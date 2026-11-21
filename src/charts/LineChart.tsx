"use client";

import { useMemo, useState } from "react";
import type { TrackStatus } from "@/engine/types";
import { useWidth } from "@/state/hooks";

export interface Series {
  id: string;
  label: string;
  color: string;
  values: (number | null)[];
  width?: number;
  dash?: string;
  /** Draw as a step line (values hold until the next observation). */
  step?: boolean;
}

export interface Marker {
  x: number;
  y: number;
  kind: "buy" | "sell";
  label: string;
}

interface Props {
  series: Series[];
  /** Last index of the x domain (the chart always spans 0..xMax so the remaining race is visible as empty space). */
  xMax: number;
  height?: number;
  yDomain?: [number, number];
  yFormat?: (v: number) => string;
  xFormat?: (i: number) => string;
  xTitle?: string;
  band?: { lo: (number | null)[]; hi: (number | null)[]; label: string };
  markers?: Marker[];
  status?: TrackStatus[];
  cursor?: number;
  title: string;
  yTicks?: number[];
  /** Vertical separators with labels (used for round boundaries in the NAV chart). */
  dividers?: { x: number; label: string }[];
  baseline?: number;
}

const STATUS_FILL: Partial<Record<TrackStatus, string>> = {
  SC: "rgb(217 122 0 / 0.18)",
  VSC: "rgb(201 151 0 / 0.14)",
  RED: "rgb(184 50 42 / 0.2)",
};

export function LineChart({
  series, xMax, height = 220, yDomain = [0, 1], yFormat = (v) => `${Math.round(v * 100)}%`, xFormat = (i) => String(i), xTitle,
  band, markers = [], status, cursor, title, yTicks, dividers, baseline,
}: Props) {
  const [ref, width] = useWidth<HTMLDivElement>(480);
  const [hover, setHover] = useState<number | null>(null);
  const m = { l: 44, r: 12, t: 10, b: xTitle ? 34 : 24 };
  const w = Math.max(60, width - m.l - m.r);
  const h = height - m.t - m.b;
  const [y0, y1] = yDomain;
  const sx = (i: number) => m.l + (xMax > 0 ? (i / xMax) * w : 0);
  const sy = (v: number) => m.t + (1 - (Math.min(y1, Math.max(y0, v)) - y0) / (y1 - y0 || 1)) * h;
  const ticks = yTicks ?? [0, 0.25, 0.5, 0.75, 1].map((t) => y0 + t * (y1 - y0));
  const xStep = xMax <= 12 ? 1 : xMax <= 30 ? 5 : xMax <= 80 ? 10 : Math.ceil(xMax / 8 / 10) * 10;
  const xTicks = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i <= xMax; i += xStep) out.push(i);
    return out;
  }, [xMax, xStep]);

  const pathFor = (s: Series) => {
    let d = "";
    let pen = false;
    s.values.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) {
        pen = false;
        return;
      }
      const x = sx(i);
      const y = sy(v);
      if (!pen) d += `M${x.toFixed(1)},${y.toFixed(1)}`;
      else if (s.step) d += `H${x.toFixed(1)}V${y.toFixed(1)}`;
      else d += `L${x.toFixed(1)},${y.toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const bandPath = useMemo(() => {
    if (!band) return "";
    const pts: [number, number, number][] = [];
    band.lo.forEach((lo, i) => {
      const hi = band.hi[i];
      if (lo !== null && hi !== null) pts.push([i, lo, hi]);
    });
    if (pts.length < 2) return "";
    return `M${pts.map(([i, , hi]) => `${sx(i).toFixed(1)},${sy(hi).toFixed(1)}`).join("L")}L${pts.reverse().map(([i, lo]) => `${sx(i).toFixed(1)},${sy(lo).toFixed(1)}`).join("L")}Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band, width, xMax, y0, y1, height]);

  const statusRuns = useMemo(() => {
    if (!status) return [];
    const runs: { from: number; to: number; s: TrackStatus }[] = [];
    status.forEach((s, i) => {
      if (!STATUS_FILL[s]) return;
      const last = runs[runs.length - 1];
      if (last && last.s === s && last.to === i - 1) last.to = i;
      else runs.push({ from: i, to: i, s });
    });
    return runs;
  }, [status]);

  const lastIndex = Math.max(0, ...series.map((s) => s.values.length - 1));
  const inspect = hover !== null ? Math.min(hover, lastIndex) : null;
  const onMove = (clientX: number, target: SVGSVGElement) => {
    const rect = target.getBoundingClientRect();
    const i = Math.round(((clientX - rect.left - m.l) / w) * xMax);
    setHover(Math.max(0, Math.min(lastIndex, i)));
  };
  const summary = series.map((s) => {
    const v = [...s.values].reverse().find((x) => x !== null && Number.isFinite(x));
    return `${s.label} ${v === undefined || v === null ? "no data" : yFormat(v)}`;
  }).join("; ");

  return (
    <div ref={ref} className="relative w-full select-none">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${title}. Latest values: ${summary}.`}
        tabIndex={0}
        className="block touch-pan-y outline-offset-0"
        onMouseMove={(e) => onMove(e.clientX, e.currentTarget)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => onMove(e.touches[0].clientX, e.currentTarget)}
        onTouchMove={(e) => onMove(e.touches[0].clientX, e.currentTarget)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); setHover((x) => Math.min(lastIndex, (x ?? cursor ?? lastIndex) + 1)); }
          if (e.key === "ArrowLeft") { e.preventDefault(); setHover((x) => Math.max(0, (x ?? cursor ?? lastIndex) - 1)); }
          if (e.key === "Escape") setHover(null);
        }}
      >
        {statusRuns.map((r, k) => (
          <rect key={k} x={sx(Math.max(0, r.from - 0.5))} y={m.t} width={Math.max(2, sx(Math.min(xMax, r.to + 0.5)) - sx(Math.max(0, r.from - 0.5)))} height={h} fill={STATUS_FILL[r.s]} />
        ))}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={m.l + w} y1={sy(t)} y2={sy(t)} stroke="var(--color-rule-2)" />
            <text x={m.l - 6} y={sy(t) + 4} textAnchor="end" className="num" fontSize="11" fill="var(--color-ink-3)">{yFormat(t)}</text>
          </g>
        ))}
        {baseline !== undefined && <line x1={m.l} x2={m.l + w} y1={sy(baseline)} y2={sy(baseline)} stroke="var(--color-ink)" strokeDasharray="2 3" strokeWidth="1" />}
        <line x1={m.l} x2={m.l + w} y1={m.t + h} y2={m.t + h} stroke="var(--color-ink)" />
        {xTicks.map((i) => (
          <g key={i}>
            <line x1={sx(i)} x2={sx(i)} y1={m.t + h} y2={m.t + h + 4} stroke="var(--color-ink)" />
            <text x={sx(i)} y={m.t + h + 15} textAnchor="middle" className="num" fontSize="11" fill="var(--color-ink-3)">{xFormat(i)}</text>
          </g>
        ))}
        {xTitle && <text x={m.l + w} y={height - 2} textAnchor="end" className="num" fontSize="10.5" fill="var(--color-ink-3)" letterSpacing="0.08em">{xTitle.toUpperCase()}</text>}
        {dividers?.map((d) => (
          <g key={d.x}>
            <line x1={sx(d.x)} x2={sx(d.x)} y1={m.t} y2={m.t + h} stroke="var(--color-rule)" strokeDasharray="1 3" />
            <text x={sx(d.x) + 3} y={m.t + 10} className="num" fontSize="10" fill="var(--color-ink-3)">{d.label}</text>
          </g>
        ))}
        {bandPath && <path d={bandPath} fill="rgb(20 22 26 / 0.1)" stroke="rgb(20 22 26 / 0.3)" strokeWidth="0.75" />}
        {series.map((s) => (
          <path key={s.id} d={pathFor(s)} fill="none" stroke={s.color} strokeWidth={s.width ?? 1.75} strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {cursor !== undefined && cursor <= xMax && (
          <g>
            <line x1={sx(cursor)} x2={sx(cursor)} y1={m.t - 4} y2={m.t + h} stroke="var(--color-ink)" strokeWidth="1" />
            <path d={`M${sx(cursor) - 4},${m.t - 6}h8l-4,6z`} fill="var(--color-ink)" />
          </g>
        )}
        {markers.map((mk, k) => {
          const x = sx(mk.x);
          const y = sy(mk.y);
          return (
            <g key={k}>
              <path d={mk.kind === "buy" ? `M${x},${y - 7}l6,10h-12z` : `M${x},${y + 7}l6,-10h-12z`} fill="var(--color-you)" stroke="var(--color-sheet)" strokeWidth="1.25">
                <title>{mk.label}</title>
              </path>
            </g>
          );
        })}
        {inspect !== null && (
          <g pointerEvents="none">
            <line x1={sx(inspect)} x2={sx(inspect)} y1={m.t} y2={m.t + h} stroke="var(--color-ink-3)" strokeDasharray="3 3" />
            {series.map((s) => {
              const v = s.values[inspect];
              return v === null || v === undefined || !Number.isFinite(v) ? null : <circle key={s.id} cx={sx(inspect)} cy={sy(v)} r="3.5" fill="var(--color-sheet)" stroke={s.color} strokeWidth="2" />;
            })}
          </g>
        )}
      </svg>
      {inspect !== null && (
        <div
          className="absolute z-10 sheet px-2.5 py-2 text-[12.5px] pointer-events-none shadow-[3px_3px_0_rgb(20_22_26/0.12)] min-w-[128px]"
          style={{ top: 4, ...(sx(inspect) > width / 2 ? { right: width - sx(inspect) + 10 } : { left: sx(inspect) + 10 }) }}
          aria-hidden="true"
        >
          <div className="eyebrow !text-[10.5px] mb-1">{xTitle ? `${xTitle} ` : ""}{xFormat(inspect)}</div>
          {band && band.lo[inspect] !== null && band.hi[inspect] !== null && (
            <div className="flex justify-between gap-3"><span className="text-ink-2">{band.label}</span><span className="num">{yFormat(band.lo[inspect]!)}–{yFormat(band.hi[inspect]!)}</span></div>
          )}
          {series.map((s) => {
            const v = s.values[inspect];
            return v === null || v === undefined ? null : (
              <div key={s.id} className="flex justify-between gap-3">
                <span className="flex items-center gap-1.5 min-w-0"><span className="w-2.5 h-[3px] shrink-0" style={{ background: s.color }} /><span className="truncate">{s.label}</span></span>
                <span className="num font-medium">{yFormat(v)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sparkline({ values, width = 72, height = 22, color = "var(--color-model)" }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * (width - 2) + 1).toFixed(1)},${(height - 2 - ((v - lo) / span) * (height - 4)).toFixed(1)}`).join("");
  return (
    <svg width={width} height={height} aria-hidden="true" className="shrink-0">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
