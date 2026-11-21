# PROJECT_SPEC.md

# ApexGP Markets

## Historical Event Markets and Portfolio Simulation for Formula One

---

# 1. Project Vision

Build a premium quantitative event-market platform that transforms historical Formula One races into replayable probability markets and portfolio simulations.

This project is NOT a sportsbook.

This project is NOT fantasy sports.

This project is NOT a Formula One statistics dashboard.

This project is NOT a prediction website.

This project is a historical market simulation environment designed to demonstrate how information becomes price, how price becomes exposure, and how exposure becomes portfolio performance.

Users should leave believing:

> This person understands probability markets, trading workflows, portfolio risk, and market microstructure under uncertainty.

---

# 2. Target Audience

Primary:

* Quant recruiters
* Quant traders
* Risk managers

Secondary:

* Financial engineers
* Technical builders
* Quant research reviewers

Not targeted:

* Retail sports bettors
* Casual Formula One fans
* Gambling users
* General entertainment audiences

---

# 3. Core Product Concept

Users receive a session-only portfolio with a fixed starting bankroll of:

```text
$100,000
```

They select a historical Formula One race from the 2025 season.

Before and during replay, users trade event contracts linked to race outcomes.

The historical outcome is hidden until the replay reaches settlement.

As race events occur, the platform updates:

* probabilities
* bid/mid/ask prices
* portfolio value
* realized and unrealized PnL
* exposure
* drawdown
* market commentary

The experience should feel like:

```text
Prediction Market
+
Bloomberg Terminal
+
Formula One Broadcast
+
Portfolio Risk Simulator
```

---

# 4. Data Requirement

The builder must use a zero-cost historical data pipeline.

The project owner does NOT need to:

* buy data
* download data manually
* create an API account
* get an API key
* pay for a subscription
* maintain a database

The builder must handle data collection locally through code.

Recommended sources:

* FastF1 Python package
* OpenF1 historical API

Historical data is enough.

No live race data is required.

No real-time market data is required.

No sportsbook odds are required.

---

# 5. Data Architecture

V1 must use static preprocessed JSON files.

The frontend should NOT call external APIs during normal user interaction.

Required flow:

```text
FastF1 / OpenF1

↓

Local Python Export Scripts

↓

Cleaned Race JSON

↓

public/data/

↓

Next.js Frontend
```

Expected folder structure:

```text
public/
  data/
    season_2025.json
    races/
      australia.json
      china.json
      japan.json
      bahrain.json
      saudi_arabia.json
      miami.json
      imola.json
      monaco.json
      spain.json
      canada.json
      austria.json
      great_britain.json
      belgium.json
      hungary.json
      netherlands.json
      italy.json
      azerbaijan.json
      singapore.json
      united_states.json
      mexico_city.json
      sao_paulo.json
      las_vegas.json
      qatar.json
      abu_dhabi.json
```

The builder may adjust race filenames if needed, but the structure must remain clean and readable.

---

# 6. Required Race Data Fields

Each race file should contain enough information to power replay and market updates.

Minimum required fields:

```text
race_id
race_name
round_number
circuit
country
date
laps
drivers
constructors
starting_grid
final_result
events
positions_by_lap
pit_stops
race_control_messages
weather
retirements
penalties
```

If some data is unavailable, the builder must create a reasonable fallback.

Example:

* if penalty data is incomplete, use race control messages
* if weather data is sparse, use session-level weather
* if exact event timestamps are unavailable, use lap-level event timing

---

# 7. Data Leakage Rule

Historical outcomes must not be visible to the user before settlement.

The app may internally use final results to settle contracts, but the UI must not reveal:

* winner
* podium
* fastest lap
* DNF outcome
* championship winner

until the replay reaches the correct settlement point.

This is critical.

The project should feel like replaying history without knowing the answer.

---

# 8. Market Types

V1 should support the following contract categories.

## Race Markets

* Race Winner
* Podium Finish
* Fastest Lap
* Safety Car
* Driver Head-to-Head
* DNF / Retirement

## Championship Futures

* Drivers Champion
* Constructors Champion
* Total Wins

Championship futures should be available before any race begins.

---

# 9. Contract Model

Users trade contracts, not bets.

Use trading language.

Preferred terminology:

* contract
* market
* bid
* ask
* position
* exposure
* portfolio
* settlement

Avoid:

* bet slip
* wager
* casino
* odds boost
* gambling
* sportsbook

Settlement:

```text
Correct outcome → contract settles at 1.00

Incorrect outcome → contract settles at 0.00
```

Example trade ticket:

```text
BUY 20 contracts

Market:
Race Winner

Driver:
Oscar Piastri

Entry:
0.62

Notional:
$1,240
```

---

# 10. Trading Rules

Users may:

* buy contracts
* sell held contracts
* close positions

Users may NOT:

* use leverage
* short contracts they do not own
* trade with margin
* carry portfolio state after the session closes

Risk constraints:

```text
Maximum total exposure:
30% of portfolio value

Maximum single-market exposure:
15% of portfolio value

Cash balance:
must remain >= 0
```

If portfolio value approaches zero, the system should prevent further trading or auto-liquidate open positions.

---

# 11. Pricing Engine

V1 pricing should be hybrid and explainable.

Use:

```text
Historical Prior
+
Race State Adjustment
+
Bayesian-Style Update
+
Simple Predictive Layer
```

The model does NOT need to be perfect.

It needs to be internally consistent, explainable, and visually convincing.

Each market should display:

* bid
* mid
* ask
* implied probability
* price change
* explanation

Example:

```text
Model Probability:
0.64

Displayed Market:
0.62 / 0.66
```

The spread can be synthetic.

No live sportsbook odds required.

No external market data required.

---

# 12. Replay Engine

Replay should advance through historical race events.

Replay speeds:

* 0.5x
* 1x
* 2x
* 4x
* 10x
* Instant

Market updates should occur after meaningful events.

Examples:

* lap completed
* pit stop
* safety car
* penalty
* retirement
* position change
* weather change

The replay should prioritize event-driven updates over raw real-time accuracy.

---

# 13. Market Halt Logic

Markets should temporarily halt when major information arrives.

Examples:

* Safety Car
* DNF
* Race completion
* major penalty

During a halt:

* user cannot trade affected contracts
* UI displays market halt
* prices update after halt

This makes the simulation feel like a real market.

---

# 14. Portfolio Engine

Portfolio starts at:

```text
$100,000
```

Portfolio is session-only.

No authentication.

No database.

No save/load.

Close tab = reset.

Track:

* cash
* open positions
* realized PnL
* unrealized PnL
* total portfolio value
* exposure
* drawdown
* return %
* hit rate
* Sharpe ratio
* position attribution

All portfolio calculations can run in the frontend.

---

# 15. Commentary Engine

Every major price movement should explain itself.

Example:

```text
LAP 41

Piastri Win

0.71 → 0.82

Drivers:

+ fastest sector
+ track position
- tire degradation

Portfolio Impact:

+$2,180
```

Commentary should feel like market explanation, not sports commentary.

Tone:

* concise
* analytical
* institutional

---

# 16. Website Architecture

Pages/sections:

```text
Landing
Overview
Market
Replay
Portfolio
Championship
Research
Project Context
```

V1 may be a single-page application with sections rather than traditional routes.

---

# 17. Frontend Requirements

Technology:

* Next.js
* React
* TypeScript
* Tailwind CSS

Visualization:

* Recharts
* Plotly only if needed

Animation:

* Framer Motion
* subtle transitions only

State:

* browser session state
* no backend state
* no database

Hosting:

* Vercel free tier

---

# 18. Backend Requirements

V1 should not require a backend server.

Acceptable backend-like components:

* local Python scripts
* preprocessing scripts
* static JSON exports

Do NOT build:

* FastAPI server
* database
* authentication system
* user accounts
* payment system
* live API proxy

unless absolutely necessary.

---

# 19. Visual Identity

Design should feel like:

45% Bloomberg Terminal
35% Formula One Broadcast
20% Quant Research Lab

Avoid:

* sportsbook UI
* gambling design
* neon crypto dashboards
* overly playful racing graphics
* fake Bloomberg clone

The frontend must look institutional, market-oriented, and premium.

---

# 20. Required Deliverables

Builder must produce:

* working website
* responsive frontend
* race replay interface
* market contract interface
* portfolio interface
* championship futures interface
* research/analytics section
* local data export scripts
* preprocessed JSON files
* README.md
* clear folder structure
* deployed version if possible

---

# 21. Non-Goals

Do not build live trading.

Do not connect to sportsbooks.

Do not use real money.

Do not require user login.

Do not store user portfolios.

Do not build a full exchange matching engine.

Do not build a complete F1 analytics platform.

Do not overfit complex models.

Do not make this look like gambling.

---

# 22. Success Criteria

The project succeeds if a reviewer says:

> This feels like a market simulation built by someone who understands trading, risk, and probability.

The project fails if a reviewer says:

> This is a sports betting app with finance labels.

---

END SPEC
