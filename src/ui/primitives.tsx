"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { TrackStatus, TyreCode } from "@/engine/types";
import { teamColor } from "./format";

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 select-none" aria-label="ApexGP Markets">
      {/* The mark: a racing line clipping an apex. */}
      <svg width={compact ? 22 : 26} height={compact ? 22 : 26} viewBox="0 0 26 26" aria-hidden="true">
        <rect x="0.75" y="0.75" width="24.5" height="24.5" fill="var(--color-ink)" />
        <path d="M4 22 C 4 10, 10 4, 22 4" fill="none" stroke="var(--color-paper)" strokeWidth="2.2" strokeLinecap="square" />
        <circle cx="9.6" cy="9.6" r="2.6" fill="var(--color-you)" />
      </svg>
      <span className="display text-[17px] leading-none tracking-[-0.03em]">
        Apex<span className="text-you">GP</span>
      </span>
      {!compact && <span className="eyebrow hidden sm:inline !text-[10.5px] border-l border-rule pl-2 ml-0.5">Markets</span>}
    </span>
  );
}

export function SideChip({ side }: { side: "YES" | "NO" }) {
  return <span className={side === "YES" ? "side-yes" : "side-no"}>{side}</span>;
}

const STATUS_META: Record<TrackStatus, { label: string; color: string; text: string }> = {
  GREEN: { label: "Green", color: "var(--color-flag-green)", text: "#fff" },
  YELLOW: { label: "Yellow", color: "var(--color-flag-yellow)", text: "#14161a" },
  VSC: { label: "Virtual SC", color: "var(--color-flag-yellow)", text: "#14161a" },
  SC: { label: "Safety car", color: "var(--color-flag-sc)", text: "#14161a" },
  RED: { label: "Red flag", color: "var(--color-flag-red)", text: "#fff" },
};

export function StatusFlag({ status, phase, compact = false }: { status: TrackStatus; phase?: "pre" | "live" | "flag" | "settled"; compact?: boolean }) {
  if (phase === "pre") return <span className="tag" style={{ background: "var(--color-sheet)" }}>Grid</span>;
  if (phase === "flag") return <span className="tag" style={{ background: "var(--color-ink)", color: "var(--color-paper)", borderColor: "var(--color-ink)" }}>Chequered flag</span>;
  if (phase === "settled") return <span className="tag" style={{ background: "var(--color-ink)", color: "var(--color-paper)", borderColor: "var(--color-ink)" }}>Settled</span>;
  const m = STATUS_META[status];
  return (
    <span className="tag" style={{ background: m.color, color: m.text, borderColor: "transparent" }}>
      {compact && status === "VSC" ? "VSC" : compact && status === "SC" ? "SC" : m.label}
    </span>
  );
}

export const statusColor = (status: TrackStatus) => STATUS_META[status].color;

const TYRE: Record<TyreCode, { color: string; name: string }> = {
  S: { color: "#d7352b", name: "Soft" },
  M: { color: "#e3b505", name: "Medium" },
  H: { color: "#f7f5ee", name: "Hard" },
  I: { color: "#2e9e58", name: "Intermediate" },
  W: { color: "#2a6fdb", name: "Wet" },
};

export function Tyre({ code, age }: { code: TyreCode | null; age: number | null }) {
  if (!code) return <span className="num text-ink-3 text-[12px]">—</span>;
  const t = TYRE[code];
  return (
    <span className="inline-flex items-center gap-1" title={`${t.name}${age !== null ? `, ${age} laps old` : ""}`}>
      <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full num text-[10px] font-semibold" style={{ border: `2.5px solid ${t.color}`, boxShadow: "0 0 0 1px var(--color-ink)", background: "var(--color-ink)", color: "#fff" }} aria-hidden="true">
        {code}
      </span>
      <span className="sr-only">{t.name} tyre</span>
      {age !== null && <span className="num text-[12px] text-ink-3">{age}</span>}
    </span>
  );
}

export function DriverTag({ code, color, name, dim = false }: { code: string; color: string | null; name?: string; dim?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 min-w-0 ${dim ? "opacity-50" : ""}`}>
      <span className="w-[4px] h-[18px] shrink-0" style={{ background: teamColor(color) }} aria-hidden="true" />
      <span className="num font-semibold text-[13.5px] tracking-wide">{code}</span>
      {name && <span className="truncate text-[13.5px] text-ink-2 hidden sm:inline">{name}</span>}
    </span>
  );
}

export function Stat({ label, value, sub, tone, big = false, info }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string; big?: boolean; info?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="eyebrow flex items-center gap-1">
        <span className="truncate">{label}</span>
        {info && <InfoTip label={label}>{info}</InfoTip>}
      </div>
      <div className={`num font-medium truncate ${big ? "text-[26px] sm:text-[30px] leading-[1.1]" : "text-[18px] leading-tight"} ${tone ?? ""}`}>{value}</div>
      {sub && <div className="text-[12.5px] text-ink-3 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

export function SectionHead({ idx, title, children, id }: { idx?: string; title: string; children?: ReactNode; id?: string }) {
  return (
    <div className="section-head mb-3" id={id}>
      {idx && <span className="idx">{idx}</span>}
      <h2 className="display text-[15px] sm:text-[16px] flex-1 min-w-0">{title}</h2>
      {children && <div className="shrink-0 flex items-center gap-2">{children}</div>}
    </div>
  );
}

/**
 * An explanation behind a small "i" button. Opens on click/tap or keyboard — never hover-only —
 * and closes on Escape or an outside press.
 */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex normal-case tracking-normal">
      <button
        type="button"
        aria-label={`About: ${label}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full border border-ink-3 text-ink-3 text-[11px] font-serif italic leading-none hover:bg-ink hover:text-paper hover:border-ink relative after:absolute after:-inset-3 after:content-['']"
      >
        i
      </button>
      {open && (
        <span id={id} role="note" className="absolute z-40 top-[calc(100%+6px)] left-1/2 -translate-x-1/2 w-[min(280px,78vw)] sheet p-3 text-[13px] leading-snug text-ink font-sans shadow-[4px_4px_0_rgb(20_22_26/0.12)]" style={{ animation: "fade 120ms ease-out" }}>
          {children}
        </span>
      )}
    </span>
  );
}

export function Meter({ value, limit, label }: { value: number; limit: number; label: string }) {
  const ratio = limit > 0 ? Math.min(1.2, value / limit) : 0;
  const over = ratio > 1;
  return (
    <div>
      <div className="flex justify-between text-[12px] text-ink-2 mb-1">
        <span>{label}</span>
        <span className={`num ${over ? "loss font-semibold" : ""}`}>{Math.round(ratio * 100)}% of limit</span>
      </div>
      <div className="h-[6px] bg-paper-3 relative" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, ratio) * 100)} aria-label={label}>
        <div className="absolute inset-y-0 left-0" style={{ width: `${Math.min(100, ratio * 100)}%`, background: over ? "var(--color-loss)" : ratio > 0.8 ? "var(--color-flag-sc)" : "var(--color-ink)" }} />
      </div>
    </div>
  );
}

/** The three kinds of number in the product, shown wherever they could be confused. */
export function ProvenanceLegend({ dense = false }: { dense?: boolean }) {
  const items = [
    { swatch: <span className="w-4 h-[3px] bg-ink inline-block" />, name: "Recorded", text: "what happened in the race, from the official timing record" },
    { swatch: <span className="w-4 h-[3px] bg-model inline-block" />, name: "Estimated", text: "a model's probability, built only from what was known at that lap" },
    { swatch: <span className="w-4 h-[9px] bg-ink/15 border-y border-ink/40 inline-block" />, name: "Simulated", text: "a dealer's quote that never existed on any real exchange" },
    { swatch: <span className="w-0 h-0 border-x-[5px] border-x-transparent border-b-[9px] border-b-you inline-block" />, name: "Yours", text: "your own orders and fills in this session" },
  ];
  return (
    <ul className={`grid gap-x-5 gap-y-1.5 ${dense ? "grid-cols-2 sm:grid-cols-4" : "sm:grid-cols-2"}`}>
      {items.map((it) => (
        <li key={it.name} className="flex items-baseline gap-2 text-[13px] leading-snug">
          <span className="shrink-0 w-4 flex justify-center translate-y-[-2px]" aria-hidden="true">{it.swatch}</span>
          <span>
            <span className="font-semibold">{it.name}</span>
            {!dense && <span className="text-ink-2"> — {it.text}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border border-dashed border-rule px-4 py-6 text-center">
      <p className="font-semibold text-[14.5px]">{title}</p>
      {children && <div className="text-[13.5px] text-ink-2 mt-1 max-w-[46ch] mx-auto">{children}</div>}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-2" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-9 bg-paper-2" style={{ opacity: 1 - i * 0.14 }} />
      ))}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="border-l-[3px] border-loss bg-sheet border-y border-r border-rule p-4">
      <p className="font-semibold">That didn’t load.</p>
      <p className="text-[14px] text-ink-2 mt-1">{message}</p>
      {onRetry && <button className="btn btn-sm mt-3" onClick={onRetry}>Try again</button>}
    </div>
  );
}

/** Modal dialog built on the native <dialog> element: focus is trapped and Escape closes it. */
export function Dialog({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`app-dialog ${wide ? "wide" : ""}`}
    >
      {open && (
        <div className="flex flex-col max-h-[inherit]">
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 h-[52px] border-b-2 border-ink shrink-0 bg-sheet sticky top-0 z-10">
            <h2 className="display text-[14px] truncate">{title}</h2>
            <button type="button" className="btn btn-sm btn-ghost !px-2 -mr-2" onClick={onClose} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2" /></svg>
            </button>
          </div>
          <div className="overflow-y-auto overscroll-contain scroll-thin">{children}</div>
        </div>
      )}
    </dialog>
  );
}
