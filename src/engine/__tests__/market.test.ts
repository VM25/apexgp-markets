import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { consume, direction, feeCents, matchLadder, matchResting } from "../market/execution";
import { emptyBook, quote, stepBook, type QuoteContext } from "../market/quote";
import type { ContractKind } from "../market/contracts";
import type { TrackStatus } from "../types";

const kinds: ContractKind[] = ["WIN", "POD", "PTS", "DNF", "H2H", "WDC", "WCC"];
const statuses: TrackStatus[] = ["GREEN", "YELLOW", "VSC", "SC"];
const ctxArb = fc.record({
  kind: fc.constantFrom(...kinds),
  status: fc.constantFrom(...statuses),
  frame: fc.integer({ min: 0, max: 55 }),
  totalFrames: fc.constant(58),
}) as fc.Arbitrary<QuoteContext>;
const bookArb = fc.record({
  inv: fc.integer({ min: -6000, max: 6000 }),
  usedBid: fc.integer({ min: 0, max: 4000 }),
  usedAsk: fc.integer({ min: 0, max: 4000 }),
  variance: fc.double({ min: 0, max: 0.02, noNaN: true }),
  lastFair: fc.constant(null),
});

describe("dealer quotes", () => {
  it("are always a valid two-sided ladder on the tick grid", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), bookArb, ctxArb, (fair, book, ctx) => {
        const q = quote(fair, book, ctx);
        expect(q.state).toBe("open");
        for (const l of [...q.bids, ...q.asks]) {
          expect(Number.isInteger(l.price)).toBe(true);
          expect(l.price).toBeGreaterThanOrEqual(1);
          expect(l.price).toBeLessThanOrEqual(99);
          expect(l.size).toBeGreaterThan(0);
        }
        if (q.bestBid !== null && q.bestAsk !== null) expect(q.bestAsk).toBeGreaterThan(q.bestBid);
        q.asks.forEach((l, i) => i > 0 && expect(l.price).toBeGreaterThan(q.asks[i - 1].price));
        q.bids.forEach((l, i) => i > 0 && expect(l.price).toBeLessThan(q.bids[i - 1].price));
        expect(q.halfSpread).toBeGreaterThan(0);
      }),
      { numRuns: 500 },
    );
  });

  it("YES and NO prices are complements: buying NO costs 100 minus the YES bid", () => {
    const q = quote(0.37, emptyBook(), { kind: "WIN", status: "GREEN", frame: 10, totalFrames: 58 });
    const buyNo = matchLadder(q, direction("NO", "BUY"), 100, null);
    expect(buyNo.fills[0].price).toBe(q.bestBid);
    expect(100 - buyNo.avgPrice).toBe(100 - q.bestBid!);
    // A YES buyer and a NO buyer at the touch together pay more than $1.00: the difference is the spread.
    expect(q.bestAsk! + (100 - q.bestBid!)).toBeGreaterThan(100);
  });

  it("widen under a safety car and at the start, and thin out", () => {
    const book = { ...emptyBook(), variance: 0.0004 };
    const green = quote(0.4, book, { kind: "WIN", status: "GREEN", frame: 20, totalFrames: 58 });
    const sc = quote(0.4, book, { kind: "WIN", status: "SC", frame: 20, totalFrames: 58 });
    expect(sc.halfSpread).toBeGreaterThan(green.halfSpread);
    expect(sc.asks[0].size).toBeLessThan(green.asks[0].size);
    const red = quote(0.4, book, { kind: "WIN", status: "RED", frame: 20, totalFrames: 58 });
    expect(red.state).toBe("suspended");
    expect(red.asks).toHaveLength(0);
    expect(quote(0.4, book, { kind: "WIN", status: "GREEN", frame: 57, totalFrames: 58 }).state).toBe("closed");
  });

  it("skew against the dealer's inventory and recover as it is laid off", () => {
    const ctx: QuoteContext = { kind: "POD", status: "GREEN", frame: 12, totalFrames: 58 };
    const flat = quote(0.5, emptyBook(), ctx);
    const short = quote(0.5, consume(emptyBook(), 1, 2000), ctx); // the user bought 2000 YES from the dealer
    expect(short.reservation).toBeGreaterThan(flat.reservation);
    expect(short.bestAsk!).toBeGreaterThanOrEqual(flat.bestAsk!);
    let book = consume(emptyBook(), 1, 2000);
    for (let k = 0; k < 30; k++) book = stepBook(book, 0.5);
    expect(book.inv).toBe(0);
    expect(book.usedAsk).toBe(0);
    expect(quote(0.5, book, ctx).bestAsk).toBe(flat.bestAsk);
  });

  it("near-certain outcomes are one-sided", () => {
    const ctx: QuoteContext = { kind: "WIN", status: "GREEN", frame: 50, totalFrames: 58 };
    expect(quote(0.0005, emptyBook(), ctx).bids).toHaveLength(0);
    expect(quote(0.9995, emptyBook(), ctx).asks).toHaveLength(0);
  });
});

describe("execution", () => {
  const ctx: QuoteContext = { kind: "WIN", status: "GREEN", frame: 10, totalFrames: 58 };
  it("walks the ladder: bigger orders never get a better average price", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.03, max: 0.97, noNaN: true }), fc.integer({ min: 1, max: 20000 }), fc.integer({ min: 1, max: 20000 }), fc.constantFrom(1 as const, -1 as const), (fair, a, b, dir) => {
        const q = quote(fair, emptyBook(), ctx);
        const [small, large] = a < b ? [a, b] : [b, a];
        const ms = matchLadder(q, dir, small, null);
        const ml = matchLadder(q, dir, large, null);
        expect(ml.filled).toBeGreaterThanOrEqual(ms.filled);
        expect(ms.filled + ms.remaining).toBe(small);
        if (ms.filled && ml.filled) {
          if (dir === 1) expect(ml.avgPrice).toBeGreaterThanOrEqual(ms.avgPrice - 1e-9);
          else expect(ml.avgPrice).toBeLessThanOrEqual(ms.avgPrice + 1e-9);
        }
        const depth = (dir === 1 ? q.asks : q.bids).reduce((s, l) => s + l.size, 0);
        expect(ml.filled).toBe(Math.min(large, depth));
      }),
      { numRuns: 300 },
    );
  });

  it("respects limit prices and partially fills", () => {
    const q = quote(0.5, emptyBook(), ctx);
    const ask = q.bestAsk!;
    const m = matchLadder(q, 1, 1_000_000, ask + 1);
    expect(m.fills.every((f) => f.price <= ask + 1)).toBe(true);
    expect(m.remaining).toBeGreaterThan(0);
    expect(matchLadder(q, 1, 100, ask - 1).filled).toBe(0);
  });

  it("depth consumed by one order is gone for the next", () => {
    const q0 = quote(0.5, emptyBook(), ctx);
    const top = q0.asks[0];
    const q1 = quote(0.5, { ...consume(emptyBook(), 1, top.size), inv: 0 }, ctx);
    expect(q1.asks[0].price).toBeGreaterThan(top.price);
  });

  it("charges the published fee formula, rounded up to the cent", () => {
    expect(feeCents(100, 50, "taker")).toBe(175); // 0.07 * 100 * 0.5 * 0.5 = $1.75
    expect(feeCents(1, 50, "taker")).toBe(2); // 1.75 cents rounds up
    expect(feeCents(100, 5, "taker")).toBe(34); // 0.07 * 100 * 0.05 * 0.95 = $0.3325
    expect(feeCents(100, 50, "maker")).toBe(44);
    fc.assert(fc.property(fc.integer({ min: 1, max: 99 }), fc.integer({ min: 1, max: 5000 }), (p, n) => {
      expect(feeCents(n, p, "taker")).toBe(feeCents(n, 100 - p, "taker")); // symmetric in YES / NO
      expect(feeCents(n, p, "taker")).toBeGreaterThanOrEqual(feeCents(n, p, "maker"));
    }));
  });

  it("a resting order fills at its own limit, only once the dealer's quote reaches it", () => {
    const high = quote(0.5, emptyBook(), ctx);
    const limit = high.bestAsk! - 3;
    expect(matchResting(high, 1, 500, limit).filled).toBe(0);
    const low = quote(0.44, emptyBook(), ctx);
    const m = matchResting(low, 1, 500, limit);
    expect(low.bestAsk!).toBeLessThanOrEqual(limit);
    expect(m.filled).toBe(500);
    expect(m.avgPrice).toBe(limit);
  });
});
