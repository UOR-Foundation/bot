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
        this.logger.log(`Parsing user input: "${userInput}"`);
        
        // Extract potential person information
        this.extractPersonInfo(userInput, semantics);
        
        // Extract question information
        this.extractQuestionInfo(userInput, semantics);
        
        // Extract topic information
        this.extractTopicInfo(userInput, semantics);
        
        // Determine intent (inform, request, greet, etc.)
        this.determineIntent(userInput, semantics);
        
        this.logger.log(`Extracted semantics: ${semantics.entities.length} entities, ${semantics.relationships.length} relationships, ${semantics.intents.length} intents`);
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
    
    /**
     * Determine the intent of the user input
     * @param {string} userInput - The raw user input
     * @param {Object} semantics - The semantic structure to populate
     */
    determineIntent(userInput, semantics) {
      this.logger.log(`Determining intent for: "${userInput}"`);
      
      // Enhanced greeting detection
      if (/^(hi|hello|hey|greetings|good morning|good afternoon|good evening)[\.\s!\,]?$/i.test(userInput)) {
        semantics.intents.push({ type: 'greet', confidence: 0.9 });
        this.logger.log('Detected greeting intent with confidence 0.9');
      }
      
      // Enhanced question detection 
      if (/\?$/.test(userInput) || 
          /^(what|who|where|when|why|how|can|could|is|are|do|does|tell me|explain)/i.test(userInput)) {
        semantics.intents.push({ type: 'question', confidence: 0.9 });
        this.logger.log('Detected question intent with confidence 0.9');
      }
      
      // Enhanced information sharing detection
      if (/^(my name is|i am|i'm from|i live in|i'm|i have|my|i)/i.test(userInput) && 
         !(/\?$/.test(userInput))) {
        semantics.intents.push({ type: 'inform', confidence: 0.8 });
        this.logger.log('Detected inform intent with confidence 0.8');
      }
      
      // If no intents were determined, add a default
      if (semantics.intents.length === 0) {
        semantics.intents.push({ type: 'statement', confidence: 0.5 });
        this.logger.log('Detected default statement intent with confidence 0.5');
      }
    }
    
    /**
     * Create UOR kernels based on semantic entities
     * @param {Object} semantics - The semantic structure
     * @returns {Array} Array of created kernels
     */
    createKernelsFromSemantics(semantics) {
      this.logger.log(`Creating kernels from semantics with ${semantics.entities.length} entities`);
      
      const createdKernels = [];
      const entityKernelMap = new Map(); // Maps entity IDs to kernel references
      
      try {
        // First, create or update conversation kernel
        let conversationKernelRef = null;
        
        // Try to find an existing conversation kernel
        const allKernels = this.uorCortex.getAllKernels();
        const existingConversationKernel = allKernels.find(k => 
          k.data && k.data.schemaType === 'Conversation'
        );
        
        if (existingConversationKernel) {
          conversationKernelRef = existingConversationKernel.reference;
          this.logger.log(`Found existing conversation kernel: ${conversationKernelRef}`);
        } else {
          // Create a new conversation kernel if none exists
          const conversationKernel = this.uorCortex.createKernel({
            schemaType: 'Conversation',
            properties: {
              startTime: new Date().toISOString(),
              turns: []
            },
            timestamp: Date.now()
          });
          conversationKernelRef = conversationKernel.kernelReference;
          createdKernels.push(conversationKernel);
          this.logger.log(`Created new conversation kernel: ${conversationKernelRef}`);
        }
        
        // First, create kernels for each entity
        for (const entity of semantics.entities) {
          // For Person entities, check if we already have one
          if (entity.type === 'Person') {
            const existingPersonKernel = allKernels.find(k => 
              k.data && k.data.schemaType === 'Person'
            );
            
            if (existingPersonKernel) {
              // Update existing person kernel with new properties
              const updatedProperties = {
                ...existingPersonKernel.data.properties,
                ...entity.properties
              };
              
              const updatedKernel = this.uorCortex.createKernel({
                schemaType: 'Person',
                properties: updatedProperties,
                entityId: entity.id,
                timestamp: Date.now()
              });
              
              this.logger.log(`Updated existing Person kernel: ${updatedKernel.kernelReference}`);
              this.logger.log(`Updated properties: ${JSON.stringify(updatedProperties)}`);
              
              createdKernels.push(updatedKernel);
              entityKernelMap.set(entity.id, updatedKernel.kernelReference);
              
              // Also link to conversation if not already linked
              this.uorCortex.linkObjects(
                updatedKernel.kernelReference,
                conversationKernelRef,
                'participatesIn'
              );
              
              continue; // Skip creating a new kernel
            }
          }
          
          // Create new kernel for this entity
          const kernelData = {
            schemaType: entity.type,
            properties: entity.properties,
            entityId: entity.id,
            timestamp: Date.now()
          };
          
          const kernel = this.uorCortex.createKernel(kernelData);
          createdKernels.push(kernel);
          entityKernelMap.set(entity.id, kernel.kernelReference);
          
          this.logger.log(`Created kernel for ${entity.type}: ${kernel.kernelReference}`);
          
          // Link entity to conversation if applicable
          if (entity.type === 'Person' || entity.type === 'Question') {
            this.uorCortex.linkObjects(
              kernel.kernelReference,
              conversationKernelRef,
              entity.type === 'Person' ? 'participatesIn' : 'partOf'
            );
            this.logger.log(`Linked ${entity.type} to conversation`);
          }
        }
        
        // Then, establish relationships between kernels
        for (const relationship of semantics.relationships) {
          const sourceKernelRef = entityKernelMap.get(relationship.source);
          const targetKernelRef = entityKernelMap.get(relationship.target);
          
          // Handle special case for 'conversation' which might not be an entity
          let targetRef = targetKernelRef;
          if (relationship.target === 'conversation') {
            targetRef = conversationKernelRef;
          }
          
          if (sourceKernelRef && targetRef) {
            this.uorCortex.linkObjects(sourceKernelRef, targetRef, relationship.type);
            this.logger.log(`Linked kernels: ${sourceKernelRef} -[${relationship.type}]-> ${targetRef}`);
          }
        }
      } catch (error) {
        this.logger.error(`Error creating kernels from semantics: ${error.message}`);
        this.logger.error(error.stack);
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
      this.logger.log(`Looking for personal info based on question: "${question}"`);
      
      // Parse the question to understand what's being asked
      const semantics = this.parseUserInput(question);
      
      // Enhanced question patterns for personal information
      const personQuestions = [
        { pattern: /what( is|'s) my name/i, property: 'name' },
        { pattern: /who am i/i, property: 'name' },
        { pattern: /how old am i/i, property: 'age' },
        { pattern: /what( is|'s) my age/i, property: 'age' },
        { pattern: /where (am i from|do i live)/i, property: 'location' },
        { pattern: /what( is|'s) my location/i, property: 'location' }
      ];
      
      // Check if any entity in semantics is a Question with personal property
      let targetProperty = null;
      
      // First, check the extracted semantics
      const questionEntities = semantics.entities.filter(e => e.type === 'Question');
      for (const questionEntity of questionEntities) {
        if (questionEntity.properties && 
            questionEntity.properties.isPersonalQuestion && 
            questionEntity.properties.aboutProperty) {
          targetProperty = questionEntity.properties.aboutProperty;
          this.logger.log(`Found personal property in semantics: ${targetProperty}`);
          break;
        }
      }
      
      // If not found in semantics, try pattern matching
      if (!targetProperty) {
        for (const pq of personQuestions) {
          if (pq.pattern.test(question)) {
            targetProperty = pq.property;
            this.logger.log(`Found personal property via pattern: ${targetProperty}`);
            break;
          }
        }
      }
      
      if (!targetProperty) {
        this.logger.log('No personal property identified in question');
        return null;
      }
      
      // Search for Person kernels in the UOR graph
      const allKernels = this.uorCortex.getAllKernels();
      this.logger.log(`Searching ${allKernels.length} kernels for Person with ${targetProperty}`);
      
      // Find Person kernels with the requested property
      const personKernels = allKernels.filter(kernel => 
        kernel.data && 
        kernel.data.schemaType === 'Person' && 
        kernel.data.properties && 
        kernel.data.properties[targetProperty]
      );
      
      this.logger.log(`Found ${personKernels.length} person kernels with ${targetProperty}`);
      
      if (personKernels.length > 0) {
        // Sort by recency (assuming more recent kernels are more relevant)
        personKernels.sort((a, b) => {
          return (b.data.timestamp || 0) - (a.data.timestamp || 0);
        });
        
        const personalInfo = {
          property: targetProperty,
          value: personKernels[0].data.properties[targetProperty],
          confidence: 0.9
        };
        
        this.logger.log(`Returning personal info: ${JSON.stringify(personalInfo)}`);
        return personalInfo;
      }
      
      this.logger.log('No matching personal info found');
      return null;
    }
}
  
export default SchemaProcessor;