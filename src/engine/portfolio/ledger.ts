/**
 * Cash and position accounting, in integer cents.
 *
 * A position is a signed quantity of YES contracts: q > 0 is a YES holding,
 * q < 0 is a NO holding of |q| contracts (economically a fully collateralised
 * short YES). Holding YES and NO of the same contract is therefore impossible
 * by construction — the two net, exactly as a matched pair redeems for $1.00.
 *
 * Raw cash moves by  -dq x price - fee  on every fill and by  q x 100 x payoff
 * at settlement. $1.00 per NO contract is locked as collateral, so
 *
 *   available = cash - 100 x sum(max(0, -q)) - reserved for resting orders
 *   NAV       = cash + sum(q x mark)
 *   NAV       = start + realised + unrealised - fees        (checked in tests)
 */

export interface Position {
  contractId: string;
  /** Signed YES quantity. */
  q: number;
  /** Cost basis of the open quantity in own-side cents (YES price for q > 0, NO price for q < 0). */
  basis: number;
  realized: number;
  fees: number;
}

export interface Ledger {
  startCash: number;
  cash: number;
  realized: number;
  fees: number;
  positions: Record<string, Position>;
}

export const newLedger = (startCash: number): Ledger => ({ startCash, cash: startCash, realized: 0, fees: 0, positions: {} });

const ownPrice = (q: number, yesPrice: number) => (q >= 0 ? yesPrice : 100 - yesPrice);

export interface FillResult {
  ledger: Ledger;
  /** Realised P&L of this fill in cents (before fees). */
  realized: number;
  /** Contracts that reduced an existing position, and contracts that opened or added. */
  closed: number;
  opened: number;
}

/** Apply a fill of `dq` YES contracts (signed) at `price` cents with `fee` cents. */
export function applyFill(ledger: Ledger, contractId: string, dq: number, price: number, fee: number): FillResult {
  const prev = ledger.positions[contractId] ?? { contractId, q: 0, basis: 0, realized: 0, fees: 0 };
  let { q, basis } = prev;
  let realized = 0;
  let closed = 0;
  let opened = 0;
  let left = dq;
  if (q !== 0 && Math.sign(left) !== Math.sign(q)) {
    // Reducing (and possibly flipping) the position: realise against average cost.
    closed = Math.min(Math.abs(left), Math.abs(q));
    const avg = basis / Math.abs(q);
    realized = closed * (ownPrice(q, price) - avg);
    basis -= avg * closed;
    q += Math.sign(left) * closed;
    left -= Math.sign(left) * closed;
    if (q === 0) basis = 0;
  }
  if (left !== 0) {
    opened = Math.abs(left);
    q += left;
    basis += opened * ownPrice(q, price);
  }
  const position: Position = { contractId, q, basis, realized: prev.realized + realized, fees: prev.fees + fee };
  const positions = { ...ledger.positions, [contractId]: position };
  return {
    ledger: { ...ledger, cash: ledger.cash - dq * price - fee, realized: ledger.realized + realized, fees: ledger.fees + fee, positions },
    realized,
    closed,
    opened,
  };
}

export interface SettleResult {
  ledger: Ledger;
  /** Cash paid to (+) or by (-) the account. */
  cashFlow: number;
  realized: number;
  q: number;
}

/** Settle a contract at payoff 0 or 1. Idempotent: a flat or missing position is a no-op. */
export function applySettlement(ledger: Ledger, contractId: string, payoff: 0 | 1): SettleResult {
  const prev = ledger.positions[contractId];
  if (!prev || prev.q === 0) return { ledger, cashFlow: 0, realized: 0, q: 0 };
  const cashFlow = prev.q * 100 * payoff;
  const value = prev.q > 0 ? prev.q * 100 * payoff : -prev.q * 100 * (1 - payoff);
  const realized = value - prev.basis;
  const positions = { ...ledger.positions, [contractId]: { ...prev, q: 0, basis: 0, realized: prev.realized + realized } };
  return { ledger: { ...ledger, cash: ledger.cash + cashFlow, realized: ledger.realized + realized, positions }, cashFlow, realized, q: prev.q };
}

/** Collateral locked behind NO positions, in cents. */
export function lockedCollateral(ledger: Ledger): number {
  let locked = 0;
  for (const p of Object.values(ledger.positions)) if (p.q < 0) locked += -p.q * 100;
  return locked;
}

export function openPositions(ledger: Ledger): Position[] {
  return Object.values(ledger.positions).filter((p) => p.q !== 0);
}

/** Mark value of one position in cents; `mark` is a YES probability in [0, 1]. */
export function positionValue(p: Position, mark: number): number {
  return p.q >= 0 ? p.q * mark * 100 : -p.q * (1 - mark) * 100;
}

export function unrealized(p: Position, mark: number): number {
  return positionValue(p, mark) - p.basis;
}

/** Net asset value in cents given YES marks per contract. */
export function nav(ledger: Ledger, marks: (contractId: string) => number): number {
  let v = ledger.cash;
  for (const p of Object.values(ledger.positions)) if (p.q !== 0) v += p.q * marks(p.contractId) * 100;
  return v;
}
