<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python" alt="Python 3.11"/>
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/LangGraph-0.2-6C5CE7?style=flat-square" alt="LangGraph"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" alt="React 18"/>
  <img src="https://img.shields.io/badge/build-passing-brightgreen?style=flat-square" alt="CI"/>
</p>

<h1 align="center">TripMind — AI Travel Planner</h1>

<p align="center">
  <strong>Multi-agent travel planning system with LLM-powered research, HITL review, and real-time streaming.</strong>
</p>

<p align="center">
  Built with <strong>LangGraph</strong>, <strong>FastAPI</strong>, <strong>React</strong>, and <strong>Redis</strong>.
  Two specialised agents research destinations and build day-by-day itineraries, then pause for human-in-the-loop approval before finalising.
</p>

---

## Architecture

```
┌──────────────┐     ┌──────────────────────────────────────────────────────┐
│   Browser    │     │                  FastAPI Backend                     │
│  (React +    │────▶│  ┌────────────┐  ┌──────────────┐  ┌─────────────┐  │
│   Leaflet)   │     │  │   Auth     │  │  Session     │  │  LangGraph  │  │
│              │◀────│  │  (JWT)     │  │  Store       │  │  Workflow   │  │
└──────────────┘     │  └────────────┘  │  (Redis)     │  │             │  │
       │             │                  │  /Memory     │  │  ┌───────┐  │  │
   SSE Stream        │                  └──────────────┘  │  │Research│  │  │
       │             │                                    │  │ Agent  │  │  │
       ▼             │  ┌──────────────────────────────┐  │  └───┬───┘  │  │
┌──────────────┐     │  │       Observability          │  │      │      │  │
│  Prometheus  │◀────│  │  OTEL Tracing  │  Metrics     │  │  ┌───▼───┐  │  │
│  /metrics    │     │  └──────────────────────────────┘  │  │Planner│  │  │
└──────────────┘     │                                    │  │ Agent │  │  │
                     │                                    │  └───┬───┘  │  │
                     │                                    │      │      │  │
                     │                                    │  ┌───▼───┐  │  │
                     │                                    │  │ HITL  │  │  │
                     │                                    │  │Review │  │  │
                     │                                    │  └───────┘  │  │
                     └────────────────────────────────────┴─────────────┘  │
```

---

## Features

- ✅ **Multi-agent orchestration** — LangGraph StateGraph drives research → plan → review → finalise
- ✅ **Human-in-the-loop review** — Approve, reject with feedback, or modify before finalising
- ✅ **Real-time SSE streaming** — Watch agent progress live in the browser
- ✅ **Agent personas** — Backpacker, Luxury, Family, Business — or skip for default
- ✅ **Trip purpose classification** — Adventure, Food, Culture, Relax, Honeymoon, Bachelor Party
- ✅ **Multi-destination trips** — Chain multiple cities in a single planning session
- ✅ **JWT authentication** — Optional; all `/plan/*` endpoints work without a token
- ✅ **Redis session store** — Production-ready with in-memory fallback for development
- ✅ **Rate limiting** — SlowAPI middleware configurable via `RATE_LIMIT_PER_MINUTE`
- ✅ **PDF & iCal export** — Download your plan or add it to your calendar
- ✅ **RAG knowledge base** — ChromaDB + HuggingFace embeddings for destination tips
- ✅ **Interactive map** — Leaflet + OpenStreetMap with activity markers, polylines, and coloured days
- ✅ **Live pricing** — Amadeus API integration for flights and hotels (graceful fallback)
- ✅ **Geocoding** — Nominatim-powered lat/lng for every activity and accommodation
- ✅ **OpenTelemetry tracing** — Distributed tracing with console or OTLP export
- ✅ **Prometheus metrics** — Request counts, durations, active sessions at `/metrics`
- ✅ **Dark-theme React UI** — PlanWizard (4 steps), ReviewPage, FinalPage with export
- ✅ **Docker Compose** — `docker-compose up` starts app + Redis + frontend
- ✅ **CI/CD** — GitHub Actions: lint → test → Docker build on every push

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/your-username/tripmind.git
cd tripmind

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys (GROQ_API_KEY and SERPER_API_KEY required)

# 3. Start everything
docker-compose up

# 4. Open the app
open http://localhost:5173
```

The API is also available at `http://localhost:8000` with interactive docs at `/docs`.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/plan` | Submit a new travel planning request |
| `GET` | `/plan/{id}` | Get current plan status and draft itinerary |
| `GET` | `/plan/{id}/stream` | SSE stream of workflow progress |
| `POST` | `/plan/{id}/review` | Approve, reject, or modify the draft |
| `GET` | `/plan/{id}/final` | Retrieve the approved final plan |
| `GET` | `/plan/{id}/export?format=pdf` | Download plan as PDF |
| `GET` | `/plan/{id}/export?format=ical` | Download plan as .ics calendar |
| `GET` | `/plan/{id}/pricing` | Live flight and hotel pricing data |
| `GET` | `/metrics` | Prometheus metrics (text format) |
| `GET` | `/health` | Health check |
| `POST` | `/auth/register` | Register a new user |
| `POST` | `/auth/login` | Get JWT access token |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | Yes* | — | Groq API key for LLM inference |
| `SERPER_API_KEY` | Yes* | — | Serper.dev web search API key |
| `ANTHROPIC_API_KEY` | No | — | Alternative LLM provider (Anthropic) |
| `OPENAI_API_KEY` | No | — | Alternative LLM provider (OpenAI) |
| `LLM_PROVIDER` | No | `groq` | `groq`, `anthropic`, or `openai` |
| `LLM_MODEL` | No | `llama-3.3-70b-versatile` | Model name for the chosen provider |
| `JWT_SECRET` | No | `change-me-in-production` | Secret key for JWT token signing |
| `USE_REDIS` | No | `false` | Set `true` + start Redis for production |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection string |
| `RATE_LIMIT_PER_MINUTE` | No | `10` | Max POST /plan requests per IP per minute |
| `AMADEUS_API_KEY` | No | — | Amadeus API key (live pricing) |
| `AMADEUS_API_SECRET` | No | — | Amadeus API secret |
| `CHROMADB_PATH` | No | `./data/chromadb` | Path for ChromaDB persistence |
| `RAG_DOCS_DIR` | No | `./data/travel_docs` | Directory with knowledge base docs |
| `OTEL_ENDPOINT` | No | — | OTLP endpoint for OpenTelemetry export |

\* At least one LLM provider key is required for full functionality. The system falls back gracefully when keys are missing.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.11, FastAPI, Uvicorn |
| **Orchestration** | LangGraph, LangChain |
| **LLM Providers** | Groq (default), Anthropic, OpenAI |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS |
| **Maps** | Leaflet, React Leaflet, OpenStreetMap (CartoDB tiles) |
| **Pricing** | Amadeus API (flights + hotels) |
| **Geocoding** | Nominatim / OpenStreetMap |
| **RAG** | ChromaDB, HuggingFace embeddings, LlamaIndex |
| **Export** | WeasyPrint (PDF), icalendar (iCal) |
| **Auth** | PyJWT, passlib |
| **Caching** | Redis (optional, in-memory fallback) |
| **Rate Limiting** | SlowAPI |
| **Observability** | OpenTelemetry, Prometheus |
| **CI/CD** | GitHub Actions, Railway |
| **Containerisation** | Docker, Docker Compose |

---

## License

MIT — see [LICENSE](LICENSE) for details.
