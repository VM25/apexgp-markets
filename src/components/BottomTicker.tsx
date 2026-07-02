"use client";

import React from "react";
import { Activity } from "lucide-react";
import { CommentaryHeadline } from "../hooks/useSimulation";

interface BottomTickerProps {
  commentary: CommentaryHeadline[];
}

export default function BottomTicker({ commentary }: BottomTickerProps) {
  return (
    <div className="h-6 bg-carbon-dark border-t border-white/5 flex items-center px-3 overflow-hidden z-20 font-data">
      <span className="text-terminal-blue font-bold tracking-wider text-micro mr-3 shrink-0 uppercase flex items-center gap-1.5">
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
                <span key={idx} className={`inline-flex items-center gap-1.5 text-micro ${colorClass}`}>
                  <span className="text-slate-600 font-bold">[{c.timestamp}]</span>
                  {c.headline}
                </span>
              );
            })
          ) : (
            <span className="text-slate-500 text-micro font-mono">
              REPLAY WIRE SYSTEM NOMINAL. LAUNCH REPLAY TO STREAM QUANT PRICE COMMITS.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
