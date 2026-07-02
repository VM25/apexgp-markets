"use client";

import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, ShieldAlert, ChevronDown } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";

interface RaceMeta {
  id: string;
  name: string;
  round_number?: number;
}

interface CommandBarProps {
  isPlaying: boolean;
  isHalted: boolean;
  speed: number;
  currentLapIdx: number;
  totalLaps: number;
  selectedRaceId: string;
  setSelectedRaceId: (id: string) => void;
  allRaces: RaceMeta[];
  portfolioValue: number;
  unrealizedPnL: number;
  handlePlayPause: () => void;
  handleReset: () => void;
  handleInstantReplay: () => void;
  handleSpeedChange: (speed: number) => void;
  onResetSeason: () => void;
  isAssembled: boolean;
}

const SPEEDS = [0.5, 1, 2, 4, 10];

export default function CommandBar({
  isPlaying,
  isHalted,
  speed,
  currentLapIdx,
  totalLaps,
  selectedRaceId,
  setSelectedRaceId,
  allRaces,
  portfolioValue,
  unrealizedPnL,
  handlePlayPause,
  handleReset,
  handleInstantReplay,
  handleSpeedChange,
  onResetSeason,
  isAssembled,
}: CommandBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "race" | "season">(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  return (
    <div
      className={`h-11 bg-carbon-dark border-b border-white/5 flex items-center justify-between px-3 z-20 transition-all duration-700 ease-out ${isAssembled ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}`}
    >
      {/* Brand + session menu + race selector */}
      <div className="flex items-center gap-3">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-1.5 cursor-pointer rounded px-1 py-0.5 hover:bg-white/5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60"
          >
            <span className={`w-2 h-2 rounded ${isPlaying ? "bg-terminal-blue animate-ping" : "bg-slate-500"}`} />
            <h1 className="text-white font-extrabold tracking-wider text-micro uppercase">
              APEXGP <span className="text-terminal-blue-light font-light">{"// INSTITUTIONAL DESK"}</span>
            </h1>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute left-0 top-full mt-1.5 w-52 panel-elevated rounded-md p-1 z-50 animate-fadeIn"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirm("race");
                }}
                className="w-full text-left px-2.5 py-2 rounded text-body-sm text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer transition-colors flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset race
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirm("season");
                }}
                className="w-full text-left px-2.5 py-2 rounded text-body-sm text-slate-300 hover:bg-terminal-red/10 hover:text-terminal-red cursor-pointer transition-colors flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60"
              >
                <ShieldAlert className="w-3.5 h-3.5" /> Reset season
              </button>
            </div>
          )}
        </div>

        <div className="h-3 w-px bg-white/10" />

        <select
          value={selectedRaceId}
          onChange={(e) => setSelectedRaceId(e.target.value)}
          aria-label="Select race"
          className="bg-carbon-surface hover:bg-white/5 text-slate-300 border border-white/5 rounded px-2 py-1 cursor-pointer text-micro font-bold transition-colors max-w-[220px] outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60"
        >
          {allRaces.map((r, idx) => (
            <option key={r.id} value={r.id}>
              ROUND {String(r.round_number || idx + 1).padStart(2, "0")} · {r.name.replace("Grand Prix", "GP")}
            </option>
          ))}
        </select>
      </div>

      {/* Playback + speed + lap + status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-carbon-surface rounded border border-white/5 overflow-hidden">
          <button
            onClick={handlePlayPause}
            title={isPlaying ? "Pause Simulation" : "Start Simulation"}
            className={`p-1.5 hover:bg-white/5 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 ${isPlaying ? "text-terminal-yellow" : "text-terminal-green-light"}`}
          >
            {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
          </button>
          <button
            onClick={handleReset}
            title="Reset Simulation"
            className="p-1.5 hover:bg-white/5 text-slate-400 cursor-pointer border-l border-white/5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center bg-carbon-surface rounded border border-white/5 overflow-hidden text-micro font-bold">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => handleSpeedChange(s)}
              className={`px-1.5 py-1.5 cursor-pointer transition-colors border-r border-white/5 last:border-0 outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 ${speed === s && isPlaying ? "bg-terminal-blue/20 text-white" : "hover:bg-white/5 text-slate-500"}`}
            >
              {s}x
            </button>
          ))}
          <button
            onClick={handleInstantReplay}
            title="Settle Race Instantly"
            className="px-1.5 py-1.5 hover:bg-white/5 text-terminal-gold cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60"
          >
            INST
          </button>
        </div>

        <div className="flex items-center gap-1.5 bg-carbon-surface rounded border border-white/5 px-2 py-1 text-white font-bold">
          <span className="text-slate-400 text-micro">LAP</span>
          <span className="text-terminal-blue-light font-data text-body-sm font-extrabold">{currentLapIdx}</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-300 font-data text-body-sm">{totalLaps}</span>
        </div>

        {isHalted ? (
          <div className="bg-terminal-red/10 border border-terminal-red/35 px-2 py-1 rounded flex items-center gap-1 text-terminal-red text-micro font-extrabold animate-pulse-border uppercase tracking-wider">
            <ShieldAlert className="w-3 h-3 text-terminal-red" /> HALTED
          </div>
        ) : (
          <div className="bg-terminal-green/5 border border-terminal-green/20 px-2 py-1 rounded flex items-center gap-1 text-terminal-green-light text-micro font-extrabold tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-terminal-green-light animate-pulse" /> BROADCASTING
          </div>
        )}
      </div>

      {/* NAV + unrealized PnL */}
      <div className="flex items-center gap-3 bg-carbon-surface rounded border border-white/5 px-3 py-1">
        <div className="text-right">
          <span className="text-micro text-slate-450 block uppercase font-bold tracking-wider leading-none">
            NAV Net Worth
          </span>
          <span className="text-white text-data font-extrabold font-data block leading-tight mt-0.5">
            ${portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="text-left font-data border-l border-white/5 pl-3">
          <span className="text-micro text-slate-450 block uppercase font-bold tracking-wider leading-none">
            Unrealized PnL
          </span>
          <span
            className={`text-data font-extrabold block leading-tight mt-0.5 ${unrealizedPnL >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}
          >
            {unrealizedPnL >= 0 ? "+" : ""}${unrealizedPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === "race"}
        title="Reset Race"
        message="This resets the current race replay to the pre-race grid (Lap 0) and re-initializes the market chain. Your portfolio balances and championship standings are preserved."
        confirmLabel="Reset Race"
        cancelLabel="Cancel"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          handleReset();
        }}
      />
      <ConfirmDialog
        open={confirm === "season"}
        danger
        title="Reset Season Session"
        message="Resetting the season session will fully clear your portfolio balances ($100k baseline), wipe the trade history ledger, purge championship standings, and return you to Round 01 Australian GP. Are you sure you want to proceed?"
        confirmLabel="Reset Season"
        cancelLabel="Cancel"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          onResetSeason();
        }}
      />
    </div>
  );
}
