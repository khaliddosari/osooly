"""NextAuth session bridge (PRD 3.7): no separate login, no separate OAuth.

Osooly stores sessions in D1 with NextAuth's database strategy, so the
cookie value IS the sessions.sessionToken row key. The Next.js /api/namtheg
proxy forwards the browser's Cookie header; we look the token up in the
shared D1 and the request acts as that user.

Server-to-server callers (the run_automl agent tool) have no cookie; they
authenticate with the shared NAMTHEG_INTERNAL_TOKEN plus an explicit
X-Osooly-User-Id. The internal path is disabled unless the token is set.
"""

import hmac
import logging
from datetime import datetime, timezone

from fastapi import HTTPException, Request

from app.config import settings
from app.d1 import client

log = logging.getLogger(__name__)


def _parse_expires(raw: object) -> datetime | None:
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        # Auth.js may store epoch milliseconds depending on adapter version.
        seconds = float(raw) / (1000 if raw > 1e12 else 1)
        return datetime.fromtimestamp(seconds, tz=timezone.utc)
    text = str(raw).strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _session_user(token: str) -> str | None:
    rows = client().query(
        "SELECT userId, expires FROM sessions WHERE sessionToken = ?", [token]
    )
    if not rows:
        return None
    expires = _parse_expires(rows[0].get("expires"))
    if expires is not None and expires <= datetime.now(timezone.utc):
        return None
    return rows[0]["userId"]


def current_user_id(request: Request) -> str:
    """FastAPI dependency: resolve the acting user or raise 401."""
    internal = request.headers.get("x-osooly-internal-token")
    if internal and settings.namtheg_internal_token:
        if not hmac.compare_digest(internal, settings.namtheg_internal_token):
            raise HTTPException(401, "Invalid internal token.")
        user_id = request.headers.get("x-osooly-user-id", "").strip()
        if not user_id:
            raise HTTPException(401, "X-Osooly-User-Id required with internal token.")
        return user_id

    for name in settings.session_cookie_names:
        token = request.cookies.get(name)
        if token:
            user_id = _session_user(token)
            if user_id:
                return user_id

    raise HTTPException(401, "Sign in to Osooly to use Namtheg.")
