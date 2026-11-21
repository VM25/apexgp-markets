import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { emptyBook, quote } from "../market/quote";

const ref = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../public/data/market_reference.json"), "utf8"));

describe("dealer spread calibration against the real-venue snapshot", () => {
  it("pre-race quoted spreads sit within (or within one tick of) the measured interquartile range by price level", () => {
    const rows: string[] = [];
    for (const b of ref.snapshot.buckets as { lo: number; hi: number; n: number; median_spread_cents: number | null; p25_spread_cents: number; p75_spread_cents: number }[]) {
      if (!b.n || b.median_spread_cents === null) continue;
      const p = (b.lo + b.hi) / 2;
      const q = quote(p, emptyBook(), { kind: "WIN", status: "GREEN", frame: 0, totalFrames: 58 });
      const spread = q.bestBid !== null && q.bestAsk !== null ? q.bestAsk - q.bestBid : null;
      rows.push(`${(b.lo * 100).toFixed(0)}-${(b.hi * 100).toFixed(0)}c: measured median ${b.median_spread_cents} [${b.p25_spread_cents}, ${b.p75_spread_cents}] n=${b.n}; dealer ${spread}`);
      if (spread === null) continue; // one-sided in the extreme tail, as on the venues
      expect(spread, rows[rows.length - 1]).toBeGreaterThanOrEqual(Math.floor(b.p25_spread_cents) - 1);
      expect(spread, rows[rows.length - 1]).toBeLessThanOrEqual(Math.ceil(b.p75_spread_cents) + 1);
    }
    console.log(rows.join("\n"));
    expect(rows.length).toBeGreaterThanOrEqual(5);
  });
});
