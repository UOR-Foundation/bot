// cognitive/memory-traversal.js
// Implements working memory via specialized UOR traversal strategies

/**
 * MemoryTraversal class implements working memory functionality
 * by providing specialized traversal strategies for the UOR graph
 */
class MemoryTraversal {
  /**
   * Create a new MemoryTraversal instance
   * @param {Object} uorCortex - Reference to the UOR Cortex
   */
  constructor(uorCortex) {
    this.uorCortex = uorCortex;
    this.logger = console; // Logger (can be replaced with a custom one)
    
    // Configuration for memory traversal
    this.config = {
      // Recency thresholds in milliseconds
      recencyThresholds: {
        working: 5 * 60 * 1000, // 5 minutes
        episodic: 24 * 60 * 60 * 1000, // 24 hours
        longTerm: 30 * 24 * 60 * 60 * 1000 // 30 days
      },
      // Maximum number of kernels to retrieve for different contexts
      kernelLimits: {
        conversation: 10,
        working: 20,
        episodic: 30
      },
      // Relevance thresholds for different memory types
      relevanceThresholds: {
        critical: 0.8,
        high: 0.6,
        medium: 0.4,
        low: 0.2
      }
    };
  }

  /**
   * Gets the current working memory context based on query
   * @param {Object} queryKernel - The kernel representing the current query
   * @param {Object} options - Options for traversal
   * @param {string} options.contextType - Type of context (personal, domain, general)
   * @param {number} options.kernelLimit - Maximum number of kernels to retrieve
   * @param {number} options.relevanceThreshold - Minimum relevance score
   * @param {boolean} options.includePersonal - Whether to include personal info
   * @returns {Array} - The working memory context (relevant kernels)
   */
  async getWorkingMemoryContext(queryKernel, options = {}) {
    this.logger.log(`Getting working memory context for query`);
    
    // Set defaults for options
    const contextType = options.contextType || 'general';
    const kernelLimit = options.kernelLimit || this.config.kernelLimits.working;
    const relevanceThreshold = options.relevanceThreshold || this.config.relevanceThresholds.low;
    const includePersonal = options.includePersonal !== undefined ? options.includePersonal : true;
    
    try {
      // Get recent kernels from UOR Cortex
      const recentKernels = await this.uorCortex.getWorkingMemorySet(
        this.config.recencyThresholds.working
      );
      this.logger.log(`Found ${recentKernels.length} kernels in working memory timeframe`);
      
      // Get related kernels through traversal
      const traversalResults = await this.uorCortex.traverseUORLattice(queryKernel, {
        contextType: contextType,
        initialKernels: recentKernels,
        kernelLimit: kernelLimit,
        relevanceThreshold: relevanceThreshold
      });
      
      // Apply context-specific filtering
      let filteredContext = await this.filterByContextRelevance(
        traversalResults, 
        contextType
      );
      
      // Include or exclude personal info based on options
      if (!includePersonal) {
        filteredContext = filteredContext.filter(kernel => 
          !(kernel.data && kernel.data.schemaType === 'Person')
        );
      }
      
      // Sort by relevance
      filteredContext.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
      
      // Limit to requested number of kernels
      const workingMemoryContext = filteredContext.slice(0, kernelLimit);
      
      this.logger.log(`Working memory context contains ${workingMemoryContext.length} kernels`);
      return workingMemoryContext;
    } catch (error) {
      this.logger.error(`Error getting working memory context: ${error.message}`);
      return [];
    }
  }

  /**
   * Retrieves episodic memory within a given time range
   * @param {Object} timeRange - The time range to retrieve memories from
   * @param {number} timeRange.start - Start timestamp
   * @param {number} timeRange.end - End timestamp
   * @param {Object} options - Additional options
   * @returns {Array} - The episodic memory context
   */
  async getEpisodicMemory(timeRange, options = {}) {
    const startTime = timeRange.start || (Date.now() - this.config.recencyThresholds.episodic);
    const endTime = timeRange.end || Date.now();
    const kernelLimit = options.kernelLimit || this.config.kernelLimits.episodic;
    
    this.logger.log(`Getting episodic memory from ${new Date(startTime)} to ${new Date(endTime)}`);
    
    try {
      // Get all kernels
      const allKernels = this.uorCortex.getAllKernels();
      
      // Filter kernels by timestamp
      const episodicKernels = allKernels.filter(kernel => {
        const timestamp = kernel.data && kernel.data.timestamp ? kernel.data.timestamp : 0;
        return timestamp >= startTime && timestamp <= endTime;
      });
      
      // Sort by timestamp (most recent first)
      episodicKernels.sort((a, b) => {
        const timestampA = a.data && a.data.timestamp ? a.data.timestamp : 0;
        const timestampB = b.data && b.data.timestamp ? b.data.timestamp : 0;
        return timestampB - timestampA;
      });
      
      // Apply optional filtering
      let filteredKernels = episodicKernels;
      
      if (options.filterByType) {
        filteredKernels = filteredKernels.filter(kernel => 
          kernel.data && kernel.data.schemaType === options.filterByType
        );
      }
      
      // Limit to requested number of kernels
      const limitedKernels = filteredKernels.slice(0, kernelLimit);
      
      this.logger.log(`Episodic memory contains ${limitedKernels.length} kernels`);
      return limitedKernels;
    } catch (error) {
      this.logger.error(`Error getting episodic memory: ${error.message}`);
      return [];
    }
  }

  /**
   * Gets the recent conversation flow
   * @param {number} turnCount - Number of conversation turns to retrieve
   * @returns {Array} - The recent conversation flow context
   */
  async getRecentConversationFlow(turnCount = 5) {
    this.logger.log(`Getting recent conversation flow: ${turnCount} turns`);
    
    try {
      // Find conversation kernel
      const allKernels = this.uorCortex.getAllKernels();
      const conversationKernel = allKernels.find(kernel => 
        kernel.data && kernel.data.schemaType === 'Conversation'
      );
      
      if (!conversationKernel) {
        this.logger.log('No Conversation kernel found');
        return [];
      }
      
      // Find query kernels connected to the conversation
      const queryKernels = [];
      
      // First, get kernels directly connected to conversation
      if (conversationKernel.relationships) {
        const queriesByTime = [];
        
        // Check for relationships in both directions
        for (const kernel of allKernels) {
          // Check if this kernel links to the conversation
          if (kernel.relationships) {
            const hasLink = kernel.relationships.some(rel => 
              rel.targetKernelRef === conversationKernel.reference && 
              (rel.relationshipType === 'partOf' || rel.relationshipType === 'mentionedBy')
            );
            
            if (hasLink && kernel.data && kernel.data.type === 'query') {
              queriesByTime.push(kernel);
            }
          }
          
          // Also check if the conversation links to this kernel
          if (conversationKernel.relationships) {
            const isLinked = conversationKernel.relationships.some(rel => 
              rel.targetKernelRef === kernel.reference && 
              (rel.relationshipType === 'hasPart' || rel.relationshipType === 'mentions')
            );
            
            if (isLinked && kernel.data && kernel.data.type === 'query' && 
                !queriesByTime.some(k => k.reference === kernel.reference)) {
              queriesByTime.push(kernel);
            }
          }
        }
        
        // Sort by timestamp
        queriesByTime.sort((a, b) => {
          const timestampA = a.data && a.data.timestamp ? a.data.timestamp : 0;
          const timestampB = b.data && b.data.timestamp ? b.data.timestamp : 0;
          return timestampB - timestampA;
        });
        
        // Take the most recent N turns
        for (let i = 0; i < Math.min(turnCount, queriesByTime.length); i++) {
          queryKernels.push(queriesByTime[i]);
        }
      }
      
      this.logger.log(`Found ${queryKernels.length} recent query kernels`);
      return queryKernels;
    } catch (error) {
      this.logger.error(`Error getting recent conversation flow: ${error.message}`);
      return [];
    }
  }

  /**
   * Merges multiple contexts with priority ordering
   * @param {Array} contexts - Array of context arrays to merge
   * @param {Array} priorityOrder - Array of priority weights
   * @returns {Array} - The merged context
   */
  mergePriorityContexts(contexts, priorityOrder) {
    this.logger.log(`Merging ${contexts.length} contexts with priority ordering`);
    
    if (!contexts || contexts.length === 0) {
      return [];
    }
    
    // Use default equal priorities if not provided
    const priorities = priorityOrder || contexts.map(() => 1);
    
    // Map to track already-added kernels
    const addedKernelRefs = new Set();
    const mergedContext = [];
    
    // Process contexts in priority order
    for (let i = 0; i < contexts.length; i++) {
      const context = contexts[i];
      const priority = priorities[i];
      
      if (!context || context.length === 0) {
        continue;
      }
      
      // Add each kernel if not already added
      for (const kernel of context) {
        if (kernel.reference && !addedKernelRefs.has(kernel.reference)) {
          // Add to merged context
          mergedContext.push({
            ...kernel,
            // Boost relevance by priority if relevance score exists
            relevanceScore: kernel.relevanceScore ? 
              kernel.relevanceScore * priority : priority
          });
          
          // Mark as added
          addedKernelRefs.add(kernel.reference);
        }
      }
    }
    
    // Sort by relevance score
    mergedContext.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    
    this.logger.log(`Merged context contains ${mergedContext.length} kernels`);
    return mergedContext;
  }

  /**
   * Filters kernels based on context relevance
   * @param {Array} kernels - The kernels to filter
   * @param {string} contextType - The context type
   * @returns {Array} - The filtered kernels
   */
  async filterByContextRelevance(kernels, contextType) {
    this.logger.log(`Filtering ${kernels.length} kernels by ${contextType} context relevance`);
    
    if (!kernels || kernels.length === 0) {
      return [];
    }
    
    try {
      let filteredKernels = [...kernels];
      
      switch (contextType) {
        case 'personal':
          // Boost Person kernels and related information
          filteredKernels = filteredKernels.map(kernel => {
            // Boost Person schemas
            if (kernel.data && kernel.data.schemaType === 'Person') {
              return {
                ...kernel,
                relevanceScore: (kernel.relevanceScore || 0.5) * 2.0
              };
            }
            
            // Boost kernels related to Person
            if (kernel.relationships && kernel.relationships.some(rel => {
              // Try to find the target kernel
              const targetKernel = kernels.find(k => k.reference === rel.targetKernelRef);
              return targetKernel && 
                     targetKernel.data && 
                     targetKernel.data.schemaType === 'Person';
            })) {
              return {
                ...kernel,
                relevanceScore: (kernel.relevanceScore || 0.5) * 1.5
              };
            }
            
            return kernel;
          });
          break;
          
        case 'domain':
          // Boost domain-specific kernels
          filteredKernels = filteredKernels.map(kernel => {
            // Check for domain keywords in kernel content
            const domainKeywords = ['UOR', 'framework', 'bot', 'knowledge', 'semantic', 
                                   'token', 'traversal', 'lattice', 'kernel'];
            
            let keywordFound = false;
            let kernelContent = '';
            
            if (kernel.data) {
              if (typeof kernel.data === 'string') {
                kernelContent = kernel.data;
              } else if (kernel.data.title) {
                kernelContent = kernel.data.title;
                if (kernel.data.content) {
                  kernelContent += ' ' + kernel.data.content;
                }
              }
            }
            
            // Check if content contains domain keywords
            keywordFound = domainKeywords.some(keyword => 
              kernelContent.toLowerCase().includes(keyword.toLowerCase())
            );
            
            if (keywordFound) {
              return {
                ...kernel,
                relevanceScore: (kernel.relevanceScore || 0.5) * 1.8
              };
            }
            
            return kernel;
          });
          break;
          
        case 'general':
          // No special filtering for general context
          break;
          
        default:
          // No filtering for unknown context types
          break;
      }
      
      // Re-sort by adjusted relevance score
      filteredKernels.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
      
      this.logger.log(`Context-filtered to ${filteredKernels.length} kernels`);
      return filteredKernels;
    } catch (error) {
      this.logger.error(`Error filtering by context relevance: ${error.message}`);
      return kernels; // Return original kernels on error
    }
  }
}

export default MemoryTraversal;
