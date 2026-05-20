# Travel Knowledge Base

Add ``.txt`` or ``.md`` travel guides here.  One file per destination
is recommended for best retrieval accuracy.

## Usage

1. Place your travel guides in this directory (``.txt`` or ``.md``).
2. Run the ingestion script from the project root:

   ```bash
   python scripts/ingest_knowledge.py
   ```

3. The Research Agent will automatically query this knowledge base
   during travel planning via the ``query_knowledge_base`` tool.

## Supported formats

- Markdown (``.md``)
- Plain text (``.txt``)

## Requirements

Install the RAG pipeline dependencies once:

```bash
pip install chromadb llama-index llama-index-embeddings-huggingface
```
