# Testing and evidence

Everything in this document was executed on the `overhaul/v3` branch on 21 November 2026. Raw outputs are in `docs/evidence/`; screenshots in `docs/evidence/screens/`.

## Results of the last run

| Command | Result | Evidence |
|---|---|---|
| `npm run lint` | 0 errors, 0 warnings | `evidence/lint-typecheck.txt` |
| `npm run typecheck` | 0 errors | `evidence/lint-typecheck.txt` |
| `npm test` | **89 passed** (7 files, 5.8 s) | `evidence/unit-tests.txt` |
| `pipeline/.venv/bin/python -m pytest pipeline/tests` | **13 passed** | `evidence/pipeline-tests.txt` |
| `npm run build` | Static export on Next.js 16.4.6, 6 routes prerendered, 3.7 MB | `evidence/build.txt` |
| `npm audit` | 0 vulnerabilities | `evidence/lint-typecheck.txt` |
| `npm run e2e` | **35 passed** (Chromium, against `./out`) | `evidence/e2e-tests.txt` |

## What each suite establishes

### Engine — `src/engine/__tests__` (vitest, fast-check)

| File | Tests | Establishes |
|---|---|---|
| `golden.test.ts` | 25 | The TypeScript features, strengths and hazards equal the Python pipeline's on 24 frames from three races (to 1e-6 / 1e-4). The model in the browser is the model that was validated. |
| `leakage.test.ts` | 6 | **No look-ahead.** For random frames in four races, every later frame is overwritten with nonsense (reversed order, random gaps, red flags); forecasts, joint draws, fair values, title probabilities and dealer quotes at the frame are bit-identical. Observation files contain no result fields and list entrants in grid order. |
| `forecast.test.ts` | 7 | Probabilities in [0, 1]; winners sum to 1; podium ≤ 3, points ≤ 10; win ≤ podium ≤ points per driver; head-to-head sides sum to 1; titles sum to 1; determinism; and the engine's 2025 winner Brier score is within 3% of the pipeline's reported figure. |
| `market.test.ts` | 10 | Property tests over fair value, book and context: ladders are valid, on the tick grid, bid < ask; YES/NO complement; spread widens and depth thins under a safety car; quotes are pulled under a red flag and closed at the flag; inventory skews quotes and decays back; bigger orders never get a better average price; limits are respected; partial fills; the fee formula to the cent; resting orders fill at their own price only when reached. |
| `calibration.test.ts` | 1 | The dealer's pre-race spread is within one tick of the measured interquartile range in each price bucket of the real-venue snapshot. |
| `ledger.test.ts` | 5 | For random sequences of fills and settlements: cash moves only through recorded flows; NAV = start + realised + unrealised − fees; basis is bounded; settlement is idempotent; a position can never lose more than its premium; YES and NO net; worst-case netting for mutually exclusive contracts. |
| `session.test.ts` | 35 | Buying at the ask and selling at the bid to the cent; NO costs 100 − bid; rejections (not held, no cash, bad size, unknown contract, risk limits); the clock only moves forward; markets close at the flag; settlement exactly once and only with the right file; no re-opening an earlier round; resting orders reserve cash, fill as maker at their limit under adverse moves, expire at the flag; IOC never rests; serialise → restore gives identical clock, cash, quotes and NAV; titles carry across rounds and settle after the final one; and **all 24 rounds settle with exactly one winner, three podium places and ten points finishes**, with disqualified cars handled. |

### Pipeline — `pipeline/tests` (pytest, offline against the source cache)

| File | Tests | Establishes |
|---|---|---|
| `test_asof.py` | 6 | Truncating raw timing at a frame's cutoff (and blanking all labels) leaves that frame and its features identical — on ten archive races and six 2025 races; scrambling the classification changes no frame; frame invariants; entrants in grid order; the two-lap stopped rule. |
| `test_ratings.py` | 2 | Changing one race's result changes ratings only for later rounds; ratings stay bounded. |
| `test_data.py` | 5 | 24 rounds, 6 sprint weekends; observation files have no labels; one winner with 25 points per race; points follow the rule; recomputed standings equal the published ones in every round; season points total 24 × 101 + 6 × 36; all cross-source quality gates; the shipped model beats the baseline out of sample. |

### Browser — `tests/e2e` (Playwright, production export)

| File | Tests | Establishes |
|---|---|---|
| `journey.spec.ts` | 4 | The primary journey end to end: land → markets → select → preview → two-step confirm → cash checked to the cent → refusal to oversell → step and run to the flag → markets closed → settle on the official result → payout checked → open round 2 → portfolio records → reload restores. Plus: a corrupted saved session is discarded safely; a failed data request shows a readable error and a working retry; review is read-only and keeps the result behind an explicit action. No console errors or failed requests. |
| `mobile.spec.ts` | 2 | At 390 × 844 with touch: bottom tab bar; the contract opens as a sheet; buy NO, confirm, close; race panes; speed; run to the flag; settle; the NO payout is exact. Explanations open on tap and close on an outside tap. |
| `responsive.spec.ts` | 13 | **Every view at 320, 375, 390, 430, 768, 1024, 1280, 1440, 1920 and 2560 px, plus three landscape sizes.** Asserts: no horizontal overflow (document width ≤ viewport, and no element outside it unless inside its own scroll region); no text under 10.5 px; no target under 24 px; the clock control and primary navigation in view; no console errors. |
| `a11y.spec.ts` | 13 | axe-core scan for WCAG 2.0/2.1/2.2 A and AA on all five views at 390 px and 1,440 px: **zero violations**. Keyboard: skip link, named controls, visible focus, ticket by Enter, Space toggles the clock, Escape closes dialogs. Charts expose a text summary and respond to arrow keys. Reduced motion removes animation. |
| `evidence.spec.ts` | 3 | Drives a realistic session and saves the workflow screenshots. |

## Defects found by these tests and fixed

Recorded because finding them is the point of the tests.

| Found by | Defect | Fix |
|---|---|---|
| `forecast.test.ts` | Head-to-head probabilities for (A, B) and (B, A) did not sum to 1 when neither car was classified. | Antisymmetric tie-break. |
| Rendered inspection | The gap map crashed if the circuit trace had not loaded yet. | Guard, plus a route-level error boundary. |
| `responsive.spec.ts` (phone emulation) | Pages were up to 122 px wider than a 390 px viewport, pushing the tab bar off-screen: implicit grid tracks sized to their widest child. Desktop had hidden this behind `overflow-x: hidden`. | `min-width: 0` on grid children; truncating table cells; the mask removed so it cannot hide a regression. |
| `responsive.spec.ts` | Component CSS outside a cascade layer overrode Tailwind utilities, so `hidden` controls still rendered on phones. | Component styles moved into `@layer components`. |
| `responsive.spec.ts` | Three tables and a select overflowed at 320 px; tyre letters were 10 px. | Column priority, compact row actions, sizes. |
| `a11y.spec.ts` (axe) | White on the action colour was 4.42:1 and the wordmark 3.85:1; tertiary text marginal on tinted rows. | Darker `you` and `ink-3` tokens. |
| `a11y.spec.ts` (axe) | Several `aria-label`s did not contain their visible text; scrollable tables were not keyboard-reachable. | Names derived from content with visually-hidden detail; scroll regions focusable and named. |
| End-to-end run | Python's `http.server` stalled under four parallel browsers. | A small Node static server for tests (`tests/serve.mjs`). |

## Screenshots

`docs/evidence/screens/` — captured by the test suite from the production build.

- Each view at five widths: `{overview,markets,race,portfolio,research}-{320,390,768,1440,2560}.jpg`
- Workflow: `flow-markets-ticket-1440.jpg` (position, ladder, ticket preview, limit meters), `flow-race-live-1440.jpg`, `flow-portfolio-1440.jpg` (full page: positions, resting order, risk distribution, costs, records), `flow-settlement-1440.jpg`, `flow-research-validation-1440.jpg`, `flow-research-quotelab-1440.jpg`, `flow-contract-sheet-390.jpg`

These were opened and inspected, not just generated.

## What was not tested

- **Browsers other than Chromium.** Playwright's Firefox and WebKit engines were not installed; the code uses no engine-specific features (native `<dialog>`, `ResizeObserver`, CSS cascade layers and `dvh` units are supported by current Safari and Firefox), but this is unverified.
- **Real devices and screen readers.** Phone sizes are emulated; assistive-technology behaviour is inferred from axe and the accessibility tree, not from VoiceOver or NVDA sessions.
- **The Netlify deployment itself.** The static export was built and served locally exactly as Netlify will publish it; no deploy was made from this branch (see `docs/REPORT.md`).
- **Long sessions.** A full 24-round season was exercised by the engine tests in pieces (rounds 1–2, 23–24, and settlement of all 24) but not played start to finish in a browser.

## Known issues

- With the repository inside an iCloud-synced folder, macOS can leave duplicate files such as `index 2.html` in `.next/` and `out/` during rapid rebuilds. They are ignored by git and by `tsconfig.json`; `npm run clean` removes them. A clean checkout or CI build is unaffected.
- On the first lap under a safety-car pit-lane procedure (e.g. Australia 2025, laps 2–4) OpenF1 records a pit-lane transit for every car; the event feed shows them all.
- Dependencies: the audit at the start of this work reported 20 advisories (3 critical), most in `next` 16.2.6. Next.js was upgraded to 16.4.6 and vitest to 5.1; `npm audit` now reports none. The whole suite was rerun after the upgrade — the results above are from that run.
