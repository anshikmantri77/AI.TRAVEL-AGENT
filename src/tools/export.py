"""Export utilities for finalized travel plans.

Two export formats are supported:

generate_pdf(final_plan)  → bytes   (WeasyPrint HTML → PDF)
generate_ical(final_plan) → str     (icalendar VCALENDAR .ics)

Both functions raise ``ImportError`` with an installation hint if the
required third-party library is not installed, so the calling endpoint
can return HTTP 501 rather than a 500 traceback.

``final_plan`` shape (from the ``finalize`` orchestrator node)::

    {
        "destination": "Paris",
        "itinerary": {
            "trip_summary": "...",
            "days": [
                {
                    "day": 1,
                    "date": "2026-09-01",
                    "theme": "Arrival",
                    "morning":   {"activity": "...", "duration": "3h", "cost": 25},
                    "afternoon": {"activity": "...", "duration": "3h", "cost": 20},
                    "evening":   {"activity": "...", "duration": "2h", "cost": 35},
                    "accommodation": {"name": "Hotel Paris", "type": "hotel",
                                      "cost_per_night": 120},
                    "daily_budget": 200,
                },
                ...
            ],
            "packing_suggestions": ["Umbrella", "Comfortable shoes"],
            "important_notes": "Book Louvre in advance.",
        }
    }
"""

from __future__ import annotations

import html
from typing import Any

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _esc(value: Any) -> str:
    """HTML-escape *value* converted to str; return empty string for None."""
    if value is None:
        return ""
    return html.escape(str(value))


def _activity_cell(slot: Any) -> str:
    """Render a morning/afternoon/evening slot dict as an HTML table cell."""
    if not slot or not isinstance(slot, dict):
        return "<td>—</td>"
    activity = _esc(slot.get("activity", ""))
    duration = _esc(slot.get("duration", ""))
    cost = slot.get("cost")
    cost_str = f" · ₹{cost}" if cost is not None else ""
    gmaps = slot.get("google_maps_link", "")
    maps_link = f' <a href="{_esc(gmaps)}">📍</a>' if gmaps else ""
    detail = f"<br><small>{duration}{_esc(cost_str)}{maps_link}</small>" if (duration or cost_str or maps_link) else ""
    return f"<td>{activity}{detail}</td>"


def _build_html(final_plan: dict[str, Any]) -> str:
    """Render *final_plan* to a self-contained HTML string."""
    destination = _esc(final_plan.get("destination", "Unknown Destination"))
    itinerary: dict[str, Any] = final_plan.get("itinerary", {})
    trip_summary = _esc(itinerary.get("trip_summary", ""))
    days: list[dict[str, Any]] = itinerary.get("days", [])
    packing: list[Any] = itinerary.get("packing_suggestions", [])
    important_notes = _esc(itinerary.get("important_notes", ""))

    # Trip date range from first/last day
    trip_dates = ""
    if days:
        first_date = _esc(days[0].get("date", ""))
        last_date = _esc(days[-1].get("date", ""))
        trip_dates = f"{first_date} – {last_date}" if first_date != last_date else first_date

    # Build day sections
    day_sections: list[str] = []
    for day_data in days:
        day_num = _esc(day_data.get("day", ""))
        date = _esc(day_data.get("date", ""))
        theme = _esc(day_data.get("theme", ""))
        morning = day_data.get("morning")
        afternoon = day_data.get("afternoon")
        evening = day_data.get("evening")
        accommodation = day_data.get("accommodation") or {}
        acc_name = _esc(accommodation.get("name", "—"))
        acc_cost = accommodation.get("cost_per_night")
        acc_cost_str = f"₹{acc_cost}/night" if acc_cost is not None else ""
        daily_budget = day_data.get("daily_budget")
        budget_str = f"₹{daily_budget}" if daily_budget is not None else "—"
        booking_link = accommodation.get("booking_link", "")
        gmaps_link = accommodation.get("google_maps_link", "")

        # Budget detail enriched
        budget_detail = day_data.get("budget_detail")
        budget_detail_html = ""
        if budget_detail and isinstance(budget_detail, dict):
            items = "".join(
                f'<span class="bd-item"><strong>{_esc(k)}:</strong> ₹{_esc(str(v))}</span>'
                for k, v in budget_detail.items()
            )
            budget_detail_html = f'<div class="budget-detail">{items}</div>'

        # Travel costs enriched
        travel_costs = day_data.get("travel_costs", [])
        travel_costs_html = ""
        if travel_costs and isinstance(travel_costs, list):
            items = "".join(
                f'<span class="tc-item">🚕 {_esc(tc.get("from",""))} → {_esc(tc.get("to",""))} ({_esc(tc.get("mode",""))}) — ₹{tc.get("cost_inr","")}</span>'
                for tc in travel_costs
            )
            travel_costs_html = f'<div class="travel-costs">{items}</div>'

        # Extra activities enriched
        extra_activities = day_data.get("extra_activities", [])
        extra_html = ""
        if extra_activities and isinstance(extra_activities, list):
            items = "".join(f'<li>{_esc(a)}</li>' for a in extra_activities)
            extra_html = f'<div class="extra-activities"><strong>📍 Extra activities:</strong> <ul>{items}</ul></div>'

        acc_links = ""
        if booking_link:
            acc_links += f' <a href="{_esc(booking_link)}">🔗 Book</a>'
        if gmaps_link:
            acc_links += f' <a href="{_esc(gmaps_link)}">📍 Map</a>'

        day_sections.append(f"""
        <div class="day-section">
            <h2 class="day-header">Day {day_num} · {date} — {theme}</h2>
            <table class="activities-table">
                <thead>
                    <tr>
                        <th>🌅 Morning</th>
                        <th>☀️ Afternoon</th>
                        <th>🌙 Evening</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        {_activity_cell(morning)}
                        {_activity_cell(afternoon)}
                        {_activity_cell(evening)}
                    </tr>
                </tbody>
            </table>
            <div class="day-meta">
                <span class="meta-item">🏨 <strong>Stay:</strong> {acc_name}
                    {"<small>(" + acc_cost_str + ")</small>" if acc_cost_str else ""}
                    {acc_links}
                </span>
                <span class="meta-item">💰 <strong>Daily budget:</strong> {budget_str}</span>
            </div>
            {budget_detail_html}
            {travel_costs_html}
            {extra_html}
        </div>
        """)

    # Packing list
    packing_items = "\n".join(
        f"<li>{_esc(item)}</li>" for item in packing
    ) if packing else "<li>No suggestions provided.</li>"

    notes_section = (
        f'<div class="notes-box"><strong>Important Notes:</strong> {important_notes}</div>'
        if important_notes
        else ""
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  /* ── Reset & base ──────────────────────────────────── */
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 11pt;
    color: #1a1a2e;
    line-height: 1.5;
    padding: 20mm 18mm;
  }}

  /* ── Header ────────────────────────────────────────── */
  .trip-header {{
    border-bottom: 3px solid #4a6fa5;
    padding-bottom: 10px;
    margin-bottom: 18px;
  }}
  .trip-header h1 {{
    font-size: 22pt;
    color: #4a6fa5;
    letter-spacing: 0.5px;
  }}
  .trip-header .dates {{
    font-size: 10pt;
    color: #666;
    margin-top: 2px;
  }}
  .trip-summary {{
    font-size: 10.5pt;
    color: #444;
    margin-top: 8px;
    font-style: italic;
  }}

  /* ── Day sections ──────────────────────────────────── */
  .day-section {{
    margin-bottom: 22px;
    page-break-inside: avoid;
  }}
  .day-header {{
    font-size: 13pt;
    color: #16213e;
    background: #eef2f7;
    padding: 5px 10px;
    border-left: 4px solid #4a6fa5;
    margin-bottom: 8px;
  }}

  /* ── Activities table ─────────────────────────────── */
  .activities-table {{
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
    font-size: 9.5pt;
  }}
  .activities-table th {{
    background: #4a6fa5;
    color: white;
    padding: 5px 8px;
    text-align: left;
    font-weight: 600;
    width: 33.3%;
  }}
  .activities-table td {{
    padding: 6px 8px;
    border: 1px solid #d8e0ec;
    vertical-align: top;
    background: #fff;
  }}
  .activities-table small {{
    color: #777;
    font-size: 8.5pt;
  }}

  /* ── Day meta ──────────────────────────────────────── */
  .day-meta {{
    display: flex;
    gap: 24px;
    font-size: 9.5pt;
    color: #444;
    padding: 4px 2px;
  }}
  .meta-item small {{ color: #888; font-size: 8.5pt; }}

  /* ── Footer ────────────────────────────────────────── */
  .footer-section {{
    border-top: 2px solid #4a6fa5;
    padding-top: 12px;
    margin-top: 10px;
  }}
  .footer-section h3 {{
    font-size: 12pt;
    color: #4a6fa5;
    margin-bottom: 6px;
  }}
  .packing-list {{
    columns: 2;
    column-gap: 24px;
    list-style: disc;
    padding-left: 18px;
    font-size: 9.5pt;
  }}
  .packing-list li {{ margin-bottom: 3px; }}
  .notes-box {{
    margin-top: 12px;
    background: #fff8e1;
    border-left: 4px solid #f9a825;
    padding: 8px 10px;
    font-size: 9.5pt;
    color: #5d4037;
  }}

  /* ── Enriched fields ──────────────────────────────── */
  .budget-detail {{
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 6px;
    font-size: 8.5pt;
  }}
  .bd-item {{
    background: #e8f5e9;
    padding: 2px 6px;
    border-radius: 3px;
  }}
  .travel-costs {{
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 4px;
    font-size: 8.5pt;
  }}
  .tc-item {{
    background: #e3f2fd;
    padding: 2px 6px;
    border-radius: 3px;
  }}
  .extra-activities {{
    margin-top: 4px;
    font-size: 8.5pt;
  }}
  .extra-activities ul {{
    margin: 2px 0 0 16px;
  }}
  .day-meta a {{
    color: #1a73e8;
    text-decoration: none;
  }}
</style>
</head>
<body>

<div class="trip-header">
  <h1>✈ {destination}</h1>
  {"<p class='dates'>" + trip_dates + "</p>" if trip_dates else ""}
  {"<p class='trip-summary'>" + trip_summary + "</p>" if trip_summary else ""}
</div>

{"".join(day_sections)}

<div class="footer-section">
  <h3>🧳 Packing Suggestions</h3>
  <ul class="packing-list">
    {packing_items}
  </ul>
  {notes_section}
</div>

</body>
</html>"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def generate_pdf(final_plan: dict[str, Any]) -> bytes:
    """Render *final_plan* to a PDF and return the raw bytes.

    Raises
    ------
    ImportError
        If WeasyPrint is not installed.
    """
    try:
        from weasyprint import HTML  # noqa: PLC0415
    except ImportError as exc:
        raise ImportError(
            "Install weasyprint: pip install weasyprint"
        ) from exc

    html_content = _build_html(final_plan)
    pdf_bytes: bytes = HTML(string=html_content).write_pdf()
    return pdf_bytes


def generate_ical(final_plan: dict[str, Any]) -> str:
    """Build an iCalendar (.ics) string from *final_plan*.

    One VEVENT is created per itinerary day.

    Raises
    ------
    ImportError
        If icalendar is not installed.
    """
    try:
        from icalendar import Calendar, Event, vDate, vText  # noqa: PLC0415
    except ImportError as exc:
        raise ImportError(
            "Install icalendar: pip install icalendar"
        ) from exc

    from datetime import date as _date  # noqa: PLC0415

    destination: str = final_plan.get("destination", "Unknown")
    itinerary: dict[str, Any] = final_plan.get("itinerary", {})
    days: list[dict[str, Any]] = itinerary.get("days", [])

    cal = Calendar()
    cal.add("prodid", "-//AI Travel Planner//travel-plan//EN")
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("method", "PUBLISH")
    cal.add("x-wr-calname", vText(f"Trip to {destination}"))

    for day_data in days:
        day_num: int = day_data.get("day", 0)
        theme: str = day_data.get("theme", "")
        date_str: str = day_data.get("date", "")

        # Parse date string "YYYY-MM-DD"
        try:
            year, month, day = (int(p) for p in date_str.split("-"))
            event_date = _date(year, month, day)
        except (ValueError, AttributeError):
            continue  # skip malformed dates

        # Build description from the three time-of-day slots
        slots: list[str] = []
        for slot_key in ("morning", "afternoon", "evening"):
            slot = day_data.get(slot_key)
            if slot and isinstance(slot, dict):
                activity = slot.get("activity", "")
                if activity:
                    slots.append(activity)
        description = " | ".join(slots) if slots else "No activities recorded."

        event = Event()
        event.add("summary", vText(f"Day {day_num}: {theme} in {destination}"))
        event.add("dtstart", vDate(event_date))
        event.add("dtend", vDate(event_date))   # all-day event
        event.add("description", vText(description))
        event.add("location", vText(destination))
        cal.add_component(event)

    return cal.to_ical().decode("utf-8")
