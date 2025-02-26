// schema-definitions.js
// Defines schema.org type definitions for the UOR framework

/**
 * SchemaDefinitions class handles the initialization and management 
 * of schema.org type definitions
 */
class SchemaDefinitions {
  constructor() {
    this.schemaTypes = new Map(); // Maps schema types to their properties
    this.logger = console; // Logger (can be replaced with a custom one)
    
    // Initialize schema definitions
    this.initializeSchemaTypes();
  }
  
  /**
   * Initialize basic schema.org type definitions
   */
  initializeSchemaTypes() {
    // Person schema
    this.schemaTypes.set('Person', {
      properties: ['name', 'givenName', 'familyName', 'email', 'location', 'age'],
      subtypes: ['User'],
      supertype: 'Thing'
    });
    
    // Question schema
    this.schemaTypes.set('Question', {
      properties: ['text', 'about', 'answerCount', 'author'],
      subtypes: [],
      supertype: 'CreativeWork'
    });
    
    // Conversation schema
    this.schemaTypes.set('Conversation', {
      properties: ['participants', 'turns', 'startTime', 'currentTopic'],
      subtypes: [],
      supertype: 'CreativeWork'
    });
    
    // Topic schema
    this.schemaTypes.set('Topic', {
      properties: ['name', 'description', 'relatedTopics'],
      subtypes: [],
      supertype: 'Thing'
    });
    
    // Add more schema types as needed
    this.logger.log('Schema types initialized');
  }
  
  /**
   * Gets a schema type definition by name
   * @param {string} typeName - The schema type name
   * @returns {Object|null} The schema definition or null if not found
   */
  getSchemaType(typeName) {
    return this.schemaTypes.get(typeName) || null;
  }
  
  /**
   * Gets all schema type definitions
   * @returns {Map} Map of all schema types
   */
  getAllSchemaTypes() {
    return this.schemaTypes;
  }
  
  /**
   * Adds a new schema type definition
   * @param {string} typeName - The schema type name
   * @param {Object} definition - The schema definition
   */
  addSchemaType(typeName, definition) {
    if (this.schemaTypes.has(typeName)) {
      this.logger.warn(`Schema type ${typeName} already exists and will be overwritten`);
    }
    
    this.schemaTypes.set(typeName, definition);
    this.logger.log(`Added schema type: ${typeName}`);
  }
}

export default SchemaDefinitions;
