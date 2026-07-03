"use client";

import React from "react";
import { RaceData, Contract, CommentaryHeadline } from "../hooks/useSimulation";
import FieldLabel from "./FieldLabel";

interface LeftRailProps {
  raceData: RaceData | null;
  currentLapIdx: number;
  totalLaps: number;
  contracts: { [id: string]: Contract };
  commentary: CommentaryHeadline[];
  isAssembled: boolean;
  /** When hosted inside the mobile/tablet Drawer, drop the inline slide-in + border. */
  inDrawer?: boolean;
}

/**
 * Race telemetry context rail (left). Three states: pre-race, during replay,
 * settled. Ported from the original TerminalShell left column.
 */
export default function LeftRail({
  raceData,
  currentLapIdx,
  totalLaps,
  contracts,
  commentary,
  isAssembled,
  inDrawer = false,
}: LeftRailProps) {
  const currentRaceIdx = raceData?.round_number ? raceData.round_number : 1;
  const roundNumLabel = String(currentRaceIdx).padStart(2, "0");
  const gpNameLabel = raceData?.race_name.replace("Grand Prix", "GP") || "Australian GP";
  const circuitLabel = raceData?.circuit ? raceData.circuit.split(",")[0] : "Melbourne";

  const activeWeather = raceData?.laps[currentLapIdx > 0 ? currentLapIdx - 1 : 0]?.weather;
  const activeSafetyCar = raceData?.laps[currentLapIdx > 0 ? currentLapIdx - 1 : 0]?.safety_car;

  const currentLapData =
    raceData?.laps && raceData.laps.length > 0
      ? raceData.laps[currentLapIdx > 0 ? Math.min(currentLapIdx - 1, raceData.laps.length - 1) : 0]
      : null;
  const sortedStandings = currentLapData
    ? [...currentLapData.positions].sort((a, b) => a.position - b.position)
    : [];

  const leader = sortedStandings.length > 0 ? sortedStandings[0].driver_code : "VER";
  const scActive = activeSafetyCar && activeSafetyCar !== "NONE" && activeSafetyCar !== "";

  return (
    <aside
      className={
        inDrawer
          ? "w-full bg-carbon-dark flex flex-col overflow-y-auto scrollbar-none p-3 space-y-3"
          : `w-full bg-carbon-dark border-r border-white/5 flex flex-col overflow-y-auto scrollbar-none p-3 space-y-3 transition-all duration-700 delay-100 ease-out transform ${isAssembled ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"}`
      }
    >
      <div className="flex-1 flex flex-col space-y-3 font-mono">
        {/* Header */}
        <div className="panel-raised rounded p-2.5 space-y-1">
          <FieldLabel className="text-micro">Race Telemetry Context</FieldLabel>
          <h3 className="text-white font-extrabold text-body-sm leading-tight uppercase">
            ROUND {roundNumLabel} · {gpNameLabel}
          </h3>
          <p className="text-slate-450 leading-none text-micro mt-0.5 font-bold">{circuitLabel}</p>
        </div>

        {currentLapIdx === 0 ? (
          /* PRE-RACE */
          <>
            <div className="panel-raised rounded p-2.5 space-y-2">
              <FieldLabel className="text-micro border-b border-white/5 pb-1">Opening Winner Odds</FieldLabel>
              <div className="space-y-1 font-data text-body-sm">
                {[
                  ["L. Leclerc (LEC)", "21%"],
                  ["O. Piastri (PIA)", "19%"],
                  ["L. Norris (NOR)", "17%"],
                ].map(([name, odds]) => (
                  <div className="flex justify-between" key={name}>
                    <span className="text-slate-350">{name}</span>
                    <span className="text-terminal-blue-light font-bold">{odds}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel-raised rounded p-2.5 space-y-1 text-body-sm">
              <FieldLabel className="text-micro border-b border-white/5 pb-1">Circuit Environment</FieldLabel>
              <div className="flex justify-between pt-1 font-data text-slate-450">
                <span>Track Temp:</span>
                <span className="text-white font-bold">
                  {activeWeather
                    ? `${activeWeather.track_temp.toFixed(0)}°C / ${Math.round(activeWeather.track_temp * 1.8 + 32)}°F`
                    : "24°C / 75°F"}{" "}
                  / Dry
                </span>
              </div>
            </div>

            <div className="panel-raised rounded p-2.5 space-y-2">
              <FieldLabel className="text-micro border-b border-white/5 pb-1">Expected Event Odds</FieldLabel>
              <div className="space-y-1 font-data text-body-sm">
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

            <div className="panel-raised rounded p-2 text-center text-slate-500 border-dashed">
              <FieldLabel className="text-micro text-slate-500">REPLAY STATE: PRE-RACE</FieldLabel>
              <p className="text-micro mt-0.5 leading-snug font-sans font-light">
                Launch simulation to process dynamic timing streams.
              </p>
            </div>
          </>
        ) : currentLapIdx < totalLaps ? (
          /* DURING REPLAY */
          <>
            <div className="panel-raised rounded p-2.5 space-y-2">
              <FieldLabel className="text-micro border-b border-white/5 pb-1">Race Story Status</FieldLabel>
              <div className="space-y-1.5 text-body-sm font-bold">
                <div className="flex justify-between items-center bg-carbon-black/30 p-1.5 rounded">
                  <span className="text-slate-500 text-micro uppercase">Telemetry Lap</span>
                  <span className="text-terminal-blue-light font-data">
                    {currentLapIdx} / {totalLaps}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-1 mt-1">
                  <span className="text-slate-500 text-micro uppercase">Current Leader</span>
                  <span className="text-white font-data">{leader}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-1">
                  <span className="text-slate-500 text-micro uppercase">Active Podium</span>
                  <span className="text-slate-200 text-body-sm font-data">
                    {sortedStandings.slice(0, 3).map((p) => p.driver_code).join(", ") || "VER, NOR, LEC"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-micro uppercase">Safety Car Trigger</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-micro font-extrabold ${scActive ? "bg-terminal-yellow/10 text-terminal-yellow border border-terminal-yellow/20" : "text-slate-500"}`}
                  >
                    {scActive ? "YES" : "NO"}
                  </span>
                </div>
              </div>
            </div>

            <div className="panel-raised rounded p-2.5 space-y-1.5">
              <FieldLabel className="text-micro border-b border-white/5 pb-1">Most Recent Event</FieldLabel>
              <div className="text-slate-200 text-body-sm leading-snug font-sans font-light">
                {commentary.length > 0 ? commentary[0].headline : "Green flags active."}
              </div>
            </div>

            <div className="panel-raised rounded p-2.5 space-y-1.5 font-data">
              <FieldLabel className="text-micro border-b border-white/5 pb-1">Winner Market Shift</FieldLabel>
              <div className="flex justify-between items-center text-body-sm">
                <span className="text-slate-400">Winner Ticker [{leader}]:</span>
                <span
                  className={`font-bold ${(Object.values(contracts).find((c) => c.type === "WINNER" && c.target === leader)?.change || 0) >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}
                >
                  {(() => {
                    const cMatch = Object.values(contracts).find((c) => c.type === "WINNER" && c.target === leader);
                    return cMatch ? `${cMatch.change >= 0 ? "+" : ""}${Math.round(cMatch.change * 100)}%` : "0%";
                  })()}
                </span>
              </div>
            </div>
          </>
        ) : (
          /* SETTLED */
          <div className="panel-raised border-terminal-gold/25 rounded p-2.5 space-y-2.5 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-1.5 py-0.5 bg-terminal-gold/10 text-terminal-gold text-micro font-extrabold tracking-wider border-l border-b border-terminal-gold/20 font-sans">
              RESOLVED
            </div>
            <FieldLabel className="text-micro border-b border-white/5 pb-1">Final Results Summary</FieldLabel>
            <div className="space-y-1.5 text-body-sm font-bold font-data">
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500 text-micro uppercase">Winner Title</span>
                <span className="text-terminal-gold">{leader}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500 text-micro uppercase">Podium Finishers</span>
                <span className="text-slate-200">
                  {sortedStandings.slice(0, 3).map((p) => p.driver_code).join(", ")}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500 text-micro uppercase">Fastest Lap</span>
                <span className="text-terminal-blue-light">{raceData?.starting_grid[2]?.driver_code || "HAD"}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500 text-micro uppercase">Safety Car</span>
                <span className="text-white">{scActive ? "YES" : "NO"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-500 text-micro uppercase block mb-1">Retired (DNFs)</span>
                <span className="text-terminal-red text-body-sm leading-relaxed truncate font-data">
                  {sortedStandings.filter((p) => p.dnf).map((p) => p.driver_code).join(", ") || "NONE RECORDED"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
