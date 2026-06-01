import React, { useState, useEffect } from "react";
import { Contract } from "../../hooks/useSimulation";
import { Position } from "../../hooks/usePortfolio";
import { ArrowUpRight, ArrowDownRight, ShieldAlert, CheckCircle2, Sigma, Activity, HelpCircle } from "lucide-react";

interface MarketTabProps {
  contracts: { [id: string]: Contract };
  positions: { [id: string]: Position };
  cash: number;
  portfolioValue: number;
  assetsValue: number;
  isHalted: boolean;
  buyContracts: (id: string, qty: number, side?: "BUY" | "LAY") => { success: boolean; message: string };
  sellContracts: (posKey: string, qty: number) => { success: boolean; message: string };
  isFocusMode?: boolean;
}

export default function MarketTab({
  contracts, positions, cash, portfolioValue, assetsValue, isHalted, buyContracts, sellContracts, isFocusMode
}: MarketTabProps) {
  
  const [selectedCategory, setSelectedCategory] = useState<string>("WINNER");
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [tradeAction, setTradeAction] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState<number>(0);
  const [tradeResult, setTradeResult] = useState<{ success: boolean; message: string } | null>(null);
  const showGreeks = !!isFocusMode;
  const [backingSide, setBackingSide] = useState<"YES" | "NO">("YES");
  const [showSettlementInfoModal, setShowSettlementInfoModal] = useState<boolean>(false);
  const [showPayoutCalc, setShowPayoutCalc] = useState<boolean>(false);

  const activeContracts = Object.values(contracts).filter(c => c.type === selectedCategory);
  
  useEffect(() => {
    // Keep selection clean on category change unless matching
    if (selectedContractId) {
      const currentValid = activeContracts.find(c => c.id === selectedContractId);
      if (!currentValid) {
        setSelectedContractId("");
      }
    }
    setTradeResult(null);
  }, [selectedCategory, contracts]);

  const selectedContract = contracts[selectedContractId];
  const posKey = selectedContractId ? (backingSide === "NO" ? `${selectedContractId}_NO` : selectedContractId) : "";
  const activePosition = positions[posKey];

  // Ticket calculations based on Backing Side (YES vs NO/LAY)
  const price = selectedContract 
    ? (backingSide === "NO" 
        ? (tradeAction === "BUY" ? 1.00 - selectedContract.bid : 1.00 - selectedContract.ask)
        : (tradeAction === "BUY" ? selectedContract.ask : selectedContract.bid))
    : 0.10;
  const cost = quantity * price;
  
  // Risk validations
  const nextAssetsVal = assetsValue + (tradeAction === "BUY" ? cost : -cost);
  const nextExposurePct = portfolioValue > 0 ? (nextAssetsVal / portfolioValue) * 100 : 0;
  const isExposureViolated = tradeAction === "BUY" && nextExposurePct > 30.01;

  const currentContractPrice = selectedContract ? selectedContract.bid : 0;
  const currentPosPrice = selectedContract ? (backingSide === "NO" ? (1.00 - selectedContract.ask) : currentContractPrice) : 0;
  const existingCost = activePosition ? activePosition.qty * currentPosPrice : 0;
  const nextSingleCost = existingCost + (tradeAction === "BUY" ? cost : -cost);
  const nextSingleExposurePct = portfolioValue > 0 ? (nextSingleCost / portfolioValue) * 100 : 0;
  const isSingleViolated = tradeAction === "BUY" && nextSingleExposurePct > 15.01;

  const isCashViolated = tradeAction === "BUY" && cost > cash;
  const isSellViolated = tradeAction === "SELL" && (!activePosition || activePosition.qty < quantity);

  const canExecute = selectedContract && !isHalted && !selectedContract.settled && quantity > 0 &&
                     !isExposureViolated && !isSingleViolated && !isCashViolated && !isSellViolated;

  const handleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canExecute || !selectedContract) return;

    let res;
    if (tradeAction === "BUY") {
      res = buyContracts(selectedContractId, quantity, backingSide === "NO" ? "LAY" : "BUY");
    } else {
      res = sellContracts(posKey, quantity);
    }

    setTradeResult(res);
    if (res.success) {
      // Clear standard trade result after 3 seconds
      setTimeout(() => setTradeResult(null), 3000);
    }
  };

  // Mocking Bayesian likelihood factors for the quant box based on telemetry
  const getBayesianMetrics = () => {
    if (!selectedContract) return { prior: 0, likelihood: 0, posterior: 0 };
    const posterior = selectedContract.mid;
    
    // Deconstruct posterior = prior * likelihood (simplified for visualization)
    let prior = selectedContract.prevMid;
    let likelihood = prior > 0 ? roundToThree(posterior / prior) : 1.0;
    
    return { prior, likelihood, posterior };
  };

  const roundToThree = (num: number) => Math.round(num * 1000) / 1000;
  const bayes = getBayesianMetrics();

  return (
    <div className="h-full flex flex-col md:flex-row gap-3.5 select-none min-h-[480px]">
      
      {/* 1. LEFT SIDEBAR: MINIMAL MONOCHROME FILTER LIST */}
      <div className="w-full md:w-40 shrink-0 flex flex-row md:flex-col gap-1 pr-0 md:pr-1">
        {[
          { id: "WINNER", label: "Race Winner" },
          { id: "PODIUM", label: "Podium Finish" },
          { id: "FASTEST_LAP", label: "Fastest Lap" },
          { id: "H2H", label: "Head-to-Head" },
          { id: "SAFETY_CAR", label: "Safety Car" },
          { id: "DNF", label: "Retirement (DNF)" }
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-2 text-left font-bold rounded text-[10px] cursor-pointer transition-colors block shrink-0 ${selectedCategory === cat.id ? "bg-terminal-blue/15 border-l border-terminal-blue text-white" : "bg-white/3 hover:bg-white/5 text-slate-400"}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 2. CENTER PIECE: DERIVATIVES EXCHANGE CHAIN TABLE */}
      <div className="flex-1 bg-carbon-surface border border-white/5 rounded p-3.5 flex flex-col min-w-0">
        <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-terminal-blue" />
            <h2 className="text-white font-bold text-[10px] uppercase tracking-wider">{selectedCategory} CONTRACT INDEX</h2>
          </div>
          <span className="text-[8px] text-slate-500 font-mono uppercase font-bold tracking-wider">EXIT PRICING RE-VALUATION (BID EXECUTION)</span>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          <table className="w-full text-left font-data text-[10px] select-none">
            <thead>
              <tr className="text-slate-500 uppercase text-[8px] border-b border-white/5 font-bold tracking-wider">
                <th className="pb-2 pl-2 w-[35%]">Contract Asset</th>
                <th className="pb-2 text-right">Implied Prob (Mid)</th>
                <th className="pb-2 text-right">Tick Chg</th>
                <th className="pb-2 text-center w-[22%]">Bid / Ask</th>
                {showGreeks && (
                  <>
                    <th className="pb-2 text-right">Delta (Δ)</th>
                    <th className="pb-2 text-right">Theta (Θ)</th>
                    <th className="pb-2 text-right">IV</th>
                  </>
                )}
                <th className="pb-2 text-right">Holdings</th>
              </tr>
            </thead>
            <tbody>
              {activeContracts.map((c) => {
                const isSelected = c.id === selectedContractId;
                const pos = positions[c.id];
                const priceChg = c.change;
                const directionClass = priceChg > 0 
                  ? "text-terminal-green-light" 
                  : (priceChg < 0 ? "text-terminal-red" : "text-slate-500");

                const settlementRule = (() => {
                  switch (c.type) {
                    case "WINNER": return "Resolves on P1 finish outcome.";
                    case "PODIUM": return "Resolves on P1-P3 podium outcome.";
                    case "FASTEST_LAP": return "Resolves on official fastest lap score.";
                    case "H2H": return "Resolves on head-to-head match finisher.";
                    case "SAFETY_CAR": return "Resolves on active Safety Car deployment.";
                    case "DNF": return "Resolves on active driver retirement.";
                    default: return "Resolves on target race outcome.";
                  }
                })();

                const currentQty = pos ? pos.qty : 0;
                const entryCost = pos ? pos.qty * pos.entryPrice : 0;
                const bestOutcome = pos ? pos.qty * (1.00 - pos.entryPrice) : 0;
                const worstOutcome = pos ? -entryCost : 0;
                const itemExposure = portfolioValue > 0 ? (currentQty * c.bid) / portfolioValue * 100 : 0;

                return (
                  <React.Fragment key={c.id}>
                    <tr
                      onClick={() => {
                        if (selectedContractId === c.id) {
                          setSelectedContractId("");
                        } else {
                          setSelectedContractId(c.id);
                          setTradeResult(null);
                        }
                      }}
                      className={`border-b border-white/5 hover:bg-white/4 cursor-pointer last:border-0 select-none transition-all duration-150 ${isSelected ? "bg-white/5 border-l-2 border-l-terminal-blue font-bold text-white" : "hover:text-slate-200"}`}
                    >
                      <td className={`pl-2 transition-all duration-150 ${isSelected ? "py-2.5" : "py-1"}`}>
                        <span className="text-terminal-blue-light font-mono font-bold block text-[9.5px] tracking-wide">{c.symbol}</span>
                        <span className={`text-[9px] font-sans font-light block mt-0.5 ${isSelected ? "text-slate-200" : "text-slate-400"}`}>{c.title}</span>
                      </td>
                      <td className={`py-1 text-right font-bold transition-all duration-150 ${isSelected ? "text-slate-100" : "text-slate-350"}`}>
                        {Math.round(c.mid * 100)}%
                      </td>
                      <td className={`py-1 text-right font-bold transition-all duration-150`}>
                        <span className={`inline-flex items-center gap-0.5 ${directionClass}`}>
                          {priceChg > 0 ? "+" : ""}{(priceChg * 100).toFixed(1)}%
                          {priceChg > 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : (priceChg < 0 ? <ArrowDownRight className="w-2.5 h-2.5" /> : null)}
                        </span>
                      </td>
                      <td className="py-1 text-center">
                        <div className="inline-flex rounded border border-white/5 bg-carbon-black overflow-hidden font-bold select-none text-[9px]">
                          <span className="px-2 py-0.5 text-terminal-green border-r border-white/5 hover:bg-terminal-green/5">${c.bid.toFixed(2)}</span>
                          <span className="px-2 py-0.5 text-terminal-blue hover:bg-terminal-blue/5">${c.ask.toFixed(2)}</span>
                        </div>
                      </td>
                      {showGreeks && (
                        <>
                          <td className="py-1 text-right text-slate-450 font-bold">{c.delta?.toFixed(3)}</td>
                          <td className={`py-1 text-right font-bold ${c.theta >= 0 ? "text-terminal-green-light" : "text-slate-450"}`}>
                            {c.theta > 0 ? "+" : ""}{c.theta?.toFixed(4)}
                          </td>
                          <td className="py-1 text-right text-slate-450 font-bold">{Math.round((c.iv || 0) * 100)}%</td>
                        </>
                      )}
                      <td className={`py-1 text-right font-bold pr-2 transition-all duration-150 ${isSelected ? "text-terminal-blue-light" : "text-slate-500"}`}>
                        {pos ? `${pos.qty}` : "--"}
                      </td>
                    </tr>
                    
                    {isSelected && (
                      <tr className="bg-carbon-black/30 border-b border-white/5 select-none">
                        <td colSpan={showGreeks ? 8 : 5} className="p-2.5">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            
                            {/* Left Box: Exposure */}
                            <div className="bg-carbon-surface/30 border border-white/5 rounded p-2 space-y-1">
                              <div className="flex justify-between items-center text-[7.5px] text-slate-500 uppercase font-bold">
                                <span>Position Exposure</span>
                                <span className="text-terminal-blue-light">LIMIT: 15%</span>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5 text-[8.5px] font-data">
                                <div>
                                  <span className="text-slate-500 block text-[6.5px] uppercase">Exposure Ratio</span>
                                  <span className={`font-bold ${itemExposure > 10 ? "text-terminal-yellow" : "text-white"}`}>
                                    {itemExposure.toFixed(1)}%
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[6.5px] uppercase">Active Quantity</span>
                                  <span className="text-white font-bold">{currentQty} units</span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Middle Box: Rule */}
                            <div className="bg-carbon-surface/30 border border-white/5 rounded p-2 space-y-1">
                              <span className="text-[7.5px] text-slate-500 uppercase font-bold block">Settlement Rule</span>
                              <p className="text-[8.5px] text-slate-350 leading-normal font-sans font-light">
                                {settlementRule}
                              </p>
                            </div>
                            
                            {/* Right Box: Outcomes */}
                            <div className="bg-carbon-surface/30 border border-white/5 rounded p-2 space-y-1">
                              <span className="text-[7.5px] text-slate-500 uppercase font-bold block">Worst vs Best Outcome</span>
                              <div className="grid grid-cols-2 gap-1.5 text-[8.5px] font-data">
                                <div>
                                  <span className="text-slate-500 block text-[6.5px] uppercase">Worst Deficit</span>
                                  <span className={`font-bold ${worstOutcome < 0 ? "text-terminal-red" : "text-slate-450"}`}>
                                    {worstOutcome < 0 ? `-$${Math.abs(worstOutcome).toFixed(0)}` : "$0.00"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[6.5px] uppercase">Best Net Gain</span>
                                  <span className={`font-bold ${bestOutcome > 0 ? "text-terminal-green-light" : "text-slate-450"}`}>
                                    {bestOutcome > 0 ? `+$${bestOutcome.toFixed(0)}` : "$0.00"}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Bottom row: Greeks Impact */}
                            <div className="lg:col-span-3 bg-carbon-surface/20 border border-white/5 rounded p-2 flex flex-col sm:flex-row gap-2 justify-between items-center text-[8.5px]">
                              <div className="text-slate-400">
                                Delta Impact: <strong className="text-white">{(c.delta || 0).toFixed(3)}</strong> | Decay (Theta): <strong className={c.theta >= 0 ? "text-terminal-green-light" : "text-slate-300"}>{(c.theta || 0).toFixed(4)}/lap</strong> | Current IV: <strong className="text-terminal-gold">{(c.iv * 100).toFixed(0)}%</strong>
                              </div>
                              <div className="text-slate-500 font-sans font-light italic">
                                Click order slip on the right rail to adjust exposure sizes.
                              </div>
                            </div>
                            
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. RIGHT SIDEBAR: QUANT TRADING EXECUTION TICKET (Sticky above fold) */}
      <div className="w-full md:w-76 md:sticky md:top-3.5 shrink-0 flex flex-col bg-carbon-surface border border-white/5 rounded p-3.5 select-none">
        {selectedContract ? (
          <form onSubmit={handleOrderSubmit} className="flex-1 flex flex-col justify-between space-y-3">
            
            <div className="space-y-3">
              <div className="border-b border-white/5 pb-2">
                <div className="flex justify-between items-center select-none">
                  <span className="text-[8.5px] text-slate-500 font-bold uppercase tracking-wider">Option Execution Slip</span>
                  <button
                    type="button"
                    onClick={() => setShowSettlementInfoModal(true)}
                    className="text-[8px] text-terminal-blue hover:text-terminal-blue-light font-bold flex items-center gap-0.5 cursor-pointer bg-white/2 hover:bg-white/5 p-1 rounded transition-all"
                  >
                    ⓘ Settlement Info
                  </button>
                </div>
                <div className="flex items-baseline gap-2 mt-1 select-none">
                  <h3 className="text-terminal-blue-light text-xs font-mono font-bold uppercase">{selectedContract.symbol}</h3>
                  <span className="text-white text-[9.5px] font-sans font-light truncate">{selectedContract.title}</span>
                </div>
              </div>

              {/* Symmetric Backing Side Selection */}
              <div className="space-y-1">
                <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider block">Contract Direction</span>
                <div className="flex bg-carbon-black rounded border border-white/10 p-0.5 font-bold uppercase text-[9px] select-none">
                  <button
                    type="button"
                    onClick={() => { setBackingSide("YES"); setTradeResult(null); }}
                    className={`flex-1 py-1 text-center rounded transition-all cursor-pointer ${backingSide === "YES" ? "bg-terminal-blue/20 text-terminal-blue-light border border-terminal-blue/30" : "text-slate-550 hover:text-slate-400"}`}
                  >
                    BACK (YES)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBackingSide("NO"); setTradeResult(null); }}
                    className={`flex-1 py-1 text-center rounded transition-all cursor-pointer ${backingSide === "NO" ? "bg-terminal-red/15 text-terminal-red border border-terminal-red/20" : "text-slate-550 hover:text-slate-400"}`}
                  >
                    LAY (NO)
                  </button>
                </div>
              </div>

              {/* Spread details */}
              <div className="grid grid-cols-3 gap-1.5 text-center font-data text-[10px]">
                <div className="bg-carbon-black p-1.5 rounded border border-white/5">
                  <span className="text-slate-500 block text-[8px] uppercase">Bid (Sell)</span>
                  <span className="text-terminal-green-light font-bold block mt-0.5">
                    ${backingSide === "NO" ? (1.00 - selectedContract.ask).toFixed(2) : selectedContract.bid.toFixed(2)}
                  </span>
                </div>
                <div className="bg-carbon-black p-1.5 rounded border border-white/5">
                  <span className="text-slate-500 block text-[8px] uppercase">Implied</span>
                  <span className="text-white font-bold block mt-0.5">
                    {backingSide === "NO" ? 100 - Math.round(selectedContract.mid * 100) : Math.round(selectedContract.mid * 100)}%
                  </span>
                </div>
                <div className="bg-carbon-black p-1.5 rounded border border-white/5">
                  <span className="text-slate-500 block text-[8px] uppercase">Ask (Buy)</span>
                  <span className="text-terminal-blue-light font-bold block mt-0.5">
                    ${backingSide === "NO" ? (1.00 - selectedContract.bid).toFixed(2) : selectedContract.ask.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Market Snapshot (Option A) */}
              {(() => {
                const showBid = backingSide === "NO" ? (1.00 - selectedContract.ask) : selectedContract.bid;
                const showAsk = backingSide === "NO" ? (1.00 - selectedContract.bid) : selectedContract.ask;
                const spread = Math.abs(showAsk - showBid);
                const impliedProb = backingSide === "NO" ? 1.00 - selectedContract.mid : selectedContract.mid;
                const priceChg = selectedContract.change;
                const directionClass = priceChg > 0 
                  ? "text-terminal-green-light" 
                  : (priceChg < 0 ? "text-terminal-red" : "text-slate-450");
                
                return (
                  <div className="bg-carbon-black rounded border border-white/5 p-2.5 font-data text-[9px] space-y-2 select-none">
                    <span className="text-slate-500 font-extrabold uppercase text-[7px] tracking-wider block">
                      ⚡ Market Snapshot
                    </span>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 leading-snug">
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-450">Best Bid:</span>
                        <span className="text-terminal-green-light font-bold">${showBid.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-455">Best Ask:</span>
                        <span className="text-terminal-blue-light font-bold">${showAsk.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-450">Bid-Ask Spread:</span>
                        <span className="text-white font-bold">${spread.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-450">Implied Prob:</span>
                        <span className="text-white font-bold">{Math.round(impliedProb * 100)}%</span>
                      </div>
                      <div className="flex justify-between col-span-2 border-t border-white/5 pt-1.5 mt-0.5">
                        <span className="text-slate-450 font-bold uppercase text-[7.5px]">Recent Price Chg:</span>
                        <span className={`font-bold inline-flex items-center gap-0.5 ${directionClass}`}>
                          {priceChg > 0 ? "+" : ""}{(priceChg * 100).toFixed(1)}%
                          {priceChg > 0 ? "▲" : (priceChg < 0 ? "▼" : "")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Action tabs */}
              <div className="flex flex-col gap-1 select-none">
                <div className="flex bg-carbon-black rounded border border-white/10 p-0.5 font-bold uppercase text-[9px]">
                  <button
                    type="button"
                    onClick={() => { setTradeAction("BUY"); setTradeResult(null); }}
                    className={`flex-1 py-1.5 text-center rounded transition-colors cursor-pointer ${tradeAction === "BUY" ? "bg-terminal-blue/20 text-terminal-blue-light border border-terminal-blue/30" : "text-slate-550 hover:text-slate-350"}`}
                  >
                    OPEN POSITION
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTradeAction("SELL"); setTradeResult(null); }}
                    className={`flex-1 py-1.5 text-center rounded transition-colors cursor-pointer ${tradeAction === "SELL" ? "bg-terminal-red/10 text-terminal-red border border-terminal-red/20" : "text-slate-550 hover:text-slate-350"}`}
                  >
                    SELL / EXIT
                  </button>
                </div>
              </div>

              {/* Quantity selector */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-550 text-[8px] uppercase font-bold">
                  <span>Order Size (Contracts)</span>
                  <span>Holding: {activePosition ? activePosition.qty : 0}</span>
                </div>
                <div className="flex items-center gap-2 bg-carbon-black border border-white/10 rounded px-2 py-0.5">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={quantity || ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setQuantity(isNaN(val) ? 0 : val);
                      setTradeResult(null);
                    }}
                    placeholder="Enter contracts qty"
                    className="flex-1 bg-transparent text-white font-bold outline-none text-xs font-data"
                  />
                  <span className="text-slate-500 text-[9px] uppercase font-bold tracking-wider">contracts</span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-[8px] font-bold text-slate-400 pt-0.5">
                  {[50, 100, 500, 1000].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => { setQuantity(q); setTradeResult(null); }}
                      className="py-1 bg-white/3 hover:bg-white/5 rounded border border-white/5 cursor-pointer text-center"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              {/* OUTCOME PAYOUT BOARD */}
              <div className="bg-carbon-black p-2.5 rounded border border-white/5 space-y-2 text-[9px] select-none font-mono">
                <button
                  type="button"
                  onClick={() => setShowPayoutCalc(!showPayoutCalc)}
                  className="w-full flex justify-between items-center text-slate-550 font-bold uppercase text-[7.5px] tracking-wider cursor-pointer hover:text-white"
                >
                  <span>Outcome Contract Payout</span>
                  <span className="text-[7px] text-terminal-blue font-bold">{showPayoutCalc ? "COLLAPSE ▲" : "EXPAND ▼"}</span>
                </button>
                {showPayoutCalc && (
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-data text-slate-350 mt-1.5 animate-fadeIn">
                    <div className="flex justify-between col-span-2">
                      <span>Position Size:</span>
                      <span className="text-white font-bold">{quantity} Contracts</span>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span>Execution Price:</span>
                      <span className="text-white font-bold">${price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between col-span-2 border-b border-white/5 pb-1.5">
                      <span>Notional Cost:</span>
                      <span className="text-white font-bold">${cost.toFixed(2)}</span>
                    </div>

                    {/* SUCCESS SCENARIO */}
                    <div className="col-span-2 bg-terminal-green/5 border border-terminal-green/20 p-1.5 rounded text-[8.5px] space-y-0.5 mt-0.5">
                      <div className="flex justify-between text-terminal-green-light font-bold uppercase text-[7px] tracking-wider">
                        <span>IF {backingSide === "NO" ? "OUTCOME FAILS" : "OUTCOME OCCURS"}</span>
                        <span>PAYS $1.00</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Receive:</span>
                        <span className="text-white font-bold">${quantity.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Net Profit:</span>
                        <span className="text-terminal-green-light font-bold">+${Math.max(0, quantity - cost).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* FAILURE SCENARIO */}
                    <div className="col-span-2 bg-terminal-red/5 border border-terminal-red/20 p-1.5 rounded text-[8.5px] space-y-0.5 mt-1">
                      <div className="flex justify-between text-terminal-red font-bold uppercase text-[7px] tracking-wider">
                        <span>IF {backingSide === "NO" ? "OUTCOME OCCURS" : "OUTCOME FAILS"}</span>
                        <span>PAYS $0.00</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Receive:</span>
                        <span className="text-white font-bold">$0.00</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Net Loss:</span>
                        <span className="text-terminal-red font-bold">-${cost.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="h-px bg-white/5 col-span-2 my-1" />

                    <div className="flex justify-between col-span-2 text-slate-500">
                      <span>Portfolio at Risk:</span>
                      <span className={`font-bold ${nextExposurePct > 25 ? "text-terminal-yellow font-bold" : "text-white"}`}>
                        {nextExposurePct.toFixed(1)}% <span className="text-[7.5px] text-slate-555">/ 30%</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Submission button & Alerts (Repositioned directly below Payout Board) */}
              <div className="space-y-2 pt-2.5 border-t border-white/5">
                {quantity === 0 && (
                  <div className="bg-terminal-blue/5 border border-terminal-blue/20 p-2 rounded text-[8.5px] text-slate-400 select-none">
                    Select quantity of contracts to open transaction.
                  </div>
                )}

                {isHalted && (
                  <div className="bg-terminal-red/10 border border-terminal-red/20 p-2 rounded text-[9px] text-terminal-red flex items-start gap-1 font-sans font-light leading-normal select-none">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-terminal-red" />
                    <div>
                      <span className="font-bold block uppercase font-mono text-[8px]">Simulation Halts Active</span>
                      Incidents or Safety Cars suspend trading on affected derivatives.
                    </div>
                  </div>
                )}

                {tradeResult && (
                  <div className={`p-2 rounded text-[9px] flex items-start gap-1 font-sans font-light leading-normal select-none ${tradeResult.success ? "bg-terminal-green/10 border border-terminal-green/20 text-terminal-green-light" : "bg-terminal-red/10 border border-terminal-red/20 text-terminal-red"}`}>
                    {tradeResult.success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-terminal-green-light" /> : <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-terminal-red" />}
                    <div>
                      <span className="font-bold block uppercase font-mono text-[8px]">{tradeResult.success ? "Trade Settled" : "Execution Error"}</span>
                      {tradeResult.message}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canExecute}
                  className={`w-full py-2 font-mono font-bold tracking-wider text-xs uppercase rounded cursor-pointer transition-all duration-200 select-none flex items-center justify-center gap-1.5 ${canExecute ? (tradeAction === "BUY" ? "bg-terminal-blue hover:bg-terminal-blue-light text-white shadow-lg active:scale-[0.98]" : "bg-terminal-red hover:bg-red-650 text-white active:scale-[0.98]") : "bg-white/3 border border-white/5 text-slate-500 cursor-not-allowed"}`}
                >
                  {tradeAction === "BUY" ? "OPEN POSITION" : "SELL / EXIT"}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-650 text-center p-6 border border-dashed border-white/5 rounded">
            <span className="text-[10.5px] uppercase font-bold tracking-wider text-slate-500">Order Desk Inactive</span>
            <p className="text-[8px] mt-1.5 leading-snug font-sans font-light text-slate-600">Open a position to begin replay. Trade a market to activate valuation.</p>
          </div>
        )}
      </div>

      {/* How Settlement Works Help Modal */}
      {showSettlementInfoModal && (
        <div className="fixed inset-0 bg-carbon-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none font-mono">
          <div className="relative max-w-sm w-full bg-carbon-dark border border-white/10 rounded-lg p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-terminal-blue-light font-extrabold text-[9px] uppercase tracking-wider flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-terminal-blue" />
                HOW SETTLEMENT WORKS
              </span>
              <button
                type="button"
                onClick={() => setShowSettlementInfoModal(false)}
                className="text-slate-500 hover:text-white text-[12px] font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="text-[9px] text-slate-350 leading-relaxed space-y-2 select-text font-sans font-light">
              <p>
                <strong>Binary Settlements:</strong> Event contracts settle strictly deterministically to either <strong>$1.00</strong> (if the target outcome occurs) or <strong>$0.00</strong> (if the outcome fails).
              </p>
              <p>
                <strong>Backing Sides:</strong> ApexGP supports complete two-sided trading. Selecting <strong>BACK (YES)</strong> backs the event to happen. Selecting <strong>LAY (NO)</strong> backs the event to fail. A Lay contract is priced as the complement <code>$1.00 - YES_Price</code>.
              </p>
              <p>
                <strong>Zero Time Decay:</strong> Positions do not incur time-based theta decay during simulation replay, and can be exited (liquidated) at live bid prices at any lap tick.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSettlementInfoModal(false)}
              className="w-full py-1.5 bg-terminal-blue hover:bg-terminal-blue-light text-white font-bold text-[9px] rounded uppercase tracking-wider transition-colors"
            >
              Acknowledge & Return
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
