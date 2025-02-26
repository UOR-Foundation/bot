// entity-extractor.js
// Extracts entities from user input for schema.org-based semantic understanding

/**
 * EntityExtractor class handles extraction of schema.org-aligned entities from text
 */
class EntityExtractor {
  constructor() {
    this.logger = console; // Logger (can be replaced with a custom one)
    
    // Define extraction patterns for different entity types
    this.entityPatterns = {
      person: [
        { regex: /my name is\s+([a-zA-Z\s]+)(?:\.|\,|\s|$)/i, property: 'name' },
        { regex: /i am\s+([a-zA-Z\s]+)(?:\.|\,|\s|$)/i, property: 'name' },
        { regex: /call me\s+([a-zA-Z\s]+)(?:\.|\,|\s|$)/i, property: 'name' },
        { regex: /i'm\s+([a-zA-Z\s]+)(?:\.|\,|\s|$)/i, property: 'name' },
        { regex: /this is\s+([a-zA-Z\s]+)(?:\.|\,|\s|$)/i, property: 'name' },
        { regex: /i am\s+(\d+)(?:\s+years old)?/i, property: 'age' },
        { regex: /i'm\s+(\d+)(?:\s+years old)?/i, property: 'age' },
        { regex: /my age is\s+(\d+)/i, property: 'age' },
        { regex: /i am (\d+)(?:\s+years)?(?:\s+old)?/i, property: 'age' }
      ],
      location: [
        { regex: /i(?:'m| am) from\s+([a-zA-Z\s,]+)(?:\.|\,|\s|$)/i, property: 'location' },
        { regex: /i live in\s+([a-zA-Z\s,]+)(?:\.|\,|\s|$)/i, property: 'location' },
        { regex: /my location is\s+([a-zA-Z\s,]+)(?:\.|\,|\s|$)/i, property: 'location' },
        { regex: /my home is in\s+([a-zA-Z\s,]+)(?:\.|\,|\s|$)/i, property: 'location' },
        { regex: /i(?:'m| am) in\s+([a-zA-Z\s,]+)(?:\.|\,|\s|$)/i, property: 'location' }
      ],
      organization: [
        { regex: /i work (?:at|for)\s+([a-zA-Z\s,\.]+)(?:\.|\,|\s|$)/i, property: 'worksFor' },
        { regex: /i(?:'m| am) employed (?:at|by)\s+([a-zA-Z\s,\.]+)(?:\.|\,|\s|$)/i, property: 'worksFor' },
        { regex: /my company is\s+([a-zA-Z\s,\.]+)(?:\.|\,|\s|$)/i, property: 'worksFor' }
      ],
      dateTime: [
        { regex: /(?:on|for)\s+((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)/i, property: 'date' },
        { regex: /(?:at|around)\s+(\d{1,2}(?::\d{2})?(?:\s*[ap]\.?m\.?)?)/i, property: 'time' }
      ],
      product: [
        { regex: /(?:bought|purchased|ordered)\s+(?:a|an|the)\s+([a-zA-Z0-9\s,\.]+)(?:\.|\,|\s|$)/i, property: 'name' },
        { regex: /looking for (?:a|an|the)\s+([a-zA-Z0-9\s,\.]+)(?:\.|\,|\s|$)/i, property: 'name' }
      ]
    };
  }
  
  /**
   * Extracts entities from user input and adds them to the semantics object
   * @param {string} userInput - The raw user input text
   * @param {Object} semantics - The semantic structure to populate
   */
  extractEntities(userInput, semantics) {
    this.logger.log(`Extracting entities from: "${userInput}"`);
    
    // Ensure entities array exists in semantics
    if (!semantics.entities) {
      semantics.entities = [];
    }
    
    // Extract different types of entities
    this.extractPersonInfo(userInput, semantics);
    this.extractLocationInfo(userInput, semantics);
    this.extractOrganizationInfo(userInput, semantics);
    this.extractDateTimeInfo(userInput, semantics);
    this.extractProductInfo(userInput, semantics);
    this.extractQuestionInfo(userInput, semantics);
    
    this.logger.log(`Extracted ${semantics.entities.length} entities from user input`);
  }
  
  /**
   * Extract person information from user input
   * @param {string} userInput - The raw user input
   * @param {Object} semantics - The semantic structure to populate
   */
  extractPersonInfo(userInput, semantics) {
    let personEntity = null;
    
    // Process all person pattern matches
    for (const pattern of this.entityPatterns.person) {
      const match = userInput.match(pattern.regex);
      if (match && match[1]) {
        // Create person entity if it doesn't exist yet
        if (!personEntity) {
          personEntity = {
            type: 'Person',
            id: `person_${Date.now()}`,
            properties: {},
            confidence: 0.9,
            source: 'user_input',
            timestamp: Date.now()
          };
          semantics.entities.push(personEntity);
          
          // If this is new personal info, add an inform intent
          if (!semantics.intents.some(intent => intent.type === 'inform' && intent.category === 'personal_info')) {
            semantics.intents.push({ 
              type: 'inform', 
              confidence: 0.95,
              category: 'personal_info' 
            });
          }
          
          this.logger.log(`Created Person entity with ID: ${personEntity.id}`);
        }
        
        // Add the matched property
        const value = pattern.property === 'age' ? parseInt(match[1]) : match[1].trim();
        personEntity.properties[pattern.property] = value;
        this.logger.log(`Added ${pattern.property} = "${value}" to Person entity`);
      }
    }
  }
  
  /**
   * Extract location information from user input
   * @param {string} userInput - The raw user input
   * @param {Object} semantics - The semantic structure to populate
   */
  extractLocationInfo(userInput, semantics) {
    let locationEntity = null;
    
    // Process all location pattern matches
    for (const pattern of this.entityPatterns.location) {
      const match = userInput.match(pattern.regex);
      if (match && match[1]) {
        // Create location entity if it doesn't exist yet
        if (!locationEntity) {
          locationEntity = {
            type: 'Place',
            id: `place_${Date.now()}`,
            properties: {},
            confidence: 0.85,
            source: 'user_input',
            timestamp: Date.now()
          };
          semantics.entities.push(locationEntity);
          
          this.logger.log(`Created Place entity with ID: ${locationEntity.id}`);
        }
        
        // Add the matched property - usually this will be the address or name
        locationEntity.properties[pattern.property || 'address'] = match[1].trim();
        this.logger.log(`Added ${pattern.property || 'address'} = "${match[1].trim()}" to Place entity`);
        
        // If we're talking about the user's location, add a relationship to the Person entity
        const personEntity = semantics.entities.find(e => e.type === 'Person');
        if (personEntity) {
          if (!semantics.relationships) {
            semantics.relationships = [];
          }
          
          semantics.relationships.push({
            type: 'homeLocation',
            source: personEntity.id,
            target: locationEntity.id,
            confidence: 0.8
          });
          
          this.logger.log(`Added homeLocation relationship between Person and Place`);
        }
      }
    }
  }
  
  /**
   * Extract organization information from user input
   * @param {string} userInput - The raw user input
   * @param {Object} semantics - The semantic structure to populate
   */
  extractOrganizationInfo(userInput, semantics) {
    let organizationEntity = null;
    
    // Process all organization pattern matches
    for (const pattern of this.entityPatterns.organization) {
      const match = userInput.match(pattern.regex);
      if (match && match[1]) {
        // Create organization entity if it doesn't exist yet
        if (!organizationEntity) {
          organizationEntity = {
            type: 'Organization',
            id: `organization_${Date.now()}`,
            properties: {},
            confidence: 0.8,
            source: 'user_input',
            timestamp: Date.now()
          };
          semantics.entities.push(organizationEntity);
          
          this.logger.log(`Created Organization entity with ID: ${organizationEntity.id}`);
        }
        
        // Add the matched property - usually this will be the name
        organizationEntity.properties['name'] = match[1].trim();
        this.logger.log(`Added name = "${match[1].trim()}" to Organization entity`);
        
        // If the user mentioned they work for this organization, add a relationship to the Person entity
        if (pattern.property === 'worksFor') {
          const personEntity = semantics.entities.find(e => e.type === 'Person');
          if (personEntity) {
            if (!semantics.relationships) {
              semantics.relationships = [];
            }
            
            semantics.relationships.push({
              type: 'worksFor',
              source: personEntity.id,
              target: organizationEntity.id,
              confidence: 0.85
            });
            
            this.logger.log(`Added worksFor relationship between Person and Organization`);
          }
        }
      }
    }
  }
  
  /**
   * Extract date and time information from user input
   * @param {string} userInput - The raw user input
   * @param {Object} semantics - The semantic structure to populate
   */
  extractDateTimeInfo(userInput, semantics) {
    let dateTimeEntity = null;
    
    // Process all dateTime pattern matches
    for (const pattern of this.entityPatterns.dateTime) {
      const match = userInput.match(pattern.regex);
      if (match && match[1]) {
        // Create dateTime entity if it doesn't exist yet
        if (!dateTimeEntity) {
          dateTimeEntity = {
            type: 'DateTime',
            id: `datetime_${Date.now()}`,
            properties: {},
            confidence: 0.75,
            source: 'user_input',
            timestamp: Date.now()
          };
          semantics.entities.push(dateTimeEntity);
          
          this.logger.log(`Created DateTime entity with ID: ${dateTimeEntity.id}`);
        }
        
        // Add the matched property
        dateTimeEntity.properties[pattern.property] = match[1].trim();
        this.logger.log(`Added ${pattern.property} = "${match[1].trim()}" to DateTime entity`);
      }
    }
  }
  
  /**
   * Extract product information from user input
   * @param {string} userInput - The raw user input
   * @param {Object} semantics - The semantic structure to populate
   */
  extractProductInfo(userInput, semantics) {
    let productEntity = null;
    
    // Process all product pattern matches
    for (const pattern of this.entityPatterns.product) {
      const match = userInput.match(pattern.regex);
      if (match && match[1]) {
        // Create product entity if it doesn't exist yet
        if (!productEntity) {
          productEntity = {
            type: 'Product',
            id: `product_${Date.now()}`,
            properties: {},
            confidence: 0.7,
            source: 'user_input',
            timestamp: Date.now()
          };
          semantics.entities.push(productEntity);
          
          this.logger.log(`Created Product entity with ID: ${productEntity.id}`);
        }
        
        // Add the matched property
        productEntity.properties[pattern.property] = match[1].trim();
        this.logger.log(`Added ${pattern.property} = "${match[1].trim()}" to Product entity`);
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
        confidence: 0.9,
        source: 'user_input',
        timestamp: Date.now()
      };
      
      semantics.entities.push(questionEntity);
      
      // Add a strong question intent when a question is detected
      if (!semantics.intents.some(intent => intent.type === 'question')) {
        semantics.intents.push({ 
          type: 'question', 
          confidence: 0.95 
        });
      }
      
      this.logger.log(`Created Question entity with ID: ${questionEntity.id}`);
      
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
              },
              confidence: 0.8,
              source: 'user_input',
              timestamp: Date.now()
            };
            
            semantics.entities.push(topicEntity);
            
            // Add relationship between question and topic
            if (!semantics.relationships) {
              semantics.relationships = [];
            }
            
            semantics.relationships.push({
              type: 'isAbout',
              source: questionEntity.id,
              target: topicEntity.id,
              confidence: 0.85
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
    // Keywords that might indicate general topics of interest
    const topicKeywords = [
      'politics', 'science', 'technology', 'health', 'sports',
      'education', 'finance', 'entertainment', 'art', 'music',
      'history', 'travel', 'food', 'fashion', 'business',
      'environment', 'religion', 'culture', 'economy', 'literature'
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
        confidence: 0.7,
        source: 'user_input',
        timestamp: Date.now()
      };
      
      semantics.entities.push(topicEntity);
      this.logger.log(`Added Topic entity: ${topic}`);
    });
  }
}

export default EntityExtractor;