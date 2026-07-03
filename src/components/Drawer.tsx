"use client";

import React from "react";
import { X } from "lucide-react";
import { useOverlay } from "./lib/useOverlay";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  title: string;
  /** Panel width. Defaults to a mobile-safe max. */
  widthClass?: string;
  children: React.ReactNode;
}

/**
 * Slide-in drawer over a dimmed overlay. Used to host the LeftRail (race story)
 * and the DeskPanel (order desk) at breakpoints where they leave the inline grid.
 *
 * - Esc / overlay-tap / close button all dismiss.
 * - Focus trapped inside; focus returns to trigger on close (useOverlay).
 * - transform/opacity only; prefers-reduced-motion removes the slide.
 * - z-index sits just below the app modals (SettlementModal/ConfirmDialog = z-70).
 */
export default function Drawer({
  open,
  onClose,
  side = "left",
  title,
  widthClass = "w-[min(320px,86vw)]",
  children,
}: DrawerProps) {
  const panelRef = useOverlay({ open, onClose });

  if (!open) return null;

  const isLeft = side === "left";

  return (
    <div className="fixed inset-0 z-[65] flex select-none" role="dialog" aria-modal="true" aria-label={title}>
      {/* Dimmed overlay */}
      <div
        className="absolute inset-0 bg-carbon-black/75 backdrop-blur-sm animate-fadeIn"
        onMouseDown={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative ${widthClass} h-full bg-carbon-dark ${isLeft ? "border-r mr-auto motion-safe:animate-drawer-in-left" : "border-l ml-auto motion-safe:animate-drawer-in-right"} border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.6)] flex flex-col min-h-0 outline-none`}
      >
        <div className="h-11 shrink-0 flex items-center justify-between px-3 border-b border-white/5 bg-carbon-dark">
          <span className="text-white font-mono font-extrabold uppercase tracking-wider text-micro">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="w-9 h-9 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 active:scale-[0.96]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
