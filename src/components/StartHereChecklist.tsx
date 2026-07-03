"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X, Compass, ArrowRight } from "lucide-react";
import {
  useTerminalUI,
  ChecklistStepId,
  CHECKLIST_STEP_IDS,
  OrientTarget,
} from "./TerminalUIProvider";
import FieldLabel from "./FieldLabel";

interface StartHereChecklistProps {
  /**
   * Live state signals from the terminal used to auto-check steps. No business
   * logic is mutated here — we only observe existing state.
   */
  selectedContractId: string;
  tradeHistoryLen: number;
  isPlaying: boolean;
  commentaryLen: number;
  showSettlement: boolean;
  /**
   * docked  — bottom of the LeftRail (>=1280)
   * banner  — slim strip above main (mobile/tablet first-run)
   * sheet   — inside the More bottom sheet (mobile)
   */
  variant: "docked" | "banner" | "sheet";
}

interface StepDef {
  id: ChecklistStepId;
  label: string;
  hint: string;
  target: OrientTarget;
}

const STEPS: StepDef[] = [
  {
    id: "context",
    label: "Review pre-race context",
    hint: "Race Story rail, far left",
    target: "left-rail",
  },
  {
    id: "select",
    label: "Select a contract from the chain",
    hint: "Contract index, centre workspace",
    target: "chain",
  },
  {
    id: "trial",
    label: "Execute a trial order",
    hint: "Desk panel ticket, right rail",
    target: "desk",
  },
  {
    id: "replay",
    label: "Launch the replay engine",
    hint: "Play control, command bar",
    target: "playback",
  },
  {
    id: "reprice",
    label: "Observe a repricing event",
    hint: "Wire ticker, along the footer",
    target: "commentary",
  },
  {
    id: "settlement",
    label: "Hold to settlement",
    hint: "Run the replay to the final lap",
    target: "playback",
  },
];

/**
 * DESK ORIENTATION module (VAT-16). A compact, dismissible, collapsible
 * checklist whose steps auto-complete from existing terminal state. Persists
 * progress via TerminalUIProvider (localStorage). No spotlight overlay — a
 * "show me" click flashes a subtle ring on the target region via a data-attribute.
 */
export default function StartHereChecklist({
  selectedContractId,
  tradeHistoryLen,
  isPlaying,
  commentaryLen,
  showSettlement,
  variant,
}: StartHereChecklistProps) {
  const {
    checklistDone,
    markChecklistStep,
    checklistDismissed,
    setChecklistDismissed,
    checklistExpanded,
    setChecklistExpanded,
    flashOrientTarget,
  } = useTerminalUI();

  // Auto-check steps from live state. Step 1 (context) completes alongside step 2
  // (a selection implies the desk has been oriented) to keep detection simple.
  useEffect(() => {
    if (selectedContractId) {
      markChecklistStep("context");
      markChecklistStep("select");
    }
  }, [selectedContractId, markChecklistStep]);

  useEffect(() => {
    if (tradeHistoryLen > 0) markChecklistStep("trial");
  }, [tradeHistoryLen, markChecklistStep]);

  useEffect(() => {
    if (isPlaying) markChecklistStep("replay");
  }, [isPlaying, markChecklistStep]);

  useEffect(() => {
    if (commentaryLen > 1) markChecklistStep("reprice");
  }, [commentaryLen, markChecklistStep]);

  useEffect(() => {
    if (showSettlement) markChecklistStep("settlement");
  }, [showSettlement, markChecklistStep]);

  // The mobile/tablet banner starts collapsed (a slim progress bar) so it never
  // dominates a small first screen; docked and sheet variants follow the shared
  // expanded state.
  const [bannerExpanded, setBannerExpanded] = useState<boolean>(false);
  const expanded = variant === "banner" ? bannerExpanded : checklistExpanded;
  const setExpanded = variant === "banner" ? setBannerExpanded : setChecklistExpanded;

  const completedCount = CHECKLIST_STEP_IDS.filter((id) => checklistDone[id]).length;
  const total = CHECKLIST_STEP_IDS.length;
  const allDone = completedCount === total;

  if (checklistDismissed) return null;

  // The first not-yet-complete step gets the pulsing "active" accent.
  const activeStepId = STEPS.find((s) => !checklistDone[s.id])?.id ?? null;

  const containerClass =
    variant === "banner"
      ? "panel-raised rounded border-terminal-blue/25 p-2.5"
      : variant === "sheet"
        ? "panel-raised rounded p-3"
        : "panel-raised rounded p-2.5 mt-auto shrink-0";

  return (
    <div className={containerClass} data-orient-checklist>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="flex items-center gap-1.5 min-w-0 cursor-pointer rounded outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 transition-colors group"
        >
          <Compass className="w-3.5 h-3.5 text-terminal-blue shrink-0" />
          <FieldLabel as="span" className="text-micro text-slate-350 group-hover:text-white transition-colors truncate">
            Desk Orientation
          </FieldLabel>
          <span className="text-micro font-data font-bold text-terminal-blue-light shrink-0">
            {completedCount}/{total}
          </span>
          {expanded ? (
            <ChevronUp className="w-3 h-3 text-slate-500 shrink-0" />
          ) : (
            <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setChecklistDismissed(true)}
          aria-label="Dismiss orientation checklist"
          className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-white hover:bg-white/5 cursor-pointer transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-[3px] w-full rounded-full bg-carbon-black overflow-hidden">
        <div
          className="h-full bg-terminal-blue transition-all duration-500 ease-out"
          style={{ width: `${(completedCount / total) * 100}%` }}
        />
      </div>

      {expanded && (
        <div className="mt-2.5 space-y-1 animate-fadeIn">
          {allDone ? (
            <div className="text-center py-2 space-y-2">
              <p className="text-body-sm text-terminal-green-light font-bold font-mono uppercase tracking-wide">
                Orientation complete.
              </p>
              <p className="text-body-sm text-slate-400 font-sans font-light leading-snug">
                Full desk unlocked.
              </p>
              <button
                type="button"
                onClick={() => setChecklistDismissed(true)}
                className="mt-1 px-3 py-1.5 rounded border border-white/10 bg-white/3 hover:bg-white/5 text-micro font-bold uppercase tracking-wider text-slate-300 hover:text-white cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60"
              >
                Dismiss
              </button>
            </div>
          ) : (
            STEPS.map((step, idx) => {
              const done = checklistDone[step.id];
              const isActive = step.id === activeStepId;
              return (
                <div
                  key={step.id}
                  className={`rounded p-2 border transition-colors ${
                    done
                      ? "border-white/5 bg-carbon-black/40"
                      : isActive
                        ? "border-terminal-blue/30 bg-terminal-blue/5 motion-safe:animate-pulse-border"
                        : "border-white/5 bg-carbon-black/25"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-terminal-green-light shrink-0 mt-0.5" />
                    ) : (
                      <Circle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isActive ? "text-terminal-blue-light" : "text-slate-600"}`} />
                    )}
                    <div className="min-w-0 flex-1">
                      <span
                        className={`block text-body-sm font-bold leading-snug ${
                          done ? "text-slate-500 line-through" : isActive ? "text-white" : "text-slate-300"
                        }`}
                      >
                        <span className="font-data text-micro text-slate-500 mr-1">{idx + 1}.</span>
                        {step.label}
                      </span>
                      {!done && (
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-micro text-slate-500 font-sans font-light leading-tight">
                            {step.hint}
                          </span>
                          <button
                            type="button"
                            onClick={() => flashOrientTarget(step.target)}
                            className="shrink-0 inline-flex items-center gap-0.5 text-micro font-bold uppercase tracking-wide text-terminal-blue hover:text-terminal-blue-light cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 rounded px-1"
                          >
                            Show me <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
