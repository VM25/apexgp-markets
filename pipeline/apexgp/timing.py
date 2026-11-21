"""Canonical race timing and the strict as-of frame builder.

One ``RaceTiming`` describes everything that was *observed* in a race plus the
official classification used for settlement. ``build_frames`` turns the timing
into a sequence of information snapshots ("frames"). Training (Kaggle/Ergast
archive) and replay (Jolpica + OpenF1) both go through this module, so the
model is fitted on exactly the feature definitions it is later served with.

Information time
----------------
Let ``tau[m]`` be the race-clock time at which the first car completes lap m.

* frame 0      : the grid. Nothing from the race is known.
* frame n < N  : every line crossing strictly before ``tau[n+1]``. All cars on
                 the lead lap have completed lap n; the leader has not yet
                 completed lap n+1. This is the usual "end of lap n" lap chart,
                 but lapped cars are shown where they really were at that
                 instant instead of at their own (later) lap n.
* frame N      : every crossing of the race (chequered flag for all cars).

Frame n therefore depends only on crossings with time < tau[n+1]. The test
suite truncates the raw timing at that instant and checks that frames 0..n are
bit-identical (``tests/test_asof.py``).
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


@dataclass
class RaceTiming:
    season: int
    round: int
    name: str
    date: str
    circuit_id: str
    drivers: list[str]                 # canonical driver ids
    constructors: list[str]            # canonical constructor ids, aligned with drivers
    grid: np.ndarray                   # official grid slot; 0 = pit lane / no slot
    cum: list[np.ndarray]              # cum[i][k-1] = race clock (s) when driver i completed lap k
    pit_laps: list[list[int]]          # laps on which driver i entered the pits
    # --- settlement labels (never read by build_frames / features) ---
    final_order: np.ndarray            # official position order, 1 = winner
    classified: np.ndarray             # bool: has a numeric official finishing position
    status: list[str]
    points: np.ndarray
    total_laps: int = 0                # race distance in laps (winner's lap count)
    extra: dict = field(default_factory=dict)

    @property
    def n(self) -> int:
        return len(self.drivers)


@dataclass
class Frames:
    n_frames: int          # N + 1 (frame 0 is the grid)
    total_laps: int
    tau: np.ndarray        # tau[m], m = 0..N ; tau[0] = 0
    cutoff: np.ndarray     # information cutoff time of each frame
    laps: np.ndarray       # [F, D] laps completed by each car as of the frame
    order: np.ndarray      # [F, D] running order, 1 = first; stopped cars sort last
    gap: np.ndarray        # [F, D] seconds behind the first car across the line on the car's last lap
    pits: np.ndarray       # [F, D] pit stops completed
    down: np.ndarray       # [F, D] laps behind the lead lap
    stopped: np.ndarray    # [F, D] no line crossing during the leader's last two laps
    last_lap: np.ndarray   # [F, D] duration of the car's most recent lap (s), nan if none


def canonical(rt: RaceTiming) -> RaceTiming:
    """Reorder drivers by (grid slot, driver id) so that array position carries no outcome information.

    Sources list entrants in finishing order. Any index-based tie-break downstream
    would then leak the result, so every loader passes through here first.
    """
    keys = sorted(range(rt.n), key=lambda i: (rt.grid[i] <= 0, int(rt.grid[i]), rt.drivers[i]))
    idx = np.array(keys, dtype=int)
    return RaceTiming(
        season=rt.season, round=rt.round, name=rt.name, date=rt.date, circuit_id=rt.circuit_id,
        drivers=[rt.drivers[i] for i in keys], constructors=[rt.constructors[i] for i in keys],
        grid=rt.grid[idx], cum=[rt.cum[i] for i in keys], pit_laps=[rt.pit_laps[i] for i in keys],
        final_order=rt.final_order[idx], classified=rt.classified[idx], status=[rt.status[i] for i in keys],
        points=rt.points[idx], total_laps=rt.total_laps, extra={**rt.extra, "perm": keys},
    )


def start_rank(grid: np.ndarray) -> np.ndarray:
    """Rank on the starting grid, 1 = pole. Cars without a slot (grid 0) start behind everyone."""
    g = np.where(grid > 0, grid.astype(float), 1e6 + np.arange(len(grid)))
    return np.argsort(np.argsort(g, kind="stable"), kind="stable") + 1


def build_frames(rt: RaceTiming) -> Frames:
    D = rt.n
    lens = np.array([len(c) for c in rt.cum])
    N = int(lens.max()) if D else 0
    tau = np.zeros(N + 1)
    for m in range(1, N + 1):
        tau[m] = min(rt.cum[i][m - 1] for i in range(D) if lens[i] >= m)
    F = N + 1
    cutoff = np.zeros(F)
    laps = np.zeros((F, D), dtype=np.int32)
    for n in range(1, N):
        cutoff[n] = tau[n + 1]
        for i in range(D):
            laps[n, i] = np.searchsorted(rt.cum[i], tau[n + 1], side="left")
    if N >= 1:
        cutoff[N] = max((c[-1] for c in rt.cum if len(c)), default=0.0)
        laps[N] = lens

    srank = start_rank(rt.grid)
    order = np.zeros((F, D), dtype=np.int32)
    gap = np.zeros((F, D))
    pits = np.zeros((F, D), dtype=np.int32)
    down = np.zeros((F, D), dtype=np.int32)
    stopped = np.zeros((F, D), dtype=bool)
    last_lap = np.full((F, D), np.nan)

    for n in range(F):
        k = laps[n]
        last_cross = np.array([rt.cum[i][k[i] - 1] if k[i] > 0 else 0.0 for i in range(D)])
        if n >= 2:
            # No crossing during the leader's last two laps. A car merely being
            # lapped misses at most one interval, so two is unambiguous.
            stopped[n] = laps[n] <= laps[n - 2]
        lead = int(k.max())
        down[n] = lead - k
        for i in range(D):
            gap[n, i] = last_cross[i] - tau[k[i]] if k[i] > 0 else 0.0
            pits[n, i] = sum(1 for lap in rt.pit_laps[i] if lap <= k[i])
            if k[i] >= 2:
                last_lap[n, i] = rt.cum[i][k[i] - 1] - rt.cum[i][k[i] - 2]
            elif k[i] == 1:
                last_lap[n, i] = rt.cum[i][0]
        # Running order: not stopped first, then laps desc, then time at last crossing, then grid.
        keys = sorted(range(D), key=lambda i: (stopped[n, i], -k[i], last_cross[i] if k[i] > 0 else 0.0, srank[i]))
        for pos, i in enumerate(keys):
            order[n, i] = pos + 1

    return Frames(F, N, tau, cutoff, laps, order, gap, pits, down, stopped, last_lap)


def truncate(rt: RaceTiming, t: float) -> RaceTiming:
    """Drop every observation at or after race-clock time ``t`` and blank the settlement labels."""
    cum = [c[c < t] for c in rt.cum]
    pit_laps = [[lap for lap in pl if lap <= len(cum[i])] for i, pl in enumerate(rt.pit_laps)]
    D = rt.n
    return RaceTiming(
        season=rt.season, round=rt.round, name=rt.name, date=rt.date, circuit_id=rt.circuit_id,
        drivers=list(rt.drivers), constructors=list(rt.constructors), grid=rt.grid.copy(),
        cum=cum, pit_laps=pit_laps,
        final_order=np.zeros(D, dtype=np.int32), classified=np.zeros(D, dtype=bool),
        status=["?"] * D, points=np.zeros(D), total_laps=rt.total_laps,
    )
