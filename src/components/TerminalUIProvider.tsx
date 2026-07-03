"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

export type ToastVariant = "success" | "error" | "info";

/**
 * Desk-orientation checklist step ids (VAT-16). Each auto-completes from
 * existing terminal state; progress is persisted to localStorage.
 */
export type ChecklistStepId =
  | "context"
  | "select"
  | "trial"
  | "replay"
  | "reprice"
  | "settlement";

export const CHECKLIST_STEP_IDS: ChecklistStepId[] = [
  "context",
  "select",
  "trial",
  "replay",
  "reprice",
  "settlement",
];

/** data-orient-target values used to highlight a region when a step is clicked. */
export type OrientTarget = "left-rail" | "chain" | "desk" | "playback" | "commentary";

export interface Toast {
  id: number;
  variant: ToastVariant;
  title: string;
  message?: string;
}

export type BackingSide = "YES" | "NO";

/**
 * Mobile bottom-sheet channels (<768). One sheet is open at a time.
 * - ticket: OrderTicket for the selected contract
 * - nav: portfolio snapshot + open positions (opened from the NAV chip)
 * - more: secondary workspace menu (opened from the MobileTabBar "More")
 * - commentary: recent wire commentary (opened from the ticker chip)
 */
export type MobileSheetKind = null | "ticket" | "nav" | "more" | "commentary";

interface TerminalUIState {
  // Contextual contract selection (lifted out of MarketTab / ChampionshipTab)
  selectedContractId: string;
  setSelectedContractId: (id: string) => void;

  backingSide: BackingSide;
  setBackingSide: (side: BackingSide) => void;

  // Toast queue
  toasts: Toast[];
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;

  // Rail drawers (Wave B): LeftRail (race story) <1280, DeskPanel (desk) 768-1023
  leftDrawerOpen: boolean;
  setLeftDrawerOpen: (v: boolean) => void;
  rightDrawerOpen: boolean;
  setRightDrawerOpen: (v: boolean) => void;

  // Legacy boolean kept for API compatibility; mobile sheets use activeSheet.
  sheetOpen: boolean;
  setSheetOpen: (v: boolean) => void;

  // Mobile bottom sheet channel (<768)
  activeSheet: MobileSheetKind;
  setActiveSheet: (s: MobileSheetKind) => void;

  // Desk-orientation checklist (VAT-16)
  checklistDone: Record<ChecklistStepId, boolean>;
  markChecklistStep: (id: ChecklistStepId) => void;
  checklistDismissed: boolean;
  setChecklistDismissed: (v: boolean) => void;
  checklistExpanded: boolean;
  setChecklistExpanded: (v: boolean) => void;
  /** Region currently highlighted by a checklist "show me" click (auto-clears). */
  orientHighlight: OrientTarget | null;
  flashOrientTarget: (target: OrientTarget) => void;
}

const TerminalUIContext = createContext<TerminalUIState | null>(null);

const TOAST_TTL = 8000;

const CHECKLIST_STORAGE_KEY = "apexgp_orientation_progress";
const CHECKLIST_DISMISS_KEY = "apexgp_orientation_dismissed";

const EMPTY_CHECKLIST: Record<ChecklistStepId, boolean> = {
  context: false,
  select: false,
  trial: false,
  replay: false,
  reprice: false,
  settlement: false,
};

export function TerminalUIProvider({ children }: { children: React.ReactNode }) {
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [backingSide, setBackingSide] = useState<BackingSide>("YES");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [leftDrawerOpen, setLeftDrawerOpen] = useState<boolean>(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState<boolean>(false);
  const [sheetOpen, setSheetOpen] = useState<boolean>(false);
  const [activeSheet, setActiveSheet] = useState<MobileSheetKind>(null);

  // Desk-orientation checklist state (hydrated post-mount from localStorage).
  const [checklistDone, setChecklistDone] = useState<Record<ChecklistStepId, boolean>>(EMPTY_CHECKLIST);
  const [checklistDismissed, setChecklistDismissedState] = useState<boolean>(false);
  // Expanded by default: users who opted out on the landing screen never see
  // it (dismissed hydrates true); users who opted in get the open checklist.
  const [checklistExpanded, setChecklistExpanded] = useState<boolean>(true);
  const [orientHighlight, setOrientHighlight] = useState<OrientTarget | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydration-safe progress read: must run post-mount, off the render path.
  useEffect(() => {
    try {
      const rawProgress = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (rawProgress) {
        const parsed = JSON.parse(rawProgress) as Partial<Record<ChecklistStepId, boolean>>;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setChecklistDone((prev) => ({ ...prev, ...parsed }));
      }
      if (localStorage.getItem(CHECKLIST_DISMISS_KEY) === "true") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setChecklistDismissedState(true);
      }
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const markChecklistStep = useCallback((id: ChecklistStepId) => {
    setChecklistDone((prev) => {
      if (prev[id]) return prev;
      const next = { ...prev, [id]: true };
      try {
        localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const setChecklistDismissed = useCallback((v: boolean) => {
    setChecklistDismissedState(v);
    try {
      localStorage.setItem(CHECKLIST_DISMISS_KEY, v ? "true" : "false");
    } catch {
      /* ignore */
    }
  }, []);

  const flashOrientTarget = useCallback((target: OrientTarget) => {
    setOrientHighlight(target);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setOrientHighlight(null), 2600);
  }, []);

  const nextId = useRef<number>(1);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => dismissToast(id), TOAST_TTL);
    },
    [dismissToast]
  );

  const value: TerminalUIState = {
    selectedContractId,
    setSelectedContractId,
    backingSide,
    setBackingSide,
    toasts,
    pushToast,
    dismissToast,
    leftDrawerOpen,
    setLeftDrawerOpen,
    rightDrawerOpen,
    setRightDrawerOpen,
    sheetOpen,
    setSheetOpen,
    activeSheet,
    setActiveSheet,
    checklistDone,
    markChecklistStep,
    checklistDismissed,
    setChecklistDismissed,
    checklistExpanded,
    setChecklistExpanded,
    orientHighlight,
    flashOrientTarget,
  };

  return <TerminalUIContext.Provider value={value}>{children}</TerminalUIContext.Provider>;
}

export function useTerminalUI(): TerminalUIState {
  const ctx = useContext(TerminalUIContext);
  if (!ctx) {
    throw new Error("useTerminalUI must be used within a TerminalUIProvider");
  }
  return ctx;
}
