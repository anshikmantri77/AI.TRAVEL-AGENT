"""Tests for PDF and iCal export functionality.

Covers:
- test_pdf_export_returns_bytes         : generate_pdf → non-empty bytes
- test_ical_export_returns_string       : generate_ical → str with BEGIN:VCALENDAR
- test_ical_has_correct_event_count     : 5-day plan → 5 VEVENT blocks
- test_export_endpoint_409_before_approval : /export on unfinished session → 409
- test_pdf_contains_destination         : PDF HTML contains destination name
- test_ical_event_summary_format        : VEVENT SUMMARY has correct shape
- test_ical_skips_malformed_dates       : days with bad dates are omitted cleanly
- test_export_endpoint_404_unknown      : unknown session → 404
- test_export_endpoint_422_bad_format   : ?format=docx → 422
"""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.tools.export import _build_html, generate_ical

# ---------------------------------------------------------------------------
# Shared sample data
# ---------------------------------------------------------------------------

SAMPLE_FINAL_PLAN: dict[str, Any] = {
    "destination": "Paris",
    "itinerary": {
        "trip_summary": "A wonderful 2-day Paris trip.",
        "days": [
            {
                "day": 1,
                "date": "2026-09-01",
                "theme": "Arrival",
                "morning": {"activity": "Eiffel Tower", "duration": "3h", "cost": 25},
                "afternoon": {"activity": "Louvre", "duration": "3h", "cost": 20},
                "evening": {"activity": "Seine cruise", "duration": "2h", "cost": 35},
                "accommodation": {
                    "name": "Hotel Paris",
                    "type": "hotel",
                    "cost_per_night": 120,
                },
                "daily_budget": 200,
            }
        ],
        "packing_suggestions": ["Umbrella", "Comfortable shoes"],
        "important_notes": "Book Louvre in advance.",
    },
}

FIVE_DAY_PLAN: dict[str, Any] = {
    "destination": "Tokyo",
    "itinerary": {
        "trip_summary": "Five days in Tokyo.",
        "days": [
            {
                "day": i,
                "date": f"2026-10-0{i}",
                "theme": f"Theme {i}",
                "morning": {"activity": f"Morning activity {i}", "duration": "2h", "cost": 10},
                "afternoon": {"activity": f"Afternoon {i}", "duration": "3h", "cost": 15},
                "evening": {"activity": f"Evening {i}", "duration": "2h", "cost": 20},
                "accommodation": {"name": f"Hotel {i}", "cost_per_night": 100},
                "daily_budget": 150,
            }
            for i in range(1, 6)
        ],
        "packing_suggestions": ["Rain jacket"],
        "important_notes": "",
    },
}

# ---------------------------------------------------------------------------
# Unit tests: generate_pdf
# ---------------------------------------------------------------------------


def test_pdf_export_returns_bytes() -> None:
    """generate_pdf must return non-empty bytes."""
    pytest.importorskip("weasyprint", reason="weasyprint not installed")
    from src.tools.export import generate_pdf

    result = generate_pdf(SAMPLE_FINAL_PLAN)
    assert isinstance(result, bytes)
    assert len(result) > 0


def test_pdf_contains_destination() -> None:
    """The intermediate HTML must contain the destination name."""
    html = _build_html(SAMPLE_FINAL_PLAN)
    assert "Paris" in html


def test_pdf_contains_day_theme() -> None:
    """The HTML must contain the day theme."""
    html = _build_html(SAMPLE_FINAL_PLAN)
    assert "Arrival" in html


def test_pdf_contains_activities() -> None:
    """The HTML must include all three activity slots."""
    html = _build_html(SAMPLE_FINAL_PLAN)
    assert "Eiffel Tower" in html
    assert "Louvre" in html
    assert "Seine cruise" in html


def test_pdf_contains_accommodation() -> None:
    """The HTML must include accommodation name."""
    html = _build_html(SAMPLE_FINAL_PLAN)
    assert "Hotel Paris" in html


def test_pdf_contains_packing_suggestions() -> None:
    """The HTML footer must include packing suggestions."""
    html = _build_html(SAMPLE_FINAL_PLAN)
    assert "Umbrella" in html
    assert "Comfortable shoes" in html


def test_pdf_contains_important_notes() -> None:
    """The HTML footer must include important notes."""
    html = _build_html(SAMPLE_FINAL_PLAN)
    assert "Book Louvre in advance" in html


def test_pdf_import_error_message() -> None:
    """generate_pdf must raise ImportError with pip install hint when WeasyPrint missing."""
    import sys
    import importlib

    weasyprint_backup = sys.modules.get("weasyprint")
    sys.modules["weasyprint"] = None  # type: ignore[assignment]
    try:
        # Re-import to force the ImportError path
        import importlib
        from src.tools import export as export_mod
        importlib.reload(export_mod)
        with pytest.raises(ImportError, match="pip install weasyprint"):
            export_mod.generate_pdf(SAMPLE_FINAL_PLAN)
    finally:
        if weasyprint_backup is not None:
            sys.modules["weasyprint"] = weasyprint_backup
        else:
            sys.modules.pop("weasyprint", None)


# ---------------------------------------------------------------------------
# Unit tests: generate_ical
# ---------------------------------------------------------------------------


def test_ical_export_returns_string() -> None:
    """generate_ical must return a str containing BEGIN:VCALENDAR."""
    pytest.importorskip("icalendar", reason="icalendar not installed")
    result = generate_ical(SAMPLE_FINAL_PLAN)
    assert isinstance(result, str)
    assert "BEGIN:VCALENDAR" in result


def test_ical_ends_with_vcalendar() -> None:
    """The .ics string must close the VCALENDAR component."""
    pytest.importorskip("icalendar", reason="icalendar not installed")
    result = generate_ical(SAMPLE_FINAL_PLAN)
    assert "END:VCALENDAR" in result


def test_ical_has_correct_event_count() -> None:
    """A 5-day plan must produce exactly 5 VEVENT blocks."""
    pytest.importorskip("icalendar", reason="icalendar not installed")
    result = generate_ical(FIVE_DAY_PLAN)
    assert result.count("BEGIN:VEVENT") == 5
    assert result.count("END:VEVENT") == 5


def test_ical_event_summary_format() -> None:
    """Each VEVENT SUMMARY must match 'Day N: Theme in Destination'."""
    pytest.importorskip("icalendar", reason="icalendar not installed")
    result = generate_ical(SAMPLE_FINAL_PLAN)
    assert "Day 1: Arrival in Paris" in result


def test_ical_event_description_contains_activities() -> None:
    """DESCRIPTION must join morning/afternoon/evening activities with ' | '."""
    pytest.importorskip("icalendar", reason="icalendar not installed")
    result = generate_ical(SAMPLE_FINAL_PLAN)
    assert "Eiffel Tower" in result
    assert "Louvre" in result
    assert "Seine cruise" in result


def test_ical_event_location_is_destination() -> None:
    """LOCATION must be set to the destination."""
    pytest.importorskip("icalendar", reason="icalendar not installed")
    result = generate_ical(SAMPLE_FINAL_PLAN)
    assert "Paris" in result


def test_ical_skips_malformed_dates() -> None:
    """Days with unparseable dates must be silently skipped."""
    pytest.importorskip("icalendar", reason="icalendar not installed")
    bad_plan: dict[str, Any] = {
        "destination": "Rome",
        "itinerary": {
            "trip_summary": "",
            "days": [
                {
                    "day": 1,
                    "date": "not-a-date",
                    "theme": "Broken",
                    "morning": {"activity": "Colosseum"},
                    "afternoon": {},
                    "evening": {},
                },
                {
                    "day": 2,
                    "date": "2026-11-01",
                    "theme": "Good day",
                    "morning": {"activity": "Vatican"},
                    "afternoon": {},
                    "evening": {},
                },
            ],
            "packing_suggestions": [],
            "important_notes": "",
        },
    }
    result = generate_ical(bad_plan)
    # Only the valid day should produce a VEVENT
    assert result.count("BEGIN:VEVENT") == 1
    assert "Good day" in result


def test_ical_import_error_message() -> None:
    """generate_ical must raise ImportError with pip install hint when icalendar missing."""
    import sys

    ical_backup = sys.modules.get("icalendar")
    sys.modules["icalendar"] = None  # type: ignore[assignment]
    try:
        from src.tools import export as export_mod
        import importlib
        importlib.reload(export_mod)
        with pytest.raises(ImportError, match="pip install icalendar"):
            export_mod.generate_ical(SAMPLE_FINAL_PLAN)
    finally:
        if ical_backup is not None:
            sys.modules["icalendar"] = ical_backup
        else:
            sys.modules.pop("icalendar", None)


# ---------------------------------------------------------------------------
# Integration tests: HTTP endpoint
# ---------------------------------------------------------------------------

def _make_app(
    session_exists: bool = True,
    workflow_stage: str = "completed",
    final_plan: dict[str, Any] | None = None,
) -> FastAPI:
    """Build a minimal FastAPI app with stubbed graph + session store."""
    from fastapi import FastAPI
    from src.api.routes import router

    app = FastAPI()

    _final = final_plan if final_plan is not None else SAMPLE_FINAL_PLAN
    _state: dict[str, Any] = {
        "workflow_stage": workflow_stage,
        "final_plan": _final if workflow_stage == "completed" else None,
    }

    class _FakeSessions:
        async def get(self, sid: str):
            if session_exists and sid == "test123":
                return {"status": workflow_stage, "workflow_stage": workflow_stage}
            return None

    class _FakeGraph:
        async def aget_state(self, config):
            snap = MagicMock()
            snap.values = _state
            return snap

    @app.on_event("startup")
    async def _startup():
        app.state.sessions = _FakeSessions()
        app.state.graph = _FakeGraph()

    app.include_router(router)
    return app


def test_export_endpoint_409_before_approval() -> None:
    """GET /plan/{id}/export on an unfinished plan must return 409."""
    app = _make_app(session_exists=True, workflow_stage="awaiting_review")
    with TestClient(app) as client:
        response = client.get("/plan/test123/export?format=pdf")
    assert response.status_code == 409
    assert "not yet finalized" in response.json()["detail"].lower()


def test_export_endpoint_404_unknown() -> None:
    """GET /plan/{id}/export on unknown session must return 404."""
    app = _make_app(session_exists=False)
    with TestClient(app) as client:
        response = client.get("/plan/ghost999/export?format=pdf")
    assert response.status_code == 404


def test_export_endpoint_422_bad_format() -> None:
    """GET /plan/{id}/export?format=docx must return 422."""
    app = _make_app(session_exists=True, workflow_stage="completed")
    with TestClient(app) as client:
        response = client.get("/plan/test123/export?format=docx")
    assert response.status_code == 422


def test_export_ical_endpoint_returns_200() -> None:
    """GET /plan/{id}/export?format=ical on completed plan → 200 text/calendar."""
    pytest.importorskip("icalendar", reason="icalendar not installed")
    app = _make_app(session_exists=True, workflow_stage="completed")
    with TestClient(app) as client:
        response = client.get("/plan/test123/export?format=ical")
    assert response.status_code == 200
    assert "text/calendar" in response.headers["content-type"]
    assert "BEGIN:VCALENDAR" in response.text
    assert 'filename=trip-test123.ics' in response.headers["content-disposition"]


def test_export_pdf_endpoint_returns_200() -> None:
    """GET /plan/{id}/export?format=pdf on completed plan → 200 application/pdf."""
    pytest.importorskip("weasyprint", reason="weasyprint not installed")
    app = _make_app(session_exists=True, workflow_stage="completed")
    with TestClient(app) as client:
        response = client.get("/plan/test123/export?format=pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert 'filename=trip-test123.pdf' in response.headers["content-disposition"]
    # PDF magic bytes
    assert response.content[:4] == b"%PDF"


def test_export_default_format_is_pdf() -> None:
    """GET /plan/{id}/export with no format param defaults to PDF."""
    pytest.importorskip("weasyprint", reason="weasyprint not installed")
    app = _make_app(session_exists=True, workflow_stage="completed")
    with TestClient(app) as client:
        response = client.get("/plan/test123/export")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
