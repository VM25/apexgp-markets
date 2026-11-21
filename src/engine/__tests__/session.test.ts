import { describe, expect, it } from "vitest";
import { settleRaceContract } from "../market/contracts";
import { RISK_LIMITS, START_CASH_CENTS } from "../market/params";
import { isValidState, TradingSession } from "../session/session";
import { clone, lensFor, loadSettlement, season, seasonSettlement, sessionAt } from "./helpers";

const win = (s: TradingSession, code: string) => s.lens.contracts.find((c) => c.kind === "WIN" && c.code === code)!;
const runToFlag = (s: TradingSession) => {
  while (s.advance());
};

describe("trading session", () => {
  it("opens on the grid with the full starting balance", () => {
    const s = sessionAt(1);
    expect(s.state.phase).toBe("pre");
    expect(s.state.frame).toBe(0);
    expect(s.nav()).toBe(START_CASH_CENTS);
    expect(s.available()).toBe(START_CASH_CENTS);
  });

  it("buys at the ask, sells at the bid, and accounts for every cent", () => {
    const s = sessionAt(1);
    const c = win(s, "NOR");
    const q = s.quoteFor(c.id);
    const r = s.place({ contractId: c.id, side: "YES", action: "BUY", qty: 100, type: "MARKET" });
    expect(r.ok).toBe(true);
    expect(r.avgPriceYes).toBe(q.bestAsk);
    expect(s.state.ledger.cash).toBe(START_CASH_CENTS - 100 * q.bestAsk! - r.fee);
    expect(s.holding(c.id, "YES")).toBe(100);
    const q2 = s.quoteFor(c.id);
    const sell = s.place({ contractId: c.id, side: "YES", action: "SELL", qty: 100, type: "MARKET" });
    expect(sell.ok).toBe(true);
    expect(sell.avgPriceYes).toBe(q2.bestBid);
    expect(s.positions()).toHaveLength(0);
    // A round trip at the touch loses the spread plus two fees — never makes money.
    expect(s.state.ledger.cash).toBeLessThan(START_CASH_CENTS);
    expect(s.state.ledger.cash).toBe(START_CASH_CENTS + s.state.ledger.realized - s.state.ledger.fees);
  });

  it("buying NO pays 100 minus the YES bid and locks nothing beyond the premium", () => {
    const s = sessionAt(1);
    const c = win(s, "VER");
    const bid = s.quoteFor(c.id).bestBid!;
    const r = s.place({ contractId: c.id, side: "NO", action: "BUY", qty: 200, type: "MARKET" });
    expect(r.ok).toBe(true);
    expect(r.avgPrice).toBe(100 - bid);
    expect(s.holding(c.id, "NO")).toBe(200);
    expect(START_CASH_CENTS - s.available()).toBe(200 * (100 - bid) + r.fee);
  });

  it("rejects selling what is not held, orders beyond cash, and breaches of the risk limits", () => {
    const s = sessionAt(1);
    const c = win(s, "NOR");
    expect(s.place({ contractId: c.id, side: "YES", action: "SELL", qty: 10, type: "MARKET" }).ok).toBe(false);
    expect(s.place({ contractId: c.id, side: "YES", action: "BUY", qty: 0, type: "MARKET" }).ok).toBe(false);
    expect(s.place({ contractId: c.id, side: "YES", action: "BUY", qty: 1.5, type: "MARKET" }).ok).toBe(false);
    expect(s.place({ contractId: "nope", side: "YES", action: "BUY", qty: 1, type: "MARKET" }).ok).toBe(false);
    // Keep buying until a limit bites; the account must stay inside both limits throughout.
    let rejected = false;
    for (let k = 0; k < 400 && !rejected; k++) {
      const r = s.place({ contractId: c.id, side: "YES", action: "BUY", qty: 2000, type: "MARKET" });
      if (!r.ok) rejected = true;
      if (!s.advance()) break;
    }
    expect(rejected).toBe(true);
    const navNow = s.nav();
    const pos = s.state.ledger.positions[c.id];
    expect(Math.abs(pos.q) * s.mark(c.id) * 100).toBeLessThanOrEqual(RISK_LIMITS.perContract * navNow * 1.25); // limit was checked pre-trade; marks may drift
    expect(s.available()).toBeGreaterThanOrEqual(0);
    expect(s.state.ledger.cash).toBeGreaterThan(0);
  });

  it("the clock only moves forward; markets close at the flag; settlement happens exactly once", () => {
    const s = sessionAt(1);
    const c = win(s, "NOR");
    s.place({ contractId: c.id, side: "YES", action: "BUY", qty: 500, type: "MARKET" });
    const other = win(s, "VER");
    s.place({ contractId: other.id, side: "YES", action: "BUY", qty: 300, type: "MARKET" });
    expect(() => s.openRound(lensFor(2))).toThrow(); // cannot skip an unsettled round
    let last = s.state.frame;
    while (s.advance()) {
      expect(s.state.frame).toBe(last + 1);
      last = s.state.frame;
    }
    expect(s.state.phase).toBe("flag");
    expect(s.advance()).toBe(false);
    expect(s.place({ contractId: c.id, side: "YES", action: "BUY", qty: 1, type: "MARKET" }).ok).toBe(false);
    expect(s.place({ contractId: c.id, side: "YES", action: "SELL", qty: 1, type: "MARKET" }).ok).toBe(false);
    const cashBefore = s.state.ledger.cash;
    const settlement = loadSettlement(1);
    const records = s.settleRace(settlement, seasonSettlement);
    expect(records).toHaveLength(2);
    expect(s.state.phase).toBe("settled");
    // Norris won the 2025 Australian Grand Prix; the official classification decides, not the test.
    expect(settleRaceContract(c, settlement)).toBe(1);
    expect(s.state.ledger.cash).toBe(cashBefore + 500 * 100);
    const cashAfter = s.state.ledger.cash;
    expect(s.settleRace(settlement, seasonSettlement)).toHaveLength(0);
    expect(s.state.ledger.cash).toBe(cashAfter);
    expect(s.positions()).toHaveLength(0);
    expect(() => s.openRound(lensFor(1))).toThrow(); // no going back
    s.openRound(lensFor(2));
    expect(s.state.round).toBe(2);
    expect(s.state.frame).toBe(0);
    expect(s.state.phase).toBe("pre");
    expect(() => s.settleRace(settlement)).toThrow(); // a settlement file for another race is refused
  });

  it("a resting limit order reserves cash, fills at its limit when the market comes to it, and expires at the flag", () => {
    const s = sessionAt(8);
    const c = win(s, "NOR");
    const ask = s.quoteFor(c.id).bestAsk!;
    const limit = Math.max(2, ask - 8);
    const r = s.place({ contractId: c.id, side: "YES", action: "BUY", qty: 400, type: "LIMIT", limit, tif: "GTC" });
    expect(r.ok).toBe(true);
    expect(r.filled).toBe(0);
    expect(s.state.orders).toHaveLength(1);
    expect(s.reserved()).toBeGreaterThanOrEqual(400 * limit);
    expect(s.available()).toBe(START_CASH_CENTS - s.reserved());
    runToFlag(s);
    const fills = s.state.fills.filter((f) => f.contractId === c.id);
    for (const f of fills) {
      expect(f.liquidity).toBe("maker");
      expect(f.priceYes).toBe(limit);
      expect(f.fair * 100).toBeLessThan(limit + 1); // filled only because fair value fell to the limit: adverse selection
    }
    expect(s.state.orders).toHaveLength(0); // filled or expired at the flag
    const far = sessionAt(8);
    far.place({ contractId: win(far, "NOR").id, side: "YES", action: "BUY", qty: 10, type: "LIMIT", limit: 1, tif: "GTC" });
    expect(far.cancel(far.state.orders[0].id)).toBe(true);
    expect(far.available()).toBe(START_CASH_CENTS);
  });

  it("IOC limit orders never rest", () => {
    const s = sessionAt(1);
    const c = win(s, "NOR");
    const r = s.place({ contractId: c.id, side: "YES", action: "BUY", qty: 100, type: "LIMIT", limit: 1, tif: "IOC" });
    expect(r.ok).toBe(false);
    expect(s.state.orders).toHaveLength(0);
  });

  it("survives a reload: serialised state restores the same clock, cash, quotes and NAV", () => {
    const s = sessionAt(3);
    const c = win(s, "VER");
    s.place({ contractId: c.id, side: "YES", action: "BUY", qty: 800, type: "MARKET" });
    for (let k = 0; k < 14; k++) s.advance();
    s.place({ contractId: win(s, "NOR").id, side: "NO", action: "BUY", qty: 300, type: "MARKET" });
    s.place({ contractId: c.id, side: "YES", action: "SELL", qty: 100, type: "LIMIT", limit: 99, tif: "GTC" });
    const saved = clone(s.state);
    expect(isValidState(saved)).toBe(true);
    const restored = new TradingSession(saved, lensFor(3), season);
    expect(restored.state.frame).toBe(s.state.frame);
    expect(restored.nav()).toBe(s.nav());
    expect(restored.available()).toBe(s.available());
    expect(restored.quoteFor(c.id)).toEqual(s.quoteFor(c.id));
    expect(restored.state.audit.length).toBe(s.state.audit.length); // restoring does not re-open the session
    expect(isValidState({ ...saved, version: 1 })).toBe(false);
    expect(isValidState(null)).toBe(false);
  });

  it("title contracts carry across rounds and settle after the final round", () => {
    const s = sessionAt(23);
    const wdc = s.lens.contracts.find((c) => c.kind === "WDC" && c.code === "NOR")!;
    const r = s.place({ contractId: wdc.id, side: "YES", action: "BUY", qty: 200, type: "MARKET" });
    expect(r.ok).toBe(true);
    runToFlag(s);
    s.settleRace(loadSettlement(23), seasonSettlement);
    expect(s.holding(wdc.id, "YES")).toBe(200); // still open after round 23
    expect(s.state.seasonSettled).toBe(false);
    s.openRound(lensFor(24));
    expect(s.holding(wdc.id, "YES")).toBe(200);
    runToFlag(s);
    const cash = s.state.ledger.cash;
    s.settleRace(loadSettlement(24), seasonSettlement);
    expect(s.state.seasonSettled).toBe(true);
    expect(s.positions()).toHaveLength(0);
    expect(seasonSettlement.champion.driver.id).toBe("norris");
    expect(s.state.ledger.cash).toBe(cash + 200 * 100);
    expect(s.nextRound()).toBeNull();
  });

  it("NAV history is recorded every frame and equals cash when flat", () => {
    const s = sessionAt(5);
    runToFlag(s);
    expect(s.state.navHistory.length).toBe(s.totalFrames);
    for (const p of s.state.navHistory) expect(p.nav).toBe(START_CASH_CENTS);
  });

  it("scenario risk reflects dependence between related contracts", () => {
    const s = sessionAt(1);
    const nor = s.lens.contracts.filter((c) => c.code === "NOR" && (c.kind === "WIN" || c.kind === "POD"));
    for (const c of nor) s.place({ contractId: c.id, side: "YES", action: "BUY", qty: 300, type: "MARKET" });
    const risk = s.risk()!;
    expect(risk.sims).toBeGreaterThan(500);
    // WIN implies POD, so the two positions gain and lose together: the joint spread is far wider than independent bets would give.
    expect(risk.best).toBeGreaterThan(0);
    expect(risk.worst).toBeLessThan(0);
    expect(risk.worst).toBeGreaterThanOrEqual(-risk.markValue - 1);
    expect(risk.es05).toBeLessThanOrEqual(risk.p05 + 1e-9);
  });
});

describe("official settlement of every 2025 round", () => {
  for (let round = 1; round <= 24; round++) {
    it(`round ${round}: exactly one winner, three podium places, at most ten points finishes`, () => {
      const lens = lensFor(round);
      const st = loadSettlement(round);
      const pay = (kind: string) => lens.contracts.filter((c) => c.kind === kind).map((c) => settleRaceContract(c, st));
      expect(pay("WIN").filter((x) => x === 1)).toHaveLength(1);
      expect(pay("POD").filter((x) => x === 1)).toHaveLength(3);
      expect(pay("PTS").filter((x) => x === 1)).toHaveLength(10);
      expect(pay("WIN").every((x) => x !== null)).toBe(true);
      for (const c of lens.contracts.filter((x) => x.kind === "DNF")) {
        const row = st.classification.find((r) => r.id === c.subject)!;
        expect(settleRaceContract(c, st)).toBe(row.classified ? 0 : 1);
        if (row.text === "D") expect(settleRaceContract(lens.contracts.find((x) => x.kind === "PTS" && x.subject === c.subject)!, st)).toBe(0);
      }
    });
  }
});
