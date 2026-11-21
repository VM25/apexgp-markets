# Historical data: sources, construction and validation

## 1. Source selection

Five candidate sources were evaluated against what the product needs. The decision for each is recorded here; evidence quotes and access dates are in `pipeline/reference/SOURCES_AND_LICENCES.md`.

| | Jolpica F1 | OpenF1 | Kaggle archive | FastF1 | TUMFTM track DB |
|---|---|---|---|---|---|
| Provides | Results, grids, qualifying, sprints, lap times and lap chart, pit stops, standings, calendar | Timestamped laps, stints (tyres), pit lane, race control, weather, car position | Ergast-derived CSVs: results, laps, pit stops, standings | Python access to F1 live-timing archive | Surveyed centre-lines and widths |
| Coverage | 1950– (laps 1996–, pits 2011–) | 2023– | Results 1950–2024, laps 1996–2024, pits 2011–2024 (the title says "1950–2020"; the files run through 2024) | 2018– | 25 circuits; 16 of the 24 raced in 2025 |
| Grain | Lap | Sub-second | Lap | Sub-second | Geometry |
| Access | Free, no key; 4 req/s burst, 500/h | Free historical, no key; 3 req/s, 30/min | One zip (supplied) | **F1's archive now returns HTTP 401** (login required since Oct 2026) | Git repository |
| Data licence | CC BY-NC-SA 4.0 | CC BY-NC-SA 4.0 | CC0 | n/a (code MIT) | LGPL-3.0, on ODbL map data |
| Reproducible at $0 | Yes | Yes | Yes | **No** | Yes |
| **Decision** | **Primary: official record** | **Primary: timed context. Cross-check: timing** | **Training only** | **Rejected** | **Rejected** (incomplete) |

Field ownership:

| Field | Primary | Cross-check |
|---|---|---|
| Calendar, entry list, grid | Jolpica | OpenF1 driver list (identity) |
| Lap times, lap chart | Jolpica | OpenF1 lap durations and lap-start timestamps |
| Pit-stop laps | Jolpica | OpenF1 pit-lane records |
| Official classification, points | Jolpica | OpenF1 session result |
| Standings | Recomputed from classifications | Jolpica published standings, every round |
| Race start instant (UTC) | OpenF1 lap timestamps aligned to Jolpica lap times | OpenF1 "session started" message |
| Track status (SC / VSC / red) | OpenF1 race-control messages | — |
| Tyre compound and age | OpenF1 stints | — |
| Weather | OpenF1 | — |
| Circuit outline | OpenF1 position samples of the fastest race lap | — |
| Model training | Kaggle archive | — |

Jolpica is primary for timing because the model is trained on the Ergast lineage (the Kaggle archive); serving it the same lineage removes a source of train/serve skew.

## 2. Pipeline

```
pipeline/fetch.py      warm a disk cache of every source response (throttled, resumable, offline thereafter)
pipeline/build.py      train  -> fit models, walk-forward validation            (pipeline/build/train.pkl)
                       export -> replay seasons, model, diagnostics, provenance  (public/data/)
pipeline/circuits.py   circuit traces                                           (public/data/circuits/)
```

`pipeline/apexgp/`:

| Module | Responsibility |
|---|---|
| `http.py` | Disk-cached, throttled JSON client. Every response is stored by URL; a rebuild with a warm cache makes no network calls. |
| `sources/` | One thin module per source. |
| `timing.py` | The canonical `RaceTiming` record and the as-of frame builder shared by training and replay. |
| `ratings.py` | Walk-forward driver/team form and reliability ratings. |
| `features.py` | Feature definitions (mirrored in `src/engine/model/features.ts`). |
| `model.py`, `futures.py` | Model fitting, joint simulation, season simulation. |
| `evaluate.py` | Scoring and baselines. |
| `replay.py` | Builds each 2025 round from Jolpica + OpenF1 and runs the cross-source checks. |

The build is deterministic: fixed seeds, cached inputs.

## 3. Canonical schema

IDs are the Ergast ones throughout: `driverId` (`max_verstappen`), `constructorId` (`red_bull`), `circuitId` (`albert_park`). A race is `"{season}-{round:02d}"`. A contract is `"{raceId}:{KIND}:{subject}"` or `"{season}:{WDC|WCC}:{subject}"`. Time is seconds on the race clock (zero at the start), anchored to UTC by `startUtc`.

Files under `public/data/` (TypeScript types in `src/engine/types.ts`):

| File | Contents |
|---|---|
| `{season}/season.json` | Calendar, rounds with data, points system. **No results.** |
| `{season}/r{NN}.json` | One race's **observations**: entrants in grid order, grid, pre-race ratings, standings entering the race, remaining calendar, and frames (per frame and car: laps completed, order, gap, stops, laps down, stopped flag, tyre, last lap; plus track status, weather and events). **No classification.** |
| `{season}/r{NN}.settlement.json` | The official classification, sprint result, standings after the round, notes on disqualifications. Fetched only at settlement or on an explicit review. |
| `{season}/season.settlement.json` | Final standings and champions. |
| `model.json` | Coefficients and constants of the shipped model. |
| `diagnostics.json` | Walk-forward and out-of-sample scores, reliability tables, title evaluation. |
| `provenance.json` | Sources and the per-race quality report. |
| `market_reference.json` | Real-venue fee schedules and spread measurements. |
| `circuits/{circuitId}.json` | 240-point outline, reference lap time. |

Details that matter:

- **Entrants are stored in (grid slot, driver id) order**, never finishing order. Sources list results in finishing order; any index-based tie-break downstream would otherwise leak the result.
- **Mid-season driver changes** (Tsunoda/Lawson after round 2, Colapinto for Doohan from round 7) are handled by taking each round's entry list from that round's classification. Ratings are keyed by driver and by constructor lineage (`ratings.LINEAGE`), so a renamed team keeps its history.
- **Sprint weekends**: sprint points are added to the standings entering that weekend's grand prix, and the remaining-sprint count feeds the title simulation.
- **Points rules** are per season (`season.json → points`). For 2025: 25-18-15-12-10-8-6-4-2-1, sprint 8…1, no fastest-lap point. The export verifies every published points value against the rule.
- **Disqualifications**: the classification is the post-penalty official result. Six cars were disqualified in 2025; settlement files carry a note for each.

## 4. Information time

Let τ(m) be the race-clock instant the first car completes lap m.

- **Frame 0** — the grid. Nothing from the race.
- **Frame n** (0 < n < N) — every line crossing strictly before τ(n+1). Lead-lap cars have completed lap n; lapped cars are where they really were at that instant.
- **Frame N** — every crossing (all cars have taken the flag).

A car is flagged *stopped* when it has made no crossing during the leader's last two laps. One missed lap is ambiguous (the car may just have been lapped); two is not. The rule uses nothing after the frame's cutoff. Race-control messages and status changes are attributed to a frame only if published at least one second before its cutoff, because the two clocks agree to about 0.1 s.

`pipeline/tests/test_asof.py` truncates raw timing at each cutoff and requires frames and features to be identical, on archive races and on 2025.

## 5. Validation (2025, all 24 rounds)

Run by `replay.build_race`, stored in `provenance.json`, asserted in `pipeline/tests/test_data.py`.

| Check | Result |
|---|---|
| Lap chart complete (no gaps) | 24 / 24 |
| Official race time = sum of the winner's lap times | Within 0.001 s in 24 / 24 |
| Published lap-chart positions = positions re-derived from cumulative lap times | 100% of 26,657 driver-laps |
| Jolpica vs OpenF1 lap time within 5 ms | 96.6%–98.6% per race (the rest are first laps and pit laps, where the sources define the lap boundary differently) |
| Lap-end clock agreement after aligning race start | Median residual 0.037–0.043 s |
| Pit stops, Jolpica vs OpenF1 (driver, lap) | Identical sets in 24 / 24 |
| Classification, Jolpica vs OpenF1 | No differences |
| Driver identity (number ↔ code) | No mismatches |
| Official lap count vs lap chart | Differs only for four disqualified cars in two rounds, whose official lap count is zeroed |
| Points vs points rule | 0 violations |
| Recomputed vs published standings (drivers and constructors) | 0 differences in 24 rounds |

## 6. Licences and attribution

- **Jolpica F1** and **OpenF1** data: CC BY-NC-SA 4.0. The derived JSON in `public/data/` is redistributed under the same licence, with attribution in the app footer, the README and here. Non-commercial use only.
- **Kaggle archive**: CC0. Not redistributed; `archive.zip` is git-ignored and the pipeline reads it in place.
- **Order-book snapshot** (`pipeline/reference/`): public market-data endpoints of Kalshi and Polymarket, read without authentication; only aggregate statistics are shipped to the app.
- No images, logos, broadcast graphics or official typefaces are used. Team colours are plain hex values from OpenF1.
- ApexGP Markets is unofficial and not associated with Formula 1, the FIA or any team.

## 7. Known limits

- **2025 only.** The pipeline is season-parametrised and Jolpica already lists 20 completed 2026 rounds, but 2026 was not built: the title contracts could not settle and the model has no evidence yet on the 2026 regulations. Adding it is `REPLAY_SEASONS = (2025, 2026)` plus a session rule for an unfinished season.
- **Lap granularity.** Nothing inside a lap is modelled; the gap map interpolates between line crossings.
- **Tyres, weather and track status are displayed but not model inputs** — the training archive has none of them.
- **Race distance** is taken from the winner's lap count. No 2025 race was shortened after its start, so this equals the scheduled distance; a shortened race would need the scheduled figure from elsewhere.
- **OpenF1 stint encoding** occasionally starts a new stint without a tyre change (e.g. a pit-lane drive-through under the safety car); tyre age is shown as OpenF1 reports it.
