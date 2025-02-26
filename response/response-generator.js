// response-generator.js
// Generates contextually appropriate responses using knowledge graph data and GPT-2

import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3/dist/transformers.min.js';

/**
 * ResponseGenerator class handles generating responses based on knowledge graph data
 * and transformer-based language models.
 */
class ResponseGenerator {
  /**
   * Initialize the response generator
   * @param {Object} knowledgeGraph - Reference to the knowledge graph
   * @param {Object} memoryManager - Reference to the memory manager
   */
  constructor(knowledgeGraph, memoryManager) {
    this.knowledgeGraph = knowledgeGraph;
    this.memoryManager = memoryManager;
    this.transformer = null; // Will be initialized with GPT-2
    this.logger = console; // Logger (can be replaced with a custom one)
    
    // Common response templates for different scenarios
    this.responseTemplates = {
      greeting: [
        "Hello! How can I help you today?",
        "Hi there! What can I assist you with?",
        "Greetings! How may I be of service?",
        "Hello! What questions do you have today?"
      ],
      fallback: [
        "I don't have specific information on that topic yet. Is there something else I can help with?",
        "I'm not sure I have enough information about that. Could you tell me more?",
        "That's an interesting question, but I don't have detailed information on it yet.",
        "I don't have sufficient knowledge about that topic in my current context."
      ],
      acknowledgement: [
        "I understand.",
        "Got it.",
        "I see what you mean.",
        "That makes sense."
      ],
      transition: [
        "On a related note,",
        "Speaking of which,",
        "That reminds me,",
        "By the way,"
      ],
      personalInfo: {
        name: [
          "Your name is {0}.",
          "You told me your name is {0}.",
          "I remember that you're {0}."
        ],
        age: [
          "You are {0} years old.",
          "You told me you're {0} years old.",
          "I have your age recorded as {0}."
        ],
        location: [
          "You're from {0}.",
          "You told me you're from {0}.",
          "I have your location saved as {0}."
        ]
      }
    };
    
    // Used axioms tracking
    this.usedAxioms = new Set();
  }

  /**
   * Initialize the transformer model
   * @returns {Promise<void>}
   */
  async initializeTransformer() {
    try {
      this.logger.log("Initializing GPT-2 transformer model");
      // Load the pre-trained GPT-2 model from Hugging Face
      this.transformer = await pipeline('text-generation', 'onnx-community/gpt2-ONNX');
      this.logger.log("Transformer model loaded successfully");
    } catch (error) {
      this.logger.error(`Error initializing transformer model: ${error.message}`);
      // Fallback to template-based responses if transformer fails
      this.transformer = null;
    }
  }

  /**
   * Generate a response based on context and semantics
   * @param {Object} context - The context information including relevant entities
   * @param {Object} semantics - Semantic understanding of the query
   * @returns {Promise<string>} - The generated response
   */
  async generateResponse(context, semantics) {
    this.logger.log(`Generating response based on context and semantics`);
    
    // Clear previously used axioms
    this.usedAxioms.clear();
    
    // Select the appropriate response strategy based on semantics and context
    const strategy = this.selectResponseStrategy(semantics, context.relevantEntities);
    
    // Track context entities as used axioms
    context.relevantEntities.forEach(entity => {
      if (entity.id) {
        this.usedAxioms.add(entity.id);
      }
    });
    
    // Generate response based on selected strategy
    let response;
    switch (strategy) {
      case 'greeting':
        response = this.generateGreetingResponse(context, semantics);
        break;
      case 'personal_info':
        response = this.generatePersonalInfoResponse(context, semantics);
        break;
      case 'personal_info_acknowledgement':
        response = this.generatePersonalInfoAcknowledgement(context, semantics);
        break;
      case 'domain_knowledge':
        response = await this.generateDomainKnowledgeResponse(context, semantics);
        break;
      case 'general_question':
        response = await this.generateInformationalResponse(context, semantics);
        break;
      case 'acknowledgement':
        response = this.generateAcknowledgementResponse(context);
        break;
      default:
        // Default to transformer or fallback response
        response = await this.generateGeneralResponse(context, semantics);
    }
    
    // Record which axioms were used in the response
    await this.recordAxiomUsage(Array.from(this.usedAxioms));
    
    return response;
  }

  /**
   * Selects the appropriate response strategy
   * @param {Object} semantics - The semantic understanding
   * @param {Array} relevantEntities - Relevant knowledge graph entities
   * @returns {string} - The selected strategy type
   */
  selectResponseStrategy(semantics, relevantEntities) {
    // Check for a primary intent in semantics
    const primaryIntent = semantics.intents && semantics.intents.length > 0
      ? semantics.intents.sort((a, b) => b.confidence - a.confidence)[0]
      : { type: 'unknown', confidence: 0 };
    
    this.logger.log(`Primary intent: ${primaryIntent.type} with confidence ${primaryIntent.confidence}`);
    
    // Handle personal information related queries and statements
    if (this.isPersonalInfoQuery(semantics, relevantEntities)) {
      return 'personal_info';
    }
    
    // Handle different intent types
    switch (primaryIntent.type) {
      case 'greet':
        return 'greeting';
        
      case 'question':
        // Check what type of question it is
        if (this.isPersonalInfoQuestion(semantics)) {
          return 'personal_info';
        } else if (this.isDomainQuestion(semantics)) {
          return 'domain_knowledge';
        } else {
          return 'general_question';
        }
        
      case 'inform':
        // Check if this is providing personal information
        if (this.isPersonalInfoStatement(semantics)) {
          return 'personal_info_acknowledgement';
        } else {
          return 'acknowledgement';
        }
        
      default:
        // Default to a general informational response
        return 'general';
    }
  }

  /**
   * Check if this is a personal information query
   * @param {Object} semantics - The semantic understanding
   * @param {Array} entities - Relevant entities
   * @returns {boolean} True if this is a personal info query
   */
  isPersonalInfoQuery(semantics, entities) {
    // Check if any entity is a Person
    const hasPersonEntity = entities.some(entity => 
      entity['@type'] === 'Person'
    );
    
    // Check for personal pronouns in the query
    const hasPersonalPronouns = semantics.original && 
                               /\b(my|me|i|mine)\b/i.test(semantics.original);
    
    // Check for explicit person property inquiry
    const isPropertyInquiry = semantics.entities && semantics.entities.some(entity =>
      entity.type === 'Question' && 
      entity.properties && 
      entity.properties.aboutProperty &&
      ['name', 'age', 'location'].includes(entity.properties.aboutProperty)
    );
    
    return (hasPersonEntity && hasPersonalPronouns) || isPropertyInquiry;
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
    
    // Check for personal keywords in the query
    return semantics.original && 
           /\b(my name|who am i|how old am i|my age|where.*i from|my location)\b/i.test(semantics.original);
  }

  /**
   * Check if this is a domain-specific question
   * @param {Object} semantics - The semantic understanding
   * @returns {boolean} True if this is a domain question
   */
  isDomainQuestion(semantics) {
    // Domain keywords that indicate domain knowledge
    const domainKeywords = [
      'framework', 'knowledge', 'semantic', 'context',
      'memory', 'schema', 'entity', 'property', 'relationship'
    ];
    
    // Check if any domain keywords are in the query
    return semantics.original && domainKeywords.some(keyword => 
      semantics.original.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * Check if this is a personal information statement
   * @param {Object} semantics - The semantic understanding
   * @returns {boolean} True if this is a personal info statement
   */
  isPersonalInfoStatement(semantics) {
    // Check for inform intent
    const hasInformIntent = semantics.intents && semantics.intents.some(intent => 
      intent.type === 'inform' && intent.confidence > 0.7
    );
    
    if (!hasInformIntent) return false;
    
    // Check for person entities with properties
    const personEntities = semantics.entities && semantics.entities.filter(entity => 
      entity.type === 'Person' && 
      entity.properties && 
      Object.keys(entity.properties).length > 0
    );
    
    return personEntities && personEntities.length > 0;
  }

  /**
   * Generate a greeting response
   * @param {Object} context - The context information
   * @param {Object} semantics - The semantic understanding
   * @returns {string} - The greeting response
   */
  generateGreetingResponse(context, semantics) {
    // Get a random greeting template
    const greetingTemplate = this.responseTemplates.greeting[
      Math.floor(Math.random() * this.responseTemplates.greeting.length)
    ];
    
    // Find person info if available
    const personEntity = context.relevantEntities.find(entity => 
      entity['@type'] === 'Person'
    );
    
    if (personEntity && personEntity.name) {
      return greetingTemplate.replace('!', `, ${personEntity.name}!`);
    }
    
    return greetingTemplate;
  }

  /**
   * Generate a personal information response
   * @param {Object} context - The context information
   * @param {Object} semantics - The semantic understanding
   * @returns {string} - The personal information response
   */
  generatePersonalInfoResponse(context, semantics) {
    // Find person entity
    const personEntity = context.relevantEntities.find(entity => 
      entity['@type'] === 'Person'
    );
    
    if (!personEntity) {
      return "I don't have that personal information about you yet. Would you like to share it with me?";
    }
    
    // Track this entity as used
    if (personEntity.id) {
      this.usedAxioms.add(personEntity.id);
    }
    
    // Check which property is being requested
    let property = null;
    
    // Check in semantics entities first
    if (semantics.entities) {
      const questionEntity = semantics.entities.find(entity => 
        entity.type === 'Question' && 
        entity.properties && 
        entity.properties.aboutProperty
      );
      
      if (questionEntity) {
        property = questionEntity.properties.aboutProperty;
      }
    }
    
    // If not found in entities, check the query text
    if (!property && semantics.original) {
      const query = semantics.original.toLowerCase();
      
      if (query.includes('name') || query.includes('who am i')) {
        property = 'name';
      } else if (query.includes('age') || query.includes('how old')) {
        property = 'age';
      } else if (query.includes('location') || query.includes('where') || query.includes('from')) {
        property = 'location';
      }
    }
    
    // Generate response based on the requested property
    if (property && personEntity[property]) {
      const templates = this.responseTemplates.personalInfo[property];
      if (templates) {
        const template = templates[Math.floor(Math.random() * templates.length)];
        return template.replace('{0}', personEntity[property]);
      }
      return `Your ${property} is ${personEntity[property]}.`;
    }
    
    // If no specific property was requested or found, provide all known info
    const infoParts = [];
    
    if (personEntity.name) {
      infoParts.push(`your name is ${personEntity.name}`);
    }
    
    if (personEntity.age) {
      infoParts.push(`you are ${personEntity.age} years old`);
    }
    
    if (personEntity.location) {
      infoParts.push(`you're from ${personEntity.location}`);
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
   * Generate a response acknowledging provided personal information
   * @param {Object} context - The context information
   * @param {Object} semantics - The semantic understanding
   * @returns {string} - The acknowledgement response
   */
  generatePersonalInfoAcknowledgement(context, semantics) {
    const personEntity = context.relevantEntities.find(entity => 
      entity['@type'] === 'Person'
    );
    
    if (!personEntity) {
      return "Thanks for sharing that information with me.";
    }
    
    // Track this entity as used
    if (personEntity.id) {
      this.usedAxioms.add(personEntity.id);
    }
    
    // Check which property was likely provided
    let property = null;
    let value = null;
    
    if (semantics.entities) {
      const personFromSemantics = semantics.entities.find(entity => 
        entity.type === 'Person' && entity.properties
      );
      
      if (personFromSemantics && personFromSemantics.properties) {
        // Find the first property that was provided
        const props = personFromSemantics.properties;
        for (const key of ['name', 'age', 'location']) {
          if (props[key]) {
            property = key;
            value = props[key];
            break;
          }
        }
      }
    }
    
    if (property && value) {
      switch (property) {
        case 'name':
          return `Nice to meet you, ${value}! I'll remember your name.`;
        case 'age':
          return `Thanks for letting me know you're ${value} years old. I'll remember that.`;
        case 'location':
          return `I see you're from ${value}. I'll remember that.`;
        default:
          return `Thanks for telling me your ${property} is ${value}. I'll remember that.`;
      }
    }
    
    return "Thanks for sharing that information with me. I'll remember it for our conversation.";
  }

  /**
   * Generate a domain knowledge response
   * @param {Object} context - The context information
   * @param {Object} semantics - The semantic understanding
   * @returns {Promise<string>} - The domain knowledge response
   */
  async generateDomainKnowledgeResponse(context, semantics) {
    // Get domain knowledge entities
    const domainEntities = context.relevantEntities.filter(entity => 
      entity.relevanceScore > 0.5
    );
    
    if (domainEntities.length === 0) {
      return "I don't have specific information on that aspect of my knowledge system yet.";
    }
    
    // Track these entities as used
    domainEntities.forEach(entity => {
      if (entity.id) {
        this.usedAxioms.add(entity.id);
      }
    });
    
    // Try using transformer if available
    if (this.transformer) {
      try {
        const promptContext = this.prepareTransformerContext(domainEntities, semantics);
        const result = await this.transformer(promptContext, {
          max_length: 100,
          temperature: 0.7,
          top_p: 0.9
        });
        
        if (result && result[0] && result[0].generated_text) {
          // Extract the generated part (after the prompt)
          const generatedText = result[0].generated_text.slice(promptContext.length).trim();
          if (generatedText.length > 10) {
            return generatedText;
          }
        }
      } catch (error) {
        this.logger.error(`Transformer error: ${error.message}`);
        // Fall back to template response
      }
    }
    
    // Fall back to template-based response if transformer fails
    // Get the most relevant domain entity
    const topEntity = domainEntities[0];
    let response = '';
    
    if (topEntity.description) {
      response = topEntity.description;
    } else {
      // Construct from properties
      response = `${topEntity.name || topEntity['@type'] || 'This concept'}`;
      
      if (topEntity.definition) {
        response += ` refers to ${topEntity.definition}`;
      } else if (topEntity.description) {
        response += ` is ${topEntity.description}`;
      }
      
      response += '.';
    }
    
    // Add a second fact if available
    if (domainEntities.length > 1 && domainEntities[1].description) {
      const connector = this.responseTemplates.transition[
        Math.floor(Math.random() * this.responseTemplates.transition.length)
      ];
      
      response += ` ${connector} ${domainEntities[1].description}`;
    }
    
    return response;
  }

  /**
   * Generate an acknowledgement response
   * @param {Object} context - The context information
   * @returns {string} - The acknowledgement response
   */
  generateAcknowledgementResponse(context) {
    // Get a random acknowledgement template
    const ackTemplate = this.responseTemplates.acknowledgement[
      Math.floor(Math.random() * this.responseTemplates.acknowledgement.length)
    ];
    
    // If there's relevant information, add it
    if (context.relevantEntities.length > 0) {
      const relevantEntity = context.relevantEntities[0];
      
      // Track this entity as used
      if (relevantEntity.id) {
        this.usedAxioms.add(relevantEntity.id);
      }
      
      const transition = this.responseTemplates.transition[
        Math.floor(Math.random() * this.responseTemplates.transition.length)
      ];
      
      let additionalInfo = '';
      if (relevantEntity.description) {
        additionalInfo = relevantEntity.description;
      } else if (relevantEntity.name) {
        additionalInfo = `${relevantEntity.name} is an important concept to consider.`;
      }
      
      if (additionalInfo) {
        return `${ackTemplate} ${transition} ${additionalInfo}`;
      }
    }
    
    return ackTemplate;
  }

  /**
   * Generate an informational response
   * @param {Object} context - The context information
   * @param {Object} semantics - The semantic understanding
   * @returns {Promise<string>} - The informational response
   */
  async generateInformationalResponse(context, semantics) {
    const relevantEntities = context.relevantEntities;
    
    // If no relevant entities, provide a fallback response
    if (relevantEntities.length === 0) {
      return this.responseTemplates.fallback[
        Math.floor(Math.random() * this.responseTemplates.fallback.length)
      ];
    }
    
    // Track these entities as used
    relevantEntities.forEach(entity => {
      if (entity.id) {
        this.usedAxioms.add(entity.id);
      }
    });
    
    // Try using transformer if available
    if (this.transformer) {
      try {
        const promptContext = this.prepareTransformerContext(relevantEntities, semantics);
        const result = await this.transformer(promptContext, {
          max_length: 150,
          temperature: 0.7,
          top_p: 0.9
        });
        
        if (result && result[0] && result[0].generated_text) {
          // Extract the generated part (after the prompt)
          const generatedText = result[0].generated_text.slice(promptContext.length).trim();
          if (generatedText.length > 10) {
            return generatedText;
          }
        }
      } catch (error) {
        this.logger.error(`Transformer error: ${error.message}`);
        // Fall back to template response
      }
    }
    
    // Fall back to template-based response
    let response = '';
    
    // Use the most relevant entity
    const mainEntity = relevantEntities[0];
    if (mainEntity.description) {
      response = mainEntity.description;
    } else {
      response = `${mainEntity.name || mainEntity['@type'] || 'This'} is a relevant concept. `;
      
      // Add some properties if available
      const properties = Object.entries(mainEntity)
        .filter(([key]) => !['@type', 'id', 'name', 'relevanceScore'].includes(key))
        .map(([key, value]) => `Its ${key} is ${value}`);
      
      if (properties.length > 0) {
        response += properties.slice(0, 2).join('. ') + '.';
      }
    }
    
    // Add a second entity if available
    if (relevantEntities.length > 1 && relevantEntities[1].description) {
      const connector = this.responseTemplates.transition[
        Math.floor(Math.random() * this.responseTemplates.transition.length)
      ];
      
      response += ` ${connector} ${relevantEntities[1].description}`;
    }
    
    return response;
  }

  /**
   * Generate a general response for any other query type
   * @param {Object} context - The context information
   * @param {Object} semantics - The semantic understanding
   * @returns {Promise<string>} - The general response
   */
  async generateGeneralResponse(context, semantics) {
    // Try using transformer if available
    if (this.transformer) {
      try {
        const promptContext = this.prepareTransformerContext(context.relevantEntities, semantics);
        const result = await this.transformer(promptContext, {
          max_length: 100,
          temperature: 0.8,
          top_p: 0.9
        });
        
        if (result && result[0] && result[0].generated_text) {
          // Extract the generated part (after the prompt)
          const generatedText = result[0].generated_text.slice(promptContext.length).trim();
          if (generatedText.length > 10) {
            return generatedText;
          }
        }
      } catch (error) {
        this.logger.error(`Transformer error: ${error.message}`);
        // Fall back to template response
      }
    }
    
    // If transformer fails or isn't available, provide a reasonable fallback
    if (context.relevantEntities.length > 0) {
      return this.generateInformationalResponse(context, semantics);
    } else {
      return this.responseTemplates.fallback[
        Math.floor(Math.random() * this.responseTemplates.fallback.length)
      ];
    }
  }

  /**
   * Prepares context for the transformer model
   * @param {Array} entities - Relevant entities
   * @param {Object} semantics - Semantic understanding
   * @returns {string} - Formatted context for GPT-2
   */
  prepareTransformerContext(entities, semantics) {
    // Create a prompt for the transformer model
    let prompt = '';
    
    // Add the user's query
    if (semantics.original) {
      prompt += `Question: ${semantics.original}\n\n`;
    }
    
    // Add relevant knowledge from entities
    if (entities.length > 0) {
      prompt += "Knowledge:\n";
      
      entities.slice(0, 3).forEach((entity, index) => {
        // Add type and name
        prompt += `[${index + 1}] ${entity['@type'] || 'Entity'}: ${entity.name || 'Unknown'}\n`;
        
        // Add description if available
        if (entity.description) {
          prompt += `Description: ${entity.description}\n`;
        }
        
        // Add a few key properties
        const properties = Object.entries(entity)
          .filter(([key, value]) => 
            !['@type', 'id', 'name', 'description', 'relevanceScore'].includes(key) && 
            typeof value !== 'object'
          )
          .slice(0, 3);
        
        if (properties.length > 0) {
          properties.forEach(([key, value]) => {
            prompt += `${key}: ${value}\n`;
          });
        }
        
        prompt += '\n';
      });
    }
    
    // Add response prefix
    prompt += "Answer: ";
    
    return prompt;
  }

  /**
   * Records which axioms were used in the response
   * @param {Array} usedAxiomIds - IDs of axioms used in response
   * @returns {Promise<void>}
   */
  async recordAxiomUsage(usedAxiomIds) {
    this.logger.log(`Recording usage of ${usedAxiomIds.length} axioms`);
    
    if (usedAxiomIds.length === 0) {
      return;
    }
    
    try {
      // Use the memory manager to record axiom usage
      for (const axiomId of usedAxiomIds) {
        await this.memoryManager.recordAxiomUsage(axiomId);
      }
    } catch (error) {
      this.logger.error(`Error recording axiom usage: ${error.message}`);
    }
  }
}

export default ResponseGenerator;