// schema-processor.js
// Enhanced implementation that coordinates schema.org-based semantic processing
// with improved personal information extraction and context awareness

import EntityExtractor from './entity-extractor.js';
import IntentClassifier from './intent-classifier.js';
import PersonalInfoManager from './personal-info-manager.js';
import KernelCreator from './kernel-creator.js';

/**
 * SchemaProcessor class coordinates schema.org aligned semantic processing
 * for natural language understanding and knowledge representation
 */
class SchemaProcessor {
    constructor(uorCortex) {
      this.uorCortex = uorCortex; // Reference to the UOR Cortex for creating/linking kernels
      this.entityExtractor = new EntityExtractor(); // Extracts entities from text
      this.intentClassifier = new IntentClassifier(); // Classifies user intents
      this.personalInfoManager = new PersonalInfoManager(uorCortex); // Handles personal info
      this.kernelCreator = new KernelCreator(uorCortex); // Creates kernels from entities
      this.logger = console; // Logger (can be replaced with a custom one)
      
      this.previousContext = null; // Store previous conversational context
    }
    
    /**
     * Process user query using schema-based semantics
     * @param {string} userQuery - The user's input
     * @returns {Object} The query kernel, semantic information, and created kernels
     */
    processQuery(userQuery) {
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
      
      // Create kernels based on the semantic entities
      const createdKernels = this.kernelCreator.createKernelsFromSemantics(semantics);
      
      // Create a query kernel
      const queryKernel = this.kernelCreator.createQueryKernel(userQuery, semantics);
      
      // Link the query kernel to created entity kernels
      this.kernelCreator.linkQueryToEntities(queryKernel, createdKernels);
      
      // Special handling for personal info
      const personalInfo = this.getPersonalInfoFromStatement(userQuery, semantics);
      if (personalInfo) {
        // Store personal info in the UOR knowledge graph
        const personalInfoKernel = this.storePersonalInfo(personalInfo);
        // Link this info to the query
        if (personalInfoKernel && queryKernel) {
          this.uorCortex.linkObjects(
            queryKernel.kernelReference,
            personalInfoKernel.kernelReference,
            'contains'
          );
        }
      }
      
      return {
        queryKernel,
        semantics,
        createdKernels,
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
        'uor', 'framework', 'kernel', 'schema', 'context', 'bot', 
        'lattice', 'traversal', 'graph', 'semantic', 'database',
        'token', 'limit', 'memory', 'knowledge'
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
     * Store personal information in the UOR graph
     * @param {Object} personalInfo - The personal information to store
     * @returns {Object} The created or updated kernel
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