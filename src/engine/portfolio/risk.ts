/**
 * Portfolio risk from the joint simulation.
 *
 * Related contracts are not independent bets: a WIN, a POD and a PTS contract
 * on the same driver all pay in the same scenarios. Rather than assume a
 * correlation, risk is measured by revaluing the whole book in each simulated
 * race (and, for title contracts, each simulated season) and reading the
 * distribution of settlement values directly.
 */
import type { Contract } from "../market/contracts";
import { positionValue, type Position } from "./ledger";

export interface ScenarioRisk {
  sims: number;
  /** Current mark value of the positions covered, in cents. */
  markValue: number;
  /** Mean / percentiles of settlement value minus mark value, in cents. */
  mean: number;
  stdev: number;
  p05: number;
  p50: number;
  p95: number;
  /** Mean of the worst 5% of scenarios. */
  es05: number;
  worst: number;
  best: number;
  probLoss: number;
  /** Histogram of scenario P&L (cents) for display. */
  histogram: { lo: number; hi: number; count: number }[];
}

export function scenarioRisk(
  positions: Position[],
  contractOf: (id: string) => Contract | undefined,
  mark: (id: string) => number,
  payoff: (c: Contract, m: number) => 0 | 1,
  sims: number,
): ScenarioRisk | null {
  const live = positions.filter((p) => p.q !== 0 && contractOf(p.contractId));
  if (live.length === 0 || sims === 0) return null;
  const markValue = live.reduce((acc, p) => acc + positionValue(p, mark(p.contractId)), 0);
  const pnl = new Float64Array(sims);
  for (const p of live) {
    const c = contractOf(p.contractId)!;
    for (let m = 0; m < sims; m++) {
      const y = payoff(c, m);
      pnl[m] += p.q >= 0 ? p.q * 100 * y : -p.q * 100 * (1 - y);
    }
  }
  let mean = 0;
  for (let m = 0; m < sims; m++) {
    pnl[m] -= markValue;
    mean += pnl[m];
  }
  mean /= sims;
  let varSum = 0;
  let losses = 0;
  for (let m = 0; m < sims; m++) {
    varSum += (pnl[m] - mean) ** 2;
    if (pnl[m] < -0.5) losses++;
  }
  const sorted = Float64Array.from(pnl).sort();
  const at = (qv: number) => sorted[Math.min(sims - 1, Math.max(0, Math.floor(qv * sims)))];
  const tail = Math.max(1, Math.floor(0.05 * sims));
  let es = 0;
  for (let k = 0; k < tail; k++) es += sorted[k];
  const lo = sorted[0];
  const hi = sorted[sims - 1];
  const bins = 24;
  const width = (hi - lo) / bins || 1;
  const histogram = Array.from({ length: bins }, (_, k) => ({ lo: lo + k * width, hi: lo + (k + 1) * width, count: 0 }));
  for (let m = 0; m < sims; m++) histogram[Math.min(bins - 1, Math.floor((pnl[m] - lo) / width))].count++;
  return {
    sims, markValue, mean, stdev: Math.sqrt(varSum / sims), p05: at(0.05), p50: at(0.5), p95: at(0.95),
    es05: es / tail, worst: lo, best: hi, probLoss: losses / sims, histogram,
  };
}

/**
 * Exact worst-case loss versus current marks, in cents (a positive number).
 *
 * Within a mutually exclusive group (race winner, each title) at most one
 * contract can pay, so the worst case is found by trying every possible
 * winner plus "none of them". Other contracts are taken at their individual
 * worst case, which is conservative.
 */
export function worstCaseLoss(positions: Position[], contractOf: (id: string) => Contract | undefined, mark: (id: string) => number): number {
  const groups = new Map<string, Position[]>();
  let loss = 0;
  for (const p of positions) {
    if (p.q === 0) continue;
    const c = contractOf(p.contractId);
    const value = positionValue(p, mark(p.contractId));
    if (c && (c.kind === "WIN" || c.kind === "WDC" || c.kind === "WCC")) {
      const key = `${c.kind}:${c.raceId ?? c.season}`;
      groups.set(key, [...(groups.get(key) ?? []), p]);
    } else {
      loss += value; // the position can settle at zero
    }
  }
  for (const group of groups.values()) {
    const markValue = group.reduce((acc, p) => acc + positionValue(p, mark(p.contractId)), 0);
    // Settlement value if none of the held subjects wins:
    const noneWins = group.reduce((acc, p) => acc + (p.q < 0 ? -p.q * 100 : 0), 0);
    let worst = noneWins;
    for (const winner of group) {
      // `winner` pays YES; every other held contract in the group resolves NO.
      const value = noneWins + (winner.q > 0 ? winner.q * 100 : winner.q * 100);
      worst = Math.min(worst, value);
    }
    loss += markValue - worst;
  }
  return Math.max(0, loss);
}
