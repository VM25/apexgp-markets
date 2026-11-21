"""Frames are strictly as-of: nothing after a frame's cutoff can change that frame or its features."""
import numpy as np
import pytest

from apexgp import features as F
from apexgp.ratings import Ratings
from apexgp.timing import build_frames, truncate

FIELDS = ("laps", "order", "gap", "pits", "down", "stopped")


def _same(a, b, n):
    for name in FIELDS:
        x, y = getattr(a, name)[: n + 1], getattr(b, name)[: n + 1]
        assert np.array_equal(x, y), f"{name} differs in frames 0..{n}"
    assert np.array_equal(np.nan_to_num(a.last_lap[: n + 1], nan=-1), np.nan_to_num(b.last_lap[: n + 1], nan=-1))


def _check_race(rt, step=1):
    full = build_frames(rt)
    N = full.n_frames - 1
    ratings = Ratings().before(rt.season, rt.drivers, rt.constructors)
    for n in range(0, N, step):
        cut = truncate(rt, full.tau[n + 1])           # drop every crossing at or after the cutoff, and all labels
        part = build_frames(cut)
        _same(full, part, n)
        Xa, ra = F.order_features(rt, full, n, ratings)
        Xb, rb = F.order_features(cut, part, n, ratings)
        assert np.array_equal(Xa, Xb) and np.array_equal(ra, rb)
        assert np.array_equal(F.hazard_features(rt, full, n, ratings), F.hazard_features(cut, part, n, ratings))


def test_truncating_the_future_never_changes_a_frame_archive(archive_races):
    rng = np.random.default_rng(1)
    picks = rng.choice(len(archive_races), size=10, replace=False)
    for i in picks:
        _check_race(archive_races[i], step=3)


def test_truncating_the_future_never_changes_a_frame_2025(season_2025):
    for b in season_2025[::4]:
        _check_race(b.timing, step=2)


def test_settlement_labels_are_not_inputs(season_2025):
    """Scrambling the official classification leaves every frame and feature untouched."""
    b = season_2025[7]
    rt = b.timing
    full = build_frames(rt)
    ratings = Ratings().before(rt.season, rt.drivers, rt.constructors)
    before = [F.order_features(rt, full, n, ratings)[0] for n in range(full.n_frames - 1)]
    rng = np.random.default_rng(3)
    saved = (rt.final_order, rt.classified, rt.points)
    try:
        rt.final_order = rng.permutation(rt.final_order)
        rt.classified = ~rt.classified
        rt.points = rt.points[::-1].copy()
        again = build_frames(rt)
        _same(full, again, full.n_frames - 1)
        for n, X in enumerate(before):
            assert np.array_equal(X, F.order_features(rt, again, n, ratings)[0])
    finally:
        rt.final_order, rt.classified, rt.points = saved


def test_frame_invariants(season_2025):
    for b in season_2025:
        fr, rt = b.frames, b.timing
        assert fr.n_frames == rt.total_laps + 1
        assert np.all(np.diff(fr.tau) > 0), "leader lap times must be positive"
        assert np.all(np.diff(fr.laps, axis=0) >= 0), "laps completed never decrease"
        assert np.all(np.diff(fr.pits, axis=0) >= 0)
        for n in range(fr.n_frames):
            assert sorted(fr.order[n]) == list(range(1, rt.n + 1)), "order is a permutation"
            assert np.all(fr.gap[n] >= -1e-9)
            running = ~fr.stopped[n]
            assert fr.order[n][running].max(initial=0) <= running.sum(), "running cars are ranked ahead of stopped cars"
        # Frame 0 is the grid and knows nothing about the race.
        assert fr.laps[0].sum() == 0 and fr.pits[0].sum() == 0 and not fr.stopped[0].any()


def test_entrants_are_in_grid_order_not_finishing_order(season_2025):
    for b in season_2025:
        g = b.timing.grid
        slots = np.where(g > 0, g, 10_000)
        assert np.all(np.diff(slots) >= 0)
    # ...and that order really is uninformative about the result in at least most races.
    informative = sum(1 for b in season_2025 if np.array_equal(np.argsort(b.timing.final_order), np.arange(b.timing.n)))
    assert informative == 0


@pytest.mark.parametrize("n_stop", [2])
def test_stopped_rule_needs_two_missed_laps(n_stop):
    from apexgp.timing import RaceTiming
    lap = 90.0
    cum = [np.arange(1, 11) * lap, np.arange(1, 11) * lap + 5, (np.arange(1, 4) * lap + 9)]   # third car stops after lap 3
    rt = RaceTiming(2025, 1, "t", "2025-01-01", "c", ["a", "b", "c"], ["x", "x", "y"], np.array([1, 2, 3]), cum, [[], [], []],
                    np.array([1, 2, 3]), np.array([True, True, False]), ["", "", ""], np.zeros(3), total_laps=10)
    fr = build_frames(rt)
    assert not fr.stopped[4, 2] and fr.stopped[5, 2], "flagged once two leader laps have passed without a crossing"
    assert fr.down[4, 2] == 1
