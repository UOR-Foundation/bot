// kernel-creator.js
// Creates UOR kernels from semantic entities

/**
 * KernelCreator class handles creation of UOR kernels from semantic entities
 */
class KernelCreator {
  constructor(uorCortex) {
    this.uorCortex = uorCortex;
    this.logger = console; // Logger (can be replaced with a custom one)
  }
  
  /**
   * Create UOR kernels based on semantic entities
   * @param {Object} semantics - The semantic structure
   * @returns {Array} Array of created kernels
   */
  createKernelsFromSemantics(semantics) {
    this.logger.log(`Creating kernels from semantics with ${semantics.entities.length} entities`);
    
    const createdKernels = [];
    const entityKernelMap = new Map(); // Maps entity IDs to kernel references
    
    try {
      // First, create or update conversation kernel
      let conversationKernelRef = null;
      
      // Try to find an existing conversation kernel
      const allKernels = this.uorCortex.getAllKernels();
      const existingConversationKernel = allKernels.find(k => 
        k.data && k.data.schemaType === 'Conversation'
      );
      
      if (existingConversationKernel) {
        conversationKernelRef = existingConversationKernel.reference;
        this.logger.log(`Found existing conversation kernel: ${conversationKernelRef}`);
      } else {
        // Create a new conversation kernel if none exists
        const conversationKernel = this.uorCortex.createKernel({
          schemaType: 'Conversation',
          properties: {
            startTime: new Date().toISOString(),
            turns: []
          },
          timestamp: Date.now()
        });
        conversationKernelRef = conversationKernel.kernelReference;
        createdKernels.push(conversationKernel);
        this.logger.log(`Created new conversation kernel: ${conversationKernelRef}`);
      }
      
      // Create kernels for each entity
      for (const entity of semantics.entities) {
        // For Person entities, check if we already have one
        if (entity.type === 'Person') {
          const existingPersonKernel = allKernels.find(k => 
            k.data && k.data.schemaType === 'Person'
          );
          
          if (existingPersonKernel) {
            // Update existing person kernel with new properties
            const updatedProperties = {
              ...existingPersonKernel.data.properties,
              ...entity.properties
            };
            
            const updatedKernel = this.uorCortex.createKernel({
              schemaType: 'Person',
              properties: updatedProperties,
              entityId: entity.id,
              timestamp: Date.now()
            });
            
            this.logger.log(`Updated existing Person kernel: ${updatedKernel.kernelReference}`);
            this.logger.log(`Updated properties: ${JSON.stringify(updatedProperties)}`);
            
            createdKernels.push(updatedKernel);
            entityKernelMap.set(entity.id, updatedKernel.kernelReference);
            
            // Also link to conversation if not already linked
            this.uorCortex.linkObjects(
              updatedKernel.kernelReference,
              conversationKernelRef,
              'participatesIn'
            );
            
            continue; // Skip creating a new kernel
          }
        }
        
        // Create new kernel for this entity
        const kernelData = {
          schemaType: entity.type,
          properties: entity.properties,
          entityId: entity.id,
          timestamp: Date.now()
        };
        
        const kernel = this.uorCortex.createKernel(kernelData);
        createdKernels.push(kernel);
        entityKernelMap.set(entity.id, kernel.kernelReference);
        
        this.logger.log(`Created kernel for ${entity.type}: ${kernel.kernelReference}`);
        
        // Link entity to conversation if applicable
        if (entity.type === 'Person' || entity.type === 'Question') {
          this.uorCortex.linkObjects(
            kernel.kernelReference,
            conversationKernelRef,
            entity.type === 'Person' ? 'participatesIn' : 'partOf'
          );
          this.logger.log(`Linked ${entity.type} to conversation`);
        }
      }
      
      // Then, establish relationships between kernels
      for (const relationship of semantics.relationships) {
        const sourceKernelRef = entityKernelMap.get(relationship.source);
        const targetKernelRef = entityKernelMap.get(relationship.target);
        
        // Handle special case for 'conversation' which might not be an entity
        let targetRef = targetKernelRef;
        if (relationship.target === 'conversation') {
          targetRef = conversationKernelRef;
        }
        
        if (sourceKernelRef && targetRef) {
          this.uorCortex.linkObjects(sourceKernelRef, targetRef, relationship.type);
          this.logger.log(`Linked kernels: ${sourceKernelRef} -[${relationship.type}]-> ${targetRef}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error creating kernels from semantics: ${error.message}`);
      this.logger.error(error.stack);
    }
    
    return createdKernels;
  }
  
  /**
   * Create a query kernel from user input and semantics
   * @param {string} userQuery - The original user query text
   * @param {Object} semantics - The parsed semantic information
   * @returns {Object} The created query kernel reference
   */
  createQueryKernel(userQuery, semantics) {
    this.logger.log(`Creating query kernel for: "${userQuery}"`);
    
    // Create a query kernel that includes semantic information
    const queryObject = { 
      type: "query",
      text: userQuery,
      timestamp: Date.now(),
      semantics: semantics,
      intents: semantics.intents
    };
    
    // Create the query kernel
    const queryKernel = this.uorCortex.createKernel(queryObject);
    this.logger.log(`Created query kernel: ${queryKernel.kernelReference}`);
    
    return queryKernel;
  }
  
  /**
   * Link a query kernel to created entity kernels
   * @param {Object} queryKernel - The query kernel
   * @param {Array} createdKernels - Array of created entity kernels
   */
  linkQueryToEntities(queryKernel, createdKernels) {
    for (const kernel of createdKernels) {
      this.uorCortex.linkObjects(
        queryKernel.kernelReference,
        kernel.kernelReference,
        'mentions'
      );
      this.logger.log(`Linked query to ${kernel.kernelReference} with mentions relationship`);
    }
  }
}

export default KernelCreator;