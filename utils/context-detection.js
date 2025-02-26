// utils/context-detection.js
// Utility for detecting conversation context from semantic data

/**
 * ContextDetection provides utilities for analyzing semantics and determining
 * the current conversational context.
 */
class ContextDetection {
  constructor() {
    this.logger = console; // Logger (can be replaced with a custom one)
    
    // Context type definitions with keywords and patterns
    this.contextDefinitions = {
      personal: {
        keywords: ['my', 'i', 'me', 'mine', 'name', 'age', 'location', 'birthday'],
        patterns: [
          /\b(my|i|me|mine)\b/i,
          /\b(name|age|location|address|phone|email)\b/i,
          /who am i/i,
          /where am i from/i,
          /how old am i/i
        ]
      },
      domain: {
        keywords: ['uor', 'framework', 'token', 'context', 'kernel', 'memory', 'graph', 
                  'traversal', 'lattice', 'schema', 'semantic', 'entity', 'relationship'],
        patterns: [
          /\b(uor|framework|token|context|kernel)\b/i,
          /\b(memory|graph|traversal|lattice)\b/i,
          /\b(schema|semantic|entity|relationship)\b/i,
          /how does (this|the bot|the system) work/i
        ]
      },
      general: {
        keywords: ['hello', 'hi', 'hey', 'help', 'thanks', 'goodbye', 'bye'],
        patterns: [
          /^(hi|hello|hey|greetings)/i,
          /^(goodbye|bye|see you)/i,
          /thank you/i,
          /help me/i
        ]
      }
    };
  }

  /**
   * Checks if semantics have a personal context
   * @param {Object} semantics - The semantic understanding
   * @returns {boolean} - True if personal context is detected
   */
  hasPersonalContext(semantics) {
    // Check if there's a Person entity with properties
    const hasPersonEntity = semantics.entities.some(entity => 
      entity.type === 'Person' && entity.properties && Object.keys(entity.properties).length > 0
    );
    
    // Check if there's a Question about personal properties
    const hasPersonalQuestion = semantics.entities.some(entity =>
      entity.type === 'Question' && 
      entity.properties && 
      entity.properties.isPersonalQuestion
    );
    
    // Check for personal intent
    const hasPersonalIntent = semantics.intents.some(intent =>
      intent.type === 'inform' && intent.category === 'personal_info'
    );
    
    // Check for personal pronouns or keywords in the original text
    const text = semantics.original || '';
    const hasPersonalKeywords = this.contextDefinitions.personal.patterns.some(pattern =>
      pattern.test(text)
    );
    
    return hasPersonEntity || hasPersonalQuestion || hasPersonalIntent || hasPersonalKeywords;
  }

  /**
   * Checks if semantics have a domain-specific knowledge context
   * @param {Object} semantics - The semantic understanding
   * @returns {boolean} - True if domain context is detected
   */
  hasDomainContext(semantics) {
    // Check if there are Topic entities related to domain keywords
    const hasDomainTopic = semantics.entities.some(entity =>
      entity.type === 'Topic' && 
      entity.properties && 
      entity.properties.name && 
      this.contextDefinitions.domain.keywords.some(keyword => 
        entity.properties.name.toLowerCase().includes(keyword.toLowerCase())
      )
    );
    
    // Check for domain-specific questions
    const hasDomainQuestion = semantics.entities.some(entity =>
      entity.type === 'Question' && 
      entity.properties && 
      entity.properties.about && 
      this.contextDefinitions.domain.keywords.some(keyword => 
        entity.properties.about.toLowerCase().includes(keyword.toLowerCase())
      )
    );
    
    // Check for domain keywords in the original text
    const text = semantics.original || '';
    const hasDomainKeywords = this.contextDefinitions.domain.patterns.some(pattern =>
      pattern.test(text)
    );
    
    return hasDomainTopic || hasDomainQuestion || hasDomainKeywords;
  }

  /**
   * Checks if semantics have a general conversational context
   * @param {Object} semantics - The semantic understanding
   * @returns {boolean} - True if general context is detected
   */
  hasGeneralContext(semantics) {
    // Check for general intents like greetings
    const hasGeneralIntent = semantics.intents.some(intent =>
      ['greet', 'farewell', 'thank', 'help'].includes(intent.type)
    );
    
    // Check for very short queries
    const text = semantics.original || '';
    const isShortQuery = text.split(' ').length <= 3;
    
    // Check for general conversation patterns
    const hasGeneralPattern = this.contextDefinitions.general.patterns.some(pattern =>
      pattern.test(text)
    );
    
    // If no specific context is detected, default to general
    const noSpecificContext = !this.hasPersonalContext(semantics) && 
                             !this.hasDomainContext(semantics);
    
    return hasGeneralIntent || hasGeneralPattern || (isShortQuery && noSpecificContext);
  }

  /**
   * Calculate confidence score for a specific context type
   * @param {Object} semantics - The semantic understanding
   * @param {string} contextType - The context type to calculate confidence for
   * @returns {number} - Confidence score between 0 and 1
   */
  calculateContextConfidence(semantics, contextType) {
    const text = semantics.original || '';
    let score = 0;
    let factors = 0;
    
    // Check for context-specific entities
    if (contextType === 'personal') {
      // Count Person entities
      const personEntities = semantics.entities.filter(entity => entity.type === 'Person');
      if (personEntities.length > 0) {
        score += 0.4 * Math.min(personEntities.length, 2); // Up to 0.8 for Person entities
        factors += 1;
      }
      
      // Check for personal questions
      const personalQuestions = semantics.entities.filter(entity => 
        entity.type === 'Question' && entity.properties && entity.properties.isPersonalQuestion
      );
      if (personalQuestions.length > 0) {
        score += 0.6; // Strong signal for explicit personal questions
        factors += 1;
      }
      
      // Check for personal intent
      const personalIntent = semantics.intents.find(intent => 
        intent.type === 'inform' && intent.category === 'personal_info'
      );
      if (personalIntent) {
        score += personalIntent.confidence || 0.5;
        factors += 1;
      }
    } 
    else if (contextType === 'domain') {
      // Count Topic entities related to domain
      const domainTopics = semantics.entities.filter(entity => 
        entity.type === 'Topic' && 
        entity.properties && 
        entity.properties.name && 
        this.contextDefinitions.domain.keywords.some(keyword => 
          entity.properties.name.toLowerCase().includes(keyword.toLowerCase())
        )
      );
      if (domainTopics.length > 0) {
        score += 0.5 * Math.min(domainTopics.length, 2); // Up to 1.0 for domain topics
        factors += 1;
      }
      
      // Check for domain-specific questions
      const domainQuestions = semantics.entities.filter(entity => 
        entity.type === 'Question' && 
        entity.properties && 
        entity.properties.about && 
        this.contextDefinitions.domain.keywords.some(keyword => 
          entity.properties.about.toLowerCase().includes(keyword.toLowerCase())
        )
      );
      if (domainQuestions.length > 0) {
        score += 0.6; // Strong signal for explicit domain questions
        factors += 1;
      }
    }
    else if (contextType === 'general') {
      // Check for general intents
      const generalIntent = semantics.intents.find(intent => 
        ['greet', 'farewell', 'thank', 'help'].includes(intent.type)
      );
      if (generalIntent) {
        score += generalIntent.confidence || 0.7;
        factors += 1;
      }
      
      // Very short queries tend to be general
      if (text.split(' ').length <= 3) {
        score += 0.4;
        factors += 1;
      }
    }
    
    // Add keyword-based scoring
    const contextDef = this.contextDefinitions[contextType];
    if (contextDef) {
      // Count matching keywords
      const keywordCount = contextDef.keywords.filter(keyword => 
        text.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      
      // Add pattern matches
      const patternMatches = contextDef.patterns.filter(pattern => 
        pattern.test(text)
      ).length;
      
      if (keywordCount > 0 || patternMatches > 0) {
        // Calculate keyword score (diminishing returns for many keywords)
        const keywordScore = Math.min(keywordCount * 0.1, 0.5);
        
        // Pattern matches are stronger signals
        const patternScore = Math.min(patternMatches * 0.2, 0.6);
        
        score += Math.max(keywordScore, patternScore);
        factors += 1;
      }
    }
    
    // Calculate average score
    const finalScore = factors > 0 ? score / factors : 0;
    
    // Normalize to 0-1 range (though it should already be in this range)
    return Math.max(0, Math.min(1, finalScore));
  }

  /**
   * Get the context type with the highest confidence
   * @param {Object} semantics - The semantic understanding
   * @returns {Object} - The top context with type and confidence
   */
  getTopContext(semantics) {
    const contexts = [
      { 
        type: 'personal', 
        confidence: this.calculateContextConfidence(semantics, 'personal')
      },
      { 
        type: 'domain', 
        confidence: this.calculateContextConfidence(semantics, 'domain')
      },
      { 
        type: 'general', 
        confidence: this.calculateContextConfidence(semantics, 'general')
      }
    ];
    
    // Sort by confidence (descending)
    contexts.sort((a, b) => b.confidence - a.confidence);
    
    this.logger.log(`Context confidence scores: ` + 
                   `personal=${contexts.find(c => c.type === 'personal').confidence.toFixed(2)}, ` +
                   `domain=${contexts.find(c => c.type === 'domain').confidence.toFixed(2)}, ` +
                   `general=${contexts.find(c => c.type === 'general').confidence.toFixed(2)}`);
    
    // If highest confidence is below threshold, default to general
    if (contexts[0].confidence < 0.3) {
      this.logger.log('No strong context detected, defaulting to general');
      return { type: 'general', confidence: Math.max(0.3, contexts[0].confidence) };
    }
    
    this.logger.log(`Selected context: ${contexts[0].type} with confidence ${contexts[0].confidence.toFixed(2)}`);
    return contexts[0];
  }

  /**
   * Detect if there's a transition between previous and current context
   * @param {string} previousContext - The previous context type
   * @param {Object} currentContextScores - Current context scores
   * @returns {boolean} - True if a context transition is detected
   */
  detectContextTransition(previousContext, currentContextScores) {
    if (!previousContext || !currentContextScores) {
      return false;
    }
    
    // Find the current top context
    let topContext = 'general';
    let topScore = 0;
    
    for (const [contextType, score] of Object.entries(currentContextScores)) {
      if (score > topScore) {
        topScore = score;
        topContext = contextType;
      }
    }
    
    // If the top context is different and score is significant, it's a transition
    const isSignificantScore = topScore >= 0.4;
    const isDifferentContext = previousContext !== topContext;
    
    return isDifferentContext && isSignificantScore;
  }
}

export default ContextDetection;
