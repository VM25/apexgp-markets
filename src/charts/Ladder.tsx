"use client";

import type { Quote } from "@/engine/market/quote";
import { pct, qty } from "@/ui/format";

/**
 * The dealer's ladder. Asks above, bids below, in YES cents; bar length is size.
 * Clicking a level sets the ticket's limit price.
 */
export function Ladder({ quote, side, onPick }: { quote: Quote; side: "YES" | "NO"; onPick?: (ownPriceCents: number) => void }) {
  const max = Math.max(1, ...quote.asks.map((l) => l.size), ...quote.bids.map((l) => l.size));
  const own = (yes: number) => (side === "YES" ? yes : 100 - yes);
  // For a NO viewer the ladder is mirrored: the YES bids are where NO is offered.
  const offers = side === "YES" ? quote.asks : quote.bids;
  const bids = side === "YES" ? quote.bids : quote.asks;
  if (quote.state !== "open") {
    return (
      <div className="border border-dashed border-rule px-3 py-5 text-center text-[13.5px] text-ink-2">
        <p className="font-semibold text-ink">{quote.state === "suspended" ? "Quotes pulled" : quote.state === "settled" ? "Settled" : "Market closed"}</p>
        <p className="mt-0.5">{quote.reason}</p>
      </div>
    );
  }
  const row = (l: { price: number; size: number }, kind: "offer" | "bid", k: number) => (
    <li key={`${kind}${l.price}`}>
      <button
        type="button"
        onClick={() => onPick?.(own(l.price))}
        className="group relative grid grid-cols-[52px_1fr_auto] items-center w-full h-[30px] text-left hover:bg-paper-2 focus-visible:bg-paper-2"
      >
        <span className={`num text-[13.5px] pl-1 ${k === 0 ? "font-semibold" : "text-ink-2"}`}>{own(l.price)}¢</span>
        <span className="relative h-[14px]" aria-hidden="true">
          <span className={`absolute inset-y-0 left-0 ${kind === "offer" ? "bg-ink/80" : "border border-ink bg-transparent"}`} style={{ width: `${Math.max(2, (l.size / max) * 100)}%` }} />
        </span>
        <span className="num text-[12.5px] text-ink-2 pl-2 pr-1 tabular-nums">{qty(l.size)}</span>
        <span className="sr-only"> {side} contracts {kind === "offer" ? "offered" : "bid for"} by the dealer. Use this price as your limit.</span>
      </button>
    </li>
  );
  return (
    <div>
      <div className="grid grid-cols-[52px_1fr_auto] eyebrow !text-[10.5px] pb-1 border-b border-ink">
        <span className="pl-1">{side} price</span>
        <span>Dealer offers</span>
        <span className="pr-1">Contracts</span>
      </div>
      <ol className="flex flex-col-reverse">{offers.length ? offers.map((l, k) => row(l, "offer", k)) : <li className="text-[12.5px] text-ink-3 py-2 pl-1">The dealer is not offering {side} here.</li>}</ol>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1.5 border-y border-rule bg-paper-2/60">
        <span className="h-px bg-model" />
        <span className="num text-[12px] text-model font-medium whitespace-nowrap">model {pct(side === "YES" ? quote.fair : 1 - quote.fair)}</span>
        <span className="h-px bg-model" />
      </div>
      <div className="eyebrow !text-[10.5px] pt-1.5 pb-1 pl-1">Dealer bids</div>
      <ol>{bids.length ? bids.map((l, k) => row(l, "bid", k)) : <li className="text-[12.5px] text-ink-3 py-2 pl-1">The dealer is not bidding for {side} here.</li>}</ol>
    </div>
  );
}
