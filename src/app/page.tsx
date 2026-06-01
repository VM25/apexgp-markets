"use client";

import React, { useState, useEffect } from "react";
import { useSimulation } from "../hooks/useSimulation";
import { usePortfolio } from "../hooks/usePortfolio";
import LandingView from "../components/LandingView";
import TerminalShell from "../components/TerminalShell";
import MarketTab from "../components/tabs/MarketTab";
import ReplayTab from "../components/tabs/ReplayTab";
import PortfolioTab from "../components/tabs/PortfolioTab";
import ChampionshipTab from "../components/tabs/ChampionshipTab";
import ResearchTab from "../components/tabs/ResearchTab";
import StandingsTab from "../components/tabs/StandingsTab";

const DRIVER_TO_TEAM: { [code: string]: string } = {
  VER: "RBR", NOR: "MCL", LEC: "FER", PIA: "MCL", HAM: "FER", RUS: "MER",
  HAD: "VCARB", TSU: "VCARB", ALB: "WIL", ALO: "AST", BOR: "KICK", BEA: "HAAS",
  LAW: "RBR", GAS: "ALP", ANT: "MER", HUL: "KICK", STR: "AST", DOO: "ALP",
  OCO: "HAAS", SAI: "WIL"
};

export default function Home() {
  const [hasEnteredTerminal, setHasEnteredTerminal] = useState<boolean>(false);
  const [showLedgerInSettlement, setShowLedgerInSettlement] = useState<boolean>(false);
  const [densityMode, setDensityMode] = useState<"default" | "focus">("default");

  // 1. Season State Machine Points Standings state
  const [completedRaces, setCompletedRaces] = useState<string[]>([]);
  const [driverPoints, setDriverPoints] = useState<{ [code: string]: number }>({
    VER: 0, NOR: 0, LEC: 0, PIA: 0, HAM: 0, RUS: 0, HAD: 0, TSU: 0, ALB: 0, ALO: 0, BOR: 0, BEA: 0, LAW: 0, GAS: 0, ANT: 0, HUL: 0, STR: 0, DOO: 0, OCO: 0, SAI: 0
  });
  const [constructorPoints, setConstructorPoints] = useState<{ [code: string]: number }>({
    MCL: 0, FER: 0, RBR: 0, MER: 0, VCARB: 0, WIL: 0, KICK: 0, HAAS: 0, AST: 0, ALP: 0
  });

  // 2. Simulation and repricing state hook
  const {
    selectedRaceId,
    setSelectedRaceId,
    raceData,
    currentLapIdx,
    isPlaying,
    speed,
    isHalted,
    commentary,
    contracts,
    activeTab,
    setActiveTab,
    allRaces,
    handlePlayPause,
    handleSpeedChange,
    handleInstantReplay,
    handleReset
  } = useSimulation(driverPoints, constructorPoints, completedRaces);

  // 3. Portfolio and derivative ledger hook
  const {
    cash,
    positions,
    assetsValue,
    portfolioValue,
    unrealizedPnL,
    totalPnL,
    exposurePercent,
    tradeHistory,
    equityCurve,
    maxDrawdown,
    netDelta,
    netTheta,
    avgIv,
    buyContracts,
    sellContracts,
    closePosition,
    getReturnPercent,
    getHitRate,
    getSharpeRatio,
    resetPortfolio,
    lastSettledPositions,
    cashBeforeSettlement,
    cashAfterSettlement
  } = usePortfolio(contracts, currentLapIdx, raceData?.laps_total || 0, selectedRaceId, isHalted);

  const [settlementDismissedForRace, setSettlementDismissedForRace] = useState<string | null>(null);

  const totalLaps = raceData?.laps_total || 0;
  const showSettlement = currentLapIdx === totalLaps && totalLaps > 0 && settlementDismissedForRace !== selectedRaceId;

  // Track point scoring accumulation state machine
  useEffect(() => {
    if (currentLapIdx === totalLaps && totalLaps > 0 && raceData && !completedRaces.includes(selectedRaceId)) {
      setCompletedRaces(prev => [...prev, selectedRaceId]);
      
      setDriverPoints(prevDrivers => {
        const nextDrivers = { ...prevDrivers };
        raceData.final_result.forEach(res => {
          const code = res.driver_code;
          if (nextDrivers[code] !== undefined) {
            nextDrivers[code] += res.points || 0;
          }
        });
        return nextDrivers;
      });

      setConstructorPoints(prevTeams => {
        const nextTeams = { ...prevTeams };
        raceData.final_result.forEach(res => {
          const code = res.driver_code;
          const team = DRIVER_TO_TEAM[code] || "MCL";
          if (nextTeams[team] !== undefined) {
            nextTeams[team] += res.points || 0;
          }
        });
        return nextTeams;
      });
    }
  }, [currentLapIdx, totalLaps, raceData, selectedRaceId, completedRaces]);

  const handleFullReset = () => {
    handleReset();
    setSelectedRaceId("australia");
    resetPortfolio();
    setCompletedRaces([]);
    setDriverPoints({
      VER: 0, NOR: 0, LEC: 0, PIA: 0, HAM: 0, RUS: 0, HAD: 0, TSU: 0, ALB: 0, ALO: 0, BOR: 0, BEA: 0, LAW: 0, GAS: 0, ANT: 0, HUL: 0, STR: 0, DOO: 0, OCO: 0, SAI: 0
    });
    setConstructorPoints({
      MCL: 0, FER: 0, RBR: 0, MER: 0, VCARB: 0, WIL: 0, KICK: 0, HAAS: 0, AST: 0, ALP: 0
    });
  };

  // Calculate final settlement details
  const winner = raceData?.final_result?.find(r => r.position === 1)?.driver_code || "VER";
  const podiumList = raceData?.final_result
    ? [...raceData.final_result]
        .filter(r => r.position !== null && r.position <= 3)
        .sort((a, b) => (a.position || 0) - (b.position || 0))
        .map(r => r.driver_code)
    : ["VER", "NOR", "LEC"];
  
  let safetyCarOccurred = false;
  if (raceData?.laps) {
    for (let i = 0; i < raceData.laps.length; i++) {
      if (raceData.laps[i]?.safety_car && raceData.laps[i].safety_car !== "NONE" && raceData.laps[i].safety_car !== "") {
        safetyCarOccurred = true;
        break;
      }
    }
  }

  const dnfList = raceData?.final_result
    ? raceData.final_result.filter(r => r.dnf).map(r => r.driver_code)
    : [];

  const fastestLapHolder = raceData?.starting_grid[2]?.driver_code || "HAD";

  // Dynamic Performance Metrics calculations for Season Report Card
  const closedTrades = tradeHistory.filter(t => t.type === "SELL" || t.type === "SETTLE");
  const bestTradeVal = closedTrades.length > 0 ? Math.max(...closedTrades.map(t => t.pnl || 0)) : 0;
  const worstTradeVal = closedTrades.length > 0 ? Math.min(...closedTrades.map(t => t.pnl || 0)) : 0;
  const bestTrade = closedTrades.find(t => t.pnl === bestTradeVal)?.contractTitle || "None";
  const worstTrade = closedTrades.find(t => t.pnl === worstTradeVal)?.contractTitle || "None";

  // Group PnL by contract to identify most profitable market
  const marketPnL: { [title: string]: number } = {};
  closedTrades.forEach(t => {
    const title = t.contractTitle;
    marketPnL[title] = (marketPnL[title] || 0) + (t.pnl || 0);
  });
  let mostProfitableMarket = "None";
  let maxMarketPnL = -999999;
  Object.keys(marketPnL).forEach(title => {
    if (marketPnL[title] > maxMarketPnL) {
      maxMarketPnL = marketPnL[title];
      mostProfitableMarket = title;
    }
  });

  // Calculate percentage portfolio shift in this settlement
  const netWorthPrior = cashBeforeSettlement + lastSettledPositions.reduce((sum, item) => sum + (item.qty * item.entryPrice), 0);
  const totalSettledPnL = lastSettledPositions.reduce((sum, item) => sum + item.pnl, 0);
  const portfolioChangePct = netWorthPrior > 0 ? (totalSettledPnL / netWorthPrior) * 100 : 0;

  const handleTradeNextRace = () => {
    setSettlementDismissedForRace(null);
    setShowLedgerInSettlement(false);
    if (selectedRaceId === "abu_dhabi") {
      handleFullReset();
    } else if (allRaces && allRaces.length > 0) {
      const currentIdx = allRaces.findIndex(r => r.id === selectedRaceId);
      const nextIdx = (currentIdx + 1) % allRaces.length;
      setSelectedRaceId(allRaces[nextIdx].id);
    }
  };

  // Render active workspace tabs in center panel
  const renderTabContent = () => {
    switch (activeTab) {
      case "market":
        return (
          <MarketTab
            contracts={contracts}
            positions={positions}
            cash={cash}
            portfolioValue={portfolioValue}
            assetsValue={assetsValue}
            isHalted={isHalted}
            buyContracts={buyContracts}
            sellContracts={sellContracts}
            isFocusMode={densityMode === "focus"}
          />
        );
      case "replay":
        return (
          <ReplayTab
            raceData={raceData}
            currentLapIdx={currentLapIdx}
            commentary={commentary}
          />
        );
      case "portfolio":
        return (
          <PortfolioTab
            cash={cash}
            positions={positions}
            assetsValue={assetsValue}
            portfolioValue={portfolioValue}
            unrealizedPnL={unrealizedPnL}
            exposurePercent={exposurePercent}
            tradeHistory={tradeHistory}
            equityCurve={equityCurve}
            maxDrawdown={maxDrawdown}
            getReturnPercent={getReturnPercent}
            getHitRate={getHitRate}
            getSharpeRatio={getSharpeRatio}
            closePosition={closePosition}
            netDelta={netDelta}
            netTheta={netTheta}
            avgIv={avgIv}
            contracts={contracts}
          />
        );
      case "championship":
        return (
          <ChampionshipTab
            contracts={contracts}
            positions={positions}
            cash={cash}
            portfolioValue={portfolioValue}
            assetsValue={assetsValue}
            isHalted={isHalted}
            buyContracts={buyContracts}
            sellContracts={sellContracts}
            currentLapIdx={currentLapIdx}
            totalLaps={raceData?.laps_total || 0}
            raceId={selectedRaceId}
            completedRaces={completedRaces}
            driverPoints={driverPoints}
            constructorPoints={constructorPoints}
            isFocusMode={densityMode === "focus"}
          />
        );
      case "standings":
        return (
          <StandingsTab
            completedRaces={completedRaces}
            driverPoints={driverPoints}
            constructorPoints={constructorPoints}
            allRaces={allRaces}
            raceData={raceData}
          />
        );
      case "research":
        return (
          <ResearchTab
            isSeasonFinished={completedRaces.includes("abu_dhabi")}
            sharpeRatio={getSharpeRatio()}
            totalPnL={portfolioValue - 100000}
            hitRate={getHitRate()}
            bestTrade={bestTrade}
            worstTrade={worstTrade}
            maxDrawdown={maxDrawdown}
            mostProfitableMarket={mostProfitableMarket}
          />
        );
      default:
        return (
          <div className="h-full flex items-center justify-center text-slate-500 font-mono">
            TAB WORKSPACE UNDER CONSTRUCTION
          </div>
        );
    }
  };

  if (!hasEnteredTerminal) {
    return <LandingView onEnterTerminal={() => setHasEnteredTerminal(true)} />;
  }

  // Find round index
  const currentRaceIdx = allRaces.findIndex(r => r.id === selectedRaceId);
  const roundNumLabel = String(currentRaceIdx !== -1 ? currentRaceIdx + 1 : (raceData?.round_number || 1)).padStart(2, "0");
  const gpNameLabel = raceData?.race_name.replace("Grand Prix", "GP") || "Australian GP";

  return (
    <TerminalShell
      raceData={raceData}
      currentLapIdx={currentLapIdx}
      isPlaying={isPlaying}
      speed={speed}
      isHalted={isHalted}
      commentary={commentary}
      contracts={contracts}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      allRaces={allRaces}
      handlePlayPause={handlePlayPause}
      handleSpeedChange={handleSpeedChange}
      handleInstantReplay={handleInstantReplay}
      handleReset={handleReset}
      selectedRaceId={selectedRaceId}
      setSelectedRaceId={setSelectedRaceId}
      cash={cash}
      positions={positions}
      assetsValue={assetsValue}
      portfolioValue={portfolioValue}
      unrealizedPnL={unrealizedPnL}
      exposurePercent={exposurePercent}
      closePosition={closePosition}
      resetPortfolio={handleFullReset}
      getReturnPercent={getReturnPercent}
      densityMode={densityMode}
      setDensityMode={setDensityMode}
    >
      {renderTabContent()}

      {showSettlement && (
        <div className="fixed inset-0 bg-carbon-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none font-mono">
          <div className="relative max-w-lg w-full bg-carbon-dark border border-terminal-gold/30 rounded-lg p-6 shadow-[0_0_30px_rgba(212,175,55,0.15)] flex flex-col justify-between max-h-[90vh] overflow-hidden">
            
            {/* Header */}
            <div className="border-b border-white/10 pb-3 shrink-0">
              <span className="text-terminal-gold font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                🏆 RACE SETTLEMENT COMPLETED: APEXGP WIRE
              </span>
              <h2 className="text-white text-base font-extrabold uppercase mt-1">
                RACE COMPLETE
              </h2>
              <div className="text-[10px] text-slate-300 font-bold mt-0.5">
                ROUND {roundNumLabel} · {gpNameLabel}
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto my-4 space-y-4 pr-1">
              
              {/* Official Results Grid */}
              <div className="bg-carbon-surface/60 border border-white/5 rounded p-3 space-y-2">
                <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider block border-b border-white/5 pb-1">
                  OFFICIAL RESULTS
                </span>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[9.5px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Winner:</span>
                    <span className="text-terminal-gold font-extrabold font-data">{winner}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Safety Car:</span>
                    <span className="text-white font-extrabold">{safetyCarOccurred ? "YES" : "NO"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fastest Lap:</span>
                    <span className="text-white font-data">{fastestLapHolder}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">DNFs:</span>
                    <span className="text-terminal-red font-bold font-data truncate max-w-[90px]">
                      {dnfList.join(", ") || "None"}
                    </span>
                  </div>
                  <div className="flex justify-between col-span-2 border-t border-white/5 pt-1.5">
                    <span className="text-slate-500">Podium:</span>
                    <span className="text-slate-200 font-extrabold font-data">{podiumList.join(" | ")}</span>
                  </div>
                </div>
              </div>

              {/* Positions Settlements Payout Breakdown */}
              <div className="space-y-2">
                <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider block">
                  YOUR POSITIONS
                </span>
                
                {lastSettledPositions.length === 0 ? (
                  <div className="bg-carbon-surface/30 border border-dashed border-white/5 rounded p-4 text-center text-slate-550 text-[9px] font-sans font-light">
                    No active positions held for this race.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {lastSettledPositions.map((item) => (
                      <div key={item.contractId} className="bg-carbon-black p-2 border border-white/5 rounded flex justify-between items-center text-[9px] font-data">
                        <div>
                          <span className="text-slate-200 font-bold uppercase block truncate max-w-[280px]">
                            {item.contractTitle}
                          </span>
                        </div>
                        <span className={`font-bold text-[9.5px] ${item.pnl >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
                          {item.pnl >= 0 ? "+" : ""}${item.pnl.toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Detailed Trade Ledger Audit Trail Table */}
              {showLedgerInSettlement && lastSettledPositions.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-white/5 animate-fadeIn select-text font-mono">
                  <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider block border-b border-white/5 pb-1 mb-1">
                    SYSTEM REAL-TIME SETTLEMENT AUDIT LEDGER
                  </span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[8px] font-data">
                      <thead>
                        <tr className="text-slate-500 uppercase border-b border-white/5 pb-1 font-bold">
                          <th className="pb-1 w-[20%]">Contract</th>
                          <th className="pb-1 text-center w-[10%]">Entry Price</th>
                          <th className="pb-1 text-center w-[12%]">Settlement Price</th>
                          <th className="pb-1 text-center w-[10%]">Position Size</th>
                          <th className="pb-1 text-center w-[8%]">Result</th>
                          <th className="pb-1 text-right w-[10%]">Realized PnL</th>
                          <th className="pb-1 text-center w-[10%]">Holding Duration</th>
                          <th className="pb-1 text-left pl-3 w-[20%]">Settlement Reason</th>
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
                              <td className="py-1.5 text-slate-200 truncate max-w-[90px] uppercase font-bold">{item.contractTitle}</td>
                              <td className="py-1.5 text-center text-slate-400">${item.entryPrice.toFixed(2)}</td>
                              <td className="py-1.5 text-center text-slate-400">${item.exitPrice.toFixed(2)}</td>
                              <td className="py-1.5 text-center text-slate-400">{item.qty} units</td>
                              <td className="py-1.5 text-center">
                                <span className={`px-1 py-0.2 rounded text-[7.5px] font-bold ${isProfit ? "bg-terminal-green/10 text-terminal-green-light" : "bg-terminal-red/10 text-terminal-red"}`}>
                                  {resultText}
                                </span>
                              </td>
                              <td className={`py-1.5 text-right font-bold ${item.pnl >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
                                {item.pnl >= 0 ? "+" : ""}${item.pnl.toFixed(0)}
                              </td>
                              <td className="py-1.5 text-center text-slate-450">{holdingDuration}</td>
                              <td className={`py-1.5 pl-3 font-sans font-light text-[8px] leading-snug ${item.pnl >= 0 ? "text-terminal-green-light/80" : "text-slate-455"}`}>{reason}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Realized PnL and Cash flows Attribution */}
              <div className="bg-carbon-surface/85 border border-white/10 p-3 rounded space-y-2 select-none font-mono text-[9px]">
                <div className="flex justify-between border-b border-white/5 pb-1.5 font-data">
                  <span className="text-slate-500">Total Settled PnL:</span>
                  <span className={`font-bold ${totalSettledPnL >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
                    {totalSettledPnL >= 0 ? "+" : ""}${totalSettledPnL.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1.5 font-data">
                  <span className="text-slate-500">Portfolio Cash:</span>
                  <span className="text-white font-bold">
                    ${cashBeforeSettlement.toLocaleString(undefined, { maximumFractionDigits: 0 })} → ${cashAfterSettlement.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between font-data">
                  <span className="text-slate-500">Portfolio Change:</span>
                  <span className={`font-bold ${portfolioChangePct >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
                    {portfolioChangePct >= 0 ? "+" : ""}{portfolioChangePct.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* SPECIAL ROUND 24 CHAMPIONSHIP REPORT OVERLAY */}
              {selectedRaceId === "abu_dhabi" && (
                <div className="bg-terminal-gold/5 border border-terminal-gold/25 p-3 rounded.lg space-y-3 pt-3 mt-3 animate-pulse-border text-[9.5px]">
                  <span className="text-terminal-gold font-extrabold text-[9px] tracking-wider uppercase block flex items-center gap-1.5">
                    🏆 2025 World Title Futures Settle
                  </span>
                  
                  <div className="grid grid-cols-2 gap-3 text-[9px] font-data text-slate-350 pt-1 border-t border-white/5">
                    <div className="bg-carbon-black/40 p-2 rounded border border-white/5">
                      <span className="text-slate-500 block text-[6.5px] uppercase">Drivers Champion</span>
                      <span className="text-white font-bold block mt-0.5">
                        {Object.entries(driverPoints).sort((a,b)=>b[1]-a[1])[0]?.[0] || "VER"}
                      </span>
                    </div>
                    <div className="bg-carbon-black/40 p-2 rounded border border-white/5">
                      <span className="text-slate-500 block text-[6.5px] uppercase">Constructors Champion</span>
                      <span className="text-white font-bold block mt-0.5">
                        {Object.entries(constructorPoints).sort((a,b)=>b[1]-a[1])[0]?.[0] || "MCL"}
                      </span>
                    </div>
                  </div>

                  <div className="bg-carbon-black/60 rounded border border-white/5 p-2.5 space-y-1.5">
                    <span className="text-[7.5px] text-slate-550 font-bold uppercase tracking-wider block border-b border-white/5 pb-1">
                      SEASON PERFORMANCE REPORT
                    </span>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[8.5px] font-data">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Sharpe Ratio:</span>
                        <span className="text-white font-bold">{getSharpeRatio()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Net Return PnL:</span>
                        <span className={`font-bold ${portfolioValue - 100000 >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
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
                        <span className="text-slate-500 text-[6px] uppercase font-bold">Best Closed Position</span>
                        <span className="text-terminal-green-light truncate font-bold font-sans font-light mt-0.5">{bestTrade}</span>
                      </div>
                      <div className="flex flex-col col-span-2">
                        <span className="text-slate-500 text-[6px] uppercase font-bold">Worst Closed Position</span>
                        <span className="text-terminal-red truncate font-bold font-sans font-light mt-0.5">{worstTrade}</span>
                      </div>
                      <div className="flex flex-col col-span-2 border-t border-white/5 pt-1">
                        <span className="text-slate-500 text-[6px] uppercase font-bold">Most Profitable Contract</span>
                        <span className="text-terminal-gold truncate font-bold font-mono mt-0.5">{mostProfitableMarket}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-white/5 shrink-0 text-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setSettlementDismissedForRace(selectedRaceId);
                  setActiveTab("replay");
                }}
                className="py-2 px-3 bg-white/5 hover:bg-white/10 text-white rounded font-bold text-[9.5px] uppercase tracking-wider cursor-pointer border border-white/15 transition-all text-center"
              >
                Review Market Replay
              </button>
              {lastSettledPositions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowLedgerInSettlement(!showLedgerInSettlement)}
                  className="py-2 px-3 bg-carbon-surface/60 hover:bg-carbon-surface text-slate-300 rounded font-bold text-[9.5px] uppercase tracking-wider cursor-pointer border border-white/10 transition-all text-center"
                >
                  {showLedgerInSettlement ? "Hide Trade Ledger" : "Open Trade Ledger"}
                </button>
              )}
              <button
                type="button"
                onClick={handleTradeNextRace}
                className="py-2 px-4 bg-terminal-gold hover:bg-terminal-gold/90 text-carbon-black rounded font-extrabold text-[9.5px] uppercase tracking-wider cursor-pointer transition-all text-center shadow-lg"
              >
                {selectedRaceId === "abu_dhabi" ? "Reset Season Session" : "Trade Next Race"}
              </button>
            </div>

          </div>
        </div>
      )}
    </TerminalShell>
  );
}
