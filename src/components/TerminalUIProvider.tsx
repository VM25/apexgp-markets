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

  // Drawer booleans (defined now; used in Wave B)
  leftDrawerOpen: boolean;
  setLeftDrawerOpen: (v: boolean) => void;
  rightDrawerOpen: boolean;
  setRightDrawerOpen: (v: boolean) => void;
  sheetOpen: boolean;
  setSheetOpen: (v: boolean) => void;
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
