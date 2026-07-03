import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { RaceData, CommentaryHeadline } from "../../hooks/useSimulation";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { ShieldAlert, Info, Radio, Clock } from "lucide-react";

interface ReplayTabProps {
  raceData: RaceData | null;
  currentLapIdx: number;
  commentary?: CommentaryHeadline[];
}

export default function ReplayTab({ raceData, currentLapIdx, commentary = [] }: ReplayTabProps) {
  const [selectedDriverCode, setSelectedDriverCode] = useState<string | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);
  
  // State for portal tooltip rendering
  const [hoveredMilestone, setHoveredMilestone] = useState<any>(null);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!raceData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 font-mono text-micro">
        LOADING SYSTEM TELEMETRY INDEX...
      </div>
    );
  }

  const currentLapData = raceData.laps[currentLapIdx > 0 ? currentLapIdx - 1 : 0];
  const sortedStandings = currentLapData 
    ? [...currentLapData.positions].sort((a, b) => (a.dnf ? 1 : 0) - (b.dnf ? 1 : 0) || a.position - b.position)
    : [];

  const isReplayActive = currentLapIdx > 0;

  // Generate historical data points for the Recharts telemetry chart (Top 5 drivers)
  const getTelemetryData = () => {
    const points: any[] = [];
    const driversToTrace = ["VER", "NOR", "LEC", "PIA", "HAM"];
    
    const maxLap = Math.max(1, currentLapIdx);
    for (let l = 1; l <= maxLap; l++) {
      const lapInfo = raceData.laps[l - 1];
      if (!lapInfo) continue;
      
      const point: any = { lap: l };
      driversToTrace.forEach((d) => {
        const car = lapInfo.positions.find(p => p.driver_code === d);
        if (car && !car.dnf) {
          point[d] = car.gap_to_leader;
        } else {
          point[d] = null;
        }
      });
      points.push(point);
    }
    return points;
  };

  const telemetryData = getTelemetryData();

  // Colors for driver lines
  const driverColors: { [code: string]: string } = {
    VER: "#005aff", // Red Bull Blue
    NOR: "#ff8700", // McLaren Papaya
    PIA: "#ffc800", // McLaren Papaya Light
    LEC: "#ff0000", // Ferrari Red
    HAM: "#9b0000"  // Ferrari Red Dark
  };

  // Find exact dynamic milestone laps from raceData
  const getDynamicMilestones = () => {
    let pitLap = 12;
    let pitDesc = "Leclerc pits. Norris takes temporary lead.";
    let pitMarket = "Norris WIN contract +15%. Leclerc -8%.";
    let pitPortfolio = "Exposure risk shifts to NOR. Net delta steady.";
    
    let scLap = 18;
    let scDesc = "Safety Car deployed. Sector 2 incident.";
    let scMarket = "SC-YES contract jumps to $1.00. spreads frozen.";
    let scPortfolio = "SC-YES position realized. Cash balance updated.";

    let dnfLap = 31;
    let dnfDesc = "Hamilton retired. Power unit failure.";
    let dnfMarket = "DNF-HAM settles at $1.00. HAM-WIN drops to $0.00.";
    let dnfPortfolio = "Hedge slips adjusted. HAM exposure liquidated.";

    let overtakeLap = 44;
    let overtakeDesc = "Piastri overtakes Verstappen for P2.";
    let overtakeMarket = "Piastri PODIUM contract mid rises by 24%.";
    let overtakePortfolio = "Unrealized portfolio options gain +$320.";

    const totalLaps = raceData.laps_total;

    // Find first DNF
    for (let l = 1; l <= raceData.laps.length; l++) {
      const lapInfo = raceData.laps[l - 1];
      const dnfPos = lapInfo.positions.find(p => p.dnf);
      if (dnfPos) {
        dnfLap = l;
        dnfDesc = `${dnfPos.driver_name} retired: ${dnfPos.dnf_reason || "Mechanical issue"}.`;
        dnfMarket = `DNF_${dnfPos.driver_code} settles at $1.00. WINNER_${dnfPos.driver_code} drops to $0.00.`;
        dnfPortfolio = `Liquidated remaining risk on ${dnfPos.driver_code}. Cash balances adjusted.`;
        break;
      }
    }

    // Find first Safety Car
    for (let l = 1; l <= raceData.laps.length; l++) {
      const lapInfo = raceData.laps[l - 1];
      if (lapInfo.safety_car && lapInfo.safety_car !== "NONE" && lapInfo.safety_car !== "") {
        scLap = l;
        scDesc = `Safety Car deployed (${lapInfo.safety_car}). Field bunched.`;
        scMarket = "SAFETY_CAR_YES contract converges to $1.00. All affected slips suspended.";
        scPortfolio = "Safety Car yes option hedges settled and credited.";
        break;
      }
    }

    // Find first Pit Stop
    for (let l = 1; l <= raceData.laps.length; l++) {
      const lapInfo = raceData.laps[l - 1];
      const pit = lapInfo.positions.find(p => p.pit_stops > 0);
      if (pit) {
        pitLap = l;
        pitDesc = `${pit.driver_name} pits for fresh tires (Compound: ${pit.tires}).`;
        pitMarket = "Live options model pricing adjusts for track position shift.";
        pitPortfolio = "Recalculated portfolio option theta and theta decay rates.";
        break;
      }
    }

    // Find first overtake among top 3
    for (let l = 2; l <= raceData.laps.length; l++) {
      const prevLap = raceData.laps[l - 2];
      const curLap = raceData.laps[l - 1];
      let topChange = false;
      for (let pIdx = 0; pIdx < Math.min(prevLap.positions.length, curLap.positions.length); pIdx++) {
        const prevP = prevLap.positions[pIdx];
        const curP = curLap.positions.find(p => p.driver_code === prevP.driver_code);
        if (curP && curP.position !== prevP.position && curP.position <= 3) {
          overtakeLap = l;
          overtakeDesc = `${curP.driver_name} shifts positions to P${curP.position} in the top-field battle.`;
          overtakeMarket = `${curP.driver_code} winner and podium implied probabilities updated.`;
          overtakePortfolio = "Dynamic portfolio option delta exposure recalibrated.";
          topChange = true;
          break;
        }
      }
      if (topChange) break;
    }

    return { pitLap, pitDesc, pitMarket, pitPortfolio, scLap, scDesc, scMarket, scPortfolio, dnfLap, dnfDesc, dnfMarket, dnfPortfolio, overtakeLap, overtakeDesc, overtakeMarket, overtakePortfolio };
  };

  const dyn = getDynamicMilestones();

  // Construct official, dynamically populated milestone nodes list
  const startWeather = raceData.laps[0]?.weather;
  const startFavs = raceData.starting_grid.slice(0, 2).map(g => g.driver_code).join(" and ");
  const polePos = raceData.starting_grid.find(g => g.position === 1)?.driver_code || "NOR";
  
  const winnerRes = raceData.final_result.find(r => r.position === 1);
  const podiumList = raceData.final_result
    .filter(r => r.position !== null && r.position <= 3)
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map(r => r.driver_code)
    .join(", ");
  const fastestLapHolder = raceData.starting_grid[2]?.driver_code || "HAD";

  const milestonesList = [
    {
      lap: 0,
      label: "Race Start",
      type: "START",
      eventLabel: "Race Conditions & Track Setup",
      desc: `Circuit: ${raceData.circuit} (${raceData.country}) | Laps: ${raceData.laps_total}`,
      marketLabel: "Weather & Starting Grid Priors",
      market: `Air Temp: ${startWeather?.air_temp || 25}°C / ${Math.round((startWeather?.air_temp || 25) * 1.8 + 32)}°F | Track: ${startWeather?.track_temp || 36}°C / ${Math.round((startWeather?.track_temp || 36) * 1.8 + 32)}°F | Pole Position: ${polePos}`,
      portfolioLabel: "Opening Favorites & Spreads",
      portfolio: `Opening Favorites: ${startFavs} | Winner and Podium options chains open at P${polePos} grid baseline.`
    },
    {
      lap: dyn.pitLap,
      label: `Lap ${dyn.pitLap} • Pit Stop`,
      type: "PIT",
      eventLabel: "Race Event",
      desc: dyn.pitDesc,
      marketLabel: "Market Impact",
      market: dyn.pitMarket,
      portfolioLabel: "Portfolio Impact",
      portfolio: dyn.pitPortfolio
    },
    {
      lap: dyn.scLap,
      label: `Lap ${dyn.scLap} • Safety Car`,
      type: "SC",
      eventLabel: "Race Event",
      desc: dyn.scDesc,
      marketLabel: "Market Impact",
      market: dyn.scMarket,
      portfolioLabel: "Portfolio Impact",
      portfolio: dyn.scPortfolio
    },
    {
      lap: dyn.dnfLap,
      label: `Lap ${dyn.dnfLap} • DNF`,
      type: "DNF",
      eventLabel: "Race Event",
      desc: dyn.dnfDesc,
      marketLabel: "Market Impact",
      market: dyn.dnfMarket,
      portfolioLabel: "Portfolio Impact",
      portfolio: dyn.dnfPortfolio
    },
    {
      lap: dyn.overtakeLap,
      label: `Lap ${dyn.overtakeLap} • Overtake`,
      type: "OVERTAKE",
      eventLabel: "Race Event",
      desc: dyn.overtakeDesc,
      marketLabel: "Market Impact",
      market: dyn.overtakeMarket,
      portfolioLabel: "Portfolio Impact",
      portfolio: dyn.overtakePortfolio
    },
    {
      lap: raceData.laps_total,
      label: "Checkered Flag",
      type: "FINISH",
      eventLabel: "Official Settlement Summary",
      desc: `Official Winner: ${winnerRes?.driver_name || "Unknown"} [P1] | Podium Finish: ${podiumList}`,
      marketLabel: "Market Resolution",
      market: "All binary options settled. TRUE contracts resolve to $1.00, FALSE to $0.00.",
      portfolioLabel: "Portfolio Outcome",
      portfolio: "All open position liabilities closed. Cash proceeds returned to sandbox account balances."
    }
  ];

  return (
    <div className="h-full flex flex-col gap-3.5 min-h-0 text-slate-450 font-mono text-body-sm">
      
      {/* Top Banner */}
      <div className="bg-carbon-surface border border-white/5 rounded p-2.5 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isReplayActive ? "bg-terminal-blue animate-ping" : "bg-slate-655"}`} />
          <span className="text-white font-extrabold text-micro uppercase tracking-wider flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-terminal-blue" />
            {isReplayActive ? "LIVE QUANT REPLAY TELEMETRY BROADCAST" : "TELEMETRY ENGINE STANDBY"}
          </span>
        </div>
        <div className="flex gap-4 text-micro text-slate-500 font-data select-none items-center">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-terminal-blue" /> ENGINE FEED ONLINE</span>
          <span>HISTORICAL SEASON REPLAY</span>
          <span>CALENDAR: 2025 F1</span>
        </div>
      </div>

      {/* EVENT TIMELINE PROGRESS BAR */}
      <div className="bg-carbon-surface border border-white/5 rounded p-3.5 flex flex-col gap-2 shrink-0 select-none">
        <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
          <span className="text-micro text-slate-500 font-bold uppercase tracking-wider block">
            HISTORICAL REPLAY TIMELINE & EVENT MAP
          </span>
          <span className="text-slate-300 font-bold font-data">
            {currentLapIdx === 0 ? "Pre-Race Initial Grid" : currentLapIdx === raceData.laps_total ? "Checkered Flag Settled" : `Lap ${currentLapIdx} / ${raceData.laps_total}`}
          </span>
        </div>

        {/* Milestone Nodes */}
        <div className="relative mt-2 mb-4 px-4 h-8 select-none">
          {/* Timeline background track bar */}
          <div className="absolute top-1/2 left-4 right-4 h-[2px] bg-white/5 -translate-y-1/2 rounded" />
          
          {/* Timeline active progress bar */}
          <div 
            className="absolute top-1/2 left-4 h-[2px] bg-terminal-blue -translate-y-1/2 rounded transition-all duration-300"
            style={{ width: `calc(${Math.min(100, (currentLapIdx / raceData.laps_total) * 100)}% - 8px)` }}
          />

          {/* Chronological & deduplicated absolute milestone circles */}
          <div className="absolute top-1/2 left-4 right-4 h-0 -translate-y-1/2 relative select-none">
            {(() => {
              // Deduplicate and sort milestones to guarantee perfect timeline integrity
              const sortedMilestones = Array.from(
                new Map(milestonesList.map((m) => [m.lap, m])).values()
              ).sort((a, b) => a.lap - b.lap);

              return sortedMilestones.map((m, idx) => {
                const isPassed = currentLapIdx >= m.lap;
                const isActive = currentLapIdx > 0 && (
                  idx === sortedMilestones.length - 1 
                    ? currentLapIdx === m.lap
                    : currentLapIdx >= m.lap && currentLapIdx < sortedMilestones[idx + 1].lap
                );
                const isFuture = currentLapIdx < m.lap;
                const percent = (m.lap / raceData.laps_total) * 100;

                return (
                  <div 
                    key={m.label} 
                    className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center select-none"
                    style={{ left: `${percent}%`, transform: "translate(-50%, -50%)" }}
                  >
                    <button
                      type="button"
                      disabled={isFuture}
                      onMouseEnter={(e) => {
                        setHoveredMilestone(m);
                        setHoveredRect(e.currentTarget.getBoundingClientRect());
                      }}
                      onMouseLeave={() => {
                        setHoveredMilestone(null);
                        setHoveredRect(null);
                      }}
                      className={`w-3 h-3 rounded-full border-2 transition-all duration-300 z-10 ${
                        isFuture ? "cursor-not-allowed bg-carbon-black border-white/10" : "cursor-pointer"
                      } ${
                        isActive 
                          ? "bg-terminal-blue border-white shadow-[0_0_8px_#005aff] scale-125" 
                          : isPassed 
                            ? "bg-carbon-surface border-terminal-blue" 
                            : "bg-carbon-black border-white/10"
                      }`}
                    />
                    <span className={`text-micro font-bold mt-4 tracking-wider uppercase whitespace-nowrap block ${isPassed ? "text-slate-200" : "text-slate-550"}`}>
                      {m.lap === 0 ? "START" : m.lap === raceData.laps_total ? "FINISH" : `L${m.lap}`}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* Viewport-portal Hover tooltip rendering */}
      {mounted && hoveredMilestone && hoveredRect && (() => {
        const tooltipWidth = 220;
        const tooltipHeight = hoveredMilestone.type === "START" || hoveredMilestone.type === "FINISH" ? 230 : 155;
        
        let tooltipTop = hoveredRect.top - tooltipHeight - 10;
        let tooltipLeft = hoveredRect.left + (hoveredRect.width / 2) - (tooltipWidth / 2);

        // Viewport and collision awareness check
        if (tooltipTop < 10) {
          // If it goes above the screen, render it below the milestone circle instead
          tooltipTop = hoveredRect.bottom + 10;
        }

        // Horizontal boundary checks
        if (tooltipLeft < 10) {
          tooltipLeft = 10;
        } else if (tooltipLeft + tooltipWidth > window.innerWidth - 10) {
          tooltipLeft = window.innerWidth - tooltipWidth - 10;
        }

        return createPortal(
          <div
            style={{
              position: "fixed",
              top: tooltipTop,
              left: tooltipLeft,
              width: `${tooltipWidth}px`,
              zIndex: 99999,
            }}
            className="pointer-events-none bg-carbon-dark/95 border border-terminal-blue/30 p-2.5 rounded shadow-[0_0_20px_rgba(0,122,204,0.15)] transition-all duration-200 text-micro space-y-1.5 text-slate-350 select-none normal-case leading-normal font-sans font-light backdrop-blur-md"
          >
            <div className="flex justify-between items-center border-b border-white/5 pb-1 mb-1.5 uppercase font-mono font-bold text-white text-micro tracking-wider">
              <span>{hoveredMilestone.label}</span>
              <span className="px-1 py-0.2 bg-terminal-blue/15 text-terminal-blue-light rounded text-micro">
                {hoveredMilestone.type}
              </span>
            </div>

            {hoveredMilestone.type === "START" ? (
              <div className="space-y-1.5">
                <div>
                  <span className="text-white font-bold block text-micro uppercase tracking-wider">Race Conditions</span>
                  <span className="text-slate-200 font-sans block text-micro mt-0.5">Circuit: {raceData.circuit} ({raceData.country}) | Laps: {raceData.laps_total}</span>
                </div>
                <div className="pt-1 border-t border-white/5">
                  <span className="text-white font-bold block text-micro uppercase tracking-wider">Weather</span>
                  <span className="text-slate-200 font-sans block text-micro mt-0.5">Air Temp: {startWeather?.air_temp || 25}°C / {Math.round((startWeather?.air_temp || 25) * 1.8 + 32)}°F | Humidity: {startWeather?.humidity || "40"}%</span>
                </div>
                <div className="pt-1 border-t border-white/5">
                  <span className="text-white font-bold block text-micro uppercase tracking-wider">Track</span>
                  <span className="text-slate-200 font-sans block text-micro mt-0.5">Track Temp: {startWeather?.track_temp || 36}°C / {Math.round((startWeather?.track_temp || 36) * 1.8 + 32)}°F | Surface: DRY / Nominal Grip</span>
                </div>
                <div className="pt-1 border-t border-white/5">
                  <span className="text-terminal-blue-light font-bold block text-micro uppercase tracking-wider">Opening Market</span>
                  <span className="text-slate-300 font-mono block text-micro mt-0.5">WINNER and PODIUM chains open with dynamic Bayesian pricing models.</span>
                </div>
                <div className="pt-1 border-t border-white/5">
                  <span className="text-terminal-blue-light font-bold block text-micro uppercase tracking-wider">Pole Position</span>
                  <span className="text-slate-300 font-mono block text-micro mt-0.5">Secured by contender [{polePos}] with starting grid P1 priority.</span>
                </div>
                <div className="pt-1 border-t border-white/5">
                  <span className="text-terminal-green-light font-bold block text-micro uppercase tracking-wider">Opening Favorites</span>
                  <span className="text-slate-300 font-mono block text-micro mt-0.5">{startFavs} secure top market backing status.</span>
                </div>
              </div>
            ) : hoveredMilestone.type === "FINISH" ? (
              <div className="space-y-1.5">
                <div>
                  <span className="text-white font-bold block text-micro uppercase tracking-wider">Official Result</span>
                  <span className="text-slate-200 font-sans block text-micro mt-0.5">Checkered Flag. Race complete and settled.</span>
                </div>
                <div className="pt-1 border-t border-white/5">
                  <span className="text-white font-bold block text-micro uppercase tracking-wider">Winner</span>
                  <span className="text-terminal-gold font-bold block text-micro mt-0.5">{winnerRes?.driver_name || "Unknown"} (P1)</span>
                </div>
                <div className="pt-1 border-t border-white/5">
                  <span className="text-white font-bold block text-micro uppercase tracking-wider">Podium</span>
                  <span className="text-slate-200 font-sans block text-micro mt-0.5">{podiumList} (Positions P1 - P3)</span>
                </div>
                <div className="pt-1 border-t border-white/5">
                  <span className="text-white font-bold block text-micro uppercase tracking-wider">Fastest Lap</span>
                  <span className="text-terminal-blue-light font-bold block text-micro mt-0.5">{fastestLapHolder} (FL Bonus point secured)</span>
                </div>
                <div className="pt-1 border-t border-white/5">
                  <span className="text-terminal-green-light font-bold block text-micro uppercase tracking-wider">Portfolio Outcome</span>
                  <span className="text-slate-300 font-mono block text-micro mt-0.5">Race book positions auto-liquidated. Sandbox account balances credited.</span>
                </div>
                <div className="pt-1 border-t border-white/5">
                  <span className="text-terminal-green-light font-bold block text-micro uppercase tracking-wider">Settlement Summary</span>
                  <span className="text-slate-300 font-mono block text-micro mt-0.5">Race book closed. Season Book futures marked-to-market for standings progression.</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div>
                  <span className="text-white font-bold block text-micro uppercase tracking-wider">{hoveredMilestone.eventLabel}</span>
                  <span className="text-slate-200 font-sans block text-micro leading-snug mt-0.5">{hoveredMilestone.desc}</span>
                </div>
                <div className="pt-1 border-t border-white/5">
                  <span className="text-terminal-blue-light font-bold block text-micro uppercase tracking-wider">{hoveredMilestone.marketLabel}</span>
                  <span className="text-slate-300 font-mono block text-micro leading-snug mt-0.5">{hoveredMilestone.market}</span>
                </div>
                <div className="pt-1 border-t border-white/5">
                  <span className="text-terminal-green-light font-bold block text-micro uppercase tracking-wider">{hoveredMilestone.portfolioLabel}</span>
                  <span className="text-slate-300 font-mono block text-micro leading-snug mt-0.5">{hoveredMilestone.portfolio}</span>
                </div>
              </div>
            )}
          </div>,
          document.body
        );
      })()}

      {/* Main Grid split */}
      <div className="flex-1 flex flex-col xl:flex-row gap-3.5 min-h-0">
        
        {/* Timing standings (Left) */}
        <div className="flex-1 bg-carbon-surface border border-white/5 rounded p-3 flex flex-col min-h-0">
          <span className="text-micro text-slate-500 font-bold uppercase tracking-wider block mb-2">Timing Grid Standings</span>
          <div className="flex-1 overflow-y-auto pr-1">
            {/* Mobile 2-line card rows (<768) */}
            <div className="md:hidden space-y-1.5">
              {sortedStandings.map((car) => {
                const startGridPos = raceData.starting_grid.find(g => g.driver_code === car.driver_code)?.position;
                const posDelta = startGridPos ? startGridPos - car.position : 0;
                const hasSCInfluence = currentLapData?.safety_car && currentLapData.safety_car !== "NONE" && !car.dnf;
                return (
                  <div
                    key={car.driver_code}
                    className={`panel-base border rounded p-2.5 ${car.dnf ? "border-terminal-red/20 opacity-80" : "border-white/5"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-white font-data w-8 shrink-0 flex items-center gap-0.5">
                          {car.dnf ? "DNF" : car.position}
                          {!car.dnf && posDelta > 0 && <span className="text-terminal-green-light text-micro">▲{posDelta}</span>}
                          {!car.dnf && posDelta < 0 && <span className="text-terminal-red text-micro">▼{Math.abs(posDelta)}</span>}
                        </span>
                        <span className="font-bold text-slate-200 font-data">{car.driver_code}</span>
                        <span className="text-slate-400 font-sans font-light truncate">{car.driver_name}</span>
                      </div>
                      {car.dnf ? (
                        <span className="text-terminal-red bg-terminal-red/10 border border-terminal-red/20 px-1.5 py-0.5 rounded text-micro font-bold uppercase shrink-0">
                          {car.dnf_reason || "RETIRED"}
                        </span>
                      ) : hasSCInfluence ? (
                        <span className="text-terminal-yellow bg-terminal-yellow/10 border border-terminal-yellow/20 px-1.5 py-0.5 rounded text-micro font-bold uppercase shrink-0">SC</span>
                      ) : (
                        <span className="text-terminal-green-light bg-terminal-green/5 border border-terminal-green/20 px-1.5 py-0.5 rounded text-micro font-bold uppercase shrink-0">RUN</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-white/5 font-data text-micro text-slate-400">
                      <span>Gap: <strong className="text-slate-200">{car.dnf ? "--" : (car.position === 1 ? "LEADER" : `+${car.gap_to_leader.toFixed(3)}s`)}</strong></span>
                      <span>Tire: <strong className={car.tires === "S" ? "text-terminal-red" : car.tires === "M" ? "text-terminal-yellow" : "text-slate-200"}>[{car.tires}] {car.dnf ? "--" : car.tire_age}</strong></span>
                      <span>Pits: <strong className="text-slate-200">{car.pit_stops}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>

            <table className="hidden md:table w-full text-left font-data text-micro select-none">
              <thead>
                <tr className="text-slate-500 uppercase text-micro border-b border-white/5 font-bold">
                  <th className="pb-1.5 pl-2">Pos</th>
                  <th className="pb-1.5">Car</th>
                  <th className="pb-1.5">Driver</th>
                  <th className="pb-1.5 text-right">Gap to Ldr</th>
                  <th className="pb-1.5 text-right">Interval</th>
                  <th className="pb-1.5 text-center">Tire</th>
                  <th className="pb-1.5 text-center">Age</th>
                  <th className="pb-1.5 text-center">Pits</th>
                  <th className="pb-1.5 text-right pr-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedStandings.map((car, idx) => {
                  const isSelected = car.driver_code === selectedDriverCode;
                  const isDriverFaded = isReplayActive && !isSelected && selectedDriverCode !== null;

                  const startGridPos = raceData.starting_grid.find(g => g.driver_code === car.driver_code)?.position;
                  const posDelta = startGridPos ? startGridPos - car.position : 0;

                  const hasDRS = car.position > 1 && car.interval_to_car_ahead < 1.0 && !car.dnf;
                  const hasSCInfluence = currentLapData?.safety_car && currentLapData.safety_car !== "NONE" && !car.dnf;

                  return (
                    <React.Fragment key={car.driver_code}>
                      <tr
                        onClick={() => setSelectedDriverCode(prev => prev === car.driver_code ? null : car.driver_code)}
                        className={`border-b border-white/5 hover:bg-white/4 last:border-0 cursor-pointer select-none transition-all duration-150 ${isSelected ? "bg-white/5 text-white font-bold border-l-2 border-l-terminal-blue" : isDriverFaded ? "opacity-60 text-slate-400" : ""}`}
                      >
                        <td className={`pl-2 font-bold transition-all duration-150 ${isSelected ? "py-2" : "py-1"} flex items-center gap-1`}>
                          <span>{car.dnf ? "DNF" : car.position}</span>
                          {!car.dnf && posDelta > 0 && (
                            <span className="text-terminal-green-light text-micro">▲{posDelta}</span>
                          )}
                          {!car.dnf && posDelta < 0 && (
                            <span className="text-terminal-red text-micro">▼{Math.abs(posDelta)}</span>
                          )}
                        </td>
                        <td className="font-bold text-slate-200">
                          <div className="flex items-center gap-1">
                            <span>{car.driver_code}</span>
                            {hasDRS && (
                              <span className="px-0.5 py-0.2 bg-terminal-green-light/10 text-terminal-green-light text-micro rounded border border-terminal-green-light/20 font-bold uppercase select-none scale-90">DRS</span>
                            )}
                          </div>
                        </td>
                        <td className="font-sans font-light text-slate-350">{car.driver_name}</td>
                        <td className="text-right text-slate-400">
                          {car.dnf ? "--" : (car.position === 1 ? "LEADER" : `+${car.gap_to_leader.toFixed(3)}s`)}
                        </td>
                        <td className="text-right text-slate-400">
                          {car.dnf ? "--" : (car.position === 1 ? "--" : `+${car.interval_to_car_ahead.toFixed(3)}s`)}
                        </td>
                        <td className="text-center font-mono">
                          <span className={`text-micro font-bold ${car.tires === "S" ? "text-terminal-red" : (car.tires === "M" ? "text-terminal-yellow" : "text-slate-350")}`}>
                            [{car.tires}]
                          </span>
                        </td>
                        <td className="text-center text-slate-450">{car.dnf ? "--" : `${car.tire_age}`}</td>
                        <td className="text-center text-slate-450">
                          <div className="flex items-center justify-center gap-0.5">
                            <span>{car.pit_stops}</span>
                            {car.pit_stops > 0 && <span className="text-micro text-slate-500" title="Pitted">🔧</span>}
                          </div>
                        </td>
                        <td className="text-right pr-2">
                          {car.dnf ? (
                            <span className="text-terminal-red bg-terminal-red/10 border border-terminal-red/20 px-1.5 py-0.2 rounded text-micro font-bold uppercase inline-block truncate max-w-[100px]" title={car.dnf_reason || "Retired"}>
                              {car.dnf_reason || "RETIRED"}
                            </span>
                          ) : hasSCInfluence ? (
                            <span className="text-terminal-yellow bg-terminal-yellow/10 border border-terminal-yellow/20 px-1.5 py-0.2 rounded text-micro font-bold uppercase">
                              SC LIMIT
                            </span>
                          ) : (
                            <span className="text-terminal-green-light bg-terminal-green/5 border border-terminal-green/20 px-1.5 py-0.2 rounded text-micro font-bold uppercase">
                              RUNNING
                            </span>
                          )}
                        </td>
                      </tr>
                      
                      {isSelected && (
                        <tr className="bg-carbon-black/35 text-micro border-b border-white/5 select-none font-mono">
                          <td colSpan={9} className="p-3 pl-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
                              <div>
                                <span className="text-slate-500 block text-micro uppercase tracking-wider font-bold">Telemetry State</span>
                                <span className={`font-bold uppercase ${car.dnf ? "text-terminal-red" : "text-terminal-green-light"}`}>
                                  {car.dnf ? "DISCONNECTED (DNF)" : "LINK ACTIVE // 921.4 MHz"}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-micro uppercase tracking-wider font-bold">Sector Splits</span>
                                <span className="text-slate-350">
                                  S1: <strong className="text-white">{(28.1 + idx * 0.05).toFixed(3)}s</strong> | S2: <strong className="text-white">{(36.0 + idx * 0.08).toFixed(3)}s</strong> | S3: <strong className="text-white">{(22.4 + idx * 0.04).toFixed(3)}s</strong>
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-micro uppercase tracking-wider font-bold">Interval Evolution</span>
                                <span className="text-slate-300">
                                  {car.position === 1 ? "Leading Field" : `+${car.interval_to_car_ahead.toFixed(3)}s Ahead`}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-micro uppercase tracking-wider font-bold">Tire Summary & Wear</span>
                                <span className="text-terminal-blue-light">
                                  Compound: {car.tires} | Age: {car.tire_age} Lps | Wear: {Math.min(99, Math.round(car.tire_age * 1.5))}%
                                </span>
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

        {/* Graphical Telemetry Rebuild: Race State Evolution Chart (Right) */}
        <div className="w-full xl:w-[480px] flex flex-col gap-3.5 shrink-0 min-h-0 select-none">
          
          {/* Race State Evolution Chart */}
          <div className="flex-[2] min-h-[300px] panel-raised rounded p-3.5 flex flex-col">
            <div className="flex justify-between items-center border-b border-white/5 pb-1.5 mb-2 select-none">
              <span className="text-micro text-slate-200 font-extrabold uppercase tracking-wider block">
                📊 Race State Evolution & Repricing Moments
              </span>
              <span className="text-micro text-slate-550 font-bold uppercase">GAP TELEMETRY</span>
            </div>
            
            <div className="flex-1 min-h-[140px] w-full select-none relative">
              {telemetryData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-650 text-center space-y-1.5 p-6 border border-dashed border-white/5 rounded">
                  <span className="text-xs uppercase font-bold tracking-wider">No Telemetry Streams Active</span>
                  <p className="text-micro max-w-[180px] leading-snug">Press play on the simulation engine to generate lap-by-lap telemetry tracks.</p>
                </div>
              ) : (
                <div className="absolute inset-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                     data={telemetryData}
                     margin={{ top: 10, right: 10, left: -28, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                    <XAxis 
                      dataKey="lap" 
                      stroke="rgba(255,255,255,0.12)" 
                      tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 8 }}
                    />
                    <YAxis 
                      stroke="rgba(255,255,255,0.12)" 
                      tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 8 }}
                      reversed // P1 gap is 0.0 (top), trailing cars sit lower
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#181a1e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "3px" }}
                      itemStyle={{ fontSize: "8.5px", fontFamily: "var(--font-mono)", fontWeight: "bold" }}
                      labelStyle={{ fontSize: "8.5px", color: "#888", fontFamily: "var(--font-mono)" }}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: 9, paddingTop: 4, color: "#ffffff", fontWeight: "bold" }}
                      iconType="circle"
                    />

                    {/* Pit Window Annotation */}
                    {currentLapIdx >= dyn.pitLap && (
                      <ReferenceLine 
                        x={dyn.pitLap} 
                        stroke="#00d2be" 
                        strokeDasharray="3 3" 
                        label={{ value: "[PIT]", fill: "#00d2be", fontSize: 7, position: "insideTopLeft", fontFamily: "var(--font-mono)", fontWeight: "bold" }} 
                      />
                    )}

                    {/* Safety Car Annotation */}
                    {currentLapIdx >= dyn.scLap && (
                      <ReferenceLine 
                        x={dyn.scLap} 
                        stroke="#ffc800" 
                        strokeDasharray="3 3" 
                        label={{ value: "[SC]", fill: "#ffc800", fontSize: 7, position: "insideTopLeft", fontFamily: "var(--font-mono)", fontWeight: "bold" }} 
                      />
                    )}

                    {/* DNF Annotation */}
                    {currentLapIdx >= dyn.dnfLap && (
                      <ReferenceLine 
                        x={dyn.dnfLap} 
                        stroke="#ff0000" 
                        strokeDasharray="3 3" 
                        label={{ value: "[DNF]", fill: "#ff0000", fontSize: 7, position: "insideTopLeft", fontFamily: "var(--font-mono)", fontWeight: "bold" }} 
                      />
                    )}

                    {["VER", "NOR", "LEC", "PIA", "HAM"].map((d) => (
                      <Line
                        key={d}
                        type="monotone"
                        dataKey={d}
                        name={d}
                        stroke={driverColors[d]}
                        strokeWidth={d === selectedDriverCode ? 2.2 : 1.2}
                        dot={false}
                        activeDot={{ r: 3 }}
                        isAnimationActive={true}
                        animationDuration={600}
                        connectNulls={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Repricing Moments & Incident Log Panel */}
            <div className="border-t border-white/5 pt-2.5 mt-3 min-h-0 flex-1 flex flex-col">
              <span className="text-micro text-slate-500 font-extrabold uppercase tracking-wider block mb-1.5">
                📋 Repricing Moments & Incident Log
              </span>
              <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
                {(() => {
                  const moments = [];
                  if (currentLapIdx >= dyn.pitLap) {
                    moments.push({
                      lap: dyn.pitLap,
                      what: dyn.pitDesc,
                      why: dyn.pitMarket,
                      how: dyn.pitPortfolio,
                      color: "text-terminal-blue-light"
                    });
                  }
                  if (currentLapIdx >= dyn.scLap) {
                    moments.push({
                      lap: dyn.scLap,
                      what: dyn.scDesc,
                      why: dyn.scMarket,
                      how: dyn.scPortfolio,
                      color: "text-terminal-yellow"
                    });
                  }
                  if (currentLapIdx >= dyn.dnfLap) {
                    moments.push({
                      lap: dyn.dnfLap,
                      what: dyn.dnfDesc,
                      why: dyn.dnfMarket,
                      how: dyn.dnfPortfolio,
                      color: "text-terminal-red"
                    });
                  }
                  if (currentLapIdx >= dyn.overtakeLap) {
                    moments.push({
                      lap: dyn.overtakeLap,
                      what: dyn.overtakeDesc,
                      why: dyn.overtakeMarket,
                      how: dyn.overtakePortfolio,
                      color: "text-slate-200"
                    });
                  }
                  if (currentLapIdx >= raceData.laps_total) {
                    moments.push({
                      lap: raceData.laps_total,
                      what: `checkered flag: Winner ${winnerRes?.driver_name || "Unknown"} (P1) | Podium: ${podiumList}`,
                      why: "All binary options settled (TRUE to $1.00, FALSE to $0.00).",
                      how: "Open race positions liquidated, cash balances settled.",
                      color: "text-terminal-green-light"
                    });
                  }

                  if (moments.length === 0) {
                    return (
                      <div className="h-full flex items-center justify-center text-slate-650 text-micro uppercase font-bold border border-dashed border-white/5 rounded py-4 select-none">
                        Awaiting trigger lap milestone events...
                      </div>
                    );
                  }

                  return (
                    <table className="w-full text-left font-data text-micro leading-normal select-text">
                      <thead>
                        <tr className="text-slate-500 uppercase text-micro border-b border-white/5 font-bold tracking-wider pb-1">
                          <th className="pb-1 pl-1">Lap</th>
                          <th className="pb-1 w-[32%]">Incident</th>
                          <th className="pb-1 w-[32%]">Pricing Effect</th>
                          <th className="pb-1 w-[32%]">Risk Profile Shift</th>
                        </tr>
                      </thead>
                      <tbody>
                        {moments.map((m, idx) => (
                          <tr key={`${m.lap}-${idx}`} className="border-b border-white/5 last:border-0 hover:bg-white/2">
                            <td className={`py-1 pl-1 font-bold ${m.color}`}>L{m.lap}</td>
                            <td className="py-1 pr-2 font-sans font-light text-slate-200">{m.what}</td>
                            <td className="py-1 pr-2 text-slate-350">{m.why}</td>
                            <td className="py-1 text-slate-400">{m.how}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* ACTIVE WIRE COMMENTARY FEED */}
          <div className="flex-1 panel-raised rounded p-3.5 flex flex-col min-h-[150px]">
            <div className="flex justify-between items-center border-b border-white/5 pb-1.5 mb-2.5 select-none">
              <span className="text-micro text-slate-200 font-extrabold uppercase tracking-wider block flex items-center gap-1">
                📡 ACTIVE WIRE COMMENTARY & LEDGER ACTION
              </span>
              <span className="text-micro text-slate-550 font-bold tracking-wider flex items-center gap-1">
                <Clock className="w-2.5 h-2.5 text-terminal-blue" /> WIRE BROADCAST
              </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2 select-text scrollbar-thin">
              {commentary.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-650 text-center p-4">
                  <span className="text-micro font-bold uppercase tracking-wider block">Awaiting Replay Commentary Logs...</span>
                  <p className="text-micro leading-snug font-sans font-light mt-1 max-w-[200px]">Wire updates arrive dynamically lap-by-lap, mapping race events to exact option pricing outcomes.</p>
                </div>
              ) : (
                commentary.map((feedItem, idx) => (
                  <div key={idx} className="bg-carbon-black/35 border border-white/5 rounded p-2 text-micro font-data leading-normal flex items-start gap-2">
                    <span className="px-1.5 py-0.5 bg-terminal-blue/15 border border-terminal-blue/30 text-terminal-blue-light font-bold rounded text-micro uppercase shrink-0 mt-0.5 min-w-[50px] text-center">
                      LAP {feedItem.lap}
                    </span>
                    <div className="flex-1 space-y-0.5">
                      <span className="text-slate-500 text-micro uppercase font-bold tracking-wider block">TYPE: {feedItem.impactType.toUpperCase()} // LOG</span>
                      <p className="text-slate-200 font-sans font-light leading-normal">{feedItem.headline}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
