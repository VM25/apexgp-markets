"use client";

import React from "react";
import { Activity, Briefcase, Landmark, FileText, Globe, Trophy, BookOpen } from "lucide-react";

interface WorkspaceNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  densityMode: "default" | "focus";
  setDensityMode: (mode: "default" | "focus") => void;
  onOpenTutorial: () => void;
  progressPercent: number;
  isAssembled: boolean;
}

const TABS = [
  { id: "market", label: "Race Markets", icon: <Globe className="w-3 h-3" /> },
  { id: "replay", label: "Race Replay", icon: <Activity className="w-3 h-3" /> },
  { id: "portfolio", label: "Portfolio", icon: <Briefcase className="w-3 h-3" /> },
  { id: "championship", label: "Season Futures", icon: <Landmark className="w-3 h-3" /> },
  { id: "standings", label: "Championship", icon: <Trophy className="w-3 h-3" /> },
  { id: "research", label: "Research Lab", icon: <FileText className="w-3 h-3" /> },
];

export default function WorkspaceNav({
  activeTab,
  setActiveTab,
  densityMode,
  setDensityMode,
  onOpenTutorial,
  progressPercent,
  isAssembled,
}: WorkspaceNavProps) {
  return (
    <div>
      {/* Race progress timeline strip */}
      <div className="w-full h-[2px] bg-carbon-surface">
        <div
          className="bg-terminal-blue h-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div
        className={`h-8 bg-carbon-dark border-b border-white/5 flex items-center justify-between px-3 z-10 transition-all duration-700 delay-75 ease-out ${isAssembled ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}`}
      >
        {/* Workspace tabs */}
        <div className="flex gap-1 h-full items-end">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`h-[26px] px-3 font-bold border-t-2 flex items-center gap-1.5 transition-colors text-micro cursor-pointer rounded-t outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 ${activeTab === tab.id ? "bg-carbon-light border-terminal-blue text-white" : "border-transparent text-slate-500 hover:text-slate-300"}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Density + tutorial */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-carbon-surface rounded border border-white/5 overflow-hidden text-micro font-bold">
            <button
              type="button"
              onClick={() => setDensityMode("default")}
              className={`px-3 py-1 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 ${densityMode === "default" ? "bg-terminal-blue/20 text-white" : "hover:bg-white/5 text-slate-500 hover:text-slate-400"}`}
            >
              Default
            </button>
            <button
              type="button"
              onClick={() => setDensityMode("focus")}
              className={`px-3 py-1 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 ${densityMode === "focus" ? "bg-terminal-blue/20 text-white" : "hover:bg-white/5 text-slate-500 hover:text-slate-400"}`}
            >
              Focus
            </button>
          </div>

          <div className="h-3 w-px bg-white/10" />

          <button
            type="button"
            onClick={onOpenTutorial}
            className="px-2 py-1 rounded font-bold border text-micro flex items-center gap-1 cursor-pointer bg-white/3 border-white/5 text-slate-500 hover:text-slate-300 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60"
          >
            <BookOpen className="w-3 h-3" />
            Tutorial
          </button>
        </div>
      </div>
    </div>
  );
}
