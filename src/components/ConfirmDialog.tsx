"use client";

import React, { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Styled in-app confirmation dialog replacing native confirm().
 * - Esc closes (cancel)
 * - Simple focus trap between the two action buttons
 * - Danger variant tints the confirm action red
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    // Focus the safe (cancel) action first
    cancelRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === "Tab") {
        // Trap focus between the two buttons
        const focusables = [cancelRef.current, confirmRef.current].filter(
          Boolean
        ) as HTMLButtonElement[];
        if (focusables.length === 0) return;
        const active = document.activeElement;
        const idx = focusables.indexOf(active as HTMLButtonElement);
        e.preventDefault();
        const dir = e.shiftKey ? -1 : 1;
        const next = focusables[(idx + dir + focusables.length) % focusables.length];
        next.focus();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-carbon-black/85 backdrop-blur-md select-none"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="panel-elevated rounded-lg p-5 max-w-sm w-full space-y-4">
        <div className="flex items-start gap-2.5 border-b border-white/5 pb-3">
          <AlertTriangle
            className={`w-4 h-4 shrink-0 mt-0.5 ${danger ? "text-terminal-red" : "text-terminal-yellow"}`}
          />
          <h2
            id="confirm-dialog-title"
            className="text-white font-mono font-extrabold uppercase tracking-wider text-body-sm"
          >
            {title}
          </h2>
        </div>

        <div className="text-body-sm text-slate-300 font-sans font-light leading-relaxed">
          {message}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="py-2 px-3.5 rounded font-bold text-micro uppercase tracking-wider cursor-pointer bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 focus-visible:ring-offset-1 focus-visible:ring-offset-carbon-black active:scale-[0.98]"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`py-2 px-4 rounded font-extrabold text-micro uppercase tracking-wider cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 focus-visible:ring-offset-1 focus-visible:ring-offset-carbon-black active:scale-[0.98] ${
              danger
                ? "bg-terminal-red hover:bg-terminal-red/90 text-white"
                : "bg-terminal-blue hover:bg-terminal-blue-light text-white"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
