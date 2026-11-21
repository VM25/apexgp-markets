import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { forecastFrame, raceRandoms } from "../model/forecast";
import { RaceLens } from "../session/lens";
import type { RaceFile } from "../types";
import { clone, loadRace, model, season } from "./helpers";

/** Overwrite everything after frame n with nonsense: reversed order, huge gaps, everyone stopped, red flag. */
function scrambleFuture(race: RaceFile, n: number, salt: number): RaceFile {
  const r = clone(race);
  const f = r.frames;
  const D = r.drivers.length;
  for (let k = n + 1; k < f.n; k++) {
    f.status[k] = (["RED", "SC", "VSC", "GREEN"] as const)[(k + salt) % 4];
    for (let d = 0; d < D; d++) {
      f.pos[k][d] = ((d + salt + k) % D) + 1;
      f.gap[k][d] = ((d * 7 + salt) % 97) + 0.123;
      f.pits[k][d] = (d + salt) % 5;
      f.down[k][d] = (d + k) % 3;
      f.stopped[k][d] = (d + salt + k) % 2;
      f.laps[k][d] = 0;
      f.lastLap[k][d] = 1;
    }
    f.events[k] = [{ type: "RED", text: "scrambled" }];
  }
  return r;
}

describe("no look-ahead: forecasts and quotes at frame n ignore every later frame", () => {
  const rounds = [1, 8, 12, 22];
  for (const round of rounds) {
    const race = loadRace(round);
    it(`round ${round}: forecast(n) is identical after the future is scrambled`, () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: race.frames.n - 2 }), fc.integer({ min: 0, max: 1000 }), (n, salt) => {
          const altered = scrambleFuture(race, n, salt);
          const a = forecastFrame(race, n, model, raceRandoms(race));
          const b = forecastFrame(altered, n, model, raceRandoms(altered));
          expect(b.win).toEqual(a.win);
          expect(b.podium).toEqual(a.podium);
          expect(b.points).toEqual(a.points);
          expect(b.nc).toEqual(a.nc);
          expect(Array.from(b.placed)).toEqual(Array.from(a.placed));
        }),
        { numRuns: 12 },
      );
    });
  }

  it("fair values, title probabilities and dealer quotes at frame n are identical after the future is scrambled", () => {
    const race = loadRace(8);
    for (const n of [0, 1, 17, 40, race.frames.n - 2]) {
      const a = new RaceLens(race, model, season.points);
      const b = new RaceLens(scrambleFuture(race, n, 3), model, season.points);
      expect(Array.from(b.fairAt(n))).toEqual(Array.from(a.fairAt(n)));
      for (const c of a.contracts.filter((_, i) => i % 9 === 0)) {
        const qa = a.baseQuote(c.id, n);
        const qb = b.baseQuote(c.id, n);
        expect(qb.bids).toEqual(qa.bids);
        expect(qb.asks).toEqual(qa.asks);
      }
    }
  });

  it("observation files carry no settlement labels", () => {
    for (let round = 1; round <= 24; round++) {
      const race = loadRace(round) as unknown as Record<string, unknown>;
      for (const key of ["classification", "final_result", "result", "winner", "points", "standingsAfter"]) expect(race).not.toHaveProperty(key);
      // Entrants are listed in grid order, never in finishing order.
      const r = loadRace(round);
      const slots = r.grid.map((g) => (g > 0 ? g : 1000));
      expect([...slots].sort((x, y) => x - y)).toEqual(slots);
    }
  });
});
