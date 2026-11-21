"""ApexGP Markets v3 — offline build.

    python pipeline/build.py train     # fit + walk-forward validation  -> pipeline/build/train.pkl
    python pipeline/build.py export    # replay seasons + app assets    -> public/data/
    python pipeline/build.py all

Run ``python pipeline/fetch.py 2025`` first to warm the source cache. With a warm
cache the whole build is offline and deterministic (fixed seeds).
"""
from __future__ import annotations

import json
import pickle
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from apexgp import config, dataset, evaluate as ev, features as F, futures, model, replay  # noqa: E402
from apexgp.ratings import Ratings, lineage  # noqa: E402
from apexgp.sources import jolpica, kaggle, openf1  # noqa: E402
from apexgp.timing import start_rank  # noqa: E402

WF_TEST_YEARS = [2019, 2020, 2021, 2022, 2023, 2024]
SEED = 20250316
TRAIN_PKL = config.BUILD_DIR / "train.pkl"


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


# ------------------------------------------------------------------------------------------
# season ("pre-weekend") model: ratings only, used for races that have not been qualified yet
# ------------------------------------------------------------------------------------------
SEASON_ORDER_FEATURES = ["dform", "tform"]
SEASON_HAZARD_FEATURES = ["const", "dnc", "tnc", "lfield"]


def season_view(snap: dataset.Snapshots) -> dataset.Snapshots:
    """Pre-race frames with the grid feature blanked: what is known before a weekend starts."""
    pre = snap.subset(snap.frame == 0)
    X = pre.X.copy()
    X[:, :, F.ORDER_FEATURES.index("lgrid")] = 0.0
    H = pre.H.copy()
    H[:, :, F.HAZARD_FEATURES.index("lpos")] = 0.0
    return dataset.Snapshots(X, H, pre.B, pre.running, pre.present, pre.final_order, pre.classified,
                             pre.race, pre.frame, pre.s, pre.order, pre.meta)


def fit_season(snap: dataset.Snapshots) -> dict:
    sv = season_view(snap)
    om = model.fit_order(sv, smooth=0.0)
    hm = model.fit_hazard(sv)
    fo = [F.ORDER_FEATURES.index(k) for k in SEASON_ORDER_FEATURES]
    fh = [F.HAZARD_FEATURES.index(k) for k in ("const", "dnc", "tnc", "lfield")]
    # At frame 0 the hazard features lrem (=0) and pre (=1) are constants: fold ``pre`` into the intercept.
    w = hm.w.copy()
    const = w[F.HAZARD_FEATURES.index("const")] + w[F.HAZARD_FEATURES.index("pre")]
    return {"beta": om.beta[:, fo, 0], "hazard_w": np.r_[const, w[fh[1:]]]}


def season_strengths(sm: dict, r: dict[str, np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    x = np.stack([r["dform"] - 0.5, r["tform"] - 0.5], axis=1)       # [D, 2]
    U = np.einsum("df,gf->gd", x, sm["beta"])
    field = np.clip(r["field_nc"], 0.01, 0.99)
    hx = np.stack([np.ones(len(field)), r["dnc"] - field, r["tnc"] - field, np.log(field / (1 - field))], axis=1)
    h = 1.0 / (1.0 + np.exp(-(hx @ sm["hazard_w"])))
    return U, h


# ------------------------------------------------------------------------------------------
# training + walk-forward validation
# ------------------------------------------------------------------------------------------
def predict(om: model.OrderModel, hm: model.HazardModel, snap: dataset.Snapshots, seed: int, sims: int = 1500) -> dict[str, np.ndarray]:
    U = om.scores(snap.X.astype(np.float64), snap.B.astype(np.float64))
    h = hm.prob(snap.H.astype(np.float64))
    return model.simulate(U, h, snap.running, np.random.default_rng(seed), sims=sims)


def kaggle_title_context(first: int, last: int) -> dict:
    """Standings entering each grand prix, calendar and champions, from the Kaggle tables."""
    races = kaggle.table("races")
    races = races[(races.year >= first) & (races.year <= last)].sort_values(["year", "round"])
    ds = kaggle.table("driver_standings").merge(kaggle.table("drivers")[["driverId", "driverRef"]], on="driverId")
    cs = kaggle.table("constructor_standings").merge(kaggle.table("constructors")[["constructorId", "constructorRef"]], on="constructorId")
    sp = kaggle.sprint_results(first, last)
    ctx: dict = {}
    for year, g in races.groupby("year"):
        g = g.sort_values("round")
        rounds = list(g["round"])
        sprint_rounds = {int(r["round"]) for _, r in g.iterrows() if isinstance(r.get("sprint_date"), str)}
        after_d, after_c, sprint_pts = {}, {}, {}
        for _, r in g.iterrows():
            d = ds[ds.raceId == r.raceId]
            after_d[int(r["round"])] = {row.driverRef: (float(row.points), int(row.wins)) for row in d.itertuples()}
            c = cs[cs.raceId == r.raceId]
            after_c[int(r["round"])] = {row.constructorRef: float(row.points) for row in c.itertuples()}
            s = sp[sp.raceId == r.raceId]
            sprint_pts[int(r["round"])] = [(row.driverRef, row.constructorRef, float(row.points)) for row in s.itertuples()]
        last_round = max(rounds)
        champ_d = max(after_d[last_round].items(), key=lambda kv: kv[1])[0] if after_d[last_round] else None
        champ_c = max(after_c[last_round].items(), key=lambda kv: kv[1])[0] if after_c[last_round] else None
        ctx[int(year)] = {"rounds": rounds, "sprint_rounds": sprint_rounds, "after_d": after_d, "after_c": after_c,
                          "sprint_pts": sprint_pts, "champion_driver": champ_d, "champion_constructor": champ_c}
    return ctx


def standings_before(ctx_y: dict, rnd: int) -> tuple[dict, dict]:
    prev = max((r for r in ctx_y["rounds"] if r < rnd), default=None)
    d = dict(ctx_y["after_d"][prev]) if prev is not None else {}
    c = dict(ctx_y["after_c"][prev]) if prev is not None else {}
    for drv, team, pts in ctx_y["sprint_pts"].get(rnd, []):
        p, w = d.get(drv, (0.0, 0))
        d[drv] = (p + pts, w)
        c[team] = c.get(team, 0.0) + pts
    return d, c


def title_eval_rows(races, ratings_by_race: dict, om, hm, sm, ctx: dict, years: list[int], seed: int, sims: int = 600) -> list[dict]:
    """Pre-race title probabilities for every round of ``years``; one row per (season, round, driver)."""
    rows: list[dict] = []
    rng = np.random.default_rng(seed)
    for rt in races:
        if rt.season not in years or rt.season not in ctx or not dataset.usable(rt):
            continue
        cy = ctx[rt.season]
        r = ratings_by_race[(rt.season, rt.round)]
        fr = dataset.build_frames(rt)
        X, running = F.order_features(rt, fr, 0, r)
        H = F.hazard_features(rt, fr, 0, r)
        B = F.basis(0, rt.total_laps)
        U_now = np.einsum("df,b,gfb->gd", X, B, om.beta)
        h_now = hm.prob(H)
        placed_now = futures.sample_placings(U_now, h_now, sims, rng)
        U_s, h_s = season_strengths(sm, r)
        d_before, c_before = standings_before(cy, rt.round)
        teams = sorted({lineage(c) for c in rt.constructors} | {lineage(c) for c in c_before})
        tix = {t: i for i, t in enumerate(teams)}
        team_pts = np.zeros(len(teams))
        for c, p in c_before.items():
            team_pts[tix[lineage(c)]] += p
        pts_now = np.array([d_before.get(d, (0.0, 0))[0] for d in rt.drivers])
        wins_now = np.array([d_before.get(d, (0.0, 0))[1] for d in rt.drivers])
        gps_left = sum(1 for q in cy["rounds"] if q > rt.round)
        sprints_left = sum(1 for q in cy["sprint_rounds"] if q > rt.round)
        # Absent drivers with banked points keep them but score no more.
        res = futures.title_probabilities(pts_now, wins_now, np.array([tix[lineage(c)] for c in rt.constructors]), len(teams),
                                          team_pts, placed_now, U_s, h_s, gps_left, sprints_left, rng, sims=sims)
        absent_best = max((p for d, (p, _) in d_before.items() if d not in rt.drivers), default=0.0)
        tot = pts_now.sum()
        share = pts_now / tot if tot > 0 else np.full(rt.n, 1.0 / rt.n)
        leader = np.zeros(rt.n)
        if tot > 0:
            leader[int(np.argmax(pts_now + 1e-3 * wins_now))] = 1.0
        else:
            leader[:] = 1.0 / rt.n
        for i, d in enumerate(rt.drivers):
            rows.append({"season": rt.season, "round": rt.round, "progress": (rt.round - 1) / len(cy["rounds"]), "driver": d,
                         "p_model": float(res["driver"][i]), "p_share": float(share[i]), "p_leader": float(leader[i]),
                         "y": int(d == cy["champion_driver"]), "absent_best": absent_best})
        for t, i in tix.items():
            rows.append({"season": rt.season, "round": rt.round, "progress": (rt.round - 1) / len(cy["rounds"]), "constructor": t,
                         "p_model": float(res["constructor"][i]),
                         "p_share": float(team_pts[i] / team_pts.sum()) if team_pts.sum() > 0 else 1.0 / len(teams),
                         "y": int(t == lineage(cy["champion_constructor"]))})
    return rows


def summarise_title(rows: list[dict], key: str) -> dict:
    sel = [r for r in rows if key in r]
    if not sel:
        return {}
    y = np.array([r["y"] for r in sel], dtype=float)
    out = {"n": len(sel), "seasons": sorted({r["season"] for r in sel})}
    for name in ("p_model", "p_share", "p_leader"):
        if name in sel[0]:
            p = np.array([r[name] for r in sel])
            out[name] = {"brier": round(ev.brier(p, y), 5), "logloss": round(ev.logloss(p, y), 5)}
    thirds = {}
    for lo, hi, label in [(0, 1 / 3, "first third"), (1 / 3, 2 / 3, "middle third"), (2 / 3, 1.01, "final third")]:
        m = np.array([lo <= r["progress"] < hi for r in sel])
        if m.any():
            thirds[label] = {name: round(ev.brier(np.array([r[name] for r in sel])[m], y[m]), 5)
                             for name in ("p_model", "p_share", "p_leader") if name in sel[0]}
            thirds[label]["n"] = int(m.sum())
    out["by_season_progress"] = thirds
    p = np.array([r["p_model"] for r in sel])
    out["reliability"] = ev.reliability(p, y, bins=5)
    return out


def ratings_walk(races) -> tuple[dict, Ratings]:
    """Ratings entering every race (keyed by season, round) and the final state."""
    rat = Ratings()
    out = {}
    for rt in races:
        out[(rt.season, rt.round)] = rat.before(rt.season, rt.drivers, rt.constructors)
        rat.update(rt.drivers, rt.constructors, rt.final_order, rt.classified)
    return out, rat


def train() -> None:
    config.BUILD_DIR.mkdir(parents=True, exist_ok=True)
    log("loading Kaggle archive")
    races = kaggle.race_timings(2010, config.TRAIN_LAST_SEASON)
    snap = dataset.build(races, config.TRAIN_FIRST_SEASON)
    years = np.array([snap.meta[r]["season"] for r in snap.race])
    log(f"{len(races)} races loaded, {len(snap.meta)} usable for training, {len(snap.s)} snapshots")
    ratings_by_race, _ = ratings_walk(races)
    ctx = kaggle_title_context(2010, config.TRAIN_LAST_SEASON)

    folds = []
    pooled: dict[str, dict[str, list[np.ndarray]]] = {}
    pooled_y: dict[str, list[np.ndarray]] = {e: [] for e in ev.EVENTS}
    title_rows: list[dict] = []
    test_parts = []
    for year in WF_TEST_YEARS:
        tr = snap.subset(years < year)
        te = snap.subset(years == year)
        t0 = time.time()
        om = model.fit_order(tr)
        om_plain = model.fit_order(tr, groups=1)
        hm = model.fit_hazard(tr)
        sm = fit_season(tr)
        preds = {
            "stagewise": predict(om, hm, te, SEED + year),
            "plain_rol": predict(om_plain, hm, te, SEED + year),
            "position_table": ev.PositionTable(tr).predict(te),
            "uniform": ev.uniform_baseline(te),
        }
        y = ev.outcomes(te)
        m = te.running
        row = {"test_season": year, "train_seasons": [config.TRAIN_FIRST_SEASON, year - 1],
               "train_snapshots": int(len(tr.s)), "test_snapshots": int(len(te.s)), "scores": {}}
        for e in ev.EVENTS:
            row["scores"][e] = {name: {"brier": round(ev.brier(p[e][m], y[e][m]), 5), "logloss": round(ev.logloss(p[e][m], y[e][m]), 5)}
                                for name, p in preds.items()}
            pooled_y[e].append(y[e][m])
            for name, p in preds.items():
                pooled.setdefault(name, {}).setdefault(e, []).append(p[e][m])
        folds.append(row)
        test_parts.append((te, preds))
        title_rows += title_eval_rows(races, ratings_by_race, om, hm, sm, ctx, [year], SEED + year)
        log(f"fold {year}: win brier stagewise={row['scores']['win']['stagewise']['brier']} "
            f"plain={row['scores']['win']['plain_rol']['brier']} table={row['scores']['win']['position_table']['brier']} ({time.time() - t0:.0f}s)")

    pooled_scores = {}
    reliability = {}
    for e in ev.EVENTS:
        yy = np.concatenate(pooled_y[e])
        pooled_scores[e] = {"n": int(len(yy)), "base_rate": round(float(yy.mean()), 4)}
        for name in pooled:
            pp = np.concatenate(pooled[name][e])
            pooled_scores[e][name] = {"brier": round(ev.brier(pp, yy), 5), "logloss": round(ev.logloss(pp, yy), 5), "ece": round(ev.ece(pp, yy), 5)}
        reliability[e] = {name: ev.reliability(np.concatenate(pooled[name][e]), yy) for name in ("stagewise", "plain_rol", "position_table")}
    # Scores by race progress, pooled over the walk-forward test seasons.
    by_progress: dict = {e: {} for e in ev.EVENTS}
    for lo, hi, label in ev.PROGRESS_BUCKETS:
        acc: dict = {e: {"y": [], **{name: [] for name in pooled}} for e in ev.EVENTS}
        for te, preds in test_parts:
            fm = ev.progress_mask(te, lo, hi)
            m = fm[:, None] & te.running
            y = ev.outcomes(te)
            for e in ev.EVENTS:
                acc[e]["y"].append(y[e][m])
                for name, p in preds.items():
                    acc[e][name].append(p[e][m])
        for e in ev.EVENTS:
            yy = np.concatenate(acc[e]["y"])
            by_progress[e][label] = {"n": int(len(yy)), "base_rate": round(float(yy.mean()), 4),
                                     **{name: round(ev.brier(np.concatenate(acc[e][name]), yy), 5) for name in pooled}}

    log("final fit on the full training window")
    om = model.fit_order(snap)
    hm = model.fit_hazard(snap)
    sm = fit_season(snap)
    stopped = model.stopped_nc_rates(snap)
    with TRAIN_PKL.open("wb") as fh:
        pickle.dump({
            "order_beta": om.beta, "hazard_w": hm.w, "season": sm, "stopped_nc": stopped,
            "folds": folds, "pooled": pooled_scores, "reliability": reliability, "by_progress": by_progress,
            "title_rows": title_rows,
            "train_meta": {"first_season": config.TRAIN_FIRST_SEASON, "last_season": config.TRAIN_LAST_SEASON,
                           "races": len(snap.meta), "snapshots": int(len(snap.s)),
                           "driver_snapshots": int(snap.running.sum())},
            "kaggle_coverage": kaggle.coverage(),
        }, fh)
    log(f"saved {TRAIN_PKL}")
    for e in ev.EVENTS:
        log(f"pooled {e}: {pooled_scores[e]}")
    log(f"title (drivers): {summarise_title(title_rows, 'driver')}")


# ------------------------------------------------------------------------------------------
# export
# ------------------------------------------------------------------------------------------
def r3(x):
    return None if x is None or (isinstance(x, float) and not np.isfinite(x)) else round(float(x), 3)


def write_json(path: Path, obj) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, separators=(",", ":"), ensure_ascii=False)
    path.write_text(text)
    return len(text)


def export() -> None:
    with TRAIN_PKL.open("rb") as fh:
        T = pickle.load(fh)
    om = model.OrderModel(T["order_beta"])
    hm = model.HazardModel(T["hazard_w"])
    sm = T["season"]
    jolpica.client.offline = True
    openf1.client.offline = True

    log("replaying ratings through the training archive")
    kag = kaggle.race_timings(2010, config.TRAIN_LAST_SEASON)
    _, rat = ratings_walk(kag)

    out_root = config.APP_DATA_DIR
    built_utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    season_index = []
    diagnostics_replay = {}
    quality_summary = {}
    golden_cases = []

    for season in config.REPLAY_SEASONS:
        log(f"building replay season {season}")
        schedule = jolpica.schedule(season)
        builds = replay.build_season(season)
        completed = {b.info["round"] for b in builds}
        sprint_rounds = {int(r["round"]) for r in schedule if "Sprint" in r}
        total_rounds = len(schedule)
        status = "complete" if len(completed) == total_rounds else "in_progress"

        # ---- standings: recomputed from classifications and checked against the published tables
        d_pts: dict[str, float] = {}
        d_wins: dict[str, int] = {}
        c_pts: dict[str, float] = {}
        c_wins: dict[str, int] = {}
        d_meta: dict[str, dict] = {}
        c_meta: dict[str, dict] = {}
        standings_check = []
        points_rule_violations = []
        snaps_parts = []
        rounds_out = []
        for b in builds:
            rt, fr = b.timing, b.frames
            rnd = b.info["round"]
            for i, d in enumerate(b.drivers):
                d_meta[d["id"]] = {"id": d["id"], "code": d["code"], "name": d["name"], "team": d["team"]}
                c_meta[d["team"]] = {"id": d["team"], "name": d["teamName"], "color": d["color"] or c_meta.get(d["team"], {}).get("color")}
            if b.sprint:
                for s in b.sprint:
                    d_pts[s["id"]] = d_pts.get(s["id"], 0.0) + s["points"]
                    c_pts[s["team"]] = c_pts.get(s["team"], 0.0) + s["points"]
                for s in b.sprint:
                    exp = config.SPRINT_POINTS_2022[s["position"] - 1] if s["position"] and s["position"] <= 8 else 0
                    if exp != s["points"]:
                        points_rule_violations.append({"round": rnd, "session": "sprint", "driver": s["id"], "expected": exp, "published": s["points"]})
            standings_in = {
                "drivers": sorted(({**d_meta[k], "points": d_pts.get(k, 0.0), "wins": d_wins.get(k, 0)} for k in d_meta),
                                  key=lambda x: (-x["points"], -x["wins"], x["id"])),
                "constructors": sorted(({**c_meta[k], "points": c_pts.get(k, 0.0), "wins": c_wins.get(k, 0)} for k in c_meta),
                                       key=lambda x: (-x["points"], -x["wins"], x["id"])),
            }
            ratings = rat.before(season, rt.drivers, rt.constructors)

            # ---- race observation file (no settlement labels) --------------------------------
            F_ = fr.n_frames
            D = rt.n
            race_id = f"{season}-{rnd:02d}"
            obs = {
                "schema": 3, "id": race_id, **b.info, "laps": rt.total_laps,
                "startUtc": r3(b.t0_utc),
                "drivers": b.drivers,
                "grid": [int(g) for g in rt.grid], "startRank": [int(x) for x in start_rank(rt.grid)],
                "teams": sorted(({"id": t, **{k: v for k, v in c_meta[t].items() if k != "id"}} for t in set(rt.constructors)), key=lambda x: x["id"]),
                "ratings": {"dform": [r3(x) for x in ratings["dform"]], "tform": [r3(x) for x in ratings["tform"]],
                            "dnc": [r3(x) for x in ratings["dnc"]], "tnc": [r3(x) for x in ratings["tnc"]],
                            "fieldNc": r3(ratings["field_nc"][0])},
                "standings": standings_in,
                "calendar": {"roundsTotal": total_rounds,
                             "gpsLeft": sum(1 for r_ in schedule if int(r_["round"]) > rnd),
                             "sprintsLeft": sum(1 for q in sprint_rounds if q > rnd)},
                "frames": {
                    "n": F_, "t": [r3(x) for x in fr.cutoff], "status": b.status,
                    "laps": fr.laps.tolist(), "pos": fr.order.tolist(),
                    "gap": [[r3(x) for x in row] for row in fr.gap], "pits": fr.pits.tolist(), "down": fr.down.tolist(),
                    "stopped": fr.stopped.astype(int).tolist(),
                    "tyre": b.tyre, "tyreAge": b.tyre_age,
                    "lastLap": [[r3(x) for x in row] for row in fr.last_lap],
                    "weather": b.weather, "events": b.events,
                },
                "quality": b.quality,
                "sources": {
                    "official": f"{config.JOLPICA_BASE}/{season}/{rnd}/results.json",
                    "lapChart": f"{config.JOLPICA_BASE}/{season}/{rnd}/laps.json",
                    "pitStops": f"{config.JOLPICA_BASE}/{season}/{rnd}/pitstops.json",
                    "context": openf1.source_url(b.openf1_session_key, "race_control") if b.openf1_session_key else None,
                },
            }
            # Ratings in the file are rounded; features must be computed from exactly what ships.
            ratings_r = {k: np.round(v, 3) for k, v in ratings.items()}
            size = write_json(out_root / str(season) / f"r{rnd:02d}.json", obs)

            # ---- golden vectors for the TypeScript mirror ------------------------------------
            if rnd in (1, 8, 13):
                for n in sorted({0, 1, 2, 5, rt.total_laps // 3, rt.total_laps // 2, rt.total_laps - 6, rt.total_laps - 1}):
                    # Recompute from the rounded values the browser will see.
                    fr_r = fr
                    X, running = F.order_features(rt, fr_r, n, ratings_r)
                    H = F.hazard_features(rt, fr_r, n, ratings_r)
                    Bv = F.basis(n, rt.total_laps)
                    U = np.einsum("df,b,gfb->gd", X, Bv, om.beta)
                    golden_cases.append({"race": race_id, "frame": n, "basis": Bv.tolist(),
                                         "X": np.round(X, 9).tolist(), "H": np.round(H, 9).tolist(),
                                         "U": np.round(U, 9).tolist(), "h": np.round(hm.prob(H), 9).tolist(),
                                         "running": running.astype(int).tolist()})

            # ---- fold this race into running totals ------------------------------------------
            exp_pts = np.zeros(D)
            for c in b.classification:
                if c["classified"] and c["position"] <= 10:
                    exp_pts[rt.drivers.index(c["id"])] = config.RACE_POINTS[c["position"] - 1]
            for i in range(D):
                if abs(exp_pts[i] - rt.points[i]) > 1e-9:
                    points_rule_violations.append({"round": rnd, "session": "race", "driver": rt.drivers[i],
                                                   "expected": float(exp_pts[i]), "published": float(rt.points[i])})
                d_pts[rt.drivers[i]] = d_pts.get(rt.drivers[i], 0.0) + float(rt.points[i])
                c_pts[rt.constructors[i]] = c_pts.get(rt.constructors[i], 0.0) + float(rt.points[i])
                if rt.final_order[i] == 1:
                    d_wins[rt.drivers[i]] = d_wins.get(rt.drivers[i], 0) + 1
                    c_wins[rt.constructors[i]] = c_wins.get(rt.constructors[i], 0) + 1
            pub_d = {s["Driver"]["driverId"]: float(s["points"]) for s in jolpica.driver_standings(season, rnd)}
            pub_c = {s["Constructor"]["constructorId"]: float(s["points"]) for s in jolpica.constructor_standings(season, rnd)}
            diff_d = {k: (d_pts.get(k, 0.0), v) for k, v in pub_d.items() if abs(d_pts.get(k, 0.0) - v) > 1e-9}
            diff_c = {k: (c_pts.get(k, 0.0), v) for k, v in pub_c.items() if abs(c_pts.get(k, 0.0) - v) > 1e-9}
            standings_check.append({"round": rnd, "driver_diffs": diff_d, "constructor_diffs": diff_c})
            standings_out = {
                "drivers": sorted(({**d_meta[k], "points": d_pts.get(k, 0.0), "wins": d_wins.get(k, 0)} for k in d_meta),
                                  key=lambda x: (-x["points"], -x["wins"], x["id"])),
                "constructors": sorted(({**c_meta[k], "points": c_pts.get(k, 0.0), "wins": c_wins.get(k, 0)} for k in c_meta),
                                       key=lambda x: (-x["points"], -x["wins"], x["id"])),
            }
            notes = []
            for c in b.classification:
                if c["text"] == "D":
                    notes.append(f"{d_meta[c['id']]['name']} was disqualified after the race; the official classification differs from the order at the flag.")
                if c["text"] == "W" or c["status"] == "Did not start":
                    notes.append(f"{d_meta[c['id']]['name']} did not start.")
            write_json(out_root / str(season) / f"r{rnd:02d}.settlement.json", {
                "schema": 3, "id": race_id, "season": season, "round": rnd,
                "classification": b.classification, "sprint": b.sprint, "standingsAfter": standings_out,
                "fastestLap": b.fastest_lap_ref, "notes": notes,
                "source": f"{config.JOLPICA_BASE}/{season}/{rnd}/results.json",
            })

            # ---- out-of-sample snapshots for scoring the shipped model on this season ---------
            if dataset.usable(rt):
                one = dataset.build([rt], season, ratings=_FrozenRatings(ratings_r))
                snaps_parts.append(one)
            rat.update(rt.drivers, rt.constructors, rt.final_order, rt.classified)
            rounds_out.append({**b.info, "id": race_id, "laps": rt.total_laps, "entrants": D, "bytes": size})
            quality_summary[race_id] = b.quality
            log(f"  {race_id} {b.info['name']}: {F_} frames, {D} cars, {size / 1024:.0f} kB")

        champion = None
        if status == "complete":
            champion = {"driver": standings_out["drivers"][0], "constructor": standings_out["constructors"][0]}
            write_json(out_root / str(season) / "season.settlement.json", {
                "schema": 3, "season": season, "finalStandings": standings_out, "champion": champion,
                "source": f"{config.JOLPICA_BASE}/{season}/driverstandings.json",
            })
        write_json(out_root / str(season) / "season.json", {
            "schema": 3, "season": season, "status": status, "roundsTotal": total_rounds,
            "rounds": rounds_out,
            "calendar": [{"round": int(r_["round"]), "name": r_["raceName"], "date": r_["date"], "sprintWeekend": "Sprint" in r_,
                          "hasData": int(r_["round"]) in completed} for r_ in schedule],
            "points": {"race": config.RACE_POINTS, "sprint": config.SPRINT_POINTS_2022, "fastestLapPoint": False},
            "builtUtc": built_utc,
        })
        season_index.append({"season": season, "status": status, "rounds": len(rounds_out), "roundsTotal": total_rounds})

        # ---- score the shipped model on the replay season (never used in training) -----------
        snap_r = _concat(snaps_parts)
        preds = {
            "stagewise": predict(om, hm, snap_r, SEED + season),
            "uniform": ev.uniform_baseline(snap_r),
        }
        kag_snap = dataset.build(kag, config.TRAIN_FIRST_SEASON)
        preds["position_table"] = ev.PositionTable(kag_snap).predict(snap_r)
        y = ev.outcomes(snap_r)
        m = snap_r.running
        diagnostics_replay[str(season)] = {
            "races": len(snaps_parts), "snapshots": int(len(snap_r.s)), "driver_snapshots": int(m.sum()),
            "scores": ev.score_table(snap_r, preds),
            "reliability": {e: ev.reliability(preds["stagewise"][e][m], y[e][m]) for e in ev.EVENTS},
            "ece": {e: round(ev.ece(preds["stagewise"][e][m], y[e][m]), 5) for e in ev.EVENTS},
            "standings_check": {"rounds": len(standings_check),
                                "rounds_with_differences": [s for s in standings_check if s["driver_diffs"] or s["constructor_diffs"]]},
            "points_rule_violations": points_rule_violations,
        }
        log(f"  {season} out-of-sample: " + ", ".join(
            f"{e} brier {diagnostics_replay[str(season)]['scores'][e]['all']['stagewise']['brier']} "
            f"(table {diagnostics_replay[str(season)]['scores'][e]['all']['position_table']['brier']})" for e in ev.EVENTS))
        log(f"  standings reconciliation: {len(standings_check)} rounds, "
            f"{len(diagnostics_replay[str(season)]['standings_check']['rounds_with_differences'])} with differences; "
            f"points-rule violations: {len(points_rule_violations)}")

    # ---- model + diagnostics ------------------------------------------------------------------
    write_json(out_root / "model.json", {
        "schema": 3, "builtUtc": built_utc, "training": T["train_meta"],
        "features": {"order": F.ORDER_FEATURES, "hazard": F.HAZARD_FEATURES, "inRaceOnly": list(F.IN_RACE_ONLY),
                     "knots": F.KNOTS, "seasonOrder": SEASON_ORDER_FEATURES, "seasonHazard": SEASON_HAZARD_FEATURES},
        "constants": {"gapCap": F.GAP_CAP, "rateCap": F.RATE_CAP, "leadCap": F.LEAD_CAP, "pitLossS": F.PIT_LOSS_S},
        "stageGroup": model.STAGE_GROUP[:26], "stages": model.STAGES,
        "order": {"beta": np.round(om.beta, 6).tolist()},
        "hazard": {"w": np.round(hm.w, 6).tolist(), "stoppedNc": {"early": round(T["stopped_nc"]["early"], 4), "late": round(T["stopped_nc"]["late"], 4)}},
        "season": {"beta": np.round(sm["beta"], 6).tolist(), "hazardW": np.round(sm["hazard_w"], 6).tolist()},
    })
    write_json(out_root / "diagnostics.json", {
        "schema": 3, "builtUtc": built_utc, "training": T["train_meta"],
        "walkForward": {"testSeasons": WF_TEST_YEARS, "folds": T["folds"], "pooled": T["pooled"],
                        "reliability": T["reliability"], "byProgress": T["by_progress"]},
        "title": {"drivers": summarise_title(T["title_rows"], "driver"), "constructors": summarise_title(T["title_rows"], "constructor")},
        "replay": diagnostics_replay,
    })
    write_json(out_root / "index.json", {"schema": 3, "builtUtc": built_utc, "seasons": season_index})
    write_json(out_root / "provenance.json", {
        "schema": 3, "builtUtc": built_utc,
        "sources": {
            "jolpica": {"base": config.JOLPICA_BASE, "role": "official classification, grid, lap chart, pit-stop laps, calendar, standings"},
            "openf1": {"base": config.OPENF1_BASE, "role": "race start instant, track status, tyre stints, weather, race-control messages; cross-check of lap times, pit laps and classification"},
            "kaggle": {"dataset": "rohanrao/formula-1-world-championship-1950-2020", "role": "model training and walk-forward validation only", "coverage": T["kaggle_coverage"]},
        },
        "quality": quality_summary,
    })
    fixtures = config.REPO_ROOT / "src" / "engine" / "__tests__" / "fixtures"
    write_json(fixtures / "golden.json", {"cases": golden_cases})
    log(f"wrote {len(golden_cases)} golden vectors; export complete")


class _FrozenRatings(Ratings):
    """A ratings object that always answers with a fixed snapshot (for scoring a single race)."""

    def __init__(self, snapshot: dict[str, np.ndarray]):
        super().__init__()
        self._snapshot = snapshot

    def before(self, season, drivers, constructors):  # type: ignore[override]
        return self._snapshot

    def update(self, *args, **kwargs) -> None:  # type: ignore[override]
        return None


def _concat(parts: list[dataset.Snapshots]) -> dataset.Snapshots:
    meta: list[dict] = []
    race = []
    for p in parts:
        race.append(p.race + len(meta))
        meta += p.meta
    cat = lambda name: np.concatenate([getattr(p, name) for p in parts])  # noqa: E731
    return dataset.Snapshots(cat("X"), cat("H"), cat("B"), cat("running"), cat("present"), cat("final_order"),
                             cat("classified"), np.concatenate(race), cat("frame"), cat("s"), cat("order"), meta)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    if cmd in ("train", "all"):
        train()
    if cmd in ("export", "all"):
        export()
