/**
 * index.js – Refactored Chatbot Implementation
 *
 * This script sets up an in‑browser SQLite database (via sql.js) to store documents and chat messages,
 * uses PDF.js to extract text from PDFs, and uses Transformers.js for computing text embeddings.
 * It also implements a chat UI that synthesizes coherent responses.
 *
 * Note: Ensure that sql-wasm.js is loaded via a <script> tag in your index.html so that the global
 * function initSqlJs is available.
 */

// --- Global Fetch Override ---
// Redirect any local model requests to Hugging Face Hub.
const originalFetch = window.fetch;
window.fetch = (input, init) => {
  if (typeof input === "string" && input.includes("/models/Xenova/all-MiniLM-L6-v2/")) {
    input = input.replace(
      /\/models\/Xenova\/all-MiniLM-L6-v2/,
      "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main"
    );
  }
  return originalFetch(input, init);
};

// --- Import Transformers Pipeline ---
import { pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.11.0";

// ============================================================
// Database Helpers
// ============================================================
const DB_NAME = "ChatbotDB";
const STORE_NAME = "sqliteFile";
const KEY_NAME = "dbFile";

let db = null; // SQL.Database instance

function openIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = (event) => {
      console.error("IndexedDB error", event);
      reject(event);
    };
    request.onupgradeneeded = (event) => {
      const idb = event.target.result;
      if (!idb.objectStoreNames.contains(STORE_NAME)) {
        idb.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
  });
}

function saveDBToIDB(dbBinary) {
  return openIDB().then((idb) => {
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const putRequest = store.put(dbBinary, KEY_NAME);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = (e) => reject(e);
    });
  });
}

function loadDBFromIDB() {
  return openIDB().then((idb) => {
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(KEY_NAME);
      getRequest.onsuccess = (e) => resolve(e.target.result);
      getRequest.onerror = (e) => reject(e);
    });
  });
}

async function initDB() {
  try {
    // Initialize SQL.js using the global initSqlJs (ensure sql-wasm.js is loaded via <script>)
    const SQL = await window.initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });
    const savedDB = await loadDBFromIDB();
    if (savedDB) {
      db = new SQL.Database(new Uint8Array(savedDB));
      console.log("Database loaded from persistence.");
    } else {
      db = new SQL.Database();
      console.log("New database created.");
      db.run(`
        CREATE TABLE IF NOT EXISTS Documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT,
          embedding BLOB
        );
      `);
    }
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }
}

async function persistDB() {
  try {
    if (db) {
      const binaryArray = db.export();
      await saveDBToIDB(binaryArray);
      console.log("Database persisted to IndexedDB.");
    }
  } catch (error) {
    console.error("Failed to persist database:", error);
  }
}

// ============================================================
// Model & Embedding Functions
// ============================================================
let extractor = null; // Cached Transformers pipeline

async function embedText(text) {
  try {
    if (!extractor) {
      extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
        pooling: "mean",
        normalize: true,
        modelUrl: "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/",
        localFiles: false
      });
      console.log("Embedding model loaded.");
    }
    const result = await extractor(text);
    let embedding;
    if (result.data) {
      if (result.dims && result.dims[0] === 1) {
        embedding = result.data;
      } else {
        embedding = result.data.slice(0, result.data.length / result.dims[0]);
      }
    } else {
      throw new Error("Unexpected embedding result format.");
    }
    return embedding;
  } catch (error) {
    console.error("Embedding error:", error);
    throw error;
  }
}

// ============================================================
// Chat Logic & Synthesis
// ============================================================

// Insert a document (chat message or PDF page) into the database.
async function insertDocument(text) {
  try {
    const embedding = await embedText(text);
    const embeddingBlob = new Uint8Array(embedding.buffer);
    const stmt = db.prepare("INSERT INTO Documents (content, embedding) VALUES (?, ?);");
    stmt.bind([text, embeddingBlob]);
    stmt.step();
    stmt.free();
    await persistDB();
    console.log(`Inserted document: "${text}"`);
  } catch (error) {
    console.error("Error inserting document:", error);
  }
}

// Search the database for documents similar to the query.
async function searchDatabase(queryEmbedding) {
  const results = db.exec("SELECT content, embedding FROM Documents;");
  if (results.length === 0) return [];
  const rows = results[0].values;
  const scored = rows.map(row => {
    const content = row[0];
    const embeddingBlob = row[1];
    const storedEmbedding = new Float32Array(embeddingBlob.buffer);
    let dot = 0;
    for (let i = 0; i < storedEmbedding.length; i++) {
      dot += storedEmbedding[i] * queryEmbedding[i];
    }
    return { content, score: dot };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// Synthesize a coherent answer. For "name" queries, extract a name from stored chat messages.
// Otherwise, combine top unique matches into a conversational reply.
async function answerQuery(userQuery) {
  try {
    const queryEmbedding = await embedText(userQuery);
    const scoredResults = await searchDatabase(queryEmbedding);
    const SIMILARITY_THRESHOLD = 0.3;

    // Special handling for "what is my name" queries.
    if (/what.*name/i.test(userQuery)) {
      for (const item of scoredResults) {
        const match = item.content.match(/my name is\s+(\w+)/i);
        if (match) {
          return `Based on our conversation, your name appears to be ${match[1]}.`;
        }
      }
    }

    // Remove duplicate content and pick top unique matches.
    const unique = [];
    const seen = new Set();
    for (const item of scoredResults) {
      if (item.score < SIMILARITY_THRESHOLD) break;
      if (!seen.has(item.content)) {
        seen.add(item.content);
        unique.push(item);
      }
      if (unique.length >= 3) break;
    }
    if (unique.length === 0) {
      return "I'm sorry, I don't have enough context on that.";
    }
    // If there's one strong unique match, use it directly.
    if (unique.length === 1 || unique[0].score > unique[1].score * 1.5) {
      return `I recall you mentioned: "${unique[0].content}"`;
    }
    // Otherwise, synthesize a combined response.
    const responses = unique.map((match, idx) => `(${idx + 1}) ${match.content}`);
    return `Based on our conversation, here's what I gathered:\n${responses.join("; ")}`;
  } catch (error) {
    console.error("Error in answerQuery:", error);
    return "An error occurred while processing your question.";
  }
}

// ============================================================
// UI Handlers & Chat Interface
// ============================================================
document.addEventListener("DOMContentLoaded", async () => {
  await initDB();

  // PDF Upload Handler.
  const fileInput = document.getElementById("file-input");
  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      const files = e.target.files;
      await loadKnowledgeBase(files);
    });
  } else {
    console.warn("File input element not found.");
  }

  // Chat Interface Handler.
  const sendButton = document.getElementById("send-btn");
  const userInput = document.getElementById("user-input");
  const chatLog = document.getElementById("chat-log");

  if (sendButton && userInput && chatLog) {
    sendButton.addEventListener("click", async () => {
      const query = userInput.value.trim();
      if (!query) return;
      
      // Display and store the user message.
      const userMsg = document.createElement("div");
      userMsg.classList.add("message", "user-message");
      userMsg.textContent = "User: " + query;
      chatLog.appendChild(userMsg);
      await insertDocument(query);
      
      // Get the bot's answer.
      const answer = await answerQuery(query);
      await insertDocument(answer);
      
      // Display the bot's message.
      const botMsg = document.createElement("div");
      botMsg.classList.add("message", "bot-message");
      botMsg.textContent = "Bot: " + answer;
      chatLog.appendChild(botMsg);
      
      userInput.value = "";
      chatLog.scrollTop = chatLog.scrollHeight;
    });
  } else {
    console.error("One or more UI elements (send button, user input, chat log) not found.");
  }

  window.addEventListener("beforeunload", persistDB);
});

// ============================================================
// PDF Knowledge Base Loader
// ============================================================
async function loadKnowledgeBase(sourceFiles) {
  if (!sourceFiles || sourceFiles.length === 0) {
    console.warn("No files provided to load into the knowledge base.");
    return;
  }
  for (let i = 0; i < sourceFiles.length; i++) {
    const file = sourceFiles[i];
    if (file.type !== "application/pdf") {
      console.warn(`File ${file.name} is not a PDF. Skipping.`);
      continue;
    }
    try {
      const fileBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise;
      console.log(`Loaded PDF ${file.name} with ${pdf.numPages} pages.`);
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(" ");
          if (pageText.trim().length === 0) continue;
          await insertDocument(pageText);
          console.log(`Indexed page ${pageNum} of ${file.name}.`);
        } catch (pageError) {
          console.warn(`Error processing page ${pageNum} of ${file.name}:`, pageError);
        }
      }
    } catch (pdfError) {
      console.error(`Failed to load PDF ${file.name}:`, pdfError);
    }
  }
}
