"""Osooly's Namtheg sidecar (PRD 3.7): the ported AutoML pipeline as FastAPI.

Every data endpoint resolves the acting user through the NextAuth session
bridge (app/auth_bridge.py) and scopes run access to that user; run state and
results live in Osooly's D1 (app/storage_d1.py). The Next.js app talks to
this service through its /api/namtheg proxy, and card agents call it
directly with the internal service token (the run_automl tool).

Namtheg's Modal deployment step was dropped in the port: /runs/{id}/predict
serves the trained bundle in process, so upload -> preview -> running ->
result -> inference needs nothing beyond this service and D1.
"""

import json as _json
import logging

import joblib
import pandas as pd
from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, Request, Response, UploadFile

from app import storage_d1 as storage
from app.agent.orchestrator import run_agent
from app.auth_bridge import current_user_id
from app.config import settings
from app.schemas import StartRunRequest

logging.basicConfig(level=settings.log_level)
log = logging.getLogger("osooly-namtheg")

app = FastAPI(title="Osooly Namtheg sidecar", version="0.1.0")

# No CORS middleware on purpose: the browser only reaches this service through
# the same-origin Next.js proxy (or the production reverse proxy on the same
# domain), so cross-origin grants would only widen the attack surface.


@app.api_route("/health", methods=["GET", "HEAD"])
def health() -> dict:
    return {
        "status": "ok",
        "llm_configured": bool(settings.openrouter_api_key),
        "llm_provider": "openrouter",
        "llm_model": settings.openrouter_model,
    }


def _require_run(run_id: str, user_id: str) -> None:
    if not storage.run_exists(run_id, user_id):
        raise HTTPException(404, "run_id not found")


@app.get("/runs")
def list_runs(user_id: str = Depends(current_user_id)) -> dict:
    return {"runs": storage.list_runs(user_id)}


@app.post("/upload")
async def upload_csv(
    file: UploadFile = File(...), user_id: str = Depends(current_user_id)
) -> dict:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only .csv files are accepted.")
    run_id = storage.create_run(user_id, file.filename)
    dest = storage.dataset_path(run_id)

    MAX_SIZE = 30 * 1024 * 1024  # 30 MB cap
    total_bytes = 0
    try:
        with dest.open("wb") as f:
            while chunk := await file.read(1024 * 1024):
                total_bytes += len(chunk)
                if total_bytes > MAX_SIZE:
                    f.close()  # close the handle before deleting
                    if dest.exists():
                        dest.unlink()
                    raise HTTPException(413, "File too large. Maximum size allowed is 30 MB.")
                f.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        if dest.exists():
            dest.unlink()
        raise HTTPException(500, f"Failed to save file: {e}")

    try:
        df = pd.read_csv(dest, nrows=5)
    except Exception as e:
        if dest.exists():
            dest.unlink()
        raise HTTPException(400, f"Could not parse CSV: {e}")
    try:
        # Roundtrip through pandas' JSON writer to safely handle NaN, Inf,
        # Timestamps and numpy scalar types that the default encoder rejects.
        columns = [str(c) for c in df.columns.tolist()]
        preview = _json.loads(df.to_json(orient="records", date_format="iso"))
        return {
            "run_id": run_id,
            "filename": file.filename,
            "columns": columns,
            "preview": preview,
        }
    except Exception as e:
        log.exception("Upload post-processing failed for run %s", run_id)
        if dest.exists():
            dest.unlink()
        raise HTTPException(500, f"Upload post-processing failed: {e}")


@app.get("/runs/{run_id}/preview")
def preview(run_id: str, user_id: str = Depends(current_user_id)) -> dict:
    _require_run(run_id, user_id)
    if not storage.dataset_path(run_id).exists():
        raise HTTPException(
            409, "Dataset no longer on the compute node; upload it again."
        )
    df = pd.read_csv(storage.dataset_path(run_id), nrows=20)
    status_data = storage.read_status(run_id)
    filename = status_data.get("filename", "dataset.csv")
    columns = [str(c) for c in df.columns.tolist()]
    preview_rows = _json.loads(df.to_json(orient="records", date_format="iso"))
    return {
        "run_id": run_id,
        "filename": filename,
        "n_columns": int(df.shape[1]),
        "columns": columns,
        "preview": preview_rows,
    }


@app.post("/runs/{run_id}/start")
def start_run(
    run_id: str,
    req: StartRunRequest,
    background: BackgroundTasks,
    user_id: str = Depends(current_user_id),
) -> dict:
    _require_run(run_id, user_id)
    if not storage.dataset_path(run_id).exists():
        raise HTTPException(
            409, "Dataset no longer on the compute node; upload it again."
        )
    df = pd.read_csv(storage.dataset_path(run_id), nrows=1)
    if req.target not in df.columns:
        raise HTTPException(400, f"Target '{req.target}' not in columns: {df.columns.tolist()}")
    storage.write_status(run_id, "queued", target=req.target)
    background.add_task(run_agent, run_id, req.target)
    return {"run_id": run_id, "status": "queued", "target": req.target}


@app.get("/runs/{run_id}/status")
def status(run_id: str, user_id: str = Depends(current_user_id)) -> dict:
    _require_run(run_id, user_id)
    return {"run_id": run_id, **storage.read_status(run_id)}


@app.get("/runs/{run_id}/result")
def result(run_id: str, user_id: str = Depends(current_user_id)) -> dict:
    _require_run(run_id, user_id)
    result = storage.read_json(run_id, "result.json")
    if result is None:
        raise HTTPException(409, "Run has not produced a result yet.")
    return result


@app.get("/runs/{run_id}/plot")
def plot(run_id: str, user_id: str = Depends(current_user_id)) -> Response:
    _require_run(run_id, user_id)
    stored = storage.read_binary(run_id, "plot.png")
    if stored is None:
        raise HTTPException(404, "Plot not yet generated.")
    data, content_type = stored
    return Response(content=data, media_type=content_type)


@app.get("/runs/{run_id}/model_schema")
def model_schema(run_id: str, user_id: str = Depends(current_user_id)) -> dict:
    _require_run(run_id, user_id)
    bundle_path = storage.artifact_path(run_id, "model.joblib")
    if not bundle_path.exists():
        raise HTTPException(409, "No trained model - finish a successful run first.")
    bundle = joblib.load(bundle_path)

    # First engineered row gives a realistic baseline for the predict form.
    sample: dict = {}
    eng_path = storage.engineered_path(run_id)
    if eng_path.exists():
        row = pd.read_csv(eng_path, nrows=1)
        target = storage.read_status(run_id).get("target")
        for c in bundle["feature_cols"]:
            if c in row.columns:
                val = row.iloc[0][c]
                # Cast numpy scalars to plain JSON-safe types.
                if pd.isna(val):
                    sample[c] = None
                elif hasattr(val, "item"):
                    sample[c] = val.item()
                else:
                    sample[c] = val
        # paranoia: never leak the target column
        sample.pop(target, None)

    return {
        "run_id": run_id,
        "model_name": bundle.get("model_name"),
        "problem_type": bundle.get("problem_type"),
        "feature_cols": bundle["feature_cols"],
        "class_labels": bundle.get("class_labels"),
        "sample": sample,
    }


@app.post("/runs/{run_id}/predict")
async def predict(
    run_id: str, request: Request, user_id: str = Depends(current_user_id)
) -> dict:
    """Serve a prediction from the run's trained bundle, in process.

    Same request/response contract as Namtheg's Modal endpoint (features
    object or rows array in, predictions/labels/probabilities out) so the
    ported UI did not have to change shape.
    """
    _require_run(run_id, user_id)
    bundle_path = storage.artifact_path(run_id, "model.joblib")
    if not bundle_path.exists():
        raise HTTPException(
            409,
            "Model is not available on the compute node; finish a successful run first.",
        )
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(400, "Body must be JSON.")

    bundle = joblib.load(bundle_path)
    model = bundle["model"]
    feature_cols = bundle["feature_cols"]
    problem_type = bundle["problem_type"]
    model_name = bundle.get("model_name", "model")
    class_labels = bundle.get("class_labels")

    if isinstance(payload, dict) and isinstance(payload.get("features"), dict):
        row = {c: payload["features"].get(c) for c in feature_cols}
        df = pd.DataFrame([row], columns=feature_cols)
    elif isinstance(payload, dict) and isinstance(payload.get("rows"), list):
        try:
            df = pd.DataFrame(payload["rows"], columns=feature_cols)
        except Exception as e:
            raise HTTPException(
                400,
                f"Each row must have {len(feature_cols)} values in the order "
                f"returned by /model_schema. {e}",
            )
    else:
        raise HTTPException(
            400,
            "Provide either 'features' (object of column->value) or 'rows' "
            "(array of arrays). Call /model_schema for the expected columns.",
        )

    try:
        preds = model.predict(df)
        preds_list = preds.tolist() if hasattr(preds, "tolist") else list(preds)
        result: dict = {"predictions": preds_list, "model": model_name}

        if problem_type == "classification":
            if class_labels:
                result["predicted_labels"] = [
                    class_labels[int(p)] if 0 <= int(p) < len(class_labels) else None
                    for p in preds_list
                ]
            if hasattr(model, "predict_proba"):
                probs = model.predict_proba(df)
                result["probabilities"] = probs.tolist()
                if class_labels:
                    result["class_labels"] = list(class_labels)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Prediction failed: {e}")
