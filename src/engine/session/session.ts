/**
 * The trading session: one account, one monotonic market clock.
 *
 * Rules that keep the accounting causally consistent
 * --------------------------------------------------
 * 1. The clock is (round, frame) and only moves forward. There is no rewind
 *    in a trading session; looking back is done in the read-only review.
 * 2. Orders execute at the clock's frame, against quotes built from
 *    information up to that frame.
 * 3. Race contracts stop trading at the chequered flag and settle once, on the
 *    official classification. Settlement is idempotent.
 * 4. The next round can be opened only after the current one has settled.
 *    Skipping ahead means running the clock forward, never jumping over it.
 * 5. Title contracts carry across rounds and settle after the final round.
 * 6. State is serialisable; a reload restores the same clock, cash, positions,
 *    resting orders and dealer inventory.
 */
import { KIND_META, settleRaceContract, settleSeasonContract, type Contract } from "../market/contracts";
import { consume, direction, feeCents, matchLadder, matchResting, type Action, type Side } from "../market/execution";
import { INVENTORY, RISK_LIMITS, START_CASH_CENTS } from "../market/params";
import { quote, type Quote } from "../market/quote";
import { applyFill, applySettlement, lockedCollateral, nav, newLedger, openPositions, positionValue, type Ledger, type Position } from "../portfolio/ledger";
import { scenarioRisk, worstCaseLoss, type ScenarioRisk } from "../portfolio/risk";
import type { SeasonFile, SeasonSettlementFile, SettlementFile } from "../types";
import type { RaceLens } from "./lens";

export const SESSION_VERSION = 3;

export type Phase = "pre" | "live" | "flag" | "settled";

export interface OrderRequest {
  contractId: string;
  side: Side;
  action: Action;
  qty: number;
  type: "MARKET" | "LIMIT";
  /** Limit price in own-side cents (the YES price for YES orders, the NO price for NO orders). */
  limit?: number;
  tif?: "IOC" | "GTC";
}

export interface RestingOrder {
  id: string;
  contractId: string;
  side: Side;
  action: Action;
  qty: number;
  filled: number;
  /** YES-price limit in cents and book direction. */
  yesLimit: number;
  dir: 1 | -1;
  placedRound: number;
  placedFrame: number;
  seq: number;
}

export interface FillRecord {
  id: string;
  orderId: string;
  seq: number;
  round: number;
  raceId: string;
  frame: number;
  contractId: string;
  kind: Contract["kind"];
  title: string;
  side: Side;
  action: Action;
  qty: number;
  /** Average YES price (cents) and the same in own-side terms. */
  priceYes: number;
  price: number;
  fee: number;
  liquidity: "taker" | "maker";
  /** Model fair value and quoted mid at the moment of the fill, as YES probabilities. */
  fair: number;
  mid: number;
  /** Best quote on the side taken, in YES cents, before the order. */
  touch: number | null;
  realized: number;
}

export interface SettlementRecord {
  seq: number;
  round: number;
  raceId: string | null;
  contractId: string;
  kind: Contract["kind"];
  title: string;
  q: number;
  payoff: 0 | 1;
  cashFlow: number;
  realized: number;
  basis: number;
}

export interface AuditEvent {
  seq: number;
  round: number;
  frame: number;
  type: "SESSION" | "ORDER" | "FILL" | "CANCEL" | "EXPIRE" | "REJECT" | "SETTLE" | "CLOCK";
  text: string;
}

export interface NavPoint {
  round: number;
  frame: number;
  nav: number;
  cash: number;
}

export interface RaceSummary {
  round: number;
  raceId: string;
  name: string;
  navStart: number;
  navEnd: number;
  realized: number;
  fees: number;
  fills: number;
  settled: number;
}

export interface SessionState {
  version: number;
  id: string;
  season: number;
  startRound: number;
  round: number;
  frame: number;
  phase: Phase;
  seasonSettled: boolean;
  ledger: Ledger;
  /** Dealer inventory per contract (only contracts the account has traded). */
  inventory: Record<string, { inv: number; usedBid: number; usedAsk: number }>;
  orders: RestingOrder[];
  fills: FillRecord[];
  settlements: SettlementRecord[];
  audit: AuditEvent[];
  navHistory: NavPoint[];
  races: RaceSummary[];
  settledRounds: number[];
  /** Last mark of title contracts, used between rounds. */
  seasonMarks: Record<string, number>;
  /** Titles of contracts ever traded, so history stays readable after their race is gone. */
  titles: Record<string, { title: string; kind: Contract["kind"]; raceId: string | null }>;
  seq: number;
}

export interface OrderPreview {
  ok: boolean;
  reason: string | null;
  warnings: string[];
  contract: Contract | null;
  quote: Quote | null;
  dir: 1 | -1;
  filled: number;
  remaining: number;
  rests: boolean;
  /** Own-side average price in cents. */
  avgPrice: number;
  avgPriceYes: number;
  fee: number;
  /** Cash paid (+) or received (-) including fees, in cents. */
  cashDelta: number;
  /** Cost versus the quoted mid, split into half-spread and walking the ladder, in cents. */
  spreadCost: number;
  impactCost: number;
  /** Own-side model edge: positive when buying below (or selling above) the model's fair value, in cents. */
  modelEdge: number;
  positionBefore: number;
  positionAfter: number;
  maxLoss: number;
  maxGain: number;
  limits: { contractLoss: number; contractLimit: number; totalLoss: number; totalLimit: number; availableAfter: number };
  closes: number;
}

export interface OrderResult extends OrderPreview {
  orderId: string | null;
}

export function newSessionState(season: number, startRound: number, id: string): SessionState {
  return {
    version: SESSION_VERSION, id, season, startRound, round: startRound, frame: 0, phase: "pre", seasonSettled: false,
    ledger: newLedger(START_CASH_CENTS), inventory: {}, orders: [], fills: [], settlements: [], audit: [],
    navHistory: [], races: [], settledRounds: [], seasonMarks: {}, titles: {}, seq: 0,
  };
}

/** Shape check for restored state; anything unexpected is rejected rather than trusted. */
export function isValidState(x: unknown): x is SessionState {
  if (!x || typeof x !== "object") return false;
  const s = x as SessionState;
  return (
    s.version === SESSION_VERSION && typeof s.season === "number" && Number.isInteger(s.round) && Number.isInteger(s.frame) &&
    ["pre", "live", "flag", "settled"].includes(s.phase) && !!s.ledger && Number.isFinite(s.ledger.cash) &&
    typeof s.ledger.positions === "object" && Array.isArray(s.orders) && Array.isArray(s.fills) && Array.isArray(s.navHistory)
  );
}

export class TradingSession {
  state: SessionState;
  lens: RaceLens;
  season: SeasonFile;

  constructor(state: SessionState, lens: RaceLens, season: SeasonFile) {
    this.state = state;
    this.lens = lens;
    this.season = season;
    if (lens.race.round !== state.round) throw new Error("lens/round mismatch");
    this.lens.ensure(state.frame);
    if (state.navHistory.length === 0) {
      this.log("SESSION", `Session opened with $${(state.ledger.startCash / 100).toLocaleString("en-US")} at round ${state.round}.`);
      this.beginRace();
    }
  }

  // ---------------------------------------------------------------- queries
  get totalFrames(): number {
    return this.lens.totalFrames;
  }

  contract(id: string): Contract | undefined {
    const i = this.lens.indexOf.get(id);
    return i === undefined ? undefined : this.lens.contracts[i];
  }

  isTradable(c: Contract): boolean {
    if (this.state.phase === "flag" || this.state.phase === "settled") return false;
    if (c.scope === "season" && this.state.seasonSettled) return false;
    return this.quoteFor(c.id).state === "open";
  }

  fair(contractId: string): number {
    const i = this.lens.indexOf.get(contractId);
    if (i === undefined) return this.state.seasonMarks[contractId] ?? 0;
    return this.lens.fairAt(this.state.frame)[i];
  }

  /** The dealer's live quote, including this account's inventory impact. */
  quoteFor(contractId: string): Quote {
    const c = this.contract(contractId)!;
    const base = this.lens.marketBook(contractId, this.state.frame);
    const inv = this.state.inventory[contractId];
    const book = inv ? { ...base, ...inv } : base;
    const q = quote(this.fair(contractId), book, this.lens.quoteContext(c, this.state.frame));
    if (this.state.phase === "settled") return { ...q, state: "settled", reason: "Settled on the official classification.", bids: [], asks: [], bestBid: null, bestAsk: null };
    return q;
  }

  /** Mark used for valuation: the quoted mid while a market is open, otherwise the model's fair value. */
  mark = (contractId: string): number => {
    const c = this.contract(contractId);
    if (!c) return this.state.seasonMarks[contractId] ?? 0;
    if (this.state.phase === "flag" || this.state.phase === "settled") return this.fair(contractId);
    return this.quoteFor(contractId).mid;
  };

  nav(): number {
    return nav(this.state.ledger, this.mark);
  }

  reserved(): number {
    let r = 0;
    for (const o of this.state.orders) {
      if (o.action !== "BUY") continue;
      const own = o.side === "YES" ? o.yesLimit : 100 - o.yesLimit;
      const left = o.qty - o.filled;
      r += left * own + feeCents(left, o.yesLimit, "maker");
    }
    return r;
  }

  available(): number {
    return this.state.ledger.cash - lockedCollateral(this.state.ledger) - this.reserved();
  }

  positions(): Position[] {
    return openPositions(this.state.ledger);
  }

  /** Quantity of a holding already promised to resting sell orders. */
  private committed(contractId: string, side: Side): number {
    return this.state.orders.filter((o) => o.contractId === contractId && o.side === side && o.action === "SELL").reduce((a, o) => a + o.qty - o.filled, 0);
  }

  holding(contractId: string, side: Side): number {
    const q = this.state.ledger.positions[contractId]?.q ?? 0;
    return side === "YES" ? Math.max(0, q) : Math.max(0, -q);
  }

  risk(): ScenarioRisk | null {
    const frame = Math.min(this.state.frame, this.totalFrames - 1);
    const payoff = this.lens.payoffIn(frame);
    return scenarioRisk(this.positions(), (id) => this.contract(id), this.mark, payoff, this.lens.titleCtx.sims);
  }

  worstCase(ledger: Ledger = this.state.ledger): number {
    return worstCaseLoss(openPositions(ledger), (id) => this.contract(id), this.mark);
  }

  // ---------------------------------------------------------------- orders
  preview(req: OrderRequest): OrderPreview {
    const c = this.contract(req.contractId);
    const dir = direction(req.side, req.action);
    const blank: OrderPreview = {
      ok: false, reason: null, warnings: [], contract: c ?? null, quote: null, dir, filled: 0, remaining: req.qty, rests: false,
      avgPrice: NaN, avgPriceYes: NaN, fee: 0, cashDelta: 0, spreadCost: 0, impactCost: 0, modelEdge: 0,
      positionBefore: 0, positionAfter: 0, maxLoss: 0, maxGain: 0, closes: 0,
      limits: { contractLoss: 0, contractLimit: 0, totalLoss: 0, totalLimit: 0, availableAfter: this.available() },
    };
    if (!c) return { ...blank, reason: "This contract is not listed in the current round." };
    const q = this.quoteFor(c.id);
    const out = { ...blank, quote: q };
    const posBefore = this.state.ledger.positions[c.id]?.q ?? 0;
    out.positionBefore = posBefore;
    out.positionAfter = posBefore;
    if (!Number.isInteger(req.qty) || req.qty < 1) return { ...out, reason: "Enter a whole number of contracts (at least 1)." };
    if (req.qty > 200_000) return { ...out, reason: "Order size is limited to 200,000 contracts." };
    if (this.state.phase === "settled") return { ...out, reason: "This round has settled. Open the next round to keep trading." };
    if (this.state.phase === "flag") return { ...out, reason: "The chequered flag is out. Markets are closed until settlement." };
    if (c.scope === "season" && this.state.seasonSettled) return { ...out, reason: "The championship has been settled." };
    if (q.state !== "open") return { ...out, reason: q.reason ?? "This market is not open." };
    if (req.action === "SELL") {
      const free = this.holding(c.id, req.side) - this.committed(c.id, req.side);
      if (free < req.qty) return { ...out, reason: free > 0 ? `You can sell at most ${free.toLocaleString("en-US")} ${req.side} contracts here.` : `You hold no ${req.side} contracts to sell. To take the other side, buy ${req.side === "YES" ? "NO" : "YES"}.` };
    }
    let yesLimit: number | null = null;
    if (req.type === "LIMIT") {
      if (req.limit === undefined || !Number.isInteger(req.limit) || req.limit < 1 || req.limit > 99) return { ...out, reason: "Limit price must be between 1¢ and 99¢." };
      yesLimit = req.side === "YES" ? req.limit : 100 - req.limit;
    }
    const m = matchLadder(q, dir, req.qty, yesLimit);
    const rests = req.type === "LIMIT" && (req.tif ?? "GTC") === "GTC" && m.remaining > 0;
    if (m.filled === 0 && !rests) {
      const sideEmpty = (dir === 1 ? q.asks : q.bids).length === 0;
      return { ...out, reason: sideEmpty ? "The dealer is not quoting this side right now." : "No quantity is available at your limit price." };
    }
    // Hypothetical ledger after the marketable part.
    let ledger = this.state.ledger;
    let realized = 0;
    let closes = 0;
    for (const f of m.fills) {
      const r = applyFill(ledger, c.id, dir * f.qty, f.price, feeCents(f.qty, f.price, "taker"));
      ledger = r.ledger;
      realized += r.realized;
      closes += r.closed;
    }
    const posAfter = ledger.positions[c.id]?.q ?? 0;
    const own = (yes: number) => (req.side === "YES" ? yes : 100 - yes);
    const sign = req.action === "BUY" ? 1 : -1;
    const midCents = q.mid * 100;
    const touch = dir === 1 ? q.bestAsk : q.bestBid;
    out.filled = m.filled;
    out.remaining = m.remaining;
    out.rests = rests;
    out.avgPriceYes = m.avgPrice;
    out.avgPrice = m.filled ? own(m.avgPrice) : NaN;
    out.fee = m.fee;
    out.cashDelta = this.state.ledger.cash - ledger.cash;
    out.positionAfter = posAfter;
    out.closes = closes;
    if (m.filled) {
      out.spreadCost = sign * m.filled * (own(m.avgPrice) - own(midCents));
      out.impactCost = touch !== null ? sign * m.filled * (own(m.avgPrice) - own(touch)) : 0;
      out.modelEdge = sign * m.filled * (own(q.fair * 100) - own(m.avgPrice));
    }
    const pos = ledger.positions[c.id];
    if (pos && pos.q !== 0) {
      out.maxLoss = pos.basis;
      out.maxGain = Math.abs(pos.q) * 100 - pos.basis;
    }
    // Limits are evaluated on the post-trade book, marking the new position at its entry price.
    const navNow = this.nav();
    const reserveExtra = rests ? m.remaining * own(yesLimit!) + feeCents(m.remaining, yesLimit!, "maker") : 0;
    const availableAfter = ledger.cash - lockedCollateral(ledger) - this.reserved() - (req.action === "BUY" ? reserveExtra : 0);
    const contractLoss = pos && pos.q !== 0 ? positionValue(pos, this.mark(c.id)) : 0;
    const totalLoss = this.worstCase(ledger);
    out.limits = {
      contractLoss, contractLimit: RISK_LIMITS.perContract * navNow, totalLoss, totalLimit: RISK_LIMITS.total * navNow, availableAfter,
    };
    const reduces = Math.abs(posAfter) < Math.abs(posBefore) && Math.sign(posAfter) * Math.sign(posBefore) >= 0 && !rests;
    if (!reduces) {
      if (availableAfter < 0) return { ...out, reason: `Not enough available cash: this order needs $${((out.cashDelta + (req.action === "BUY" ? reserveExtra : 0)) / 100).toFixed(2)} and $${(this.available() / 100).toFixed(2)} is free.` };
      if (contractLoss > out.limits.contractLimit + 0.5) return { ...out, reason: `Position limit: no single contract may put more than ${RISK_LIMITS.perContract * 100}% of net asset value at risk.` };
      if (totalLoss > out.limits.totalLimit + 0.5) return { ...out, reason: `Portfolio limit: the worst-case loss across all positions may not exceed ${RISK_LIMITS.total * 100}% of net asset value.` };
    }
    if (closes > 0 && req.action === "BUY") out.warnings.push(`This first closes ${closes.toLocaleString("en-US")} of your ${req.side === "YES" ? "NO" : "YES"} contracts — YES and NO in the same market net against each other.`);
    if (m.remaining > 0 && !rests) out.warnings.push(`Only ${m.filled.toLocaleString("en-US")} of ${req.qty.toLocaleString("en-US")} would fill; the rest is cancelled.`);
    if (rests && m.filled === 0) out.warnings.push("This order will rest until the dealer's quote reaches your price. It may never fill.");
    if (rests && m.filled > 0) out.warnings.push(`${m.remaining.toLocaleString("en-US")} contracts will rest at your limit.`);
    void realized;
    return { ...out, ok: true };
  }

  place(req: OrderRequest): OrderResult {
    const p = this.preview(req);
    const c = p.contract;
    if (!p.ok || !c || !p.quote) {
      this.log("REJECT", `Order rejected (${req.action} ${req.qty} ${req.side} ${c?.title ?? req.contractId}): ${p.reason}`);
      return { ...p, orderId: null };
    }
    const orderId = this.nextId("o");
    const dir = p.dir;
    const yesLimit = req.type === "LIMIT" ? (req.side === "YES" ? req.limit! : 100 - req.limit!) : null;
    this.state.titles[c.id] = { title: c.title, kind: c.kind, raceId: c.raceId };
    this.log("ORDER", `${req.type === "LIMIT" ? `Limit ${req.limit}¢` : "Market"} ${req.action.toLowerCase()} ${req.qty.toLocaleString("en-US")} ${req.side} — ${c.title}`);
    const m = matchLadder(p.quote, dir, req.qty, yesLimit);
    if (m.filled > 0) this.book(c, orderId, req.side, req.action, dir, m.fills, "taker", p.quote);
    if (p.rests && yesLimit !== null) {
      this.state.orders.push({
        id: orderId, contractId: c.id, side: req.side, action: req.action, qty: req.qty, filled: m.filled, yesLimit, dir,
        placedRound: this.state.round, placedFrame: this.state.frame, seq: ++this.state.seq,
      });
    }
    this.recordNav(true);
    return { ...p, orderId };
  }

  cancel(orderId: string): boolean {
    const i = this.state.orders.findIndex((o) => o.id === orderId);
    if (i < 0) return false;
    const [o] = this.state.orders.splice(i, 1);
    this.log("CANCEL", `Cancelled resting order: ${o.action.toLowerCase()} ${(o.qty - o.filled).toLocaleString("en-US")} ${o.side} — ${this.titleOf(o.contractId)}`);
    return true;
  }

  private book(c: Contract, orderId: string, side: Side, action: Action, dir: 1 | -1, fills: { price: number; qty: number }[], liquidity: "taker" | "maker", q: Quote): void {
    const touch = dir === 1 ? q.bestAsk : q.bestBid;
    let qty = 0;
    let notional = 0;
    let fee = 0;
    let realized = 0;
    for (const f of fills) {
      const fe = feeCents(f.qty, f.price, liquidity);
      const r = applyFill(this.state.ledger, c.id, dir * f.qty, f.price, fe);
      this.state.ledger = r.ledger;
      realized += r.realized;
      qty += f.qty;
      notional += f.qty * f.price;
      fee += fe;
    }
    const inv = this.state.inventory[c.id] ?? { inv: 0, usedBid: 0, usedAsk: 0 };
    const next = consume({ ...inv, variance: 0, lastFair: null }, dir, qty);
    this.state.inventory[c.id] = { inv: next.inv, usedBid: next.usedBid, usedAsk: next.usedAsk };
    const priceYes = notional / qty;
    const record: FillRecord = {
      id: this.nextId("f"), orderId, seq: ++this.state.seq, round: this.state.round, raceId: this.lens.race.id, frame: this.state.frame,
      contractId: c.id, kind: c.kind, title: c.title, side, action, qty, priceYes, price: side === "YES" ? priceYes : 100 - priceYes,
      fee, liquidity, fair: q.fair, mid: q.mid, touch, realized,
    };
    this.state.fills.push(record);
    this.log("FILL", `${liquidity === "maker" ? "Resting order filled" : "Filled"}: ${action.toLowerCase()} ${qty.toLocaleString("en-US")} ${side} @ ${record.price.toFixed(1)}¢ — ${c.title} (fee $${(fee / 100).toFixed(2)})`);
  }

  // ---------------------------------------------------------------- clock
  canAdvance(): boolean {
    return (this.state.phase === "pre" || this.state.phase === "live") && this.state.frame < this.totalFrames - 1;
  }

  /** Move the clock forward one frame. Returns false at the chequered flag. */
  advance(): boolean {
    if (!this.canAdvance()) return false;
    const s = this.state;
    s.frame += 1;
    this.lens.ensure(s.frame);
    // Dealer housekeeping: lay off inventory, replenish depth.
    for (const [id, inv] of Object.entries(s.inventory)) {
      const nextInv = Math.abs(inv.inv) < 1 ? 0 : inv.inv * (1 - INVENTORY.decay);
      const usedBid = inv.usedBid * (1 - INVENTORY.replenish) < 1 ? 0 : inv.usedBid * (1 - INVENTORY.replenish);
      const usedAsk = inv.usedAsk * (1 - INVENTORY.replenish) < 1 ? 0 : inv.usedAsk * (1 - INVENTORY.replenish);
      if (nextInv === 0 && usedBid === 0 && usedAsk === 0) delete s.inventory[id];
      else s.inventory[id] = { inv: nextInv, usedBid, usedAsk };
    }
    const flag = s.frame >= this.totalFrames - 1;
    s.phase = flag ? "flag" : "live";
    if (flag) {
      this.expireOrders((o) => this.contract(o.contractId)?.scope === "race", "the chequered flag closed the market");
      this.log("CLOCK", `Chequered flag at ${this.lens.race.name}. Race markets are closed pending the official classification.`);
    } else {
      this.fillResting();
    }
    for (const c of this.lens.contracts) if (c.scope === "season") s.seasonMarks[c.id] = this.fair(c.id);
    this.recordNav(false);
    return true;
  }

  private fillResting(): void {
    const s = this.state;
    // Price-time priority: better price first, then earlier order.
    const queue = [...s.orders].sort((a, b) => (a.contractId === b.contractId && a.dir === b.dir ? (a.dir === 1 ? b.yesLimit - a.yesLimit : a.yesLimit - b.yesLimit) || a.seq - b.seq : a.seq - b.seq));
    for (const o of queue) {
      const c = this.contract(o.contractId);
      if (!c) continue;
      const q = this.quoteFor(c.id);
      const m = matchResting(q, o.dir, o.qty - o.filled, o.yesLimit);
      if (m.filled <= 0) continue;
      // Re-check cash for buys: reserves make this a formality, but never let a fill overdraw the account.
      if (o.action === "BUY") {
        const own = o.side === "YES" ? o.yesLimit : 100 - o.yesLimit;
        const freeCash = s.ledger.cash - lockedCollateral(s.ledger);
        if (freeCash < m.filled * own + m.fee) continue;
      }
      this.book(c, o.id, o.side, o.action, o.dir, m.fills, "maker", q);
      o.filled += m.filled;
    }
    s.orders = s.orders.filter((o) => o.filled < o.qty);
  }

  private expireOrders(pred: (o: RestingOrder) => boolean, why: string): void {
    const s = this.state;
    for (const o of s.orders.filter(pred)) {
      this.log("EXPIRE", `Resting order expired (${why}): ${o.action.toLowerCase()} ${(o.qty - o.filled).toLocaleString("en-US")} ${o.side} — ${this.titleOf(o.contractId)}`);
    }
    s.orders = s.orders.filter((o) => !pred(o));
  }

  // ---------------------------------------------------------------- settlement
  /** Settle the round on the official classification. Safe to call more than once. */
  settleRace(settlement: SettlementFile, seasonSettlement: SeasonSettlementFile | null = null): SettlementRecord[] {
    const s = this.state;
    if (settlement.id !== this.lens.race.id) throw new Error("settlement file does not belong to this race");
    if (s.phase !== "flag") return [];
    const records: SettlementRecord[] = [];
    for (const c of this.lens.contracts) {
      if (c.scope !== "race") continue;
      const pos = s.ledger.positions[c.id];
      if (!pos || pos.q === 0) continue;
      const payoff = settleRaceContract(c, settlement);
      if (payoff === null) continue;
      records.push(this.settleOne(c, payoff));
    }
    s.settledRounds.push(s.round);
    s.phase = "settled";
    this.log("SETTLE", `${this.lens.race.name} settled on the official classification: ${records.length} position${records.length === 1 ? "" : "s"} resolved.`);
    const finalRound = this.season.status === "complete" && s.round === Math.max(...this.season.rounds.map((r) => r.round));
    if (finalRound && seasonSettlement && !s.seasonSettled) {
      for (const c of this.lens.contracts) {
        if (c.scope !== "season") continue;
        const payoff = settleSeasonContract(c, seasonSettlement);
        if (payoff === null) continue;
        s.seasonMarks[c.id] = payoff;
        const pos = s.ledger.positions[c.id];
        if (!pos || pos.q === 0) continue;
        records.push(this.settleOne(c, payoff));
      }
      this.expireOrders(() => true, "the season has ended");
      s.seasonSettled = true;
      this.log("SETTLE", `The ${s.season} championships are settled: ${seasonSettlement.champion.driver.name} and ${seasonSettlement.champion.constructor.name}.`);
    }
    const navEnd = this.nav();
    const summary = s.races.find((r) => r.round === s.round);
    if (summary) {
      summary.navEnd = navEnd;
      summary.realized = s.ledger.realized - summary.realized;
      summary.fees = s.ledger.fees - summary.fees;
      summary.fills = s.fills.filter((f) => f.round === s.round).length;
      summary.settled = records.length;
    }
    this.recordNav(true);
    return records;
  }

  private settleOne(c: Contract, payoff: 0 | 1): SettlementRecord {
    const s = this.state;
    const basis = s.ledger.positions[c.id]?.basis ?? 0;
    const r = applySettlement(s.ledger, c.id, payoff);
    s.ledger = r.ledger;
    delete s.inventory[c.id];
    const record: SettlementRecord = {
      seq: ++s.seq, round: s.round, raceId: c.raceId, contractId: c.id, kind: c.kind, title: c.title,
      q: r.q, payoff, cashFlow: r.cashFlow, realized: r.realized, basis,
    };
    s.settlements.push(record);
    s.titles[c.id] = { title: c.title, kind: c.kind, raceId: c.raceId };
    this.log("SETTLE", `${c.title}: resolved ${payoff ? "YES" : "NO"}. ${r.q > 0 ? `${r.q.toLocaleString("en-US")} YES` : `${(-r.q).toLocaleString("en-US")} NO`} → ${r.realized >= 0 ? "+" : "−"}$${(Math.abs(r.realized) / 100).toFixed(2)}`);
    return record;
  }

  /** Whether another round with data follows the current one. */
  nextRound(): number | null {
    const later = this.season.rounds.map((r) => r.round).filter((r) => r > this.state.round);
    return later.length ? Math.min(...later) : null;
  }

  /** Move to the next round. The caller supplies the lens for that round. */
  openRound(lens: RaceLens): void {
    const s = this.state;
    if (s.phase !== "settled") throw new Error("the current round has not settled");
    if (lens.race.round <= s.round) throw new Error("the clock only moves forward");
    this.lens = lens;
    s.round = lens.race.round;
    s.frame = 0;
    s.phase = "pre";
    // Race books belong to the finished race; title-contract inventory carries over.
    for (const id of Object.keys(s.inventory)) if (!lens.indexOf.has(id)) delete s.inventory[id];
    this.lens.ensure(0);
    this.beginRace();
  }

  private beginRace(): void {
    const s = this.state;
    const race = this.lens.race;
    for (const c of this.lens.contracts) if (c.scope === "season") s.seasonMarks[c.id] = this.fair(c.id);
    const navStart = this.nav();
    if (!s.races.some((r) => r.round === race.round)) {
      s.races.push({ round: race.round, raceId: race.id, name: race.name, navStart, navEnd: navStart, realized: s.ledger.realized, fees: s.ledger.fees, fills: 0, settled: 0 });
    }
    this.log("CLOCK", `Round ${race.round}: ${race.name}. Markets open on the starting grid.`);
    this.recordNav(true);
  }

  // ---------------------------------------------------------------- bookkeeping
  private recordNav(replaceSameFrame: boolean): void {
    const s = this.state;
    const point: NavPoint = { round: s.round, frame: s.frame, nav: Math.round(this.nav()), cash: s.ledger.cash };
    const last = s.navHistory[s.navHistory.length - 1];
    if (replaceSameFrame && last && last.round === point.round && last.frame === point.frame) s.navHistory[s.navHistory.length - 1] = point;
    else s.navHistory.push(point);
  }

  private titleOf(contractId: string): string {
    return this.contract(contractId)?.title ?? this.state.titles[contractId]?.title ?? contractId;
  }

  private nextId(prefix: string): string {
    return `${prefix}${(++this.state.seq).toString(36)}`;
  }

  private log(type: AuditEvent["type"], text: string): void {
    const s = this.state;
    s.audit.push({ seq: ++s.seq, round: s.round, frame: s.frame, type, text });
    if (s.audit.length > 1500) s.audit.splice(0, s.audit.length - 1500);
  }
}

export { KIND_META };
