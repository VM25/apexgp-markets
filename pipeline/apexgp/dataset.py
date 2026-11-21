"""Assemble model-ready snapshot tensors from a chronological list of races."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from . import features as F
from .ratings import Ratings
from .timing import RaceTiming, build_frames

D_MAX = 26


@dataclass
class Snapshots:
    X: np.ndarray          # [S, D_MAX, n_order_features]
    H: np.ndarray          # [S, D_MAX, n_hazard_features]
    B: np.ndarray          # [S, N_BASIS]
    running: np.ndarray    # [S, D_MAX] bool — in the race and not flagged stopped
    present: np.ndarray    # [S, D_MAX] bool — entered
    final_order: np.ndarray  # [S, D_MAX] official order (label)
    classified: np.ndarray   # [S, D_MAX] bool (label)
    race: np.ndarray       # [S] index into ``meta``
    frame: np.ndarray      # [S]
    s: np.ndarray          # [S] progress n / N
    order: np.ndarray      # [S, D_MAX] running order at the frame (for baselines)
    meta: list[dict]

    def subset(self, mask: np.ndarray) -> "Snapshots":
        return Snapshots(self.X[mask], self.H[mask], self.B[mask], self.running[mask], self.present[mask],
                         self.final_order[mask], self.classified[mask], self.race[mask], self.frame[mask],
                         self.s[mask], self.order[mask], self.meta)


def usable(rt: RaceTiming) -> bool:
    """Races need a real lap chart: enough distance and timing for most of the field."""
    if rt.total_laps < 20 or rt.n < 10 or rt.n > D_MAX:
        return False
    with_laps = sum(1 for c in rt.cum if len(c) > 0)
    winner = int(np.argmin(rt.final_order))
    return with_laps >= 0.7 * rt.n and len(rt.cum[winner]) == rt.total_laps


def build(races: list[RaceTiming], first_season: int, ratings: Ratings | None = None, frame_step: int = 1) -> Snapshots:
    ratings = ratings or Ratings()
    Xs, Hs, Bs, run, pres, fo, cl, ridx, fidx, ss, orders = ([] for _ in range(11))
    meta: list[dict] = []
    for rt in races:
        r = ratings.before(rt.season, rt.drivers, rt.constructors)
        if rt.season >= first_season and usable(rt):
            fr = build_frames(rt)
            N = rt.total_laps
            mi = len(meta)
            meta.append({"season": rt.season, "round": rt.round, "name": rt.name, "laps": N, "drivers": rt.drivers})
            for n in range(0, min(N, fr.n_frames - 1), frame_step):
                X, running = F.order_features(rt, fr, n, r)
                H = F.hazard_features(rt, fr, n, r)
                D = rt.n
                Xp = np.zeros((D_MAX, X.shape[1])); Xp[:D] = X
                Hp = np.zeros((D_MAX, H.shape[1])); Hp[:D] = H
                m = np.zeros(D_MAX, dtype=bool); m[:D] = running
                p = np.zeros(D_MAX, dtype=bool); p[:D] = True
                o = np.full(D_MAX, 99, dtype=np.int32); o[:D] = rt.final_order
                c = np.zeros(D_MAX, dtype=bool); c[:D] = rt.classified
                od = np.full(D_MAX, 99, dtype=np.int32); od[:D] = fr.order[n]
                Xs.append(Xp); Hs.append(Hp); Bs.append(F.basis(n, N)); run.append(m); pres.append(p)
                fo.append(o); cl.append(c); ridx.append(mi); fidx.append(n); ss.append(n / N); orders.append(od)
        ratings.update(rt.drivers, rt.constructors, rt.final_order, rt.classified)
    return Snapshots(np.array(Xs, dtype=np.float32), np.array(Hs, dtype=np.float32), np.array(Bs, dtype=np.float32),
                     np.array(run), np.array(pres), np.array(fo), np.array(cl), np.array(ridx), np.array(fidx),
                     np.array(ss), np.array(orders), meta)
