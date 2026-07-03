"use client";

import React, { useEffect } from "react";
import { Contract } from "../../hooks/useSimulation";
import { Position } from "../../hooks/usePortfolio";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useTerminalUI } from "../TerminalUIProvider";
import FieldLabel from "../FieldLabel";

interface MarketTabProps {
  contracts: { [id: string]: Contract };
  positions: { [id: string]: Position };
  isFocusMode?: boolean;
}

const CATEGORIES = [
  { id: "WINNER", label: "Race Winner" },
  { id: "PODIUM", label: "Podium Finish" },
  { id: "FASTEST_LAP", label: "Fastest Lap" },
  { id: "H2H", label: "Head-to-Head" },
  { id: "SAFETY_CAR", label: "Safety Car" },
  { id: "DNF", label: "Retirement (DNF)" },
];

export default function MarketTab({ contracts, positions, isFocusMode }: MarketTabProps) {
  const { selectedContractId, setSelectedContractId, setActiveSheet } = useTerminalUI();
  const [selectedCategory, setSelectedCategory] = React.useState<string>("WINNER");
  const showGreeks = !!isFocusMode;

  const activeContracts = Object.values(contracts).filter((c) => c.type === selectedCategory);

  // On mobile a card tap selects the contract AND opens the order-ticket sheet.
  const handleMobileSelect = (id: string) => {
    setSelectedContractId(id);
    setActiveSheet("ticket");
  };

  // Keep selection valid when the category changes.
  useEffect(() => {
    if (selectedContractId) {
      const stillValid = activeContracts.find((c) => c.id === selectedContractId);
      if (!stillValid) setSelectedContractId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, contracts]);

  return (
    <div className="h-full flex flex-col md:flex-row gap-3.5 min-h-0">
      {/* Category filter */}
      <div className="w-full md:w-40 shrink-0 flex flex-row md:flex-col gap-1 md:pr-1 overflow-x-auto md:overflow-visible scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-2 text-left font-bold rounded text-body-sm cursor-pointer transition-colors block shrink-0 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 ${selectedCategory === cat.id ? "bg-terminal-blue/15 border-l-2 border-terminal-blue text-white" : "bg-white/3 hover:bg-white/5 text-slate-400"}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Contract chain table */}
      <div className="flex-1 panel-raised rounded p-3.5 flex flex-col min-w-0 min-h-0">
        <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-terminal-blue" />
            <h2 className="text-white font-bold text-body-sm uppercase tracking-wider">
              {selectedCategory} CONTRACT INDEX
            </h2>
          </div>
          <FieldLabel as="span" className="text-micro">
            EXIT PRICING RE-VALUATION (BID EXECUTION)
          </FieldLabel>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          {/* Mobile card list (<768) */}
          <div className="md:hidden space-y-1.5">
            {activeContracts.map((c) => {
              const isSelected = c.id === selectedContractId;
              const pos = positions[c.id];
              const priceChg = c.change;
              const directionClass =
                priceChg > 0 ? "text-terminal-green-light" : priceChg < 0 ? "text-terminal-red" : "text-slate-500";
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleMobileSelect(c.id)}
                  className={`w-full text-left panel-base border rounded p-3 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 ${isSelected ? "border-terminal-blue-light/60 bg-terminal-blue/10" : "border-white/5 hover:bg-white/4"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-terminal-blue-light font-mono font-bold text-body-sm tracking-wide">
                        {c.symbol}
                      </span>
                      <span className="text-body-sm font-sans font-light text-slate-300 block mt-0.5 leading-snug">
                        {c.title}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-white font-bold font-data text-body-sm block">
                        {Math.round(c.mid * 100)}%
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
                        ${c.bid.toFixed(2)}
                      </span>
                      <span className="px-2 py-0.5 text-terminal-blue-light">${c.ask.toFixed(2)}</span>
                    </div>
                    <span className={`font-bold uppercase ${pos ? "text-terminal-blue-light" : "text-slate-500"}`}>
                      {pos ? `Holding ${pos.qty}` : "No holding"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <table className="hidden md:table w-full text-left font-data text-body-sm">
            <thead>
              <tr className="text-slate-400 uppercase text-micro border-b border-white/5 font-bold tracking-wider">
                <th className="pb-2 pl-2 w-[35%]">Contract Asset</th>
                <th className="pb-2 text-right">Implied Prob (Mid)</th>
                <th className="pb-2 text-right">Tick Chg</th>
                <th className="pb-2 text-center w-[22%]">Bid / Ask</th>
                {showGreeks && (
                  <>
                    <th className="pb-2 text-right">Delta (Δ)</th>
                    <th className="pb-2 text-right">Theta (Θ)</th>
                    <th className="pb-2 text-right">IV</th>
                  </>
                )}
                <th className="pb-2 text-right">Holdings</th>
              </tr>
            </thead>
            <tbody>
              {activeContracts.map((c) => {
                const isSelected = c.id === selectedContractId;
                const pos = positions[c.id];
                const priceChg = c.change;
                const directionClass =
                  priceChg > 0 ? "text-terminal-green-light" : priceChg < 0 ? "text-terminal-red" : "text-slate-500";

                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedContractId(isSelected ? "" : c.id)}
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
                          {c.symbol}
                        </span>
                      </span>
                      <span
                        className={`text-body-sm font-sans font-light block mt-0.5 ${isSelected ? "text-slate-200" : "text-slate-400"}`}
                      >
                        {c.title}
                      </span>
                    </td>
                    <td className={`py-1.5 text-right font-bold ${isSelected ? "text-white" : "text-slate-300"}`}>
                      {Math.round(c.mid * 100)}%
                    </td>
                    <td className="py-1.5 text-right font-bold">
                      <span className={`inline-flex items-center gap-0.5 justify-end ${directionClass}`}>
                        {priceChg > 0 ? "+" : ""}
                        {(priceChg * 100).toFixed(1)}%
                        {priceChg > 0 ? (
                          <ArrowUpRight className="w-2.5 h-2.5" />
                        ) : priceChg < 0 ? (
                          <ArrowDownRight className="w-2.5 h-2.5" />
                        ) : null}
                      </span>
                    </td>
                    <td className="py-1.5 text-center">
                      <div className="inline-flex rounded border border-white/5 bg-carbon-black overflow-hidden font-bold text-body-sm">
                        <span className="px-2 py-0.5 text-terminal-green-light border-r border-white/5">
                          ${c.bid.toFixed(2)}
                        </span>
                        <span className="px-2 py-0.5 text-terminal-blue-light">${c.ask.toFixed(2)}</span>
                      </div>
                    </td>
                    {showGreeks && (
                      <>
                        <td className="py-1.5 text-right text-slate-400 font-bold">{c.delta?.toFixed(3)}</td>
                        <td
                          className={`py-1.5 text-right font-bold ${c.theta >= 0 ? "text-terminal-green-light" : "text-slate-400"}`}
                        >
                          {c.theta > 0 ? "+" : ""}
                          {c.theta?.toFixed(4)}
                        </td>
                        <td className="py-1.5 text-right text-slate-400 font-bold">
                          {Math.round((c.iv || 0) * 100)}%
                        </td>
                      </>
                    )}
                    <td
                      className={`py-1.5 text-right font-bold pr-2 ${isSelected ? "text-terminal-blue-light" : "text-slate-500"}`}
                    >
                      {pos ? `${pos.qty}` : "--"}
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
              Select a contract to open the execution ticket in the desk panel on the right.
            </span>
            <span className="md:hidden">Tap a contract card to open the execution ticket.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
