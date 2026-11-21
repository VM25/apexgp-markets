import { describe, expect, it } from "vitest";
import golden from "./fixtures/golden.json";
import { frameFeatures, hazards, strengths } from "../model/features";
import { loadRace, model } from "./helpers";

interface Case { race: string; frame: number; basis: number[]; X: number[][]; H: number[][]; U: number[][]; h: number[]; running: number[] }

describe("TypeScript features match the Python pipeline", () => {
  const cases = (golden as { cases: Case[] }).cases;
  it("has golden vectors", () => expect(cases.length).toBeGreaterThan(10));
  for (const c of cases) {
    it(`${c.race} frame ${c.frame}`, () => {
      const race = loadRace(Number(c.race.split("-")[1]));
      const ff = frameFeatures(race, c.frame, model);
      const U = strengths(ff, model);
      const h = hazards(ff, model);
      expect(ff.running.map(Number)).toEqual(c.running);
      c.basis.forEach((v, i) => expect(ff.basis[i]).toBeCloseTo(v, 9));
      c.X.forEach((row, d) => row.forEach((v, f) => expect(ff.X[d][f], `X[${d}][${f}]`).toBeCloseTo(v, 6)));
      c.H.forEach((row, d) => row.forEach((v, f) => expect(ff.H[d][f], `H[${d}][${f}]`).toBeCloseTo(v, 6)));
      c.U.forEach((row, g) => row.forEach((v, d) => expect(U[g][d], `U[${g}][${d}]`).toBeCloseTo(v, 4)));
      c.h.forEach((v, d) => expect(h[d]).toBeCloseTo(v, 5));
    });
  }
});
