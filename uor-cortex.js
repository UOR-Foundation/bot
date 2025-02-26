// Enhanced uor-cortex.js
// Refactored implementation of UOR Lattice for schema-based knowledge representation
// with enhanced cognitive capabilities

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
      isSummarized: true,
      cognitiveMetadata: kernel.cognitiveMetadata // Preserve cognitive metadata
    };
  });
  
  // Combine the top kernels with the summarized ones
  return [...topKernels, ...summarizedRest];
}

class UORCortex {
  constructor() {
    this.uorGraph = new Map(); // Stores all kernels in a directed acyclic graph (DAG)
    this.contextKernelRef = null; // Reference to the current context kernel
    this.logger = console; // For logging, could be replaced with a custom logger
    
    // Initialize cognitive metadata tracking
    this.cognitiveMetadata = {
      lastAccessTime: {}, // Maps kernel references to last access timestamp
      attentionWeights: {}, // Maps kernel references to attention weights
      contextRelevance: {}, // Maps kernel references to context relevance scores
      workingMemoryStatus: {} // Maps kernel references to working memory status
    };
  }

  /**
   * Creates a new kernel (encoded object) in the UOR framework.
   * Enhanced to better handle schema-typed objects, updates, and cognitive metadata
   * @param {Object} objectData - The data representing the object to be encoded.
   * @returns {Object} - The newly created or existing kernel.
   */
  createKernel(objectData) {
    // Generate a unique reference for the new kernel
    const kernelReference = this.generateUniqueReference();

    // For schema-typed objects, check if we're updating an existing kernel
    if (objectData && objectData.schemaType === 'Person') {
      // Try to find existing Person kernel to update
      for (let [reference, kernel] of this.uorGraph.entries()) {
        if (kernel.data && kernel.data.schemaType === 'Person') {
          this.logger.log(`Found existing Person kernel to update: ${reference}`);
          
          // Create an updated kernel with merged properties
          const updatedData = {
            ...kernel.data,
            properties: {
              ...kernel.data.properties,
              ...objectData.properties
            },
            timestamp: Date.now() // Update timestamp
          };
          
          // Encode the updated object
          const updatedKernel = this.encodeObject(updatedData);
          
          // Preserve relationships
          updatedKernel.relationships = kernel.relationships || [];
          
          // Preserve and update cognitive metadata
          updatedKernel.cognitiveMetadata = {
            ...kernel.cognitiveMetadata,
            lastAccessed: Date.now(),
            attentionWeight: 1.0, // Boost attention weight for recent updates
            isInWorkingMemory: true
          };
          
          // Update the cognitive metadata tracking
          this.cognitiveMetadata.lastAccessTime[reference] = Date.now();
          this.cognitiveMetadata.attentionWeights[reference] = 1.0;
          this.cognitiveMetadata.workingMemoryStatus[reference] = true;
          
          // Update in the graph
          this.uorGraph.set(reference, updatedKernel);
          
          return { kernelReference: reference, kernel: updatedKernel };
        }
      }
    }

    // Check if the kernel's data already exists in the uorGraph
    for (let [reference, kernel] of this.uorGraph.entries()) {
      if (JSON.stringify(kernel.data) === JSON.stringify(objectData)) {
        // Update the access time and attention weight
        this.cognitiveMetadata.lastAccessTime[reference] = Date.now();
        this.cognitiveMetadata.attentionWeights[reference] = 
          (this.cognitiveMetadata.attentionWeights[reference] || 0.5) + 0.2;
        
        // Update the kernel's cognitive metadata
        kernel.cognitiveMetadata = {
          ...kernel.cognitiveMetadata,
          lastAccessed: Date.now(),
          attentionWeight: this.cognitiveMetadata.attentionWeights[reference]
        };
        
        // Return the existing kernel and its reference
        return { kernelReference: reference, kernel };
      }
    }

    // Encode the object data into a kernel
    const kernel = this.encodeObject(objectData);
    
    // Initialize cognitive metadata for the new kernel
    kernel.cognitiveMetadata = {
      created: Date.now(),
      lastAccessed: Date.now(),
      attentionWeight: 0.8, // Start with relatively high attention for new objects
      isInWorkingMemory: true,
      contextRelevance: {}
    };
    
    // Update the cognitive metadata tracking
    this.cognitiveMetadata.lastAccessTime[kernelReference] = Date.now();
    this.cognitiveMetadata.attentionWeights[kernelReference] = 0.8;
    this.cognitiveMetadata.workingMemoryStatus[kernelReference] = true;

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
      relevanceScore: 0,  // Initialize relevance score
      cognitiveMetadata: {} // Initialize empty cognitive metadata
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
   * Enhanced to better track bidirectional relationships and cognitive weights
   * @param {String} kernel1Ref - The reference of the first kernel.
   * @param {String} kernel2Ref - The reference of the second kernel.
   * @param {String} relationship - The relationship between the two kernels.
   * @param {Object} options - Optional parameters for the link
   */
  linkObjects(kernel1Ref, kernel2Ref, relationship, options = {}) {
    const kernel1 = this.uorGraph.get(kernel1Ref);
    const kernel2 = this.uorGraph.get(kernel2Ref);

    if (!kernel1 || !kernel2) {
      throw new Error('One or both kernels not found');
    }

    // Define the relationship between the two kernels
    const relationshipData = { 
      targetKernelRef: kernel2Ref, 
      relationshipType: relationship,
      weight: options.weight || 1.0, // Default relationship weight with option to override
      timestamp: Date.now() // Add timestamp to track recency
    };

    // Ensure the relationship does not violate coherence norms
    this.checkConsistency(relationshipData);

    // Check if the relationship already exists to avoid duplicates
    const existingRelationship = (kernel1.relationships || []).find(rel => 
      rel.targetKernelRef === kernel2Ref && rel.relationshipType === relationship
    );

    if (!existingRelationship) {
      // Link the two kernels by storing the relationship in kernel1
      if (!kernel1.relationships) kernel1.relationships = [];
      kernel1.relationships.push(relationshipData);
      
      this.logger.log(`Linked ${kernel1Ref} -[${relationship}]-> ${kernel2Ref}`);
      
      // Update cognitive metadata - linking increases attention to both kernels
      this.updateKernelCognitiveMetadata(kernel1Ref, {
        lastAccessed: Date.now(),
        attentionWeight: (this.cognitiveMetadata.attentionWeights[kernel1Ref] || 0.5) + 0.1
      });
      
      this.updateKernelCognitiveMetadata(kernel2Ref, {
        lastAccessed: Date.now(),
        attentionWeight: (this.cognitiveMetadata.attentionWeights[kernel2Ref] || 0.5) + 0.1
      });
    }
    
    // For bidirectional relationships, also add the inverse relationship
    // Determine inverse relationship name
    let inverseRelationship = `inverse_${relationship}`;
    
    // Some relationships have specific inverse names
    if (relationship === 'mentions') inverseRelationship = 'mentionedBy';
    if (relationship === 'contains') inverseRelationship = 'containedIn';
    if (relationship === 'participatesIn') inverseRelationship = 'hasParticipant';
    if (relationship === 'partOf') inverseRelationship = 'hasPart';
    
    // Check if inverse relationship already exists
    const existingInverseRelationship = (kernel2.relationships || []).find(rel => 
      rel.targetKernelRef === kernel1Ref && rel.relationshipType === inverseRelationship
    );
    
    if (!existingInverseRelationship) {
      if (!kernel2.relationships) kernel2.relationships = [];
      kernel2.relationships.push({
        targetKernelRef: kernel1Ref,
        relationshipType: inverseRelationship,
        weight: options.inverseWeight || options.weight || 1.0,
        timestamp: Date.now()
      });
      
      this.logger.log(`Linked ${kernel2Ref} -[${inverseRelationship}]-> ${kernel1Ref}`);
    }
    
    // If either kernel is the context kernel, update context relevance
    if (kernel1Ref === this.contextKernelRef || kernel2Ref === this.contextKernelRef) {
      const nonContextRef = kernel1Ref === this.contextKernelRef ? kernel2Ref : kernel1Ref;
      this.cognitiveMetadata.contextRelevance[nonContextRef] = 
        (this.cognitiveMetadata.contextRelevance[nonContextRef] || 0.5) + 0.2;
    }
  }

  /**
   * Resolves content based on a query kernel, tracing related kernels across the UOR graph.
   * Enhanced to better handle schema-typed queries
   * @param {Object|String} query - The query kernel or string to resolve.
   * @returns {Array} - The list of kernels that resolve the query.
   */
  resolveContent(query) {
    // If query is a string, convert it to a temporary kernel for matching
    const queryKernel = typeof query === 'string' 
      ? { data: query, encodedRepresentation: this.encodeData({ query }) }
      : query;
    
    const relatedKernels = [];

    // First, check if this is a personal information query
    const isPersonalQuery = this.isPersonalInfoQuery(queryKernel);
    
    // For personal queries, first prioritize Person kernels
    if (isPersonalQuery) {
      this.logger.log(`Detected personal info query: ${typeof query === 'string' ? query : queryKernel.data.text}`);
      // Find Person kernels
      for (let [reference, kernel] of this.uorGraph.entries()) {
        if (kernel.data && kernel.data.schemaType === 'Person') {
          relatedKernels.push({
            ...kernel,
            reference,
            relevanceScore: 0.95 // High relevance for Person kernels in personal queries
          });
          this.logger.log(`Found Person kernel with high relevance: ${reference}`);
          
          // Update cognitive metadata for this kernel
          this.updateKernelCognitiveMetadata(reference, {
            lastAccessed: Date.now(),
            attentionWeight: 1.0,
            isInWorkingMemory: true
          });
        }
      }
    }

    // Then find other relevant kernels based on content similarity
    this.uorGraph.forEach((kernel, reference) => {
      // Skip if the kernel is already in the related list
      if (relatedKernels.some(k => k.reference === reference)) {
        return;
      }
      
      const relevanceScore = this.calculateRelevance(queryKernel, kernel);
      
      // For greeting or very short queries, include all kernels with a base relevance
      const queryText = typeof query === 'string' 
        ? query 
        : (query.data && query.data.text) 
          ? query.data.text 
          : JSON.stringify(query.data);
      
      const isGeneralQuery = queryText.length < 5 || 
                            /^(hi|hello|hey|greetings)/i.test(queryText);
      
      // Adjust threshold based on query type and kernel count
      const threshold = isGeneralQuery ? 0.01 : 0.1;
      
      // Apply cognitive attention boost
      const attentionBoost = this.cognitiveMetadata.attentionWeights[reference] || 0;
      const contextBoost = this.cognitiveMetadata.contextRelevance[reference] || 0;
      const adjustedRelevanceScore = relevanceScore + (attentionBoost * 0.1) + (contextBoost * 0.2);
      
      if (adjustedRelevanceScore > threshold) {
        // Update access time for this kernel
        this.updateKernelCognitiveMetadata(reference, {
          lastAccessed: Date.now(),
          isInWorkingMemory: true
        });
        
        // Create a copy of the kernel with the relevance score
        const kernelWithRelevance = { 
          ...kernel, 
          reference, 
          relevanceScore: adjustedRelevanceScore
        };
        relatedKernels.push(kernelWithRelevance);
      }
    });
    
    // If no kernels found and this is a general query, include all kernels with a base relevance
    if (relatedKernels.length === 0) {
      this.logger.log("[UOR] No directly relevant kernels found, including all kernels with base relevance");
      this.uorGraph.forEach((kernel, reference) => {
        // Update this kernel's cognitive metadata to note it was considered
        this.updateKernelCognitiveMetadata(reference, {
          lastAccessed: Date.now()
        });
        
        relatedKernels.push({
          ...kernel,
          reference,
          relevanceScore: 0.1 // Base relevance
        });
      });
    }
    
    // Sort by relevance score (descending)
    relatedKernels.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Log the top relevant kernels
    if (relatedKernels.length > 0) {
      this.logger.log(`Top relevant kernel: ${relatedKernels[0].reference} with score ${relatedKernels[0].relevanceScore}`);
    }
    
    // Limit the number of kernels returned to avoid overwhelming the system
    const maxKernels = 10;
    return relatedKernels.slice(0, maxKernels);
  }

  /**
   * Checks if a query is asking for personal information
   * @param {Object} queryKernel - The query kernel
   * @returns {boolean} - Whether this is a personal info query
   */
  isPersonalInfoQuery(queryKernel) {
    // Extract query text
    let queryText = '';
    if (typeof queryKernel.data === 'string') {
      queryText = queryKernel.data;
    } else if (queryKernel.data) {
      queryText = queryKernel.data.text || JSON.stringify(queryKernel.data);
    }
    
    // Personal info query patterns
    const personalInfoPatterns = [
      /what(?:'s| is) my name/i,
      /who am i/i,
      /how old am i/i,
      /what(?:'s| is) my age/i,
      /where (?:am i from|do i live)/i,
      /what(?:'s| is) my location/i,
      /tell me about (myself|me)/i
    ];
    
    // Check if any pattern matches
    return personalInfoPatterns.some(pattern => pattern.test(queryText));
  }

  /**
   * Calculates the relevance (similarity) between two kernels.
   * Enhanced to better handle schema-typed kernels, semantic understanding, and context
   * @param {Object} kernel1 - The first kernel.
   * @param {Object} kernel2 - The second kernel.
   * @param {Object} contextInfo - Optional context information to influence relevance
   * @returns {number} - Relevance score between 0 and 1.
   */
  calculateRelevance(kernel1, kernel2, contextInfo = {}) {
    // Special handling for schema-typed kernels
    // If kernel1 is a query and kernel2 is a Person kernel
    if (kernel1.data && kernel2.data && kernel2.data.schemaType === 'Person') {
      // For queries about personal information
      const queryText = typeof kernel1.data === 'string' 
        ? kernel1.data 
        : (kernel1.data.text || JSON.stringify(kernel1.data));
      
      // Check for personal info queries
      if (this.isPersonalInfoQuery(kernel1)) {
        this.logger.log(`High relevance for Person kernel matched with personal query`);
        return 0.95; // Very high relevance for Person kernels in personal info queries
      }
      
      // For greetings or general conversation, Person kernels are somewhat relevant
      if (/^(hi|hello|hey|greetings)/i.test(queryText)) {
        return 0.7; // High relevance for Person kernels in greetings
      }
    }
    
    // Special handling for queries about specific schema types
    if (kernel1.data && kernel1.data.type === 'query' && kernel2.data && kernel2.data.schemaType) {
      const queryText = kernel1.data.text || '';
      const schemaType = kernel2.data.schemaType;
      
      // If query explicitly mentions the schema type
      if (queryText.toLowerCase().includes(schemaType.toLowerCase())) {
        return 0.8; // High relevance for explicitly mentioned schema types
      }
    }
    
    // Context-based relevance boost
    if (contextInfo.contextType === 'personal' && kernel2.data && kernel2.data.schemaType === 'Person') {
      return 0.9; // Very high relevance for Person kernels in personal context
    }
    
    if (contextInfo.contextKernelRef && kernel2.relationships) {
      // Check if kernel2 is connected to the context kernel
      const isConnectedToContext = kernel2.relationships.some(rel => 
        rel.targetKernelRef === contextInfo.contextKernelRef
      );
      
      if (isConnectedToContext) {
        return 0.8; // High relevance for kernels connected to current context
      }
    }
    
    // Extract text from kernels
    let text1 = '';
    if (typeof kernel1.data === 'string') {
      text1 = kernel1.data;
    } else if (kernel1.data) {
      // Handle query objects specially
      if (kernel1.data.type === 'query' && kernel1.data.text) {
        text1 = kernel1.data.text;
      } else if (kernel1.data.query) {
        text1 = kernel1.data.query;
      } else {
        // Extract fields that might contain query text
        text1 = Object.values(kernel1.data)
          .filter(val => typeof val === 'string')
          .join(' ');
      }
    }
    
    let text2 = '';
    if (typeof kernel2.data === 'string') {
      text2 = kernel2.data;
    } else if (kernel2.data) {
      // For schema-typed kernels, include schema type in relevance calculation
      if (kernel2.data.schemaType) {
        text2 += kernel2.data.schemaType + ' ';
        
        // Include properties for better matching
        if (kernel2.data.properties) {
          Object.values(kernel2.data.properties)
            .filter(val => typeof val === 'string' || typeof val === 'number')
            .forEach(val => {
              text2 += val + ' ';
            });
        }
      }
      
      // For content kernels, prioritize title and content fields
      if (kernel2.data.title) text2 += kernel2.data.title + ' ';
      if (kernel2.data.content) text2 += kernel2.data.content + ' ';
      if (text2.trim() === '') {
        // If no title/content, use all string fields
        text2 = Object.values(kernel2.data)
          .filter(val => typeof val === 'string')
          .join(' ');
      }
    }
    
    // Handle general queries like "Hi" or very short queries
    if (text1.length < 5) {
      // For very short queries, return a low but non-zero relevance for all kernels
      // This ensures the bot can respond with some information
      return 0.1;
    }
    
    // For "what is X" type questions, extract the key term
    const whatIsMatch = text1.match(/what\s+is\s+(\w+)/i);
    if (whatIsMatch && whatIsMatch[1]) {
      const searchTerm = whatIsMatch[1].toLowerCase();
      
      // Check if the term appears in the kernel data
      if (text2.toLowerCase().includes(searchTerm)) {
        // Higher relevance if the search term is in a title
        if (kernel2.data && kernel2.data.title && 
            kernel2.data.title.toLowerCase().includes(searchTerm)) {
          return 0.9;
        }
        return 0.7;
      }
    }
    
    // Convert to lowercase for case-insensitive comparison
    const words1 = text1.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const words2 = text2.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    
    // Count matching words with higher weight for important words
    let matchCount = 0;
    for (const word of words1) {
      if (words2.includes(word)) {
        matchCount++;
      }
    }
    
    // If no matches but we're looking for "bot" information
    if (matchCount === 0 && text1.toLowerCase().includes('bot')) {
      // Check if kernel2 is related to bot functionality
      if (text2.toLowerCase().includes('bot') || 
          text2.toLowerCase().includes('chatbot') ||
          text2.toLowerCase().includes('framework')) {
        return 0.5; // Return medium relevance
      }
    }
    
    // Calculate relevance score (improved Jaccard similarity)
    const uniqueWords = new Set([...words1, ...words2]);
    const baseRelevance = uniqueWords.size > 0 ? matchCount / uniqueWords.size : 0;
    
    // Boost relevance for kernels that directly mention query terms
    for (const word of words1) {
      if (word.length > 3 && text2.toLowerCase().includes(word)) {
        return Math.max(baseRelevance, 0.4); // Ensure minimum relevance of 0.4 for direct matches
      }
    }
    
    // Apply cognitive attention boost if available
    if (kernel2.reference && this.cognitiveMetadata.attentionWeights[kernel2.reference]) {
      const attentionBoost = this.cognitiveMetadata.attentionWeights[kernel2.reference] * 0.1;
      return Math.min(baseRelevance + attentionBoost, 1.0); // Cap at 1.0
    }
    
    return baseRelevance;
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
    
    // Update the last access time for this kernel
    this.updateKernelCognitiveMetadata(kernelReference, {
      lastAccessed: Date.now()
    });

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
   * Enhanced to better handle schema-typed kernels, personal info, and cognitive metadata
   * @param {String|Object} queryInput - The initial query string or kernel
   * @param {Object} options - Optional traversal parameters
   * @returns {Promise<Array>} - The packed context (array of relevant kernels)
   */
  async traverseUORLattice(queryInput, options = {}) {
    const TOKEN_LIMIT = options.tokenLimit || 1000;
    
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
    
    // Check if this is a personal information query
    const isPersonalQuery = this.isPersonalInfoQuery(queryKernel);
    
    // Get the current context kernel if it exists
    const contextKernel = this.findContextKernel();
    let contextType = contextKernel?.data?.contextType || null;
    
    // Create context info for relevance calculation
    const contextInfo = {
      contextType: contextType,
      contextKernelRef: this.contextKernelRef,
      isPersonalQuery
    };
    
    // Get initial related kernels based on content similarity
    const initialKernels = this.resolveContent(queryKernel);
    traversalQueue.push(...initialKernels);
    
    this.logger.log(`[UOR] Initial content resolution found ${initialKernels.length} relevant kernels`);
    
    // For personal queries, ensure Person kernels are prioritized even more
    if (isPersonalQuery) {
      // Move any Person kernels to the front of the queue
      const personKernels = traversalQueue.filter(k => 
        k.data && k.data.schemaType === 'Person'
      );
      const otherKernels = traversalQueue.filter(k => 
        !k.data || k.data.schemaType !== 'Person'
      );
      
      traversalQueue = [...personKernels, ...otherKernels];
      this.logger.log(`[UOR] Prioritized ${personKernels.length} Person kernels for personal query`);
    }
    
    // If we have working memory filtering enabled, prioritize working memory
    if (options.useWorkingMemory) {
      const workingMemoryKernels = this.getWorkingMemorySet();
      // Reorder traversal queue to prioritize working memory kernels
      traversalQueue.sort((a, b) => {
        const aInWorkingMemory = workingMemoryKernels.has(a.reference) ? 1 : 0;
        const bInWorkingMemory = workingMemoryKernels.has(b.reference) ? 1 : 0;
        
        // Primary sort by working memory status
        if (aInWorkingMemory !== bInWorkingMemory) {
          return bInWorkingMemory - aInWorkingMemory;
        }
        
        // Secondary sort by relevance score
        return b.relevanceScore - a.relevanceScore;
      });
      this.logger.log(`[UOR] Prioritized working memory kernels in traversal queue`);
    }
    
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
      
      // Update cognitive metadata for this kernel - increase attention as it's being accessed
      this.updateKernelCognitiveMetadata(kernelRef, {
        lastAccessed: Date.now(),
        attentionWeight: (this.cognitiveMetadata.attentionWeights[kernelRef] || 0.5) + 0.1,
        isInWorkingMemory: true
      });
      
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
            
            // Skip if the relationship is too old (added optional temporal decay)
            if (options.temporalDecay && relationship.timestamp) {
              const age = Date.now() - relationship.timestamp;
              const maxAge = options.maxRelationshipAge || (24 * 60 * 60 * 1000); // Default 24 hours
              if (age > maxAge) {
                this.logger.log(`[UOR] Skipping old relationship to ${relatedKernelRef} (${age}ms old)`);
                continue;
              }
            }
            
            // Retrieve the related kernel
            try {
              const relatedKernel = this.retrieveObject(relatedKernelRef);
              
              // Calculate relevance to original query
              const relevanceToQuery = this.calculateRelevance(queryKernel, relatedKernel, contextInfo);
              
              // For personal queries, boost relevance of Person kernels in relationships
              let adjustedRelevance = relevanceToQuery;
              if (isPersonalQuery && relatedKernel.data && relatedKernel.data.schemaType === 'Person') {
                adjustedRelevance = Math.max(relevanceToQuery, 0.9);
                this.logger.log(`[UOR] Boosted relevance for Person kernel in relationship: ${relatedKernelRef}`);
              }
              
              // Adjust relevance based on relationship type
              // Certain relationships should have higher priority for certain types of queries
              let relationshipBoost = 0;
              if (isPersonalQuery && 
                  (relationship.relationshipType === 'participatesIn' || 
                   relationship.relationshipType === 'hasParticipant' ||
                   relationship.relationshipType === 'mentions' ||
                   relationship.relationshipType === 'mentionedBy')) {
                relationshipBoost = 0.2;
              }
              
              // Apply attention weight boost if kernel is currently attended to
              const attentionBoost = this.cognitiveMetadata.attentionWeights[relatedKernelRef] || 0;
              
              // Apply context relevance boost if kernel is relevant to current context
              const contextBoost = this.cognitiveMetadata.contextRelevance[relatedKernelRef] || 0;
              
              // Add to traversal queue with combined score for prioritization
              traversalQueue.push({ 
                ...relatedKernel, 
                reference: relatedKernelRef,
                // Combine relationship weight with relevance score, adding boosts
                relevanceScore: (relationship.weight * 0.3) + 
                               (adjustedRelevance * 0.5) + 
                               relationshipBoost + 
                               (attentionBoost * 0.1) +
                               (contextBoost * 0.1)
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
    
    // For personal queries, log information about Person kernels in context
    if (isPersonalQuery) {
      const personKernelsInContext = context.filter(k => 
        k.data && k.data.schemaType === 'Person'
      );
      
      if (personKernelsInContext.length > 0) {
        this.logger.log(`[UOR] Context contains ${personKernelsInContext.length} Person kernels for personal query`);
        personKernelsInContext.forEach(k => {
          if (k.data && k.data.properties) {
            this.logger.log(`[UOR] Person kernel properties: ${JSON.stringify(k.data.properties)}`);
          }
        });
      } else {
        this.logger.log(`[UOR] No Person kernels found in context for personal query`);
      }
    }
    
    // Apply decay to attention weights for kernels not included in the traversal
    this.decayAttentionWeights(Array.from(visitedKernelRefs));
    
    return context;
  }

  /**
   * Decay attention weights for kernels not recently visited
   * @param {Array} visitedRefs - References of kernels that were just visited
   * @param {number} decayRate - Rate at which to decay attention (default 0.1)
   */
  decayAttentionWeights(visitedRefs, decayRate = 0.1) {
    // Get all kernel references
    const allRefs = Array.from(this.uorGraph.keys());
    
    // For each kernel not in the visited set, decay its attention weight
    allRefs.forEach(ref => {
      if (!visitedRefs.includes(ref)) {
        const currentWeight = this.cognitiveMetadata.attentionWeights[ref] || 0.5;
        // Apply decay but ensure it doesn't go below minimum threshold
        const newWeight = Math.max(0.1, currentWeight - decayRate);
        this.cognitiveMetadata.attentionWeights[ref] = newWeight;
        
        // Update the kernel's cognitive metadata
        const kernel = this.uorGraph.get(ref);
        if (kernel && kernel.cognitiveMetadata) {
          kernel.cognitiveMetadata.attentionWeight = newWeight;
        }
      }
    });
  }

  /**
   * Get the set of kernels currently in working memory
   * @param {number} recencyThreshold - Time threshold in ms (default 5 minutes)
   * @returns {Set} - Set of kernel references in working memory
   */
  getWorkingMemorySet(recencyThreshold = 5 * 60 * 1000) {
    const workingMemorySet = new Set();
    const currentTime = Date.now();
    
    // Find all kernels accessed within the recency threshold
    for (const [ref, kernel] of this.uorGraph.entries()) {
      const lastAccessTime = this.cognitiveMetadata.lastAccessTime[ref] || 0;
      if (currentTime - lastAccessTime < recencyThreshold) {
        workingMemorySet.add(ref);
      }
    }
    
    return workingMemorySet;
  }

  /**
   * Update cognitive metadata for a kernel
   * @param {string} kernelRef - The kernel reference
   * @param {Object} metadata - The metadata to update
   */
  updateKernelCognitiveMetadata(kernelRef, metadata) {
    // Update the in-memory tracking objects
    if (metadata.lastAccessed) {
      this.cognitiveMetadata.lastAccessTime[kernelRef] = metadata.lastAccessed;
    }
    
    if (metadata.attentionWeight !== undefined) {
      this.cognitiveMetadata.attentionWeights[kernelRef] = metadata.attentionWeight;
    }
    
    if (metadata.isInWorkingMemory !== undefined) {
      this.cognitiveMetadata.workingMemoryStatus[kernelRef] = metadata.isInWorkingMemory;
    }
    
    // Update the kernel object itself if it exists
    const kernel = this.uorGraph.get(kernelRef);
    if (kernel) {
      kernel.cognitiveMetadata = {
        ...kernel.cognitiveMetadata || {},
        ...metadata
      };
    }
  }

  /**
   * Find the current context kernel, or create one if it doesn't exist
   * @returns {Object|null} The context kernel or null
   */
  findContextKernel() {
    // If we already have a reference, try to retrieve it
    if (this.contextKernelRef) {
      try {
        return this.retrieveObject(this.contextKernelRef);
      } catch (error) {
        this.logger.error(`[UOR] Error retrieving context kernel: ${error.message}`);
        this.contextKernelRef = null; // Reset if not found
      }
    }
    
    // Look for any existing context kernel
    for (const [ref, kernel] of this.uorGraph.entries()) {
      if (kernel.data && kernel.data.schemaType === 'Context') {
        this.contextKernelRef = ref;
        return kernel;
      }
    }
    
    // No context kernel found, return null
    return null;
  }

  /**
   * Aggregate kernels into higher-level context
   * Enhanced to better prioritize schema-typed kernels
   * @param {Array} context - The context to be aggregated
   * @returns {Array} - The higher-level aggregated context
   */
  aggregateContext(context) {
    this.logger.log(`[UOR] Aggregating context of ${context.length} kernels`);
    
    // Identify schema-typed kernels for special handling
    const schemaKernels = context.filter(k => k.data && k.data.schemaType);
    const regularKernels = context.filter(k => !k.data || !k.data.schemaType);
    
    this.logger.log(`[UOR] Context contains ${schemaKernels.length} schema-typed kernels and ${regularKernels.length} regular kernels`);
    
    // Always prioritize schema-typed kernels (especially Person kernels)
    schemaKernels.sort((a, b) => {
      // Prioritize Person kernels first
      if (a.data.schemaType === 'Person' && b.data.schemaType !== 'Person') return -1;
      if (a.data.schemaType !== 'Person' && b.data.schemaType === 'Person') return 1;
      
      // Then sort by relevance
      return (b.relevanceScore || 0) - (a.relevanceScore || 0);
    });
    
    // Apply attention weights to regular kernels
    regularKernels.forEach(kernel => {
      const ref = kernel.reference;
      const attentionWeight = this.cognitiveMetadata.attentionWeights[ref] || 0.5;
      kernel.relevanceScore = (kernel.relevanceScore || 0) * (0.7 + (attentionWeight * 0.3));
    });
    
    // Sort regular kernels by adjusted relevance
    regularKernels.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    
    // If context is already small enough, return the prioritized list
    if (estimateTokenCount([...schemaKernels, ...regularKernels]) <= 1000 / 2) {
      return [...schemaKernels, ...regularKernels];
    }
    
    // Organize context into levels based on relevance scores
    const contextLevels = {
      level1: [], // Basic - highest relevance, direct facts
      level2: [], // Intermediate - medium relevance, related concepts
      level3: []  // Higher-level - lower relevance, background context
    };
    
    // All schema kernels go into level 1 (highest priority)
    contextLevels.level1.push(...schemaKernels);
    
    // Classify regular kernels into levels
    for (const kernel of regularKernels) {
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

export default UORCortex;