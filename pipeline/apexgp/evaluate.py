"""Forecast scoring: Brier score, log loss, reliability tables and baselines."""
from __future__ import annotations

import numpy as np

from .dataset import Snapshots

EVENTS = ("win", "podium", "points", "nc")
PROGRESS_BUCKETS = [(0.0, 0.0, "grid"), (0.0, 0.25, "0-25%"), (0.25, 0.5, "25-50%"), (0.5, 0.75, "50-75%"), (0.75, 1.0, "75-100%")]


def outcomes(snap: Snapshots) -> dict[str, np.ndarray]:
    pos = snap.final_order
    cl = snap.classified
    return {
        "win": cl & (pos == 1),
        "podium": cl & (pos <= 3),
        "points": cl & (pos <= 10),
        "nc": ~cl,
    }


def brier(p: np.ndarray, y: np.ndarray) -> float:
    return float(np.mean((p - y) ** 2))


def logloss(p: np.ndarray, y: np.ndarray, eps: float = 1e-4) -> float:
    q = np.clip(p, eps, 1 - eps)
    return float(-np.mean(y * np.log(q) + (1 - y) * np.log(1 - q)))


def reliability(p: np.ndarray, y: np.ndarray, bins: int = 10) -> list[dict]:
    edges = np.linspace(0, 1, bins + 1)
    out = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (p >= lo) & (p < hi if hi < 1 else p <= hi)
        if m.sum() == 0:
            continue
        out.append({"lo": round(float(lo), 2), "hi": round(float(hi), 2), "n": int(m.sum()),
                    "mean_p": round(float(p[m].mean()), 4), "freq": round(float(y[m].mean()), 4)})
    return out


def ece(p: np.ndarray, y: np.ndarray, bins: int = 10) -> float:
    rel = reliability(p, y, bins)
    n = sum(r["n"] for r in rel)
    return float(sum(r["n"] * abs(r["mean_p"] - r["freq"]) for r in rel) / n)


def progress_mask(snap: Snapshots, lo: float, hi: float) -> np.ndarray:
    if hi == 0.0:
        return snap.frame == 0
    return (snap.frame > 0) & (snap.s > lo - 1e-12) & (snap.s <= hi) if lo > 0 else (snap.frame > 0) & (snap.s <= hi)


class PositionTable:
    """Baseline: empirical frequency of each event given running position and race-progress bucket.

    This is what a careful trader with a spreadsheet would use, and it is the
    bar the fitted model has to clear.
    """

    def __init__(self, snap: Snapshots, max_pos: int = 24):
        self.max_pos = max_pos
        y = outcomes(snap)
        self.tables: dict[str, np.ndarray] = {}
        nb = len(PROGRESS_BUCKETS)
        for ev in EVENTS:
            t = np.zeros((nb, max_pos + 1))
            for bi, (lo, hi, _) in enumerate(PROGRESS_BUCKETS):
                fm = progress_mask(snap, lo, hi)
                for pos in range(1, max_pos + 1):
                    m = fm[:, None] & snap.running & (snap.order == pos)
                    # Laplace smoothing toward the bucket-wide rate.
                    base = y[ev][fm[:, None] & snap.running].mean() if (fm[:, None] & snap.running).any() else 0.0
                    t[bi, pos] = (y[ev][m].sum() + 2 * base) / (m.sum() + 2)
            self.tables[ev] = t

    def predict(self, snap: Snapshots) -> dict[str, np.ndarray]:
        out = {}
        for ev in EVENTS:
            p = np.zeros(snap.order.shape)
            for bi, (lo, hi, _) in enumerate(PROGRESS_BUCKETS):
                fm = progress_mask(snap, lo, hi)
                pos = np.clip(snap.order, 1, self.max_pos)
                p[fm] = self.tables[ev][bi][pos[fm]]
            out[ev] = np.where(snap.running, p, 0.0 if ev != "nc" else 1.0)
        return out


def uniform_baseline(snap: Snapshots) -> dict[str, np.ndarray]:
    k = snap.running.sum(1, keepdims=True).astype(float)
    k = np.where(k > 0, k, 1.0)
    base_nc = float((~snap.classified)[snap.running].mean())
    return {
        "win": np.where(snap.running, 1.0 / k, 0.0),
        "podium": np.where(snap.running, np.minimum(1.0, 3.0 / k), 0.0),
        "points": np.where(snap.running, np.minimum(1.0, 10.0 / k), 0.0),
        "nc": np.where(snap.running, base_nc, 1.0),
    }


def score_table(snap: Snapshots, preds: dict[str, dict[str, np.ndarray]]) -> dict:
    """Scores per event and progress bucket. Only cars running at the frame are scored."""
    y = outcomes(snap)
    out: dict = {}
    for ev in EVENTS:
        out[ev] = {}
        for lo, hi, label in PROGRESS_BUCKETS + [(None, None, "all")]:
            fm = np.ones(len(snap.s), dtype=bool) if label == "all" else progress_mask(snap, lo, hi)
            m = fm[:, None] & snap.running
            if not m.any():
                continue
            row = {"n": int(m.sum()), "base_rate": round(float(y[ev][m].mean()), 4)}
            for name, p in preds.items():
                row[name] = {"brier": round(brier(p[ev][m], y[ev][m]), 5), "logloss": round(logloss(p[ev][m], y[ev][m]), 5)}
            out[ev][label] = row
    return out
