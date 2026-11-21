# V1 Product Refinement Pass - ApexGP Markets

This implementation plan covers the targeted V1 product refinement pass to solve clarity, state transitions, outcome understanding, season continuity, and quant education across the platform.

---

## User Review Required

> [!IMPORTANT]
> **Dynamic Season State Machine**: We will introduce active standings points calculation for drivers and constructors. Point values accumulate as the user completes GP rounds. At Round 24, all season futures resolve, and a complete Quant performance report card is unlocked.
> 
> **Symmetrical BACK / LAY Options**: The Season Futures Chain will now support YES (BACK) and NO (LAY) option contracts with exact probability complements ($1.00 - Price) and risk validation limits.
> 
> **Three-Tab Guided Learning Workspace**: Replaces simple onboarding with an advanced workspace (Beginner, Advanced, Quant Notes) containing step-by-step mathematical examples, Bid/Ask spreads, option Greeks, and risk exposure limits.
> 
> **Desk Philosophy Memo**: The research page is refactored from card modules into an internal proprietary memo explaining translation matrices, Bayesian pricing formulas, failure modes, and observed behaviors.

---

## Proposed Changes

### 1. Unified State & Standings Machine
#### [MODIFY] [page.tsx](file:///Users/vatsal/Documents/ApexGP/src/app/page.tsx)
- Define state variables for `completedRaces`, `driverPoints`, and `constructorPoints` to dynamically accumulate standings.
- Update the race settlement modal to support:
  - Structured trade ledger toggle: renders columns for Position, Entry, Exit, PnL, and Settlement status.
  - Cash flow indicators: showing Cash change ($100000 → $100450) and % NAV shift.
- Detect completion of Round 24 (Abu Dhabi GP) to trigger the **SEASON REPORT OVERLAY**:
  - Summarize driver & constructor champions.
  - Render a quantitative report card (Sharpe ratio, net PnL, hit rate, best/worst trade performance, largest drawdown, and most profitable contract).

### 2. Symmetrical Championship Futures Chain
#### [MODIFY] [ChampionshipTab.tsx](file:///Users/vatsal/Documents/ApexGP/src/components/tabs/ChampionshipTab.tsx)
- Set initial contender to `""` and contract quantity to `0` to remove pre-selected defaults.
- Implement click-again row collapse to reset highlighted futures selection.
- Add `backingSide` (YES/NO) backing controls. Renders complement pricing ($1.00 - Ask/Bid) and calculates cost bounds.
- Connect point labels and rounds remaining directly to live season standing states passed from the parent.

### 3. Guided Learning Workspace Rebuild
#### [MODIFY] [BeginnerOnboarding.tsx](file:///Users/vatsal/Documents/ApexGP/src/components/BeginnerOnboarding.tsx)
- Rename button labels from "Onboard" to "Tutorial".
- Launch the tutorial modal automatically on very first load using `localStorage` check.
- Expand content into a 3-tab Guided Learning Workspace:
  - **Beginner**: Binary settlement, bid/ask spreads, and a complete worked contract example (100 contracts at $0.62 cost, $38 profit vs $62 risk).
  - **Advanced**: Risk concentration caps (15% single, 30% aggregate), futures settlement, and telemetry replays.
  - **Quant Notes**: Option Greeks definitions (Delta, Theta, IV) and Bayesian likelihood updates.

### 4. Market Design Quant Memo
#### [MODIFY] [ResearchTab.tsx](file:///Users/vatsal/Documents/ApexGP/src/components/tabs/ResearchTab.tsx)
- Rewrite completely into a professional, non-card terminal memo:
  - **Thesis**: Quantitative case for event contracts.
  - **Matrix**: Mapping physical F1 events to financial mechanisms (Pit Stop → Liquidity, Weather → Regime Shift).
  - **Engine Stack**: Expandable sectors displaying code formulas for telemetry parsing, Bayesian likelihood convergence, pricing spreads, and portfolio risk bounds.
  - **Decision Log**: Technical trade-offs (replays, paper trading, binary boundaries).
  - **Failure Modes**: Regime shocks, late retirements, and liquidity shocks.
  - **Season Report**: Locked view if before Round 24, unlocked card if completed.

### 5. Layout Spacing & Workspace Density
#### [MODIFY] [TerminalShell.tsx](file:///Users/vatsal/Documents/ApexGP/src/components/TerminalShell.tsx)
- Integrate a global density selector next to the tutorial controls supporting **Compact**, **Focus**, and **Expanded** modes.
- Apply high-density padding and scaling styles (tighten tables, reduce spacing, adjust text sizes).
- Standardize race metadata header and dropdown rendering to avoid internal `(R)` and `undefined` suffixes.
- Update holdings list empty state to prompt active trading.

---

## Verification Plan

### Compilation & Build
- Propose `npm run build` in Terminal. Verify compilation completes in under 3.5s with zero errors or warnings.

### Functional Verification
1. **Tutorial Auto-Launch**: Clear localStorage and refresh. Verify Guided Learning Workspace overlays immediately. Check Beginner, Advanced, and Quant Notes navigation tabs.
2. **Timing Grid Collapse**: Select a contract row in the Derivatives Option Chain. Click it again. Verify selection collapses and the ticket returns to standby.
3. **BACK / LAY Symmetry**: Highlight "Leclerc beats Piastri" H2H contract. Toggle YES / NO. Confirm prices invert ($0.52 ask vs $0.48 bid) and Cost projections calculate correctly.
4. **Race Settlement Ledger**: Run Australia GP simulation to completion. Confirm Settlement modal opens automatically. Click "Open Trade Ledger". Verify structured columns display entry, exit, and realized PnL details.
5. **Season State Machine**: Settle a race. Navigate to the Championship tab. Confirm driver points, team standings, and remaining rounds update dynamically.
6. **Abu Dhabi Season Report**: Skip/Fast-forward to Round 24 (Abu Dhabi GP) and settle. Verify the Season Report card unlocks inside the Market Design tab and displays a comprehensive quantitative summary.
