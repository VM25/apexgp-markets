"""Ratings entering a round depend only on earlier rounds."""
import numpy as np

from apexgp.ratings import Ratings


def _walk(races):
    rat = Ratings()
    out = []
    for rt in races:
        out.append({k: v.copy() for k, v in rat.before(rt.season, rt.drivers, rt.constructors).items()})
        rat.update(rt.drivers, rt.constructors, rt.final_order, rt.classified)
    return out


def test_changing_a_result_only_affects_later_rounds(archive_races):
    base = _walk(archive_races)
    k = len(archive_races) // 2
    victim = archive_races[k]
    original = (victim.final_order.copy(), victim.classified.copy())
    try:
        victim.final_order = victim.final_order[::-1].copy()
        victim.classified = np.ones_like(victim.classified)
        changed = _walk(archive_races)
    finally:
        victim.final_order, victim.classified = original
    for i in range(k + 1):                      # rounds up to and including the altered one are untouched
        for key in base[i]:
            assert np.array_equal(base[i][key], changed[i][key]), f"round index {i} changed"
    assert any(not np.array_equal(base[i]["dform"], changed[i]["dform"]) for i in range(k + 1, len(base))), "the change must show up later"


def test_ratings_are_bounded(archive_races):
    for r in _walk(archive_races):
        for key in ("dform", "tform", "dnc", "tnc", "field_nc"):
            assert np.all(r[key] >= -0.06) and np.all(r[key] <= 1.0)
