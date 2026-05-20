"""Amadeus API client for live flight and hotel pricing.

Gracefully degrades when API credentials are missing — all public
methods return empty lists.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import httpx

from src.config import get_settings

logger = logging.getLogger(__name__)

_TOKEN_URL = "https://test.api.amadeus.com/v1/security/oauth2/token"
_FLIGHT_URL = "https://test.api.amadeus.com/v2/shopping/flight-offers"
_HOTEL_URL = "https://test.api.amadeus.com/v3/shopping/hotel-offers"
_HOTEL_SEARCH_URL = "https://test.api.amadeus.com/v1/reference-data/locations/hotel"

_token: str | None = None
_token_expires: float = 0.0


def _get_token() -> str | None:
    """Obtain an OAuth2 access token from Amadeus (lazy, cached)."""
    global _token, _token_expires  # noqa: PLW0603

    if _token and time.time() < _token_expires - 60:
        return _token

    settings = get_settings()
    if not settings.AMADEUS_API_KEY or not settings.AMADEUS_API_SECRET:
        return None

    try:
        with httpx.Client() as client:
            resp = client.post(
                _TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": settings.AMADEUS_API_KEY,
                    "client_secret": settings.AMADEUS_API_SECRET,
                },
                timeout=10.0,
            )
            resp.raise_for_status()
            body = resp.json()
            _token = body["access_token"]
            _token_expires = time.time() + body.get("expires_in", 1799)
            return _token
    except Exception as exc:  # noqa: BLE001
        logger.warning("Amadeus auth failed: %s", exc)
        return None


def search_flights(
    origin: str,
    destination: str,
    date: str,
    passengers: int = 1,
) -> list[dict[str, Any]]:
    """Search for flight offers and return a list of price options.

    Returns an empty list when credentials are missing or the API call fails.
    """
    token = _get_token()
    if not token:
        return []

    try:
        with httpx.Client() as client:
            resp = client.get(
                _FLIGHT_URL,
                headers={"Authorization": f"Bearer {token}"},
                params={
                    "originLocationCode": origin,
                    "destinationLocationCode": destination,
                    "departureDate": date,
                    "adults": passengers,
                    "currencyCode": "USD",
                    "max": 3,
                },
                timeout=15.0,
            )
            resp.raise_for_status()
            body = resp.json()
            offers: list[dict[str, Any]] = []
            for item in body.get("data", []):
                first_itinerary = item.get("itineraries", [{}])[0]
                first_segment = first_itinerary.get("segments", [{}])[0]
                price = item.get("price", {})
                offers.append({
                    "airline": first_segment.get("carrierCode", ""),
                    "flight_number": f"{first_segment.get('carrierCode', '')}{first_segment.get('number', '')}",
                    "departure": first_segment.get("departure", {}).get("at", ""),
                    "arrival": first_segment.get("arrival", {}).get("at", ""),
                    "duration": first_itinerary.get("duration", ""),
                    "price": float(price.get("grandTotal", 0)),
                    "currency": price.get("currency", "USD"),
                    "stops": len(first_itinerary.get("segments", [])) - 1,
                })
            return offers
    except Exception as exc:  # noqa: BLE001
        logger.debug("Amadeus flight search failed: %s", exc)
        return []


def search_hotels(
    city: str,
    check_in: str,
    check_out: str,
    rooms: int = 1,
) -> list[dict[str, Any]]:
    """Search for hotel offers in *city*.

    First resolves the city to an Amadeus hotel location code, then
    fetches offers.  Returns an empty list on any failure.
    """
    token = _get_token()
    if not token:
        return []

    try:
        with httpx.Client() as client:
            # Step 1: find hotel IDs for the city
            loc_resp = client.get(
                _HOTEL_SEARCH_URL,
                headers={"Authorization": f"Bearer {token}"},
                params={
                    "keyword": city,
                    "subType": "HOTEL",
                    "countryCode": "US",
                },
                timeout=10.0,
            )
            loc_resp.raise_for_status()
            hotels_data = loc_resp.json().get("data", [])
            if not hotels_data:
                return []
            hotel_ids = [h["hotelId"] for h in hotels_data[:5]]

            # Step 2: get offers for those hotels
            offers_resp = client.get(
                _HOTEL_URL,
                headers={"Authorization": f"Bearer {token}"},
                params={
                    "hotelIds": ",".join(hotel_ids),
                    "checkInDate": check_in,
                    "checkOutDate": check_out,
                    "adults": rooms,
                    "currency": "USD",
                    "bestRateOnly": True,
                },
                timeout=15.0,
            )
            offers_resp.raise_for_status()
            offers_body = offers_resp.json()
            results: list[dict[str, Any]] = []
            for item in offers_body.get("data", []):
                hotel_info = item.get("hotel", {})
                offer = item.get("offers", [{}])[0]
                price = offer.get("price", {})
                results.append({
                    "hotel_name": hotel_info.get("name", ""),
                    "hotel_id": hotel_info.get("hotelId", ""),
                    "latitude": hotel_info.get("latitude"),
                    "longitude": hotel_info.get("longitude"),
                    "price_per_night": float(price.get("total", 0)),
                    "currency": price.get("currency", "USD"),
                    "board_type": offer.get("boardType", ""),
                })
            return results
    except Exception as exc:  # noqa: BLE001
        logger.debug("Amadeus hotel search failed: %s", exc)
        return []
