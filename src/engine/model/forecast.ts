/**
 * Joint race simulation.
 *
 * `forecastFrame(race, n, ...)` is the only way the app obtains probabilities,
 * and it reads `race.frames` at index n (and n-1 for one hazard feature) only.
 * The leakage tests perturb every later frame and require identical output.
 *
 * One simulated race = a draw of which running cars fail to be classified
 * (independent, probability h_i) followed by a stage-by-stage draw of the
 * finishing order among the survivors (stage j: P(car i) proportional to
 * exp(U[group(j)][i])). Every race contract is read off the same draws, so
 * related markets are coherent by construction.
 *
 * Common random numbers: the uniforms are generated once per race and reused
 * at every frame, so a forecast moves only because the inputs moved.
 */
import { hashSeed, uniformTable } from "../rng";
import type { ModelFile, RaceFile } from "../types";
import { frameFeatures, hazards, strengths, type FrameFeatures } from "./features";

export const SIMS = 4000;

export interface RaceRandoms {
  sims: number;
  D: number;
  alive: Float32Array; // [sims * D]
  stage: Float32Array; // [sims * D]
  coin: Float32Array; // [sims]
}

export function raceRandoms(race: RaceFile, sims: number = SIMS): RaceRandoms {
  const D = race.drivers.length;
  const seed = hashSeed(race.id);
  return {
    sims,
    D,
    alive: uniformTable(seed ^ 0x9e3779b9, sims * D),
    stage: uniformTable(seed ^ 0x85ebca6b, sims * D),
    coin: uniformTable(seed ^ 0xc2b2ae35, sims),
  };
}

export interface RaceForecast {
  frame: number;
  D: number;
  sims: number;
  running: boolean[];
  /** Model-estimated probabilities per entrant. */
  win: number[];
  podium: number[];
  points: number[];
  /** Probability of not being classified. */
  nc: number[];
  /** placed[m * D + d] = finishing position among classified cars in simulation m, 0 if not classified. */
  placed: Uint8Array;
  features: FrameFeatures;
  /** Strengths per stage group, U[g][d]. */
  U: number[][];
  hazard: number[];
}

export function forecastFrame(race: RaceFile, n: number, model: ModelFile, rnd: RaceRandoms): RaceForecast {
  const D = race.drivers.length;
  const sims = rnd.sims;
  const ff = frameFeatures(race, n, model);
  const U = strengths(ff, model);
  const h = hazards(ff, model);
  const G = U.length;
  const running = ff.running;

  // exp(U - max) per group, zero for cars that are not running.
  const E: Float64Array[] = [];
  for (let g = 0; g < G; g++) {
    let mx = -Infinity;
    for (let i = 0; i < D; i++) if (running[i] && U[g][i] > mx) mx = U[g][i];
    const e = new Float64Array(D);
    for (let i = 0; i < D; i++) e[i] = running[i] ? Math.exp(U[g][i] - mx) : 0;
    E.push(e);
  }
  const stageGroup = model.stageGroup;
  const win = new Float64Array(D);
  const pod = new Float64Array(D);
  const pts = new Float64Array(D);
  const placed = new Uint8Array(sims * D);
  const alive = new Uint8Array(D);
  const totals = new Float64Array(G);

  for (let m = 0; m < sims; m++) {
    const base = m * D;
    let nAlive = 0;
    totals.fill(0);
    for (let i = 0; i < D; i++) {
      const a = running[i] && rnd.alive[base + i] >= h[i] ? 1 : 0;
      alive[i] = a;
      if (a) {
        nAlive++;
        for (let g = 0; g < G; g++) totals[g] += E[g][i];
      }
    }
    if (nAlive === 0) continue;
    // Winner: exact conditional probability given the survivor set (lower variance than counting).
    const z0 = totals[0];
    for (let i = 0; i < D; i++) if (alive[i]) win[i] += E[0][i] / z0;
    for (let j = 0; j < nAlive; j++) {
      const g = stageGroup[Math.min(j, stageGroup.length - 1)];
      const e = E[g];
      const target = rnd.stage[base + j] * totals[g];
      let acc = 0;
      let pick = -1;
      let last = -1;
      for (let i = 0; i < D; i++) {
        if (!alive[i]) continue;
        last = i;
        acc += e[i];
        if (acc > target) {
          pick = i;
          break;
        }
      }
      if (pick < 0) pick = last;
      alive[pick] = 0;
      for (let k = 0; k < G; k++) totals[k] -= E[k][pick];
      placed[base + pick] = j + 1;
      if (j < 3) pod[pick]++;
      if (j < 10) pts[pick]++;
    }
  }
  const late = n / Math.max(race.laps, 1) >= 0.9;
  const stoppedNc = late ? model.hazard.stoppedNc.late : model.hazard.stoppedNc.early;
  return {
    frame: n,
    D,
    sims,
    running,
    win: Array.from(win, (v) => v / sims),
    podium: Array.from(pod, (v) => v / sims),
    points: Array.from(pts, (v) => v / sims),
    nc: h.map((v, i) => (running[i] ? v : stoppedNc)),
    placed,
    features: ff,
    U,
    hazard: h,
  };
}

/** P(a is classified ahead of b) from the joint draws. Both unclassified is a coin flip. */
export function headToHead(fc: RaceForecast, rnd: RaceRandoms, a: number, b: number): number {
  let wins = 0;
  for (let m = 0; m < fc.sims; m++) wins += h2hOutcome(fc, rnd, m, a, b);
  return wins / fc.sims;
}

export function h2hOutcome(fc: RaceForecast, rnd: RaceRandoms, m: number, a: number, b: number): 0 | 1 {
  const pa = fc.placed[m * fc.D + a];
  const pb = fc.placed[m * fc.D + b];
  if (pa && pb) return pa < pb ? 1 : 0;
  if (pa) return 1;
  if (pb) return 0;
  // Neither is classified: the model does not time retirements, so it is a fair coin —
  // drawn once per scenario and antisymmetric, so P(a>b) + P(b>a) = 1 exactly.
  return rnd.coin[m] < 0.5 === a < b ? 1 : 0;
}
