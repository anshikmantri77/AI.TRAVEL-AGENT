"""FastAPI application entry point for the AI Travel Planner."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from src.api.routes import router
from src.api.session_store import SessionStore
from src.api.streaming import streaming_manager
from src.auth.routes import auth_router
from src.config import get_settings
from src.observability.tracing import setup_tracing
from src.orchestrator import compile_graph
from src.utils.helpers import setup_logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# SlowAPI rate limiter — keyed by client IP
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)


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

    # Cleanup (nothing persistent to tear down with in-memory store)


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
# Rate-limiting middleware + error handler
# ---------------------------------------------------------------------------
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ---------------------------------------------------------------------------
# Attach rate limit to POST /plan via a route-level decorator helper.
# SlowAPI requires the limiter decorator on the route function itself; we
# monkey-patch it onto the route after the router is included so that the
# existing routes.py file is never modified.
# ---------------------------------------------------------------------------
app.include_router(router)
app.include_router(auth_router)

# Apply rate limit to the /plan endpoint after router registration.
_settings = get_settings()
_rate_string = f"{_settings.RATE_LIMIT_PER_MINUTE}/minute"

for route in app.routes:
    if hasattr(route, "path") and route.path == "/plan" and "POST" in getattr(route, "methods", set()):
        # Wrap the existing endpoint with the SlowAPI decorator at startup.
        route.endpoint = limiter.limit(_rate_string)(route.endpoint)
        logger.debug("Rate limit '%s' applied to POST /plan.", _rate_string)
        break

