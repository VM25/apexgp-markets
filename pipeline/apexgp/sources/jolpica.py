"""Jolpica F1 (Ergast-compatible) — official classifications, grids, calendar, standings, lap chart."""
from __future__ import annotations

from typing import Any

from ..config import JOLPICA_BASE
from ..http import CachedClient

# Documented limits: 4 requests/s burst, 500 requests/hour sustained (unauthenticated).
client = CachedClient("jolpica", min_interval_s=0.6)

PAGE = 100


def _paged(path: str, table_key: str, list_key: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    offset = 0
    while True:
        body = client.get(f"{JOLPICA_BASE}/{path}.json?limit={PAGE}&offset={offset}")
        mr = body["MRData"]
        out.extend(mr[table_key][list_key])
        total = int(mr["total"])
        offset += PAGE
        if offset >= total:
            return out


def _merge_races(races: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    """Paging splits a race's rows across pages; stitch them back together by round."""
    by_round: dict[int, dict[str, Any]] = {}
    for race in races:
        rnd = int(race["round"])
        if rnd not in by_round:
            by_round[rnd] = {**race, key: list(race.get(key, []))}
        else:
            by_round[rnd][key].extend(race.get(key, []))
    return [by_round[r] for r in sorted(by_round)]


def schedule(season: int) -> list[dict[str, Any]]:
    return _paged(f"{season}", "RaceTable", "Races")


def results(season: int) -> list[dict[str, Any]]:
    return _merge_races(_paged(f"{season}/results", "RaceTable", "Races"), "Results")


def qualifying(season: int) -> list[dict[str, Any]]:
    return _merge_races(_paged(f"{season}/qualifying", "RaceTable", "Races"), "QualifyingResults")


def sprints(season: int) -> list[dict[str, Any]]:
    return _merge_races(_paged(f"{season}/sprint", "RaceTable", "Races"), "SprintResults")


def laps(season: int, rnd: int) -> list[dict[str, Any]]:
    races = _paged(f"{season}/{rnd}/laps", "RaceTable", "Races")
    merged: dict[int, list[dict[str, Any]]] = {}
    for race in races:
        for lap in race.get("Laps", []):
            merged.setdefault(int(lap["number"]), []).extend(lap["Timings"])
    return [{"number": n, "Timings": merged[n]} for n in sorted(merged)]


def pitstops(season: int, rnd: int) -> list[dict[str, Any]]:
    races = _paged(f"{season}/{rnd}/pitstops", "RaceTable", "Races")
    out: list[dict[str, Any]] = []
    for race in races:
        out.extend(race.get("PitStops", []))
    return out


def driver_standings(season: int, rnd: int) -> list[dict[str, Any]]:
    body = client.get(f"{JOLPICA_BASE}/{season}/{rnd}/driverstandings.json?limit={PAGE}")
    lists = body["MRData"]["StandingsTable"]["StandingsLists"]
    return lists[0]["DriverStandings"] if lists else []


def constructor_standings(season: int, rnd: int) -> list[dict[str, Any]]:
    body = client.get(f"{JOLPICA_BASE}/{season}/{rnd}/constructorstandings.json?limit={PAGE}")
    lists = body["MRData"]["StandingsTable"]["StandingsLists"]
    return lists[0]["ConstructorStandings"] if lists else []
