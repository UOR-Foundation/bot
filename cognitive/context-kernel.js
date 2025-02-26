// cognitive/context-kernel.js
// Implements UOR-native context management as a specialized kernel

/**
 * ContextKernel class maintains and manages conversational context
 * using the UOR knowledge graph structure
 */
class ContextKernel {
  constructor(uorCortex) {
    this.uorCortex = uorCortex;
    this.logger = console; // Logger (can be replaced with a custom one)
    this.contextHistory = []; // Stores historical context changes for tracking
    this.currentContextKernelRef = null; // Reference to the current context kernel
    this.contextTypes = {
      PERSONAL: 'personal',
      DOMAIN: 'domain',
      GENERAL: 'general'
    };
  }

  /**
   * Creates or retrieves the context kernel from the UOR graph
   * @returns {Object} The context kernel reference and kernel object
   */
  async createOrRetrieveContextKernel() {
    this.logger.log("Creating or retrieving context kernel");
    
    // Check if we already have a context kernel reference
    if (this.currentContextKernelRef) {
      try {
        // Try to retrieve the existing kernel
        const kernel = this.uorCortex.retrieveObject(this.currentContextKernelRef);
        return { kernelReference: this.currentContextKernelRef, kernel };
      } catch (error) {
        this.logger.error(`Error retrieving context kernel: ${error.message}`);
        // Continue to create a new one if retrieval fails
      }
    }

    // Find if any context kernel already exists in the UOR graph
    const allKernels = this.uorCortex.getAllKernels();
    const existingContextKernel = allKernels.find(k => 
      k.data && k.data.schemaType === 'ConversationContext'
    );

    if (existingContextKernel) {
      this.currentContextKernelRef = existingContextKernel.reference;
      this.logger.log(`Found existing context kernel: ${this.currentContextKernelRef}`);
      return { 
        kernelReference: this.currentContextKernelRef, 
        kernel: existingContextKernel 
      };
    }

    // Create a new context kernel if none exists
    const contextKernel = this.uorCortex.createKernel({
      schemaType: 'ConversationContext',
      properties: {
        type: this.contextTypes.GENERAL, // Default to general context
        confidence: 1.0,
        timestamp: Date.now(),
        transitions: [], // Track context transitions
        activeSince: Date.now()
      },
      metaData: {
        isContextKernel: true,
        priority: 1.0  // High priority for context kernels
      }
    });

    this.currentContextKernelRef = contextKernel.kernelReference;
    this.logger.log(`Created new context kernel: ${this.currentContextKernelRef}`);
    
    return contextKernel;
  }

  /**
   * Updates the conversation context based on semantics analysis
   * @param {Object} semantics - The semantic structure from query analysis
   * @param {string} currentQuery - The current user query text
   * @returns {Object} Updated context info
   */
  async updateContext(semantics, currentQuery) {
    this.logger.log(`Updating context from semantics for query: "${currentQuery}"`);
    
    // Get the current context kernel
    const contextKernel = await this.createOrRetrieveContextKernel();
    
    // Detect context from semantics
    const newContextInfo = this.detectContextFromSemantics(semantics);
    const oldContextType = contextKernel.kernel.data.properties.type;
    
    // Check if the context has changed
    const contextChanged = oldContextType !== newContextInfo.type;
    
    // Record context transition if changed
    if (contextChanged) {
      const transition = {
        from: oldContextType,
        to: newContextInfo.type,
        timestamp: Date.now(),
        query: currentQuery
      };
      
      // Add the transition to history
      this.contextHistory.push(transition);
      
      // Keep only the last 10 transitions
      if (this.contextHistory.length > 10) {
        this.contextHistory.shift();
      }
      
      this.logger.log(`Context transition: ${oldContextType} -> ${newContextInfo.type}`);
      
      // Update the kernel with the new context
      const updatedKernel = this.uorCortex.createKernel({
        schemaType: 'ConversationContext',
        properties: {
          type: newContextInfo.type,
          confidence: newContextInfo.confidence,
          timestamp: Date.now(),
          transitions: [...(contextKernel.kernel.data.properties.transitions || []), transition],
          activeSince: Date.now(),
          previousContext: oldContextType
        },
        metaData: {
          isContextKernel: true,
          priority: 1.0
        }
      });
      
      this.currentContextKernelRef = updatedKernel.kernelReference;
      
      // Link the context to relevant kernels
      await this.linkContextToRelevantKernels(this.currentContextKernelRef, newContextInfo);
      
      return {
        contextKernelRef: this.currentContextKernelRef,
        type: newContextInfo.type,
        confidence: newContextInfo.confidence,
        changed: true,
        previousType: oldContextType
      };
    } else {
      // Context hasn't changed, just update confidence and timestamp
      const updatedKernel = this.uorCortex.createKernel({
        schemaType: 'ConversationContext',
        properties: {
          ...contextKernel.kernel.data.properties,
          confidence: newContextInfo.confidence,
          timestamp: Date.now()
        },
        metaData: {
          isContextKernel: true,
          priority: 1.0
        }
      });
      
      this.currentContextKernelRef = updatedKernel.kernelReference;
      
      return {
        contextKernelRef: this.currentContextKernelRef,
        type: newContextInfo.type,
        confidence: newContextInfo.confidence,
        changed: false,
        previousType: oldContextType
      };
    }
  }

  /**
   * Detects the type of context from semantic understanding
   * @param {Object} semantics - The semantic structure
   * @returns {Object} The detected context type and confidence
   */
  detectContextFromSemantics(semantics) {
    this.logger.log(`Detecting context from semantics with ${semantics.entities.length} entities and ${semantics.intents.length} intents`);
    
    // Calculate scores for each context type
    const personalScore = this.getContextScore(this.contextTypes.PERSONAL, semantics);
    const domainScore = this.getContextScore(this.contextTypes.DOMAIN, semantics);
    const generalScore = this.getContextScore(this.contextTypes.GENERAL, semantics);
    
    this.logger.log(`Context scores: Personal=${personalScore.toFixed(2)}, Domain=${domainScore.toFixed(2)}, General=${generalScore.toFixed(2)}`);
    
    // Find the highest scoring context
    let contextType = this.contextTypes.GENERAL;
    let confidence = generalScore;
    
    if (personalScore > domainScore && personalScore > generalScore) {
      contextType = this.contextTypes.PERSONAL;
      confidence = personalScore;
    } else if (domainScore > personalScore && domainScore > generalScore) {
      contextType = this.contextTypes.DOMAIN;
      confidence = domainScore;
    }
    
    return { type: contextType, confidence };
  }

  /**
   * Calculates a context score based on semantic analysis
   * @param {string} contextType - The type of context to score
   * @param {Object} semantics - The semantic structure
   * @returns {number} The context score (0-1)
   */
  getContextScore(contextType, semantics) {
    let score = 0;
    
    switch (contextType) {
      case this.contextTypes.PERSONAL:
        // Check for Person entities
        const personEntities = semantics.entities.filter(e => e.type === 'Person');
        if (personEntities.length > 0) {
          score += 0.6;
        }
        
        // Check for personal pronouns in the query
        if (semantics.original && semantics.original.match(/\b(my|me|i|mine)\b/i)) {
          score += 0.3;
        }
        
        // Check for personal info questions
        const personalQuestions = semantics.entities.filter(e => 
          e.type === 'Question' && 
          e.properties && 
          e.properties.isPersonalQuestion
        );
        if (personalQuestions.length > 0) {
          score += 0.7;
        }
        
        // Check for inform intents with personal category
        const personalInforms = semantics.intents.filter(i => 
          i.type === 'inform' && 
          i.category === 'personal_info'
        );
        if (personalInforms.length > 0) {
          score += 0.6;
        }
        
        break;
        
      case this.contextTypes.DOMAIN:
        // Domain-specific keywords for the UOR framework
        const domainKeywords = [
          'uor', 'framework', 'bot', 'knowledge', 'semantic', 'context',
          'memory', 'token', 'limit', 'traversal', 'lattice', 'kernel',
          'graph', 'reference', 'universal', 'object'
        ];
        
        // Check for domain keywords in the query
        if (semantics.original) {
          const queryLower = semantics.original.toLowerCase();
          const matchedKeywords = domainKeywords.filter(kw => queryLower.includes(kw));
          score += Math.min(0.7, matchedKeywords.length * 0.15);
        }
        
        // Check for Topic entities related to domain
        const domainTopics = semantics.entities.filter(e => 
          e.type === 'Topic' && 
          e.properties && 
          domainKeywords.some(kw => 
            e.properties.name && 
            e.properties.name.toLowerCase().includes(kw)
          )
        );
        if (domainTopics.length > 0) {
          score += 0.5;
        }
        
        // Check for question intents (domain explanations)
        const questionIntents = semantics.intents.filter(i => i.type === 'question');
        if (questionIntents.length > 0) {
          score += 0.3;
        }
        
        break;
        
      case this.contextTypes.GENERAL:
        // General context is the fallback - start with a base score
        score = 0.5;
        
        // Reduce score if we have strong signals for other contexts
        const hasPersonalSignals = semantics.entities.some(e => e.type === 'Person') ||
                                  semantics.original && semantics.original.match(/\b(my|me|i|mine)\b/i);
        
        const hasDomainSignals = semantics.original && domainKeywords.some(kw => 
          semantics.original.toLowerCase().includes(kw)
        );
        
        if (hasPersonalSignals) score -= 0.2;
        if (hasDomainSignals) score -= 0.2;
        
        // Greetings are generally in general context
        const greetIntents = semantics.intents.filter(i => i.type === 'greet');
        if (greetIntents.length > 0) {
          score += 0.3;
        }
        
        break;
    }
    
    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Links the context kernel to other relevant kernels in the graph
   * @param {string} contextKernelRef - The reference to the context kernel
   * @param {Object} contextInfo - Information about the context
   */
  async linkContextToRelevantKernels(contextKernelRef, contextInfo) {
    this.logger.log(`Linking context kernel ${contextKernelRef} to relevant kernels`);
    
    // Get all kernels
    const allKernels = this.uorCortex.getAllKernels();
    
    try {
      // Link to conversation kernel (if it exists)
      const conversationKernel = allKernels.find(k => 
        k.data && k.data.schemaType === 'Conversation'
      );
      
      if (conversationKernel) {
        this.uorCortex.linkObjects(
          contextKernelRef,
          conversationKernel.reference,
          'contextFor'
        );
        this.logger.log(`Linked context to conversation kernel ${conversationKernel.reference}`);
      }
      
      // Link to appropriate entity kernels based on context type
      switch (contextInfo.type) {
        case this.contextTypes.PERSONAL:
          // Link to Person kernels
          const personKernels = allKernels.filter(k => 
            k.data && k.data.schemaType === 'Person'
          );
          
          for (const person of personKernels) {
            this.uorCortex.linkObjects(
              contextKernelRef,
              person.reference,
              'focusesOn'
            );
            this.logger.log(`Linked personal context to Person kernel ${person.reference}`);
          }
          break;
          
        case this.contextTypes.DOMAIN:
          // Link to domain knowledge kernels (like "UOR Framework" kernel)
          const domainKernels = allKernels.filter(k => 
            k.data && k.data.title && (
              k.data.title.toLowerCase().includes('uor') ||
              k.data.title.toLowerCase().includes('framework') ||
              k.data.title.toLowerCase().includes('context') ||
              k.data.title.toLowerCase().includes('token')
            )
          );
          
          for (const domain of domainKernels) {
            this.uorCortex.linkObjects(
              contextKernelRef,
              domain.reference,
              'focusesOn'
            );
            this.logger.log(`Linked domain context to knowledge kernel ${domain.reference}`);
          }
          break;
          
        case this.contextTypes.GENERAL:
          // For general context, we might not need specific links
          // But we could link to recent kernels to maintain recency
          const recentKernels = allKernels
            .filter(k => k.data && k.data.timestamp)
            .sort((a, b) => (b.data.timestamp || 0) - (a.data.timestamp || 0))
            .slice(0, 3); // Just the 3 most recent
          
          for (const recent of recentKernels) {
            this.uorCortex.linkObjects(
              contextKernelRef,
              recent.reference,
              'references'
            );
            this.logger.log(`Linked general context to recent kernel ${recent.reference}`);
          }
          break;
      }
    } catch (error) {
      this.logger.error(`Error linking context kernel: ${error.message}`);
    }
  }

  /**
   * Gets the current conversation context
   * @returns {Object} The current context information
   */
  getCurrentContext() {
    if (!this.currentContextKernelRef) {
      return {
        type: this.contextTypes.GENERAL,
        confidence: 1.0,
        exists: false
      };
    }
    
    try {
      const contextKernel = this.uorCortex.retrieveObject(this.currentContextKernelRef);
      
      return {
        type: contextKernel.data.properties.type,
        confidence: contextKernel.data.properties.confidence,
        timestamp: contextKernel.data.properties.timestamp,
        activeSince: contextKernel.data.properties.activeSince,
        kernelRef: this.currentContextKernelRef,
        exists: true
      };
    } catch (error) {
      this.logger.error(`Error getting current context: ${error.message}`);
      return {
        type: this.contextTypes.GENERAL,
        confidence: 1.0,
        exists: false
      };
    }
  }

  /**
   * Gets the history of context transitions
   * @param {number} limit - Maximum number of transitions to return
   * @returns {Array} Context transition history
   */
  getContextHistory(limit = 5) {
    // Return a copy of the history limited to the requested amount
    return [...this.contextHistory].slice(-limit);
  }
}

export default ContextKernel;
