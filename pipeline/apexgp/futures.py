"""Championship (season-long) contracts: Monte Carlo over the rest of the calendar.

The title probability at any instant is the share of simulated seasons a driver
(or constructor) ends on top, where each simulated season is

    points already banked
  + points from the race in progress   (drawn from the in-race model)
  + points from every remaining grand prix and sprint
                                        (drawn from the pre-weekend model, which
                                         sees form ratings but no grid)

Inputs are limited to what is known at that instant: current standings, the
published calendar (how many races and sprints remain), today's entry list and
ratings computed from earlier rounds. Mid-season driver changes and car
development are not foreseen — a stated limitation, not a leak.
"""
from __future__ import annotations

import numpy as np

from .config import RACE_POINTS, SPRINT_POINTS_2022
from .model import STAGE_GROUP


def sample_placings(U: np.ndarray, h: np.ndarray | None, sims: int, rng: np.random.Generator, depth: int = 10) -> np.ndarray:
    """U: [G, D] stage strengths; h: [D] non-classification probabilities (None = everyone finishes).

    Returns placed [sims, D]: 1-based finishing position for the top ``depth``, 0 otherwise.
    """
    D = U.shape[1]
    alive = np.ones((sims, D), dtype=bool) if h is None else rng.random((sims, D)) >= h[None, :]
    remaining = alive.copy()
    placed = np.zeros((sims, D), dtype=np.int8)
    rows = np.arange(sims)
    for j in range(depth):
        lu = np.where(remaining, U[STAGE_GROUP[j]][None, :], -np.inf)
        pick = np.argmax(lu + rng.gumbel(size=(sims, D)), axis=1)
        ok = remaining.any(axis=1)
        placed[rows[ok], pick[ok]] = j + 1
        remaining[rows[ok], pick[ok]] = False
    return placed


def points_from(placed: np.ndarray, table: list[float]) -> np.ndarray:
    lut = np.zeros(placed.max() + 2)
    lut[1:len(table) + 1] = table
    return lut[placed]


def title_probabilities(points_now: np.ndarray, wins_now: np.ndarray, team_of: np.ndarray, n_teams: int,
                        team_points_now: np.ndarray, placed_now: np.ndarray | None,
                        U_season: np.ndarray, h_season: np.ndarray, gps_left: int, sprints_left: int,
                        rng: np.random.Generator, sims: int = 1000,
                        race_points: list[float] = RACE_POINTS, sprint_points: list[float] = SPRINT_POINTS_2022) -> dict[str, np.ndarray]:
    """Driver and constructor title probabilities.

    points_now/wins_now: [D] for today's entrants; team_of: [D] index into the constructor list;
    team_points_now: [T]; placed_now: [sims, D] placings of the race in progress (None between races).
    """
    D = len(points_now)
    pts = np.tile(points_now.astype(float), (sims, 1))
    wins = np.tile(wins_now.astype(float), (sims, 1))
    if placed_now is not None:
        pts += points_from(placed_now, race_points)
        wins += placed_now == 1
    for _ in range(gps_left):
        placed = sample_placings(U_season, h_season, sims, rng)
        pts += points_from(placed, race_points)
        wins += placed == 1
    for _ in range(sprints_left):
        placed = sample_placings(U_season, None, sims, rng, depth=len(sprint_points))
        pts += points_from(placed, sprint_points)
    gained = pts - points_now[None, :]
    # Driver title: most points, ties broken on wins, then on the entry order (arbitrary but fixed).
    key = pts + 1e-3 * wins + 1e-7 * (D - np.arange(D))[None, :]
    champ = np.argmax(key, axis=1)
    p_driver = np.bincount(champ, minlength=D) / sims
    team_pts = np.tile(team_points_now.astype(float), (sims, 1))
    for t in range(n_teams):
        m = team_of == t
        if m.any():
            team_pts[:, t] += gained[:, m].sum(axis=1)
    tchamp = np.argmax(team_pts + 1e-7 * (n_teams - np.arange(n_teams))[None, :], axis=1)
    p_team = np.bincount(tchamp, minlength=n_teams) / sims
    return {"driver": p_driver, "constructor": p_team}
