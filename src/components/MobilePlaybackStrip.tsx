"use client";

import React from "react";
import { Play, Pause, RotateCcw, ShieldAlert } from "lucide-react";

interface MobilePlaybackStripProps {
  isPlaying: boolean;
  isHalted: boolean;
  speed: number;
  currentLapIdx: number;
  totalLaps: number;
  handlePlayPause: () => void;
  handleReset: () => void;
  handleInstantReplay: () => void;
  handleSpeedChange: (speed: number) => void;
}

const MOBILE_SPEEDS = [1, 2, 10];

/**
 * Slim always-visible playback row on mobile (<768). Sits under the compact
 * CommandBar. Contains transport, speed presets, INST settle, halt state, and
 * the lap counter.
 */
export default function MobilePlaybackStrip({
  isPlaying,
  isHalted,
  speed,
  currentLapIdx,
  totalLaps,
  handlePlayPause,
  handleReset,
  handleInstantReplay,
  handleSpeedChange,
}: MobilePlaybackStripProps) {
  return (
    <div className="h-11 bg-carbon-dark border-b border-white/5 flex items-center gap-2 px-2.5 z-10">
      <div className="flex items-center bg-carbon-surface rounded border border-white/5 overflow-hidden">
        <button
          onClick={handlePlayPause}
          aria-label={isPlaying ? "Pause simulation" : "Start simulation"}
          className={`w-9 h-9 flex items-center justify-center hover:bg-white/5 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-terminal-blue-light/60 ${isPlaying ? "text-terminal-yellow" : "text-terminal-green-light"}`}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
        </button>
        <button
          onClick={handleReset}
          aria-label="Reset simulation"
          className="w-9 h-9 flex items-center justify-center hover:bg-white/5 text-slate-400 cursor-pointer border-l border-white/5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-terminal-blue-light/60"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center bg-carbon-surface rounded border border-white/5 overflow-hidden text-micro font-bold">
        {MOBILE_SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => handleSpeedChange(s)}
            className={`min-w-9 h-9 px-1 cursor-pointer transition-colors border-r border-white/5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-terminal-blue-light/60 ${speed === s && isPlaying ? "bg-terminal-blue/20 text-white" : "hover:bg-white/5 text-slate-500"}`}
          >
            {s}x
          </button>
        ))}
        <button
          onClick={handleInstantReplay}
          aria-label="Settle race instantly"
          className="min-w-9 h-9 px-1.5 hover:bg-white/5 text-terminal-gold cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-terminal-blue-light/60"
        >
          INST
        </button>
      </div>

      <div className="flex items-center gap-1.5 bg-carbon-surface rounded border border-white/5 px-2 h-9 text-white font-bold">
        <span className="text-slate-400 text-micro">LAP</span>
        <span className="text-terminal-blue-light font-data text-body-sm font-extrabold">{currentLapIdx}</span>
        <span className="text-slate-600">/</span>
        <span className="text-slate-300 font-data text-body-sm">{totalLaps}</span>
      </div>

      <div className="ml-auto shrink-0">
        {isHalted ? (
          <div className="bg-terminal-red/10 border border-terminal-red/35 px-2 h-9 rounded flex items-center gap-1 text-terminal-red text-micro font-extrabold uppercase tracking-wider">
            <ShieldAlert className="w-3 h-3" /> HALT
          </div>
        ) : (
          <div className="bg-terminal-green/5 border border-terminal-green/20 px-2 h-9 rounded flex items-center gap-1 text-terminal-green-light text-micro font-extrabold tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-terminal-green-light animate-pulse" /> LIVE
          </div>
        )}
      </div>
    </div>
  );
}
