# FUNCTIONAL_REQUIREMENTS.md - Version 2.0

# ApexGP Markets: Actual Implemented Functional Requirements

---

# 1. Purpose & Scope

This document specifies the actual functional boundaries and operational criteria of the ApexGP Markets V2 platform. Visual correctness is a secondary requirement; the platform's core completeness is defined by its ability to perform robust state changes, compile telemetry timing inputs, recalculate probability trees, and enforce risk parameters.

---

# 2. Session Lifecycle Rules

* **Sandbox Balance Initialization**: Every new browser session begins with a Sandbox USD balance of exactly `$100,000` with no open positions and zero exposure.
* **Client-Only Persistence**: All trades, cash balances, historical standings, and ledger histories are managed exclusively in client-side state hooks.
* **Clean Session Termination**: Closing the browser tab or reloading the page purges all session states.
* **Desk Reset**: Enforcing a "Reset Season Session" action wipes all portfolio values, resets cash to `$100,000`, clears the transaction ledger, and returns the user to Round 01 (Australian GP) at Lap 0.

---

# 3. Core Functional Requirements

## FR-01: Race Selector Dropdown
* **Operation**: Users can select any of the 24 Grand Prix rounds from the official 2025 calendar.
* **State Behavior**: Switching races resets the active replay engine back to Lap 0 and clears all race-specific open positions. However, the global sandbox cash and the progressive championship standings points persist across rounds.

## FR-02: Telemetry Playback & Replay Engine
* **Controllers**: The player handles Play, Pause, and Reset commands.
* **Speed Selectors**: Supports multipliers of 0.5x, 1x, 2x, 4x, 10x, and `INST` (Instant Settlement).
* **Instant Settle (INST)**: Instantly fast-forwards timing data to the final lap, processing all intermediate incidents and executing options settlements.
* **Timeline Strip**: Maps key milestones (Race Start, Pit Stops, Safety Cars, DNFs, Settlement) with hovered tooltips. Clicking a milestone updates the timeline position.
* **Progress Bar**: Adjusts width continuously based on current lap percentage.

## FR-03: Bayesian Repricing Engine
* **Lap Recalculations**: Implied probabilities and mid-market prices recalculate dynamically lap-by-lap based on qualifying positions, sector splits, tire ages, and racing events:
  
  $$\text{Price}_{\text{mid}} = (1 - w) \cdot \text{Prior} + w \cdot \text{Outcome}$$
  
  Where $w = \left(\frac{\text{lap}}{\text{total\_laps}}\right)^{1.6}$ represents the exponential information convergence weight, and $P_{\text{outcome}}$ represents the deterministic final race outcome.
  
* **Automated Market Maker Spreads**: Generates synthetic bid/ask bounds around the mid price, maintaining a constant spread margin of $0.02$ bid discount and $0.02$ ask premium (constant $0.04$ total spread):
  
  $$\text{Bid} = \text{Price}_{\text{mid}} - 0.02, \quad \text{Ask} = \text{Price}_{\text{mid}} + 0.02$$
  
* **Compliment NO Pricing**: When a user selects a `LAY (NO)` contract, the options chain returns the mathematical complement of the `YES` contract:
  
  $$\text{Bid}_{\text{NO}} = \$1.00 - \text{Ask}_{\text{YES}}, \quad \text{Ask}_{\text{NO}} = \$1.00 - \text{Bid}_{\text{YES}}$$

## FR-04: Options Trading Engine
* **Directions**: Supports two-sided execution—`BACK (YES)` and `LAY (NO)`.
* **Actions**:
  * **BUY (Open Position)**: Purchases contracts, reducing cash by `Qty * Ask` and opening a derivative holding.
  * **SELL / EXIT (Liquidate Position)**: Sells held contracts at current Bid prices, increasing cash and updating realized PnL.
* **Cost Calculation**: Cost is computed instantly as:
  
  $$\text{Notional Cost} = \text{Quantity} \times \text{Execution Price}$$
  
* **Drawdowns**: If cash drops to zero, further purchases are blocked.

## FR-05: Risk Management Desk Safeguards
Every trade submission triggers programmatic validation before execution:
* **Exposure Limit**: The aggregate value of all open derivative positions must not exceed **30%** of total Net Asset Value (NAV). If a transaction breaches this, it is blocked with a "Exposure Violated" alert.
* **Concentration Limit**: Exposure in any single derivative contract asset (e.g. `PIA_WINNER`) must not exceed **15%** of total NAV. Breaches trigger "Single-Market Violated" blocks.
* **Circuit Breaker Halts**: Safety Cars or driver DNF retirements trigger a complete trading halt (circuit breaker) on affected options chains, blocking trading and displaying "HALTED" alerts for 2.5 to 3.5 seconds.

## FR-06: Portfolio Analytics Engine
* **Mark-to-Market (MTM)**: Re-evaluates assets value continuously during playback using current bid prices.
* **PnL Breakdown**: Tracks and logs:
* **Unrealized PnL**: The dynamic gain/loss on open contracts.
* **Realized PnL**: The locked gain/loss from exited positions.
* **Total PnL**: `Realized PnL + Unrealized PnL`.
* **Analytical Metrics**: Computes Drawdown %, Win Rate %, percentage return on capital, and **Sharpe Ratio** (calculated as the daily-equivalent Sharpe Ratio from the standard deviation of lap percentage returns and annualized by multiplying by $\sqrt{252}$).
* **Audit Ledger**: A structured table logging every transaction with timestamp, round, asset, side, size, execution price, settlement value, and final realized profit.

## FR-07: Progressive Championship State Machine
* **Progressive Points Ingestion**: Driver and constructor standings points aggregate dynamically in client memory as the user completes and settles Grand Prix rounds.
* **Abu Dhabi Season Settlement**: Settling Round 24 (Abu Dhabi GP) triggers final settlements for all Drivers and Constructors Championship futures. It evaluates the season standings, liquidating all championship contracts to `$1.00` or `$0.00`.

## FR-08: Institutional Season Report Card
Resolving the final GP round triggers a full-screen **Prop-Desk Season Report Card** overlay displaying:
* Total Net Return ($) & Capital Yield (%)
* Sharpe Ratio & Maximum Portfolio Drawdown (%)
* Win Hit Rate (%) across all transactions
* Best and Worst executed trades
* Most Profitable contract name

## FR-09: Guided Learning Tutorial Overlay
An educational workspace overlay offers three focused tabs to bridge domain knowledge gaps:
* **Beginner**: Teaches binary options concepts, spreads, and outlines a complete worked mathematical trade example (buying 100 contracts at $0.62 cost, yielding +$38.00 gain or -$62.00 risk).
* **Advanced**: Explains risk bounds constraints (15% single, 30% aggregate), championship futures, and F1 telemetry data sources.
* **Quant Notes**: Details options Greeks (Delta, Theta, Implied Volatility) and the Bayesian updating formula.

## FR-10: Analytical Commentary Wire Feed
Streams concise, institutional commentary logs (Bloomberg style) to the marquee bottom bar, detailing lap changes, Safety Car macro shocks, retirements, and options repricing effects.

---

# 4. Error Handling & Validation

* **Double Key Console Warning Safeguard**: To prevent DOM reconciliation conflicts, the incident log maps moments using a composite key: `key={`${m.lap}-${idx}`}`.
* **Halt Recoverability**: Restarting or resetting a race correctly restores options chains to active status and clears halt states.
* **Empty State Fallbacks**: If no positions are held, the portfolio rail displays a structured, clean standby message rather than a blank panel.

---

# 5. Acceptance Test Verification

Execute the following verification command to confirm total compilation success:
```bash
npm run build
```
The output must show a successful Turbopack build with zero type mismatches or build warnings.

---

**END FUNCTIONAL REQUIREMENTS**
