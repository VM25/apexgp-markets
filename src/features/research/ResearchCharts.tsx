"use client";

import { useMemo, useState } from "react";
import { Ladder } from "@/charts/Ladder";
import { LineChart } from "@/charts/LineChart";
import type { ContractKind } from "@/engine/market/contracts";
import { feeCents, matchLadder } from "@/engine/market/execution";
import { quote } from "@/engine/market/quote";
import type { ModelFile, TrackStatus } from "@/engine/types";
import { useWidth } from "@/state/hooks";
import { pct, usd } from "@/ui/format";

export const EVENT_LABEL: Record<string, string> = { win: "Race winner", podium: "Podium", points: "Points finish", nc: "Not classified" };
export const MODEL_LABEL: Record<string, string> = {
  stagewise: "Stage-wise model (shipped)",
  plain_rol: "Plain rank-ordered logit",
  position_table: "Position-frequency table",
  uniform: "Uniform",
};

interface RelBin { lo: number; hi: number; n: number; mean_p: number; freq: number }

/** Reliability diagram: predicted probability against observed frequency, bubble area proportional to sample size. */
export function Reliability({ bins, title }: { bins: RelBin[]; title: string }) {
  const [ref, width] = useWidth<HTMLDivElement>(320);
  const size = Math.min(width, 360);
  const m = { l: 40, r: 10, t: 10, b: 34 };
  const w = size - m.l - m.r;
  const h = size - m.t - m.b;
  const x = (v: number) => m.l + v * w;
  const y = (v: number) => m.t + (1 - v) * h;
  const maxN = Math.max(1, ...bins.map((b) => b.n));
  return (
    <div ref={ref}>
      <svg width={size} height={size} role="img" aria-label={`${title}. ${bins.map((b) => `predicted ${pct(b.mean_p, 0)}, observed ${pct(b.freq, 0)}, ${b.n} cases`).join("; ")}.`}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={x(0)} x2={x(1)} y1={y(t)} y2={y(t)} stroke="var(--color-rule-2)" />
            <line x1={x(t)} x2={x(t)} y1={y(0)} y2={y(1)} stroke="var(--color-rule-2)" />
            <text x={m.l - 6} y={y(t) + 4} textAnchor="end" className="num" fontSize="11" fill="var(--color-ink-3)">{t * 100}%</text>
            <text x={x(t)} y={size - 16} textAnchor="middle" className="num" fontSize="11" fill="var(--color-ink-3)">{t * 100}%</text>
          </g>
        ))}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--color-ink)" strokeDasharray="3 3" />
        <polyline points={bins.map((b) => `${x(b.mean_p)},${y(b.freq)}`).join(" ")} fill="none" stroke="var(--color-model)" strokeWidth="1.5" />
        {bins.map((b) => (
          <circle key={b.lo} cx={x(b.mean_p)} cy={y(b.freq)} r={3 + 7 * Math.sqrt(b.n / maxN)} fill="var(--color-model-soft)" stroke="var(--color-model)" strokeWidth="1.5">
            <title>{`Predicted ${pct(b.mean_p)} · observed ${pct(b.freq)} · n = ${b.n.toLocaleString("en-US")}`}</title>
          </circle>
        ))}
        <text x={x(0.5)} y={size - 2} textAnchor="middle" className="num" fontSize="10.5" fill="var(--color-ink-3)" letterSpacing="0.08em">MODEL PROBABILITY</text>
      </svg>
      <table className="tsheet mt-2 !text-[12.5px]">
        <thead><tr><th>Predicted</th><th className="r">Observed</th><th className="r">Cases</th></tr></thead>
        <tbody>
          {bins.map((b) => (
            <tr key={b.lo}><td className="num !py-1">{pct(b.mean_p)}</td><td className="r num !py-1">{pct(b.freq)}</td><td className="r num !py-1 text-ink-2">{b.n.toLocaleString("en-US")}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FEATURE_TEXT: Record<string, string> = {
  lpos: "log of running position",
  pos: "running position",
  gapl: "gap to the leader (per 30 s)",
  lnpos: "log of pit-adjusted position",
  npos: "pit-adjusted position",
  ngap: "pit-adjusted gap (per 30 s)",
  lead: "net leader’s margin (per 10 s)",
  rate: "seconds per lap needed to catch the net leader",
  pit: "stops made minus the field’s median",
  down: "laps down",
  lgrid: "log of grid slot",
  dform: "driver form",
  tform: "team form",
};

/** How much weight the model puts on one feature as the race progresses, for each stage group. */
export function CoefficientCurves({ model }: { model: ModelFile }) {
  const [feature, setFeature] = useState("npos");
  const fi = model.features.order.indexOf(feature);
  const knots = model.features.knots;
  const steps = 40;
  const series = useMemo(() => {
    const names = ["Winner stage", "Podium stages", "Points stages"];
    const colors = ["var(--color-model)", "var(--color-ink)", "var(--color-ink-3)"];
    return model.order.beta.map((bg, g) => {
      const row = bg[fi];
      const values = Array.from({ length: steps + 1 }, (_, k) => {
        const s = k / steps;
        let j = 0;
        while (j < knots.length - 2 && s > knots[j + 1]) j++;
        const w = Math.min(1, Math.max(0, (s - knots[j]) / (knots[j + 1] - knots[j])));
        return row[1 + j] * (1 - w) + row[2 + j] * w;
      });
      return { id: `g${g}`, label: names[g], color: colors[g], values, width: g === 0 ? 2.25 : 1.5, dash: g === 2 ? "4 3" : undefined };
    });
  }, [model, fi, knots]);
  const all = series.flatMap((s) => s.values);
  const lo = Math.min(0, ...all);
  const hi = Math.max(0, ...all);
  const pad = (hi - lo) * 0.1 || 0.5;
  const pre = model.order.beta.map((bg) => bg[fi][0]);
  const inRace = model.features.inRaceOnly.includes(feature);
  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-2">
        <div className="min-w-0 max-w-full">
          <label htmlFor="coef-feature" className="eyebrow block mb-1">Feature</label>
          <select id="coef-feature" className="field !min-h-[40px] !text-[14px] !font-sans sm:!w-auto max-w-full pr-8" value={feature} onChange={(e) => setFeature(e.target.value)}>
            {model.features.order.map((f) => <option key={f} value={f}>{f} — {FEATURE_TEXT[f] ?? f}</option>)}
          </select>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] pb-1">
          {series.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5"><svg width="18" height="6" aria-hidden="true"><line x1="0" x2="18" y1="3" y2="3" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash} /></svg>{s.label}</li>
          ))}
        </ul>
      </div>
      <LineChart
        title={`Fitted coefficient of ${feature} over race progress, by stage group`}
        series={series}
        xMax={steps}
        xFormat={(i) => `${Math.round((i / steps) * 100)}%`}
        xTitle="Race distance completed"
        yDomain={[lo - pad, hi + pad]}
        yTicks={[lo - pad, 0, hi + pad]}
        yFormat={(v) => v.toFixed(2)}
        baseline={0}
        height={230}
      />
      <p className="text-[13px] text-ink-2 mt-2">
        {inRace ? "This feature does not exist before the start, so it has no pre-race coefficient." : <>Pre-race coefficients (grid frame): <span className="num">{pre.map((v) => v.toFixed(2)).join(" / ")}</span> for the winner / podium / points stages.</>} A negative coefficient means a larger value of the feature lowers a car’s strength at that stage.
      </p>
    </div>
  );
}

const KINDS: { v: ContractKind; l: string }[] = [
  { v: "WIN", l: "Race winner" }, { v: "POD", l: "Podium" }, { v: "PTS", l: "Points" }, { v: "DNF", l: "Not classified" }, { v: "H2H", l: "Head-to-head" }, { v: "WDC", l: "Drivers’ title" },
];
const STATUSES: TrackStatus[] = ["GREEN", "YELLOW", "VSC", "SC", "RED"];

/** The dealer model, live: the same `quote` and `matchLadder` functions the trading engine calls. */
export function QuoteLab() {
  const [fair, setFair] = useState(42);
  const [lapsLeft, setLapsLeft] = useState(30);
  const [status, setStatus] = useState<TrackStatus>("GREEN");
  const [inv, setInv] = useState(0);
  const [recent, setRecent] = useState(2);
  const [kind, setKind] = useState<ContractKind>("WIN");
  const [size, setSize] = useState(2000);
  const total = 60;
  const frame = Math.max(1, total - 1 - lapsLeft);
  const q = quote(fair / 100, { inv, usedBid: 0, usedAsk: 0, variance: (recent / 100) ** 2, lastFair: fair / 100 }, { kind, status, frame, totalFrames: total });
  const m = matchLadder(q, 1, size, null);
  const c = q.components;
  const parts = [
    { k: "Floor", v: c.floor, note: "order processing" },
    { k: "Price level", v: c.curvature, note: "∝ √(p(1−p))" },
    { k: "Adverse selection", v: c.adverse, note: `σ × ${c.infoMult.toFixed(1)} for ${status === "GREEN" ? "green running" : status.toLowerCase()}` },
  ];
  const sum = parts.reduce((a, p) => a + p.v, 0) || 1;
  const slider = (id: string, label: string, value: number, min: number, max: number, step: number, set: (v: number) => void, fmt: (v: number) => string) => (
    <div>
      <div className="flex justify-between text-[13px] mb-0.5"><label htmlFor={id} className="font-medium">{label}</label><span className="num">{fmt(value)}</span></div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} className="w-full h-8 accent-[var(--color-ink)]" />
    </div>
  );
  return (
    <div className="sheet !border-ink border-2 p-4 sm:p-5 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6">
      <div className="grid gap-3 content-start">
        <p className="display text-[13px]">Quote lab</p>
        {slider("ql-fair", "Model fair value", fair, 1, 99, 1, setFair, (v) => `${v}%`)}
        {slider("ql-laps", "Laps left in the race", lapsLeft, 1, 58, 1, setLapsLeft, (v) => String(v))}
        {slider("ql-recent", "Recent move per lap", recent, 0, 12, 0.5, setRecent, (v) => `${v.toFixed(1)} pts`)}
        {slider("ql-inv", "Dealer inventory (YES contracts)", inv, -6000, 6000, 250, setInv, (v) => (v > 0 ? `long ${v.toLocaleString("en-US")}` : v < 0 ? `short ${Math.abs(v).toLocaleString("en-US")}` : "flat"))}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ql-status" className="eyebrow block mb-1">Track status</label>
            <select id="ql-status" className="field !min-h-[40px] !text-[14px] !font-sans" value={status} onChange={(e) => setStatus(e.target.value as TrackStatus)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s === "GREEN" ? "Green" : s === "SC" ? "Safety car" : s === "VSC" ? "Virtual safety car" : s === "RED" ? "Red flag" : "Yellow"}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ql-kind" className="eyebrow block mb-1">Market</label>
            <select id="ql-kind" className="field !min-h-[40px] !text-[14px] !font-sans" value={kind} onChange={(e) => setKind(e.target.value as ContractKind)}>
              {KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
            </select>
          </div>
        </div>
        {q.state === "open" && (
          <div className="border-t border-rule pt-3">
            <p className="eyebrow mb-1.5">Half-spread = {(q.halfSpread * 100).toFixed(2)}¢</p>
            <div className="flex h-5 border border-ink" role="img" aria-label={parts.map((p) => `${p.k} ${(p.v * 100).toFixed(2)} cents`).join(", ")}>
              {parts.map((p, i) => <div key={p.k} style={{ width: `${(p.v / sum) * 100}%`, background: ["var(--color-paper-3)", "var(--color-ink-3)", "var(--color-ink)"][i] }} />)}
            </div>
            <ul className="grid gap-0.5 mt-2 text-[13px]">
              {parts.map((p, i) => (
                <li key={p.k} className="flex items-baseline gap-2">
                  <span className="w-3 h-3 shrink-0 border border-ink translate-y-[1px]" style={{ background: ["var(--color-paper-3)", "var(--color-ink-3)", "var(--color-ink)"][i] }} />
                  <span className="font-medium">{p.k}</span>
                  <span className="text-ink-3 truncate">{p.note}</span>
                  <span className="num ml-auto shrink-0">{(p.v * 100).toFixed(2)}¢</span>
                </li>
              ))}
              <li className="flex items-baseline gap-2 border-t border-rule-2 pt-1 mt-0.5">
                <span className="font-medium">Reservation price</span>
                <span className="text-ink-3 truncate">fair {c.skew >= 0 ? "+" : "−"} inventory skew</span>
                <span className="num ml-auto shrink-0">{(q.reservation * 100).toFixed(2)}¢</span>
              </li>
            </ul>
          </div>
        )}
      </div>
      <div className="grid gap-3 content-start min-w-0">
        <Ladder quote={q} side="YES" />
        {q.state === "open" && (
          <div className="border-t border-rule pt-3">
            {slider("ql-size", "Market order: buy YES", size, 100, 20000, 100, setSize, (v) => `${v.toLocaleString("en-US")} contracts`)}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13.5px] mt-1">
              <div className="flex justify-between"><dt className="text-ink-2">Filled</dt><dd className="num">{m.filled.toLocaleString("en-US")}{m.remaining > 0 ? ` of ${size.toLocaleString("en-US")}` : ""}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-2">Average price</dt><dd className="num">{m.filled ? `${m.avgPrice.toFixed(2)}¢` : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-2">vs best ask</dt><dd className="num">{m.filled && q.bestAsk !== null ? `+${(m.avgPrice - q.bestAsk).toFixed(2)}¢` : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-2">vs model</dt><dd className="num">{m.filled ? `+${(m.avgPrice - fair).toFixed(2)}¢` : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-2">Fee</dt><dd className="num">{usd(m.fee)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-2">Resting fee instead</dt><dd className="num">{m.filled ? usd(feeCents(m.filled, Math.round(m.avgPrice), "maker")) : "—"}</dd></div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
