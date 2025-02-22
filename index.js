// index.js
// Self-contained chatbot logic for GitHub Pages
// Uses IndexedDB to store the invariant knowledge base (from CBOR), user-uploaded documents, and chat history.
// Utilizes Transformers.js for in-browser embedding and question-answering, and PDF.js for parsing uploaded PDFs.

// --------------------------
// IndexedDB Initialization
// --------------------------
const DB_NAME = 'ChatbotDB';
const DB_VERSION = 1;
let db;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      db = event.target.result;
      db.createObjectStore('knowledge', { keyPath: 'id' });
      db.createObjectStore('documents', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('history', { autoIncrement: true });
    };
    request.onsuccess = (event) => {
      db = event.target.result;
      console.log('IndexedDB initialized');
      resolve();
    };
    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };
  });
}

// --------------------------
// Load Knowledge Base (CBOR)
// --------------------------
async function loadKnowledgeBase() {
  try {
    const response = await fetch('knowledge.cbor', { cache: "no-cache" });
    if (!response.ok) throw new Error('Failed to fetch knowledge.cbor');
    const arrayBuffer = await response.arrayBuffer();
    // Decode CBOR using the globally available CBOR.decode (from cbor-web)
    const KB_ITEMS = CBOR.decode(new Uint8Array(arrayBuffer));
    const tx = db.transaction('knowledge', 'readwrite');
    const store = tx.objectStore('knowledge');
    store.clear();
    KB_ITEMS.forEach((item, index) => {
      if (!item.id) item.id = index;
      store.put(item);
    });
    await tx.complete;
    console.log(`Loaded ${KB_ITEMS.length} knowledge items into IndexedDB`);
  } catch (err) {
    console.error('Error loading knowledge base:', err);
  }
}

// --------------------------
// Periodic Knowledge Base Update Check
// --------------------------
function setupPeriodicKBCheck() {
  setInterval(async () => {
    try {
      const headResp = await fetch('knowledge.cbor', { method: 'HEAD' });
      const remoteLastModified = headResp.headers.get('Last-Modified');
      const lastModifiedStored = localStorage.getItem('KB_LastModified');
      if (remoteLastModified && remoteLastModified !== lastModifiedStored) {
        console.log('New knowledge base detected, updating...');
        await loadKnowledgeBase();
        localStorage.setItem('KB_LastModified', remoteLastModified);
      }
    } catch (err) {
      console.warn('KB update check failed:', err);
    }
  }, 24 * 60 * 60 * 1000); // every 24 hours
}

// --------------------------
// Chat UI Elements and History
// --------------------------
const chatLog = document.getElementById('chat-log');
const userInputEl = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const fileInput = document.getElementById('file-input');

function appendMessage(role, text) {
  const msgDiv = document.createElement('div');
  msgDiv.className = role === 'user' ? 'user-message' : 'bot-message';
  msgDiv.textContent = (role === 'user' ? "You: " : "Bot: ") + text;
  chatLog.appendChild(msgDiv);
  chatLog.scrollTop = chatLog.scrollHeight;
  const tx = db.transaction('history', 'readwrite');
  tx.objectStore('history').add({ role, text, timestamp: Date.now() });
}

function loadChatHistory() {
  const tx = db.transaction('history', 'readonly');
  const store = tx.objectStore('history');
  const request = store.getAll();
  request.onsuccess = () => {
    const messages = request.result;
    messages.forEach(msg => {
      appendMessage(msg.role, msg.text);
    });
  };
}

// --------------------------
// Embedding and Similarity Functions
// --------------------------
let embedder = null;
async function embedText(text) {
  if (!embedder) {
    embedder = await window.transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('Embedding model loaded');
  }
  const result = await embedder(text, { pooling: 'mean', normalize: true });
  const embedding = result.data ? Array.from(result.data) : result.tolist()[0];
  return embedding;
}

function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
  const normB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
  return dot / (normA * normB);
}

async function getAllChunks() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['knowledge', 'documents'], 'readonly');
    const store1 = tx.objectStore('knowledge');
    const store2 = tx.objectStore('documents');
    let chunks = [];
    const req1 = store1.getAll();
    req1.onsuccess = () => {
      chunks = chunks.concat(req1.result);
      const req2 = store2.getAll();
      req2.onsuccess = () => {
        chunks = chunks.concat(req2.result);
        resolve(chunks);
      };
      req2.onerror = () => reject(req2.error);
    };
    req1.onerror = () => reject(req1.error);
  });
}

async function retrieveRelevantChunks(queryEmbedding, topK = 3) {
  const chunks = await getAllChunks();
  const scored = chunks.map(item => {
    if (!item.embedding) return { score: -Infinity, text: item.text };
    const score = cosineSimilarity(queryEmbedding, item.embedding);
    return { score, text: item.text };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

// --------------------------
// QA Pipeline for Answer Generation
// --------------------------
let qaPipeline = null;
async function answerQuery(question) {
  if (!qaPipeline) {
    qaPipeline = await window.transformers.pipeline('question-answering', 'Xenova/distilbert-base-uncased-distilled-squad');
    console.log('QA model loaded');
  }
  const queryEmbedding = await embedText(question);
  const topChunks = await retrieveRelevantChunks(queryEmbedding, 3);
  if (topChunks.length === 0) {
    return "I'm sorry, I don't have information on that.";
  }
  let context = topChunks.map(item => item.text).join('\n\n');
  if (context.length > 10000) {
    context = context.slice(0, 10000);
  }
  try {
    const result = await qaPipeline({ question: question, context: context });
    const answer = result.answer || "";
    return answer.length ? answer : "I couldn't find an answer.";
  } catch (err) {
    console.error('Error in QA pipeline:', err);
    return "Sorry, something went wrong generating the answer.";
  }
}

// --------------------------
// Chat Interaction Handling
// --------------------------
sendBtn.addEventListener('click', async () => {
  const question = userInputEl.value.trim();
  if (!question) return;
  appendMessage('user', question);
  userInputEl.value = '';
  appendMessage('bot', '...');
  const answer = await answerQuery(question);
  chatLog.lastChild.textContent = "Bot: " + answer;
});


// --------------------------
// PDF Upload Handling for User Documents
// --------------------------
fileInput.addEventListener('change', async () => {
  const files = Array.from(fileInput.files);
  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += "\n" + pageText;
      }
      const chunkSize = 1000;
      const chunks = [];
      for (let i = 0; i < fullText.length; i += chunkSize) {
        chunks.push(fullText.slice(i, i + chunkSize));
      }
      const tx = db.transaction('documents', 'readwrite');
      const docStore = tx.objectStore('documents');
      for (const chunk of chunks) {
        const embedding = await embedText(chunk);
        docStore.add({ text: chunk, embedding: embedding, source: file.name });
      }
      await tx.complete;
      console.log(`Processed and stored ${chunks.length} chunks from ${file.name}`);
      alert(`File "${file.name}" processed successfully.`);
    } catch (error) {
      console.error('Error processing uploaded PDF:', error);
      alert(`Error processing file "${file.name}". See console for details.`);
    }
  }
});

// --------------------------
// Initialize App on Page Load
// --------------------------
(async function initApp() {
  await initDB();
  loadChatHistory();
  await loadKnowledgeBase();
  setupPeriodicKBCheck();
  console.log('Chatbot app initialized.');
})();
