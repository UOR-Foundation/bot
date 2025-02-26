// response/domain-response.js
// Specialized response generation for domain knowledge queries

/**
 * Handles the generation of responses for domain-specific knowledge queries
 * within the UOR framework. This specializes in structuring technical
 * information from the UOR graph into coherent explanations.
 */
class DomainResponseGenerator {
  /**
   * Creates a new DomainResponseGenerator instance
   * @param {Object} uorCortex - The UOR Cortex for knowledge representation
   */
  constructor(uorCortex) {
    this.uorCortex = uorCortex;
    this.logger = console; // Logger (can be replaced with a custom one)
    
    // Domain-specific response templates for different concepts
    this.conceptTemplates = {
      "UOR Framework": "The Universal Object Reference (UOR) framework {0}. It {1}.",
      "Token Limits": "Token limits are important because {0}. They {1}.",
      "Context Packing": "Context packing is a technique where {0}. This helps {1}.",
      "Knowledge Graph": "A knowledge graph structure {0}. This enables {1}.",
      "Lattice Traversal": "Traversing the UOR lattice means {0}, which allows {1}."
    };
    
    // Connectors to combine facts elegantly
    this.factConnectors = [
      "Additionally, ",
      "Furthermore, ",
      "Moreover, ",
      "It's also worth noting that ",
      "Another important aspect is that "
    ];
    
    // Relationship phrase templates to make connections sound natural
    this.relationshipPhrases = {
      "relates_to": "{0} is related to {1}",
      "requires": "{0} requires {1}",
      "implements": "{0} implements {1}",
      "uses": "{0} uses {1}",
      "defines": "{0} defines {1}",
      "contains": "{0} contains {1}",
      "partOf": "{0} is part of {1}",
      "hasPart": "{0} has {1} as a component",
      "depends_on": "{0} depends on {1}",
      "influences": "{0} influences {1}"
    };
  }

  /**
   * Generate a domain-specific response based on context and semantics
   * @param {Object} context - The aggregated context from UOR traversal
   * @param {Object} semantics - The semantic understanding of the query
   * @returns {string} The generated domain response
   */
  generateDomainResponse(context, semantics) {
    this.logger.log(`Generating domain response for query: "${semantics.original}"`);
    
    // Extract the most relevant facts and relationships
    const relevantFacts = this.extractRelevantFacts(context);
    const keyRelationships = this.extractKeyRelationships(context);
    
    // Formulate a domain explanation using the extracted knowledge
    const response = this.formulateDomainExplanation(relevantFacts, keyRelationships, semantics);
    
    this.logger.log(`Generated domain response using ${relevantFacts.length} facts and ${keyRelationships.length} relationships`);
    
    return response;
  }

  /**
   * Extract the most relevant facts from the context
   * @param {Object} context - The aggregated context
   * @returns {Array} Array of relevant facts with metadata
   */
  extractRelevantFacts(context) {
    const facts = [];
    
    // Extract facts from context kernels
    const kernels = context.aggregatedKernels || [];
    
    kernels.forEach(kernel => {
      if (!kernel || !kernel.data) return;
      
      // Skip irrelevant kernels with very low relevance
      if (kernel.relevanceScore && kernel.relevanceScore < 0.05) return;
      
      // Extract facts from different types of kernels
      if (typeof kernel.data === 'object') {
        // Handle structured kernels with title/content
        if (kernel.data.title && kernel.data.content) {
          facts.push({
            title: kernel.data.title,
            content: kernel.data.content,
            relevanceScore: kernel.relevanceScore || 0.5,
            reference: kernel.reference,
            type: 'contentKernel'
          });
        } 
        // Handle schema-typed kernels
        else if (kernel.data.schemaType && kernel.data.schemaType !== 'Person') {
          facts.push({
            title: kernel.data.schemaType,
            content: this.formatSchemaProperties(kernel.data.properties),
            relevanceScore: kernel.relevanceScore || 0.5,
            reference: kernel.reference,
            type: 'schemaKernel',
            schemaType: kernel.data.schemaType
          });
        }
      } 
      // Handle string or primitive data kernels
      else if (kernel.data) {
        facts.push({
          content: String(kernel.data),
          relevanceScore: kernel.relevanceScore || 0.3,
          reference: kernel.reference,
          type: 'simpleKernel'
        });
      }
    });
    
    // Sort facts by relevance score (highest first)
    facts.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    return facts;
  }

  /**
   * Format schema properties into a readable string
   * @param {Object} properties - The properties object from a schema kernel
   * @returns {string} Formatted string of properties
   */
  formatSchemaProperties(properties) {
    if (!properties || typeof properties !== 'object') {
      return "no specific properties available";
    }
    
    const propertyStrings = Object.entries(properties)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    
    return propertyStrings || "no specific properties available";
  }

  /**
   * Extract key relationships from the context
   * @param {Object} context - The aggregated context
   * @returns {Array} Array of important relationships
   */
  extractKeyRelationships(context) {
    const relationships = [];
    const keyRelationships = context.keyRelationships || [];
    
    // Process existing relationships
    keyRelationships.forEach(rel => {
      if (!rel.source || !rel.target) return;
      
      relationships.push({
        source: rel.source,
        sourceTitle: rel.sourceTitle || 'Unknown',
        target: rel.target,
        targetTitle: rel.targetTitle || 'Unknown',
        relationship: rel.relationship,
        weight: rel.weight || 1.0
      });
    });
    
    // Build a map of all kernels by reference for title lookup
    const kernelMap = new Map();
    (context.aggregatedKernels || []).forEach(kernel => {
      if (kernel && kernel.reference) {
        kernelMap.set(kernel.reference, kernel);
      }
    });
    
    // Find additional relationships between kernels if needed
    if (relationships.length === 0) {
      (context.aggregatedKernels || []).forEach(kernel => {
        if (!kernel || !kernel.relationships) return;
        
        kernel.relationships.forEach(rel => {
          if (!rel.targetKernelRef) return;
          
          const targetKernel = kernelMap.get(rel.targetKernelRef);
          if (!targetKernel) return;
          
          // Get titles from kernel data
          let sourceTitle = 'Unknown';
          let targetTitle = 'Unknown';
          
          if (kernel.data) {
            sourceTitle = kernel.data.title || 
                           (kernel.data.schemaType ? kernel.data.schemaType : 'Unknown');
          }
          
          if (targetKernel.data) {
            targetTitle = targetKernel.data.title || 
                           (targetKernel.data.schemaType ? targetKernel.data.schemaType : 'Unknown');
          }
          
          relationships.push({
            source: kernel.reference,
            sourceTitle: sourceTitle,
            target: rel.targetKernelRef,
            targetTitle: targetTitle,
            relationship: rel.relationshipType,
            weight: rel.weight || 1.0
          });
        });
      });
    }
    
    // Sort relationships by weight (most important first)
    relationships.sort((a, b) => b.weight - a.weight);
    
    return relationships;
  }

  /**
   * Create a coherent domain explanation from facts and relationships
   * @param {Array} facts - Relevant facts extracted from context
   * @param {Array} relationships - Key relationships between concepts
   * @param {Object} semantics - The semantic understanding of the query
   * @returns {string} The formulated domain explanation
   */
  formulateDomainExplanation(facts, relationships, semantics) {
    // If no facts found, provide a generic response
    if (facts.length === 0) {
      return "I don't have specific information about that in my knowledge base. " +
             "The UOR framework is designed to represent and retrieve knowledge " +
             "across a distributed graph of semantic kernels, but this topic " +
             "may not be covered yet.";
    }
    
    // Check if we should use a concept template
    const mainFact = facts[0];
    const conceptTemplate = mainFact.title ? this.conceptTemplates[mainFact.title] : null;
    let response = "";
    
    if (conceptTemplate && facts.length >= 2) {
      // Use template with the top two facts
      response = conceptTemplate
        .replace("{0}", this.extractMainClause(facts[0].content))
        .replace("{1}", this.extractMainClause(facts[1].content));
      
      // Add a third fact if available
      if (facts.length >= 3) {
        const connector = this.factConnectors[Math.floor(Math.random() * this.factConnectors.length)];
        response += " " + connector + this.extractMainClause(facts[2].content) + ".";
      }
    } else {
      // Create a response from scratch using the most relevant facts
      response = this.extractMainClause(facts[0].content) + ". ";
      
      // Add a second fact with a connector if available
      if (facts.length >= 2) {
        const connector = this.factConnectors[Math.floor(Math.random() * this.factConnectors.length)];
        response += connector + this.extractMainClause(facts[1].content) + ". ";
      }
      
      // Add a third fact if highly relevant
      if (facts.length >= 3 && facts[2].relevanceScore > 0.4) {
        const connector = this.factConnectors[Math.floor(Math.random() * this.factConnectors.length)];
        response += connector + this.extractMainClause(facts[2].content) + ".";
      }
    }
    
    // Add relationship context if available
    if (relationships.length > 0) {
      const rel = relationships[0];
      const relationshipPhrase = this.relationshipPhrases[rel.relationship] || 
                                "{0} is connected to {1}";
      
      const relationshipStatement = relationshipPhrase
        .replace("{0}", rel.sourceTitle)
        .replace("{1}", rel.targetTitle);
      
      response += " " + relationshipStatement + ".";
      
      // Add a second relationship if available and relevant
      if (relationships.length > 1 && 
          relationships[0].source !== relationships[1].source &&
          relationships[0].target !== relationships[1].target) {
        const rel2 = relationships[1];
        const relationshipPhrase2 = this.relationshipPhrases[rel2.relationship] || 
                                  "{0} is connected to {1}";
        
        const relationshipStatement2 = relationshipPhrase2
          .replace("{0}", rel2.sourceTitle)
          .replace("{1}", rel2.targetTitle);
        
        response += " " + relationshipStatement2 + ".";
      }
    }
    
    // If the query appears to be a direct "what is X" question about a concept
    // that matches our main fact, format it more directly as a definition
    const whatIsMatch = semantics.original && 
                      semantics.original.match(/^what\s+is\s+([a-zA-Z\s]+)/i);
    
    if (whatIsMatch && whatIsMatch[1] && mainFact.title && 
        mainFact.title.toLowerCase().includes(whatIsMatch[1].toLowerCase())) {
      // Format as a direct definition
      return `${mainFact.title} is ${this.extractDefinition(mainFact.content)}. ${
        this.extractAdditionalInfo(response, mainFact.title)
      }`;
    }
    
    return response;
  }

  /**
   * Extract the main clause from a text, removing punctuation
   * @param {string} text - The source text
   * @returns {string} The main clause
   */
  extractMainClause(text) {
    if (!text) return "";
    
    // Remove trailing punctuation
    let mainClause = text.trim().replace(/[.!?]+$/, "");
    
    // If it's a very long text, try to extract first sentence
    if (mainClause.length > 100) {
      const firstSentence = mainClause.split(/[.!?]/).filter(s => s.trim().length > 0)[0];
      if (firstSentence && firstSentence.length > 20) {
        return firstSentence.trim();
      }
    }
    
    return mainClause;
  }

  /**
   * Extract a definition-style content from text
   * @param {string} text - The source text
   * @returns {string} The definition
   */
  extractDefinition(text) {
    if (!text) return "";
    
    // Look for "is a" or similar definition patterns
    const isAMatch = text.match(/\b(is an?|refers to|describes)\b\s+([^.!?]+)/i);
    
    if (isAMatch && isAMatch[2]) {
      return isAMatch[2].trim();
    }
    
    // If no pattern found, just return the first part of the text
    const firstPart = text.split(/[.!?]/)[0].trim();
    if (firstPart.length > 10) {
      return firstPart;
    }
    
    return text;
  }

  /**
   * Extract additional information from text, excluding mentions of the main concept
   * @param {string} text - The source text
   * @param {string} concept - The main concept to exclude
   * @returns {string} The additional information
   */
  extractAdditionalInfo(text, concept) {
    if (!text) return "";
    
    // Split into sentences
    const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 0);
    
    // Filter out sentences that mainly define the concept
    const additionalSentences = sentences.filter(sentence => {
      const lowercaseSentence = sentence.toLowerCase();
      const lowercaseConcept = concept.toLowerCase();
      
      // Skip sentences that start with the concept followed by "is" or "refers to"
      return !(lowercaseSentence.trim().startsWith(lowercaseConcept) && 
               lowercaseSentence.match(new RegExp(`${lowercaseConcept}\\s+(is|refers to|describes)`, 'i')));
    });
    
    if (additionalSentences.length === 0) return "";
    
    return additionalSentences.map(s => s.trim()).join(". ") + ".";
  }
}

export default DomainResponseGenerator;
