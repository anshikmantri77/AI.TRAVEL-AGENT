"""FastAPI application entry point for the AI Travel Planner."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from src.api.routes import router
from src.api.session_store import SessionStore
from src.api.streaming import streaming_manager
from src.auth.routes import auth_router
from src.config import get_settings
from src.limiter import limiter
from src.observability.tracing import setup_tracing
from src.orchestrator import compile_graph
from src.utils.helpers import setup_logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — initialise graph + session store on startup."""
    setup_logging()

    # Compile the LangGraph workflow with MemorySaver checkpointer
    app.state.graph = compile_graph()

    # Create the in-memory session store
    app.state.sessions = SessionStore()

    # Attach the SSE streaming manager singleton
    app.state.streaming = streaming_manager

    # ---------------------------------------------------------------------------
    # Production upgrade: swap to RedisSessionStore when USE_REDIS=true
    # The in-memory SessionStore created above remains as the local-dev default.
    # ---------------------------------------------------------------------------
    settings = get_settings()
    if settings.USE_REDIS:
        try:
            from src.api.redis_session_store import RedisSessionStore  # noqa: PLC0415

            app.state.sessions = RedisSessionStore(redis_url=settings.REDIS_URL)
            logger.info(
                "RedisSessionStore initialised (url=%s, ttl=%ss).",
                settings.REDIS_URL,
                settings.SESSION_TTL_SECONDS,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "USE_REDIS=true but RedisSessionStore failed to initialise (%s). "
                "Falling back to in-memory SessionStore.",
                exc,
            )

    setup_tracing(app)

    yield


app = FastAPI(
    title="AI Travel Planner",
    description=(
        "Multi-agent travel planning system with LangGraph orchestration "
        "and human-in-the-loop approval."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS — allow frontend origins (Vercel, local dev)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("CORS_ORIGIN", "http://localhost:5173"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Rate-limiting middleware + error handler
# ---------------------------------------------------------------------------
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ---------------------------------------------------------------------------
# Register routers — rate limit is applied via @limiter.limit() decorator
# directly in routes.py using the shared src.limiter module.
# ---------------------------------------------------------------------------
app.include_router(router)
app.include_router(auth_router)

