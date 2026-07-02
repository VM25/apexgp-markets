"use client";

import React, { useState, useEffect } from "react";
import { useSimulation } from "../hooks/useSimulation";
import { usePortfolio } from "../hooks/usePortfolio";
import LandingView from "../components/LandingView";
import TerminalShell from "../components/TerminalShell";
import { TerminalUIProvider } from "../components/TerminalUIProvider";
import SettlementModal from "../components/SettlementModal";
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
    <TerminalUIProvider>
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
        buyContracts={buyContracts}
        sellContracts={sellContracts}
        densityMode={densityMode}
        setDensityMode={setDensityMode}
      >
        {renderTabContent()}
      </TerminalShell>

      {showSettlement && (
        <SettlementModal
          roundNumLabel={roundNumLabel}
          gpNameLabel={gpNameLabel}
          winner={winner}
          safetyCarOccurred={safetyCarOccurred}
          fastestLapHolder={fastestLapHolder}
          dnfList={dnfList}
          podiumList={podiumList}
          lastSettledPositions={lastSettledPositions}
          totalSettledPnL={totalSettledPnL}
          cashBeforeSettlement={cashBeforeSettlement}
          cashAfterSettlement={cashAfterSettlement}
          portfolioChangePct={portfolioChangePct}
          selectedRaceId={selectedRaceId}
          driverPoints={driverPoints}
          constructorPoints={constructorPoints}
          getSharpeRatio={getSharpeRatio}
          getHitRate={getHitRate}
          portfolioValue={portfolioValue}
          maxDrawdown={maxDrawdown}
          bestTrade={bestTrade}
          worstTrade={worstTrade}
          mostProfitableMarket={mostProfitableMarket}
          onReviewReplay={() => {
            setSettlementDismissedForRace(selectedRaceId);
            setActiveTab("replay");
          }}
          onTradeNextRace={handleTradeNextRace}
        />
      )}
    </TerminalUIProvider>
  );
}
