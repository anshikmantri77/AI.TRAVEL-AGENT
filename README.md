<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python" alt="Python 3.11"/>
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/LangGraph-0.2-6C5CE7?style=flat-square" alt="LangGraph"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" alt="React 18"/>
  <img src="https://img.shields.io/badge/build-passing-brightgreen?style=flat-square" alt="CI"/>
</p>

<h1 align="center">TripMind — AI Travel Planner</h1>

<p align="center">
  <strong>Multi-agent, human-in-the-loop travel planning system powered by LLMs, LangGraph orchestration, and a premium React frontend.</strong>
</p>

<p align="center">
  <a href="#architecture">Architecture</a> ·
  <a href="#agent-workflow">Agent Workflow</a> ·
  <a href="#data-flow">Data Flow</a> ·
  <a href="#api-design">API Design</a> ·
  <a href="#tech-decisions">Tech Decisions</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#deployment">Deployment</a>
</p>

---

## Table of Contents

- [High-Level Architecture](#architecture)
- [Agent Workflow (LangGraph State Machine)](#agent-workflow)
- [Data Flow](#data-flow)
- [API Design](#api-design)
- [Frontend Architecture](#frontend-architecture)
- [Key Technology Decisions](#tech-decisions)
- [Security Architecture](#security)
- [Observability](#observability)
- [Quick Start](#quick-start)
- [Environment Reference](#environment-reference)
- [Deployment Architecture](#deployment)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                  CLIENT LAYER                                       │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │  React 18 SPA (Vite + TypeScript + Tailwind CSS)                              │  │
│  │                                                                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  ┌──────────────────────┐  │  │
│  │  │ PlanWizard  │  │ ReviewPage  │  │ FinalPage  │  │  PricingPanel        │  │  │
│  │  │ (4-step)    │  │ (Timeline / │  │ (Export /  │  │  (Flights + Hotels)  │  │  │
│  │  │             │  │  Map toggle)│  │  Booking)  │  │                      │  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘  └──────────────────────┘  │  │
│  │         │                │               │                                    │  │
│  │  ┌──────┴────────────────┴───────────────┴────────────────────────────────┐  │  │
│  │  │  @tanstack/react-query  │  SSE EventSource  │  React Router v6         │  │  │
│  │  └────────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                                │  │
│  │  ┌────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Map: Leaflet + CartoDB dark tiles  │  Booking.com URL builder         │  │  │
│  │  │  SkyScanner / IRCTC / RedBus integration  │  PDF / iCal export         │  │  │
│  │  └────────────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                          │ HTTP REST + SSE
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                               API GATEWAY (FastAPI / Uvicorn)                        │
│                                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │  Auth Routes │  │  Plan Routes │  │  SSE Stream  │  │  Rate Limiter (SlowAPI) │  │
│  │  /auth/*     │  │  /plan/*     │  │  /plan/{id}/ │  │  10 req/min per IP      │  │
│  │  JWT + bcrypt│  │  CRUD + HITL │  │  stream      │  └─────────────────────────┘  │
│  └──────────────┘  └──────┬───────┘  └──────────────┘                               │
│                           │                                                          │
│                           ▼                                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                      LANGGRAPH ORCHESTRATOR                                   │   │
│  │                                                                               │   │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐  │   │
│  │  │ Validate │───▶│ Research │───▶│  Plan    │───▶│  HITL    │───▶│Finalize│  │   │
│  │  │ Request  │    │  Agent   │    │Itinerary │    │Checkpoint│    │        │  │   │
│  │  └──────────┘    └──────────┘    └──────────┘    └────┬─────┘    └────────┘  │   │
│  │                          ▲                            │                      │   │
│  │                          │             ┌──────────────┴──────────┐           │   │
│  │                          │             │  Process Feedback       │           │   │
│  │                          │             │  ┌─────┐ ┌──────┐ ┌───┐ │           │   │
│  │                          └─────────────┤ │Rej.│ │Modify│ │App│ │           │   │
│  │                                        │ └──┬──┘ └──┬───┘ └─┬─┘ │           │   │
│  │                                        └────┴───────┴───────┘───┘           │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                           │                                                          │
│                           ▼                                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                     SESSION & STATE MANAGEMENT                                 │   │
│  │  ┌─────────────────────────┐  ┌──────────────────────────────────────────┐   │   │
│  │  │  SessionStore (In-Mem)  │  │  LangGraph MemorySaver (Checkpointer)     │   │   │
│  │  │  or RedisSessionStore   │  │  Persists PlannerState across HTTP calls  │   │   │
│  │  └─────────────────────────┘  └──────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                           │                                                          │
│                           ▼                                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                     LLM PROVIDERS (Pluggable)                                 │   │
│  │  ┌─────────┐  ┌───────────┐  ┌──────────┐  ┌───────────────────────────┐    │   │
│  │  │  Groq   │  │ Anthropic │  │  OpenAI  │  │  LangChain @tool system   │    │   │
│  │  │(default)│  │ (Claude)  │  │ (GPT-4o) │  │  allocate_budget          │    │   │
│  │  └─────────┘  └───────────┘  └──────────┘  │  score_activities         │    │   │
│  │                                             │  get_flight_prices        │    │   │
│  │                                             │  get_hotel_prices         │    │   │
│  │                                             └───────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                           │                                                          │
│                           ▼                                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                   EXTERNAL INTEGRATIONS                                        │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │   │
│  │  │ Serper   │  │ Amadeus  │  │Nominatim │  │WeasyPrint│  │  ChromaDB     │   │   │
│  │  │ Web      │  │ Flights  │  │Geocoding │  │ PDF Gen  │  │  RAG /        │   │   │
│  │  │ Search   │  │ + Hotels │  │          │  │          │  │  Embeddings   │   │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └───────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  Observability: OpenTelemetry Tracing │ Prometheus Metrics (/metrics)               │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Workflow

The system uses a **LangGraph StateGraph** with 8 nodes and a shared `PlannerState` TypedDict that flows through the entire pipeline:

```
route_destinations
       │
       ▼
validate_request ──[error]──→ END
       │
       ▼
  research (Research Agent: Serper search → destination insights)
       │
       ▼
plan_itinerary (Planner Agent: LLM + tools → structured itinerary)
       │
       ▼
hitl_checkpoint (interrupt() — waits for human feedback)
       │
       ▼
process_feedback
       │
       ├── approve ──→ finalize ──→ next_destination? ──→ END
       │
       ├── reject ───→ research (re-route, increment revision)
       │
       └── modify ───→ plan_itinerary (re-route with delta)
```

### State Schema (`PlannerState`)

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | `str` | Unique session identifier |
| `travel_request` | `TravelRequest` | User-submitted request (dest, dates, budget, interests) |
| `research_output` | `dict` | Research Agent findings (attractions, weather, tips) |
| `draft_itinerary` | `dict` | Planner Agent day-by-day itinerary |
| `pricing_data` | `dict` | Live Amadeus pricing for flights + hotels |
| `hitl_status` | `enum` | `pending → approved/rejected/modified` |
| `final_plan` | `dict` | Assembled final plan after approval |
| `error` | `str \| None` | Validation/execution error |
| `revision_count` | `int` | Number of HITL feedback cycles |
| `user_id` | `str \| None` | Authenticated user (optional) |

---

## Data Flow

### 1. Plan Creation (POST /plan)
```
User → PlanWizard → POST /plan → FastAPI → LangGraph.ainvoke()
  → route_destinations → validate_request
  → Research Agent (Serper search for destination)
  → Planner Agent (LLM + budget/activity/pricing tools)
  → hitl_checkpoint (interrupt)
  → Response: { session_id, draft_itinerary }
```

### 2. HITL Review (POST /plan/{id}/review)
```
User approves/rejects/modifies → FastAPI
  → Command(resume={action, feedback})
  → process_feedback node
  → approve? → finalize → final_plan
  → reject? → research → plan → hitl_checkpoint again
  → modify? → plan_itinerary (with modifications) → hitl_checkpoint again
```

### 3. Real-Time Streaming (SSE)
```
Browser opens EventSource(/plan/{id}/stream)
  ← event: research_complete { destination }
  ← event: awaiting_review { draft_itinerary }
  ← event: done { final_plan }
  ← event: error { message }
```

### 4. Pricing Data Flow
```
Planner Agent calls get_flight_prices / get_hotel_prices (Amadeus)
  → Results captured in captured_pricing dict
  → Stored in PlannerState.pricing_data via plan_itinerary node
  → GET /plan/{id}/pricing reads directly from state
```

---

## API Design

### RESTful Endpoints

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `POST` | `/plan` | Submit travel request | Optional JWT |
| `GET` | `/plan/{id}` | Poll status + draft | — |
| `GET` | `/plan/{id}/stream` | SSE event stream | — |
| `POST` | `/plan/{id}/review` | Approve/reject/modify | — |
| `GET` | `/plan/{id}/final` | Get finalized plan | — |
| `GET` | `/plan/{id}/pricing` | Get cached pricing | — |
| `GET` | `/plan/{id}/export?format=pdf\|ical` | Export | — |
| `POST` | `/auth/register` | Create account | — |
| `POST` | `/auth/login` | Get JWT | — |
| `GET` | `/metrics` | Prometheus metrics | — |
| `GET` | `/health` | Health check | — |

### Key Design Decisions

- **Session ID as bearer token**: Plan endpoints use session_id as an implicit auth — only the creator knows it. Clean UX without forcing auth for core flow.
- **Rate limiting**: SlowAPI applied via decorator (`10 req/min` configurable) on POST /plan only — protects LLM costs.
- **LangGraph interrupt model**: The graph pauses at HITL via `interrupt()`, persists state via MemorySaver, and resumes via `Command(resume=...)` — no polling or webhooks needed.
- **CQRS for pricing**: Amadeus data cached in state, read via dedicated endpoint, never recomputed on read.

---

## Frontend Architecture

### Route Tree
```
/plan          → PlanWizard (4-step form)
/plan/:id      → ReviewPage (Timeline | Map + HITL)
/plan/:id/final → FinalPage (Itinerary + Booking tabs)
```

### Component Tree
```
App
├── PlanWizard (4 steps)
│   ├── TripPurposeSelector (6 cards)
│   ├── DestinationForm (icon-prefixed fields)
│   ├── InterestPicker (chip toggles)
│   └── PersonaSelector
├── ReviewPage
│   ├── ItineraryTimeline (day cards)
│   ├── MapView (Leaflet + Polyline + Markers)
│   ├── StreamingStatus (SSE progress stepper)
│   └── HITLReviewPanel (approve/reject/modify)
└── FinalPage
    ├── DestinationHero
    ├── BookingTabs (SkyScanner / Google Flights / IRCTC / RedBus)
    ├── ItineraryTimeline
    └── MapView
```

### Design System (Hallmark-Inspired)
- **Colors**: OKLCH token system — deep navy/amber, ambient glow, gradient backgrounds
- **Typography**: DM Serif Display (headings) + Inter (body) + JetBrains Mono (UI labels)
- **Components**: Glass cards, accent buttons, chip toggles, section § prefixes
- **Micro-interactions**: Hover glow, lift on active, gradient text, fade-in animations
- **Map**: CartoDB dark tiles, divIcon markers (colored dots + accommodation "H"), deduplicated polylines

---

## Tech Decisions

| Decision | Rationale |
|----------|-----------|
| **LangGraph over straight LangChain** | State machine with interrupt/resume enables true HITL. MemorySaver checkpointer persists state across HTTP requests without a database. |
| **FastAPI over Django/Flask** | Async-native, Pydantic v2 validation, OpenAPI docs autogenerated, perfect for SSE streaming. |
| **Groq as default LLM** | Fastest inference, cost-effective for agentic workflows. Pluggable via provider abstraction — swap to Claude/GPT-4o with one env var. |
| **LLM tool-calling over hardcoded logic** | Budget allocation, activity scoring, and pricing are done via LangChain @tool decorators — the LLM decides when and how to use them, enabling emergent planning behavior. |
| **SSE over WebSockets** | Simpler infrastructure (no persistent connection manager), works with standard HTTP proxies, unidirectional stream fits our use case. |
| **React Query over Redux** | Server state management with automatic refetch, caching, and background updates. Perfect for polling plan status and SSE events. |
| **OKLCH over hex/RGB** | Perceptually uniform color space — consistent relative luminance across hues. Enables systematic dark/light theme with arithmetic lightness manipulation. |
| **Session ID over OAuth for plans** | Zero-friction onboarding — users can create plans immediately without registration. JWT auth available for those who want it. |

---

## Security

| Measure | Implementation |
|---------|---------------|
| **JWT auth** | Optional password-based auth with bcrypt hashing. Access/refresh token model. |
| **Rate limiting** | SlowAPI per-IP limiting on POST /plan (configurable, default 10/min). Protects against runaway LLM costs. |
| **Input validation** | Pydantic v2 model validators on all endpoints — date ranges, budget constraints, interest limits, feedback requirements on reject. |
| **Session isolation** | LangGraph thread_id = session_id. No cross-session state leakage. Session store TTL = 1 hour. |
| **No secrets in code** | All API keys via environment variables. `.env` in `.gitignore`. |
| **CORS** | Configurable origin whitelist via environment. |

---

## Observability

### Metrics (Prometheus, /metrics)
- `plan_requests_total` — total plan creation requests
- `plan_completions_total` — successful plan completions
- `plan_duration_seconds` — histogram of end-to-end durations
- `active_sessions` — gauge of in-progress sessions

### Tracing (OpenTelemetry)
- Console exporter by default
- OTLP export configurable via `OTEL_ENDPOINT`
- `@trace_node` decorator wraps every LangGraph node
- Spans capture per-node duration, errors, and stage transitions

### Logging
- Structured JSON logging via standard library
- Configurable log level via `LOG_LEVEL` env var
- LangGraph node entry/exit logged with session ID

---

## Quick Start

```bash
# 1. Clone & enter
git clone https://github.com/your-username/tripmind.git
cd tripmind

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum: GROQ_API_KEY and SERPER_API_KEY

# 3. Start with Docker
docker-compose up

# 4. Open in browser
open http://localhost:5173
```

**API docs**: `http://localhost:8000/docs`

### Without Docker

```bash
# Backend
pip install -r requirements.txt
uvicorn src.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

---

## Environment Reference

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `GROQ_API_KEY` | Yes* | — | Primary LLM provider |
| `SERPER_API_KEY` | Yes* | — | Web search for research agent |
| `ANTHROPIC_API_KEY` | No | — | Alternative LLM |
| `OPENAI_API_KEY` | No | — | Alternative LLM |
| `LLM_PROVIDER` | No | `groq` | `groq` / `anthropic` / `openai` |
| `LLM_MODEL` | No | `llama-3.3-70b-versatile` | Per-provider model name |
| `JWT_SECRET` | No | `change-me-in-production` | 256-bit+ random string |
| `USE_REDIS` | No | `false` | Enable Redis session store |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection |
| `RATE_LIMIT_PER_MINUTE` | No | `10` | POST /plan per IP |
| `AMADEUS_API_KEY` | No | — | Live flight/hotel pricing |
| `AMADEUS_API_SECRET` | No | — | Amadeus auth |
| `LOG_LEVEL` | No | `INFO` | Python logging level |
| `MAX_REVISIONS` | No | `3` | Max HITL cycles before auto-finalize |
| `CHROMADB_PATH` | No | `./data/chromadb` | RAG persistence |
| `RAG_DOCS_DIR` | No | `./data/travel_docs` | Knowledge base docs |

\* At least one LLM key + Serper key required for full functionality.

---

## Deployment

### Production Topology
```
                         ┌─────────────┐
                         │   CDN        │
                         │ (Vite build) │
                         └──────┬──────┘
                                │
┌─────────────┐         ┌───────┴───────┐         ┌─────────────┐
│  Prometheus │◄────────│  FastAPI App  │────────►│   Redis     │
│  /metrics   │         │ (Uvicorn,    │         │ (Sessions)  │
└─────────────┘         │  Gunicorn)   │         └─────────────┘
                        └───────┬───────┘
                                │
                        ┌───────┴───────┐
                        │  ChromaDB     │
                        │  (RAG)        │
                        └─────────────┘
```

### CI/CD Pipeline (GitHub Actions)
```
Push → lint (ruff) → test (pytest) → Docker build → Push to registry → Deploy
```

### Docker Compose
- `redis`: Redis 7 Alpine (session store in production)
- `app`: FastAPI + LangGraph + agents
- `frontend`: Nginx-served Vite SPA

---

## Project Structure

```
├── src/
│   ├── agents/          # Research + Planner agents
│   ├── api/             # FastAPI routes, models, session store, streaming
│   ├── auth/            # JWT authentication
│   ├── tools/           # Budget, pricing, geocoding, weather, web search
│   ├── rag/             # ChromaDB knowledge base
│   ├── observability/   # Prometheus metrics + OpenTelemetry tracing
│   ├── limiter.py       # Shared SlowAPI rate limiter
│   ├── orchestrator.py  # LangGraph StateGraph definition
│   ├── state.py         # PlannerState TypedDict schema
│   └── config.py        # Centralised env-var config
├── frontend/
│   ├── src/
│   │   ├── components/  # MapView, HITLReviewPanel, StreamingStatus, etc.
│   │   ├── pages/       # PlanWizard, ReviewPage, FinalPage
│   │   └── lib/         # API client, URL builders, IATA codes
│   └── tailwind.config.js
├── tests/               # pytest suite (API, orchestrator, export, streaming, tools)
├── data/                # ChromaDB persistence + travel docs
├── Dockerfile
├── docker-compose.yml
└── pytest.ini
```

---

## Live Demo

Coming soon at **https://tripmind.up.railway.app**

---

## License

MIT — see [LICENSE](LICENSE) for details.
