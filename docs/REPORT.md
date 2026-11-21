# ApexGP Markets v3 — implementation report

21 November 2026 · branch `overhaul/v3` · baseline preserved at tag `legacy-v2-june-2026` and branch `legacy/v2`

## 1. Summary

ApexGP Markets was rebuilt from the data up. The June 2026 version's race data was script-generated, its prices were blended toward the known result, and its market was a constant two-cent offset. The rebuild replaces all three with a reproducible pipeline over real timing data, a fitted and validated forecasting model with look-ahead excluded by construction and by test, and a state-dependent dealer whose spreads are calibrated to measured real-venue books — under a new interface and a forward-only session with exact accounting.

Nothing from the old interface, hooks, data or documents is in the new application. The idea, the contract families, the $100,000 balance, the stack and the name are.

## 2. What was replaced

| Area | June 2026 | v3 |
|---|---|---|
| Race data | `generate_official_race_data.py`: invented grids, safety cars, retirements, points | Jolpica F1 + OpenF1, 24 real rounds, cross-checked (`docs/DATA.md`) |
| Pricing | `(1−w)·heuristic + w·actual result`, labelled Bayesian | Stage-wise rank-ordered logit + hazard, fitted on 2014–2024, scored on 2025 |
| Titles | Five hard-coded drivers, points share | Every driver and constructor, season Monte Carlo |
| Fastest-lap market | Settled on the car that started third | Removed |
| Market | Mid ± 2¢, unlimited size, no fees | Dealer ladder: variance- and state-dependent spread, inventory skew, finite depth, partial fills, resting orders, Kalshi fee schedule |
| Risk | Independent-sum caps, invented "Greeks" | Joint-scenario distribution, exact netted worst case, pre-trade limits |
| Performance | Lap returns × √252 "Sharpe" | Per-race statistics, drawdown, cost attribution |
| Session | Replayable races, liquidation at stale prices, no persistence | Forward-only clock, idempotent settlement, read-only review, `localStorage` |
| Architecture | One 1,069-line hook, no tests | Framework-free engine, 89 unit + 13 pipeline + 35 browser tests |
| Interface | Dark six-tab terminal | "Timing sheet" system: five views, purpose-built phone layout, WCAG AA |
| Hosting | Next.js runtime on Netlify | Static export (no functions) on Netlify |

## 3. What was preserved

- The concept and the project identity.
- The repository, its history and remote; the old implementation, recoverable at `legacy-v2-june-2026`.
- The old documentation, moved to `docs/legacy/`.
- Next.js, React, TypeScript, Tailwind; Netlify; the $100,000 starting balance.

## 4. Data sources chosen, and why

| Source | Role | Reason |
|---|---|---|
| **Jolpica F1** | Official classification, grid, lap chart, pit laps, standings | The authoritative record, same lineage as the training data, free |
| **OpenF1** | Race-start instant, track status, tyres, weather, race control, circuit traces; cross-check of timing | The only free timestamped source that still answers |
| **Kaggle archive** | Training and walk-forward validation | 1950–2024 despite its title; laps from 1996, pit stops from 2011; CC0 |
| FastF1 | Rejected | Its backend (F1's timing archive) returns HTTP 401; a build could not be reproduced |
| TUMFTM | Rejected | Covers 16 of 24 circuits; traces are derived from OpenF1 instead |
| Kalshi, Polymarket | Reference only | Published fee schedules and one order-book snapshot to set the level of spreads; never used as prices |

## 5. Problems corrected

**Data.** All fabricated observations removed. For every 2025 round: official race time reproduced from summed lap times; lap chart re-derived exactly (26,657 driver-laps); lap times agree across two sources within 5 ms for 96.6–98.6% of laps; pit stops and classifications identical across sources; standings recomputed and matched in all 24 rounds.

**Look-ahead.** Forecasting inputs and settlement labels are separate files and separate code paths. Frames are strictly as-of. Three independent tests: truncation in the pipeline, scrambling the future in the engine, and label-free observation files. Entrant order no longer encodes results.

**Model.** A defensible structure (rank-ordered logit) extended only where measurement justified it (stage-specific coefficients cut winner calibration error from 0.016 to 0.002). Out of sample on 2025 it reduces the winner Brier score by 24.6% against the position-frequency baseline. Where it has little skill (retirements) or loses to a naive rule (titles late in a season, in a six-season sample), the documentation says so.

**Market.** Fair value, quoted price, execution price and settlement value are four distinct things in code and on screen. Spread, depth and fees respond to state; orders have size-dependent cost and can partially fill; resting orders exhibit adverse selection.

**Accounting.** Integer cents; signed-YES positions with collateralised NO; the NAV identity property-tested; settlement idempotent; every replay exploit from the audit closed.

**Terminology.** "Bayesian", "implied volatility", "Delta/Theta", "Sharpe", "official telemetry", "AMM" and "live" are gone from product and documentation wherever they were not true.

## 6. New capabilities

Seven contract types on every race, including points finishes, team-mate head-to-heads and full-field titles · five-level order book with click-to-limit · order preview with fills, fees, slippage, model edge, worst case and limit usage · two-step confirmation · limit orders that rest · "why it moved" explanations · timing tower with tyres and stops · gap map on real circuit traces · contender probability chart · race-control feed interleaved with model repricing · settlement sheet with the official classification and stewards' notes · read-only review with the result behind an explicit action · joint-scenario risk histogram · execution-cost and attribution reports · session export · Research page with live diagnostics, reliability diagrams, coefficient curves and an interactive quote lab.

## 7. Tests executed

All on this branch, 21 November 2026, after the final dependency upgrade. Details and defects found: `docs/TESTING.md`.

| Suite | Result |
|---|---|
| ESLint | clean |
| TypeScript | clean |
| `npm audit` | 0 vulnerabilities |
| Engine (vitest + fast-check) | 89 / 89 |
| Pipeline (pytest) | 13 / 13 |
| Production build (static export, Next.js 16.4.6) | success, 3.7 MB |
| Browser (Playwright, Chromium, production export) | 35 / 35 — journey, phone, 13 viewport sizes × 5 views, axe on 5 views × 2 widths, keyboard, reduced motion |

Rendered output was inspected in screenshots at 320, 390, 768, 1,440 and 2,560 px and in the workflow captures.

## 8. Limited or incomplete

| Item | State |
|---|---|
| 2026 season | **Not built.** Jolpica lists 20 completed 2026 rounds; the pipeline is season-parametrised, but an unfinished season needs a session rule for unsettled titles and there is no validation yet under the 2026 regulations. |
| Safety-car market | **Not built.** The training archive has no track-status history; a hazard model would need a second historical source. |
| Model inputs | No tyres, weather, track status or damage. Constant 20 s pit loss. |
| Retirement model | Barely better than a base rate; retirements treated as independent across cars. |
| Depth and dealer dynamics | Assumed, not measured. Only the level of spreads and the fee schedule are empirical, from one snapshot. |
| Other market participants | None. One dealer, one account. |
| Browsers | Tested on Chromium only. |
| Devices and assistive technology | Emulated sizes and automated checks; no physical-device or screen-reader sessions. |
| Netlify deploy | Not performed from this branch (below). |
| Full-season browser run | Rounds are exercised individually and in pairs; a 24-round session was not played through in a browser. |

## 9. Deployment

Production (<https://apexgp-markets.netlify.app>) still serves the June 2026 build from `main`. **Nothing has been pushed or deployed.** The work is committed locally on `overhaul/v3`.

To release:

1. `git push -u origin overhaul/v3` and open a pull request against `main`.
2. Check the Netlify deploy preview for the pull request. `netlify.toml` now sets the build command (`npm run build`), the publish directory (`out`) and Node 22; the site previously relied on auto-detection of the Next.js runtime, so this is the step most worth checking. If the site has the Next.js runtime plugin pinned in the Netlify UI, remove it — the app is a plain static site now.
3. Walk the five views on the preview on a phone and a desktop.
4. Merge. Netlify deploys `main`.
5. Optionally `git push origin legacy-v2-june-2026 legacy/v2` so the baseline is recoverable from GitHub as well as locally.

Rollback is a revert of the merge commit; the old build needs no data migration because session state from v2 was never persisted and v3's storage key is new.

## 10. Decisions worth knowing about

- **Static export over the Next.js runtime.** The app needs no server; a static site is cheaper, simpler and cannot incur usage.
- **One model for all markets** rather than a best-in-class model per market: coherence between related contracts was judged worth a fourth-decimal loss on one market.
- **The dealer does not learn from order flow.** In a replay the user may know the result; a learning dealer would leak it into prices.
- **No rewind in a session.** The read-only review exists so that this never feels like a missing feature.
- **Depth is deliberately unrealistic** (several times real books) so that a $100,000 account can trade; this is stated wherever depth is shown or discussed.
- **2025 only**, done completely, in preference to two seasons done partly.
- **Dependencies upgraded** during the work (Next.js 16.2.6 → 16.4.6, vitest 3 → 5) to clear 20 audit advisories; `recharts`, `canvas-confetti` and `lucide-react` removed. Runtime dependencies are now `next`, `react` and `react-dom`.
