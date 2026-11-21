import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyFill, applySettlement, lockedCollateral, nav, newLedger, openPositions, unrealized, type Ledger } from "../portfolio/ledger";
import { worstCaseLoss } from "../portfolio/risk";
import type { Contract } from "../market/contracts";

const START = 100_000_00;
const ids = ["a", "b", "c", "d"];
const op = fc.oneof(
  fc.record({ t: fc.constant("fill" as const), id: fc.constantFrom(...ids), dq: fc.integer({ min: -500, max: 500 }).filter((x) => x !== 0), price: fc.integer({ min: 1, max: 99 }), fee: fc.integer({ min: 0, max: 200 }) }),
  fc.record({ t: fc.constant("settle" as const), id: fc.constantFrom(...ids), payoff: fc.constantFrom(0 as const, 1 as const) }),
);

describe("ledger invariants", () => {
  it("NAV = start + realised + unrealised - fees, for any sequence of fills and settlements", () => {
    fc.assert(
      fc.property(fc.array(op, { maxLength: 60 }), fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { minLength: 4, maxLength: 4 }), (ops, marks) => {
        let l: Ledger = newLedger(START);
        let flows = 0;
        for (const o of ops) {
          if (o.t === "fill") {
            l = applyFill(l, o.id, o.dq, o.price, o.fee).ledger;
            flows += -o.dq * o.price - o.fee;
          } else {
            const r = applySettlement(l, o.id, o.payoff);
            l = r.ledger;
            flows += r.cashFlow;
            expect(l.positions[o.id]?.q ?? 0).toBe(0);
            // Settling again changes nothing.
            expect(applySettlement(l, o.id, o.payoff).ledger).toBe(l);
          }
        }
        const mark = (id: string) => marks[ids.indexOf(id)];
        expect(l.cash).toBeCloseTo(START + flows, 6); // cash moves only through recorded flows
        const unreal = openPositions(l).reduce((a, p) => a + unrealized(p, mark(p.contractId)), 0);
        expect(nav(l, mark)).toBeCloseTo(START + l.realized + unreal - l.fees, 4);
        for (const p of Object.values(l.positions)) {
          expect(p.basis).toBeGreaterThanOrEqual(-1e-6);
          if (p.q === 0) expect(p.basis).toBeCloseTo(0, 6);
          // Basis never exceeds the maximum payout of the open quantity.
          expect(p.basis).toBeLessThanOrEqual(Math.abs(p.q) * 100 + 1e-6);
        }
        expect(lockedCollateral(l)).toBe(openPositions(l).reduce((a, p) => a + (p.q < 0 ? -p.q * 100 : 0), 0));
      }),
      { numRuns: 400 },
    );
  });

  it("a position's settlement value is bounded by [0, $1] per contract", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 1, max: 99 }), fc.constantFrom(1, -1), fc.constantFrom(0 as const, 1 as const), (qty, price, sign, payoff) => {
        const l = applyFill(newLedger(START), "x", sign * qty, price, 0).ledger;
        const after = applySettlement(l, "x", payoff).ledger;
        const pnl = after.cash - START;
        const paid = sign > 0 ? qty * price : qty * (100 - price);
        expect(pnl).toBeGreaterThanOrEqual(-paid); // can never lose more than the premium
        expect(pnl).toBeLessThanOrEqual(qty * 100 - paid);
      }),
    );
  });

  it("buying NO then YES of the same contract nets instead of holding both", () => {
    let l = applyFill(newLedger(START), "x", -300, 40, 0).ledger; // 300 NO at 60c
    expect(l.positions.x.q).toBe(-300);
    expect(l.positions.x.basis).toBe(300 * 60);
    const r = applyFill(l, "x", 500, 45, 0); // buy 500 YES at 45c: closes 300 NO at 55c, opens 200 YES
    l = r.ledger;
    expect(r.closed).toBe(300);
    expect(r.opened).toBe(200);
    expect(r.realized).toBe(300 * (55 - 60));
    expect(l.positions.x.q).toBe(200);
    expect(l.positions.x.basis).toBe(200 * 45);
  });
});

describe("worst-case loss", () => {
  const c = (id: string, kind: Contract["kind"]): Contract => ({ id, kind, scope: "race", season: 2025, raceId: "r", subject: id, versus: null, index: 0, versusIndex: -1, code: id, title: id, question: id });
  const contracts: Record<string, Contract> = { w1: c("w1", "WIN"), w2: c("w2", "WIN"), w3: c("w3", "WIN"), p1: c("p1", "POD") };
  const of = (id: string) => contracts[id];
  it("nets mutually exclusive winners: at most one NO on the winner market can lose", () => {
    let l = newLedger(START);
    l = applyFill(l, "w1", -100, 30, 0).ledger;
    l = applyFill(l, "w2", -100, 30, 0).ledger;
    l = applyFill(l, "w3", -100, 30, 0).ledger;
    const mark = () => 0.3;
    // Three NO positions worth 70c each; the worst case is that one of the three wins.
    expect(worstCaseLoss(openPositions(l), of, mark)).toBeCloseTo(3 * 100 * 70 - 2 * 100 * 100, 6);
  });
  it("treats long winners as able to all lose, and other markets individually", () => {
    let l = newLedger(START);
    l = applyFill(l, "w1", 100, 40, 0).ledger;
    l = applyFill(l, "w2", 100, 20, 0).ledger;
    l = applyFill(l, "p1", 50, 60, 0).ledger;
    const mark = (id: string) => ({ w1: 0.4, w2: 0.2, p1: 0.6 })[id]!;
    expect(worstCaseLoss(openPositions(l), of, mark)).toBeCloseTo(100 * 40 + 100 * 20 + 50 * 60, 6);
  });
});
