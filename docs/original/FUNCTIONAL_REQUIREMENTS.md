# FUNCTIONAL_REQUIREMENTS.md

# ApexGP Markets

## Functional Requirements

---

# Purpose

This document defines what must function.

Visual completion is NOT sufficient.

Animation is NOT sufficient.

Clickability is NOT sufficient.

The project is complete only if user actions create meaningful state changes.

---

# Definition of Done

ApexGP Markets is considered functional only if:

* users can trade contracts
* portfolio values update
* prices move
* races replay
* positions settle
* results become visible

If the website only displays information without changing system state:

PROJECT IS NOT COMPLETE.

---

# V1 Scope

Must support:

* historical replay
* race selection
* contract trading
* market repricing
* portfolio tracking
* settlement
* commentary

Not required:

* live markets
* databases
* accounts
* authentication
* sportsbooks
* persistence

---

# Session Rules

Session begins:

```text
Portfolio:
$100,000

No Positions

No Exposure
```

Session ends:

```text
Close Tab

↓

Delete Portfolio
```

No save.

No load.

No accounts.

---

# User Flow

Required flow:

```text
Enter Market

↓

Select Race

↓

Select Contract

↓

Open Position

↓

Start Replay

↓

Observe Repricing

↓

Modify Position

↓

Reach Settlement

↓

View Results
```

Every step must work.

---

# Functional Requirement 01

# Race Selection

User must be able to:

* select race
* switch race
* reset race

Supported:

2025 season.

When switching race:

```text
Replay resets

Portfolio remains

Positions settle if required
```

If user switches after settlement:

Portfolio persists.

---

# Functional Requirement 02

# Market Loading

Selecting race must load:

* available contracts
* replay state
* race metadata
* championship context

Markets must render within:

2 seconds.

User must never see empty state.

---

# Functional Requirement 03

# Contract Discovery

User must immediately understand:

What can be traded.

Each contract card must show:

```text
Contract

Probability

Bid

Ask

Settlement Rule
```

Example:

```text
Winner

Piastri

0.62

0.60 / 0.64

Settles:
1 or 0
```

User must never guess what contract means.

---

# Functional Requirement 04

# Contract Purchase

User action:

BUY

Required outcome:

```text
Cash

↓

Position Opens

↓

Exposure Updates

↓

Portfolio Updates
```

Required calculations:

```text
Cost

=

Contracts × Entry
```

Example:

```text
BUY

20

×

0.62

=

1240
```

Portfolio:

```text
Cash:
98760
```

must update immediately.

---

# Functional Requirement 05

# Position Management

User must be able to:

* close position
* reduce position
* review position

Closing:

```text
Sell

↓

Cash Returns

↓

PnL Updates
```

No position should require replay completion.

---

# Functional Requirement 06

# Replay Engine

User must:

* start replay
* pause replay
* resume replay
* change speed

Replay speeds:

* 0.5×
* 1×
* 2×
* 4×
* 10×
* Instant

Replay must trigger events.

Replay must not only animate.

---

# Functional Requirement 07

# Market Repricing

Race events must change prices.

Example:

```text
Safety Car

↓

Probability Update

↓

Price Update

↓

Portfolio Update
```

If prices never change:

FAIL.

---

# Functional Requirement 08

# Market Halt

Major events trigger:

HALT

Examples:

* Safety Car
* DNF
* Settlement

During halt:

* trades disabled
* commentary updates
* prices refresh

Trading resumes automatically.

---

# Functional Requirement 09

# Portfolio Calculations

Portfolio must update continuously.

Required:

```text
Portfolio

Cash

Exposure

Open Value

PnL
```

Formula:

```text
Portfolio

=

Cash

+

Position Value
```

---

# Functional Requirement 10

# PnL

Required:

Realized

Unrealized

Total

Example:

```text
Entry:
0.62

Current:
0.80

Qty:
20

PnL:
+3.60
```

Updates must occur live.

---

# Functional Requirement 11

# Portfolio Metrics

Required:

* Return
* Exposure
* Drawdown
* Sharpe
* Hit Rate

Must update after settlement.

---

# Functional Requirement 12

# Commentary

Events must produce explanation.

Example:

```text
LAP 21

Safety Car

Winner Market Halted

Piastri Probability +6%
```

Commentary must explain:

WHAT

WHY

IMPACT

---

# Functional Requirement 13

# Settlement

Settlement must occur.

Contract:

```text
Success → 1

Failure → 0
```

Settlement must:

```text
Close Positions

↓

Update Cash

↓

Update PnL

↓

Show Result
```

---

# Functional Requirement 14

# Championship Markets

User must:

* open futures
* hold futures
* settle futures

Settlement may occur:

Season end.

---

# Functional Requirement 15

# Empty States

System must handle:

No positions

No cash

No race

No contracts

No replay

No results

Never show blank screen.

---

# Functional Requirement 16

# Failure Conditions

Project fails if:

* buttons do nothing
* replay only animates
* portfolio never changes
* contracts never settle
* race cannot switch
* prices remain static
* commentary never updates
* settlement missing

---

# Beginner Onboarding Requirement

The platform must include a first-time user explanation mode.

Users with no finance background should understand:

- what a contract is
- how buying works
- how prices move
- how PnL changes
- how settlement works

The interface should include:

- How This Works panel
- Example Trade
- Glossary toggle
- Guided first interaction

The platform should support both:

1. Beginner Mode
2. Market Mode

---

# Acceptance Test

Builder demonstrates:

```text
Open Race

↓

Buy Contract

↓

Replay

↓

Price Changes

↓

Portfolio Changes

↓

Settle

↓

Final PnL
```

Without manual intervention.

---

# Final Builder Rule

If a user says:

"I don't understand what happened."

System failed.

If user says:

"I understood how my portfolio changed."

System succeeded.

---

END FUNCTIONAL REQUIREMENTS
