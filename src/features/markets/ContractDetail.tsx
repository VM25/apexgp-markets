"use client";

import { useMemo, useState } from "react";
import { Ladder } from "@/charts/Ladder";
import { LineChart, type Marker } from "@/charts/LineChart";
import { KIND_META, type Contract } from "@/engine/market/contracts";
import { EXPLAIN_BUCKETS, type RaceLens } from "@/engine/session/lens";
import { OrderTicket } from "@/features/ticket/OrderTicket";
import { useApp } from "@/state/hooks";
import { cents, pct } from "@/ui/format";
import { InfoTip } from "@/ui/primitives";

/** What changed for this contract since the previous frame, in the model's own terms. */
export function WhyMoved({ lens, contract, frame }: { lens: RaceLens; contract: Contract; frame: number }) {
  const idx = lens.indexOf.get(contract.id)!;
  if (frame === 0) {
    return <p className="text-[13.5px] text-ink-2">On the grid the estimate rests on the starting slot and on driver and team form from earlier rounds. It starts moving when the race does.</p>;
  }
  const now = lens.fairAt(frame)[idx];
  const prev = lens.fairAt(frame - 1)[idx];
  const d = now - prev;
  const events = lens.race.frames.events[frame] ?? [];
  const mine = events.filter((e) => e.d === contract.index || (contract.versusIndex >= 0 && e.d === contract.versusIndex));
  const global = events.filter((e) => ["SC", "VSC", "RED", "SC_END", "VSC_END"].includes(e.type));
  let terms: { label: string; delta: number }[] = [];
  if (contract.index >= 0 && contract.scope === "race") {
    const a = lens.summaryAt(frame).contrib[contract.index];
    const b = lens.summaryAt(frame - 1).contrib[contract.index];
    terms = EXPLAIN_BUCKETS.map((bk, k) => ({ label: bk.label, delta: a[k] - b[k] })).filter((t) => Math.abs(t.delta) > 0.02).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, 3);
  }
  const flat = Math.abs(d) < 0.002;
  return (
    <div className="text-[13.5px] leading-snug grid gap-1.5">
      <p>
        <span className="num font-semibold">{pct(prev)} → {pct(now)}</span>{" "}
        <span className={`num ${d > 0 ? "gain" : d < 0 ? "loss" : ""}`}>({d >= 0 ? "+" : "−"}{Math.abs(d * 100).toFixed(1)} pts)</span>{" "}
        <span className="text-ink-2">since the previous lap.</span>
      </p>
      {[...mine, ...global].slice(0, 4).map((e, k) => (
        <p key={k} className="flex gap-2"><span className="tag shrink-0">Recorded</span><span>{e.text.charAt(0) + e.text.slice(1).toLowerCase()}</span></p>
      ))}
      {terms.length > 0 && !flat && (
        <ul className="grid gap-0.5">
          {terms.map((t) => (
            <li key={t.label} className="flex items-baseline gap-2">
              <span className={`num w-12 shrink-0 text-right ${t.delta > 0 ? "gain" : "loss"}`}>{t.delta > 0 ? "+" : "−"}{Math.abs(t.delta).toFixed(2)}</span>
              <span className="text-ink-2">{t.label}</span>
            </li>
          ))}
        </ul>
      )}
      {flat && mine.length + global.length === 0 && <p className="text-ink-2">Nothing material changed for this contract on this lap.</p>}
      {terms.length > 0 && !flat && (
        <p className="text-[12px] text-ink-3">Figures are changes in this car’s win-stage strength (log-odds units). Its probability also moves when rivals’ strengths move.</p>
      )}
    </div>
  );
}

export function ContractDetail({ contractId, layout = "wide" }: { contractId: string; layout?: "wide" | "stack" }) {
  const app = useApp();
  const s = app.session!;
  const c = s.contract(contractId);
  const [pick, setPick] = useState<{ price: number; nonce: number } | null>(null);
  const frame = s.state.frame;
  const lens = s.lens;
  const N = lens.totalFrames - 1;

  const chart = useMemo(() => {
    if (!c) return null;
    const path = lens.path(c.id, frame);
    const lo: (number | null)[] = [];
    const hi: (number | null)[] = [];
    for (let k = 0; k <= frame; k++) {
      const q = lens.baseQuote(c.id, k);
      lo.push(q.bestBid !== null ? q.bestBid / 100 : null);
      hi.push(q.bestAsk !== null ? q.bestAsk / 100 : null);
    }
    return { path, lo, hi };
  }, [c, lens, frame]);

  if (!c || !chart) return null;
  const q = s.quoteFor(c.id);
  const fills = s.state.fills.filter((f) => f.contractId === c.id && f.round === s.state.round);
  const markers: Marker[] = fills.map((f) => ({
    x: f.frame, y: f.priceYes / 100,
    kind: (f.side === "YES") === (f.action === "BUY") ? "buy" : "sell",
    label: `${f.action} ${f.qty} ${f.side} @ ${f.price.toFixed(1)}¢`,
  }));
  const side = app.ticket.side;
  const top = Math.max(0.1, Math.min(1, Math.ceil((Math.max(...chart.path, ...chart.hi.map((v) => v ?? 0)) + 0.06) * 10) / 10));
  const spread = q.bestAsk !== null && q.bestBid !== null ? q.bestAsk - q.bestBid : null;

  return (
    <div className="grid gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="tag">{KIND_META[c.kind].label}</span>
          {c.scope === "season" && <span className="tag">Settles after the final round</span>}
          {q.state !== "open" && <span className="tag !bg-ink !text-paper !border-ink">{q.state}</span>}
        </div>
        <h2 className="text-[19px] sm:text-[21px] font-bold leading-tight tracking-[-0.01em]">{c.question}</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 border-y border-rule py-2.5">
        <div>
          <div className="eyebrow flex items-center gap-1">Model estimate <InfoTip label="Model estimate">The probability the forecasting model assigns, using only information available at this lap. It is an estimate, not a price anyone quoted.</InfoTip></div>
          <div className="num text-[22px] text-model font-medium leading-tight">{pct(q.fair)}</div>
        </div>
        <div>
          <div className="eyebrow">Dealer bid / ask</div>
          <div className="num text-[22px] font-medium leading-tight">{cents(q.bestBid)} <span className="text-ink-3">/</span> {cents(q.bestAsk)}</div>
        </div>
        <div>
          <div className="eyebrow flex items-center gap-1">Spread <InfoTip label="Spread">The gap between the dealer’s bid and ask. It widens when the next lap is expected to carry more information — at the start, under a safety car — and when the dealer is carrying inventory from your earlier trades.</InfoTip></div>
          <div className="num text-[18px] leading-tight mt-0.5">{spread !== null ? `${spread}¢` : "—"}</div>
        </div>
        <div>
          <div className="eyebrow">At the best price</div>
          <div className="num text-[18px] leading-tight mt-0.5">{q.asks[0] ? q.asks[0].size.toLocaleString("en-US") : "—"} <span className="text-[12px] text-ink-3">to buy</span></div>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-1">
          <p className="eyebrow">Probability and quote · this race</p>
          <div className="flex items-center gap-3 text-[12px] text-ink-2">
            <span className="flex items-center gap-1.5"><span className="w-4 h-[3px] bg-model" />Model</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-[8px] bg-ink/15 border-y border-ink/40" />Simulated quote</span>
            <span className="flex items-center gap-1.5"><span className="w-0 h-0 border-x-[5px] border-x-transparent border-b-[8px] border-b-you" />Your fills</span>
          </div>
        </div>
        <LineChart
          title={`${c.title}: model estimate and simulated dealer quote by lap`}
          series={[{ id: "model", label: "Model estimate", color: "var(--color-model)", values: chart.path, width: 2 }]}
          band={{ lo: chart.lo, hi: chart.hi, label: "Bid–ask" }}
          markers={markers}
          status={lens.race.frames.status.slice(0, frame + 1)}
          cursor={frame}
          xMax={N}
          xTitle="Lap"
          yDomain={[0, top]}
          yTicks={[0, top / 4, top / 2, (3 * top) / 4, top]}
          height={layout === "wide" ? 230 : 190}
        />
      </div>

      <div className={layout === "wide" ? "grid xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] gap-5" : "grid gap-5"}>
        <div className="grid gap-4 content-start min-w-0 order-2 xl:order-1">
          <section>
            <p className="eyebrow mb-1.5 flex items-center gap-1">
              Order book · {side}
              <InfoTip label="Order book">One simulated dealer quotes every level; there are no other traders. Buying walks up the offers, selling walks down the bids. Tap a price to use it as your limit.</InfoTip>
            </p>
            <Ladder quote={q} side={side} onPick={(price) => setPick({ price, nonce: Date.now() })} />
          </section>
          <section>
            <p className="eyebrow mb-1.5">Why it moved</p>
            <WhyMoved lens={lens} contract={c} frame={frame} />
          </section>
          <section className="text-[13px] text-ink-2 border-l-[3px] border-ink pl-3">
            <p className="eyebrow !text-ink mb-0.5">Settlement rule</p>
            {KIND_META[c.kind].rule} Source of truth: the official classification as published by the FIA, read from Jolpica F1.
          </section>
        </div>
        <section className={`order-1 xl:order-2 ${layout === "wide" ? "xl:border-l xl:border-rule xl:pl-5" : ""}`} aria-label="Trade">
          <p className="eyebrow mb-2">Trade</p>
          <OrderTicket key={c.id} contractId={c.id} limitFromLadder={pick} />
        </section>
      </div>
    </div>
  );
}
