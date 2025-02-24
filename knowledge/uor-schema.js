// uor-schema.js
// Defines the structure and relationships of the UOR objects (kernels)
// Provides a schema for the UOR knowledge graph

class UORSchemas {
    constructor() {
      this.schemas = new Map(); // Stores schemas for different types of kernels
    }
  
    /**
     * Defines the schema for a specific kernel type.
     * @param {String} kernelType - The type of kernel (e.g., "concept", "fact").
     * @param {Object} schemaDefinition - The structure of the kernel (properties, relationships, etc.).
     */
    defineSchema(kernelType, schemaDefinition) {
      if (this.schemas.has(kernelType)) {
        throw new Error(`Schema for kernel type "${kernelType}" already exists.`);
      }
  
      // Define the schema structure for the given kernel type
      this.schemas.set(kernelType, schemaDefinition);
    }
  
    /**
     * Retrieves the schema for a specific kernel type.
     * @param {String} kernelType - The type of kernel (e.g., "concept", "fact").
     * @returns {Object} - The schema for the kernel type.
     */
    getSchema(kernelType) {
      const schema = this.schemas.get(kernelType);
      if (!schema) {
        throw new Error(`Schema for kernel type "${kernelType}" not found.`);
      }
  
      return schema;
    }
  
    /**
     * Validates a kernel object based on its defined schema.
     * @param {String} kernelType - The type of the kernel.
     * @param {Object} kernelData - The kernel object to validate.
     * @returns {boolean} - True if the kernel data is valid, false otherwise.
     */
    validateKernel(kernelType, kernelData) {
      const schema = this.getSchema(kernelType);
  
      // Check if the kernel data contains the required properties defined in the schema
      for (const [key, value] of Object.entries(schema.properties)) {
        if (kernelData[key] === undefined || typeof kernelData[key] !== value) {
          throw new Error(`Invalid kernel data: Missing or incorrect type for property "${key}".`);
        }
      }
  
      // Check if the kernel data adheres to defined relationships
      if (schema.relationships) {
        for (const relationship of schema.relationships) {
          if (!kernelData[relationship]) {
            throw new Error(`Invalid kernel data: Missing relationship "${relationship}".`);
          }
        }
      }
  
      return true; // Data is valid
    }
  
    /**
     * Defines relationships between two kernels based on their types.
     * @param {String} kernelType1 - The first kernel type (e.g., "concept").
     * @param {String} kernelType2 - The second kernel type (e.g., "fact").
     * @param {String} relationship - The name of the relationship (e.g., "is related to").
     */
    defineRelationship(kernelType1, kernelType2, relationship) {
      const schema1 = this.getSchema(kernelType1);
      const schema2 = this.getSchema(kernelType2);
  
      // Ensure the relationship is valid by adding it to both schema definitions
      if (!schema1.relationships) schema1.relationships = [];
      if (!schema2.relationships) schema2.relationships = [];
  
      schema1.relationships.push(relationship);
      schema2.relationships.push(relationship);
  
      // Add the relationship to the UOR graph schemas
      this.schemas.set(kernelType1, schema1);
      this.schemas.set(kernelType2, schema2);
    }
  
    /**
     * Returns all defined schemas.
     * @returns {Map} - A map of all kernel types and their schemas.
     */
    getAllSchemas() {
      return this.schemas;
    }
  }
  
  export default UORSchemas; // Default export of the Bot class
  