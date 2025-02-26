// bot.js
// Refactored Bot implementation based on UOR framework
// Handles user interaction, knowledge retrieval, and response generation
// Main orchestration class that coordinates cognitive components

import UORCortex from './uor-cortex.js';
import { LogicEngine } from './semantics/logic.js';
import SchemaProcessor from './semantics/schema-processor.js';

// Import cognitive components
import ContextKernel from './cognitive/context-kernel.js';
import AttentionWeights from './cognitive/attention-weights.js';
import MemoryTraversal from './cognitive/memory-traversal.js';

// Import response generators
import ResponseGenerator from './response/response-generator.js';
import PersonalResponseGenerator from './response/personal-response.js';
import DomainResponseGenerator from './response/domain-response.js';

// Import utility modules
import ContextDetection from './utils/context-detection.js';
import RelevanceCalculator from './utils/relevance-calculator.js';

export default class Bot {
  constructor() {
    this.logger = console; // Initialize logger first
    this.uorCortex = new UORCortex(); // Initialize the UOR Cortex for knowledge representation
    this.logicEngine = new LogicEngine(); // Initialize the LogicEngine
    this.schemaProcessor = new SchemaProcessor(this.uorCortex); // Initialize the schema processor
    
    // Initialize cognitive components
    this.contextKernel = new ContextKernel(this.uorCortex);
    this.attentionWeights = new AttentionWeights(this.uorCortex);
    this.memoryTraversal = new MemoryTraversal(this.uorCortex);
    this.contextDetection = new ContextDetection();
    this.relevanceCalculator = new RelevanceCalculator();
    
    // Initialize response generators
    this.responseGenerator = new ResponseGenerator(this.uorCortex);
    this.personalResponseGenerator = new PersonalResponseGenerator(this.uorCortex);
    this.domainResponseGenerator = new DomainResponseGenerator(this.uorCortex);
    
    // Conversation memory for quick access
    this.conversationMemory = {
      userName: null,
      recentQueries: [],
      personalInfo: {},
      lastResponse: null,
      currentContext: null
    };
    
    this.initBot(); // Initialize the bot after logger is set
  }

  /**
   * Initializes the bot by setting up necessary components such as the UOR Cortex.
   * @returns {Promise<void>}
   */
  async initBot() {
    try {
      // Create or retrieve the context kernel for this conversation
      await this.contextKernel.createOrRetrieveContextKernel();
      
      // Initialize the knowledge base with sample kernels
      this.initializeKnowledgeBase();
      
      this.logger.log("Bot initialization complete with refactored cognitive architecture.");
    } catch (error) {
      this.logger.error("Error during bot initialization:", error);
    }
  }

  /**
   * Initialize the knowledge base with some sample kernels
   * This can be extended or replaced with real data in production
   */
  initializeKnowledgeBase() {
    try {
      // Create sample kernels about UOR and context management
      const kernelUOR = this.uorCortex.createKernel({
        title: "UOR Framework",
        content: "The Universal Object Reference (UOR) framework provides a way to represent knowledge as a directed acyclic graph of interconnected kernels."
      });
      
      const kernelTokenLimits = this.uorCortex.createKernel({
        title: "Token Limits",
        content: "Language models have token limits that constrain the amount of context they can process at once, requiring efficient context management."
      });
      
      const kernelContextPacking = this.uorCortex.createKernel({
        title: "Context Packing",
        content: "Context packing involves selectively including relevant information within token limits while maintaining coherence and relevance."
      });
      
      const kernelContextLevels = this.uorCortex.createKernel({
        title: "Hierarchical Context",
        content: "Organizing context into hierarchical levels based on relevance allows for more efficient use of token limits and better response quality."
      });
      
      const kernelTraversal = this.uorCortex.createKernel({
        title: "Lattice Traversal",
        content: "Traversing the UOR lattice involves following relationships between kernels to build a rich context for response generation."
      });
      
      // Link the kernels with relationships
      this.uorCortex.linkObjects(kernelUOR.kernelReference, kernelTokenLimits.kernelReference, "relates_to");
      this.uorCortex.linkObjects(kernelTokenLimits.kernelReference, kernelContextPacking.kernelReference, "requires");
      this.uorCortex.linkObjects(kernelContextPacking.kernelReference, kernelContextLevels.kernelReference, "implements");
      this.uorCortex.linkObjects(kernelContextLevels.kernelReference, kernelTraversal.kernelReference, "uses");
      this.uorCortex.linkObjects(kernelUOR.kernelReference, kernelTraversal.kernelReference, "defines");
      
      // Apply initial attention weights to these foundational kernels
      this.attentionWeights.applyAttentionToKernel(kernelUOR.kernelReference, 0.8);
      this.attentionWeights.distributeAttentionAcrossRelationships(kernelUOR.kernelReference);
      
      this.logger.log("Knowledge base initialized with sample kernels and relationships");
    } catch (error) {
      this.logger.error("Error initializing knowledge base:", error);
    }
  }

  /**
   * Handles user input, processes the query, and retrieves relevant knowledge from the UOR framework.
   * This method orchestrates cognitive components to generate a response.
   * @param {string} userQuery - The query input from the user.
   * @returns {Promise<string>} - The generated response to the user.
   */
  async handleUserQuery(userQuery) {
    try {
      this.logger.log(`Processing user query: "${userQuery}"`);
      
      // Update conversation memory with the current query
      this.updateConversationMemory(userQuery);
      
      // Step 1: Process query using schema processor to extract semantics
      const { queryKernel, semantics, createdKernels } = this.schemaProcessor.processQuery(userQuery);
      
      // Step 2: Update and detect the context based on semantics
      await this.contextKernel.updateContext(semantics, userQuery);
      const currentContext = this.contextKernel.getCurrentContext();
      this.conversationMemory.currentContext = currentContext;
      
      // Step 3: Determine which traversal strategy to use based on context
      let packedContext;
      if (this.isPersonalInfoQuestion(semantics)) {
        // Use personal information traversal strategy
        packedContext = await this.memoryTraversal.getWorkingMemoryContext(queryKernel.kernel, {
          prioritizeSchemaType: 'Person',
          recencyWeight: 0.9,
          contextType: 'personal'
        });
      } else if (this.isDomainQuestion(semantics)) {
        // Use domain knowledge traversal strategy
        packedContext = await this.memoryTraversal.getWorkingMemoryContext(queryKernel.kernel, {
          contextType: 'domain',
          includeRecentConversation: true
        });
      } else {
        // Default traversal strategy
        packedContext = await this.traverseUORLattice(queryKernel.kernel);
      }
      
      // Step 4: Apply logical inference to the packed context
      const inferenceResults = this.applyLogicalInference(packedContext);
      
      // Step 5: Boost attention for the current context
      this.attentionWeights.boostAttentionForContext(currentContext.type);
      
      // Step 6: Aggregate the context into a higher-level representation
      const higherLevelContext = this.aggregateContext(inferenceResults, semantics);
      
      // Step 7: Generate a response based on the higher-level context and semantics
      const response = await this.generateResponse(higherLevelContext, semantics);
      
      // Step 8: Store the response in memory and apply temporal decay to attention
      this.conversationMemory.lastResponse = response;
      this.attentionWeights.decayAttentionOverTime();
      
      return response;
    } catch (error) {
      this.logger.error('Error processing query:', error);
      return 'Sorry, there was an error processing your request.';
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
   * Checks if the query is asking for personal information
   * @param {Object} semantics - The semantic understanding of the query
   * @returns {boolean} - True if this is a personal info question
   */
  isPersonalInfoQuestion(semantics) {
    return this.contextDetection.hasPersonalContext(semantics);
  }
  
  /**
   * Checks if the query is about domain knowledge (UOR, frameworks, etc.)
   * @param {Object} semantics - The semantic understanding of the query
   * @returns {boolean} - True if this is a domain question
   */
  isDomainQuestion(semantics) {
    return this.contextDetection.hasDomainContext(semantics);
  }

  /**
   * Traverse the UOR lattice to build a contextually rich representation of knowledge
   * related to the query.
   * @param {Object} queryKernel - The kernel representing the user's query
   * @returns {Promise<Array>} - Array of relevant kernels that form the context
   */
  async traverseUORLattice(queryKernel) {
    this.logger.log(`Traversing UOR lattice for query kernel`);
    
    try {
      // Delegate to the UOR Cortex for proper lattice traversal
      const packedContext = await this.uorCortex.traverseUORLattice(queryKernel);
      
      this.logger.log(`Lattice traversal complete. Retrieved ${packedContext.length} relevant kernels`);
      return packedContext;
    } catch (error) {
      this.logger.error(`Error during lattice traversal: ${error.message}`);
      // Return an empty context in case of error
      return [];
    }
  }

  /**
   * Applies logical inference to the resolved kernels.
   * The inferred results are based on relationships, rules, and logic defined within the UOR framework.
   * @param {Array} packedContext - The kernels retrieved during lattice traversal.
   * @returns {Array} - The list of inference results based on logical reasoning.
   */
  applyLogicalInference(packedContext) {
    this.logger.log(`Applying logical inference to ${packedContext.length} kernels`);
    
    // Apply inference to each kernel in the context
    const inferenceResults = packedContext.map(contextItem => {
      const kernel = contextItem;
      
      // Apply logic rules to the kernel
      try {
        const inferredKernel = this.logicEngine.applyInference(kernel);
        return inferredKernel;
      } catch (error) {
        this.logger.error(`Inference error for kernel: ${error.message}`);
        return kernel; // Return original kernel if inference fails
      }
    });
    
    this.logger.log(`Inference complete. Processed ${inferenceResults.length} kernels`);
    return inferenceResults;
  }

  /**
   * Aggregate context into a higher-level representation
   * @param {Array} inferenceResults - The context after inference has been applied
   * @param {Object} semantics - The semantic understanding of the query
   * @returns {Object} - Higher-level context for response generation
   */
  aggregateContext(inferenceResults, semantics) {
    this.logger.log(`Aggregating context from ${inferenceResults.length} kernels`);
    
    // Get the original user query
    let queryText = semantics ? semantics.original : "";
    
    // Delegate to UOR Cortex for context aggregation
    const higherLevelContext = this.uorCortex.aggregateContext(inferenceResults);
    
    // Organize key information for the response generator
    const structuredContext = {
      queryText: queryText,
      kernelCount: inferenceResults.length,
      aggregatedKernels: higherLevelContext,
      relevantFacts: this.extractRelevantFacts(higherLevelContext),
      keyRelationships: this.extractKeyRelationships(higherLevelContext),
      semantics: semantics, // Include semantic understanding
      currentContext: this.conversationMemory.currentContext,
      personalInfo: this.conversationMemory.personalInfo,
      userName: this.conversationMemory.userName
    };
    
    this.logger.log(`Context aggregation complete`);
    return structuredContext;
  }
  
  /**
   * Extract the most relevant facts from the context for response generation
   * @param {Array} higherLevelContext - The aggregated context
   * @returns {Array} - Array of relevant facts
   */
  extractRelevantFacts(higherLevelContext) {
    // Extract key facts from the kernels
    return higherLevelContext
      .filter(kernel => kernel.relevanceScore > 0.1) // Include more kernels
      .map(kernel => {
        // Check for schema type kernels first
        if (kernel.data && kernel.data.schemaType) {
          // Handle schema.org typed kernels
          return {
            schemaType: kernel.data.schemaType,
            properties: kernel.data.properties || {},
            relevance: kernel.relevanceScore
          };
        }
        
        // Extract the most important information from regular kernels
        if (typeof kernel.data === 'object' && kernel.data.title && kernel.data.content) {
          return { title: kernel.data.title, content: kernel.data.content };
        } else if (typeof kernel.data === 'object') {
          return { content: JSON.stringify(kernel.data) };
        } else {
          return { content: String(kernel.data) };
        }
      });
  }
  
  /**
   * Extract key relationships from the context
   * @param {Array} higherLevelContext - The aggregated context 
   * @returns {Array} - Array of important relationships
   */
  extractKeyRelationships(higherLevelContext) {
    const relationships = [];
    
    // Build a map of kernels by reference for quick lookup
    const kernelMap = new Map();
    higherLevelContext.forEach(kernel => {
      if (kernel.reference) {
        kernelMap.set(kernel.reference, kernel);
      }
    });
    
    // Find relationships between kernels in the context
    higherLevelContext.forEach(kernel => {
      if (kernel.relationships) {
        kernel.relationships.forEach(rel => {
          const targetKernel = kernelMap.get(rel.targetKernelRef);
          if (targetKernel) {
            // Get titles from kernel data
            let sourceTitle = 'Unknown';
            let targetTitle = 'Unknown';
            
            if (kernel.data) {
              sourceTitle = kernel.data.title || 
                           (kernel.data.schemaType ? kernel.data.schemaType : 'Unknown');
            }
            
            if (targetKernel.data) {
              targetTitle = targetKernel.data.title || 
                           (targetKernel.data.schemaType ? targetKernel.data.schemaType : 'Unknown');
            }
            
            relationships.push({
              source: kernel.reference,
              sourceTitle: sourceTitle,
              target: rel.targetKernelRef,
              targetTitle: targetTitle,
              relationship: rel.relationshipType
            });
          }
        });
      }
    });
    
    return relationships;
  }

  /**
   * Generates a response based on the higher-level context.
   * Delegates to appropriate specialized response generators based on context.
   * @param {Object} higherLevelContext - The structured context for response generation.
   * @param {Object} semantics - The semantic understanding of the query.
   * @returns {Promise<string>} - The response generated by the model.
   */
  async generateResponse(higherLevelContext, semantics) {
    this.logger.log(`Generating response based on higher-level context and semantics`);
    
    // Determine the appropriate response strategy based on context
    const responseStrategy = this.responseGenerator.selectResponseStrategy(semantics, higherLevelContext);
    
    // Generate the response using the appropriate strategy
    switch (responseStrategy) {
      case 'personal':
        return this.personalResponseGenerator.generatePersonalResponse(higherLevelContext, semantics);
        
      case 'domain':
        return this.domainResponseGenerator.generateDomainResponse(higherLevelContext, semantics);
        
      case 'greeting':
        return this.personalResponseGenerator.generateGreetingResponse(
          semantics, 
          this.conversationMemory.userName
        );
        
      case 'acknowledgement':
        return this.personalResponseGenerator.generateAcknowledgementResponse(
          semantics, 
          this.conversationMemory.personalInfo
        );
        
      default:
        // Fallback to the main response generator
        return this.responseGenerator.generateResponse(higherLevelContext, semantics);
    }
  }
}