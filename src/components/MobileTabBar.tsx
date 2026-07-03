"use client";

import React from "react";
import { Globe, Activity, Briefcase, Landmark, MoreHorizontal } from "lucide-react";

interface MobileTabBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenMore: () => void;
}

const PRIMARY_TABS = [
  { id: "market", label: "Markets", icon: Globe },
  { id: "replay", label: "Replay", icon: Activity },
  { id: "portfolio", label: "Portfolio", icon: Briefcase },
  { id: "championship", label: "Futures", icon: Landmark },
];

/**
 * Bottom navigation bar for mobile (<768). Rendered as the shell's last grid row.
 * "More" opens a sheet listing the secondary workspaces (Standings, Research,
 * Tutorial, Session reset). Hidden at >=768 (WorkspaceNav takes over).
 */
export default function MobileTabBar({ activeTab, setActiveTab, onOpenMore }: MobileTabBarProps) {
  // "More" is highlighted when a secondary workspace is active.
  const moreActive = activeTab === "standings" || activeTab === "research";

  return (
    <nav
      className="md:hidden h-14 bg-carbon-dark border-t border-white/10 flex items-stretch z-20"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      {PRIMARY_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            aria-current={isActive ? "page" : undefined}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-terminal-blue-light/60 ${isActive ? "text-terminal-blue-light" : "text-slate-500 hover:text-slate-300"}`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-micro font-bold uppercase tracking-wide">{tab.label}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onOpenMore}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-terminal-blue-light/60 ${moreActive ? "text-terminal-blue-light" : "text-slate-500 hover:text-slate-300"}`}
      >
        <MoreHorizontal className="w-4 h-4" />
        <span className="text-micro font-bold uppercase tracking-wide">More</span>
      </button>
    </nav>
  );
}
