"""Walk-forward form and reliability ratings.

Ratings entering round r are a function of races strictly before r. They are
exponentially weighted moving averages, deliberately simple so that every
number shown in the app can be recomputed by hand from the results table.

  driver form   EWMA of finishing score over classified finishes (half-life 8 races)
  team form     EWMA of the team's mean finishing score         (half-life 5 races)
  driver / team non-classification rate (half-lives 20 / 10 races)
  field non-classification rate          (half-life 20 races)

finishing score = 1 - (position - 1) / (entrants - 1): 1 for a win, 0 for last.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

# Constructor identities change when a team is renamed or sold. Form and
# reliability follow the factory, so ratings are keyed by lineage.
LINEAGE = {
    "toro_rosso": "faenza", "alphatauri": "faenza", "rb": "faenza",
    "sauber": "hinwil", "alfa": "hinwil", "audi": "hinwil",
    "force_india": "silverstone", "racing_point": "silverstone", "aston_martin": "silverstone",
    "lotus_f1": "enstone", "renault": "enstone", "alpine": "enstone",
    "marussia": "banbury", "manor": "banbury",
    "virgin": "banbury",
    "lotus_racing": "leafield", "caterham": "leafield",
}


def lineage(constructor: str) -> str:
    return LINEAGE.get(constructor, constructor)


def _alpha(half_life: float) -> float:
    return 1.0 - 0.5 ** (1.0 / half_life)


A_DRIVER = _alpha(8)
A_TEAM = _alpha(5)
A_DRIVER_NC = _alpha(20)
A_TEAM_NC = _alpha(10)
A_FIELD_NC = _alpha(20)
SEASON_REGRESSION = 0.75      # share of a team's form deviation carried into a new season
ROOKIE_DISCOUNT = 0.05
NEW_TEAM_FORM = 0.30


@dataclass
class Ratings:
    dform: dict[str, float] = field(default_factory=dict)
    tform: dict[str, float] = field(default_factory=dict)
    dnc: dict[str, float] = field(default_factory=dict)
    tnc: dict[str, float] = field(default_factory=dict)
    field_nc: float = 0.2
    season: int | None = None

    def before(self, season: int, drivers: list[str], constructors: list[str]) -> dict[str, np.ndarray]:
        """Ratings as they stand before a race in ``season`` (applies the new-season regression once)."""
        if self.season is not None and season != self.season:
            for k in self.tform:
                self.tform[k] = 0.5 + SEASON_REGRESSION * (self.tform[k] - 0.5)
            for k in self.tnc:
                self.tnc[k] = self.field_nc + 0.5 * (self.tnc[k] - self.field_nc)
        self.season = season
        df, tf, dn, tn = [], [], [], []
        for d, c in zip(drivers, constructors):
            team = lineage(c)
            t = self.tform.get(team, NEW_TEAM_FORM)
            tf.append(t)
            df.append(self.dform.get(d, t - ROOKIE_DISCOUNT))
            dn.append(self.dnc.get(d, self.field_nc))
            tn.append(self.tnc.get(team, self.field_nc))
        return {
            "dform": np.array(df), "tform": np.array(tf),
            "dnc": np.array(dn), "tnc": np.array(tn),
            "field_nc": np.full(len(drivers), self.field_nc),
        }

    def update(self, drivers: list[str], constructors: list[str], final_order: np.ndarray, classified: np.ndarray) -> None:
        """Fold one finished race into the ratings. Call only after ``before`` for the same race."""
        D = len(drivers)
        if D < 2:
            return
        score = 1.0 - (final_order.astype(float) - 1.0) / (D - 1.0)
        team_scores: dict[str, list[float]] = {}
        team_nc: dict[str, list[float]] = {}
        for i, (d, c) in enumerate(zip(drivers, constructors)):
            team = lineage(c)
            nc = 0.0 if classified[i] else 1.0
            prior_t = self.tform.get(team, NEW_TEAM_FORM)
            if classified[i]:
                prev = self.dform.get(d, prior_t - ROOKIE_DISCOUNT)
                self.dform[d] = prev + A_DRIVER * (score[i] - prev)
                team_scores.setdefault(team, []).append(score[i])
            else:
                self.dform.setdefault(d, prior_t - ROOKIE_DISCOUNT)
            prev_nc = self.dnc.get(d, self.field_nc)
            self.dnc[d] = prev_nc + A_DRIVER_NC * (nc - prev_nc)
            team_nc.setdefault(team, []).append(nc)
        for team, xs in team_scores.items():
            prev = self.tform.get(team, NEW_TEAM_FORM)
            self.tform[team] = prev + A_TEAM * (float(np.mean(xs)) - prev)
        for team, xs in team_nc.items():
            self.tform.setdefault(team, NEW_TEAM_FORM)
            prev = self.tnc.get(team, self.field_nc)
            self.tnc[team] = prev + A_TEAM_NC * (float(np.mean(xs)) - prev)
        rate = 1.0 - float(np.mean(classified))
        self.field_nc += A_FIELD_NC * (rate - self.field_nc)
