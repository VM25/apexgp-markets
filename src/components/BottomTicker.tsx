"use client";

import React from "react";
import { Activity, ChevronRight } from "lucide-react";
import { CommentaryHeadline } from "../hooks/useSimulation";
import { useTerminalUI } from "./TerminalUIProvider";

interface BottomTickerProps {
  commentary: CommentaryHeadline[];
}

function impactColor(impactType: string) {
  if (impactType === "gain") return "text-terminal-green-light font-bold";
  if (impactType === "loss") return "text-terminal-red font-bold";
  if (impactType === "halt") return "text-terminal-yellow font-bold";
  if (impactType === "settlement") return "text-terminal-gold font-bold";
  return "text-slate-400";
}

export default function BottomTicker({ commentary }: BottomTickerProps) {
  const { setActiveSheet } = useTerminalUI();
  const latest = commentary.length > 0 ? commentary[0] : null;

  return (
    <>
      {/* Desktop / tablet marquee (>=768) */}
      <div className="hidden md:flex h-6 bg-carbon-dark border-t border-white/5 items-center px-3 overflow-hidden z-20 font-data">
        <span className="text-terminal-blue font-bold tracking-wider text-micro mr-3 shrink-0 uppercase flex items-center gap-1.5">
          <Activity className="w-3 h-3" /> WIRE FEED //
        </span>
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-marquee whitespace-nowrap inline-flex gap-8 hover:[animation-play-state:paused] cursor-pointer">
            {commentary.length > 0 ? (
              commentary.slice(0, 10).map((c, idx) => (
                <span key={idx} className={`inline-flex items-center gap-1.5 text-micro ${impactColor(c.impactType)}`}>
                  <span className="text-slate-600 font-bold">[{c.timestamp}]</span>
                  {c.headline}
                </span>
              ))
            ) : (
              <span className="text-slate-500 text-micro font-mono">
                REPLAY WIRE SYSTEM NOMINAL. LAUNCH REPLAY TO STREAM QUANT PRICE COMMITS.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mobile single-line headline chip (<768) — tap opens commentary sheet. */}
      <button
        type="button"
        onClick={() => setActiveSheet("commentary")}
        aria-label="Open wire commentary"
        className="md:hidden h-8 w-full bg-carbon-dark border-t border-white/5 flex items-center gap-2 px-2.5 z-20 font-data cursor-pointer active:bg-white/5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-terminal-blue-light/60"
      >
        <span className="text-terminal-blue font-bold tracking-wider text-micro shrink-0 uppercase flex items-center gap-1">
          <Activity className="w-3 h-3" /> WIRE
        </span>
        <span className={`text-micro truncate flex-1 text-left ${latest ? impactColor(latest.impactType) : "text-slate-500"}`}>
          {latest ? latest.headline : "Wire nominal. Launch replay to stream."}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
      </button>
    </>
  );
}
