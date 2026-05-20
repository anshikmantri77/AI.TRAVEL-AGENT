"""FastAPI dependency functions for JWT-based authentication.

Two dependencies are provided:

get_optional_user
    Reads the ``Authorization: Bearer <token>`` header.
    Returns the decoded payload dict if the token is present and valid,
    or **None** if the header is absent or the token is invalid.
    **Never raises an HTTP error** — callers decide what to do with None.

require_user
    Wraps ``get_optional_user``; raises HTTP 401 when the result is None.
    Use this on endpoints that must be authenticated.

Usage in route handlers
-----------------------
Optional::

    from src.auth.dependencies import get_optional_user

    @router.post("/plan")
    async def create_plan(
        body: TravelRequestBody,
        request: Request,
        user: dict | None = Depends(get_optional_user),
    ):
        user_id = user["sub"] if user else None

Required::

    from src.auth.dependencies import require_user

    @router.get("/auth/me")
    async def me(user: dict = Depends(require_user)):
        return {"user_id": user["sub"], "email": user["email"]}
"""

from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.auth.jwt_handler import decode_token

# ---------------------------------------------------------------------------
# HTTPBearer scheme — auto_error=False means FastAPI won't raise 403 when
# the header is absent; we handle the None case ourselves.
# ---------------------------------------------------------------------------
_bearer = HTTPBearer(auto_error=False)


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict[str, Any] | None:
    """Extract and validate the JWT from the Authorization header.

    Returns the decoded payload (containing ``sub``, ``email``, etc.) when
    a valid Bearer token is supplied, or **None** when:

    - The ``Authorization`` header is absent.
    - The scheme is not ``Bearer``.
    - The token is expired, malformed, or has an invalid signature.

    This dependency **never raises an HTTP exception**, making it safe to
    use on endpoints that support both authenticated and anonymous access.
    """
    if credentials is None:
        return None
    return decode_token(credentials.credentials)


async def require_user(
    user: dict[str, Any] | None = Depends(get_optional_user),
) -> dict[str, Any]:
    """Enforce authentication.

    Delegates to ``get_optional_user``; raises ``HTTP 401`` when the result
    is None (no header, invalid token, or expired token).

    Returns the decoded JWT payload dict on success.
    """
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
