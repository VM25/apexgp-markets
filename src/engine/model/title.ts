/**
 * Championship contracts: Monte Carlo over the rest of the calendar.
 * Mirrors pipeline/apexgp/futures.py.
 *
 * Known at the instant of the forecast and used: standings entering the race,
 * how many grands prix and sprints remain, today's entry list, pre-race
 * ratings, and (while the race runs) the joint simulation of the race itself.
 * Not known and not used: anything about later rounds.
 */
import { hashSeed, mulberry32 } from "../rng";
import type { ModelFile, RaceFile } from "../types";
import type { RaceForecast } from "./forecast";

export const TITLE_SIMS = 2000;

export interface TitleContext {
  sims: number;
  D: number;
  /** Simulated points and wins from every round after this one: [sims * D]. */
  futurePts: Float32Array;
  futureWins: Uint8Array;
  /** Driver candidates: the entrants (same order as race.drivers), then absent drivers with banked points. */
  driverIds: string[];
  driverPts: number[];
  driverWins: number[];
  teamIds: string[];
  teamPts: number[];
  /** Team index of each entrant. */
  teamOf: number[];
  racePoints: number[];
}

function seasonStrengths(race: RaceFile, model: ModelFile): { U: number[][]; h: number[] } {
  const D = race.drivers.length;
  const field = Math.min(0.99, Math.max(0.01, race.ratings.fieldNc));
  const lfield = Math.log(field / (1 - field));
  const w = model.season.hazardW;
  const U = model.season.beta.map((bg) =>
    Array.from({ length: D }, (_, i) => bg[0] * (race.ratings.dform[i] - 0.5) + bg[1] * (race.ratings.tform[i] - 0.5)),
  );
  const h = Array.from({ length: D }, (_, i) => {
    const z = w[0] + w[1] * (race.ratings.dnc[i] - field) + w[2] * (race.ratings.tnc[i] - field) + w[3] * lfield;
    return 1 / (1 + Math.exp(-z));
  });
  return { U, h };
}

export function buildTitleContext(
  race: RaceFile,
  model: ModelFile,
  points: { race: number[]; sprint: number[] },
  sims: number = TITLE_SIMS,
): TitleContext {
  const D = race.drivers.length;
  const { U, h } = seasonStrengths(race, model);
  const G = U.length;
  const E = U.map((ug) => {
    const mx = Math.max(...ug);
    return Float64Array.from(ug, (v) => Math.exp(v - mx));
  });
  const rnd = mulberry32(hashSeed(race.id) ^ 0x27d4eb2f);
  const futurePts = new Float32Array(sims * D);
  const futureWins = new Uint8Array(sims * D);
  const alive = new Uint8Array(D);
  const totals = new Float64Array(G);
  const stageGroup = model.stageGroup;

  const runEvent = (m: number, table: number[], withHazard: boolean, countWins: boolean) => {
    let nAlive = 0;
    totals.fill(0);
    for (let i = 0; i < D; i++) {
      const a = !withHazard || rnd() >= h[i] ? 1 : 0;
      alive[i] = a;
      if (a) {
        nAlive++;
        for (let g = 0; g < G; g++) totals[g] += E[g][i];
      }
    }
    const depth = Math.min(table.length, nAlive);
    for (let j = 0; j < depth; j++) {
      const g = stageGroup[Math.min(j, stageGroup.length - 1)];
      const target = rnd() * totals[g];
      let acc = 0;
      let pick = -1;
      let last = -1;
      for (let i = 0; i < D; i++) {
        if (!alive[i]) continue;
        last = i;
        acc += E[g][i];
        if (acc > target) {
          pick = i;
          break;
        }
      }
      if (pick < 0) pick = last;
      alive[pick] = 0;
      for (let k = 0; k < G; k++) totals[k] -= E[k][pick];
      futurePts[m * D + pick] += table[j];
      if (countWins && j === 0) futureWins[m * D + pick]++;
    }
  };

  for (let m = 0; m < sims; m++) {
    for (let r = 0; r < race.calendar.gpsLeft; r++) runEvent(m, points.race, true, true);
    for (let r = 0; r < race.calendar.sprintsLeft; r++) runEvent(m, points.sprint, false, false);
  }

  const standing = new Map(race.standings.drivers.map((d) => [d.id, d]));
  const entrantIds = race.drivers.map((d) => d.id);
  const entrantSet = new Set(entrantIds);
  const absent = race.standings.drivers.filter((d) => !entrantSet.has(d.id) && d.points > 0);
  const driverIds = [...entrantIds, ...absent.map((d) => d.id)];
  const driverPts = driverIds.map((id) => standing.get(id)?.points ?? 0);
  const driverWins = driverIds.map((id) => standing.get(id)?.wins ?? 0);

  const teamIds = Array.from(new Set([...race.teams.map((t) => t.id), ...race.standings.constructors.map((t) => t.id)]));
  const teamStanding = new Map(race.standings.constructors.map((t) => [t.id, t.points]));
  const teamPts = teamIds.map((id) => teamStanding.get(id) ?? 0);
  const teamOf = race.drivers.map((d) => teamIds.indexOf(d.team));
  return { sims, D, futurePts, futureWins, driverIds, driverPts, driverWins, teamIds, teamPts, teamOf, racePoints: points.race };
}

export interface TitleForecast {
  /** Probability per candidate, aligned with ctx.driverIds / ctx.teamIds. */
  driver: number[];
  team: number[];
  /** Champion index per simulation, for scenario risk. */
  champDriver: Int16Array;
  champTeam: Int16Array;
}

/**
 * Title probabilities given the race in progress.
 * `race` is the joint simulation of the current race (its first ctx.sims draws are used),
 * or null once the race has been settled and its points are already in the standings.
 */
export function titleForecast(ctx: TitleContext, race: RaceForecast | null): TitleForecast {
  const { sims, D } = ctx;
  const nDrivers = ctx.driverIds.length;
  const nTeams = ctx.teamIds.length;
  const dCount = new Float64Array(nDrivers);
  const tCount = new Float64Array(nTeams);
  const champDriver = new Int16Array(sims);
  const champTeam = new Int16Array(sims);
  const teamTotal = new Float64Array(nTeams);
  const table = ctx.racePoints;
  for (let m = 0; m < sims; m++) {
    for (let t = 0; t < nTeams; t++) teamTotal[t] = ctx.teamPts[t];
    let best = -1;
    let bestKey = -Infinity;
    for (let i = 0; i < nDrivers; i++) {
      let pts = ctx.driverPts[i];
      let wins = ctx.driverWins[i];
      if (i < D) {
        let gained = ctx.futurePts[m * D + i];
        wins += ctx.futureWins[m * D + i];
        if (race) {
          const p = race.placed[m * D + i];
          if (p >= 1 && p <= table.length) gained += table[p - 1];
          if (p === 1) wins += 1;
        }
        pts += gained;
        teamTotal[ctx.teamOf[i]] += gained;
      }
      // Most points; ties on wins; then on entry order (arbitrary but fixed and label-free).
      const key = pts + 1e-3 * wins - 1e-7 * i;
      if (key > bestKey) {
        bestKey = key;
        best = i;
      }
    }
    champDriver[m] = best;
    dCount[best]++;
    let bt = 0;
    let btKey = -Infinity;
    for (let t = 0; t < nTeams; t++) {
      const key = teamTotal[t] - 1e-7 * t;
      if (key > btKey) {
        btKey = key;
        bt = t;
      }
    }
    champTeam[m] = bt;
    tCount[bt]++;
  }
  return {
    driver: Array.from(dCount, (v) => v / sims),
    team: Array.from(tCount, (v) => v / sims),
    champDriver,
    champTeam,
  };
}
