// bot.js
// Bot implementation based on UOR framework
// Handles user interaction, knowledge retrieval, and response generation

import UORCortex from './uor-cortex.js'; // Import UOR Cortex class to handle knowledge representation
import { LogicEngine } from './semantics/logic.js'; // Import LogicEngine class
import SchemaProcessor from './semantics/schema-processor.js'; // Import our new Schema Processor

export default class Bot {
  constructor() {
    this.logger = console; // Initialize logger first
    this.uorCortex = new UORCortex(); // Initialize the UOR Cortex for knowledge representation
    this.logicEngine = new LogicEngine(); // Initialize the LogicEngine
    this.schemaProcessor = new SchemaProcessor(this.uorCortex); // Initialize the schema processor
    this.conversationMemory = {
      userName: null,
      recentQueries: [],
      personalInfo: {},
      lastResponse: null
    }; // Add conversation memory
    this.initBot(); // Initialize the bot after logger is set
  }

  /**
   * Initializes the bot by setting up necessary components such as the UOR Cortex.
   * @returns {Promise<void>}
   */
  async initBot() {
    this.logger.log("Bot initialization complete.");
    
    // Add some sample kernels and relationships for testing purposes
    this.initializeKnowledgeBase();
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
      
      this.logger.log("Knowledge base initialized with sample kernels and relationships");
    } catch (error) {
      this.logger.error("Error initializing knowledge base:", error);
    }
  }

  /**
   * Handles user input, processes the query, and retrieves relevant knowledge from the UOR framework.
   * This method performs knowledge resolution and applies logical inference to generate a response.
   * @param {string} userQuery - The query input from the user.
   * @returns {Promise<string>} - The generated response to the user.
   */
  async handleUserQuery(userQuery) {
    try {
      this.logger.log(`Processing user query: "${userQuery}"`);
      
      // Add to recent queries
      this.updateConversationMemory(userQuery);
      
      // Process query using schema processor
      const { queryKernel, semantics, createdKernels } = this.schemaProcessor.processQuery(userQuery);
      
      // Log semantic understanding
      this.logger.log(`Semantic understanding: ${semantics.entities.length} entities, ${semantics.intents.length} intents`);
      
      // First check if this is a personal information statement
      if (this.isPersonalInfoStatement(semantics)) {
        return this.generatePersonalInfoAcknowledgement(semantics);
      }
      
      // Then check if this is a personal information question
      if (this.isPersonalInfoQuestion(semantics)) {
        const personalInfo = this.schemaProcessor.getPersonalInfoForQuestion(userQuery);
        if (personalInfo) {
          return this.generatePersonalInfoResponse(personalInfo);
        }
      }
      
      // Step 2: Traverse the UOR lattice to build a rich context
      const packedContext = await this.traverseUORLattice(queryKernel.kernel);
      
      // Step 3: Apply logical inference to the packed context
      const inferenceResults = this.applyLogicalInference(packedContext);
      
      // Step 4: Aggregate the context into a higher-level representation
      const higherLevelContext = this.aggregateContext(inferenceResults, semantics);
      
      // Step 5: Generate a response based on the higher-level context
      const response = await this.generateResponse(higherLevelContext, semantics);
      
      // Store the response in memory
      this.conversationMemory.lastResponse = response;
      
      return response;
    } catch (error) {
      this.logger.error('Error processing query:', error);
      return 'Sorry, there was an error processing your request.';
    }
  }
  
  /**
   * Check if the semantics represent a personal information statement
   * @param {Object} semantics - The semantic understanding of the query
   * @returns {boolean} - True if this is a personal information statement
   */
  isPersonalInfoStatement(semantics) {
    // Check if there's an inform intent with high confidence
    const hasInformIntent = semantics.intents.some(intent => 
      intent.type === 'inform' && intent.confidence > 0.7
    );
    
    if (!hasInformIntent) return false;
    
    // Check if there are Person entities with properties
    const personEntities = semantics.entities.filter(entity => 
      entity.type === 'Person' && 
      entity.properties && 
      Object.keys(entity.properties).length > 0
    );
    
    return personEntities.length > 0;
  }
  
  /**
   * Generate an acknowledgement response for personal information statements
   * @param {Object} semantics - The semantic understanding of the statement
   * @returns {string} - The acknowledgement response
   */
  generatePersonalInfoAcknowledgement(semantics) {
    const personEntity = semantics.entities.find(entity => 
      entity.type === 'Person' && entity.properties
    );
    
    if (!personEntity || !personEntity.properties) {
      return "I'm sorry, I didn't catch that personal information.";
    }
    
    const props = personEntity.properties;
    
    if (props.name) {
      // Update conversation memory explicitly
      this.conversationMemory.userName = props.name;
      this.conversationMemory.personalInfo.name = props.name;
      
      return `Nice to meet you, ${props.name}! I'll remember your name.`;
    }
    
    if (props.age) {
      this.conversationMemory.personalInfo.age = props.age;
      return `Thanks for letting me know you're ${props.age} years old. I'll remember that.`;
    }
    
    if (props.location) {
      this.conversationMemory.personalInfo.location = props.location;
      return `I see you're from ${props.location}. I'll remember that.`;
    }
    
    // For any other property
    const propName = Object.keys(props)[0];
    if (propName) {
      this.conversationMemory.personalInfo[propName] = props[propName];
      return `Thanks for letting me know about your ${propName}. I'll remember that.`;
    }
    
    return "Thanks for sharing that information with me. I'll keep that in mind.";
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
    
    // Other memory updates handled by schema processor via kernels
  }
  
  /**
   * Checks if the query is asking for personal information
   * @param {Object} semantics - The semantic understanding of the query
   * @returns {boolean} - True if this is a personal info question
   */
  isPersonalInfoQuestion(semantics) {
    // Check if there's a question intent
    const hasQuestionIntent = semantics.intents.some(intent => 
      intent.type === 'question' && intent.confidence > 0.7
    );
    
    if (!hasQuestionIntent) return false;
    
    // Check if there are questions about personal properties
    const questionEntities = semantics.entities.filter(entity => 
      entity.type === 'Question' && 
      entity.properties && 
      entity.properties.isPersonalQuestion
    );
    
    if (questionEntities.length > 0) return true;
    
    // Check if there are personal pronouns in the query
    const hasPersonalReferences = semantics.original.match(/\b(my|me|i|mine)\b/i);
    
    return hasPersonalReferences !== null;
  }
  
  /**
   * Generates a response for personal information questions
   * @param {Object} personalInfo - The personal information found
   * @returns {string} - The response
   */
  generatePersonalInfoResponse(personalInfo) {
    if (!personalInfo) {
      return "I don't have that personal information about you yet.";
    }
    
    switch (personalInfo.property) {
      case 'name':
        return `Your name is ${personalInfo.value}.`;
      case 'age':
        return `You told me you are ${personalInfo.value} years old.`;
      case 'location':
        return `You told me you're from ${personalInfo.value}.`;
      default:
        return `I know that your ${personalInfo.property} is ${personalInfo.value}.`;
    }
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
      semantics: semantics // Include semantic understanding
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
   * This method applies all the necessary context aggregation and inference before generating the final output.
   * @param {Object} higherLevelContext - The structured context for response generation.
   * @param {Object} semantics - The semantic understanding of the query.
   * @returns {Promise<string>} - The response generated by the model.
   */
  async generateResponse(higherLevelContext, semantics) {
    this.logger.log(`Generating response based on higher-level context and semantics`);
    
    // Get the query text
    const queryText = higherLevelContext.queryText || '';
    
    // Determine the primary intent from semantics
    const primaryIntent = semantics && semantics.intents.length > 0 
      ? semantics.intents.sort((a, b) => b.confidence - a.confidence)[0].type
      : 'unknown';
      
    this.logger.log(`Primary intent: ${primaryIntent}`);
    
    // Handle different intent types
    switch (primaryIntent) {
      case 'greet':
        return this.generateGreetingResponse(semantics);
        
      case 'question':
        // Double-check for personal information queries (for safety)
        if (this.isPersonalInfoQuestion(semantics)) {
          const personalInfo = this.schemaProcessor.getPersonalInfoForQuestion(queryText);
          if (personalInfo) {
            return this.generatePersonalInfoResponse(personalInfo);
          }
        }
        // Fall through to standard question handling
        return this.generateInformationalResponse(higherLevelContext, semantics);
        
      case 'inform':
        // Handle when user is providing information
        if (this.isPersonalInfoStatement(semantics)) {
          return this.generatePersonalInfoAcknowledgement(semantics);
        }
        return this.generateAcknowledgementResponse(semantics);
        
      default:
        // Default to informational response
        return this.generateInformationalResponse(higherLevelContext, semantics);
    }
  }
  
  /**
   * Generates a greeting response
   * @param {Object} semantics - The semantic understanding of the query
   * @returns {string} - The greeting response
   */
  generateGreetingResponse(semantics) {
    // Look for a Person entity with a name from previous conversations
    let knownName = this.conversationMemory.userName;
    
    // If no name in memory, try to find it in the UOR graph
    if (!knownName) {
      const allKernels = this.uorCortex.getAllKernels();
      const personKernel = allKernels.find(k => 
        k.data && k.data.schemaType === 'Person' && 
        k.data.properties && k.data.properties.name
      );
      
      if (personKernel) {
        knownName = personKernel.data.properties.name;
        // Update memory
        this.conversationMemory.userName = knownName;
      }
    }
    
    if (knownName) {
      return `Hello ${knownName}! How can I help you today?`;
    } else {
      return "Hello! I'm a friendly assistant. How can I help you today?";
    }
  }
  
  /**
   * Generates a response acknowledging provided information
   * @param {Object} semantics - The semantic understanding of the query
   * @returns {string} - The acknowledgement response
   */
  generateAcknowledgementResponse(semantics) {
    // Check what information was provided
    const personEntity = semantics.entities.find(entity => entity.type === 'Person');
    
    if (personEntity) {
      const props = personEntity.properties;
      
      if (props.name) {
        // Update memory
        this.conversationMemory.userName = props.name;
        this.conversationMemory.personalInfo.name = props.name;
        
        return `Nice to meet you, ${props.name}! How can I help you today?`;
      }
      
      if (props.age) {
        this.conversationMemory.personalInfo.age = props.age;
        return `Thanks for letting me know you're ${props.age} years old. Is there something I can help you with?`;
      }
      
      if (props.location) {
        this.conversationMemory.personalInfo.location = props.location;
        return `Thanks for letting me know you're from ${props.location}. Is there something I can help you with?`;
      }
      
      return "Thanks for sharing that information with me. Is there something specific you'd like to know?";
    }
    
    return "I've noted that information. How can I assist you?";
  }
  
  /**
   * Generates an informational response based on knowledge base
   * @param {Object} higherLevelContext - The structured context
   * @param {Object} semantics - The semantic understanding of the query
   * @returns {string} - The informational response
   */
  generateInformationalResponse(higherLevelContext, semantics) {
    const relevantFacts = higherLevelContext.relevantFacts || [];
    const factCount = relevantFacts.length;
    
    // If we have semantically-typed facts about schema entities, use those first
    const schemaFacts = relevantFacts.filter(fact => fact.schemaType);
    
    if (schemaFacts.length > 0) {
      // Handle schema-based facts specifically
      const personFacts = schemaFacts.filter(fact => fact.schemaType === 'Person');
      
      if (personFacts.length > 0) {
        // Generate response about person
        const person = personFacts[0];
        return `I know that your name is ${person.properties.name || 'unknown'}${
          person.properties.age ? ` and you are ${person.properties.age} years old` : ''
        }${
          person.properties.location ? ` and you're from ${person.properties.location}` : ''
        }.`;
      }
    }
    
    // If no relevant facts, provide a friendly response
    if (factCount === 0) {
      return "I don't have specific information on that topic yet. Is there something else I can help you with?";
    } else {
      // Combine facts into a coherent response with more natural language
      let response = "";
      
      // Get the most relevant facts
      const mainFacts = relevantFacts
        .filter(fact => fact.content) // Only include facts with content
        .slice(0, 2);
      
      if (mainFacts.length > 0) {
        // Use the first fact directly
        response = mainFacts[0].content + ". ";
        
        // Add second fact with a connector
        if (mainFacts.length > 1) {
          const connectors = ["Additionally, ", "Also, ", "Furthermore, ", "Moreover, "];
          const connector = connectors[Math.floor(Math.random() * connectors.length)];
          response += connector + mainFacts[1].content + ". ";
        }
      } else {
        response = "I can provide some information on that topic. ";
      }
      
      // Add relationship context if available, with more natural phrasing
      const keyRelationships = higherLevelContext.keyRelationships;
      if (keyRelationships && keyRelationships.length > 0) {
        const relationshipPhrases = [
          `It's worth noting that ${keyRelationships[0].sourceTitle} ${keyRelationships[0].relationship} ${keyRelationships[0].targetTitle}.`,
          `I should mention that ${keyRelationships[0].sourceTitle} is ${keyRelationships[0].relationship.replace('_', ' ')} ${keyRelationships[0].targetTitle}.`,
          `Keep in mind that there's a connection between ${keyRelationships[0].sourceTitle} and ${keyRelationships[0].targetTitle}.`
        ];
        
        response += relationshipPhrases[Math.floor(Math.random() * relationshipPhrases.length)];
      }
      
      return response;
    }
  }
}