"""Geocoding utility using OpenStreetMap's Nominatim API (free, no key).

Converts place names to (lat, lng) coordinates.  Used by the Research
Agent's ``geocode_location`` tool so that activities and accommodations
can be plotted on the interactive map.

Nominatim requires a 1-second delay between requests and a descriptive
User-Agent header: https://operations.osmfoundation.org/policies/nominatim/
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
_USER_AGENT = "TripMind/1.0 (AI Travel Planner)"
_last_call: float = 0.0


def geocode_place(name: str, city: str | None = None) -> dict[str, Any]:
    """Geocode a place name and return ``{lat, lng, display_name}``.

    Parameters
    ----------
    name:
        Place to geocode (e.g. ``"Eiffel Tower"``).
    city:
        Optional city context to improve accuracy (e.g. ``"Paris"``).

    Returns
    -------
    dict
        ``{"lat": float, "lng": float, "display_name": str}`` on success,
        or ``{"lat": 0.0, "lng": 0.0, "display_name": ""}`` on any failure.
    """
    global _last_call  # noqa: PLW0603

    query = f"{name}, {city}" if city else name

    # Respect Nominatim's 1 req/s rate limit
    elapsed = time.time() - _last_call
    if elapsed < 1.0:
        time.sleep(1.0 - elapsed)

    try:
        with httpx.Client() as client:
            response = client.get(
                _NOMINATIM_URL,
                params={"q": query, "format": "json", "limit": 1},
                headers={"User-Agent": _USER_AGENT},
                timeout=10.0,
            )
            _last_call = time.time()
            response.raise_for_status()
            data: list[dict[str, Any]] = response.json()
            if data:
                return {
                    "lat": float(data[0]["lat"]),
                    "lng": float(data[0]["lon"]),
                    "display_name": data[0].get("display_name", ""),
                }
    except Exception as exc:  # noqa: BLE001
        logger.debug("Nominatim geocode failed for '%s': %s", query, exc)

    _last_call = time.time()
    return {"lat": 0.0, "lng": 0.0, "display_name": ""}
