"""The sidecar's seam onto Osooly's D1 database (PRD 3.7).

Two interchangeable clients behind one `query()` surface:

- `HttpD1Client` talks to the Cloudflare D1 HTTP API and is what production
  uses; the sidecar and the Next.js app then literally share one database.
- `LocalD1Client` opens the SQLite file wrangler's miniflare keeps for
  `next dev`, so local development also shares one database without any
  Cloudflare credentials.

Both accept `?`-style positional parameters and return rows as dicts.
"""

import json
import logging
import sqlite3
import threading
import urllib.request
from pathlib import Path
from typing import Any, Protocol

from app.config import settings

log = logging.getLogger(__name__)


class D1Client(Protocol):
    def query(self, sql: str, params: list[Any] | None = None) -> list[dict]:
        """Run one statement; returns result rows (empty for writes)."""
        ...


class HttpD1Client:
    def __init__(self, account_id: str, database_id: str, api_token: str) -> None:
        self._url = (
            f"https://api.cloudflare.com/client/v4/accounts/{account_id}"
            f"/d1/database/{database_id}/query"
        )
        self._token = api_token

    def query(self, sql: str, params: list[Any] | None = None) -> list[dict]:
        payload = json.dumps({"sql": sql, "params": params or []}).encode("utf-8")
        req = urllib.request.Request(
            self._url,
            data=payload,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        if not body.get("success"):
            raise RuntimeError(f"D1 query failed: {body.get('errors')}")
        results = body.get("result") or []
        return (results[0].get("results") or []) if results else []


class LocalD1Client:
    """sqlite3 against wrangler's local D1 file. One connection guarded by a
    lock: the sidecar's writes are short, and SQLite serializes anyway."""

    def __init__(self, sqlite_path: Path) -> None:
        self._path = sqlite_path
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(str(sqlite_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")

    def query(self, sql: str, params: list[Any] | None = None) -> list[dict]:
        with self._lock:
            cur = self._conn.execute(sql, params or [])
            rows = [dict(r) for r in cur.fetchall()]
            self._conn.commit()
            return rows


def _discover_local_sqlite() -> Path | None:
    """Find the miniflare D1 SQLite file `next dev` / wrangler writes.

    Layout: <repo>/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite
    The sidecar lives at <repo>/sidecar/, so look one level up.
    """
    d1_dir = (
        Path(__file__).resolve().parents[2]
        / ".wrangler"
        / "state"
        / "v3"
        / "d1"
        / "miniflare-D1DatabaseObject"
    )
    if not d1_dir.is_dir():
        return None
    candidates = sorted(
        d1_dir.glob("*.sqlite"), key=lambda p: p.stat().st_mtime, reverse=True
    )
    return candidates[0] if candidates else None


def make_client() -> D1Client:
    if settings.cloudflare_api_token and settings.cloudflare_d1_database_id:
        log.info("D1: using Cloudflare HTTP API client")
        return HttpD1Client(
            settings.cloudflare_account_id,
            settings.cloudflare_d1_database_id,
            settings.cloudflare_api_token,
        )
    path = (
        Path(settings.d1_local_sqlite)
        if settings.d1_local_sqlite
        else _discover_local_sqlite()
    )
    if path is None or not path.exists():
        raise RuntimeError(
            "No D1 configured: set CLOUDFLARE_API_TOKEN + CLOUDFLARE_D1_DATABASE_ID "
            "(+ CLOUDFLARE_ACCOUNT_ID) for production, or D1_LOCAL_SQLITE to "
            "wrangler's local .sqlite file (run `npx wrangler d1 migrations "
            "apply osooly --local` in the repo root first)."
        )
    log.info("D1: using local SQLite at %s", path)
    return LocalD1Client(path)


_client: D1Client | None = None


def client() -> D1Client:
    global _client
    if _client is None:
        _client = make_client()
    return _client
