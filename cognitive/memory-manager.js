/**
 * Memory Manager manages the working memory of the bot
 * Handles memory hierarchy with promotion mechanisms for axioms
 * Works like a CPU cache system with different memory levels
 */
export default class MemoryManager {
    constructor(knowledgeGraph, schemaDatabase) {
      this.knowledgeGraph = knowledgeGraph;
      this.schemaDatabase = schemaDatabase;
      this.workingMemory = new Map(); // In-memory recent/active entities
      this.attentionWeights = new Map(); // Maps entity IDs to attention weights
      this.promotionThresholds = {
        usageCount: 3, // Number of uses before promotion
        timeSinceLastUse: 1000 * 60 * 60 * 24 // 24 hours
      };
      this.logger = console;
      this.lastDecayTime = Date.now();
    }
    
    /**
     * Gets the current working memory context
     * @param {Object} queryContext - Query context information
     * @param {Object} options - Additional options
     * @returns {Promise<Array>} - The working memory entities
     */
    async getWorkingMemoryContext(queryContext, options = {}) {
      this.logger.log("Getting working memory context for query");
      
      // Set defaults for options
      const contextType = options.contextType || 'general';
      const kernelLimit = options.kernelLimit || 20;
      const relevanceThreshold = options.relevanceThreshold || 0.2;
      const includePersonal = options.includePersonal !== undefined ? options.includePersonal : true;
      
      try {
        // Get entities in working memory
        const workingMemoryEntities = Array.from(this.workingMemory.entries())
          .map(([id, data]) => ({
            id,
            entity: data.entity,
            relevanceScore: data.relevance,
            lastAccessed: data.lastAccessed
          }));
        
        this.logger.log(`Found ${workingMemoryEntities.length} entities in working memory`);
        
        // Get additional relevant entities from knowledge graph based on query
        const relevantEntities = await this.knowledgeGraph.retrieveRelevantEntities(
          queryContext, 
          {
            contextType,
            limit: kernelLimit - workingMemoryEntities.length,
            threshold: relevanceThreshold
          }
        );
        
        // Merge working memory and additional relevant entities
        let mergedEntities = [...workingMemoryEntities];
        
        // Add only those relevant entities that aren't already in working memory
        for (const entity of relevantEntities) {
          if (!this.workingMemory.has(entity.id)) {
            mergedEntities.push(entity);
            
            // Add to working memory with the retrieved relevance
            this.addToWorkingMemory(entity.id, entity.entity, entity.relevanceScore);
          }
        }
        
        // Apply context-based filtering
        let filteredEntities = await this.filterByContextRelevance(
          mergedEntities, 
          contextType
        );
        
        // Exclude personal info if requested
        if (!includePersonal) {
          filteredEntities = filteredEntities.filter(entity => 
            !(entity.entity && entity.entity['@type'] === 'Person')
          );
        }
        
        // Sort by relevance
        filteredEntities.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
        
        // Limit to requested number of entities
        const workingMemoryContext = filteredEntities.slice(0, kernelLimit);
        
        this.logger.log(`Working memory context contains ${workingMemoryContext.length} entities`);
        return workingMemoryContext;
      } catch (error) {
        this.logger.error(`Error getting working memory context: ${error.message}`);
        return [];
      }
    }
    
    /**
     * Adds an entity to working memory
     * @param {string} entityId - Entity ID to add
     * @param {Object} entity - The entity object
     * @param {number} relevance - Relevance score (0-1)
     * @returns {boolean} - Success indicator
     */
    addToWorkingMemory(entityId, entity, relevance = 0.5) {
      if (!entityId || !entity) {
        this.logger.warn("Attempted to add invalid entity to working memory");
        return false;
      }
      
      // If entity is already in working memory, update relevance and timestamp
      if (this.workingMemory.has(entityId)) {
        const existingData = this.workingMemory.get(entityId);
        this.workingMemory.set(entityId, {
          entity,
          relevance: Math.max(existingData.relevance, relevance),
          usageCount: existingData.usageCount + 1,
          lastAccessed: Date.now(),
          firstAccessed: existingData.firstAccessed
        });
        
        this.logger.log(`Updated existing entity in working memory: ${entityId}`);
      } else {
        // Add new entity to working memory
        this.workingMemory.set(entityId, {
          entity,
          relevance,
          usageCount: 1,
          lastAccessed: Date.now(),
          firstAccessed: Date.now()
        });
        
        this.logger.log(`Added new entity to working memory: ${entityId}`);
      }
      
      // Update attention weight
      this.attentionWeights.set(entityId, {
        weight: relevance,
        timestamp: Date.now()
      });
      
      return true;
    }
    
    /**
     * Records usage of an axiom and potentially promotes it
     * @param {string} axiomId - The axiom ID
     * @returns {Promise<Object>} - Updated axiom status
     */
    async recordAxiomUsage(axiomId) {
      try {
        // Get current axiom data
        const axiom = await this.schemaDatabase.getAxiom(axiomId);
        
        if (!axiom) {
          this.logger.warn(`Axiom ${axiomId} not found`);
          return { success: false, message: "Axiom not found" };
        }
        
        // Update usage count and last used timestamp
        axiom.usageCount = (axiom.usageCount || 0) + 1;
        axiom.lastUsed = Date.now();
        
        // Check if axiom should be promoted
        const shouldPromote = this.shouldPromoteAxiom(axiom);
        
        if (shouldPromote && axiom.status !== 'invariant') {
          // Promote axiom to invariant
          await this.schemaDatabase.updateAxiomStatus(axiomId, 'invariant');
          
          this.logger.log(`Promoted axiom ${axiomId} to invariant status`);
          return { 
            success: true, 
            promoted: true, 
            message: "Axiom was promoted to invariant status" 
          };
        } else {
          // Just update usage data
          await this.schemaDatabase.updateAxiomUsage(axiomId, axiom.usageCount, axiom.lastUsed);
          
          return { 
            success: true, 
            promoted: false, 
            message: "Axiom usage recorded" 
          };
        }
      } catch (error) {
        this.logger.error(`Error recording axiom usage: ${error.message}`);
        return { success: false, message: error.message };
      }
    }
    
    /**
     * Evaluates whether an axiom should be promoted
     * @param {Object} axiom - Axiom data
     * @returns {boolean} - True if should be promoted
     */
    shouldPromoteAxiom(axiom) {
      // Don't promote if already invariant
      if (axiom.status === 'invariant') {
        return false;
      }
      
      // Check usage count threshold
      const hasEnoughUsage = axiom.usageCount >= this.promotionThresholds.usageCount;
      
      // Check if it's been used recently enough
      const recentEnough = axiom.lastUsed && 
        (Date.now() - axiom.lastUsed) < this.promotionThresholds.timeSinceLastUse;
      
      // Check consistency - axioms with high confidence from reliable sources
      // are more likely to be promoted
      const isReliable = axiom.confidence > 0.8 || axiom.source === 'system';
      
      // Time factor - axioms that have existed for a long time are more trusted
      const isEstablished = axiom.firstCreated && 
        (Date.now() - axiom.firstCreated) > (this.promotionThresholds.timeSinceLastUse * 3);
      
      // Combination of factors determines promotion eligibility
      return (hasEnoughUsage && recentEnough) || (isReliable && isEstablished);
    }
    
    /**
     * Decays attention on entities not recently accessed
     * @param {number} decayRate - Rate of decay (0-1)
     * @returns {number} - Number of entities affected
     */
    decayAttentionWeights(decayRate = 0.1) {
      try {
        // Validate decay rate
        if (decayRate < 0 || decayRate > 1) {
          throw new Error('Decay rate must be between 0 and 1');
        }
        
        const now = Date.now();
        const timeSinceLastDecay = (now - this.lastDecayTime) / 1000; // in seconds
        
        // Only apply decay if significant time has passed (more than 5 seconds)
        if (timeSinceLastDecay < 5) {
          return 0;
        }
        
        this.logger.log(`Applying attention decay with rate ${decayRate} after ${timeSinceLastDecay.toFixed(1)}s`);
        
        // Calculate time-based decay factor
        // The longer the time, the more decay is applied
        const timeDecayFactor = Math.min(1.0, timeSinceLastDecay / 3600); // Max effect after 1 hour
        const effectiveDecayRate = decayRate * timeDecayFactor;
        
        let affectedCount = 0;
        
        // Apply decay to all attention values
        for (const [entityId, attentionData] of this.attentionWeights.entries()) {
          // Calculate time-since-update for this specific entity
          const entityTimeSinceUpdate = (now - attentionData.timestamp) / 1000; // in seconds
          
          // Skip very recent updates (less than 5 seconds)
          if (entityTimeSinceUpdate < 5) continue;
          
          // Calculate individual decay factor based on time since this entity was updated
          const entityDecayFactor = Math.min(1.0, entityTimeSinceUpdate / 3600);
          const entityDecayRate = decayRate * entityDecayFactor;
          
          // Apply exponential decay formula: A(t) = A₀ * (1 - decayRate*t)
          let newAttention = attentionData.weight * (1 - entityDecayRate);
          
          // Ensure it doesn't go below a minimum threshold (0.1)
          newAttention = Math.max(0.1, newAttention);
          
          // Update the attention weight
          this.attentionWeights.set(entityId, {
            weight: newAttention,
            timestamp: now
          });
          
          // Also update working memory if the entity is there
          if (this.workingMemory.has(entityId)) {
            const memoryData = this.workingMemory.get(entityId);
            memoryData.relevance = newAttention;
            this.workingMemory.set(entityId, memoryData);
          }
          
          affectedCount++;
        }
        
        // Update decay tracking
        this.lastDecayTime = now;
        
        // Clean up working memory - remove entries with very low attention
        this.cleanupWorkingMemory();
        
        this.logger.log(`Decayed attention for ${affectedCount} entities`);
        return affectedCount;
      } catch (error) {
        this.logger.error(`Error in decayAttentionWeights: ${error.message}`);
        return 0;
      }
    }
    
    /**
     * Remove low-attention entities from working memory
     */
    cleanupWorkingMemory() {
      const now = Date.now();
      const recentThreshold = 5 * 60 * 1000; // 5 minutes
      const relevanceThreshold = 0.2;
      
      // Identify entities to remove
      const entitiesToRemove = [];
      
      for (const [entityId, data] of this.workingMemory.entries()) {
        const isOld = (now - data.lastAccessed) > recentThreshold;
        const hasLowRelevance = data.relevance < relevanceThreshold;
        
        if (isOld && hasLowRelevance) {
          entitiesToRemove.push(entityId);
        }
      }
      
      // Remove the identified entities
      for (const entityId of entitiesToRemove) {
        this.workingMemory.delete(entityId);
      }
      
      if (entitiesToRemove.length > 0) {
        this.logger.log(`Removed ${entitiesToRemove.length} low-relevance entities from working memory`);
      }
    }
    
    /**
     * Filters entities based on context relevance
     * @param {Array} entities - The entities to filter
     * @param {string} contextType - The context type
     * @returns {Promise<Array>} - The filtered entities
     */
    async filterByContextRelevance(entities, contextType) {
      this.logger.log(`Filtering ${entities.length} entities by ${contextType} context relevance`);
      
      if (!entities || entities.length === 0) {
        return [];
      }
      
      try {
        let filteredEntities = [...entities];
        
        switch (contextType) {
          case 'personal':
            // Boost Person entities and related information
            filteredEntities = filteredEntities.map(entity => {
              const entityObj = entity.entity || entity;
              
              // Boost Person schemas
              if (entityObj['@type'] === 'Person') {
                return {
                  ...entity,
                  relevanceScore: (entity.relevanceScore || 0.5) * 2.0
                };
              }
              
              // Boost entities related to Person
              if (entityObj.relatedTo && entityObj.relatedTo.some(rel => rel.type === 'Person')) {
                return {
                  ...entity,
                  relevanceScore: (entity.relevanceScore || 0.5) * 1.5
                };
              }
              
              return entity;
            });
            break;
            
          case 'domain':
            // Boost domain-specific entities
            filteredEntities = filteredEntities.map(entity => {
              const entityObj = entity.entity || entity;
              
              // Check for domain keywords in entity content
              const domainKeywords = ['knowledge', 'semantic', 'schema', 'entity', 
                                      'property', 'relationship', 'graph'];
              
              // Get entity text content for keyword matching
              let entityContent = '';
              if (entityObj.name) entityContent += entityObj.name + ' ';
              if (entityObj.description) entityContent += entityObj.description + ' ';
              
              // Additional properties that might contain text
              ['text', 'content', 'title', 'about'].forEach(prop => {
                if (entityObj[prop]) entityContent += entityObj[prop] + ' ';
              });
              
              // Check if content contains domain keywords
              const keywordFound = domainKeywords.some(keyword => 
                entityContent.toLowerCase().includes(keyword.toLowerCase())
              );
              
              if (keywordFound) {
                return {
                  ...entity,
                  relevanceScore: (entity.relevanceScore || 0.5) * 1.8
                };
              }
              
              return entity;
            });
            break;
            
          default:
            // No special filtering for general context
            break;
        }
        
        // Re-sort by adjusted relevance score
        filteredEntities.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
        
        this.logger.log(`Context-filtered to ${filteredEntities.length} entities`);
        return filteredEntities;
      } catch (error) {
        this.logger.error(`Error filtering by context relevance: ${error.message}`);
        return entities; // Return original entities on error
      }
    }
    
    /**
     * Merges information from multiple sources with conflict resolution
     * @param {Array} entities - Entities to merge
     * @returns {Promise<Array>} - Merged entities
     */
    async mergeEntityInformation(entities) {
      if (!entities || entities.length === 0) {
        return [];
      }
      
      this.logger.log(`Merging information from ${entities.length} entities`);
      
      // Group entities by ID
      const entityGroups = new Map();
      
      for (const entity of entities) {
        const id = entity.id || entity['@id'];
        if (!id) continue;
        
        if (!entityGroups.has(id)) {
          entityGroups.set(id, []);
        }
        
        entityGroups.get(id).push(entity);
      }
      
      // Process each group
      const mergedEntities = [];
      
      for (const [id, group] of entityGroups.entries()) {
        if (group.length === 1) {
          // No need to merge
          mergedEntities.push(group[0]);
          continue;
        }
        
        // Sort by confidence and recency
        group.sort((a, b) => {
          // First by confidence if available
          const confA = a.confidence || 0;
          const confB = b.confidence || 0;
          
          if (confA !== confB) {
            return confB - confA;
          }
          
          // Then by timestamp if available
          const timeA = a.timestamp || 0;
          const timeB = b.timestamp || 0;
          
          return timeB - timeA;
        });
        
        // Take highest confidence/latest entity as base
        const baseEntity = { ...group[0] };
        
        // Merge properties from other entities
        for (let i = 1; i < group.length; i++) {
          const entity = group[i];
          
          for (const [key, value] of Object.entries(entity)) {
            // Skip ID and metadata fields
            if (['id', '@id', 'confidence', 'timestamp', '@type', 'type'].includes(key)) {
              continue;
            }
            
            // If property doesn't exist in base, add it
            if (baseEntity[key] === undefined) {
              baseEntity[key] = value;
              continue;
            }
            
            // For arrays, merge unique values
            if (Array.isArray(baseEntity[key]) && Array.isArray(value)) {
              // Add values not already in base
              for (const item of value) {
                // Check if item is an object
                if (typeof item === 'object' && item !== null) {
                  // For objects, check by id or similarity
                  const exists = baseEntity[key].some(existing => 
                    (existing.id && existing.id === item.id) || 
                    JSON.stringify(existing) === JSON.stringify(item)
                  );
                  
                  if (!exists) {
                    baseEntity[key].push(item);
                  }
                } 
                // For primitives, check direct equality
                else if (!baseEntity[key].includes(item)) {
                  baseEntity[key].push(item);
                }
              }
            }
            // For objects, recursively merge
            else if (typeof baseEntity[key] === 'object' && typeof value === 'object' &&
                     baseEntity[key] !== null && value !== null) {
              baseEntity[key] = await this.mergeObjects(baseEntity[key], value);
            }
            // For primitives, keep base value (already sorted by confidence)
          }
        }
        
        mergedEntities.push(baseEntity);
      }
      
      this.logger.log(`Merged into ${mergedEntities.length} entities`);
      return mergedEntities;
    }
    
    /**
     * Helper function to recursively merge objects
     * @param {Object} base - Base object
     * @param {Object} overlay - Overlay object
     * @returns {Object} - Merged object
     */
    async mergeObjects(base, overlay) {
      const result = { ...base };
      
      for (const [key, value] of Object.entries(overlay)) {
        // If property doesn't exist in base, add it
        if (result[key] === undefined) {
          result[key] = value;
          continue;
        }
        
        // For arrays, merge unique values
        if (Array.isArray(result[key]) && Array.isArray(value)) {
          for (const item of value) {
            if (!result[key].some(existing => 
              JSON.stringify(existing) === JSON.stringify(item))) {
              result[key].push(item);
            }
          }
        }
        // For objects, recursively merge
        else if (typeof result[key] === 'object' && typeof value === 'object' &&
                 result[key] !== null && value !== null) {
          result[key] = await this.mergeObjects(result[key], value);
        }
        // For primitives, keep base value
      }
      
      return result;
    }
    
    /**
     * Gets the top entities by attention weight
     * @param {number} limit - Maximum number to return
     * @returns {Array} - Top entities by attention
     */
    getTopAttendedEntities(limit = 5) {
      // Sort entities by attention weight
      const sortedEntities = Array.from(this.attentionWeights.entries())
        .sort((a, b) => b[1].weight - a[1].weight)
        .slice(0, limit);
      
      // Retrieve full entity data for the top entities
      const results = [];
      
      for (const [entityId, attentionData] of sortedEntities) {
        if (this.workingMemory.has(entityId)) {
          const memoryData = this.workingMemory.get(entityId);
          results.push({
            id: entityId,
            entity: memoryData.entity,
            attention: attentionData.weight,
            lastUpdated: attentionData.timestamp
          });
        }
      }
      
      return results;
    }
    
    /**
     * Clears working memory (for testing or reset)
     */
    clearWorkingMemory() {
      this.workingMemory.clear();
      this.attentionWeights.clear();
      this.lastDecayTime = Date.now();
      this.logger.log("Working memory cleared");
    }
  }