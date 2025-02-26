// personal-response.js
// Specialized response generation for personal contexts

/**
 * PersonalResponseGenerator class handles generating responses for personal information queries
 * and statements within the UOR framework
 */
class PersonalResponseGenerator {
  /**
   * Constructor initializes the response generator
   * @param {Object} uorCortex - Reference to the UOR Cortex
   */
  constructor(uorCortex) {
    this.uorCortex = uorCortex;
    this.logger = console; // Logger (can be replaced with a custom one)
  }

  /**
   * Generates a response for personal information queries
   * @param {Object} personalInfo - Personal information to include in the response
   * @param {Object} options - Optional configuration parameters
   * @returns {string} - Personalized response
   */
  generatePersonalInfoResponse(personalInfo, options = {}) {
    this.logger.log(`Generating personal info response for property: ${personalInfo.property}`);
    
    if (!personalInfo || !personalInfo.property) {
      return "I don't have that personal information about you yet.";
    }
    
    // Handle different personal properties with natural language variations
    switch (personalInfo.property) {
      case 'name':
        return this.createNameResponse(personalInfo.value, options);
      case 'age':
        return this.createAgeResponse(personalInfo.value, options);
      case 'location':
        return this.createLocationResponse(personalInfo.value, options);
      default:
        return `I know that your ${personalInfo.property} is ${personalInfo.value}.`;
    }
  }
  
  /**
   * Creates a personalized response about the user's name
   * @param {string} name - The user's name
   * @param {Object} options - Optional configuration parameters
   * @returns {string} - Personalized name response
   */
  createNameResponse(name, options = {}) {
    // Add some variation to the responses
    const responses = [
      `Your name is ${name}.`,
      `You told me your name is ${name}.`,
      `I remember that you're ${name}.`
    ];
    
    // Select a response based on options or randomly
    if (options.formal) {
      return responses[0];
    } else if (options.casual) {
      return responses[2];
    } else {
      return responses[Math.floor(Math.random() * responses.length)];
    }
  }
  
  /**
   * Creates a personalized response about the user's age
   * @param {number|string} age - The user's age
   * @param {Object} options - Optional configuration parameters
   * @returns {string} - Personalized age response
   */
  createAgeResponse(age, options = {}) {
    const responses = [
      `You are ${age} years old.`,
      `You told me you're ${age} years old.`,
      `I have your age recorded as ${age}.`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  /**
   * Creates a personalized response about the user's location
   * @param {string} location - The user's location
   * @param {Object} options - Optional configuration parameters
   * @returns {string} - Personalized location response
   */
  createLocationResponse(location, options = {}) {
    const responses = [
      `You're from ${location}.`,
      `You told me you're from ${location}.`,
      `I have your location saved as ${location}.`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Generates a greeting response based on semantic understanding
   * @param {Object} semantics - Semantic understanding of the query
   * @param {string} userName - The user's name if available
   * @returns {string} - Appropriate greeting response
   */
  generateGreetingResponse(semantics, userName) {
    this.logger.log(`Generating greeting response${userName ? ' for ' + userName : ''}`);
    
    // Time-aware greetings
    const currentHour = new Date().getHours();
    let timeGreeting = "Hello";
    
    if (currentHour >= 5 && currentHour < 12) {
      timeGreeting = "Good morning";
    } else if (currentHour >= 12 && currentHour < 18) {
      timeGreeting = "Good afternoon";
    } else if (currentHour >= 18 && currentHour < 22) {
      timeGreeting = "Good evening";
    }
    
    // If we know the user's name, personalize the greeting
    if (userName) {
      const greetings = [
        `${timeGreeting}, ${userName}! How can I help you today?`,
        `${timeGreeting}, ${userName}! It's good to see you again.`,
        `Hello ${userName}! How can I assist you?`
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    } else {
      const greetings = [
        `${timeGreeting}! How can I help you today?`,
        `${timeGreeting}! I'm a friendly assistant. What can I do for you?`,
        `Hello there! How can I assist you?`
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    }
  }

  /**
   * Generates a response acknowledging provided personal information
   * @param {Object} semantics - Semantic understanding of the statement
   * @param {Object} personalContext - Current personal context information
   * @returns {string} - Appropriate acknowledgement response
   */
  generateAcknowledgementResponse(semantics, personalContext = {}) {
    this.logger.log(`Generating acknowledgement response for semantic entities`);
    
    if (!semantics || !semantics.entities) {
      return "I've noted that information. How can I assist you?";
    }
    
    // Find person entities with properties
    const personEntity = semantics.entities.find(entity => 
      entity.type === 'Person' && entity.properties && Object.keys(entity.properties).length > 0
    );
    
    if (!personEntity) {
      return "I've noted that information. Is there something I can help you with?";
    }
    
    const props = personEntity.properties;
    
    // Handle name updates
    if (props.name) {
      // Check if this is a new name or confirming existing name
      const existingName = personalContext.name;
      if (existingName && existingName.toLowerCase() === props.name.toLowerCase()) {
        return `Yes, I remember that your name is ${props.name}. How can I help you today?`;
      } else {
        // New name or different from what we had
        const responses = [
          `Nice to meet you, ${props.name}! How can I help you today?`,
          `I'll remember that your name is ${props.name}. What can I do for you?`,
          `Thanks for letting me know your name, ${props.name}. How can I assist you?`
        ];
        return responses[Math.floor(Math.random() * responses.length)];
      }
    }
    
    // Handle age updates
    if (props.age) {
      const responses = [
        `Thanks for letting me know you're ${props.age} years old. Is there something I can help you with?`,
        `I'll remember that you're ${props.age}. What would you like to know?`,
        `Got it, you're ${props.age} years old. How can I assist you?`
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }
    
    // Handle location updates
    if (props.location) {
      const responses = [
        `Thanks for letting me know you're from ${props.location}. Is there something I can help you with?`,
        `I'll remember that you're from ${props.location}. What would you like to know?`,
        `Got it, you're from ${props.location}. How can I assist you?`
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }
    
    // For any other property
    const propName = Object.keys(props)[0];
    if (propName) {
      return `Thanks for letting me know about your ${propName}. I'll remember that. How can I help you today?`;
    }
    
    return "Thanks for sharing that information with me. Is there something specific you'd like to know?";
  }

  /**
   * Main method to formulate a personal response based on context and intent
   * @param {Object} context - The context information including personal data
   * @param {string} intent - The identified intent (e.g., 'question', 'inform')
   * @returns {string} - The formulated personal response
   */
  formulatePersonalResponse(context, intent) {
    this.logger.log(`Formulating personal response for intent: ${intent}`);
    
    // Extract relevant personal information from context
    let personalInfo = null;
    let userName = null;
    
    // Find Person kernels in the context
    const personKernels = context.aggregatedKernels?.filter(kernel => 
      kernel.data && kernel.data.schemaType === 'Person'
    ) || [];
    
    if (personKernels.length > 0) {
      // Sort by relevance or recency
      personKernels.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
      
      // Get the most relevant Person kernel
      const topPersonKernel = personKernels[0];
      
      if (topPersonKernel.data && topPersonKernel.data.properties) {
        userName = topPersonKernel.data.properties.name;
        
        // For personal info questions, extract requested property
        if (intent === 'question' && context.requestedProperty) {
          personalInfo = {
            property: context.requestedProperty,
            value: topPersonKernel.data.properties[context.requestedProperty],
            confidence: topPersonKernel.relevanceScore || 0.5
          };
        }
      }
    }
    
    // Handle different intents
    switch (intent) {
      case 'greet':
        return this.generateGreetingResponse(context.semantics, userName);
        
      case 'question':
        if (personalInfo) {
          return this.generatePersonalInfoResponse(personalInfo);
        } else if (context.requestedProperty) {
          return `I don't know your ${context.requestedProperty} yet. Would you like to tell me?`;
        } else {
          return "I'm not sure I have that personal information about you yet.";
        }
        
      case 'inform':
        return this.generateAcknowledgementResponse(context.semantics, 
          personKernels.length > 0 && personKernels[0].data ? personKernels[0].data.properties : {});
        
      default:
        // For other intents, try to personalize based on known information
        if (userName) {
          return `I'll try to help with that, ${userName}. Let me think...`;
        } else {
          return "I'll try to help with that. Let me think...";
        }
    }
  }
}

export default PersonalResponseGenerator;
