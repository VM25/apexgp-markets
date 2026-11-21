"""Finishing-order and non-classification models.

Order model — rank-ordered ("exploded") logit, Beggs, Cardell & Hausman (1981)
    Each running car i has strength u_i = sum_f beta_f(s) x_if, where the
    coefficient of every feature is a piecewise-linear function of race
    progress s. Conditional on the set of cars that are eventually classified,
    the finishing order is Plackett-Luce: the winner is drawn with probability
    softmax(u), then the runner-up among the rest, and so on. Fitted by
    penalised maximum likelihood on the top ``stages`` finishing positions.

Hazard model — logistic regression
    P(car i is not classified at the finish | frame). Fitted by penalised
    maximum likelihood on every car still running at every frame.

Joint simulation
    Draw non-classification independently per car, then a Plackett-Luce order
    among the survivors. Every race contract is a function of that one joint
    draw, so related contracts are coherent by construction (sum of win
    probabilities = 1, P(win) <= P(podium) <= P(points), and so on).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.optimize import minimize

from . import features as F
from .dataset import Snapshots

STAGES = 10


# Stage groups: the winner, the rest of the podium, everyone else. Each group has
# its own coefficient curves — what separates P1 from P2 is not what separates
# P10 from P11.
STAGE_GROUP = [0, 1, 1] + [2] * 40
N_GROUPS = 3


@dataclass
class OrderModel:
    beta: np.ndarray   # [N_GROUPS, n_features, N_BASIS]

    def scores(self, X: np.ndarray, B: np.ndarray) -> np.ndarray:
        """Strengths per stage group: [G, S, D]."""
        return np.einsum("sdf,sb,gfb->gsd", X, B, self.beta)


@dataclass
class HazardModel:
    w: np.ndarray  # [n_hazard_features]

    def prob(self, H: np.ndarray) -> np.ndarray:
        return 1.0 / (1.0 + np.exp(-(H @ self.w)))


def _stage_ranks(snap: Snapshots) -> np.ndarray:
    """rank[s, d] = position of car d among cars that were running at the frame and are classified; -1 otherwise."""
    elig = snap.running & snap.classified
    key = np.where(elig, snap.final_order, 10_000)
    rank = np.argsort(np.argsort(key, axis=1, kind="stable"), axis=1, kind="stable")
    return np.where(elig, rank, -1)


def fit_order(snap: Snapshots, ridge: float = 1e-3, smooth: float = 2e-2, groups: int = N_GROUPS) -> OrderModel:
    """Penalised maximum likelihood. ``groups=1`` gives the plain rank-ordered logit (one curve set for all stages)."""
    X = snap.X.astype(np.float64)
    B = snap.B.astype(np.float64)
    nf, nb = X.shape[2], B.shape[1]
    # Features that are identically zero before the start have no pre-race coefficient.
    free1 = np.ones((nf, nb), dtype=bool)
    free1[[F.ORDER_FEATURES.index(k) for k in F.IN_RACE_ONLY], 0] = False
    free = np.broadcast_to(free1, (groups, nf, nb)).copy()
    group_of = [min(g, groups - 1) for g in STAGE_GROUP]
    rank = _stage_ranks(snap)
    S = X.shape[0]
    stage_masks = [(rank >= j) for j in range(STAGES)]
    stage_chosen = [(rank == j) for j in range(STAGES)]
    stage_valid = [(m.sum(1) >= 2) & c.any(1) for m, c in zip(stage_masks, stage_chosen)]

    def unpack(theta: np.ndarray) -> np.ndarray:
        beta = np.zeros((groups, nf, nb))
        beta[free] = theta
        return beta

    def objective(theta: np.ndarray):
        beta = unpack(theta)
        U = np.einsum("sdf,sb,gfb->gsd", X, B, beta)
        nll = 0.0
        G = np.zeros_like(U)
        for j, (m, c, v) in enumerate(zip(stage_masks, stage_chosen, stage_valid)):
            g = group_of[j]
            u = U[g]
            um = np.where(m, u, -np.inf)
            mx = um.max(1, keepdims=True)
            mx = np.where(np.isfinite(mx), mx, 0.0)
            e = np.where(m, np.exp(um - mx), 0.0)
            z = e.sum(1, keepdims=True)
            z_safe = np.where(z > 0, z, 1.0)
            logz = (np.log(z_safe) + mx)[:, 0]
            chosen_u = (u * c).sum(1)
            nll -= float(((chosen_u - logz) * v).sum())
            G[g] -= (c.astype(float) - e / z_safe) * v[:, None]
        nll /= S
        G /= S
        gbeta = np.einsum("gsd,sdf,sb->gfb", G, X, B)
        # Ridge on everything; smoothness on second differences across the in-race knots.
        pen = ridge * float((beta ** 2).sum())
        gpen = 2 * ridge * beta
        d2 = beta[:, :, 1:-2] - 2 * beta[:, :, 2:-1] + beta[:, :, 3:]
        pen += smooth * float((d2 ** 2).sum())
        gs = np.zeros_like(beta)
        gs[:, :, 1:-2] += 2 * smooth * d2
        gs[:, :, 2:-1] -= 4 * smooth * d2
        gs[:, :, 3:] += 2 * smooth * d2
        return nll + pen, (gbeta + gpen + gs)[free]

    res = minimize(objective, np.zeros(int(free.sum())), jac=True, method="L-BFGS-B", options={"maxiter": 1500, "maxfun": 3000})
    beta = unpack(res.x)
    if groups < N_GROUPS:
        beta = np.concatenate([beta] + [beta[-1:]] * (N_GROUPS - groups), axis=0)
    return OrderModel(beta)


def fit_hazard(snap: Snapshots, ridge: float = 1e-5) -> HazardModel:
    mask = snap.running & snap.present
    H = snap.H[mask].astype(np.float64)
    y = (~snap.classified[mask]).astype(np.float64)
    mu = np.zeros(H.shape[1])

    def objective(w: np.ndarray):
        z = H @ w
        p = 1.0 / (1.0 + np.exp(-z))
        eps = 1e-12
        nll = -float(np.mean(y * np.log(p + eps) + (1 - y) * np.log(1 - p + eps)))
        g = H.T @ (p - y) / len(y)
        return nll + ridge * float(((w - mu)[1:] ** 2).sum()), g + 2 * ridge * np.r_[0.0, (w - mu)[1:]]

    res = minimize(objective, np.zeros(H.shape[1]), jac=True, method="L-BFGS-B", options={"maxiter": 500})
    return HazardModel(res.x)


def stopped_nc_rates(snap: Snapshots) -> dict[str, float]:
    """Empirical P(not classified | flagged stopped), split by whether 90% distance was already covered."""
    stopped = snap.present & ~snap.running
    y = ~snap.classified
    late = (snap.s >= 0.9)[:, None] & stopped
    early = (snap.s < 0.9)[:, None] & stopped
    def rate(m):
        return float(y[m].mean()) if m.any() else 1.0
    return {"early": rate(early), "late": rate(late), "n_early": int(early.sum()), "n_late": int(late.sum())}


def simulate(U: np.ndarray, h: np.ndarray, running: np.ndarray, rng: np.random.Generator,
             sims: int = 2000, chunk: int = 128) -> dict[str, np.ndarray]:
    """Monte Carlo event probabilities for a batch of snapshots.

    U: [G, S, D] stage-group strengths; h, running: [S, D]. Cars are drawn into
    finishing positions one stage at a time (stage j uses group STAGE_GROUP[j]).
    Returns win / podium / top-10 probabilities [S, D] and the (analytic)
    probability of not being classified.
    """
    _, S, D = U.shape
    win = np.zeros((S, D)); pod = np.zeros((S, D)); pts = np.zeros((S, D))
    for a in range(0, S, chunk):
        b = min(S, a + chunk)
        n = b - a
        alive = (rng.random((n, sims, D)) >= h[a:b][:, None, :]) & running[a:b][:, None, :]
        remaining = alive.copy()
        placed = np.zeros((n, sims, D), dtype=np.int8)  # 1-based finishing stage, 0 = not in the top 10
        for j in range(10):
            uu = U[STAGE_GROUP[j], a:b][:, None, :]
            lu = np.where(remaining, uu, -np.inf)
            # Gumbel-max draw of one car from the remaining set.
            pick = np.argmax(lu + rng.gumbel(size=(n, sims, D)), axis=2)
            idx = np.nonzero(remaining.any(axis=2))
            placed[idx[0], idx[1], pick[idx]] = j + 1
            remaining[idx[0], idx[1], pick[idx]] = False
        win[a:b] = (placed == 1).mean(1)
        pod[a:b] = ((placed >= 1) & (placed <= 3)).mean(1)
        pts[a:b] = (placed >= 1).mean(1)
    nc = np.where(running, h, 1.0)
    return {"win": win, "podium": pod, "points": pts, "nc": nc}
