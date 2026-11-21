#!/usr/bin/env python3
"""snapshot_books.py - one-shot, read-only snapshot of public Formula 1
prediction-market order books, for calibrating a *simulated* market.

Venues (public, no-auth GET endpoints only):
  * Kalshi Trade API v2   : /series -> /markets (open) -> /markets/orderbooks
  * Polymarket Gamma API  : /events/keyset (F1 tags)  + CLOB /book per market

No accounts, no authentication, no orders, no personal data. Generic
User-Agent, >= 1 s between requests per host. A venue is abandoned on HTTP
429 (and on 401/403/451) and the status is recorded - nothing is retried or
worked around.

Usage
  python snapshot_books.py                       # fetch, save raw, summarise
  python snapshot_books.py --from-raw raw/<DIR>  # re-summarise saved raw only
  python snapshot_books.py --venues kalshi       # one venue

Outputs (next to this file)
  raw/<UTCSTAMP>/*.jsonl        one line per HTTP response:
                                {fetched_utc, url, http_status, body}
  raw/<UTCSTAMP>/manifest.json  what was fetched, what failed and why
  book_snapshot_summary.csv     one row per market
  book_snapshot_buckets.json    medians bucketed by mid price

Dependencies: stdlib + requests.
"""
import argparse
import csv
import json
import re
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

import requests

HERE = Path(__file__).resolve().parent
UA = "research-script/1.0"
MIN_INTERVAL_S = 1.1          # politeness: per-host gap between requests
TIMEOUT_S = 30
STOP_STATUSES = {401, 403, 429, 451}

KALSHI = "https://external-api.kalshi.com/trade-api/v2"
GAMMA = "https://gamma-api.polymarket.com"
CLOB = "https://clob.polymarket.com"
PM_F1_TAG_IDS = (435, 100389)     # "formula1", "f1" (from GET /sports, /tags/slug/*)
KALSHI_EXTRA_SERIES = ("KXUSAF1", "KXAFRICAF1")   # F1 series carrying no Motorsport tag
F1_RE = re.compile(r"\bF1\b|Formula ?(1|One)", re.I)

BUCKETS = [(0.0, 0.05), (0.05, 0.15), (0.15, 0.35), (0.35, 0.65),
           (0.65, 0.85), (0.85, 0.95), (0.95, 1.0001)]
WINDOWS_C = (1, 2, 5)


def utcnow():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


class VenueStop(Exception):
    """Raised when a venue answers with a status we must not push past."""


class Fetcher:
    def __init__(self, raw_dir):
        self.raw_dir = raw_dir
        self.s = requests.Session()
        self.s.headers.update({"User-Agent": UA, "Accept": "application/json"})
        self.last = {}
        self.log = []          # (file, url, status)

    def get(self, url, params=None, out="misc"):
        host = urlsplit(url).netloc
        wait = MIN_INTERVAL_S - (time.monotonic() - self.last.get(host, 0.0))
        if wait > 0:
            time.sleep(wait)
        try:
            r = self.s.get(url, params=params, timeout=TIMEOUT_S)
            status, full_url = r.status_code, r.url
            try:
                body = r.json()
            except ValueError:
                body = r.text[:2000]
        except requests.RequestException as e:
            status, full_url, body = 0, url, f"{type(e).__name__}: {e}"
        self.last[host] = time.monotonic()
        rec = {"fetched_utc": utcnow(), "url": full_url, "http_status": status, "body": body}
        with open(self.raw_dir / f"{out}.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, separators=(",", ":")) + "\n")
        self.log.append((out, full_url, status))
        if status in STOP_STATUSES:
            raise VenueStop(f"HTTP {status} from {full_url}")
        return rec if status == 200 else None


# ----------------------------------------------------------------- fetching
def fetch_kalshi(fx):
    rec = fx.get(f"{KALSHI}/series", {"category": "Sports", "tags": "Motorsport"}, "kalshi_series")
    series = [s for s in ((rec or {}).get("body") or {}).get("series") or []
              if F1_RE.search(f"{s.get('ticker', '').replace('KXF1', 'F1 ')} {s.get('title', '')}")]
    tickers = sorted({s["ticker"] for s in series} | set(KALSHI_EXTRA_SERIES))
    market_tickers = []
    for st in tickers:
        cursor = ""
        while True:
            p = {"series_ticker": st, "status": "open", "limit": 1000}
            if cursor:
                p["cursor"] = cursor
            rec = fx.get(f"{KALSHI}/markets", p, "kalshi_markets")
            body = (rec or {}).get("body") or {}
            market_tickers += [m["ticker"] for m in body.get("markets") or []]
            cursor = body.get("cursor") or ""
            if not cursor:
                break
    for i in range(0, len(market_tickers), 50):   # endpoint allows up to 100 tickers
        fx.get(f"{KALSHI}/markets/orderbooks",
               [("tickers", t) for t in market_tickers[i:i + 50]], "kalshi_orderbooks")
    return {"series": len(tickers), "markets": len(market_tickers)}


def fetch_polymarket(fx):
    seen, tokens = set(), []
    for tag in PM_F1_TAG_IDS:
        cursor = None
        while True:
            p = {"tag_id": tag, "closed": "false", "limit": 50}
            if cursor:
                p["after_cursor"] = cursor
            rec = fx.get(f"{GAMMA}/events/keyset", p, "polymarket_events")
            body = (rec or {}).get("body") or {}
            for ev in body.get("events") or []:
                if ev.get("id") in seen:
                    continue
                seen.add(ev.get("id"))
                for m in ev.get("markets") or []:
                    if pm_tradable(m):
                        tokens.append(json.loads(m["clobTokenIds"])[0])
            cursor = body.get("next_cursor")
            if not cursor:
                break
    for tok in tokens:                      # first-outcome ("Yes") token book
        fx.get(f"{CLOB}/book", {"token_id": tok}, "polymarket_books")
    return {"events": len(seen), "markets": len(tokens)}


def pm_tradable(m):
    return bool(m.get("active") and not m.get("closed") and m.get("enableOrderBook")
                and m.get("acceptingOrders") and m.get("clobTokenIds"))


# ---------------------------------------------------------------- analysis
def read_jsonl(path):
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def fnum(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def book_metrics(bids, asks):
    """bids/asks: [(price 0-1, size)] in YES-price terms. Depth windows are
    inclusive: bids >= mid - w, asks <= mid + w. USD = sum(price * size)."""
    bids = sorted([(p, s) for p, s in bids if s > 0], key=lambda x: -x[0])
    asks = sorted([(p, s) for p, s in asks if s > 0], key=lambda x: x[0])
    o = {"n_bid_levels": len(bids), "n_ask_levels": len(asks),
         "best_bid": bids[0][0] if bids else None, "best_bid_size": bids[0][1] if bids else None,
         "best_ask": asks[0][0] if asks else None, "best_ask_size": asks[0][1] if asks else None,
         "total_bid_contracts": round(sum(s for _, s in bids), 2),
         "total_ask_contracts": round(sum(s for _, s in asks), 2),
         "mid": None, "spread_cents": None}
    o["book_state"] = ("two_sided" if bids and asks else "bid_only" if bids
                       else "ask_only" if asks else "empty")
    for w in WINDOWS_C:
        o[f"depth_{w}c_contracts"] = o[f"depth_{w}c_usd"] = None
    if bids and asks:
        mid = (bids[0][0] + asks[0][0]) / 2
        o["mid"] = round(mid, 5)
        o["spread_cents"] = round((asks[0][0] - bids[0][0]) * 100, 3)
        for w in WINDOWS_C:
            b = [(p, s) for p, s in bids if p >= mid - w / 100 - 1e-9]
            a = [(p, s) for p, s in asks if p <= mid + w / 100 + 1e-9]
            o[f"depth_{w}c_contracts"] = round(sum(s for _, s in b + a), 2)
            o[f"depth_{w}c_usd"] = round(sum(p * s for p, s in b + a), 2)
    return o


def kalshi_rows(raw):
    series = {}
    for rec in read_jsonl(raw / "kalshi_series.jsonl"):
        if rec["http_status"] == 200:
            series.update({s["ticker"]: s for s in rec["body"].get("series") or []})
    meta = {}
    for rec in read_jsonl(raw / "kalshi_markets.jsonl"):
        if rec["http_status"] == 200:
            meta.update({m["ticker"]: m for m in rec["body"].get("markets") or []})
    rows = []
    for rec in read_jsonl(raw / "kalshi_orderbooks.jsonl"):
        if rec["http_status"] != 200:
            continue
        for ob in rec["body"].get("orderbooks") or []:
            m = meta.get(ob["ticker"], {})
            fp = ob.get("orderbook_fp") or {}
            bids = [(float(p), float(c)) for p, c in fp.get("yes_dollars") or []]
            # a NO bid at q is a YES ask at 1 - q
            asks = [(round(1 - float(p), 4), float(c)) for p, c in fp.get("no_dollars") or []]
            st = m.get("event_ticker", "").split("-")[0]
            row = {"venue": "kalshi", "market_id": ob["ticker"], "event_id": m.get("event_ticker"),
                   "group": st, "title": m.get("title"), "outcome": m.get("yes_sub_title"),
                   "fetched_utc": rec["fetched_utc"],
                   "volume_24h": fnum(m.get("volume_24h_fp")), "volume_24h_unit": "contracts",
                   "open_interest_contracts": fnum(m.get("open_interest_fp")),
                   "last_price": fnum(m.get("last_price_dollars")),
                   "fee_model": f"{series.get(st, {}).get('fee_type')} x{series.get(st, {}).get('fee_multiplier')}",
                   "closes_utc": m.get("close_time")}
            row.update(book_metrics(bids, asks))
            ref = row["mid"] if row["mid"] is not None else (row["last_price"] or 0.5)
            row["tick_size"] = next((fnum(r["step"]) for r in m.get("price_ranges") or []
                                     if fnum(r["start"]) <= ref <= fnum(r["end"])), None)
            rows.append(row)
    return rows


def polymarket_rows(raw):
    meta = {}
    for rec in read_jsonl(raw / "polymarket_events.jsonl"):
        if rec["http_status"] != 200:
            continue
        for ev in rec["body"].get("events") or []:
            for m in ev.get("markets") or []:
                if pm_tradable(m):
                    meta[json.loads(m["clobTokenIds"])[0]] = (ev, m)
    rows = []
    for rec in read_jsonl(raw / "polymarket_books.jsonl"):
        tok = re.search(r"token_id=(\d+)", rec["url"]).group(1)
        ev, m = meta.get(tok, ({}, {}))
        b = rec["body"] if rec["http_status"] == 200 and isinstance(rec["body"], dict) else {}
        bids = [(float(x["price"]), float(x["size"])) for x in b.get("bids") or []]
        asks = [(float(x["price"]), float(x["size"])) for x in b.get("asks") or []]
        fs = m.get("feeSchedule") or {}
        row = {"venue": "polymarket", "market_id": m.get("conditionId"), "event_id": ev.get("slug"),
               "group": re.sub(r"-\d{4}-\d{2}-\d{2}$", "", ev.get("slug") or ""),
               "title": m.get("question"),
               "outcome": m.get("groupItemTitle") or (json.loads(m.get("outcomes") or '[""]')[0]),
               "fetched_utc": rec["fetched_utc"], "tick_size": fnum(b.get("tick_size")),
               "volume_24h": fnum(m.get("volume24hr")), "volume_24h_unit": "usd",
               "open_interest_contracts": None, "last_price": fnum(m.get("lastTradePrice")),
               "fee_model": (f"taker {fs.get('rate')} x p(1-p); maker 0" if m.get("feesEnabled")
                             else "no fee"),
               "closes_utc": m.get("endDate")}
        row.update(book_metrics(bids, asks))
        if rec["http_status"] != 200:
            row["book_state"] = f"http_{rec['http_status']}"
        rows.append(row)
    return rows


def med(xs):
    xs = [x for x in xs if x is not None]
    return round(statistics.median(xs), 3) if xs else None


def bucket_table(rows):
    out = []
    for lo, hi in BUCKETS:
        r = [x for x in rows if x["mid"] is not None and lo <= x["mid"] < hi]
        sp = sorted(x["spread_cents"] for x in r)
        q = statistics.quantiles(sp, n=4, method="inclusive") if len(sp) >= 2 else [None] * 3
        out.append({
            "lo": lo, "hi": min(hi, 1.0), "n": len(r),
            "median_spread_cents": med(sp),
            "p25_spread_cents": None if q[0] is None else round(q[0], 3),
            "p75_spread_cents": None if q[2] is None else round(q[2], 3),
            "median_top_size": med([(x["best_bid_size"] + x["best_ask_size"]) / 2 for x in r]),
            "median_best_bid_size": med([x["best_bid_size"] for x in r]),
            "median_best_ask_size": med([x["best_ask_size"] for x in r]),
            "median_depth_1c": med([x["depth_1c_contracts"] for x in r]),
            "median_depth_2c": med([x["depth_2c_contracts"] for x in r]),
            "median_depth_5c": med([x["depth_5c_contracts"] for x in r]),
            "median_depth_2c_usd": med([x["depth_2c_usd"] for x in r]),
            "median_levels_per_side": med([(x["n_bid_levels"] + x["n_ask_levels"]) / 2 for x in r]),
        })
    return out


COLS = ["venue", "market_id", "event_id", "group", "title", "outcome", "fetched_utc",
        "book_state", "tick_size", "best_bid", "best_bid_size", "best_ask", "best_ask_size",
        "mid", "spread_cents", "n_bid_levels", "n_ask_levels",
        "depth_1c_contracts", "depth_1c_usd", "depth_2c_contracts", "depth_2c_usd",
        "depth_5c_contracts", "depth_5c_usd", "total_bid_contracts", "total_ask_contracts",
        "volume_24h", "volume_24h_unit", "open_interest_contracts", "last_price",
        "fee_model", "closes_utc"]


def summarise(raw):
    rows = kalshi_rows(raw) + polymarket_rows(raw)
    with open(HERE / "book_snapshot_summary.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    two = [r for r in rows if r["book_state"] == "two_sided"]
    traded = [r for r in two if (r["volume_24h"] or 0) > 0]
    times = sorted(r["fetched_utc"] for r in rows)
    res = {"raw_dir": str(raw.relative_to(HERE)), "first_book_utc": times[0] if times else None,
           "last_book_utc": times[-1] if times else None, "venues": {},
           "definitions": {
               "mid": "(best_bid + best_ask) / 2 of the YES / first-outcome token, 0-1 dollars",
               "spread_cents": "(best_ask - best_bid) * 100",
               "top_size": "(best_bid_size + best_ask_size) / 2, contracts ($1 max payout each)",
               "depth_Nc": "contracts resting at bid >= mid - N cents plus ask <= mid + N cents",
               "usd": "sum(price * size) over the same levels, YES-price terms",
               "buckets": "two-sided books only; lo <= mid < hi"},
           "buckets_all": bucket_table(two), "buckets_traded_24h": bucket_table(traded),
           "buckets_by_venue": {}, "buckets_traded_24h_by_venue": {}}
    for v in sorted({r["venue"] for r in rows}):
        vr = [r for r in rows if r["venue"] == v]
        states = {}
        for r in vr:
            states[r["book_state"]] = states.get(r["book_state"], 0) + 1
        res["venues"][v] = {"n_markets": len(vr), "book_states": states,
                            "n_two_sided": states.get("two_sided", 0),
                            "n_two_sided_traded_24h": len([r for r in traded if r["venue"] == v])}
        res["buckets_by_venue"][v] = bucket_table([r for r in two if r["venue"] == v])
        res["buckets_traded_24h_by_venue"][v] = bucket_table([r for r in traded if r["venue"] == v])
    with open(HERE / "book_snapshot_buckets.json", "w", encoding="utf-8") as f:
        json.dump(res, f, indent=1)
    return res


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--from-raw", help="re-summarise an existing raw/<DIR>; no network")
    ap.add_argument("--venues", default="kalshi,polymarket")
    a = ap.parse_args()
    if a.from_raw:
        raw = Path(a.from_raw).resolve()
    else:
        raw = HERE / "raw" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        raw.mkdir(parents=True, exist_ok=False)
        fx = Fetcher(raw)
        manifest = {"started_utc": utcnow(), "user_agent": UA, "min_interval_s": MIN_INTERVAL_S,
                    "venues": {}}
        for name, fn in (("kalshi", fetch_kalshi), ("polymarket", fetch_polymarket)):
            if name not in a.venues.split(","):
                continue
            t0 = utcnow()
            try:
                info = {"status": "ok", **fn(fx)}
            except VenueStop as e:      # blocked / rate-limited: record and move on
                info = {"status": "stopped", "reason": str(e)}
            info.update(started_utc=t0, finished_utc=utcnow())
            manifest["venues"][name] = info
            print(name, info, flush=True)
        codes = {}
        for out, _, status in fx.log:
            codes.setdefault(out, {}).setdefault(str(status), 0)
            codes[out][str(status)] += 1
        manifest.update(finished_utc=utcnow(), http_status_counts=codes)
        (raw / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    res = summarise(raw)
    print(json.dumps({k: res[k] for k in ("raw_dir", "first_book_utc", "last_book_utc", "venues")},
                     indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
