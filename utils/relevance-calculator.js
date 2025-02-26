// relevance-calculator.js
// Enhanced relevance calculation with context awareness

/**
 * RelevanceCalculator class provides enhanced relevance calculation 
 * with context-aware scoring for different schema.org types
 */
class RelevanceCalculator {
  constructor() {
    this.logger = console; // Logger (can be replaced with a custom one)
    
    // Context type multipliers to adjust relevance based on context
    this.contextMultipliers = {
      personal: {
        Person: 2.0,
        Organization: 0.8,
        Question: 1.2,
        Topic: 0.8,
        default: 1.0
      },
      domain: {
        Topic: 1.8,
        Question: 1.3,
        Person: 0.5,
        Organization: 1.2,
        default: 1.0
      },
      general: {
        default: 1.0
      }
    };
    
    // Weight factors for different relevance components
    this.weights = {
      textualSimilarity: 0.5,
      semanticSimilarity: 0.3,
      temporalRecency: 0.2
    };
  }
  
  /**
   * Calculate base relevance between a query and an entity
   * @param {Object} query - The query (can be text or structured)
   * @param {Object} entity - The entity to evaluate
   * @returns {number} Base relevance score between 0 and 1
   */
  calculateBaseRelevance(query, entity) {
    this.logger.log(`Calculating base relevance between query and entity`);
    
    try {
      // Extract text from query
      let queryText = '';
      if (typeof query.data === 'string') {
        queryText = query.data;
      } else if (query.data) {
        // Handle query objects specifically
        if (query.data.type === 'query' && query.data.text) {
          queryText = query.data.text;
        } else if (query.data.query) {
          queryText = query.data.query;
        } else {
          // Extract fields that might contain query text
          queryText = Object.values(query.data)
            .filter(val => typeof val === 'string')
            .join(' ');
        }
      }
      
      // Extract text from entity
      let entityText = '';
      if (typeof entity.data === 'string') {
        entityText = entity.data;
      } else if (entity.data) {
        // For schema-typed entities, include schema type in relevance calculation
        if (entity.data.schemaType) {
          entityText += entity.data.schemaType + ' ';
          
          // Include properties for better matching
          if (entity.data.properties) {
            Object.values(entity.data.properties)
              .filter(val => typeof val === 'string' || typeof val === 'number')
              .forEach(val => {
                entityText += val + ' ';
              });
          }
        }
        
        // For content entities, prioritize title and content fields
        if (entity.data.title) entityText += entity.data.title + ' ';
        if (entity.data.content) entityText += entity.data.content + ' ';
        if (entityText.trim() === '') {
          // If no title/content, use all string fields
          entityText = Object.values(entity.data)
            .filter(val => typeof val === 'string')
            .join(' ');
        }
      }
      
      // Calculate textual similarity
      const textualScore = this.calculateTextualSimilarity(queryText, entityText);
      
      // Calculate semantic similarity if schema types are available
      const semanticScore = this.calculateSemanticSimilarity(query, entity);
      
      // Calculate temporal relevance
      const temporalScore = this.calculateTemporalRelevance(entity);
      
      // Weight and combine the scores
      const weightedScore = 
        (this.weights.textualSimilarity * textualScore) +
        (this.weights.semanticSimilarity * semanticScore) +
        (this.weights.temporalRecency * temporalScore);
      
      return Math.min(1, Math.max(0, weightedScore)); // Ensure score is between 0 and 1
      
    } catch (error) {
      this.logger.error(`Error calculating base relevance: ${error.message}`);
      return 0.1; // Return a low but non-zero default relevance
    }
  }
  
  /**
   * Apply context multipliers to base relevance score
   * @param {number} baseRelevance - Base relevance score
   * @param {string} contextType - The current context type (personal, domain, general)
   * @param {string} entityType - Entity schema.org type
   * @returns {number} The adjusted relevance score
   */
  applyContextMultipliers(baseRelevance, contextType, entityType) {
    // Get the multiplier for this context and entity type
    const contextSettings = this.contextMultipliers[contextType] || this.contextMultipliers.general;
    const multiplier = contextSettings[entityType] || contextSettings.default;
    
    // Apply the multiplier to the base relevance
    const adjustedRelevance = baseRelevance * multiplier;
    
    this.logger.log(`Applied context multiplier ${multiplier} for ${contextType}/${entityType}: ${baseRelevance} → ${adjustedRelevance}`);
    
    return Math.min(1, adjustedRelevance); // Cap at 1.0
  }
  
  /**
   * Calculate textual similarity between two pieces of text
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {number} Similarity score between 0 and 1
   */
  calculateTextualSimilarity(text1, text2) {
    // Handle very short queries as a special case
    if (text1.length < 5) {
      return 0.1; // Default low relevance for very short queries
    }
    
    // Convert to lowercase and split into words
    const words1 = text1.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const words2 = text2.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    
    // If either text has no significant words
    if (words1.length === 0 || words2.length === 0) {
      return 0.1;
    }
    
    // Count matching words
    let matchCount = 0;
    for (const word of words1) {
      if (words2.includes(word)) {
        matchCount++;
        
        // Provide additional weight for exact phrase matches
        if (text2.toLowerCase().includes(word.toLowerCase())) {
          matchCount += 0.5;
        }
      }
    }
    
    // Calculate similarity using Jaccard-inspired approach
    const uniqueWords = new Set([...words1, ...words2]);
    const similarity = uniqueWords.size > 0 ? matchCount / uniqueWords.size : 0;
    
    // For "what is X" type questions, extract the key term and check for direct matches
    const whatIsMatch = text1.match(/what\s+is\s+(\w+)/i);
    if (whatIsMatch && whatIsMatch[1]) {
      const searchTerm = whatIsMatch[1].toLowerCase();
      
      // Higher relevance if the search term appears in the text
      if (text2.toLowerCase().includes(searchTerm)) {
        // Higher relevance if the search term is in a title or key position
        if (text2.toLowerCase().indexOf(searchTerm) < 50) {
          return Math.max(similarity, 0.8);
        }
        return Math.max(similarity, 0.6);
      }
    }
    
    return similarity;
  }
  
  /**
   * Calculate semantic similarity between entities
   * @param {Object} entity1 - First entity
   * @param {Object} entity2 - Second entity
   * @returns {number} - Similarity score between 0 and 1
   */
  calculateSemanticSimilarity(entity1, entity2) {
    // Default semantic score if no schema information
    let semanticScore = 0.5;
    
    // If neither has schema types, return neutral score
    if ((!entity1.data || !entity1.data.schemaType) && 
        (!entity2.data || !entity2.data.schemaType)) {
      return semanticScore;
    }
    
    // Check for personal info queries
    const isPersonalQuery = this.isPersonalInfoQuery(entity1);
    
    // If entity2 is a Person entity and this is a personal query, high relevance
    if (entity2.data && 
        entity2.data.schemaType === 'Person' && 
        isPersonalQuery) {
      return 0.95;
    }
    
    // If we have schema types for both, calculate schema-based similarity
    if (entity1.data && entity2.data && entity2.data.schemaType) {
      // Check if entity1 has semantic entities
      if (entity1.data.semantics && entity1.data.semantics.entities) {
        // Look for entities in entity1 that match entity2's schema type
        const matchingEntities = entity1.data.semantics.entities.filter(e => 
          e.type === entity2.data.schemaType
        );
        
        if (matchingEntities.length > 0) {
          semanticScore = 0.9; // High relevance for matching schema types
        }
      } else if (entity1.data.schemaType) {
        // If entity1 also has a schema type, compare schema types
        if (entity1.data.schemaType === entity2.data.schemaType) {
          semanticScore = 0.9; // High relevance for exact type match
        } else {
          // Check for related schema types (superclass/subclass)
          const relatedTypes = this.getRelatedSchemaTypes(entity1.data.schemaType);
          if (relatedTypes.includes(entity2.data.schemaType)) {
            semanticScore = 0.7; // Good relevance for related types
          }
        }
      } else {
        // Check if entity1 text mentions entity2's schema type
        const entity1Text = typeof entity1.data === 'string' ? 
                           entity1.data : 
                           JSON.stringify(entity1.data);
                           
        if (entity1Text.toLowerCase().includes(entity2.data.schemaType.toLowerCase())) {
          semanticScore = 0.8; // Good relevance for mentioned schema types
        }
      }
      
      // If entity2 has properties that match entity1's query terms, increase score
      if (entity2.data.properties && entity1.data.text) {
        const queryTerms = entity1.data.text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
        let propertyMatchCount = 0;
        
        Object.values(entity2.data.properties).forEach(propValue => {
          if (typeof propValue === 'string') {
            const propTerms = propValue.toLowerCase().split(/\W+/).filter(w => w.length > 2);
            queryTerms.forEach(term => {
              if (propTerms.includes(term)) propertyMatchCount++;
            });
          }
        });
        
        if (propertyMatchCount > 0) {
          const propertyBoost = Math.min(0.3, propertyMatchCount * 0.1);
          semanticScore = Math.min(1.0, semanticScore + propertyBoost);
        }
      }
    }
    
    return semanticScore;
  }
  
  /**
   * Get related schema.org types for a given type
   * @param {string} schemaType - The schema.org type
   * @returns {Array} - List of related types
   */
  getRelatedSchemaTypes(schemaType) {
    // This is a simplified implementation - in a real system, 
    // this would use a full schema.org ontology
    const relatedTypesMap = {
      'Person': ['Organization', 'User', 'Contact', 'Author'],
      'Organization': ['Corporation', 'LocalBusiness', 'Person', 'Company'],
      'CreativeWork': ['Article', 'Book', 'BlogPosting', 'WebPage'],
      'Place': ['LocalBusiness', 'Address', 'Location'],
      // Add more related types as needed
    };
    
    return relatedTypesMap[schemaType] || [];
  }
  
  /**
   * Calculate temporal relevance based on entity recency
   * @param {Object} entity - The entity
   * @param {number} recencyThreshold - The recency threshold in milliseconds (default 1 hour)
   * @returns {number} Temporal relevance score
   */
  calculateTemporalRelevance(entity, recencyThreshold = 60 * 60 * 1000) {
    // Check if entity has timestamp
    if (!entity.data || !entity.data.timestamp) {
      return 0.5; // Neutral score for entities without timestamp
    }
    
    const now = Date.now();
    const entityTime = entity.data.timestamp;
    const age = now - entityTime;
    
    // For very recent entities (within threshold), high score
    if (age <= recencyThreshold) {
      // Linear decay within the threshold
      return 1.0 - (age / recencyThreshold) * 0.3; // Scale from 1.0 to 0.7
    }
    
    // For older entities, logarithmic decay
    // This ensures older entities don't drop too drastically in relevance
    const ageInHours = age / (60 * 60 * 1000);
    return Math.max(0.3, 0.7 - (0.1 * Math.log10(ageInHours + 1)));
  }
  
  /**
   * Checks if a query is asking for personal information
   * @param {Object} query - The query object
   * @returns {boolean} Whether this is a personal info query
   */
  isPersonalInfoQuery(query) {
    // Extract query text
    let queryText = '';
    if (typeof query.data === 'string') {
      queryText = query.data;
    } else if (query.data) {
      queryText = query.data.text || JSON.stringify(query.data);
    }
    
    // Personal info query patterns
    const personalInfoPatterns = [
      /what(?:'s| is) my name/i,
      /who am i/i,
      /how old am i/i,
      /what(?:'s| is) my age/i,
      /where (?:am i from|do i live)/i,
      /what(?:'s| is) my location/i,
      /tell me about (myself|me)/i,
      /my (?:name|age|info|profile)/i
    ];
    
    // Check if any pattern matches
    return personalInfoPatterns.some(pattern => pattern.test(queryText));
  }
  
  /**
   * Calculate overall relevance with context awareness
   * @param {Object} query - The query (can be text or structured)
   * @param {Object} entity - The entity to evaluate
   * @param {Object} contextInfo - Additional context information
   * @returns {number} The final relevance score
   */
  calculateRelevance(query, entity, contextInfo = {}) {
    // Calculate base relevance
    const baseRelevance = this.calculateBaseRelevance(query, entity);
    
    // Extract context type and entity type
    const contextType = contextInfo.contextType || 'general';
    const entityType = entity.data && entity.data.schemaType 
      ? entity.data.schemaType 
      : 'default';
    
    // Apply context multipliers
    const adjustedRelevance = this.applyContextMultipliers(baseRelevance, contextType, entityType);
    
    // Apply any attention weights if provided
    if (contextInfo.attentionWeight && typeof contextInfo.attentionWeight === 'number') {
      const attentionAdjusted = adjustedRelevance * (1 + contextInfo.attentionWeight * 0.5);
      return Math.min(1, attentionAdjusted);
    }
    
    return adjustedRelevance;
  }
  
  /**
   * Sorts entities by relevance
   * @param {Array} entities - Entities to sort
   * @param {Object} query - The query
   * @param {Object} contextInfo - Context information
   * @returns {Array} - Sorted entities with relevance scores
   */
  sortByRelevance(entities, query, contextInfo = {}) {
    // Calculate relevance for each entity and add the score
    const scoredEntities = entities.map(entity => {
      const score = this.calculateRelevance(query, entity, contextInfo);
      return { entity, score };
    });
    
    // Sort by score in descending order
    scoredEntities.sort((a, b) => b.score - a.score);
    
    this.logger.log(`Sorted ${entities.length} entities by relevance`);
    
    return scoredEntities;
  }
}

export default RelevanceCalculator;