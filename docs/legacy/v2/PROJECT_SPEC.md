# PROJECT_SPEC.md - Version 2.0

# ApexGP Markets: Actual Implemented Technical Specification

---

# 1. Project Vision

ApexGP Markets V2 is a high-performance quantitative event-market simulation and portfolio risk terminal that models dynamic binary derivative event contracts. The platform replays the complete, official 2025 Formula One World Championship season, transforming real-time physical timing streams and racing incidents into structured, liquid options chains.

### Explicit Anti-Goals:
* **This project is NOT a sportsbook.** It contains no wagering, no betting slips, and no odds boosts.
* **This project is NOT fantasy sports.** There are no draft boards or gamified badges.
* **This project is NOT a standard statistical dashboard.** It does not simply display historical data tables.
* **This project is NOT a prediction site.** It studies market behavior *under* uncertainty, rather than predicting specific outcomes.

The platform is designed to visually and mathematically demonstrate how raw timing information dynamically propagates into market prices, how pricing fluctuations create mark-to-market exposure, and how exposure dictates overall portfolio outcomes under strict risk parameters.

---

# 2. Target Audience

The platform is built to satisfy the rigorous requirements of institutional reviewers and technical recruiters:
* **Quantitative Recruiters & Researchers**: Assessing proficiency in financial engineering, dynamic probability pricing, and robust software architectures.
* **Risk Managers**: Evaluating the integration of strict exposure limits, concentration bounds, and automated market halt safeguards.
* **Financial Engineers**: Reviewing implementation details regarding Bayesian belief updates, options spread mechanics, and portfolio attribution.

It is deliberately optimized to exclude recreational sports bettors or casual audiences, framing all copy and interactions with institutional-grade trading terminology.

---

# 3. Core Product Concept

Every user session begins with a blank proprietary trading book and a virtual Sandbox USD balance of:

```text
$100,000
```

Users enter the terminal via an academic landing page, select any of the 24 historical Grand Prix rounds, analyze starting grids, trade binary event options, and launch the replay engine. 

As the race progresses, the platform processes lap telemetry and race control incidents, dynamically recalculating contract mid-prices. The Synthetic Automated Market Maker (AMM) maintains continuous bid/ask bounds around the mid-price using a constant $0.02 bid discount and $0.02 ask premium (constant $0.04 spread: $Bid = Mid - 0.02$, $Ask = Mid + 0.02$). All positions are evaluated on a continuous **Mark-to-Market (MTM)** basis using active bid valuations. Upon checkered flag resolution, the platform executes absolute binary settlements, updates long-term standings, and evaluates overall trading book statistics (Sharpe Ratio annualized by $\sqrt{252}$, Drawdown %, and Win Hit Rate %).

The terminal integrates four functional themes:
```text
  Prediction Market Architecture (Polymarket style)
+ Institutional Quantitative Terminal (Bloomberg style)
+ Physical Telemetry Stream (Official F1 timing style)
+ Portfolio Risk Simulator (Capital risk desk style)
```

---

# 4. Data Pipeline & Ingestion Ingestion

To keep the application highly reliable, responsive, and completely zero-cost to maintain, the platform utilizes a preprocessed local file-based data pipeline. No external network requests are executed during gameplay:

1. **Extraction**: A Python data extraction suite uses the `FastF1` package and `OpenF1` API.
2. **Aggregation**: Scripts parse official session grids, lap charts, sector split times, compounds, race control flags, retirements, and weather streams.
3. **Structuring**: Cleaned data is saved as structured, highly compressed JSON documents within the public directory.
4. **Ingestion**: The client-side React hooks fetch the race files instantly upon dropdown selection.

### Directory Structure:
```text
public/
  data/
    season_2025.json       # General calendar, round schedules, and points priors
    races/
      bahrain.json         # Round 01 telemetry, events, starting grids, and weather
      saudi_arabia.json    # Round 02 telemetry
      ...
      abu_dhabi.json       # Round 24 final telemetry and Abu Dhabi GP final data
```

---

# 5. Ingested Data Fields

Each JSON file contains complete, validated telemetry structures:
* `race_id` / `race_name` / `round_number` / `circuit` / `country` / `date`
* `laps_total`: Total lap count (e.g. 58 for Melbourne)
* `starting_grid`: Driver codes, grid position, tire compounds, and opening priors
* `drivers` & `constructors`: Full rosters and active team associations
* `weather`: Dynamic track and air temperature streams (with Celsius & Fahrenheit scales)
* `laps`: Array of lap state documents containing driver positions, lap times, pit stops, and safety car status
* `events`: Array of physical occurrences (overtakes, pit entries, VSC/SC flags, DNF retirements)
* `final_result`: Official FIA final classification, fastest lap scores, and points allocation

---

# 6. Data Leakage Safeguards

To preserve the realism of historical replaying, **strict data leakage safeguards are enforced**:
* **State Encapsulation**: The client application loads the race data but locks all future lap structures inside a private state.
* **Telemetry Curtain**: The UI restricts access to position charts, timeline nodes, commentary logs, and final results until the replay engine physically advances to the corresponding lap.
* **Deterministic Settlement**: Final classifications are kept hidden until the checkers flag drops, ensuring that options pricing mirrors actual live uncertainty.

---

# 7. Derivative Contract Categories

The platform supports two major contract groupings, separating active short-term trades from long-term exposures.

## A. Race Markets (Active Tab)
* **Race Winner**: Settle to $1.00 on the P1 driver; all others settle to $0.00.
* **Podium Finish**: Settle to $1.00 on drivers finishing P1, P2, or P3.
* **Fastest Lap**: Settle to $1.00 on the driver holding the fastest lap score.
* **Safety Car**: Settle to $1.00 if a Safety Car or VSC is deployed; else $0.00.
* **Head-to-Head**: Matchups comparing two drivers (e.g., NOR vs VER).
* **Retirement (DNF)**: Settle to $1.00 on drivers who fail to finish the session.

## B. Season Futures (Long-Term Tab)
* **Drivers Championship**: Back/Lay contracts on the overall drivers world title.
* **Constructors Championship**: Back/Lay contracts on the constructors world title.

Season contracts remain active across rounds and undergo final, absolute settlement when the user completes Round 24 (Abu Dhabi GP) based on compiled points standings.

---

# 8. Symmetrical Contract Model

Every contract is modeled as a symmetrical two-sided binary option:
* **YES (BACK)**: Purchase contracts backing the event to occur (bought at the Ask price).
* **NO (LAY)**: Purchase contracts backing the event to fail (bought at the complement price: $\$1.00 - \text{YES Price}$).

### Symmetrical Compliment Pricing Mechanics:
A "NO" or "LAY" contract is priced dynamically as the exact complement of the best market bid/ask:

$$\text{Bid}_{\text{NO}} = \$1.00 - \text{Ask}_{\text{YES}}, \quad \text{Ask}_{\text{NO}} = \$1.00 - \text{Bid}_{\text{YES}}$$

All open positions settle cleanly to **$1.00** (Success) or **$0.00** (Failure).

---

# 9. Institutional Risk Constraints

Programmatic risk management safeguards are executed client-side on every trade transaction:

```text
Net Asset Value (NAV) = Cash Sandbox Balance + Dynamic Assets Value
```

### Risk Desk Boundaries:
1. **Total Exposure Limit**: The total mark-to-market value of all open derivative assets must not exceed **30%** of total NAV.
2. **Single-Contract Concentration Limit**: Exposure in any single derivative contract asset (e.g. `LEC_WINNER`) must not exceed **15%** of total NAV.
3. **Liquidity Safeguard**: Purchases are rejected if the notional cost exceeds available cash.
4. **Circuit Breaker Trading Halts**: Triggering a Safety Car or driver DNF retirement automatically suspends trading on affected options chains, showing highlighted "HALTED" alerts and blocking all order submissions for 2.5 to 3.5 seconds to simulate real-world exchange safeguards.

---

# 10. Replay and Pricing Engine

* **Adaptive Speed Control**: Supports playback speeds of 0.5x, 1x, 2x, 4x, 10x, and `INST` (Instant Settlement).
* **Bayesian Repricing Engine**: The pricing engine updates contract mid-prices dynamically lap-by-lap, using prior points distributions, qualifying positions, sector pacing, and telemetry events:
  
  $$\text{Mid Price} = (1 - w) \cdot \text{Prior} + w \cdot \text{Outcome}$$
  
  Where $w = \left(\frac{\text{lap}}{\text{total\_laps}}\right)^{1.6}$ decay uncertainty exponentially. The Synthetic AMM enforces a constant $0.02$ bid-ask spread around the mid price ($Mid \pm 0.02$). Option Greeks are calculated as analytical proxies (Delta Δ, Theta Θ, Implied Volatility IV index) for binary options sensitivities, rather than continuous PDE solvers.

---

# 11. Portfolio & Commentary Modules

* **Mark-to-Market Valuation**: Re-evaluates assets value continuously on live bid pricing during replay.
* **Attribution & Analytics**: Displays overall Net Return (%), Sharpe Ratio, Drawdown (%), and Win Hit Rate (%).
* **Attribution Ledger**: Houses a table logging every completed trade, including contract type, side (Back/Lay), entry cost, settlement value, and realized PnL.
* **Analytical Wire Feed**: Generates concise, institutional-grade wire comments (Bloomberg style) explaining why prices moved and detailing their quantitative impacts.

---

# 12. Tech Stack

* **Frontend**: Next.js 16.2.6 (App Router, Turbopack enabled)
* **Language**: TypeScript 5.x (Strict compilation)
* **Styling**: Vanilla CSS with custom theme variables
* **Charts**: Recharts SVG engine
* **Data Processing**: Python 3.10+, FastF1 API, Pandas, NumPy

---

# 13. Project Success Criteria

The terminal is considered successful if a professional quantitative reviewer concludes:
> "This platform is a highly polished, type-safe demonstration of market microstructure, Bayesian repricing models, and risk management limits. It translates physical timing telemetry into a realistic financial terminal, avoiding gamification or sportsbook clichés."

---

# 14. Acceptance Test

To verify complete systems integrity, run:
```bash
npm run build
```
The project must compile successfully under Turbopack with zero warnings, validating all types, components, and layout files.

---

**END TECHNICAL SPECIFICATION**
