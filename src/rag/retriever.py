"""Context retrieval from the ChromaDB knowledge base.

``retrieve_context`` embeds the query with the same HuggingFace model
used during ingestion and returns the top *n_results* matching chunks
joined by ``\\n---\\n``.

Any failure (missing dependencies, absent ChromaDB, empty collection)
results in an empty string — the caller is expected to handle absence
of RAG context gracefully.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def retrieve_context(
    query: str,
    collection_name: str = "travel_knowledge",
    n_results: int = 3,
) -> str:
    """Query the local knowledge base and return up to *n_results* chunks.

    Parameters
    ----------
    query:
        Natural-language search query (e.g. ``"hidden gems in Paris"``).
    collection_name:
        ChromaDB collection to search.
    n_results:
        Maximum number of document chunks to return.

    Returns
    -------
    str
        Matching chunks joined by ``\\n---\\n``, or an empty string when
        the database is unavailable / empty.
    """
    try:
        import chromadb  # noqa: PLC0415
        from llama_index.embeddings.huggingface import (  # noqa: PLC0415
            HuggingFaceEmbedding,
        )
    except ImportError:
        return ""

    from src.config import get_settings  # noqa: PLC0415

    settings = get_settings()

    try:
        client = chromadb.PersistentClient(path=settings.CHROMADB_PATH)
        collection = client.get_collection(name=collection_name)
    except Exception:  # noqa: BLE001
        logger.debug("ChromaDB collection '%s' not found; returning empty.", collection_name)
        return ""

    try:
        embed_model = HuggingFaceEmbedding(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
        )
        query_embedding: list[float] = embed_model.get_text_embedding(query)
    except Exception as exc:  # noqa: BLE001
        logger.debug("Embedding failed for query '%s': %s", query, exc)
        return ""

    try:
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
        )
    except Exception as exc:  # noqa: BLE001
        logger.debug("ChromaDB query failed for '%s': %s", query, exc)
        return ""

    documents: list[list[str]] | None = results.get("documents")
    if not documents or not documents[0]:
        return ""

    return "\n---\n".join(documents[0])
