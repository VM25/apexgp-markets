import React, { useState, useEffect } from "react";
import { Contract } from "../../hooks/useSimulation";
import { Position } from "../../hooks/usePortfolio";
import { Landmark, Trophy, ArrowUpRight, ArrowDownRight, ShieldAlert, CheckCircle2, Sigma, Activity } from "lucide-react";

interface ChampionshipTabProps {
  contracts: { [id: string]: Contract };
  positions: { [id: string]: Position };
  cash: number;
  portfolioValue: number;
  assetsValue: number;
  isHalted: boolean;
  buyContracts: (id: string, qty: number, side?: "BUY" | "LAY") => { success: boolean; message: string };
  sellContracts: (posKey: string, qty: number) => { success: boolean; message: string };
  currentLapIdx: number;
  totalLaps: number;
  raceId: string;
  completedRaces: string[];
  driverPoints: { [code: string]: number };
  constructorPoints: { [code: string]: number };
  isFocusMode?: boolean;
}

export default function ChampionshipTab({
  contracts, positions, cash, portfolioValue, assetsValue, isHalted, buyContracts, sellContracts,
  currentLapIdx, totalLaps, raceId, completedRaces, driverPoints, constructorPoints, isFocusMode
}: ChampionshipTabProps) {

  const [selectedChampionship, setSelectedChampionship] = useState<"DRIVERS" | "CONSTRUCTORS">("DRIVERS");
  const [selectedContender, setSelectedContender] = useState<string>(""); // No pre-selected default
  const [quantity, setQuantity] = useState<number>(0); // No default quantity
  const [tradeAction, setTradeAction] = useState<"BUY" | "SELL">("BUY");
  const [backingSide, setBackingSide] = useState<"YES" | "NO">("YES"); // Symmetrical backing side
  const [tradeResult, setTradeResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showPayoutCalc, setShowPayoutCalc] = useState<boolean>(false);

  const getContenderTeamName = (target: string) => {
    switch (target) {
      case "VER": return "Red Bull Racing";
      case "NOR": return "McLaren";
      case "LEC": return "Ferrari";
      case "PIA": return "McLaren";
      case "HAM": return "Ferrari";
      case "MCL": return "McLaren Formula 1 Team";
      case "FER": return "Scuderia Ferrari";
      case "RBR": return "Oracle Red Bull Racing";
      case "MER": return "Mercedes-AMG Petronas F1 Team";
      default: return "Championship Contender";
    }
  };

  const typeFilter = selectedChampionship === "DRIVERS" ? "FUTURE_DRIVERS" : "FUTURE_CONSTRUCTORS";
  const activeFutures = Object.values(contracts).filter(c => c.type === typeFilter);
  const selectedFuture = selectedContender ? activeFutures.find(f => f.target === selectedContender) : null;
  
  const posKey = selectedFuture ? (backingSide === "NO" ? `${selectedFuture.id}_NO` : selectedFuture.id) : "";
  const activePosition = positions[posKey];

  // Ticket calculations based on Backing Side (YES vs NO/LAY)
  const price = selectedFuture 
    ? (backingSide === "NO" 
        ? (tradeAction === "BUY" ? 1.00 - selectedFuture.bid : 1.00 - selectedFuture.ask)
        : (tradeAction === "BUY" ? selectedFuture.ask : selectedFuture.bid))
    : 0.50;
  const cost = quantity * price;

  const nextAssetsVal = assetsValue + (tradeAction === "BUY" ? cost : -cost);
  const nextExposurePct = portfolioValue > 0 ? (nextAssetsVal / portfolioValue) * 100 : 0;
  const isExposureViolated = tradeAction === "BUY" && nextExposurePct > 30.01;

  const currentContractPrice = selectedFuture ? selectedFuture.bid : 0;
  const currentPosPrice = selectedFuture ? (backingSide === "NO" ? (1.00 - selectedFuture.ask) : currentContractPrice) : 0;
  const existingCost = activePosition ? activePosition.qty * currentPosPrice : 0;
  const nextSingleCost = existingCost + (tradeAction === "BUY" ? cost : -cost);
  const nextSingleExposurePct = portfolioValue > 0 ? (nextSingleCost / portfolioValue) * 100 : 0;
  const isSingleViolated = tradeAction === "BUY" && nextSingleExposurePct > 15.01;

  const isCashViolated = tradeAction === "BUY" && cost > cash;
  const isSellViolated = tradeAction === "SELL" && (!activePosition || activePosition.qty < quantity);

  const canExecute = selectedFuture && !isHalted && !selectedFuture.settled && quantity > 0 &&
                     !isExposureViolated && !isSingleViolated && !isCashViolated && !isSellViolated;

  const handleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canExecute || !selectedFuture) return;

    let res;
    if (tradeAction === "BUY") {
      res = buyContracts(selectedFuture.id, quantity, backingSide === "NO" ? "LAY" : "BUY");
    } else {
      res = sellContracts(posKey, quantity);
    }
    setTradeResult(res);
    if (res.success) {
      setTimeout(() => setTradeResult(null), 3000);
    }
  };

  // Synchronize active contender selection when category switches
  const handleChampionshipChange = (type: "DRIVERS" | "CONSTRUCTORS") => {
    setSelectedChampionship(type);
    setSelectedContender(""); // Reset contender default
    setTradeResult(null);
    setQuantity(0); // Reset quantity
  };

  // Find Dynamic Standing Leaders for narrative panel
  const sortedDrvPoints = Object.entries(driverPoints).sort((a,b)=>b[1]-a[1]);
  const activeDriverLeader = sortedDrvPoints.length > 0 && sortedDrvPoints[0][1] > 0 ? `${sortedDrvPoints[0][0]} (${sortedDrvPoints[0][1]} pts)` : "L. Norris (MCL)";
  
  const sortedTeamPoints = Object.entries(constructorPoints).sort((a,b)=>b[1]-a[1]);
  const activeTeamLeader = sortedTeamPoints.length > 0 && sortedTeamPoints[0][1] > 0 ? `${sortedTeamPoints[0][0]} (${sortedTeamPoints[0][1]} pts)` : "McLaren (MCL)";

  // Selected contender's current positions MTM / exposure calculations
  const getMTMValue = () => {
    if (!activePosition || !selectedFuture) return 0;
    const curVal = activePosition.qty * (selectedFuture.settled ? (selectedFuture.settlementValue ?? 0) : selectedFuture.bid);
    const entryCost = activePosition.qty * activePosition.entryPrice;
    return curVal - entryCost;
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-4 select-none min-h-[480px] font-mono text-[10px] text-slate-400">
      
      {/* 1. LEFT CATEGORY FILTER LIST */}
      <div className="w-full md:w-44 shrink-0 flex flex-row md:flex-col gap-1 border-b md:border-b-0 md:border-r border-white/5 pb-2 md:pb-0 pr-0 md:pr-3">
        <button
          onClick={() => handleChampionshipChange("DRIVERS")}
          className={`px-3 py-2 text-left font-bold rounded text-[10px] cursor-pointer transition-colors block shrink-0 ${selectedChampionship === "DRIVERS" ? "bg-terminal-blue/15 border-l border-terminal-blue text-white" : "bg-white/3 hover:bg-white/5 text-slate-400"}`}
        >
          Drivers Championship
        </button>
        <button
          onClick={() => handleChampionshipChange("CONSTRUCTORS")}
          className={`px-3 py-2 text-left font-bold rounded text-[10px] cursor-pointer transition-colors block shrink-0 ${selectedChampionship === "CONSTRUCTORS" ? "bg-terminal-blue/15 border-l border-terminal-blue text-white" : "bg-white/3 hover:bg-white/5 text-slate-400"}`}
        >
          Constructors Championship
        </button>
      </div>

      {/* 2. CENTER STANDINGS FUTURES BOARD */}
      <div className="flex-1 bg-carbon-surface border border-white/5 rounded p-3.5 flex flex-col min-w-0">
        
        {/* Compact Season Narrative Context Panel */}
        <div className="bg-carbon-black/30 border border-white/5 rounded p-2.5 mb-3.5 space-y-2 select-none text-[9.5px]">
          <span className="text-[7.5px] text-slate-550 font-bold uppercase tracking-wider block">Season Standings Machine</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px] font-data">
            <div className="bg-carbon-surface/20 p-2 rounded border border-white/5">
              <span className="text-slate-500 block text-[6.5px] uppercase">Title Standings Leader</span>
              <span className="text-white font-bold block mt-0.5 truncate">
                {selectedChampionship === "DRIVERS" ? activeDriverLeader : activeTeamLeader}
              </span>
            </div>
            <div className="bg-carbon-surface/20 p-2 rounded border border-white/5">
              <span className="text-slate-500 block text-[6.5px] uppercase">Rounds Remaining</span>
              <span className="text-white font-bold block mt-0.5">{24 - completedRaces.length} / 24 GP Rounds</span>
            </div>
            <div className="bg-carbon-surface/20 p-2 rounded border border-white/5">
              <span className="text-slate-500 block text-[6.5px] uppercase">Momentum</span>
              <span className="text-terminal-green-light font-bold block mt-0.5">NOR +3.2%</span>
            </div>
            <div className="bg-carbon-surface/20 p-2 rounded border border-white/5">
              <span className="text-slate-500 block text-[6.5px] uppercase">Selected Coverage</span>
              <span className="text-terminal-blue-light font-bold block mt-0.5 truncate">
                {selectedContender ? `[FUT-${selectedContender}] ${backingSide === "NO" ? "LAY" : "BACK"}` : "None Highlighted"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-3 shrink-0">
          <h2 className="text-white font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-terminal-gold animate-pulse" /> 2025 World Title Futures Chain
          </h2>
          <span className="text-[8px] text-slate-555 font-mono uppercase font-bold tracking-wider">MARKETS PROGRESSIVE RE-PRICING ACTIVE</span>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          <table className="w-full text-left font-data text-[10px] select-none">
            <thead>
              <tr className="text-slate-500 uppercase text-[8px] border-b border-white/5 font-bold tracking-wider">
                <th className="pb-2 pl-2 w-[40%]">Contender Details</th>
                <th className="pb-2 text-right">Points</th>
                <th className="pb-2 text-right">Implied Odds</th>
                <th className="pb-2 text-right">Progressive Chg</th>
                <th className="pb-2 text-center w-[25%]">Bid / Ask</th>
                {isFocusMode && (
                  <>
                    <th className="pb-2 text-right">Delta (Δ)</th>
                    <th className="pb-2 text-right">Theta (Θ)</th>
                    <th className="pb-2 text-right">IV</th>
                  </>
                )}
                <th className="pb-2 text-right pr-2">Holdings</th>
              </tr>
            </thead>
            <tbody>
              {activeFutures.map((fut) => {
                const isSelected = fut.target === selectedContender;
                const pos = positions[fut.id];
                const posNo = positions[`${fut.id}_NO`];
                const pointsScored = selectedChampionship === "DRIVERS" ? (driverPoints[fut.target] || 0) : (constructorPoints[fut.target] || 0);
                const priceChg = fut.change;
                const directionClass = priceChg > 0 
                  ? "text-terminal-green-light" 
                  : (priceChg < 0 ? "text-terminal-red" : "text-slate-500");

                const settlementScenario = "Resolves at the final round (Abu Dhabi GP) based on official FIA season standing outcomes.";

                return (
                  <React.Fragment key={fut.id}>
                    <tr
                      onClick={() => {
                        if (selectedContender === fut.target) {
                          setSelectedContender(""); // Collapse on re-click
                        } else {
                          setSelectedContender(fut.target);
                          setTradeResult(null);
                        }
                      }}
                      className={`border-b border-white/5 hover:bg-white/4 cursor-pointer last:border-0 select-none transition-all duration-150 ${isSelected ? "bg-white/5 border-l-2 border-l-terminal-blue font-bold text-white" : "hover:text-slate-200"}`}
                    >
                      <td className={`pl-2 transition-all duration-150 ${isSelected ? "py-2.5" : "py-1.5"}`}>
                        <span className="text-terminal-blue-light font-mono font-bold block text-[9.5px] tracking-wide">{fut.symbol}</span>
                        <span className={`text-[9px] font-sans font-light block mt-0.5 ${isSelected ? "text-slate-200" : "text-slate-400"}`}>{fut.title}</span>
                      </td>
                      <td className="py-1 text-right font-bold text-slate-300">
                        {pointsScored} pts
                      </td>
                      <td className="py-1 text-right font-bold text-slate-350">
                        {Math.round(fut.mid * 100)}%
                      </td>
                      <td className="py-1 text-right font-bold">
                        <span className={`inline-flex items-center gap-0.5 ${directionClass}`}>
                          {priceChg > 0 ? "+" : ""}{(priceChg * 100).toFixed(1)}%
                          {priceChg > 0 ? <ArrowUpRight className="w-3 h-3" /> : (priceChg < 0 ? <ArrowDownRight className="w-3 h-3" /> : null)}
                        </span>
                      </td>
                      <td className="py-1 text-center">
                        <div className="inline-flex rounded border border-white/5 bg-carbon-black overflow-hidden font-bold select-none text-[9px]">
                          <span className="px-2.5 py-0.5 text-terminal-green border-r border-white/5 hover:bg-terminal-green/5">${fut.bid.toFixed(2)}</span>
                          <span className="px-2.5 py-0.5 text-terminal-blue hover:bg-terminal-blue/5">${fut.ask.toFixed(2)}</span>
                        </div>
                      </td>
                      {isFocusMode && (
                        <>
                          <td className="py-1 text-right text-slate-450 font-bold">{fut.delta?.toFixed(3)}</td>
                          <td className="py-1 text-right text-slate-450 font-bold">{fut.theta?.toFixed(4)}</td>
                          <td className="py-1 text-right text-slate-450 font-bold">{Math.round((fut.iv || 0) * 100)}%</td>
                        </>
                      )}
                      <td className={`py-1 text-right font-bold pr-2 transition-all duration-150 ${isSelected ? "text-terminal-blue-light" : "text-slate-555"}`}>
                        {pos || posNo ? (
                          <div className="text-[8px] leading-tight">
                            {pos ? <div className="text-terminal-green-light">YES: {pos.qty}</div> : null}
                            {posNo ? <div className="text-terminal-red">NO: {posNo.qty}</div> : null}
                          </div>
                        ) : "--"}
                      </td>
                    </tr>

                    {isSelected && (
                      <tr className="bg-carbon-black/30 border-b border-white/5 select-none font-data text-[9px]">
                        <td colSpan={isFocusMode ? 9 : 6} className="p-2.5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="bg-carbon-surface/30 border border-white/5 rounded p-2 space-y-1">
                              <span className="text-[7.5px] text-slate-500 uppercase font-bold block">Probability Shift Status</span>
                              <div className="grid grid-cols-2 gap-2 text-[8.5px]">
                                <div>
                                  <span className="text-slate-500 block text-[6.5px]">Implied odds</span>
                                  <span className="text-white font-bold">{Math.round(fut.mid * 100)}%</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[6.5px]">odds Shift</span>
                                  <span className={`font-bold ${priceChg >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
                                    {priceChg >= 0 ? "+" : ""}{(priceChg * 100).toFixed(2)}%
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="bg-carbon-surface/30 border border-white/5 rounded p-2 space-y-1">
                              <span className="text-[7.5px] text-slate-500 uppercase font-bold block">Season sensitivity bounds</span>
                              <p className="text-[8.5px] text-slate-350 font-sans font-light">
                                Point delta gap tracks with +/- 2.5% shifts in championship price models per Grand Prix podium result.
                              </p>
                            </div>

                            <div className="md:col-span-2 bg-carbon-surface/20 border border-white/5 rounded p-2 text-[8.5px]">
                              <span className="text-slate-500 block text-[7px] uppercase font-bold mb-1">Championship Settlement Scenario</span>
                              <p className="text-slate-300 font-sans font-light leading-normal">
                                {settlementScenario}
                              </p>
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

      {/* 3. RIGHT TRADE ENTRY TICKET */}
      <div className="w-full md:w-80 shrink-0 flex flex-col bg-carbon-surface border border-white/5 rounded p-4 select-none">
        {selectedFuture ? (
          <form onSubmit={handleOrderSubmit} className="flex-1 flex flex-col justify-between space-y-3">
            
            <div className="space-y-3">
              <div className="border-b border-white/5 pb-2">
                <span className="text-[8.5px] text-slate-500 font-bold uppercase tracking-wider block">Title Derivative Ticket</span>
                <div className="flex items-baseline gap-2 mt-1 select-none">
                  <h3 className="text-terminal-blue-light text-xs font-mono font-bold uppercase">
                    {backingSide === "NO" ? `${selectedFuture.symbol}-Against` : selectedFuture.symbol}
                  </h3>
                  <span className="text-white text-[9.5px] font-sans font-light truncate">
                    {backingSide === "NO" ? `${selectedFuture.title} [Against]` : selectedFuture.title}
                  </span>
                </div>
              </div>

              {/* Symmetrical BACK (YES) / LAY (NO) direction selectors */}
              <div className="space-y-1 select-none">
                <span className="text-slate-550 text-[8px] uppercase font-bold">Backing Direction</span>
                <div className="flex bg-carbon-black rounded border border-white/10 p-0.5 font-bold uppercase text-[9px]">
                  <button
                    type="button"
                    onClick={() => { setBackingSide("YES"); setTradeResult(null); }}
                    className={`flex-1 py-1.5 text-center rounded transition-colors cursor-pointer ${backingSide === "YES" ? "bg-terminal-blue/20 text-terminal-blue-light border border-terminal-blue/30" : "text-slate-550 hover:text-slate-350"}`}
                  >
                    BACK (YES)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBackingSide("NO"); setTradeResult(null); }}
                    className={`flex-1 py-1.5 text-center rounded transition-colors cursor-pointer ${backingSide === "NO" ? "bg-terminal-red/10 text-terminal-red border border-terminal-red/20" : "text-slate-550 hover:text-slate-350"}`}
                  >
                    LAY (NO)
                  </button>
                </div>
              </div>

              {/* Bid/Ask detail */}
              <div className="grid grid-cols-3 gap-2 text-center font-data text-[10px]">
                <div className="bg-carbon-black p-1.5 rounded border border-white/5">
                  <span className="text-slate-500 block text-[8px] uppercase">Futures Bid</span>
                  <span className="text-terminal-green-light font-bold block mt-0.5">
                    ${(backingSide === "NO" ? 1.00 - selectedFuture.ask : selectedFuture.bid).toFixed(2)}
                  </span>
                </div>
                <div className="bg-carbon-black p-1.5 rounded border border-white/5">
                  <span className="text-slate-500 block text-[8px] uppercase">Implied</span>
                  <span className="text-white font-bold block mt-0.5">
                    {Math.round((backingSide === "NO" ? 1.00 - selectedFuture.mid : selectedFuture.mid) * 100)}%
                  </span>
                </div>
                <div className="bg-carbon-black p-1.5 rounded border border-white/5">
                  <span className="text-slate-500 block text-[8px] uppercase">Futures Ask</span>
                  <span className="text-terminal-blue-light font-bold block mt-0.5">
                    ${(backingSide === "NO" ? 1.00 - selectedFuture.bid : selectedFuture.ask).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Market Snapshot (Option A) */}
              {(() => {
                const currentAsk = backingSide === "NO" ? 1.00 - selectedFuture.bid : selectedFuture.ask;
                const currentBid = backingSide === "NO" ? 1.00 - selectedFuture.ask : selectedFuture.bid;
                const spread = Math.abs(currentAsk - currentBid);
                const impliedProb = backingSide === "NO" ? 1.00 - selectedFuture.mid : selectedFuture.mid;
                const priceChg = selectedFuture.change;
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
                        <span className="text-terminal-green-light font-bold">${currentBid.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-455">Best Ask:</span>
                        <span className="text-terminal-blue-light font-bold">${currentAsk.toFixed(2)}</span>
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

              {/* Action Selector */}
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

              {/* Quantity input */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-550 text-[8px] uppercase font-bold">
                  <span>Contracts Qty</span>
                  <span>Available: {activePosition ? activePosition.qty : 0}</span>
                </div>
                <div className="flex items-center gap-2 bg-carbon-black border border-white/10 rounded px-2 py-0.5">
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setQuantity(isNaN(val) ? 0 : val);
                      setTradeResult(null);
                    }}
                    className="flex-1 bg-transparent text-white font-bold outline-none text-xs font-data"
                  />
                  <span className="text-slate-500 text-[9px] uppercase font-bold tracking-wider">Qty</span>
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
                        <span>IF OUTCOME HAPPENS (TRUE)</span>
                        <span>PAYOUT</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Receive:</span>
                        <span className="text-white font-bold">${quantity.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Net Profit:</span>
                        <span className="text-terminal-green-light font-bold">+${(quantity - cost).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* FAILURE SCENARIO */}
                    <div className="col-span-2 bg-terminal-red/5 border border-terminal-red/20 p-1.5 rounded text-[8.5px] space-y-0.5 mt-1">
                      <div className="flex justify-between text-terminal-red font-bold uppercase text-[7px] tracking-wider">
                        <span>IF OUTCOME FAILS (FALSE)</span>
                        <span>ZERO</span>
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

                    {/* MTM Valuation check for held positions */}
                    {activePosition && (
                      <div className="col-span-2 bg-carbon-surface/60 border border-white/5 p-2 rounded text-[8px] text-slate-400 mt-1 flex justify-between">
                        <span>Current MTM PnL:</span>
                        <span className={`font-bold ${getMTMValue() >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
                          {getMTMValue() >= 0 ? "+" : ""}${getMTMValue().toFixed(2)}
                        </span>
                      </div>
                    )}

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

                {/* Settlements alerts */}
                {selectedFuture.settled && (
                  <div className="bg-terminal-gold/10 border border-terminal-gold/20 p-2 rounded text-[9px] text-terminal-gold flex items-start gap-1 font-sans font-light leading-normal select-none">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-terminal-gold" />
                    <div>
                      <span className="font-bold block uppercase font-mono text-[8px]">Championship Settled</span>
                      Season ended. Settle value resolved to ${selectedFuture.settlementValue?.toFixed(2)}. No further trades.
                    </div>
                  </div>
                )}

                {/* Exposure alert */}
                {isExposureViolated && (
                  <div className="bg-terminal-red/10 border border-terminal-red/20 p-2 rounded text-[9px] text-terminal-red flex items-start gap-1 font-sans font-light leading-normal select-none">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-terminal-red" />
                    <div>
                      <span className="font-bold block uppercase font-mono text-[8px]">Exposure Violated</span>
                      Exposure cannot exceed 30% of total portfolio capital.
                    </div>
                  </div>
                )}

                {/* Single-market exposure alert */}
                {isSingleViolated && (
                  <div className="bg-terminal-red/10 border border-terminal-red/20 p-2 rounded text-[9px] text-terminal-red flex items-start gap-1 font-sans font-light leading-normal select-none">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-terminal-red" />
                    <div>
                      <span className="font-bold block uppercase font-mono text-[8px]">Single-Market Violated</span>
                      Exposure in this title contract cannot exceed 15% limit.
                    </div>
                  </div>
                )}

                {/* Cash alert */}
                {isCashViolated && (
                  <div className="bg-terminal-red/10 border border-terminal-red/20 p-2 rounded text-[9px] text-terminal-red flex items-start gap-1 font-sans font-light leading-normal select-none">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-terminal-red" />
                    <div>
                      <span className="font-bold block uppercase font-mono text-[8px]">Liquidity Shortage</span>
                      Insufficient cash balance.
                    </div>
                  </div>
                )}

                {/* Sell balance alert */}
                {isSellViolated && (
                  <div className="bg-terminal-red/10 border border-terminal-red/20 p-2 rounded text-[9px] text-terminal-red flex items-start gap-1 font-sans font-light leading-normal select-none">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-terminal-red" />
                    <div>
                      <span className="font-bold block uppercase font-mono text-[8px]">Position Shortage</span>
                      You do not hold active title contracts.
                    </div>
                  </div>
                )}

                {tradeResult && (
                  <div className={`p-2 rounded text-[9px] flex items-start gap-1 font-sans font-light leading-normal select-none ${tradeResult.success ? "bg-terminal-green/10 border border-terminal-green/20 text-terminal-green-light" : "bg-terminal-red/10 border border-terminal-red/20 text-terminal-red"}`}>
                    {tradeResult.success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-terminal-green-light mt-0.5" /> : <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-terminal-red mt-0.5" />}
                    <div>
                      <span className="font-bold block uppercase font-mono text-[8px]">{tradeResult.success ? "Order Filled" : "Execution Error"}</span>
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
            <span className="text-[10px] uppercase font-bold tracking-wider">No Contender Highlighted</span>
            <p className="text-[8px] leading-snug mt-1 font-sans font-light">
              Open season positions to track championship exposure. Highlight a candidate contender in the futures chain to execute.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
