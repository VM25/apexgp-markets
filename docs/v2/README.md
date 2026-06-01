# 🏎️ ApexGP Markets V2

<div align="center">

# Institutional F1 Event Markets and Portfolio Risk Simulation

### Real 2025 Season Replay • Bayesian Repricing • Portfolio Analytics • Microstructure Laboratory

*Formula One serves as an event-rich environment for replaying historical telemetry streams as live probability books, studying event-driven price discovery and portfolio risk constraints under high uncertainty.*

---

Build Exposure.

Replay History.

Observe Information Become Price.

</div>

---

## Overview

ApexGP Markets V2 is a high-fidelity quantitative event-market research platform. It converts the official 2025 Formula One World Championship season into a series of highly interactive, liquid probability chains backed by a **Synthetic Automated Market Maker (AMM)**.

Instead of traditional sports betting or static statistics dashboards, the platform behaves like an **institutional market operating terminal**. Every session begins with a virtual Sandbox USD balance of `$100,000` inside a closed trading book. Users select any of the 24 Grand Prix rounds, analyze starting grids, trade binary event options, and replay real-time race telemetry.

As physical events unfold on-track (pit stops, retirements, overtakes, or Safety Car macro shocks), the platform's **Bayesian Repricing Engine** dynamically updates contract mid-prices. The Synthetic AMM maintains a continuous, constant **$0.02** bid-ask margin around the mid-price (resulting in a constant **$0.04** total spread: $Bid = Mid - 0.02$, $Ask = Mid + 0.02$). Users must actively manage their portfolios, stress-test extreme drawdowns, and adhere to strict, institutional risk desk limits (30% total capital exposure and 15% single-contract concentration constraints enforced client-side at order submission). During Safety Car or retirement events, the platform triggers a **complete trading halt** (circuit breaker) that temporarily suspends order entry.

No real money is used. The platform functions as an academic sandbox for quantitative researchers, financial engineers, and market architects to study the intersection of physical systems telemetry and derivative contract microstructure.

---

## Core Technical Thesis

Financial markets evolve continuously as new information is disseminated and processed. Competitive physical systems—such as Formula One races—progress through a highly parallel, high-frequency stream of structured information. 

Each race lap, sector split, pit stop, or mechanical failure represents an information shock that reshapes the probability distribution of future outcomes. ApexGP Markets maps these physical events directly to financial market equivalents:

| Formula One Telemetry Event | Market Microstructure Analog |
| :--- | :--- |
| **Lap Completion / Sector Splits** | Tick-by-Tick Price Updates |
| **Pit Stop / Compound Changes** | Earnings Surprise & Short-Term Liquidity Shift |
| **Safety Car / Virtual Safety Car** | Macro Systematic Shock & Liquidity Halt |
| **Driver Retirement (DNF)** | Default / Credit Event |
| **Weather & Track Temp Swings** | Market Volatility Regime Shift |
| **Championship Standings Progression** | Long-Term Futures Contract Re-valuation |
| **Sandbox Portfolio Ledger** | Proprietary Quantitative Trading Book |
| **Contract Implied Probability** | Dynamic Mid-Market Derivative Price |

---

## Platform Navigation Structure

The terminal workspace utilizes a professional, streamlined navigation schema to ensure first-time recruiters, technical reviewers, and quantitative finance professionals can navigate the terminal immediately without explanation:

1. **Race Markets**: The core derivative options chain tab. Displays six contract categories (Race Winner, Podium Finish, Fastest Lap, Head-to-Head, Safety Car, DNF) with continuous bid/ask quotes backed by a Synthetic AMM, dynamic implied probabilities, and detailed position bounds.
2. **Race Replay**: The dynamic control center. Houses the sequential telemetry timeline, playback speed selectors (0.5x, 1x, 2x, 4x, 10x, and INST for instant settlement), active leaderboards, and the Repricing Moments log.
3. **Portfolio**: The trading ledger. Provides complete mark-to-market holdings valuation, realized/unrealized PnL, drawdowns, capital returns, Sharpe Ratio (calculated using standard deviation of lap returns and annualized via $\sqrt{252}$), and an open trade audit ledger mapping every transaction.
4. **Season Futures**: The long-horizon derivative suite. Allows users to trade Drivers and Constructors championship futures contracts with symmetrical Back/Lay side selections and a minimum pricing floor of $0.04 to prevent invalid zero-bid scenarios.
5. **Championship**: The global standings center. Dynamically tracks driver and constructor points progressively as races are completed across the 24 Grand Prix.
6. **Research Lab**: The academic foundation of the project. Presented as a quantitative trading desk memo, detailing the platform's mathematical formulations, Bayesian updating logic, Black-Scholes style telemetry decay, and design choices.

---

## Quantitative & Probability Engines

### 1. Bayesian Repricing Engine
Contract pricing follows a continuous probability model combining historical priors, real-time track positions, and dynamic updates:

$$P(\theta | \text{Telemetry}) = (1 - w) \cdot P_{\text{prior}} + w \cdot P_{\text{outcome}}$$

Where $w = \left(\frac{\text{lap}}{\text{total\_laps}}\right)^{1.6}$ represents the exponential information convergence weight, and $P_{\text{outcome}}$ represents the deterministic final race outcome. As telemetry events occur, the weight ($w$) shifts, causing implied probability curves to adjust, and driving real-time bid/ask repricing ($Mid \pm 0.02$) through the Synthetic AMM.

### 2. Symmetrical Option Chains
Every contract supports two-sided trading:
* **BACK (YES)**: Buying exposure that the outcome *will* occur (executed at the Ask price).
* **LAY (NO)**: Buying exposure that the outcome *will not* occur (executed at the complement: $\$1.00 - \text{YES Price}$).

### 3. Absolute Binary Settlement
Upon checkered flag completion, all open positions undergo deterministic settlement:
* **Successful Outcomes**: Settle at exactly **$1.00** per contract, credited as cash to the sandbox ledger.
* **Unsuccessful Outcomes**: Settle at exactly **$0.00** per contract.

### 4. Option Greeks Analytic Proxies
Rather than solving continuous partial differential equations (PDEs) like standard Black-Scholes models, the platform computes highly elegant **analytical proxies** client-side to represent binary option contract sensitivities:
* **Delta ($\Delta$)**: Price sensitivity to state change, peaking at 50% probability where uncertainty is maximum: $\Delta = Mid \cdot (1 - Mid) \cdot \lambda$.
* **Theta ($\Theta$)**: Telemetry-adjusted time decay of uncertainty per lap completed, converging to boundary states as laps remaining approaches zero.
* **Implied Volatility (IV)**: A synthetic uncertainty index combining weather risk, Safety Car events, and time-to-settlement: $IV = 0.18 + \frac{\text{RainProb}}{200} + (\text{SafetyCarActive} ? 0.30 : 0) + \left(1.0 - \frac{\text{lap}}{\text{total\_laps}}\right) \cdot 0.25$.

---

## Risk Management Framework

The platform enforces strict institutional risk constraints in the frontend, programmatically checked and blocked at order submission:
* **Max Capital Exposure Limit**: Total mark-to-market value of all open derivative positions cannot exceed **30%** of total Net Asset Value (NAV).
* **Single-Contract Concentration Limit**: Exposure in any single contract asset cannot exceed **15%** of overall NAV.
* **Capital Liquidity Check**: Sandbox cash balance checks to prevent purchases exceeding available cash.
* **Circuit Breaker Halts**: Trading is programmatically halted on affected options chains during Safety Car periods or retirements, locking order entries for 2.5 to 3.5 seconds to simulate real-world exchange safeguards.

---

## Technology Stack

* **Frontend Framework**: Next.js 16.2.6 (App Router, Turbopack)
* **Core Logic**: React, Client-side State Hooks, Contextual Architecture
* **Language**: TypeScript 5.x (Strict typing enabled)
* **Styling**: Vanilla CSS, Tailwind CSS Utility Layer
* **Data Visualizations**: Recharts (High-performance dynamic SVG charts)
* **Data Preprocessing**: Python 3.10+, FastF1 API, Pandas, NumPy
* **Hosting / Deployment**: Vercel

---

## Developer and Academic Attribution

ApexGP Markets V2 is designed and built by **Vatsal Maniar** as a professional portfolio project demonstrating advanced concepts in quantitative event market design, risk engineering, and physical telemetry translation.

* **Author**: Vatsal Maniar
* **Degree**: M.S. Financial Engineering (MSFE)
* **Institution**: Stevens Institute of Technology

---

<div align="center">

### Information propagates.

### Price adjusts.

### Portfolio outcomes settle.

</div>
