"use client";

import React, { useEffect } from "react";
import { Contract } from "../../hooks/useSimulation";
import { Position } from "../../hooks/usePortfolio";
import { Trophy, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useTerminalUI } from "../TerminalUIProvider";
import FieldLabel from "../FieldLabel";

interface ChampionshipTabProps {
  contracts: { [id: string]: Contract };
  positions: { [id: string]: Position };
  completedRaces: string[];
  driverPoints: { [code: string]: number };
  constructorPoints: { [code: string]: number };
  isFocusMode?: boolean;
}

export default function ChampionshipTab({
  contracts,
  positions,
  completedRaces,
  driverPoints,
  constructorPoints,
  isFocusMode,
}: ChampionshipTabProps) {
  const { selectedContractId, setSelectedContractId, backingSide, setActiveSheet } = useTerminalUI();
  const [selectedChampionship, setSelectedChampionship] = React.useState<"DRIVERS" | "CONSTRUCTORS">("DRIVERS");

  // On mobile a card tap selects the contender AND opens the ticket sheet.
  const handleMobileSelect = (id: string) => {
    setSelectedContractId(id);
    setActiveSheet("ticket");
  };

  const typeFilter = selectedChampionship === "DRIVERS" ? "FUTURE_DRIVERS" : "FUTURE_CONSTRUCTORS";
  const activeFutures = Object.values(contracts).filter((c) => c.type === typeFilter);

  // Keep selection valid when the championship category changes.
  useEffect(() => {
    if (selectedContractId) {
      const stillValid = activeFutures.find((f) => f.id === selectedContractId);
      if (!stillValid) setSelectedContractId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChampionship, contracts]);

  const handleChampionshipChange = (type: "DRIVERS" | "CONSTRUCTORS") => {
    setSelectedChampionship(type);
    setSelectedContractId("");
  };

  const selectedContender = contracts[selectedContractId]?.target || "";

  // Standing leaders for the narrative panel
  const sortedDrvPoints = Object.entries(driverPoints).sort((a, b) => b[1] - a[1]);
  const activeDriverLeader =
    sortedDrvPoints.length > 0 && sortedDrvPoints[0][1] > 0
      ? `${sortedDrvPoints[0][0]} (${sortedDrvPoints[0][1]} pts)`
      : "L. Norris (MCL)";

  const sortedTeamPoints = Object.entries(constructorPoints).sort((a, b) => b[1] - a[1]);
  const activeTeamLeader =
    sortedTeamPoints.length > 0 && sortedTeamPoints[0][1] > 0
      ? `${sortedTeamPoints[0][0]} (${sortedTeamPoints[0][1]} pts)`
      : "McLaren (MCL)";

  return (
    <div className="h-full flex flex-col md:flex-row gap-4 min-h-0 font-mono text-body-sm text-slate-400">
      {/* Category filter */}
      <div className="w-full md:w-44 shrink-0 flex flex-row md:flex-col gap-1 border-b md:border-b-0 md:border-r border-white/5 pb-2 md:pb-0 pr-0 md:pr-3 overflow-x-auto md:overflow-visible scrollbar-none">
        <button
          onClick={() => handleChampionshipChange("DRIVERS")}
          className={`px-3 py-2 text-left font-bold rounded text-body-sm cursor-pointer transition-colors block shrink-0 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 ${selectedChampionship === "DRIVERS" ? "bg-terminal-blue/15 border-l-2 border-terminal-blue text-white" : "bg-white/3 hover:bg-white/5 text-slate-400"}`}
        >
          Drivers Championship
        </button>
        <button
          onClick={() => handleChampionshipChange("CONSTRUCTORS")}
          className={`px-3 py-2 text-left font-bold rounded text-body-sm cursor-pointer transition-colors block shrink-0 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 ${selectedChampionship === "CONSTRUCTORS" ? "bg-terminal-blue/15 border-l-2 border-terminal-blue text-white" : "bg-white/3 hover:bg-white/5 text-slate-400"}`}
        >
          Constructors Championship
        </button>
      </div>

      {/* Futures board */}
      <div className="flex-1 panel-raised rounded p-3.5 flex flex-col min-w-0 min-h-0">
        {/* Season narrative context */}
        <div className="panel-base border border-white/5 rounded p-2.5 mb-3.5 space-y-2">
          <FieldLabel className="text-micro">Season Standings Machine</FieldLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-body-sm font-data">
            <div className="panel-raised p-2 rounded">
              <FieldLabel className="text-micro">Title Standings Leader</FieldLabel>
              <span className="text-white font-bold block mt-0.5 truncate">
                {selectedChampionship === "DRIVERS" ? activeDriverLeader : activeTeamLeader}
              </span>
            </div>
            <div className="panel-raised p-2 rounded">
              <FieldLabel className="text-micro">Rounds Remaining</FieldLabel>
              <span className="text-white font-bold block mt-0.5">{24 - completedRaces.length} / 24 GP Rounds</span>
            </div>
            <div className="panel-raised p-2 rounded">
              <FieldLabel className="text-micro">Momentum</FieldLabel>
              <span className="text-terminal-green-light font-bold block mt-0.5">NOR +3.2%</span>
            </div>
            <div className="panel-raised p-2 rounded">
              <FieldLabel className="text-micro">Selected Coverage</FieldLabel>
              <span className="text-terminal-blue-light font-bold block mt-0.5 truncate">
                {selectedContender ? `[FUT-${selectedContender}] ${backingSide === "NO" ? "LAY" : "BACK"}` : "None Highlighted"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-3 shrink-0">
          <h2 className="text-white font-bold text-body-sm uppercase tracking-wider flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-terminal-gold" /> 2025 World Title Futures Chain
          </h2>
          <FieldLabel as="span" className="text-micro">
            MARKETS PROGRESSIVE RE-PRICING ACTIVE
          </FieldLabel>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 min-h-0">
          {/* Mobile card list (<768) */}
          <div className="md:hidden space-y-1.5">
            {activeFutures.map((fut) => {
              const isSelected = fut.id === selectedContractId;
              const pos = positions[fut.id];
              const posNo = positions[`${fut.id}_NO`];
              const pointsScored =
                selectedChampionship === "DRIVERS"
                  ? driverPoints[fut.target] || 0
                  : constructorPoints[fut.target] || 0;
              const priceChg = fut.change;
              const directionClass =
                priceChg > 0 ? "text-terminal-green-light" : priceChg < 0 ? "text-terminal-red" : "text-slate-500";
              return (
                <button
                  key={fut.id}
                  type="button"
                  onClick={() => handleMobileSelect(fut.id)}
                  className={`w-full text-left panel-base border rounded p-3 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 ${isSelected ? "border-terminal-blue-light/60 bg-terminal-blue/10" : "border-white/5 hover:bg-white/4"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-terminal-blue-light font-mono font-bold text-body-sm tracking-wide">
                        {fut.symbol}
                      </span>
                      <span className="text-body-sm font-sans font-light text-slate-300 block mt-0.5 leading-snug">
                        {fut.title}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-white font-bold font-data text-body-sm block">
                        {Math.round(fut.mid * 100)}%
                      </span>
                      <span className={`text-micro font-bold font-data inline-flex items-center gap-0.5 justify-end ${directionClass}`}>
                        {priceChg > 0 ? "+" : ""}
                        {(priceChg * 100).toFixed(1)}%
                        {priceChg > 0 ? (
                          <ArrowUpRight className="w-2.5 h-2.5" />
                        ) : priceChg < 0 ? (
                          <ArrowDownRight className="w-2.5 h-2.5" />
                        ) : null}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-white/5 font-data text-micro">
                    <div className="inline-flex rounded border border-white/5 bg-carbon-black overflow-hidden font-bold text-body-sm">
                      <span className="px-2 py-0.5 text-terminal-green-light border-r border-white/5">
                        ${fut.bid.toFixed(2)}
                      </span>
                      <span className="px-2 py-0.5 text-terminal-blue-light">${fut.ask.toFixed(2)}</span>
                    </div>
                    <span className="text-slate-400 font-bold">{pointsScored} pts</span>
                    <span className="font-bold uppercase">
                      {pos || posNo ? (
                        <span className="inline-flex gap-1.5">
                          {pos ? <span className="text-terminal-green-light">Y:{pos.qty}</span> : null}
                          {posNo ? <span className="text-terminal-red">N:{posNo.qty}</span> : null}
                        </span>
                      ) : (
                        <span className="text-slate-500">No holding</span>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <table className="hidden md:table w-full text-left font-data text-body-sm">
            <thead>
              <tr className="text-slate-400 uppercase text-micro border-b border-white/5 font-bold tracking-wider">
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
                const isSelected = fut.id === selectedContractId;
                const pos = positions[fut.id];
                const posNo = positions[`${fut.id}_NO`];
                const pointsScored =
                  selectedChampionship === "DRIVERS"
                    ? driverPoints[fut.target] || 0
                    : constructorPoints[fut.target] || 0;
                const priceChg = fut.change;
                const directionClass =
                  priceChg > 0 ? "text-terminal-green-light" : priceChg < 0 ? "text-terminal-red" : "text-slate-500";

                return (
                  <tr
                    key={fut.id}
                    onClick={() => setSelectedContractId(isSelected ? "" : fut.id)}
                    className={`border-b border-white/5 hover:bg-white/4 cursor-pointer last:border-0 transition-colors ${isSelected ? "bg-terminal-blue/10 border-l-2 border-l-terminal-blue-light font-bold text-white" : "hover:text-slate-200"}`}
                  >
                    <td className={`pl-2 ${isSelected ? "py-2.5" : "py-1.5"}`}>
                      <span className="inline-flex items-center gap-1.5">
                        {isSelected && (
                          <span className="px-1 py-0.5 rounded bg-terminal-blue-light/20 text-terminal-blue-light text-micro font-bold uppercase">
                            SEL
                          </span>
                        )}
                        <span className="text-terminal-blue-light font-mono font-bold text-body-sm tracking-wide">
                          {fut.symbol}
                        </span>
                      </span>
                      <span
                        className={`text-body-sm font-sans font-light block mt-0.5 ${isSelected ? "text-slate-200" : "text-slate-400"}`}
                      >
                        {fut.title}
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-bold text-slate-300">{pointsScored} pts</td>
                    <td className="py-1.5 text-right font-bold text-slate-300">{Math.round(fut.mid * 100)}%</td>
                    <td className="py-1.5 text-right font-bold">
                      <span className={`inline-flex items-center gap-0.5 justify-end ${directionClass}`}>
                        {priceChg > 0 ? "+" : ""}
                        {(priceChg * 100).toFixed(1)}%
                        {priceChg > 0 ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : priceChg < 0 ? (
                          <ArrowDownRight className="w-3 h-3" />
                        ) : null}
                      </span>
                    </td>
                    <td className="py-1.5 text-center">
                      <div className="inline-flex rounded border border-white/5 bg-carbon-black overflow-hidden font-bold text-body-sm">
                        <span className="px-2.5 py-0.5 text-terminal-green-light border-r border-white/5">
                          ${fut.bid.toFixed(2)}
                        </span>
                        <span className="px-2.5 py-0.5 text-terminal-blue-light">${fut.ask.toFixed(2)}</span>
                      </div>
                    </td>
                    {isFocusMode && (
                      <>
                        <td className="py-1.5 text-right text-slate-400 font-bold">{fut.delta?.toFixed(3)}</td>
                        <td className="py-1.5 text-right text-slate-400 font-bold">{fut.theta?.toFixed(4)}</td>
                        <td className="py-1.5 text-right text-slate-400 font-bold">{Math.round((fut.iv || 0) * 100)}%</td>
                      </>
                    )}
                    <td
                      className={`py-1.5 text-right font-bold pr-2 ${isSelected ? "text-terminal-blue-light" : "text-slate-500"}`}
                    >
                      {pos || posNo ? (
                        <div className="text-micro leading-tight">
                          {pos ? <div className="text-terminal-green-light">YES: {pos.qty}</div> : null}
                          {posNo ? <div className="text-terminal-red">NO: {posNo.qty}</div> : null}
                        </div>
                      ) : (
                        "--"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="pt-2 mt-2 border-t border-white/5 shrink-0">
          <p className="text-micro text-slate-500 font-sans font-light italic">
            <span className="hidden md:inline">
              Highlight a contender to open the title derivative ticket in the desk panel on the right.
            </span>
            <span className="md:hidden">Tap a contender card to open the title derivative ticket.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
