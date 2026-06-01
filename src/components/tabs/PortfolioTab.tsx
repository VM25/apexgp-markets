import React, { useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Position, TradeLog, EquityCurvePoint } from "../../hooks/usePortfolio";
import { Contract } from "../../hooks/useSimulation";
import { Activity, ShieldAlert, TrendingUp, Layers, Sigma, TrendingDown, Clock, ShieldCheck, Briefcase } from "lucide-react";

interface PortfolioTabProps {
  cash: number;
  positions: { [id: string]: Position };
  assetsValue: number;
  portfolioValue: number;
  unrealizedPnL: number;
  exposurePercent: number;
  tradeHistory: TradeLog[];
  equityCurve: EquityCurvePoint[];
  maxDrawdown: number;
  getReturnPercent: () => number;
  getHitRate: () => number;
  getSharpeRatio: () => number;
  closePosition: (id: string) => void;
  
  // Greeks and global contracts passed from unified state
  netDelta: number;
  netTheta: number;
  avgIv: number;
  contracts: { [id: string]: Contract };
}

export default function PortfolioTab({
  cash, positions, assetsValue, portfolioValue, unrealizedPnL, exposurePercent,
  tradeHistory, equityCurve, maxDrawdown, getReturnPercent, getHitRate, getSharpeRatio, closePosition,
  netDelta, netTheta, avgIv, contracts
}: PortfolioTabProps) {



  const returnPct = getReturnPercent();
  const hitRate = getHitRate();
  const sharpe = getSharpeRatio();
  const realizedPnL = tradeHistory.reduce((sum, t) => sum + (t.pnl || 0), 0);

  const activeHoldingsCount = Object.keys(positions).length;
  const isPortfolioEmpty = activeHoldingsCount === 0 && tradeHistory.length === 0;

  // Split positions into Race Book vs Season Book (Championship Futures)
  const positionsArray = Object.values(positions);
  const racePositions = positionsArray.filter(pos => {
    const contract = contracts[pos.contractId];
    return contract ? !contract.type.startsWith("FUTURE_") : !pos.contractId.startsWith("FUTURE_");
  });
  const seasonPositions = positionsArray.filter(pos => {
    const contract = contracts[pos.contractId];
    return contract ? contract.type.startsWith("FUTURE_") : pos.contractId.startsWith("FUTURE_");
  });

  const openRaceExposure = racePositions.reduce((sum, pos) => sum + (pos.qty * pos.currentPrice), 0);
  const openSeasonExposure = seasonPositions.reduce((sum, pos) => sum + (pos.qty * pos.currentPrice), 0);
  
  const unrealizedFuturesPnL = seasonPositions.reduce((sum, pos) => sum + (pos.qty * (pos.currentPrice - pos.entryPrice)), 0);

  // Real-time Best and Worst Settlement Outcome calculations
  const getOutcomeProjections = () => {
    let worst = cash;
    let best = cash;
    
    positionsArray.forEach(pos => {
      const contract = contracts[pos.contractId];
      if (contract) {
        if (contract.settled) {
          const sVal = contract.settlementValue ?? 0;
          worst += pos.qty * sVal;
          best += pos.qty * sVal;
        } else {
          // Worst case: settles to $0.00
          worst += 0;
          // Best case: settles to $1.00
          best += pos.qty * 1.00;
        }
      } else {
        worst += pos.qty * pos.entryPrice;
        best += pos.qty * pos.entryPrice;
      }
    });

    return { worst, best };
  };

  const outcomes = getOutcomeProjections();

  // Dynamic Risk Status description
  const getRiskStatus = () => {
    if (activeHoldingsCount === 0) return { label: "RISK STANDBY (INACTIVE)", style: "text-slate-550" };
    if (exposurePercent > 25.0) return { label: "LIMIT EXCEEDED (REDUCE)", style: "text-terminal-red font-bold" };
    if (exposurePercent > 15.0) return { label: "ELEVATED EXPOSURE", style: "text-terminal-yellow font-bold" };
    return { label: "NOMINAL RISK EXPOSURE", style: "text-terminal-green-light font-bold" };
  };

  const riskStatus = getRiskStatus();

  // Dynamic Risk Attribution Calculations
  const getRiskAttribution = () => {
    const teamCaps: { [name: string]: number } = {
      McLaren: 0,
      Ferrari: 0,
      "Red Bull": 0,
      Mercedes: 0,
      "Macro/Incident": 0,
      Others: 0
    };

    let totalWeight = 0;
    positionsArray.forEach(pos => {
      const val = pos.qty * pos.currentPrice;
      totalWeight += val;
      
      const title = pos.contractTitle.toUpperCase();
      if (title.includes("NOR") || title.includes("PIA") || title.includes("MCL")) {
        teamCaps["McLaren"] += val;
      } else if (title.includes("LEC") || title.includes("HAM") || title.includes("FER")) {
        teamCaps["Ferrari"] += val;
      } else if (title.includes("VER") || title.includes("LAW") || title.includes("RBR")) {
        teamCaps["Red Bull"] += val;
      } else if (title.includes("RUS") || title.includes("ANT") || title.includes("MER")) {
        teamCaps["Mercedes"] += val;
      } else if (title.includes("SAFETY") || title.includes("H2H") || title.includes("MATCHUP")) {
        teamCaps["Macro/Incident"] += val;
      } else {
        teamCaps["Others"] += val;
      }
    });

    return Object.keys(teamCaps).map(team => {
      const val = teamCaps[team];
      const pct = totalWeight > 0 ? (val / totalWeight) * 100 : 0;
      const navPct = portfolioValue > 0 ? (val / portfolioValue) * 100 : 0;
      return { team, val, pct, navPct };
    });
  };

  const riskAttribution = getRiskAttribution();

  // Dynamic Delta-Hedging Advisor Widget logic
  const getDeltaHedgingAdvice = () => {
    if (netDelta === 0) {
      return {
        bias: "DELTA NEUTRAL",
        style: "text-slate-450 bg-white/2 border-white/5",
        text: "Portfolio risk is delta-neutral. Capital value has no bias toward race outcomes.",
        action: "No hedging offset required."
      };
    }

    const bias = netDelta > 0 ? "LONG DELTA PRO-DOWNSTREAM" : "SHORT DELTA DNF-DOWNSTREAM";
    const hedgeContractsCount = Math.abs(Math.round(netDelta * 1.5));
    
    if (netDelta > 0) {
      return {
        bias,
        style: "text-terminal-blue-light bg-terminal-blue/5 border-terminal-blue/20",
        text: `Portfolio bias is positive delta. An upward shift in qualifying drivers paces increases NAV.`,
        action: `Hedge: Buy ${hedgeContractsCount} units of opposing championship futures, or reduce long call contracts.`
      };
    } else {
      return {
        bias,
        style: "text-terminal-red bg-terminal-red/5 border-terminal-red/20",
        text: `Portfolio bias is negative delta. Position gains are weighted toward retirement or safety cars.`,
        action: `Hedge: Buy ${hedgeContractsCount} long qualifying calls, or go long on constructors championship futures.`
      };
    }
  };

  const hedgeAdvice = getDeltaHedgingAdvice();



  return (
    <div className="h-full flex flex-col gap-3.5 select-none min-h-[500px] font-mono text-[10px] text-slate-450">
      
      {/* 1. ASYMMETRIC PORTFOLIO HERO LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 shrink-0 select-none">
        
        {/* HERO: Portfolio Value (NAV) - Spans 5 columns */}
        <div className="md:col-span-5 bg-carbon-surface border border-white/10 rounded p-4 flex flex-col justify-between shadow-xl relative overflow-hidden">
          <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider block">NAV Net Worth Portfolio Valuation</span>
          <h2 className="text-white text-xl md:text-2xl font-extrabold tracking-tight block font-data leading-none mt-2">
            ${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          
          <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-white/5 text-[8px] text-slate-500 font-data">
            <div>
              <span className="block text-slate-550 uppercase text-[6.5px]">Open Race Exposure</span>
              <span className="text-white font-bold block mt-0.5">${openRaceExposure.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div>
              <span className="block text-slate-550 uppercase text-[6.5px]">Open Season Exposure</span>
              <span className="text-white font-bold block mt-0.5">${openSeasonExposure.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        </div>

        {/* PnL Ledger (Medium) - Spans 3 columns */}
        <div className="md:col-span-3 bg-carbon-surface border border-white/5 rounded p-4 flex flex-col justify-between">
          <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider block">Mark-to-Market PnL</span>
          <div className="mt-1">
            <span className={`text-base md:text-lg font-bold block font-data leading-none ${unrealizedPnL >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
              {unrealizedPnL >= 0 ? "+" : ""}${unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div className="grid grid-cols-2 gap-1.5 mt-2 pt-1.5 border-t border-white/5 text-[7px] text-slate-500 font-mono">
              <div>
                <span className="text-slate-550 uppercase block font-bold text-[6px]">Realized PnL</span>
                <span className={`font-bold block mt-0.5 ${realizedPnL >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
                  {realizedPnL >= 0 ? "+" : ""}${realizedPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div>
                <span className="text-slate-550 uppercase block font-bold text-[6px]">Unrealized Futures</span>
                <span className={`font-bold block mt-0.5 ${unrealizedFuturesPnL >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
                  {unrealizedFuturesPnL >= 0 ? "+" : ""}${unrealizedFuturesPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center text-[8.5px] text-slate-550 border-t border-white/5 pt-1 mt-2">
            <span>Cash Reserves</span>
            <span className="text-white font-bold font-data">${cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        {/* Secondary: Exposure Ratio - Spans 2 columns */}
        <div className="md:col-span-2 bg-carbon-surface border border-white/5 rounded p-3 flex flex-col justify-between text-[9px]">
          <div>
            <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider block">Risk Exposure</span>
            <div className="mt-1.5 flex items-baseline gap-1 font-data">
              <span className={`text-sm font-bold ${exposurePercent > 25 ? "text-terminal-yellow" : "text-white"}`}>
                {exposurePercent.toFixed(1)}%
              </span>
              <span className="text-[7.5px] text-slate-550">/ 30.0% Limit</span>
            </div>
          </div>
          <div className="w-full bg-white/5 h-1 rounded overflow-hidden mt-2">
            <div className="bg-terminal-blue h-full transition-all duration-300" style={{ width: `${Math.min(100, (exposurePercent / 30) * 100)}%` }} />
          </div>
        </div>

        {/* Secondary: Drawdown & Limits - Spans 2 columns */}
        <div className="md:col-span-2 bg-carbon-surface border border-white/5 rounded p-3 flex flex-col justify-between text-[9px]">
          <div>
            <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider block">Maximum Drawdown</span>
            <div className="mt-1.5 flex items-baseline gap-1 font-data">
              <span className={`text-sm font-bold ${maxDrawdown > 15 ? "text-terminal-red" : "text-white"}`}>
                {maxDrawdown.toFixed(1)}%
              </span>
              <span className="text-[7.5px] text-slate-550">Peak-to-Trough</span>
            </div>
          </div>
          <div className="text-[7.5px] text-slate-550 flex justify-between items-center border-t border-white/5 pt-1.5 mt-2 font-mono">
            <span>RISK LEVEL</span>
            <span className="text-slate-400 font-bold">20% MAX</span>
          </div>
        </div>

      </div>

      {/* 2. DYNAMIC RISK DESK GREEKS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 shrink-0 select-none">
        <div className="bg-carbon-surface border border-white/5 rounded p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[7.5px] text-slate-550 font-bold uppercase tracking-wider block">Portfolio Delta (Δ_P)</span>
            <span className={`text-xs font-bold font-data block mt-0.5 ${netDelta > 0 ? "text-terminal-blue-light" : (netDelta < 0 ? "text-terminal-red" : "text-white")}`}>
              {netDelta > 0 ? "+" : ""}{netDelta.toFixed(2)}
            </span>
          </div>
          <Sigma className="w-4 h-4 text-terminal-blue/35" />
        </div>

        <div className="bg-carbon-surface border border-white/5 rounded p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[7.5px] text-slate-550 font-bold uppercase tracking-wider block">Portfolio Theta (Θ_P)</span>
            <span className={`text-xs font-bold font-data block mt-0.5 ${netTheta >= 0 ? "text-terminal-green-light" : "text-slate-400"}`}>
              {netTheta > 0 ? "+" : ""}{netTheta.toFixed(4)} <span className="text-[7.5px] text-slate-550 font-normal">/ lap</span>
            </span>
          </div>
          <Activity className="w-4 h-4 text-terminal-green/35" />
        </div>

        <div className="bg-carbon-surface border border-white/5 rounded p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[7.5px] text-slate-550 font-bold uppercase tracking-wider block">Average Implied Volatility (IV)</span>
            <span className="text-white text-xs font-bold font-data block mt-0.5">
              {avgIv}%
            </span>
          </div>
          <ShieldAlert className="w-4 h-4 text-terminal-gold/35" />
        </div>
      </div>

      {/* 3. PERFORMANCE TELEMETRY GRAPHIC (Compressed when Empty) */}
      {!isPortfolioEmpty && (
        <div className="flex-1 min-h-[160px] bg-carbon-surface border border-white/5 rounded p-3 flex flex-col min-w-0 transition-all duration-350">
          <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-3 shrink-0 select-none">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-terminal-blue" />
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Equity Curve Telemetry History</span>
            </div>
            <span className="text-[7.5px] text-slate-550 font-mono uppercase font-bold tracking-wider">MARK-TO-MARKET PORTFOLIO NET ASSETS VALUE</span>
          </div>

          <div className="flex-1 min-h-[100px]">
            {equityCurve.length < 2 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-650 text-center space-y-1 p-6 border border-dashed border-white/5 rounded select-none">
                <span className="text-[9px] uppercase font-bold tracking-wider">No Performance History recorded</span>
                <p className="text-[8px] font-sans font-light">Run the simulation to record and chart portfolio NAV telemetry.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={equityCurve}
                  margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#007acc" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#007acc" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.01)" />
                  <XAxis 
                    dataKey="lap" 
                    stroke="rgba(255,255,255,0.12)" 
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 8 }}
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.12)" 
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 8 }}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`$${parseFloat(value).toFixed(2)}`, "NAV"]}
                    contentStyle={{ backgroundColor: "#0f1012", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "3px" }}
                    itemStyle={{ fontSize: "8.5px", fontFamily: "var(--font-mono)", fontWeight: "bold" }}
                    labelStyle={{ fontSize: "8.5px", color: "#888", fontFamily: "var(--font-mono)" }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#007acc" 
                    strokeWidth={1.2}
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* 4. MIDDLE ROW: ACTIVE HOLDINGS, RISK ATTRIBUTION, AND DELTA NEUTRAL HEDGING ADVISOR */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3.5 shrink-0 h-[220px] min-h-0">
               {/* Open Positions Ledger: Race Book & Season Book (Col-span-2) */}
        <div className="lg:col-span-2 bg-carbon-surface border border-white/5 rounded p-3.5 flex flex-col min-h-0">
          
          <div className="flex justify-between items-center mb-2 border-b border-white/5 pb-1.5 shrink-0 select-none">
            <span className="text-[8.5px] text-white font-extrabold uppercase tracking-wider block flex items-center gap-1.5">
              💼 ACTIVE PORTFOLIO OPEN POSITIONS LEDGER
            </span>
            <span className="text-[7.5px] text-slate-550 font-bold uppercase font-mono">Race vs. Season Segregation</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            
            {/* SUBSECTION 1: ACTIVE RACE CONTRACTS (RACE BOOK) */}
            <div className="space-y-1.5">
              <span className="text-[7.5px] text-terminal-blue font-bold uppercase tracking-wider block">
                ⚡ Active Race Contracts (Short-Term Positions)
              </span>
              {racePositions.length === 0 ? (
                <div className="bg-carbon-black/20 border border-dashed border-white/5 rounded p-2 text-center text-slate-550 text-[8.5px]">
                  No active short-term race contracts held.
                </div>
              ) : (
                <table className="w-full text-left font-data text-[9px]">
                  <thead>
                    <tr className="text-slate-500 uppercase text-[7px] border-b border-white/5 font-bold tracking-wider">
                      <th className="pb-1 pl-1 w-[40%]">Option Ticker</th>
                      <th className="pb-1 text-right">Size</th>
                      <th className="pb-1 text-right">Avg Cost</th>
                      <th className="pb-1 text-right">Valuation</th>
                      <th className="pb-1 text-right">MTM PnL</th>
                      <th className="pb-1 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {racePositions.map((pos) => {
                      const contract = contracts[pos.contractId];
                      const symbol = contract ? contract.symbol : pos.contractId;
                      const profit = pos.qty * (pos.currentPrice - pos.entryPrice);
                      const posKey = pos.side === "LAY" ? `${pos.contractId}_NO` : pos.contractId;
                      return (
                        <tr key={posKey} className="border-b border-white/5 last:border-0 hover:bg-white/2">
                          <td className="py-1 pl-1">
                            <span className="text-terminal-blue-light font-mono font-bold block leading-none">{symbol}</span>
                            <span className="text-[7.5px] text-slate-450 truncate block mt-0.5 leading-none">{pos.contractTitle}</span>
                          </td>
                          <td className="py-1 text-right font-bold text-slate-200">{pos.qty}</td>
                          <td className="py-1 text-right">${pos.entryPrice.toFixed(2)}</td>
                          <td className="py-1 text-right">${pos.currentPrice.toFixed(2)}</td>
                          <td className={`py-1 text-right font-bold ${profit >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
                            {profit >= 0 ? "+" : ""}${profit.toFixed(0)}
                          </td>
                          <td className="py-1 text-center">
                            <button
                              onClick={() => closePosition(posKey)}
                              className="px-1 py-0.2 bg-terminal-red/10 border border-terminal-red/20 text-terminal-red hover:bg-terminal-red/25 font-bold uppercase rounded cursor-pointer transition-colors text-[7px]"
                            >
                              Exit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* SUBSECTION 2: SEASON FUTURES HOLDINGS (SEASON BOOK) */}
            <div className="space-y-1.5 border-t border-white/5 pt-3">
              <span className="text-[7.5px] text-terminal-gold font-bold uppercase tracking-wider block">
                🏆 Season Championship Futures (Long-Term Holdings)
              </span>
              {seasonPositions.length === 0 ? (
                <div className="bg-carbon-black/20 border border-dashed border-white/5 rounded p-2 text-center text-slate-550 text-[8.5px]">
                  No active long-term season futures positions held.
                </div>
              ) : (
                <table className="w-full text-left font-data text-[9px]">
                  <thead>
                    <tr className="text-slate-500 uppercase text-[7px] border-b border-white/5 font-bold tracking-wider">
                      <th className="pb-1 pl-1 w-[45%]">Season Future Asset</th>
                      <th className="pb-1 text-right w-[15%]">Position Size</th>
                      <th className="pb-1 text-right w-[12%]">Entry Price</th>
                      <th className="pb-1 text-right w-[14%]">MTM Value</th>
                      <th className="pb-1 text-right pr-2">Unrealized PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seasonPositions.map((pos) => {
                      const contract = contracts[pos.contractId];
                      const symbol = contract ? contract.symbol : pos.contractId;
                      const profit = pos.qty * (pos.currentPrice - pos.entryPrice);
                      const mtmValue = pos.qty * pos.currentPrice;
                      return (
                        <tr key={pos.contractId} className="border-b border-white/5 last:border-0 hover:bg-white/2">
                          <td className="py-1 pl-1">
                            <span className="text-terminal-gold font-mono font-bold block leading-none">{symbol}</span>
                            <span className="text-[7.5px] text-slate-450 truncate block mt-0.5 leading-none">{pos.contractTitle}</span>
                          </td>
                          <td className="py-1 text-right text-slate-300">{pos.qty} units</td>
                          <td className="py-1 text-right text-slate-400">${pos.entryPrice.toFixed(2)}</td>
                          <td className="py-1 text-right font-bold text-white">${mtmValue.toFixed(0)}</td>
                          <td className={`py-1 text-right font-bold pr-2 ${profit >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
                            {profit >= 0 ? "+" : ""}${profit.toFixed(0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        </div>

        {/* Quant Team Risk Attribution Matrix */}
        <div className="bg-carbon-surface border border-white/5 rounded p-3 flex flex-col min-h-0">
          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block mb-2">Team Concentration Matrix</span>

          <div className="flex-1 overflow-y-auto pr-1">
            {activeHoldingsCount === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-650 text-[8px] uppercase font-bold select-none border border-dashed border-white/5 rounded">
                NO ASSETS VALUED
              </div>
            ) : (
              <table className="w-full text-left font-data text-[9px]">
                <thead>
                  <tr className="text-slate-500 uppercase text-[7px] border-b border-white/5 font-bold tracking-wider">
                    <th className="pb-1 pl-1">Risk Dimension</th>
                    <th className="pb-1 text-right">Exposure</th>
                    <th className="pb-1 text-right">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {riskAttribution.map((attr) => (
                    <tr key={attr.team} className="border-b border-white/5 last:border-0 py-1">
                      <td className="py-1 pl-1 font-bold text-white leading-tight">{attr.team}</td>
                      <td className="py-1 text-right text-slate-350">${attr.val.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="py-1 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="font-bold text-white text-[8px]">{attr.pct.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Delta-Hedging Advisor Widget */}
        <div className="bg-carbon-surface border border-white/5 rounded p-3 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-2 shrink-0 select-none">
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block">Hedging Advisor</span>
            <Layers className="w-3.5 h-3.5 text-terminal-blue" />
          </div>

          <div className="flex-1 flex flex-col justify-between space-y-2 min-h-0 select-none">
            <div className={`p-2 rounded border text-[8.5px] leading-snug font-sans font-light flex-1 overflow-y-auto ${hedgeAdvice.style}`}>
              <span className="font-bold block uppercase font-mono text-[8px] tracking-wider mb-1 flex items-center gap-1">
                {netDelta > 0 ? <TrendingUp className="w-3 h-3 text-terminal-blue" /> : (netDelta < 0 ? <TrendingDown className="w-3 h-3 text-terminal-red" /> : <Sigma className="w-3 h-3 text-slate-400" />)}
                {hedgeAdvice.bias}
              </span>
              {hedgeAdvice.text}
            </div>

            <div className="p-2 bg-carbon-black border border-white/5 rounded text-[8px] text-slate-400 leading-snug font-mono select-none">
              <span className="text-terminal-gold font-bold block uppercase tracking-wider text-[7.5px] mb-0.5">HEADING RECOMMENDATION</span>
              {hedgeAdvice.action}
            </div>
          </div>
        </div>

      </div>

      {/* 5. PORTFOLIO SETTLEMENT PROJECTIONS & RISK BOUNDS */}
      <div className="bg-carbon-surface border border-white/5 rounded p-3.5 flex flex-col shrink-0 select-none">
        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block mb-2">Institutional Settlement Range & Risk Bounds</span>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 text-center font-data text-[9.5px]">
          <div className="bg-carbon-black/30 p-2 rounded border border-white/5">
            <span className="text-slate-500 block text-[7px] uppercase">Worst Outcome (Liquidated)</span>
            <span className="text-white font-bold block mt-0.5">
              ${outcomes.worst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-carbon-black/30 p-2 rounded border border-white/5">
            <span className="text-slate-500 block text-[7px] uppercase">Best Outcome (Perfect Settlement)</span>
            <span className="text-white font-bold block mt-0.5">
              ${outcomes.best.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-carbon-black/30 p-2 rounded border border-white/5">
            <span className="text-slate-500 block text-[7px] uppercase">Current Risk Ratio</span>
            <span className="text-white font-bold block mt-0.5">
              {exposurePercent.toFixed(2)}%
            </span>
          </div>
          <div className="bg-carbon-black/30 p-2 rounded border border-white/5">
            <span className="text-slate-500 block text-[7px] uppercase">Projected Net Settlement Range</span>
            <span className={`font-bold block mt-0.5 ${outcomes.worst - portfolioValue >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
              {outcomes.worst - portfolioValue >= 0 ? "+" : ""}${(outcomes.worst - portfolioValue).toFixed(0)} / +${(outcomes.best - portfolioValue).toFixed(0)}
            </span>
          </div>
          <div className="bg-carbon-black/30 p-2 rounded border border-white/5 col-span-2 md:col-span-1 flex flex-col justify-center">
            <span className="text-slate-500 block text-[7px] uppercase">Institutional Risk Status</span>
            <span className={`block mt-0.5 font-bold ${riskStatus.style}`}>
              {riskStatus.label}
            </span>
          </div>
        </div>
      </div>

      {/* 6. CLOSED TRANSACTION LOGS AUDIT TRAIL */}
      <div className="bg-carbon-surface border border-white/5 rounded p-3 flex flex-col h-[140px] shrink-0 min-h-0 font-mono">
        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block mb-2">Audit Ledger Log Archive</span>
        <div className="flex-1 overflow-y-auto pr-1">
          {tradeHistory.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-650 text-[9px] uppercase font-bold select-none border border-dashed border-white/5 rounded">
              LEDGER STANDBY - NO AUDIT TRAIL RECORDED
            </div>
          ) : (
            <table className="w-full text-left font-data text-[9.5px]">
              <thead>
                <tr className="text-slate-500 uppercase text-[7px] border-b border-white/5 font-bold tracking-wider">
                  <th className="pb-1 pl-1.5">Time</th>
                  <th className="pb-1 w-[35%]">Option Symbol</th>
                  <th className="pb-1 text-center">Type</th>
                  <th className="pb-1 text-right">Qty</th>
                  <th className="pb-1 text-right">Price</th>
                  <th className="pb-1 text-right">Notional</th>
                  <th className="pb-1 text-right">PnL</th>
                </tr>
              </thead>
              <tbody>
                {tradeHistory.slice().reverse().map((t, idx) => (
                  <tr key={idx} className="border-b border-white/5 last:border-0 hover:bg-white/3 font-data">
                    <td className="py-1 pl-1.5 text-slate-500 font-mono">{t.timestamp}</td>
                    <td className="py-1">
                      <span className="text-terminal-blue-light font-bold font-mono block leading-tight">{t.contractTitle}</span>
                    </td>
                    <td className="py-1 text-center">
                      <span className={`px-1 rounded text-[7.5px] font-bold ${t.type === "BUY" ? "bg-terminal-blue/10 text-terminal-blue-light" : (t.type === "SELL" ? "bg-terminal-red/10 text-terminal-red" : "bg-white/5 text-slate-300")}`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="py-1 text-right text-slate-200">{t.qty}</td>
                    <td className="py-1 text-right">${t.price.toFixed(2)}</td>
                    <td className="py-1 text-right text-slate-350">${(t.qty * t.price).toFixed(0)}</td>
                    <td className={`py-1 text-right font-bold ${t.pnl === undefined ? "text-slate-400" : (t.pnl >= 0 ? "text-terminal-green-light" : "text-terminal-red")}`}>
                      {t.pnl === undefined ? "--" : `${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(0)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
