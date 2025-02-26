// response-generator.js
// Main response generation orchestrator with context awareness

/**
 * ResponseGenerator class handles generating appropriate responses
 * based on context and semantics
 */
class ResponseGenerator {
  /**
   * Initialize the response generator
   * @param {Object} uorCortex - Reference to the UOR knowledge framework
   */
  constructor(uorCortex) {
    this.uorCortex = uorCortex;
    this.logger = console; // Logger (can be replaced with a custom one)
    
    // Common response templates for flexibility
    this.templates = {
      greetings: [
        "Hello! How can I help you today?",
        "Hi there! What can I assist you with?",
        "Greetings! How may I be of service?",
        "Hello! What questions do you have today?"
      ],
      fallbacks: [
        "I don't have specific information on that topic yet. Is there something else I can help with?",
        "I'm not sure I have enough information about that. Could you tell me more?",
        "That's an interesting question, but I don't have detailed information on it yet.",
        "I don't have sufficient knowledge about that topic in my current context."
      ],
      acknowledgements: [
        "I understand.",
        "Got it.",
        "I see what you mean.",
        "That makes sense."
      ],
      transitions: [
        "On a related note,",
        "In addition,",
        "Also worth mentioning,",
        "Furthermore,"
      ]
    };
  }

  /**
   * Generate a response based on provided context and semantics
   * @param {Object} context - The context information and relevant kernels
   * @param {Object} semantics - The semantic understanding of the query
   * @returns {string} The generated response
   */
  generateResponse(context, semantics) {
    this.logger.log(`Generating response based on context and semantics`);
    
    // Select the appropriate response strategy based on semantics and context
    const strategy = this.selectResponseStrategy(semantics, context);
    
    // Aggregate context content for response construction
    const aggregatedContext = this.aggregateContextForResponse(context);
    
    // Generate the appropriate response using the selected strategy
    const response = this.formulateResponseFromContext(aggregatedContext, strategy);
    
    // Filter any irrelevant content based on current context
    const filteredResponse = this.filterIrrelevantContent(response, context.currentContext);
    
    return filteredResponse;
  }

  /**
   * Select the appropriate response strategy based on semantics and context
   * @param {Object} semantics - The semantic understanding of the query
   * @param {Object} context - The context information
   * @returns {string} The selected strategy type
   */
  selectResponseStrategy(semantics, context) {
    // Check for a primary intent in semantics
    const primaryIntent = semantics.intents && semantics.intents.length > 0
      ? semantics.intents.sort((a, b) => b.confidence - a.confidence)[0]
      : { type: 'unknown', confidence: 0 };
    
    this.logger.log(`Primary intent: ${primaryIntent.type} with confidence ${primaryIntent.confidence}`);
    
    // Handle personal information related queries and statements
    if (this.isPersonalInfoQuery(semantics, context)) {
      return 'personal_info_response';
    }
    
    // Handle different intent types
    switch (primaryIntent.type) {
      case 'greet':
        return 'greeting_response';
        
      case 'question':
        // Check what type of question it is
        if (this.isPersonalInfoQuestion(semantics)) {
          return 'personal_info_response';
        } else if (this.isDomainQuestion(semantics)) {
          return 'domain_knowledge_response';
        } else {
          return 'general_question_response';
        }
        
      case 'inform':
        // Check if this is providing personal information
        if (this.isPersonalInfoStatement(semantics)) {
          return 'personal_info_acknowledgement';
        } else {
          return 'general_acknowledgement';
        }
        
      default:
        // Default to a general informational response
        return 'general_informational_response';
    }
  }

  /**
   * Check if this is a personal information query
   * @param {Object} semantics - The semantic understanding
   * @param {Object} context - The context information
   * @returns {boolean} True if this is a personal info query
   */
  isPersonalInfoQuery(semantics, context) {
    // Check if this is a personal question based on semantics
    if (this.isPersonalInfoQuestion(semantics)) {
      return true;
    }
    
    // Check context for personal information focus
    const hasPrimaryPersonalContext = context.currentContext === 'personal';
    const hasPersonalReferences = semantics.original && semantics.original.match(/\b(my|me|i|mine)\b/i);
    
    return hasPrimaryPersonalContext && hasPersonalReferences;
  }

  /**
   * Check if this is a personal information question
   * @param {Object} semantics - The semantic understanding
   * @returns {boolean} True if this is a personal info question
   */
  isPersonalInfoQuestion(semantics) {
    // Check if there's a question intent
    const hasQuestionIntent = semantics.intents && semantics.intents.some(intent => 
      intent.type === 'question' && intent.confidence > 0.7
    );
    
    if (!hasQuestionIntent) return false;
    
    // Check if there are questions about personal properties
    const questionEntities = semantics.entities && semantics.entities.filter(entity => 
      entity.type === 'Question' && 
      entity.properties && 
      entity.properties.isPersonalQuestion
    );
    
    if (questionEntities && questionEntities.length > 0) return true;
    
    // Check if personal keywords are present in the query
    return semantics.original && /\b(my name|who am i|how old am i|my age|where.*i from|my location)\b/i.test(semantics.original);
  }

  /**
   * Check if this is a personal information statement
   * @param {Object} semantics - The semantic understanding
   * @returns {boolean} True if this is a personal info statement
   */
  isPersonalInfoStatement(semantics) {
    // Check if there's an inform intent with high confidence
    const hasInformIntent = semantics.intents && semantics.intents.some(intent => 
      intent.type === 'inform' && intent.confidence > 0.7
    );
    
    if (!hasInformIntent) return false;
    
    // Check if there are Person entities with properties
    const personEntities = semantics.entities && semantics.entities.filter(entity => 
      entity.type === 'Person' && 
      entity.properties && 
      Object.keys(entity.properties).length > 0
    );
    
    return personEntities && personEntities.length > 0;
  }

  /**
   * Check if this is a domain-specific question
   * @param {Object} semantics - The semantic understanding
   * @returns {boolean} True if this is a domain question
   */
  isDomainQuestion(semantics) {
    // Domain keywords that indicate the query is about the bot's domain knowledge
    const domainKeywords = [
      'uor', 'framework', 'bot', 'knowledge', 'semantic', 'context',
      'memory', 'token', 'limit', 'traversal', 'lattice', 'kernel',
      'schema', 'entity', 'property', 'relationship', 'inference',
      'graph', 'query', 'search', 'relevance', 'embedding'
    ];
    
    // Check if any domain keywords are present in the query
    if (semantics.original) {
      const lowerQuery = semantics.original.toLowerCase();
      return domainKeywords.some(keyword => lowerQuery.includes(keyword));
    }
    
    // Check if any topic entities match domain keywords
    const topicEntities = semantics.entities && semantics.entities.filter(entity => 
      entity.type === 'Topic' && entity.properties && entity.properties.name
    );
    
    if (topicEntities && topicEntities.length > 0) {
      return topicEntities.some(entity => 
        domainKeywords.includes(entity.properties.name.toLowerCase())
      );
    }
    
    return false;
  }

  /**
   * Aggregate context information for response generation
   * @param {Object} context - The context information and relevant kernels
   * @returns {Object} Aggregated context for response formulation
   */
  aggregateContextForResponse(context) {
    this.logger.log(`Aggregating context for response`);
    
    // Extract query text if available
    const queryText = context.queryText || '';
    
    // Get the relevant kernels sorted by relevance
    const relevantKernels = context.aggregatedKernels || [];
    
    // Organize key information for the response generator
    const aggregatedContext = {
      queryText: queryText,
      kernelCount: relevantKernels.length,
      relevantFacts: this.extractRelevantFacts(relevantKernels),
      keyRelationships: this.extractKeyRelationships(relevantKernels),
      currentContext: context.currentContext || 'general',
      personInfo: this.extractPersonInfo(relevantKernels),
      domainInfo: this.extractDomainInfo(relevantKernels)
    };
    
    this.logger.log(`Context aggregation complete: ${aggregatedContext.relevantFacts.length} facts, ${aggregatedContext.keyRelationships.length} relationships`);
    return aggregatedContext;
  }

  /**
   * Extract the most relevant facts from the kernels
   * @param {Array} kernels - The relevant kernels
   * @returns {Array} Array of relevant facts
   */
  extractRelevantFacts(kernels) {
    // Extract key facts from the kernels, sorted by relevance
    return kernels
      .filter(kernel => kernel.relevanceScore > 0.1)
      .map(kernel => {
        // Handle schema-typed kernels first
        if (kernel.data && kernel.data.schemaType) {
          return {
            schemaType: kernel.data.schemaType,
            properties: kernel.data.properties || {},
            relevance: kernel.relevanceScore
          };
        }
        
        // Handle regular content kernels
        if (typeof kernel.data === 'object' && kernel.data.title && kernel.data.content) {
          return { 
            title: kernel.data.title, 
            content: kernel.data.content,
            relevance: kernel.relevanceScore
          };
        } else if (typeof kernel.data === 'object') {
          return { 
            content: JSON.stringify(kernel.data),
            relevance: kernel.relevanceScore 
          };
        } else {
          return { 
            content: String(kernel.data),
            relevance: kernel.relevanceScore 
          };
        }
      })
      .sort((a, b) => (b.relevance || 0) - (a.relevance || 0)); // Sort by relevance
  }

  /**
   * Extract key relationships from the kernels
   * @param {Array} kernels - The relevant kernels
   * @returns {Array} Array of key relationships
   */
  extractKeyRelationships(kernels) {
    const relationships = [];
    
    // Build a map of kernels by reference for quick lookup
    const kernelMap = new Map();
    kernels.forEach(kernel => {
      if (kernel.reference) {
        kernelMap.set(kernel.reference, kernel);
      }
    });
    
    // Find relationships between kernels
    kernels.forEach(kernel => {
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
              relationship: rel.relationshipType,
              relevance: (kernel.relevanceScore || 0) * 0.7 + (targetKernel.relevanceScore || 0) * 0.3
            });
          }
        });
      }
    });
    
    // Sort relationships by combined relevance
    return relationships.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Extract person information from the kernels
   * @param {Array} kernels - The relevant kernels
   * @returns {Object|null} Person information or null
   */
  extractPersonInfo(kernels) {
    // Find Person kernels
    const personKernels = kernels.filter(kernel => 
      kernel.data && 
      kernel.data.schemaType === 'Person' && 
      kernel.data.properties
    );
    
    if (personKernels.length === 0) {
      return null;
    }
    
    // Get the most relevant person kernel
    const mostRelevantPerson = personKernels.sort((a, b) => 
      (b.relevanceScore || 0) - (a.relevanceScore || 0)
    )[0];
    
    return mostRelevantPerson.data.properties;
  }

  /**
   * Extract domain information from the kernels
   * @param {Array} kernels - The relevant kernels
   * @returns {Array} Domain information kernels
   */
  extractDomainInfo(kernels) {
    // Domain keywords that indicate a kernel contains domain knowledge
    const domainKeywords = [
      'uor', 'framework', 'bot', 'knowledge', 'semantic', 'context',
      'memory', 'token', 'limit', 'traversal', 'lattice', 'kernel'
    ];
    
    // Find kernels with domain knowledge
    return kernels.filter(kernel => {
      if (!kernel.data) return false;
      
      if (kernel.data.title) {
        const lowerTitle = kernel.data.title.toLowerCase();
        return domainKeywords.some(keyword => lowerTitle.includes(keyword));
      }
      
      if (kernel.data.content && typeof kernel.data.content === 'string') {
        const lowerContent = kernel.data.content.toLowerCase();
        // Only count kernels with significant domain content
        return domainKeywords.some(keyword => lowerContent.includes(keyword)) &&
               kernel.relevanceScore > 0.4;
      }
      
      return false;
    });
  }

  /**
   * Formulate a response based on the aggregated context and strategy
   * @param {Object} aggregatedContext - The aggregated context info
   * @param {string} strategy - The selected response strategy
   * @returns {string} The formulated response
   */
  formulateResponseFromContext(aggregatedContext, strategy) {
    this.logger.log(`Formulating response using strategy: ${strategy}`);
    
    // Handle different response strategies
    switch (strategy) {
      case 'greeting_response':
        return this.generateGreetingResponse(aggregatedContext);
        
      case 'personal_info_response':
        return this.generatePersonalInfoResponse(aggregatedContext);
        
      case 'personal_info_acknowledgement':
        return this.generatePersonalInfoAcknowledgement(aggregatedContext);
        
      case 'domain_knowledge_response':
        return this.generateDomainKnowledgeResponse(aggregatedContext);
        
      case 'general_acknowledgement':
        return this.generateGeneralAcknowledgement(aggregatedContext);
        
      case 'general_question_response':
      case 'general_informational_response':
      default:
        return this.generateInformationalResponse(aggregatedContext);
    }
  }

  /**
   * Generate a greeting response
   * @param {Object} context - The aggregated context
   * @returns {string} The greeting response
   */
  generateGreetingResponse(context) {
    // Get person information if available
    const personInfo = context.personInfo;
    
    // Get a random greeting template
    const greetingTemplate = this.templates.greetings[
      Math.floor(Math.random() * this.templates.greetings.length)
    ];
    
    if (personInfo && personInfo.name) {
      return greetingTemplate.replace('!', `, ${personInfo.name}!`);
    }
    
    return greetingTemplate;
  }

  /**
   * Generate a response to a personal information question
   * @param {Object} context - The aggregated context
   * @returns {string} The personal info response
   */
  generatePersonalInfoResponse(context) {
    const personInfo = context.personInfo;
    
    if (!personInfo) {
      return "I don't have that personal information about you yet. Would you like to share it with me?";
    }
    
    // Check if the query was specifically about name, age, or location
    if (context.queryText) {
      const lowerQuery = context.queryText.toLowerCase();
      
      if (lowerQuery.includes('name') || lowerQuery.includes('who am i')) {
        if (personInfo.name) {
          return `Your name is ${personInfo.name}.`;
        } else {
          return "I don't know your name yet. Would you like to introduce yourself?";
        }
      }
      
      if (lowerQuery.includes('age') || lowerQuery.includes('how old')) {
        if (personInfo.age) {
          return `You are ${personInfo.age} years old.`;
        } else {
          return "I don't know your age yet.";
        }
      }
      
      if (lowerQuery.includes('location') || lowerQuery.includes('where') || lowerQuery.includes('from')) {
        if (personInfo.location) {
          return `You're from ${personInfo.location}.`;
        } else {
          return "I don't know where you're from yet.";
        }
      }
    }
    
    // If query wasn't specific or we couldn't determine what it was about,
    // provide all the personal information we have
    const infoParts = [];
    
    if (personInfo.name) {
      infoParts.push(`your name is ${personInfo.name}`);
    }
    
    if (personInfo.age) {
      infoParts.push(`you are ${personInfo.age} years old`);
    }
    
    if (personInfo.location) {
      infoParts.push(`you're from ${personInfo.location}`);
    }
    
    if (infoParts.length === 0) {
      return "I don't have any personal information about you yet.";
    } else if (infoParts.length === 1) {
      return `I know that ${infoParts[0]}.`;
    } else {
      const lastPart = infoParts.pop();
      return `I know that ${infoParts.join(', ')} and ${lastPart}.`;
    }
  }

  /**
   * Generate an acknowledgement for provided personal information
   * @param {Object} context - The aggregated context
   * @returns {string} The acknowledgement response
   */
  generatePersonalInfoAcknowledgement(context) {
    const personInfo = context.personInfo;
    
    if (!personInfo) {
      return "Thanks for sharing that information with me.";
    }
    
    // Check which property was most likely provided based on the query
    if (context.queryText) {
      const lowerQuery = context.queryText.toLowerCase();
      
      if (lowerQuery.includes('name') && personInfo.name) {
        return `Nice to meet you, ${personInfo.name}! I'll remember your name.`;
      }
      
      if (lowerQuery.includes('age') && personInfo.age) {
        return `Thanks for letting me know you're ${personInfo.age} years old. I'll remember that.`;
      }
      
      if ((lowerQuery.includes('location') || lowerQuery.includes('from') || lowerQuery.includes('live')) && 
          personInfo.location) {
        return `I see you're from ${personInfo.location}. I'll remember that.`;
      }
    }
    
    // Default acknowledgement if we can't determine the specific property
    return "Thanks for sharing that information with me. I'll remember it for our conversation.";
  }

  /**
   * Generate a response to a domain knowledge question
   * @param {Object} context - The aggregated context
   * @returns {string} The domain knowledge response
   */
  generateDomainKnowledgeResponse(context) {
    const domainFacts = context.domainInfo || [];
    
    if (domainFacts.length === 0) {
      return "I don't have specific information on that aspect of my knowledge representation system yet.";
    }
    
    // Get the most relevant domain facts (top 2)
    const topFacts = domainFacts.slice(0, 2);
    let response = "";
    
    // Format the first fact
    if (topFacts[0].data && topFacts[0].data.title && topFacts[0].data.content) {
      response = `${topFacts[0].data.content} `;
    } else if (topFacts[0].data && topFacts[0].data.content) {
      response = `${topFacts[0].data.content} `;
    }
    
    // Add second fact with a connector if available
    if (topFacts.length > 1) {
      const connector = this.templates.transitions[
        Math.floor(Math.random() * this.templates.transitions.length)
      ];
      
      if (topFacts[1].data && topFacts[1].data.content) {
        response += `${connector} ${topFacts[1].data.content}`;
      }
    }
    
    // Add relationships between domain concepts if available
    const domainRelationships = context.keyRelationships.filter(rel => 
      rel.relationship !== 'mentions' && rel.relationship !== 'mentionedBy'
    ).slice(0, 1);
    
    if (domainRelationships.length > 0) {
      const rel = domainRelationships[0];
      response += ` It's worth noting that ${rel.sourceTitle} ${rel.relationship.replace('_', ' ')} ${rel.targetTitle}.`;
    }
    
    return response;
  }

  /**
   * Generate a general acknowledgement response
   * @param {Object} context - The aggregated context
   * @returns {string} The acknowledgement response
   */
  generateGeneralAcknowledgement(context) {
    // Get a random acknowledgement template
    const ackTemplate = this.templates.acknowledgements[
      Math.floor(Math.random() * this.templates.acknowledgements.length)
    ];
    
    // If there's relevant information, add it
    if (context.relevantFacts.length > 0) {
      const randomTransition = this.templates.transitions[
        Math.floor(Math.random() * this.templates.transitions.length)
      ];
      
      const relevantFact = context.relevantFacts[0];
      let factContent = '';
      
      if (relevantFact.content) {
        factContent = relevantFact.content;
      } else if (relevantFact.properties) {
        // Format properties as a string
        const props = Object.entries(relevantFact.properties)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        factContent = `A ${relevantFact.schemaType} with ${props}`;
      }
      
      return `${ackTemplate} ${randomTransition} ${factContent}`;
    }
    
    return ackTemplate;
  }

  /**
   * Generate a general informational response
   * @param {Object} context - The aggregated context
   * @returns {string} The informational response
   */
  generateInformationalResponse(context) {
    const relevantFacts = context.relevantFacts || [];
    
    // If no relevant facts, provide a fallback response
    if (relevantFacts.length === 0) {
      return this.templates.fallbacks[
        Math.floor(Math.random() * this.templates.fallbacks.length)
      ];
    }
    
    // Generate response from the most relevant facts
    const mainFacts = relevantFacts.slice(0, 2);
    let response = "";
    
    // First fact
    if (mainFacts[0].content) {
      response = mainFacts[0].content + ". ";
    } else if (mainFacts[0].properties) {
      // Format properties of a schema type as readable content
      const props = Object.entries(mainFacts[0].properties)
        .map(([key, value]) => `${key} is ${value}`)
        .join(', ');
      response = `Information about ${mainFacts[0].schemaType}: ${props}. `;
    }
    
    // Add second fact with a connector
    if (mainFacts.length > 1 && mainFacts[1].content) {
      const connector = this.templates.transitions[
        Math.floor(Math.random() * this.templates.transitions.length)
      ];
      response += `${connector} ${mainFacts[1].content}. `;
    }
    
    // Add a relationship if available
    if (context.keyRelationships && context.keyRelationships.length > 0) {
      const relationship = context.keyRelationships[0];
      response += `It's worth noting that ${relationship.sourceTitle} ${relationship.relationship.replace('_', ' ')} ${relationship.targetTitle}.`;
    }
    
    return response;
  }

  /**
   * Filter irrelevant content from the response based on current context
   * @param {string} response - The initial response
   * @param {string} currentContext - The current conversational context
   * @returns {string} The filtered response
   */
  filterIrrelevantContent(response, currentContext) {
    // Currently just returns the original response
    // This could be enhanced to filter out content not relevant to current context
    return response;
  }
}

export default ResponseGenerator;
