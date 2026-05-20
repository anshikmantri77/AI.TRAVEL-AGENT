"""JWT creation / validation and password hashing utilities.

- Tokens: HS256, 24-hour expiry, secret from ``Settings.JWT_SECRET``.
- Passwords: bcrypt via passlib (auto-generates salt, auto-upgrades cost).

Public API
----------
create_access_token(user_id, email) → str
decode_token(token)                 → dict | None   (None on any error)
hash_password(plain)                → str
verify_password(plain, hashed)      → bool
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from passlib.context import CryptContext

from src.config import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Return a bcrypt hash of *plain*."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches the stored bcrypt *hashed* value."""
    return _pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

_ALGORITHM = "HS256"
_TOKEN_EXPIRE_HOURS = 24


def _secret() -> str:
    return get_settings().JWT_SECRET


def create_access_token(user_id: str, email: str) -> str:
    """Create a signed JWT for *user_id* / *email*, expiring in 24 hours.

    Payload keys
    ------------
    sub   – user_id (standard JWT subject claim)
    email – user's email address
    iat   – issued-at  (UTC)
    exp   – expiry     (UTC, iat + 24 h)
    """
    now = datetime.now(tz=timezone.utc)
    payload: dict[str, Any] = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(hours=_TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, _secret(), algorithm=_ALGORITHM)


def decode_token(token: str) -> dict[str, Any] | None:
    """Decode and verify *token*.

    Returns the full payload dict on success, or **None** for any failure
    (expired, malformed, wrong signature, etc.).  Callers must treat None
    as "unauthenticated" and decide how to respond.
    """
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            _secret(),
            algorithms=[_ALGORITHM],
            options={"require": ["sub", "email", "exp"]},
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.debug("JWT decode failed: token expired.")
    except jwt.InvalidTokenError as exc:
        logger.debug("JWT decode failed: %s", exc)
    return None
