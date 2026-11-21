import { describe, expect, it } from "vitest";
import { headToHead } from "../model/forecast";
import { diagnostics, lensFor, loadRace, loadSettlement } from "./helpers";

describe("forecast coherence", () => {
  for (const round of [1, 2, 8, 13, 24]) {
    it(`round ${round}: probabilities are bounded, normalised and nested`, () => {
      const lens = lensFor(round);
      const N = lens.totalFrames;
      for (const n of [0, 1, 5, Math.floor(N / 2), N - 2]) {
        const { forecast: f, title } = lens.scenario(n);
        const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
        for (const arr of [f.win, f.podium, f.points, f.nc, title.driver, title.team]) for (const p of arr) {
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThanOrEqual(1);
        }
        // One winner whenever at least one car is classified.
        expect(sum(f.win)).toBeGreaterThan(0.999);
        expect(sum(f.win)).toBeLessThanOrEqual(1 + 1e-9);
        expect(sum(f.podium)).toBeLessThanOrEqual(3 + 1e-9);
        expect(sum(f.points)).toBeLessThanOrEqual(10 + 1e-9);
        f.win.forEach((w, d) => {
          expect(w).toBeLessThanOrEqual(f.podium[d] + 0.02); // win is exact-conditional, podium is counted
          expect(f.podium[d]).toBeLessThanOrEqual(f.points[d] + 1e-9);
          if (!f.running[d]) expect(f.win[d] + f.podium[d] + f.points[d]).toBe(0);
        });
        expect(sum(title.driver)).toBeCloseTo(1, 9);
        expect(sum(title.team)).toBeCloseTo(1, 9);
        expect(headToHead(f, lens.randoms, 0, 1) + headToHead(f, lens.randoms, 1, 0)).toBeCloseTo(1, 9);
      }
    });
  }

  it("is deterministic", () => {
    const a = lensFor(5);
    const b = lensFor(5);
    expect(Array.from(a.fairAt(30))).toEqual(Array.from(b.fairAt(30)));
  });

  it("matches the pipeline's reported out-of-sample win Brier score for 2025", () => {
    let se = 0;
    let n = 0;
    for (let round = 1; round <= 24; round++) {
      const race = loadRace(round);
      const winner = loadSettlement(round).classification.find((c) => c.classified && c.position === 1)!.id;
      const lens = lensFor(round);
      for (let k = 0; k < race.laps; k++) {
        const f = lens.summaryAt(k);
        race.drivers.forEach((d, i) => {
          if (race.frames.stopped[k][i]) return;
          se += (f.win[i] - (d.id === winner ? 1 : 0)) ** 2;
          n++;
        });
      }
    }
    const reported = diagnostics.replay["2025"].scores.win.all.stagewise;
    expect(n).toBe(diagnostics.replay["2025"].scores.win.all.n);
    // Same model, same data, independent implementation and random numbers.
    expect(se / n).toBeGreaterThan(reported.brier * 0.97);
    expect(se / n).toBeLessThan(reported.brier * 1.03);
  });
});
