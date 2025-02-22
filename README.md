# This repo isn't quite ready. Check back soon!

# Self-Contained Browser Chatbot on GitHub Pages

A fully self-contained, offline-capable chatbot that runs entirely in the browser. This project leverages a local knowledge base generated from PDF documents and stored in a compact CBOR file, combined with Retrieval-Augmented Generation (RAG) techniques. It uses IndexedDB for local storage of the invariant knowledge base, user-added documents, and chat history. All AI processing—including embedding generation and question answering—is performed in-browser using Transformers.js, ensuring privacy and zero server costs.

---

## Features

- **Offline-First Chatbot**: Runs entirely client-side with no server dependencies after initial load.
- **Automated Knowledge Base**: Uses a GitHub Action to process PDFs from the `content/` directory into a CBOR file.
- **Local Storage with IndexedDB**: Stores the invariant knowledge base, user-uploaded document chunks, and chat history locally (up to ~1GB).
- **In-Browser Embedding & QA**: Utilizes the free Xenova Transformers.js library to generate embeddings and perform question answering.
- **User Document Upload**: Users can upload their own PDFs, which are parsed, embedded, and added to the chatbot's knowledge context.
- **Periodic Updates**: The chatbot checks periodically for updated knowledge base content, ensuring it always uses the latest information.

---

## Repository Structure

```
├── .github
│   ├── workflows
│   │   └── embed.yml           # GitHub Action to process PDFs and generate knowledge.cbor
│   └── scripts
│       └── embed.js            # Node.js script for extracting text, generating embeddings, and outputting a CBOR file
├── content                   # Directory for source PDF documents
├── index.html                # Frontend UI for the chatbot
├── index.js                  # Client-side logic for chat, IndexedDB, retrieval, and AI processing
└── README.md                 # This file
```

---

## Setup & Installation

### 1. Clone the Repository

Clone this repository to your local machine:

```bash
git clone https://github.com/<USERNAME>/<REPO>.git
cd <REPO>
```

### 2. Add Your PDF Documents

Place your PDF documents into the `content/` directory. These documents will be processed by the GitHub Action to generate the invariant knowledge base.

### 3. GitHub Action – Generating the CBOR Knowledge Base

When you push to the `main` branch, the GitHub Action defined in `.github/workflows/embed.yml` will automatically:

- Run the `embed.js` script (located in `.github/scripts/`) to:
  - Extract text from each PDF in `content/`
  - Chunk the text and generate vector embeddings using a free in-browser–compatible model from `@xenova/transformers`
  - Serialize the chunks into a CBOR file (`knowledge.cbor`)
- Copy `knowledge.cbor` into the `public/` directory and deploy it to GitHub Pages.

Make sure your repository’s GitHub Pages is configured to serve from the correct branch (e.g. `gh-pages` or `main`).

### 4. Local Dependencies for embed.js

Navigate to the `.github/scripts` directory and install the Node.js dependencies:

```bash
cd .github/scripts
npm install
```

This will install libraries such as `pdf-parse`, `cbor`, and `@xenova/transformers` required for processing PDFs and generating embeddings.

---

## Usage

Once deployed on GitHub Pages:

1. **Chat Interface**: Open your chatbot URL (e.g., `https://<USERNAME>.github.io/<REPO>/`) to access the chat interface.
2. **Ask Questions**: Type your question in the input box and click "Send". The chatbot will use the locally stored knowledge base and in-browser embedding/QA models to generate an answer.
3. **Upload Documents**: Use the file upload input to add your own PDFs. These are parsed, embedded, and stored locally, enriching the chatbot’s knowledge.
4. **Local Storage**: Chat history, user documents, and knowledge base data are stored in your browser via IndexedDB. Refreshing the page resets user-added content to the invariant base (while preserving chat history if desired).

---

## Customization & Development

- **Modifying Embedding/QA Models**: The in-browser models are loaded via Transformers.js. You can change the model names in `index.js` (e.g., to a different sentence transformer or QA model) if desired.
- **Adjusting Chunking Parameters**: Modify chunk sizes and overlaps in both `embed.js` (for the invariant knowledge base) and `index.js` (for user uploads) to suit your documents.
- **Styling the Chat UI**: Customize `index.html` and the embedded CSS to change the look and feel of your chatbot.

---

## Contributing

Contributions are welcome! If you have improvements or new features, please fork the repository and open a pull request. For major changes, please open an issue first to discuss what you would like to change.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Acknowledgements

- [Xenova Transformers.js](https://github.com/xenova/transformers.js) – for providing free in-browser AI models.
- [PDF.js](https://mozilla.github.io/pdf.js/) – for client-side PDF parsing.
- [cbor-web](https://www.npmjs.com/package/cbor-web) – for CBOR encoding/decoding in the browser.
- IndexedDB – for robust local storage.

---

Enjoy your offline, privacy-preserving chatbot!
