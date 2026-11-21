"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/state/hooks";
import { cents, dateShort, pct, teamColor, tone, usd } from "@/ui/format";
import { Dialog, ProvenanceLegend, SectionHead, StatusFlag } from "@/ui/primitives";

export function OverviewView() {
  const app = useApp();
  const s = app.session!;
  const lens = s.lens;
  const race = lens.race;
  const { frame, phase, round } = s.state;
  const season = app.season!;
  const [newOpen, setNewOpen] = useState(false);
  const [startRound, setStartRound] = useState(1);
  const fair = lens.fairAt(frame);
  const nav = s.nav();
  const pnl = nav - s.state.ledger.startCash;
  const settled = new Set(s.state.settledRounds);
  const board = lens.contracts
    .filter((c) => c.kind === "WIN")
    .map((c) => ({ c, p: fair[lens.indexOf.get(c.id)!] }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 6);
  const titleRows = (kind: "WDC" | "WCC") =>
    lens.contracts
      .filter((c) => c.kind === kind)
      .map((c) => ({ c, p: fair[lens.indexOf.get(c.id)!] }))
      .sort((a, b) => b.p - a.p);
  const drivers = race.standings.drivers.slice(0, 10);
  const teams = race.standings.constructors.slice(0, 10);
  const wdc = new Map(titleRows("WDC").map((r) => [r.c.subject, r]));
  const wcc = new Map(titleRows("WCC").map((r) => [r.c.subject, r]));
  const fresh = s.state.fills.length === 0 && round === s.state.startRound && frame === 0;

  return (
    <div className="grid gap-10 lg:gap-12">
      <section className="grid lg:grid-cols-[minmax(0,7fr)_minmax(340px,5fr)] gap-8 lg:gap-12 items-start">
        <div className="rise">
          <p className="eyebrow">Formula 1 · prediction-market simulation · fictional money only</p>
          <h1 className="display text-[clamp(30px,9.2vw,56px)] lg:text-[clamp(46px,5.3vw,76px)] mt-3">
            Every lap is new <span className="text-model">information</span>. <span className="relative inline-block">Trade it.<span className="absolute left-0 right-0 -bottom-1 h-[5px] sm:h-[7px] bg-you" /></span>
          </h1>
          <p className="prose-sheet mt-6 max-w-[58ch]">
            ApexGP replays the real 2025 season one lap at a time. A forecasting model turns each lap into probabilities, a simulated dealer turns those probabilities into bid and ask prices, and you run a $100,000 book of YES/NO contracts through to official settlement.
          </p>
          <div className="flex flex-wrap gap-2.5 mt-6">
            <Link href="/markets/" className="btn btn-you">{fresh ? "Open the markets" : "Back to the markets"} →</Link>
            <Link href="/race/" className="btn">{phase === "pre" ? "Go to the grid" : "Watch the race"}</Link>
            <Link href="/research/" className="btn btn-ghost underline underline-offset-4">How it works</Link>
          </div>
          <div className="mt-8 border-t border-rule pt-4">
            <p className="eyebrow mb-2">Four kinds of number, never mixed up</p>
            <ProvenanceLegend />
          </div>
        </div>

        <aside className="sheet !border-ink border-2 rise" style={{ animationDelay: "90ms" }} aria-label="Your session">
          <div className="flex items-center justify-between gap-3 px-4 h-11 border-b-2 border-ink bg-ink text-paper">
            <span className="display text-[13px]">Your session</span>
            <span className="num text-[12px] opacity-80">{app.restored ? "restored from this browser" : "saved in this browser"}</span>
          </div>
          <div className="p-4 grid gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">Market clock</p>
                <p className="font-bold text-[18px] leading-tight mt-0.5 truncate">R{round} · {race.name}</p>
                <p className="num text-[13.5px] text-ink-2 mt-0.5">{phase === "pre" ? "Starting grid" : phase === "settled" ? "Settled" : `Lap ${Math.min(frame, race.laps)} of ${race.laps}`}</p>
              </div>
              <StatusFlag status={race.frames.status[Math.min(frame, lens.totalFrames - 1)]} phase={phase === "live" ? undefined : phase} />
            </div>
            <div className="grid grid-cols-3 gap-3 border-y border-rule py-3">
              <div><p className="eyebrow">Net value</p><p className="num text-[19px] font-medium">{usd(nav, { decimals: 0 })}</p></div>
              <div><p className="eyebrow">Since start</p><p className={`num text-[19px] font-medium ${tone(pnl)}`}>{usd(pnl, { sign: true, decimals: 0 })}</p></div>
              <div><p className="eyebrow">Positions</p><p className="num text-[19px] font-medium">{s.positions().length}</p></div>
            </div>
            <div>
              <p className="eyebrow mb-1">Race winner · on the board now</p>
              <table className="tsheet">
                <thead><tr><th>Driver</th><th className="r"><span className="text-model">Model</span></th><th className="r">Bid</th><th className="r">Ask</th><th className="w-[64px]"><span className="sr-only">Trade</span></th></tr></thead>
                <tbody>
                  {board.map(({ c, p }) => {
                    const q = s.quoteFor(c.id);
                    const d = race.drivers[c.index];
                    return (
                      <tr key={c.id}>
                        <td><span className="flex items-center gap-2"><span className="w-[4px] h-5" style={{ background: teamColor(d.color) }} /><span className="num font-semibold text-[13px]">{d.code}</span><span className="truncate hidden xs:inline text-[13.5px]">{d.name.split(" ").slice(-1)[0]}</span></span></td>
                        <td className="r num text-model font-medium">{pct(p)}</td>
                        <td className="r num text-ink-2">{q.state === "open" ? cents(q.bestBid) : "—"}</td>
                        <td className="r num font-medium">{q.state === "open" ? cents(q.bestAsk) : "—"}</td>
                        <td className="r !py-1"><button className="btn btn-sm btn-quiet !min-h-[34px] !px-2.5" onClick={() => app.openTicket(c.id, "YES", "BUY")} disabled={!s.isTradable(c)}>Trade</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/portfolio/" className="btn btn-sm flex-1">Portfolio</Link>
              <button className="btn btn-sm btn-quiet flex-1" onClick={() => { setStartRound(1); setNewOpen(true); }}>New session…</button>
            </div>
            {!app.storageOk && <p className="text-[12.5px] loss">This browser is blocking local storage, so the session will not survive a reload.</p>}
          </div>
        </aside>
      </section>

      <section aria-labelledby="how">
        <SectionHead idx="01" title="How a round works" id="how" />
        <ol className="grid sm:grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-5">
          {[
            { t: "Pick a contract", d: "Each contract asks a yes-or-no question about the race — will this driver win, finish on the podium, score points? One contract pays $1.00 if you are right and nothing if you are wrong." },
            { t: "Buy YES or NO", d: "The price in cents is roughly the market’s probability. The dealer sells above its estimate and buys below it; that gap is the spread, and it widens when the next lap is likely to matter more." },
            { t: "Run the clock", d: "Step lap by lap or press play. Positions, gaps, pit stops and safety cars arrive as they were recorded; the model re-estimates and the dealer re-quotes. The clock never runs backwards." },
            { t: "Settle on the result", d: "At the flag, markets close and every contract resolves on the official classification — including any post-race penalties. Title contracts carry on to the end of the season." },
          ].map((step, k) => (
            <li key={step.t} className="border-t border-ink pt-3">
              <p className="num text-[12px] font-semibold text-you">STEP {k + 1}</p>
              <p className="font-bold text-[17px] mt-1">{step.t}</p>
              <p className="text-[14px] text-ink-2 mt-1.5 leading-relaxed">{step.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="cal">
        <SectionHead idx="02" title="2025 calendar" id="cal">
          <span className="text-[12.5px] text-ink-3 hidden sm:inline">{season.rounds.length} rounds with verified lap-by-lap data</span>
        </SectionHead>
        <ol className="grid md:grid-cols-2 2xl:grid-cols-3 gap-x-8">
          {season.rounds.map((r) => {
            const done = settled.has(r.round);
            const current = r.round === round;
            const sum = s.state.races.find((x) => x.round === r.round);
            const racePnl = sum && done ? sum.navEnd - sum.navStart : null;
            return (
              <li key={r.round} className={`flex items-center gap-3 min-h-[52px] border-b border-rule-2 ${current ? "bg-you-soft -mx-2 px-2" : ""}`}>
                <span className="num text-[12px] font-semibold w-8 shrink-0 text-ink-3">R{String(r.round).padStart(2, "0")}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-[14.5px] truncate">{r.name.replace(" Grand Prix", "")}{r.sprintWeekend && <span className="tag ml-2 align-middle">Sprint</span>}</span>
                  <span className="block text-[12.5px] text-ink-3 truncate">{r.circuit.locality} · {dateShort(r.date)} · {r.laps} laps</span>
                </span>
                {done ? (
                  <span className="flex items-center gap-2 shrink-0">
                    {racePnl !== null && Math.abs(racePnl) > 0.5 && <span className={`num text-[13px] ${tone(racePnl)}`}>{usd(racePnl, { sign: true, decimals: 0 })}</span>}
                    <Link href="/race/" className="btn btn-sm btn-quiet !min-h-[34px] !px-2.5" onClick={() => void app.openReview(r.round)}>Review</Link>
                  </span>
                ) : current ? (
                  <Link href="/race/" className="btn btn-sm btn-solid !min-h-[34px] !px-2.5 shrink-0">{phase === "pre" ? "On the grid" : "In progress"}</Link>
                ) : r.round < round ? (
                  <span className="tag shrink-0">Before your start</span>
                ) : (
                  <span className="tag shrink-0">Ahead</span>
                )}
              </li>
            );
          })}
        </ol>
        <p className="text-[12.5px] text-ink-3 mt-3 max-w-[78ch]">
          Results of rounds ahead of your clock are not shown anywhere in the app unless you choose to review them. To trade an earlier round again, open a new session.
        </p>
      </section>

      <section aria-labelledby="stand" className="grid lg:grid-cols-2 gap-8">
        <div>
          <SectionHead idx="03" title="Drivers’ championship" id="stand" />
          <p className="text-[13px] text-ink-2 mb-2">Standings entering round {round} (recorded), with the model’s title estimate at the current lap.</p>
          <table className="tsheet">
            <thead><tr><th className="w-8">P</th><th>Driver</th><th className="r">Points</th><th className="r">Wins</th><th className="r"><span className="text-model">Title</span></th><th className="w-[64px]"><span className="sr-only">Trade</span></th></tr></thead>
            <tbody>
              {drivers.map((d, i) => {
                const row = wdc.get(d.id);
                const color = race.drivers.find((x) => x.id === d.id)?.color ?? null;
                return (
                  <tr key={d.id}>
                    <td className="num font-semibold">{i + 1}</td>
                    <td><span className="flex items-center gap-2"><span className="w-[4px] h-5" style={{ background: teamColor(color) }} /><span className="truncate font-medium">{d.name}</span></span></td>
                    <td className="r num">{d.points}</td>
                    <td className="r num text-ink-2">{d.wins}</td>
                    <td className="r num text-model font-medium">{row ? pct(row.p) : "—"}</td>
                    <td className="r !py-1">{row && <button className="btn btn-sm btn-quiet !min-h-[34px] !px-2.5" onClick={() => app.openTicket(row.c.id, "YES", "BUY")} disabled={!s.isTradable(row.c)}>Trade</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div>
          <SectionHead idx="04" title="Constructors’ championship" />
          <p className="text-[13px] text-ink-2 mb-2">Team points are the sum of both cars. Title contracts settle after the final round.</p>
          <table className="tsheet">
            <thead><tr><th className="w-8">P</th><th>Constructor</th><th className="r">Points</th><th className="r">Wins</th><th className="r"><span className="text-model">Title</span></th><th className="w-[64px]"><span className="sr-only">Trade</span></th></tr></thead>
            <tbody>
              {teams.map((t, i) => {
                const row = wcc.get(t.id);
                return (
                  <tr key={t.id}>
                    <td className="num font-semibold">{i + 1}</td>
                    <td><span className="flex items-center gap-2"><span className="w-[4px] h-5" style={{ background: teamColor(t.color) }} /><span className="truncate font-medium">{t.name}</span></span></td>
                    <td className="r num">{t.points}</td>
                    <td className="r num text-ink-2">{t.wins}</td>
                    <td className="r num text-model font-medium">{row ? pct(row.p) : "—"}</td>
                    <td className="r !py-1">{row && <button className="btn btn-sm btn-quiet !min-h-[34px] !px-2.5" onClick={() => app.openTicket(row.c.id, "YES", "BUY")} disabled={!s.isTradable(row.c)}>Trade</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={newOpen} onClose={() => setNewOpen(false)} title="Open a new session">
        <div className="p-4 sm:p-5 grid gap-4">
          <p className="text-[14.5px] text-ink-2">
            A new session starts again with $100,000.00 and a fresh clock. Your current session — {s.state.fills.length} fill{s.state.fills.length === 1 ? "" : "s"}, net value {usd(nav)} — is closed{s.state.fills.length ? " and a one-line summary is kept" : ""}. Open positions are not settled; they are simply abandoned.
          </p>
          <div>
            <label htmlFor="start-round" className="eyebrow block mb-1">Start at round</label>
            <select id="start-round" className="field !font-sans !text-[15px]" value={startRound} onChange={(e) => setStartRound(Number(e.target.value))}>
              {season.rounds.map((r) => <option key={r.round} value={r.round}>Round {r.round} — {r.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end flex-wrap">
            <button className="btn" onClick={() => setNewOpen(false)}>Keep my session</button>
            <button className="btn btn-you" onClick={() => { setNewOpen(false); void app.newSession(startRound); }}>Start new session</button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
