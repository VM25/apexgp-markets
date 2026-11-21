/**
 * Performance and attribution for a finite, event-driven trading experiment.
 *
 * Deliberately absent: annualised Sharpe ratios. A handful of race-length
 * holding periods has no meaningful annualisation, so results are reported per
 * event (per race) with their sample size, alongside drawdown, hit rate,
 * execution costs and a comparison of prices paid with outcomes.
 */
import type { ContractKind } from "../market/contracts";
import type { FillRecord, NavPoint, RaceSummary, SessionState, SettlementRecord } from "../session/session";

export interface Drawdown {
  maxDrawdown: number; // cents, positive
  maxDrawdownPct: number;
  peak: number;
  trough: number;
}

export function drawdown(history: NavPoint[]): Drawdown {
  let peak = -Infinity;
  let best: Drawdown = { maxDrawdown: 0, maxDrawdownPct: 0, peak: 0, trough: 0 };
  for (const p of history) {
    if (p.nav > peak) peak = p.nav;
    const dd = peak - p.nav;
    if (dd > best.maxDrawdown) best = { maxDrawdown: dd, maxDrawdownPct: peak > 0 ? dd / peak : 0, peak, trough: p.nav };
  }
  return best;
}

export interface EventStats {
  n: number;
  mean: number;
  stdev: number;
  best: number;
  worst: number;
  positive: number;
  /** mean / stdev of per-race P&L; reported only for n >= 5 and never annualised. */
  ratio: number | null;
}

export function eventStats(races: RaceSummary[], settledRounds: number[]): EventStats {
  const pnl = races.filter((r) => settledRounds.includes(r.round)).map((r) => r.navEnd - r.navStart);
  const n = pnl.length;
  if (n === 0) return { n: 0, mean: 0, stdev: 0, best: 0, worst: 0, positive: 0, ratio: null };
  const mean = pnl.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? pnl.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const stdev = Math.sqrt(variance);
  return {
    n, mean, stdev, best: Math.max(...pnl), worst: Math.min(...pnl), positive: pnl.filter((x) => x > 0).length,
    ratio: n >= 5 && stdev > 0 ? mean / stdev : null,
  };
}

export interface ExecutionCosts {
  fills: number;
  contracts: number;
  notional: number;
  fees: number;
  /** Cost versus the quoted mid at the time of each fill (half-spread plus ladder impact), cents. */
  spread: number;
  /** Part of the above caused by trading through the best quote. */
  impact: number;
  /** Sum over fills of (model fair value − price paid) in own-side terms: positive = traded at better-than-model prices. */
  modelEdge: number;
  maker: number;
}

export function executionCosts(fills: FillRecord[]): ExecutionCosts {
  const out: ExecutionCosts = { fills: fills.length, contracts: 0, notional: 0, fees: 0, spread: 0, impact: 0, modelEdge: 0, maker: 0 };
  for (const f of fills) {
    const own = (yes: number) => (f.side === "YES" ? yes : 100 - yes);
    const sign = f.action === "BUY" ? 1 : -1;
    out.contracts += f.qty;
    out.notional += f.qty * f.price;
    out.fees += f.fee;
    out.spread += sign * f.qty * (f.price - own(f.mid * 100));
    if (f.touch !== null && f.liquidity === "taker") out.impact += sign * f.qty * (f.price - own(f.touch));
    out.modelEdge += sign * f.qty * (own(f.fair * 100) - f.price);
    if (f.liquidity === "maker") out.maker++;
  }
  return out;
}

export interface SettledStats {
  n: number;
  wins: number;
  hitRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number | null;
  /** Average own-side price paid (as a probability) and how often those contracts paid. */
  avgEntry: number;
  realisedFrequency: number;
}

export function settledStats(settlements: SettlementRecord[]): SettledStats {
  const n = settlements.length;
  if (n === 0) return { n: 0, wins: 0, hitRate: 0, avgWin: 0, avgLoss: 0, profitFactor: null, avgEntry: 0, realisedFrequency: 0 };
  const wins = settlements.filter((s) => s.realized > 0);
  const losses = settlements.filter((s) => s.realized < 0);
  const gross = wins.reduce((a, s) => a + s.realized, 0);
  const lost = -losses.reduce((a, s) => a + s.realized, 0);
  let qty = 0;
  let basis = 0;
  let paid = 0;
  for (const s of settlements) {
    const q = Math.abs(s.q);
    qty += q;
    basis += s.basis;
    const ownPayoff = s.q > 0 ? s.payoff : 1 - s.payoff;
    paid += q * ownPayoff;
  }
  return {
    n, wins: wins.length, hitRate: wins.length / n,
    avgWin: wins.length ? gross / wins.length : 0, avgLoss: losses.length ? lost / losses.length : 0,
    profitFactor: lost > 0 ? gross / lost : null,
    avgEntry: qty ? basis / qty / 100 : 0, realisedFrequency: qty ? paid / qty : 0,
  };
}

export interface Attribution {
  key: string;
  label: string;
  realized: number;
  fees: number;
  fills: number;
  settled: number;
}

const KIND_LABEL: Record<ContractKind, string> = {
  WIN: "Race winner", POD: "Podium", PTS: "Points finish", DNF: "Not classified", H2H: "Head-to-head", WDC: "Drivers' title", WCC: "Constructors' title",
};

export function byKind(state: SessionState): Attribution[] {
  const map = new Map<string, Attribution>();
  const get = (k: ContractKind) => {
    if (!map.has(k)) map.set(k, { key: k, label: KIND_LABEL[k], realized: 0, fees: 0, fills: 0, settled: 0 });
    return map.get(k)!;
  };
  for (const f of state.fills) {
    const a = get(f.kind);
    a.realized += f.realized;
    a.fees += f.fee;
    a.fills++;
  }
  for (const s of state.settlements) {
    const a = get(s.kind);
    a.realized += s.realized;
    a.settled++;
  }
  return [...map.values()].sort((a, b) => b.realized - b.fees - (a.realized - a.fees));
}

export function byRace(state: SessionState): Attribution[] {
  return state.races.map((r) => {
    const fills = state.fills.filter((f) => f.round === r.round);
    const settled = state.settlements.filter((s) => s.round === r.round);
    return {
      key: String(r.round), label: r.name,
      realized: fills.reduce((a, f) => a + f.realized, 0) + settled.reduce((a, s) => a + s.realized, 0),
      fees: fills.reduce((a, f) => a + f.fee, 0), fills: fills.length, settled: settled.length,
    };
  });
}
