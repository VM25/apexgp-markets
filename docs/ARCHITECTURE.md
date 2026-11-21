# Architecture

## Shape

ApexGP Markets is a static web application plus an offline data pipeline. Nothing runs on a server at request time.

```
            offline (Python)                               browser (TypeScript)
┌──────────────────────────────────────┐       ┌───────────────────────────────────────────────┐
│ sources ─► as-of frames ─► features  │       │  state/data.ts      fetch static JSON once      │
│    │            │             │      │ JSON  │        │                                       │
│    │         ratings      model fit  ├──────►│  engine/session/lens.ts    forecasts, fair      │
│    │            │             │      │       │        │                   values, base quotes  │
│    └── cross-source checks ── export │       │  engine/session/session.ts clock, orders,       │
│              diagnostics             │       │        │                   ledger, settlement   │
└──────────────────────────────────────┘       │  state/store.ts     playback, persistence       │
                                               │        │                                       │
                                               │  features/*  charts/*  ui/*   (React)           │
                                               └───────────────────────────────────────────────┘
```

## Layers and their rules

| Layer | Path | Rule |
|---|---|---|
| Data ingestion and validation | `pipeline/apexgp/sources`, `replay.py` | The only code that talks to the network. Disk-cached. |
| Feature construction | `pipeline/apexgp/timing.py`, `features.py`; `src/engine/model/features.ts` | Pure functions of one frame. The Python and TypeScript versions are pinned together by golden vectors. |
| Model inference | `src/engine/model/forecast.ts`, `title.ts` | Pure; seeded; reads `frames[n]` and `frames[n−1]` only. |
| Market quotation and execution | `src/engine/market/` | Pure functions of (fair value, book, context). All tunables in `params.ts`, each marked measured / calibrated / assumed. |
| Accounting and risk | `src/engine/portfolio/` | Pure; integer cents; immutable updates. |
| Session and sequencing | `src/engine/session/` | The only stateful engine code. `SessionState` is plain JSON. |
| Persistence and playback | `src/state/store.ts` | Owns timers, `localStorage`, async loading. No business rules. |
| Interface | `src/features`, `src/charts`, `src/ui` | Reads the store, calls its actions. No pricing or accounting logic. |
| Tests | `src/engine/__tests__`, `pipeline/tests`, `tests/e2e` | See `docs/TESTING.md`. |

`src/engine/` imports nothing from React, Next.js or the DOM and runs unchanged under Node — which is how its 89 tests run.

## The two session objects

**`RaceLens`** (`session/lens.ts`) holds one race's observations and everything derivable from them without an account: the contract list, per-frame forecasts and fair values, realised-variance state, and the dealer's *baseline* quote (zero inventory). Frames are computed in order and cached; frame *n* is a function of frames ≤ *n*. Both the trading session and the read-only review use it.

**`TradingSession`** (`session/session.ts`) adds the account: a `SessionState` (clock, ledger, dealer inventory for contracts the account has traded, resting orders, fills, settlements, audit log, NAV history) and the operations on it — `preview`, `place`, `cancel`, `advance`, `settleRace`, `openRound`. Its invariants are listed at the top of the file and enforced in code:

1. the clock only moves forward;
2. orders execute at the clock's frame;
3. race contracts close at the flag and settle once (idempotent);
4. a later round opens only after the current one settles;
5. title contracts carry across rounds;
6. state round-trips through JSON.

Because fair values and the market-wide part of each quote are deterministic functions of the data, only the account-specific parts are persisted. On reload the lens recomputes forecasts up to the saved frame (in small slices, so the page stays responsive) and the restored session produces identical quotes and NAV — tested in `session.test.ts` and end to end.

## State management

A single framework-free store (`state/store.ts`) with a version counter; React subscribes through `useSyncExternalStore` (`state/hooks.ts`). The engine objects are mutable and long-lived; the store bumps the version after each action. There is no global state library.

Persistence: the session's JSON is written to `localStorage` (`apexgp.v3.session`) 250 ms after any change and on `pagehide`. Restored state passes `isValidState` (version and shape) or is discarded. Closing a session with fills archives a one-line summary (`apexgp.v3.archive`, last eight).

## Data loading and performance

- Each view loads only what it needs: the season index and model at boot (~40 kB), one race file (45–70 kB) per round, a settlement file only at settlement or review, a circuit trace only on the race view, diagnostics only on Research.
- A frame's forecast (4,000 joint draws, 2,000 season draws, ~130 fair values) takes a few milliseconds; nothing is computed ahead of the clock.
- Charts are hand-written SVG (`src/charts`), sized by `ResizeObserver`; there is no charting dependency.
- Runtime dependencies: `next`, `react`, `react-dom`. Icons are inline SVG.

## Deployment

`next.config.ts` sets `output: "export"`: `npm run build` writes plain HTML, JS, CSS and JSON to `./out` (about 4 MB including data). `netlify.toml` publishes that directory with long-lived caching for hashed assets. No functions, no environment variables, no build-time secrets, no paid services. Fonts (Archivo, IBM Plex Mono, Newsreader; SIL Open Font Licence) are fetched and self-hosted at build time by `next/font`.

The production site deploys from `main`. The rebuild is on `overhaul/v3`; merging it is the deployment step (see `docs/REPORT.md`).

## Adding things

- **A season**: add it to `config.REPLAY_SEASONS`, run `fetch.py`, `build.py export`, `circuits.py`. An unfinished season needs one session rule (titles stay open).
- **A contract type**: add the kind, its fair value, scenario payoff and settlement rule in `engine/market/contracts.ts`, and a `TOP_SIZE` entry.
- **A different dealer**: `quote()` is a pure function; the session calls nothing else to price.
