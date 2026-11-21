"use client";

import type { RaceLens } from "@/engine/session/lens";
import { loadCircuit } from "@/state/data";
import { useData, useWidth } from "@/state/hooks";
import { teamColor } from "@/ui/format";

/**
 * Gap map: the circuit outline with each car placed by its time gap behind the leader along one
 * reference lap. It is a picture of the timing screen, not GPS: positions are exact at the line
 * and interpolated in between.
 */
export function GapMap({ lens, frame, highlight }: { lens: RaceLens; frame: number; highlight: Set<number> }) {
  const race = lens.race;
  const { data, error } = useData(() => loadCircuit(race.circuit.id), race.circuit.id);
  const [ref, width] = useWidth<HTMLDivElement>(360);
  const size = Math.min(width, 520);
  const pad = 26;
  const f = race.frames;
  const n = Math.min(frame, f.n - 1);
  if (error) return <p className="text-[13px] text-ink-3 border border-dashed border-rule p-4">No circuit trace is available for this round. The timing tower carries the same information.</p>;
  const pts = data?.points ?? [];
  const P = (k: number) => {
    const p = pts[((k % pts.length) + pts.length) % pts.length];
    return [pad + p[0] * (size - 2 * pad), pad + p[1] * (size - 2 * pad)] as const;
  };
  const path = pts.length ? `M${pts.map((_, k) => P(k).map((v) => v.toFixed(1)).join(",")).join("L")}Z` : "";
  const leader = f.pos[n].indexOf(1);
  const lapTime = (leader >= 0 ? f.lastLap[n][leader] : null) ?? data?.lapSeconds ?? 90;
  const cars = race.drivers
    .map((d, i) => {
      if (pts.length < 2 || f.stopped[n][i]) return null;
      const frac = n === 0 ? 1 - race.startRank[i] * 0.006 : (((1 - f.gap[n][i] / lapTime) % 1) + 1) % 1;
      const k = frac * pts.length;
      const a = P(Math.floor(k));
      const b = P(Math.floor(k) + 1);
      const t = k - Math.floor(k);
      return { i, d, x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, pos: f.pos[n][i] };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.pos - a.pos);
  const start = pts.length ? P(0) : [0, 0];
  return (
    <div ref={ref} className="w-full">
      <svg width={size} height={size} className="block mx-auto" role="img" aria-label={`Gap map of ${race.circuit.name}. ${cars.length} cars running. Leader: ${leader >= 0 ? race.drivers[leader].name : "none"}.`}>
        {path ? (
          <>
            <path d={path} fill="none" stroke="var(--color-paper-3)" strokeWidth="13" strokeLinejoin="round" />
            <path d={path} fill="none" stroke="var(--color-ink)" strokeWidth="1.25" strokeLinejoin="round" />
            <g transform={`translate(${start[0]},${start[1]})`}>
              <rect x="-2" y="-9" width="4" height="18" fill="var(--color-ink)" />
            </g>
            {cars.map((c) => {
              const hot = highlight.has(c.i);
              const labelled = c.pos <= 5 || hot;
              return (
                <g key={c.d.id} style={{ transform: `translate(${c.x}px, ${c.y}px)`, transition: "transform 420ms cubic-bezier(0.3, 0.1, 0.3, 1)" }}>
                  {hot && <circle r="10.5" fill="none" stroke="var(--color-you)" strokeWidth="2" />}
                  <circle r={c.pos === 1 ? 7 : 5.5} fill={teamColor(c.d.color)} stroke="var(--color-ink)" strokeWidth="1.5" />
                  {labelled && (
                    <text y={-11} textAnchor="middle" className="num" fontSize="10.5" fontWeight="600" fill="var(--color-ink)" stroke="var(--color-sheet)" strokeWidth="3" paintOrder="stroke">
                      {c.d.code}
                    </text>
                  )}
                </g>
              );
            })}
          </>
        ) : (
          <rect x={pad} y={pad} width={size - 2 * pad} height={size - 2 * pad} fill="var(--color-paper-2)" />
        )}
      </svg>
      <p className="text-[12px] text-ink-3 text-center mt-1 max-w-[52ch] mx-auto leading-snug">
        Cars are placed by recorded time gap along one reference lap — a view of the timing screen, not GPS. Outline traced from OpenF1 position samples.
      </p>
    </div>
  );
}
