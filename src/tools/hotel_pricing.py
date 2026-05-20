"""LangChain @tool wrapper for live hotel pricing.

Add to the Planner Agent's tool list so the LLM can look up real-time
hotel rates during itinerary planning.
"""

from __future__ import annotations

import json
from typing import Any

from langchain_core.tools import tool


@tool
def get_hotel_prices(
    city: str,
    check_in: str,
    check_out: str,
    rooms: int = 1,
) -> str:
    """Get live hotel prices for a destination city.

    Args:
        city: Destination city name (e.g. 'Paris', 'Tokyo').
        check_in: Check-in date in YYYY-MM-DD format.
        check_out: Check-out date in YYYY-MM-DD format.
        rooms: Number of rooms requested (default 1).
    """
    from src.tools.amadeus_client import search_hotels  # noqa: PLC0415

    results = search_hotels(city, check_in, check_out, rooms)
    if not results:
        return "Live pricing unavailable. No hotel data found."
    return json.dumps(results, indent=2)
