import React, { useState, useEffect } from "react";
import { 
  Play, Pause, RotateCcw, ShieldAlert, BookOpen, 
  Briefcase, Activity, Landmark, FileText, Globe, Trophy
} from "lucide-react";
import { RaceData, Contract } from "../hooks/useSimulation";
import { Position } from "../hooks/usePortfolio";
import BeginnerOnboarding from "./BeginnerOnboarding";

interface TerminalShellProps {
  raceData: RaceData | null;
  currentLapIdx: number;
  isPlaying: boolean;
  speed: number;
  isHalted: boolean;
  commentary: any[];
  contracts: { [id: string]: Contract };
  activeTab: string;
  setActiveTab: (tab: string) => void;
  allRaces: any[];
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
  
  children: React.ReactNode;
  densityMode: "default" | "focus";
  setDensityMode: (mode: "default" | "focus") => void;
}

export default function TerminalShell({
  raceData, currentLapIdx, isPlaying, speed, isHalted, commentary, contracts,
  activeTab, setActiveTab, allRaces, handlePlayPause, handleSpeedChange, handleInstantReplay,
  handleReset, selectedRaceId, setSelectedRaceId,
  cash, positions, assetsValue, portfolioValue, unrealizedPnL, exposurePercent,
  closePosition, resetPortfolio, getReturnPercent, children,
  densityMode, setDensityMode
}: TerminalShellProps) {
  
  const [beginnerMode, setBeginnerMode] = useState<boolean>(false);
  const [isAssembled, setIsAssembled] = useState<boolean>(false);

  // Auto-launch tutorial on first session load
  useEffect(() => {
    const sessionShown = sessionStorage.getItem("apexgp_session_tutorial_shown");
    const localCompleted = localStorage.getItem("apexgp_tutorial_completed");
    
    if (sessionShown !== "true" && localCompleted !== "true") {
      setBeginnerMode(true);
      sessionStorage.setItem("apexgp_session_tutorial_shown", "true");
    }
    
    const timer = setTimeout(() => {
      setIsAssembled(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const totalLaps = raceData?.laps_total || 0;
  const progressPercent = totalLaps > 0 ? (currentLapIdx / totalLaps) * 100 : 0;
  const activeWeather = raceData?.laps[currentLapIdx > 0 ? currentLapIdx - 1 : 0]?.weather;
  const activeSafetyCar = raceData?.laps[currentLapIdx > 0 ? currentLapIdx - 1 : 0]?.safety_car;

  const returnPct = getReturnPercent();

  const currentLapData = raceData?.laps && raceData.laps.length > 0
    ? raceData.laps[currentLapIdx > 0 ? Math.min(currentLapIdx - 1, raceData.laps.length - 1) : 0]
    : null;
  const sortedStandings = currentLapData
    ? [...currentLapData.positions].sort((a, b) => a.position - b.position)
    : [];

  // Dynamic State-Aware Atmosphere class
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

  // Robust labels to remove internal '(R)' and undefined
  const currentRaceIdx = allRaces.findIndex(r => r.id === selectedRaceId);
  const roundNumLabel = String(currentRaceIdx !== -1 ? currentRaceIdx + 1 : (raceData?.round_number || 1)).padStart(2, "0");
  const gpNameLabel = raceData?.race_name.replace("Grand Prix", "GP") || "Australian GP";
  const circuitLabel = raceData?.circuit ? raceData.circuit.split(",")[0] : "Melbourne";
  const countryLabel = raceData?.country || "Australia";

  // Density layout styles
  const isLeftCollapsed = densityMode === "focus";
  const isRightCollapsed = densityMode === "focus";
  const paddingClass = "p-3";
  const spacingClass = "space-y-3";
  const textClass = "text-[10.2px]";

  return (
    <div className={`min-h-screen bg-carbon-black flex flex-col font-mono text-[10px] text-slate-450 select-none antialiased ${stateAtmosphereClass} ${textClass}`}>
      
      {/* 1. TOP MAIN HEADER */}
      <header className={`h-11 bg-carbon-dark border-b border-white/5 flex items-center justify-between px-3 z-20 shrink-0 transform transition-all duration-700 ease-out ${isAssembled ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}`}>
        
        {/* Brand and Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => window.location.reload()}>
            <span className={`w-2 h-2 rounded ${isPlaying ? "bg-terminal-blue animate-ping" : "bg-slate-500"}`} />
            <h1 className="text-white font-extrabold tracking-wider text-[11px] uppercase select-none">
              APEXGP <span className="text-terminal-blue-light font-light">// INSTITUTIONAL DESK</span>
            </h1>
          </div>
          
          <div className="h-3 w-px bg-white/10" />
          
          <select
            value={selectedRaceId}
            onChange={(e) => setSelectedRaceId(e.target.value)}
            className="bg-carbon-surface hover:bg-white/5 text-slate-300 border border-white/5 rounded px-2 py-0.5 outline-none cursor-pointer text-[9px] font-bold transition-all max-w-[200px]"
          >
            {allRaces.map((r, idx) => (
              <option key={r.id} value={r.id}>
                ROUND {String(r.round_number || idx + 1).padStart(2, "0")} · {r.name.replace("Grand Prix", "GP")}
              </option>
            ))}
          </select>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-carbon-surface rounded border border-white/5 overflow-hidden">
            <button
              onClick={handlePlayPause}
              title={isPlaying ? "Pause Simulation" : "Start Simulation"}
              className={`p-1 px-1.5 hover:bg-white/5 cursor-pointer transition-colors ${isPlaying ? "text-terminal-yellow" : "text-terminal-green-light"}`}
            >
              {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
            </button>
            <button
              onClick={handleReset}
              title="Reset Simulation"
              className="p-1 px-1.5 hover:bg-white/5 text-slate-400 cursor-pointer border-l border-white/5 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Speed settings */}
          <div className="flex items-center bg-carbon-surface rounded border border-white/5 overflow-hidden text-[8px] font-bold">
            {[0.5, 1, 2, 4, 10].map((s) => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                className={`px-1.5 py-1 cursor-pointer transition-colors border-r border-white/5 last:border-0 ${speed === s && isPlaying ? "bg-terminal-blue/20 text-white font-bold" : "hover:bg-white/5 text-slate-500"}`}
              >
                {s}x
              </button>
            ))}
            <button
              onClick={handleInstantReplay}
              title="Settle Race Instantly"
              className="px-1.5 py-1 hover:bg-white/5 text-terminal-gold flex items-center gap-0.5 cursor-pointer transition-colors"
            >
              INST
            </button>
          </div>

          {/* Lap standings */}
          <div className="flex items-center gap-1.5 bg-carbon-surface rounded border border-white/5 px-2 py-0.5 text-white font-bold select-none">
            <span className="text-slate-400 text-[8px]">LAP</span>
            <span className="text-terminal-blue-light font-data text-[10.5px] font-extrabold">{currentLapIdx}</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-300 font-data text-[10px]">{totalLaps}</span>
          </div>

          {/* Halt Banner */}
          {isHalted ? (
            <div className="bg-terminal-red/10 border border-terminal-red/35 px-2 py-0.5 rounded flex items-center gap-1 text-terminal-red text-[9px] font-extrabold animate-pulse-border uppercase tracking-wider">
              <ShieldAlert className="w-2.5 h-2.5 text-terminal-red animate-bounce" /> HALTED
            </div>
          ) : (
            <div className="bg-terminal-green/5 border border-terminal-green/20 px-2 py-0.5 rounded flex items-center gap-1 text-terminal-green-light text-[9px] font-extrabold tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-terminal-green-light animate-pulse" /> BROADCASTING
            </div>
          )}
        </div>

        {/* Global Net Worth metrics */}
        <div className="flex items-center gap-3 bg-carbon-surface rounded border border-white/5 px-2.5 py-0.5 shadow-lg select-none">
          <div className="text-right">
            <span className="text-[7.5px] text-slate-450 block uppercase font-bold tracking-wider leading-none">NAV Net Worth</span>
            <span className="text-white text-[11px] font-extrabold font-data block leading-tight mt-0.5">
              ${portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="text-left font-data border-l border-white/5 pl-2">
            <span className="text-[7.5px] text-slate-450 block uppercase font-bold tracking-wider leading-none">Unrealized PnL</span>
            <span className={`text-[11px] font-extrabold block leading-tight mt-0.5 ${unrealizedPnL >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
              {unrealizedPnL >= 0 ? "+" : ""}${unrealizedPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

      </header>

      {/* Progress timeline strip */}
      <div className="w-full h-[2px] bg-carbon-surface z-10 shrink-0">
        <div className="bg-terminal-blue h-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
      </div>

      {/* 2. SUB NAVIGATION STRIP & DE-CLUTTER CONTROLS */}
      <nav className={`h-8 bg-carbon-dark border-b border-white/5 flex items-center justify-between px-3 z-10 shrink-0 transform transition-all duration-700 delay-75 ease-out ${isAssembled ? "translate-y-0 opacity-105" : "-translate-y-full opacity-0"}`}>
        
        {/* Workspace tabs */}
        <div className="flex gap-1 h-full items-end">
          {[
            { id: "market", label: "Race Markets", icon: <Globe className="w-3 h-3" /> },
            { id: "replay", label: "Race Replay", icon: <Activity className="w-3 h-3" /> },
            { id: "portfolio", label: "Portfolio", icon: <Briefcase className="w-3 h-3" /> },
            { id: "championship", label: "Season Futures", icon: <Landmark className="w-3 h-3" /> },
            { id: "standings", label: "Championship", icon: <Trophy className="w-3 h-3" /> },
            { id: "research", label: "Research Lab", icon: <FileText className="w-3 h-3" /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`h-[26px] px-3 font-bold border-t-2 flex items-center gap-1.5 transition-all text-[9px] cursor-pointer rounded-t ${activeTab === tab.id ? "bg-carbon-light border-terminal-blue text-white" : "border-transparent text-slate-550 hover:text-slate-350"}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Collapsible layout & density controls */}
        <div className="flex items-center gap-2 select-none">
          
          {/* Workspace density mode selection */}
          <div className="flex items-center bg-carbon-surface rounded border border-white/5 overflow-hidden text-[8.5px] font-bold mr-1 select-none">
            <button
              type="button"
              onClick={() => setDensityMode("default")}
              className={`px-3 py-1 cursor-pointer transition-all ${densityMode === "default" ? "bg-terminal-blue/20 text-white font-bold" : "hover:bg-white/5 text-slate-550 hover:text-slate-400"}`}
            >
              Default Mode
            </button>
            <button
              type="button"
              onClick={() => setDensityMode("focus")}
              className={`px-3 py-1 cursor-pointer transition-all ${densityMode === "focus" ? "bg-terminal-blue/20 text-white font-bold" : "hover:bg-white/5 text-slate-550 hover:text-slate-400"}`}
            >
              Focus Mode
            </button>
          </div>

          <div className="h-3 w-px bg-white/10 mx-1" />

          {/* Tutorial mode trigger */}
          <button
            type="button"
            onClick={() => setBeginnerMode(true)}
            className={`px-2 py-0.5 rounded font-bold border text-[8.5px] flex items-center gap-1 cursor-pointer transition-all ${beginnerMode ? "bg-terminal-blue/15 border-terminal-blue/30 text-white" : "bg-white/3 border-white/5 text-slate-550 hover:text-slate-400"}`}
          >
            <BookOpen className="w-2.5 h-2.5" />
            Tutorial
          </button>
        </div>

      </nav>

      {/* 3. CORE FRAMEWORK LAYOUT */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* LEFT COLUMN: RACE STORY timing desk */}
        {!isLeftCollapsed && (
          <aside className={`w-56 bg-carbon-dark border-r border-white/5 flex flex-col overflow-y-auto ${paddingClass} ${spacingClass} shrink-0 scrollbar-none transition-all duration-700 delay-100 ease-out transform ${isAssembled ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"}`}>
            
            <div className={`flex-1 flex flex-col ${spacingClass} text-[9.5px] select-none font-mono`}>
              
              {/* Header: GP Name in official F1 convention */}
              <div className="bg-carbon-surface/60 border border-white/5 rounded p-2.5 space-y-1">
                <span className="text-[7px] text-slate-500 font-bold uppercase tracking-wider block">Race Telemetry Context</span>
                <h3 className="text-white font-extrabold text-[10px] leading-tight uppercase">
                  ROUND {roundNumLabel} · {gpNameLabel}
                </h3>
                <p className="text-slate-450 leading-none text-[8px] mt-0.5 font-bold">{circuitLabel}</p>
              </div>

              {/* State-based narrative sections */}
              {currentLapIdx === 0 ? (
                /* 1. PRE-RACE STATE */
                <>
                  <div className="bg-carbon-surface border border-white/5 rounded p-2.5 space-y-2">
                    <span className="text-[7px] text-slate-500 font-bold uppercase tracking-wider block border-b border-white/5 pb-1">Opening Winner Odds</span>
                    <div className="space-y-1 select-none font-data">
                      <div className="flex justify-between">
                        <span className="text-slate-350">L. Leclerc (LEC)</span>
                        <span className="text-terminal-blue-light font-bold">21%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-350">O. Piastri (PIA)</span>
                        <span className="text-terminal-blue-light font-bold">19%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-350">L. Norris (NOR)</span>
                        <span className="text-terminal-blue-light font-bold">17%</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-carbon-surface border border-white/5 rounded p-2.5 space-y-1 text-[8.5px]">
                    <span className="text-[7px] text-slate-500 font-bold uppercase tracking-wider block border-b border-white/5 pb-1">Circuit Environment</span>
                    <div className="flex justify-between pt-1 font-data text-slate-450">
                      <span>Track Temp:</span>
                      <span className="text-white font-bold">{activeWeather ? `${activeWeather.track_temp.toFixed(0)}°C / ${Math.round(activeWeather.track_temp * 1.8 + 32)}°F` : "24°C / 75°F"} / Dry</span>
                    </div>
                  </div>

                  <div className="bg-carbon-surface border border-white/5 rounded p-2.5 space-y-2">
                    <span className="text-[7px] text-slate-500 font-bold uppercase tracking-wider block border-b border-white/5 pb-1">Expected Event Odds</span>
                    <div className="space-y-1 font-data text-[8.5px]">
                      <div className="flex justify-between">
                        <span className="text-slate-450">SC Probability:</span>
                        <span className="text-white font-bold">32%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-450">DNF Probability:</span>
                        <span className="text-white font-bold">18%</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-carbon-surface/20 border border-white/5 rounded p-2 text-center text-slate-500 border-dashed">
                    <span className="font-extrabold uppercase text-[7.5px] block">REPLAY STATE: PRE-RACE</span>
                    <p className="text-[7px] mt-0.5 leading-snug font-sans font-light">Launch simulation to process dynamic timing streams.</p>
                  </div>
                </>
              ) : currentLapIdx < totalLaps ? (
                /* 2. DURING REPLAY STATE */
                <>
                  <div className="bg-carbon-surface border border-white/5 rounded p-2.5 space-y-2">
                    <span className="text-[7px] text-slate-500 font-bold uppercase tracking-wider block border-b border-white/5 pb-1">RACE STORY STATUS</span>
                    <div className="space-y-1.5 text-[9px] font-bold">
                      <div className="flex justify-between items-center bg-carbon-black/30 p-1 px-1.5 rounded">
                        <span className="text-slate-500 text-[6.5px] uppercase">Telemetry Lap</span>
                        <span className="text-terminal-blue-light font-data text-[10px]">{currentLapIdx} / {totalLaps}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-white/5 pb-1 mt-1">
                        <span className="text-slate-500 text-[6.5px] uppercase">Current Leader</span>
                        <span className="text-white font-data">{sortedStandings.length > 0 ? sortedStandings[0].driver_code : "VER"}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-white/5 pb-1">
                        <span className="text-slate-500 text-[6.5px] uppercase">Active Podium</span>
                        <span className="text-slate-200 text-[8.5px] font-data">
                          {sortedStandings.slice(0, 3).map(p => p.driver_code).join(", ") || "VER, NOR, LEC"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-[6.5px] uppercase">Safety Car Trigger</span>
                        <span className={`px-1 py-0.2 rounded text-[7.5px] font-extrabold ${activeSafetyCar && activeSafetyCar !== "NONE" && activeSafetyCar !== "" ? "bg-terminal-yellow/10 text-terminal-yellow border border-terminal-yellow/20" : "text-slate-550"}`}>
                          {activeSafetyCar && activeSafetyCar !== "NONE" && activeSafetyCar !== "" ? "YES" : "NO"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-carbon-surface border border-white/5 rounded p-2.5 space-y-1.5">
                    <span className="text-[7px] text-slate-500 font-bold uppercase tracking-wider block border-b border-white/5 pb-1">Most Recent Event</span>
                    <div className="text-slate-200 text-[8.5px] leading-snug font-sans font-light">
                      {commentary.length > 0 ? commentary[0].headline : "Green flags active."}
                    </div>
                  </div>

                  <div className="bg-carbon-surface border border-white/5 rounded p-2.5 space-y-1.5 font-data">
                    <span className="text-[7px] text-slate-500 font-bold uppercase tracking-wider block border-b border-white/5 pb-1">Winner Market Shift</span>
                    <div className="flex justify-between items-center text-[8.5px]">
                      <span className="text-slate-400">Winner Ticker [{sortedStandings.length > 0 ? sortedStandings[0].driver_code : "VER"}]:</span>
                      <span className={`font-bold ${(Object.values(contracts).find(c => c.type === "WINNER" && c.target === (sortedStandings.length > 0 ? sortedStandings[0].driver_code : "VER"))?.change || 0) >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
                        {(() => {
                          const lc = sortedStandings.length > 0 ? sortedStandings[0].driver_code : "VER";
                          const cMatch = Object.values(contracts).find(c => c.type === "WINNER" && c.target === lc);
                          return cMatch ? `${cMatch.change >= 0 ? "+" : ""}${Math.round(cMatch.change * 100)}%` : "0%";
                        })()}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                /* 3. SETTLED STATE */
                <>
                  <div className="bg-carbon-surface border border-terminal-gold/25 rounded p-2.5 space-y-2.5 select-none relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-1 bg-terminal-gold/10 text-terminal-gold text-[6px] font-extrabold tracking-wider border-l border-b border-terminal-gold/20 font-sans">
                      RESOLVED
                    </div>
                    <span className="text-[7px] text-slate-500 font-bold uppercase tracking-wider block border-b border-white/5 pb-1">FINAL RESULTS SUMMARY</span>
                    <div className="space-y-1.5 text-[9px] font-bold font-data">
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-500 text-[6.5px] uppercase">Winner Title</span>
                        <span className="text-terminal-gold">{sortedStandings.length > 0 ? sortedStandings[0].driver_code : "VER"}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-500 text-[6.5px] uppercase">Podium Finishers</span>
                        <span className="text-slate-200">{sortedStandings.slice(0, 3).map(p => p.driver_code).join(", ")}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-500 text-[6.5px] uppercase">Fastest Lap</span>
                        <span className="text-terminal-blue-light">{raceData?.starting_grid[2]?.driver_code || "HAD"}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-500 text-[6.5px] uppercase">Safety Car</span>
                        <span className="text-white">{activeSafetyCar && activeSafetyCar !== "NONE" && activeSafetyCar !== "" ? "YES" : "NO"}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-500 text-[6.5px] uppercase block mb-1">Retired (DNFs)</span>
                        <span className="text-terminal-red text-[8px] leading-relaxed truncate font-data">
                          {sortedStandings.filter(p => p.dnf).map(p => p.driver_code).join(", ") || "NONE RECORDED"}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}

            </div>
          </aside>
        )}

        {/* CENTER PRIMARY PANEL: TAB CONTENT */}
        <main className={`flex-1 bg-carbon-light telemetry-grid overflow-y-auto min-w-0 transition-all duration-800 delay-150 ease-out ${paddingClass} ${isAssembled ? "opacity-100 scale-100" : "opacity-0 scale-[0.98]"}`}>
          {children}
        </main>

        {/* RIGHT COLUMN: PORTFOLIO HOLDINGS SNAPSHOT */}
        {!isRightCollapsed && (
          <aside className={`w-72 bg-carbon-dark border-l border-white/5 flex flex-col overflow-y-auto ${paddingClass} ${spacingClass} shrink-0 scrollbar-none transition-all duration-700 delay-100 ease-out transform ${isAssembled ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}>
            
            {/* Risk attribution stats */}
            <div className="bg-carbon-surface border border-white/5 rounded p-2.5 space-y-2 font-data text-[9px]">
              <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider block">Portfolio Net Balances</span>
              <div className="grid grid-cols-2 gap-2 select-none">
                <div>
                  <span className="text-slate-500 block text-[7px] uppercase group relative cursor-help">
                    Cash (Sandbox)
                    <span className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 w-36 rounded bg-carbon-black border border-white/10 p-1.5 text-[7px] leading-tight text-white opacity-0 transition-opacity group-hover:opacity-100 font-sans font-light select-none shadow-xl normal-case">
                      Available sandbox liquidity
                    </span>
                  </span>
                  <span className="text-white font-bold block mt-0.5">${cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[7px] uppercase group relative cursor-help">
                    Derivative Value
                    <span className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 w-36 rounded bg-carbon-black border border-white/10 p-1.5 text-[7px] leading-tight text-white opacity-0 transition-opacity group-hover:opacity-100 font-sans font-light select-none shadow-xl normal-case">
                      Mark-to-market positions valuation
                    </span>
                  </span>
                  <span className="text-white font-bold block mt-0.5">${assetsValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[7px] uppercase group relative cursor-help">
                    Risk Exposure
                    <span className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 w-36 rounded bg-carbon-black border border-white/10 p-1.5 text-[7px] leading-tight text-white opacity-0 transition-opacity group-hover:opacity-100 font-sans font-light select-none shadow-xl normal-case">
                      Portfolio at risk
                    </span>
                  </span>
                  <span className={`font-bold block mt-0.5 ${exposurePercent > 25 ? "text-terminal-yellow font-bold" : "text-white"}`}>
                    {exposurePercent.toFixed(1)}% <span className="text-[7.5px] text-slate-500">/ 30%</span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[7px] uppercase">Capital Return</span>
                  <span className={`font-bold block mt-0.5 ${returnPct >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
                    {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(2)}%
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  if (confirm("Resetting the season session will fully clear your portfolio balances ($100k baseline), wipe trade history ledger, purge championship standings, and return you back to Round 01 Australian GP. Are you sure you want to proceed?")) {
                    resetPortfolio();
                  }
                }}
                className="w-full py-1 border border-white/5 hover:bg-white/3 text-[8.5px] text-slate-500 hover:text-white rounded transition-colors text-center cursor-pointer font-bold block uppercase"
              >
                Reset Season Session
              </button>
            </div>

            {/* Holdings list (Dynamic Empty State) */}
            <div className="bg-carbon-surface border border-white/5 rounded p-2.5 flex-1 flex flex-col overflow-hidden min-h-0 select-none">
              <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">Open Derivative Positions</span>
                         {(() => {
                const positionsArray = Object.values(positions);
                const racePositions = positionsArray.filter(pos => {
                  const contract = contracts[pos.contractId];
                  return contract ? !contract.type.startsWith("FUTURE_") : !pos.contractId.startsWith("FUTURE_");
                });
                const seasonPositions = positionsArray.filter(pos => {
                  const contract = contracts[pos.contractId];
                  return contract ? contract.type.startsWith("FUTURE_") : pos.contractId.startsWith("FUTURE_");
                });

                if (positionsArray.length === 0) {
                  return (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-650 text-center p-4 border border-dashed border-white/5 rounded">
                      <span className="text-[10px] uppercase font-bold tracking-wider">Desk Standby</span>
                      <p className="text-[8px] leading-normal mt-1 text-slate-600 font-mono">
                        Open a position to begin replay. Trade a market to activate valuation.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                    {/* RACE CONTRACTS SECTION */}
                    {racePositions.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[7.5px] text-terminal-blue font-bold uppercase tracking-wider block border-b border-white/5 pb-1">
                          ⚡ Race Contracts
                        </span>
                        {racePositions.map((pos) => {
                          const contract = contracts[pos.contractId];
                          const exitPrice = contract ? (contract.settled ? (contract.settlementValue ?? 0) : (pos.side === "LAY" ? 1.00 - contract.ask : contract.bid)) : pos.entryPrice;
                          const profit = pos.qty * (exitPrice - pos.entryPrice);
                          const posKey = pos.side === "LAY" ? `${pos.contractId}_NO` : pos.contractId;
                          
                          return (
                            <div key={posKey} className="bg-carbon-black p-2 border border-white/5 rounded space-y-1.5 font-data text-[9.5px]">
                              <div className="flex justify-between items-start">
                                <div className="truncate max-w-[130px]">
                                  <span className="text-white font-bold block truncate leading-tight uppercase">{pos.contractTitle}</span>
                                  <span className="text-[7.5px] text-slate-500 uppercase block font-semibold mt-0.5">{pos.contractType}</span>
                                </div>
                                <button
                                  onClick={() => closePosition(posKey)}
                                  className="px-1.5 py-0.5 bg-terminal-red/10 border border-terminal-red/20 hover:border-terminal-red/40 text-[8px] text-terminal-red font-bold uppercase rounded cursor-pointer transition-all"
                                >
                                  Exit
                                </button>
                              </div>

                              <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-white/5 select-none text-[8.5px] text-slate-400">
                                <div className="flex justify-between">
                                  <span>Size:</span>
                                  <span className="text-white font-bold">{pos.qty}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>PnL:</span>
                                  <span className={`font-bold ${profit >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
                                    {profit >= 0 ? "+" : ""}${profit.toFixed(0)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Entry:</span>
                                  <span className="text-slate-350">${pos.entryPrice.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Val:</span>
                                  <span className="text-slate-350">${exitPrice.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* SEASON CHAMPIONSHIP FUTURES SECTION */}
                    {seasonPositions.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[7.5px] text-terminal-gold font-bold uppercase tracking-wider block border-b border-white/5 pb-1">
                          🏆 Season Futures
                        </span>
                        {seasonPositions.map((pos) => {
                          const contract = contracts[pos.contractId];
                          const exitPrice = contract ? (contract.settled ? (contract.settlementValue ?? 0) : (pos.side === "LAY" ? 1.00 - contract.ask : contract.bid)) : pos.entryPrice;
                          const profit = pos.qty * (exitPrice - pos.entryPrice);
                          const mtmVal = pos.qty * exitPrice;
                          
                          return (
                            <div key={pos.contractId} className="bg-carbon-black p-2 border border-white/5 rounded space-y-1.5 font-data text-[9.5px]">
                              <div className="flex justify-between items-start">
                                <div className="truncate max-w-[170px]">
                                  <span className="text-terminal-gold font-bold block truncate leading-tight uppercase font-mono">{pos.contractTitle}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-white/5 select-none text-[8.5px] text-slate-400">
                                <div className="flex justify-between col-span-2">
                                  <span>Future Asset:</span>
                                  <span className="text-white font-bold">{pos.contractId}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Pos Size:</span>
                                  <span className="text-white font-bold">{pos.qty} units</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Entry Price:</span>
                                  <span className="text-slate-300">${pos.entryPrice.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Current MTM:</span>
                                  <span className="text-slate-300 font-bold">${mtmVal.toFixed(0)}</span>
                                </div>
                                <div className="flex justify-between col-span-2 border-t border-white/5 pt-1 mt-1">
                                  <span>Unrealized PnL:</span>
                                  <span className={`font-bold ${profit >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
                                    {profit >= 0 ? "+" : ""}${profit.toFixed(0)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

          </aside>
        )}

      </div>

      {/* 4. BOTTOM NEWS TAPE ticker */}
      <footer className="h-5.5 bg-carbon-dark border-t border-white/5 flex items-center px-3 overflow-hidden z-20 shrink-0 font-data select-none">
        <span className="text-terminal-blue font-bold tracking-wider text-[8.5px] mr-3 shrink-0 uppercase flex items-center gap-1.5">
          <Activity className="w-3 h-3" /> WIRE FEED //
        </span>
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-marquee whitespace-nowrap inline-flex gap-8 hover:[animation-play-state:paused] cursor-pointer">
            {commentary.length > 0 ? (
              commentary.slice(0, 10).map((c, idx) => {
                let colorClass = "text-slate-400";
                if (c.impactType === "gain") colorClass = "text-terminal-green-light font-bold";
                else if (c.impactType === "loss") colorClass = "text-terminal-red font-bold";
                else if (c.impactType === "halt") colorClass = "text-terminal-yellow font-bold";
                else if (c.impactType === "settlement") colorClass = "text-terminal-gold font-bold";

                return (
                  <span key={idx} className={`inline-flex items-center gap-1.5 text-[8.5px] ${colorClass}`}>
                    <span className="text-slate-600 font-bold">[{c.timestamp}]</span>
                    {c.headline}
                  </span>
                );
              })
            ) : (
              <span className="text-slate-650 text-[8.5px] font-mono">REPLAY WIRE SYSTEM NOMINAL. LAUNCH REPLAY TO STREAM QUANT PRICE COMMITS.</span>
            )}
          </div>
        </div>
      </footer>

      {beginnerMode && (
        <BeginnerOnboarding onClose={() => setBeginnerMode(false)} />
      )}

    </div>
  );
}
