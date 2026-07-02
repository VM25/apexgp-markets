import React, { useState } from "react";
import { HelpCircle, ArrowRight, ArrowLeft, CheckCircle2, X, BookOpen, Layers, Sigma, ShieldAlert, Award, TrendingUp, Info, HelpCircle as HelpIcon } from "lucide-react";

interface BeginnerOnboardingProps {
  onClose: () => void;
}

type TabType = "BEGINNER" | "ADVANCED" | "QUANT_NOTES" | "GLOSSARY";

export default function BeginnerOnboarding({ onClose }: BeginnerOnboardingProps) {
  const [activeTab, setActiveTab] = useState<TabType>("BEGINNER");
  const [activeStep, setActiveStep] = useState<number>(0);
  const [selectedGlossaryTerm, setSelectedGlossaryTerm] = useState<number>(0);

  const handleSkip = () => {
    localStorage.setItem("apexgp_tutorial_completed", "true");
    onClose();
  };

  const handleFinish = () => {
    localStorage.setItem("apexgp_tutorial_completed", "true");
    onClose();
  };

  // 1. Beginner Tab Steps (Core Concepts)
  const beginnerSteps = [
    {
      title: "1. What is an Event Contract?",
      content: "Instead of standard sportsbooks or legacy derivatives, ApexGP operates on event contracts that settle to absolute binary values: $1.00 if the outcome happens, or $0.00 if it fails. The current contract price represents the market's implied probability (e.g. a contract priced at $0.62 represents a 62% implied probability of occurring).",
      example: (
        <div className="space-y-2">
          <span className="text-terminal-blue-light font-bold block uppercase text-micro tracking-wider">CANONICAL WORKED PAYOUT EXAMPLE (BUY YES):</span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-micro text-slate-350 bg-carbon-black/60 p-2.5 rounded border border-white/5">
            <div>Contracts Quantity: <span className="text-white font-extrabold">100 Contracts</span></div>
            <div>Purchase Price (Ask): <span className="text-white font-extrabold">$0.62</span></div>
            <div className="col-span-2 border-b border-white/10 pb-1">Notional Capital Allocated: <span className="text-terminal-blue-light font-extrabold">100 * $0.62 = $62.00</span></div>
            
            <div className="space-y-0.5 mt-1 border-r border-white/5 pr-2">
              <span className="text-terminal-green-light font-bold block text-micro uppercase">▲ EVENT SUCCEEDS (TRUE)</span>
              <div>Contract Settle: <span className="text-white font-bold">$1.00 / contract</span></div>
              <div>Gross Payoff: <span className="text-white font-mono font-bold">100 * $1.00 = $100.00</span></div>
              <div className="text-terminal-green-light font-extrabold font-mono mt-0.5">Net Profit: +$38.00</div>
            </div>
            
            <div className="space-y-0.5 mt-1 pl-2">
              <span className="text-terminal-red font-bold block text-micro uppercase">▼ EVENT FAILS (FALSE)</span>
              <div>Contract Settle: <span className="text-white font-bold">$0.00 / contract</span></div>
              <div>Gross Payoff: <span className="text-white font-mono font-bold">$0.00</span></div>
              <div className="text-terminal-red font-extrabold font-mono mt-0.5">Net Loss: -$62.00</div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "2. Bid, Ask & Market Microstructure",
      content: "Prices do not jump arbitrarily; they are managed by a Synthetic Automated Market Maker (AMM) that maintains a continuous bid-ask spread around calculated mid-prices. The Bid is the price you sell at to exit early; the Ask is the price you pay to buy in. The small gap between them is the Spread, compensating the market maker for risk.",
      example: (
        <div className="space-y-1.5 text-micro font-mono">
          <span className="text-terminal-blue-light font-bold block uppercase text-micro tracking-wider mb-1">TERMINOLOGY FOCUS:</span>
          <div className="bg-carbon-black/60 p-2 rounded border border-white/5 space-y-1">
            <div>• <strong className="text-white">ASK (Offer):</strong> The lowest price the AMM accepts. This is your buy-in price ($Mid + 0.02$).</div>
            <div>• <strong className="text-white">BID:</strong> The highest price the AMM pays. This is your immediate liquidation price ($Mid - 0.02$).</div>
            <div>• <strong className="text-white">SPREAD:</strong> The difference (Ask - Bid). Held constant at exactly $0.04. Track incidents or retirements trigger trading halts rather than widening spreads.</div>
          </div>
        </div>
      )
    },
    {
      title: "3. Historical Telemetry Replay",
      content: "ApexGP is a Historical Replay Market. You are trading markets on historical 2025 F1 races as if they were live, using official FIA stats. Race outcomes, incidents, and championship standings resolve EXACTLY as they occurred in reality. Market prices shift dynamically lap-by-lap based on telemetry replay, but final outcomes are mathematically locked.",
      example: (
        <div className="space-y-1.5 text-micro font-sans font-light">
          <span className="text-terminal-blue-light font-bold block uppercase text-micro tracking-wider mb-1">PROGRESSIVE TIMELINE:</span>
          <p className="leading-relaxed text-slate-300">
            The telemetry progress timeline is spoiler-safe. Future events remain masked as <strong className="text-white font-mono">"Await telemetry"</strong> until the replay reaches that specific lap. Completed laps unlock exact incidents, DRS triggers, and pit summaries to maintain trading immersion.
          </p>
        </div>
      )
    },
    {
      title: "4. Analytics & Race Settlement",
      content: "When a race finishes, the market halts immediately. Click 'Review Market Replay' to open the spoiler-safe Race Settlement report. Rather than standard dashboard summaries, ApexGP shows a complete quantitative audit of your portfolio risk, entry vs. exit spreads, contract resolutions, and final MTM changes.",
      example: (
        <div className="space-y-1.5 text-micro font-mono">
          <span className="text-terminal-blue-light font-bold block uppercase text-micro tracking-wider mb-1">SETTLEMENT FLOW:</span>
          <div className="bg-carbon-black/60 p-2 rounded border border-white/5 space-y-0.5 text-slate-350">
            <div>• <strong className="text-white">Official Results:</strong> Checked against official 2025 FIA race data.</div>
            <div>• <strong className="text-white">Portfolio Impact:</strong> Every contract pays out to exactly $1.00 or $0.00.</div>
            <div>• <strong className="text-white">Expand Ledger:</strong> Inspect detailed entries, settlement prices, and PnL.</div>
          </div>
        </div>
      )
    }
  ];

  // 2. Advanced Tab Steps (Advanced Mechanics)
  const advancedSteps = [
    {
      title: "1. Portfolio Exposure Boundaries",
      content: "To emulate institutional quant desks, ApexGP enforces strict real-time exposure caps to prevent overallocation on single risks. You cannot buy unlimited quantities of a single contract or driver. These risk gates operate automatically at order submission.",
      example: (
        <div className="space-y-2">
          <span className="text-terminal-blue-light font-bold block uppercase text-micro tracking-wider">RISK LIMIT THRESHOLDS:</span>
          <div className="grid grid-cols-2 gap-2 text-micro font-mono">
            <div className="bg-carbon-black/80 p-2 border border-white/5 rounded">
              <span className="text-slate-500 block text-micro uppercase font-bold">SINGLE CONTRACT</span>
              <span className="text-terminal-red font-bold block mt-0.5">15% Max Exposure</span>
              <p className="text-micro text-slate-400 mt-1 leading-normal">Max capital allocation on one contract outcome.</p>
            </div>
            <div className="bg-carbon-black/80 p-2 border border-white/5 rounded">
              <span className="text-slate-500 block text-micro uppercase font-bold">PORTFOLIO AT RISK</span>
              <span className="text-terminal-red font-bold block mt-0.5">30% Max at Risk</span>
              <p className="text-micro text-slate-400 mt-1 leading-normal">Max cumulative risk across all open contracts.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "2. Championship Futures Contracts",
      content: "Championship Futures track the season-wide Drivers' and Constructors' titles across the entire 24-race 2025 calendar. Unlike individual race contracts that resolve at the checker flag, Futures remain open, pricing dynamically after every GP finish, and resolve ONLY at the final lap of the final Abu Dhabi GP.",
      example: (
        <div className="space-y-1.5 text-micro font-sans font-light">
          <span className="text-terminal-blue-light font-bold block uppercase text-micro tracking-wider mb-1">LONG-TERM RISK:</span>
          <p className="leading-relaxed text-slate-350">
            Futures contracts have a strict minimum pricing floor of <strong className="text-white font-mono">$0.04</strong> and bid/ask spreads to prevent invalid zero-bid scenarios. They reprice based on championship points standing, mathematical momentum, and remaining rounds.
          </p>
        </div>
      )
    },
    {
      title: "3. Telemetry-Driven Repricing",
      content: "The pricing engine monitors race telemetry in real-time. Position gains, pit-stops, tyre age, interval splits, safety car deployments, and DNF retirements are instantly translated into probability updates. You are trading in an environment directly linked to physical race states.",
      example: (
        <div className="space-y-1 text-micro font-mono">
          <span className="text-terminal-blue-light font-bold block uppercase text-micro tracking-wider mb-1">TELEMETRY INPUTS TO PRICE:</span>
          <div className="bg-carbon-black/60 p-2 rounded border border-white/5 space-y-1 text-micro">
            <div>• <strong className="text-white">Tyre Age & Pit Icon (🔧):</strong> Older tyres degrade lap times, lowering winning probability.</div>
            <div>• <strong className="text-white">Safety Car (SC):</strong> Bunches the field, expanding uncertainty and triggering trading halts.</div>
            <div>• <strong className="text-white">DRS Flag:</strong> Active DRS increases overtake probability, altering delta sensitivities.</div>
          </div>
        </div>
      )
    }
  ];

  // 3. Quant Notes Tab Steps (Quant Math Notes)
  const quantSteps = [
    {
      title: "1. Options Greeks in Focus Mode",
      content: "Rather than solving continuous partial differential equations (PDEs), ApexGP calculates robust analytical proxies client-side to represent binary option contract sensitivities. Switch to Focus Mode in the terminal nav to display Options Greeks (Delta, Theta, Implied Volatility) on the contracts chain.",
      example: (
        <div className="space-y-2">
          <span className="text-terminal-blue-light font-bold block uppercase text-micro tracking-wider">GREEKS EXPOSURE DICTIONARY:</span>
          <div className="grid grid-cols-3 gap-1.5 text-micro leading-snug font-mono">
            <div className="bg-carbon-black p-1.5 rounded border border-white/5 text-center">
              <span className="text-terminal-blue block font-extrabold text-micro">Δ (Delta)</span>
              <span className="text-slate-400 block mt-0.5 text-micro leading-none">Sensitivity to odds shift</span>
            </div>
            <div className="bg-carbon-black p-1.5 rounded border border-white/5 text-center">
              <span className="text-terminal-green-light block font-extrabold text-micro">Θ (Theta)</span>
              <span className="text-slate-400 block mt-0.5 text-micro leading-none">Uncertainty decay per lap</span>
            </div>
            <div className="bg-carbon-black p-1.5 rounded border border-white/5 text-center">
              <span className="text-terminal-gold block font-extrabold text-micro">IV Index</span>
              <span className="text-slate-400 block mt-0.5 text-micro leading-none">Implied track uncertainty</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "2. Bayesian Likelihood Convergence Model",
      content: "Contracts pricing maps dynamic telemetry onto prior standings via a mathematical convergence factor 'w'. As the race approaches completion, 'w' converges exponentially to boundary states, forcing pricing to exact settlement values ($1.00 or $0.00).",
      example: (
        <div className="space-y-2">
          <span className="text-terminal-blue-light font-bold block uppercase text-micro tracking-wider">EXPONENTIAL CONVERGENCE CONSTRUCT:</span>
          <code className="text-terminal-blue-light block text-micro py-1 px-2 bg-carbon-black border border-white/5 rounded font-bold font-mono">
            {"P(θ | Telemetry) = (1 - w) * Prior + w * RealizedOutcome"}
          </code>
          <span className="text-slate-400 text-micro block font-sans font-light leading-relaxed">
            Where <strong className="text-white font-mono">w = (lap / totalLaps)^1.6</strong> represents the information leakage exponent, simulating the asymptotic resolution of uncertainty as the checker flag approaches.
          </span>
        </div>
      )
    }
  ];

  // 4. Glossary Tab (Interactive Glossary Grid)
  const glossaryTerms = [
    {
      term: "Binary Contract",
      category: "Structure",
      definition: "An event-driven derivative that resolves strictly to either $1.00 (if the outcome occurs) or $0.00 (if the outcome fails).",
      racing: "e.g., 'Hamilton P1-P3 Podium' contract.",
      quant: "Payoff = I(Outcome) where I is the indicator function."
    },
    {
      term: "Ask Price",
      category: "Microstructure",
      definition: "The lowest price at which market makers are willing to sell the contract. This is your purchase price.",
      racing: "The price you pay to enter a YES position or buy back a Lay.",
      quant: "Ask = Mid + (Spread / 2)"
    },
    {
      term: "Bid Price",
      category: "Microstructure",
      definition: "The highest price at which market makers are willing to buy the contract. This is your early exit price.",
      racing: "The price you receive if you click 'Sell / Exit' to close out early.",
      quant: "Bid = Mid - (Spread / 2)"
    },
    {
      term: "Bid-Ask Spread",
      category: "Microstructure",
      definition: "The difference between the Ask price and the Bid price. Represents the cost of immediate liquidity.",
      racing: "Spreads are held constant at $0.04, while Safety Cars trigger complete trading halts.",
      quant: "Spread = Ask - Bid = 0.04"
    },
    {
      term: "Mark-to-Market (MTM)",
      category: "Portfolio",
      definition: "Valuing portfolio assets based on current bid prices rather than original acquisition costs.",
      racing: "Your net portfolio value fluctuates live lap-by-lap as driver positions shift.",
      quant: "MTM = Cash + Sum(Contracts_i * Bid_i)"
    },
    {
      term: "Risk Gateway",
      category: "Risk Control",
      definition: "Boundary filters enforcing capital limits on single drivers or general exposure caps.",
      racing: "Enforces max 15% on a single driver, and max 30% aggregate portfolio at risk.",
      quant: "Allocation_Limit = Min(15% * Portfolio, Max_Loss_Bound)"
    },
    {
      term: "Delta (Δ)",
      category: "Greeks",
      definition: "The rate of change of contract price with respect to underlying telemetry probability shifts.",
      racing: "High Delta means a single overtake shifts contract price significantly.",
      quant: "Delta = Mid * (1 - Mid) * lambda (Analytic Proxy)"
    },
    {
      term: "Theta (Θ)",
      category: "Greeks",
      definition: "The rate of time decay of the contract's premium as the race draws closer to completion.",
      racing: "A leading driver's P1 YES contract decays slowly toward $1.00 as laps run out.",
      quant: "Theta = (isLeader ? 1 : -1) * Mid * (1 - Mid) / (lapsRemaining + 1)"
    },
    {
      term: "Bayesian Convergence",
      category: "Probability",
      definition: "Blending prior historical parameters with real-time telemetry inputs.",
      racing: "Early laps depend on historical grids. Late laps match physical telemetry.",
      quant: "w = (lap/totalLaps)^1.6 convergence leakage factor."
    }
  ];

  const getActiveSteps = () => {
    switch (activeTab) {
      case "BEGINNER": return beginnerSteps;
      case "ADVANCED": return advancedSteps;
      case "QUANT_NOTES": return quantSteps;
      default: return [];
    }
  };

  const steps = getActiveSteps();
  const currentStep = steps[activeStep] || steps[0];

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setActiveStep(0);
  };

  const handleNext = () => {
    if (activeTab === "GLOSSARY") {
      handleFinish();
      return;
    }
    if (activeStep < steps.length - 1) {
      setActiveStep(prev => prev + 1);
    } else {
      if (activeTab === "BEGINNER") {
        handleTabChange("ADVANCED");
      } else if (activeTab === "ADVANCED") {
        handleTabChange("QUANT_NOTES");
      } else if (activeTab === "QUANT_NOTES") {
        handleTabChange("GLOSSARY");
      }
    }
  };

  const handlePrev = () => {
    if (activeTab === "GLOSSARY") {
      handleTabChange("QUANT_NOTES");
      setActiveStep(1);
      return;
    }
    if (activeStep > 0) {
      setActiveStep(prev => prev - 1);
    } else {
      if (activeTab === "QUANT_NOTES") {
        handleTabChange("ADVANCED");
        setActiveStep(2);
      } else if (activeTab === "ADVANCED") {
        handleTabChange("BEGINNER");
        setActiveStep(3);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-carbon-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none font-mono">
      <div className="relative max-w-4xl w-full bg-carbon-dark border border-terminal-blue/20 rounded-lg p-6 shadow-[0_0_40px_rgba(0,122,204,0.15)] flex flex-col justify-between h-[510px] min-h-[510px] max-h-[510px] overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-white/5 pb-2.5 shrink-0">
          <span className="text-white font-extrabold text-micro uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-terminal-blue animate-pulse" />
            ApexGP Guided Learning Workspace // Institutional Tutorial
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSkip}
              className="text-micro font-bold text-slate-500 hover:text-slate-300 uppercase cursor-pointer transition-colors border border-white/5 px-2 py-0.5 rounded bg-white/2 hover:bg-white/5"
            >
              Skip Tutorial
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/5 text-slate-500 hover:text-white rounded cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/5 shrink-0 select-none bg-carbon-black/20 mt-2 rounded overflow-hidden">
          {[
            { id: "BEGINNER", label: "Core Concepts", icon: <HelpCircle className="w-3 h-3" /> },
            { id: "ADVANCED", label: "Advanced Mechanics", icon: <Layers className="w-3 h-3" /> },
            { id: "QUANT_NOTES", label: "Quant Math Notes", icon: <Sigma className="w-3 h-3" /> },
            { id: "GLOSSARY", label: "Contract Glossary", icon: <Info className="w-3 h-3" /> }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id as TabType)}
              className={`flex-1 py-2 font-bold text-micro flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-b-2 ${activeTab === t.id ? "bg-carbon-light text-white border-terminal-blue" : "border-transparent text-slate-500 hover:text-slate-400"}`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Workspace Body */}
        <div className="flex-1 flex gap-4 my-4 overflow-hidden min-h-0">
          
          {activeTab !== "GLOSSARY" ? (
            <>
              {/* Left Topic Selector */}
              <div className="w-48 shrink-0 border-r border-white/5 pr-3 space-y-1 select-none overflow-y-auto">
                {steps.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveStep(idx)}
                    className={`w-full p-2.5 text-left font-bold rounded text-micro leading-tight block cursor-pointer transition-all border-l-2 ${activeStep === idx ? "bg-white/5 text-white border-l-terminal-blue" : "border-l-transparent text-slate-500 hover:text-slate-400"}`}
                  >
                    {s.title.substring(3)}
                  </button>
                ))}
              </div>

              {/* Right Explanation Content */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 select-text">
                <div className="flex justify-between items-center uppercase font-bold text-micro text-slate-550 tracking-wider">
                  <span>ACTIVE DESK: {activeTab} // SEGMENT</span>
                  <span className="font-data">STEP {activeStep + 1} OF {steps.length}</span>
                </div>
                
                <h4 className="text-white font-extrabold text-micro uppercase tracking-wider">
                  {currentStep?.title}
                </h4>
                
                <p className="text-slate-300 leading-relaxed font-sans font-light text-micro">
                  {currentStep?.content}
                </p>
                
                <div className="bg-carbon-black/60 p-3 border border-white/10 rounded relative overflow-hidden">
                  {currentStep?.example}
                </div>
              </div>
            </>
          ) : (
            /* Glossary Grid Widescreen view */
            <div className="flex-1 flex gap-4 overflow-hidden select-text">
              {/* Glossary list */}
              <div className="w-64 shrink-0 border-r border-white/5 pr-3 space-y-1 select-none overflow-y-auto">
                {glossaryTerms.map((g, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedGlossaryTerm(idx)}
                    className={`w-full p-2 text-left font-bold rounded text-micro leading-tight flex justify-between items-center cursor-pointer transition-all border-l-2 ${selectedGlossaryTerm === idx ? "bg-white/5 text-white border-l-terminal-blue" : "border-l-transparent text-slate-500 hover:text-slate-400"}`}
                  >
                    <span>{g.term}</span>
                    <span className="text-micro text-slate-650 font-bold uppercase">{g.category}</span>
                  </button>
                ))}
              </div>

              {/* Glossary detailed definitions card */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 font-mono">
                <div className="flex justify-between items-center uppercase font-bold text-micro text-slate-550 tracking-wider">
                  <span>SYSTEM DICTIONARY // INDEX</span>
                  <span className="font-data">TERM {selectedGlossaryTerm + 1} OF {glossaryTerms.length}</span>
                </div>

                <div className="bg-carbon-black/40 border border-white/5 rounded p-3 space-y-3">
                  <div className="flex justify-between items-baseline">
                    <h4 className="text-terminal-blue-light font-extrabold text-label uppercase tracking-wider">
                      {glossaryTerms[selectedGlossaryTerm].term}
                    </h4>
                    <span className="px-2 py-0.5 bg-terminal-blue/10 border border-terminal-blue/20 text-terminal-blue-light rounded font-bold text-micro uppercase">
                      {glossaryTerms[selectedGlossaryTerm].category}
                    </span>
                  </div>

                  <div className="space-y-2 text-micro">
                    <div className="text-slate-200 font-sans font-light leading-relaxed">
                      <span className="text-micro text-slate-550 font-bold uppercase block tracking-wider font-mono">DEFINITION:</span>
                      {glossaryTerms[selectedGlossaryTerm].definition}
                    </div>

                    <div className="border-t border-white/5 pt-2 grid grid-cols-2 gap-2 text-micro">
                      <div>
                        <span className="text-micro text-slate-500 font-bold uppercase block tracking-wider mb-0.5">RACING CONTEXT:</span>
                        <span className="text-slate-350">{glossaryTerms[selectedGlossaryTerm].racing}</span>
                      </div>
                      <div>
                        <span className="text-micro text-slate-500 font-bold uppercase block tracking-wider mb-0.5">QUANT LOGIC:</span>
                        <span className="text-slate-350">{glossaryTerms[selectedGlossaryTerm].quant}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-terminal-blue/5 border border-terminal-blue/15 rounded p-2.5 text-micro text-slate-400 flex items-start gap-2 font-sans font-light">
                  <HelpIcon className="w-3.5 h-3.5 text-terminal-blue shrink-0 mt-0.5" />
                  <p>
                    Glossary terms are integrated natively as tooltips across timing grids, order panels, and option chains. Hover over dotted underlines anywhere in default workspace mode to see instant definitions.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Fixed Footer Navigation */}
        <div className="flex justify-between items-center pt-3 border-t border-white/5 shrink-0 h-10 min-h-[40px]">
          <span className="text-micro text-slate-550 font-bold tracking-wider uppercase select-none">
            {activeTab} PANEL {activeTab !== "GLOSSARY" ? `· STEP ${activeStep + 1} OF ${steps.length}` : ""}
          </span>
          <div className="flex gap-2">
            {(activeStep > 0 || activeTab !== "BEGINNER") && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded font-bold text-micro uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all border border-white/10"
              >
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="px-3 py-1.5 bg-terminal-blue hover:bg-terminal-blue-light text-white rounded font-bold text-micro uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all border border-terminal-blue-light"
            >
              {activeTab === "GLOSSARY" ? (
                <>Finish <CheckCircle2 className="w-3 h-3 text-white" /></>
              ) : (
                <>Next <ArrowRight className="w-3 h-3" /></>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
