/**
 * bot.js - Core chatbot implementation that uses bot1.js cognitive layer
 * This version calls into bot1.js for structured knowledge and reasoning
 */

// Import bot1's cognitive capabilities
import {
    initBot as initBot1,
    analyzeInput,
    storeAxioms,
    retrieveContext,
    checkContradiction,
    verifyResponse,
    addExternalKnowledge,
    ensureCoherence,
    getEntityFacts,
    getExternalInfo,
    storeExternalInfo,
    persistKnowledgeBase
  } from './bot1.js';
  
  // Load Transformers.js
  import { pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.11.0";
  
  // Global state
  let generator = null;
  let isInitialized = false;
  
  /**
   * Initialize the chatbot
   */
  export async function initBot() {
    if (isInitialized) return;
    
    try {
      console.log("Initializing chatbot...");
      
      // Initialize bot1's cognitive layer first
      await initBot1();
      
      // Initialize the text generation model 
      generator = await pipeline('text-generation', 'Xenova/gpt2', {
        quantized: true,
        revision: 'main'
      });
  
      isInitialized = true;
      console.log("Chatbot initialization complete");
    } catch (err) {
      console.error("Failed to initialize chatbot:", err);
      throw err;
    }
  }
  
  /**
   * Main message handler - uses bot1's cognitive capabilities
   */
  export async function handleSendMessage(userInput) {
    if (!isInitialized) {
      throw new Error("Chatbot not initialized");
    }
  
    try {
      // 1. Extract and process facts using bot1
      const facts = await analyzeInput(userInput);
      if (facts.length > 0) {
        for (const fact of facts) {
          const contradiction = await checkContradiction(fact);
          if (contradiction) {
            return constructClarificationRequest(fact, contradiction);
          }
          await storeAxioms([fact], "user");
        }
      }
  
      // 2. Handle special queries
      if (isSpecialQuery(userInput)) {
        return handleSpecialQuery(userInput);
      }
  
      // 3. Get context from bot1
      const context = await retrieveContext(userInput);
  
      // 4. Augment with external knowledge if needed
      let augmentedContext = context;
      if (shouldFetchExternalKnowledge(userInput, context)) {
        const externalInfo = await fetchExternalContent(userInput);
        if (externalInfo) {
          augmentedContext = await addExternalKnowledge(context, externalInfo);
        }
      }
  
      // 5. Generate and verify response
      const response = await generateResponse(userInput, augmentedContext);
      
      const verificationResult = await verifyResponse(response);
      if (!verificationResult.isValid) {
        return await generateResponse(userInput, augmentedContext, true);
      }
  
      // 6. Store interaction
      await storeAxioms([{
        entity: 'conversation',
        type: 'Interaction',
        attribute: 'userInput',
        value: userInput,
        timestamp: Date.now()
      }], 'conversation');
  
      return response;
  
    } catch (err) {
      console.error("Error handling message:", err);
      return "I apologize, but I encountered an error. Could you try rephrasing that?";
    }
  }
  
  /**
   * Generate a response using the context and query
   */
  async function generateResponse(query, context, emphasizeFacts = false) {
    const prompt = constructPrompt(query, context, emphasizeFacts);
    
    try {
      const output = await generator(prompt, {
        max_length: 200,
        num_return_sequences: 1,
        temperature: emphasizeFacts ? 0.3 : 0.7,
        top_p: emphasizeFacts ? 0.85 : 0.9,
        do_sample: true
      });
  
      let response = Array.isArray(output) ? output[0].generated_text : output;
      response = cleanResponse(response, prompt);
      return response;
  
    } catch (err) {
      console.error("Generation error:", err);
      return "I apologize, but I couldn't generate a proper response.";
    }
  }
  
  /**
   * Construct a prompt with appropriate context
   */
  function constructPrompt(query, context, emphasizeFacts) {
    let prompt = '';
    
    if (context && context.trim()) {
      prompt += 'Facts I Know:\n';
      prompt += context;
      prompt += '\n\n';
      
      if (emphasizeFacts) {
        prompt += 'IMPORTANT: You must use the facts above in your response.\n\n';
      }
    }
  
    prompt += `User: ${query}\n`;
    prompt += 'Assistant: ';
    
    return prompt;
  }
  
  /**
   * Clean and format the generated response
   */
  function cleanResponse(response, prompt) {
    if (response.startsWith(prompt)) {
      response = response.slice(prompt.length);
    }
    
    response = response.split(/User:|Assistant:/)[0];
    
    return response.trim()
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ');
  }
  
  /**
   * Check if input is a special query
   */
  function isSpecialQuery(input) {
    const specialPatterns = [
      /what.*your name/i,
      /who.*you/i,
      /what.*my name/i,
      /do you remember/i
    ];
    
    return specialPatterns.some(pattern => pattern.test(input));
  }
  
  /**
   * Handle special queries
   */
  async function handleSpecialQuery(input) {
    if (/what.*your name/i.test(input)) {
      return "I'm an AI chatbot assistant.";
    }
    
    if (/what.*my name/i.test(input)) {
      const userFacts = await getEntityFacts('user');
      const nameFact = userFacts.find(f => f.attribute === 'name');
      return nameFact ? `Your name is ${nameFact.value}.` : "I'm not sure of your name yet.";
    }
    
    return null;
  }
  
  /**
   * Determine if external knowledge should be fetched
   */
  function shouldFetchExternalKnowledge(query, context) {
    if (/my|me|i am|i'm/i.test(query)) {
      return false;
    }
    
    const hasContext = context && context.split(' ').length > 20;
    return !hasContext;
  }
  
  /**
   * Create a clarification request for contradictions
   */
  function constructClarificationRequest(newFact, existingFact) {
    return `I notice a contradiction: earlier I learned that ${existingFact.entity} ${existingFact.attribute} is ${existingFact.value}, but now you're telling me it's ${newFact.value}. Which is correct?`;
  }
  
  /**
   * Fetch external content (Wikipedia)
   */
  async function fetchExternalContent(query) {
    const cached = await getExternalInfo(query);
    if (cached) return cached;
  
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
      const response = await fetch(searchUrl);
      const data = await response.json();
  
      if (data.query?.search?.length > 0) {
        const pageId = data.query.search[0].pageid;
        const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&pageids=${pageId}&format=json&origin=*`;
        
        const contentResponse = await fetch(contentUrl);
        const contentData = await contentResponse.json();
        
        const extract = contentData.query?.pages[pageId]?.extract;
        if (extract) {
          await storeExternalInfo(query, extract, 'wikipedia');
          return extract;
        }
      }
    } catch (err) {
      console.warn("Error fetching from Wikipedia:", err);
    }
    
    return '';
  }
  
  /**
   * Load PDFs into knowledge base
   */
  export async function loadPDFKnowledgeBase(files) {
    if (!files?.length) return;
    
    for (const file of files) {
      if (file.type !== 'application/pdf') continue;
      
      try {
        const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise;
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          
          const facts = await analyzeInput(pageText);
          if (facts.length > 0) {
            await storeAxioms(facts, 'pdf');
          }
        }
      } catch (err) {
        console.error(`Error processing PDF ${file.name}:`, err);
      }
    }
  }
  
  /**
   * Persist state
   */
  export async function persist() {
    await persistKnowledgeBase();
  }