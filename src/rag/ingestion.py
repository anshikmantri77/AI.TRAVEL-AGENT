"""Document ingestion pipeline for the RAG knowledge base.

Reads ``.txt`` and ``.md`` files from a directory, chunks them with
LlamaIndex ``SimpleNodeParser`` (512 tokens, 50 overlap), embeds using
a local HuggingFace model (``all-MiniLM-L6-v2``), and stores the
result in ChromaDB at the path specified by ``CHROMADB_PATH``.

Gracefully degrades when dependencies are missing — logs a warning and
returns 0 instead of crashing.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def ingest_documents(
    docs_dir: str,
    collection_name: str = "travel_knowledge",
) -> int:
    """Ingest all ``.txt`` and ``.md`` files from *docs_dir* into ChromaDB.

    Returns the number of document chunks indexed, or 0 if the
    directory is empty, the dependencies are missing, or an error occurs.
    """
    try:
        import chromadb  # noqa: PLC0415
        from llama_index.core.node_parser import SimpleNodeParser  # noqa: PLC0415
        from llama_index.core.schema import Document as LLDocument  # noqa: PLC0415
        from llama_index.embeddings.huggingface import (  # noqa: PLC0415
            HuggingFaceEmbedding,
        )
    except ImportError as exc:
        logger.warning(
            "RAG ingestion dependencies not installed (%s). "
            "Install: chromadb, llama-index, llama-index-embeddings-huggingface",
            exc,
        )
        return 0

    from src.config import get_settings  # noqa: PLC0415

    settings = get_settings()
    docs_path = Path(docs_dir)

    if not docs_path.is_dir():
        logger.warning("RAG docs directory not found: %s", docs_dir)
        return 0

    # Collect all text content from .txt and .md files
    raw_texts: list[str] = []
    for path in sorted(docs_path.rglob("*")):
        if path.suffix.lower() in (".txt", ".md") and path.is_file():
            try:
                raw_texts.append(path.read_text(encoding="utf-8"))
            except Exception as exc:  # noqa: BLE001
                logger.warning("Skipping unreadable file %s: %s", path, exc)

    if not raw_texts:
        logger.info("No .txt or .md files found in %s", docs_dir)
        return 0

    # Convert raw text to LlamaIndex documents for parsing
    documents = [LLDocument(text=t) for t in raw_texts]

    # Chunk into nodes
    parser = SimpleNodeParser.from_defaults(
        chunk_size=512,
        chunk_overlap=50,
    )
    nodes = parser.get_nodes_from_documents(documents)

    if not nodes:
        return 0

    # Compute embeddings
    embed_model = HuggingFaceEmbedding(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
    )
    node_texts = [n.get_content() for n in nodes]
    logger.info("Computing embeddings for %d chunks …", len(node_texts))
    embeddings: list[list[float]] = [
        embed_model.get_text_embedding(t) for t in node_texts
    ]

    # Persist in ChromaDB
    client = chromadb.PersistentClient(path=settings.CHROMADB_PATH)
    collection = client.get_or_create_collection(name=collection_name)

    ids = [f"chunk_{i:06d}" for i in range(len(nodes))]
    metadatas: list[dict[str, Any]] = [
        {"chunk_index": i, "source": docs_dir} for i in range(len(nodes))
    ]

    collection.add(
        documents=node_texts,
        embeddings=embeddings,
        ids=ids,
        metadatas=metadatas,
    )

    logger.info(
        "Ingested %d chunks into ChromaDB collection '%s' at %s",
        len(nodes),
        collection_name,
        settings.CHROMADB_PATH,
    )
    return len(nodes)
