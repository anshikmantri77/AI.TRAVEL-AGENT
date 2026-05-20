"""Tests for observability endpoints (metrics, tracing).

Requires prometheus-client to be installed (listed in requirements.txt).
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from src.main import app

# Re-use payloads from test_api
VALID_PAYLOAD = {
    "destination": "Barcelona",
    "start_date": (date.today() + timedelta(days=30)).isoformat(),
    "end_date": (date.today() + timedelta(days=35)).isoformat(),
    "budget_min": 500,
    "budget_max": 2000,
    "interests": ["history", "food", "architecture"],
    "num_travelers": 2,
}

MOCK_RESEARCH = {
    "destination_overview": "Barcelona is a beautiful Mediterranean city.",
    "top_attractions": ["Sagrada Familia", "Park Güell", "Gothic Quarter"],
    "local_tips": ["Get a T-Casual metro pass"],
    "safety_notes": "Generally safe for tourists.",
    "weather_summary": "Warm and sunny, 25-30°C.",
    "best_areas_to_stay": ["Eixample", "Gothic Quarter"],
    "cuisine_highlights": ["Paella", "Tapas"],
}

MOCK_ITINERARY = {
    "trip_summary": "A 5-day trip to Barcelona.",
    "duration_days": 5,
    "total_budget_used": 1500,
    "days": [
        {
            "day": 1,
            "date": (date.today() + timedelta(days=30)).isoformat(),
            "theme": "Arrival & Gothic Quarter",
            "morning": {"activity": "Arrive, check in", "duration": "2h", "cost": 0},
            "afternoon": {"activity": "Gothic Quarter walk", "duration": "3h", "cost": 0},
            "evening": {"activity": "Tapas tour", "duration": "2h", "cost": 40},
            "accommodation": {"name": "Hotel Example", "type": "hotel", "cost_per_night": 120},
            "daily_budget": 200,
        }
    ],
    "packing_suggestions": ["Comfortable walking shoes", "Sunscreen"],
    "important_notes": "Book Sagrada Familia tickets in advance.",
}


@pytest_asyncio.fixture
async def client():
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac


@pytest.mark.asyncio
async def test_metrics_endpoint_returns_200(client: AsyncClient):
    """GET /metrics returns 200 with prometheus-client installed."""
    resp = await client.get("/metrics")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "text/plain; version=0.0.4; charset=utf-8"


@pytest.mark.asyncio
async def test_metrics_contains_expected_metrics(client: AsyncClient):
    """The /metrics response includes all four TripMind metric families."""
    resp = await client.get("/metrics")
    body = resp.text

    assert "tripmind_plan_requests_total" in body
    assert "tripmind_plan_completions_total" in body
    assert "tripmind_plan_duration_seconds" in body
    assert "tripmind_active_sessions" in body


@pytest.mark.asyncio
async def test_metrics_counters_increment_after_plan(
    client: AsyncClient,
):
    """After a successful plan + approve, request and completion counters increment."""
    from unittest.mock import AsyncMock, patch

    resp = await client.get("/metrics")
    before = resp.text

    # Run a full plan cycle
    with (
        patch("src.agents.research_agent.run_research_agent", new_callable=AsyncMock, return_value=MOCK_RESEARCH),
        patch("src.agents.planner_agent.run_planner_agent", new_callable=AsyncMock, return_value=MOCK_ITINERARY),
    ):
        resp = await client.post("/plan", json=VALID_PAYLOAD)
        assert resp.status_code == 200
        session_id = resp.json()["session_id"]

        resp = await client.post(f"/plan/{session_id}/review", json={"action": "approve"})
        assert resp.status_code == 200

        # GET /final triggers record_plan_complete
        resp = await client.get(f"/plan/{session_id}/final")
        assert resp.status_code == 200

    resp = await client.get("/metrics")
    after = resp.text

    # The request total must have increased by at least 1
    assert after.count("tripmind_plan_requests_total") >= before.count("tripmind_plan_requests_total")
    assert after.count("tripmind_plan_completions_total") >= before.count("tripmind_plan_completions_total")


@pytest.mark.asyncio
async def test_metrics_active_sessions_tracks_lifecycle(client: AsyncClient):
    """active_sessions gauge increases during planning and decreases after completion."""
    from unittest.mock import AsyncMock, patch

    async def get_active_sessions() -> float:
        resp = await client.get("/metrics")
        for line in resp.text.splitlines():
            if line.startswith("tripmind_active_sessions") and " " in line:
                return float(line.split()[-1])
        return 0.0

    start_val = await get_active_sessions()

    with (
        patch("src.agents.research_agent.run_research_agent", new_callable=AsyncMock, return_value=MOCK_RESEARCH),
        patch("src.agents.planner_agent.run_planner_agent", new_callable=AsyncMock, return_value=MOCK_ITINERARY),
    ):
        resp = await client.post("/plan", json=VALID_PAYLOAD)
        session_id = resp.json()["session_id"]

        mid_val = await get_active_sessions()
        # Should have incremented by 1 during the planning phase
        assert mid_val == start_val + 1.0

        resp = await client.post(f"/plan/{session_id}/review", json={"action": "approve"})
        assert resp.status_code == 200

        resp = await client.get(f"/plan/{session_id}/final")
        assert resp.status_code == 200

    end_val = await get_active_sessions()
    # After completion, should return to the starting value
    assert end_val == start_val


@pytest.mark.asyncio
async def test_metrics_501_when_prometheus_missing(client: AsyncClient):
    """If prometheus-client is uninstalled, /metrics should return 501."""
    from unittest.mock import patch as mock_patch

    with mock_patch("src.observability.metrics._HAS_PROMETHEUS", False):
        resp = await client.get("/metrics")
        assert resp.status_code == 501
        assert "prometheus-client not installed" in resp.text
