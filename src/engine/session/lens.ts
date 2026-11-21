/**
 * RaceLens — everything that can be derived from one race's observations up to
 * a given frame, with no account state: forecasts, fair values, the dealer's
 * baseline quotes. Used by both the trading session and the read-only review.
 *
 * Frames are computed strictly in order and cached, and frame n is computed
 * from `race.frames` rows <= n only.
 */
import { fairValue, raceContracts, scenarioPayoff, seasonContracts, type Contract } from "../market/contracts";
import { emptyBook, quote, stepBook, type BookState, type Quote, type QuoteContext } from "../market/quote";
import { coefficientsAt } from "../model/features";
import { forecastFrame, raceRandoms, type RaceForecast, type RaceRandoms } from "../model/forecast";
import { buildTitleContext, titleForecast, type TitleContext, type TitleForecast } from "../model/title";
import type { ModelFile, RaceFile } from "../types";

export interface FrameSummary {
  win: number[];
  podium: number[];
  points: number[];
  nc: number[];
  netPos: number[];
  netGap: number[];
  /** Win-stage strength contribution of each feature bucket per driver: contrib[d][bucket]. */
  contrib: number[][];
}

export const EXPLAIN_BUCKETS = [
  { key: "position", label: "Track position", features: ["lpos", "pos"] },
  { key: "gap", label: "Gap to the leader", features: ["gapl"] },
  { key: "net", label: "Pit-adjusted position", features: ["lnpos", "npos"] },
  { key: "netgap", label: "Pit-adjusted gap", features: ["ngap", "rate"] },
  { key: "lead", label: "Lead margin", features: ["lead"] },
  { key: "pit", label: "Stops made vs the field", features: ["pit"] },
  { key: "down", label: "Laps down", features: ["down"] },
  { key: "grid", label: "Starting grid", features: ["lgrid"] },
  { key: "form", label: "Driver and team form", features: ["dform", "tform"] },
] as const;

export class RaceLens {
  readonly race: RaceFile;
  readonly model: ModelFile;
  readonly randoms: RaceRandoms;
  readonly titleCtx: TitleContext;
  readonly contracts: Contract[];
  readonly indexOf: Map<string, number>;
  /** Number of frames (race.laps + 1). The last frame is the chequered flag and is not tradable. */
  readonly totalFrames: number;

  private fair: Float32Array[] = [];
  private variance: Float32Array[] = [];
  private summaries: FrameSummary[] = [];
  private last: { frame: number; forecast: RaceForecast; title: TitleForecast } | null = null;
  private bucketIdx: number[][];

  constructor(race: RaceFile, model: ModelFile, points: { race: number[]; sprint: number[] }) {
    this.race = race;
    this.model = model;
    this.randoms = raceRandoms(race);
    this.titleCtx = buildTitleContext(race, model, points);
    this.contracts = [...raceContracts(race), ...seasonContracts(race, this.titleCtx)];
    this.indexOf = new Map(this.contracts.map((c, i) => [c.id, i]));
    this.totalFrames = race.frames.n;
    this.bucketIdx = EXPLAIN_BUCKETS.map((b) => b.features.map((f) => model.features.order.indexOf(f)));
  }

  get computedThrough(): number {
    return this.fair.length - 1;
  }

  /** Compute and cache every frame up to and including n. */
  ensure(n: number): void {
    const target = Math.min(n, this.totalFrames - 1);
    for (let k = this.fair.length; k <= target; k++) {
      const forecast = forecastFrame(this.race, k, this.model, this.randoms);
      const title = titleForecast(this.titleCtx, forecast);
      const fair = new Float32Array(this.contracts.length);
      for (let i = 0; i < this.contracts.length; i++) {
        fair[i] = fairValue(this.contracts[i], forecast, this.randoms, this.titleCtx, title);
      }
      const prev = k > 0 ? this.fair[k - 1] : null;
      const prevVar = k > 0 ? this.variance[k - 1] : null;
      const variance = new Float32Array(this.contracts.length);
      if (prev && prevVar) {
        for (let i = 0; i < fair.length; i++) {
          const book = stepBook({ ...emptyBook(), variance: prevVar[i], lastFair: prev[i] }, fair[i]);
          variance[i] = book.variance;
        }
      }
      const coef = coefficientsAt(forecast.features.basis, this.model)[0];
      const contrib = forecast.features.X.map((x) =>
        this.bucketIdx.map((idx) => idx.reduce((acc, f) => acc + (f >= 0 ? x[f] * coef[f] : 0), 0)),
      );
      this.fair.push(fair);
      this.variance.push(variance);
      this.summaries.push({
        win: forecast.win, podium: forecast.podium, points: forecast.points, nc: forecast.nc,
        netPos: forecast.features.netPos, netGap: forecast.features.netGap, contrib,
      });
      this.last = { frame: k, forecast, title };
    }
  }

  fairAt(n: number): Float32Array {
    this.ensure(n);
    return this.fair[Math.min(n, this.totalFrames - 1)];
  }

  summaryAt(n: number): FrameSummary {
    this.ensure(n);
    return this.summaries[Math.min(n, this.totalFrames - 1)];
  }

  /** Fair-value path of one contract over frames 0..n. */
  path(contractId: string, n: number): number[] {
    this.ensure(n);
    const i = this.indexOf.get(contractId);
    if (i === undefined) return [];
    const out: number[] = [];
    for (let k = 0; k <= Math.min(n, this.totalFrames - 1); k++) out.push(this.fair[k][i]);
    return out;
  }

  /** Full joint simulation of frame n (recomputed if it is not the most recent one). */
  scenario(n: number): { forecast: RaceForecast; title: TitleForecast } {
    this.ensure(n);
    if (this.last && this.last.frame === n) return this.last;
    const forecast = forecastFrame(this.race, n, this.model, this.randoms);
    const title = titleForecast(this.titleCtx, forecast);
    this.last = { frame: n, forecast, title };
    return this.last;
  }

  payoffIn(n: number): (c: Contract, m: number) => 0 | 1 {
    const { forecast, title } = this.scenario(n);
    return (c, m) => scenarioPayoff(c, m, forecast, this.randoms, this.titleCtx, title);
  }

  quoteContext(c: Contract, n: number): QuoteContext {
    const ctx: QuoteContext = { kind: c.kind, status: this.race.frames.status[n], frame: n, totalFrames: this.totalFrames };
    if (c.scope === "season") {
      ctx.seasonFramesLeft = Math.max(1, this.totalFrames - 1 - n) + this.race.calendar.gpsLeft * 60;
    }
    return ctx;
  }

  /** Market-wide part of a book at frame n (realised variance); inventory fields are zero. */
  marketBook(contractId: string, n: number): BookState {
    this.ensure(n);
    const i = this.indexOf.get(contractId)!;
    return { inv: 0, usedBid: 0, usedAsk: 0, variance: this.variance[n][i], lastFair: this.fair[n][i] };
  }

  /** The dealer's quote at frame n before any of the user's own inventory impact. */
  baseQuote(contractId: string, n: number): Quote {
    const i = this.indexOf.get(contractId)!;
    const c = this.contracts[i];
    return quote(this.fairAt(n)[i], this.marketBook(contractId, n), this.quoteContext(c, n));
  }
}
