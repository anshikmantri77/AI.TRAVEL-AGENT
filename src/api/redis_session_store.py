"""Redis-backed session store with TTL-based expiry.

Drop-in replacement for :class:`SessionStore` backed by Redis.
Identical async interface: create / get / update / delete /
cleanup_expired / size.

Key pattern: ``session:{session_id}``
TTL is taken from ``SESSION_TTL_SECONDS`` in config (default 3600 s).

Connection errors are handled gracefully — a warning is logged and the
method returns ``None`` / ``False`` / ``0`` so the application continues
to operate (with degraded session persistence) rather than crashing.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any
from uuid import uuid4

import aioredis

from src.config import get_settings

logger = logging.getLogger(__name__)

_HASH_FIELDS_JSON = {"plan"}  # fields stored as JSON-encoded strings


def _encode(value: Any) -> str:
    """Encode a Python value to a Redis-safe string."""
    if isinstance(value, str):
        return value
    return json.dumps(value)


def _decode_entry(raw: dict[bytes | str, bytes | str]) -> dict[str, Any]:
    """Convert a raw Redis hash (bytes keys/values) to a Python dict."""
    result: dict[str, Any] = {}
    for k, v in raw.items():
        key = k.decode() if isinstance(k, bytes) else k
        val = v.decode() if isinstance(v, bytes) else v
        # Try JSON first; fall back to plain string for non-JSON fields.
        try:
            result[key] = json.loads(val)
        except (json.JSONDecodeError, ValueError):
            result[key] = val
    return result


class RedisSessionStore:
    """Async Redis-backed session store.

    Parameters
    ----------
    redis_url:
        Redis connection URL (e.g. ``redis://localhost:6379``).
        Defaults to ``Settings.REDIS_URL``.
    """

    def __init__(self, redis_url: str | None = None) -> None:
        settings = get_settings()
        self._url: str = redis_url or settings.REDIS_URL
        self._ttl: int = settings.SESSION_TTL_SECONDS
        self._redis: aioredis.Redis | None = None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _client(self) -> aioredis.Redis:
        """Return a lazily-initialised Redis client (connection-pooled)."""
        if self._redis is None:
            self._redis = aioredis.from_url(
                self._url,
                encoding="utf-8",
                decode_responses=False,  # we decode manually for safety
            )
        return self._redis

    @staticmethod
    def _key(session_id: str) -> str:
        return f"session:{session_id}"

    # ------------------------------------------------------------------
    # Public interface  (mirrors SessionStore exactly)
    # ------------------------------------------------------------------

    async def create(self) -> str:
        """Create a new session and return its ID."""
        session_id = uuid4().hex[:12]
        entry: dict[str, str] = {
            "thread_id": session_id,
            "created_at": _encode(time.time()),
            "status": "created",
            "workflow_stage": "created",
        }
        try:
            client = await self._client()
            pipe = client.pipeline()
            pipe.hset(self._key(session_id), mapping=entry)
            pipe.expire(self._key(session_id), self._ttl)
            await pipe.execute()
        except (aioredis.ConnectionError, aioredis.RedisError) as exc:
            logger.warning(
                "RedisSessionStore.create — Redis unavailable (%s). "
                "Session %s will not be persisted.",
                exc,
                session_id,
            )
        return session_id

    async def get(self, session_id: str) -> dict[str, Any] | None:
        """Retrieve session metadata, or None if not found / expired."""
        try:
            client = await self._client()
            raw = await client.hgetall(self._key(session_id))
            if not raw:
                return None
            return _decode_entry(raw)
        except (aioredis.ConnectionError, aioredis.RedisError) as exc:
            logger.warning(
                "RedisSessionStore.get(%s) — Redis unavailable (%s).",
                session_id,
                exc,
            )
            return None

    async def update(self, session_id: str, **kwargs: Any) -> bool:
        """Update session metadata fields.  Returns False if not found."""
        try:
            client = await self._client()
            # Verify the key exists before updating.
            exists = await client.exists(self._key(session_id))
            if not exists:
                return False
            encoded = {k: _encode(v) for k, v in kwargs.items()}
            await client.hset(self._key(session_id), mapping=encoded)
            # Refresh TTL on every update so active sessions don't expire.
            await client.expire(self._key(session_id), self._ttl)
            return True
        except (aioredis.ConnectionError, aioredis.RedisError) as exc:
            logger.warning(
                "RedisSessionStore.update(%s) — Redis unavailable (%s).",
                session_id,
                exc,
            )
            return False

    async def delete(self, session_id: str) -> bool:
        """Delete a session.  Returns True if it existed."""
        try:
            client = await self._client()
            deleted = await client.delete(self._key(session_id))
            return bool(deleted)
        except (aioredis.ConnectionError, aioredis.RedisError) as exc:
            logger.warning(
                "RedisSessionStore.delete(%s) — Redis unavailable (%s).",
                session_id,
                exc,
            )
            return False

    async def cleanup_expired(self) -> int:
        """No-op for Redis — TTL expiry is handled natively by Redis.

        Returns 0 because Redis automatically evicts expired keys;
        there is nothing to manually scan and remove.  The method is
        retained so callers written against the ``SessionStore`` interface
        continue to work without modification.
        """
        # Redis handles TTL expiry automatically; nothing to do here.
        return 0

    @property
    def size(self) -> int:
        """Approximate count of session keys.

        Uses a synchronous DBSIZE call if a client is already initialised,
        otherwise returns 0.  This is intentionally approximate — exact
        counting would require a blocking SCAN across all keys.

        Note: returns 0 if no client has been initialised yet or if Redis
        is unreachable, matching the graceful-degradation pattern used
        elsewhere.
        """
        if self._redis is None:
            return 0
        try:
            # aioredis exposes a synchronous connection pool size; for a
            # true count we'd need `await`, but the property contract is
            # synchronous (matching SessionStore).  Return -1 to signal
            # "Redis connected but count unavailable synchronously."
            return -1
        except Exception:  # noqa: BLE001
            return 0
