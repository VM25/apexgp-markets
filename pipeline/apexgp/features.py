"""Feature definitions for the finishing-order and non-classification models.

Mirrored one-for-one by ``src/engine/model/features.ts``; the golden-vector
test (``tests/test_golden.py`` + ``src/engine/__tests__/golden.test.ts``)
keeps the two implementations in lock-step.

Every feature is a function of one frame (see ``timing.build_frames``), the
starting grid and the pre-race ratings — nothing else.
"""
from __future__ import annotations

import numpy as np

from .timing import Frames, RaceTiming, start_rank

ORDER_FEATURES = ["lpos", "pos", "gapl", "lnpos", "npos", "ngap", "lead", "rate", "pit", "down", "lgrid", "dform", "tform"]
IN_RACE_ONLY = ("lpos", "pos", "gapl", "lnpos", "npos", "ngap", "lead", "rate", "pit", "down")
HAZARD_FEATURES = ["const", "lrem", "pre", "down", "newdown", "lpos", "dnc", "tnc", "lfield"]

# Race-progress basis: one indicator for the pre-race frame, then piecewise
# linear "hat" functions on s = n / N for the in-race frames.
KNOTS = [0.0, 0.08, 0.25, 0.5, 0.75, 0.9, 1.0]
N_BASIS = 1 + len(KNOTS)

GAP_CAP = 100.0
RATE_CAP = 5.0
LEAD_CAP = 30.0
# Time lost by making a pit stop, in seconds. Used to put cars on different
# stop counts on a common footing ("net" gap). A single constant by design: the
# fitted ``pit`` coefficient absorbs the average error.
PIT_LOSS_S = 20.0


def net_state(gap: np.ndarray, pits: np.ndarray, down: np.ndarray, running: np.ndarray) -> tuple[np.ndarray, np.ndarray, float]:
    """Pit-adjusted gaps and order.

    Cars that have made fewer stops than the reference (the median stop count of
    the running cars on the lead lap) are charged one pit loss per missing stop.
    Returns (net gap to the net leader, net order with 1 = net leader, reference stops).
    """
    ref_mask = running & (down == 0)
    ref = float(np.median(pits[ref_mask])) if ref_mask.any() else 0.0
    eff = gap + PIT_LOSS_S * np.maximum(0.0, ref - pits)
    eff_run = np.where(running, eff, np.inf)
    best = float(eff_run.min()) if running.any() else 0.0
    ngap = np.where(running, eff - best, GAP_CAP)
    key = np.where(running, eff, 1e9 + np.arange(len(gap)))
    norder = np.argsort(np.argsort(key, kind="stable"), kind="stable") + 1
    return ngap, norder, ref


def basis(n: int, total_laps: int) -> np.ndarray:
    b = np.zeros(N_BASIS)
    if n == 0:
        b[0] = 1.0
        return b
    s = min(1.0, n / max(total_laps, 1))
    for j in range(len(KNOTS) - 1):
        lo, hi = KNOTS[j], KNOTS[j + 1]
        if s <= hi or j == len(KNOTS) - 2:
            w = (s - lo) / (hi - lo)
            w = min(1.0, max(0.0, w))
            b[1 + j] = 1.0 - w
            b[2 + j] = w
            return b
    return b


def order_features(rt: RaceTiming, fr: Frames, n: int, ratings: dict[str, np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    """Returns (X [D, n_features], running [D]) for frame n."""
    D = rt.n
    N = rt.total_laps
    running = ~fr.stopped[n]
    X = np.zeros((D, len(ORDER_FEATURES)))
    rem = max(N - n, 0)
    if n > 0:
        pos = fr.order[n].astype(float)
        ngap, norder, ref = net_state(fr.gap[n], fr.pits[n], fr.down[n], running)
        npos = norder.astype(float)
        second = np.sort(ngap[running])[1] if running.sum() >= 2 else 0.0
        X[:, 0] = np.log(pos)
        X[:, 1] = pos / 10.0
        X[:, 2] = np.minimum(fr.gap[n], GAP_CAP) / 30.0
        X[:, 3] = np.log(npos)
        X[:, 4] = npos / 10.0
        X[:, 5] = np.minimum(ngap, GAP_CAP) / 30.0
        X[:, 6] = np.where(norder == 1, min(second, LEAD_CAP) / 10.0, 0.0)
        X[:, 7] = np.minimum(ngap / (rem + 1.0), RATE_CAP)
        X[:, 8] = np.clip(fr.pits[n] - ref, -2.0, 2.0)
        X[:, 9] = np.minimum(fr.down[n], 3)
    X[:, 10] = np.log(start_rank(rt.grid).astype(float))
    X[:, 11] = ratings["dform"] - 0.5
    X[:, 12] = ratings["tform"] - 0.5
    return X, running


def hazard_features(rt: RaceTiming, fr: Frames, n: int, ratings: dict[str, np.ndarray]) -> np.ndarray:
    """Returns H [D, n_hazard_features] for frame n (defined for n < N)."""
    D = rt.n
    N = rt.total_laps
    H = np.zeros((D, len(HAZARD_FEATURES)))
    H[:, 0] = 1.0
    H[:, 1] = np.log(max(N - n, 1) / max(N, 1))
    H[:, 2] = 1.0 if n == 0 else 0.0
    if n > 0:
        H[:, 3] = np.minimum(fr.down[n], 3)
        # Fell off the lead lap (or a further lap behind) since the previous frame:
        # either just lapped, or missing at the line.
        H[:, 4] = (fr.down[n] > fr.down[n - 1]).astype(float)
        H[:, 5] = np.log(fr.order[n].astype(float))
    else:
        H[:, 5] = np.log(start_rank(rt.grid).astype(float))
    field = np.clip(ratings["field_nc"], 0.01, 0.99)
    H[:, 6] = ratings["dnc"] - field          # driver's non-classification rate relative to the field
    H[:, 7] = ratings["tnc"] - field          # team's, likewise
    H[:, 8] = np.log(field / (1.0 - field))   # log-odds of the field-wide rate
    return H
