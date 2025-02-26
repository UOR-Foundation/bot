// knowledge-graph.js
// Schema.org based knowledge representation system with axiom classification
// Replaces the UOR Cortex implementation with a generalized knowledge graph

/**
 * Helper class that classifies and manages axiom status
 */
class AxiomClassifier {
    constructor() {
      this.invariantAxioms = new Set(); // Axioms considered to be true across all contexts
      this.variantAxioms = new Map(); // Maps axiom IDs to usage counts and metadata
      this.logger = console;
    }
    
    /**
     * Classifies an axiom as invariant or variant
     * @param {string} axiomId - The axiom ID
     * @param {string} source - Source of the axiom
     * @param {number} confidence - Confidence level (0-1)
     * @returns {string} - Classification ('invariant' or 'variant')
     */
    classifyAxiom(axiomId, source, confidence = 0.5) {
      // System or highly confident axioms are invariant
      if (source === 'system' || confidence > 0.95) {
        this.invariantAxioms.add(axiomId);
        return 'invariant';
      }
      
      // Check if already classified as invariant
      if (this.invariantAxioms.has(axiomId)) {
        return 'invariant';
      }
      
      // Initialize or update usage tracking for variant axioms
      if (!this.variantAxioms.has(axiomId)) {
        this.variantAxioms.set(axiomId, {
          usageCount: 0,
          firstSeen: Date.now(),
          lastUsed: Date.now(),
          sources: [source],
          confidence: confidence
        });
      } else {
        const axiomData = this.variantAxioms.get(axiomId);
        axiomData.lastUsed = Date.now();
        if (!axiomData.sources.includes(source)) {
          axiomData.sources.push(source);
        }
        // Update confidence if higher
        if (confidence > axiomData.confidence) {
          axiomData.confidence = confidence;
        }
      }
      
      return 'variant';
    }
    
    /**
     * Records usage of an axiom
     * @param {string} axiomId - Axiom ID
     * @returns {Object} - Updated usage data
     */
    recordUsage(axiomId) {
      // Invariant axioms don't need usage tracking
      if (this.invariantAxioms.has(axiomId)) {
        return { isInvariant: true };
      }
      
      // Update variant axiom usage count
      if (this.variantAxioms.has(axiomId)) {
        const axiomData = this.variantAxioms.get(axiomId);
        axiomData.usageCount++;
        axiomData.lastUsed = Date.now();
        return { 
          isInvariant: false,
          ...axiomData
        };
      }
      
      return null; // Axiom not found
    }
    
    /**
     * Promotes a variant axiom to invariant status
     * @param {string} axiomId - Axiom ID to promote
     * @returns {boolean} - Success indicator
     */
    promoteToInvariant(axiomId) {
      if (this.invariantAxioms.has(axiomId)) {
        // Already invariant
        return true;
      }
      
      if (this.variantAxioms.has(axiomId)) {
        this.invariantAxioms.add(axiomId);
        this.variantAxioms.delete(axiomId);
        this.logger.log(`Promoted axiom ${axiomId} to invariant status`);
        return true;
      }
      
      return false; // Axiom not found
    }
    
    /**
     * Checks if an axiom is invariant
     * @param {string} axiomId - Axiom ID
     * @returns {boolean} - True if invariant
     */
    isInvariant(axiomId) {
      return this.invariantAxioms.has(axiomId);
    }
    
    /**
     * Gets axiom metadata
     * @param {string} axiomId - Axiom ID
     * @returns {Object|null} - Axiom metadata or null if not found
     */
    getAxiomMetadata(axiomId) {
      if (this.invariantAxioms.has(axiomId)) {
        return { isInvariant: true };
      }
      
      if (this.variantAxioms.has(axiomId)) {
        return {
          isInvariant: false,
          ...this.variantAxioms.get(axiomId)
        };
      }
      
      return null;
    }
    
    /**
     * Evaluates promotion eligibility based on usage
     * @param {string} axiomId - Axiom ID
     * @returns {boolean} - True if eligible for promotion
     */
    isEligibleForPromotion(axiomId) {
      if (!this.variantAxioms.has(axiomId)) {
        return false;
      }
      
      const axiomData = this.variantAxioms.get(axiomId);
      
      // Promotion criteria: high usage count, multiple sources, and good confidence
      const hasHighUsage = axiomData.usageCount >= 5;
      const hasMultipleSources = axiomData.sources.length >= 2;
      const hasGoodConfidence = axiomData.confidence >= 0.8;
      
      return hasHighUsage && (hasMultipleSources || hasGoodConfidence);
    }
  }
  
  /**
   * Main KnowledgeGraph class that manages entities and relationships
   */
  class KnowledgeGraph {
    constructor() {
      this.entities = new Map(); // Maps entity IDs to entity objects
      this.relationships = new Map(); // Maps relationship IDs to relationship objects
      this.axiomClassifier = new AxiomClassifier();
      this.entityIndex = new Map(); // Index by entity type
      this.relationshipIndex = new Map(); // Index by relationship type
      this.logger = console;
      
      // Initialize counters for ID generation
      this._entityIdCounter = 0;
      this._relationshipIdCounter = 0;
    }
    
    /**
     * Generates a unique entity ID
     * @returns {string} - The generated ID
     */
    _generateEntityId() {
      return `entity_${Date.now()}_${this._entityIdCounter++}`;
    }
    
    /**
     * Generates a unique relationship ID
     * @returns {string} - The generated ID
     */
    _generateRelationshipId() {
      return `rel_${Date.now()}_${this._relationshipIdCounter++}`;
    }
    
    /**
     * Validates that an entity conforms to schema.org structure
     * @param {Object} entityData - The entity to validate
     * @returns {boolean} - True if valid
     */
    _validateSchemaEntity(entityData) {
      // Basic validation - must have @type
      if (!entityData || !entityData['@type']) {
        this.logger.error('Invalid entity: missing @type property');
        return false;
      }
      
      // Could add more schema.org validation here
      return true;
    }
    
    /**
     * Updates the entity index
     * @param {string} entityId - Entity ID
     * @param {string} entityType - Entity type
     */
    _updateEntityIndex(entityId, entityType) {
      if (!this.entityIndex.has(entityType)) {
        this.entityIndex.set(entityType, new Set());
      }
      this.entityIndex.get(entityType).add(entityId);
    }
    
    /**
     * Updates the relationship index
     * @param {string} relationshipId - Relationship ID
     * @param {string} relationType - Relationship type
     */
    _updateRelationshipIndex(relationshipId, relationType) {
      if (!this.relationshipIndex.has(relationType)) {
        this.relationshipIndex.set(relationType, new Set());
      }
      this.relationshipIndex.get(relationType).add(relationshipId);
    }
    
    /**
     * Creates or updates an entity in the knowledge graph
     * @param {Object} entityData - The data representing the entity (must include @type)
     * @param {string} source - Source of the information (e.g., 'user', 'web', 'inference')
     * @param {number} confidence - Confidence score between 0 and 1
     * @returns {Object} - The created/updated entity with its ID
     */
    createEntity(entityData, source = 'system', confidence = 0.5) {
      // Validate entity structure
      if (!this._validateSchemaEntity(entityData)) {
        return null;
      }
      
      let entityId;
      let isUpdate = false;
      
      // Check if this is an update to an existing entity
      if (entityData.id) {
        entityId = entityData.id;
        isUpdate = this.entities.has(entityId);
      } else {
        // For new entities without ID, check if similar entity exists
        const similarEntities = this.findSimilarEntities(entityData);
        if (similarEntities.length > 0) {
          // Use the first similar entity's ID
          entityId = similarEntities[0].id;
          isUpdate = true;
        } else {
          // No similar entity found, generate new ID
          entityId = this._generateEntityId();
        }
      }
      
      // Prepare entity object
      const timestamp = Date.now();
      const entity = {
        id: entityId,
        ...entityData,
        _metadata: {
          created: isUpdate ? this.entities.get(entityId)._metadata.created : timestamp,
          updated: timestamp,
          source: source,
          confidence: confidence,
          axiomId: `axiom_entity_${entityId}`
        }
      };
      
      // Classify the axiom
      const classification = this.axiomClassifier.classifyAxiom(
        entity._metadata.axiomId,
        source,
        confidence
      );
      entity._metadata.axiomStatus = classification;
      
      // Store entity
      this.entities.set(entityId, entity);
      
      // Update index
      this._updateEntityIndex(entityId, entity['@type']);
      
      this.logger.log(`${isUpdate ? 'Updated' : 'Created'} entity ${entityId} of type ${entity['@type']}`);
      
      return entity;
    }
    
    /**
     * Creates a relationship between two entities
     * @param {string} sourceEntityId - ID of the source entity
     * @param {string} targetEntityId - ID of the target entity
     * @param {string} relationType - The schema.org relationship type
     * @param {Object} properties - Additional properties for the relationship
     * @param {string} source - Source of the relationship
     * @param {number} confidence - Confidence score between 0 and 1
     * @returns {Object} - The created relationship
     */
    createRelationship(sourceEntityId, targetEntityId, relationType, properties = {}, source = 'system', confidence = 0.5) {
      // Validate entities exist
      if (!this.entities.has(sourceEntityId) || !this.entities.has(targetEntityId)) {
        this.logger.error(`Cannot create relationship: one or both entities not found`);
        return null;
      }
      
      // Check for existing relationship of the same type between the entities
      const existingRel = this.findRelationship(sourceEntityId, targetEntityId, relationType);
      
      let relationshipId;
      let isUpdate = false;
      
      if (existingRel) {
        relationshipId = existingRel.id;
        isUpdate = true;
      } else {
        relationshipId = this._generateRelationshipId();
      }
      
      // Create relationship object
      const timestamp = Date.now();
      const relationship = {
        id: relationshipId,
        sourceEntityId,
        targetEntityId,
        type: relationType,
        properties: { ...properties },
        _metadata: {
          created: isUpdate ? this.relationships.get(relationshipId)._metadata.created : timestamp,
          updated: timestamp,
          source: source,
          confidence: confidence,
          axiomId: `axiom_rel_${relationshipId}`
        }
      };
      
      // Classify the axiom
      const classification = this.axiomClassifier.classifyAxiom(
        relationship._metadata.axiomId,
        source,
        confidence
      );
      relationship._metadata.axiomStatus = classification;
      
      // Store relationship
      this.relationships.set(relationshipId, relationship);
      
      // Update index
      this._updateRelationshipIndex(relationshipId, relationType);
      
      this.logger.log(`${isUpdate ? 'Updated' : 'Created'} relationship ${relationshipId} (${relationType})`);
      
      return relationship;
    }
    
    /**
     * Finds an existing relationship between entities
     * @param {string} sourceEntityId - Source entity ID
     * @param {string} targetEntityId - Target entity ID
     * @param {string} relationType - Relationship type
     * @returns {Object|null} - Matching relationship or null
     */
    findRelationship(sourceEntityId, targetEntityId, relationType) {
      for (const [id, rel] of this.relationships.entries()) {
        if (rel.sourceEntityId === sourceEntityId && 
            rel.targetEntityId === targetEntityId && 
            rel.type === relationType) {
          return rel;
        }
      }
      return null;
    }
    
    /**
     * Find entities similar to the provided entity data
     * @param {Object} entityData - Entity data to compare
     * @returns {Array} - Array of similar entities
     */
    findSimilarEntities(entityData) {
      const results = [];
      const entityType = entityData['@type'];
      
      // Check entities of the same type
      const sameTypeEntities = this.getEntitiesByType(entityType);
      
      for (const entity of sameTypeEntities) {
        // Simple similarity - match main identifying properties
        let similarityScore = 0;
        let matchedProperties = 0;
        let totalProperties = 0;
        
        // Check common identifying properties
        const identifyingProps = ['name', 'title', 'identifier', 'url'];
        
        for (const prop of identifyingProps) {
          if (entityData[prop] && entity[prop]) {
            totalProperties++;
            if (entityData[prop] === entity[prop]) {
              matchedProperties++;
            }
          }
        }
        
        if (totalProperties > 0) {
          similarityScore = matchedProperties / totalProperties;
        }
        
        // If score exceeds threshold, consider similar
        if (similarityScore > 0.7) {
          results.push(entity);
        }
      }
      
      return results;
    }
    
    /**
     * Gets entities by type
     * @param {string} type - Entity type
     * @returns {Array} - Entities of the specified type
     */
    getEntitiesByType(type) {
      const results = [];
      
      if (this.entityIndex.has(type)) {
        const entityIds = this.entityIndex.get(type);
        for (const id of entityIds) {
          if (this.entities.has(id)) {
            results.push(this.entities.get(id));
          }
        }
      }
      
      return results;
    }
    
    /**
     * Retrieves entities related to the query
     * @param {Object|string} query - Query parameters or text query
     * @param {Object} options - Query options (e.g., limit, axiom preferences)
     * @returns {Array} - Array of relevant entities with relevance scores
     */
    retrieveRelevantEntities(query, options = {}) {
      const results = [];
      const limit = options.limit || 10;
      const prioritizeInvariant = options.prioritizeInvariant !== false;
      
      // Convert string query to object
      if (typeof query === 'string') {
        query = { text: query };
      }
      
      // Handle different query types
      if (query.entityId) {
        // Direct entity lookup by ID
        if (this.entities.has(query.entityId)) {
          const entity = this.entities.get(query.entityId);
          results.push({
            entity,
            relevanceScore: 1.0,
            isInvariant: this.axiomClassifier.isInvariant(entity._metadata.axiomId)
          });
        }
      } else if (query.entityType) {
        // Query by type
        const entitiesOfType = this.getEntitiesByType(query.entityType);
        for (const entity of entitiesOfType) {
          const isInvariant = this.axiomClassifier.isInvariant(entity._metadata.axiomId);
          results.push({
            entity,
            relevanceScore: isInvariant ? 0.9 : 0.7,
            isInvariant
          });
        }
      } else if (query.text) {
        // Text-based query - simple search for now
        const searchText = query.text.toLowerCase();
        
        // Check all entities
        for (const [id, entity] of this.entities.entries()) {
          let matchScore = 0;
          
          // Search in name/title
          if (entity.name && entity.name.toLowerCase().includes(searchText)) {
            matchScore = 0.8;
          } else if (entity.title && entity.title.toLowerCase().includes(searchText)) {
            matchScore = 0.7;
          } else if (entity.description && entity.description.toLowerCase().includes(searchText)) {
            matchScore = 0.5;
          }
          
          // Add other properties search
          for (const [key, value] of Object.entries(entity)) {
            if (key !== 'name' && key !== 'title' && key !== 'description' && 
                typeof value === 'string' && value.toLowerCase().includes(searchText)) {
              matchScore = Math.max(matchScore, 0.3);
            }
          }
          
          if (matchScore > 0) {
            const isInvariant = this.axiomClassifier.isInvariant(entity._metadata.axiomId);
            
            // Boost invariant axioms if prioritized
            if (prioritizeInvariant && isInvariant) {
              matchScore *= 1.2;
            }
            
            results.push({
              entity,
              relevanceScore: matchScore,
              isInvariant
            });
          }
        }
      }
      
      // Sort by relevance score
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      // Apply limit
      return results.slice(0, limit);
    }
    
    /**
     * Gets an entity by ID
     * @param {string} entityId - The entity ID
     * @returns {Object|null} - The entity or null if not found
     */
    getEntity(entityId) {
      return this.entities.get(entityId) || null;
    }
    
    /**
     * Gets a relationship by ID
     * @param {string} relationshipId - The relationship ID
     * @returns {Object|null} - The relationship or null if not found
     */
    getRelationship(relationshipId) {
      return this.relationships.get(relationshipId) || null;
    }
    
    /**
     * Gets all relationships for an entity
     * @param {string} entityId - Entity ID
     * @param {Object} options - Options like direction and type filters
     * @returns {Array} - Relationships involving the entity
     */
    getEntityRelationships(entityId, options = {}) {
      const results = [];
      const direction = options.direction || 'both'; // 'outgoing', 'incoming', or 'both'
      const types = options.types || []; // Filter by relationship types
      
      for (const [id, rel] of this.relationships.entries()) {
        let matches = false;
        
        if (direction === 'outgoing' && rel.sourceEntityId === entityId) {
          matches = true;
        } else if (direction === 'incoming' && rel.targetEntityId === entityId) {
          matches = true;
        } else if (direction === 'both' && (rel.sourceEntityId === entityId || rel.targetEntityId === entityId)) {
          matches = true;
        }
        
        // Apply type filter if specified
        if (matches && types.length > 0) {
          matches = types.includes(rel.type);
        }
        
        if (matches) {
          results.push(rel);
        }
      }
      
      return results;
    }
    
    /**
     * Traverses the knowledge graph from a starting point
     * @param {string} startEntityId - Starting entity ID
     * @param {Object} options - Traversal options (depth, filters, etc.)
     * @returns {Array} - Array of connected entities and relationships
     */
    traverseGraph(startEntityId, options = {}) {
      const maxDepth = options.maxDepth || 2;
      const relationshipTypes = options.relationshipTypes || [];
      const entityTypes = options.entityTypes || [];
      const direction = options.direction || 'both';
      
      const visited = new Set(); // Keep track of visited entities
      const result = []; // Collected entities and relationships
      
      // Helper function for recursive traversal
      const traverse = (entityId, currentDepth) => {
        // Stop if we've reached max depth or already visited this entity
        if (currentDepth > maxDepth || visited.has(entityId)) {
          return;
        }
        
        visited.add(entityId);
        
        // Get the entity
        const entity = this.getEntity(entityId);
        if (!entity) {
          return;
        }
        
        // Check entity type filter
        if (entityTypes.length > 0 && !entityTypes.includes(entity['@type'])) {
          return;
        }
        
        // Add entity to results
        result.push({
          type: 'entity',
          data: entity,
          depth: currentDepth
        });
        
        // Get relationships based on direction
        const relationships = this.getEntityRelationships(entityId, {
          direction,
          types: relationshipTypes
        });
        
        // Add relationships and continue traversal
        for (const rel of relationships) {
          // Add relationship to results
          result.push({
            type: 'relationship',
            data: rel,
            depth: currentDepth
          });
          
          // Determine the next entity to visit
          const nextEntityId = rel.sourceEntityId === entityId ? 
                              rel.targetEntityId : rel.sourceEntityId;
          
          // Recursively traverse the next entity
          traverse(nextEntityId, currentDepth + 1);
        }
      };
      
      // Start traversal from the given entity
      traverse(startEntityId, 0);
      
      return result;
    }
    
    /**
     * Promotes a variant axiom to invariant status
     * @param {string} axiomId - ID of the axiom to promote
     * @returns {boolean} - Success indicator
     */
    promoteVariantToInvariant(axiomId) {
      return this.axiomClassifier.promoteToInvariant(axiomId);
    }
    
    /**
     * Records usage of axioms
     * @param {Array} axiomIds - IDs of axioms that were used
     * @returns {Array} - Updated axiom data
     */
    recordAxiomsUsage(axiomIds) {
      const results = [];
      
      for (const axiomId of axiomIds) {
        const usageData = this.axiomClassifier.recordUsage(axiomId);
        results.push({
          axiomId,
          ...usageData,
          eligibleForPromotion: this.axiomClassifier.isEligibleForPromotion(axiomId)
        });
      }
      
      return results;
    }
    
    /**
     * Performs inference to derive new knowledge from existing facts
     * @param {Array} entities - Entities to analyze
     * @returns {Array} - New inferred facts (entities or relationships)
     */
    performInference(entities) {
      const inferredFacts = [];
      
      // This is a simplified implementation - a real system would have
      // more sophisticated inference rules
      
      for (const entity of entities) {
        // Example inference: if entity is a Person with both givenName and familyName
        // but no full name, create the full name
        if (entity['@type'] === 'Person' && 
            entity.givenName && 
            entity.familyName && 
            !entity.name) {
          
          // Create update with inferred full name
          const updatedEntity = {
            ...entity,
            name: `${entity.givenName} ${entity.familyName}`
          };
          
          // Add to the knowledge graph with inference source
          const result = this.createEntity(
            updatedEntity, 
            'inference',
            0.9
          );
          
          if (result) {
            inferredFacts.push({
              type: 'entity',
              data: result,
              inferenceType: 'name_composition'
            });
          }
        }
        
        // More inference rules could be added here
      }
      
      return inferredFacts;
    }
    
    /**
     * Gets all entities in the knowledge graph
     * @returns {Array} - All entities
     */
    getAllEntities() {
      return Array.from(this.entities.values());
    }
    
    /**
     * Gets all relationships in the knowledge graph
     * @returns {Array} - All relationships
     */
    getAllRelationships() {
      return Array.from(this.relationships.values());
    }
    
    /**
     * Gets statistics about the knowledge graph
     * @returns {Object} - Statistics object
     */
    getStatistics() {
      return {
        entityCount: this.entities.size,
        relationshipCount: this.relationships.size,
        entityTypeCount: this.entityIndex.size,
        relationshipTypeCount: this.relationshipIndex.size,
        invariantAxiomCount: this.axiomClassifier.invariantAxioms.size,
        variantAxiomCount: this.axiomClassifier.variantAxioms.size
      };
    }
  }
  
  export default KnowledgeGraph;