"""Warm the source cache for a replay season (idempotent, resumable).

    python pipeline/fetch.py 2025 [--no-laps]
"""
from __future__ import annotations

import sys

from apexgp.sources import jolpica, openf1


def main() -> None:
    season = int(sys.argv[1])
    want_laps = "--no-laps" not in sys.argv

    sched = jolpica.schedule(season)
    res = jolpica.results(season)
    jolpica.qualifying(season)
    jolpica.sprints(season)
    rounds = [int(r["round"]) for r in res]
    print(f"[jolpica] {season}: {len(sched)} scheduled, {len(rounds)} with results", flush=True)

    sessions = openf1.race_sessions(season)
    print(f"[openf1] {season}: {len(sessions)} race sessions", flush=True)
    for s in sessions:
        for ep in openf1.SESSION_ENDPOINTS:
            rows = openf1.session_table(s["session_key"], ep)
            if ep == "laps":
                print(f"[openf1] {s['date_start'][:10]} {s['country_name']}: {len(rows)} lap rows", flush=True)

    for rnd in rounds:
        jolpica.driver_standings(season, rnd)
        jolpica.constructor_standings(season, rnd)
        jolpica.pitstops(season, rnd)
    print("[jolpica] standings + pit stops cached", flush=True)

    if want_laps:
        for rnd in rounds:
            laps = jolpica.laps(season, rnd)
            print(f"[jolpica] round {rnd}: {len(laps)} laps", flush=True)
    print(f"done. network calls: jolpica={jolpica.client.network_calls} openf1={openf1.client.network_calls}", flush=True)


if __name__ == "__main__":
    main()
