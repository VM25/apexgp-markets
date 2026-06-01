# INFORMATION_ARCHITECTURE.md - Version 2.0

# ApexGP Markets: Actual Implemented Information Architecture

---

# 1. Experience Philosophy

ApexGP Markets V2 is structured to operate like a **high-density market operating terminal**. It rejects traditional long-scroll marketing templates, cryptocurrency dashboard neon trends, and sports betting coupon lists.

### Architectural Directives:
* **Bloomberg-on-Glass Aesthetic**: Content is laid out in compact, nested grid panes.
* **Information Density**: Maximum screen space is dedicated to timing telemetry, price tickers, and risk indicators.
* **Single-Page Application Shell**: State persists in the client memory. Navigating tabs switches the central workspace panel without triggering browser reloads or layout shifts.
* **Context-Aware Visual States**: The terminal background and panels adjust dynamically based on race events (yellow glowing hues during Safety Cars, gold accents upon settlement, red flashing borders during trading halts, and crimson highlights when in deep capital drawdowns).

---

# 2. Global Application Shell Layout

Once a user transitions from the landing portal, they enter the persistent terminal shell. The layout is optimized to display complex data grids and risk stats in a structured interface:

```text
+------------------------------------------------------------------------------------+
|                                    1. TOP HEADER                                   |
| APEXGP // INSTITUTIONAL DESK | [ROUND Selector] | [Playback Cont] | [NAV / PnL]    |
+------------------------------------------------------------------------------------+
|                                2. PROGRESS STRIP                                   |
+--------------------------+----------------------------------+----------------------+
|                          |                                  |                      |
|                          |                                  |                      |
|                          |                                  |  5. RIGHT SIDEBAR    |
|   3. LEFT SIDEBAR        |     4. CENTER PRIMARY WORKSPACE  |  Portfolio Holdings  |
|   Timing & Telemetry     |     (Race Markets / Replay /     |                      |
|   Context Panel          |      Portfolio / Futures /       |  ⚡ Race Contracts   |
|                          |      Championship / Research)    |  🏆 Season Futures   |
|                          |                                  |                      |
|                          |                                  |                      |
+--------------------------+----------------------------------+----------------------+
|                                6. BOTTOM WIRE marquee                              |
+------------------------------------------------------------------------------------+
```

### persistent shell components:
1. **Top Header**: Hosts branding, Grand Prix selector dropdown, playback controller (Play/Pause, speed multipliers, Reset, Instant Settle), Telemetry Lap indicator (`Lxx/Lyy`), Halt status banner, Sandbox capital NAV, and session Unrealized PnL.
2. **Progress Strip**: A high-contrast linear bar representing completed lap percentage.
3. **Left Sidebar (Context)**: Track status readouts showing round numbers, circuit, weather conditions with dual-unit scales (`36°C / 97°F`), real-time podium tickers, Safety Car statuses, and DNF logs.
4. **Center Workspace**: The active workspace rendering the content of the selected tab.
5. **Right Sidebar (Holdings)**: Net cash balance, total assets valuation, risk exposures, return percentages, and vertically split folders for **⚡ Race Contracts** (detailed stats and exit buttons) and **🏆 Season Futures** (structural season holdings with no Greeks or exit buttons).
6. **Bottom Wire Ticker**: An automated, horizontally scrolling marquee wire feed streaming telemetry logs, incident descriptions, price changes, and settlement events.

---

# 3. Primary Workspace Tabs

The center panel updates dynamically based on the active tab chosen in the sub-header nav strip:

## 1. Race Markets
* **Purpose**: Primary options trading desk.
* **Layout**: A categories sidebar filter list on the left (Winner, Podium, Fastest Lap, Head-to-Head, Safety Car, DNF), a derivatives chain table in the center, and a sticky Order execution ticket on the right.
* **Order Execution Ticket Flow**:
  
  $$\text{Option Selection} \longrightarrow \text{Direction (Back/Lay)} \longrightarrow \text{Order Size (Qty)} \longrightarrow \text{Outcome Contract Payout} \longrightarrow \text{Open Position}$$
  
  The submit button and validation banners are positioned directly below the Payout Board, keeping primary execution actions immediately visible without vertical scrolling.

## 2. Race Replay
* **Purpose**: Replay simulation and telemetry visualization.
* **Layout**: Interactive lap timeline strip mapping milestones (Race Start, Pit Stops, Safety Cars, DNFs, Settlement) with hovered detail tooltips, a real-time driver positions lap chart, a live telemetry chart (visualizing sector pacing and speed differences), and a scrollable Repricing Moments log.

## 3. Portfolio
* **Purpose**: Attribution analysis and historic transaction auditing.
* **Layout**: Performance cards (Capital Returns %, Sharpe Ratio, Win Hit Rate %, Max Drawdown %) and the Open Trade Ledger mapping every executed order with timestamps.

## 4. Season Futures
* **Purpose**: Multi-race championship options trading.
* **Layout**: Driver and Constructor championship tables with symmetrical Back (YES) and Lay (NO) execution slips, allowing long-term position taking across the complete 24-round season.

## 5. Championship
* **Purpose**: Global season standings tracking.
* **Layout**: Progression boards tracking official driver and constructor points standings, updated dynamically in real-time as the user completes and settles GP rounds.

## 6. Research Lab
* **Purpose**: Academic foundation and methodology memo.
* **Layout**: A premium structured research memo outlining the physical-financial translation matrix, mathematical equations for pricing volatility, Bayesian telemetry updating, and design decision logs.

---

# 4. The User Journey

```text
1. Academic Landing Portal (Introductory abstract & MSFE credits)
                   │
                   ▼
2. Guided Onboarding (Optional full-screen tutorial modal)
                   │
                   ▼
3. Terminal Workspace (Round 01 Melbourne GP selected)
                   │
                   ▼
4. Formulate Strategy (Analyze starting grids, opening prices, weather)
                   │
                   ▼
5. Trade Opening Positions (Enforce 30% aggregate and 15% single risk limits)
                   │
                   ▼
6. Launch Replay Engine (Playback speed 0.5x to 10x, or INST settle)
                   │
                   ▼
7. Monitor Active Markets (Observe Safety Cars, retirements, Bayesian repricing)
                   │
                   ▼
8. Manage / Hedge Risks (Liquidate contracts, adjust Back/Lay exposures)
                   │
                   ▼
9. Reach Checkered Flag (Liquidate open race contracts, realize final PnL)
                   │
                   ▼
10. Settle Season Futures (Championship points update dynamically)
                   │
                   ▼
11. Abu Dhabi Season Completion (Trigger Season Report Card with Prop stats)
```

---

# 5. Data Display and Ingestion Safeguards

* **Data Leakage Safeguard**: The system reads race telemetry sequentially. The UI is blocked from accessing future laps, preventing users from viewing race winners, DNFs, or championship standings before the replay engine advances to those points.
* **Abstraction of Raw Formats**: Telemetry streams are never rendered as raw JSON. They are presented as implied probabilities, order books, timeline nodes, commentary wire feeds, and dynamic charts.

---

# 6. Responsive Fallback

* **Desktop View**: Optimal full grid display, rendering all sidebars and workspaces simultaneously for maximum density.
* **Tablet View**: Collapses the left and right rails into toggleable slide-out drawers, keeping the central workspace and timeline visible.
* **Mobile View**: Converts the multi-column layout into a stacked layout, prioritizing the central workspace and converting sidebars into swipeable overlay drawers.

---

**END INFORMATION ARCHITECTURE**
