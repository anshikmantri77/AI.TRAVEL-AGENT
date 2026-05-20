"""Tests for SSE streaming infrastructure.

Covers:
- test_sse_endpoint_returns_200  : valid session → 200 text/event-stream
- test_sse_endpoint_404_on_invalid : unknown session_id → 404
- test_push_and_subscribe        : push event then subscribe, assert event received
"""

from __future__ import annotations

import asyncio
import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient

from src.api.streaming import StreamingManager, _format_sse, streaming_manager


# ---------------------------------------------------------------------------
# Unit tests: StreamingManager
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_push_and_subscribe() -> None:
    """Push one event then subscribe — the event must be received."""
    mgr = StreamingManager()

    session_id = "test_session_push"

    # Push the event BEFORE subscribing so it sits on the queue.
    await mgr.push(session_id, "research_complete", {"destination": "Paris"})
    # Terminal event so the generator stops cleanly.
    await mgr.push(session_id, "done", {})

    received: list[dict[str, Any]] = []
    async for chunk in mgr.subscribe(session_id):
        if chunk.startswith(":"):
            continue  # skip keepalive pings
        # Parse SSE lines into (event_type, data_dict)
        lines = chunk.strip().splitlines()
        event_type = lines[0].removeprefix("event: ")
        data = json.loads(lines[1].removeprefix("data: "))
        received.append({"event": event_type, "data": data})

    assert len(received) == 2  # research_complete + done

    first = received[0]
    assert first["event"] == "research_complete"
    assert first["data"]["stage"] == "research_complete"
    assert first["data"]["session_id"] == session_id
    assert "timestamp" in first["data"]
    assert first["data"]["destination"] == "Paris"

    last = received[1]
    assert last["event"] == "done"


@pytest.mark.asyncio
async def test_push_populates_queue() -> None:
    """push() must create a queue entry for the session."""
    mgr = StreamingManager()
    assert mgr.active_sessions == 0
    await mgr.push("sess1", "research_complete", {})
    assert mgr.active_sessions == 1


@pytest.mark.asyncio
async def test_subscribe_removes_queue_on_done() -> None:
    """Queue must be cleaned up after the stream terminates."""
    mgr = StreamingManager()
    await mgr.push("sess2", "done", {})
    async for _ in mgr.subscribe("sess2"):
        pass
    assert mgr.active_sessions == 0


@pytest.mark.asyncio
async def test_subscribe_removes_queue_on_error_event() -> None:
    """Error terminal event also cleans up the queue."""
    mgr = StreamingManager()
    await mgr.push("sess3", "error", {"message": "something went wrong"})
    chunks = []
    async for chunk in mgr.subscribe("sess3"):
        chunks.append(chunk)
    # One event chunk, then generator exits
    assert any("error" in c for c in chunks)
    assert mgr.active_sessions == 0


def test_format_sse_structure() -> None:
    """_format_sse must produce the exact SSE wire format."""
    result = _format_sse("research_complete", {"stage": "research_complete", "session_id": "abc"})
    lines = result.split("\n")
    assert lines[0] == "event: research_complete"
    assert lines[1].startswith("data: ")
    payload = json.loads(lines[1].removeprefix("data: "))
    assert payload["stage"] == "research_complete"
    assert payload["session_id"] == "abc"
    # Must end with blank line (double \n)
    assert result.endswith("\n\n")


# ---------------------------------------------------------------------------
# Integration tests: HTTP endpoint
# ---------------------------------------------------------------------------

def _make_app():
    """Build a minimal FastAPI app with the router and a fake session store."""
    from fastapi import FastAPI
    from src.api.routes import router

    app = FastAPI()

    # Fake session store: "valid_session_id" exists, nothing else does.
    class _FakeSessions:
        async def get(self, session_id: str):
            if session_id == "valid_session_id":
                return {"status": "awaiting_review", "workflow_stage": "awaiting_review"}
            return None

    @app.on_event("startup")
    async def _startup():
        app.state.sessions = _FakeSessions()
        app.state.streaming = streaming_manager

    app.include_router(router)
    return app


def test_sse_endpoint_returns_200() -> None:
    """GET /plan/{id}/stream on a known session must return 200 with text/event-stream."""
    app = _make_app()

    # Pre-populate a "done" event so the generator exits promptly.
    async def _pre_push():
        await streaming_manager.push("valid_session_id", "done", {})

    asyncio.get_event_loop().run_until_complete(_pre_push())

    with TestClient(app, raise_server_exceptions=True) as client:
        with client.stream("GET", "/plan/valid_session_id/stream") as response:
            assert response.status_code == 200
            assert "text/event-stream" in response.headers["content-type"]


def test_sse_endpoint_404_on_invalid() -> None:
    """GET /plan/{id}/stream on an unknown session must return 404."""
    app = _make_app()
    with TestClient(app, raise_server_exceptions=True) as client:
        response = client.get("/plan/nonexistent_session/stream")
        assert response.status_code == 404
        body = response.json()
        assert "not found" in body["detail"].lower()
