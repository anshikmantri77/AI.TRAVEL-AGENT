"""LangChain @tool wrapper for live flight pricing.

Add to the Planner Agent's tool list so the LLM can look up real-time
flight costs during itinerary planning.
"""

from __future__ import annotations

import json
from typing import Any

from langchain_core.tools import tool


@tool
def get_flight_prices(
    origin: str,
    destination: str,
    date: str,
    passengers: int = 1,
) -> str:
    """Get live flight prices between two cities on a given date.

    Args:
        origin: IATA airport code of departure city (e.g. 'JFK', 'LHR').
        destination: IATA airport code of arrival city (e.g. 'CDG', 'NRT').
        date: Departure date in YYYY-MM-DD format.
        passengers: Number of adult passengers (default 1).
    """
    from src.tools.amadeus_client import search_flights  # noqa: PLC0415

    offers = search_flights(origin, destination, date, passengers)
    if not offers:
        return "Live pricing unavailable. No flight data found."
    return json.dumps(offers, indent=2)
