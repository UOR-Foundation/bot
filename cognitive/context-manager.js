// cognitive/context-manager.js
// Tracks conversation context and manages topic transitions for the bot

/**
 * ContextManager class maintains conversation state and handles context detection/transitions
 */
class ContextManager {
    constructor(knowledgeGraph) {
      this.knowledgeGraph = knowledgeGraph;
      this.currentContext = {
        type: 'general',
        confidence: 1.0,
        entities: [],
        timestamp: Date.now()
      };
      this.contextHistory = []; // Tracks recent context transitions
      this.maxHistoryLength = 10; // Maximum context transitions to remember
      this.logger = console; // Logger (can be replaced with a custom one)
      
      // Context types with associated keywords for detection
      this.contextTypes = {
        personal: {
          keywords: ['my', 'i', 'me', 'mine', 'name', 'age', 'birthday', 'family'],
          confidenceThreshold: 0.6
        },
        technical: {
          keywords: ['how', 'works', 'system', 'function', 'code', 'program', 'technology'],
          confidenceThreshold: 0.7
        },
        informational: {
          keywords: ['what', 'who', 'when', 'where', 'why', 'tell me about', 'information'],
          confidenceThreshold: 0.5
        },
        general: {
          keywords: ['hello', 'hi', 'greetings', 'thanks', 'okay', 'yes', 'no'],
          confidenceThreshold: 0.3
        }
      };
    }
  
    /**
     * Updates the conversation context based on semantics
     * @param {Object} semantics - Semantic understanding of the query
     * @param {string} currentQuery - The current user query text
     * @returns {Object} - Updated context information
     */
    async updateContext(semantics, currentQuery) {
      this.logger.log(`Updating context based on query: "${currentQuery}"`);
      
      // Get the previous context type
      const previousContextType = this.currentContext.type;
      
      // Detect new context from semantics
      const newContext = this.detectContextFromSemantics(semantics);
      
      // Check if this represents a context transition
      const isTransition = this.isContextTransition(newContext);
      
      // If context has changed significantly, record the transition
      if (isTransition) {
        const transition = {
          from: previousContextType,
          to: newContext.type,
          confidence: newContext.confidence,
          timestamp: Date.now(),
          query: currentQuery
        };
        
        // Add to history
        this.contextHistory.unshift(transition);
        
        // Trim history if needed
        if (this.contextHistory.length > this.maxHistoryLength) {
          this.contextHistory.pop();
        }
        
        this.logger.log(`Context transition: ${previousContextType} → ${newContext.type} (confidence: ${newContext.confidence.toFixed(2)})`);
      }
      
      // Update the current context
      this.currentContext = {
        type: newContext.type,
        confidence: newContext.confidence,
        entities: newContext.entities || [],
        timestamp: Date.now(),
        previousType: isTransition ? previousContextType : this.currentContext.previousType
      };
      
      // Link the context to relevant entities if we have entity IDs
      if (newContext.entities && newContext.entities.length > 0) {
        await this.linkContextToEntities(newContext.type, newContext.entities);
      }
      
      return {
        type: this.currentContext.type,
        confidence: this.currentContext.confidence,
        isTransition: isTransition,
        previousType: this.currentContext.previousType
      };
    }
  
    /**
     * Detects context from semantics
     * @param {Object} semantics - Semantic understanding of the query
     * @returns {Object} - Detected context with confidence
     */
    detectContextFromSemantics(semantics) {
      this.logger.log(`Detecting context from semantics`);
      
      // Calculate scores for each context type
      const scores = {};
      const entities = [];
      
      // Score based on entities in semantics
      if (semantics.entities && semantics.entities.length > 0) {
        semantics.entities.forEach(entity => {
          // Add entity ID to list
          if (entity.id) {
            entities.push(entity.id);
          }
          
          // Check entity type for context hints
          if (entity.type === 'Person') {
            scores.personal = (scores.personal || 0) + 0.4;
          } else if (entity.type === 'Question') {
            // Look at question properties
            if (entity.properties && entity.properties.isPersonalQuestion) {
              scores.personal = (scores.personal || 0) + 0.6;
            } else {
              scores.informational = (scores.informational || 0) + 0.3;
            }
          } else if (entity.type === 'Topic') {
            // Topic entities might indicate technical or informational context
            if (entity.properties && entity.properties.name) {
              const topicName = entity.properties.name.toLowerCase();
              
              // Check if topic matches technical keywords
              if (this.contextTypes.technical.keywords.some(kw => topicName.includes(kw))) {
                scores.technical = (scores.technical || 0) + 0.5;
              } else {
                scores.informational = (scores.informational || 0) + 0.4;
              }
            }
          }
        });
      }
      
      // Score based on intents
      if (semantics.intents && semantics.intents.length > 0) {
        semantics.intents.forEach(intent => {
          if (intent.type === 'greet' || intent.type === 'farewell') {
            scores.general = (scores.general || 0) + 0.7 * (intent.confidence || 1.0);
          } else if (intent.type === 'question') {
            scores.informational = (scores.informational || 0) + 0.5 * (intent.confidence || 1.0);
          } else if (intent.type === 'inform' && intent.category === 'personal_info') {
            scores.personal = (scores.personal || 0) + 0.8 * (intent.confidence || 1.0);
          }
        });
      }
      
      // Score based on original query text keywords
      if (semantics.original) {
        const lowerQuery = semantics.original.toLowerCase();
        
        // Check each context type for keyword matches
        Object.entries(this.contextTypes).forEach(([type, data]) => {
          const matchCount = data.keywords.filter(kw => lowerQuery.includes(kw)).length;
          if (matchCount > 0) {
            // More matches = higher confidence, diminishing returns
            const keywordScore = Math.min(0.1 * matchCount, 0.5);
            scores[type] = (scores[type] || 0) + keywordScore;
          }
        });
        
        // Very short queries are likely general context
        if (lowerQuery.split(' ').length <= 3) {
          scores.general = (scores.general || 0) + 0.3;
        }
      }
      
      // Add base scores for all context types to ensure they all have a value
      Object.keys(this.contextTypes).forEach(type => {
        scores[type] = scores[type] || 0.1;
      });
      
      // Find the context type with the highest score
      let maxType = 'general';
      let maxScore = 0;
      
      Object.entries(scores).forEach(([type, score]) => {
        if (score > maxScore) {
          maxType = type;
          maxScore = score;
        }
      });
      
      // If the top score doesn't meet the threshold for that type, default to general
      if (maxScore < (this.contextTypes[maxType]?.confidenceThreshold || 0.5)) {
        this.logger.log(`No strong context detected, defaulting to general context`);
        maxType = 'general';
        maxScore = Math.max(0.5, scores.general || 0);
      }
      
      // Cap confidence at 1.0
      const confidence = Math.min(1.0, maxScore);
      
      this.logger.log(`Detected context: ${maxType} with confidence ${confidence.toFixed(2)}`);
      
      return {
        type: maxType,
        confidence: confidence,
        entities: entities
      };
    }
  
    /**
     * Determines if a context transition has occurred
     * @param {Object} newContext - Newly detected context
     * @returns {boolean} - True if context has changed significantly
     */
    isContextTransition(newContext) {
      // If context type has changed, it's definitely a transition
      if (newContext.type !== this.currentContext.type) {
        // Only consider it a transition if the new context has reasonable confidence
        return newContext.confidence >= this.contextTypes[newContext.type]?.confidenceThreshold || 0.5;
      }
      
      // Even if type hasn't changed, a significant confidence change could indicate transition
      const confidenceChange = Math.abs(newContext.confidence - this.currentContext.confidence);
      if (confidenceChange > 0.3) {
        return true;
      }
      
      // No significant change detected
      return false;
    }
  
    /**
     * Links context to relevant entities in the knowledge graph
     * @param {string} contextType - The type of context
     * @param {Array} relevantEntities - IDs of relevant entities
     * @returns {Promise<void>}
     */
    async linkContextToEntities(contextType, relevantEntities) {
      this.logger.log(`Linking ${contextType} context to ${relevantEntities.length} entities`);
      
      try {
        // Create a context entity if it doesn't exist already
        const contextEntity = {
          '@type': 'ConversationContext',
          'contextType': contextType,
          'confidence': this.currentContext.confidence,
          'timestamp': Date.now()
        };
        
        // Add to knowledge graph
        const contextEntityResult = await this.knowledgeGraph.createEntity(
          contextEntity, 
          'system', 
          this.currentContext.confidence
        );
        
        // Link this context to relevant entities
        if (contextEntityResult && contextEntityResult.id) {
          for (const entityId of relevantEntities) {
            await this.knowledgeGraph.createRelationship(
              contextEntityResult.id,
              entityId,
              'refersTo',
              'system',
              this.currentContext.confidence
            );
          }
        }
      } catch (error) {
        this.logger.error(`Error linking context to entities: ${error.message}`);
      }
    }
  
    /**
     * Gets the current conversation context
     * @returns {Object} - The current context information
     */
    getCurrentContext() {
      return {
        ...this.currentContext,
        age: Date.now() - this.currentContext.timestamp // How long this context has been active
      };
    }
  
    /**
     * Gets context history
     * @param {number} limit - Maximum number of history items
     * @returns {Array} - Context history
     */
    getContextHistory(limit = 5) {
      // Return a copy of the history limited to the requested amount
      return this.contextHistory.slice(0, Math.min(limit, this.contextHistory.length));
    }
    
    /**
     * Calculates context score for a specific context type
     * @param {Object} semantics - The semantic understanding
     * @param {string} contextType - The context type to calculate score for
     * @returns {number} - Score between 0 and 1
     */
    calculateContextScore(semantics, contextType) {
      let score = 0;
      let factors = 0;
      
      // Implementation similar to detectContextFromSemantics but for a specific type
      // This can be used for more granular context analysis
      
      // Check entities
      if (semantics.entities) {
        if (contextType === 'personal' && 
            semantics.entities.some(e => e.type === 'Person')) {
          score += 0.4;
          factors++;
        }
        
        // More context-type specific checks would go here
      }
      
      // Check intents
      if (semantics.intents) {
        // Implementation depends on context type
      }
      
      // Check original text
      if (semantics.original) {
        const keywords = this.contextTypes[contextType]?.keywords || [];
        const matchCount = keywords.filter(kw => 
          semantics.original.toLowerCase().includes(kw)
        ).length;
        
        if (matchCount > 0) {
          score += Math.min(0.1 * matchCount, 0.5);
          factors++;
        }
      }
      
      // Calculate final score
      return factors > 0 ? score / factors : 0.1;
    }
  }
  
  module.exports = ContextManager;