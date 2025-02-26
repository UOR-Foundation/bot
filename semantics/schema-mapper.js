// schema-mapper.js
// Maps entities to schema.org semantic structures

/**
 * SchemaMapper class handles mapping extracted entities to schema.org types
 * and provides utilities for standardizing semantic representations
 */
class SchemaMapper {
  constructor() {
    this.schemaTypes = new Map(); // Maps schema types to their properties
    this.schemaRelationships = new Map(); // Maps relationships between schema types
    this.logger = console; // Logger (can be replaced with a custom one)
    
    // Initialize schema definitions
    this.loadSchemaDefinitions();
    
    // Initialize relationship mappings
    this.loadRelationshipMappings();
  }
  
  /**
   * Loads schema.org type definitions
   */
  loadSchemaDefinitions() {
    this.logger.log("Loading schema.org type definitions");
    
    // Define basic schema.org types with core properties
    this.schemaTypes.set('Person', {
      properties: ['name', 'givenName', 'familyName', 'email', 'telephone', 'age', 'birthDate', 'gender', 'location'],
      subtypes: ['User', 'Contact', 'Author'],
      supertype: 'Thing'
    });
    
    this.schemaTypes.set('Organization', {
      properties: ['name', 'description', 'url', 'logo', 'address', 'email', 'telephone'],
      subtypes: ['Corporation', 'LocalBusiness', 'Company'],
      supertype: 'Thing'
    });
    
    this.schemaTypes.set('Place', {
      properties: ['name', 'address', 'geo', 'description', 'telephone'],
      subtypes: ['LocalBusiness', 'Residence', 'TouristAttraction'],
      supertype: 'Thing'
    });
    
    this.schemaTypes.set('CreativeWork', {
      properties: ['name', 'author', 'dateCreated', 'datePublished', 'description', 'text', 'headline'],
      subtypes: ['Article', 'Book', 'BlogPosting', 'WebPage'],
      supertype: 'Thing'
    });
    
    this.schemaTypes.set('Product', {
      properties: ['name', 'description', 'brand', 'manufacturer', 'model', 'price'],
      subtypes: ['IndividualProduct', 'ProductModel'],
      supertype: 'Thing'
    });
    
    this.schemaTypes.set('Event', {
      properties: ['name', 'description', 'startDate', 'endDate', 'location', 'organizer'],
      subtypes: ['BusinessEvent', 'SportsEvent', 'SocialEvent'],
      supertype: 'Thing'
    });
    
    this.schemaTypes.set('Question', {
      properties: ['text', 'about', 'author', 'dateCreated'],
      subtypes: [],
      supertype: 'CreativeWork'
    });
    
    this.schemaTypes.set('Topic', {
      properties: ['name', 'description', 'relatedTopics'],
      subtypes: [],
      supertype: 'Thing'
    });
    
    this.schemaTypes.set('DateTime', {
      properties: ['date', 'time', 'timezone'],
      subtypes: [],
      supertype: 'Thing'
    });
    
    this.schemaTypes.set('ConversationContext', {
      properties: ['type', 'confidence', 'timestamp', 'activeSince'],
      subtypes: [],
      supertype: 'Thing'
    });
  }
  
  /**
   * Loads relationship mappings between schema types
   */
  loadRelationshipMappings() {
    this.logger.log("Loading schema.org relationship mappings");
    
    // Define common mappings for internal relationship types to schema.org properties
    this.schemaRelationships.set('isAbout', 'about');
    this.schemaRelationships.set('hasAuthor', 'author');
    this.schemaRelationships.set('hasPart', 'hasPart');
    this.schemaRelationships.set('isPartOf', 'isPartOf');
    this.schemaRelationships.set('mentions', 'mentions');
    this.schemaRelationships.set('worksFor', 'worksFor');
    this.schemaRelationships.set('subjectOf', 'subjectOf');
    this.schemaRelationships.set('knows', 'knows');
    this.schemaRelationships.set('memberOf', 'memberOf');
    this.schemaRelationships.set('affiliation', 'affiliation');
    this.schemaRelationships.set('location', 'location');
    this.schemaRelationships.set('homeLocation', 'homeLocation');
    this.schemaRelationships.set('organizer', 'organizer');
    this.schemaRelationships.set('attendee', 'attendee');
    this.schemaRelationships.set('publisher', 'publisher');
    this.schemaRelationships.set('creator', 'creator');
    this.schemaRelationships.set('owns', 'owns');
    this.schemaRelationships.set('produces', 'produces');
    this.schemaRelationships.set('brand', 'brand');
    this.schemaRelationships.set('manufacturer', 'manufacturer');
  }
  
  /**
   * Maps an entity to the best matching schema.org type
   * @param {Object} entity - Entity to map
   * @returns {Object} - Schema.org mapped entity
   */
  mapEntityToSchema(entity) {
    this.logger.log(`Mapping entity of type "${entity.type}" to schema.org`);
    
    if (!entity || !entity.type) {
      return null;
    }
    
    // Create the base schema entity with the @type property
    const schemaType = this.mapTypeToSchema(entity.type);
    
    const schemaEntity = {
      '@type': schemaType,
      id: entity.id || `entity_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
    };
    
    // Transfer properties from the entity to the schema entity
    if (entity.properties) {
      Object.entries(entity.properties).forEach(([key, value]) => {
        // Map the property name to schema.org property if needed
        const schemaProperty = this.mapPropertyToSchema(key, schemaType);
        schemaEntity[schemaProperty] = value;
      });
    }
    
    // Copy metadata
    if (entity.confidence) {
      schemaEntity.confidence = entity.confidence;
    }
    
    if (entity.source) {
      schemaEntity.source = entity.source;
    }
    
    if (entity.timestamp) {
      schemaEntity.timestamp = entity.timestamp;
    }
    
    // Store the original entity ID for reference in relationships
    if (entity.id) {
      schemaEntity.sourceId = entity.id;
    }
    
    return schemaEntity;
  }
  
  /**
   * Maps entity type to schema.org type
   * @param {string} entityType - The entity type 
   * @returns {string} - The schema.org type
   */
  mapTypeToSchema(entityType) {
    // Direct mappings
    const typeMappings = {
      'Person': 'Person',
      'Organization': 'Organization',
      'Place': 'Place',
      'Question': 'Question',
      'Topic': 'Thing',
      'DateTime': 'DateTime',
      'Product': 'Product',
      'Event': 'Event',
      'ConversationContext': 'Thing'
    };
    
    // Return the mapped type or the original if no mapping exists
    return typeMappings[entityType] || entityType;
  }
  
  /**
   * Maps property name to schema.org property
   * @param {string} property - The property name
   * @param {string} schemaType - The schema.org type
   * @returns {string} - The schema.org property name
   */
  mapPropertyToSchema(property, schemaType) {
    // Direct property mappings for specific schema types
    const propertyMappings = {
      'Person': {
        'location': 'homeLocation',
        'company': 'worksFor'
      },
      'Question': {
        'aboutProperty': 'about',
        'text': 'text',
        'isPersonalQuestion': 'additionalType'
      }
    };
    
    // Check if there's a specific mapping for this schema type and property
    if (propertyMappings[schemaType] && propertyMappings[schemaType][property]) {
      return propertyMappings[schemaType][property];
    }
    
    // No specific mapping, return the original property
    return property;
  }
  
  /**
   * Maps relationship type to schema.org relationship
   * @param {string} relationshipType - The relationship type
   * @returns {string} - The schema.org relationship type
   */
  mapRelationshipType(relationshipType) {
    return this.schemaRelationships.get(relationshipType) || relationshipType;
  }
  
  /**
   * Gets schema definition for a type
   * @param {string} schemaType - The schema type to look up
   * @returns {Object|null} - The schema definition or null if not found
   */
  getSchemaDefinition(schemaType) {
    return this.schemaTypes.get(schemaType) || null;
  }
  
  /**
   * Checks if a property is valid for a schema type
   * @param {string} schemaType - The schema type
   * @param {string} property - The property to check
   * @returns {boolean} - Whether the property is valid
   */
  isValidProperty(schemaType, property) {
    const schemaDef = this.getSchemaDefinition(schemaType);
    if (!schemaDef) {
      return true; // If schema is unknown, consider all properties valid
    }
    
    return schemaDef.properties.includes(property);
  }
  
  /**
   * Validates a schema entity against schema.org definitions
   * @param {Object} schemaEntity - The schema entity to validate
   * @returns {boolean} - Whether the entity is valid
   */
  validateSchemaEntity(schemaEntity) {
    if (!schemaEntity || !schemaEntity['@type']) {
      return false;
    }
    
    const schemaType = schemaEntity['@type'];
    const schemaDef = this.getSchemaDefinition(schemaType);
    
    // If we don't have a definition for this type, consider it valid
    if (!schemaDef) {
      return true;
    }
    
    // Check that all properties are valid for this type
    // This is a simplified validation - schema.org has more complex rules
    for (const key in schemaEntity) {
      // Skip type and metadata properties
      if (key === '@type' || key === 'id' || key === 'sourceId' || 
          key === 'confidence' || key === 'timestamp' || key === 'source') {
        continue;
      }
      
      if (!this.isValidProperty(schemaType, key)) {
        this.logger.warn(`Property "${key}" is not valid for schema type "${schemaType}"`);
        // Don't reject entirely, just warn
      }
    }
    
    return true;
  }
  
  /**
   * Gets subtypes of a schema type
   * @param {string} schemaType - The schema type
   * @returns {Array} - Array of subtype names
   */
  getSubtypes(schemaType) {
    const schemaDef = this.getSchemaDefinition(schemaType);
    return schemaDef ? schemaDef.subtypes : [];
  }
  
  /**
   * Gets the supertype of a schema type
   * @param {string} schemaType - The schema type
   * @returns {string|null} - The supertype or null if not found
   */
  getSupertype(schemaType) {
    const schemaDef = this.getSchemaDefinition(schemaType);
    return schemaDef ? schemaDef.supertype : null;
  }
  
  /**
   * Checks if two schema types are related (one is a subtype of the other)
   * @param {string} type1 - First schema type
   * @param {string} type2 - Second schema type
   * @returns {boolean} - Whether the types are related
   */
  areTypesRelated(type1, type2) {
    // Direct match
    if (type1 === type2) return true;
    
    // Check if type1 is a subtype of type2
    let currentType = type1;
    while (currentType) {
      const supertype = this.getSupertype(currentType);
      if (supertype === type2) return true;
      if (!supertype || supertype === currentType) break;
      currentType = supertype;
    }
    
    // Check if type2 is a subtype of type1
    currentType = type2;
    while (currentType) {
      const supertype = this.getSupertype(currentType);
      if (supertype === type1) return true;
      if (!supertype || supertype === currentType) break;
      currentType = supertype;
    }
    
    return false;
  }
}

export default SchemaMapper;
