# Quantitative methodology

What the forecasting model, the simulated market and the accounting actually compute. Numbers quoted here are from `public/data/diagnostics.json`, written by `pipeline/build.py`; the Research page in the app reads the same file.

## 1. Contracts

A YES contract pays $1.00 if its event is true in the official classification, else $0. NO is the exact complement, so YES + NO = $1.00 at settlement, and a NO purchase at (100 − bid)¢ is economically a fully collateralised sale of YES at the bid.

| Kind | Pays if | Structure |
|---|---|---|
| `WIN` | classified first | exactly one per race |
| `POD` | classified top three | three per race |
| `PTS` | classified top ten | ten per race |
| `DNF` | no numeric finishing position (retired, disqualified, did not start) | independent |
| `H2H` | first-named driver ahead of team-mate in the official results order | one per two-car team; the car with the better grid slot is named first |
| `WDC`, `WCC` | leads the final official standings | one per season; settles after the last round |

Tick 1¢, prices 1–99¢. Race markets open on the grid, trade every lap, close at the chequered flag and settle once on the official classification — which includes post-race penalties, so a contract can close near 99¢ and settle at zero. Settlement source: Jolpica F1 mirror of the FIA classification. There is no fastest-lap market (no point is awarded for it in 2025, and v2's settled on the grid).

## 2. Forecasting model

### 2.1 Information set

The model sees a *frame* (`docs/DATA.md` §4): for each car, laps completed, running order, gap, stops made, laps down and a stopped flag — plus the grid and ratings computed from earlier rounds. It does not see the classification, later frames, tyres, track status or weather.

### 2.2 Ratings (walk-forward)

Exponentially weighted averages updated after each race and read before the next (`pipeline/apexgp/ratings.py`):

| Rating | Definition | Half-life |
|---|---|---|
| Driver form | finishing score 1 − (pos − 1)/(entrants − 1) over classified finishes | 8 races |
| Team form | mean finishing score of the team's classified cars | 5 races |
| Driver / team / field non-classification rate | share of starts not classified | 20 / 10 / 20 races |

Team form regresses 25% toward 0.5 at each new season. Rookies start at team form − 0.05; a new team at 0.30. Ratings follow a constructor's lineage through renames.

### 2.3 Finishing order: stage-wise rank-ordered logit

For car *i* at race progress *s* (share of distance completed), with stage group *g* ∈ {winner, places 2–3, places 4+}:

```
u_i(g) = Σ_f β_{f,g}(s) · x_{i,f}
P(car i takes the next place | cars still unplaced) = exp(u_i(g)) / Σ_j exp(u_j(g))
```

This is the rank-ordered ("exploded") logit of Beggs, Cardell & Hausman (1981) with stage-specific coefficients. Each β_{f,g}(s) is piecewise linear in *s* with knots at 0, 0.08, 0.25, 0.5, 0.75, 0.9, 1, plus a separate value for the grid frame. Fitted by penalised maximum likelihood (L-BFGS, ridge 1e-3, second-difference smoothness 2e-2) on the top ten finishing positions, conditional on the set of cars that are classified.

Features (`pipeline/apexgp/features.py`, mirrored in `src/engine/model/features.ts`):

| Feature | Definition |
|---|---|
| `lpos`, `pos` | log and level (÷10) of running order |
| `gapl` | gap to the leader, capped at 100 s, ÷30 |
| `lnpos`, `npos`, `ngap` | the same after charging 20 s per stop a car has made fewer than the lead-lap median ("net" order and gap) |
| `lead` | for the net leader, margin to the net second, capped at 30 s, ÷10 |
| `rate` | net gap ÷ (laps left + 1), capped at 5 s/lap |
| `pit` | stops made minus the median, clipped to ±2 |
| `down` | laps down, capped at 3 |
| `lgrid` | log of grid slot |
| `dform`, `tform` | driver and team form minus 0.5 |

Why stage-specific coefficients: a single set must explain both who wins and who is tenth, and compromises — the fitted scale is too flat for leaders. The plain model's expected calibration error for winners is 0.0161 against 0.0018 for the stage-wise model (walk-forward, pooled). That measured gain is the reason for the extra parameters.

### 2.4 Not classified: logistic hazard

```
P(car i is not classified | frame) = logistic(w · z_i)
z = [1, log(laps left / laps), grid-frame flag, laps down, newly a lap down, log position,
     driver rate − field rate, team rate − field rate, logit(field rate)]
```

A stopped car is assigned the empirical rate from training: 99.99% before 90% distance, 96.9% after.

### 2.5 Joint simulation

One simulated race: draw "not classified" independently per running car, then draw the order stage by stage among the survivors. The app uses 4,000 draws with random numbers fixed per race and reused at every frame (common random numbers), so an estimate changes only when inputs change. The winner probability uses the exact conditional softmax given each draw's survivor set rather than a count, which removes most of its Monte Carlo noise.

Every race contract is read off the same draws, so by construction: Σ P(win) = 1; P(win) ≤ P(podium) ≤ P(points); P(A ahead of B) + P(B ahead of A) = 1. If neither team-mate is classified the head-to-head is an antisymmetric coin flip (the model does not time retirements).

### 2.6 Titles

2,000 simulated remainders of the season per race, drawn once when the race loads from a ratings-only version of the order model (no grid: later qualifying sessions are unknown) plus a ratings-only hazard. Per frame, each simulated season = banked points + points from the race in progress (from §2.5's draws) + the simulated remainder; sprints pay 8…1 with no retirements. Ties break on wins. Constructors sum their entrants.

Inputs are the standings entering the race, the published calendar, today's entry list and pre-race ratings. Approximations: the grid stays as it is today; form does not update inside the simulated remainder; drivers no longer racing keep their points and score none.

## 3. Validation

### 3.1 Design

- **Walk-forward**: for each test season 2019–2024, refit on 2014 to the previous season, score the test season, pool.
- **Held-out season**: the shipped model (fitted 2014–2024: 226 races, 13,615 frames, 250,471 driver-frames) scored on 2025.
- **Baselines**: *uniform* over running cars; a *position-frequency table* (historical frequency of each outcome by running position and race phase, Laplace-smoothed) — the bar to clear; the *plain* rank-ordered logit (one coefficient set for all stages).
- **Metrics**: Brier score, log loss, expected calibration error (10 bins), reliability tables, by race phase. Scored on every running car at every frame.

### 3.2 Walk-forward, pooled (141,831 driver-frames)

| Market (base rate) | Stage-wise | Plain | Position table | Uniform |
|---|---|---|---|---|
| Winner (5.4%) — Brier | **0.02094** | 0.02214 | 0.02403 | 0.05106 |
| — log loss | **0.0730** | 0.0768 | 0.0855 | 0.2099 |
| — calibration error | **0.0018** | 0.0161 | 0.0042 | |
| Podium (16.2%) — Brier | **0.04809** | 0.04869 | 0.05222 | 0.13554 |
| Points (54.0%) — Brier | 0.09983 | **0.09959** | 0.11223 | 0.24613 |
| Not classified (5.7%) — Brier | 0.05163 | 0.05163 | 0.05244 | 0.05322 |

Winner Brier by fold (stage-wise / plain / table): 2019 0.0283 / 0.0264 / 0.0307 · 2020 0.0199 / 0.0207 / 0.0215 · 2021 0.0257 / 0.0260 / 0.0314 · 2022 0.0204 / 0.0224 / 0.0231 · 2023 0.0109 / 0.0137 / 0.0146 · 2024 0.0206 / 0.0233 / 0.0226. The stage-wise model beats the table in all six folds and the plain model in five; it loses to the plain model in 2019, the fold with the least training data.

### 3.3 Held-out 2025 (26,874 driver-frames, 24 races)

| Market | Stage-wise | Position table | Uniform | Reduction vs table |
|---|---|---|---|---|
| Winner | **0.01491** | 0.01977 | 0.05083 | 24.6% |
| Podium | **0.04433** | 0.04717 | 0.13506 | 6.0% |
| Points | **0.11153** | 0.11629 | 0.24693 | 4.1% |
| Not classified | **0.04750** | 0.04854 | 0.04898 | 2.1% |

Calibration error in 2025: winner 0.0128, podium 0.0234, points 0.0244, not classified 0.0079. Mid-range winner estimates were too low in 2025 (cars given 55% won 75% of the time): leaders converted more often than in 2014–2024. Frames within a race are strongly dependent, so the effective sample is nearer 24 than 26,874.

The app's TypeScript engine reproduces the 2025 winner Brier score within 3% using its own random numbers (`forecast.test.ts`), which ties the documented figures to the code that runs in the browser.

### 3.4 Titles (walk-forward, 2019–2024, pre-race estimates)

| Drivers' title, Brier | Season simulation | Leader takes all | Points share (v2's method) |
|---|---|---|---|
| First third of season | **0.0213** | 0.0375 | 0.0387 |
| Middle third | 0.0066 | **0.0024** | 0.0357 |
| Final third | 0.0058 | **0.0037** | 0.0354 |
| Whole season (2,539 driver-rounds) | **0.0116** | 0.0152 | 0.0367 |

The simulation is about three times better than the points-share heuristic. "Whoever leads wins" beats it from mid-season in this sample because all six mid-season leaders went on to win; six champions is too few to conclude more. Constructors: simulation 0.0328 vs points share 0.0609 on Brier, but marginally worse on log loss (0.210 vs 0.206).

### 3.5 What the validation does not show

That the model is "right": it is a calibrated summary of position, gaps, stops and form. It has no skill on retirements beyond a base rate, knows nothing about tyres or safety cars except through gaps, and has been tested on one held-out season.

## 4. Simulated market

### 4.1 Mechanism

One dealer per contract; the user is the only counterparty. Not a central limit order book, and not described as one.

```
σ²          = ½·v  +  ½·p(1−p)/L          v: EWMA (decay 0.7) of squared one-frame changes in p;  L: frames left
half-spread = 0.002 + 0.008·√(p(1−p)) + 0.36·σ·info(status)          capped at 0.12
reservation = p − 0.8·(inventory / top size)·half-spread               skew capped at ±3 half-spreads
best ask    = ⌈reservation + half-spread⌉,  best bid = ⌊reservation − half-spread⌋   (cents; ask − bid ≥ 1)
info        : grid 1.4, green 1.0, yellow 1.2, VSC 1.5, safety car 1.9
depth       : top size × (0.35 + 0.65·4p(1−p)) × state share (green 1, yellow 0.8, VSC 0.6, SC 0.5)
              × level multipliers 1, 1.4, 1.9, 2.5, 3.2 over five one-cent levels
top size    : WIN 1500, POD 1200, PTS 1000, DNF 500, H2H 900, WDC 2500, WCC 2000 contracts
```

**Why p(1−p)/L.** A price that is a martingale ending at 0 or 1 has exactly p(1−p) of variance left: E[Σ Δp²] = p(1−p). Spread evenly over the remaining frames this is the expected squared size of the next move — the quantity a dealer facing possibly-informed flow must charge for (the Glosten–Milgrom logic). The 0.36 is the share charged.

**Inventory.** Buying leaves the dealer short; the reservation price and both quotes shift against the next buyer. 25% of inventory is laid off each frame and 50% of consumed depth returns. Impact is temporary: the dealer does not update the *fair value* from order flow, deliberately — in a replay the user may know the result, and a learning dealer would simply be leaking it.

**States.** Red flag: quotes pulled. Chequered flag: closed. Fair value above 99.5% or below 0.5%: one-sided.

### 4.2 Execution

- **Market / marketable limit**: walks the ladder level by level; partial fill if depth is exhausted or the limit is reached.
- **Resting limit (good till close)**: filled only when the dealer's opposite quote reaches the limit, at the limit, up to the size shown at or through it; price-time priority among the account's own orders. A resting bid therefore fills when fair value has fallen to it — adverse selection, visible in the fill record (`fair` at fill vs price).
- **Fees**: taker ⌈0.07 · n · P(1−P)⌉ to the cent; maker a quarter of that.
- **Netting**: buying the opposite side first closes the existing position.

### 4.3 Calibration against real venues

`pipeline/reference/` holds fee schedules and one order-book snapshot (21 Nov 2026, 18:00–18:14 UTC, about ten hours before a race) of F1 markets on Kalshi and Polymarket: 887 markets, 234 with a two-sided quote.

| Mid | n | Measured median spread | Interquartile range | Simulated dealer, grid |
|---|---|---|---|---|
| 0–5¢ | 76 | 1¢ | 0.5–2.8¢ | 3¢ |
| 5–15¢ | 36 | 4¢ | 3–7¢ | 4¢ |
| 15–35¢ | 55 | 5¢ | 3.5–10.5¢ | 6¢ |
| 35–65¢ | 33 | 9¢ | 3–10¢ | 6¢ |
| 65–85¢ | 23 | 5¢ | 3.3–8¢ | 6¢ |
| 85–95¢ | 11 | 5¢ | 4–8¢ | 4¢ |

**Measured**: the Kalshi fee formula and maker rate; tick size; the level of spreads by price. `calibration.test.ts` requires the dealer's pre-race spread to sit within one tick of the interquartile range in every bucket. **Assumed**: depth (real books showed a median of 30–250 contracts at the best price; the dealer shows several times that so a $100,000 account can trade), inventory decay, replenishment, and the status multipliers. One weekend on two venues with different designs is a level check, not an estimate of dynamics, and those are 2026 real-money markets — never used as 2025 prices.

## 5. Accounting

Integer cents. A position is a signed YES quantity *q* (q < 0 is |q| NO contracts).

```
fill of Δq at price P with fee f:   cash −= Δq·P + f
settlement at payoff y ∈ {0,1}:     cash += q·100·y
free cash = cash − 100·Σ max(0, −q) − reserved for resting buys
NAV       = cash + Σ q·mark   =   start + realised + unrealised − fees
```

Cost basis is kept in own-side terms (YES price for q > 0, NO price for q < 0); reducing a position realises against average cost; crossing through zero splits the fill. Marks are the quote mid while a market is open and the model's estimate once it has closed. The NAV identity, bounded payoffs, idempotent settlement and YES/NO netting are property-tested (`ledger.test.ts`).

## 6. Risk

**Scenario distribution.** Open positions are revalued in each simulated race (and season, for titles): mean, standard deviation, 5th/50th/95th percentiles, expected shortfall at 5%, chance of a loss. Dependence between related contracts comes from the simulation itself, not from an assumed correlation.

**Exact worst case.** Within a mutually exclusive group (one winner, one champion) every possible winner plus "none" is enumerated; other contracts are taken at their individual worst case (conservative).

**Pre-trade limits**, evaluated on the post-trade book: free cash ≥ 0; a single contract may put at most 20% of NAV at risk; the worst case may not exceed 50% of NAV. Orders that reduce a position are always allowed.

## 7. Performance reporting

Reported: NAV by lap, drawdown, realised/unrealised P&L, fees; per-race P&L with count, mean, standard deviation, best/worst, and mean ÷ standard deviation only from five settled races and never annualised; hit rate, average win/loss, profit factor; average price paid vs frequency paid; execution costs (spread vs mid, impact vs best quote, fees, edge vs model); attribution by market type and race.

Not reported: annualised Sharpe ratios (v2 multiplied lap returns by √252) and option "Greeks" (v2's had no model behind them).

## 8. Session integrity

| Situation | Behaviour |
|---|---|
| Replaying a settled race | Not possible in a session. Read-only review instead. |
| Rewinding | No rewind; the clock is forward-only. |
| Switching race with open positions | A later round opens only after the current one settles. Skipping means running the clock to the flag, with resting orders evaluated every lap. |
| Jumping to title settlement | Titles settle only when the final round settles. |
| Reload | State restored from `localStorage`; forecasts recomputed deterministically; invalid state rejected. |
| Repeated settlement | No-op. |
| Reset with open trades | "New session" abandons the old book (nothing is liquidated at a made-up price) and archives a one-line summary. |
| Returning to an earlier race | Only by starting a new session. |

The user may still know the result. That is inherent in a replay and is stated in the app.
