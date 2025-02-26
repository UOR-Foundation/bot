// schema-database.js
// Persistent storage for entities and relationships with indexing and query capabilities

/**
 * SchemaDatabase class handles persistent storage of schema.org entities and relationships
 * using IndexedDB. It provides transaction handling, indexing, and query capabilities
 * while supporting the axiom classification system.
 */
class SchemaDatabase {
    constructor() {
      this.db = null; // IndexedDB connection
      this.dbName = 'SchemaKnowledgeDB';
      this.entityStore = 'entities';
      this.relationshipStore = 'relationships';
      this.axiomStore = 'axioms';
      this.indexStore = 'indices';
      this.version = 1;
      this.logger = console;
      this.isInitialized = false;
    }
  
    /**
     * Opens the IndexedDB and creates necessary object stores
     * @returns {Promise<void>}
     */
    async openDatabase() {
      return new Promise((resolve, reject) => {
        if (this.db) {
          resolve(this.db);
          return;
        }
  
        this.logger.log(`Opening database: ${this.dbName}`);
        const request = indexedDB.open(this.dbName, this.version);
  
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          this.logger.log('Database upgrade needed, creating stores');
  
          // Create entity store with indices
          if (!db.objectStoreNames.contains(this.entityStore)) {
            const entityStore = db.createObjectStore(this.entityStore, { keyPath: 'id' });
            entityStore.createIndex('type', '@type', { multiEntry: true });
            entityStore.createIndex('dateCreated', 'dateCreated', { unique: false });
            entityStore.createIndex('dateModified', 'dateModified', { unique: false });
            entityStore.createIndex('source', 'source', { unique: false });
            entityStore.createIndex('isInvariant', 'isInvariant', { unique: false });
          }
  
          // Create relationship store with indices
          if (!db.objectStoreNames.contains(this.relationshipStore)) {
            const relationshipStore = db.createObjectStore(this.relationshipStore, { keyPath: 'id' });
            relationshipStore.createIndex('sourceEntityId', 'sourceEntityId', { unique: false });
            relationshipStore.createIndex('targetEntityId', 'targetEntityId', { unique: false });
            relationshipStore.createIndex('relationType', 'relationType', { unique: false });
            relationshipStore.createIndex('source', 'source', { unique: false });
            relationshipStore.createIndex('isInvariant', 'isInvariant', { unique: false });
            relationshipStore.createIndex('sourceTargetType', 'sourceTargetType', { unique: false });
          }
  
          // Create axiom store for tracking axiom status and metadata
          if (!db.objectStoreNames.contains(this.axiomStore)) {
            const axiomStore = db.createObjectStore(this.axiomStore, { keyPath: 'id' });
            axiomStore.createIndex('status', 'status', { unique: false });
            axiomStore.createIndex('usageCount', 'usageCount', { unique: false });
            axiomStore.createIndex('source', 'source', { unique: false });
            axiomStore.createIndex('lastUsed', 'lastUsed', { unique: false });
          }
  
          // Create index store for full-text search and auxiliary indices
          if (!db.objectStoreNames.contains(this.indexStore)) {
            const indexStore = db.createObjectStore(this.indexStore, { keyPath: 'id' });
            indexStore.createIndex('term', 'term', { unique: false });
            indexStore.createIndex('entityId', 'entityId', { unique: false });
            indexStore.createIndex('propertyName', 'propertyName', { unique: false });
          }
        };
  
        request.onsuccess = (event) => {
          this.db = event.target.result;
          this.isInitialized = true;
          this.logger.log('Database opened successfully');
          resolve(this.db);
        };
  
        request.onerror = (event) => {
          this.logger.error('Error opening database:', event.target.error);
          reject(new Error(`Failed to open database: ${event.target.error}`));
        };
      });
    }
  
    /**
     * Ensures the database is open before executing operations
     * @private
     * @returns {Promise<IDBDatabase>} - The database instance
     */
    async ensureDatabase() {
      if (!this.isInitialized) {
        await this.openDatabase();
      }
      return this.db;
    }
  
    /**
     * Stores an entity in the database
     * @param {Object} entity - The entity to store
     * @param {boolean} isInvariant - Whether this is an invariant axiom
     * @returns {Promise<string>} - The entity ID
     */
    async storeEntity(entity, isInvariant = false) {
      await this.ensureDatabase();
      
      // Ensure entity has required fields
      if (!entity.id) {
        entity.id = this.generateId('entity');
      }
      
      if (!entity['@type']) {
        throw new Error('Entity must have a @type property (schema.org type)');
      }
      
      // Add metadata
      const now = new Date().toISOString();
      entity.dateModified = now;
      
      if (!entity.dateCreated) {
        entity.dateCreated = now;
      }
      
      // Mark invariant status
      entity.isInvariant = isInvariant;
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.entityStore, this.indexStore], 'readwrite');
        transaction.oncomplete = () => {
          this.logger.log(`Entity stored: ${entity.id}`);
          resolve(entity.id);
        };
        
        transaction.onerror = (event) => {
          this.logger.error(`Error storing entity: ${event.target.error}`);
          reject(new Error(`Failed to store entity: ${event.target.error}`));
        };
        
        // Store the entity
        const entityStore = transaction.objectStore(this.entityStore);
        entityStore.put(entity);
        
        // Create indices for text search
        this.indexEntityProperties(entity, transaction);
        
        // Create/update axiom record
        this.updateAxiomRecord(entity.id, isInvariant ? 'invariant' : 'variant', entity.source || 'system', transaction);
      });
    }
  
    /**
     * Indexes entity properties for text search
     * @private
     * @param {Object} entity - The entity to index
     * @param {IDBTransaction} transaction - Active transaction
     */
    indexEntityProperties(entity, transaction) {
      const indexStore = transaction.objectStore(this.indexStore);
      const indexableProps = ['name', 'description', 'text', 'title', 'alternateName'];
      
      // Remove existing indices for this entity
      const removeIndex = indexStore.index('entityId').openCursor(IDBKeyRange.only(entity.id));
      
      removeIndex.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          indexStore.delete(cursor.value.id);
          cursor.continue();
        }
      };
      
      // Add new indices
      for (const prop of indexableProps) {
        if (entity[prop] && typeof entity[prop] === 'string') {
          // Split text and create index entries
          const words = entity[prop].toLowerCase().split(/\W+/).filter(w => w.length > 2);
          
          for (const word of words) {
            indexStore.put({
              id: `${entity.id}_${prop}_${word}`,
              term: word,
              entityId: entity.id,
              propertyName: prop,
              type: entity['@type']
            });
          }
        }
      }
    }
  
    /**
     * Stores a relationship in the database
     * @param {Object} relationship - The relationship to store
     * @param {boolean} isInvariant - Whether this is an invariant axiom
     * @returns {Promise<string>} - The relationship ID
     */
    async storeRelationship(relationship, isInvariant = false) {
      await this.ensureDatabase();
      
      // Ensure relationship has required fields
      if (!relationship.id) {
        relationship.id = this.generateId('relationship');
      }
      
      if (!relationship.sourceEntityId || !relationship.targetEntityId || !relationship.relationType) {
        throw new Error('Relationship must have sourceEntityId, targetEntityId, and relationType');
      }
      
      // Add metadata
      const now = new Date().toISOString();
      relationship.dateModified = now;
      
      if (!relationship.dateCreated) {
        relationship.dateCreated = now;
      }
      
      // Mark invariant status
      relationship.isInvariant = isInvariant;
      
      // Add composite index for efficient source-target queries
      relationship.sourceTargetType = `${relationship.sourceEntityId}_${relationship.targetEntityId}_${relationship.relationType}`;
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.relationshipStore], 'readwrite');
        transaction.oncomplete = () => {
          this.logger.log(`Relationship stored: ${relationship.id}`);
          resolve(relationship.id);
        };
        
        transaction.onerror = (event) => {
          this.logger.error(`Error storing relationship: ${event.target.error}`);
          reject(new Error(`Failed to store relationship: ${event.target.error}`));
        };
        
        // Store the relationship
        const relationshipStore = transaction.objectStore(this.relationshipStore);
        relationshipStore.put(relationship);
        
        // Create/update axiom record
        this.updateAxiomRecord(relationship.id, isInvariant ? 'invariant' : 'variant', relationship.source || 'system', transaction);
      });
    }
  
    /**
     * Updates or creates an axiom record
     * @private
     * @param {string} axiomId - The axiom ID (entity or relationship ID)
     * @param {string} status - Status ('invariant' or 'variant')
     * @param {string} source - Source of the axiom
     * @param {IDBTransaction} [existingTransaction] - Optional existing transaction
     * @returns {Promise<string>} - The axiom ID
     */
    async updateAxiomRecord(axiomId, status, source, existingTransaction = null) {
      await this.ensureDatabase();
      
      const executeUpdate = (resolve, reject, transaction) => {
        const axiomStore = transaction.objectStore(this.axiomStore);
        
        // Check if axiom record exists
        const getRequest = axiomStore.get(axiomId);
        
        getRequest.onsuccess = (event) => {
          const existingAxiom = event.target.result;
          const now = new Date().toISOString();
          
          if (existingAxiom) {
            // Update existing record
            const updatedAxiom = {
              ...existingAxiom,
              status: status === 'invariant' ? 'invariant' : existingAxiom.status, // Only allow promotions, not demotions
              lastUsed: now,
              usageCount: existingAxiom.usageCount + 1
            };
            
            axiomStore.put(updatedAxiom);
          } else {
            // Create new axiom record
            const newAxiom = {
              id: axiomId,
              status,
              source,
              usageCount: 1,
              created: now,
              lastUsed: now
            };
            
            axiomStore.add(newAxiom);
          }
          
          if (!existingTransaction) {
            resolve(axiomId);
          }
        };
        
        getRequest.onerror = (event) => {
          this.logger.error(`Error updating axiom: ${event.target.error}`);
          if (!existingTransaction) {
            reject(new Error(`Failed to update axiom: ${event.target.error}`));
          }
        };
      };
      
      // If transaction was provided, use it directly
      if (existingTransaction) {
        if (existingTransaction.objectStoreNames.contains(this.axiomStore)) {
          executeUpdate(null, null, existingTransaction);
          return axiomId;
        } else {
          // If the transaction doesn't include axiomStore, create a new transaction
          return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.axiomStore], 'readwrite');
            transaction.oncomplete = () => resolve(axiomId);
            transaction.onerror = (event) => reject(new Error(`Transaction error: ${event.target.error}`));
            
            executeUpdate(resolve, reject, transaction);
          });
        }
      } else {
        // Create a new transaction
        return new Promise((resolve, reject) => {
          const transaction = this.db.transaction([this.axiomStore], 'readwrite');
          transaction.oncomplete = () => resolve(axiomId);
          transaction.onerror = (event) => reject(new Error(`Transaction error: ${event.target.error}`));
          
          executeUpdate(resolve, reject, transaction);
        });
      }
    }
  
    /**
     * Retrieves an entity by ID
     * @param {string} entityId - The ID of the entity to retrieve
     * @returns {Promise<Object|null>} - The entity or null if not found
     */
    async retrieveEntity(entityId) {
      await this.ensureDatabase();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.entityStore], 'readonly');
        const entityStore = transaction.objectStore(this.entityStore);
        
        const request = entityStore.get(entityId);
        
        request.onsuccess = (event) => {
          const entity = event.target.result;
          if (entity) {
            this.logger.log(`Retrieved entity: ${entityId}`);
            // Record usage when entity is accessed
            this.updateAxiomRecord(entityId, entity.isInvariant ? 'invariant' : 'variant', entity.source || 'system')
              .catch(err => this.logger.warn('Could not update axiom usage', err));
          } else {
            this.logger.log(`Entity not found: ${entityId}`);
          }
          resolve(entity || null);
        };
        
        request.onerror = (event) => {
          this.logger.error(`Error retrieving entity: ${event.target.error}`);
          reject(new Error(`Failed to retrieve entity: ${event.target.error}`));
        };
      });
    }
  
    /**
     * Retrieves a relationship by ID
     * @param {string} relationshipId - The ID of the relationship to retrieve
     * @returns {Promise<Object|null>} - The relationship or null if not found
     */
    async retrieveRelationship(relationshipId) {
      await this.ensureDatabase();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.relationshipStore], 'readonly');
        const relationshipStore = transaction.objectStore(this.relationshipStore);
        
        const request = relationshipStore.get(relationshipId);
        
        request.onsuccess = (event) => {
          const relationship = event.target.result;
          if (relationship) {
            this.logger.log(`Retrieved relationship: ${relationshipId}`);
            // Record usage when relationship is accessed
            this.updateAxiomRecord(relationshipId, relationship.isInvariant ? 'invariant' : 'variant', relationship.source || 'system')
              .catch(err => this.logger.warn('Could not update axiom usage', err));
          } else {
            this.logger.log(`Relationship not found: ${relationshipId}`);
          }
          resolve(relationship || null);
        };
        
        request.onerror = (event) => {
          this.logger.error(`Error retrieving relationship: ${event.target.error}`);
          reject(new Error(`Failed to retrieve relationship: ${event.target.error}`));
        };
      });
    }
  
    /**
     * Searches for entities matching a query
     * @param {Object} query - The search query
     * @param {Object} options - Search options (limit, prioritize invariant, etc.)
     * @returns {Promise<Array>} - Matching entities
     */
    async searchEntities(query, options = {}) {
      await this.ensureDatabase();
      
      const defaultOptions = {
        limit: 20,
        offset: 0,
        prioritizeInvariant: true,
        includeVariant: true, // Whether to include variant axioms in results
        sortBy: 'relevance', // 'relevance', 'dateCreated', 'dateModified'
        sortDirection: 'desc' // 'asc' or 'desc'
      };
      
      const opts = { ...defaultOptions, ...options };
      
      // Process different types of queries
      if (typeof query === 'string') {
        // Text search
        return this.searchEntitiesByText(query, opts);
      } else if (query['@type']) {
        // Type-based search
        return this.searchEntitiesByType(query['@type'], opts);
      } else if (Object.keys(query).length === 0) {
        // Empty query - return most recent entities
        return this.getRecentEntities(opts);
      } else {
        // Property-based search
        return this.searchEntitiesByProperties(query, opts);
      }
    }
  
    /**
     * Searches for entities by text
     * @private
     * @param {string} text - The search text
     * @param {Object} options - Search options
     * @returns {Promise<Array>} - Matching entities
     */
    async searchEntitiesByText(text, options) {
      const searchTerms = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
      
      if (searchTerms.length === 0) {
        return this.getRecentEntities(options);
      }
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.indexStore, this.entityStore, this.axiomStore], 'readonly');
        const indexStore = transaction.objectStore(this.indexStore);
        const entityStore = transaction.objectStore(this.entityStore);
        const axiomStore = transaction.objectStore(this.axiomStore);
        
        const termIndex = indexStore.index('term');
        const entityMatches = new Map(); // Map of entity IDs to match count
        
        // Function to process each search term
        const processSearchTerm = (termIndex, searchTerm) => {
          return new Promise(resolveTermSearch => {
            const range = IDBKeyRange.only(searchTerm);
            const request = termIndex.openCursor(range);
            
            request.onsuccess = (event) => {
              const cursor = event.target.result;
              if (cursor) {
                const indexEntry = cursor.value;
                
                // Add to entity matches or increment match count
                if (entityMatches.has(indexEntry.entityId)) {
                  entityMatches.set(
                    indexEntry.entityId, 
                    entityMatches.get(indexEntry.entityId) + 1
                  );
                } else {
                  entityMatches.set(indexEntry.entityId, 1);
                }
                
                cursor.continue();
              } else {
                resolveTermSearch();
              }
            };
            
            request.onerror = (event) => {
              this.logger.error(`Error in term search: ${event.target.error}`);
              resolveTermSearch();
            };
          });
        };
        
        // Process all search terms in parallel
        Promise.all(searchTerms.map(term => processSearchTerm(termIndex, term)))
          .then(async () => {
            // Get entities and their axiom status
            const results = [];
            const entityPromises = [];
            
            for (const [entityId, matchCount] of entityMatches.entries()) {
              entityPromises.push(
                new Promise(resolveEntity => {
                  // Get entity
                  const entityRequest = entityStore.get(entityId);
                  
                  entityRequest.onsuccess = (event) => {
                    const entity = event.target.result;
                    if (!entity) {
                      resolveEntity();
                      return;
                    }
                    
                    // Skip variant axioms if includeVariant is false
                    if (!options.includeVariant && !entity.isInvariant) {
                      resolveEntity();
                      return;
                    }
                    
                    // Get axiom record to check usage
                    const axiomRequest = axiomStore.get(entityId);
                    
                    axiomRequest.onsuccess = (event) => {
                      const axiom = event.target.result || { 
                        usageCount: 0, 
                        status: entity.isInvariant ? 'invariant' : 'variant' 
                      };
                      
                      results.push({
                        entity,
                        matchScore: matchCount / searchTerms.length,
                        usageCount: axiom.usageCount,
                        isInvariant: entity.isInvariant || axiom.status === 'invariant'
                      });
                      
                      resolveEntity();
                    };
                    
                    axiomRequest.onerror = () => resolveEntity();
                  };
                  
                  entityRequest.onerror = () => resolveEntity();
                })
              );
            }
            
            await Promise.all(entityPromises);
            
            // Sort results based on options
            if (options.prioritizeInvariant) {
              // Sort by invariant status first, then by match score
              results.sort((a, b) => {
                if (a.isInvariant !== b.isInvariant) {
                  return a.isInvariant ? -1 : 1;
                }
                return b.matchScore - a.matchScore;
              });
            } else if (options.sortBy === 'relevance') {
              // Sort by match score only
              results.sort((a, b) => b.matchScore - a.matchScore);
            } else if (options.sortBy === 'dateCreated' || options.sortBy === 'dateModified') {
              // Sort by date
              const field = options.sortBy;
              results.sort((a, b) => {
                const dateA = new Date(a.entity[field]);
                const dateB = new Date(b.entity[field]);
                return options.sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
              });
            }
            
            // Apply limit and offset
            const paginatedResults = results
              .slice(options.offset, options.offset + options.limit)
              .map(result => result.entity);
            
            resolve(paginatedResults);
          })
          .catch(error => {
            this.logger.error('Error in text search:', error);
            reject(error);
          });
      });
    }
  
    /**
     * Searches for entities by type
     * @private
     * @param {string|Array} types - The schema.org type(s) to search for
     * @param {Object} options - Search options
     * @returns {Promise<Array>} - Matching entities
     */
    async searchEntitiesByType(types, options) {
      await this.ensureDatabase();
      
      const typeArray = Array.isArray(types) ? types : [types];
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.entityStore], 'readonly');
        const entityStore = transaction.objectStore(this.entityStore);
        const typeIndex = entityStore.index('type');
        
        const results = [];
        let processedTypes = 0;
        
        // Process each type
        typeArray.forEach(type => {
          const request = typeIndex.openCursor(IDBKeyRange.only(type));
          
          request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              const entity = cursor.value;
              
              // Skip variant axioms if includeVariant is false
              if (!options.includeVariant && !entity.isInvariant) {
                cursor.continue();
                return;
              }
              
              results.push(entity);
              cursor.continue();
            } else {
              processedTypes++;
              
              if (processedTypes === typeArray.length) {
                // Sort and paginate results
                this.sortAndPaginateResults(results, options)
                  .then(finalResults => resolve(finalResults))
                  .catch(error => reject(error));
              }
            }
          };
          
          request.onerror = (event) => {
            this.logger.error(`Error in type search: ${event.target.error}`);
            processedTypes++;
            
            if (processedTypes === typeArray.length) {
              // Sort and paginate results even if some searches failed
              this.sortAndPaginateResults(results, options)
                .then(finalResults => resolve(finalResults))
                .catch(error => reject(error));
            }
          };
        });
      });
    }
  
    /**
     * Searches for entities by property values
     * @private
     * @param {Object} query - Property-value pairs to search for
     * @param {Object} options - Search options
     * @returns {Promise<Array>} - Matching entities
     */
    async searchEntitiesByProperties(query, options) {
      await this.ensureDatabase();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.entityStore], 'readonly');
        const entityStore = transaction.objectStore(this.entityStore);
        
        const request = entityStore.getAll();
        
        request.onsuccess = (event) => {
          let entities = event.target.result;
          
          // Filter entities based on property values
          Object.entries(query).forEach(([property, value]) => {
            entities = entities.filter(entity => {
              if (property === 'isInvariant') {
                return entity.isInvariant === value;
              }
              
              // Skip variant axioms if includeVariant is false
              if (!options.includeVariant && !entity.isInvariant) {
                return false;
              }
              
              if (entity[property] === undefined) {
                return false;
              }
              
              if (typeof value === 'string' && typeof entity[property] === 'string') {
                // Case-insensitive string comparison
                return entity[property].toLowerCase().includes(value.toLowerCase());
              }
              
              return entity[property] === value;
            });
          });
          
          // Sort and paginate results
          this.sortAndPaginateResults(entities, options)
            .then(finalResults => resolve(finalResults))
            .catch(error => reject(error));
        };
        
        request.onerror = (event) => {
          this.logger.error(`Error in property search: ${event.target.error}`);
          reject(new Error(`Failed to search by properties: ${event.target.error}`));
        };
      });
    }
  
    /**
     * Gets the most recent entities
     * @private
     * @param {Object} options - Search options
     * @returns {Promise<Array>} - Recent entities
     */
    async getRecentEntities(options) {
      await this.ensureDatabase();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.entityStore], 'readonly');
        const entityStore = transaction.objectStore(this.entityStore);
        const dateIndex = entityStore.index('dateModified');
        
        const request = dateIndex.openCursor(null, 'prev'); // Reverse order (newest first)
        const results = [];
        
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor && results.length < options.limit + options.offset) {
            const entity = cursor.value;
            
            // Skip variant axioms if includeVariant is false
            if (!options.includeVariant && !entity.isInvariant) {
              cursor.continue();
              return;
            }
            
            results.push(entity);
            cursor.continue();
          } else {
            // Apply offset and limit
            const finalResults = results.slice(options.offset, options.offset + options.limit);
            resolve(finalResults);
          }
        };
        
        request.onerror = (event) => {
          this.logger.error(`Error getting recent entities: ${event.target.error}`);
          reject(new Error(`Failed to get recent entities: ${event.target.error}`));
        };
      });
    }
  
    /**
     * Sorts and paginates search results
     * @private
     * @param {Array} results - Search results to process
     * @param {Object} options - Sort and pagination options
     * @returns {Promise<Array>} - Processed results
     */
    async sortAndPaginateResults(results, options) {
      // Sort results based on options
      if (options.prioritizeInvariant) {
        // Sort by invariant status first
        results.sort((a, b) => {
          if (a.isInvariant !== b.isInvariant) {
            return a.isInvariant ? -1 : 1;
          }
          
          // Then by specified sort field
          if (options.sortBy === 'dateCreated' || options.sortBy === 'dateModified') {
            const dateA = new Date(a[options.sortBy]);
            const dateB = new Date(b[options.sortBy]);
            return options.sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
          }
          
          return 0;
        });
      } else if (options.sortBy === 'dateCreated' || options.sortBy === 'dateModified') {
        // Sort by date only
        results.sort((a, b) => {
          const dateA = new Date(a[options.sortBy]);
          const dateB = new Date(b[options.sortBy]);
          return options.sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
        });
      }
      
      // Apply pagination
      return results.slice(options.offset, options.offset + options.limit);
    }
  
    /**
     * Updates axiom status (variant/invariant)
     * @param {string} axiomId - The axiom ID
     * @param {string} status - New status ('invariant' or 'variant')
     * @returns {Promise<boolean>} - Success indicator
     */
    async updateAxiomStatus(axiomId, status) {
      if (status !== 'invariant' && status !== 'variant') {
        throw new Error('Status must be either "invariant" or "variant"');
      }
      
      await this.ensureDatabase();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.axiomStore, this.entityStore, this.relationshipStore], 'readwrite');
        transaction.oncomplete = () => {
          this.logger.log(`Axiom ${axiomId} status updated to ${status}`);
          resolve(true);
        };
        
        transaction.onerror = (event) => {
          this.logger.error(`Error updating axiom status: ${event.target.error}`);
          reject(new Error(`Failed to update axiom status: ${event.target.error}`));
        };
        
        const axiomStore = transaction.objectStore(this.axiomStore);
        const entityStore = transaction.objectStore(this.entityStore);
        const relationshipStore = transaction.objectStore(this.relationshipStore);
        
        // First check if axiom record exists
        const getAxiomRequest = axiomStore.get(axiomId);
        
        getAxiomRequest.onsuccess = (event) => {
          const axiom = event.target.result;
          
          if (axiom) {
            // Update axiom record
            axiom.status = status;
            axiom.lastUsed = new Date().toISOString();
            axiomStore.put(axiom);
            
            // Now update the entity or relationship
            // First try entity store
            const getEntityRequest = entityStore.get(axiomId);
            
            getEntityRequest.onsuccess = (event) => {
              const entity = event.target.result;
              
              if (entity) {
                // Update entity's invariant status
                entity.isInvariant = (status === 'invariant');
                entityStore.put(entity);
              } else {
                // Try relationship store
                const getRelationshipRequest = relationshipStore.get(axiomId);
                
                getRelationshipRequest.onsuccess = (event) => {
                  const relationship = event.target.result;
                  
                  if (relationship) {
                    // Update relationship's invariant status
                    relationship.isInvariant = (status === 'invariant');
                    relationshipStore.put(relationship);
                  } else {
                    this.logger.warn(`Axiom ${axiomId} exists but no matching entity or relationship found`);
                  }
                };
              }
            };
          } else {
            // Axiom doesn't exist, create it
            const newAxiom = {
              id: axiomId,
              status,
              usageCount: 1,
              created: new Date().toISOString(),
              lastUsed: new Date().toISOString(),
              source: 'system'
            };
            
            axiomStore.add(newAxiom);
            
            // Try to update entity or relationship
            const getEntityRequest = entityStore.get(axiomId);
            
            getEntityRequest.onsuccess = (event) => {
              const entity = event.target.result;
              
              if (entity) {
                entity.isInvariant = (status === 'invariant');
                entityStore.put(entity);
              } else {
                // Try relationship store
                const getRelationshipRequest = relationshipStore.get(axiomId);
                
                getRelationshipRequest.onsuccess = (event) => {
                  const relationship = event.target.result;
                  
                  if (relationship) {
                    relationship.isInvariant = (status === 'invariant');
                    relationshipStore.put(relationship);
                  } else {
                    this.logger.warn(`Creating axiom ${axiomId} but no matching entity or relationship found`);
                  }
                };
              }
            };
          }
        };
      });
    }
  
    /**
     * Retrieves all relationships for an entity
     * @param {string} entityId - The entity ID
     * @returns {Promise<Array>} - Array of relationships
     */
    async getEntityRelationships(entityId) {
      await this.ensureDatabase();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.relationshipStore], 'readonly');
        const relationshipStore = transaction.objectStore(this.relationshipStore);
        
        // Find relationships where the entity is source or target
        const sourceIndex = relationshipStore.index('sourceEntityId');
        const targetIndex = relationshipStore.index('targetEntityId');
        
        const relationships = [];
        let queriesCompleted = 0;
        
        // Get relationships where entity is source
        const sourceRequest = sourceIndex.openCursor(IDBKeyRange.only(entityId));
        
        sourceRequest.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            relationships.push({
              ...cursor.value,
              direction: 'outgoing'
            });
            cursor.continue();
          } else {
            queriesCompleted++;
            if (queriesCompleted === 2) {
              resolve(relationships);
            }
          }
        };
        
        sourceRequest.onerror = (event) => {
          this.logger.error(`Error retrieving source relationships: ${event.target.error}`);
          reject(new Error(`Failed to retrieve source relationships: ${event.target.error}`));
        };
        
        // Get relationships where entity is target
        const targetRequest = targetIndex.openCursor(IDBKeyRange.only(entityId));
        
        targetRequest.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            relationships.push({
              ...cursor.value,
              direction: 'incoming'
            });
            cursor.continue();
          } else {
            queriesCompleted++;
            if (queriesCompleted === 2) {
              resolve(relationships);
            }
          }
        };
        
        targetRequest.onerror = (event) => {
          this.logger.error(`Error retrieving target relationships: ${event.target.error}`);
          reject(new Error(`Failed to retrieve target relationships: ${event.target.error}`));
        };
      });
    }
  
    /**
     * Retrieves connected entities for an entity
     * @param {string} entityId - The entity ID
     * @param {Object} options - Options for retrieval
     * @returns {Promise<Array>} - Array of connected entities with their relationships
     */
    async getConnectedEntities(entityId, options = {}) {
      const defaultOptions = {
        direction: 'both', // 'outgoing', 'incoming', or 'both'
        depth: 1, // How many levels to traverse
        relationTypes: [], // Empty array means all types
        includeVariant: true
      };
      
      const opts = { ...defaultOptions, ...options };
      
      // Get relationships
      const relationships = await this.getEntityRelationships(entityId);
      
      // Filter by direction and relation type
      const filteredRelationships = relationships.filter(rel => {
        // Direction filter
        if (opts.direction !== 'both' && rel.direction !== opts.direction) {
          return false;
        }
        
        // Relation type filter
        if (opts.relationTypes.length > 0 && !opts.relationTypes.includes(rel.relationType)) {
          return false;
        }
        
        // Variant/invariant filter
        if (!opts.includeVariant && !rel.isInvariant) {
          return false;
        }
        
        return true;
      });
      
      // Get connected entities
      const connectedEntities = [];
      
      for (const rel of filteredRelationships) {
        const connectedEntityId = rel.direction === 'outgoing' ? rel.targetEntityId : rel.sourceEntityId;
        const entity = await this.retrieveEntity(connectedEntityId);
        
        if (entity) {
          connectedEntities.push({
            entity,
            relationship: rel
          });
        }
      }
      
      // If depth > 1, recursively get more connections
      if (opts.depth > 1 && connectedEntities.length > 0) {
        const nextLevelEntities = [];
        
        for (const { entity } of connectedEntities) {
          const nextOpts = { ...opts, depth: opts.depth - 1 };
          const nextConnections = await this.getConnectedEntities(entity.id, nextOpts);
          
          nextLevelEntities.push(...nextConnections);
        }
        
        // Add next level entities
        connectedEntities.push(...nextLevelEntities);
      }
      
      return connectedEntities;
    }
  
    /**
     * Gets axiom usage statistics
     * @param {string} axiomId - The axiom ID
     * @returns {Promise<Object|null>} - Axiom usage data or null if not found
     */
    async getAxiomUsage(axiomId) {
      await this.ensureDatabase();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.axiomStore], 'readonly');
        const axiomStore = transaction.objectStore(this.axiomStore);
        
        const request = axiomStore.get(axiomId);
        
        request.onsuccess = (event) => {
          const axiom = event.target.result;
          resolve(axiom || null);
        };
        
        request.onerror = (event) => {
          this.logger.error(`Error retrieving axiom usage: ${event.target.error}`);
          reject(new Error(`Failed to retrieve axiom usage: ${event.target.error}`));
        };
      });
    }
  
    /**
     * Generates a unique ID for entities or relationships
     * @private
     * @param {string} prefix - Prefix for the ID ('entity' or 'relationship')
     * @returns {string} - A unique ID
     */
    generateId(prefix) {
      return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }
  
    /**
     * Closes the database connection
     * @returns {Promise<void>}
     */
    async closeDatabase() {
      if (this.db) {
        this.db.close();
        this.db = null;
        this.isInitialized = false;
        this.logger.log('Database connection closed');
      }
    }
  }
  
  export default SchemaDatabase;