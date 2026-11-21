"""The exported app data: real results, reconciled points, no labels in observation files."""
import json
from pathlib import Path

import pytest

from apexgp import config

DATA = config.APP_DATA_DIR


def _load(rel):
    path = DATA / rel
    if not path.exists():
        pytest.skip("app data not built: run `python pipeline/build.py all`")
    return json.loads(path.read_text())


def test_season_index_is_complete():
    season = _load("2025/season.json")
    assert season["status"] == "complete" and len(season["rounds"]) == 24 == season["roundsTotal"]
    assert [r["round"] for r in season["rounds"]] == list(range(1, 25))
    assert sum(r["sprintWeekend"] for r in season["rounds"]) == 6
    assert season["points"]["fastestLapPoint"] is False


def test_observation_files_carry_no_labels_and_settlement_files_do():
    for rnd in range(1, 25):
        obs = _load(f"2025/r{rnd:02d}.json")
        st = _load(f"2025/r{rnd:02d}.settlement.json")
        for forbidden in ("classification", "final_result", "result", "winner", "standingsAfter"):
            assert forbidden not in obs
        assert obs["frames"]["n"] == obs["laps"] + 1 == len(obs["frames"]["pos"])
        assert len(obs["drivers"]) == len(st["classification"])
        assert {d["id"] for d in obs["drivers"]} == {c["id"] for c in st["classification"]}
        winners = [c for c in st["classification"] if c["classified"] and c["position"] == 1]
        assert len(winners) == 1 and winners[0]["points"] == 25
        positions = sorted(c["position"] for c in st["classification"] if c["classified"])
        assert positions == list(range(1, len(positions) + 1))


def test_points_follow_the_rule_and_standings_reconcile():
    diag = _load("diagnostics.json")["replay"]["2025"]
    assert diag["standings_check"]["rounds"] == 24
    assert diag["standings_check"]["rounds_with_differences"] == []
    assert diag["points_rule_violations"] == []
    final = _load("2025/season.settlement.json")
    total = sum(d["points"] for d in final["finalStandings"]["drivers"])
    teams = sum(t["points"] for t in final["finalStandings"]["constructors"])
    assert total == teams, "every driver point belongs to exactly one constructor"
    # 24 grands prix at 101 points each plus six sprints at 36.
    assert total == 24 * 101 + 6 * 36


def test_cross_source_quality_gates():
    quality = _load("provenance.json")["quality"]
    assert len(quality) == 24
    for race, q in quality.items():
        assert q["lap_chart_gaps"] == 0, race
        assert abs(q["winner_time_diff_s"]) < 0.01, f"{race}: summed lap times must reproduce the official race time"
        assert q["chart_position_agreement"] == 1.0, race
        assert q["lap_time_crosscheck"]["share_within_100ms"] > 0.96, race
        assert q["clock_alignment"]["median_abs_residual_s"] < 0.2, race
        assert q["pit_crosscheck"]["jaccard"] == 1.0, race
        assert q["classification_crosscheck"]["differences"] == [], race
        assert q["identity_mismatch"] == [] and q["drivers_without_openf1"] == [], race
        assert all(m["explained"] for m in q["lap_count_mismatch"]), race


def test_shipped_model_beats_the_baseline_out_of_sample():
    scores = _load("diagnostics.json")["replay"]["2025"]["scores"]
    for market in ("win", "podium", "points"):
        s = scores[market]["all"]
        assert s["stagewise"]["brier"] < s["position_table"]["brier"] < s["uniform"]["brier"], market
