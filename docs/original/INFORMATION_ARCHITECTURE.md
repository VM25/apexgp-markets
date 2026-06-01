# INFORMATION_ARCHITECTURE.md

# ApexGP Markets

## Information Architecture

---

# Experience Philosophy

The website behaves like:

A market operating system.

NOT:

* long-scroll portfolio page
* sportsbook
* racing dashboard
* documentation site
* static project showcase

The user should feel like they are entering a live market terminal built around historical Formula One event markets.

The experience should begin cinematically, then collapse into an operational trading workspace.

---

# Core Experience Structure

```text
Landing

↓

Terminal Launch

↓

Tabbed Market Workspace
```

The site should NOT rely on one long scroll page.

The main product experience should use tabs/workspaces.

---

# Site Model

## Public Layer

Landing page.

Purpose:

* establish project identity
* explain concept quickly
* create authority
* enter terminal

---

## Product Layer

Tabbed market workspace.

Purpose:

* trade contracts
* replay race events
* monitor portfolio
* review championship markets
* inspect research analytics

---

# Application Shell

Persistent layout after entering terminal:

```text
TOP
-----------------------------------------
ApexGP Markets | Market | Replay | Portfolio | Championship | Research

LEFT
-----------------------------------------
Race Context / Selected Market / Filters

CENTER
-----------------------------------------
Primary Workspace

RIGHT
-----------------------------------------
Portfolio Snapshot / Open Positions

BOTTOM
-----------------------------------------
Market Commentary / Event Feed
```

The shell should remain stable across tabs.

Changing tabs should change the center workspace, not the entire site structure.

---

# Primary Tabs

## 1. Market

Purpose:

Trade event contracts.

Content:

* contract grid
* bid/mid/ask
* implied probability
* price movement
* trade ticket
* market state

Primary actions:

* buy
* sell
* close

---

## 2. Replay

Purpose:

Control historical race replay.

Content:

* race timeline
* event queue
* lap state
* replay speed
* market update log

Primary actions:

* play
* pause
* change speed
* jump to event
* instant replay

---

## 3. Portfolio

Purpose:

Monitor performance and risk.

Content:

* portfolio value
* cash
* open positions
* realized PnL
* unrealized PnL
* exposure
* drawdown
* attribution

Primary actions:

* review position
* close position
* inspect PnL drivers

---

## 4. Championship

Purpose:

Trade long-horizon season markets.

Content:

* driver futures
* constructor futures
* season state
* championship probability movement

Primary actions:

* buy futures
* sell futures
* review exposure

---

## 5. Research

Purpose:

Explain quant logic and market behavior.

Content:

* probability notes
* market commentary archive
* model assumptions
* performance observations
* project methodology

Primary actions:

* read
* inspect
* understand

---

# Landing Page

Goal:

Create authority and distinction.

The landing page should make clear:

* this is not sports betting
* this is not a racing statistics site
* this is a quantitative event-market platform

Structure:

```text
Hero

↓

Market Thesis

↓

Preview Terminal

↓

Enter Market
```

Landing should be cinematic but short.

No long storytelling.

No excessive scrolling.

---

# Terminal Launch Interaction

When user clicks:

```text
ENTER MARKET
```

The experience should visually transition into the workspace.

Preferred behavior:

```text
Landing fades / compresses

↓

Terminal shell appears

↓

Market tab loads by default
```

This transition should feel like entering a market terminal.

---

# Global Components

Always visible in terminal:

* top navigation tabs
* selected race
* portfolio value
* active replay status
* market status
* commentary feed

---

# Left Rail

Purpose:

Context and filtering.

Possible contents:

* selected race
* race selector
* market category
* driver filter
* contract type
* replay status

Left rail should be compact.

Do not overload it.

---

# Center Workspace

Purpose:

Main tab content.

This is where the active market, replay, portfolio, championship, or research view appears.

Center workspace should carry the main interaction.

---

# Right Rail

Purpose:

Portfolio awareness.

Always show:

* portfolio value
* cash
* unrealized PnL
* exposure
* top open positions

Right rail keeps the user aware that every market decision affects the portfolio.

---

# Bottom Commentary Rail

Purpose:

Explain information flow.

Show:

* lap events
* market halts
* price changes
* PnL impact
* short market commentary

Tone:

* market analyst
* not sports commentator

Example:

```text
LAP 27

Safety Car deployed.

Winner market halted.

McLaren podium contracts repricing after restart.
```

---

# User Journey

```text
Enter Landing

↓

Launch Terminal

↓

Select Race

↓

Open Market

↓

Buy/Sell Contracts

↓

Start Replay

↓

Observe Events

↓

Prices Reprice

↓

Portfolio Updates

↓

Race Settles

↓

Review Result
```

---

# Data Display Rules

Never show raw data.

Do not expose:

* JSON
* raw API structure
* raw timing tables
* final results before settlement

Data appears as:

* contracts
* prices
* events
* probabilities
* portfolio metrics
* charts
* commentary

---

# Interaction Rules

Allowed:

* tab switching
* race selection
* market filtering
* buy/sell/close
* replay controls
* position review

Avoid:

* deep settings panels
* complicated modals
* nested menus
* hidden actions

---

# Mobile Rules

Mobile should NOT attempt full terminal complexity.

Mobile layout:

```text
Top Tabs

↓

Primary Content

↓

Portfolio Drawer

↓

Commentary Drawer
```

Prioritize:

* Market
* Replay
* Portfolio

Research can be simplified.

---

# Performance Rules

* static data only
* lazy-load charts
* keep animations lightweight
* no unnecessary 3D
* no expensive scroll hijacking

Target:

LCP < 2.5 seconds

---

# Success Criteria

A reviewer should say:

> This feels like a market terminal built around Formula One event contracts.

Not:

> This feels like a long project website.

Not:

> This feels like a sports betting interface.

---

END INFORMATION ARCHITECTURE
