// cognitive/attention-weights.js
// Implements attention mechanism using UOR relationship weights

/**
 * AttentionWeights class implements a cognitive attention mechanism that 
 * adjusts UOR relationship weights to prioritize important information
 */
class AttentionWeights {
  /**
   * Constructor initializes the attention mechanism
   * @param {Object} uorCortex - Reference to the UOR Cortex for knowledge access
   */
  constructor(uorCortex) {
    this.uorCortex = uorCortex;
    this.logger = console; // Logger (can be replaced with a custom one)
    this.attentionMap = new Map(); // Maps kernel references to attention levels
    this.lastUpdateTime = Date.now(); // Track when attention was last updated
    this.contextAttentionBoosts = {
      'personal': 1.5,     // Personal information gets higher attention
      'domain': 1.2,       // Domain-specific information gets medium boost
      'conversation': 1.1, // Conversation flow gets slight boost
      'general': 1.0       // General information gets no boost
    };
    
    this.logger.log("AttentionWeights initialized");
  }

  /**
   * Apply attention level to a specific kernel
   * @param {string} kernelRef - Reference to the kernel
   * @param {number} attentionLevel - Level of attention (0.0 - 1.0)
   * @returns {boolean} Success indicator
   */
  applyAttentionToKernel(kernelRef, attentionLevel) {
    try {
      // Validate inputs
      if (!kernelRef || typeof attentionLevel !== 'number') {
        throw new Error('Invalid kernel reference or attention level');
      }
      
      attentionLevel = Math.max(0, Math.min(1, attentionLevel)); // Clamp between 0 and 1
      
      this.logger.log(`Applying attention level ${attentionLevel} to kernel ${kernelRef}`);
      
      // Store the attention level
      this.attentionMap.set(kernelRef, {
        level: attentionLevel,
        timestamp: Date.now()
      });
      
      // Attempt to update the kernel's cognitive metadata with attention
      try {
        const metadata = {
          attention: attentionLevel,
          lastAttentionUpdate: Date.now()
        };
        
        this.uorCortex.updateKernelCognitiveMetadata(kernelRef, metadata);
      } catch (metadataError) {
        this.logger.warn(`Could not update kernel metadata: ${metadataError.message}`);
        // Continue even if metadata update fails - we still have the attention map
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Error in applyAttentionToKernel: ${error.message}`);
      return false;
    }
  }

  /**
   * Distribute attention across relationships from a source kernel
   * @param {string} sourceKernelRef - Reference to the source kernel
   * @param {number} initialAttention - Initial attention level (default: 1.0)
   * @param {number} decayFactor - How quickly attention decays (default: 0.5)
   * @returns {Array} List of kernels and their new attention levels
   */
  distributeAttentionAcrossRelationships(sourceKernelRef, initialAttention = 1.0, decayFactor = 0.5) {
    try {
      this.logger.log(`Distributing attention from kernel ${sourceKernelRef}`);
      
      // Apply initial attention to source
      this.applyAttentionToKernel(sourceKernelRef, initialAttention);
      
      // Get the kernel from the UOR Cortex
      const sourceKernel = this.uorCortex.retrieveObject(sourceKernelRef);
      
      if (!sourceKernel || !sourceKernel.relationships) {
        this.logger.warn(`No relationships found for kernel ${sourceKernelRef}`);
        return [];
      }
      
      const results = [];
      
      // Distribute attention to related kernels (breadth-first, one level)
      for (const relationship of sourceKernel.relationships) {
        const targetKernelRef = relationship.targetKernelRef;
        
        // Calculate decayed attention level for this relationship
        // Factors that influence the attention:
        // 1. The strength/weight of the relationship
        // 2. The decay factor (attention diminishes with distance)
        // 3. Relationship type (some relationships carry more attention)
        
        let relationshipWeight = relationship.weight || 1.0;
        
        // Adjust weight based on relationship type
        const relationshipFactors = {
          'participatesIn': 1.3,  // Strong connection
          'mentions': 1.2,        // Direct reference
          'isAbout': 1.2,         // Topical relevance
          'contains': 1.1,        // Part-whole relationship
          'relates_to': 1.0,      // Generic relationship
          'requires': 1.1         // Dependency relationship
        };
        
        const relationshipFactor = relationshipFactors[relationship.relationshipType] || 1.0;
        relationshipWeight *= relationshipFactor;
        
        // Calculate new attention level for target, applying decay
        const targetAttention = initialAttention * relationshipWeight * decayFactor;
        
        // Apply attention to related kernel
        this.applyAttentionToKernel(targetKernelRef, targetAttention);
        
        results.push({
          kernelRef: targetKernelRef,
          attentionLevel: targetAttention,
          relationshipType: relationship.relationshipType
        });
      }
      
      this.logger.log(`Distributed attention to ${results.length} related kernels`);
      return results;
    } catch (error) {
      this.logger.error(`Error in distributeAttentionAcrossRelationships: ${error.message}`);
      return [];
    }
  }

  /**
   * Boost attention for kernels related to a specific context type
   * @param {string} contextType - Type of context to boost ('personal', 'domain', etc.)
   * @returns {number} Number of kernels affected
   */
  boostAttentionForContext(contextType) {
    try {
      this.logger.log(`Boosting attention for context: ${contextType}`);
      
      if (!this.contextAttentionBoosts[contextType]) {
        this.logger.warn(`Unknown context type: ${contextType}, defaulting to general`);
        contextType = 'general';
      }
      
      const boostFactor = this.contextAttentionBoosts[contextType];
      let affectedCount = 0;
      
      // Find relevant kernels for this context type
      let relevantKernels = [];
      
      // Get all kernels
      const allKernels = this.uorCortex.getAllKernels();
      
      // Filter based on context type
      switch (contextType) {
        case 'personal':
          // Boost Person kernels
          relevantKernels = allKernels.filter(k => 
            k.data && k.data.schemaType === 'Person'
          );
          break;
          
        case 'domain':
          // Boost kernels with domain-specific titles or content
          const domainKeywords = [
            'UOR', 'framework', 'lattice', 'kernel', 
            'context', 'traversal', 'semantic'
          ];
          
          relevantKernels = allKernels.filter(k => {
            if (!k.data) return false;
            
            // Check title and content for domain keywords
            const title = k.data.title || '';
            const content = k.data.content || '';
            
            return domainKeywords.some(keyword => 
              title.includes(keyword) || content.includes(keyword)
            );
          });
          break;
          
        case 'conversation':
          // Boost conversation kernels
          relevantKernels = allKernels.filter(k => 
            k.data && k.data.schemaType === 'Conversation'
          );
          
          // Also boost recent Question kernels
          const recentQuestions = allKernels.filter(k => 
            k.data && k.data.schemaType === 'Question' && 
            k.data.timestamp && 
            (Date.now() - k.data.timestamp < 5 * 60 * 1000) // Questions from last 5 minutes
          );
          
          relevantKernels = [...relevantKernels, ...recentQuestions];
          break;
          
        default:
          // For 'general' or unknown context, do nothing special
          relevantKernels = [];
      }
      
      // Apply boost to all relevant kernels
      for (const kernel of relevantKernels) {
        if (!kernel.reference) continue;
        
        // Get current attention or default to 0.5
        const currentAttention = this.attentionMap.get(kernel.reference)?.level || 0.5;
        
        // Apply boost (capped at 1.0)
        const boostedAttention = Math.min(1.0, currentAttention * boostFactor);
        
        this.applyAttentionToKernel(kernel.reference, boostedAttention);
        affectedCount++;
      }
      
      this.logger.log(`Boosted attention for ${affectedCount} kernels related to ${contextType} context`);
      return affectedCount;
    } catch (error) {
      this.logger.error(`Error in boostAttentionForContext: ${error.message}`);
      return 0;
    }
  }

  /**
   * Decay attention values over time to model cognitive decay
   * @param {number} decayRate - Rate at which attention decays (0.0 - 1.0, default: 0.1)
   * @returns {number} Number of kernels affected
   */
  decayAttentionOverTime(decayRate = 0.1) {
    try {
      // Validate decay rate
      if (decayRate < 0 || decayRate > 1) {
        throw new Error('Decay rate must be between 0 and 1');
      }
      
      const now = Date.now();
      const timeSinceLastUpdate = (now - this.lastUpdateTime) / 1000; // in seconds
      
      // Only apply decay if significant time has passed (more than 5 seconds)
      if (timeSinceLastUpdate < 5) {
        return 0;
      }
      
      this.logger.log(`Applying attention decay with rate ${decayRate} after ${timeSinceLastUpdate.toFixed(1)}s`);
      
      // Calculate time-based decay factor
      // The longer the time, the more decay is applied
      const timeDecayFactor = Math.min(1.0, timeSinceLastUpdate / 3600); // Max effect after 1 hour
      const effectiveDecayRate = decayRate * timeDecayFactor;
      
      let affectedCount = 0;
      
      // Apply decay to all attention values
      for (const [kernelRef, attentionData] of this.attentionMap.entries()) {
        // Calculate time-since-update for this specific kernel
        const kernelTimeSinceUpdate = (now - attentionData.timestamp) / 1000; // in seconds
        
        // Skip very recent updates (less than 5 seconds)
        if (kernelTimeSinceUpdate < 5) continue;
        
        // Calculate individual decay factor based on time since this kernel was updated
        const kernelDecayFactor = Math.min(1.0, kernelTimeSinceUpdate / 3600);
        const kernelDecayRate = decayRate * kernelDecayFactor;
        
        // Apply exponential decay formula: A(t) = A₀ * (1 - decayRate*t)
        let newAttention = attentionData.level * (1 - kernelDecayRate);
        
        // Ensure it doesn't go below a minimum threshold (0.1)
        newAttention = Math.max(0.1, newAttention);
        
        // Update the attention map
        this.attentionMap.set(kernelRef, {
          level: newAttention,
          timestamp: now
        });
        
        // Update kernel metadata
        try {
          const metadata = {
            attention: newAttention,
            lastAttentionUpdate: now
          };
          
          this.uorCortex.updateKernelCognitiveMetadata(kernelRef, metadata);
        } catch (metadataError) {
          // Continue even if metadata update fails
        }
        
        affectedCount++;
      }
      
      // Update the last update time
      this.lastUpdateTime = now;
      
      this.logger.log(`Decayed attention for ${affectedCount} kernels`);
      return affectedCount;
    } catch (error) {
      this.logger.error(`Error in decayAttentionOverTime: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get the top attended kernels
   * @param {number} limit - Maximum number of kernels to return
   * @returns {Array} Array of top attended kernels with their attention levels
   */
  getTopAttendedKernels(limit = 5) {
    try {
      // Sort kernels by attention level (descending)
      const sortedAttention = [...this.attentionMap.entries()]
        .sort((a, b) => b[1].level - a[1].level)
        .slice(0, limit);
      
      // Retrieve actual kernel objects for the top references
      const results = [];
      
      for (const [kernelRef, attentionData] of sortedAttention) {
        try {
          const kernel = this.uorCortex.retrieveObject(kernelRef);
          
          if (kernel) {
            results.push({
              kernelRef,
              attention: attentionData.level,
              lastUpdated: attentionData.timestamp,
              kernel: kernel
            });
          }
        } catch (retrieveError) {
          this.logger.warn(`Could not retrieve kernel ${kernelRef}: ${retrieveError.message}`);
          // Skip this kernel but continue with others
        }
      }
      
      this.logger.log(`Retrieved ${results.length} top attended kernels`);
      return results;
    } catch (error) {
      this.logger.error(`Error in getTopAttendedKernels: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get current attention level for a specific kernel
   * @param {string} kernelRef - Reference to the kernel
   * @returns {number} Current attention level (0.0 - 1.0)
   */
  getKernelAttention(kernelRef) {
    if (!kernelRef) return 0;
    
    const attentionData = this.attentionMap.get(kernelRef);
    return attentionData ? attentionData.level : 0;
  }
  
  /**
   * Clear all attention data (for testing or reset)
   */
  clearAttentionData() {
    this.attentionMap.clear();
    this.lastUpdateTime = Date.now();
    this.logger.log("Attention data cleared");
  }
}

export default AttentionWeights;
