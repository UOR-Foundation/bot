// personal-response.js
// Specialized response generation for personal contexts.

/**
 * PersonalResponseGenerator class handles generating responses for personal contexts
 */
class PersonalResponseGenerator {
  constructor(uorCortex) {
    this.uorCortex = uorCortex;
    this.logger = console; // Logger (can be replaced with a custom one)
  }
  
  /**
   * Generate a personal response based on context and semantics
   * @param {Object} context - Context information
   * @param {Object} semantics - Semantic understanding of the query
   * @returns {string} Generated personal response
   */
  generatePersonalResponse(context, semantics) {
    this.logger.log(`Generating personal response`);
    
    // Ensure semantics and context are valid
    if (!semantics) semantics = { original: "", intents: [] };
    if (!context) context = { aggregatedKernels: [] };
    
    // Get the query text from semantics
    const queryText = semantics.original || "";
    
    // Get the primary intent
    const primaryIntent = this.getPrimaryIntent(semantics);
    
    // First check for personal info questions
    if (this.isPersonalInfoQuestion(queryText)) {
      return this.generatePersonalInfoResponse(this.extractPersonalInfo(context));
    }
    
    // Check for greetings
    if (primaryIntent === 'greet') {
      return this.generateGreetingResponse(semantics, this.extractUserName(context));
    }
    
    // Check for information sharing
    if (primaryIntent === 'inform') {
      return this.generateAcknowledgementResponse(semantics, this.extractPersonalInfo(context));
    }
    
    // Default response for personal context
    return "I'm here to help with any personal information or questions you might have. Is there something specific you'd like to know or share?";
  }
  
  /**
   * Generate a response to a personal info question
   * @param {Object} personalInfo - The extracted personal info
   * @returns {string} The response
   */
  generatePersonalInfoResponse(personalInfo) {
    this.logger.log(`Generating personal info response with: ${JSON.stringify(personalInfo)}`);
    
    // If no personal info found
    if (!personalInfo || Object.keys(personalInfo).length === 0) {
      return "I don't have that information about you yet. Would you like to share it?";
    }
    
    // Handle different properties
    if (personalInfo.name) {
      return `Your name is ${personalInfo.name}.`;
    } else if (personalInfo.age) {
      return `You are ${personalInfo.age} years old.`;
    } else if (personalInfo.location) {
      return `You are from ${personalInfo.location}.`;
    } else {
      // If there is some other personal info, return it
      const property = Object.keys(personalInfo)[0];
      return `Your ${property} is ${personalInfo[property]}.`;
    }
  }
  
  /**
   * Generate a greeting response
   * @param {Object} semantics - The semantic understanding
   * @param {string} userName - The user's name if known
   * @returns {string} The greeting response
   */
  generateGreetingResponse(semantics, userName) {
    this.logger.log(`Generating greeting response for user: ${userName || 'unknown'}`);
    
    const greetings = [
      "Hello there!",
      "Hi!",
      "Greetings!",
      "Hello!"
    ];
    
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    
    if (userName) {
      return `${greeting} Nice to see you, ${userName}. How can I help you today?`;
    } else {
      return `${greeting} How can I help you today?`;
    }
  }
  
  /**
   * Generate an acknowledgement for personal info shared
   * @param {Object} semantics - The semantic understanding
   * @param {Object} personalContext - Current personal info
   * @returns {string} The acknowledgement response
   */
  generateAcknowledgementResponse(semantics, personalContext) {
    if (!semantics) semantics = { original: "" };
    
    const queryText = semantics.original || "";
    this.logger.log(`Generating acknowledgement for: ${queryText}`);
    
    // Extract what personal info was shared
    let sharedInfo = null;
    
    // Check for name
    const nameMatch = queryText.match(/my name is\s+([a-zA-Z\s]+)(?:\.|\,|\s|$)/i);
    if (nameMatch && nameMatch[1]) {
      sharedInfo = { property: 'name', value: nameMatch[1].trim() };
    }
    
    // Check for age
    const ageMatch = queryText.match(/i am\s+(\d+)(?:\s+years old)?/i);
    if (ageMatch && ageMatch[1]) {
      sharedInfo = { property: 'age', value: parseInt(ageMatch[1]) };
    }
    
    // Check for location
    const locationMatch = queryText.match(/i(?:'m| am) from\s+([a-zA-Z\s,]+)(?:\.|\,|\s|$)/i);
    if (locationMatch && locationMatch[1]) {
      sharedInfo = { property: 'location', value: locationMatch[1].trim() };
    }
    
    // If no specific info was found but entities indicate personal info
    if (!sharedInfo && semantics.entities) {
      const personEntity = semantics.entities.find(e => e.type === 'Person' && e.properties);
      if (personEntity && personEntity.properties) {
        const props = personEntity.properties;
        if (props.name) {
          sharedInfo = { property: 'name', value: props.name };
        } else if (props.age) {
          sharedInfo = { property: 'age', value: props.age };
        } else if (props.location) {
          sharedInfo = { property: 'location', value: props.location };
        }
      }
    }
    
    // Generate acknowledgement based on what was shared
    if (sharedInfo) {
      switch (sharedInfo.property) {
        case 'name':
          return `Nice to meet you, ${sharedInfo.value}! I'll remember your name.`;
        
        case 'age':
          return `I see, you're ${sharedInfo.value} years old. I'll remember that.`;
        
        case 'location':
          return `Thanks for letting me know you're from ${sharedInfo.value}.`;
        
        default:
          return `I've noted that your ${sharedInfo.property} is ${sharedInfo.value}.`;
      }
    }
    
    // Generic acknowledgement if no specific info identified
    return "Thanks for sharing that information with me.";
  }
  
  /**
   * Extract personal info from context
   * @param {Object} context - The context information
   * @returns {Object} The extracted personal info
   */
  extractPersonalInfo(context) {
    const personalInfo = {};
    
    if (!context || !context.aggregatedKernels) {
      return personalInfo;
    }
    
    // Find Person kernels in context
    const personKernels = context.aggregatedKernels.filter(kernel => 
      kernel && kernel.data && kernel.data.schemaType === 'Person'
    );
    
    if (personKernels.length > 0) {
      // Get properties from the most relevant Person kernel
      const personKernel = personKernels[0];
      const properties = personKernel.data.properties || {};
      
      // Add all properties to personal info
      Object.assign(personalInfo, properties);
    }
    
    return personalInfo;
  }
  
  /**
   * Extract the user's name from context if available
   * @param {Object} context - The context information
   * @returns {string|null} The user's name or null if not found
   */
  extractUserName(context) {
    const personalInfo = this.extractPersonalInfo(context);
    return personalInfo.name || null;
  }
  
  /**
   * Check if query text is asking for personal information
   * @param {string} queryText - The query text
   * @returns {boolean} Whether this is a personal info question
   */
  isPersonalInfoQuestion(queryText) {
    if (!queryText) return false;
    
    const personalInfoPatterns = [
      /what(?:'s| is) my name/i,
      /who am i/i,
      /how old am i/i,
      /what(?:'s| is) my age/i,
      /where (?:am i from|do i live)/i,
      /what(?:'s| is) my location/i,
      /tell me about (myself|me)/i
    ];
    
    return personalInfoPatterns.some(pattern => pattern.test(queryText));
  }
  
  /**
   * Get the primary intent from semantics
   * @param {Object} semantics - The semantic understanding
   * @returns {string} The primary intent type
   */
  getPrimaryIntent(semantics) {
    if (!semantics || !semantics.intents || !Array.isArray(semantics.intents) || semantics.intents.length === 0) {
      return 'unknown';
    }
    
    // Sort by confidence and return the highest type
    const sortedIntents = [...semantics.intents].sort((a, b) => 
      (b.confidence || 0) - (a.confidence || 0)
    );
    
    return sortedIntents[0].type || 'unknown';
  }
}

export default PersonalResponseGenerator;