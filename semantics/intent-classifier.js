// intent-classifier.js
// Determines user intent for schema-based semantic understanding

/**
 * IntentClassifier class handles detection of user intents from text
 */
class IntentClassifier {
  constructor() {
    this.logger = console; // Logger (can be replaced with a custom one)
  }
  
  /**
   * Determine the intent of the user input
   * @param {string} userInput - The raw user input
   * @param {Object} semantics - The semantic structure to populate
   */
  determineIntent(userInput, semantics) {
    this.logger.log(`Determining intent for: "${userInput}"`);
    
    // Check if we've already assigned intents during entity extraction
    const hasAssignedIntents = semantics.intents.length > 0;
    
    // Enhanced greeting detection
    if (!hasAssignedIntents && /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)[\.\s!\,]?$/i.test(userInput)) {
      semantics.intents.push({ type: 'greet', confidence: 0.95 });
      this.logger.log('Detected greeting intent with confidence 0.95');
    }
    
    // Enhanced question detection (if not already added by extractQuestionInfo)
    if (!semantics.intents.some(intent => intent.type === 'question') && 
        (/\?$/.test(userInput) || 
        /^(what|who|where|when|why|how|can|could|is|are|do|does|tell me|explain)/i.test(userInput))) {
      semantics.intents.push({ type: 'question', confidence: 0.9 });
      this.logger.log('Detected question intent with confidence 0.9');
    }
    
    // Enhanced information sharing detection (if not already added)
    if (!semantics.intents.some(intent => intent.type === 'inform') &&
        (/^(my name is|i am|i'm from|i live in|i'm|i have|my|i)/i.test(userInput) && 
       !(/\?$/.test(userInput)))) {
      semantics.intents.push({ type: 'inform', confidence: 0.8 });
      this.logger.log('Detected inform intent with confidence 0.8');
    }
    
    // If no intents were determined, add a default
    if (semantics.intents.length === 0) {
      semantics.intents.push({ type: 'statement', confidence: 0.5 });
      this.logger.log('Detected default statement intent with confidence 0.5');
    }
  }
  
  /**
   * Get the primary intent from semantics
   * @param {Object} semantics - The semantic understanding
   * @returns {Object} The primary intent
   */
  getPrimaryIntent(semantics) {
    if (!semantics || !semantics.intents || semantics.intents.length === 0) {
      return { type: 'unknown', confidence: 0 };
    }
    
    // Sort by confidence and return the highest
    return semantics.intents.sort((a, b) => b.confidence - a.confidence)[0];
  }
  
  /**
   * Check if the semantics contain a specific intent type
   * @param {Object} semantics - The semantic understanding
   * @param {string} intentType - The intent type to check for
   * @param {number} confidenceThreshold - The minimum confidence threshold
   * @returns {boolean} Whether the intent exists with sufficient confidence
   */
  hasIntent(semantics, intentType, confidenceThreshold = 0.7) {
    if (!semantics || !semantics.intents) return false;
    
    return semantics.intents.some(intent => 
      intent.type === intentType && intent.confidence >= confidenceThreshold
    );
  }
}

export default IntentClassifier;
