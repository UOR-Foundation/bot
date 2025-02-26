// relevance-calculator.js
// Enhanced relevance calculation with context awareness

/**
 * RelevanceCalculator class provides enhanced relevance calculation 
 * with context-aware scoring for different kernel types
 */
class RelevanceCalculator {
  constructor() {
    this.logger = console; // Logger (can be replaced with a custom one)
    
    // Context type multipliers to adjust relevance based on context
    this.contextMultipliers = {
      personal: {
        Person: 2.0,
        Question: 1.2,
        Topic: 0.8,
        default: 1.0
      },
      domain: {
        Topic: 1.8,
        Question: 1.3,
        Person: 0.5,
        default: 1.0
      },
      general: {
        default: 1.0
      }
    };
    
    // Weight factors for different relevance components
    this.weights = {
      textualSimilarity: 0.5,
      schemaTypeMatch: 0.3,
      temporalRecency: 0.2
    };
  }
  
  /**
   * Calculate base relevance between a query kernel and a candidate kernel
   * @param {Object} queryKernel - The query kernel
   * @param {Object} candidateKernel - The candidate kernel to evaluate
   * @returns {number} Base relevance score between 0 and 1
   */
  calculateBaseRelevance(queryKernel, candidateKernel) {
    this.logger.log(`Calculating base relevance between query and candidate kernel`);
    
    try {
      // Extract text from query kernel
      let queryText = '';
      if (typeof queryKernel.data === 'string') {
        queryText = queryKernel.data;
      } else if (queryKernel.data) {
        // Handle query objects specifically
        if (queryKernel.data.type === 'query' && queryKernel.data.text) {
          queryText = queryKernel.data.text;
        } else if (queryKernel.data.query) {
          queryText = queryKernel.data.query;
        } else {
          // Extract fields that might contain query text
          queryText = Object.values(queryKernel.data)
            .filter(val => typeof val === 'string')
            .join(' ');
        }
      }
      
      // Extract text from candidate kernel
      let candidateText = '';
      if (typeof candidateKernel.data === 'string') {
        candidateText = candidateKernel.data;
      } else if (candidateKernel.data) {
        // For schema-typed kernels, include schema type in relevance calculation
        if (candidateKernel.data.schemaType) {
          candidateText += candidateKernel.data.schemaType + ' ';
          
          // Include properties for better matching
          if (candidateKernel.data.properties) {
            Object.values(candidateKernel.data.properties)
              .filter(val => typeof val === 'string' || typeof val === 'number')
              .forEach(val => {
                candidateText += val + ' ';
              });
          }
        }
        
        // For content kernels, prioritize title and content fields
        if (candidateKernel.data.title) candidateText += candidateKernel.data.title + ' ';
        if (candidateKernel.data.content) candidateText += candidateKernel.data.content + ' ';
        if (candidateText.trim() === '') {
          // If no title/content, use all string fields
          candidateText = Object.values(candidateKernel.data)
            .filter(val => typeof val === 'string')
            .join(' ');
        }
      }
      
      // Calculate textual similarity
      const textualScore = this.calculateTextualSimilarity(queryText, candidateText);
      
      // Calculate schema type relevance
      const schemaScore = this.calculateSchemaTypeRelevance(queryKernel, candidateKernel);
      
      // Calculate temporal relevance
      const temporalScore = this.calculateTemporalRelevance(candidateKernel);
      
      // Weight and combine the scores
      const weightedScore = 
        (this.weights.textualSimilarity * textualScore) +
        (this.weights.schemaTypeMatch * schemaScore) +
        (this.weights.temporalRecency * temporalScore);
      
      return Math.min(1, Math.max(0, weightedScore)); // Ensure score is between 0 and 1
      
    } catch (error) {
      this.logger.error(`Error calculating base relevance: ${error.message}`);
      return 0.1; // Return a low but non-zero default relevance
    }
  }
  
  /**
   * Apply context multipliers to base relevance score
   * @param {number} baseRelevance - The base relevance score
   * @param {string} contextType - The current context type (personal, domain, general)
   * @param {string} kernelType - The kernel type to adjust for
   * @returns {number} The adjusted relevance score
   */
  applyContextMultipliers(baseRelevance, contextType, kernelType) {
    // Get the multiplier for this context and kernel type
    const contextSettings = this.contextMultipliers[contextType] || this.contextMultipliers.general;
    const multiplier = contextSettings[kernelType] || contextSettings.default;
    
    // Apply the multiplier to the base relevance
    const adjustedRelevance = baseRelevance * multiplier;
    
    this.logger.log(`Applied context multiplier ${multiplier} for ${contextType}/${kernelType}: ${baseRelevance} → ${adjustedRelevance}`);
    
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
   * Calculate relevance based on schema type matching
   * @param {Object} queryKernel - The query kernel
   * @param {Object} candidateKernel - The candidate kernel
   * @returns {number} Schema type relevance score
   */
  calculateSchemaTypeRelevance(queryKernel, candidateKernel) {
    // Default schema score
    let schemaScore = 0.5;
    
    // If neither has schema types, neutral score
    if ((!queryKernel.data || !queryKernel.data.schemaType) && 
        (!candidateKernel.data || !candidateKernel.data.schemaType)) {
      return schemaScore;
    }
    
    // Check for personal info queries
    const isPersonalQuery = this.isPersonalInfoQuery(queryKernel);
    
    // If candidate is a Person kernel and this is a personal query, high relevance
    if (candidateKernel.data && 
        candidateKernel.data.schemaType === 'Person' && 
        isPersonalQuery) {
      return 0.95;
    }
    
    // If we have schema types for both, check if they match or are related
    if (queryKernel.data && 
        queryKernel.data.semantics && 
        queryKernel.data.semantics.entities && 
        candidateKernel.data && 
        candidateKernel.data.schemaType) {
      
      // Look for entities in the query that match the candidate's schema type
      const matchingEntities = queryKernel.data.semantics.entities.filter(entity => 
        entity.type === candidateKernel.data.schemaType
      );
      
      if (matchingEntities.length > 0) {
        schemaScore = 0.9; // High relevance for matching schema types
      } else {
        // Check if the query mentions the schema type name
        const queryText = queryKernel.data.text || '';
        if (queryText.toLowerCase().includes(candidateKernel.data.schemaType.toLowerCase())) {
          schemaScore = 0.8; // Good relevance for mentioned schema types
        }
      }
    }
    
    return schemaScore;
  }
  
  /**
   * Calculate temporal relevance based on kernel recency
   * @param {Object} candidateKernel - The candidate kernel
   * @param {number} recencyThreshold - The recency threshold in milliseconds (default 1 hour)
   * @returns {number} Temporal relevance score
   */
  calculateTemporalRelevance(candidateKernel, recencyThreshold = 60 * 60 * 1000) {
    // Check if kernel has timestamp
    if (!candidateKernel.data || !candidateKernel.data.timestamp) {
      return 0.5; // Neutral score for kernels without timestamp
    }
    
    const now = Date.now();
    const kernelTime = candidateKernel.data.timestamp;
    const age = now - kernelTime;
    
    // For very recent kernels (within threshold), high score
    if (age <= recencyThreshold) {
      // Linear decay within the threshold
      return 1.0 - (age / recencyThreshold) * 0.3; // Scale from 1.0 to 0.7
    }
    
    // For older kernels, logarithmic decay
    // This ensures older kernels don't drop too drastically in relevance
    const ageInHours = age / (60 * 60 * 1000);
    return Math.max(0.3, 0.7 - (0.1 * Math.log10(ageInHours + 1)));
  }
  
  /**
   * Checks if a query is asking for personal information
   * @param {Object} queryKernel - The query kernel
   * @returns {boolean} Whether this is a personal info query
   */
  isPersonalInfoQuery(queryKernel) {
    // Extract query text
    let queryText = '';
    if (typeof queryKernel.data === 'string') {
      queryText = queryKernel.data;
    } else if (queryKernel.data) {
      queryText = queryKernel.data.text || JSON.stringify(queryKernel.data);
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
   * @param {Object} queryKernel - The query kernel
   * @param {Object} candidateKernel - The candidate kernel
   * @param {Object} contextInfo - Additional context information
   * @returns {number} The final relevance score
   */
  calculateRelevance(queryKernel, candidateKernel, contextInfo = {}) {
    // Calculate base relevance
    const baseRelevance = this.calculateBaseRelevance(queryKernel, candidateKernel);
    
    // Extract context type and kernel type
    const contextType = contextInfo.contextType || 'general';
    const kernelType = candidateKernel.data && candidateKernel.data.schemaType 
      ? candidateKernel.data.schemaType 
      : 'default';
    
    // Apply context multipliers
    const adjustedRelevance = this.applyContextMultipliers(baseRelevance, contextType, kernelType);
    
    // Apply any attention weights if provided
    if (contextInfo.attentionWeight && typeof contextInfo.attentionWeight === 'number') {
      const attentionAdjusted = adjustedRelevance * (1 + contextInfo.attentionWeight * 0.5);
      return Math.min(1, attentionAdjusted);
    }
    
    return adjustedRelevance;
  }
}

export default RelevanceCalculator;