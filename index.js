// index.js – Entry Point & UI Handler for ChatBot
// This file handles UI events and delegates core chatbot operations to bot.js

// Ensure our fetch override is active so that any local model requests are redirected.
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

// Import core bot functions from bot.js
import { initBot, handleSendMessage, loadPDFKnowledgeBase } from "./bot.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize the chatbot core (DB, model, etc.)
  await initBot();

  // Wire up the PDF file input.
  const fileInput = document.getElementById("file-input");
  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      const files = e.target.files;
      await loadPDFKnowledgeBase(files);
    });
  } else {
    console.warn("File input element not found.");
  }

  // Wire up the chat send button.
  const sendButton = document.getElementById("send-btn");
  const userInput = document.getElementById("user-input");
  const chatLog = document.getElementById("chat-log");

  if (sendButton && userInput && chatLog) {
    sendButton.addEventListener("click", async () => {
      const query = userInput.value.trim();
      if (!query) return;
      
      // Display user message in the chat log.
      const userMsg = document.createElement("div");
      userMsg.classList.add("message", "user-message");
      userMsg.textContent = "User: " + query;
      chatLog.appendChild(userMsg);
      
      // Delegate to the bot to process the message and return a response.
      const response = await handleSendMessage(query);
      
      // Display the bot's response.
      const botMsg = document.createElement("div");
      botMsg.classList.add("message", "bot-message");
      botMsg.textContent = "Bot: " + response;
      chatLog.appendChild(botMsg);
      
      // Clear the input and scroll to bottom.
      userInput.value = "";
      chatLog.scrollTop = chatLog.scrollHeight;
    });
  } else {
    console.error("One or more UI elements (send button, user input, chat log) not found.");
  }

  // Persist DB before unload.
  window.addEventListener("beforeunload", async () => {
    await initBot.persist(); // Optionally expose a persist function from bot.js
  });
});
