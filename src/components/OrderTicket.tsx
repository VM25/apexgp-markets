"use client";

import React, { useState } from "react";
import { ShieldAlert, CheckCircle2, HelpCircle } from "lucide-react";
import { Contract } from "../hooks/useSimulation";
import { Position } from "../hooks/usePortfolio";
import { useTerminalUI } from "./TerminalUIProvider";
import FieldLabel from "./FieldLabel";

interface OrderTicketProps {
  /** race = GP option chain; futures = championship futures */
  kind: "race" | "futures";
  contract: Contract;
  positions: { [id: string]: Position };
  cash: number;
  portfolioValue: number;
  assetsValue: number;
  isHalted: boolean;
  buyContracts: (id: string, qty: number, side?: "BUY" | "LAY") => { success: boolean; message: string };
  sellContracts: (posKey: string, qty: number) => { success: boolean; message: string };
}

const PRESETS = [50, 100, 500, 1000];

/**
 * Shared execution ticket used by the DeskPanel on both the Market and
 * Championship (Season Futures) workspaces. Preserves ALL fields from the two
 * original in-tab tickets: direction BACK/LAY, bid/implied/ask, market
 * snapshot, action tabs, quantity + presets, payout board, risk banners, submit.
 */
export default function OrderTicket({
  kind,
  contract,
  positions,
  cash,
  portfolioValue,
  assetsValue,
  isHalted,
  buyContracts,
  sellContracts,
}: OrderTicketProps) {
  const { backingSide, setBackingSide, pushToast } = useTerminalUI();

  const [tradeAction, setTradeAction] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState<number>(0);
  const [tradeResult, setTradeResult] = useState<{ success: boolean; message: string } | null>(null);
  const [justFilled, setJustFilled] = useState<boolean>(false);
  const [showPayoutCalc, setShowPayoutCalc] = useState<boolean>(false);
  const [showSettlementInfoModal, setShowSettlementInfoModal] = useState<boolean>(false);
  // NOTE: DeskPanel keys this component on the contract id, so switching the
  // selected contract mounts a fresh ticket (clears quantity/result). Direction
  // (BACK/LAY) toggles clear the transient result inline below.

  const posKey = backingSide === "NO" ? `${contract.id}_NO` : contract.id;
  const activePosition = positions[posKey];

  const price =
    backingSide === "NO"
      ? tradeAction === "BUY"
        ? 1.0 - contract.bid
        : 1.0 - contract.ask
      : tradeAction === "BUY"
        ? contract.ask
        : contract.bid;
  const cost = quantity * price;

  // Risk validations
  const nextAssetsVal = assetsValue + (tradeAction === "BUY" ? cost : -cost);
  const nextExposurePct = portfolioValue > 0 ? (nextAssetsVal / portfolioValue) * 100 : 0;
  const isExposureViolated = tradeAction === "BUY" && nextExposurePct > 30.01;

  const currentContractPrice = contract.bid;
  const currentPosPrice = backingSide === "NO" ? 1.0 - contract.ask : currentContractPrice;
  const existingCost = activePosition ? activePosition.qty * currentPosPrice : 0;
  const nextSingleCost = existingCost + (tradeAction === "BUY" ? cost : -cost);
  const nextSingleExposurePct = portfolioValue > 0 ? (nextSingleCost / portfolioValue) * 100 : 0;
  const isSingleViolated = tradeAction === "BUY" && nextSingleExposurePct > 15.01;

  const isCashViolated = tradeAction === "BUY" && cost > cash;
  const isSellViolated = tradeAction === "SELL" && (!activePosition || activePosition.qty < quantity);

  const canExecute =
    !isHalted &&
    !contract.settled &&
    quantity > 0 &&
    !isExposureViolated &&
    !isSingleViolated &&
    !isCashViolated &&
    !isSellViolated;

  const showBid = backingSide === "NO" ? 1.0 - contract.ask : contract.bid;
  const showAsk = backingSide === "NO" ? 1.0 - contract.bid : contract.ask;
  const spread = Math.abs(showAsk - showBid);
  const impliedProb = backingSide === "NO" ? 1.0 - contract.mid : contract.mid;
  const priceChg = contract.change;
  const directionClass =
    priceChg > 0 ? "text-terminal-green-light" : priceChg < 0 ? "text-terminal-red" : "text-slate-450";

  const displaySymbol =
    kind === "futures" && backingSide === "NO" ? `${contract.symbol}-Against` : contract.symbol;
  const displayTitle =
    kind === "futures" && backingSide === "NO" ? `${contract.title} [Against]` : contract.title;

  const handleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canExecute || justFilled) return;

    const res =
      tradeAction === "BUY"
        ? buyContracts(contract.id, quantity, backingSide === "NO" ? "LAY" : "BUY")
        : sellContracts(posKey, quantity);

    setTradeResult(res);
    pushToast({
      variant: res.success ? "success" : "error",
      title: res.success
        ? tradeAction === "BUY"
          ? "Order Filled"
          : "Position Closed"
        : "Execution Error",
      message: res.message,
    });
    if (res.success) {
      // Immediate feedback on the button itself, then a slower-fading inline
      // confirmation the reader can dismiss early.
      setJustFilled(true);
      window.setTimeout(() => setJustFilled(false), 900);
      window.setTimeout(() => setTradeResult((prev) => (prev === res ? null : prev)), 8000);
    }
  };

  const label = kind === "futures" ? "Title Derivative Ticket" : "Option Execution Slip";

  return (
    <form onSubmit={handleOrderSubmit} className="flex flex-col space-y-3">
      {/* Identity header */}
      <div className="border-b border-white/5 pb-2">
        <div className="flex justify-between items-center">
          <FieldLabel>{label}</FieldLabel>
          {kind === "race" && (
            <button
              type="button"
              onClick={() => setShowSettlementInfoModal(true)}
              className="text-micro text-terminal-blue hover:text-terminal-blue-light font-bold flex items-center gap-0.5 cursor-pointer bg-white/2 hover:bg-white/5 px-1.5 py-1 rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 focus-visible:ring-offset-1 focus-visible:ring-offset-carbon-black"
            >
              <HelpCircle className="w-3 h-3" /> Settlement Info
            </button>
          )}
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <h3 className="text-terminal-blue-light text-body-sm font-mono font-bold uppercase">
            {displaySymbol}
          </h3>
          <span className="text-white text-micro font-sans font-light truncate">{displayTitle}</span>
        </div>
      </div>

      {/* Direction (BACK/LAY) */}
      <div className="space-y-1">
        <FieldLabel>Contract Direction</FieldLabel>
        <div className="flex bg-carbon-black rounded border border-white/10 p-0.5 font-bold uppercase text-micro">
          <button
            type="button"
            onClick={() => {
              setBackingSide("YES");
              setTradeResult(null);
            }}
            className={`flex-1 py-1.5 text-center rounded transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 ${backingSide === "YES" ? "bg-terminal-blue/20 text-terminal-blue-light border border-terminal-blue/30" : "text-slate-500 hover:text-slate-300"}`}
          >
            BACK (YES)
          </button>
          <button
            type="button"
            onClick={() => {
              setBackingSide("NO");
              setTradeResult(null);
            }}
            className={`flex-1 py-1.5 text-center rounded transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 ${backingSide === "NO" ? "bg-terminal-red/15 text-terminal-red border border-terminal-red/20" : "text-slate-500 hover:text-slate-300"}`}
          >
            LAY (NO)
          </button>
        </div>
      </div>

      {/* Bid / Implied / Ask */}
      <div className="grid grid-cols-3 gap-1.5 text-center font-data text-body-sm">
        <div className="panel-base border border-white/5 p-1.5 rounded">
          <FieldLabel className="text-micro">Bid (Sell)</FieldLabel>
          <span className="text-terminal-green-light font-bold block mt-0.5">${showBid.toFixed(2)}</span>
        </div>
        <div className="panel-base border border-white/5 p-1.5 rounded">
          <FieldLabel className="text-micro">Implied</FieldLabel>
          <span className="text-white font-bold block mt-0.5">{Math.round(impliedProb * 100)}%</span>
        </div>
        <div className="panel-base border border-white/5 p-1.5 rounded">
          <FieldLabel className="text-micro">Ask (Buy)</FieldLabel>
          <span className="text-terminal-blue-light font-bold block mt-0.5">${showAsk.toFixed(2)}</span>
        </div>
      </div>

      {/* Market snapshot */}
      <div className="panel-base rounded border border-white/5 p-2.5 font-data text-body-sm space-y-2">
        <FieldLabel className="text-micro">Market Snapshot</FieldLabel>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 leading-snug">
          <div className="flex justify-between border-b border-white/5 pb-1">
            <span className="text-slate-450">Best Bid:</span>
            <span className="text-terminal-green-light font-bold">${showBid.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-1">
            <span className="text-slate-450">Best Ask:</span>
            <span className="text-terminal-blue-light font-bold">${showAsk.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-450">Spread:</span>
            <span className="text-white font-bold">${spread.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-450">Implied:</span>
            <span className="text-white font-bold">{Math.round(impliedProb * 100)}%</span>
          </div>
          <div className="flex justify-between col-span-2 border-t border-white/5 pt-1.5 mt-0.5">
            <span className="text-slate-450 font-bold uppercase text-micro">Recent Price Chg:</span>
            <span className={`font-bold inline-flex items-center gap-0.5 ${directionClass}`}>
              {priceChg > 0 ? "+" : ""}
              {(priceChg * 100).toFixed(1)}%{priceChg > 0 ? " ▲" : priceChg < 0 ? " ▼" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Action tabs */}
      <div className="flex bg-carbon-black rounded border border-white/10 p-0.5 font-bold uppercase text-micro">
        <button
          type="button"
          onClick={() => {
            setTradeAction("BUY");
            setTradeResult(null);
          }}
          className={`flex-1 py-1.5 text-center rounded transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 ${tradeAction === "BUY" ? "bg-terminal-blue/20 text-terminal-blue-light border border-terminal-blue/30" : "text-slate-500 hover:text-slate-300"}`}
        >
          OPEN POSITION
        </button>
        <button
          type="button"
          onClick={() => {
            setTradeAction("SELL");
            setTradeResult(null);
          }}
          className={`flex-1 py-1.5 text-center rounded transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 ${tradeAction === "SELL" ? "bg-terminal-red/10 text-terminal-red border border-terminal-red/20" : "text-slate-500 hover:text-slate-300"}`}
        >
          SELL / EXIT
        </button>
      </div>

      {/* Quantity */}
      <div className="space-y-1">
        <div className="flex justify-between text-slate-500 text-micro uppercase font-bold">
          <span>Order Size (Contracts)</span>
          <span>Holding: {activePosition ? activePosition.qty : 0}</span>
        </div>
        <div className="flex items-center gap-2 bg-carbon-black border border-white/10 rounded px-2 py-1 focus-within:ring-2 focus-within:ring-terminal-blue-light/40">
          <input
            type="number"
            min="0"
            step="1"
            value={quantity || ""}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setQuantity(isNaN(val) ? 0 : val);
              setTradeResult(null);
            }}
            placeholder="Enter contracts qty"
            className="flex-1 bg-transparent text-white font-bold outline-none text-body-sm font-data min-w-0"
          />
          <span className="text-slate-500 text-micro uppercase font-bold tracking-wider">contracts</span>
        </div>
        <div className="grid grid-cols-4 gap-1 text-micro font-bold text-slate-400 pt-0.5">
          {PRESETS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setQuantity(q);
                setTradeResult(null);
              }}
              className="py-1 bg-white/3 hover:bg-white/5 rounded border border-white/5 cursor-pointer text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Risk-limit feedback renders adjacent to its cause — the size input. */}
        {isExposureViolated && (
          <RiskBanner title="Exposure Violated" message="Exposure cannot exceed 30% of total portfolio capital." />
        )}
        {isSingleViolated && (
          <RiskBanner title="Single-Market Violated" message="Exposure in this contract cannot exceed the 15% limit." />
        )}
        {isCashViolated && (
          <RiskBanner title="Liquidity Shortage" message="Insufficient cash balance to fund this order." />
        )}
        {isSellViolated && (
          <RiskBanner title="Position Shortage" message="You do not hold enough contracts to exit this size." />
        )}
      </div>

      {/* Payout board */}
      <div className="panel-base p-2.5 rounded border border-white/5 space-y-2 text-body-sm font-mono">
        <button
          type="button"
          onClick={() => setShowPayoutCalc(!showPayoutCalc)}
          className="w-full flex justify-between items-center text-slate-500 font-bold uppercase text-micro tracking-wider cursor-pointer hover:text-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 rounded"
        >
          <span>Outcome Contract Payout</span>
          <span className="text-micro text-terminal-blue font-bold">
            {showPayoutCalc ? "COLLAPSE ▲" : "EXPAND ▼"}
          </span>
        </button>
        {showPayoutCalc && (
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-data text-slate-350 mt-1.5 animate-fadeIn">
            <div className="flex justify-between col-span-2">
              <span>Position Size:</span>
              <span className="text-white font-bold">{quantity} Contracts</span>
            </div>
            <div className="flex justify-between col-span-2">
              <span>Execution Price:</span>
              <span className="text-white font-bold">${price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between col-span-2 border-b border-white/5 pb-1.5">
              <span>Notional Cost:</span>
              <span className="text-white font-bold">${cost.toFixed(2)}</span>
            </div>

            <div className="col-span-2 bg-terminal-green/5 border border-terminal-green/20 p-1.5 rounded text-body-sm space-y-0.5 mt-0.5">
              <div className="flex justify-between text-terminal-green-light font-bold uppercase text-micro tracking-wider">
                <span>IF {backingSide === "NO" ? "OUTCOME FAILS" : "OUTCOME OCCURS"}</span>
                <span>PAYS $1.00</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Receive:</span>
                <span className="text-white font-bold">${quantity.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Net Profit:</span>
                <span className="text-terminal-green-light font-bold">
                  +${Math.max(0, quantity - cost).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="col-span-2 bg-terminal-red/5 border border-terminal-red/20 p-1.5 rounded text-body-sm space-y-0.5 mt-1">
              <div className="flex justify-between text-terminal-red font-bold uppercase text-micro tracking-wider">
                <span>IF {backingSide === "NO" ? "OUTCOME OCCURS" : "OUTCOME FAILS"}</span>
                <span>PAYS $0.00</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Receive:</span>
                <span className="text-white font-bold">$0.00</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Net Loss:</span>
                <span className="text-terminal-red font-bold">-${cost.toFixed(2)}</span>
              </div>
            </div>

            <div className="h-px bg-white/5 col-span-2 my-1" />

            <div className="flex justify-between col-span-2 text-slate-500">
              <span>Portfolio at Risk:</span>
              <span className={`font-bold ${nextExposurePct > 25 ? "text-terminal-yellow" : "text-white"}`}>
                {nextExposurePct.toFixed(1)}% <span className="text-micro text-slate-500">/ 30%</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Alerts + submit */}
      <div className="space-y-2 pt-2.5 border-t border-white/5">
        {quantity === 0 && (
          <div className="bg-terminal-blue/5 border border-terminal-blue/20 p-2 rounded text-body-sm text-slate-400">
            Select quantity of contracts to open transaction.
          </div>
        )}

        {contract.settled && kind === "futures" && (
          <div className="bg-terminal-gold/10 border border-terminal-gold/20 p-2 rounded text-body-sm text-terminal-gold flex items-start gap-1.5 font-sans font-light leading-normal">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-terminal-gold mt-0.5" />
            <div>
              <span className="font-bold block uppercase font-mono text-micro">Championship Settled</span>
              Season ended. Settle value resolved to ${contract.settlementValue?.toFixed(2)}. No further trades.
            </div>
          </div>
        )}

        {isHalted && kind === "race" && (
          <div className="bg-terminal-red/10 border border-terminal-red/25 p-2 rounded text-body-sm text-terminal-red flex items-start gap-1.5 font-sans font-light leading-normal">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-terminal-red mt-0.5" />
            <div>
              <span className="font-bold block uppercase font-mono text-micro">Simulation Halts Active</span>
              Incidents or Safety Cars suspend trading on affected derivatives.
            </div>
          </div>
        )}

        {tradeResult && (
          <div
            className={`p-2 rounded text-body-sm flex items-start gap-1.5 font-sans font-light leading-normal ${tradeResult.success ? "bg-terminal-green/10 border border-terminal-green/20 text-terminal-green-light" : "bg-terminal-red/10 border border-terminal-red/20 text-terminal-red"}`}
          >
            {tradeResult.success ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-terminal-green-light mt-0.5" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-terminal-red mt-0.5" />
            )}
            <div className="flex-1">
              <span className="font-bold block uppercase font-mono text-micro">
                {tradeResult.success ? "Trade Settled" : "Execution Error"}
              </span>
              {tradeResult.message}
            </div>
            <button
              type="button"
              onClick={() => setTradeResult(null)}
              aria-label="Dismiss trade result"
              className="shrink-0 text-current/60 hover:text-current font-bold px-1 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 rounded"
            >
              ✕
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={!canExecute && !justFilled}
          className={`w-full py-2.5 font-mono font-bold tracking-wider text-body-sm uppercase rounded transition-colors flex items-center justify-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 focus-visible:ring-offset-1 focus-visible:ring-offset-carbon-black ${
            justFilled
              ? "bg-terminal-green text-white cursor-default"
              : canExecute
                ? tradeAction === "BUY"
                  ? "bg-terminal-blue hover:bg-terminal-blue-light text-white cursor-pointer active:scale-[0.98]"
                  : "bg-terminal-red hover:bg-terminal-red/85 text-white cursor-pointer active:scale-[0.98]"
                : "bg-white/3 border border-white/5 text-slate-500 opacity-40 cursor-not-allowed"
          }`}
        >
          {justFilled ? (
            <>
              <CheckCircle2 className="w-4 h-4" /> ORDER FILLED
            </>
          ) : tradeAction === "BUY" ? (
            "OPEN POSITION"
          ) : (
            "SELL / EXIT"
          )}
        </button>
      </div>

      {/* Settlement info modal (race contracts only) */}
      {showSettlementInfoModal && (
        <div
          className="fixed inset-0 bg-carbon-black/85 backdrop-blur-md z-[70] flex items-center justify-center p-4 font-mono"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowSettlementInfoModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="panel-elevated max-w-sm w-full rounded-lg p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-terminal-blue-light font-extrabold text-micro uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-terminal-blue" /> HOW SETTLEMENT WORKS
              </span>
              <button
                type="button"
                onClick={() => setShowSettlementInfoModal(false)}
                aria-label="Close"
                className="text-slate-500 hover:text-white text-body font-bold cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 rounded"
              >
                ✕
              </button>
            </div>
            <div className="text-body-sm text-slate-350 leading-relaxed space-y-2 select-text font-sans font-light">
              <p>
                <strong>Binary Settlements:</strong> Event contracts settle strictly deterministically to
                either <strong>$1.00</strong> (if the target outcome occurs) or <strong>$0.00</strong> (if
                the outcome fails).
              </p>
              <p>
                <strong>Backing Sides:</strong> ApexGP supports complete two-sided trading. Selecting{" "}
                <strong>BACK (YES)</strong> backs the event to happen. Selecting <strong>LAY (NO)</strong>{" "}
                backs the event to fail. A Lay contract is priced as the complement{" "}
                <code>$1.00 - YES_Price</code>.
              </p>
              <p>
                <strong>Zero Time Decay:</strong> Positions do not incur time-based theta decay during
                simulation replay, and can be exited (liquidated) at live bid prices at any lap tick.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSettlementInfoModal(false)}
              className="w-full py-2 bg-terminal-blue hover:bg-terminal-blue-light text-white font-bold text-body-sm rounded uppercase tracking-wider transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue-light/60 active:scale-[0.98]"
            >
              Acknowledge & Return
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function RiskBanner({ title, message }: { title: string; message: string }) {
  return (
    <div className="bg-terminal-red/10 border border-terminal-red/25 p-2 rounded text-body-sm text-terminal-red flex items-start gap-1.5 font-sans font-light leading-normal">
      <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-terminal-red mt-0.5" />
      <div>
        <span className="font-bold block uppercase font-mono text-micro">{title}</span>
        {message}
      </div>
    </div>
  );
}
