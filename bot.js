// bot.js
// Main orchestration class that coordinates all components for the chatbot

import SchemaDatabase from './knowledge/schema-database.js';
import KnowledgeGraph from './knowledge/knowledge-graph.js';
import SchemaProcessor from './semantics/schema-processor.js';
import ContextManager from './cognitive/context-manager.js';
import MemoryManager from './cognitive/memory-manager.js';
import ResponseGenerator from './response/response-generator.js';
import RelevanceCalculator from './utils/relevance-calculator.js';

/**
 * Bot class serves as the main orchestration layer that coordinates
 * all components of the system to process user queries and generate responses
 */
class Bot {
  constructor() {
    this.logger = console; // Initialize logger first
    this.schemaDatabase = new SchemaDatabase();
    this.knowledgeGraph = new KnowledgeGraph();
    this.schemaProcessor = new SchemaProcessor(this.knowledgeGraph);
    
    // Cognitive components
    this.contextManager = new ContextManager(this.knowledgeGraph);
    this.memoryManager = new MemoryManager(this.knowledgeGraph, this.schemaDatabase);
    
    // Response generation
    this.responseGenerator = new ResponseGenerator(this.knowledgeGraph, this.memoryManager);
    
    // Utility components
    this.relevanceCalculator = new RelevanceCalculator();
    
    // Conversation state
    this.conversationMemory = {
      userName: null,
      recentQueries: [],
      personalInfo: {},
      lastResponse: null
    };
    
    this.initialized = false;
  }
  
  /**
   * Initializes the bot and all its components
   * @returns {Promise<void>}
   */
  async initBot() {
    try {
      this.logger.log("Initializing bot components...");
      
      // Initialize database first
      await this.schemaDatabase.openDatabase();
      this.logger.log("Database initialized");
      
      // Load any persisted knowledge into the knowledge graph
      const persistedEntities = await this.schemaDatabase.getAllEntities({ limit: 100 });
      for (const entity of persistedEntities) {
        this.knowledgeGraph.loadEntity(entity);
      }
      this.logger.log(`Loaded ${persistedEntities.length} entities from database`);
      
      // Initialize transformer model for response generation
      await this.responseGenerator.initializeTransformer();
      this.logger.log("Transformer model initialized");
      
      // Preload common schema definitions
      await this.schemaProcessor.loadCommonSchemas();
      this.logger.log("Schema definitions loaded");
      
      // Initialize the working memory with high-relevance invariant axioms
      const invariantAxioms = await this.schemaDatabase.getInvariantAxioms();
      for (const axiom of invariantAxioms) {
        this.memoryManager.addToWorkingMemory(axiom.id, 0.9);
      }
      this.logger.log(`Initialized working memory with ${invariantAxioms.length} invariant axioms`);
      
      this.initialized = true;
      this.logger.log("Bot initialization complete");
    } catch (error) {
      this.logger.error("Error initializing bot:", error);
      throw new Error(`Failed to initialize bot: ${error.message}`);
    }
  }
  
  /**
   * Handles user query and generates response
   * @param {string} userQuery - The user's input
   * @returns {Promise<string>} - The bot's response
   */
  async handleUserQuery(userQuery) {
    if (!this.initialized) {
      await this.initBot();
    }
    
    try {
      this.logger.log(`Processing user query: "${userQuery}"`);
      
      // Update conversation memory with the current query
      this.updateConversationMemory(userQuery);
      
      // Step 1: Process the query to extract semantics
      const semantics = await this.processUserInput(userQuery);
      
      // Step 2: Update the conversation context
      const currentContext = await this.contextManager.updateContext(semantics, userQuery);
      
      // Step 3: Retrieve relevant knowledge based on semantics and context
      const relevantEntities = await this.retrieveKnowledge(semantics, currentContext);
      
      // Step 4: Generate a response using the retrieved knowledge
      const response = await this.generateResponse(relevantEntities, semantics, currentContext);
      
      // Step 5: Learn from this interaction (update knowledge if needed)
      await this.updateKnowledge(semantics, response);
      
      // Step 6: Store the response in memory and decay attention weights
      this.conversationMemory.lastResponse = response;
      this.memoryManager.decayAttentionWeights(0.1);
      
      return response;
    } catch (error) {
      this.logger.error('Error processing query:', error);
      return 'Sorry, I encountered an error while processing your request. Could you try again?';
    }
  }
  
  /**
   * Updates the conversation memory with the current query
   * @param {string} userQuery - The user's query
   */
  updateConversationMemory(userQuery) {
    // Add to recent queries (keep last 5)
    this.conversationMemory.recentQueries.unshift(userQuery);
    if (this.conversationMemory.recentQueries.length > 5) {
      this.conversationMemory.recentQueries.pop();
    }
  }
  
  /**
   * Processes user input to extract semantic information
   * @param {string} userInput - User's raw input
   * @returns {Object} - Semantic understanding
   */
  async processUserInput(userInput) {
    this.logger.log(`Processing user input: "${userInput}"`);
    
    // Use the schema processor to extract entities, intents, and relationships
    const semantics = this.schemaProcessor.processQuery(userInput, {
      includePersonalInfo: true,
      includeEntityExtraction: true,
      detectIntent: true,
      contextHistory: this.conversationMemory.recentQueries
    });
    
    // Get the primary intent for logging
    const primaryIntent = this.schemaProcessor.getPrimaryIntent(semantics);
    this.logger.log(`Detected primary intent: ${primaryIntent.type} with confidence ${primaryIntent.confidence.toFixed(2)}`);
    
    // Create knowledge graph entities from the extracted semantics
    const createdEntities = await this.schemaProcessor.createEntitiesFromSemantics(semantics, 'user');
    if (createdEntities.length > 0) {
      this.logger.log(`Created ${createdEntities.length} entities from user input`);
    }
    
    // Extract and store personal info if present
    const personalInfo = this.schemaProcessor.extractPersonalInfo(userInput, semantics);
    if (personalInfo) {
      this.logger.log(`Extracted personal info: ${JSON.stringify(personalInfo)}`);
      // Update conversation memory with personal info
      this.conversationMemory.personalInfo = {
        ...this.conversationMemory.personalInfo,
        ...personalInfo
      };
      
      // If we got a name, update userName
      if (personalInfo.name) {
        this.conversationMemory.userName = personalInfo.name;
      }
    }
    
    return semantics;
  }
  
  /**
   * Retrieves relevant knowledge
   * @param {Object} semantics - Semantic understanding
   * @param {Object} context - Current context
   * @returns {Promise<Array>} - Relevant knowledge entities
   */
  async retrieveKnowledge(semantics, context) {
    this.logger.log(`Retrieving knowledge for context: ${context.type}`);
    
    // Prepare query from semantics
    const query = {
      text: semantics.original || "",
      entities: semantics.entities || [],
      intents: semantics.intents || [],
      contextType: context.type
    };
    
    // Retrieve knowledge from working memory first (fast path)
    const workingMemoryEntities = this.memoryManager.getWorkingMemoryContext(query, {
      limit: 10,
      contextType: context.type
    });
    
    // Then retrieve from knowledge graph based on relevance
    const graphEntities = await this.knowledgeGraph.retrieveRelevantEntities(query, {
      limit: 20,
      minConfidence: 0.3,
      includeRelationships: true,
      prioritizeInvariantAxioms: true
    });
    
    // Merge entities from both sources, prioritizing working memory
    let combinedEntities = [...workingMemoryEntities];
    for (const entity of graphEntities) {
      if (!combinedEntities.some(e => e.id === entity.id)) {
        combinedEntities.push(entity);
      }
    }
    
    // Sort by relevance
    combinedEntities = this.relevanceCalculator.sortByRelevance(
      combinedEntities,
      query,
      { contextType: context.type }
    );
    
    // Apply inferences to potentially discover new knowledge
    const inferenceResults = this.knowledgeGraph.performInference(combinedEntities);
    if (inferenceResults.length > 0) {
      this.logger.log(`Inferred ${inferenceResults.length} new facts from existing knowledge`);
      // Add inferred entities to the result set
      for (const inferred of inferenceResults) {
        if (!combinedEntities.some(e => e.id === inferred.id)) {
          combinedEntities.push(inferred);
        }
      }
    }
    
    this.logger.log(`Retrieved ${combinedEntities.length} relevant entities`);
    return combinedEntities.slice(0, 25); // Limit to top 25 most relevant
  }
  
  /**
   * Generates a response based on retrieved knowledge
   * @param {Array} relevantEntities - Relevant entities
   * @param {Object} semantics - Semantic understanding
   * @param {Object} context - Current context
   * @returns {Promise<string>} - Generated response
   */
  async generateResponse(relevantEntities, semantics, context) {
    this.logger.log(`Generating response for context type: ${context.type}`);
    
    // Track which entities are used in the response for axiom promotion
    const usedAxioms = new Set();
    
    // Select response strategy based on semantics and entities
    const responseStrategy = this.responseGenerator.selectResponseStrategy(semantics, relevantEntities);
    this.logger.log(`Selected response strategy: ${responseStrategy}`);
    
    // Generate response using the selected strategy
    const response = await this.responseGenerator.generateResponse({
      relevantEntities,
      semantics,
      context,
      personalInfo: this.conversationMemory.personalInfo,
      userName: this.conversationMemory.userName,
      recentQueries: this.conversationMemory.recentQueries,
      usedAxioms // This will be populated during generation
    });
    
    // Record which axioms were used in the response
    if (usedAxioms.size > 0) {
      this.logger.log(`Response used ${usedAxioms.size} axioms`);
      await this.responseGenerator.recordAxiomUsage(Array.from(usedAxioms));
    }
    
    return response;
  }
  
  /**
   * Updates the bot's knowledge based on learning from interaction
   * @param {Object} semantics - Semantic understanding
   * @param {string} response - The bot's response
   * @returns {Promise<void>}
   */
  async updateKnowledge(semantics, response) {
    try {
      // Check if we should learn from this interaction
      if (!semantics || !semantics.entities || semantics.entities.length === 0) {
        return; // Nothing to learn
      }
      
      // For each entity used in the query, update its usage statistics
      for (const entity of semantics.entities) {
        if (entity.id) {
          this.memoryManager.recordEntityUsage(entity.id);
        }
      }
      
      // Check if any invariant axioms were challenged by this interaction
      // (for example, if the user corrected the bot)
      const corrections = this.detectCorrections(semantics, response);
      if (corrections.length > 0) {
        this.logger.log(`Detected ${corrections.length} potential corrections to existing knowledge`);
        
        // Handle each correction
        for (const correction of corrections) {
          await this.knowledgeGraph.addCorrectionEvidence(
            correction.entityId,
            correction.property,
            correction.newValue,
            'user',
            0.8 // High confidence for user corrections
          );
        }
      }
      
      // Check for potential new invariant axioms to promote
      const potentialInvariants = this.memoryManager.findPromotionCandidates();
      if (potentialInvariants.length > 0) {
        this.logger.log(`Found ${potentialInvariants.length} variant axioms eligible for promotion`);
        
        for (const axiomId of potentialInvariants) {
          const shouldPromote = this.memoryManager.shouldPromoteAxiom(
            axiomId,
            await this.schemaDatabase.getAxiomUsageData(axiomId)
          );
          
          if (shouldPromote) {
            this.logger.log(`Promoting axiom ${axiomId} to invariant status`);
            await this.knowledgeGraph.promoteVariantToInvariant(axiomId);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error updating knowledge:', error);
      // Continue execution - knowledge update failures shouldn't break the bot
    }
  }
  
  /**
   * Detects if the user is correcting previously provided information
   * @param {Object} semantics - Semantic understanding
   * @param {string} response - Bot's response
   * @returns {Array} - List of detected corrections
   */
  detectCorrections(semantics, response) {
    const corrections = [];
    
    // Check for correction intents
    const hasCorrectionIntent = semantics.intents && semantics.intents.some(
      intent => intent.type === 'correct' && intent.confidence > 0.7
    );
    
    // Check for correction patterns in the text
    const correctionPatterns = [
      { regex: /no,?\s+(my|the)\s+(\w+)\s+is\s+(.+)/i, property: '$2', value: '$3' },
      { regex: /that('s| is)\s+not\s+(right|correct)/i },
      { regex: /actually,?\s+(my|the)\s+(\w+)\s+is\s+(.+)/i, property: '$2', value: '$3' }
    ];
    
    const hasTextualCorrection = correctionPatterns.some(pattern => 
      pattern.regex.test(semantics.original)
    );
    
    if (hasCorrectionIntent || hasTextualCorrection) {
      // Extract the entity and property being corrected
      for (const pattern of correctionPatterns) {
        const match = semantics.original.match(pattern.regex);
        if (match && pattern.property && pattern.value) {
          // Find the entity being corrected
          const property = match[pattern.property.replace('$', '')];
          const newValue = match[pattern.value.replace('$', '')].trim();
          
          // Look for an entity with this property in recent knowledge
          const recentEntityIds = this.memoryManager.getRecentlyUsedEntityIds();
          for (const entityId of recentEntityIds) {
            const entity = this.knowledgeGraph.getEntity(entityId);
            if (entity && entity.properties && entity.properties[property]) {
              corrections.push({
                entityId,
                property,
                oldValue: entity.properties[property],
                newValue
              });
              break;
            }
          }
        }
      }
    }
    
    return corrections;
  }
}

export default Bot;