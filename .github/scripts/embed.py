#!/usr/bin/env python3
"""
Efficient PDF Text Extraction and Embedding in Python

This script performs the following:
  - Extracts text from a PDF file one page at a time using PyMuPDF.
  - Generates embeddings for each page's text using SentenceTransformers.
  - Stores the filename, page number, text, and embedding (as a JSON string) in an SQLite database.
  
The resulting database can be used by a JavaScript-based retrieval-augmented generation (RAG) system.
"""

import fitz  # PyMuPDF for PDF processing
from sentence_transformers import SentenceTransformer
import sqlite3
import json
from pathlib import Path
import sys

def init_db(db_path: str):
    """
    Initialize an SQLite database and create a table for storing the document data.
    """
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS Documents (
        id        INTEGER PRIMARY KEY,
        filename  TEXT,
        page      INTEGER,
        text      TEXT,
        embedding TEXT
    )
    """)
    conn.commit()
    return conn

def process_pdf(pdf_path: str, model: SentenceTransformer, conn: sqlite3.Connection, commit_interval: int = 50):
    """
    Process a PDF file by:
      - Extracting text from each page.
      - Generating an embedding for that page's text.
      - Inserting a record into the database with the filename, page number, text, and JSON-serialized embedding.
      
    The script commits to the database every 'commit_interval' pages.
    """
    doc = fitz.open(pdf_path)
    cur = conn.cursor()
    file_name = Path(pdf_path).name
    num_pages = doc.page_count
    print(f"Processing PDF: {file_name} with {num_pages} pages.")

    for page_number, page in enumerate(doc, start=1):
        text = page.get_text("text").strip()
        if not text:
            print(f"Page {page_number} has no text. Skipping.")
            continue

        print(f"Processing page {page_number}/{num_pages}...")
        # Generate embedding for the page's text
        embedding_vector = model.encode(text)
        # Convert the embedding to a list and then serialize as JSON
        embedding_list = embedding_vector.tolist() if hasattr(embedding_vector, 'tolist') else embedding_vector
        embedding_json = json.dumps(embedding_list)

        # Insert record into the database
        cur.execute(
            "INSERT INTO Documents (filename, page, text, embedding) VALUES (?, ?, ?, ?)",
            (file_name, page_number, text, embedding_json)
        )
        # Commit periodically to avoid large transactions in memory
        if page_number % commit_interval == 0:
            conn.commit()
            print(f"Committed records up to page {page_number}.")

    conn.commit()
    print(f"Finished processing PDF: {file_name}.")

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 pdf_embedder.py <pdf_file_path>")
        sys.exit(1)

    pdf_file = sys.argv[1]
    if not Path(pdf_file).exists():
        print(f"PDF file '{pdf_file}' does not exist.")
        sys.exit(1)

    # Load the embedding model (e.g., all-MiniLM-L6-v2)
    print("Loading embedding model (all-MiniLM-L6-v2)...")
    model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
    print("Embedding model loaded.")

    # Initialize the SQLite database
    db_path = "pdf_embeddings.db"
    conn = init_db(db_path)

    # Process the PDF file (page by page)
    process_pdf(pdf_file, model, conn)

    conn.close()
    print(f"Embeddings saved to {db_path}.")

if __name__ == "__main__":
    main()
