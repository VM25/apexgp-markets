# DESIGN_SYSTEM.md - Version 2.0

# ApexGP Markets: Actual Implemented Design System

---

# 1. Core Design Philosophy

The visual identity of ApexGP Markets V2 is designed to convey the authority, precision, and performance of an **Institutional F1 Quantitative Trading Terminal**. 

```text
  45% Bloomberg Terminal (dense data tables, monospace fonts, monochrome panels)
+ 35% Formula One Broadcast (timing bars, circuit info, active leaderboards)
+ 20% Quant Research Lab (academic headers, mathematical abstracts, clear credits)
```

The system is optimized to look premium, structured, alive, and dense. It deliberately avoids recreational sportsbook visual cues, crypto neon gradients, playful cartoonish racing illustrations, and excessive empty white spaces.

---

# 2. Visual Identity & Atmosphere

The terminal utilizes a "Terminal-on-Glass" visual hierarchy:
* **Backgrounds**: Deep, rich carbon graphite, maintaining maximum screen contrast.
* **Panels**: Structured slate-carbon glass blocks with subtle, translucent borders.
* **Data Panels**: Extremely sharp, high-density grids to ensure rapid scanning of price spreads and greeks.
* **Dynamic State-Aware Atmospheric Overlays**: Background boundaries shift their subtle aura based on live simulation states:
  * **Default State**: Near-monochrome deep carbon with a tint of terminal blue.
  * **Safety Car State**: Dynamic glowing golden border overlay (`state-safety-car`) signaling a circuit-breaker trading halt.
  * **Trading Halt State**: High-visibility red alert indicators (`state-market-halt`).
  * **Drawdown State**: Crimson highlights on panels when unrealized losses exceed portfolio bounds.
  * **Gain State**: Subtle emerald highlights when capital yield exceeds performance thresholds.
  * **Settlement State**: Soft gold atmospheric focus during final binary contract resolution.

---

# 3. Color Tokens

Color is used strictly to convey critical information shocks, price adjustments, and risk states:

| Role / Element | Implemented Color | Hex / Utility Value |
| :--- | :--- | :--- |
| **Base Background** | Deep Carbon Black | `#090a0f` |
| **Primary Panel** | Graphite Carbon Dark | `#111218` |
| **Active Panel** | Graphite Carbon Surface | `#181922` |
| **Hover State** | Carbon Light | `#20222f` |
| **Text Primary** | Absolute White | `#ffffff` |
| **Text Secondary** | Slate Silver | `#7d859b` |
| **Text Muted** | Slate Charcoal | `#454958` |
| **Market Primary** | Electric Terminal Blue | `#2563eb` / `#60a5fa` |
| **Safety Car / Warnings** | Warning Yellow | `#f59e0b` |
| **Settlements / Championship** | Soft Gold | `#d97706` |
| **Gain / Upward Shift** | Terminal Green | `#10b981` |
| **Loss / Downward Shift** | Terminal Red | `#ef4444` |

---

# 4. Typography Font Stack

Typography is partitioned strictly by information category to preserve readability and institutional authority:

### A. Display & Brand Headers
* **Role**: Section titles, navigation items, and high-level card headers.
* **Font**: Premium Sans-Serif (`Outfit` / `Inter` / `system-ui`)
* **Styling**: Uppercase, medium to extra bold, tight letter spacing, high authority.

### B. Body Copy & Abstracts
* **Role**: Learning explanations, glossary items, and research memo texts.
* **Font**: Neutral Sans-Serif (`Inter` / `system-ui` / `sans-serif`)
* **Styling**: Regular, thin weight, high line spacing for prolonged screen reading.

### C. Data Tickers & Numerical Grids
* **Role**: All numbers, contract bid/ask spreads, pricing deltas/thetas, laps, points, and financial metrics.
* **Font**: Clean Monospace (`JetBrains Mono` / `SFMono-Regular` / `monospace`)
* **Styling**: Bold, numbers are aligned perfectly to prevent layout shifts.

*Note: All numerical values and pricing indicators are strictly prohibited from using proportional fonts.*

---

# 5. Spacing & Density System

The platform operates an adaptive, user-selectable density layout:
* **Default Mode**: Dense, compact margins, and tightly aligned panes. Text scale is optimized for high-density trading desktops.
* **Focus Mode**: Programmatically collapses left Timing and right Portfolio sidebars to maximize screen space for center timeline charting and telemetry replaying.
* **Mobile Stack**: Responsive stack margins with sliding overlay drawers.

---

# 6. Data Visualization Guidelines

All visualizations follow a clean, monochrome-inspired design:
* **Allowed Charts**: Telemetry lines, position area charts, equity yield curves, and historical risk drawdowns.
* **Allowed Visuals**: Single or multiple line SVG charts, smooth node connectors, flat grids.
* **Explicitly Forbidden**: Pie charts, donut charts, 3D bar layouts, and vibrant multi-colored gradient meshes.
* **Commentary Feeds**: Positioned on the bottom wire marquee, styled to represent Bloomberg-style breaking news wires.

---

# 7. Animation & Sound Rules

* **Motion System**: Micro-animations are functional rather than decorative, with timings between **150ms and 350ms**. Transitions only trigger during active price updates, timeline milestone shifts, or modal entries.
* **Interactive Sounds**: Completely disabled. The user terminal is silent to respect focus.

---

**END DESIGN SYSTEM**
