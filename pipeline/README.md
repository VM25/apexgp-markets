# ApexGP data and modelling pipeline

Offline Python that turns public Formula 1 data into the static files the app loads. Free and open-source dependencies only.

## Setup

```bash
python3 -m venv pipeline/.venv
pipeline/.venv/bin/pip install -r pipeline/requirements.txt
```

Place the Kaggle archive `rohanrao/formula-1-world-championship-1950-2020` (CC0) at the repository root as `archive.zip`. It is git-ignored and read in place; it is needed for `build.py train` and for the archive-based tests, not for running the app.

## Commands

```bash
pipeline/.venv/bin/python pipeline/fetch.py 2025        # cache every source response (about 650 requests, 15–20 min, resumable)
pipeline/.venv/bin/python pipeline/build.py train       # fit + walk-forward validation (about 3 min)
pipeline/.venv/bin/python pipeline/build.py export      # write public/data (about 15 s)
pipeline/.venv/bin/python pipeline/circuits.py 2025     # circuit traces
pipeline/.venv/bin/python -m pytest pipeline/tests      # 13 tests, offline
```

`fetch.py` respects the sources' published rate limits (Jolpica 4 req/s burst and 500/h; OpenF1 30/min) and backs off on HTTP 429. Responses are cached under `pipeline/.cache/` keyed by URL; once warm, `build.py` runs offline and reproduces the same files.

## What is where

| | |
|---|---|
| `apexgp/timing.py` | Canonical race record and the strict as-of frame builder |
| `apexgp/ratings.py` | Walk-forward form and reliability ratings |
| `apexgp/features.py` | Feature definitions (mirrored in `src/engine/model/features.ts`) |
| `apexgp/model.py` | Stage-wise rank-ordered logit, hazard model, joint simulation |
| `apexgp/futures.py` | Season simulation for title contracts |
| `apexgp/evaluate.py` | Brier, log loss, reliability, baselines |
| `apexgp/replay.py` | 2025 build with cross-source validation |
| `reference/` | Licences, fee schedules and the real-venue order-book snapshot used to calibrate spreads |
| `tests/` | As-of truncation, ratings independence, exported-data integrity |

Method and results: `docs/DATA.md`, `docs/METHODOLOGY.md`.
