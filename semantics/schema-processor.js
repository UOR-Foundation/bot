// schema-processor.js
// Refactored implementation that coordinates schema.org-based semantic processing

import SchemaDefinitions from './schema-definitions.js';
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
      this.schemaDefinitions = new SchemaDefinitions(); // Schema type definitions
      this.entityExtractor = new EntityExtractor(); // Extracts entities from text
      this.intentClassifier = new IntentClassifier(); // Classifies user intents
      this.personalInfoManager = new PersonalInfoManager(uorCortex); // Handles personal info
      this.kernelCreator = new KernelCreator(uorCortex); // Creates kernels from entities
      this.logger = console; // Logger (can be replaced with a custom one)
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
        this.entityExtractor.extractPersonInfo(userInput, semantics);
        
        // Extract question information
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
     * Process user query using schema-based semantics
     * @param {string} userQuery - The user's input
     * @returns {Object} The query kernel and semantic information
     */
    processQuery(userQuery) {
      this.logger.log(`Processing query with schema semantics: "${userQuery}"`);
      
      // Parse user input to extract semantic information
      const semantics = this.parseUserInput(userQuery);
      
      // Create kernels based on the semantic entities
      const createdKernels = this.kernelCreator.createKernelsFromSemantics(semantics);
      
      // Create a query kernel
      const queryKernel = this.kernelCreator.createQueryKernel(userQuery, semantics);
      
      // Link the query kernel to created entity kernels
      this.kernelCreator.linkQueryToEntities(queryKernel, createdKernels);
      
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
      return this.personalInfoManager.getPersonalInfoForQuestion(question);
    }
    
    /**
     * Explicitly check if user is providing personal information
     * @param {string} userInput - The user's input string
     * @returns {Object|null} - The personal info found or null
     */
    getPersonalInfoFromStatement(userInput) {
      return this.personalInfoManager.getPersonalInfoFromStatement(userInput);
    }
    
    /**
     * Store personal information in the UOR graph
     * @param {Object} personalInfo - The personal information to store
     * @returns {Object} The created or updated kernel
     */
    storePersonalInfo(personalInfo) {
      return this.personalInfoManager.storePersonalInfo(personalInfo);
    }
}
  
export default SchemaProcessor;