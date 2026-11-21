/**
 * The simulated dealer.
 *
 * ApexGP does not run a central limit order book: there is one automated
 * market maker per contract, and the user is its only counterparty. The dealer
 * quotes a ladder of bids and asks around a reservation price:
 *
 *   sigma^2     = blend of (a) p(1-p)/frames_left — the variance a probability
 *                 that must end at 0 or 1 has left to spend, spread evenly over
 *                 the remaining frames — and (b) an EWMA of realised squared moves
 *   half-spread = floor + curvature*sqrt(p(1-p)) + informed * sigma * info(status)
 *   reservation = fair - skew * (inventory / top size) * half-spread
 *   best ask    = ceil_tick(reservation + half-spread), best bid = floor_tick(reservation - half-spread)
 *
 * The dealer does not learn from the user's orders (the fair value comes from
 * the race model, not from order flow); inventory skew gives temporary price
 * impact that decays as the dealer lays the position off.
 */
import type { TrackStatus } from "../types";
import type { ContractKind } from "./contracts";
import { INVENTORY, LEVELS, LEVEL_MULT, MAX_PRICE, MIN_PRICE, SPREAD, STATUS_DEPTH, STATUS_INFO, TOP_SIZE } from "./params";

export interface BookState {
  /** Dealer inventory in YES contracts (positive = dealer is long YES). */
  inv: number;
  /** Depth consumed and not yet replenished, per side, in contracts. */
  usedBid: number;
  usedAsk: number;
  /** EWMA of squared one-frame changes in fair value. */
  variance: number;
  lastFair: number | null;
}

export const emptyBook = (): BookState => ({ inv: 0, usedBid: 0, usedAsk: 0, variance: 0, lastFair: null });

export type MarketState = "open" | "suspended" | "closed" | "settled";

export interface Level {
  /** YES price in cents. */
  price: number;
  size: number;
}

export interface Quote {
  state: MarketState;
  reason: string | null;
  fair: number;
  reservation: number;
  halfSpread: number;
  sigma: number;
  bids: Level[];
  asks: Level[];
  bestBid: number | null;
  bestAsk: number | null;
  /** Midpoint of the touch in probability units, falling back to fair when one side is empty. */
  mid: number;
  components: { floor: number; curvature: number; adverse: number; skew: number; infoMult: number; depthMult: number };
}

export interface QuoteContext {
  kind: ContractKind;
  status: TrackStatus;
  /** Frame index and frames in the race (frame 0 is the grid; trading closes at the final frame). */
  frame: number;
  totalFrames: number;
  /** Season contracts keep trading between frames of every race; their information horizon is the season. */
  seasonFramesLeft?: number;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function depthShape(p: number): number {
  // Thinner in the tails, where a contract is a lottery ticket or a near-certainty.
  return 0.35 + 0.65 * 4 * p * (1 - p);
}

export function quote(fair: number, book: BookState, ctx: QuoteContext): Quote {
  const p = clamp(fair, 0, 1);
  const lastTradable = ctx.totalFrames - 1; // the chequered-flag frame is not tradable
  const base: Omit<Quote, "state" | "reason" | "bids" | "asks" | "bestBid" | "bestAsk" | "mid"> = {
    fair: p, reservation: p, halfSpread: 0, sigma: 0,
    components: { floor: 0, curvature: 0, adverse: 0, skew: 0, infoMult: 1, depthMult: 1 },
  };
  if (ctx.frame >= lastTradable) {
    return { ...base, state: "closed", reason: "The chequered flag is out. Contracts settle on the official classification.", bids: [], asks: [], bestBid: null, bestAsk: null, mid: p };
  }
  if (ctx.status === "RED") {
    return { ...base, state: "suspended", reason: "Red flag: the dealer has pulled its quotes until the race resumes.", bids: [], asks: [], bestBid: null, bestAsk: null, mid: p };
  }
  const key = ctx.frame === 0 ? "GRID" : ctx.status;
  const infoMult = STATUS_INFO[key];
  const depthMult = STATUS_DEPTH[key];
  const framesLeft = Math.max(1, ctx.seasonFramesLeft ?? lastTradable - ctx.frame);
  const structural = (p * (1 - p)) / framesLeft;
  const variance = SPREAD.realisedWeight * book.variance + (1 - SPREAD.realisedWeight) * structural;
  const sigma = Math.sqrt(Math.max(variance, 0));
  const floor = SPREAD.floor;
  const curvature = SPREAD.curvature * Math.sqrt(p * (1 - p));
  const adverse = SPREAD.informed * sigma * infoMult;
  const halfSpread = Math.min(SPREAD.cap, floor + curvature + adverse);

  const top = TOP_SIZE[ctx.kind] * depthShape(p) * depthMult;
  const skewUnits = clamp((INVENTORY.skew * book.inv) / Math.max(top, 1), -INVENTORY.maxSkewHalfSpreads, INVENTORY.maxSkewHalfSpreads);
  const skew = -skewUnits * halfSpread;
  const reservation = clamp(p + skew, 0, 1);

  let ask = Math.ceil((reservation + halfSpread) * 100 - 1e-9);
  let bid = Math.floor((reservation - halfSpread) * 100 + 1e-9);
  if (ask - bid < 1) ask = bid + 1;
  ask = clamp(ask, MIN_PRICE, MAX_PRICE + 1);
  bid = clamp(bid, MIN_PRICE - 1, MAX_PRICE);

  const asks: Level[] = [];
  const bids: Level[] = [];
  // The dealer will not sell a near-certainty or bid for a near-impossibility.
  const sellSide = p < 0.995;
  const buySide = p > 0.005;
  let usedAsk = book.usedAsk;
  let usedBid = book.usedBid;
  for (let k = 0; k < LEVELS; k++) {
    const size = Math.round((top * LEVEL_MULT[k]) / 10) * 10;
    const ap = ask + k;
    if (sellSide && ap <= MAX_PRICE) {
      const take = Math.min(usedAsk, size);
      usedAsk -= take;
      if (size - take > 0) asks.push({ price: ap, size: size - take });
    }
    const bp = bid - k;
    if (buySide && bp >= MIN_PRICE) {
      const take = Math.min(usedBid, size);
      usedBid -= take;
      if (size - take > 0) bids.push({ price: bp, size: size - take });
    }
  }
  const bestBid = bids.length ? bids[0].price : null;
  const bestAsk = asks.length ? asks[0].price : null;
  const mid = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 200 : p;
  return {
    state: "open", reason: null, fair: p, reservation, halfSpread, sigma, bids, asks, bestBid, bestAsk, mid,
    components: { floor, curvature, adverse, skew, infoMult, depthMult },
  };
}

/** Advance a book by one frame: update realised variance, replenish depth, lay off inventory. */
export function stepBook(book: BookState, fair: number): BookState {
  const move = book.lastFair === null ? 0 : fair - book.lastFair;
  return {
    inv: Math.abs(book.inv) < 1 ? 0 : book.inv * (1 - INVENTORY.decay),
    usedBid: book.usedBid * (1 - INVENTORY.replenish) < 1 ? 0 : book.usedBid * (1 - INVENTORY.replenish),
    usedAsk: book.usedAsk * (1 - INVENTORY.replenish) < 1 ? 0 : book.usedAsk * (1 - INVENTORY.replenish),
    variance: book.lastFair === null ? 0 : SPREAD.varDecay * book.variance + (1 - SPREAD.varDecay) * move * move,
    lastFair: fair,
  };
}
