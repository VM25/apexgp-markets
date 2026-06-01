import { useState, useEffect, useRef, useCallback } from "react";
import { Contract } from "./useSimulation";

export interface Position {
  contractId: string;
  contractTitle: string;
  contractType: string;
  target: string;
  side: "BUY" | "LAY";
  qty: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
}

export interface TradeLog {
  timestamp: string;
  contractTitle: string;
  type: "BUY" | "SELL" | "SETTLE";
  qty: number;
  price: number;
  notional: number;
  pnl?: number;
}

export interface EquityCurvePoint {
  lap: number;
  value: number;
}

export interface SettledPosition {
  contractId: string;
  contractTitle: string;
  side: "BUY" | "LAY";
  qty: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  settledAs: string;
}

export function usePortfolio(
  contracts: { [id: string]: Contract },
  currentLap: number,
  totalLaps: number,
  raceId: string,
  isHalted: boolean
) {
  const [cash, setCash] = useState<number>(100000);
  const [positions, setPositions] = useState<{ [posKey: string]: Position }>({});
  const [tradeHistory, setTradeHistory] = useState<TradeLog[]>([]);
  const [equityCurve, setEquityCurve] = useState<EquityCurvePoint[]>([{ lap: 0, value: 100000 }]);
  const [peakValue, setPeakValue] = useState<number>(100000);
  const [maxDrawdown, setMaxDrawdown] = useState<number>(0);
  const [lastSettledPositions, setLastSettledPositions] = useState<SettledPosition[]>([]);
  const [cashBeforeSettlement, setCashBeforeSettlement] = useState<number>(100000);
  const [cashAfterSettlement, setCashAfterSettlement] = useState<number>(100000);
  
  const prevRaceIdRef = useRef<string>(raceId);
  const prevLapRef = useRef<number>(currentLap);
  const lastPricesRef = useRef<{ [posKey: string]: number }>({});

  // Capture active prices lap-by-lap to enable robust liquidation on simulation reset/switch
  useEffect(() => {
    if (currentLap > 0) {
      const prices: { [posKey: string]: number } = {};
      Object.keys(positions).forEach((posKey) => {
        const pos = positions[posKey];
        const c = contracts[pos.contractId];
        if (c) {
          const finalVal = c.settled ? (c.settlementValue ?? 0) : 0;
          if (c.settled) {
            prices[posKey] = pos.side === "LAY" ? (1.00 - finalVal) : finalVal;
          } else {
            prices[posKey] = pos.side === "LAY" ? (1.00 - c.ask) : c.bid;
          }
        }
      });
      lastPricesRef.current = { ...lastPricesRef.current, ...prices };
    }
  }, [currentLap, contracts, positions]);

  // Re-calculate live position values and PnL when contracts update
  const getAssetsValue = useCallback((currentPositions: { [posKey: string]: Position }) => {
    let value = 0;
    Object.values(currentPositions).forEach((pos) => {
      const contract = contracts[pos.contractId];
      if (contract) {
        const exitPrice = contract.settled
          ? (contract.settlementValue !== null ? (pos.side === "LAY" ? 1.00 - contract.settlementValue : contract.settlementValue) : pos.entryPrice)
          : (pos.side === "LAY" ? (1.00 - contract.ask) : contract.bid);
        value += pos.qty * exitPrice;
      } else {
        value += pos.qty * pos.entryPrice;
      }
    });
    return value;
  }, [contracts]);

  const getUnrealizedPnL = useCallback((currentPositions: { [posKey: string]: Position }) => {
    let pnl = 0;
    Object.values(currentPositions).forEach((pos) => {
      const contract = contracts[pos.contractId];
      if (contract) {
        const exitPrice = contract.settled
          ? (contract.settlementValue !== null ? (pos.side === "LAY" ? 1.00 - contract.settlementValue : contract.settlementValue) : pos.entryPrice)
          : (pos.side === "LAY" ? (1.00 - contract.ask) : contract.bid);
        pnl += pos.qty * (exitPrice - pos.entryPrice);
      }
    });
    return pnl;
  }, [contracts]);

  const assetsValue = getAssetsValue(positions);
  const portfolioValue = cash + assetsValue;
  const unrealizedPnL = getUnrealizedPnL(positions);
  const totalPnL = unrealizedPnL + tradeHistory.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const exposurePercent = portfolioValue > 0 ? (assetsValue / portfolioValue) * 100 : 0;

  // Track Equity Curve over lap progression
  useEffect(() => {
    if (currentLap === 0) {
      setEquityCurve([{ lap: 0, value: portfolioValue }]);
      return;
    }

    setEquityCurve((prev) => {
      const filtered = prev.filter((pt) => pt.lap !== currentLap);
      return [...filtered, { lap: currentLap, value: portfolioValue }].sort((a, b) => a.lap - b.lap);
    });

    // Update drawdown
    if (portfolioValue > peakValue) {
      setPeakValue(portfolioValue);
    } else {
      const dd = ((peakValue - portfolioValue) / peakValue) * 100;
      if (dd > maxDrawdown) {
        setMaxDrawdown(Math.round(dd * 100) / 100);
      }
    }
  }, [currentLap, portfolioValue, peakValue, maxDrawdown]);

  // Settle all active positions
  const settleAllActivePositions = useCallback((useLastPrices = false) => {
    setPositions((prevPositions) => {
      const nextPositions = { ...prevPositions };
      const logs: TradeLog[] = [];
      let cashCredit = 0;
      const settledList: SettledPosition[] = [];

      Object.keys(nextPositions).forEach((posKey) => {
        const pos = nextPositions[posKey];
        const contract = contracts[pos.contractId];
        
        // Skip futures if the race is NOT Abu Dhabi (or if this is not the final season completion of Abu Dhabi)
        const isChampionshipFuture = pos.contractType === "FUTURE_DRIVERS" || pos.contractType === "FUTURE_CONSTRUCTORS" || (contract && (contract.type === "FUTURE_DRIVERS" || contract.type === "FUTURE_CONSTRUCTORS"));
        const isAbuDhabiEnd = raceId === "abu_dhabi" && currentLap === totalLaps && totalLaps > 0;
        
        if (isChampionshipFuture && !isAbuDhabiEnd) {
          // Keep the position open across races until season completion!
          return;
        }
        
        let settlementPrice = pos.entryPrice;
        if (useLastPrices && lastPricesRef.current[posKey] !== undefined) {
          settlementPrice = lastPricesRef.current[posKey];
        } else if (contract) {
          const finalVal = contract.settled ? (contract.settlementValue ?? 0) : contract.bid;
          settlementPrice = pos.side === "LAY" ? (1.00 - finalVal) : finalVal;
        }

        const payout = pos.qty * settlementPrice;
        const profit = pos.qty * (settlementPrice - pos.entryPrice);
        cashCredit += payout;

        settledList.push({
          contractId: pos.contractId,
          contractTitle: pos.contractTitle,
          side: pos.side,
          qty: pos.qty,
          entryPrice: pos.entryPrice,
          exitPrice: settlementPrice,
          pnl: Math.round(profit * 100) / 100,
          settledAs: settlementPrice === 1.0 ? "TRUE ($1.00)" : (settlementPrice === 0.0 ? "FALSE ($0.00)" : `$${settlementPrice.toFixed(2)}`)
        });

        logs.push({
          timestamp: new Date().toTimeString().split(" ")[0],
          contractTitle: pos.contractTitle,
          type: "SETTLE",
          qty: pos.qty,
          price: settlementPrice,
          notional: payout,
          pnl: Math.round(profit * 100) / 100
        });

        delete nextPositions[posKey];
      });

      setLastSettledPositions(settledList);

      setCash((prev) => {
        setCashBeforeSettlement(prev);
        const nextCash = prev + cashCredit;
        setCashAfterSettlement(nextCash);
        return nextCash;
      });

      if (logs.length > 0) {
        setTradeHistory((prev) => [...logs, ...prev]);
      }
      return nextPositions;
    });
  }, [contracts]);

  // Handle Race Switch Position Auto-settlement
  useEffect(() => {
    if (prevRaceIdRef.current !== raceId) {
      settleAllActivePositions(true);
      prevRaceIdRef.current = raceId;
      setEquityCurve([{ lap: 0, value: portfolioValue }]);
      setPeakValue(portfolioValue);
      setMaxDrawdown(0);
    }
  }, [raceId, settleAllActivePositions, portfolioValue]);

  // Handle Simulation Reset Position Auto-settlement
  useEffect(() => {
    if (currentLap === 0 && prevLapRef.current > 0) {
      settleAllActivePositions(true);
      lastPricesRef.current = {};
    }
    prevLapRef.current = currentLap;
  }, [currentLap, settleAllActivePositions]);

  // Auto-settlement at the end of the race
  useEffect(() => {
    if (currentLap > 0 && currentLap === totalLaps) {
      settleAllActivePositions(false);
    }
  }, [currentLap, totalLaps, settleAllActivePositions]);

  // Buy Event Contracts (with Halted safety checks and exposure limits)
  const buyContracts = (contractId: string, qty: number, side: "BUY" | "LAY" = "BUY"): { success: boolean; message: string } => {
    if (isHalted) {
      return { 
        success: false, 
        message: "Trading halted: Market risk limits suspended due to dynamic race control action." 
      };
    }

    const contract = contracts[contractId];
    if (!contract || contract.settled) {
      return { success: false, message: "Contract is not active." };
    }

    const price = side === "LAY" ? (1.00 - contract.bid) : contract.ask;
    const cost = qty * price;

    if (cost > cash) {
      return { success: false, message: "Insufficient cash balance." };
    }

    // Risk rule 2: Max 30% total exposure
    const nextAssetsValue = assetsValue + cost;
    const nextPortfolioValue = portfolioValue;
    const nextExposure = (nextAssetsValue / nextPortfolioValue) * 100;
    if (nextExposure > 30.01) {
      return { 
        success: false, 
        message: `Risk limit violated: Total exposure would be ${nextExposure.toFixed(1)}% (Limit: 30%).` 
      };
    }

    // Risk rule 3: Max 15% single-market exposure
    const posKey = side === "LAY" ? `${contractId}_NO` : contractId;
    const existingPos = positions[posKey];
    const currentContractPrice = contract.bid;
    const currentPosPrice = side === "LAY" ? (1.00 - contract.ask) : currentContractPrice;
    
    const existingCost = existingPos ? existingPos.qty * currentPosPrice : 0;
    const nextSingleCost = existingCost + cost;
    const nextSingleExposure = (nextSingleCost / nextPortfolioValue) * 100;
    if (nextSingleExposure > 15.01) {
      return {
        success: false,
        message: `Risk limit violated: Exposure in this market would be ${nextSingleExposure.toFixed(1)}% (Limit: 15%).`
      };
    }

    // Perform buy
    setCash((prev) => prev - cost);
    setPositions((prev) => {
      const next = { ...prev };
      if (next[posKey]) {
        const prevPos = next[posKey];
        const newQty = prevPos.qty + qty;
        const newEntry = (prevPos.qty * prevPos.entryPrice + cost) / newQty;
        next[posKey] = {
          ...prevPos,
          qty: newQty,
          entryPrice: Math.round(newEntry * 1000) / 1000,
          currentPrice: currentPosPrice,
          unrealizedPnL: newQty * (currentPosPrice - newEntry)
        };
      } else {
        next[posKey] = {
          contractId,
          contractTitle: side === "LAY" ? `${contract.title} [Against]` : contract.title,
          contractType: contract.type,
          target: contract.target,
          side,
          qty,
          entryPrice: price,
          currentPrice: currentPosPrice,
          unrealizedPnL: qty * (currentPosPrice - price)
        };
      }
      return next;
    });

    setTradeHistory((prev) => [
      {
        timestamp: new Date().toTimeString().split(" ")[0],
        contractTitle: side === "LAY" ? `${contract.title} [Against]` : contract.title,
        type: "BUY",
        qty,
        price,
        notional: cost
      },
      ...prev
    ]);

    return { success: true, message: `Successfully opened ${side} position of ${qty} contracts for ${contract.title}.` };
  };

  // Sell/Reduce held contracts (with Halted safety checks)
  const sellContracts = (posKey: string, qty: number): { success: boolean; message: string } => {
    if (isHalted) {
      return { 
        success: false, 
        message: "Trading halted: Market risk limits suspended due to dynamic race control action." 
      };
    }

    const pos = positions[posKey];
    if (!pos || pos.qty < qty) {
      return { success: false, message: "Insufficient position quantity." };
    }

    const contract = contracts[pos.contractId];
    let price = pos.entryPrice;
    if (contract) {
      const finalVal = contract.settled ? (contract.settlementValue ?? 0) : 0;
      if (contract.settled) {
        price = pos.side === "LAY" ? (1.00 - finalVal) : finalVal;
      } else {
        price = pos.side === "LAY" ? (1.00 - contract.ask) : contract.bid;
      }
    }

    const credit = qty * price;
    const profit = qty * (price - pos.entryPrice);

    setCash((prev) => prev + credit);
    setPositions((prev) => {
      const next = { ...prev };
      if (pos.qty === qty) {
        delete next[posKey];
      } else {
        next[posKey] = {
          ...pos,
          qty: pos.qty - qty,
          currentPrice: price,
          unrealizedPnL: (pos.qty - qty) * (price - pos.entryPrice)
        };
      }
      return next;
    });

    setTradeHistory((prev) => [
      {
        timestamp: new Date().toTimeString().split(" ")[0],
        contractTitle: pos.contractTitle,
        type: "SELL",
        qty,
        price,
        notional: credit,
        pnl: Math.round(profit * 100) / 100
      },
      ...prev
    ]);

    return { success: true, message: `Successfully liquidated ${qty} contracts.` };
  };

  // Close full position
  const closePosition = (posKey: string) => {
    const pos = positions[posKey];
    if (pos) {
      return sellContracts(posKey, pos.qty);
    }
    return { success: false, message: "No active position in this contract." };
  };

  // Analytical metrics
  const getReturnPercent = () => {
    return ((portfolioValue - 100000) / 100000) * 100;
  };

  const getHitRate = () => {
    const closedTrades = tradeHistory.filter(t => t.type === "SELL" || t.type === "SETTLE");
    if (closedTrades.length === 0) return 0;
    const wins = closedTrades.filter(t => (t.pnl || 0) > 0);
    return Math.round((wins.length / closedTrades.length) * 100);
  };

  const getSharpeRatio = () => {
    if (equityCurve.length < 3) return 0;
    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const r = (equityCurve[i].value - equityCurve[i-1].value) / equityCurve[i-1].value;
      returns.push(r);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return 0;
    return Math.round((mean / stdDev) * Math.sqrt(252) * 100) / 100;
  };

  const resetPortfolio = () => {
    setCash(100000);
    setPositions({});
    setTradeHistory([]);
    setEquityCurve([{ lap: 0, value: 100000 }]);
    setPeakValue(100000);
    setMaxDrawdown(0);
    setLastSettledPositions([]);
    setCashBeforeSettlement(100000);
    setCashAfterSettlement(100000);
    lastPricesRef.current = {};
  };

  // Portfolio Greeks Accumulator
  const getNetGreeks = () => {
    let totalDelta = 0;
    let totalTheta = 0;
    let sumIv = 0;
    let count = 0;

    Object.values(positions).forEach(pos => {
      const contract = contracts[pos.contractId];
      if (contract && !contract.settled) {
        totalDelta += pos.qty * (contract.delta || 0);
        totalTheta += pos.qty * (contract.theta || 0);
        sumIv += (contract.iv || 0);
        count++;
      }
    });

    return {
      netDelta: Math.round(totalDelta * 100) / 100,
      netTheta: Math.round(totalTheta * 1000) / 1000,
      avgIv: count > 0 ? Math.round((sumIv / count) * 100) : 0
    };
  };

  const { netDelta, netTheta, avgIv } = getNetGreeks();

  return {
    cash,
    positions,
    assetsValue,
    portfolioValue,
    unrealizedPnL,
    totalPnL,
    exposurePercent,
    tradeHistory,
    equityCurve,
    maxDrawdown,
    netDelta,
    netTheta,
    avgIv,
    buyContracts,
    sellContracts,
    closePosition,
    getReturnPercent,
    getHitRate,
    getSharpeRatio,
    resetPortfolio,
    lastSettledPositions,
    cashBeforeSettlement,
    cashAfterSettlement
  };
}
