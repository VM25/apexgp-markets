import React, { useState } from "react";
import { Cpu, Landmark, Activity, GraduationCap, ShieldAlert, BarChart3 } from "lucide-react";

interface LandingViewProps {
  onEnterTerminal: () => void;
}

export default function LandingView({ onEnterTerminal }: LandingViewProps) {
  const [isCollapsing, setIsCollapsing] = useState<boolean>(false);

  const handleEnterClick = () => {
    setIsCollapsing(true);
    setTimeout(() => {
      onEnterTerminal();
    }, 350);
  };

  return (
    <div className={`relative min-h-screen bg-carbon-black flex flex-col items-center justify-center p-6 overflow-hidden select-none transition-all duration-350 font-mono text-micro text-slate-450 ${isCollapsing ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"}`}>
      
      {/* Background Quantitative Telemetry Feed Stream (Academic Atmosphere) */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none text-micro leading-relaxed p-8 overflow-hidden">
        {Array.from({ length: 50 }).map((_, idx) => (
          <div key={idx} className="whitespace-nowrap truncate">
            {`[BAYESIAN_UPDATE] round=${idx + 1} prior_prob=${(0.18 + idx * 0.016).toFixed(4)} alpha=${(1.2 + idx * 0.1).toFixed(2)} beta=${(4.5 - idx * 0.05).toFixed(2)} posterior=${(0.21 + idx * 0.012).toFixed(4)}`}
            {` [TELEMETRY_LOG] lap_speed_ms=${(75.5 + Math.sin(idx) * 4.2).toFixed(2)} weather_temp_c=${(22.4 + Math.cos(idx) * 1.5).toFixed(1)} safety_car_trigger_prob=${(0.08 + idx * 0.005).toFixed(4)}`}
          </div>
        ))}
      </div>

      {/* Structured Academic Container */}
      <div className="relative z-10 max-w-5xl w-full bg-carbon-dark/90 border border-white/5 rounded p-8 md:p-12 shadow-2xl flex flex-col gap-10">
        
        {/* Academic Meta Header */}
        <div className="border-b border-white/5 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1.5">
            <span className="text-micro text-slate-500 font-extrabold uppercase tracking-widest block leading-none">
              APEXGP MARKETS // EVENT MICROSTRUCTURE STUDY
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-wider text-white uppercase leading-none">
              APEXGP MARKETS
            </h1>
            <p className="text-slate-400 text-xs font-light leading-relaxed max-w-2xl font-sans mt-1">
              A Quantitative Event Market Research Platform studying dynamic probability pricing, portfolio risk management, and market microstructure.
            </p>
          </div>
          
          {/* Stevens Academic Attribution Badge */}
          <div className="flex items-start gap-2.5 bg-white/3 border border-white/5 rounded p-2.5 max-w-xs shrink-0 select-text">
            <GraduationCap className="w-5 h-5 text-terminal-blue shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-tight">
              <span className="text-white font-bold block text-micro">Vatsal Maniar</span>
              <span className="text-slate-400 block text-micro">M.S. Financial Engineering</span>
              <span className="text-slate-500 block text-micro">Stevens Institute of Technology</span>
            </div>
          </div>
        </div>

        {/* Abstract & Motivation ("What, Why, Why Care") */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-sans">
          
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-white font-bold font-mono text-micro uppercase tracking-wider border-b border-white/5 pb-1.5">
              <Cpu className="w-3.5 h-3.5 text-terminal-blue" />
              1. What is this?
            </div>
            <p className="text-slate-400 text-micro leading-relaxed font-light">
              ApexGP Markets is a specialized research environment that models dynamic binary derivative event contracts. Built using the complete, official 2025 Formula One season calendar, it translates real-time racing incidents and timing telemetry directly into liquid probability books.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-white font-bold font-mono text-micro uppercase tracking-wider border-b border-white/5 pb-1.5">
              <Landmark className="w-3.5 h-3.5 text-terminal-blue" />
              2. Why was it built?
            </div>
            <p className="text-slate-400 text-micro leading-relaxed font-light">
              The project evaluates how physical real-world telemetry feeds can be used to build real-time pricing pipelines. By mapping driver standings and safety car incidents to continuous Bayesian belief networks, it demonstrates probability repricing, event-driven settlement, and portfolio hedging under extreme drawdowns.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-white font-bold font-mono text-micro uppercase tracking-wider border-b border-white/5 pb-1.5">
              <Activity className="w-3.5 h-3.5 text-terminal-blue" />
              3. Why should one care?
            </div>
            <p className="text-slate-400 text-micro leading-relaxed font-light">
              This sandbox serves as a robust proof-of-concept for quantitative finance professionals and market architects. It enforces strict portfolio risk constraints—limiting maximum capital exposure to 30% and single-contract concentrations to 15%—simulating institutional risk desk behaviors in a gameless terminal.
            </p>
          </div>

        </div>

        {/* The Three Pillars Grid */}
        <div className="bg-carbon-surface border border-white/5 rounded p-5 space-y-4">
          <span className="text-micro text-slate-500 font-extrabold uppercase tracking-widest block border-b border-white/5 pb-2">
            CORE METHODOLOGY PILLARS
          </span>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Pillar 1: Market Design */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-terminal-blue font-bold tracking-wider uppercase">
                <span className="w-1.5 h-1.5 bg-terminal-blue rounded-full" />
                Market Design
              </div>
              <ul className="space-y-1.5 font-data text-slate-350">
                <li className="flex justify-between items-center bg-carbon-black/35 px-2 py-1 rounded">
                  <span>Binary Event Contracts</span>
                  <span className="text-white font-bold">$0.00 / $1.00</span>
                </li>
                <li className="flex justify-between items-center bg-carbon-black/35 px-2 py-1 rounded">
                  <span>Probability Repricing</span>
                  <span className="text-white font-bold">Continuous Mid</span>
                </li>
                <li className="flex justify-between items-center bg-carbon-black/35 px-2 py-1 rounded">
                  <span>Bid/Ask Evolution</span>
                  <span className="text-white font-bold">Dynamic Spreads</span>
                </li>
                <li className="flex justify-between items-center bg-carbon-black/35 px-2 py-1 rounded">
                  <span>Market Microstructure</span>
                  <span className="text-white font-bold">Order Ledger</span>
                </li>
              </ul>
            </div>

            {/* Pillar 2: Quantitative Models */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-terminal-gold font-bold tracking-wider uppercase">
                <span className="w-1.5 h-1.5 bg-terminal-gold rounded-full" />
                Quantitative Models
              </div>
              <ul className="space-y-1.5 font-data text-slate-350">
                <li className="flex justify-between items-center bg-carbon-black/35 px-2 py-1 rounded">
                  <span>Bayesian Updating</span>
                  <span className="text-white font-bold">Posterior Priors</span>
                </li>
                <li className="flex justify-between items-center bg-carbon-black/35 px-2 py-1 rounded">
                  <span>Risk Management</span>
                  <span className="text-white font-bold">30% Max Exp</span>
                </li>
                <li className="flex justify-between items-center bg-carbon-black/35 px-2 py-1 rounded">
                  <span>Portfolio Construction</span>
                  <span className="text-white font-bold">Cash Sandbox</span>
                </li>
                <li className="flex justify-between items-center bg-carbon-black/35 px-2 py-1 rounded">
                  <span>Event-Driven Pricing</span>
                  <span className="text-white font-bold">Telemetry Decay</span>
                </li>
              </ul>
            </div>

            {/* Pillar 3: Historical Replay */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-terminal-green-light font-bold tracking-wider uppercase">
                <span className="w-1.5 h-1.5 bg-terminal-green-light rounded-full" />
                Historical Replay
              </div>
              <ul className="space-y-1.5 font-data text-slate-350">
                <li className="flex justify-between items-center bg-carbon-black/35 px-2 py-1 rounded">
                  <span>Official 2025 F1 Season</span>
                  <span className="text-white font-bold">Historical Data</span>
                </li>
                <li className="flex justify-between items-center bg-carbon-black/35 px-2 py-1 rounded">
                  <span>24 Grand Prix Rounds</span>
                  <span className="text-white font-bold">Melbourne ➔ Yas Marina</span>
                </li>
                <li className="flex justify-between items-center bg-carbon-black/35 px-2 py-1 rounded">
                  <span>Race-by-Race Settlement</span>
                  <span className="text-white font-bold">FIA Results Settle</span>
                </li>
                <li className="flex justify-between items-center bg-carbon-black/35 px-2 py-1 rounded">
                  <span>Championship Progression</span>
                  <span className="text-white font-bold">Driver / Construct Points</span>
                </li>
              </ul>
            </div>

          </div>
        </div>

        {/* Primary Call to Action */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center pt-2">
          <div className="flex flex-col gap-1 text-micro text-slate-500 font-sans leading-normal">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-terminal-green-light rounded-full animate-pulse" />
              <span>Closed Sandbox Environment</span>
            </div>
            <span>No real money operations. All trades resolved in virtual Sandbox USD liquidity.</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleEnterClick}
              className="w-full sm:w-auto px-8 py-3 bg-terminal-blue hover:bg-terminal-blue-light text-white font-mono font-bold text-xs tracking-widest uppercase rounded cursor-pointer transition-all duration-200 active:scale-[0.98] shadow-lg shadow-terminal-blue/15 text-center"
            >
              Enter Market Terminal ➔
            </button>
          </div>
        </div>

      </div>

      {/* Global Academic Footer */}
      <div className="absolute bottom-4 text-center z-10 text-micro text-slate-600 font-mono tracking-wider font-bold">
        APEXGP MARKETS // STEVENS FE RESEARCH PORTFOLIO PROJECT • © 2026 VATSAL MANIAR
      </div>

    </div>
  );
}
