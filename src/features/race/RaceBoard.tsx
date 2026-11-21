"use client";

import { useMemo, useState } from "react";
import { LineChart, type Series } from "@/charts/LineChart";
import type { RaceLens } from "@/engine/session/lens";
import type { TradingSession } from "@/engine/session/session";
import { useApp } from "@/state/hooks";
import { gapText, pct, qty, teamColor } from "@/ui/format";
import { SideChip, Tyre } from "@/ui/primitives";

const EVENT_TAG: Record<string, { label: string; cls: string }> = {
  SC: { label: "Safety car", cls: "!bg-flag-sc !text-ink !border-transparent" },
  VSC: { label: "Virtual SC", cls: "!bg-flag-yellow !text-ink !border-transparent" },
  SC_END: { label: "SC ending", cls: "" },
  VSC_END: { label: "VSC ending", cls: "" },
  RED: { label: "Red flag", cls: "!bg-flag-red !text-white !border-transparent" },
  FLAG: { label: "Flag", cls: "!bg-ink !text-paper !border-ink" },
  PENALTY: { label: "Stewards", cls: "" },
  INCIDENT: { label: "Incident", cls: "" },
  WEATHER: { label: "Weather", cls: "" },
  LEAD: { label: "Lead", cls: "" },
  PIT: { label: "Pit", cls: "" },
  OUT: { label: "Stopped", cls: "!border-loss !text-loss" },
  BACK: { label: "Running", cls: "" },
  FASTEST: { label: "Fastest lap", cls: "" },
};

/** The timing tower: recorded order, gaps, tyres and stops, with the model's win estimate alongside. */
export function TimingTower({ lens, frame, session, onTrade }: { lens: RaceLens; frame: number; session: TradingSession | null; onTrade?: (driverIndex: number) => void }) {
  const race = lens.race;
  const f = race.frames;
  const n = Math.min(frame, f.n - 1);
  const summary = lens.summaryAt(n);
  const order = race.drivers.map((_, i) => i).sort((a, b) => f.pos[n][a] - f.pos[n][b]);
  const held = (i: number) => {
    if (!session) return null;
    const id = race.drivers[i].id;
    const ps = session.positions().filter((p) => {
      const c = session.contract(p.contractId);
      return c && c.scope === "race" && (c.subject === id || c.versus === id);
    });
    return ps.length ? ps : null;
  };
  return (
    <table className="tsheet">
      <caption className="sr-only">Timing tower after lap {n}: recorded positions, gaps, tyres and pit stops, with the model’s win estimate.</caption>
      <thead>
        <tr>
          <th scope="col" className="w-8">P</th>
          <th scope="col">Driver</th>
          <th scope="col" className="r">Gap</th>
          <th scope="col" className="hidden sm:table-cell">Tyre</th>
          <th scope="col" className="r hidden sm:table-cell">Stops</th>
          <th scope="col" className="r"><span className="text-model">Win</span></th>
          <th scope="col" className="r hidden md:table-cell lg:hidden 2xl:table-cell"><span className="text-model">Podium</span></th>
          {onTrade && <th scope="col" className="r w-[72px]"><span className="sr-only">Trade</span></th>}
        </tr>
      </thead>
      <tbody>
        {order.map((i) => {
          const d = race.drivers[i];
          const out = f.stopped[n][i] === 1;
          const h = held(i);
          return (
            <tr key={d.id} className={out ? "text-ink-3" : ""}>
              <td className="num font-semibold">{out ? "—" : n === 0 ? race.startRank[i] : f.pos[n][i]}</td>
              <td className="fill">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-[4px] h-5 shrink-0" style={{ background: teamColor(d.color), opacity: out ? 0.35 : 1 }} />
                  <span className="num font-semibold text-[13px]">{d.code}</span>
                  <span className="truncate text-[13.5px] hidden xs:inline">{d.name.split(" ").slice(-1)[0]}</span>
                  {h && <span className="inline-flex gap-0.5 shrink-0" title="You hold contracts on this driver">{h.slice(0, 2).map((p) => <SideChip key={p.contractId} side={p.q > 0 ? "YES" : "NO"} />)}</span>}
                </span>
              </td>
              <td className="r num text-[13px] whitespace-nowrap">{out ? "Out" : n === 0 ? `Grid ${race.grid[i] || "PL"}` : gapText(f.gap[n][i], f.down[n][i])}</td>
              <td className="hidden sm:table-cell">{out ? null : <Tyre code={f.tyre[n][i]} age={f.tyreAge[n][i]} />}</td>
              <td className="r num hidden sm:table-cell">{f.pits[n][i]}</td>
              <td className="r">
                <span className="inline-flex items-center gap-2 justify-end">
                  <span className="hidden xs:block w-10 h-[5px] bg-paper-3 relative" aria-hidden="true"><span className="absolute inset-y-0 left-0 bg-model" style={{ width: `${Math.min(100, summary.win[i] * 100)}%` }} /></span>
                  <span className="num text-model font-medium w-[46px] text-right">{pct(summary.win[i])}</span>
                </span>
              </td>
              <td className="r num text-ink-2 hidden md:table-cell lg:hidden 2xl:table-cell">{pct(summary.podium[i])}</td>
              {onTrade && (
                <td className="r !py-1">
                  <button className="btn btn-sm btn-quiet !min-h-[34px] !px-2.5" onClick={() => onTrade(i)} aria-label={`Trade ${d.name}`} disabled={out}>Trade</button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Win (or podium) estimates of the main contenders over the race so far. */
export function ContenderChart({ lens, frame, height = 240 }: { lens: RaceLens; frame: number; height?: number }) {
  const [metric, setMetric] = useState<"win" | "podium">("win");
  const race = lens.race;
  const n = Math.min(frame, lens.totalFrames - 1);
  const series = useMemo(() => {
    const D = race.drivers.length;
    const paths: number[][] = Array.from({ length: D }, () => []);
    for (let k = 0; k <= n; k++) {
      const sm = lens.summaryAt(k);
      for (let i = 0; i < D; i++) paths[i].push(sm[metric][i]);
    }
    const peak = paths.map((p, i) => ({ i, peak: Math.max(...p), last: p[p.length - 1] }));
    const chosen = peak.filter((p) => p.peak >= (metric === "win" ? 0.06 : 0.25)).sort((a, b) => b.last - a.last || b.peak - a.peak).slice(0, 7);
    const seenTeam = new Map<string, number>();
    return chosen.map(({ i }): Series => {
      const d = race.drivers[i];
      const k = seenTeam.get(d.team) ?? 0;
      seenTeam.set(d.team, k + 1);
      return { id: d.id, label: d.code, color: teamColor(d.color), values: paths[i], width: 2, dash: k > 0 ? "5 3" : undefined };
    });
  }, [lens, n, metric, race]);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <p className="eyebrow"><span className="text-model">Estimated</span> · {metric === "win" ? "win" : "podium"} probability by lap</p>
        <div className="seg" role="group" aria-label="Metric">
          <button className="!min-h-[32px] !px-2.5" aria-pressed={metric === "win"} onClick={() => setMetric("win")}>Win</button>
          <button className="!min-h-[32px] !px-2.5" aria-pressed={metric === "podium"} onClick={() => setMetric("podium")}>Podium</button>
        </div>
      </div>
      <LineChart title={`Model-estimated ${metric} probability of the leading contenders by lap`} series={series} status={race.frames.status.slice(0, n + 1)} cursor={n} xMax={lens.totalFrames - 1} xTitle="Lap" height={height} />
      <ul className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
        {series.map((sr) => (
          <li key={sr.id} className="flex items-center gap-1.5 text-[12.5px]">
            <svg width="18" height="6" aria-hidden="true"><line x1="0" x2="18" y1="3" y2="3" stroke={sr.color} strokeWidth="3" strokeDasharray={sr.dash} /></svg>
            <span className="num font-medium">{sr.label}</span>
            <span className="num text-ink-3">{pct(sr.values[sr.values.length - 1] ?? 0, 0)}</span>
          </li>
        ))}
        <li className="flex items-center gap-1.5 text-[12.5px] text-ink-3"><span className="w-3 h-3 inline-block" style={{ background: "rgb(217 122 0 / 0.3)" }} />safety car</li>
      </ul>
    </div>
  );
}

/** Race-control messages and timing events (recorded), interleaved with the model's biggest repricing each lap. */
export function EventFeed({ lens, frame, limit = 60 }: { lens: RaceLens; frame: number; limit?: number }) {
  const race = lens.race;
  const n = Math.min(frame, lens.totalFrames - 1);
  const items = useMemo(() => {
    const out: { lap: number; kind: "rec" | "est"; type: string; text: string }[] = [];
    for (let k = n; k >= 1 && out.length < limit; k--) {
      const a = lens.summaryAt(k).win;
      const b = lens.summaryAt(k - 1).win;
      let best = -1;
      let bestD = 0;
      for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > Math.abs(bestD)) { bestD = a[i] - b[i]; best = i; }
      if (best >= 0 && Math.abs(bestD) >= 0.06) {
        out.push({ lap: k, kind: "est", type: "MODEL", text: `${race.drivers[best].code} win estimate ${pct(b[best], 0)} → ${pct(a[best], 0)}` });
      }
      for (const e of [...race.frames.events[k]].reverse()) {
        if (e.type === "FASTEST") continue;
        out.push({ lap: k, kind: "rec", type: e.type, text: e.text });
      }
    }
    return out.slice(0, limit);
  }, [lens, n, limit, race]);
  if (n === 0) return <p className="text-[13.5px] text-ink-2 border border-dashed border-rule p-4">The race has not started. Press play, or step one lap at a time, and events will appear here as they were recorded.</p>;
  if (items.length === 0) return <p className="text-[13.5px] text-ink-2">A quiet race so far: no race-control events, stops or lead changes.</p>;
  return (
    <ol className="grid" aria-label="Race events, newest first">
      {items.map((it, k) => {
        const meta = EVENT_TAG[it.type];
        return (
          <li key={k} className="grid grid-cols-[38px_auto_1fr] gap-2 items-baseline py-1.5 border-b border-rule-2 text-[13px] leading-snug">
            <span className="num text-ink-3 text-[12px]">L{it.lap}</span>
            {it.kind === "est" ? <span className="tag !border-model !text-model">Model</span> : <span className={`tag ${meta?.cls ?? ""}`}>{meta?.label ?? it.type}</span>}
            <span className={it.kind === "est" ? "text-model" : ""}>{it.kind === "est" ? it.text : sentence(it.text)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function sentence(text: string): string {
  if (text !== text.toUpperCase()) return text;
  const lower = text.toLowerCase().replace(/\bfia\b/g, "FIA").replace(/\bcar (\d+) \(([a-z]{3})\)/g, (_, num: string, code: string) => `car ${num} (${code.toUpperCase()})`);
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Positions the account holds in this race, with a one-tap close. */
export function RacePositions() {
  const app = useApp();
  const s = app.session!;
  const rows = s.positions().map((p) => ({ p, c: s.contract(p.contractId) })).filter((r) => r.c);
  if (rows.length === 0) return <p className="text-[13.5px] text-ink-2 border border-dashed border-rule p-3">No open positions. Tap <b>Trade</b> on any driver to open one.</p>;
  return (
    <ul className="grid">
      {rows.map(({ p, c }) => {
        const side = p.q > 0 ? "YES" : "NO";
        const mark = s.mark(p.contractId);
        const value = p.q > 0 ? p.q * mark * 100 : -p.q * (1 - mark) * 100;
        const pnl = value - p.basis;
        return (
          <li key={p.contractId} className="flex items-center gap-2 py-2 border-b border-rule-2 text-[13px]">
            <SideChip side={side} />
            <span className="num w-12 text-right shrink-0">{qty(Math.abs(p.q))}</span>
            <span className="truncate flex-1 min-w-0">{c!.title}</span>
            <span className={`num shrink-0 ${pnl > 0.5 ? "gain" : pnl < -0.5 ? "loss" : ""}`}>{pnl >= 0 ? "+" : "−"}${(Math.abs(pnl) / 100).toFixed(2)}</span>
            <button className="btn btn-sm btn-quiet !min-h-[32px] !px-2" onClick={() => app.openTicket(p.contractId, side, "SELL")} disabled={!s.isTradable(c!)}>Close</button>
          </li>
        );
      })}
    </ul>
  );
}
