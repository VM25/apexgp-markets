"use client";

import React, { useState, useEffect } from "react";
import { RaceData, Contract, CommentaryHeadline } from "../hooks/useSimulation";
import { Position } from "../hooks/usePortfolio";
import { Receipt } from "lucide-react";

interface RaceMeta {
  id: string;
  name: string;
  round_number?: number;
}
import BeginnerOnboarding from "./BeginnerOnboarding";
import AppShell from "./AppShell";
import CommandBar from "./CommandBar";
import WorkspaceNav from "./WorkspaceNav";
import MobilePlaybackStrip from "./MobilePlaybackStrip";
import LeftRail from "./LeftRail";
import DeskPanel from "./DeskPanel";
import BottomTicker from "./BottomTicker";
import ToastStack from "./Toast";
import MobileTabBar from "./MobileTabBar";
import Drawer from "./Drawer";
import MobileSheet from "./MobileSheet";
import OrderTicket from "./OrderTicket";
import { useTerminalUI } from "./TerminalUIProvider";

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

  const {
    leftDrawerOpen,
    setLeftDrawerOpen,
    rightDrawerOpen,
    setRightDrawerOpen,
    activeSheet,
    setActiveSheet,
    selectedContractId,
  } = useTerminalUI();

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

  const isTradingTab = activeTab === "market" || activeTab === "championship";
  const selectedContract = contracts[selectedContractId];
  const kind: "race" | "futures" = activeTab === "championship" ? "futures" : "race";
  const selectionValidForTab =
    selectedContract &&
    (kind === "futures"
      ? selectedContract.type.startsWith("FUTURE_")
      : !selectedContract.type.startsWith("FUTURE_"));

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

  const deskPanel = (
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
  );

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
            showDeskTrigger
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
        mobilePlayback={
          <MobilePlaybackStrip
            isPlaying={isPlaying}
            isHalted={isHalted}
            speed={speed}
            currentLapIdx={currentLapIdx}
            totalLaps={totalLaps}
            handlePlayPause={handlePlayPause}
            handleReset={handleReset}
            handleInstantReplay={handleInstantReplay}
            handleSpeedChange={handleSpeedChange}
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
        deskPanel={deskPanel}
        ticker={<BottomTicker commentary={commentary} />}
        mobileTabBar={
          <MobileTabBar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onOpenMore={() => setActiveSheet("more")}
          />
        }
        overlays={
          <>
            {/* LeftRail as a left Drawer (<1280). */}
            <Drawer
              open={leftDrawerOpen}
              onClose={() => setLeftDrawerOpen(false)}
              side="left"
              title="Race Story"
            >
              <LeftRail
                raceData={raceData}
                currentLapIdx={currentLapIdx}
                totalLaps={totalLaps}
                contracts={contracts}
                commentary={commentary}
                isAssembled
                inDrawer
              />
            </Drawer>

            {/* DeskPanel as a right Drawer (768-1023). */}
            <Drawer
              open={rightDrawerOpen}
              onClose={() => setRightDrawerOpen(false)}
              side="right"
              title="Order Desk"
              widthClass="w-[min(340px,90vw)]"
            >
              <div className="p-3 h-full min-h-0">{deskPanel}</div>
            </Drawer>

            {/* Mobile bottom sheets (<768). */}
            <MobileSheet
              open={activeSheet === "ticket"}
              onClose={() => setActiveSheet(null)}
              title={kind === "futures" ? "Title Derivative Ticket" : "Order Ticket"}
            >
              {selectionValidForTab && selectedContract ? (
                <div className="panel-raised rounded p-3">
                  <OrderTicket
                    key={selectedContract.id}
                    kind={kind}
                    contract={selectedContract}
                    positions={positions}
                    cash={cash}
                    portfolioValue={portfolioValue}
                    assetsValue={assetsValue}
                    isHalted={isHalted}
                    buyContracts={buyContracts}
                    sellContracts={sellContracts}
                  />
                </div>
              ) : (
                <div className="text-body-sm text-slate-400 font-sans font-light p-4 text-center">
                  Select a contract from the chain to activate the execution ticket.
                </div>
              )}
            </MobileSheet>

            <MobileSheet
              open={activeSheet === "nav"}
              onClose={() => setActiveSheet(null)}
              title="Portfolio & Positions"
            >
              <DeskPanel
                activeTab="portfolio"
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
            </MobileSheet>

            <MobileSheet
              open={activeSheet === "more"}
              onClose={() => setActiveSheet(null)}
              title="More Workspaces"
            >
              <MoreMenu
                setActiveTab={setActiveTab}
                onOpenTutorial={() => setBeginnerMode(true)}
                onClose={() => setActiveSheet(null)}
              />
            </MobileSheet>

            <MobileSheet
              open={activeSheet === "commentary"}
              onClose={() => setActiveSheet(null)}
              title="Wire Commentary"
            >
              <CommentarySheet commentary={commentary} />
            </MobileSheet>

            {/* Floating "Ticket" affordance on mobile when a contract is selected. */}
            {isTradingTab && selectionValidForTab && activeSheet === null && (
              <button
                type="button"
                onClick={() => setActiveSheet("ticket")}
                className="md:hidden fixed right-3 z-[55] flex items-center gap-1.5 bg-terminal-blue hover:bg-terminal-blue-light text-white font-bold text-body-sm uppercase tracking-wider rounded-full px-4 py-3 shadow-[0_6px_24px_rgba(0,0,0,0.5)] cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 active:scale-[0.97]"
                style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom) + 2.5rem)" }}
              >
                <Receipt className="w-4 h-4" /> Ticket
              </button>
            )}
          </>
        }
      />

      <ToastStack />

      {beginnerMode && <BeginnerOnboarding onClose={() => setBeginnerMode(false)} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile "More" workspace menu                                        */
/* ------------------------------------------------------------------ */
function MoreMenu({
  setActiveTab,
  onOpenTutorial,
  onClose,
}: {
  setActiveTab: (tab: string) => void;
  onOpenTutorial: () => void;
  onClose: () => void;
}) {
  const items: { label: string; onClick: () => void }[] = [
    {
      label: "Championship (Standings)",
      onClick: () => {
        setActiveTab("standings");
        onClose();
      },
    },
    {
      label: "Research Lab",
      onClick: () => {
        setActiveTab("research");
        onClose();
      },
    },
    {
      label: "Tutorial",
      onClick: () => {
        onOpenTutorial();
        onClose();
      },
    },
  ];

  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          className="w-full text-left px-3 py-3 rounded panel-raised text-body-sm text-slate-200 font-bold hover:bg-white/5 hover:text-white cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile commentary sheet (reuses existing commentary data)           */
/* ------------------------------------------------------------------ */
function CommentarySheet({ commentary }: { commentary: CommentaryHeadline[] }) {
  if (commentary.length === 0) {
    return (
      <div className="text-body-sm text-slate-500 font-sans font-light text-center p-6 border border-dashed border-white/5 rounded">
        Wire nominal. Launch the replay to stream lap-by-lap commentary.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {commentary.slice(0, 30).map((c, idx) => (
        <div key={idx} className="bg-carbon-black/35 border border-white/5 rounded p-2.5 flex items-start gap-2">
          <span className="px-1.5 py-0.5 bg-terminal-blue/15 border border-terminal-blue/30 text-terminal-blue-light font-bold rounded text-micro uppercase shrink-0 mt-0.5 min-w-[52px] text-center font-data">
            LAP {c.lap}
          </span>
          <p className="text-body-sm text-slate-200 font-sans font-light leading-snug flex-1">{c.headline}</p>
        </div>
      ))}
    </div>
  );
}
