"use client";

import type { Frames } from "@/engine/types";
import { useWidth } from "@/state/hooks";

interface Mark {
  frame: number;
  kind: "buy" | "sell";
}

/**
 * The lap ruler: one tick per lap, track-status bands, notable events and the clock cursor.
 * It is the shared time axis of the product — the clock strip, the replay and the charts all read against it.
 */
export function LapRuler({ frames, frame, height = 34, marks = [], onSeek, label = true }: { frames: Frames; frame: number; height?: number; marks?: Mark[]; onSeek?: (frame: number) => void; label?: boolean }) {
  const [ref, width] = useWidth<HTMLDivElement>(300);
  const n = frames.n - 1;
  const padX = 6;
  const w = Math.max(40, width - padX * 2);
  const x = (i: number) => padX + (n > 0 ? (i / n) * w : 0);
  const base = height - (label ? 13 : 3);
  const runs: { from: number; to: number; s: string }[] = [];
  frames.status.forEach((s, i) => {
    if (s === "GREEN") return;
    const last = runs[runs.length - 1];
    if (last && last.s === s && last.to === i - 1) last.to = i;
    else runs.push({ from: i, to: i, s });
  });
  const color: Record<string, string> = { SC: "var(--color-flag-sc)", VSC: "var(--color-flag-yellow)", YELLOW: "var(--color-flag-yellow)", RED: "var(--color-flag-red)" };
  const dense = w / Math.max(1, n) < 4;
  const seek = (clientX: number, el: HTMLElement) => {
    if (!onSeek) return;
    const rect = el.getBoundingClientRect();
    onSeek(Math.round(((clientX - rect.left - padX) / w) * n));
  };
  return (
    <div
      ref={ref}
      className={`w-full ${onSeek ? "cursor-pointer" : ""}`}
      onClick={(e) => seek(e.clientX, e.currentTarget)}
      role="img"
      aria-label={`Lap ${Math.min(frame, n)} of ${n}. Track status ${frames.status[Math.min(frame, n)]}.`}
    >
      <svg width={width} height={height} className="block">
        {runs.map((r, k) => (
          <rect key={k} x={x(Math.max(0, r.from - 0.5))} y={base - 9} width={Math.max(2, x(Math.min(n, r.to + 0.5)) - x(Math.max(0, r.from - 0.5)))} height={9} fill={color[r.s]} opacity={r.from <= frame ? 0.95 : 0} />
        ))}
        <line x1={x(0)} x2={x(n)} y1={base} y2={base} stroke="var(--color-ink)" strokeWidth="1" />
        <line x1={x(0)} x2={x(Math.min(frame, n))} y1={base} y2={base} stroke="var(--color-ink)" strokeWidth="3" />
        {Array.from({ length: n + 1 }, (_, i) => {
          const major = i % 10 === 0 || i === n;
          if (dense && !major && i % 5 !== 0) return null;
          return <line key={i} x1={x(i)} x2={x(i)} y1={base} y2={base - (major ? 8 : i % 5 === 0 ? 5 : 3)} stroke="var(--color-ink)" strokeWidth={major ? 1.25 : 0.75} opacity={i <= frame ? 1 : 0.4} />;
        })}
        {label && Array.from({ length: Math.floor(n / 10) + 1 }, (_, k) => k * 10).filter((i) => i > 0 && n - i > 3).map((i) => (
          <text key={i} x={x(i)} y={height - 1} textAnchor="middle" className="num" fontSize="10" fill="var(--color-ink-3)">{i}</text>
        ))}
        {label && <text x={x(n)} y={height - 1} textAnchor="end" className="num" fontSize="10" fill="var(--color-ink-3)">{n}</text>}
        {marks.map((mk, k) => (
          <path key={k} d={`M${x(mk.frame)},${base - 10}l4,-7h-8z`} fill="var(--color-you)" transform={mk.kind === "sell" ? `rotate(180 ${x(mk.frame)} ${base - 13.5})` : undefined} />
        ))}
        <g style={{ transform: `translateX(${x(Math.min(frame, n))}px)`, transition: "transform 180ms linear" }}>
          <path d={`M-5,${base - 14}h10v6l-5,6l-5,-6z`} fill="var(--color-ink)" />
        </g>
      </svg>
    </div>
  );
}
