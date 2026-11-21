/**
 * Order execution against the dealer's ladder.
 *
 * Everything is expressed in YES prices. `dir = +1` lifts the dealer's asks
 * (BUY YES, or SELL NO to close); `dir = -1` hits the dealer's bids (SELL YES
 * to close, or BUY NO: buying NO at 100 - bid is the same trade as selling YES
 * at the bid with the $1.00 payout fully collateralised).
 *
 * Marketable quantity walks the ladder level by level, so larger orders get a
 * worse average price and can be partially filled when visible depth runs out.
 */
import { FEES } from "./params";
import type { BookState, Quote } from "./quote";

export type Side = "YES" | "NO";
export type Action = "BUY" | "SELL";

export interface Fill {
  /** YES price in cents. */
  price: number;
  qty: number;
}

export interface MatchResult {
  fills: Fill[];
  filled: number;
  remaining: number;
  /** Size-weighted average YES price in cents (NaN when nothing filled). */
  avgPrice: number;
  /** Total fee in cents. */
  fee: number;
}

export function direction(side: Side, action: Action): 1 | -1 {
  return (side === "YES") === (action === "BUY") ? 1 : -1;
}

/** Fee in whole cents: round up coef x contracts x P x (1 - P), P in dollars. */
export function feeCents(qty: number, priceCents: number, liquidity: "taker" | "maker"): number {
  if (qty <= 0) return 0;
  const coef = liquidity === "taker" ? FEES.takerCoef : FEES.makerCoef;
  const p = priceCents / 100;
  return Math.ceil(coef * qty * p * (1 - p) * 100 - 1e-9);
}

/**
 * Match `qty` contracts against the ladder. `limit` (YES cents) bounds the worst acceptable price:
 * for dir +1 nothing above it is bought; for dir -1 nothing below it is sold.
 */
export function matchLadder(q: Quote, dir: 1 | -1, qty: number, limit: number | null): MatchResult {
  const fills: Fill[] = [];
  let remaining = qty;
  let fee = 0;
  if (q.state === "open") {
    const levels = dir === 1 ? q.asks : q.bids;
    for (const level of levels) {
      if (remaining <= 0) break;
      if (limit !== null && (dir === 1 ? level.price > limit : level.price < limit)) break;
      const take = Math.min(remaining, level.size);
      if (take <= 0) continue;
      fills.push({ price: level.price, qty: take });
      fee += feeCents(take, level.price, "taker");
      remaining -= take;
    }
  }
  const filled = qty - remaining;
  const notional = fills.reduce((acc, f) => acc + f.price * f.qty, 0);
  return { fills, filled, remaining, avgPrice: filled > 0 ? notional / filled : NaN, fee };
}

/** Dealer book after trading `filled` contracts with the user in direction `dir`. */
export function consume(book: BookState, dir: 1 | -1, filled: number): BookState {
  if (filled <= 0) return book;
  return dir === 1
    ? { ...book, inv: book.inv - filled, usedAsk: book.usedAsk + filled }
    : { ...book, inv: book.inv + filled, usedBid: book.usedBid + filled };
}

/**
 * A resting limit order is filled when the dealer's opposite quote reaches it.
 * The user is the maker: the fill is at the user's limit price, for at most the
 * depth the dealer shows at or through that price.
 */
export function matchResting(q: Quote, dir: 1 | -1, qty: number, limit: number): MatchResult {
  if (q.state !== "open") return { fills: [], filled: 0, remaining: qty, avgPrice: NaN, fee: 0 };
  const levels = dir === 1 ? q.asks : q.bids;
  let available = 0;
  for (const level of levels) {
    if (dir === 1 ? level.price <= limit : level.price >= limit) available += level.size;
  }
  const filled = Math.min(qty, available);
  if (filled <= 0) return { fills: [], filled: 0, remaining: qty, avgPrice: NaN, fee: 0 };
  return { fills: [{ price: limit, qty: filled }], filled, remaining: qty - filled, avgPrice: limit, fee: feeCents(filled, limit, "maker") };
}
