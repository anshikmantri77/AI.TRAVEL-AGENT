#!/usr/bin/env python
"""One-shot document ingestion script for the RAG knowledge base.

Usage
-----
    python scripts/ingest_knowledge.py

Place ``.txt`` or ``.md`` travel guides in ``data/travel_docs/`` first,
then run this script.  The indexed chunks are stored in ChromaDB at the
path configured by ``CHROMADB_PATH`` (default ``./data/chromadb``).

Requires: chromadb, llama-index, llama-index-embeddings-huggingface
"""

from __future__ import annotations

import logging
import sys

from src.config import get_settings
from src.rag.ingestion import ingest_documents

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s  %(message)s",
)

if __name__ == "__main__":
    settings = get_settings()
    count = ingest_documents(docs_dir=settings.RAG_DOCS_DIR)
    if count:
        print(
            f"Ingested {count} document chunks into ChromaDB "
            f"at {settings.CHROMADB_PATH}",
        )
    else:
        print(
            "No documents ingested.  Check that travel guides exist in "
            f"{settings.RAG_DOCS_DIR} and that RAG dependencies are installed.",
        )
        sys.exit(1)
