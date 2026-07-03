"use client";

import React from "react";
import { X } from "lucide-react";
import { useOverlay } from "./lib/useOverlay";

interface MobileSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * Bottom sheet for mobile (<768). Hosts the OrderTicket, the "More" nav menu,
 * the portfolio/positions summary, and the commentary list.
 *
 * - ~80dvh max height, drag-handle visual affordance, close button.
 * - Esc / overlay-tap / close button all dismiss.
 * - Focus trap + focus return via useOverlay.
 * - transform/opacity only; prefers-reduced-motion removes the slide.
 */
export default function MobileSheet({ open, onClose, title, children }: MobileSheetProps) {
  const panelRef = useOverlay({ open, onClose });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[65] flex flex-col justify-end select-none" role="dialog" aria-modal="true" aria-label={title}>
      {/* Dimmed overlay */}
      <div
        className="absolute inset-0 bg-carbon-black/75 backdrop-blur-sm animate-fadeIn"
        onMouseDown={onClose}
        aria-hidden="true"
      />

      {/* Sheet panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative w-full max-h-[80dvh] bg-carbon-dark border-t border-white/10 rounded-t-xl shadow-[0_-8px_50px_rgba(0,0,0,0.6)] flex flex-col min-h-0 outline-none motion-safe:animate-sheet-in"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Drag handle visual */}
        <div className="shrink-0 flex justify-center pt-2 pb-1" aria-hidden="true">
          <span className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        <div className="h-9 shrink-0 flex items-center justify-between px-3 border-b border-white/5">
          <span className="text-white font-mono font-extrabold uppercase tracking-wider text-micro">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sheet"
            className="w-9 h-9 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 active:scale-[0.96]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3">{children}</div>
      </div>
    </div>
  );
}
