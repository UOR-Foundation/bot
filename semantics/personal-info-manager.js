// personal-info-manager.js
// Handles personal information queries and statements

/**
 * PersonalInfoManager class handles extraction and retrieval of personal information
 */
class PersonalInfoManager {
  constructor(uorCortex) {
    this.uorCortex = uorCortex;
    this.logger = console; // Logger (can be replaced with a custom one)
  }
  
  /**
   * Get relevant personal information based on a question
   * @param {string} question - The user's question
   * @param {Object} semantics - Optional pre-parsed semantics
   * @returns {Object|null} Personal information if found
   */
  getPersonalInfoForQuestion(question, semantics = null) {
    this.logger.log(`Looking for personal info based on question: "${question}"`);
    
    // Enhanced question patterns for personal information
    const personQuestions = [
      { pattern: /what( is|'s) my name/i, property: 'name' },
      { pattern: /who am i/i, property: 'name' },
      { pattern: /how old am i/i, property: 'age' },
      { pattern: /what( is|'s) my age/i, property: 'age' },
      { pattern: /where (am i from|do i live)/i, property: 'location' },
      { pattern: /what( is|'s) my location/i, property: 'location' }
    ];
    
    // Check if any entity in semantics is a Question with personal property
    let targetProperty = null;
    
    // First, check the extracted semantics if available
    if (semantics) {
      const questionEntities = semantics.entities.filter(e => e.type === 'Question');
      for (const questionEntity of questionEntities) {
        if (questionEntity.properties && 
            questionEntity.properties.isPersonalQuestion && 
            questionEntity.properties.aboutProperty) {
          targetProperty = questionEntity.properties.aboutProperty;
          this.logger.log(`Found personal property in semantics: ${targetProperty}`);
          break;
        }
      }
    }
    
    // If not found in semantics, try pattern matching
    if (!targetProperty) {
      for (const pq of personQuestions) {
        if (pq.pattern.test(question)) {
          targetProperty = pq.property;
          this.logger.log(`Found personal property via pattern: ${targetProperty}`);
          break;
        }
      }
    }
    
    if (!targetProperty) {
      this.logger.log('No personal property identified in question');
      return null;
    }
    
    // Search for Person kernels in the UOR graph
    const allKernels = this.uorCortex.getAllKernels();
    this.logger.log(`Searching ${allKernels.length} kernels for Person with ${targetProperty}`);
    
    // Find Person kernels with the requested property
    const personKernels = allKernels.filter(kernel => 
      kernel.data && 
      kernel.data.schemaType === 'Person' && 
      kernel.data.properties && 
      kernel.data.properties[targetProperty]
    );
    
    this.logger.log(`Found ${personKernels.length} person kernels with ${targetProperty}`);
    
    if (personKernels.length > 0) {
      // Sort by recency (assuming more recent kernels are more relevant)
      personKernels.sort((a, b) => {
        return (b.data.timestamp || 0) - (a.data.timestamp || 0);
      });
      
      const personalInfo = {
        property: targetProperty,
        value: personKernels[0].data.properties[targetProperty],
        confidence: 0.9
      };
      
      this.logger.log(`Returning personal info: ${JSON.stringify(personalInfo)}`);
      return personalInfo;
    }
    
    this.logger.log('No matching personal info found');
    return null;
  }
  
  /**
   * Explicitly check if user is providing personal information
   * @param {string} userInput - The user's input string
   * @param {Object} semantics - Optional pre-parsed semantics
   * @returns {Object|null} - The personal info found or null
   */
  getPersonalInfoFromStatement(userInput, semantics = null) {
    this.logger.log(`Checking for personal info in statement: "${userInput}"`);
    
    // If semantics weren't provided, we need to parse the input
    if (!semantics) {
      // Since we don't have access to the full SchemaProcessor here,
      // we'll rely on patterns to extract personal info
      
      // Check for name patterns
      const nameMatch = userInput.match(/my name is\s+([a-zA-Z\s]+)(?:\.|\,|\s|$)/i);
      if (nameMatch && nameMatch[1]) {
        return {
          property: 'name',
          value: nameMatch[1].trim(),
          confidence: 0.9
        };
      }
      
      // Check for age patterns
      const ageMatch = userInput.match(/i am\s+(\d+)(?:\s+years old)?/i);
      if (ageMatch && ageMatch[1]) {
        return {
          property: 'age',
          value: parseInt(ageMatch[1]),
          confidence: 0.9
        };
      }
      
      // Check for location patterns
      const locationMatch = userInput.match(/i(?:'m| am) from\s+([a-zA-Z\s,]+)(?:\.|\,|\s|$)/i);
      if (locationMatch && locationMatch[1]) {
        return {
          property: 'location',
          value: locationMatch[1].trim(),
          confidence: 0.9
        };
      }
      
      return null;
    }
    
    // If semantics were provided, use them
    const personEntities = semantics.entities.filter(entity => 
      entity.type === 'Person' && 
      entity.properties && 
      Object.keys(entity.properties).length > 0
    );
    
    if (personEntities.length === 0) {
      this.logger.log('No Person entities found in statement');
      return null;
    }
    
    // Get the most informative Person entity (one with most properties)
    const personEntity = personEntities.reduce((most, current) => 
      Object.keys(current.properties).length > Object.keys(most.properties).length 
        ? current : most, personEntities[0]);
    
    // Get the property with the highest priority (name > age > location)
    const properties = personEntity.properties;
    let primaryProperty = null;
    let primaryValue = null;
    
    if (properties.name) {
      primaryProperty = 'name';
      primaryValue = properties.name;
    } else if (properties.age) {
      primaryProperty = 'age';
      primaryValue = properties.age;
    } else if (properties.location) {
      primaryProperty = 'location';
      primaryValue = properties.location;
    } else {
      // Get the first available property
      const firstKey = Object.keys(properties)[0];
      primaryProperty = firstKey;
      primaryValue = properties[firstKey];
    }
    
    if (primaryProperty && primaryValue) {
      const personalInfo = {
        property: primaryProperty,
        value: primaryValue,
        allProperties: properties,
        confidence: 0.9
      };
      
      this.logger.log(`Found personal info in statement: ${JSON.stringify(personalInfo)}`);
      return personalInfo;
    }
    
    return null;
  }
  
  /**
   * Store personal information in the UOR graph
   * @param {Object} personalInfo - The personal information to store
   * @returns {Object} The created or updated kernel
   */
  storePersonalInfo(personalInfo) {
    this.logger.log(`Storing personal info: ${JSON.stringify(personalInfo)}`);
    
    // Check if a Person kernel already exists
    const allKernels = this.uorCortex.getAllKernels();
    const existingPersonKernel = allKernels.find(k => 
      k.data && k.data.schemaType === 'Person'
    );
    
    if (existingPersonKernel) {
      // Update existing kernel with new properties
      const updatedProperties = {
        ...existingPersonKernel.data.properties,
        [personalInfo.property]: personalInfo.value
      };
      
      // If we have additional properties, add them too
      if (personalInfo.allProperties) {
        Object.assign(updatedProperties, personalInfo.allProperties);
      }
      
      // Create updated kernel
      const updatedKernel = this.uorCortex.createKernel({
        schemaType: 'Person',
        properties: updatedProperties,
        timestamp: Date.now()
      });
      
      this.logger.log(`Updated existing Person kernel with ${personalInfo.property}`);
      return updatedKernel;
    } else {
      // Create a new Person kernel
      const properties = personalInfo.allProperties || {};
      properties[personalInfo.property] = personalInfo.value;
      
      const newKernel = this.uorCortex.createKernel({
        schemaType: 'Person',
        properties: properties,
        timestamp: Date.now()
      });
      
      this.logger.log(`Created new Person kernel with ${personalInfo.property}`);
      return newKernel;
    }
  }
}

export default PersonalInfoManager;
