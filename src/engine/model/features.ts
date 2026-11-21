/**
 * Feature definitions — a one-for-one mirror of pipeline/apexgp/features.py.
 * The golden-vector test (golden.test.ts) pins the two implementations together.
 *
 * Every function here takes a frame index `n` and reads only `frames.*[n]` and
 * `frames.*[n - 1]`, the grid and the pre-race ratings. Nothing later than
 * frame n is reachable from these signatures' call sites (see forecast.ts).
 */
import type { ModelFile, RaceFile } from "../types";

export const N_ORDER = 13;
export const N_HAZARD = 9;

export interface FrameFeatures {
  /** X[d][f] */
  X: number[][];
  /** H[d][f] */
  H: number[][];
  running: boolean[];
  basis: number[];
  /** Pit-adjusted gap to the net leader and net order, for display and explanation. */
  netGap: number[];
  netPos: number[];
  refStops: number;
}

export function basis(n: number, totalLaps: number, knots: number[]): number[] {
  const b = new Array(1 + knots.length).fill(0);
  if (n === 0) {
    b[0] = 1;
    return b;
  }
  const s = Math.min(1, n / Math.max(totalLaps, 1));
  for (let j = 0; j < knots.length - 1; j++) {
    const lo = knots[j];
    const hi = knots[j + 1];
    if (s <= hi || j === knots.length - 2) {
      const w = Math.min(1, Math.max(0, (s - lo) / (hi - lo)));
      b[1 + j] = 1 - w;
      b[2 + j] = w;
      return b;
    }
  }
  return b;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const v = [...values].sort((a, b) => a - b);
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** Stable rank (1 = smallest key); ties resolved by array position, matching numpy's stable argsort. */
function rankOf(keys: number[]): number[] {
  const idx = keys.map((_, i) => i).sort((a, b) => keys[a] - keys[b] || a - b);
  const rank = new Array(keys.length).fill(0);
  idx.forEach((i, r) => (rank[i] = r + 1));
  return rank;
}

export function frameFeatures(race: RaceFile, n: number, model: ModelFile): FrameFeatures {
  const f = race.frames;
  const D = race.drivers.length;
  const N = race.laps;
  const { gapCap, rateCap, leadCap, pitLossS } = model.constants;
  const rem = Math.max(N - n, 0);
  const running = f.stopped[n].map((s) => s === 0);
  const X: number[][] = Array.from({ length: D }, () => new Array(N_ORDER).fill(0));
  const H: number[][] = Array.from({ length: D }, () => new Array(N_HAZARD).fill(0));
  const netGap = new Array(D).fill(0);
  let netPos = race.startRank.slice();
  let refStops = 0;

  if (n > 0) {
    const gap = f.gap[n];
    const pits = f.pits[n];
    const down = f.down[n];
    const refSet: number[] = [];
    for (let i = 0; i < D; i++) if (running[i] && down[i] === 0) refSet.push(pits[i]);
    refStops = median(refSet);
    const eff = gap.map((g, i) => g + pitLossS * Math.max(0, refStops - pits[i]));
    let best = Infinity;
    for (let i = 0; i < D; i++) if (running[i] && eff[i] < best) best = eff[i];
    if (!Number.isFinite(best)) best = 0;
    for (let i = 0; i < D; i++) netGap[i] = running[i] ? eff[i] - best : gapCap;
    netPos = rankOf(eff.map((e, i) => (running[i] ? e : 1e9 + i)));
    const runningGaps = netGap.filter((_, i) => running[i]).sort((a, b) => a - b);
    const second = runningGaps.length >= 2 ? runningGaps[1] : 0;
    for (let i = 0; i < D; i++) {
      const pos = f.pos[n][i];
      X[i][0] = Math.log(pos);
      X[i][1] = pos / 10;
      X[i][2] = Math.min(gap[i], gapCap) / 30;
      X[i][3] = Math.log(netPos[i]);
      X[i][4] = netPos[i] / 10;
      X[i][5] = Math.min(netGap[i], gapCap) / 30;
      X[i][6] = netPos[i] === 1 ? Math.min(second, leadCap) / 10 : 0;
      X[i][7] = Math.min(netGap[i] / (rem + 1), rateCap);
      X[i][8] = Math.min(2, Math.max(-2, pits[i] - refStops));
      X[i][9] = Math.min(down[i], 3);
    }
  }
  const field = Math.min(0.99, Math.max(0.01, race.ratings.fieldNc));
  const lfield = Math.log(field / (1 - field));
  const lrem = Math.log(Math.max(N - n, 1) / Math.max(N, 1));
  for (let i = 0; i < D; i++) {
    const lgrid = Math.log(race.startRank[i]);
    X[i][10] = lgrid;
    X[i][11] = race.ratings.dform[i] - 0.5;
    X[i][12] = race.ratings.tform[i] - 0.5;
    H[i][0] = 1;
    H[i][1] = lrem;
    H[i][2] = n === 0 ? 1 : 0;
    if (n > 0) {
      H[i][3] = Math.min(f.down[n][i], 3);
      H[i][4] = f.down[n][i] > f.down[n - 1][i] ? 1 : 0;
      H[i][5] = Math.log(f.pos[n][i]);
    } else {
      H[i][5] = lgrid;
    }
    H[i][6] = race.ratings.dnc[i] - field;
    H[i][7] = race.ratings.tnc[i] - field;
    H[i][8] = lfield;
  }
  return { X, H, running, basis: basis(n, N, model.features.knots), netGap, netPos, refStops };
}

/** Strengths per stage group: U[g][d] = sum_f sum_b X[d][f] * basis[b] * beta[g][f][b]. */
export function strengths(ff: FrameFeatures, model: ModelFile): number[][] {
  const beta = model.order.beta;
  return beta.map((bg) =>
    ff.X.map((x) => {
      let u = 0;
      for (let f = 0; f < x.length; f++) {
        if (x[f] === 0) continue;
        let coef = 0;
        const row = bg[f];
        for (let b = 0; b < row.length; b++) coef += row[b] * ff.basis[b];
        u += x[f] * coef;
      }
      return u;
    }),
  );
}

/** Coefficient of each feature at this point of the race, per stage group: coef[g][f]. */
export function coefficientsAt(basisVec: number[], model: ModelFile): number[][] {
  return model.order.beta.map((bg) => bg.map((row) => row.reduce((acc, v, b) => acc + v * basisVec[b], 0)));
}

export function hazards(ff: FrameFeatures, model: ModelFile): number[] {
  const w = model.hazard.w;
  return ff.H.map((h) => {
    let z = 0;
    for (let k = 0; k < w.length; k++) z += h[k] * w[k];
    return 1 / (1 + Math.exp(-z));
  });
}
