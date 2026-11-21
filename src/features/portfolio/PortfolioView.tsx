"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LineChart } from "@/charts/LineChart";
import { RISK_LIMITS } from "@/engine/market/params";
import { byKind, byRace, drawdown, eventStats, executionCosts, settledStats } from "@/engine/portfolio/analytics";
import { lockedCollateral, unrealized } from "@/engine/portfolio/ledger";
import { useApp, useWidth } from "@/state/hooks";
import { pct, qty, signedPct, tone, usd } from "@/ui/format";
import { Empty, InfoTip, Meter, SectionHead, SideChip, Stat } from "@/ui/primitives";

type Tab = "fills" | "settlements" | "audit";

export function PortfolioView() {
  const app = useApp();
  const s = app.session!;
  const st = s.state;
  const [tab, setTab] = useState<Tab>("fills");
  const nav = s.nav();
  const start = st.ledger.startCash;
  const positions = s.positions();
  const unreal = positions.reduce((a, p) => a + unrealized(p, s.mark(p.contractId)), 0);
  const locked = lockedCollateral(st.ledger);
  const risk = useMemo(() => s.risk(), [s, st.frame, st.round, st.fills.length, st.settlements.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const worst = s.worstCase();
  const dd = drawdown(st.navHistory);
  const ev = eventStats(st.races, st.settledRounds);
  const ex = executionCosts(st.fills);
  const ss = settledStats(st.settlements);
  const kinds = byKind(st);
  const races = byRace(st).filter((r) => r.fills + r.settled > 0);

  const navSeries = st.navHistory.map((p) => p.nav / 100);
  const dividers: { x: number; label: string }[] = [];
  st.navHistory.forEach((p, i) => {
    if (i === 0 || st.navHistory[i - 1].round !== p.round) dividers.push({ x: i, label: `R${p.round}` });
  });
  const lo = Math.min(start / 100, ...navSeries);
  const hi = Math.max(start / 100, ...navSeries);
  const padY = Math.max(50, (hi - lo) * 0.15);
  const yDomain: [number, number] = [Math.floor((lo - padY) / 50) * 50, Math.ceil((hi + padY) / 50) * 50];
  const titleOf = (id: string) => s.contract(id)?.title ?? st.titles[id]?.title ?? id;

  const download = () => {
    const blob = new Blob([app.exportSession()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apexgp-session-${st.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-9">
      <header className="rise">
        <p className="eyebrow">Session {st.id} · started at round {st.startRound} · clock at round {st.round}</p>
        <h1 className="display text-[30px] sm:text-[38px] mt-1">Portfolio</h1>
      </header>

      <section aria-label="Account summary" className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-x-6 gap-y-4 border-y-2 border-ink py-4">
        <div className="col-span-2"><Stat big label="Net asset value" value={usd(nav)} sub={<span className={tone(nav - start)}>{usd(nav - start, { sign: true })} · {signedPct((nav - start) / start)}</span>} info={<>Cash plus the value of every open position, marked at the mid-point of the dealer’s quote (or the model’s estimate once a market has closed).</>} /></div>
        <Stat label="Free cash" value={usd(s.available(), { decimals: 0 })} info={<>Cash you can still deploy: total cash, minus the $1.00 per contract locked behind NO positions, minus cash reserved for resting buy orders.</>} />
        <Stat label="Locked for NO" value={usd(locked, { decimals: 0 })} />
        <Stat label="Realised" value={usd(st.ledger.realized, { sign: true })} tone={tone(st.ledger.realized)} />
        <Stat label="Unrealised" value={usd(unreal, { sign: true })} tone={tone(unreal)} />
        <Stat label="Fees paid" value={usd(st.ledger.fees)} />
        <Stat label="Max drawdown" value={dd.maxDrawdown > 0 ? `−${(dd.maxDrawdownPct * 100).toFixed(2)}%` : "0.00%"} sub={dd.maxDrawdown > 0 ? usd(-dd.maxDrawdown) : undefined} info={<>The largest fall in net asset value from an earlier peak, measured lap by lap across the whole session.</>} />
      </section>

      <section aria-labelledby="nav-h">
        <SectionHead idx="01" title="Net asset value" id="nav-h" />
        {st.navHistory.length < 2 ? (
          <Empty title="No history yet">The value of your book is recorded every lap once the clock is running.</Empty>
        ) : (
          <LineChart
            title="Net asset value by lap across the session"
            series={[{ id: "nav", label: "Net asset value", color: "var(--color-ink)", values: navSeries, width: 2, step: true }]}
            xMax={Math.max(1, navSeries.length - 1)}
            yDomain={yDomain}
            yTicks={[yDomain[0], (yDomain[0] + yDomain[1]) / 2, yDomain[1]]}
            yFormat={(v) => `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`}
            xFormat={(i) => { const p = st.navHistory[i]; return p ? `R${p.round}·L${p.frame}` : ""; }}
            dividers={dividers.length > 1 ? dividers : undefined}
            baseline={start / 100}
            height={210}
          />
        )}
      </section>

      <section aria-labelledby="pos-h">
        <SectionHead idx="02" title="Open positions" id="pos-h"><span className="num text-[13px] text-ink-3">{positions.length}</span></SectionHead>
        {positions.length === 0 ? (
          <Empty title="You hold no contracts">
            Open the <Link href="/markets/" className="underline underline-offset-2 font-medium">markets</Link> and buy YES or NO on any contract. Each position shows here with its cost, current value and the most it can lose.
          </Empty>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="tsheet min-w-[720px]">
              <thead><tr><th>Contract</th><th>Side</th><th className="r">Contracts</th><th className="r">Avg cost</th><th className="r">Mark</th><th className="r">Value</th><th className="r">Unrealised</th><th className="r">Max loss</th><th className="r">Max gain</th><th className="w-[70px]"><span className="sr-only">Close</span></th></tr></thead>
              <tbody>
                {positions.map((p) => {
                  const c = s.contract(p.contractId);
                  const side = p.q > 0 ? "YES" : "NO";
                  const mark = s.mark(p.contractId);
                  const own = p.q > 0 ? mark : 1 - mark;
                  const value = Math.abs(p.q) * own * 100;
                  const u = value - p.basis;
                  return (
                    <tr key={p.contractId}>
                      <td className="font-medium max-w-[280px]"><span className="block truncate">{titleOf(p.contractId)}</span></td>
                      <td><SideChip side={side} /></td>
                      <td className="r num">{qty(Math.abs(p.q))}</td>
                      <td className="r num">{(p.basis / Math.abs(p.q)).toFixed(1)}¢</td>
                      <td className="r num">{(own * 100).toFixed(1)}¢</td>
                      <td className="r num">{usd(value)}</td>
                      <td className={`r num font-medium ${tone(u)}`}>{usd(u, { sign: true })}</td>
                      <td className="r num text-ink-2">{usd(-p.basis)}</td>
                      <td className="r num text-ink-2">{usd(Math.abs(p.q) * 100 - p.basis, { sign: true })}</td>
                      <td className="r !py-1">{c && <button className="btn btn-sm btn-quiet !min-h-[34px] !px-2.5" onClick={() => app.openTicket(p.contractId, side, "SELL")} disabled={!s.isTradable(c)}>Close</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {st.orders.length > 0 && (
          <div className="mt-5">
            <p className="eyebrow mb-1.5">Resting orders · {usd(s.reserved())} reserved</p>
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="tsheet min-w-[520px]">
                <thead><tr><th>Contract</th><th>Order</th><th className="r">Limit</th><th className="r">Remaining</th><th className="r">Placed</th><th className="w-[80px]"><span className="sr-only">Cancel</span></th></tr></thead>
                <tbody>
                  {st.orders.map((o) => (
                    <tr key={o.id}>
                      <td className="font-medium"><span className="block truncate max-w-[260px]">{titleOf(o.contractId)}</span></td>
                      <td><span className="inline-flex items-center gap-1.5">{o.action === "BUY" ? "Buy" : "Sell"} <SideChip side={o.side} /></span></td>
                      <td className="r num">{o.side === "YES" ? o.yesLimit : 100 - o.yesLimit}¢</td>
                      <td className="r num">{qty(o.qty - o.filled)}</td>
                      <td className="r num text-ink-2">R{o.placedRound}·L{o.placedFrame}</td>
                      <td className="r !py-1"><button className="btn btn-sm btn-quiet !min-h-[34px] !px-2.5" onClick={() => app.cancel(o.id)}>Cancel</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="risk-h">
        <SectionHead idx="03" title="Risk" id="risk-h" />
        <div className="grid lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] gap-8">
          <div>
            <p className="eyebrow mb-1 flex items-center gap-1">
              <span className="text-model">Estimated</span>&nbsp;· outcome distribution of the open book
              <InfoTip label="Outcome distribution">Every open position is revalued in each of {risk?.sims.toLocaleString("en-US") ?? "2,000"} simulated outcomes of the race in progress (and, for title contracts, the rest of the season). Because all contracts are read off the same simulated race, a win, a podium and a points contract on one driver move together — as they would in reality.</InfoTip>
            </p>
            {risk ? <Histogram bins={risk.histogram} sims={risk.sims} /> : <Empty title="Nothing at risk">With no open positions there is no outcome distribution to show.</Empty>}
          </div>
          <div className="grid gap-4 content-start">
            {risk && (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                <Stat label="Expected" value={usd(risk.mean, { sign: true })} tone={tone(risk.mean)} info={<>Average settlement value minus today’s mark, under the model. A book bought at the ask is expected to lose roughly the spread and fees.</>} />
                <Stat label="Chance of a loss" value={pct(risk.probLoss, 0)} />
                <Stat label="Bad case (5% tail avg)" value={usd(risk.es05, { sign: true })} tone="loss" info={<>Expected shortfall: the average outcome across the worst 5% of simulated races.</>} />
                <Stat label="Good case (95th pct)" value={usd(risk.p95, { sign: true })} tone="gain" />
              </dl>
            )}
            <div className="grid gap-2.5 border-t border-rule pt-3">
              <Meter value={worst} limit={RISK_LIMITS.total * nav} label={`Worst case, exact: ${usd(worst)} of ${usd(RISK_LIMITS.total * nav, { decimals: 0 })} allowed`} />
              <p className="text-[12.5px] text-ink-3 leading-snug">
                The worst case is exact, not simulated: within a set of mutually exclusive contracts (one race winner, one champion) at most one can pay, so offsetting positions are netted. Orders that would take it above {RISK_LIMITS.total * 100}% of net asset value — or put more than {RISK_LIMITS.perContract * 100}% in a single contract — are refused.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="perf-h">
        <SectionHead idx="04" title="Performance" id="perf-h" />
        <div className="grid lg:grid-cols-3 gap-8">
          <div>
            <p className="eyebrow mb-2">Per race <InfoTip label="Per race">Results are reported per event with their sample size. There is no annualised Sharpe ratio here: a handful of two-hour holding periods cannot be annualised honestly.</InfoTip></p>
            {ev.n === 0 ? <p className="text-[13.5px] text-ink-2">No settled rounds yet.</p> : (
              <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
                <Stat label="Rounds settled" value={ev.n} />
                <Stat label="Profitable rounds" value={`${ev.positive} of ${ev.n}`} />
                <Stat label="Average per round" value={usd(ev.mean, { sign: true })} tone={tone(ev.mean)} />
                <Stat label="Std. deviation" value={ev.n > 1 ? usd(ev.stdev) : "—"} />
                <Stat label="Best / worst" value={`${usd(ev.best, { sign: true, decimals: 0 })} / ${usd(ev.worst, { sign: true, decimals: 0 })}`} />
                <Stat label="Mean ÷ std. dev." value={ev.ratio !== null ? ev.ratio.toFixed(2) : "needs 5+ rounds"} info={<>Average round P&amp;L divided by its standard deviation, per event. Shown only from five settled rounds; not annualised.</>} />
              </dl>
            )}
          </div>
          <div>
            <p className="eyebrow mb-2">Settled contracts</p>
            {ss.n === 0 ? <p className="text-[13.5px] text-ink-2">Contracts appear here once a race has settled.</p> : (
              <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
                <Stat label="Positions settled" value={ss.n} />
                <Stat label="Profitable" value={`${ss.wins} (${pct(ss.hitRate, 0)})`} />
                <Stat label="Average win" value={usd(ss.avgWin, { sign: true })} tone="gain" />
                <Stat label="Average loss" value={usd(-ss.avgLoss, { sign: true })} tone="loss" />
                <Stat label="Avg price paid" value={pct(ss.avgEntry)} info={<>The contract-weighted average price you paid, read as a probability.</>} />
                <Stat label="How often they paid" value={pct(ss.realisedFrequency)} tone={ss.realisedFrequency > ss.avgEntry ? "gain" : "loss"} info={<>The share of those contracts that actually paid $1.00. Beating your average price paid, over many contracts, is what skill looks like.</>} />
              </dl>
            )}
          </div>
          <div>
            <p className="eyebrow mb-2">Execution costs</p>
            {ex.fills === 0 ? <p className="text-[13.5px] text-ink-2">No fills yet.</p> : (
              <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
                <Stat label="Fills" value={`${ex.fills}${ex.maker ? ` (${ex.maker} resting)` : ""}`} />
                <Stat label="Contracts traded" value={qty(ex.contracts)} />
                <Stat label="Spread paid" value={usd(ex.spread)} info={<>What your fills cost relative to the mid-point of the quote at the time: half-spreads, plus {usd(ex.impact)} from trading through the best price.</>} />
                <Stat label="Fees" value={usd(ex.fees)} />
                <Stat label="Total cost" value={usd(ex.spread + ex.fees)} sub={ex.notional > 0 ? `${(((ex.spread + ex.fees) / ex.notional) * 100).toFixed(2)}% of ${usd(ex.notional, { decimals: 0 })} traded` : undefined} />
                <Stat label="Edge vs model" value={usd(ex.modelEdge, { sign: true })} tone={tone(ex.modelEdge)} info={<>Model value of what you bought minus what you paid, summed over fills. Usually negative — that is the spread.</>} />
              </dl>
            )}
          </div>
        </div>
        {(kinds.length > 0 || races.length > 0) && (
          <div className="grid lg:grid-cols-2 gap-8 mt-7">
            <AttributionTable caption="By market type" rows={kinds} />
            <AttributionTable caption="By race" rows={races} />
          </div>
        )}
      </section>

      <section aria-labelledby="hist-h">
        <SectionHead idx="05" title="Records" id="hist-h">
          <button className="btn btn-sm btn-quiet" onClick={download}>Export session (JSON)</button>
        </SectionHead>
        <div className="seg mb-3" role="tablist" aria-label="Records">
          <button role="tab" aria-selected={tab === "fills"} onClick={() => setTab("fills")}>Fills ({st.fills.length})</button>
          <button role="tab" aria-selected={tab === "settlements"} onClick={() => setTab("settlements")}>Settlements ({st.settlements.length})</button>
          <button role="tab" aria-selected={tab === "audit"} onClick={() => setTab("audit")}>Audit log</button>
        </div>
        {tab === "fills" && (st.fills.length === 0 ? <Empty title="No fills yet" /> : (
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="tsheet min-w-[760px]">
              <thead><tr><th>When</th><th>Contract</th><th>Order</th><th className="r">Contracts</th><th className="r">Price</th><th className="r"><span className="text-model">Model</span> then</th><th className="r">Fee</th><th>Type</th><th className="r">Realised</th></tr></thead>
              <tbody>
                {[...st.fills].reverse().slice(0, 200).map((f) => (
                  <tr key={f.id}>
                    <td className="num text-ink-2 whitespace-nowrap">R{f.round}·L{f.frame}</td>
                    <td className="font-medium"><span className="block truncate max-w-[240px]">{f.title}</span></td>
                    <td><span className="inline-flex items-center gap-1.5">{f.action === "BUY" ? "Buy" : "Sell"} <SideChip side={f.side} /></span></td>
                    <td className="r num">{qty(f.qty)}</td>
                    <td className="r num">{f.price.toFixed(1)}¢</td>
                    <td className="r num text-model">{pct(f.side === "YES" ? f.fair : 1 - f.fair)}</td>
                    <td className="r num">{usd(f.fee)}</td>
                    <td className="text-ink-2">{f.liquidity === "maker" ? "Resting" : "Immediate"}</td>
                    <td className={`r num ${tone(f.realized)}`}>{Math.abs(f.realized) > 0.5 ? usd(f.realized, { sign: true }) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {tab === "settlements" && (st.settlements.length === 0 ? <Empty title="Nothing has settled yet">Race contracts settle on the official classification after the chequered flag.</Empty> : (
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="tsheet min-w-[640px]">
              <thead><tr><th>Round</th><th>Contract</th><th>Held</th><th>Resolved</th><th className="r">Cost</th><th className="r">Paid out</th><th className="r">Profit / loss</th></tr></thead>
              <tbody>
                {[...st.settlements].reverse().map((r) => (
                  <tr key={r.seq}>
                    <td className="num text-ink-2">R{r.round}</td>
                    <td className="font-medium"><span className="block truncate max-w-[260px]">{r.title}</span></td>
                    <td><span className="inline-flex items-center gap-1.5"><SideChip side={r.q > 0 ? "YES" : "NO"} /><span className="num">{qty(Math.abs(r.q))}</span></span></td>
                    <td><span className={r.payoff ? "side-yes" : "side-no"}>{r.payoff ? "YES" : "NO"}</span></td>
                    <td className="r num">{usd(r.basis)}</td>
                    <td className="r num">{usd(r.basis + r.realized)}</td>
                    <td className={`r num font-medium ${tone(r.realized)}`}>{usd(r.realized, { sign: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {tab === "audit" && (
          <ol className="grid max-h-[460px] overflow-y-auto scroll-thin border border-rule bg-sheet">
            {[...st.audit].reverse().slice(0, 300).map((a) => (
              <li key={a.seq} className="grid grid-cols-[64px_70px_1fr] gap-2 px-3 py-1.5 border-b border-rule-2 text-[13px] items-baseline">
                <span className="num text-ink-3 text-[12px]">R{a.round}·L{a.frame}</span>
                <span className="tag justify-center">{a.type}</span>
                <span>{a.text}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function AttributionTable({ caption, rows }: { caption: string; rows: { key: string; label: string; realized: number; fees: number; fills: number; settled: number }[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="eyebrow mb-1.5">{caption} · realised</p>
      <table className="tsheet">
        <thead><tr><th>{caption.replace("By ", "")}</th><th className="r">Fills</th><th className="r">Settled</th><th className="r">Fees</th><th className="r">Net realised</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="font-medium"><span className="block truncate max-w-[220px]">{r.label}</span></td>
              <td className="r num">{r.fills}</td>
              <td className="r num">{r.settled}</td>
              <td className="r num text-ink-2">{usd(r.fees)}</td>
              <td className={`r num font-medium ${tone(r.realized - r.fees)}`}>{usd(r.realized - r.fees, { sign: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Histogram({ bins, sims }: { bins: { lo: number; hi: number; count: number }[]; sims: number }) {
  const [ref, width] = useWidth<HTMLDivElement>(420);
  const h = 170;
  const m = { l: 8, r: 8, t: 8, b: 26 };
  const w = width - m.l - m.r;
  const max = Math.max(1, ...bins.map((b) => b.count));
  const lo = bins[0].lo;
  const hi = bins[bins.length - 1].hi;
  const x = (v: number) => m.l + ((v - lo) / (hi - lo || 1)) * w;
  const zero = lo < 0 && hi > 0 ? x(0) : null;
  return (
    <div ref={ref}>
      <svg width={width} height={h} role="img" aria-label={`Histogram of simulated profit and loss across ${sims} outcomes, from ${usd(lo)} to ${usd(hi)}.`}>
        <defs>
          <pattern id="hatch-loss" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="var(--color-loss)" strokeWidth="2.4" /></pattern>
          <pattern id="hatch-gain" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="var(--color-gain)" strokeWidth="2.4" /></pattern>
        </defs>
        {bins.map((b, k) => {
          const bh = (b.count / max) * (h - m.t - m.b);
          const mid = (b.lo + b.hi) / 2;
          return b.count ? <rect key={k} x={x(b.lo) + 0.5} y={h - m.b - bh} width={Math.max(1, x(b.hi) - x(b.lo) - 1)} height={bh} fill={mid < 0 ? "url(#hatch-loss)" : "url(#hatch-gain)"} stroke={mid < 0 ? "var(--color-loss)" : "var(--color-gain)"} strokeWidth="1" /> : null;
        })}
        <line x1={m.l} x2={m.l + w} y1={h - m.b} y2={h - m.b} stroke="var(--color-ink)" />
        {zero !== null && <line x1={zero} x2={zero} y1={m.t} y2={h - m.b + 4} stroke="var(--color-ink)" strokeDasharray="2 3" />}
        <text x={m.l} y={h - 8} className="num" fontSize="11" fill="var(--color-ink-3)">{usd(lo, { decimals: 0 })}</text>
        {zero !== null && zero > 60 && zero < width - 60 && <text x={zero} y={h - 8} textAnchor="middle" className="num" fontSize="11" fill="var(--color-ink-3)">$0</text>}
        <text x={m.l + w} y={h - 8} textAnchor="end" className="num" fontSize="11" fill="var(--color-ink-3)">{usd(hi, { sign: true, decimals: 0 })}</text>
      </svg>
      <p className="text-[12px] text-ink-3 mt-1">Hatched bars mark simulated outcomes — hypothetical, not history. Profit and loss is measured against the current mark.</p>
    </div>
  );
}
