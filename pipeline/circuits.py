"""Circuit outlines traced from car position samples (OpenF1 `location`).

For each round the fastest race lap is used as the reference lap: by definition
a clean flying lap. The trace is the path that car drove, sampled at a constant
time step — it is not surveyed track geometry and carries no elevation.

    python pipeline/circuits.py 2025
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from apexgp import config  # noqa: E402
from apexgp.sources import jolpica, openf1  # noqa: E402
from apexgp.replay import _match_session, parse_iso  # noqa: E402

N_POINTS = 240


def iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]


def main() -> None:
    season = int(sys.argv[1])
    races = jolpica.results(season)
    sessions = openf1.race_sessions(season)
    out_dir = config.APP_DATA_DIR / "circuits"
    out_dir.mkdir(parents=True, exist_ok=True)
    for race in races:
        cid = race["Circuit"]["circuitId"]
        target = out_dir / f"{cid}.json"
        session = _match_session(race, sessions)
        fl = next((r for r in race["Results"] if r.get("FastestLap", {}).get("rank") == "1"), None)
        if session is None or fl is None:
            print(f"{cid}: no session / fastest lap reference; skipped", flush=True)
            continue
        number, lap = int(fl["number"]), int(fl["FastestLap"]["lap"])
        laps = openf1.session_table(session["session_key"], "laps")
        row = next((x for x in laps if x["driver_number"] == number and x["lap_number"] == lap), None)
        if row is None or not row.get("date_start") or not row.get("lap_duration"):
            print(f"{cid}: reference lap not in OpenF1 laps; skipped", flush=True)
            continue
        t0 = parse_iso(row["date_start"])
        t1 = t0 + float(row["lap_duration"])
        samples = openf1.location_window(session["session_key"], number, iso(t0), iso(t1))
        pts = [(parse_iso(s["date"]), float(s["x"]), float(s["y"])) for s in samples if s.get("x") is not None and (s["x"] or s["y"])]
        if len(pts) < 60:
            print(f"{cid}: only {len(pts)} position samples; skipped", flush=True)
            continue
        pts.sort()
        t = np.array([p[0] for p in pts]) - t0
        x = np.array([p[1] for p in pts])
        y = np.array([p[2] for p in pts])
        grid = np.linspace(0.0, float(row["lap_duration"]), N_POINTS, endpoint=False)
        xi = np.interp(grid, t, x)
        yi = np.interp(grid, t, y)
        span = max(xi.max() - xi.min(), yi.max() - yi.min())
        xn = (xi - (xi.max() + xi.min()) / 2) / span + 0.5
        yn = 0.5 - (yi - (yi.max() + yi.min()) / 2) / span   # screen coordinates: y down
        target.write_text(json.dumps({
            "id": cid, "points": [[round(float(a), 4), round(float(b), 4)] for a, b in zip(xn, yn)],
            "lapSeconds": round(float(row["lap_duration"]), 3), "samples": len(pts),
            "reference": {"season": season, "round": int(race["round"]), "driverNumber": number, "lap": lap},
            "source": openf1.source_url(session["session_key"], "location"),
            "note": "Path driven on the fastest race lap, resampled at a constant time step. Not surveyed geometry.",
        }, separators=(",", ":")))
        print(f"{cid}: {len(pts)} samples -> {N_POINTS} points ({row['lap_duration']}s lap)", flush=True)


if __name__ == "__main__":
    main()
