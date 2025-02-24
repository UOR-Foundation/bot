// index.js
// Main chatbot logic that ties the UOR Bot Library to the HTML frontend, now with Transformer-based generation

// Fetch override to redirect model requests to Hugging Face
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

import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3/dist/transformers.min.js';

import Bot from './bot.js'; // Import the Bot class to handle user interaction
import UORDatabase from './knowledge/uor-database.js'; // Import the UOR database to store and retrieve kernels

const bot = new Bot(); // Instantiate the Bot
const db = new UORDatabase(); // Instantiate the UOR Database for storing kernels

// Select HTML elements
const chatLog = document.getElementById('chat-log');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const fileInput = document.getElementById('file-input');

// Initialize the transformer model
let transformerModel;

async function loadTransformerModel() {
  try {
    // Load the pre-trained GPT-2 model from Hugging Face Transformers
    transformerModel = await pipeline('text-generation', 'onnx-community/gpt2-ONNX');
    console.log('Transformer model loaded.');
  } catch (error) {
    console.error('Error loading transformer model:', error);
  }
}

// Function to display user and bot messages in the chat log
function displayMessage(message, sender) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');
  messageElement.textContent = message;
  chatLog.appendChild(messageElement);
  chatLog.scrollTop = chatLog.scrollHeight; // Scroll to the bottom
}

// Function to traverse and pack context into higher-level context
async function traverseAndPackContext(query) {
  console.log(bot.uorCortex); // Check if uorCortex contains traverseUORLattice method
  const context = await bot.uorCortex.traverseUORLattice(query); // Use uorCortex to call traverseUORLattice
  const aggregatedContext = bot.aggregateContext(context); // Aggregate kernels into higher-level context
  return aggregatedContext;
}



// Event listener for the "Send" button click
sendBtn.addEventListener('click', async () => {
  const query = userInput.value.trim();
  if (query) {
    // Display user message in the chat log
    displayMessage(query, 'user');
    userInput.value = ''; // Clear input field

    try {
      // Traverse and pack context before generating the response
      const packedContext = await traverseAndPackContext(query);
      
      // Generate the response based on the higher-level context
      const response = await bot.generateResponse(packedContext);

      displayMessage(response, 'bot');
    } catch (error) {
      console.error('Error processing the query:', error);
      displayMessage('Sorry, I encountered an error. Please try again.', 'bot');
    }
  }
});

// Event listener for "Enter" key press to send the query
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    sendBtn.click();
  }
});

// Handle file input for PDF uploads
fileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (file && file.type === 'application/pdf') {
    try {
      // Open the database to ensure it's ready before processing the file
      await db.openDatabase(); // Ensure the database is open first

      const pdfText = await extractTextFromPDF(file);
      displayMessage('PDF uploaded and processed. Now you can ask questions related to its content.', 'bot');

      // Optionally, store the PDF content in the UOR database or integrate it into the bot's memory
      await db.storeObject({ kernelReference: `pdf_${Date.now()}`, data: { text: pdfText, source: 'PDF' } });

    } catch (error) {
      console.error('Error processing PDF:', error);
      displayMessage('Failed to process the PDF. Please try again.', 'bot');
    }
  } else {
    displayMessage('Please upload a valid PDF file.', 'bot');
  }
});

// Extract text from a PDF file using PDF.js
async function extractTextFromPDF(file) {
  const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
  let textContent = '';

  // Loop through each page of the PDF and extract the text
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const text = await page.getTextContent();
    textContent += text.items.map(item => item.str).join(' ') + '\n';
  }

  return textContent;
}

// Load the transformer model when the page is ready
document.addEventListener('DOMContentLoaded', async () => {
  await loadTransformerModel();
});
