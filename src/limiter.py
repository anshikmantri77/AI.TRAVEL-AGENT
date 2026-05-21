"""Shared SlowAPI rate limiter module.

Created as a shared module to avoid circular import between main.py and routes.py.
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

from src.config import get_settings

limiter = Limiter(key_func=get_remote_address)


def get_rate_limit_string() -> str:
    """Return the rate limit string (e.g. '10/minute') from settings."""
    settings = get_settings()
    return f"{settings.RATE_LIMIT_PER_MINUTE}/minute"
