"""Authentication routes: register, login, and /me.

User storage
------------
Users are stored in Redis under the key ``user:{email}`` as a JSON blob::

    {
        "user_id":         "hex string (uuid4[:12])",
        "email":           "user@example.com",
        "hashed_password": "$2b$12$..."
    }

The Redis client is sourced from ``app.state.sessions`` when it is a
``RedisSessionStore`` (i.e. USE_REDIS=true), or from a dedicated
``aioredis`` connection created at router startup otherwise.  A fallback
in-process dict is used for local dev when Redis is not available at all
(USE_REDIS=false and no Redis running).

Endpoints
---------
POST /auth/register  – create a new account
POST /auth/login     – exchange credentials for a JWT
GET  /auth/me        – return current user info (requires token)
"""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr

from src.auth.dependencies import require_user
from src.auth.jwt_handler import (
    create_access_token,
    hash_password,
    verify_password,
)
from src.config import get_settings

logger = logging.getLogger(__name__)

auth_router = APIRouter(prefix="/auth", tags=["auth"])

# ---------------------------------------------------------------------------
# In-process fallback store (used only when Redis is unavailable)
# ---------------------------------------------------------------------------
_local_users: dict[str, dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class AuthBody(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    user_id: str
    access_token: str
    message: str


class MeResponse(BaseModel):
    user_id: str
    email: str


# ---------------------------------------------------------------------------
# Redis helpers
# ---------------------------------------------------------------------------

def _user_key(email: str) -> str:
    return f"user:{email.lower()}"


async def _get_redis(request: Request):
    """Return an aioredis client, or None if Redis is not configured."""
    settings = get_settings()
    if not settings.USE_REDIS:
        return None
    # If the session store is a RedisSessionStore, reuse its client.
    sessions = getattr(request.app.state, "sessions", None)
    if sessions is not None and hasattr(sessions, "_client"):
        try:
            return await sessions._client()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Auth: could not get Redis client from session store (%s).", exc)
    # Last resort: open a direct connection.
    try:
        import aioredis  # noqa: PLC0415
        return aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Auth: direct Redis connection failed (%s). Using local store.", exc)
    return None


async def _store_user(request: Request, email: str, record: dict[str, Any]) -> None:
    """Persist a user record to Redis or the in-process fallback."""
    redis = await _get_redis(request)
    if redis is not None:
        await redis.set(_user_key(email), json.dumps(record))
    else:
        _local_users[_user_key(email)] = record


async def _load_user(request: Request, email: str) -> dict[str, Any] | None:
    """Load a user record from Redis or the in-process fallback."""
    redis = await _get_redis(request)
    if redis is not None:
        raw = await redis.get(_user_key(email))
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None
    return _local_users.get(_user_key(email))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@auth_router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user account",
)
async def register(body: AuthBody, request: Request) -> AuthResponse:
    """Register a new user with email + password.

    - Passwords are hashed with bcrypt before storage.
    - Returns a JWT access token immediately so the user is logged in.
    - Returns HTTP 409 if the email is already registered.
    """
    existing = await _load_user(request, body.email)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user_id = uuid4().hex[:12]
    record: dict[str, Any] = {
        "user_id": user_id,
        "email": body.email.lower(),
        "hashed_password": hash_password(body.password),
    }
    await _store_user(request, body.email, record)
    logger.info("New user registered: %s (id=%s)", body.email, user_id)

    token = create_access_token(user_id=user_id, email=body.email.lower())
    return AuthResponse(
        user_id=user_id,
        access_token=token,
        message="Account created successfully.",
    )


@auth_router.post(
    "/login",
    response_model=AuthResponse,
    summary="Authenticate and receive a JWT",
)
async def login(body: AuthBody, request: Request) -> AuthResponse:
    """Exchange email + password for a JWT access token.

    Returns HTTP 401 for unknown email or wrong password (intentionally
    identical error to avoid user-enumeration).
    """
    record = await _load_user(request, body.email)
    if record is None or not verify_password(body.password, record["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(
        user_id=record["user_id"],
        email=record["email"],
    )
    logger.info("User logged in: %s (id=%s)", record["email"], record["user_id"])
    return AuthResponse(
        user_id=record["user_id"],
        access_token=token,
        message="Login successful.",
    )


@auth_router.get(
    "/me",
    response_model=MeResponse,
    summary="Return the current authenticated user",
)
async def me(user: dict[str, Any] = Depends(require_user)) -> MeResponse:
    """Return the ``user_id`` and ``email`` for the authenticated caller.

    Requires a valid ``Authorization: Bearer <token>`` header.
    Returns HTTP 401 otherwise.
    """
    return MeResponse(user_id=user["sub"], email=user["email"])
