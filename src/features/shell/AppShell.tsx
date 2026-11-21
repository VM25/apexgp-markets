"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { LapRuler } from "@/charts/LapRuler";
import { OrderTicket } from "@/features/ticket/OrderTicket";
import { useApp } from "@/state/hooks";
import { SPEEDS } from "@/state/store";
import { pct, tone, usd } from "@/ui/format";
import { Dialog, ErrorNote, SideChip, StatusFlag, Wordmark } from "@/ui/primitives";

const NAV = [
  { href: "/", label: "Overview", icon: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { href: "/markets/", label: "Markets", icon: "M4 19V9m5 10V5m5 14v-8m5 8V7" },
  { href: "/race/", label: "Race", icon: "M4 21V4m0 1h14l-3 4 3 4H4" },
  { href: "/portfolio/", label: "Portfolio", icon: "M3 7h18v13H3zM8 7V4h8v3" },
  { href: "/research/", label: "Research", icon: "M6 3h9l4 4v14H6zM9 12h7M9 16h7M9 8h3" },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href.replace(/\/$/, "")));

export function AppShell({ children }: { children: ReactNode }) {
  const app = useApp();
  const path = usePathname();

  useEffect(() => {
    void app.boot();
    const flush = () => app.saveNow();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [app]);

  // Space toggles the clock when focus is not in a form control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A", "SUMMARY"].includes(t.tagName) || t.isContentEditable) return;
      if (document.querySelector("dialog[open]")) return;
      if (e.key === " ") {
        e.preventDefault();
        app.toggle();
      } else if (e.key === "." || e.key === "ArrowRight") {
        if ((t.tagName === "svg" || t.closest("svg")) && e.key === "ArrowRight") return;
        app.pause();
        app.step();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [app]);

  const s = app.session;
  const nav = s ? s.nav() : 0;
  const pnl = s ? nav - s.state.ledger.startCash : 0;

  return (
    <>
      <a href="#main" className="sr-only-focusable fixed top-2 left-2 z-[100] btn btn-solid btn-sm">Skip to content</a>
      <header className="sticky top-0 z-50 bg-paper/95 backdrop-blur-[6px] border-b-2 border-ink">
        {/* Desktop: brand, navigation, account */}
        <div className="hidden lg:flex items-center gap-6 h-[52px] px-6 3xl:px-10 border-b border-rule">
          <Link href="/" aria-label="ApexGP Markets — overview"><Wordmark /></Link>
          <nav aria-label="Primary" className="flex items-stretch h-full ml-2">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(path, n.href) ? "page" : undefined}
                className={`relative flex items-center px-3.5 text-[13.5px] font-semibold tracking-wide transition-colors ${isActive(path, n.href) ? "text-ink" : "text-ink-3 hover:text-ink"}`}
              >
                {n.label}
                {isActive(path, n.href) && <span className="absolute inset-x-3 -bottom-px h-[3px] bg-you" />}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-5">
            {s && (
              <Link href="/portfolio/" className="flex items-baseline gap-4 group" aria-label="Open portfolio">
                <span className="flex items-baseline gap-1.5">
                  <span className="eyebrow">NAV</span>
                  <span className="num text-[15px] font-medium group-hover:underline underline-offset-4">{usd(nav)}</span>
                </span>
                <span className={`num text-[13px] ${tone(pnl)}`}>{usd(pnl, { sign: true })}</span>
                <span className="flex items-baseline gap-1.5">
                  <span className="eyebrow">Free cash</span>
                  <span className="num text-[13px]">{usd(s.available(), { decimals: 0 })}</span>
                </span>
              </Link>
            )}
          </div>
        </div>
        <ClockStrip />
      </header>

      <main id="main" className="px-4 sm:px-6 3xl:px-10 pt-5 lg:pt-7 pb-[calc(var(--shell-bottom)+40px)] max-w-[1760px] mx-auto min-h-[60dvh]">
        {app.status === "error" ? (
          <div className="max-w-xl mx-auto mt-10">
            <ErrorNote message={app.error ?? "The race data could not be loaded."} onRetry={() => app.retry()} />
          </div>
        ) : app.status === "boot" || !s ? (
          <BootScreen label={app.busy} />
        ) : (
          children
        )}
      </main>

      <footer className="hidden lg:block px-6 3xl:px-10 py-5 border-t border-rule text-[12.5px] text-ink-3 max-w-[1760px] mx-auto">
        ApexGP Markets is a simulation for research and education. Fictional capital only: no real-money trading, wagering or account connections. Race data © their sources (Jolpica F1, OpenF1; CC BY-NC-SA 4.0). Unofficial and not associated with Formula 1 companies. <Link href="/research/#data" className="underline underline-offset-2">Sources and methods</Link>.
      </footer>

      {/* Phone / tablet: bottom tab bar */}
      <nav aria-label="Primary" className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-paper/97 backdrop-blur border-t-2 border-ink grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {NAV.map((n) => {
          const active = isActive(path, n.href);
          return (
            <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={`relative flex flex-col items-center justify-center gap-0.5 h-[58px] ${active ? "text-ink" : "text-ink-3"}`}>
              {active && <span className="absolute top-0 inset-x-4 h-[3px] bg-you" />}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="square" aria-hidden="true"><path d={n.icon} /></svg>
              <span className="text-[11px] font-semibold tracking-wide">{n.label}</span>
            </Link>
          );
        })}
      </nav>

      <Toasts />
      <TicketDialog />
      <SettlementDialog />
      {app.busy && app.status === "ready" && (
        <div role="status" className="fixed z-[70] left-1/2 -translate-x-1/2 bottom-[calc(var(--shell-bottom)+16px)] bg-ink text-paper px-4 h-10 flex items-center gap-2.5 text-[13.5px] font-medium shadow-[4px_4px_0_var(--color-you)]">
          <span className="w-2 h-2 bg-you live-dot" />
          {app.busy}…
        </div>
      )}
    </>
  );
}

function BootScreen({ label }: { label: string | null }) {
  return (
    <div className="max-w-md mx-auto mt-[14dvh] text-center" role="status">
      <div className="inline-block"><Wordmark /></div>
      <div className="mt-6 h-[3px] bg-paper-3 overflow-hidden relative">
        <div className="absolute inset-y-0 w-1/3 bg-ink" style={{ animation: "boot-slide 1.1s ease-in-out infinite" }} />
      </div>
      <p className="eyebrow mt-3">{label ?? "Loading the 2025 season"}…</p>
      <style>{`@keyframes boot-slide { 0% { left: -33%; } 100% { left: 100%; } }`}</style>
    </div>
  );
}

/** The market clock: round, lap, track status and transport. One clock for the whole product. */
function ClockStrip() {
  const app = useApp();
  const s = app.session;
  if (!s) return <div className="h-[44px] lg:h-[44px]" />;
  const race = s.lens.race;
  const { frame, phase, round } = s.state;
  const N = s.totalFrames - 1;
  const status = race.frames.status[Math.min(frame, N)];
  const marks = s.state.fills.filter((f) => f.round === round).map((f) => ({ frame: f.frame, kind: f.action === "BUY" ? ("buy" as const) : ("sell" as const) }));
  const canAdvance = s.canAdvance();
  const next = s.nextRound();
  return (
    <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 h-[50px] lg:h-[44px] px-3 sm:px-6 3xl:px-10">
      <Link href="/" className="lg:hidden shrink-0" aria-label="Overview"><Wordmark compact /></Link>
      <Link href="/race/" className="flex items-baseline gap-2 min-w-0 shrink" aria-label={`Round ${round}, ${race.name}. Open the race view.`}>
        <span className="num text-[12px] font-semibold bg-ink text-paper px-1.5 py-0.5 shrink-0">R{String(round).padStart(2, "0")}</span>
        <span className="font-semibold text-[13.5px] truncate hidden sm:inline">{race.name.replace("Grand Prix", "GP")}</span>
        <span className="num text-[13px] text-ink-2 shrink-0 whitespace-nowrap">
          {phase === "pre" ? "Grid" : `L${Math.min(frame, N)}`}
          <span className="text-ink-3">/{N}</span>
        </span>
      </Link>
      <span className="shrink-0"><StatusFlag status={status} phase={phase === "live" ? undefined : phase} compact /></span>
      <div className="hidden md:block flex-1 min-w-[120px] max-w-[720px]">
        <LapRuler frames={race.frames} frame={frame} marks={marks} height={30} label={false} />
      </div>
      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        {phase === "flag" ? (
          <button className="btn btn-you btn-sm" onClick={() => void app.settle()} disabled={!!app.busy}>Settle<span className="hidden sm:inline">&nbsp;race</span></button>
        ) : phase === "settled" ? (
          next !== null ? (
            <button className="btn btn-solid btn-sm" onClick={() => void app.nextRound()} disabled={!!app.busy}>Open round {next} →</button>
          ) : (
            <span className="tag">Season complete</span>
          )
        ) : (
          <>
            <button className="btn btn-solid btn-sm !px-0 w-11" onClick={() => app.toggle()} aria-label={app.playing ? "Pause the race clock" : "Play the race clock"} aria-pressed={app.playing} disabled={!canAdvance || !!app.busy}>
              {app.playing ? (
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="1" width="3.5" height="12" fill="currentColor" /><rect x="8.5" y="1" width="3.5" height="12" fill="currentColor" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1l10 6-10 6z" fill="currentColor" /></svg>
              )}
            </button>
            <button className="btn btn-sm !px-0 w-11" onClick={() => { app.pause(); app.step(); }} aria-label="Advance one lap" disabled={!canAdvance || !!app.busy}>
              <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true"><path d="M2 1l8 6-8 6z" fill="currentColor" /><rect x="11.5" y="1" width="2.5" height="12" fill="currentColor" /></svg>
            </button>
            <label className="sr-only" htmlFor="speed">Playback speed</label>
            <select id="speed" className="btn btn-sm !px-2 num appearance-none text-center bg-transparent hidden xs:block" value={app.speed} onChange={(e) => app.setSpeed(Number(e.target.value))}>
              {SPEEDS.map((sp, i) => <option key={sp.label} value={i}>{sp.label}</option>)}
            </select>
            <button className="btn btn-sm hidden sm:inline-flex" onClick={() => void app.runToFlag()} disabled={!canAdvance || !!app.busy} title="Run the clock to the chequered flag">To flag</button>
          </>
        )}
      </div>
    </div>
  );
}

function Toasts() {
  const app = useApp();
  return (
    <div className="fixed z-[80] right-3 sm:right-5 top-[calc(var(--shell-top)+10px)] grid gap-2 w-[min(340px,calc(100vw-24px))]" aria-live="polite">
      {app.toasts.map((t) => (
        <div key={t.id} className="sheet !border-ink border-2 px-3.5 py-2.5 shadow-[4px_4px_0_rgb(20_22_26/0.16)] flex gap-3 items-start" style={{ animation: "rise 220ms ease-out both" }}>
          <span className="mt-1.5 w-2 h-2 shrink-0" style={{ background: t.tone === "good" ? "var(--color-gain)" : t.tone === "bad" ? "var(--color-loss)" : "var(--color-ink)" }} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[13.5px] leading-snug">{t.title}</p>
            {t.body && <p className="text-[13px] text-ink-2 num leading-snug mt-0.5">{t.body}</p>}
          </div>
          <button className="text-ink-3 hover:text-ink -mr-1 w-7 h-7 flex items-center justify-center shrink-0" onClick={() => app.dismissToast(t.id)} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  );
}

/** The ticket as a dialog: used from the race view and on small screens. */
function TicketDialog() {
  const app = useApp();
  const s = app.session;
  const id = app.ticket.contractId;
  const c = s && id ? s.contract(id) : undefined;
  const open = app.ticket.open && !!c;
  const q = c && s ? s.quoteFor(c.id) : null;
  return (
    <Dialog open={open} onClose={() => app.closeTicket()} title={c ? c.title : "Order"}>
      {open && c && q && (
        <div className="p-4 sm:p-5 grid gap-3">
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="text-ink-2">{c.question}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 border-y border-rule py-2 text-center">
            <div><div className="eyebrow">Model</div><div className="num text-model font-medium">{pct(q.fair)}</div></div>
            <div><div className="eyebrow">Buy YES</div><div className="num font-medium">{q.bestAsk !== null ? `${q.bestAsk}¢` : "—"}</div></div>
            <div><div className="eyebrow">Buy NO</div><div className="num font-medium">{q.bestBid !== null ? `${100 - q.bestBid}¢` : "—"}</div></div>
          </div>
          <OrderTicket key={c.id} contractId={c.id} />
        </div>
      )}
    </Dialog>
  );
}

function SettlementDialog() {
  const app = useApp();
  const v = app.settlementView;
  const s = app.session;
  const next = s?.nextRound() ?? null;
  const top = v?.settlement.classification.filter((c) => c.classified).slice(0, 3) ?? [];
  const total = v ? v.records.reduce((a, r) => a + r.realized, 0) : 0;
  const nameOf = (id: string) => s?.lens.race.drivers.find((d) => d.id === id)?.name ?? id;
  return (
    <Dialog open={!!v} onClose={() => app.dismissSettlement()} title={v ? `Settled · ${v.raceName}` : "Settlement"} wide>
      {v && (
        <div className="p-4 sm:p-5 grid gap-4">
          <div>
            <p className="eyebrow mb-1.5">Official classification <span className="normal-case tracking-normal text-ink-3">— recorded result, via Jolpica F1</span></p>
            <ol className="grid sm:grid-cols-3 gap-2">
              {top.map((c) => (
                <li key={c.id} className="border border-ink px-3 py-2 flex items-baseline gap-2 bg-sheet">
                  <span className="display text-[20px]">P{c.position}</span>
                  <span className="font-semibold text-[14px] truncate">{nameOf(c.id)}</span>
                </li>
              ))}
            </ol>
            {v.settlement.notes.length > 0 && (
              <ul className="mt-2 text-[13px] text-ink-2 border-l-[3px] border-flag-sc pl-3 grid gap-0.5">
                {v.settlement.notes.map((n) => <li key={n}>{n}</li>)}
              </ul>
            )}
          </div>
          <div>
            <p className="eyebrow mb-1.5">Your contracts</p>
            {v.records.length === 0 ? (
              <p className="text-[14px] text-ink-2 border border-dashed border-rule p-3">You had no open positions in this race. Nothing to settle.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="tsheet min-w-[460px]">
                  <thead><tr><th>Contract</th><th>Held</th><th>Resolved</th><th className="r">Paid in</th><th className="r">Paid out</th><th className="r">Profit / loss</th></tr></thead>
                  <tbody>
                    {v.records.map((r) => {
                      const side = r.q > 0 ? "YES" : "NO";
                      const won = (r.q > 0) === (r.payoff === 1);
                      return (
                        <tr key={r.contractId}>
                          <td className="font-medium">{r.title}</td>
                          <td><span className="inline-flex items-center gap-1.5"><SideChip side={side} /><span className="num">{Math.abs(r.q).toLocaleString("en-US")}</span></span></td>
                          <td><span className={r.payoff ? "side-yes" : "side-no"}>{r.payoff ? "YES" : "NO"}</span></td>
                          <td className="r num">{usd(r.basis)}</td>
                          <td className="r num">{usd(won ? Math.abs(r.q) * 100 : 0)}</td>
                          <td className={`r num font-semibold ${tone(r.realized)}`}>{usd(r.realized, { sign: true })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 border-t-2 border-ink pt-3">
            <div><div className="eyebrow">Settled P&amp;L</div><div className={`num text-[20px] font-medium ${tone(total)}`}>{usd(total, { sign: true })}</div></div>
            <div><div className="eyebrow">NAV before</div><div className="num text-[16px]">{usd(v.navBefore)}</div></div>
            <div><div className="eyebrow">NAV after</div><div className="num text-[16px] font-medium">{usd(v.navAfter)}</div></div>
          </div>
          {v.seasonSettled && (
            <p className="bg-ink text-paper px-3 py-2.5 text-[14px]">The season is complete and the championship contracts have settled on the final official standings.</p>
          )}
          <div className="flex flex-wrap gap-2 justify-end">
            <button className="btn" onClick={() => app.dismissSettlement()}>Close</button>
            {next !== null && <button className="btn btn-solid" onClick={() => void app.nextRound()}>Open round {next} →</button>}
          </div>
        </div>
      )}
    </Dialog>
  );
}
