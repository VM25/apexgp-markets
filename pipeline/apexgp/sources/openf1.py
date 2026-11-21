"""OpenF1 — timestamped in-race observations (laps, stints, pits, race control, weather)."""
from __future__ import annotations

from typing import Any

from ..config import OPENF1_BASE
from ..http import CachedClient

# Free tier: 3 requests/s and 30 requests/min. We stay well under both.
client = CachedClient("openf1", min_interval_s=2.3)

SESSION_ENDPOINTS = ("laps", "stints", "pit", "race_control", "weather", "drivers", "session_result")


def race_sessions(year: int) -> list[dict[str, Any]]:
    rows = client.get(f"{OPENF1_BASE}/sessions?year={year}&session_name=Race")
    return sorted(rows, key=lambda r: r["date_start"])


def meetings(year: int) -> list[dict[str, Any]]:
    return client.get(f"{OPENF1_BASE}/meetings?year={year}")


def session_table(session_key: int, endpoint: str) -> list[dict[str, Any]]:
    assert endpoint in SESSION_ENDPOINTS, endpoint
    rows = client.get(f"{OPENF1_BASE}/{endpoint}?session_key={session_key}", allow_404=True)
    return rows or []


def location_window(session_key: int, driver_number: int, start_iso: str, end_iso: str) -> list[dict[str, Any]]:
    """Car position samples (x, y) for one driver in a time window — used only for circuit outlines."""
    url = (
        f"{OPENF1_BASE}/location?session_key={session_key}&driver_number={driver_number}"
        f"&date>={start_iso}&date<={end_iso}"
    )
    rows = client.get(url, allow_404=True)
    return rows or []


def source_url(session_key: int, endpoint: str) -> str:
    return f"{OPENF1_BASE}/{endpoint}?session_key={session_key}"
