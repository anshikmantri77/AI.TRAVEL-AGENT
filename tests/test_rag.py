"""Tests for the RAG knowledge base pipeline.

Covers:
- test_retrieve_returns_string_when_db_missing : retrieve_context → str (not raise)
- test_knowledge_base_tool_returns_string      : query_knowledge_base → str
- test_ingest_then_retrieve                    : ingest → retrieve → non-empty
"""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from src.rag.retriever import retrieve_context


# ---------------------------------------------------------------------------
# retrieve_context — graceful degradation
# ---------------------------------------------------------------------------


def test_retrieve_returns_string_when_db_missing() -> None:
    """retrieve_context must return a string (never raise) when DB unavailable."""
    result = retrieve_context("Paris hidden gems")
    assert isinstance(result, str)


def test_retrieve_non_empty_after_ingest() -> None:
    """After ingesting a sample doc, a matching query must return content."""
    pytest.importorskip("chromadb", reason="chromadb not installed")
    pytest.importorskip(
        "llama_index.embeddings.huggingface",
        reason="llama-index-embeddings-huggingface not installed",
    )

    from src.rag.ingestion import ingest_documents

    # Write a small sample file to a temp directory
    with tempfile.TemporaryDirectory() as tmpdir:
        doc_file = Path(tmpdir) / "paris_test.md"
        doc_file.write_text(
            "# Paris\n\nThe Eiffel Tower is a famous landmark in Paris, France.\n"
            "The Louvre museum houses the Mona Lisa.\n"
            "Montmartre offers great views of the city.\n",
            encoding="utf-8",
        )

        count = ingest_documents(docs_dir=tmpdir)
        assert count > 0, "Ingestion should return > 0 chunks"

        # Now retrieve — should find something about Paris
        result = retrieve_context("Eiffel Tower Paris")
        assert isinstance(result, str)
        assert len(result) > 0, "Retrieved context must not be empty"
        assert (
            "Eiffel" in result or "Paris" in result or "Louvre" in result
        ), "Result must contain expected content from the ingested doc"


# ---------------------------------------------------------------------------
# query_knowledge_base tool — integration via the @tool wrapper
# ---------------------------------------------------------------------------


def test_knowledge_base_tool_returns_string() -> None:
    """The @tool-wrapped query_knowledge_base must return a string (never raise)."""
    from src.agents.research_agent import query_knowledge_base

    result = query_knowledge_base.invoke({"query": "Tokyo nightlife"})
    assert isinstance(result, str)


def test_knowledge_base_tool_invoke_signature() -> None:
    """The tool must accept 'query' as its sole string argument."""
    from src.agents.research_agent import query_knowledge_base

    # Direct call
    result = query_knowledge_base("Museums in Berlin")
    assert isinstance(result, str)

    # Tool-call style invocation
    result2 = query_knowledge_base.invoke({"query": "Berlin museums"})
    assert isinstance(result2, str)
