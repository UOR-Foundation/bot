// intent-classifier.js
// Determines user intent from input text for schema-based semantic understanding

/**
 * IntentClassifier class handles detection and classification of user intents from text
 */
class IntentClassifier {
  constructor() {
    // Define patterns for different intent types
    this.intentPatterns = {
      // Greeting patterns
      greeting: [
        /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)[\s!\.,]?$/i,
        /^(what's up|yo|howdy)[\s!\.,]?$/i,
        /^(nice to (meet|see) you)[\s!\.,]?$/i
      ],
      
      // Question patterns
      question: [
        /\?$/, // Ends with question mark
        /^(what|who|where|when|why|how|can|could|would|will|is|are|do|does|has|have)/i,
        /^(tell me about|i want to know|i'd like to know|can you tell me)/i,
        /^(explain|describe|elaborate on)/i
      ],
      
      // Inform patterns (user providing information)
      inform: [
        /^(i am|i'm|my|i have|i've|i was|i'd|i live|i work|i like|i enjoy|i prefer)/i,
        /^(my name is|you can call me|i go by)/i,
        /^(i'm from|i live in|i was born)/i,
        /^(just wanted to (say|tell|let|inform))/i
      ],
      
      // Request patterns
      request: [
        /^(please|can you|could you|would you|will you|i need|i want|i would like|i'd like)/i,
        /^(help me|assist me|show me|find|search|look up|give me)/i,
        /^(do|make|create|build|generate|write|design)/i
      ],
      
      // Gratitude patterns
      thank: [
        /^(thanks|thank you|thx|ty|appreciate it|grateful)/i,
        /that's helpful/i,
        /^(you've been|you're) (helpful|great|amazing)/i
      ],
      
      // Confirmation patterns
      confirm: [
        /^(yes|yeah|yep|yup|correct|right|exactly|sure|ok|okay|fine|indeed)/i,
        /^(i agree|i confirm|that's right|that is correct|you're right)/i,
        /^(sounds good|works for me|perfect|great)/i
      ],
      
      // Rejection patterns
      reject: [
        /^(no|nope|nah|not really|not at all|not exactly|incorrect)/i,
        /^(i disagree|that's wrong|that is incorrect|you're wrong)/i,
        /^(that's not what i|that is not what i)/i
      ],
      
      // Clarification patterns
      clarify: [
        /^(i meant|what i meant|let me clarify|to clarify|to be clear)/i,
        /^(in other words|that is to say|to put it differently)/i,
        /^(actually|rather|instead)/i
      ],
      
      // Farewell patterns
      farewell: [
        /^(bye|goodbye|see you|farewell|take care|so long)/i,
        /^(have a (good|nice|great) day)/i,
        /^(until next time|talk to you later|ttyl)/i
      ]
    };
    
    // Define confidence adjustments based on additional signals
    this.confidenceAdjustments = {
      questionMark: { pattern: /\?$/, intentType: 'question', adjustment: 0.2 },
      exclamation: { pattern: /!$/, intentType: 'request', adjustment: 0.1 },
      pleaseWord: { pattern: /\bplease\b/i, intentType: 'request', adjustment: 0.15 },
      thankWord: { pattern: /\bthanks\b|\bthank you\b/i, intentType: 'thank', adjustment: 0.25 }
    };
    
    this.logger = console; // Logger (can be replaced with a custom one)
  }
  
  /**
   * Determines the intent of the user input
   * @param {string} userInput - The raw user input
   * @param {Object} semantics - The semantic structure to populate
   */
  determineIntent(userInput, semantics) {
    this.logger.log(`Determining intent for: "${userInput}"`);
    
    // Check if semantics already has intents
    const hasAssignedIntents = semantics.intents && semantics.intents.length > 0;
    
    // If no intents are present, initialize the intents array
    if (!semantics.intents) {
      semantics.intents = [];
    }
    
    // Skip if intents have already been assigned by another component
    if (hasAssignedIntents) {
      this.logger.log('Intents already assigned, skipping intent classification');
      return;
    }
    
    // Track detected intents and their base confidences
    const detectedIntents = new Map();
    
    // Check each intent type against the user input
    for (const [intentType, patterns] of Object.entries(this.intentPatterns)) {
      // Try each pattern for this intent type
      for (const pattern of patterns) {
        if (pattern.test(userInput)) {
          // Calculate base confidence (could be more sophisticated in a real implementation)
          const baseConfidence = 0.7;
          
          // If intent already detected, use the higher confidence
          if (detectedIntents.has(intentType)) {
            const currentConfidence = detectedIntents.get(intentType);
            detectedIntents.set(intentType, Math.max(currentConfidence, baseConfidence));
          } else {
            detectedIntents.set(intentType, baseConfidence);
          }
          
          // Break after finding a match for this intent type
          break;
        }
      }
    }
    
    // Apply confidence adjustments based on additional signals
    for (const [key, adjustment] of Object.entries(this.confidenceAdjustments)) {
      if (adjustment.pattern.test(userInput) && detectedIntents.has(adjustment.intentType)) {
        // Increase confidence but cap at 0.95
        const currentConfidence = detectedIntents.get(adjustment.intentType);
        const adjustedConfidence = Math.min(0.95, currentConfidence + adjustment.adjustment);
        detectedIntents.set(adjustment.intentType, adjustedConfidence);
      }
    }
    
    // If multiple intents are detected, preserve all with significant confidence
    const confidenceThreshold = 0.5; // Threshold for including secondary intents
    
    // Sort intents by confidence (descending)
    const sortedIntents = [...detectedIntents.entries()]
      .sort((a, b) => b[1] - a[1]);
    
    // Add intents to semantics
    for (const [intentType, confidence] of sortedIntents) {
      if (confidence >= confidenceThreshold) {
        this.addIntent(semantics, intentType, confidence);
      }
    }
    
    // If no intents were determined, add a default 'statement' intent
    if (semantics.intents.length === 0) {
      this.addIntent(semantics, 'statement', 0.5);
      this.logger.log('No specific intent detected, defaulting to statement with confidence 0.5');
    }
  }
  
  /**
   * Gets the primary intent from semantics
   * @param {Object} semantics - The semantic understanding
   * @returns {Object} - The primary intent with confidence
   */
  getPrimaryIntent(semantics) {
    if (!semantics || !semantics.intents || semantics.intents.length === 0) {
      return { type: 'unknown', confidence: 0 };
    }
    
    // Sort by confidence and return the highest
    return semantics.intents.sort((a, b) => b.confidence - a.confidence)[0];
  }
  
  /**
   * Checks if semantics contain a specific intent
   * @param {Object} semantics - The semantic understanding
   * @param {string} intentType - Intent type to check for
   * @param {number} confidenceThreshold - Minimum confidence
   * @returns {boolean} - Whether the intent exists with sufficient confidence
   */
  hasIntent(semantics, intentType, confidenceThreshold = 0.7) {
    if (!semantics || !semantics.intents) return false;
    
    return semantics.intents.some(intent => 
      intent.type === intentType && intent.confidence >= confidenceThreshold
    );
  }
  
  /**
   * Adds an intent to the semantics structure
   * @param {Object} semantics - The semantics to modify
   * @param {string} intentType - The intent type
   * @param {number} confidence - Confidence score (0-1)
   * @param {Object} metadata - Additional intent metadata
   */
  addIntent(semantics, intentType, confidence, metadata = {}) {
    if (!semantics.intents) {
      semantics.intents = [];
    }
    
    const intent = {
      type: intentType,
      confidence: confidence,
      ...metadata
    };
    
    semantics.intents.push(intent);
    this.logger.log(`Added ${intentType} intent with confidence ${confidence}`);
  }
  
  /**
   * Returns all intent types the classifier can detect
   * @returns {Array} - Array of supported intent types
   */
  getSupportedIntents() {
    return Object.keys(this.intentPatterns);
  }
  
  /**
   * Analyzes a compound query to detect multiple intents
   * @param {string} userInput - The user input to analyze
   * @returns {Array} - Array of potential intents with confidences
   */
  analyzeCompoundIntents(userInput) {
    // Split input by common separators
    const segments = userInput.split(/[,.;]|\band\b|\bthen\b|\balso\b/i)
      .map(segment => segment.trim())
      .filter(segment => segment.length > 0);
    
    const results = [];
    
    // Analyze each segment
    for (const segment of segments) {
      const tempSemantics = { intents: [] };
      this.determineIntent(segment, tempSemantics);
      
      if (tempSemantics.intents.length > 0) {
        results.push({
          segment: segment,
          intent: tempSemantics.intents[0]
        });
      }
    }
    
    return results;
  }
}

export default IntentClassifier;