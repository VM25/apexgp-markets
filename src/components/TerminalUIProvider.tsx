"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";

export type ToastVariant = "success" | "error" | "info";

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
}

const TerminalUIContext = createContext<TerminalUIState | null>(null);

const TOAST_TTL = 8000;

export function TerminalUIProvider({ children }: { children: React.ReactNode }) {
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [backingSide, setBackingSide] = useState<BackingSide>("YES");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [leftDrawerOpen, setLeftDrawerOpen] = useState<boolean>(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState<boolean>(false);
  const [sheetOpen, setSheetOpen] = useState<boolean>(false);
  const [activeSheet, setActiveSheet] = useState<MobileSheetKind>(null);

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
