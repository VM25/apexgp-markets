"""Build verified replay seasons from Jolpica (official record) and OpenF1 (timestamped context).

Field ownership
---------------
Jolpica  : calendar, entry list, starting grid, lap chart (lap times), pit-stop
           laps, official classification, points, standings.          [primary]
OpenF1   : race start instant, track status (SC / VSC / red flag), tyre stints,
           weather, race-control messages, team colours.              [primary]
           lap durations, lap-end timestamps, pit laps, classification. [cross-check]

Nothing here is invented. Where a source has no value the field is null and the
gap is counted in the race's quality report.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import numpy as np

from .sources import jolpica, openf1
from .timing import Frames, RaceTiming, build_frames, start_rank

COMPOUND_CODE = {"SOFT": "S", "MEDIUM": "M", "HARD": "H", "INTERMEDIATE": "I", "WET": "W"}
# Race-control messages and status changes are attributed to a frame only if they
# were published at least this long before the frame's information cutoff. The two
# clocks agree to ~0.1 s; the margin keeps a message from landing one frame early.
CONTEXT_MARGIN_S = 1.0


def parse_lap_time(text: str) -> float:
    parts = text.split(":")
    secs = float(parts[-1])
    if len(parts) >= 2:
        secs += 60 * int(parts[-2])
    if len(parts) == 3:
        secs += 3600 * int(parts[0])
    return secs


def parse_iso(text: str) -> float:
    return datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(timezone.utc).timestamp()


@dataclass
class RaceBuild:
    timing: RaceTiming
    frames: Frames
    info: dict[str, Any]                 # race header (names, circuit, dates)
    drivers: list[dict[str, Any]]        # aligned with timing.drivers
    t0_utc: float | None                 # race start (lights out) as a UTC epoch
    status: list[str]                    # track status per frame
    tyre: list[list[str | None]]         # [F][D]
    tyre_age: list[list[int | None]]
    weather: list[dict[str, Any] | None]
    events: list[list[dict[str, Any]]]
    classification: list[dict[str, Any]]
    sprint: list[dict[str, Any]] | None
    quality: dict[str, Any] = field(default_factory=dict)
    openf1_session_key: int | None = None
    fastest_lap_ref: dict[str, Any] | None = None


def _match_session(race: dict[str, Any], sessions: list[dict[str, Any]]) -> dict[str, Any] | None:
    start = parse_iso(f"{race['date']}T{race.get('time', '12:00:00Z')}")
    best = min(sessions, key=lambda s: abs(parse_iso(s["date_start"]) - start), default=None)
    if best is None or abs(parse_iso(best["date_start"]) - start) > 18 * 3600:
        return None
    return best


def _track_status_timeline(rc: list[dict[str, Any]]) -> list[tuple[float, str]]:
    """(utc, status) change points parsed from race-control messages."""
    out: list[tuple[float, str]] = []
    sc_ending = False
    state = "GREEN"
    for m in sorted(rc, key=lambda m: m["date"]):
        t = parse_iso(m["date"])
        msg = (m.get("message") or "").upper()
        new = None
        if m.get("category") == "SafetyCar":
            if "VIRTUAL SAFETY CAR DEPLOYED" in msg:
                new = "VSC"
            elif "VIRTUAL SAFETY CAR ENDING" in msg:
                new = "GREEN"
            elif "SAFETY CAR DEPLOYED" in msg:
                new, sc_ending = "SC", False
            elif "SAFETY CAR IN THIS LAP" in msg:
                sc_ending = True
        elif m.get("flag") == "RED":
            new, sc_ending = "RED", False
        elif m.get("flag") == "CHEQUERED":
            new = "FINISHED"
        elif m.get("scope") == "Track" and m.get("flag") == "CLEAR" and state == "SC" and sc_ending:
            new, sc_ending = "GREEN", False
        elif m.get("scope") == "Track" and m.get("flag") == "GREEN" and state == "RED":
            # Pit exit opens for the restart procedure; the field circulates behind the safety car.
            new, sc_ending = "SC", True
        if new and new != state:
            state = new
            out.append((t, new))
    return out


def _status_at(timeline: list[tuple[float, str]], t: float) -> str:
    state = "GREEN"
    for when, s in timeline:
        if when <= t:
            state = s
        else:
            break
    return state


RC_KEEP = (
    ("SAFETY CAR DEPLOYED", "SC"), ("VIRTUAL SAFETY CAR DEPLOYED", "VSC"),
    ("SAFETY CAR IN THIS LAP", "SC_END"), ("VIRTUAL SAFETY CAR ENDING", "VSC_END"),
    ("RED FLAG", "RED"), ("CHEQUERED FLAG", "FLAG"), ("PENALTY", "PENALTY"),
    ("STOPPED", "INCIDENT"), ("RETIRED", "INCIDENT"), ("RAIN", "WEATHER"),
    ("DISQUALIFIED", "PENALTY"), ("BLACK AND WHITE", "PENALTY"),
)


def _classify_rc(msg: str) -> str | None:
    up = msg.upper()
    if "CHEQUERED FLAG" in up:
        return "FLAG"
    if "VIRTUAL SAFETY CAR DEPLOYED" in up:
        return "VSC"
    if "VIRTUAL SAFETY CAR ENDING" in up:
        return "VSC_END"
    for needle, kind in RC_KEEP:
        if needle in up:
            if kind == "PENALTY" and ("NO FURTHER" in up or "NOTED" in up or "UNDER INVESTIGATION" in up or "WILL BE INVESTIGATED" in up):
                return None
            return kind
    return None


def build_race(season: int, race: dict[str, Any], session: dict[str, Any] | None,
               sprint: dict[str, Any] | None) -> RaceBuild:
    rnd = int(race["round"])
    # Entrants ordered by (grid slot, driver id): array position must not encode the result.
    results = sorted(race["Results"], key=lambda r: (int(r["grid"]) <= 0, int(r["grid"]), r["Driver"]["driverId"]))
    lap_rows = jolpica.laps(season, rnd)
    pit_rows = jolpica.pitstops(season, rnd)

    ids = [r["Driver"]["driverId"] for r in results]
    index = {d: i for i, d in enumerate(ids)}
    D = len(ids)
    lap_times: list[list[float]] = [[] for _ in range(D)]
    chart_pos: list[list[int]] = [[] for _ in range(D)]
    gaps_in_chart = 0
    for lap in lap_rows:
        n = int(lap["number"])
        for tm in lap["Timings"]:
            i = index.get(tm["driverId"])
            if i is None:
                continue
            if len(lap_times[i]) != n - 1:
                gaps_in_chart += 1
                continue
            lap_times[i].append(parse_lap_time(tm["time"]))
            chart_pos[i].append(int(tm["position"]))
    cum = [np.cumsum(np.array(x)) if x else np.zeros(0) for x in lap_times]
    pit_laps: list[list[int]] = [[] for _ in range(D)]
    for p in pit_rows:
        i = index.get(p["driverId"])
        if i is not None:
            pit_laps[i].append(int(p["lap"]))
    for pl in pit_laps:
        pl.sort()

    classified = np.array([r["positionText"].isdigit() for r in results])
    total_laps = max(int(r["laps"]) for r in results)
    rt = RaceTiming(
        season=season, round=rnd, name=race["raceName"], date=race["date"],
        circuit_id=race["Circuit"]["circuitId"], drivers=ids,
        constructors=[r["Constructor"]["constructorId"] for r in results],
        grid=np.array([int(r["grid"]) for r in results], dtype=np.int32),
        cum=cum, pit_laps=pit_laps,
        final_order=np.array([int(r["position"]) for r in results], dtype=np.int32),
        classified=classified, status=[r["status"] for r in results],
        points=np.array([float(r["points"]) for r in results]), total_laps=total_laps,
    )
    fr = build_frames(rt)
    F = fr.n_frames

    quality: dict[str, Any] = {"lap_chart_gaps": gaps_in_chart}
    # --- internal consistency of the official record ---------------------------------------
    laps_official = np.array([int(r["laps"]) for r in results])
    laps_chart = np.array([len(c) for c in cum])
    quality["lap_count_mismatch"] = [
        {"driver": ids[i], "official": int(laps_official[i]), "chart": int(laps_chart[i]),
         "explained": "disqualified: official lap count is zeroed" if results[i]["positionText"] == "D" else None}
        for i in range(D) if laps_official[i] != laps_chart[i]
    ]
    winner = next(i for i, r in enumerate(results) if r["position"] == "1")
    official_ms = results[winner].get("Time", {}).get("millis")
    if official_ms and len(cum[winner]):
        quality["winner_time_diff_s"] = round(float(cum[winner][-1]) - int(official_ms) / 1000.0, 3)
    # Lap-chart positions vs positions re-derived from cumulative lap times (same lap number).
    agree = total = 0
    for n in range(1, total_laps + 1):
        have = [i for i in range(D) if len(cum[i]) >= n]
        ranked = sorted(have, key=lambda i: cum[i][n - 1])
        for pos, i in enumerate(ranked, start=1):
            total += 1
            agree += int(chart_pos[i][n - 1] == pos)
    quality["chart_position_agreement"] = round(agree / total, 5) if total else None
    quality["chart_position_cells"] = total

    # --- OpenF1 context -----------------------------------------------------------------------
    numbers = [int(r["number"]) for r in results]
    num_index = {num: i for i, num in enumerate(numbers)}
    drivers_out: list[dict[str, Any]] = []
    for i, r in enumerate(results):
        drivers_out.append({
            "id": ids[i], "code": r["Driver"].get("code") or ids[i][:3].upper(), "number": numbers[i],
            "name": f"{r['Driver']['givenName']} {r['Driver']['familyName']}",
            "team": r["Constructor"]["constructorId"], "teamName": r["Constructor"]["name"], "color": None,
        })

    t0 = None
    status = ["GREEN"] * F
    tyre: list[list[str | None]] = [[None] * D for _ in range(F)]
    tyre_age: list[list[int | None]] = [[None] * D for _ in range(F)]
    weather: list[dict[str, Any] | None] = [None] * F
    events: list[list[dict[str, Any]]] = [[] for _ in range(F)]
    key = None
    if session is not None:
        key = session["session_key"]
        o_drivers = openf1.session_table(key, "drivers")
        o_laps = openf1.session_table(key, "laps")
        o_stints = openf1.session_table(key, "stints")
        o_pit = openf1.session_table(key, "pit")
        o_rc = openf1.session_table(key, "race_control")
        o_weather = openf1.session_table(key, "weather")
        o_result = openf1.session_table(key, "session_result")

        code_mismatch = []
        for od in o_drivers:
            i = num_index.get(od["driver_number"])
            if i is None:
                continue
            drivers_out[i]["color"] = f"#{od['team_colour']}" if od.get("team_colour") else None
            if od.get("name_acronym") and od["name_acronym"] != drivers_out[i]["code"]:
                code_mismatch.append({"number": od["driver_number"], "openf1": od["name_acronym"], "jolpica": drivers_out[i]["code"]})
        quality["identity_mismatch"] = code_mismatch
        quality["drivers_without_openf1"] = [ids[i] for i in range(D) if numbers[i] not in {od["driver_number"] for od in o_drivers}]

        started = [m for m in o_rc if m.get("category") == "SessionStatus" and "STARTED" in (m.get("message") or "")]
        # Lap-end instants in UTC: the start of the next lap, else start + duration.
        by_driver: dict[int, dict[int, dict[str, Any]]] = {}
        for row in o_laps:
            by_driver.setdefault(row["driver_number"], {})[row["lap_number"]] = row
        ends: list[tuple[int, int, float]] = []
        dur_diffs: list[float] = []
        for num, laps_d in by_driver.items():
            i = num_index.get(num)
            if i is None:
                continue
            for n, row in laps_d.items():
                if row.get("lap_duration") is not None and n <= len(lap_times[i]):
                    dur_diffs.append(row["lap_duration"] - lap_times[i][n - 1])
                nxt = laps_d.get(n + 1)
                if nxt and nxt.get("date_start"):
                    ends.append((i, n, parse_iso(nxt["date_start"])))
                elif row.get("date_start") and row.get("lap_duration") is not None:
                    ends.append((i, n, parse_iso(row["date_start"]) + row["lap_duration"]))
        offsets = np.array([utc - cum[i][n - 1] for i, n, utc in ends if n <= len(cum[i])])
        if started:
            t0 = parse_iso(started[0]["date"])
        elif len(offsets):
            t0 = float(np.median(offsets))
        if len(offsets) and t0 is not None:
            resid = offsets - np.median(offsets)
            quality["clock_alignment"] = {
                "n": int(len(offsets)),
                "t0_vs_session_start_s": round(float(np.median(offsets) - t0), 3),
                "median_abs_residual_s": round(float(np.median(np.abs(resid))), 3),
                "p95_abs_residual_s": round(float(np.percentile(np.abs(resid), 95)), 3),
            }
            # Use the timing-derived offset for mapping UTC events onto the race clock.
            t0 = float(np.median(offsets))
        if dur_diffs:
            dd = np.abs(np.array(dur_diffs))
            quality["lap_time_crosscheck"] = {
                "n": int(len(dd)), "share_within_5ms": round(float((dd <= 0.005).mean()), 5),
                "share_within_100ms": round(float((dd <= 0.1).mean()), 5), "max_abs_diff_s": round(float(dd.max()), 3),
            }
        j_pits = {(ids[i], lap) for i in range(D) for lap in pit_laps[i]}
        o_pits = {(ids[num_index[p["driver_number"]]], p["lap_number"]) for p in o_pit if p["driver_number"] in num_index}
        union = j_pits | o_pits
        quality["pit_crosscheck"] = {
            "jolpica": len(j_pits), "openf1": len(o_pits),
            "jaccard": round(len(j_pits & o_pits) / len(union), 4) if union else None,
        }
        o_pos = {r_["driver_number"]: r_.get("position") for r_ in o_result}
        diffs = [
            {"driver": ids[i], "jolpica": int(results[i]["position"]) if classified[i] else None, "openf1": o_pos.get(numbers[i])}
            for i in range(D)
            if (int(results[i]["position"]) if classified[i] else None) != o_pos.get(numbers[i])
        ]
        quality["classification_crosscheck"] = {"n": D, "differences": diffs}

        if t0 is not None:
            timeline = _track_status_timeline(o_rc)
            # Stints per driver for the tyre on the lap in progress.
            stints: dict[int, list[dict[str, Any]]] = {}
            for s in o_stints:
                i = num_index.get(s["driver_number"])
                if i is not None and s.get("lap_start") is not None:
                    stints.setdefault(i, []).append(s)
            w_sorted = sorted((w for w in o_weather if w.get("date")), key=lambda w: w["date"])
            w_times = np.array([parse_iso(w["date"]) for w in w_sorted])
            rc_sorted = sorted((m for m in o_rc if m.get("date")), key=lambda m: m["date"])
            rc_times = np.array([parse_iso(m["date"]) for m in rc_sorted])
            prev_cut = -1e18
            for n in range(F):
                cut = t0 + fr.cutoff[n] - (CONTEXT_MARGIN_S if 0 < n < F - 1 else 0.0)
                st = _status_at(timeline, cut)
                status[n] = "GREEN" if st == "FINISHED" else st
                for i in range(D):
                    lap_in_progress = min(int(fr.laps[n, i]) + 1, max(int(laps_chart[i]), 1))
                    for s in stints.get(i, []):
                        end = s.get("lap_end") or s["lap_start"]
                        if s["lap_start"] <= lap_in_progress <= end:
                            tyre[n][i] = COMPOUND_CODE.get((s.get("compound") or "").upper())
                            base = s.get("tyre_age_at_start") or 0
                            tyre_age[n][i] = int(base + (int(fr.laps[n, i]) + 1 - s["lap_start"]))
                            break
                k = int(np.searchsorted(w_times, cut, side="right")) - 1
                if k >= 0:
                    w = w_sorted[k]
                    weather[n] = {"air": w.get("air_temperature"), "track": w.get("track_temperature"),
                                  "rain": bool(w.get("rainfall")), "humidity": w.get("humidity"), "wind": w.get("wind_speed")}
                if n > 0:
                    a = int(np.searchsorted(rc_times, prev_cut, side="right"))
                    b = int(np.searchsorted(rc_times, cut, side="right"))
                    for m in rc_sorted[a:b]:
                        kind = _classify_rc(m.get("message") or "")
                        if kind:
                            ev: dict[str, Any] = {"type": kind, "text": (m["message"] or "").strip()}
                            if m.get("driver_number") in num_index:
                                ev["d"] = num_index[m["driver_number"]]
                            events[n].append(ev)
                prev_cut = cut
            quality["tyre_missing_cells"] = int(sum(1 for n in range(F) for i in range(D) if tyre[n][i] is None and not fr.stopped[n, i] and laps_chart[i] > 0))
    else:
        quality["openf1_session"] = "not found"

    # --- events derived from the timing itself (no extra source) ---------------------------
    best = np.inf
    for n in range(1, F):
        leader_prev = int(np.argmin(fr.order[n - 1]))
        leader_now = int(np.argmin(fr.order[n]))
        if n > 1 and leader_now != leader_prev:
            events[n].append({"type": "LEAD", "text": f"{drivers_out[leader_now]['code']} takes the lead from {drivers_out[leader_prev]['code']}", "d": leader_now})
        for i in range(D):
            if fr.pits[n, i] > fr.pits[n - 1, i]:
                events[n].append({"type": "PIT", "text": f"{drivers_out[i]['code']} pit stop ({int(fr.pits[n, i])})", "d": i})
            if fr.stopped[n, i] and not fr.stopped[n - 1, i]:
                events[n].append({"type": "OUT", "text": f"{drivers_out[i]['code']} has not crossed the line for two laps", "d": i})
            if not fr.stopped[n, i] and fr.stopped[n - 1, i]:
                events[n].append({"type": "BACK", "text": f"{drivers_out[i]['code']} is running again", "d": i})
            if fr.laps[n, i] > fr.laps[n - 1, i] and fr.laps[n, i] >= 2:
                lt = fr.last_lap[n, i]
                if np.isfinite(lt) and lt < best - 1e-9:
                    if np.isfinite(best) and n > 3:
                        events[n].append({"type": "FASTEST", "text": f"{drivers_out[i]['code']} sets the fastest lap so far ({lt:.3f}s)", "d": i})
                    best = lt

    classification = []
    for i, r in sorted(enumerate(results), key=lambda ir: int(ir[1]["position"])):
        classification.append({
            "id": ids[i], "order": int(r["position"]), "position": int(r["position"]) if classified[i] else None,
            "text": r["positionText"], "classified": bool(classified[i]), "status": r["status"],
            "points": float(r["points"]), "laps": int(r["laps"]), "grid": int(r["grid"]),
            "time": r.get("Time", {}).get("time"),
        })
    sprint_out = None
    if sprint is not None:
        sprint_out = [{
            "id": s["Driver"]["driverId"], "team": s["Constructor"]["constructorId"],
            "position": int(s["position"]) if s["positionText"].isdigit() else None,
            "text": s["positionText"], "points": float(s["points"]),
        } for s in sprint["SprintResults"]]

    fl = min((r for r in results if r.get("FastestLap", {}).get("rank") == "1"), key=lambda r: 0, default=None)
    fastest_ref = None
    if fl is not None:
        fastest_ref = {"driver": fl["Driver"]["driverId"], "number": int(fl["number"]), "lap": int(fl["FastestLap"]["lap"]),
                       "time": fl["FastestLap"]["Time"]["time"]}

    info = {
        "season": season, "round": rnd, "name": race["raceName"],
        "circuit": {"id": race["Circuit"]["circuitId"], "name": race["Circuit"]["circuitName"],
                    "locality": race["Circuit"]["Location"]["locality"], "country": race["Circuit"]["Location"]["country"]},
        "date": race["date"], "timeUtc": race.get("time"), "sprintWeekend": sprint is not None,
    }
    return RaceBuild(rt, fr, info, drivers_out, t0, status, tyre, tyre_age, weather, events, classification,
                     sprint_out, quality, key, fastest_ref)


def build_season(season: int) -> list[RaceBuild]:
    races = jolpica.results(season)
    sprints = {int(s["round"]): s for s in jolpica.sprints(season)}
    sessions = openf1.race_sessions(season)
    out = []
    for race in races:
        session = _match_session(race, sessions)
        out.append(build_race(season, race, session, sprints.get(int(race["round"]))))
    return out
