"""D1-backed run storage (PRD 3.7): replaces Namtheg's file-based storage.py.

Run state and every renderable artifact (status, the pipeline's JSON reports,
result.json, the plot PNG) live in Osooly's D1 so the /namtheg route and the
run_automl agent tool read the same rows the sidecar writes. Bulky binaries
the pages never fetch directly (dataset.csv, engineered.csv, model.joblib,
y_*.npy) stay on the scratch disk under settings.data_dir; they are compute
inputs, not results.

The function surface mirrors the original storage.py so the ported pipeline
modules changed only their import, plus user-scoping additions (create_run,
run_owner, list_runs) that Namtheg never had.
"""

import base64
import json
import uuid
from pathlib import Path
from typing import Any

from app.config import settings
from app.d1 import client


def new_run_id() -> str:
    return uuid.uuid4().hex[:12]


# ── Scratch disk (compute inputs only) ──────────────────────────────────────


def run_dir(run_id: str) -> Path:
    p = settings.data_dir / "runs" / run_id
    p.mkdir(parents=True, exist_ok=True)
    return p


def dataset_path(run_id: str) -> Path:
    return run_dir(run_id) / "dataset.csv"


def engineered_path(run_id: str) -> Path:
    return run_dir(run_id) / "engineered.csv"


def artifact_path(run_id: str, name: str) -> Path:
    return run_dir(run_id) / name


# ── Run rows ────────────────────────────────────────────────────────────────


def create_run(user_id: str, filename: str) -> str:
    run_id = new_run_id()
    client().query(
        "INSERT INTO namtheg_runs (id, user_id, status, filename) VALUES (?, ?, 'uploaded', ?)",
        [run_id, user_id, filename],
    )
    return run_id


def run_owner(run_id: str) -> str | None:
    rows = client().query(
        "SELECT user_id FROM namtheg_runs WHERE id = ?", [run_id]
    )
    return rows[0]["user_id"] if rows else None


def run_exists(run_id: str, user_id: str | None = None) -> bool:
    owner = run_owner(run_id)
    if owner is None:
        return False
    return user_id is None or owner == user_id


def list_runs(user_id: str, limit: int = 20) -> list[dict]:
    return client().query(
        """SELECT id, status, filename, target, error, created_at, updated_at
           FROM namtheg_runs WHERE user_id = ?
           ORDER BY created_at DESC, id DESC LIMIT ?""",
        [user_id, limit],
    )


def write_status(run_id: str, status: str, **extra: Any) -> None:
    sets = ["status = ?", "updated_at = CURRENT_TIMESTAMP"]
    params: list[Any] = [status]
    for col in ("filename", "target", "error"):
        if col in extra:
            sets.append(f"{col} = ?")
            params.append(extra[col])
    params.append(run_id)
    client().query(
        f"UPDATE namtheg_runs SET {', '.join(sets)} WHERE id = ?", params
    )


def read_status(run_id: str) -> dict:
    rows = client().query(
        "SELECT status, filename, target, error FROM namtheg_runs WHERE id = ?",
        [run_id],
    )
    if not rows:
        return {"status": "unknown"}
    return {k: v for k, v in rows[0].items() if v is not None}


# ── Artifacts (JSON + small binaries, in D1) ────────────────────────────────


def write_json(run_id: str, name: str, payload: Any) -> None:
    client().query(
        """INSERT INTO namtheg_artifacts (run_id, name, content_type, body, is_base64)
           VALUES (?, ?, 'application/json', ?, 0)
           ON CONFLICT (run_id, name) DO UPDATE SET
             body = excluded.body, content_type = excluded.content_type,
             is_base64 = 0, updated_at = CURRENT_TIMESTAMP""",
        [run_id, name, json.dumps(payload, default=str)],
    )


def read_json(run_id: str, name: str) -> Any:
    rows = client().query(
        "SELECT body FROM namtheg_artifacts WHERE run_id = ? AND name = ? AND is_base64 = 0",
        [run_id, name],
    )
    if not rows or rows[0]["body"] is None:
        return None
    return json.loads(rows[0]["body"])


def write_binary(run_id: str, name: str, data: bytes, content_type: str) -> None:
    client().query(
        """INSERT INTO namtheg_artifacts (run_id, name, content_type, body, is_base64)
           VALUES (?, ?, ?, ?, 1)
           ON CONFLICT (run_id, name) DO UPDATE SET
             body = excluded.body, content_type = excluded.content_type,
             is_base64 = 1, updated_at = CURRENT_TIMESTAMP""",
        [run_id, name, content_type, base64.b64encode(data).decode("ascii")],
    )


def read_binary(run_id: str, name: str) -> tuple[bytes, str] | None:
    rows = client().query(
        "SELECT body, content_type FROM namtheg_artifacts WHERE run_id = ? AND name = ? AND is_base64 = 1",
        [run_id, name],
    )
    if not rows or rows[0]["body"] is None:
        return None
    return base64.b64decode(rows[0]["body"]), rows[0]["content_type"]
