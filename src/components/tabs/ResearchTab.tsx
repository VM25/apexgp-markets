import React, { useState } from "react";
import { Landmark, Trophy, ArrowUpRight, ArrowDownRight, ShieldAlert, Cpu, Layers, HelpCircle, Lock, BookOpen, Sigma, Activity } from "lucide-react";

interface ResearchTabProps {
  isSeasonFinished?: boolean;
  sharpeRatio?: number;
  totalPnL?: number;
  hitRate?: number;
  bestTrade?: string;
  worstTrade?: string;
  maxDrawdown?: number;
  mostProfitableMarket?: string;
}

export default function ResearchTab({
  isSeasonFinished = false,
  sharpeRatio = 0,
  totalPnL = 0,
  hitRate = 0,
  bestTrade = "None",
  worstTrade = "None",
  maxDrawdown = 0,
  mostProfitableMarket = "None"
}: ResearchTabProps) {
  
  const [activeNarrativeSection, setActiveNarrativeSection] = useState<string>("thesis");

  const sections = [
    { id: "thesis", title: "1. Project Thesis", icon: <Layers className="w-3.5 h-3.5" /> },
    { id: "why-f1", title: "2. Why Formula 1", icon: <Activity className="w-3.5 h-3.5" /> },
    { id: "architecture", title: "3. Market Architecture", icon: <Landmark className="w-3.5 h-3.5" /> },
    { id: "probability", title: "4. Probability Engine", icon: <Sigma className="w-3.5 h-3.5" /> },
    { id: "risk", title: "5. Risk Controls", icon: <ShieldAlert className="w-3.5 h-3.5" /> },
    { id: "portfolio", title: "6. Portfolio Design", icon: <Trophy className="w-3.5 h-3.5" /> },
    { id: "replay", title: "7. Replay Philosophy", icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: "quant", title: "8. Quant Concepts", icon: <Cpu className="w-3.5 h-3.5" /> },
    { id: "lessons", title: "9. Lessons Learned", icon: <HelpCircle className="w-3.5 h-3.5" /> },
    { id: "demonstration", title: "10. What This Demonstrates", icon: <Cpu className="w-3.5 h-3.5" /> }
  ];

  return (
    <div className="h-full flex flex-col xl:flex-row gap-3.5 select-none min-h-0 font-mono text-body-sm text-slate-400">
      
      {/* LEFT COLUMN: NAVIGATION RAIL */}
      <div className="w-full xl:w-56 shrink-0 flex flex-row xl:flex-col gap-1 select-none">
        <div className="bg-carbon-surface border border-white/5 rounded p-2.5 space-y-1 w-full flex flex-col shrink-0">
          <span className="text-micro text-slate-500 font-bold uppercase tracking-wider block">Desk Document Index</span>
          <span className="text-white font-extrabold text-micro uppercase tracking-wider block leading-tight">
            RESEARCH MEMO CL-9
          </span>
        </div>

        <div className="flex-1 flex flex-row xl:flex-col gap-0.5 overflow-x-auto xl:overflow-x-visible xl:overflow-y-auto mt-2 w-full">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveNarrativeSection(s.id)}
              className={`px-3 py-2 text-left font-bold rounded text-micro cursor-pointer transition-all flex items-center gap-2 shrink-0 ${activeNarrativeSection === s.id ? "bg-terminal-blue/15 border-l-2 border-terminal-blue text-white" : "bg-white/3 hover:bg-white/5 text-slate-400"}`}
            >
              {s.icon}
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* CENTER PIECE: THE NARRATIVE memo (Details based on selection) */}
      <div className="flex-1 bg-carbon-surface border border-white/5 rounded p-4 flex flex-col min-h-0 select-text">
        <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-terminal-blue" />
            <h2 className="text-white font-bold text-micro uppercase tracking-wider">
              {sections.find(s => s.id === activeNarrativeSection)?.title}
            </h2>
          </div>
          <span className="text-micro text-slate-500 font-bold tracking-wider uppercase font-mono">CONFIDENTIAL RESEARCH SYSTEM REPORT</span>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 pr-1 leading-relaxed text-micro font-sans font-light text-slate-350 space-y-3.5">
          
          {activeNarrativeSection === "thesis" && (
            <div className="space-y-3">
              <span className="text-slate-500 font-bold font-mono uppercase text-micro tracking-wider block">I. PROJECT THESIS // THE MACRO TRANSITION</span>
              <p>
                Traditional event betting platforms operate as leisure products, using cryptic fractions (e.g., 5/2, +250) designed to hide transaction spreads and trap customer stakes until final event resolution. <strong>ApexGP Markets rejects this model.</strong>
              </p>
              <p>
                We treat active physical sporting events as highly structured, continuous financial event chains. By framing driver standing changes and Safety Car interventions as standardized binary derivatives contracts (structured to settle strictly at either $1.00 or $0.00), we bridge sports telemetry with contemporary quantitative derivatives theory.
              </p>
              <p>
                Under this framework, users act as quantitative desk operators rather than speculative bettors. The focus shifts entirely to:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-1 text-slate-300 font-mono text-micro">
                <li>Systematic Risk Management (exposure caps, sector hedging).</li>
                <li>Capital Allocation (balancing short-term GP option chains with multi-race Championship Futures).</li>
                <li>Anomalous Price Arbitrage (exploiting delayed market maker responses to sudden telemetry shocks).</li>
              </ul>
              <div className="bg-carbon-black/40 border border-white/5 p-3 rounded font-mono text-micro text-slate-400 mt-2 space-y-1 leading-normal">
                <span className="text-terminal-blue font-bold uppercase text-micro tracking-wider block">UI Connectivity</span>
                Every open position in the <strong>Open Derivative Positions</strong> rail represents a live, tradeable capital block valued dynamically via continuous market matching rather than static betting stakes.
              </div>
            </div>
          )}

          {activeNarrativeSection === "why-f1" && (
            <div className="space-y-3">
              <span className="text-slate-500 font-bold font-mono uppercase text-micro tracking-wider block">II. WHY FORMULA 1 // THE TELEMETRY DEEP STREAM</span>
              <p>
                Most financial event markets suffer from severe information asymmetry and fragmented data reporting. Formula 1 represents the perfect quantitative laboratory because it generates massive, standardized, high-frequency telemetry streams.
              </p>
              <p>
                A modern Formula 1 car acts as a dense physical sensor grid transmitting sector timings, tire compounds, thermal degradation wear, pit summaries, and incident flags. These physical inputs represent perfect state indicators:
              </p>
              <div className="grid grid-cols-2 gap-3 text-center my-2 font-mono text-micro">
                <div className="bg-carbon-black p-2.5 rounded border border-white/5">
                  <span className="text-terminal-blue-light font-bold block">F1 Physical Input</span>
                  <span className="text-white block mt-1">Tire Degradation (Age)</span>
                  <span className="text-slate-550 block text-micro mt-0.5">Degradation rate increases probability of thermal failure (DNF).</span>
                </div>
                <div className="bg-carbon-black p-2.5 rounded border border-white/5">
                  <span className="text-terminal-blue-light font-bold block">Micro-Market Translation</span>
                  <span className="text-white block mt-1">DNF contract implied odds rise</span>
                  <span className="text-slate-555 block text-micro mt-0.5">Option chain bid-ask spreads widen on risk limit warnings.</span>
                </div>
              </div>
              <p>
                By mapping these physical constraints directly to mathematical market-pricing variables, we build a spoiler-safe market engine where prices converge predictably to real standings results as telemetry packets arrive.
              </p>
              <div className="bg-carbon-black/40 border border-white/5 p-3 rounded font-mono text-micro text-slate-400 mt-2 space-y-1 leading-normal">
                <span className="text-terminal-blue font-bold uppercase text-micro tracking-wider block">UI Connectivity</span>
                The <strong>Timing Grid Standings</strong> view is the raw sensor pipeline. Expanding a driver reveals live sector splits, tire compound ages, and interval metrics that feed the pricing math in real time.
              </div>
            </div>
          )}

          {activeNarrativeSection === "architecture" && (
            <div className="space-y-3">
              <span className="text-slate-500 font-bold font-mono uppercase text-micro tracking-wider block">III. MARKET ARCHITECTURE // TWO-SIDED DECIMAL AMM CHAIN</span>
              <p>
                ApexGP operates a dual two-sided decimal option chain model where all contracts are priced inside the strict interval <strong>[ $0.01, $0.99 ]</strong> during active play, converging to exactly <strong>$1.00</strong> or <strong>$0.00</strong> upon final race verification.
              </p>
              <p>
                The exchange enforces symmetric double-sided markets via a **Synthetic Automated Market Maker (AMM)** that maintains a constant spread margin:
              </p>
              <div className="bg-carbon-black/60 border border-white/5 p-3 rounded text-micro font-mono leading-relaxed space-y-1 my-2">
                <div><code>Bid = Mid - 0.02</code></div>
                <div><code>Ask = Mid + 0.02</code></div>
                <div><code>Spread = Ask - Bid = 0.04 (Constant Spreads)</code></div>
              </div>
              <p>
                To provide maximum trading liquidity, the platform supports <strong>Symmetric Backing</strong>:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-1 text-slate-350">
                <li><strong>BACK (YES):</strong> Buying the contract. Profit accrues if the target event occurs (settles to $1.00). Executed at the Ask price.</li>
                <li><strong>LAY (NO):</strong> Selling the contract complement. Profit accrues if the target event fails to occur (settles to $1.00). The price of a Lay contract is structured as the exact complement: <code>$1.00 - YES_Price</code> (Bid is $1.00 - Ask_YES; Ask is $1.00 - Bid_YES).</li>
              </ul>
              <div className="bg-carbon-black/40 border border-white/5 p-3 rounded font-mono text-micro text-slate-400 mt-2 space-y-1 leading-normal">
                <span className="text-terminal-blue font-bold uppercase text-micro tracking-wider block">UI Connectivity</span>
                The <strong>Derivatives Option Chain</strong> tab lets you toggle categories (Winner, Podium, etc.), inspect the Bid/Ask ladder, and select a direction (BACK/LAY) on the execution ticket.
              </div>
            </div>
          )}

          {activeNarrativeSection === "probability" && (
            <div className="space-y-3">
              <span className="text-slate-500 font-bold font-mono uppercase text-micro tracking-wider block">IV. PROBABILITY ENGINE // BAYESIAN DYNAMICS</span>
              <p>
                At the core of the ApexGP terminal is a <strong>Bayesian Implied Probability Engine</strong> that updates market prices dynamically based on arriving telemetry. 
              </p>
              <p>
                The engine utilizes a dynamic blending algorithm where the posterior probability is a weighted sum of the telemetry-derived prior probability and the deterministic final outcome, scaled by an information leakage convergence exponent:
              </p>
              <div className="bg-carbon-black/60 border border-white/5 p-3.5 rounded text-micro font-mono leading-relaxed space-y-2.5 my-2 text-slate-300">
                <div className="text-terminal-blue-light font-bold"> posterior = (1 - w) * prior + w * outcome </div>
                <div className="h-px bg-white/5" />
                <div><code>w = (lap / total_laps)^1.6</code></div>
                <div><code>prior = e^(-0.75 * (current_pos - 1) - 0.15 * gap_to_leader)</code></div>
              </div>
              <p>
                The convergence factor <code>w</code> acts as an information leakage parameter:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-1 text-slate-350">
                <li>Early in the race (low <code>w</code>), prices are highly sensitive to telemetry shifts (gaps, overtakes, tire compounds).</li>
                <li>As the race nears completion (high <code>w</code>), prices converge asymptotically toward the actual physical outcomes, driving bid/ask spreads to settle cleanly.</li>
              </ul>
              <div className="bg-carbon-black/40 border border-white/5 p-3 rounded font-mono text-micro text-slate-400 mt-2 space-y-1 leading-normal">
                <span className="text-terminal-blue font-bold uppercase text-micro tracking-wider block">UI Connectivity</span>
                Every lap completion on the active GP simulation triggers a mathematical cycle, recalculating mid-prices and spreads across the option chain.
              </div>
            </div>
          )}

          {activeNarrativeSection === "risk" && (
            <div className="space-y-3">
              <span className="text-slate-500 font-bold font-mono uppercase text-micro tracking-wider block">V. RISK CONTROLS // DESK EXPOSURE MANAGEMENT</span>
              <p>
                In high-velocity event markets, managing exposure limits is critical to preventing capital collapse from tail-risk occurrences (such as multi-car pileups or engine blowouts). The terminal enforces strict <strong>automated portfolio risk audits</strong> prior to order filling:
              </p>
              <div className="overflow-x-auto my-2">
                <table className="w-full text-left font-data text-micro">
                  <thead>
                    <tr className="text-slate-500 uppercase text-micro border-b border-white/5 font-bold tracking-wider">
                      <th className="pb-1">Audit Control</th>
                      <th className="pb-1 text-center">Threshold</th>
                      <th className="pb-1 pl-3">Desk Rationale</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/5">
                      <td className="py-2 text-white font-bold">Single Market Limit</td>
                      <td className="py-2 text-center text-terminal-yellow font-bold">15.0%</td>
                      <td className="py-2 text-slate-400 pl-3 leading-relaxed">Limits total net capital allocated to any single contract driver to mitigate localized tail-risk.</td>
                    </tr>
                    <tr className="border-b border-white/5 last:border-0">
                      <td className="py-2 text-white font-bold">Total Exposure Limit</td>
                      <td className="py-2 text-center text-terminal-red font-bold">30.0%</td>
                      <td className="py-2 text-slate-400 pl-3 leading-relaxed">Caps aggregate open position asset values at 30% of NAV to preserve a liquid cash reserve.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                <strong>Circuit Breaker Trading Halts:</strong> When a major incident occurs (Safety Car or driver retirement DNF), the platform enters a complete trading halt state. During this time, trading is disabled and order entries are blocked for 2.5 to 3.5 seconds. This simulates real-world exchange safeguards, allowing the system to process the physical shock before active trading resumes under the constant $0.02 spread model.
              </p>
              <div className="bg-carbon-black/40 border border-white/5 p-3 rounded font-mono text-micro text-slate-400 mt-2 space-y-1 leading-normal">
                <span className="text-terminal-blue font-bold uppercase text-micro tracking-wider block">UI Connectivity</span>
                Entering an excessively large contract size in the <strong>Execution ticket</strong> triggers immediate risk banners blocking the submission and indicating which limit boundary is breached.
              </div>
            </div>
          )}

          {activeNarrativeSection === "portfolio" && (
            <div className="space-y-3">
              <span className="text-slate-500 font-bold font-mono uppercase text-micro tracking-wider block">VI. PORTFOLIO DESIGN // MARK-TO-MARKET VALUATION</span>
              <p>
                ApexGP maintains a continuous, real-time <strong>Mark-to-Market (MTM) Portfolio Engine</strong> to evaluate trading performance and capital drawdowns:
              </p>
              <div className="bg-carbon-black/60 border border-white/5 p-3.5 rounded text-micro font-mono leading-relaxed space-y-2 my-2 text-slate-350">
                <div><code>NAV (Net Worth) = Cash_Sandbox + Σ (Qty_i * Price_i)</code></div>
                <div><code>Price_i = position.side === "LAY" ? (1.00 - contract.ask) : contract.bid</code></div>
              </div>
              <p>
                <strong>Audited Attribution:</strong> Once the final checkered flag falls or the 24-race season completes, the terminal aggregates performance metrics for auditing:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-1 text-slate-350">
                <li><strong>Net Return (NAV Chg %):</strong> Total returns generated above the initial $100,000 sandbox capital.</li>
                <li><strong>Sharpe Ratio:</strong> A daily-equivalent Sharpe Ratio calculated from the standard deviation of lap-by-lap NAV percentage returns, annualized using the standard $\sqrt{252}$ trading multiplier.</li>
                <li><strong>Max Drawdown:</strong> The peak-to-trough percentage capital reduction, indicating exposure risk management.</li>
              </ul>
              <div className="bg-carbon-black/40 border border-white/5 p-3 rounded font-mono text-micro text-slate-400 mt-2 space-y-1 leading-normal">
                <span className="text-terminal-blue font-bold uppercase text-micro tracking-wider block">UI Connectivity</span>
                The <strong>Portfolio Ledger</strong> sidebar and the <strong>Portfolio desk Tab</strong> graph your continuous NAV equity curve, displaying cash balances, active exposure ratios, and Sharpe statistics.
              </div>
            </div>
          )}

          {activeNarrativeSection === "replay" && (
            <div className="space-y-3">
              <span className="text-slate-500 font-bold font-mono uppercase text-micro tracking-wider block">VII. REPLAY PHILOSOPHY // SYSTEMATIC QUANT BACKTESTING</span>
              <p>
                Recreational betting is inherently path-independent—bet slip outcomes are isolated. <strong>ApexGP is built on an interactive backtesting replay philosophy.</strong>
              </p>
              <p>
                By functioning as a historical replay market using official 2025 Formula 1 season results, the terminal acts as a spoiler-safe quantitative backtesting desk:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-1 text-slate-350">
                <li>Users execute transactions on event contracts under historical conditions.</li>
                <li>Physical events, incident loops, and track standings resolve <strong>exactly as they happened in reality</strong>, guaranteeing statistical integrity.</li>
                <li>Portfolio outcomes vary solely based on the operator's execution timing, hedging decisions, and exposure limit controls.</li>
              </ul>
              <p>
                Timeline milestone markers act as spoiler-safe telemetry nodes. Telemetry nodes ahead of the active lap remain locked ("Await telemetry") to preserve backtesting integrity, unlocking detailed explanations and portfolio impact logs only as the replay advances.
              </p>
              <div className="bg-carbon-black/40 border border-white/5 p-3 rounded font-mono text-micro text-slate-400 mt-2 space-y-1 leading-normal">
                <span className="text-terminal-blue font-bold uppercase text-micro tracking-wider block">UI Connectivity</span>
                The **Event Timeline** strip at the top of the **Telemetry** view maps these spoiler-safe milestone logs. Hovering completed nodes exposes the chronological Race Event → Market Effect → Portfolio Effect hierarchy.
              </div>
            </div>
          )}

          {activeNarrativeSection === "quant" && (
            <div className="space-y-3">
              <span className="text-slate-500 font-bold font-mono uppercase text-micro tracking-wider block">VIII. QUANT CONCEPTS // MICROSTRUCTURE MECHANICS</span>
              <p>
                Rather than solving continuous partial differential equations (PDEs) or continuous Black-Scholes heat equations, the terminal computes highly elegant **analytical Greeks proxies** client-side designed specifically for binary event options:
              </p>
              <div className="space-y-3 text-micro font-sans text-slate-300">
                <div>
                  <strong className="text-white block font-mono text-micro uppercase text-terminal-blue-light">1. Price Sensitivity (Delta Δ)</strong>
                  Delta represents the option price sensitivity relative to state progression. It peaks around 50% probability where contract outcome uncertainty is maximum: <code>Delta = Mid * (1 - Mid) * lambda</code>.
                </div>
                <div className="pt-2 border-t border-white/5">
                  <strong className="text-white block font-mono text-micro uppercase text-terminal-blue-light">2. Time Decay (Theta Θ)</strong>
                  Theta represents the telemetry-adjusted time-based decay of contract uncertainty per lap completed. If a driver remains P4 with few laps remaining, their P1 contract decays slowly toward $0.00 (negative Theta decay), while the leader enjoys positive Theta convergence toward $1.00 as the final checkers approach: <code>Theta = (isLeader ? 1 : -1) * Mid * (1 - Mid) / (lapsRemaining + 1)</code>.
                </div>
                <div className="pt-2 border-t border-white/5">
                  <strong className="text-white block font-mono text-micro uppercase text-terminal-blue-light">3. Implied Volatility Index (IV)</strong>
                  IV represents the synthetic track uncertainty index. It combines static weather expectations, active Safety Car systematic shocks, and remaining time-to-settlement rather than calculating standard continuous standard deviations: <code>IV = 0.18 + RainProb/200 + (SafetyCar ? 0.30 : 0) + (1.0 - lap/totalLaps) * 0.25</code>.
                </div>
              </div>
              <div className="bg-carbon-black/40 border border-white/5 p-3 rounded font-mono text-micro text-slate-400 mt-2 space-y-1 leading-normal">
                <span className="text-terminal-blue font-bold uppercase text-micro tracking-wider block">UI Connectivity</span>
                Toggling <strong>Focus Mode</strong> reveals dynamic Delta, Theta, and IV indexes columns directly inside the Derivatives Option Chain grid and Championship Futures tables.
              </div>
            </div>
          )}

          {activeNarrativeSection === "lessons" && (
            <div className="space-y-3">
              <span className="text-slate-500 font-bold font-mono uppercase text-micro tracking-wider block">IX. LESSONS LEARNED // MICROSTRUCTURE IMPLICATIONS</span>
              <p>
                Developing and operating ApexGP event-contracts terminal highlights key quantitative lessons on dynamic market microstructure:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-1 text-slate-350">
                <li>
                  <strong>Halt Liquidity Draws:</strong> Freezing transaction entries during safety cars protects AMMs from latency arbitrage, but cuts off capital liquidation paths for retail operators, illustrating the structural tradeoff of volatility circuit breakers.
                </li>
                <li>
                  <strong>Tire-Wear Volatility Blends:</strong> Blending tire wear (compound age) into options pricing priors prevents late-race degradation anomalies but increases model complexity, requiring fine-tuned Bayesian weights.
                </li>
                <li>
                  <strong>Symmetric Spreads are Mandatory:</strong> Without Lay contracts complement logic (<code>1.00 - Ask</code>), users cannot short overpriced contenders, causing severe market-maker imbalances during volatile weather transitions.
                </li>
              </ul>
              <div className="bg-carbon-black/40 border border-white/5 p-3 rounded font-mono text-micro text-slate-400 mt-2 space-y-1 leading-normal">
                <span className="text-terminal-blue font-bold uppercase text-micro tracking-wider block">UI Connectivity</span>
                The **Symmetric BACK (YES) / LAY (NO)** direction selectors on all option chain execution tickets prevent spread imbalances by allowing double-sided capital placement.
              </div>
            </div>
          )}

          {activeNarrativeSection === "demonstration" && (
            <div className="space-y-3">
              <span className="text-slate-500 font-bold font-mono uppercase text-micro tracking-wider block">X. WHAT THIS DEMONSTRATES // SYSTEM SUMMARY</span>
              <p>
                ApexGP is a comprehensive demonstrator of high-velocity, high-density microstructure engineering:
              </p>
              <div className="grid grid-cols-2 gap-3 text-slate-300 font-mono text-micro my-2 select-text">
                <div className="bg-carbon-black/35 border border-white/5 p-2 rounded">
                  <span className="text-terminal-blue-light font-bold">1. REAL-TIME DATA PIPELINES</span>
                  <p className="text-slate-450 leading-relaxed mt-0.5 font-sans font-light">Processes official, verified 2025 F1 historical statistics seamlessly into dynamic implied options valuations.</p>
                </div>
                <div className="bg-carbon-black/35 border border-white/5 p-2 rounded">
                  <span className="text-terminal-blue-light font-bold">2. BAYESIAN CONVERGENCE</span>
                  <p className="text-slate-450 leading-relaxed mt-0.5 font-sans font-light">Demonstrates progressive blending of statistical priors with on-track event leakage variables.</p>
                </div>
                <div className="bg-carbon-black/35 border border-white/5 p-2 rounded">
                  <span className="text-terminal-blue-light font-bold">3. PORTFOLIO AUDITING</span>
                  <p className="text-slate-450 leading-relaxed mt-0.5 font-sans font-light">Implements live Nav curves, Sharpe metrics, and drawdown calculators under rigorous sandbox constraints.</p>
                </div>
                <div className="bg-carbon-black/35 border border-white/5 p-2 rounded">
                  <span className="text-terminal-blue-light font-bold">4. QUANTITATIVE EDUCATION</span>
                  <p className="text-slate-450 leading-relaxed mt-0.5 font-sans font-light">Translates derivatives greeks and binary settlements into highly accessible, race-first interactive mechanics.</p>
                </div>
              </div>
              <p>
                By organizing complex timing grids and telemetry splits into a cohesive trading terminal, we prove that high-velocity physical events represent viable, predictable, and exceptionally engaging financial structures.
              </p>
            </div>
          )}

        </div>
      </div>
      
    </div>
  );
}
