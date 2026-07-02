import { Contract } from "../../hooks/useSimulation";
import { Position } from "../../hooks/usePortfolio";

export interface PositionBooks {
  racePositions: Position[];
  seasonPositions: Position[];
}

/**
 * Split the portfolio's open positions into the Race Book (short-term GP contracts)
 * and the Season Book (championship futures). Consolidates logic previously
 * duplicated across TerminalShell and PortfolioTab.
 */
export function splitPositionsByBook(
  positions: { [id: string]: Position },
  contracts: { [id: string]: Contract }
): PositionBooks {
  const positionsArray = Object.values(positions);

  const isSeason = (pos: Position) => {
    const contract = contracts[pos.contractId];
    return contract
      ? contract.type.startsWith("FUTURE_")
      : pos.contractId.startsWith("FUTURE_");
  };

  return {
    racePositions: positionsArray.filter((pos) => !isSeason(pos)),
    seasonPositions: positionsArray.filter((pos) => isSeason(pos)),
  };
}

/**
 * Live exit valuation of a position at current market prices, honoring
 * settlement value and LAY-side complement pricing.
 */
export function positionExitPrice(pos: Position, contract: Contract | undefined): number {
  if (!contract) return pos.entryPrice;
  if (contract.settled) return contract.settlementValue ?? 0;
  return pos.side === "LAY" ? 1.0 - contract.ask : contract.bid;
}
