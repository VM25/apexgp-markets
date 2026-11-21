"use client";

import { useMemo, useState } from "react";
import { Sparkline } from "@/charts/LineChart";
import { KIND_META, type Contract, type ContractKind } from "@/engine/market/contracts";
import { useApp, useMediaQuery } from "@/state/hooks";
import { cents, pct, qty, teamColor } from "@/ui/format";
import { Dialog, Empty, ProvenanceLegend, SideChip } from "@/ui/primitives";
import { ContractDetail } from "./ContractDetail";

const TABS: { kind: ContractKind; label: string }[] = [
  { kind: "WIN", label: "Winner" },
  { kind: "POD", label: "Podium" },
  { kind: "PTS", label: "Points" },
  { kind: "DNF", label: "Not classified" },
  { kind: "H2H", label: "Head-to-head" },
  { kind: "WDC", label: "Drivers’ title" },
  { kind: "WCC", label: "Constructors’ title" },
];

export function MarketsView() {
  const app = useApp();
  const s = app.session!;
  const lens = s.lens;
  const race = lens.race;
  const frame = s.state.frame;
  const desktop = useMediaQuery("(min-width: 1024px)");
  const selected = app.selected ? s.contract(app.selected) : undefined;
  const [kind, setKind] = useState<ContractKind>(selected?.kind ?? "WIN");
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState(false);

  const rows = useMemo(() => {
    const fair = lens.fairAt(frame);
    const prev = frame > 0 ? lens.fairAt(frame - 1) : fair;
    const needle = query.trim().toLowerCase();
    return lens.contracts
      .filter((c) => c.kind === kind)
      .filter((c) => !needle || c.title.toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle))
      .map((c) => {
        const i = lens.indexOf.get(c.id)!;
        return { c, fair: fair[i], delta: fair[i] - prev[i] };
      })
      .sort((a, b) => b.fair - a.fair);
  }, [lens, frame, kind, query]);

  const colorOf = (c: Contract) => {
    if (c.kind === "WCC") return race.teams.find((t) => t.id === c.subject)?.color ?? race.standings.constructors.find((t) => t.id === c.subject)?.color ?? null;
    return c.index >= 0 ? race.drivers[c.index].color : null;
  };
  const nameOf = (c: Contract) => {
    if (c.kind === "H2H") return `${race.drivers[c.index].name} ahead of ${race.drivers[c.versusIndex].name}`;
    if (c.kind === "WCC") return c.title.replace(" — constructors' title", "");
    if (c.index >= 0) return race.drivers[c.index].name;
    return c.title.split(" — ")[0];
  };
  const choose = (c: Contract) => {
    app.select(c.id);
    if (!desktop) setSheet(true);
  };
  const phase = s.state.phase;

  return (
    <div className="grid gap-5">
      <header className="grid gap-3 rise">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <p className="eyebrow">Round {race.round} · {race.name} · {phase === "pre" ? "on the grid" : phase === "live" ? `after lap ${frame}` : phase === "flag" ? "chequered flag" : "settled"}</p>
            <h1 className="display text-[30px] sm:text-[38px] mt-1">Markets</h1>
          </div>
          <div className="max-w-[560px]"><ProvenanceLegend dense /></div>
        </div>
        {(phase === "flag" || phase === "settled") && (
          <p className="bg-ink text-paper px-3 py-2 text-[14px]">
            {phase === "flag" ? "The race is over and its markets are closed. Settle on the official classification to see how your contracts resolved." : "This round has settled. Open the next round from the clock bar to keep trading."}
          </p>
        )}
      </header>

      <div className="grid lg:grid-cols-[minmax(340px,5fr)_minmax(0,8fr)] gap-6 xl:gap-8 items-start">
        <section aria-label="Contracts" className="min-w-0">
          <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto scroll-thin">
            <div role="tablist" aria-label="Market type" className="flex gap-0 border-b-2 border-ink min-w-max">
              {TABS.map((t) => (
                <button
                  key={t.kind}
                  role="tab"
                  aria-selected={kind === t.kind}
                  onClick={() => setKind(t.kind)}
                  className={`px-3 h-11 text-[13.5px] font-semibold whitespace-nowrap border-b-[3px] -mb-[2px] ${kind === t.kind ? "border-you text-ink" : "border-transparent text-ink-3 hover:text-ink"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <label htmlFor="mkt-search" className="sr-only">Search contracts</label>
            <input id="mkt-search" className="field !min-h-[40px] !text-[14px] !font-sans" placeholder="Search a driver or team" value={query} onChange={(e) => setQuery(e.target.value)} type="search" />
          </div>
          <p className="text-[12.5px] text-ink-3 mt-2 mb-1">{KIND_META[kind].rule}</p>
          {rows.length === 0 ? (
            <Empty title="No contracts match">Clear the search to see every {KIND_META[kind].label.toLowerCase()} contract.</Empty>
          ) : (
            <table className="tsheet">
              <thead>
                <tr>
                  <th scope="col">Contract</th>
                  <th scope="col" className="r">Model</th>
                  <th scope="col" className="r hidden xs:table-cell">Bid</th>
                  <th scope="col" className="r">Ask</th>
                  <th scope="col" className="r hidden sm:table-cell lg:hidden xl:table-cell">Race</th>
                  <th scope="col" className="r">Held</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ c, fair, delta }) => {
                  const q = s.quoteFor(c.id);
                  const pos = s.state.ledger.positions[c.id];
                  const active = app.selected === c.id;
                  const out = c.scope === "race" && c.index >= 0 && race.frames.stopped[Math.min(frame, lens.totalFrames - 1)][c.index] === 1;
                  return (
                    <tr key={c.id} className={`hoverable cursor-pointer ${active ? "!bg-paper-2 outline outline-[1.5px] -outline-offset-1 outline-ink" : ""}`} onClick={() => choose(c)}>
                      <td className="!py-0 fill">
                        <button className="flex items-center gap-2.5 min-w-0 w-full text-left h-11" aria-current={active ? "true" : undefined}>
                          <span className="w-[4px] h-6 shrink-0" style={{ background: teamColor(colorOf(c)) }} />
                          <span className="num font-semibold text-[13px] w-[34px] shrink-0" aria-hidden="true">{c.kind === "H2H" ? race.drivers[c.index].code : c.code}</span>
                          <span className={`truncate text-[14px] ${out ? "line-through text-ink-3" : ""}`} aria-hidden="true">{nameOf(c)}</span>
                          <span className="sr-only">{c.title}. Model {pct(fair)}.{out ? " Car has stopped." : ""}</span>
                        </button>
                      </td>
                      <td className="r num">
                        <span className="text-model font-medium">{pct(fair)}</span>
                        {Math.abs(delta) >= 0.005 && <span className={`block text-[11px] leading-none ${delta > 0 ? "gain" : "loss"}`}>{delta > 0 ? "▲" : "▼"}{Math.abs(delta * 100).toFixed(1)}</span>}
                      </td>
                      <td className="r num hidden xs:table-cell text-ink-2">{q.state === "open" ? cents(q.bestBid) : "—"}</td>
                      <td className="r num font-medium">{q.state === "open" ? cents(q.bestAsk) : "—"}</td>
                      <td className="r hidden sm:table-cell lg:hidden xl:table-cell"><span className="inline-flex justify-end"><Sparkline values={lens.path(c.id, frame)} /></span></td>
                      <td className="r">
                        {pos && pos.q !== 0 ? (
                          <span className="inline-flex items-center gap-1 justify-end"><SideChip side={pos.q > 0 ? "YES" : "NO"} /><span className="num text-[12.5px]">{qty(Math.abs(pos.q))}</span></span>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="text-[12px] text-ink-3 mt-3">
            Prices are YES prices in cents per $1.00 contract. Buying NO costs 100¢ minus the YES bid.
          </p>
        </section>

        <section aria-label="Selected contract" className="hidden lg:block sheet p-5 xl:p-6 sticky top-[calc(var(--shell-top)+20px)] max-h-[calc(100dvh-var(--shell-top)-40px)] overflow-y-auto scroll-thin">
          {app.selected && s.contract(app.selected) ? <ContractDetail contractId={app.selected} /> : <Empty title="Pick a contract">Choose a row on the left to see its quote, history and order ticket.</Empty>}
        </section>
      </div>

      <Dialog open={sheet && !desktop && !!selected} onClose={() => setSheet(false)} title={selected?.title ?? "Contract"} wide>
        {sheet && !desktop && app.selected && <div className="p-4"><ContractDetail contractId={app.selected} layout="stack" /></div>}
      </Dialog>
    </div>
  );
}
