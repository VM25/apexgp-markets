"use client";

import { useState } from "react";
import { KIND_META } from "@/engine/market/contracts";
import type { Action, Side } from "@/engine/market/execution";
import { unrealized } from "@/engine/portfolio/ledger";
import type { OrderRequest } from "@/engine/session/session";
import { useApp } from "@/state/hooks";
import { cents, pct, qty as fmtQty, tone, usd } from "@/ui/format";
import { InfoTip, Meter, SideChip } from "@/ui/primitives";

const QUICK = [100, 500, 1000, 5000];

/** Order entry with a live preview. Nothing is sent until the two-step confirm. */
export function OrderTicket({ contractId, limitFromLadder }: { contractId: string; limitFromLadder?: { price: number; nonce: number } | null }) {
  const app = useApp();
  const s = app.session!;
  const c = s.contract(contractId);
  const { side, action } = app.ticket;
  const [qtyText, setQtyText] = useState("100");
  const [type, setType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [limit, setLimit] = useState<number>(50);
  const [tif, setTif] = useState<"GTC" | "IOC">("GTC");
  const [armed, setArmed] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const quote = c ? s.quoteFor(c.id) : null;
  const holdingYes = c ? s.holding(c.id, "YES") : 0;
  const holdingNo = c ? s.holding(c.id, "NO") : 0;
  const holding = side === "YES" ? holdingYes : holdingNo;
  const pos = c ? s.state.ledger.positions[c.id] : undefined;

  // A limit price picked on the ladder: adopt it once per click (state adjusted during render, no effect).
  const [seenPick, setSeenPick] = useState<number | null>(null);
  if (limitFromLadder && limitFromLadder.nonce !== seenPick) {
    setSeenPick(limitFromLadder.nonce);
    setType("LIMIT");
    setLimit(limitFromLadder.price);
    setArmed(false);
  }

  const n = Number(qtyText);
  const req: OrderRequest | null = c ? { contractId: c.id, side, action, qty: n, type, limit: type === "LIMIT" ? limit : undefined, tif } : null;
  if (!c || !req || !quote) return null;
  const p = s.preview(req);
  const valid = Number.isFinite(n) && n > 0;

  const maxQty = () => {
    if (action === "SELL") return holding;
    let lo = 0;
    let hi = 200_000;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      const t = s.preview({ ...req, qty: mid });
      if (t.ok && (type === "LIMIT" || t.remaining === 0)) lo = mid;
      else hi = mid;
    }
    return lo;
  };

  const set = (patch: { side?: Side; action?: Action }) => {
    setArmed(false);
    setDone(null);
    app.setTicket(patch);
  };
  const toLimit = () => {
    const touchYes = (side === "YES") === (action === "BUY") ? quote.bestAsk : quote.bestBid;
    if (type !== "LIMIT" && touchYes !== null) setLimit(side === "YES" ? touchYes : 100 - touchYes);
    setType("LIMIT");
    setArmed(false);
    setDone(null);
  };
  const submit = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    const r = app.place(req);
    setArmed(false);
    if (r?.ok) {
      setDone(r.filled > 0 ? `Filled ${fmtQty(r.filled)} at ${r.avgPrice.toFixed(1)}¢${r.rests ? ` · ${fmtQty(r.remaining)} resting` : ""}` : `Resting: ${fmtQty(r.remaining)} at ${limit}¢`);
      if (action === "SELL") setQtyText(String(Math.max(0, holding - r.filled) || 100));
    }
  };
  const disarm = () => {
    setArmed(false);
    setDone(null);
  };
  const cost = p.cashDelta;
  const verb = action === "BUY" ? "Buy" : "Sell";
  const breakeven = p.filled > 0 ? (p.avgPrice * p.filled + p.fee) / p.filled / 100 : null;
  const ownFair = side === "YES" ? quote.fair : 1 - quote.fair;

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (p.ok && valid) submit();
      }}
      aria-label={`Order ticket: ${c.title}`}
    >
      {pos && pos.q !== 0 && (
        <div className="flex items-center justify-between gap-2 bg-you-soft border border-you/40 px-2.5 py-2 text-[13px]">
          <span className="flex items-center gap-2 min-w-0">
            <SideChip side={pos.q > 0 ? "YES" : "NO"} />
            <span className="num truncate">
              {fmtQty(Math.abs(pos.q))} @ {(pos.basis / Math.abs(pos.q)).toFixed(1)}¢
            </span>
            <span className={`num ${tone(unrealized(pos, s.mark(c.id)))}`}>{usd(unrealized(pos, s.mark(c.id)), { sign: true })}</span>
          </span>
          <button
            type="button"
            className="btn btn-sm !min-h-[32px]"
            onClick={() => {
              set({ side: pos.q > 0 ? "YES" : "NO", action: "SELL" });
              setQtyText(String(Math.abs(pos.q)));
              setType("MARKET");
            }}
          >
            Close
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <fieldset>
          <legend className="eyebrow mb-1">Outcome</legend>
          <div className="seg w-full" role="group">
            <button type="button" className="flex-1" aria-pressed={side === "YES"} onClick={() => set({ side: "YES" })}>● YES</button>
            <button type="button" className="flex-1" aria-pressed={side === "NO"} onClick={() => set({ side: "NO" })}>○ NO</button>
          </div>
        </fieldset>
        <fieldset>
          <legend className="eyebrow mb-1">Action</legend>
          <div className="seg w-full" role="group">
            <button type="button" className="flex-1" aria-pressed={action === "BUY"} onClick={() => set({ action: "BUY" })}>Buy</button>
            <button type="button" className="flex-1 disabled:opacity-40" aria-pressed={action === "SELL"} disabled={holding === 0} onClick={() => set({ action: "SELL" })} title={holding === 0 ? `You hold no ${side} contracts here` : undefined}>Sell</button>
          </div>
        </fieldset>
      </div>

      <div>
        <div className="flex items-end justify-between mb-1">
          <label htmlFor="ticket-qty" className="eyebrow">Contracts</label>
          <span className="text-[12px] text-ink-3">each pays $1.00 if {side === "YES" ? "true" : "false"}</span>
        </div>
        <input
          id="ticket-qty"
          className="field"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={qtyText}
          onChange={(e) => {
            setQtyText(e.target.value.replace(/[^0-9]/g, "").slice(0, 6));
            disarm();
          }}
          aria-describedby="ticket-msg"
        />
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {QUICK.map((v) => (
            <button key={v} type="button" className="btn btn-sm btn-quiet !min-h-[32px] !px-2.5 num" onClick={() => { setQtyText(String(v)); disarm(); }}>
              {fmtQty(v)}
            </button>
          ))}
          <button type="button" className="btn btn-sm btn-quiet !min-h-[32px] !px-2.5" onClick={() => { setQtyText(String(maxQty() || 1)); disarm(); }}>
            Max
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-2 items-end">
        <fieldset>
          <legend className="eyebrow mb-1 flex items-center gap-1">
            Order type
            <InfoTip label="Order type">
              <b>Market</b> trades now against the dealer’s ladder; large orders walk to worse prices. <b>Limit</b> sets the worst price you accept; any unfilled part can rest and is filled only if the dealer’s quote later reaches it.
            </InfoTip>
          </legend>
          <div className="seg" role="group">
            <button type="button" aria-pressed={type === "MARKET"} onClick={() => { setType("MARKET"); disarm(); }}>Market</button>
            <button type="button" aria-pressed={type === "LIMIT"} onClick={toLimit}>Limit</button>
          </div>
        </fieldset>
        {type === "LIMIT" && (
          <div>
            <label htmlFor="ticket-limit" className="eyebrow mb-1 block">{side} limit price</label>
            <div className="flex">
              <button type="button" className="btn !px-0 w-11 shrink-0 border-r-0" onClick={() => { setLimit((v) => Math.max(1, v - 1)); disarm(); }} aria-label="Lower limit price by one cent">−</button>
              <input id="ticket-limit" className="field text-center !px-1" inputMode="numeric" value={limit} onChange={(e) => { setLimit(Math.max(1, Math.min(99, Number(e.target.value.replace(/[^0-9]/g, "")) || 1))); disarm(); }} aria-label={`${side} limit price in cents`} />
              <button type="button" className="btn !px-0 w-11 shrink-0 border-l-0" onClick={() => { setLimit((v) => Math.min(99, v + 1)); disarm(); }} aria-label="Raise limit price by one cent">+</button>
            </div>
          </div>
        )}
      </div>
      {type === "LIMIT" && (
        <label className="flex items-center gap-2 text-[13px] text-ink-2 min-h-[32px]">
          <input type="checkbox" className="w-[18px] h-[18px] accent-[var(--color-ink)]" checked={tif === "GTC"} onChange={(e) => { setTif(e.target.checked ? "GTC" : "IOC"); disarm(); }} />
          Let the unfilled part rest until the market closes
        </label>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-y border-rule py-2.5 text-[13.5px]">
        <Row k="Fills now" v={valid ? `${fmtQty(p.filled)}${p.remaining > 0 ? ` of ${fmtQty(req.qty)}` : ""}` : "—"} />
        <Row k="Average price" v={p.filled ? cents(p.avgPrice, 1) : "—"} />
        <Row k={cost >= 0 ? "You pay" : "You receive"} v={p.filled ? usd(Math.abs(cost)) : "—"} strong />
        <Row k="of which fee" v={p.filled ? usd(p.fee) : "—"} info={<>Taker fee, charged like Kalshi’s published schedule: 7% × contracts × price × (1 − price), rounded up to the cent. Resting orders that fill pay a quarter of that.</>} />
        {action === "BUY" && <Row k="Max loss" v={p.filled ? usd(p.maxLoss) : "—"} />}
        {action === "BUY" && <Row k="Pays if right" v={p.filled ? usd(Math.abs(p.positionAfter) * 100) : "—"} />}
        <Row
          k="Spread cost"
          v={p.filled ? usd(p.spreadCost) : "—"}
          info={<>What this order pays relative to the mid-point of the dealer’s quote: half the spread{p.impactCost > 0.5 ? `, plus ${usd(p.impactCost)} for trading through the best price` : ""}.</>}
        />
        <Row
          k="Model edge"
          v={p.filled ? usd(p.modelEdge, { sign: true }) : "—"}
          tone={p.filled ? tone(p.modelEdge) : ""}
          info={<>Model value of what you get minus what you pay. The model says {side} is worth {pct(ownFair)}{breakeven !== null && action === "BUY" ? `; after fees you need it to happen ${pct(breakeven)} of the time to break even` : ""}. Negative is normal: it is the spread and the fee.</>}
        />
      </dl>

      {valid && p.quote?.state === "open" && action === "BUY" && (
        <div className="grid gap-2">
          <Meter value={p.limits.contractLoss} limit={p.limits.contractLimit} label="At risk in this contract" />
          <Meter value={p.limits.totalLoss} limit={p.limits.totalLimit} label="Worst case, whole portfolio" />
        </div>
      )}

      <div id="ticket-msg" aria-live="polite" className="min-h-[20px] text-[13px] leading-snug">
        {!valid ? (
          <span className="text-ink-3">Enter how many contracts to trade.</span>
        ) : !p.ok ? (
          <span className="loss font-medium">{p.reason}</span>
        ) : done ? (
          <span className="gain font-medium">✓ {done}</span>
        ) : (
          p.warnings.map((w) => <p key={w} className="text-ink-2">{w}</p>)
        )}
      </div>

      <div className="flex gap-2">
        {armed && (
          <button type="button" className="btn" onClick={disarm}>Edit</button>
        )}
        <button type="submit" className={`btn flex-1 ${armed ? "btn-you" : "btn-solid"}`} disabled={!p.ok || !valid}>
          {armed
            ? `Confirm · ${verb.toLowerCase()} ${fmtQty(req.qty)} ${side}${p.filled ? ` · ${usd(Math.abs(cost))}` : ` @ ${limit}¢`}`
            : `Review ${verb.toLowerCase()} ${side}`}
        </button>
      </div>
      <p className="text-[12px] text-ink-3 leading-snug">
        Simulated execution with fictional money. {KIND_META[c.kind].rule}
      </p>
    </form>
  );
}

function Row({ k, v, strong, tone: t, info }: { k: string; v: string; strong?: boolean; tone?: string; info?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 min-w-0">
      <dt className="text-ink-2 flex items-center gap-1 min-w-0">
        <span className="truncate">{k}</span>
        {info && <InfoTip label={k}>{info}</InfoTip>}
      </dt>
      <dd className={`num shrink-0 ${strong ? "font-semibold" : ""} ${t ?? ""}`}>{v}</dd>
    </div>
  );
}
