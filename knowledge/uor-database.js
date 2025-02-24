// uor-database.js
// Manages object storage and retrieval in the UOR graph structure using IndexedDB

class UORDatabase {
  constructor() {
    this.db = null; // This will hold the IndexedDB connection
    this.dbName = 'UOR_Knowledge_DB'; // IndexedDB database name
    this.objectStoreName = 'kernels'; // Object store name where kernels will be stored
  }

  /**
   * Opens the IndexedDB and creates the necessary object store for UOR kernels.
   * @returns {Promise<void>}
   */
  async openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
  
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.objectStoreName)) {
          db.createObjectStore(this.objectStoreName, { keyPath: 'kernelReference' });
        }
      };
  
      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(); // Database opened successfully
      };
  
      request.onerror = (event) => {
        console.error('Failed to open the database:', event.target.errorCode);
        reject('Database failed to open.');
      };
    });
  }

  /**
   * Stores a kernel (object) in IndexedDB.
   * @param {Object} kernel - The kernel object to store.
   * @returns {Promise<void>}
   */
  async storeObject(kernel) {
    if (!this.db) {
      throw new Error('Database is not initialized.');
    }
  
    if (!kernel || !kernel.kernelReference) {
      throw new Error('Invalid kernel object. Missing required kernelReference.');
    }
  
    const transaction = this.db.transaction([this.objectStoreName], 'readwrite');
    const objectStore = transaction.objectStore(this.objectStoreName);
  
    return new Promise((resolve, reject) => {
      const request = objectStore.put(kernel);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(`Failed to store object: ${event.target.errorCode}`);
    });
  }

  /**
   * Retrieves a kernel from IndexedDB by its reference.
   * @param {String} kernelReference - The reference of the kernel to retrieve.
   * @returns {Promise<Object|null>} - The kernel object or null if not found.
   */
  async retrieveObject(kernelReference) {
    const transaction = this.db.transaction([this.objectStoreName], 'readonly');
    const objectStore = transaction.objectStore(this.objectStoreName);

    return new Promise((resolve, reject) => {
      const request = objectStore.get(kernelReference);
      request.onsuccess = (event) => resolve(event.target.result || null);
      request.onerror = (event) => reject(`Failed to retrieve object: ${event.target.errorCode}`);
    });
  }

  /**
   * Resolves content based on the query object (kernel), tracing related kernels across the UOR graph.
   * @param {Object} queryKernel - The kernel representing the query to resolve.
   * @returns {Promise<Array>} - A promise that resolves with an array of related kernels.
   */
  async resolveContent(queryKernel) {
    const transaction = this.db.transaction([this.objectStoreName], 'readonly');
    const objectStore = transaction.objectStore(this.objectStoreName);

    return new Promise((resolve, reject) => {
      const relatedKernels = [];
      const request = objectStore.getAll();

      request.onsuccess = (event) => {
        const allKernels = event.target.result;

        // Find related kernels by checking relationships
        allKernels.forEach((kernel) => {
          if (this.isRelated(queryKernel, kernel)) {
            relatedKernels.push(kernel);
          }
        });
        
        resolve(relatedKernels);
      };

      request.onerror = (event) => reject(`Failed to resolve content: ${event.target.errorCode}`);
    });
  }

  /**
   * Determines if two kernels are related based on their encoded data and relationships.
   * @param {Object} kernel1 - The first kernel.
   * @param {Object} kernel2 - The second kernel.
   * @returns {boolean} - Returns true if the kernels are related.
   */
  isRelated(kernel1, kernel2) {
    // Check if there are relationships between kernel1 and kernel2
    // For simplicity, checking based on the `encodedRepresentation`
    return kernel1.encodedRepresentation === kernel2.encodedRepresentation;
  }

  /**
   * Links two kernels in the UOR graph, defining their semantic relationship.
   * @param {String} kernel1Ref - The reference of the first kernel.
   * @param {String} kernel2Ref - The reference of the second kernel.
   * @param {String} relationship - The relationship between the two kernels.
   * @returns {Promise<void>}
   */
  async linkObjects(kernel1Ref, kernel2Ref, relationship) {
    const kernel1 = await this.retrieveObject(kernel1Ref);
    const kernel2 = await this.retrieveObject(kernel2Ref);

    if (!kernel1 || !kernel2) {
      throw new Error('One or both kernels not found');
    }

    // Create and store relationship data in both kernels
    const relationshipData = { kernel1Ref, kernel2Ref, relationship };

    if (!kernel1.relationships) kernel1.relationships = [];
    if (!kernel2.relationships) kernel2.relationships = [];

    kernel1.relationships.push(relationshipData);
    kernel2.relationships.push(relationshipData);

    // Store updated kernels with the new relationship
    await this.storeObject(kernel1);
    await this.storeObject(kernel2);
  }

  /**
   * Checks the consistency of the UOR graph and ensures that there are no violations of the coherence norm.
   * @returns {Promise<void>}
   */
  async checkConsistency() {
    const allKernels = await this.getAllKernels();
    
    // Validate each kernel for consistency
    allKernels.forEach((kernel) => {
      // Check for consistency in terms of structure and relationships
      if (!kernel.data || !kernel.encodedRepresentation) {
        throw new Error('Kernel data or encoded representation is missing');
      }
    });
  }

  /**
   * Retrieves all kernels in the UOR database.
   * @returns {Promise<Array>} - A promise that resolves with an array of all kernels in the graph.
   */
  async getAllKernels() {
    const transaction = this.db.transaction([this.objectStoreName], 'readonly');
    const objectStore = transaction.objectStore(this.objectStoreName);

    return new Promise((resolve, reject) => {
      const request = objectStore.getAll();
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(`Failed to retrieve all objects: ${event.target.errorCode}`);
    });
  }

  /**
   * Resolves content and packs it into context for response generation.
   * @param {Object} queryKernel - The kernel representing the query to resolve.
   * @param {number} tokenLimit - The token limit to manage context size.
   * @returns {Promise<Array>} - A promise that resolves with the packed context.
   */
  async resolveAndPackContext(queryKernel, tokenLimit) {
    const context = [];
    let currentQuery = queryKernel;

    // Traverse related kernels and add them to the context until reaching token limit
    while (context.length < tokenLimit) {
      const relatedKernels = await this.resolveContent(currentQuery);
      
      for (let kernel of relatedKernels) {
        context.push(kernel);
        if (context.length >= tokenLimit) {
          break;
        }
      }

      if (context.length < tokenLimit) {
        // Adjust this method to select the next query from the current context (if necessary)
        currentQuery = selectNextQuery(context);
      }
    }

    return context;
  }
}

export default UORDatabase; // Default export of the UORDatabase class
