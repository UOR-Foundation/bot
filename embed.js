// embed.js
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const cbor = require('cbor');
const { pipeline } = require('@xenova/transformers');

/**
 * Reads a PDF file and extracts its text.
 * @param {string} filePath - The path to the PDF file.
 * @returns {Promise<string>} - The extracted text.
 */
async function loadPDFText(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  try {
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error(`Error processing PDF ${filePath}:`, error);
    return "";
  }
}

/**
 * Splits text into overlapping chunks.
 * @param {string} text - The text to split.
 * @param {number} chunkSize - Maximum number of characters per chunk.
 * @param {number} overlap - Number of overlapping characters between chunks.
 * @returns {string[]} - Array of text chunks.
 */
function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = start + chunkSize;
    if (end > text.length) {
      end = text.length;
    }
    const chunk = text.substring(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    start = end - overlap;
    if (start < 0) start = 0;
  }
  return chunks;
}

/**
 * Uses the embedding pipeline to generate an embedding vector for a text chunk.
 * @param {string} text - The text chunk.
 * @param {object} embedPipe - The embedding pipeline.
 * @returns {Promise<number[]>} - The embedding vector.
 */
async function generateEmbedding(text, embedPipe) {
  // The pipeline returns an array of embeddings (one per input); we take the first.
  const result = await embedPipe(text);
  return result[0];
}

/**
 * Processes a single PDF file: extracts text, chunks it, and generates embeddings.
 * @param {string} filePath - The path to the PDF file.
 * @param {object} embedPipe - The embedding pipeline.
 * @returns {Promise<object[]>} - An array of objects with text, embedding, and source metadata.
 */
async function processPDF(filePath, embedPipe) {
  console.log(`Processing PDF: ${filePath}`);
  const text = await loadPDFText(filePath);
  const chunks = chunkText(text, 1000, 200);
  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`Embedding chunk ${i + 1}/${chunks.length} from ${path.basename(filePath)}`);
    const embedding = await generateEmbedding(chunk, embedPipe);
    results.push({
      source: path.basename(filePath),
      chunk_index: i,
      text: chunk,
      embedding: embedding,
    });
  }
  return results;
}

async function main() {
  console.log("Loading embedding model...");
  // Load the feature-extraction pipeline using the free Xenova model.
  const embedPipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log("Embedding model loaded.");

  // Adjust the content directory path as needed.
  const contentDir = path.join(__dirname, '../../content');
  const pdfFiles = fs.readdirSync(contentDir).filter(file => file.toLowerCase().endsWith('.pdf'));

  let allChunks = [];
  for (const file of pdfFiles) {
    const filePath = path.join(contentDir, file);
    const chunks = await processPDF(filePath, embedPipe);
    allChunks = allChunks.concat(chunks);
  }
  
  console.log(`Total chunks generated: ${allChunks.length}`);

  // Encode the array of chunks into a CBOR file.
  const outputPath = path.join(__dirname, 'knowledge.cbor');
  const cborData = cbor.encode(allChunks);
  fs.writeFileSync(outputPath, cborData);
  console.log(`CBOR file written to ${outputPath}`);
}

main().catch(err => {
  console.error("Error during processing:", err);
  process.exit(1);
});
