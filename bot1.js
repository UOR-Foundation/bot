// bot1.js - Cognitive layer for structured knowledge and reasoning
import { pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.11.0";

let embedder = null;
let db = null;

// Schema based on schema.org
const SCHEMA = {
  Person: {
    properties: {
      name: { type: 'string' },
      birthYear: { type: 'number' },
      location: { type: 'string' }
    }
  },
  Place: {
    properties: {
      name: { type: 'string' },
      country: { type: 'string' },
      population: { type: 'number' }
    }
  },
  Organization: {
    properties: {
      name: { type: 'string' },
      location: { type: 'string' },
      founded: { type: 'number' }
    }
  }
};

async function initCognitive() {
  try {
    console.log("Initializing cognitive layer...");

    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true
    });

    const SQL = await initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });

    db = new SQL.Database();
    
    db.run(`
      CREATE TABLE IF NOT EXISTS axioms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity TEXT NOT NULL,
        type TEXT NOT NULL,
        attribute TEXT NOT NULL,
        value TEXT NOT NULL,
        source TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        timestamp INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS external_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        retrieved_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_axioms_entity ON axioms(entity);
      CREATE INDEX IF NOT EXISTS idx_axioms_type ON axioms(type);
      CREATE INDEX IF NOT EXISTS idx_external_query ON external_cache(query);
    `);

    await loadPersistedState();
    console.log("Cognitive layer initialized");
    return true;
  } catch (err) {
    console.error("Failed to initialize cognitive layer:", err);
    throw err;
  }
}

async function analyzeInput(text) {
  const facts = [];
  
  const nameMatch = text.match(/(?:I am|I'm|my name is) ([A-Z][a-z]+)/i);
  if (nameMatch) {
    facts.push({
      entity: 'user',
      type: 'Person',
      attribute: 'name', 
      value: nameMatch[1],
      source: 'user',
      timestamp: Date.now()
    });
  }

  const locationMatch = text.match(/(?:I live in|I am from|I'm from) ([A-Z][a-z]+)/i);
  if (locationMatch) {
    facts.push({
      entity: 'user',
      type: 'Person',
      attribute: 'location',
      value: locationMatch[1],
      source: 'user',
      timestamp: Date.now()
    });
  }

  const ageMatch = text.match(/(?:I am|I'm) (\d+)(?: years old)?/i);
  if (ageMatch) {
    const birthYear = new Date().getFullYear() - parseInt(ageMatch[1]);
    facts.push({
      entity: 'user',
      type: 'Person',
      attribute: 'birthYear',
      value: birthYear.toString(),
      source: 'user',
      timestamp: Date.now()
    });
  }

  return facts;
}

async function storeAxioms(facts, source = 'user') {
  if (!db) throw new Error("Database not initialized");

  const stmt = db.prepare(`
    INSERT INTO axioms (entity, type, attribute, value, source, timestamp)
    VALUES (?, ?, ?, ?, ?, ?);
  `);

  try {
    for (const fact of facts) {
      stmt.run([
        fact.entity,
        fact.type,
        fact.attribute,
        fact.value,
        source,
        Date.now()
      ]);
    }
  } finally {
    stmt.free();
  }

  await persistState();
}

async function checkContradiction(newFact) {
  if (!db) throw new Error("Database not initialized");

  const result = db.exec(`
    SELECT * FROM axioms 
    WHERE entity = ? 
    AND type = ?
    AND attribute = ? 
    AND value != ?
    ORDER BY timestamp DESC
    LIMIT 1;
  `, [newFact.entity, newFact.type, newFact.attribute, newFact.value]);

  if (result && result.length > 0 && result[0].values.length > 0) {
    const row = result[0].values[0];
    return {
      entity: row[1],
      type: row[2],
      attribute: row[3],
      value: row[4],
      source: row[5],
      timestamp: row[7]
    };
  }

  return null;
}

async function retrieveContext(query) {
  if (!db) throw new Error("Database not initialized");

  if (/what.*my name/i.test(query)) {
    const userFacts = await getEntityFacts('user');
    const nameFacts = userFacts.filter(f => f.attribute === 'name');
    if (nameFacts.length > 0) {
      return `The user's name is ${nameFacts[0].value}`;
    }
  }

  const queryEmbedding = await embedText(query);
  const relevantFacts = await searchSimilarFacts(queryEmbedding);
  
  if (relevantFacts.length === 0) return '';
  
  return relevantFacts
    .map(fact => `${fact.entity} ${fact.attribute} is ${fact.value}`)
    .join('\n');
}

async function searchSimilarFacts(queryEmbedding, limit = 5) {
  const facts = db.exec(`
    SELECT entity, type, attribute, value, source, timestamp
    FROM axioms
    ORDER BY timestamp DESC;
  `);

  if (!facts || !facts.length) return [];

  const scoredFacts = await Promise.all(
    facts[0].values.map(async row => {
      const factText = `${row[0]} ${row[2]} ${row[3]}`; 
      const factEmbedding = await embedText(factText);
      const similarity = cosineSimilarity(queryEmbedding, factEmbedding);
      
      return {
        entity: row[0],
        type: row[1],
        attribute: row[2],
        value: row[3],
        source: row[4],
        timestamp: row[5],
        similarity
      };
    })
  );

  return scoredFacts
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

async function embedText(text) {
  if (!embedder) throw new Error("Embedder not initialized");

  const output = await embedder(text);
  let embedding = output.data;
  
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (norm > 0) {
    embedding = embedding.map(val => val / norm);
  }

  return embedding;
}

function cosineSimilarity(vec1, vec2) {
  let dotProduct = 0;
  const len = Math.min(vec1.length, vec2.length);
  for (let i = 0; i < len; i++) {
    dotProduct += vec1[i] * vec2[i];
  }
  return dotProduct;
}

async function getEntityFacts(entity) {
  if (!db) throw new Error("Database not initialized");

  const result = db.exec(`
    SELECT entity, type, attribute, value, source, timestamp 
    FROM axioms 
    WHERE entity = ?
    ORDER BY timestamp DESC;
  `, [entity]);

  if (!result || result.length === 0) return [];

  return result[0].values.map(row => ({
    entity: row[0],
    type: row[1],
    attribute: row[2],
    value: row[3],
    source: row[4],
    timestamp: row[5]
  }));
}

async function verifyResponse(response) {
  const responseFacts = await analyzeInput(response);
  
  for (const fact of responseFacts) {
    const conflict = await checkContradiction(fact);
    if (conflict) {
      return { isValid: false, conflict };
    }
  }

  return { isValid: true };
}

async function addExternalKnowledge(context, newInfo) {
  return context ? 
    `${context}\n\nAdditional Information:\n${newInfo}` : 
    newInfo;
}

async function ensureCoherence(entity) {
  if (!db) throw new Error("Database not initialized");

  const facts = await getEntityFacts(entity);
  
  for (let i = 0; i < facts.length; i++) {
    for (let j = i + 1; j < facts.length; j++) {
      if (facts[i].attribute === facts[j].attribute && 
          facts[i].value !== facts[j].value) {
        if (facts[i].timestamp > facts[j].timestamp) {
          db.run(
            "DELETE FROM axioms WHERE entity = ? AND attribute = ? AND value = ?",
            [facts[j].entity, facts[j].attribute, facts[j].value]
          );
        } else {
          db.run(
            "DELETE FROM axioms WHERE entity = ? AND attribute = ? AND value = ?",
            [facts[i].entity, facts[i].attribute, facts[i].value]
          );
        }
      }
    }
  }
  
  await persistState();
}

async function getExternalInfo(query) {
  if (!db) throw new Error("Database not initialized");

  const now = Date.now();
  const result = db.exec(`
    SELECT content 
    FROM external_cache 
    WHERE query = ? 
    AND expires_at > ?
    LIMIT 1;
  `, [query, now]);

  if (!result || result.length === 0 || !result[0].values.length) return null;
  return result[0].values[0][0];
}

async function storeExternalInfo(query, content, source) {
  if (!db) throw new Error("Database not initialized");

  const now = Date.now();
  const expiresAt = now + (1000 * 60 * 60); // 1 hour TTL

  db.run(`
    INSERT INTO external_cache (query, content, source, retrieved_at, expires_at)
    VALUES (?, ?, ?, ?, ?);
  `, [query, content, source, now, expiresAt]);

  await persistState();
}

async function openIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CognitiveChatbot', 1);
    
    request.onerror = () => {
      console.error("IndexedDB error:", request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      console.log("IndexedDB opened successfully");
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      console.log("Creating/upgrading IndexedDB stores");
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('cognitiveState')) {
        const store = db.createObjectStore('cognitiveState', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
      }
    };
  });
}

async function loadPersistedState() {
  try {
    const idb = await openIDB();
    const tx = idb.transaction('cognitiveState', 'readonly');
    const store = tx.objectStore('cognitiveState');
    
    return new Promise((resolve, reject) => {
      const request = store.get('dbState');
      
      request.onerror = () => {
        console.warn("Error loading state:", request.error);
        resolve();
      };
      
      request.onsuccess = () => {
        const state = request.result;
        if (state?.data) {
          try {
            db = new SQL.Database(new Uint8Array(state.data));
            console.log("Loaded persisted state");
          } catch (err) {
            console.warn("Error reconstructing database:", err);
            db = new SQL.Database();
          }
        } else {
          console.log("No persisted state found, using fresh database");
        }
        resolve();
      };
    });
  } catch (err) {
    console.warn("Failed to load persisted state:", err);
  }
}

async function persistState() {
  if (!db) return;

  try {
    const idb = await openIDB();
    const tx = idb.transaction('cognitiveState', 'readwrite');
    const store = tx.objectStore('cognitiveState');
    
    return new Promise((resolve, reject) => {
      const request = store.put({
        id: 'dbState',
        data: db.export(),
        timestamp: Date.now()
      });
      
      request.onerror = () => {
        console.error("Error persisting state:", request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        console.log("State persisted successfully");
        resolve();
      };
    });
  } catch (err) {
    console.error("Failed to persist state:", err);
  }
}

async function cleanExternalCache() {
  if (!db) return;
  
  const now = Date.now();
  db.run('DELETE FROM external_cache WHERE expires_at < ?;', [now]);
  await persistState();
}

export {
  initCognitive as initBot,
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
  persistState as persistKnowledgeBase
};