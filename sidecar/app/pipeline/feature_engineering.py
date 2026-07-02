import pandas as pd
from pandas.api.types import is_numeric_dtype

from app import storage_d1 as storage


HIGH_MISSING_THRESHOLD = 0.5
ONE_HOT_MAX_CARDINALITY = 10


def feature_engineer(run_id: str, target: str) -> dict:
    """Filter columns/rows and emit a ready-but-unencoded engineered.csv.

    Structural decisions live here (drop high-missing columns, drop id-like
    columns, drop rows with a missing target). Encoding is intentionally
    deferred to the training pipeline so each CV fold fits its own encoders
    on its own train portion; that closes the encoder-leakage source and
    lets the inference endpoint accept raw inputs (the Pipeline encodes
    them internally before predicting).
    """
    df = pd.read_csv(storage.dataset_path(run_id))
    if target not in df.columns:
        raise ValueError(f"Target column '{target}' not found.")

    dropped: list[str] = []
    planned_encodings: list[str] = []

    # 1. Drop columns with too many missing values (excluding target).
    for c in list(df.columns):
        if c == target:
            continue
        if df[c].isna().mean() > HIGH_MISSING_THRESHOLD:
            df = df.drop(columns=[c])
            dropped.append(f"{c} (>{int(HIGH_MISSING_THRESHOLD*100)}% missing)")

    # 2. Drop rows where target is missing (must precede ID-like check so n is correct).
    df = df.dropna(subset=[target]).reset_index(drop=True)
    n = len(df)

    # 3. Drop ID-like columns (>=95% unique values).
    # Numeric dtypes are intentionally exempt: continuous floats on small
    # datasets naturally hit ~100% uniqueness and would otherwise be wiped
    # out as if they were identifiers.
    for c in list(df.columns):
        if c == target:
            continue
        if is_numeric_dtype(df[c]):
            continue
        if df[c].nunique(dropna=True) >= 0.95 * n:
            df = df.drop(columns=[c])
            dropped.append(f"{c} (id-like)")

    # 4. Record the encoding plan. The actual encoders are fit by the training
    # pipeline, not here; see app/pipeline/train.py:_build_preprocessor.
    for c in df.columns:
        if c == target or is_numeric_dtype(df[c]):
            continue
        cardinality = df[c].nunique(dropna=True)
        if cardinality <= ONE_HOT_MAX_CARDINALITY:
            planned_encodings.append(f"{c} (will be one-hot, {cardinality} levels)")
        else:
            planned_encodings.append(f"{c} (will be ordinal, {cardinality} levels)")

    df.to_csv(storage.engineered_path(run_id), index=False)
    report = {
        "dropped_columns": dropped,
        "encoded_columns": planned_encodings,
        "final_feature_count": int(df.shape[1] - 1),
        "final_row_count": int(len(df)),
    }
    storage.write_json(run_id, "feature_engineering.json", report)
    return report
