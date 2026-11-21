/**
 * Every tunable of the simulated market lives here, with its status:
 *   [measured]  taken from pipeline/reference (real venue fee schedules / order-book snapshot)
 *   [assumed]   a modelling choice, stated in docs/METHODOLOGY.md
 */
import type { TrackStatus } from "../types";
import type { ContractKind } from "./contracts";

export const TICK_CENTS = 1; // [measured] one-cent ticks, as on Kalshi and (above/below the tails) Polymarket
export const MIN_PRICE = 1;
export const MAX_PRICE = 99;
export const LEVELS = 5;

export const FEES = {
  /** [measured] Kalshi taker fee: round up to the next cent of 0.07 x contracts x P x (1 - P). */
  takerCoef: 0.07,
  /** [measured] Kalshi maker fee on its F1 race-winner and podium series: a quarter of the taker rate. */
  makerCoef: 0.0175,
};

export const SPREAD = {
  // floor, curvature and informed were set so that the dealer's pre-race quoted spread by price
  // level sits inside the range measured on real F1 markets (pipeline/reference, 21 Nov 2026
  // snapshot: median 1c below 5c, 4-5c between 5c and 35c, 3-9c around 50c). See spread.test.ts.
  /** [calibrated] order-processing floor of the half-spread, in probability units. */
  floor: 0.002,
  /** [calibrated] half-spread component proportional to sqrt(p(1-p)). */
  curvature: 0.008,
  /** [calibrated] share of the expected one-step move in fair value the dealer charges for (adverse selection). */
  informed: 0.36,
  /** [assumed] weight on realised (EWMA) versus structural variance. */
  realisedWeight: 0.5,
  /** [assumed] decay of the realised-variance EWMA per frame. */
  varDecay: 0.7,
  /** [assumed] quoted half-spread is capped at this many probability points. */
  cap: 0.12,
};

/** [assumed] how much more information the next frame is expected to carry in each track state. */
export const STATUS_INFO: Record<TrackStatus | "GRID", number> = {
  GRID: 1.4, // the start and first lap
  GREEN: 1.0,
  YELLOW: 1.2,
  VSC: 1.5,
  SC: 1.9,
  RED: 3.0,
};

/** [assumed] share of normal depth the dealer shows in each track state. */
export const STATUS_DEPTH: Record<TrackStatus | "GRID", number> = {
  GRID: 1.0,
  GREEN: 1.0,
  YELLOW: 0.8,
  VSC: 0.6,
  SC: 0.5,
  RED: 0,
};

/**
 * [assumed] contracts shown at the best price for a 50-cent market; scaled by depthShape(p) and level multipliers.
 * Deliberately deeper than the venues measured (median 90-250 contracts at the touch) so that a
 * $100,000 account can express a view; price impact still appears within a few thousand contracts.
 */
export const TOP_SIZE: Record<ContractKind, number> = {
  WIN: 1500,
  POD: 1200,
  PTS: 1000,
  DNF: 500,
  H2H: 900,
  WDC: 2500,
  WCC: 2000,
};
export const LEVEL_MULT = [1, 1.4, 1.9, 2.5, 3.2];

export const INVENTORY = {
  /** [assumed] reservation price moves by `skew` half-spreads per `unit` top-sizes of dealer inventory. */
  skew: 0.8,
  maxSkewHalfSpreads: 3,
  /** [assumed] share of inventory the dealer lays off elsewhere each frame. */
  decay: 0.25,
  /** [assumed] share of consumed depth restored each frame. */
  replenish: 0.5,
};

export const RISK_LIMITS = {
  /** Largest loss a single contract may cause, as a share of net asset value. */
  perContract: 0.2,
  /** Largest worst-case loss across all open positions, as a share of net asset value. */
  total: 0.5,
};

export const START_CASH_CENTS = 100_000_00;
