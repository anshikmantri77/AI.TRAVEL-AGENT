"""Server-Sent Events streaming infrastructure.

StreamingManager maintains one ``asyncio.Queue`` per active session.
Nodes in the orchestrator call ``streaming_manager.push(...)`` to
broadcast progress events; the ``GET /plan/{id}/stream`` endpoint
calls ``streaming_manager.subscribe(...)`` which yields SSE-formatted
strings directly into a ``StreamingResponse``.

SSE wire format (per https://html.spec.whatwg.org/multipage/server-sent-events.html)::

    event: research_complete
    data: {"stage":"research_complete","session_id":"abc123","timestamp":"2026-05-20T10:00:00.000000Z"}

    (blank line terminates each event)

Keepalive pings (comment lines) are emitted every 15 seconds when no
event arrives, so proxies and browsers do not close idle connections.

The module-level ``streaming_manager`` singleton is imported by both
``src.orchestrator`` (to push) and ``src.api.routes`` (to subscribe).
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

logger = logging.getLogger(__name__)

# Seconds between keepalive pings when no event is available.
_PING_INTERVAL: float = 15.0

# Maximum events buffered per session before the oldest are dropped.
_QUEUE_MAX_SIZE: int = 100

# Event types that signal the stream is finished.
_TERMINAL_EVENTS: frozenset[str] = frozenset({"done", "error"})


def _iso_now() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _format_sse(event_type: str, payload: dict[str, Any]) -> str:
    """Serialise one event to the SSE wire format.

    Returns a string ending with ``\\n\\n`` (double newline), which is the
    SSE event boundary.  The ``data`` field is a single-line JSON object.
    """
    return f"event: {event_type}\ndata: {json.dumps(payload)}\n\n"


class StreamingManager:
    """In-memory SSE broker.

    One ``asyncio.Queue`` is created per session on the first ``push``
    or ``subscribe`` call and removed when the stream is terminated or
    the subscriber disconnects.

    Thread-safety note: all public methods are coroutines and should be
    called from the same event loop.  The dict ``_queues`` is mutated
    only while holding the asyncio lock.
    """

    def __init__(self) -> None:
        self._queues: dict[str, asyncio.Queue[dict[str, Any] | None]] = {}
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_or_create_queue(
        self, session_id: str
    ) -> asyncio.Queue[dict[str, Any] | None]:
        async with self._lock:
            if session_id not in self._queues:
                self._queues[session_id] = asyncio.Queue(maxsize=_QUEUE_MAX_SIZE)
            return self._queues[session_id]

    async def _remove_queue(self, session_id: str) -> None:
        async with self._lock:
            self._queues.pop(session_id, None)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def push(
        self,
        session_id: str,
        event_type: str,
        data: dict[str, Any] | None = None,
    ) -> None:
        """Enqueue an event for *session_id*.

        The event is silently dropped if:
        - The queue is full (``_QUEUE_MAX_SIZE`` exceeded).
        - No subscriber is listening (queue does not exist yet).

        Parameters
        ----------
        session_id:
            The planning session this event belongs to.
        event_type:
            Short snake_case label, e.g. ``"research_complete"``.
        data:
            Arbitrary JSON-serialisable dict merged with standard fields
            (``stage``, ``session_id``, ``timestamp``).
        """
        payload: dict[str, Any] = {
            "stage": event_type,
            "session_id": session_id,
            "timestamp": _iso_now(),
            **(data or {}),
        }
        envelope: dict[str, Any] = {"event": event_type, "data": payload}
        try:
            q = await self._get_or_create_queue(session_id)
            q.put_nowait(envelope)
            logger.debug(
                "StreamingManager.push: session=%s event=%s", session_id, event_type
            )
        except asyncio.QueueFull:
            logger.warning(
                "StreamingManager.push: queue full for session=%s, dropping event=%s",
                session_id,
                event_type,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "StreamingManager.push: unexpected error for session=%s: %s",
                session_id,
                exc,
            )

    async def subscribe(
        self, session_id: str
    ) -> AsyncGenerator[str, None]:
        """Yield SSE-formatted strings for *session_id* until the stream ends.

        Yields
        ------
        str
            SSE-formatted event strings (``"event: ...\\ndata: ...\\n\\n"``)
            or keepalive comment lines (``": ping\\n\\n"``).

        The generator terminates automatically when a terminal event
        (``"done"`` or ``"error"``) is dequeued.
        """
        q = await self._get_or_create_queue(session_id)
        try:
            while True:
                try:
                    envelope = await asyncio.wait_for(
                        q.get(), timeout=_PING_INTERVAL
                    )
                except asyncio.TimeoutError:
                    # No event arrived within the ping interval — send a
                    # keepalive comment so the connection stays open.
                    yield ": ping\n\n"
                    continue

                event_type: str = envelope["event"]
                payload: dict[str, Any] = envelope["data"]
                yield _format_sse(event_type, payload)

                if event_type in _TERMINAL_EVENTS:
                    break
        finally:
            await self._remove_queue(session_id)
            logger.debug(
                "StreamingManager.subscribe: stream closed for session=%s", session_id
            )

    @property
    def active_sessions(self) -> int:
        """Number of sessions currently holding a queue."""
        return len(self._queues)


# ---------------------------------------------------------------------------
# Module-level singleton — import this everywhere
# ---------------------------------------------------------------------------
streaming_manager = StreamingManager()
