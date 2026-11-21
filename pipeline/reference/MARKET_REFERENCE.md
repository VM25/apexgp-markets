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

## Part C. Snapshot of live F1 order books

### C1. What was captured

| | Kalshi | Polymarket |
|---|---|---|
| Endpoints (all public, no auth, GET) | `external-api.kalshi.com/trade-api/v2`: `/series`, `/markets`, `/markets/orderbooks` | `gamma-api.polymarket.com/events/keyset` (tag ids 435 "formula1" and 100389 "f1"), `clob.polymarket.com/book` |
| HTTP results | 46 requests, all 200 | 640 requests, all 200 |
| Books fetched (UTC, 2026-11-21) | 18:00:33 to 18:00:37 | 18:00:40 to 18:13:39 |
| Open F1 markets | **250** (33 events, 17 series with open markets, from 40 F1 series queried) | **637** (50 open events) |
| Two-sided books | 139 | 256 |
| of which placeholder "stub" quotes (spread >= 50c) | 0 | 161 |
| **Quoted** (two-sided, spread < 50c) | **139** | **95** |
| Quoted and traded in last 24h | 98 | 40 |
| Offer only, no bid | 111 (103 with best ask <= 5c) | 380 (40 with best ask <= 5c; 276 with best ask > 90c) |
| Empty book | 0 | 1 |
| Reported 24h volume, all F1 markets | 366,662 contracts | $96,481 |
| Tick size on these markets | 1c on all 250 (`linear_cent`) | 0.01 on 519, 0.001 on 118 |
| Fee setting on these markets | `quadratic` x1 on 206; `quadratic_with_maker_fees` x1 on 44 (race winner, podium) | taker rate 0.05, maker 0 on 636; one market at rate 0.01 |

Sample size for the tables below: **234 quoted books** (139 Kalshi + 95 Polymarket),
of which **138 traded in the last 24h** (98 + 40).

Timing context (session times from Jolpica, `/ergast/f1/2026/races/`): Las Vegas
qualifying started 2026-11-21 04:00 UTC and the race starts 2026-11-22 04:00 UTC, so
this is a post-qualifying book about 10 hours before lights out. Both venues also had
Qatar and Abu Dhabi markets listed; on Polymarket those were almost entirely dormant
(40 of 50 events, 532 markets, had no 24h volume).

Neither venue had an open drivers'-champion or constructors'-champion winner market
at snapshot time (Kalshi series `KXF1` and `KXF1CONSTRUCTORS` returned no open
markets; Polymarket listed only "2nd place" to "5th place" events). Championship
microstructure is therefore **not** represented.

### C2. Method

Script: `snapshot_books.py` (stdlib + `requests`, User-Agent `research-script/1.0`,
1.1 s minimum gap per host, stops a venue on 429/401/403/451, no retries). Raw
responses: `raw/20261121T175945Z/*.jsonl`, one line per HTTP response with its own
`fetched_utc`. Per-market output: `book_snapshot_summary.csv` (887 rows). Bucket
medians: `book_snapshot_buckets.json`. Re-run the maths offline with
`python snapshot_books.py --from-raw raw/20261121T175945Z`.

Definitions:

- Prices are for the YES side (Polymarket: the first outcome token), in dollars 0-1.
  Kalshi returns bids only; a NO bid at q is used as a YES ask at 1 - q, as its API
  docs describe.
- `mid` = (best bid + best ask) / 2; `spread` = best ask - best bid, in cents.
- `top size` = mean of best-bid size and best-ask size. One contract or share pays
  $1, so sizes are comparable across venues.
- `depth ±Nc` = contracts resting at bids >= mid - N cents plus asks <= mid + N
  cents (both sides added). `$` = sum of price x size over those levels, at YES prices.
- `quoted` = two-sided with spread < 50c. This removes placeholder quotes such as
  1c bid / 99c ask that sit on dormant markets and would otherwise put 159
  placeholder books (typical spread 98c) into the 35-65c bucket.
- `traded` = quoted and the venue reports 24h volume > 0 (Kalshi `volume_24h_fp`
  in contracts; Polymarket Gamma `volume24hr`, taken to be USD).
- Buckets use `lo <= mid < hi`. Books with no bid have no mid and are counted
  separately (table above), not bucketed.

### C3. Spread and depth by price level

**All quoted books, both venues (n = 234).** This is the table mirrored in
`market_reference.json`.

| Mid price | n | Median spread (c) | Spread IQR (c) | Median top size | Median bid / ask size | Depth ±1c | Depth ±2c | Depth ±5c | Depth ±2c ($) | Levels per side |
|---|---|---|---|---|---|---|---|---|---|---|
| <5c | 76 | 1 | 0.5 to 2.77 | 244 | 150 / 143 | 744 | 1,897 | 2,950 | 17 | 16.2 |
| 5-15c | 36 | 4 | 3 to 7 | 214 | 23 / 225 | 0 | 36 | 1,450 | 3 | 17.5 |
| 15-35c | 55 | 5 | 3.5 to 10.5 | 135 | 30 / 59 | 0 | 0 | 361 | 0 | 15.5 |
| 35-65c | 33 | 9 | 3 to 10 | 200 | 188 / 200 | 0 | 0 | 400 | 0 | 10 |
| 65-85c | 23 | 5 | 3.25 to 8 | 92 | 21 / 80 | 0 | 0 | 400 | 0 | 12.5 |
| 85-95c | 11 | 5 | 4 to 8 | 32 | 12 / 10 | 0 | 0 | 1,418 | 0 | 11.5 |
| >95c | 0 | - | - | - | - / - | - | - | - | - | - |

**Quoted books that traded in the last 24h, both venues (n = 138).** Closer to what
an active market looks like.

| Mid price | n | Median spread (c) | Spread IQR (c) | Median top size | Median bid / ask size | Depth ±1c | Depth ±2c | Depth ±5c | Depth ±2c ($) | Levels per side |
|---|---|---|---|---|---|---|---|---|---|---|
| <5c | 34 | 1 | 0.4 to 2 | 714 | 175 / 454 | 2,346 | 3,662 | 6,183 | 49 | 19.5 |
| 5-15c | 26 | 4 | 3 to 4.75 | 270 | 18 / 503 | 0 | 360 | 2,310 | 25 | 19.5 |
| 15-35c | 35 | 4 | 3 to 6 | 128 | 13 / 59 | 0 | 15 | 871 | 2 | 18.5 |
| 35-65c | 18 | 3 | 2 to 4.75 | 79 | 35 / 65 | 0 | 267 | 1,474 | 161 | 18.8 |
| 65-85c | 17 | 5 | 2 to 8 | 58 | 17 / 20 | 0 | 0 | 348 | 0 | 13 |
| 85-95c | 8 | 5 | 3.5 to 6.5 | 66 | 26 / 7 | 0 | 0 | 1,601 | 0 | 11.5 |
| >95c | 0 | - | - | - | - / - | - | - | - | - | - |

**Kalshi, all quoted (n = 139).**

| Mid price | n | Median spread (c) | Spread IQR (c) | Median top size | Median bid / ask size | Depth ±1c | Depth ±2c | Depth ±5c | Depth ±2c ($) | Levels per side |
|---|---|---|---|---|---|---|---|---|---|---|
| <5c | 24 | 2 | 1 to 3 | 596 | 198 / 375 | 556 | 1,295 | 2,191 | 25 | 20 |
| 5-15c | 26 | 4 | 3 to 6 | 246 | 18 / 368 | 0 | 36 | 1,450 | 3 | 19.5 |
| 15-35c | 37 | 5 | 3 to 6 | 103 | 13 / 51 | 0 | 0 | 416 | 0 | 17 |
| 35-65c | 26 | 7 | 2.25 to 10 | 200 | 200 / 200 | 0 | 0 | 400 | 0 | 13.5 |
| 65-85c | 18 | 6 | 4 to 8 | 96 | 20 / 34 | 0 | 0 | 400 | 0 | 12.8 |
| 85-95c | 8 | 4.5 | 3.5 to 5.25 | 66 | 17 / 7 | 0 | 8 | 2,157 | 7 | 11.8 |
| >95c | 0 | - | - | - | - / - | - | - | - | - | - |

**Kalshi, traded in last 24h (n = 98).**

| Mid price | n | Median spread (c) | Spread IQR (c) | Median top size | Median bid / ask size | Depth ±1c | Depth ±2c | Depth ±5c | Depth ±2c ($) | Levels per side |
|---|---|---|---|---|---|---|---|---|---|---|
| <5c | 14 | 1 | 1 to 2 | 718 | 620 / 454 | 1,371 | 2,386 | 3,911 | 45 | 22.5 |
| 5-15c | 22 | 4 | 3 to 5.75 | 261 | 18 / 478 | 0 | 126 | 1,966 | 10 | 20.5 |
| 15-35c | 28 | 4 | 3 to 5.25 | 102 | 6 / 87 | 0 | 12 | 851 | 2 | 18.5 |
| 35-65c | 14 | 2.5 | 2 to 4 | 54 | 35 / 42 | 12 | 267 | 986 | 161 | 19.2 |
| 65-85c | 13 | 5 | 4 to 7 | 39 | 14 / 15 | 0 | 0 | 348 | 0 | 14 |
| 85-95c | 7 | 5 | 3 to 5.5 | 32 | 22 / 5 | 0 | 0 | 1,784 | 0 | 11.5 |
| >95c | 0 | - | - | - | - / - | - | - | - | - | - |

**Polymarket, all quoted (n = 95).**

| Mid price | n | Median spread (c) | Spread IQR (c) | Median top size | Median bid / ask size | Depth ±1c | Depth ±2c | Depth ±5c | Depth ±2c ($) | Levels per side |
|---|---|---|---|---|---|---|---|---|---|---|
| <5c | 52 | 0.8 | 0.28 to 2.48 | 181 | 150 / 92 | 1,594 | 2,468 | 3,217 | 11 | 15.2 |
| 5-15c | 10 | 5.5 | 2.02 to 9.8 | 152 | 45 / 166 | 0 | 391 | 1,541 | 23 | 11.2 |
| 15-35c | 18 | 19.5 | 11.75 to 44.9 | 262 | 337 / 60 | 0 | 0 | 0 | 0 | 9.2 |
| 35-65c | 7 | 13 | 4 to 40 | 529 | 100 / 1,048 | 0 | 0 | 0 | 0 | 9.5 |
| 65-85c | 5 | 2.5 | 2 to 8 | 89 | 50 / 99 | 0 | 1,258 | 2,156 | 877 | 11.5 |
| 85-95c | 3 | 17 | 12.5 to 17.35 | 18 | 10 / 26 | 0 | 0 | 0 | 0 | 8 |
| >95c | 0 | - | - | - | - / - | - | - | - | - | - |

**Polymarket, traded in last 24h (n = 40).**

| Mid price | n | Median spread (c) | Spread IQR (c) | Median top size | Median bid / ask size | Depth ±1c | Depth ±2c | Depth ±5c | Depth ±2c ($) | Levels per side |
|---|---|---|---|---|---|---|---|---|---|---|
| <5c | 20 | 0.45 | 0.25 to 1.65 | 688 | 153 / 683 | 2,679 | 4,039 | 6,694 | 49 | 13.8 |
| 5-15c | 4 | 2 | 1.88 to 2.25 | 447 | 21 / 883 | 489 | 1,183 | 14,421 | 86 | 10.2 |
| 15-35c | 7 | 3 | 1.5 to 12.5 | 232 | 320 / 59 | 0 | 380 | 1,221 | 59 | 14 |
| 35-65c | 4 | 4 | 2.75 to 7 | 871 | 84 / 1,665 | 0 | 715 | 8,262 | 369 | 11.5 |
| 65-85c | 4 | 5 | 1.75 to 12.5 | 74 | 34 / 90 | 89 | 726 | 1,299 | 488 | 11 |
| 85-95c | 1 | 8 | - | 556 | 100 / 1,011 | 0 | 0 | 1,418 | 0 | 11.5 |
| >95c | 0 | - | - | - | - / - | - | - | - | - | - |

What the tables show:

- **Longshots are tight in cents.** Below 5c the median spread is 1c overall (2c on
  Kalshi's 1c grid, 0.8c on Polymarket where most such books use a 0.1c tick), and
  top-of-book size is the largest of any bucket.
- **5c to 95c: 3c to 5c is typical.** Median spread is 4c to 5c for all quoted books
  outside the 35-65c bucket, and 3c to 5c for books that traded in the last day. Whole-venue medians: Kalshi
  4c quoted and 4c traded; Polymarket 2.1c quoted and 2c traded.
- **Around 50c, activity decides everything.** The 35-65c bucket is 9c wide across
  all quoted books but 3c for traded ones; 12 of the 15 untraded ones are Kalshi
  head-to-head pairs carrying 200-lot quotes about 10c apart.
- **One-tick spreads are the exception.** A 1c-or-tighter spread appears on
  19 of 139 quoted Kalshi books and 33 of 95 quoted Polymarket books; 2c or
  tighter on 36 of 139 and 45 of 95.
- **Depth is one-sided.** The offer (YES ask) is usually far bigger than the bid
  because resting liquidity is people bidding for NO on outcomes they think will
  lose. Total resting size across all F1 books: Kalshi 564,338 contracts bid
  against 3,296,202 offered; Polymarket 586,431 against 1,371,872.
- **Depth within ±1c or ±2c is often zero** in the middle buckets simply because the
  spread is wider than the window; ±5c is the more useful depth number there
  (medians of roughly 350 to 2,300 contracts).
- **Many longshots have no bid at all.** 103 Kalshi books had
  only an offer at 5c or less (median best ask 2c, median size
  1,091); Polymarket had 40 such books (median ask
  1c, median size 11).
- **Nothing above 95c.** No quoted book had a mid over 95c. A YES at 97c is the same
  book as its NO at 3c, so the under-5c row can be mirrored (bid and ask sizes
  swapped) if the simulator needs that bucket.

### C4. By market type

Quoted books only; Polymarket groups with no 24h volume are left out.

| Venue | Market group | Markets | Quoted | No bid at all | Median spread (c) | Median bid / ask size | Median depth ±5c | 24h volume |
|---|---|---|---|---|---|---|---|---|
| kalshi | `KXF1RACE` | 22 | 6 | 16 | 1 | 122 / 10,935 | 45,708 | 303,698 contracts |
| kalshi | `KXF1RACEPODIUM` | 22 | 9 | 13 | 2 | 14 / 701 | 6,779 | 29,642 contracts |
| kalshi | `KXF1FASTLAP` | 22 | 9 | 13 | 3 | 26 / 900 | 2,404 | 7,265 contracts |
| kalshi | `KXF1H2HLOTP` | 8 | 8 | 0 | 6.5 | 13 / 6 | 224 | 5,258 contracts |
| kalshi | `KXF1BIGGESTMOVER` | 22 | 10 | 12 | 2 | 116 / 413 | 822 | 4,949 contracts |
| kalshi | `KXF1TOP10` | 23 | 19 | 4 | 5 | 19 / 20 | 2,529 | 4,538 contracts |
| kalshi | `KXF1TOP5` | 23 | 12 | 11 | 4.5 | 14 / 21 | 494 | 4,022 contracts |
| kalshi | `KXF1EXACTFINISH` | 20 | 17 | 3 | 4 | 17 / 5 | 260 | 3,065 contracts |
| kalshi | `KXF1OCCUR` | 2 | 2 | 0 | 6.5 | 115 / 24 | 540 | 2,115 contracts |
| kalshi | `KXF1TOPCONSTRUCTOR` | 11 | 6 | 5 | 2.5 | 138 / 375 | 1,761 | 762 contracts |
| kalshi | `KXF1WINMARGIN` | 4 | 4 | 0 | 4 | 8 / 377 | 1,422 | 552 contracts |
| kalshi | `KXF1NEXTTEAM` | 12 | 1 | 11 | 2 | 30 / 33 | 1,784 | 504 contracts |
| kalshi | `KXF1FASTPIT` | 11 | 7 | 4 | 5 | 20 / 5 | 1,248 | 135 contracts |
| kalshi | `KXF1ACTION` | 23 | 5 | 18 | 4 | 178 / 290 | 866 | 112 contracts |
| kalshi | `KXF1H2H` | 20 | 20 | 0 | 10 | 200 / 200 | 400 | 28 contracts |
| kalshi | `KXF1RETIRE` | 4 | 3 | 1 | 5 | 5 / 200 | 416 | 17 contracts |
| kalshi | `KXF1CHINA` | 1 | 1 | 0 | 4 | 12 / 1 | 1,074 | 0 contracts |
| polymarket | `f1-las-vegas-grand-prix-winner` | 23 | 17 | 6 | 0.4 | 250 / 1,144 | 8,063 | 84,402 USD |
| polymarket | `f1-las-vegas-grand-prix-driver-podium` | 23 | 18 | 5 | 2 | 150 / 2,000 | 4,976 | 9,750 USD |
| polymarket | `will-max-verstappen-retire-from-f1-in-2026` | 1 | 1 | 0 | 1.4 | 40 / 25 | 21,750 | 1,080 USD |
| polymarket | `f1-las-vegas-grand-prix-driver-fastest-lap` | 23 | 9 | 14 | 7.3 | 150 / 83 | 1,025 | 793 USD |
| polymarket | `f1-action-of-the-year` | 22 | 22 | 0 | 1.1 | 62 / 56 | 1,255 | 174 USD |
| polymarket | `f1-abu-dhabi-grand-prix-take-place` | 1 | 1 | 0 | 26 | 17 / 99 | 0 | 102 USD |
| polymarket | `2026-f1-drivers-champion-2nd-place` | 5 | 5 | 0 | 8 | 100 / 40 | 333 | 89 USD |
| polymarket | `2026-f1-drivers-champion-3rd-place` | 5 | 5 | 0 | 13 | 20 / 30 | 0 | 74 USD |
| polymarket | `f1-las-vegas-grand-prix-safety-car` | 1 | 1 | 0 | 8 | 8 / 5 | 143 | 14 USD |

### C5. The same market on both venues: Las Vegas GP winner

| Driver | Kalshi bid x size | Kalshi ask x size | Kalshi 24h (contracts) | Polymarket bid x size | Polymarket ask x size | Polymarket 24h (USD) |
|---|---|---|---|---|---|---|
| Max Verstappen | 49c x 196 | 50c x 3,842 | 64,724 | 49c x 1,000 | 51c x 2,953 | 19,663 |
| George Russell | 24c x 612 | 25c x 4,589 | 44,667 | 25c x 1,004 | 26c x 2,079 | 14,315 |
| Kimi Antonelli | 15c x 48 | 17c x 16,867 | 69,406 | 15c x 44 | 16c x 1,155 | 15,114 |
| Lando Norris | 7c x 6 | 8c x 5,004 | 26,647 | 8c x 130 | 10c x 8,724 | 7,197 |
| Lewis Hamilton | 1c x 40 | 2c x 96,264 | 38,218 | 0.9c x 1,344 | 1c x 133 | 4,113 |
| Isack Hadjar | 1c x 2,335 | 2c x 64,638 | 12,586 | 1c x 250 | 1.8c x 1,018 | 2,172 |

Prices agree to within a cent or two across venues. Summing the best prices over all
outcomes in the winner market: Kalshi (22 drivers) bids sum to 0.97 and asks
to 1.20; Polymarket (23) bids 1.01, asks 1.13. Podium market (fair sum
is 3): Kalshi bids 2.94, asks 3.48; Polymarket bids 2.92, asks 3.33. Kalshi's
larger ask-side overround on the winner market is mostly its 1c minimum offer on 16
no-hope drivers.

### C6. Tick-size rule, checked against the Polymarket books

Among the 95 quoted Polymarket books: all 50 with a mid below 4c or above 96c
had a 0.001 tick (none had 0.01); of the 45 with a mid between 4c and 96c,
35 had 0.01 and 10 had 0.001. That fits the archived rule (finer tick once
price passes 0.96 or 0.04) and suggests the finer tick stays on after price moves
back; the second half of that sentence is an inference from one snapshot.

### C7. Caveats

- **One snapshot.** A single moment, Saturday about 18:00 UTC, post-qualifying and
  pre-race. Spreads and depth move a great deal across a race weekend and in-race;
  none of that is captured. No time series, no trades, no fill data.
- **Not simultaneous.** Kalshi books span 5 seconds; Polymarket books were read one
  at a time over 13 minutes, so cross-market sums on Polymarket mix slightly
  different instants.
- **Two venues, different rules.** Kalshi: CFTC-regulated exchange, 1c tick on these
  markets, 0.07 taker coefficient, maker fees on winner and podium. Polymarket:
  on-chain CLOB, 0.01 or 0.001 tick, 0.05 taker coefficient, no maker fee, minimum
  order 5 shares. Pooled rows mix both; use the per-venue tables when it matters.
- **Small cells.** Several buckets have fewer than 10 books (every Polymarket bucket
  above 5c in the traded table). Treat single-venue medians there as indicative only.
- **Not independent.** Winner, podium, top-5 and top-10 books on the same race share
  drivers and market makers; 234 books are not 234 independent observations.
- **Displayed size only.** Hidden or reactive liquidity, RFQ and combo flow are not
  visible. Kalshi sizes can be fractional.
- **Units.** Kalshi 24h volume is in contracts; Polymarket's is taken as USD from
  the Gamma field name and magnitude, which I did not find documented.
- **Stub threshold is a choice.** The 50c cut-off for "quoted" is mine. On Kalshi it
  removes nothing; on Polymarket the excluded books cluster at 90c+ spreads (145 of
  161), with 16 between 50c and 90c.
- **Mid-price depth in dollars** counts offers at YES prices, so a deep 1c offer adds
  almost nothing to the dollar figure.
- **Scope.** F1 only, one race weekend, no championship-winner markets open.
