# ApexGP Markets

A Formula 1 prediction-market **simulation** and market-microstructure study, built on real lap-by-lap replays of the 2025 season.

Formula 1 supplies the events. A forecasting model turns each lap into probabilities. A simulated dealer turns probabilities into bid and ask prices. You run a $100,000 book of YES/NO contracts through to official settlement, and the app measures what your decisions and your trading costs did to it.

Fictional capital only. There is no real-money trading, wagering or account connection anywhere in this project.

- Live build: <https://apexgp-markets.netlify.app> (deploys from `main`; the v3 rebuild lives on `overhaul/v3` until merged)
- The June 2026 version is preserved at the tag `legacy-v2-june-2026` and the branch `legacy/v2`

---

## What is real, what is estimated, what is simulated

| | Where it comes from | In the app |
|---|---|---|
| **Recorded** | Official classifications, grids, lap charts and pit stops (Jolpica F1); track status, tyres, weather, race control (OpenF1) | Black ink |
| **Estimated** | A rank-ordered logit model fitted on 2014–2024 and never shown 2025 | Blue |
| **Simulated** | A rule-based dealer quoting around the model's estimate. No exchange ever quoted these prices | Grey band |
| **Yours** | Orders and fills in your session | Orange markers |

The replay is never presented as live, and results of races ahead of your session clock are not shown unless you ask to review them.

## What you can do

1. **Overview** — the season calendar, standings at your session's clock, and the current race's board.
2. **Markets** — seven contract types per race (winner, podium, points, not classified, team-mate head-to-head, drivers' and constructors' title), each with a model estimate, a five-level bid/ask ladder, price history, an explanation of the last move, and an order ticket with live preview (fills, fees, slippage, worst case, risk-limit usage).
3. **Race** — step or play through the recorded race: timing tower, tyres and stops, a gap map on the real circuit trace, contender probabilities, race-control events. Trade from any row.
4. **Portfolio** — positions, resting orders, net asset value by lap, joint-scenario risk, per-race performance, execution-cost breakdown, full fill / settlement / audit records.
5. **Research** — the methods, with the model's measured out-of-sample results, calibration charts, coefficient curves and an interactive "quote lab" driven by the same code as the engine.

A five-minute tour: open **Markets**, buy 500 YES on a driver to win, press **To flag** in the clock bar, press **Settle**, read the settlement sheet, open the next round.

## Headline measurements

All figures are produced by `pipeline/build.py` and shipped in `public/data/diagnostics.json`; the Research page reads them from there.

| Brier score, lower is better | Shipped model | Position-frequency baseline | Uniform |
|---|---|---|---|
| Race winner — walk-forward 2019–2024 (141,831 driver-laps) | **0.0209** | 0.0240 | 0.0511 |
| Race winner — 2025, never seen in training (26,874 driver-laps) | **0.0149** | 0.0198 | 0.0508 |
| Podium — 2025 | **0.0443** | 0.0472 | 0.1351 |
| Points finish — 2025 | **0.1115** | 0.1163 | 0.2469 |
| Not classified — 2025 | 0.0475 | 0.0485 | 0.0490 |

The not-classified model has almost no skill beyond a base rate; that is reported, not hidden. Data checks: for all 24 rounds the official race time is reproduced from summed lap times, the published lap chart is re-derived exactly, two independent sources agree on lap times within 5 ms for 98% of laps, and recomputed standings match the published tables in every round.

## Running it

Requires Node 22+.

```bash
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run build        # static export to ./out (what Netlify publishes)
```

### Tests

```bash
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # 89 engine tests (vitest + fast-check)
npm run build && npm run e2e    # 35 browser tests against the static export (Playwright + axe)
```

```bash
pipeline/.venv/bin/python -m pytest pipeline/tests    # 13 data / look-ahead tests
```

`docs/TESTING.md` lists what each suite proves and the results of the last run.

### Rebuilding the data (optional)

The app ships with built data in `public/data/` (1.6 MB). To rebuild it from the sources you need Python 3.12 and the Kaggle archive (see `pipeline/README.md`):

```bash
python3 -m venv pipeline/.venv && pipeline/.venv/bin/pip install -r pipeline/requirements.txt
pipeline/.venv/bin/python pipeline/fetch.py 2025      # warm the source cache (throttled, resumable)
pipeline/.venv/bin/python pipeline/build.py all       # fit, validate, export
pipeline/.venv/bin/python pipeline/circuits.py 2025   # circuit traces
```

## Architecture in one screen

```
pipeline/            offline Python: sources -> as-of frames -> model fit -> validation -> app data
public/data/         static JSON the app loads (observations and settlement labels in separate files)
src/engine/          framework-free TypeScript, deterministic and unit-tested
  model/               feature mirror of the pipeline, joint race simulation, title simulation
  market/              contracts, dealer quotes, order execution, fees
  portfolio/           integer-cent ledger, scenario risk, analytics
  session/             RaceLens (read-only derivations) and TradingSession (the state machine)
src/state/           store, persistence, data loaders
src/features/        the five views; src/charts/ and src/ui/ are the design system
tests/e2e/           Playwright journeys, viewport sweep, accessibility
```

The whole app is a static export: no server, no database, no API keys. Session state lives in the browser's `localStorage`.

## Documentation

| | |
|---|---|
| [`docs/AUDIT.md`](docs/AUDIT.md) | What was wrong with the June 2026 version, verified against its code |
| [`docs/DATA.md`](docs/DATA.md) | Sources, selection matrix, schema, validation, licences |
| [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) | Forecasting model, validation, market mechanics, accounting, risk |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Modules, state, persistence, deployment |
| [`docs/DESIGN.md`](docs/DESIGN.md) | The three visual directions considered and the system that was built |
| [`docs/TESTING.md`](docs/TESTING.md) | Test inventory, executed results, screenshots, known issues |
| [`docs/REPORT.md`](docs/REPORT.md) | Implementation report for the v3 rebuild |

## Limitations

- It is history: a user may know the result. The simulation is about how information becomes price and what trading costs, not about foresight.
- One dealer, no other traders. Quoted spreads are calibrated to a single snapshot of real F1 books on two venues; depth and dynamics are assumptions.
- The model does not see tyres, track status, weather or damage, and cannot foresee stewards' decisions. Retirements are close to unpredictable.
- One season is 24 races. Read any per-race statistic with that sample size in mind.

The Research page and `docs/METHODOLOGY.md` go through these in detail.

## Data and licences

Race data is redistributed from [Jolpica F1](https://github.com/jolpica/jolpica-f1) and [OpenF1](https://openf1.org) under CC BY-NC-SA 4.0, and the derived files in `public/data/` are offered under the same licence. Model training used the CC0 Kaggle dataset `rohanrao/formula-1-world-championship-1950-2020`. This project is non-commercial, unofficial, and not associated in any way with the Formula 1 companies. F1, FORMULA ONE and related marks are trademarks of Formula One Licensing B.V.
