"use client";

import { useState, type ReactNode } from "react";
import { FEES, INVENTORY, RISK_LIMITS, SPREAD, STATUS_DEPTH, STATUS_INFO } from "@/engine/market/params";
import { SIMS } from "@/engine/model/forecast";
import { TITLE_SIMS } from "@/engine/model/title";
import { loadDiagnostics, loadMarketReference, loadProvenance } from "@/state/data";
import { useApp, useData } from "@/state/hooks";
import { ErrorNote, ProvenanceLegend, Skeleton } from "@/ui/primitives";
import { CoefficientCurves, EVENT_LABEL, MODEL_LABEL, QuoteLab, Reliability } from "./ResearchCharts";

const TOC = [
  ["truth", "What is real here"],
  ["data", "Data"],
  ["contracts", "Contracts"],
  ["model", "Forecasting model"],
  ["validation", "Validation"],
  ["market", "Market microstructure"],
  ["accounting", "Accounting and risk"],
  ["limits", "Limitations"],
  ["history", "What changed from v2"],
] as const;

function Sec({ id, n, title, children }: { id: string; n: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-[calc(var(--shell-top)+16px)]">
      <div className="section-head mb-4">
        <span className="idx">{n}</span>
        <h2 id={`${id}-h`} className="display text-[19px] sm:text-[22px]">{title}</h2>
      </div>
      <div className="grid gap-5">{children}</div>
    </section>
  );
}

const P = ({ children }: { children: ReactNode }) => <div className="prose-sheet"><p>{children}</p></div>;
const fmt = (v: number | undefined, d = 4) => (v === undefined || v === null ? "—" : v.toFixed(d));

export function ResearchView() {
  const app = useApp();
  const model = app.model!;
  const diag = useData(loadDiagnostics, "diagnostics");
  const prov = useData(loadProvenance, "provenance");
  const ref = useData(loadMarketReference, "market-reference");
  const [event, setEvent] = useState("win");
  const [sample, setSample] = useState<"wf" | "2025">("wf");
  const d = diag.data;
  const tr = model.training;

  return (
    <div className="grid lg:grid-cols-[200px_minmax(0,1fr)] gap-8 xl:gap-14">
      <aside className="hidden lg:block">
        <nav aria-label="Sections" className="sticky top-[calc(var(--shell-top)+24px)]">
          <p className="eyebrow mb-2">Contents</p>
          <ol className="grid border-l border-rule">
            {TOC.map(([id, label], i) => (
              <li key={id}>
                <a href={`#${id}`} className="flex gap-2 pl-3 py-1.5 text-[13.5px] text-ink-2 hover:text-ink hover:border-l-2 hover:border-you hover:-ml-px">
                  <span className="num text-[11.5px] text-ink-3 w-5">{String(i + 1).padStart(2, "0")}</span>{label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>

      <article className="grid gap-12 min-w-0 max-w-[1000px]">
        <header className="rise">
          <p className="eyebrow">Methods, measurements and limits</p>
          <h1 className="display text-[30px] sm:text-[42px] mt-1">Research</h1>
          <div className="prose-sheet mt-4">
            <p>
              This page documents what ApexGP Markets actually computes, with the measured results of the shipped model and the parameters of the shipped market. Every number in a table below is read from the build’s own output files, not typed in by hand. Where something is an assumption rather than a measurement, it says so.
            </p>
          </div>
          <nav aria-label="Sections" className="lg:hidden flex flex-wrap gap-1.5 mt-3">
            {TOC.map(([id, label]) => <a key={id} href={`#${id}`} className="tag !h-8 !px-2.5 !text-[11.5px]">{label}</a>)}
          </nav>
        </header>

        <Sec id="truth" n="01" title="What is real here, and what is not">
          <P>
            ApexGP is a replay, not a market that ever existed. Three different kinds of number appear on every screen, and the interface keeps them visibly apart because confusing them is the easiest way for a simulation to mislead.
          </P>
          <div className="sheet p-4"><ProvenanceLegend /></div>
          <P>
            <strong>Recorded</strong> data — positions, gaps, pit stops, tyres, flags, classifications, points — comes from public timing sources and is checked against a second source. <strong>Estimated</strong> probabilities come from a statistical model fitted on earlier seasons; they are forecasts and can be wrong. <strong>Simulated</strong> prices come from a rule-based dealer that quotes around the model’s estimate. No exchange quoted these prices in 2025 and none of the trades happened. The replay is never presented as live.
          </P>
        </Sec>

        <Sec id="data" n="02" title="Data">
          <P>
            The previous version of this project shipped files in a folder called “official” that were produced by a script: invented grids, a safety car every third round, the same driver retiring on lap 31, and points smeared evenly across the season. They have been removed. The current data is built by a reproducible pipeline (<span className="code">pipeline/</span>) from sources chosen field by field.
          </P>
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0" tabIndex={0} role="region" aria-label="Table, scrolls sideways on small screens">
            <table className="tsheet min-w-[760px]">
              <thead><tr><th>Source</th><th>Used for</th><th>Coverage / grain</th><th>Licence</th><th>Decision</th></tr></thead>
              <tbody>
                <tr><td className="font-semibold">Jolpica F1</td><td>Official classification, grid, lap chart, pit-stop laps, calendar, standings</td><td>1950–present; per lap, per driver</td><td>CC BY-NC-SA 4.0</td><td><b>Primary</b> for the official record</td></tr>
                <tr><td className="font-semibold">OpenF1</td><td>Race start instant, track status, tyres, weather, race control; circuit traces</td><td>2023–present; timestamped</td><td>CC BY-NC-SA 4.0</td><td><b>Primary</b> for context; cross-check for timing</td></tr>
                <tr><td className="font-semibold">Kaggle F1 archive</td><td>Model training and walk-forward validation only</td><td>{prov.data ? `${prov.data.sources.kaggle.coverage.results.first_season}–${prov.data.sources.kaggle.coverage.results.last_season} results; laps from ${prov.data.sources.kaggle.coverage.lap_times.first_season}; pit stops from ${prov.data.sources.kaggle.coverage.pit_stops.first_season}` : "1950–2024"}</td><td>CC0</td><td><b>Training</b>; the title says “1950–2020” but the files run to 2024</td></tr>
                <tr><td className="font-semibold">FastF1</td><td>—</td><td>Timing archive now answers HTTP 401</td><td>MIT (code)</td><td><b>Rejected</b>: its data backend needs an F1 TV login, so a build could not be reproduced</td></tr>
                <tr><td className="font-semibold">TUMFTM track database</td><td>—</td><td>Covers 16 of the 24 circuits raced in 2025</td><td>LGPL-3.0</td><td><b>Rejected</b>: incomplete; outlines are traced from OpenF1 position samples instead</td></tr>
              </tbody>
            </table>
          </div>
          <P>
            Each race file contains observations only. The official result lives in a separate settlement file that the app requests when a race is being settled or deliberately reviewed. Entrants are stored in grid order, never in finishing order, so that not even the order of an array can leak an outcome.
          </P>
          <h3 className="font-bold text-[17px]">Cross-source checks for every 2025 round</h3>
          {prov.error ? <ErrorNote message={prov.error} onRetry={prov.reload} /> : !prov.data ? <Skeleton /> : <QualityTable quality={prov.data.quality} />}
          {d && (
            <P>
              Points are recomputed from finishing positions and checked against the published tables: across {d.replay["2025"].standings_check.rounds} rounds there {d.replay["2025"].standings_check.rounds_with_differences.length === 0 ? "is no round" : `are ${d.replay["2025"].standings_check.rounds_with_differences.length} rounds`} where the recomputed drivers’ or constructors’ standings differ from the published ones, and {d.replay["2025"].points_rule_violations.length} results that break the points rule. Lap counts differ from the official classification only for disqualified cars, whose official lap count is zeroed.
            </P>
          )}
        </Sec>

        <Sec id="contracts" n="03" title="Contracts and settlement">
          <P>
            Every contract is a binary claim. One YES contract pays $1.00 if the stated event is true in the official classification and nothing otherwise; one NO contract pays $1.00 in exactly the opposite case. A YES and a NO on the same event are together worth $1.00 for certain, which is why the app nets them instead of letting an account hold both.
          </P>
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0" tabIndex={0} role="region" aria-label="Table, scrolls sideways on small screens">
            <table className="tsheet min-w-[640px]">
              <thead><tr><th>Market</th><th>Pays $1.00 if…</th><th>Structure</th></tr></thead>
              <tbody>
                <tr><td className="font-semibold">Race winner</td><td>the driver is classified first</td><td>exactly one contract in the race pays</td></tr>
                <tr><td className="font-semibold">Podium</td><td>the driver is classified in the top three</td><td>three pay</td></tr>
                <tr><td className="font-semibold">Points finish</td><td>the driver is classified in the top ten</td><td>ten pay</td></tr>
                <tr><td className="font-semibold">Not classified</td><td>the driver has no numeric finishing position (retired, disqualified, did not start)</td><td>independent per driver</td></tr>
                <tr><td className="font-semibold">Team-mate head-to-head</td><td>the first-named driver is ahead of the team-mate in the official results order</td><td>one per two-car team</td></tr>
                <tr><td className="font-semibold">Drivers’ / constructors’ title</td><td>the subject leads the final official standings</td><td>one pays, after the last round</td></tr>
              </tbody>
            </table>
          </div>
          <P>
            Settlement uses the official classification, including penalties and disqualifications applied after the flag — in 2025 that changed the result in several rounds. The model cannot foresee a steward’s decision, so a contract can be quoted near 99¢ at the flag and still settle at zero. That is a real feature of event contracts, and it is why markets close at the flag but settle on a separate, later fact. A fastest-lap market existed in the old version and has been dropped: the 2025 rules award no point for it, and the old one settled on whoever started third.
          </P>
        </Sec>

        <Sec id="model" n="04" title="Forecasting model">
          <P>
            The model answers one question at each lap: given what the timing screen shows now, how likely is each finishing order? It was fitted on {tr.races} races from {tr.first_season}–{tr.last_season} ({tr.snapshots.toLocaleString("en-US")} lap-by-lap snapshots) and has never seen 2025.
          </P>
          <h3 className="font-bold text-[17px]">Information time</h3>
          <P>
            A “frame” is a snapshot of the race. Frame <i>n</i> contains every line crossing strictly before the instant the first car completes lap <i>n</i>+1: every car on the lead lap has finished lap <i>n</i>, and lapped cars are shown where they actually were at that instant rather than at their own, later, lap <i>n</i>. Training frames (from the archive) and replay frames (from 2025) are produced by the same function, so the model is served exactly the definitions it was fitted on. A car that has not crossed the line during the leader’s last two laps is treated as stopped — the same rule in training and replay, using nothing from the future.
          </P>
          <h3 className="font-bold text-[17px]">Structure</h3>
          <pre className="formula" tabIndex={0} role="region" aria-label="Formula">{`strength of car i at stage g:   u_i(g) = Σ_f  β_f,g(s) · x_i,f           s = share of race distance completed
finishing order (given who is classified): stage-wise logit
   P(car i takes the next place) = exp(u_i(g)) / Σ_remaining exp(u_j(g))     g = winner | 2nd–3rd | 4th onward
not classified:                 h_i = logistic( w · z_i )
one simulated race:             draw "not classified" for each running car (prob. h_i), then draw the order stage by stage`}</pre>
          <P>
            This is a rank-ordered (“exploded”) logit with one extension: the coefficients are allowed to differ between the fight for the win, the rest of the podium and everything behind, because what separates first from second is not what separates tenth from eleventh. Each coefficient is a piecewise-linear function of race progress, so the weight on track position rises through the race while the weight on grid slot and form fades. Thirteen features feed the order model: running position and gap, their pit-adjusted versions (cars that owe a stop are charged {model.constants.pitLossS} seconds), the leader’s margin, the closing rate needed, stops made relative to the field, laps down, grid slot, and driver and team form ratings computed only from earlier rounds.
          </P>
          <CoefficientCurves model={model} />
          <P>
            Every race contract is read off the same {SIMS.toLocaleString("en-US")} simulated races, so related markets cannot contradict each other: win probabilities sum to one, a driver’s win probability never exceeds their podium probability, and the two sides of a head-to-head sum to one. The random numbers are fixed per race and reused at every lap, so an estimate moves only when its inputs move. Title contracts add {TITLE_SIMS.toLocaleString("en-US")} simulated remainders of the season on top of the race in progress, using current standings, the published calendar and form ratings — nothing from later rounds.
          </P>
          <h3 className="font-bold text-[17px]">How look-ahead is ruled out</h3>
          <P>
            The old engine blended its estimate toward the eventual result with a weight that grew through the race, which guaranteed convergence and guaranteed leakage. Here the forecasting function receives a frame index and can read only that frame and the one before. Two automated tests enforce it: the pipeline truncates the raw timing at each frame’s cutoff and requires the frames to be identical, and the app’s test suite overwrites every later frame with nonsense and requires bit-identical forecasts and quotes. The result file is not an input at all.
          </P>
        </Sec>

        <Sec id="validation" n="05" title="Validation">
          {diag.error ? <ErrorNote message={diag.error} onRetry={diag.reload} /> : !d ? <Skeleton rows={6} /> : (
            <>
              <P>
                Walk-forward test: for each season {d.walkForward.testSeasons[0]}–{d.walkForward.testSeasons[d.walkForward.testSeasons.length - 1]} the model is refitted on all earlier seasons and scored on that season, then the results are pooled. The comparison that matters is against a position-frequency table — the historical frequency of each outcome given running position and race phase — which is what a careful person with a spreadsheet would use.
              </P>
              <ScoreTable title={`Pooled walk-forward, ${d.walkForward.testSeasons.length} test seasons`} pooled={d.walkForward.pooled} />
              <P>
                The stage-wise model beats the table on Brier score and log loss for the win, podium and points markets, and it is the added structure that fixes calibration for winners: the plain rank-ordered logit is under-confident about race leaders (expected calibration error {fmt(d.walkForward.pooled.win.plain_rol.ece)} against {fmt(d.walkForward.pooled.win.stagewise.ece)}). For the points market the plain model is fractionally better on Brier score; the stage-wise model is kept because one coherent model across all markets matters more than a fourth decimal. The not-classified model barely improves on a constant base rate — retirements are close to unpredictable from timing data, and the page says so rather than dressing it up.
              </P>

              <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] gap-6 items-start">
                <div>
                  <h3 className="font-bold text-[17px] mb-2">Out of sample: the 2025 season</h3>
                  <p className="text-[14.5px] text-ink-2 mb-3">
                    The shipped model was fitted through {tr.last_season} and then scored on all {d.replay["2025"].races} rounds of 2025 — {d.replay["2025"].driver_snapshots.toLocaleString("en-US")} driver-laps it had never seen. These are the same estimates the app shows.
                  </p>
                  <ReplayTable scores={d.replay["2025"].scores} />
                </div>
                <div className="sheet p-4">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <div className="seg" role="group" aria-label="Sample">
                      <button className="!min-h-[34px] !px-2.5" aria-pressed={sample === "wf"} onClick={() => setSample("wf")}>Walk-forward</button>
                      <button className="!min-h-[34px] !px-2.5" aria-pressed={sample === "2025"} onClick={() => setSample("2025")}>2025</button>
                    </div>
                    <label className="sr-only" htmlFor="rel-event">Market</label>
                    <select id="rel-event" className="field !min-h-[36px] !text-[13.5px] !font-sans !w-auto pr-7" value={event} onChange={(e) => setEvent(e.target.value)}>
                      {Object.entries(EVENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <Reliability title={`Reliability of ${EVENT_LABEL[event]} estimates`} bins={sample === "wf" ? d.walkForward.reliability[event].stagewise : d.replay["2025"].reliability[event]} />
                </div>
              </div>
              <P>
                A calibrated model’s points sit on the diagonal. Two caveats belong next to this chart. Laps within one race are highly dependent, so 2025 is closer to 24 independent observations than to {d.replay["2025"].driver_snapshots.toLocaleString("en-US")}; and in 2025 leaders converted more often than the 2014–2024 record suggested, so mid-range win estimates were somewhat too low that year. Approaching 0% and 100% as the flag nears is not evidence of calibration — every forecast does that.
              </P>

              <h3 className="font-bold text-[17px]">Brier score by race phase (walk-forward)</h3>
              <ProgressTable byProgress={d.walkForward.byProgress} event={event} />

              <h3 className="font-bold text-[17px]">Title contracts</h3>
              <TitleTable title={d.title} />
              <P>
                The old version priced titles as each driver’s share of points among five hand-picked names. Scored the same way, that heuristic is roughly three times worse than the simulation. A simpler rule — “whoever leads the standings wins” — beats the simulation from mid-season onward in this sample, because in all {d.title.drivers.seasons.length} test seasons the mid-season leader went on to win. Six champions is a very small sample; the honest reading is that the simulation is well calibrated but has not been shown to beat that naive rule late in a season.
              </P>
            </>
          )}
        </Sec>

        <Sec id="market" n="06" title="Market microstructure">
          <P>
            ApexGP does not run a central limit order book. Calling it one would be false: there are no other traders. There is one automated dealer per contract, and you are its only counterparty. The dealer quotes a ladder of bids and offers around a reservation price, and your orders execute against that ladder.
          </P>
          <pre className="formula" tabIndex={0} role="region" aria-label="Formula">{`σ²          = ½ · EWMA(Δp²)  +  ½ · p(1−p) / laps_left
half-spread = ${SPREAD.floor} + ${SPREAD.curvature}·√(p(1−p)) + ${SPREAD.informed} · σ · info(status)            (capped at ${SPREAD.cap})
reservation = p − ${INVENTORY.skew} · (inventory / top size) · half-spread             (at most ±${INVENTORY.maxSkewHalfSpreads} half-spreads)
best ask    = ⌈reservation + half-spread⌉ to the cent,   best bid = ⌊reservation − half-spread⌋
info(status):  grid ${STATUS_INFO.GRID} · green ${STATUS_INFO.GREEN} · yellow ${STATUS_INFO.YELLOW} · VSC ${STATUS_INFO.VSC} · safety car ${STATUS_INFO.SC} · red flag: quotes pulled
depth shown:   green 100% · yellow ${STATUS_DEPTH.YELLOW * 100}% · VSC ${STATUS_DEPTH.VSC * 100}% · safety car ${STATUS_DEPTH.SC * 100}%`}</pre>
          <P>
            The p(1−p)/laps_left term is not arbitrary. A probability that must finish at 0 or 1 has exactly p(1−p) of variance left to spend; spread evenly over the remaining laps, that is the expected size of the next move. The dealer charges a share of it because a counterparty may know something the model has not yet priced — the standard adverse-selection argument for a spread. The spread therefore widens at the start, under a safety car and after volatile laps, and narrows in a settled race. A constant four-cent spread, as in the old version, has none of this.
          </P>
          <QuoteLab />
          <P>
            <strong>Inventory and impact.</strong> When you buy, the dealer is left short and shades both its quotes upward; a share of that inventory ({INVENTORY.decay * 100}%) is laid off each lap and the quotes drift back. Your orders move the price temporarily but never the model’s estimate: the dealer does not learn from your flow, because in a replay the user may simply know the result. Depth is finite — large orders walk the ladder, pay more on average, and can be partially filled — and half of consumed depth returns each lap.
          </P>
          <P>
            <strong>Limit orders.</strong> A resting order is filled only when the dealer’s opposite quote reaches it, at your price, for at most the size the dealer shows there. That means a resting bid fills precisely when the estimate has fallen to it — you buy because the news was bad. Resting orders save the spread and pay a lower fee, and are picked off for it. The portfolio page reports both effects.
          </P>
          <h3 className="font-bold text-[17px]">Calibration against real venues</h3>
          {ref.error ? <ErrorNote message={ref.error} onRetry={ref.reload} /> : !ref.data ? <Skeleton /> : <VenueTable data={ref.data} />}
          <P>
            Fees follow Kalshi’s published schedule: {FEES.takerCoef * 100}% × contracts × price × (1 − price), rounded up to the cent, for orders that take liquidity, and a quarter of that ({FEES.makerCoef * 100}%) for resting orders that are filled — the rate Kalshi applies on its F1 race-winner and podium series. The three spread constants were set so that the dealer’s pre-race spread falls inside the measured interquartile range at each price level (checked by an automated test). Depth is deliberately <em>not</em> calibrated: real F1 books showed a median of roughly 30–250 contracts at the best price, and the dealer shows several times that so a $100,000 account can express a view. Spread is measured; depth, inventory decay and the status multipliers are assumptions.
          </P>
        </Sec>

        <Sec id="accounting" n="07" title="Accounting and risk">
          <pre className="formula" tabIndex={0} role="region" aria-label="Formula">{`position         q  = signed YES quantity      (q < 0 is a NO holding of |q| contracts)
cash on a fill   −Δq · price − fee            cash at settlement   q · $1 · payoff
free cash        cash − $1·Σ max(0, −q) − cash reserved for resting buys
net asset value  cash + Σ q · mark             =  start + realised + unrealised − fees`}</pre>
          <P>
            Money is carried in integer cents. Buying NO at (100 − bid) is the same trade as selling YES at the bid with the $1.00 payout fully collateralised, so nothing can lose more than was paid for it. The identity on the last line is checked by property-based tests over random sequences of fills and settlements. Settlement is idempotent — settling a race twice changes nothing — and the session clock only moves forward: there is no rewinding after seeing a result, no trading a race that has settled, and no opening a later round before the current one has settled. Looking back happens in a separate read-only review that cannot place orders.
          </P>
          <P>
            <strong>Risk is measured on the joint simulation.</strong> A win, a podium and a points contract on one driver are not three independent bets. Rather than assume correlations, the portfolio page revalues the whole book in each simulated race and reports the resulting distribution: expected value, chance of a loss, and the average of the worst 5% of outcomes. Separately, an exact worst case nets mutually exclusive contracts (at most one driver can win) and is the basis for two pre-trade limits: no single contract may put more than {RISK_LIMITS.perContract * 100}% of net asset value at risk, and the worst case across the book may not exceed {RISK_LIMITS.total * 100}%.
          </P>
          <P>
            <strong>What is deliberately missing.</strong> The old version multiplied lap-to-lap returns by √252 and called the result an annualised Sharpe ratio. Laps are not trading days and a race is not a year. Performance here is reported per race with its sample size, alongside drawdown, hit rate, the average price paid against how often those contracts paid, and a breakdown of execution costs. The contract “Greeks” of the old version are gone too: they were formulas of the form mid × (1 − mid) × constant with no underlying sensitivity behind them. The one sensitivity that matters — how a position’s value changes across outcomes — is what the scenario distribution shows.
          </P>
        </Sec>

        <Sec id="limits" n="08" title="Limitations and failure modes">
          <ul className="grid gap-3 prose-sheet !text-[16.5px]">
            {[
              ["You may know the result.", "This is history. The simulation teaches how information becomes price and what trading costs; it cannot test foresight. That is also why the dealer ignores your order flow."],
              ["One dealer, no crowd.", "There are no competing traders, no queue, no hidden liquidity, no news-driven order flow. Spread was fitted to one snapshot of two venues on one weekend; depth and dynamics are assumptions."],
              ["The model is blind to several things.", "It does not see tyre compound or age, track status, weather, damage or team orders — the training archive has none of them. A safety car reaches it only through the gaps it compresses. Pit loss is one constant for every circuit."],
              ["Retirements are nearly unpredictable.", "The not-classified model has almost no skill beyond a base rate, and it treats cars’ retirements as independent, which understates multi-car incidents."],
              ["Stewards.", "Post-race penalties and disqualifications are outside the model. Contracts close at the flag and settle on a later fact."],
              ["Title forecasts assume today’s grid.", "Mid-season driver changes and car development are not foreseen; form ratings update only between rounds."],
              ["Stopped cars are recognised late.", "A retirement is known to the model up to two laps after it happens. In that window its markets can be stale."],
              ["Small samples.", "One season is 24 races. Per-race statistics on the portfolio page should be read with that in mind."],
              ["Data rights.", "Timing data is redistributed under CC BY-NC-SA 4.0 from unofficial community sources. This project is non-commercial and unaffiliated with Formula 1."],
            ].map(([t, body]) => (
              <li key={t} className="border-l-[3px] border-ink pl-3"><strong>{t}</strong> {body}</li>
            ))}
          </ul>
        </Sec>

        <Sec id="history" n="09" title="What changed from the June 2026 version">
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0" tabIndex={0} role="region" aria-label="Table, scrolls sideways on small screens">
            <table className="tsheet min-w-[680px]">
              <thead><tr><th>Area</th><th>Before</th><th>Now</th></tr></thead>
              <tbody>
                <tr><td className="font-semibold">Race data</td><td>Script-generated grids, safety cars, retirements and points, labelled “official”</td><td>Recorded timing from two public sources, cross-checked round by round</td></tr>
                <tr><td className="font-semibold">Pricing</td><td>Blend toward the known final result with weight (lap ÷ laps)<sup>1.6</sup>, called “Bayesian”</td><td>Rank-ordered logit fitted on earlier seasons; look-ahead excluded by construction and by test</td></tr>
                <tr><td className="font-semibold">Fastest lap</td><td>Settled on whoever started third</td><td>Market removed</td></tr>
                <tr><td className="font-semibold">Spread</td><td>Mid ± 2¢, always</td><td>State-dependent dealer with inventory, depth, fees; calibrated to measured spreads</td></tr>
                <tr><td className="font-semibold">Risk</td><td>Heuristic “Greeks”; flat exposure caps</td><td>Joint-scenario distribution; exact netted worst case</td></tr>
                <tr><td className="font-semibold">Performance</td><td>Lap returns × √252 as “Sharpe”</td><td>Per-race statistics, drawdown, cost attribution</td></tr>
                <tr><td className="font-semibold">Session integrity</td><td>Resetting or switching races liquidated at stale prices; races could be replayed for profit</td><td>One forward-only clock, idempotent settlement, read-only review</td></tr>
                <tr><td className="font-semibold">Titles</td><td>Five hard-coded drivers, points share</td><td>Every driver and constructor; season simulation</td></tr>
              </tbody>
            </table>
          </div>
          <P>
            The full audit, architecture notes and reproduction steps are in the repository’s <span className="code">docs/</span> folder. The June 2026 implementation is preserved at the git tag <span className="code">legacy-v2-june-2026</span>.
          </P>
        </Sec>
      </article>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function QualityTable({ quality }: { quality: Record<string, Any> }) {
  const rows = Object.entries(quality);
  const avg = (f: (q: Any) => number | undefined) => {
    const vals = rows.map(([, q]) => f(q)).filter((v): v is number => typeof v === "number");
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
  };
  const cells = rows.reduce((a, [, q]) => a + (q.chart_position_cells ?? 0), 0);
  return (
    <div className="grid gap-3">
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 border-y border-rule py-3">
        <div><dt className="eyebrow">Driver-laps checked</dt><dd className="num text-[20px]">{cells.toLocaleString("en-US")}</dd></div>
        <div><dt className="eyebrow">Lap chart re-derived</dt><dd className="num text-[20px]">{(avg((q) => q.chart_position_agreement) * 100).toFixed(2)}%</dd></div>
        <div><dt className="eyebrow">Lap times within 5 ms</dt><dd className="num text-[20px]">{(avg((q) => q.lap_time_crosscheck?.share_within_5ms) * 100).toFixed(1)}%</dd></div>
        <div><dt className="eyebrow">Pit stops matched</dt><dd className="num text-[20px]">{(avg((q) => q.pit_crosscheck?.jaccard) * 100).toFixed(1)}%</dd></div>
      </dl>
      <details className="sheet">
        <summary className="px-4 h-11 flex items-center font-semibold text-[14px] cursor-pointer select-none">Show all {rows.length} rounds</summary>
        <div className="overflow-x-auto px-4 pb-4" tabIndex={0} role="region" aria-label="Table, scrolls sideways on small screens">
          <table className="tsheet min-w-[720px] !text-[13px]">
            <thead><tr><th>Round</th><th className="r">Driver-laps</th><th className="r">Positions agree</th><th className="r">Winner time Δ</th><th className="r">Lap times ≤5 ms</th><th className="r">Clock residual</th><th className="r">Pit match</th><th className="r">Result diffs</th><th className="r">Lap-count notes</th></tr></thead>
            <tbody>
              {rows.map(([id, q]) => (
                <tr key={id}>
                  <td className="num">{id}</td>
                  <td className="r num">{q.chart_position_cells}</td>
                  <td className="r num">{(q.chart_position_agreement * 100).toFixed(1)}%</td>
                  <td className="r num">{Math.abs(q.winner_time_diff_s ?? 0).toFixed(3)} s</td>
                  <td className="r num">{q.lap_time_crosscheck ? `${(q.lap_time_crosscheck.share_within_5ms * 100).toFixed(1)}%` : "—"}</td>
                  <td className="r num">{q.clock_alignment ? `${q.clock_alignment.median_abs_residual_s.toFixed(3)} s` : "—"}</td>
                  <td className="r num">{q.pit_crosscheck?.jaccard !== undefined ? `${(q.pit_crosscheck.jaccard * 100).toFixed(0)}%` : "—"}</td>
                  <td className="r num">{q.classification_crosscheck?.differences?.length ?? "—"}</td>
                  <td className="r">{q.lap_count_mismatch?.length ? `${q.lap_count_mismatch.length} DSQ` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[12.5px] text-ink-3 mt-2">Positions agree: the published lap chart against positions re-derived from cumulative lap times. Winner time Δ: summed lap times against the official race time. Lap times and pit stops: Jolpica against OpenF1. Clock residual: median disagreement between the two sources’ lap-end instants after aligning race start.</p>
        </div>
      </details>
    </div>
  );
}

function ScoreTable({ title, pooled }: { title: string; pooled: Record<string, Any> }) {
  const models = ["stagewise", "plain_rol", "position_table", "uniform"];
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0" tabIndex={0} role="region" aria-label="Table, scrolls sideways on small screens">
      <table className="tsheet min-w-[720px]">
        <caption className="text-left eyebrow pb-1.5">{title} · Brier score (lower is better) / log loss / calibration error</caption>
        <thead><tr><th>Market</th><th className="r">Driver-laps</th><th className="r">Base rate</th>{models.map((m) => <th key={m} className="r">{MODEL_LABEL[m].replace(" (shipped)", "")}</th>)}</tr></thead>
        <tbody>
          {Object.keys(EVENT_LABEL).map((e) => {
            const best = Math.min(...models.map((m) => pooled[e][m].brier));
            return (
              <tr key={e}>
                <td className="font-semibold">{EVENT_LABEL[e]}</td>
                <td className="r num">{pooled[e].n.toLocaleString("en-US")}</td>
                <td className="r num">{(pooled[e].base_rate * 100).toFixed(1)}%</td>
                {models.map((m) => (
                  <td key={m} className="r num">
                    <span className={pooled[e][m].brier === best ? "font-semibold underline decoration-you decoration-2 underline-offset-4" : ""}>{fmt(pooled[e][m].brier)}</span>
                    <span className="block text-[11.5px] text-ink-3">{fmt(pooled[e][m].logloss)} · {fmt(pooled[e][m].ece)}</span>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReplayTable({ scores }: { scores: Record<string, Any> }) {
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Table, scrolls sideways on small screens">
      <table className="tsheet min-w-[420px]">
        <thead><tr><th>Market</th><th className="r">Shipped model</th><th className="r">Position table</th><th className="r">Uniform</th><th className="r">vs table</th></tr></thead>
        <tbody>
          {Object.keys(EVENT_LABEL).map((e) => {
            const a = scores[e].all;
            const gain = 1 - a.stagewise.brier / a.position_table.brier;
            return (
              <tr key={e}>
                <td className="font-semibold">{EVENT_LABEL[e]}</td>
                <td className="r num font-semibold">{fmt(a.stagewise.brier)}</td>
                <td className="r num">{fmt(a.position_table.brier)}</td>
                <td className="r num text-ink-2">{fmt(a.uniform.brier)}</td>
                <td className={`r num ${gain > 0 ? "gain" : "loss"}`}>{gain > 0 ? "−" : "+"}{Math.abs(gain * 100).toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[12.5px] text-ink-3 mt-1.5">Brier score over every running car at every lap. “vs table” is the reduction in Brier score relative to the position-frequency table.</p>
    </div>
  );
}

function ProgressTable({ byProgress, event }: { byProgress: Record<string, Any>; event: string }) {
  const rows = Object.entries(byProgress[event] as Record<string, Any>);
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0" tabIndex={0} role="region" aria-label="Table, scrolls sideways on small screens">
      <table className="tsheet min-w-[560px]">
        <caption className="text-left eyebrow pb-1.5">{EVENT_LABEL[event]} · choose the market with the selector above</caption>
        <thead><tr><th>Race phase</th><th className="r">Driver-laps</th><th className="r">Stage-wise</th><th className="r">Plain</th><th className="r">Position table</th><th className="r">Uniform</th></tr></thead>
        <tbody>
          {rows.map(([label, r]) => (
            <tr key={label}>
              <td className="font-semibold">{label === "grid" ? "On the grid" : `${label} of distance`}</td>
              <td className="r num">{r.n.toLocaleString("en-US")}</td>
              <td className="r num font-semibold">{fmt(r.stagewise)}</td>
              <td className="r num">{fmt(r.plain_rol)}</td>
              <td className="r num">{fmt(r.position_table)}</td>
              <td className="r num text-ink-2">{fmt(r.uniform)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TitleTable({ title }: { title: Any }) {
  const dr = title.drivers;
  const phases = Object.entries(dr.by_season_progress as Record<string, Any>);
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0" tabIndex={0} role="region" aria-label="Table, scrolls sideways on small screens">
      <table className="tsheet min-w-[560px]">
        <caption className="text-left eyebrow pb-1.5">Drivers’ title · Brier score of pre-race estimates, seasons {dr.seasons[0]}–{dr.seasons[dr.seasons.length - 1]} (walk-forward)</caption>
        <thead><tr><th>Part of season</th><th className="r">Driver-rounds</th><th className="r">Season simulation</th><th className="r">Leader takes all</th><th className="r">Points share (old)</th></tr></thead>
        <tbody>
          {phases.map(([label, r]) => (
            <tr key={label}>
              <td className="font-semibold capitalize">{label}</td>
              <td className="r num">{r.n}</td>
              <td className="r num font-semibold">{fmt(r.p_model)}</td>
              <td className="r num">{fmt(r.p_leader)}</td>
              <td className="r num text-ink-2">{fmt(r.p_share)}</td>
            </tr>
          ))}
          <tr>
            <td className="font-semibold">Whole season</td>
            <td className="r num">{dr.n}</td>
            <td className="r num font-semibold">{fmt(dr.p_model.brier)}</td>
            <td className="r num">{fmt(dr.p_leader.brier)}</td>
            <td className="r num text-ink-2">{fmt(dr.p_share.brier)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function VenueTable({ data }: { data: Any }) {
  const snap = data.snapshot;
  return (
    <div className="grid gap-2">
      <p className="text-[14.5px] text-ink-2">
        A single snapshot of public order books for Formula 1 markets on Kalshi and Polymarket, taken {new Date(snap.firstBookUtc).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC ({snap.context.split(":")[0]}): {snap.nMarkets} markets listed, {snap.nQuoted} with a two-sided quote, {snap.nTraded24h} traded in the previous 24 hours.
      </p>
      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0" tabIndex={0} role="region" aria-label="Table, scrolls sideways on small screens">
        <table className="tsheet min-w-[560px]">
          <thead><tr><th>Price level</th><th className="r">Markets</th><th className="r">Median spread</th><th className="r">Middle half</th><th className="r">Median size at best</th></tr></thead>
          <tbody>
            {snap.buckets.filter((b: Any) => b.n > 0).map((b: Any) => (
              <tr key={b.lo}>
                <td className="font-semibold num">{Math.round(b.lo * 100)}–{Math.round(b.hi * 100)}¢</td>
                <td className="r num">{b.n}</td>
                <td className="r num font-semibold">{b.median_spread_cents}¢</td>
                <td className="r num text-ink-2">{b.p25_spread_cents}–{b.p75_spread_cents}¢</td>
                <td className="r num">{Math.round(b.median_top_size).toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12.5px] text-ink-3">Measured, not simulated — but one weekend, two venues, and different market designs. These are real-money markets on the 2026 season; they are used only to set the general level of spreads, never as prices for 2025.</p>
    </div>
  );
}
