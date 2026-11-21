"use client";

import { useState } from "react";
import { LapRuler } from "@/charts/LapRuler";
import type { RaceLens } from "@/engine/session/lens";
import { useApp } from "@/state/hooks";
import { SPEEDS } from "@/state/store";
import { dateShort, tone, usd } from "@/ui/format";
import { Dialog, SectionHead, StatusFlag } from "@/ui/primitives";
import { GapMap } from "./GapMap";
import { ContenderChart, EventFeed, RacePositions, TimingTower } from "./RaceBoard";

type Pane = "timing" | "map" | "chart" | "feed";

function RaceHeader({ lens, frame, eyebrow }: { lens: RaceLens; frame: number; eyebrow: string }) {
  const race = lens.race;
  const n = Math.min(frame, lens.totalFrames - 1);
  const w = race.frames.weather[n];
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display text-[26px] sm:text-[36px] mt-1 break-words">{race.name}</h1>
        <p className="text-[13.5px] text-ink-2 mt-1">
          {race.circuit.name}, {race.circuit.locality} · {dateShort(race.date)} {race.season} · {race.laps} laps · {race.drivers.length} cars{race.sprintWeekend ? " · sprint weekend" : ""}
        </p>
      </div>
      {w && (
        <dl className="flex gap-4 text-[13px]" aria-label="Recorded weather">
          <div><dt className="eyebrow">Air</dt><dd className="num">{w.air ?? "—"}°C</dd></div>
          <div><dt className="eyebrow">Track</dt><dd className="num">{w.track ?? "—"}°C</dd></div>
          <div><dt className="eyebrow">Rain</dt><dd className="num">{w.rain ? "Yes" : "No"}</dd></div>
        </dl>
      )}
    </div>
  );
}

export function RaceView() {
  const app = useApp();
  const s = app.session!;
  const [pane, setPane] = useState<Pane>("timing");
  const [picker, setPicker] = useState(false);
  const review = app.review;

  if (review) return <ReviewBoard />;

  const lens = s.lens;
  const race = lens.race;
  const { frame, phase, round } = s.state;
  const marks = s.state.fills.filter((f) => f.round === round).map((f) => ({ frame: f.frame, kind: f.action === "BUY" ? ("buy" as const) : ("sell" as const) }));
  const highlight = new Set<number>();
  for (const p of s.positions()) {
    const c = s.contract(p.contractId);
    if (c && c.scope === "race" && c.index >= 0) highlight.add(c.index);
  }
  const summary = s.state.races.find((r) => r.round === round);
  const racePnl = summary ? s.nav() - summary.navStart : 0;
  const trade = (i: number) => {
    const c = lens.contracts.find((x) => x.kind === "WIN" && x.index === i);
    if (c) app.openTicket(c.id, "YES", "BUY");
  };
  const next = s.nextRound();

  const tower = <TimingTower lens={lens} frame={frame} session={s} onTrade={phase === "pre" || phase === "live" ? trade : undefined} />;
  const map = <GapMap lens={lens} frame={frame} highlight={highlight} />;
  const chart = <ContenderChart lens={lens} frame={frame} />;
  const feed = <EventFeed lens={lens} frame={frame} />;

  return (
    <div className="grid gap-5">
      <header className="grid gap-3 rise">
        <RaceHeader lens={lens} frame={frame} eyebrow={`Round ${round} of ${race.calendar.roundsTotal} · replay of the recorded race — not live`} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-2">
            <StatusFlag status={race.frames.status[Math.min(frame, lens.totalFrames - 1)]} phase={phase === "live" ? undefined : phase} />
            <span className="num text-[13.5px]">{phase === "pre" ? "Starting grid" : `After lap ${Math.min(frame, race.laps)} of ${race.laps}`}</span>
          </span>
          <span className="text-[13.5px] text-ink-2">This race: <span className={`num font-medium ${tone(racePnl)}`}>{usd(racePnl, { sign: true })}</span></span>
          <button className="btn btn-sm btn-quiet ml-auto" onClick={() => setPicker(true)}>Review another race</button>
        </div>
        <div className="md:hidden"><LapRuler frames={race.frames} frame={frame} marks={marks} /></div>
        {(phase === "pre" || phase === "live") && (
          <div className="md:hidden flex items-center gap-2">
            <div className="seg flex-1" role="group" aria-label="Playback speed">
              {SPEEDS.map((sp, i) => (
                <button key={sp.label} className="flex-1 !px-1 num" aria-pressed={app.speed === i} onClick={() => app.setSpeed(i)}>{sp.label}</button>
              ))}
            </div>
            <button className="btn btn-sm !min-h-[43px]" onClick={() => void app.runToFlag()} disabled={!s.canAdvance() || !!app.busy}>To flag</button>
          </div>
        )}
      </header>

      {phase === "pre" && (
        <div className="sheet !border-ink border-2 p-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex-1 min-w-[240px]">
            <p className="font-bold text-[16px]">The cars are on the grid.</p>
            <p className="text-[14px] text-ink-2 mt-0.5">Markets are open. Take a position now, or start the clock and trade as the race unfolds — every lap brings recorded information, a new estimate and a new quote.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-solid" onClick={() => app.play()}>▶ Start the race</button>
            <button className="btn" onClick={() => app.step()}>Step one lap</button>
          </div>
        </div>
      )}
      {phase === "flag" && (
        <div className="bg-ink text-paper p-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex-1 min-w-[240px]">
            <p className="font-bold text-[16px]">Chequered flag.</p>
            <p className="text-[14px] opacity-80 mt-0.5">Markets are closed. Contracts settle on the official classification — which can differ from the order on the road if the stewards intervene.</p>
          </div>
          <button className="btn btn-you" onClick={() => void app.settle()} disabled={!!app.busy}>Settle on the official result</button>
        </div>
      )}
      {phase === "settled" && (
        <div className="sheet !border-ink border-2 p-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex-1 min-w-[240px]">
            <p className="font-bold text-[16px]">Round {round} has settled.</p>
            <p className="text-[14px] text-ink-2 mt-0.5">{next !== null ? "Your title contracts carry over. The clock only moves forward: open the next round when you are ready." : "That was the final round. The championship contracts have settled too."}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn" onClick={() => void app.openReview(round)}>Review this race</button>
            {next !== null && <button className="btn btn-solid" onClick={() => void app.nextRound()} disabled={!!app.busy}>Open round {next} →</button>}
          </div>
        </div>
      )}

      {/* Phones and small tablets: one pane at a time */}
      <div className="lg:hidden">
        <div className="seg w-full mb-3" role="tablist" aria-label="Race view">
          {(["timing", "map", "chart", "feed"] as Pane[]).map((p) => (
            <button key={p} role="tab" aria-selected={pane === p} className="flex-1 capitalize !px-1" onClick={() => setPane(p)}>{p === "feed" ? "Events" : p}</button>
          ))}
        </div>
        <div className={pane === "timing" ? "" : "hidden"}>{tower}</div>
        {pane === "map" && map}
        {pane === "chart" && chart}
        {pane === "feed" && feed}
        <div className="mt-6">
          <SectionHead title="Your positions" />
          <RacePositions />
        </div>
      </div>

      {/* Laptops and up: everything at once */}
      <div className="hidden lg:grid grid-cols-[minmax(380px,5fr)_minmax(0,6fr)] 2xl:grid-cols-[minmax(420px,5fr)_minmax(0,6fr)_minmax(300px,3.4fr)] gap-6 2xl:gap-8 items-start">
        <section aria-label="Timing"><SectionHead idx="01" title="Timing · recorded" />{tower}</section>
        <div className="grid gap-6 min-w-0">
          <section aria-label="Probabilities"><SectionHead idx="02" title="Contenders" />{chart}</section>
          <section aria-label="Gap map"><SectionHead idx="03" title="Gap map" />{map}</section>
          <div className="2xl:hidden grid xl:grid-cols-2 gap-6">
            <section><SectionHead idx="04" title="Your positions" /><RacePositions /></section>
            <section><SectionHead idx="05" title="Events" /><div className="max-h-[420px] overflow-y-auto scroll-thin pr-1" tabIndex={0} role="region" aria-label="Race events">{feed}</div></section>
          </div>
        </div>
        <div className="hidden 2xl:grid gap-6 sticky top-[calc(var(--shell-top)+20px)]">
          <section><SectionHead idx="04" title="Your positions" /><RacePositions /></section>
          <section><SectionHead idx="05" title="Events" /><div className="max-h-[52dvh] overflow-y-auto scroll-thin pr-1" tabIndex={0} role="region" aria-label="Race events">{feed}</div></section>
        </div>
      </div>

      <ReviewPicker open={picker} onClose={() => setPicker(false)} />
    </div>
  );
}

function ReviewPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const s = app.session!;
  const [confirm, setConfirm] = useState<number | null>(null);
  const rounds = app.season?.rounds ?? [];
  const settled = new Set(s.state.settledRounds);
  const go = (round: number) => {
    onClose();
    setConfirm(null);
    void app.openReview(round);
  };
  return (
    <Dialog open={open} onClose={() => { setConfirm(null); onClose(); }} title="Review a race" wide>
      <div className="p-4 sm:p-5">
        <p className="text-[14px] text-ink-2 mb-3 max-w-[60ch]">
          Review is read-only: scrub through any lap and see what the model and the dealer were showing. It runs on its own clock and cannot trade — your session’s clock is untouched.
        </p>
        {confirm !== null ? (
          <div className="border-2 border-ink p-4 bg-sheet">
            <p className="font-bold">Round {confirm} is still ahead of your session.</p>
            <p className="text-[14px] text-ink-2 mt-1">Reviewing it shows how that race unfolded before you have traded it. Nothing stops you — it is public history — but it is no longer a fair test of your judgement.</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <button className="btn" onClick={() => setConfirm(null)}>Back</button>
              <button className="btn btn-solid" onClick={() => go(confirm)}>Review it anyway</button>
            </div>
          </div>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-x-4">
            {rounds.map((r) => {
              const done = settled.has(r.round);
              const ahead = r.round > s.state.round || (r.round === s.state.round && !done);
              return (
                <li key={r.round}>
                  <button className="w-full flex items-center gap-2.5 h-11 border-b border-rule-2 text-left hover:bg-paper-2 px-1" onClick={() => (ahead ? setConfirm(r.round) : go(r.round))}>
                    <span className="num text-[12px] text-ink-3 w-7">R{String(r.round).padStart(2, "0")}</span>
                    <span className="flex-1 truncate text-[14px] font-medium">{r.name}</span>
                    <span className="tag">{done ? "Settled" : ahead ? "Ahead" : "Current"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

/** Read-only review of a race on its own clock. */
function ReviewBoard() {
  const app = useApp();
  const review = app.review!;
  const { lens, frame, settlement } = review;
  const race = lens.race;
  const N = lens.totalFrames - 1;
  const ready = lens.computedThrough >= N;
  const nameOf = (id: string) => race.drivers.find((d) => d.id === id)?.name ?? id;
  return (
    <div className="grid gap-5">
      <div className="hatch border-2 border-ink">
        <div className="bg-paper/85 px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex-1 min-w-[220px]">
            <p className="font-bold">Review — read only</p>
            <p className="text-[13.5px] text-ink-2">A separate clock for looking back. No orders can be placed here, and your trading session is exactly where you left it.</p>
          </div>
          <button className="btn btn-solid btn-sm" onClick={() => app.closeReview()}>← Back to my session</button>
        </div>
      </div>
      <RaceHeader lens={lens} frame={frame} eyebrow={`Round ${race.round} · review of the recorded race`} />
      <div className="sheet p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3 mb-1">
          <label htmlFor="scrub" className="eyebrow">Lap <span className="num text-ink">{frame}</span> of {N}</label>
          <div className="flex items-center gap-2">
            <StatusFlag status={race.frames.status[frame]} phase={frame === 0 ? "pre" : frame === N ? "flag" : undefined} />
            <div className="flex">
              <button className="btn btn-sm !px-0 w-10 border-r-0" onClick={() => app.setReviewFrame(frame - 1)} disabled={frame === 0} aria-label="Previous lap">‹</button>
              <button className="btn btn-sm !px-0 w-10" onClick={() => app.setReviewFrame(frame + 1)} disabled={frame >= N} aria-label="Next lap">›</button>
            </div>
          </div>
        </div>
        <input id="scrub" type="range" className="scrub" min={0} max={ready ? N : lens.computedThrough} value={frame} onChange={(e) => app.setReviewFrame(Number(e.target.value))} aria-valuetext={`Lap ${frame} of ${N}`} />
        <LapRuler frames={race.frames} frame={frame} onSeek={(f) => app.setReviewFrame(f)} />
        {!ready && <p className="text-[12.5px] text-ink-3 mt-1" role="status">Computing estimates lap by lap… {lens.computedThrough + 1}/{N + 1}</p>}
      </div>
      <div className="grid lg:grid-cols-[minmax(360px,5fr)_minmax(0,6fr)] gap-6 items-start">
        <section><SectionHead idx="01" title="Timing · recorded" /><TimingTower lens={lens} frame={frame} session={null} /></section>
        <div className="grid gap-6 min-w-0">
          <section><SectionHead idx="02" title="Contenders" /><ContenderChart lens={lens} frame={frame} /></section>
          <section><SectionHead idx="03" title="Gap map" /><GapMap lens={lens} frame={frame} highlight={new Set()} /></section>
          <section><SectionHead idx="04" title="Events" /><div className="max-h-[360px] overflow-y-auto scroll-thin pr-1" tabIndex={0} role="region" aria-label="Race events"><EventFeed lens={lens} frame={frame} /></div></section>
        </div>
      </div>
      <section>
        <SectionHead idx="05" title="Official classification" />
        {!settlement ? (
          <div className="border border-dashed border-rule p-4 flex flex-wrap items-center gap-3">
            <p className="text-[14px] text-ink-2 flex-1 min-w-[220px]">The result is kept in a separate file from the lap-by-lap observations, and is only fetched when you ask for it.</p>
            <button className="btn" onClick={() => void app.revealReviewResult()}>Show the official result</button>
          </div>
        ) : (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Table, scrolls sideways on small screens">
            <table className="tsheet min-w-[520px]">
              <thead><tr><th>Pos</th><th>Driver</th><th>Status</th><th className="r">Grid</th><th className="r">Laps</th><th className="r">Time / gap</th><th className="r">Points</th></tr></thead>
              <tbody>
                {settlement.classification.map((c) => (
                  <tr key={c.id}>
                    <td className="num font-semibold">{c.classified ? c.position : c.text}</td>
                    <td className="font-medium">{nameOf(c.id)}</td>
                    <td className="text-ink-2">{c.status}</td>
                    <td className="r num">{c.grid || "PL"}</td>
                    <td className="r num">{c.laps}</td>
                    <td className="r num">{c.time ?? "—"}</td>
                    <td className="r num">{c.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {settlement.notes.map((n) => <p key={n} className="text-[13px] text-ink-2 mt-2 border-l-[3px] border-flag-sc pl-3">{n}</p>)}
          </div>
        )}
      </section>
    </div>
  );
}
