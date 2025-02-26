// entity-extractor.js
// Extracts entities from user input for schema-based semantic understanding

/**
 * EntityExtractor class handles extraction of schema-aligned entities from text
 */
class EntityExtractor {
  constructor() {
    this.logger = console; // Logger (can be replaced with a custom one)
  }
  
  /**
   * Extract person information from user input
   * @param {string} userInput - The raw user input
   * @param {Object} semantics - The semantic structure to populate
   */
  extractPersonInfo(userInput, semantics) {
    // Check for name introduction patterns - enhanced with more variations
    const nameIntroPatterns = [
      { regex: /my name is\s+([a-zA-Z\s]+)(?:\.|\,|\s|$)/i, property: 'name' },
      { regex: /i am\s+([a-zA-Z\s]+)(?:\.|\,|\s|$)/i, property: 'name' },
      { regex: /call me\s+([a-zA-Z\s]+)(?:\.|\,|\s|$)/i, property: 'name' },
      { regex: /i'm\s+([a-zA-Z\s]+)(?:\.|\,|\s|$)/i, property: 'name' },
      { regex: /this is\s+([a-zA-Z\s]+)(?:\.|\,|\s|$)/i, property: 'name' }
    ];
    
    // Check for age patterns - enhanced with more variations
    const agePatterns = [
      { regex: /i am\s+(\d+)(?:\s+years old)?/i, property: 'age' },
      { regex: /i'm\s+(\d+)(?:\s+years old)?/i, property: 'age' },
      { regex: /my age is\s+(\d+)/i, property: 'age' },
      { regex: /i am (\d+)(?:\s+years)?(?:\s+old)?/i, property: 'age' }
    ];
    
    // Check for location patterns - enhanced with more variations
    const locationPatterns = [
      { regex: /i(?:'m| am) from\s+([a-zA-Z\s,]+)(?:\.|\,|\s|$)/i, property: 'location' },
      { regex: /i live in\s+([a-zA-Z\s,]+)(?:\.|\,|\s|$)/i, property: 'location' },
      { regex: /my location is\s+([a-zA-Z\s,]+)(?:\.|\,|\s|$)/i, property: 'location' },
      { regex: /my home is in\s+([a-zA-Z\s,]+)(?:\.|\,|\s|$)/i, property: 'location' }
    ];
    
    // Process all patterns
    const allPatterns = [...nameIntroPatterns, ...agePatterns, ...locationPatterns];
    
    let personEntity = null;
    
    for (const pattern of allPatterns) {
      const match = userInput.match(pattern.regex);
      if (match && match[1]) {
        // Create person entity if it doesn't exist yet
        if (!personEntity) {
          personEntity = {
            type: 'Person',
            id: `person_${Date.now()}`,
            properties: {},
            timestamp: Date.now() // Add timestamp for recency tracking
          };
          semantics.entities.push(personEntity);
          
          // Add relationship between the speaker and this person
          semantics.relationships.push({
            type: 'isSpeaker',
            source: personEntity.id,
            target: 'conversation'
          });
          
          // Add a strong inform intent when personal info is detected
          semantics.intents.push({ 
            type: 'inform', 
            confidence: 0.95,
            category: 'personal_info' 
          });
          
          this.logger.log(`Created Person entity with ID: ${personEntity.id} and added inform intent with confidence 0.95`);
        }
        
        // Add the matched property
        const value = pattern.property === 'age' ? parseInt(match[1]) : match[1].trim();
        personEntity.properties[pattern.property] = value;
        this.logger.log(`Added ${pattern.property} = "${value}" to Person entity`);
      }
    }
  }
  
  /**
   * Extract question information from user input
   * @param {string} userInput - The raw user input
   * @param {Object} semantics - The semantic structure to populate
   */
  extractQuestionInfo(userInput, semantics) {
    // Enhanced patterns for question detection
    const questionPatterns = [
      /^(what|who|where|when|why|how|can|could|would|will|is|are|do|does).*\?$/i,
      /^(tell me|i want to know|i'd like to know|can you tell me).*\?$/i,
      /^(what|who|where|when|why|how|can|could|would|will|is|are|do|does)/i // Even without question mark
    ];
    
    const isQuestion = questionPatterns.some(pattern => pattern.test(userInput));
    
    if (isQuestion) {
      const questionEntity = {
        type: 'Question',
        id: `question_${Date.now()}`,
        properties: {
          text: userInput
        },
        timestamp: Date.now() // Add timestamp for recency
      };
      
      semantics.entities.push(questionEntity);
      
      // Add a strong question intent when a question is detected
      semantics.intents.push({ 
        type: 'question', 
        confidence: 0.95 
      });
      
      this.logger.log(`Created Question entity with ID: ${questionEntity.id} and added question intent with confidence 0.95`);
      
      // Enhanced patterns for detecting what the question is about
      const aboutPatterns = [
        { regex: /about\s+([a-zA-Z\s]+)(?:\.|\,|\s|$)/i, property: 'about' },
        { regex: /what(?:'s| is)\s+([a-zA-Z\s]+)(?:\.|\,|\s|\?|$)/i, property: 'about' },
        { regex: /who(?:'s| is)\s+([a-zA-Z\s]+)(?:\.|\,|\s|\?|$)/i, property: 'about' },
        { regex: /what(?:'s| is) my ([a-zA-Z\s]+)(?:\.|\,|\s|\?|$)/i, property: 'aboutProperty' }
      ];
      
      for (const pattern of aboutPatterns) {
        const match = userInput.match(pattern.regex);
        if (match && match[1]) {
          if (pattern.property === 'aboutProperty') {
            // This is a question about a personal property
            questionEntity.properties.aboutProperty = match[1].trim();
            questionEntity.properties.isPersonalQuestion = true;
            this.logger.log(`Question is about personal property: ${match[1].trim()}`);
          } else {
            questionEntity.properties.about = match[1].trim();
            this.logger.log(`Question is about: ${match[1].trim()}`);
            
            // Add a Topic entity for what the question is about
            const topicEntity = {
              type: 'Topic',
              id: `topic_${Date.now()}`,
              properties: {
                name: match[1].trim()
              }
            };
            
            semantics.entities.push(topicEntity);
            
            // Add relationship between question and topic
            semantics.relationships.push({
              type: 'isAbout',
              source: questionEntity.id,
              target: topicEntity.id
            });
          }
          
          break; // Only need one topic
        }
      }
      
      // Detect personal questions about name, age, etc.
      if (userInput.match(/what(?:'s| is) my name\??/i) || 
          userInput.match(/who am i\??/i)) {
        questionEntity.properties.aboutProperty = 'name';
        questionEntity.properties.isPersonalQuestion = true;
        this.logger.log(`Question is about personal property: name`);
      } else if (userInput.match(/how old am i\??/i) || 
                userInput.match(/what(?:'s| is) my age\??/i)) {
        questionEntity.properties.aboutProperty = 'age';
        questionEntity.properties.isPersonalQuestion = true;
        this.logger.log(`Question is about personal property: age`);
      } else if (userInput.match(/where (?:am i from|do i live)\??/i) || 
                userInput.match(/what(?:'s| is) my location\??/i)) {
        questionEntity.properties.aboutProperty = 'location';
        questionEntity.properties.isPersonalQuestion = true;
        this.logger.log(`Question is about personal property: location`);
      }
    }
  }
  
  /**
   * Extract topic information from user input
   * @param {string} userInput - The raw user input
   * @param {Object} semantics - The semantic structure to populate
   */
  extractTopicInfo(userInput, semantics) {
    // Keywords that might indicate topics - expanded domain keywords
    const topicKeywords = [
      'UOR', 'framework', 'bot', 'knowledge', 'semantic', 'context',
      'memory', 'token', 'limit', 'traversal', 'lattice', 'kernel',
      'schema', 'entity', 'property', 'relationship', 'inference',
      'graph', 'query', 'search', 'relevance', 'embedding'
    ];
    
    // Check if any topic keywords are present
    const foundTopics = topicKeywords.filter(keyword => 
      userInput.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // Add each found topic as an entity
    foundTopics.forEach(topic => {
      const topicEntity = {
        type: 'Topic',
        id: `topic_${topic.toLowerCase()}_${Date.now()}`,
        properties: {
          name: topic
        },
        timestamp: Date.now() // Add timestamp
      };
      
      semantics.entities.push(topicEntity);
      this.logger.log(`Added Topic entity: ${topic}`);
    });
  }
}

export default EntityExtractor;
