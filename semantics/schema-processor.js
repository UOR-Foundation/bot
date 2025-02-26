// schema-processor.js
// Processes user input using schema.org semantic understanding

import EntityExtractor from './entity-extractor.js';
import IntentClassifier from './intent-classifier.js';
import PersonalInfoManager from './personal-info-manager.js';
import SchemaMapper from './schema-mapper.js';

/**
 * SchemaProcessor class coordinates schema.org aligned semantic processing
 * for natural language understanding and knowledge representation
 */
class SchemaProcessor {
    constructor(knowledgeGraph) {
      this.knowledgeGraph = knowledgeGraph; // Reference to the knowledge graph
      this.entityExtractor = new EntityExtractor(); // Extracts entities from text
      this.intentClassifier = new IntentClassifier(); // Classifies user intents
      this.personalInfoManager = new PersonalInfoManager(knowledgeGraph); // Handles personal info
      this.schemaMapper = new SchemaMapper(); // Maps entities to schema.org types
      this.logger = console; // Logger (can be replaced with a custom one)
      
      this.previousContext = null; // Store previous conversational context
    }
    
    /**
     * Process user query using schema-based semantics
     * @param {string} userQuery - The user's input
     * @param {Object} options - Processing options
     * @returns {Object} The query semantics, entities, and context
     */
    processQuery(userQuery, options = {}) {
      this.logger.log(`Processing query with schema semantics: "${userQuery}"`);
      
      // Parse user input to extract semantic information
      const semantics = this.parseUserInput(userQuery);
      
      // Detect context type from semantics
      const contextType = this.detectContextType(semantics);
      semantics.contextType = contextType;
      
      // Check for context transition
      if (this.previousContext && this.previousContext !== contextType) {
        semantics.contextTransition = {
          from: this.previousContext,
          to: contextType
        };
        this.logger.log(`Context transition detected: ${this.previousContext} -> ${contextType}`);
      }
      this.previousContext = contextType;
      
      // Map extracted entities to schema.org types
      const schemaEntities = this.mapToSchemaTypes(semantics.entities);
      
      // Create knowledge graph entities if needed
      let createdEntities = [];
      if (options.createEntities !== false) {
        createdEntities = this.createEntitiesFromSemantics(semantics, schemaEntities);
      }
      
      return {
        semantics,
        schemaEntities,
        createdEntities,
        contextType
      };
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
        original: userInput,
        timestamp: Date.now()
      };
      
      try {
        this.logger.log(`Parsing user input: "${userInput}"`);
        
        // Extract potential person information with enhanced patterns
        this.entityExtractor.extractPersonInfo(userInput, semantics);
        
        // Extract question information with better personal question detection
        this.entityExtractor.extractQuestionInfo(userInput, semantics);
        
        // Extract location information
        this.entityExtractor.extractLocationInfo(userInput, semantics);
        
        // Extract date and time information
        this.entityExtractor.extractDateTimeInfo(userInput, semantics);
        
        // Extract topic information
        this.entityExtractor.extractTopicInfo(userInput, semantics);
        
        // Determine intent (inform, request, greet, etc.)
        this.intentClassifier.determineIntent(userInput, semantics);
        
        this.logger.log(`Extracted semantics: ${semantics.entities.length} entities, ${semantics.relationships.length} relationships, ${semantics.intents.length} intents`);
      } catch (error) {
        this.logger.error(`Error parsing user input: ${error.message}`);
      }
      
      return semantics;
    }
    
    /**
     * Maps extracted entities to schema.org types
     * @param {Array} entities - The extracted entities
     * @returns {Array} Schema.org compatible entities
     */
    mapToSchemaTypes(entities) {
      return entities.map(entity => this.schemaMapper.mapEntityToSchema(entity));
    }
    
    /**
     * Creates knowledge graph entities from processed semantics
     * @param {Object} semantics - The semantic structure
     * @param {Array} schemaEntities - The schema.org mapped entities
     * @param {string} source - Source of the information
     * @returns {Array} Created/updated entities
     */
    createEntitiesFromSemantics(semantics, schemaEntities, source = 'user') {
      const createdEntities = [];
      
      try {
        this.logger.log(`Creating entities from semantics with ${schemaEntities.length} schema entities`);
        
        // Create entities in the knowledge graph
        for (const entity of schemaEntities) {
          // Calculate confidence based on extraction quality
          const confidence = entity.confidence || 0.8;
          
          // Create the entity in the knowledge graph
          const createdEntity = this.knowledgeGraph.createEntity(entity, source, confidence);
          createdEntities.push(createdEntity);
          
          this.logger.log(`Created ${entity['@type']} entity: ${JSON.stringify(createdEntity.id)}`);
        }
        
        // Create relationships between entities
        this.createRelationshipsFromSemantics(semantics, createdEntities, source);
        
      } catch (error) {
        this.logger.error(`Error creating entities from semantics: ${error.message}`);
      }
      
      return createdEntities;
    }
    
    /**
     * Creates relationships between entities based on semantics
     * @param {Object} semantics - The semantic structure
     * @param {Array} createdEntities - The created entities
     * @param {string} source - Source of the information
     * @returns {Array} Created relationships
     */
    createRelationshipsFromSemantics(semantics, createdEntities, source = 'user') {
      const createdRelationships = [];
      
      // Map of entity IDs for quick lookup
      const entityMap = new Map();
      createdEntities.forEach(entity => {
        if (entity.sourceId) {
          entityMap.set(entity.sourceId, entity.id);
        }
      });
      
      // Create relationships from semantics.relationships
      for (const relationship of semantics.relationships) {
        const sourceEntityId = entityMap.get(relationship.source);
        const targetEntityId = entityMap.get(relationship.target);
        
        if (sourceEntityId && targetEntityId) {
          const relType = this.schemaMapper.mapRelationshipType(relationship.type);
          const confidence = relationship.confidence || 0.7;
          
          const createdRelationship = this.knowledgeGraph.createRelationship(
            sourceEntityId,
            targetEntityId,
            relType,
            source,
            confidence
          );
          
          createdRelationships.push(createdRelationship);
          this.logger.log(`Created relationship: ${sourceEntityId} -[${relType}]-> ${targetEntityId}`);
        }
      }
      
      return createdRelationships;
    }
    
    /**
     * Detect the primary context type from semantics
     * @param {Object} semantics - The parsed semantic information
     * @returns {string} The detected context type
     */
    detectContextType(semantics) {
      // Check for personal context
      const hasPersonalContext = this.hasPersonalContext(semantics);
      if (hasPersonalContext) {
        return 'personal';
      }
      
      // Check for domain-specific context
      const hasDomainContext = this.hasDomainContext(semantics);
      if (hasDomainContext) {
        return 'domain';
      }
      
      // Check for greeting context
      const hasGreetingIntent = semantics.intents.some(intent => 
        intent.type === 'greet' && intent.confidence > 0.7
      );
      if (hasGreetingIntent) {
        return 'greeting';
      }
      
      // Default to general context
      return 'general';
    }
    
    /**
     * Determine if semantics indicate a personal context
     * @param {Object} semantics - The parsed semantic information
     * @returns {boolean} Whether this is a personal context
     */
    hasPersonalContext(semantics) {
      // Check for Person entities
      const hasPersonEntity = semantics.entities.some(entity => 
        entity.type === 'Person' && entity.properties && Object.keys(entity.properties).length > 0
      );
      
      // Check for personal questions
      const hasPersonalQuestion = semantics.entities.some(entity => 
        entity.type === 'Question' && 
        entity.properties && 
        entity.properties.isPersonalQuestion
      );
      
      // Check for personal pronouns in original text
      const hasPersonalPronouns = /\b(my|me|i|mine)\b/i.test(semantics.original);
      
      // Check for inform intent (often used when sharing personal info)
      const hasInformIntent = semantics.intents.some(intent => 
        intent.type === 'inform' && intent.confidence > 0.7
      );
      
      return hasPersonEntity || hasPersonalQuestion || (hasPersonalPronouns && hasInformIntent);
    }
    
    /**
     * Determine if semantics indicate a domain-specific context
     * @param {Object} semantics - The parsed semantic information
     * @returns {boolean} Whether this is a domain context
     */
    hasDomainContext(semantics) {
      // Domain keywords that indicate technical or domain-specific queries
      const domainKeywords = [
        'algorithm', 'database', 'function', 'class', 'object', 
        'system', 'program', 'code', 'api', 'interface',
        'network', 'server', 'process', 'application', 'technology'
      ];
      
      // Check if original text contains domain keywords
      const lowerText = semantics.original.toLowerCase();
      const hasDomainTerms = domainKeywords.some(keyword => 
        lowerText.includes(keyword.toLowerCase())
      );
      
      // Check for Topic entities that match domain keywords
      const hasDomainTopics = semantics.entities.some(entity => 
        entity.type === 'Topic' && 
        entity.properties && 
        entity.properties.name && 
        domainKeywords.some(keyword => 
          entity.properties.name.toLowerCase() === keyword.toLowerCase()
        )
      );
      
      return hasDomainTerms || hasDomainTopics;
    }
    
    /**
     * Get relevant personal information based on a question
     * @param {string} question - The user's question
     * @param {Object} semantics - Optional pre-parsed semantics
     * @returns {Object|null} Personal information if found
     */
    getPersonalInfoForQuestion(question, semantics = null) {
      return this.personalInfoManager.getPersonalInfoForQuestion(question, semantics);
    }
    
    /**
     * Explicitly check if user is providing personal information
     * @param {string} userInput - The user's input string
     * @param {Object} semantics - Optional pre-parsed semantics
     * @returns {Object|null} - The personal info found or null
     */
    getPersonalInfoFromStatement(userInput, semantics = null) {
      return this.personalInfoManager.getPersonalInfoFromStatement(userInput, semantics);
    }
    
    /**
     * Store personal information in the knowledge graph
     * @param {Object} personalInfo - The personal information to store
     * @returns {Object} The created or updated entity
     */
    storePersonalInfo(personalInfo) {
      return this.personalInfoManager.storePersonalInfo(personalInfo);
    }
    
    /**
     * Get the primary intent from semantics
     * @param {Object} semantics - The semantic understanding
     * @returns {Object} The primary intent
     */
    getPrimaryIntent(semantics) {
      return this.intentClassifier.getPrimaryIntent(semantics);
    }
    
    /**
     * Check if the semantics contain a specific intent type
     * @param {Object} semantics - The semantic understanding
     * @param {string} intentType - The intent type to check for
     * @param {number} confidenceThreshold - The minimum confidence threshold
     * @returns {boolean} Whether the intent exists with sufficient confidence
     */
    hasIntent(semantics, intentType, confidenceThreshold = 0.7) {
      return this.intentClassifier.hasIntent(semantics, intentType, confidenceThreshold);
    }
}

export default SchemaProcessor;