# Contributing to TripMind

Thanks for your interest in contributing! Here's how to get started.

## Local Development

```bash
# Clone and install
git clone https://github.com/your-username/tripmind.git
cd tripmind
cp .env.example .env
pip install -r requirements.txt

# Run the app
uvicorn src.main:app --reload --port 8000

# Run tests
pytest tests/ -v --tb=short
```

## Code Style

- **Linting**: [ruff](https://docs.astral.sh/ruff/) — run `ruff check src/ tests/` before committing
- **Type checking**: The project uses strict type annotations throughout
- **Commit messages**: Follow [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat:` — new feature
  - `fix:` — bug fix
  - `docs:` — documentation only
  - `refactor:` — code change that neither fixes a bug nor adds a feature
  - `test:` — adding or updating tests
  - `chore:` — tooling, CI, build process

## Pull Request Process

1. Fork the repo and create a feature branch from `main`
2. Make your changes — avoid modifying existing files unless necessary
3. Run `ruff check src/ tests/` and ensure no new warnings
4. Run `pytest tests/ -v` and ensure all tests pass
5. Open a PR with a clear title and description of what you changed and why

## Project Structure

```
src/
├── agents/         # LangChain agents (research, planner)
├── api/            # FastAPI routes, models, session stores, streaming
├── auth/           # JWT authentication & dependency injection
├── observability/  # OpenTelemetry tracing & Prometheus metrics
├── rag/            # ChromaDB ingestion & retrieval pipeline
├── tools/          # LangChain @tool wrappers (search, weather, pricing, geocoding, export)
├── utils/          # Logging helpers
├── config.py       # Centralised settings from environment variables
├── main.py         # FastAPI app entry point
├── orchestrator.py # LangGraph StateGraph workflow
└── state.py        # PlannerState / TravelRequest TypedDicts
```

## Need Help?

Open a [GitHub issue](https://github.com/your-username/tripmind/issues) with the `question` label.
