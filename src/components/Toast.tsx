"use client";

import React from "react";
import { CheckCircle2, ShieldAlert, Info, X } from "lucide-react";
import { useTerminalUI, ToastVariant } from "./TerminalUIProvider";

const VARIANT_STYLES: Record<
  ToastVariant,
  { border: string; icon: React.ReactNode; accent: string }
> = {
  success: {
    border: "border-terminal-green/30",
    accent: "text-terminal-green-light",
    icon: <CheckCircle2 className="w-4 h-4 text-terminal-green-light shrink-0" />,
  },
  error: {
    border: "border-terminal-red/40",
    accent: "text-terminal-red",
    icon: <ShieldAlert className="w-4 h-4 text-terminal-red shrink-0" />,
  },
  info: {
    border: "border-terminal-blue/30",
    accent: "text-terminal-blue-light",
    icon: <Info className="w-4 h-4 text-terminal-blue-light shrink-0" />,
  },
};

/**
 * Toast stack. Anchored top-right just under the CommandBar.
 * Success / error / info variants; auto-dismiss (8s in provider) + manual dismiss.
 */
export default function ToastStack() {
  const { toasts, dismissToast } = useTerminalUI();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-14 right-3 z-[60] flex flex-col gap-2 w-[320px] max-w-[calc(100vw-1.5rem)] pointer-events-none">
      {toasts.map((t) => {
        const style = VARIANT_STYLES[t.variant];
        return (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={`panel-elevated ${style.border} rounded-md p-3 flex items-start gap-2.5 animate-toast-in pointer-events-auto`}
          >
            {style.icon}
            <div className="flex-1 min-w-0">
              <span
                className={`block font-mono font-bold uppercase text-micro tracking-wider ${style.accent}`}
              >
                {t.title}
              </span>
              {t.message && (
                <p className="text-body-sm text-slate-300 font-sans font-light leading-snug mt-0.5 break-words">
                  {t.message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss notification"
              className="text-slate-500 hover:text-white shrink-0 rounded cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 focus-visible:ring-offset-1 focus-visible:ring-offset-carbon-black"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
