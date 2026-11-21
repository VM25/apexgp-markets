"""Kaggle "Formula 1 World Championship" archive (Ergast-derived CSVs, 1950-2024).

Read straight from the zip; nothing is extracted or executed. Used for model
training, walk-forward validation and long-run form ratings only — the replay
seasons come from Jolpica + OpenF1.
"""
from __future__ import annotations

import zipfile
from functools import lru_cache

import numpy as np
import pandas as pd

from ..config import KAGGLE_ARCHIVE
from ..timing import RaceTiming, canonical

NA = ["\\N"]


@lru_cache(maxsize=None)
def table(name: str) -> pd.DataFrame:
    if not KAGGLE_ARCHIVE.exists():
        raise FileNotFoundError(
            f"{KAGGLE_ARCHIVE} not found. Download the Kaggle dataset "
            "'rohanrao/formula-1-world-championship-1950-2020' and place the zip at the repo root."
        )
    with zipfile.ZipFile(KAGGLE_ARCHIVE) as zf:
        member = next(m for m in zf.namelist() if m.endswith(f"/{name}.csv") and "__MACOSX" not in m)
        with zf.open(member) as fh:
            return pd.read_csv(fh, na_values=NA, keep_default_na=True)


def coverage() -> dict:
    races = table("races")
    year_of = races.set_index("raceId")["year"]
    out = {}
    for name in ("results", "qualifying", "lap_times", "pit_stops", "sprint_results"):
        yrs = table(name)["raceId"].map(year_of)
        out[name] = {"first_season": int(yrs.min()), "last_season": int(yrs.max()), "rows": int(len(yrs))}
    out["races"] = {"first_season": int(races.year.min()), "last_season": int(races.year.max()), "rows": int(len(races))}
    return out


def season_results(first: int, last: int) -> pd.DataFrame:
    """One row per (race, driver) with canonical ids and classification, ordered chronologically."""
    races = table("races")[["raceId", "year", "round", "name", "date", "circuitId"]]
    races = races[(races.year >= first) & (races.year <= last)]
    res = table("results").merge(races, on="raceId")
    res = res.merge(table("drivers")[["driverId", "driverRef", "code"]], on="driverId")
    res = res.merge(table("constructors")[["constructorId", "constructorRef"]], on="constructorId")
    res = res.merge(table("status"), on="statusId")
    res = res.merge(table("circuits")[["circuitId", "circuitRef"]], on="circuitId")
    res["classified"] = res["positionText"].astype(str).str.fullmatch(r"\d+")
    # A handful of historical entries list one driver twice (shared drives); keep the best row.
    res = res.sort_values(["year", "round", "positionOrder"]).drop_duplicates(["raceId", "driverId"])
    return res.reset_index(drop=True)


def sprint_results(first: int, last: int) -> pd.DataFrame:
    races = table("races")[["raceId", "year", "round"]]
    races = races[(races.year >= first) & (races.year <= last)]
    sp = table("sprint_results").merge(races, on="raceId")
    sp = sp.merge(table("drivers")[["driverId", "driverRef"]], on="driverId")
    sp = sp.merge(table("constructors")[["constructorId", "constructorRef"]], on="constructorId")
    return sp


def race_timings(first: int, last: int) -> list[RaceTiming]:
    res = season_results(first, last)
    laps = table("lap_times")
    pits = table("pit_stops")
    laps = laps[laps.raceId.isin(res.raceId.unique())]
    pits = pits[pits.raceId.isin(res.raceId.unique())]
    laps_by_race = {rid: g for rid, g in laps.groupby("raceId")}
    pits_by_race = {rid: g for rid, g in pits.groupby("raceId")}
    out: list[RaceTiming] = []
    for rid, g in res.groupby("raceId", sort=False):
        g = g.sort_values("positionOrder")
        lt = laps_by_race.get(rid)
        if lt is None:
            continue
        pt = pits_by_race.get(rid)
        cum: list[np.ndarray] = []
        pit_laps: list[list[int]] = []
        lt_by_driver = {d: x.sort_values("lap") for d, x in lt.groupby("driverId")}
        pt_by_driver = {d: x for d, x in pt.groupby("driverId")} if pt is not None else {}
        for did in g.driverId:
            x = lt_by_driver.get(did)
            if x is None:
                cum.append(np.zeros(0))
            else:
                # Keep the contiguous run of laps from lap 1 (a gap would corrupt the race clock).
                lapno = x.lap.to_numpy()
                ms = x.milliseconds.to_numpy(dtype=float)
                ok = lapno == np.arange(1, len(lapno) + 1)
                stop = len(lapno) if ok.all() else int(np.argmin(ok))
                cum.append(np.cumsum(ms[:stop]) / 1000.0)
            p = pt_by_driver.get(did)
            pit_laps.append(sorted(int(v) for v in p.lap) if p is not None else [])
        first_row = g.iloc[0]
        out.append(canonical(RaceTiming(
            season=int(first_row.year), round=int(first_row["round"]), name=str(first_row["name"]),
            date=str(first_row.date), circuit_id=str(first_row.circuitRef),
            drivers=list(g.driverRef), constructors=list(g.constructorRef),
            grid=g.grid.to_numpy(dtype=np.int32), cum=cum, pit_laps=pit_laps,
            final_order=g.positionOrder.to_numpy(dtype=np.int32),
            classified=g.classified.to_numpy(dtype=bool),
            status=list(g.status), points=g.points.to_numpy(dtype=float),
            total_laps=int(g.laps.max()),
        )))
    out.sort(key=lambda r: (r.season, r.round))
    return out
