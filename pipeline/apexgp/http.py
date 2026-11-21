"""A small disk-cached, throttled JSON client.

Every response is cached under ``pipeline/.cache/<namespace>/`` keyed by the
full URL, so a rebuild is reproducible offline once the cache is warm and the
public APIs are never hit twice for the same resource.
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any

import requests

from .config import CACHE_DIR, USER_AGENT


class RateLimited(RuntimeError):
    pass


class CachedClient:
    def __init__(self, namespace: str, min_interval_s: float, max_retries: int = 6):
        self.dir = CACHE_DIR / namespace
        self.dir.mkdir(parents=True, exist_ok=True)
        self.min_interval_s = min_interval_s
        self.max_retries = max_retries
        self._last = 0.0
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        self.network_calls = 0
        self.offline = False

    def _path(self, url: str) -> Path:
        digest = hashlib.sha256(url.encode()).hexdigest()[:24]
        return self.dir / f"{digest}.json"

    def cached(self, url: str) -> bool:
        return self._path(url).exists()

    def get(self, url: str, allow_404: bool = False) -> Any:
        path = self._path(url)
        if path.exists():
            with path.open() as fh:
                return json.load(fh)["body"]
        if self.offline:
            raise FileNotFoundError(f"offline and not cached: {url}")
        backoff = 5.0
        for attempt in range(self.max_retries):
            wait = self.min_interval_s - (time.monotonic() - self._last)
            if wait > 0:
                time.sleep(wait)
            self._last = time.monotonic()
            resp = self.session.get(url, timeout=60)
            self.network_calls += 1
            if resp.status_code == 200:
                body = resp.json()
                tmp = path.with_suffix(".tmp")
                with tmp.open("w") as fh:
                    json.dump({"url": url, "fetched_unix": int(time.time()), "body": body}, fh)
                tmp.replace(path)
                return body
            if resp.status_code == 404 and allow_404:
                with path.open("w") as fh:
                    json.dump({"url": url, "fetched_unix": int(time.time()), "body": None, "status": 404}, fh)
                return None
            if resp.status_code in (429, 500, 502, 503, 504):
                retry_after = resp.headers.get("Retry-After")
                delay = float(retry_after) if retry_after and retry_after.isdigit() else backoff
                time.sleep(min(delay, 120))
                backoff *= 2
                continue
            raise RuntimeError(f"GET {url} -> HTTP {resp.status_code}: {resp.text[:200]}")
        raise RateLimited(f"gave up after {self.max_retries} attempts: {url}")

    def fetched_at(self, url: str) -> int | None:
        path = self._path(url)
        if not path.exists():
            return None
        with path.open() as fh:
            return json.load(fh).get("fetched_unix")
