// Corrected uor-cortex.js
// Properly implements UOR Lattice traversal according to the specification

const TOKEN_LIMIT = 1000;  // Define the token limit for context

/**
 * Estimates token count for a string or object
 * This is a simplified estimation - in a real implementation, use a proper tokenizer
 * @param {*} data - The data to estimate token count for
 * @returns {number} - Estimated token count
 */
function estimateTokenCount(data) {
  const stringified = typeof data === 'string' ? data : JSON.stringify(data);
  // Simple estimation: ~4 characters per token on average
  return Math.ceil(stringified.length / 4);
}

/**
 * Creates a summary of the given context
 * @param {Array} context - The context to summarize
 * @returns {Array} - The summarized context
 */
function summarizeContext(context) {
  // In a real implementation, this would use NLP techniques to summarize content
  // Here we simulate by keeping the most relevant kernels and truncating others
  
  if (context.length <= 10) return context; // Don't summarize small contexts
  
  // Sort by relevance score (if available) or keep original order
  const sortedContext = [...context].sort((a, b) => 
    (b.relevanceScore || 0) - (a.relevanceScore || 0)
  );
  
  // Keep the top most relevant kernels intact
  const topKernels = sortedContext.slice(0, 5);
  
  // Summarize the rest by extracting key information
  const summarizedRest = sortedContext.slice(5).map(kernel => {
    // Create a simplified version of the kernel with essential information
    return {
      ...kernel,
      data: typeof kernel.data === 'object' 
        ? { summary: `Summary of ${JSON.stringify(kernel.data).substring(0, 100)}...` }
        : `Summary: ${String(kernel.data).substring(0, 100)}...`,
      isSummarized: true
    };
  });
  
  // Combine the top kernels with the summarized ones
  return [...topKernels, ...summarizedRest];
}

class UORCortex {
  constructor() {
    this.uorGraph = new Map(); // Stores all kernels in a directed acyclic graph (DAG)
    this.logger = console; // For logging, could be replaced with a custom logger
  }

  /**
   * Creates a new kernel (encoded object) in the UOR framework.
   * @param {Object} objectData - The data representing the object to be encoded.
   * @returns {Object} - The newly created or existing kernel.
   */
  createKernel(objectData) {
    // Generate a unique reference for the new kernel
    const kernelReference = this.generateUniqueReference();

    // Check if the kernel's data already exists in the uorGraph
    for (let [reference, kernel] of this.uorGraph.entries()) {
      if (JSON.stringify(kernel.data) === JSON.stringify(objectData)) {
        // Return the existing kernel and its reference
        return { kernelReference: reference, kernel };
      }
    }

    // Encode the object data into a kernel
    const kernel = this.encodeObject(objectData);

    // Store the kernel in the UOR graph
    this.uorGraph.set(kernelReference, kernel);

    // Ensure that all kernels are logically consistent
    this.checkConsistency(kernel);

    // Return the kernel and its reference
    return { kernelReference, kernel };
  }

  /**
   * Encodes an object as a kernel in the UOR system.
   * @param {Object} objectData - The data representing the object to be encoded.
   * @returns {Object} - The encoded kernel object.
   */
  encodeObject(objectData) {
    // Advanced encoding logic (here we use a base64 representation as an example)
    const encodedRepresentation = this.encodeData(objectData);

    // Return an encoded kernel object containing the original data and its encoded form
    return {
      data: objectData,
      encodedRepresentation,
      relationships: [], // Initialize empty relationships array
      relevanceScore: 0  // Initialize relevance score
    };
  }

  /**
   * Encodes the data into a unique representation (replacing simple JSON with advanced encoding).
   * @param {Object} data - The data to encode.
   * @returns {String} - The encoded string (base64 in this case).
   */
  encodeData(data) {
    // Convert the object to a JSON string
    const jsonString = JSON.stringify(data);

    // Encode the JSON string to a Uint8Array using TextEncoder
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(jsonString);

    // Convert the Uint8Array to a Base64 string
    const base64String = btoa(String.fromCharCode.apply(null, uint8Array));

    return base64String;
  }

  /**
   * Generates a unique reference for each kernel.
   * @returns {String} - A unique reference for the kernel.
   */
  generateUniqueReference() {
    return 'kernel_' + Date.now() + Math.random().toString(36).substring(2);
  }

  /**
   * Links two kernels in the UOR graph, defining their semantic relationship.
   * @param {String} kernel1Ref - The reference of the first kernel.
   * @param {String} kernel2Ref - The reference of the second kernel.
   * @param {String} relationship - The relationship between the two kernels.
   */
  linkObjects(kernel1Ref, kernel2Ref, relationship) {
    const kernel1 = this.uorGraph.get(kernel1Ref);
    const kernel2 = this.uorGraph.get(kernel2Ref);

    if (!kernel1 || !kernel2) {
      throw new Error('One or both kernels not found');
    }

    // Define the relationship between the two kernels
    const relationshipData = { 
      targetKernelRef: kernel2Ref, 
      relationshipType: relationship,
      weight: 1.0 // Default relationship weight
    };

    // Ensure the relationship does not violate coherence norms
    this.checkConsistency(relationshipData);

    // Link the two kernels by storing the relationship in kernel1
    if (!kernel1.relationships) kernel1.relationships = [];
    kernel1.relationships.push(relationshipData);
    
    // For bidirectional relationships, also add the inverse relationship
    if (!kernel2.relationships) kernel2.relationships = [];
    kernel2.relationships.push({
      targetKernelRef: kernel1Ref,
      relationshipType: `inverse_${relationship}`,
      weight: 1.0
    });
  }

  /**
   * Resolves content based on a query kernel, tracing related kernels across the UOR graph.
   * @param {Object|String} query - The query kernel or string to resolve.
   * @returns {Array} - The list of kernels that resolve the query.
   */
  resolveContent(query) {
    // If query is a string, convert it to a temporary kernel for matching
    const queryKernel = typeof query === 'string' 
      ? { data: query, encodedRepresentation: this.encodeData({ query }) }
      : query;
    
    const relatedKernels = [];

    // Traverse through all kernels in the graph and find the related ones
    this.uorGraph.forEach((kernel, reference) => {
      const relevanceScore = this.calculateRelevance(queryKernel, kernel);
      if (relevanceScore > 0.1) { // Threshold for relevance
        kernel.relevanceScore = relevanceScore; // Store the relevance score in the kernel
        relatedKernels.push({ ...kernel, reference });
      }
    });
    
    // Sort by relevance score (descending)
    relatedKernels.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return relatedKernels;
  }

  /**
   * Calculates the relevance (similarity) between two kernels.
   * @param {Object} kernel1 - The first kernel.
   * @param {Object} kernel2 - The second kernel.
   * @returns {number} - Relevance score between 0 and 1.
   */
  calculateRelevance(kernel1, kernel2) {
    // In a production system, this would use embedding similarity
    // Here we use a simple text matching approach
    
    const text1 = typeof kernel1.data === 'string' 
      ? kernel1.data 
      : JSON.stringify(kernel1.data);
      
    const text2 = typeof kernel2.data === 'string' 
      ? kernel2.data 
      : JSON.stringify(kernel2.data);
    
    // Convert to lowercase for case-insensitive comparison
    const words1 = text1.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const words2 = text2.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    
    // Count matching words
    let matchCount = 0;
    for (const word of words1) {
      if (words2.includes(word)) {
        matchCount++;
      }
    }
    
    // Calculate relevance score (simplified Jaccard similarity)
    const uniqueWords = new Set([...words1, ...words2]);
    return matchCount / uniqueWords.size;
  }

  /**
   * Ensures that the kernel is logically consistent within the UOR graph.
   * @param {Object} kernel - The kernel to check for consistency.
   */
  checkConsistency(kernel) {
    // Check if the kernel contains valid data
    if (!kernel.data && !kernel.targetKernelRef) {
      throw new Error('Kernel data or relationship target is missing');
    }

    // Validate that the kernel's encoded representation exists and is valid (if it has one)
    if (kernel.encodedRepresentation !== undefined && 
        (!kernel.encodedRepresentation || kernel.encodedRepresentation === '')) {
      throw new Error('Kernel encoded representation is invalid');
    }

    // Additional consistency checks could be added here
  }

  /**
   * Retrieves a kernel by its reference from the UOR graph.
   * @param {String} kernelReference - The reference of the kernel to retrieve.
   * @returns {Object} - The kernel associated with the provided reference.
   */
  retrieveObject(kernelReference) {
    const kernel = this.uorGraph.get(kernelReference);

    if (!kernel) {
      throw new Error('Kernel not found');
    }

    return kernel;
  }

  /**
   * Returns all objects (kernels) in the UOR graph.
   * @returns {Array} - The list of all kernels in the graph.
   */
  getAllKernels() {
    return Array.from(this.uorGraph.entries()).map(([ref, kernel]) => ({
      reference: ref,
      ...kernel
    }));
  }

  /**
   * Traverse the UOR lattice and pack context into layers
   * Implements proper graph traversal logic following relationships between kernels
   * @param {String|Object} queryInput - The initial query string or kernel
   * @returns {Promise<Array>} - The packed context (array of relevant kernels)
   */
  async traverseUORLattice(queryInput) {
    this.logger.log(`[UOR] Starting UOR lattice traversal for query: ${typeof queryInput === 'string' ? queryInput : JSON.stringify(queryInput.data)}`);
    
    // Initialize traversal state
    let context = [];
    let currentTokenCount = 0;
    let visitedKernelRefs = new Set(); // Track visited kernels to avoid cycles
    let traversalQueue = []; // Queue for breadth-first traversal
    
    // Convert query to a kernel if it's a string
    const queryKernel = typeof queryInput === 'string' 
      ? { data: queryInput, encodedRepresentation: this.encodeData({ query: queryInput }) }
      : queryInput;
    
    // Get initial related kernels based on content similarity
    const initialKernels = this.resolveContent(queryKernel);
    traversalQueue.push(...initialKernels);
    
    this.logger.log(`[UOR] Initial content resolution found ${initialKernels.length} relevant kernels`);
    
    // Process kernels in the queue using breadth-first traversal
    while (traversalQueue.length > 0 && currentTokenCount < TOKEN_LIMIT) {
      // Get the next kernel with highest relevance
      const currentKernel = traversalQueue.shift();
      const kernelRef = currentKernel.reference;
      
      // Skip if already visited
      if (visitedKernelRefs.has(kernelRef)) {
        continue;
      }
      
      // Mark as visited
      visitedKernelRefs.add(kernelRef);
      
      // Estimate token count for current kernel
      const kernelTokens = estimateTokenCount(currentKernel.data);
      
      // Add kernel to context if it fits within token limit
      if (currentTokenCount + kernelTokens <= TOKEN_LIMIT) {
        context.push(currentKernel);
        currentTokenCount += kernelTokens;
        this.logger.log(`[UOR] Added kernel ${kernelRef} to context (${currentTokenCount}/${TOKEN_LIMIT} tokens)`);
        
        // Follow relationships to related kernels (graph traversal)
        if (currentKernel.relationships && currentKernel.relationships.length > 0) {
          this.logger.log(`[UOR] Following ${currentKernel.relationships.length} relationships from kernel ${kernelRef}`);
          
          // Get related kernels through explicit relationships
          for (const relationship of currentKernel.relationships) {
            const relatedKernelRef = relationship.targetKernelRef;
            
            // Skip if already visited
            if (visitedKernelRefs.has(relatedKernelRef)) {
              continue;
            }
            
            // Retrieve the related kernel
            try {
              const relatedKernel = this.retrieveObject(relatedKernelRef);
              
              // Calculate relevance to original query
              const relevanceToQuery = this.calculateRelevance(queryKernel, relatedKernel);
              relatedKernel.relevanceScore = relevanceToQuery;
              
              // Add to traversal queue with relevance to query for prioritization
              traversalQueue.push({ 
                ...relatedKernel, 
                reference: relatedKernelRef,
                // Combine relationship weight with relevance score
                relevanceScore: relationship.weight * 0.5 + relevanceToQuery * 0.5
              });
            } catch (error) {
              this.logger.error(`[UOR] Error retrieving related kernel ${relatedKernelRef}: ${error.message}`);
            }
          }
          
          // Sort queue by relevance score to prioritize most relevant kernels
          traversalQueue.sort((a, b) => b.relevanceScore - a.relevanceScore);
        }
      } else {
        // If this kernel doesn't fit, try with another one
        continue;
      }
    }
    
    this.logger.log(`[UOR] Traversal complete. Context contains ${context.length} kernels (${currentTokenCount}/${TOKEN_LIMIT} tokens)`);
    
    return context;
  }

  /**
   * Aggregate kernels into higher-level context
   * @param {Array} context - The context to be aggregated
   * @returns {Array} - The higher-level aggregated context
   */
  aggregateContext(context) {
    this.logger.log(`[UOR] Aggregating context of ${context.length} kernels`);
    
    // If context is already small enough, return as is
    if (estimateTokenCount(context) <= TOKEN_LIMIT / 2) {
      return context;
    }
    
    // Organize context into levels based on relevance scores
    const contextLevels = {
      level1: [], // Basic - highest relevance, direct facts
      level2: [], // Intermediate - medium relevance, related concepts
      level3: []  // Higher-level - lower relevance, background context
    };
    
    // Classify kernels into levels
    for (const kernel of context) {
      const relevanceScore = kernel.relevanceScore || 0;
      
      if (relevanceScore > 0.7) {
        contextLevels.level1.push(kernel);
      } else if (relevanceScore > 0.3) {
        contextLevels.level2.push(kernel);
      } else {
        contextLevels.level3.push(kernel);
      }
    }
    
    this.logger.log(`[UOR] Context divided into levels: L1=${contextLevels.level1.length}, L2=${contextLevels.level2.length}, L3=${contextLevels.level3.length}`);
    
    // Apply different aggregation strategies based on level
    // Keep level 1 intact, summarize levels 2 and 3
    const summarizedLevel2 = summarizeContext(contextLevels.level2);
    const summarizedLevel3 = summarizeContext(contextLevels.level3);
    
    // Combine the levels, prioritizing the most relevant information
    const aggregatedContext = [
      ...contextLevels.level1,
      ...summarizedLevel2,
      ...summarizedLevel3
    ];
    
    // Final token count after aggregation
    const finalTokenCount = estimateTokenCount(aggregatedContext);
    this.logger.log(`[UOR] Aggregation complete. Final context contains ${aggregatedContext.length} kernels (${finalTokenCount} tokens)`);
    
    return aggregatedContext;
  }
}

export default UORCortex; // Default export of the UORCortex class