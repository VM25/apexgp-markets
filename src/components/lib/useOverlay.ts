"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface UseOverlayOptions {
  open: boolean;
  onClose: () => void;
}

/**
 * Shared overlay behavior for Drawer / MobileSheet:
 * - Esc closes.
 * - Focus moves into the panel on open and is trapped within it.
 * - Focus returns to the triggering element on close.
 *
 * Body scroll is already locked at the app level (body overflow-hidden), and the
 * dimmed overlay covers the shell, so no extra scroll-lock is required here.
 */
export function useOverlay({ open, onClose }: UseOverlayOptions) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Move focus into the panel (first focusable, else the panel itself).
    const panel = panelRef.current;
    const focusFirst = () => {
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        panel.focus();
      }
    };
    // Defer to allow the enter transition / mount to settle.
    const raf = requestAnimationFrame(focusFirst);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && panel) {
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (focusables.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || !panel.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last || !panel.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKey);
      // Restore focus to the trigger.
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  return panelRef;
}
