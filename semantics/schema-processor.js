// schema-processor.js
// Implements schema.org-based semantic processing for the UOR framework
// This module provides structured semantic understanding for bot cognition

/**
 * SchemaProcessor class handles schema.org aligned semantic processing
 * for natural language understanding and knowledge representation
 */
class SchemaProcessor {
    constructor(uorCortex) {
      this.uorCortex = uorCortex; // Reference to the UOR Cortex for creating/linking kernels
      this.schemaTypes = new Map(); // Maps schema types to their properties
      this.logger = console; // Logger (can be replaced with a custom one)
      
      // Initialize schema definitions
      this.initializeSchemaTypes();
    }
    
    /**
     * Initialize basic schema.org type definitions
     */
    initializeSchemaTypes() {
      // Person schema
      this.schemaTypes.set('Person', {
        properties: ['name', 'givenName', 'familyName', 'email', 'location', 'age'],
        subtypes: ['User'],
        supertype: 'Thing'
      });
      
      // Question schema
      this.schemaTypes.set('Question', {
        properties: ['text', 'about', 'answerCount', 'author'],
        subtypes: [],
        supertype: 'CreativeWork'
      });
      
      // Conversation schema
      this.schemaTypes.set('Conversation', {
        properties: ['participants', 'turns', 'startTime', 'currentTopic'],
        subtypes: [],
        supertype: 'CreativeWork'
      });
      
      // Topic schema
      this.schemaTypes.set('Topic', {
        properties: ['name', 'description', 'relatedTopics'],
        subtypes: [],
        supertype: 'Thing'
      });
      
      // Add more schema types as needed
      this.logger.log('Schema types initialized');
    }
    
    /**
     * Parse user input to extract semantic entities and relationships
     * @param {string} userInput - The raw user input text
     * @returns {Object} Structured semantic representation
     */
    parseUserInput(userInput) {
      // Create a base semantic representation
      const semantics = {
        entities: [],
        relationships: [],
        intents: [],
        original: userInput
      };
      
      try {
        // Extract potential person information
        this.extractPersonInfo(userInput, semantics);
        
        // Extract question information
        this.extractQuestionInfo(userInput, semantics);
        
        // Extract topic information
        this.extractTopicInfo(userInput, semantics);
        
        // Determine intent (inform, request, greet, etc.)
        this.determineIntent(userInput, semantics);
        
        this.logger.log(`Extracted semantics: ${semantics.entities.length} entities, ${semantics.relationships.length} relationships`);
      } catch (error) {
        this.logger.error(`Error parsing user input: ${error.message}`);
      }
      
      return semantics;
    }
    
    /**
     * Extract person information from user input
     * @param {string} userInput - The raw user input
     * @param {Object} semantics - The semantic structure to populate
     */
    extractPersonInfo(userInput, semantics) {
      // Check for name introduction patterns
      const nameIntroPatterns = [
        { regex: /my name is\s+([a-zA-Z\s]+)(?:\.|\,|\s|$)/i, property: 'name' },
        { regex: /i am\s+([a-zA-Z\s]+)(?:\.|\,|\s|$)/i, property: 'name' },
        { regex: /call me\s+([a-zA-Z\s]+)(?:\.|\,|\s|$)/i, property: 'name' }
      ];
      
      // Check for age patterns
      const agePatterns = [
        { regex: /i am\s+(\d+)(?:\s+years old)?/i, property: 'age' },
        { regex: /i'm\s+(\d+)(?:\s+years old)?/i, property: 'age' }
      ];
      
      // Check for location patterns
      const locationPatterns = [
        { regex: /i(?:'m| am) from\s+([a-zA-Z\s,]+)(?:\.|\,|\s|$)/i, property: 'location' },
        { regex: /i live in\s+([a-zA-Z\s,]+)(?:\.|\,|\s|$)/i, property: 'location' }
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
              properties: {}
            };
            semantics.entities.push(personEntity);
            
            // Add relationship between the speaker and this person
            semantics.relationships.push({
              type: 'isSpeaker',
              source: personEntity.id,
              target: 'conversation'
            });
          }
          
          // Add the matched property
          const value = pattern.property === 'age' ? parseInt(match[1]) : match[1].trim();
          personEntity.properties[pattern.property] = value;
        }
      }
    }
    
    /**
     * Extract question information from user input
     * @param {string} userInput - The raw user input
     * @param {Object} semantics - The semantic structure to populate
     */
    extractQuestionInfo(userInput, semantics) {
      // Check if input is a question
      const questionPatterns = [
        /^(what|who|where|when|why|how|can|could|would|will|is|are|do|does).*\?$/i,
        /^(tell me|i want to know|i'd like to know|can you tell me).*\?$/i
      ];
      
      const isQuestion = questionPatterns.some(pattern => pattern.test(userInput));
      
      if (isQuestion) {
        const questionEntity = {
          type: 'Question',
          id: `question_${Date.now()}`,
          properties: {
            text: userInput
          }
        };
        
        semantics.entities.push(questionEntity);
        
        // Try to determine what the question is about
        const aboutPatterns = [
          { regex: /about\s+([a-zA-Z\s]+)(?:\.|\,|\s|$)/i, property: 'about' },
          { regex: /what(?:'s| is)\s+([a-zA-Z\s]+)(?:\.|\,|\s|\?|$)/i, property: 'about' },
          { regex: /who(?:'s| is)\s+([a-zA-Z\s]+)(?:\.|\,|\s|\?|$)/i, property: 'about' }
        ];
        
        for (const pattern of aboutPatterns) {
          const match = userInput.match(pattern.regex);
          if (match && match[1]) {
            questionEntity.properties.about = match[1].trim();
            
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
            
            break; // Only need one topic
          }
        }
      }
    }
    
    /**
     * Extract topic information from user input
     * @param {string} userInput - The raw user input
     * @param {Object} semantics - The semantic structure to populate
     */
    extractTopicInfo(userInput, semantics) {
      // Keywords that might indicate topics
      const topicKeywords = [
        'UOR', 'framework', 'bot', 'knowledge', 'semantic', 'context',
        'memory', 'token', 'limit', 'traversal', 'lattice', 'kernel'
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
          }
        };
        
        semantics.entities.push(topicEntity);
      });
    }
    
    /**
     * Determine the intent of the user input
     * @param {string} userInput - The raw user input
     * @param {Object} semantics - The semantic structure to populate
     */
    determineIntent(userInput, semantics) {
      // Simple intent classification
      if (/^(hi|hello|hey|greetings)/i.test(userInput)) {
        semantics.intents.push({ type: 'greet', confidence: 0.9 });
      }
      
      if (/\?$/.test(userInput)) {
        semantics.intents.push({ type: 'question', confidence: 0.9 });
      }
      
      if (/^my name is|i am|i'm from|i live in/i.test(userInput)) {
        semantics.intents.push({ type: 'inform', confidence: 0.8 });
      }
      
      // If no intents were determined, add a default
      if (semantics.intents.length === 0) {
        semantics.intents.push({ type: 'statement', confidence: 0.5 });
      }
    }
    
    /**
     * Create UOR kernels based on semantic entities
     * @param {Object} semantics - The semantic structure
     * @returns {Array} Array of created kernels
     */
    createKernelsFromSemantics(semantics) {
      const createdKernels = [];
      const entityKernelMap = new Map(); // Maps entity IDs to kernel references
      
      try {
        // First, create kernels for each entity
        for (const entity of semantics.entities) {
          const kernelData = {
            schemaType: entity.type,
            properties: entity.properties,
            entityId: entity.id
          };
          
          const kernel = this.uorCortex.createKernel(kernelData);
          createdKernels.push(kernel);
          entityKernelMap.set(entity.id, kernel.kernelReference);
          
          this.logger.log(`Created kernel for ${entity.type}: ${kernel.kernelReference}`);
        }
        
        // Then, establish relationships between kernels
        for (const relationship of semantics.relationships) {
          const sourceKernelRef = entityKernelMap.get(relationship.source);
          const targetKernelRef = entityKernelMap.get(relationship.target);
          
          // Handle special case for 'conversation' which might not be an entity
          let targetRef = targetKernelRef;
          if (relationship.target === 'conversation' && !targetRef) {
            // Create a conversation kernel if needed
            const conversationKernel = this.uorCortex.createKernel({
              schemaType: 'Conversation',
              properties: {
                startTime: new Date().toISOString()
              }
            });
            targetRef = conversationKernel.kernelReference;
            createdKernels.push(conversationKernel);
          }
          
          if (sourceKernelRef && targetRef) {
            this.uorCortex.linkObjects(sourceKernelRef, targetRef, relationship.type);
            this.logger.log(`Linked kernels: ${sourceKernelRef} -[${relationship.type}]-> ${targetRef}`);
          }
        }
      } catch (error) {
        this.logger.error(`Error creating kernels from semantics: ${error.message}`);
      }
      
      return createdKernels;
    }
    
    /**
     * Process user query using schema-based semantics
     * @param {string} userQuery - The user's input
     * @returns {Object} The query kernel and semantic information
     */
    processQuery(userQuery) {
      this.logger.log(`Processing query with schema semantics: "${userQuery}"`);
      
      // Parse user input to extract semantic information
      const semantics = this.parseUserInput(userQuery);
      
      // Create kernels based on the semantic entities
      const createdKernels = this.createKernelsFromSemantics(semantics);
      
      // Create a query kernel that includes semantic information
      const queryObject = { 
        type: "query",
        text: userQuery,
        timestamp: Date.now(),
        semantics: semantics,
        intents: semantics.intents
      };
      
      // Create the query kernel
      const queryKernel = this.uorCortex.createKernel(queryObject);
      
      // Link the query kernel to any created entity kernels
      for (const kernel of createdKernels) {
        this.uorCortex.linkObjects(
          queryKernel.kernelReference,
          kernel.kernelReference,
          'mentions'
        );
      }
      
      return {
        queryKernel,
        semantics,
        createdKernels
      };
    }
    
    /**
     * Get relevant personal information based on a question
     * @param {string} question - The user's question
     * @returns {Object|null} Personal information if found
     */
    getPersonalInfoForQuestion(question) {
      // Parse the question to understand what's being asked
      const semantics = this.parseUserInput(question);
      
      // Look for questions about personal information
      const personQuestions = [
        { pattern: /what( is|'s) my name/i, property: 'name' },
        { pattern: /how old am i/i, property: 'age' },
        { pattern: /where (am i from|do i live)/i, property: 'location' }
      ];
      
      // Find which personal property is being asked about
      let targetProperty = null;
      for (const pq of personQuestions) {
        if (pq.pattern.test(question)) {
          targetProperty = pq.property;
          break;
        }
      }
      
      if (!targetProperty) {
        return null;
      }
      
      // Search for Person kernels in the UOR graph
      const allKernels = this.uorCortex.getAllKernels();
      
      // Find Person kernels with the requested property
      const personKernels = allKernels.filter(kernel => 
        kernel.data && 
        kernel.data.schemaType === 'Person' && 
        kernel.data.properties && 
        kernel.data.properties[targetProperty]
      );
      
      if (personKernels.length > 0) {
        // Sort by recency (assuming more recent kernels are more relevant)
        // This is a simple approach; a more sophisticated one would use relationship traversal
        personKernels.sort((a, b) => {
          return (b.data.timestamp || 0) - (a.data.timestamp || 0);
        });
        
        // Return the most relevant personal information
        return {
          property: targetProperty,
          value: personKernels[0].data.properties[targetProperty],
          confidence: 0.9
        };
      }
      
      return null;
    }
  }
  
  export default SchemaProcessor;