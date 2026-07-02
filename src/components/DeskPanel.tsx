"use client";

import React, { useState } from "react";
import { Contract } from "../hooks/useSimulation";
import { Position } from "../hooks/usePortfolio";
import { useTerminalUI } from "./TerminalUIProvider";
import { splitPositionsByBook, positionExitPrice } from "./lib/positions";
import FieldLabel from "./FieldLabel";
import OrderTicket from "./OrderTicket";
import ConfirmDialog from "./ConfirmDialog";

interface DeskPanelProps {
  activeTab: string;
  contracts: { [id: string]: Contract };
  positions: { [id: string]: Position };
  cash: number;
  assetsValue: number;
  portfolioValue: number;
  exposurePercent: number;
  returnPct: number;
  isHalted: boolean;
  buyContracts: (id: string, qty: number, side?: "BUY" | "LAY") => { success: boolean; message: string };
  sellContracts: (posKey: string, qty: number) => { success: boolean; message: string };
  closePosition: (id: string) => void;
  resetPortfolio: () => void;
}

/**
 * Contextual right rail. Supersedes the old shell right rail + in-tab tickets.
 * - market / championship: OrderTicket + selected-contract detail + compact positions strip
 * - all other tabs: portfolio snapshot + full positions list (with Reset)
 */
export default function DeskPanel({
  activeTab,
  contracts,
  positions,
  cash,
  assetsValue,
  portfolioValue,
  exposurePercent,
  returnPct,
  isHalted,
  buyContracts,
  sellContracts,
  closePosition,
  resetPortfolio,
}: DeskPanelProps) {
  const { selectedContractId } = useTerminalUI();
  const isTradingTab = activeTab === "market" || activeTab === "championship";
  const kind: "race" | "futures" = activeTab === "championship" ? "futures" : "race";

  const selectedContract = contracts[selectedContractId];
  // Only treat the selection as valid for this tab's book.
  const selectionValidForTab =
    selectedContract &&
    (kind === "futures"
      ? selectedContract.type.startsWith("FUTURE_")
      : !selectedContract.type.startsWith("FUTURE_"));

  if (isTradingTab) {
    return (
      <div className="flex flex-col h-full min-h-0 gap-3 overflow-y-auto scrollbar-none pr-0.5">
        {selectionValidForTab && selectedContract ? (
          <>
            <div className="panel-raised rounded p-3">
              <OrderTicket
                key={selectedContract.id}
                kind={kind}
                contract={selectedContract}
                positions={positions}
                cash={cash}
                portfolioValue={portfolioValue}
                assetsValue={assetsValue}
                isHalted={isHalted}
                buyContracts={buyContracts}
                sellContracts={sellContracts}
              />
            </div>
            <ContractDetail
              contract={selectedContract}
              positions={positions}
              portfolioValue={portfolioValue}
            />
            <CompactPositions positions={positions} contracts={contracts} closePosition={closePosition} />
          </>
        ) : (
          <>
            <div className="panel-raised rounded p-6 flex-1 flex flex-col items-center justify-center text-center min-h-[160px]">
              <FieldLabel className="text-slate-400 text-body-sm">
                {kind === "futures" ? "No Contender Highlighted" : "Order Desk Inactive"}
              </FieldLabel>
              <p className="text-body-sm mt-1.5 leading-snug font-sans font-light text-slate-500 max-w-[240px]">
                {kind === "futures"
                  ? "Highlight a candidate contender in the futures chain to open a title derivative ticket."
                  : "Select a contract in the market chain to activate the execution ticket."}
              </p>
            </div>
            <CompactPositions positions={positions} contracts={contracts} closePosition={closePosition} />
          </>
        )}
      </div>
    );
  }

  return (
    <PortfolioSnapshot
      contracts={contracts}
      positions={positions}
      cash={cash}
      assetsValue={assetsValue}
      exposurePercent={exposurePercent}
      returnPct={returnPct}
      closePosition={closePosition}
      resetPortfolio={resetPortfolio}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Selected-contract detail (settlement rule, exposure, outcomes, greeks) */
/* ------------------------------------------------------------------ */
function ContractDetail({
  contract,
  positions,
  portfolioValue,
}: {
  contract: Contract;
  positions: { [id: string]: Position };
  portfolioValue: number;
}) {
  const pos = positions[contract.id];
  const currentQty = pos ? pos.qty : 0;
  const entryCost = pos ? pos.qty * pos.entryPrice : 0;
  const bestOutcome = pos ? pos.qty * (1.0 - pos.entryPrice) : 0;
  const worstOutcome = pos ? -entryCost : 0;
  const itemExposure = portfolioValue > 0 ? ((currentQty * contract.bid) / portfolioValue) * 100 : 0;

  const settlementRule = (() => {
    switch (contract.type) {
      case "WINNER":
        return "Resolves on P1 finish outcome.";
      case "PODIUM":
        return "Resolves on P1-P3 podium outcome.";
      case "FASTEST_LAP":
        return "Resolves on official fastest lap score.";
      case "H2H":
        return "Resolves on head-to-head match finisher.";
      case "SAFETY_CAR":
        return "Resolves on active Safety Car deployment.";
      case "DNF":
        return "Resolves on active driver retirement.";
      case "FUTURE_DRIVERS":
      case "FUTURE_CONSTRUCTORS":
        return "Resolves at the final round (Abu Dhabi GP) on official FIA season standings.";
      default:
        return "Resolves on target race outcome.";
    }
  })();

  return (
    <div className="panel-raised rounded p-3 space-y-2.5">
      <FieldLabel className="text-micro">Selected Contract Detail</FieldLabel>

      <div className="grid grid-cols-2 gap-2 font-data text-body-sm">
        <div className="panel-base border border-white/5 rounded p-2">
          <FieldLabel className="text-micro">Exposure Ratio</FieldLabel>
          <span className={`font-bold block mt-0.5 ${itemExposure > 10 ? "text-terminal-yellow" : "text-white"}`}>
            {itemExposure.toFixed(1)}%
          </span>
        </div>
        <div className="panel-base border border-white/5 rounded p-2">
          <FieldLabel className="text-micro">Active Quantity</FieldLabel>
          <span className="text-white font-bold block mt-0.5">{currentQty} units</span>
        </div>
        <div className="panel-base border border-white/5 rounded p-2">
          <FieldLabel className="text-micro">Worst Deficit</FieldLabel>
          <span className={`font-bold block mt-0.5 ${worstOutcome < 0 ? "text-terminal-red" : "text-slate-450"}`}>
            {worstOutcome < 0 ? `-$${Math.abs(worstOutcome).toFixed(0)}` : "$0.00"}
          </span>
        </div>
        <div className="panel-base border border-white/5 rounded p-2">
          <FieldLabel className="text-micro">Best Net Gain</FieldLabel>
          <span className={`font-bold block mt-0.5 ${bestOutcome > 0 ? "text-terminal-green-light" : "text-slate-450"}`}>
            {bestOutcome > 0 ? `+$${bestOutcome.toFixed(0)}` : "$0.00"}
          </span>
        </div>
      </div>

      <div className="panel-base border border-white/5 rounded p-2 space-y-1">
        <FieldLabel className="text-micro">Settlement Rule</FieldLabel>
        <p className="text-body-sm text-slate-350 leading-normal font-sans font-light">{settlementRule}</p>
      </div>

      <div className="panel-base border border-white/5 rounded p-2 text-body-sm text-slate-400 font-data leading-snug">
        Δ Delta: <strong className="text-white">{(contract.delta || 0).toFixed(3)}</strong> · Θ Theta:{" "}
        <strong className={contract.theta >= 0 ? "text-terminal-green-light" : "text-slate-300"}>
          {(contract.theta || 0).toFixed(4)}/lap
        </strong>{" "}
        · IV: <strong className="text-terminal-gold">{((contract.iv || 0) * 100).toFixed(0)}%</strong>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Compact open-positions strip (trading tabs)                         */
/* ------------------------------------------------------------------ */
function CompactPositions({
  positions,
  contracts,
  closePosition,
}: {
  positions: { [id: string]: Position };
  contracts: { [id: string]: Contract };
  closePosition: (id: string) => void;
}) {
  const positionsArray = Object.values(positions);

  return (
    <div className="panel-raised rounded p-3 flex flex-col min-h-0">
      <FieldLabel className="text-micro mb-1.5">Open Positions</FieldLabel>
      {positionsArray.length === 0 ? (
        <div className="border border-dashed border-white/5 rounded p-3 text-center text-slate-500 text-body-sm">
          No open positions.
        </div>
      ) : (
        <div className="space-y-1.5">
          {positionsArray.map((pos) => {
            const contract = contracts[pos.contractId];
            const exit = positionExitPrice(pos, contract);
            const profit = pos.qty * (exit - pos.entryPrice);
            const posKey = pos.side === "LAY" ? `${pos.contractId}_NO` : pos.contractId;
            const isFuture = contract
              ? contract.type.startsWith("FUTURE_")
              : pos.contractId.startsWith("FUTURE_");
            return (
              <div
                key={posKey}
                className="panel-base border border-white/5 rounded p-2 flex items-center justify-between gap-2 font-data text-body-sm"
              >
                <div className="min-w-0">
                  <span
                    className={`font-bold block truncate leading-tight uppercase ${isFuture ? "text-terminal-gold font-mono" : "text-white"}`}
                  >
                    {pos.contractTitle}
                  </span>
                  <span className="text-micro text-slate-500 uppercase">
                    {pos.qty} @ ${pos.entryPrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`font-bold ${profit >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}
                  >
                    {profit >= 0 ? "+" : ""}${profit.toFixed(0)}
                  </span>
                  {!isFuture && (
                    <button
                      onClick={() => closePosition(posKey)}
                      className="px-1.5 py-0.5 bg-terminal-red/10 border border-terminal-red/20 hover:border-terminal-red/40 text-micro text-terminal-red font-bold uppercase rounded cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60"
                    >
                      Exit
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Portfolio snapshot + full positions (non-trading tabs)              */
/* ------------------------------------------------------------------ */
function PortfolioSnapshot({
  contracts,
  positions,
  cash,
  assetsValue,
  exposurePercent,
  returnPct,
  closePosition,
  resetPortfolio,
}: {
  contracts: { [id: string]: Contract };
  positions: { [id: string]: Position };
  cash: number;
  assetsValue: number;
  exposurePercent: number;
  returnPct: number;
  closePosition: (id: string) => void;
  resetPortfolio: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { racePositions, seasonPositions } = splitPositionsByBook(positions, contracts);
  const positionsArray = Object.values(positions);

  return (
    <div className="flex flex-col h-full min-h-0 gap-3 overflow-y-auto scrollbar-none pr-0.5">
      {/* Net balances */}
      <div className="panel-raised rounded p-3 space-y-2 font-data text-body-sm">
        <FieldLabel className="text-micro">Portfolio Net Balances</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel className="text-micro" title="Available sandbox liquidity">
              Cash (Sandbox)
            </FieldLabel>
            <span className="text-white font-bold block mt-0.5">
              ${cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div>
            <FieldLabel className="text-micro" title="Mark-to-market positions valuation">
              Derivative Value
            </FieldLabel>
            <span className="text-white font-bold block mt-0.5">
              ${assetsValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div>
            <FieldLabel className="text-micro" title="Portfolio at risk">
              Risk Exposure
            </FieldLabel>
            <span className={`font-bold block mt-0.5 ${exposurePercent > 25 ? "text-terminal-yellow" : "text-white"}`}>
              {exposurePercent.toFixed(1)}% <span className="text-micro text-slate-500">/ 30%</span>
            </span>
          </div>
          <div>
            <FieldLabel className="text-micro">Capital Return</FieldLabel>
            <span className={`font-bold block mt-0.5 ${returnPct >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
              {returnPct >= 0 ? "+" : ""}
              {returnPct.toFixed(2)}%
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="w-full py-1.5 border border-white/5 hover:bg-white/5 text-micro text-slate-400 hover:text-white rounded transition-colors text-center cursor-pointer font-bold uppercase outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60"
        >
          Reset Season Session
        </button>
      </div>

      {/* Holdings */}
      <div className="panel-raised rounded p-3 flex-1 flex flex-col min-h-0">
        <FieldLabel className="text-micro mb-1.5">Open Derivative Positions</FieldLabel>
        {positionsArray.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center p-4 border border-dashed border-white/5 rounded">
            <FieldLabel className="text-slate-400 text-body-sm">Desk Standby</FieldLabel>
            <p className="text-body-sm leading-normal mt-1 text-slate-500 font-sans font-light">
              Open a position to begin. Trade a market to activate valuation.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {racePositions.length > 0 && (
              <div className="space-y-2">
                <FieldLabel className="text-terminal-blue text-micro border-b border-white/5 pb-1">
                  Race Contracts
                </FieldLabel>
                {racePositions.map((pos) => {
                  const contract = contracts[pos.contractId];
                  const exit = positionExitPrice(pos, contract);
                  const profit = pos.qty * (exit - pos.entryPrice);
                  const posKey = pos.side === "LAY" ? `${pos.contractId}_NO` : pos.contractId;
                  return (
                    <div
                      key={posKey}
                      className="panel-base border border-white/5 rounded p-2 space-y-1.5 font-data text-body-sm"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <span className="text-white font-bold block truncate leading-tight uppercase">
                            {pos.contractTitle}
                          </span>
                          <span className="text-micro text-slate-500 uppercase block font-semibold mt-0.5">
                            {pos.contractType}
                          </span>
                        </div>
                        <button
                          onClick={() => closePosition(posKey)}
                          className="px-1.5 py-0.5 bg-terminal-red/10 border border-terminal-red/20 hover:border-terminal-red/40 text-micro text-terminal-red font-bold uppercase rounded cursor-pointer transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60"
                        >
                          Exit
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-white/5 text-body-sm text-slate-400">
                        <div className="flex justify-between">
                          <span>Size:</span>
                          <span className="text-white font-bold">{pos.qty}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>PnL:</span>
                          <span className={`font-bold ${profit >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
                            {profit >= 0 ? "+" : ""}${profit.toFixed(0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Entry:</span>
                          <span className="text-slate-350">${pos.entryPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Val:</span>
                          <span className="text-slate-350">${exit.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {seasonPositions.length > 0 && (
              <div className="space-y-2">
                <FieldLabel className="text-terminal-gold text-micro border-b border-white/5 pb-1">
                  Season Futures
                </FieldLabel>
                {seasonPositions.map((pos) => {
                  const contract = contracts[pos.contractId];
                  const exit = positionExitPrice(pos, contract);
                  const profit = pos.qty * (exit - pos.entryPrice);
                  const mtmVal = pos.qty * exit;
                  return (
                    <div
                      key={pos.contractId}
                      className="panel-base border border-white/5 rounded p-2 space-y-1.5 font-data text-body-sm"
                    >
                      <span className="text-terminal-gold font-bold block truncate leading-tight uppercase font-mono">
                        {pos.contractTitle}
                      </span>
                      <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-white/5 text-body-sm text-slate-400">
                        <div className="flex justify-between">
                          <span>Size:</span>
                          <span className="text-white font-bold">{pos.qty}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Entry:</span>
                          <span className="text-slate-300">${pos.entryPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>MTM:</span>
                          <span className="text-slate-300 font-bold">${mtmVal.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>PnL:</span>
                          <span className={`font-bold ${profit >= 0 ? "text-terminal-green-light" : "text-terminal-red"}`}>
                            {profit >= 0 ? "+" : ""}${profit.toFixed(0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        danger
        title="Reset Season Session"
        message="Resetting the season session will fully clear your portfolio balances ($100k baseline), wipe the trade history ledger, purge championship standings, and return you to Round 01 Australian GP. Are you sure you want to proceed?"
        confirmLabel="Reset Session"
        cancelLabel="Cancel"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          resetPortfolio();
        }}
      />
    </div>
  );
}
