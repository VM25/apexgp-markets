"use client";

import React, { useState } from "react";
import { SettledPosition } from "../hooks/usePortfolio";
import FieldLabel from "./FieldLabel";

interface SettlementModalProps {
  roundNumLabel: string;
  gpNameLabel: string;
  winner: string;
  safetyCarOccurred: boolean;
  fastestLapHolder: string;
  dnfList: string[];
  podiumList: string[];
  lastSettledPositions: SettledPosition[];
  totalSettledPnL: number;
  cashBeforeSettlement: number;
  cashAfterSettlement: number;
  portfolioChangePct: number;
  selectedRaceId: string;
  driverPoints: { [code: string]: number };
  constructorPoints: { [code: string]: number };
  getSharpeRatio: () => number;
  getHitRate: () => number;
  portfolioValue: number;
  maxDrawdown: number;
  bestTrade: string;
  worstTrade: string;
  mostProfitableMarket: string;
  onReviewReplay: () => void;
  onTradeNextRace: () => void;
}

export default function SettlementModal({
  roundNumLabel,
  gpNameLabel,
  winner,
  safetyCarOccurred,
  fastestLapHolder,
  dnfList,
  podiumList,
  lastSettledPositions,
  totalSettledPnL,
  cashBeforeSettlement,
  cashAfterSettlement,
  portfolioChangePct,
  selectedRaceId,
  driverPoints,
  constructorPoints,
  getSharpeRatio,
  getHitRate,
  portfolioValue,
  maxDrawdown,
  bestTrade,
  worstTrade,
  mostProfitableMarket,
  onReviewReplay,
  onTradeNextRace,
}: SettlementModalProps) {
  const [showLedger, setShowLedger] = useState(false);

  return (
    <div
      className="fixed inset-0 bg-carbon-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 font-mono state-settlement"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settlement-title"
    >
      <div className="relative max-w-lg w-full panel-elevated border-terminal-gold/30 rounded-lg p-6 flex flex-col justify-between max-h-[90dvh] overflow-hidden">
        {/* Header */}
        <div className="border-b border-white/10 pb-3 shrink-0">
          <span className="text-terminal-gold font-extrabold text-micro uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
            🏆 RACE SETTLEMENT COMPLETED: APEXGP WIRE
          </span>
          <h2 id="settlement-title" className="text-white text-heading font-extrabold uppercase mt-1">
            RACE COMPLETE
          </h2>
          <div className="text-body-sm text-slate-300 font-bold mt-0.5">
            ROUND {roundNumLabel} · {gpNameLabel}
          </div>

          {/* Hero: total settled PnL */}
          <div className="mt-3 flex items-baseline justify-between">
            <FieldLabel className="text-micro">Total Settled PnL</FieldLabel>
            <span
              className={`font-data font-extrabold text-data-lg ${totalSettledPnL >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}
            >
              {totalSettledPnL >= 0 ? "+" : ""}${totalSettledPnL.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto my-4 space-y-4 pr-1">
          {/* Official results */}
          <div className="panel-base border border-white/5 rounded p-3 space-y-2">
            <FieldLabel className="text-micro border-b border-white/5 pb-1">Official Results</FieldLabel>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-body-sm font-data">
              <div className="flex justify-between">
                <span className="text-slate-500">Winner:</span>
                <span className="text-terminal-gold font-extrabold">{winner}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Safety Car:</span>
                <span className="text-white font-extrabold">{safetyCarOccurred ? "YES" : "NO"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fastest Lap:</span>
                <span className="text-white">{fastestLapHolder}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">DNFs:</span>
                <span className="text-terminal-red font-bold truncate max-w-[120px]">
                  {dnfList.join(", ") || "None"}
                </span>
              </div>
              <div className="flex justify-between col-span-2 border-t border-white/5 pt-1.5">
                <span className="text-slate-500">Podium:</span>
                <span className="text-slate-200 font-extrabold">{podiumList.join(" | ")}</span>
              </div>
            </div>
          </div>

          {/* Positions */}
          <div className="space-y-2">
            <FieldLabel className="text-micro">Your Positions</FieldLabel>
            {lastSettledPositions.length === 0 ? (
              <div className="panel-base border border-dashed border-white/5 rounded p-4 text-center text-slate-500 text-body-sm font-sans font-light">
                No active positions held for this race.
              </div>
            ) : (
              <div className="space-y-1">
                {lastSettledPositions.map((item) => (
                  <div
                    key={item.contractId}
                    className="panel-base p-2 border border-white/5 rounded flex justify-between items-center text-body-sm font-data"
                  >
                    <span className="text-slate-200 font-bold uppercase truncate max-w-[280px]">
                      {item.contractTitle}
                    </span>
                    <span
                      className={`font-bold ${item.pnl >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}
                    >
                      {item.pnl >= 0 ? "+" : ""}${item.pnl.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ledger */}
          {showLedger && lastSettledPositions.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-white/5 animate-fadeIn select-text font-mono">
              <FieldLabel className="text-micro border-b border-white/5 pb-1 mb-1">
                System Real-Time Settlement Audit Ledger
              </FieldLabel>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-micro font-data">
                  <thead>
                    <tr className="text-slate-400 uppercase border-b border-white/5 font-bold">
                      <th className="pb-1 w-[20%]">Contract</th>
                      <th className="pb-1 text-center w-[10%]">Entry</th>
                      <th className="pb-1 text-center w-[12%]">Settle</th>
                      <th className="pb-1 text-center w-[10%]">Size</th>
                      <th className="pb-1 text-center w-[8%]">Result</th>
                      <th className="pb-1 text-right w-[10%]">PnL</th>
                      <th className="pb-1 text-center w-[10%]">Duration</th>
                      <th className="pb-1 text-left pl-3 w-[20%]">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastSettledPositions.map((item) => {
                      const isProfit = item.pnl >= 0;
                      const isWinner = item.contractId.includes("WINNER");
                      const isPodium = item.contractId.includes("PODIUM");
                      const isSafetyCar = item.contractId.includes("SAFETY_CAR");
                      const isDnf = item.contractId.includes("DNF");
                      const isFl = item.contractId.includes("FL_");
                      const isH2H = item.contractId.includes("H2H_");
                      const isFuture = item.contractId.includes("FUTURE_");

                      let resultText = isProfit ? "WIN" : "LOSS";
                      if (item.exitPrice === 1.0) resultText = "TRUE";
                      if (item.exitPrice === 0.0) resultText = "FALSE";

                      const holdingDuration = isFuture ? "Season" : "Full GP";

                      let reason = "Contract settled at final valuation.";
                      if (isWinner) {
                        reason = isProfit
                          ? "Driver clinched P1 victory."
                          : "Driver finished outside P1 (Options expired worthless).";
                      } else if (isPodium) {
                        reason = isProfit
                          ? "Driver finished on P1-P3 podium."
                          : "Driver finished outside P3 (Options expired worthless).";
                      } else if (isSafetyCar) {
                        reason = isProfit
                          ? "Safety Car deployment verified."
                          : "No Safety Car occurred (Options expired worthless).";
                      } else if (isDnf) {
                        reason = isProfit
                          ? "Driver DNF retirement confirmed."
                          : "Driver completed the GP (Options expired worthless).";
                      } else if (isFl) {
                        reason = isProfit
                          ? "Driver clinched official fastest lap."
                          : "Another driver set the fastest lap (Options expired worthless).";
                      } else if (isH2H) {
                        reason = isProfit
                          ? "Selected contender beat H2H opponent."
                          : "Opponent finished ahead (Options expired worthless).";
                      } else if (isFuture) {
                        reason = isProfit
                          ? "Championship Title resolved in favor."
                          : "Championship Title resolved against (Options expired worthless).";
                      }

                      return (
                        <tr key={item.contractId} className="border-b border-white/5 last:border-0 hover:bg-white/2">
                          <td className="py-1.5 text-slate-200 truncate max-w-[90px] uppercase font-bold">
                            {item.contractTitle}
                          </td>
                          <td className="py-1.5 text-center text-slate-400">${item.entryPrice.toFixed(2)}</td>
                          <td className="py-1.5 text-center text-slate-400">${item.exitPrice.toFixed(2)}</td>
                          <td className="py-1.5 text-center text-slate-400">{item.qty} units</td>
                          <td className="py-1.5 text-center">
                            <span
                              className={`px-1 py-0.5 rounded text-micro font-bold ${isProfit ? "bg-terminal-green/10 text-terminal-green-light" : "bg-terminal-red/10 text-terminal-red"}`}
                            >
                              {resultText}
                            </span>
                          </td>
                          <td
                            className={`py-1.5 text-right font-bold ${item.pnl >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}
                          >
                            {item.pnl >= 0 ? "+" : ""}${item.pnl.toFixed(0)}
                          </td>
                          <td className="py-1.5 text-center text-slate-450">{holdingDuration}</td>
                          <td
                            className={`py-1.5 pl-3 font-sans font-light leading-snug ${item.pnl >= 0 ? "text-terminal-green-light/80" : "text-slate-450"}`}
                          >
                            {reason}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cash flows */}
          <div className="panel-base border border-white/10 p-3 rounded space-y-2 font-mono text-body-sm">
            <div className="flex justify-between border-b border-white/5 pb-1.5 font-data">
              <span className="text-slate-500">Total Settled PnL:</span>
              <span className={`font-bold ${totalSettledPnL >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
                {totalSettledPnL >= 0 ? "+" : ""}${totalSettledPnL.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1.5 font-data">
              <span className="text-slate-500">Portfolio Cash:</span>
              <span className="text-white font-bold">
                ${cashBeforeSettlement.toLocaleString(undefined, { maximumFractionDigits: 0 })} → $
                {cashAfterSettlement.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between font-data">
              <span className="text-slate-500">Portfolio Change:</span>
              <span className={`font-bold ${portfolioChangePct >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
                {portfolioChangePct >= 0 ? "+" : ""}
                {portfolioChangePct.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Round 24 championship report */}
          {selectedRaceId === "abu_dhabi" && (
            <div className="bg-terminal-gold/5 border border-terminal-gold/25 p-3 rounded-lg space-y-3 pt-3 mt-3 animate-pulse-border">
              <span className="text-terminal-gold font-extrabold text-micro tracking-wider uppercase flex items-center gap-1.5">
                🏆 2025 World Title Futures Settle
              </span>

              <div className="grid grid-cols-2 gap-3 font-data text-slate-350 pt-1 border-t border-white/5">
                <div className="panel-base p-2 rounded border border-white/5">
                  <FieldLabel className="text-micro">Drivers Champion</FieldLabel>
                  <span className="text-white font-bold block mt-0.5 text-heading">
                    {Object.entries(driverPoints).sort((a, b) => b[1] - a[1])[0]?.[0] || "VER"}
                  </span>
                </div>
                <div className="panel-base p-2 rounded border border-white/5">
                  <FieldLabel className="text-micro">Constructors Champion</FieldLabel>
                  <span className="text-white font-bold block mt-0.5 text-heading">
                    {Object.entries(constructorPoints).sort((a, b) => b[1] - a[1])[0]?.[0] || "MCL"}
                  </span>
                </div>
              </div>

              <div className="panel-base rounded border border-white/5 p-2.5 space-y-1.5">
                <FieldLabel className="text-micro border-b border-white/5 pb-1">Season Performance Report</FieldLabel>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-body-sm font-data">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sharpe Ratio:</span>
                    <span className="text-white font-bold">{getSharpeRatio()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Net Return PnL:</span>
                    <span
                      className={`font-bold ${portfolioValue - 100000 >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}
                    >
                      ${(portfolioValue - 100000).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Hit Rate:</span>
                    <span className="text-white font-bold">{getHitRate()}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Max Drawdown:</span>
                    <span className="text-terminal-red font-bold">{maxDrawdown}%</span>
                  </div>
                  <div className="flex flex-col col-span-2 border-t border-white/5 pt-1.5">
                    <FieldLabel className="text-micro">Best Closed Position</FieldLabel>
                    <span className="text-terminal-green-light truncate font-sans font-light mt-0.5">{bestTrade}</span>
                  </div>
                  <div className="flex flex-col col-span-2">
                    <FieldLabel className="text-micro">Worst Closed Position</FieldLabel>
                    <span className="text-terminal-red truncate font-sans font-light mt-0.5">{worstTrade}</span>
                  </div>
                  <div className="flex flex-col col-span-2 border-t border-white/5 pt-1">
                    <FieldLabel className="text-micro">Most Profitable Contract</FieldLabel>
                    <span className="text-terminal-gold truncate font-mono mt-0.5">{mostProfitableMarket}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-white/5 shrink-0 justify-end">
          <button
            type="button"
            onClick={onReviewReplay}
            className="py-2 px-3 bg-white/5 hover:bg-white/10 text-white rounded font-bold text-body-sm uppercase tracking-wider cursor-pointer border border-white/15 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 active:scale-[0.98]"
          >
            Review Market Replay
          </button>
          {lastSettledPositions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowLedger((v) => !v)}
              className="py-2 px-3 bg-carbon-surface/60 hover:bg-carbon-surface text-slate-300 rounded font-bold text-body-sm uppercase tracking-wider cursor-pointer border border-white/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 active:scale-[0.98]"
            >
              {showLedger ? "Hide Trade Ledger" : "Open Trade Ledger"}
            </button>
          )}
          <button
            type="button"
            onClick={onTradeNextRace}
            className="py-2 px-4 bg-terminal-gold hover:bg-terminal-gold/90 text-carbon-black rounded font-extrabold text-body-sm uppercase tracking-wider cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 active:scale-[0.98]"
          >
            {selectedRaceId === "abu_dhabi" ? "Reset Season Session" : "Trade Next Race"}
          </button>
        </div>
      </div>
    </div>
  );
}
