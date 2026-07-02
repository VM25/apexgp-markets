"use client";

import React, { useState, useEffect } from "react";
import { RaceData, Contract, CommentaryHeadline } from "../hooks/useSimulation";
import { Position } from "../hooks/usePortfolio";

interface RaceMeta {
  id: string;
  name: string;
  round_number?: number;
}
import BeginnerOnboarding from "./BeginnerOnboarding";
import AppShell from "./AppShell";
import CommandBar from "./CommandBar";
import WorkspaceNav from "./WorkspaceNav";
import LeftRail from "./LeftRail";
import DeskPanel from "./DeskPanel";
import BottomTicker from "./BottomTicker";
import ToastStack from "./Toast";

interface TerminalShellProps {
  raceData: RaceData | null;
  currentLapIdx: number;
  isPlaying: boolean;
  speed: number;
  isHalted: boolean;
  commentary: CommentaryHeadline[];
  contracts: { [id: string]: Contract };
  activeTab: string;
  setActiveTab: (tab: string) => void;
  allRaces: RaceMeta[];
  handlePlayPause: () => void;
  handleSpeedChange: (speed: number) => void;
  handleInstantReplay: () => void;
  handleReset: () => void;
  selectedRaceId: string;
  setSelectedRaceId: (id: string) => void;

  cash: number;
  positions: { [id: string]: Position };
  assetsValue: number;
  portfolioValue: number;
  unrealizedPnL: number;
  exposurePercent: number;
  closePosition: (id: string) => void;
  resetPortfolio: () => void;
  getReturnPercent: () => number;

  buyContracts: (id: string, qty: number, side?: "BUY" | "LAY") => { success: boolean; message: string };
  sellContracts: (posKey: string, qty: number) => { success: boolean; message: string };

  children: React.ReactNode;
  densityMode: "default" | "focus";
  setDensityMode: (mode: "default" | "focus") => void;
}

export default function TerminalShell({
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
  handleReset,
  selectedRaceId,
  setSelectedRaceId,
  cash,
  positions,
  assetsValue,
  portfolioValue,
  unrealizedPnL,
  exposurePercent,
  closePosition,
  resetPortfolio,
  getReturnPercent,
  buyContracts,
  sellContracts,
  children,
  densityMode,
  setDensityMode,
}: TerminalShellProps) {
  const [beginnerMode, setBeginnerMode] = useState<boolean>(false);
  const [isAssembled, setIsAssembled] = useState<boolean>(false);

  // Auto-launch tutorial on first session load + entrance animation.
  useEffect(() => {
    const sessionShown = sessionStorage.getItem("apexgp_session_tutorial_shown");
    const localCompleted = localStorage.getItem("apexgp_tutorial_completed");

    if (sessionShown !== "true" && localCompleted !== "true") {
      setBeginnerMode(true);
      sessionStorage.setItem("apexgp_session_tutorial_shown", "true");
    }

    const timer = setTimeout(() => setIsAssembled(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const totalLaps = raceData?.laps_total || 0;
  const progressPercent = totalLaps > 0 ? (currentLapIdx / totalLaps) * 100 : 0;
  const activeSafetyCar = raceData?.laps[currentLapIdx > 0 ? currentLapIdx - 1 : 0]?.safety_car;
  const returnPct = getReturnPercent();

  // Dynamic State-Aware Atmosphere class (else-if chain preserved for Wave C)
  let stateAtmosphereClass = "state-transition-container";
  if (isHalted) {
    stateAtmosphereClass += " state-market-halt";
  } else if (activeSafetyCar && activeSafetyCar !== "NONE" && activeSafetyCar !== "") {
    stateAtmosphereClass += " state-safety-car";
  } else if (currentLapIdx > 0 && currentLapIdx === totalLaps) {
    stateAtmosphereClass += " state-settlement";
  } else if (isPlaying) {
    stateAtmosphereClass += " state-replay-running";
  } else if (unrealizedPnL < -200) {
    stateAtmosphereClass += " state-drawdown";
  } else if (unrealizedPnL > 200) {
    stateAtmosphereClass += " state-gain";
  }

  return (
    <>
      <AppShell
        atmosphereClass={stateAtmosphereClass}
        commandBar={
          <CommandBar
            isPlaying={isPlaying}
            isHalted={isHalted}
            speed={speed}
            currentLapIdx={currentLapIdx}
            totalLaps={totalLaps}
            selectedRaceId={selectedRaceId}
            setSelectedRaceId={setSelectedRaceId}
            allRaces={allRaces}
            portfolioValue={portfolioValue}
            unrealizedPnL={unrealizedPnL}
            handlePlayPause={handlePlayPause}
            handleReset={handleReset}
            handleInstantReplay={handleInstantReplay}
            handleSpeedChange={handleSpeedChange}
            onResetSeason={resetPortfolio}
            isAssembled={isAssembled}
          />
        }
        workspaceNav={
          <WorkspaceNav
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            densityMode={densityMode}
            setDensityMode={setDensityMode}
            onOpenTutorial={() => setBeginnerMode(true)}
            progressPercent={progressPercent}
            isAssembled={isAssembled}
          />
        }
        leftRail={
          <LeftRail
            raceData={raceData}
            currentLapIdx={currentLapIdx}
            totalLaps={totalLaps}
            contracts={contracts}
            commentary={commentary}
            isAssembled={isAssembled}
          />
        }
        main={
          <div
            className={`h-full min-h-0 transition-all duration-700 delay-150 ease-out ${isAssembled ? "opacity-100 scale-100" : "opacity-0 scale-[0.98]"}`}
          >
            {children}
          </div>
        }
        deskPanel={
          <DeskPanel
            activeTab={activeTab}
            contracts={contracts}
            positions={positions}
            cash={cash}
            assetsValue={assetsValue}
            portfolioValue={portfolioValue}
            exposurePercent={exposurePercent}
            returnPct={returnPct}
            isHalted={isHalted}
            buyContracts={buyContracts}
            sellContracts={sellContracts}
            closePosition={closePosition}
            resetPortfolio={resetPortfolio}
          />
        }
        ticker={<BottomTicker commentary={commentary} />}
      />

      <ToastStack />

      {beginnerMode && <BeginnerOnboarding onClose={() => setBeginnerMode(false)} />}
    </>
  );
}
