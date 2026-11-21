# Real prediction-market reference: fees and F1 order-book snapshot

Access date: **2026-11-21** (UTC). Everything here was read from the URL cited next
to it or measured from public no-auth endpoints on that date. Items I could not
confirm at a primary source are listed under "Not verified" at the end of each part.
Quotes are short key phrases only. Not legal or trading advice; ApexGP is a
simulation with fictional capital.

Machine-readable copy of the key numbers: `market_reference.json`.

---

## Part B. Fee schedules

### B1. Kalshi (event contracts)

**Access problem, stated up front.** The canonical document,
<https://kalshi.com/docs/kalshi-fee-schedule.pdf> (also linked as
<https://kalshi.com/fee-schedule>), returned **HTTP 429** with a "Vercel Security
Checkpoint" bot-challenge page, both to the script's generic client and to a second
plain fetch. I did not try to get past it. The formulas below therefore come from
other *official* Kalshi sources: Kalshi's own filings on cftc.gov, Kalshi's API
documentation (docs.kalshi.com), Kalshi's help centre, and the live public API.

| Item | Value | Status | Source |
|------|-------|--------|--------|
| General (taker) fee formula | `fee = round up(0.07 x C x P x (1 - P))` | Verified | Kalshi fee schedule as filed with the CFTC: <https://www.cftc.gov/filings/orgrules/rule091222kexdcm003.pdf> (page 2) |
| Variables | `P` = contract price in dollars (50c is 0.5); `C` = number of contracts | Verified | same |
| Taker coefficient still 0.07 in late 2026 | Worked example gives a per-contract fee of $0.0175 as "0.07 × 0.50 × 0.50" | Verified | Kalshi "Event Contracts Taker Rebate Program" filing dated 2026-10-14: <https://www.cftc.gov/filings/orgrules/rules10142633445.pdf> (Appendix A, 5(D)) |
| Same coefficient implied by current API docs | Example fill at $0.055 has a model fee of $0.00363825, which equals 0.07 x 0.055 x 0.945 | Verified (derived) | <https://docs.kalshi.com/getting_started/fee_rounding.md> |
| Who pays | Schedule charges only orders that match immediately (takers); resting orders are free unless the series has maker fees | Verified | 2022 filing page 2; <https://help.kalshi.com/en/articles/13823805-fees> |
| Maker fee, where a series has one | `0.25 x` the general fee, i.e. `round up(0.0175 x C x P x (1 - P))` | Multiplier verified; the literal 0.0175 formula was seen only in a search-engine excerpt of the blocked PDF | API field description for `fee_type` ("a 0.5 maker multiplier instead of 0.25"): <https://docs.kalshi.com/api-reference/market/get-series.md> |
| When maker fees are charged | Only when the resting order trades; cancelling is free | Verified | <https://help.kalshi.com/en/articles/13823805-fees> |
| Peak cost | 1.75c per contract at 50c for takers (3.5% of price); 0.4375c for makers on maker-fee series | Arithmetic from the above | |

**Rounding rule.**

- Fee schedule wording: "round up = rounds to the next cent", applied to the total
  for the trade, so 1 contract at any price from 1c to 99c costs at least 1c (the
  filed table shows $0.01 for a single contract at 1c-15c and 85c-99c, and $0.02 at
  20c-80c). Source: 2022 CFTC-filed schedule, pages 2-4.
- Current mechanics per the API docs
  (<https://docs.kalshi.com/getting_started/fee_rounding.md>): the model fee is first
  rounded **up to $0.000001** ("trade fee"); a separate "rounding fee" then brings
  the member's balance back onto its precision grid, which is **$0.01 for non-direct
  (FCM-cleared) members and $0.0001 for direct members**; over-collection is tracked
  in a per-order accumulator and rebated across later fills so that an order's total
  converges on what one equivalent fill would cost. Net fee per fill is never negative.
- For a simulator: `ceil` the fee to the cent **per order** (not per partial fill) to
  mimic an FCM-cleared retail account, or to $0.0001 to mimic a direct member.

**Per-series exceptions.**

| Exception | Detail | Source |
|-----------|--------|--------|
| Fee type is set per series | `fee_type` is one of `quadratic`, `quadratic_with_maker_fees`, `quadratic_with_combo_maker_fees`, `flat`; `fee_multiplier` scales the fee | <https://docs.kalshi.com/api-reference/market/get-series.md> |
| Combo maker fees | `quadratic_with_combo_maker_fees` uses a 0.5 maker multiplier instead of 0.25 | same |
| Event-level overrides | An event can override its series' fee type and multiplier | <https://docs.kalshi.com/api-reference/events/get-event-fee-changes.md> (index description) |
| S&P 500 and Nasdaq-100 markets | Half rate: `round up(0.035 x C x P x (1 - P))` for tickers starting `INX` / `NASDAQ100` | 2022 CFTC-filed schedule, page 5 (not re-confirmed against the current PDF) |
| Multipliers seen live | Across 4,321 Sports series on the access date: 4,196 `quadratic` x1; 106 `quadratic_with_maker_fees` x1; 18 `quadratic` x0.5 and 1 maker-fee series x0.5 (all pro-baseball series) | `GET https://external-api.kalshi.com/trade-api/v2/series?category=Sports` |
| Scheduled / historical changes | 107 entries, including 14 moves to multiplier 0 and 4 to combo maker fees; none touch an F1 series | `GET .../trade-api/v2/series/fee_changes?show_historical=true` |
| RFQ trades in `KXMVE` (combos) | Taker pays a taker-equivalent fee and the accepted quoter a maker-equivalent fee | Filing dated 2026-07-12: <https://www.cftc.gov/filings/orgrules/rules0712269458.pdf> |
| Taker rebate programme | Self-clearing members with large monthly effective volume (sum of p(1-p)c) get 15% / 30% / 50% of taker fees back at 2M / 20M / 100M; not relevant to retail | <https://www.cftc.gov/filings/orgrules/rules10142633445.pdf> |

**F1 series on Kalshi (live API, access date).** All 38 Motorsport-tagged F1 series
have `fee_multiplier = 1`. Two carry maker fees: **`KXF1RACE` (race winner)** and
**`KXF1RACEPODIUM` (podium finisher)** are `quadratic_with_maker_fees`. The other 36
(championship `KXF1`, constructors, pole, fastest lap, top-5/top-10, head-to-head and
so on) are plain `quadratic`, so makers pay nothing there.

**Tick sizes.** Prices are fixed-point dollars with up to 4 decimals. Each market
carries `price_ranges` (`start`, `end`, `step`) and a `price_level_structure` label;
`linear_cent` is a uniform 1c grid, and tapered structures use finer steps below 10c
and above 90c. Source: <https://docs.kalshi.com/getting_started/fixed_point_migration.md>
(last updated 2026-11-05). All F1 markets in the snapshot were `linear_cent` (see Part C).

**Public API limits.** Market-data endpoints need no authentication. The docs give
token budgets for authenticated tiers but no number for anonymous use, only that
unauthenticated requests have separate limits and clients should back off on 429.
Source: <https://docs.kalshi.com/getting_started/rate_limits.md>.

**Not verified (Kalshi).**

- The current fee-schedule PDF itself, including its effective date and the exact
  wording of its Maker Fees section and Specific Trading Fees table (HTTP 429).
- Whether the S&P 500 / Nasdaq-100 half rate still stands in the current PDF.
- The definition of the `flat` fee type (it points at the PDF's Specific Trading
  Fees table).

### B2. Polymarket

All from Polymarket's own docs unless marked.

| Item | Value | Source |
|------|-------|--------|
| Taker fee formula | `fee = C × feeRate × p × (1 - p)`; `C` = shares, `p` = share price | <https://docs.polymarket.com/trading/fees.md> (Fee Structure) |
| Sports taker rate | **0.05** ("Sports, including NFL and college football") | same, category table |
| Maker fee | 0 in every category: "Makers are never charged fees." | same |
| Other categories | 0.05: BTC 5/15-minute, Finance, Tech, election Politics, Combos, Other. 0.01: other Crypto, other Politics, Economics, Culture, Weather, Mentions. 0: Geopolitics | same |
| Fee precision | Rounded to 5 decimal places; smallest fee 0.00001 USDC; below that it is zero | same (Fee Precision) |
| Fees not in orders | Fees are set by the protocol and applied at match time | same (intro) |
| Peak cost (sports) | $1.25 per 100 shares at 50c (1.25c per share, 2.5% of price); $0.45 at 10c or 90c | same (Sports fee table) |
| Effective date of this schedule | 2026-11-20 23:59 UTC, the day before the snapshot | <https://docs.polymarket.com/changelog/predictions.md> (entry dated Nov 20, 2026) |
| Recent history | Sports rate rose from 0.03 to 0.05 on 2026-07-10 | same (entry dated Jul 10, 2026) |
| Maker rebates | Not a fee: a share of the taker fees your resting fills generate, by 30-day maker weighted volume: 0% under $200k, then 3% / 7% / 10% / 15% at $200k / $1M / $4M / $10M | <https://docs.polymarket.com/programs/maker-rebates.md> (Funding) |
| Taker rebates | 10% / 25% / 40% / 50% / 60% (Gold to Onyx) from $200k of 30-day weighted volume | <https://docs.polymarket.com/programs/taker-rebates.md> |
| Per-market fee fields | Gamma market object: `feesEnabled`, `feeSchedule {rate, exponent, takerOnly, rebateRate}` | <https://docs.polymarket.com/market-data/market-details.md> (Trading Fees) |

**Tick size.**

- Tick size is a per-market value that must be read from the market or book, never
  assumed. Valid increments listed in the docs: 0.1, 0.01, 0.005, 0.0025, 0.001 and
  0.0001. The 0.0025 step is reserved for certain World Cup markets.
  Source: <https://docs.polymarket.com/market-data/market-details.md> (Trading Constraints).
- A market's tick can change while it trades; the market WebSocket emits
  `tick_size_change` (docs example: 0.01 to 0.001) and orders off the current grid
  are rejected. Source: <https://docs.polymarket.com/trading/place-orders.md> and
  <https://docs.polymarket.com/market-data/realtime-data.md>.
- **When 0.01 becomes 0.001.** The current docs no longer state the trigger. The
  older official page did: the tick changes "when the book's price reaches the
  limits: price > 0.96 or price < 0.04". Source: Internet Archive copy of
  `docs.polymarket.com/developers/CLOB/websocket/market-channel` dated 2025-09-19:
  <http://web.archive.org/web/20250919142641/https://docs.polymarket.com/developers/CLOB/websocket/market-channel>.
  Part C checks this against the live books.

**Public API limits** (<https://docs.polymarket.com/api-reference/rate-limits.md>):
IP-based, throttled rather than rejected; Gamma `/events` 500 requests per 10 s, CLOB
`/book` 1,500 per 10 s. Gamma event pages above 50 items are served gzip-only (an
uncompressed request got HTTP 406 with that explanation).

**Not verified (Polymarket).**

- The 0.96 / 0.04 tick trigger in *current* documentation (archived page only).
- Whether every sports market is fee-enabled; fees are per market (`feesEnabled`).
  Part C reports what the F1 markets actually carry.

### B3. Side by side, for the simulator

| | Kalshi | Polymarket |
|---|--------|------------|
| Taker fee per contract at price p | 0.07 p(1-p) | 0.05 p(1-p) (sports) |
| Maker fee | 0, or 0.0175 p(1-p) on maker-fee series (F1 race winner and podium) | 0 |
| Rounding | Up; to the cent for FCM-cleared accounts, $0.0001 for direct members, per order | To 5 decimals, applied at match time |
| Taker fee, 100 contracts at 50c | $1.75 | $1.25 |
| Taker fee, 100 contracts at 10c or 90c | $0.63 | $0.45 |
| Taker fee, 1 contract at 50c | $0.02 (cent rounding) or $0.0175 | $0.0125 |
| Default tick | 1c (`linear_cent`) on F1 markets | 0.01 or 0.001 per market |

---

<!-- PART_C -->
