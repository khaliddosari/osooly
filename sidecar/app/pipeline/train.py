import logging

import joblib
import numpy as np
import pandas as pd
from pandas.api.types import is_numeric_dtype
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    r2_score,
    root_mean_squared_error,
)
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder, StandardScaler
from sklearn.ensemble import ExtraTreesClassifier, GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import ExtraTreesRegressor, GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.neighbors import KNeighborsRegressor

from app import storage_d1 as storage
from app.pipeline.models.classifiers import CLASSIFIERS
from app.pipeline.models.regressors import REGRESSORS

log = logging.getLogger(__name__)

ONE_HOT_MAX_CARDINALITY = 10

RANDOM_STATE = 42


def _inner_estimator(model):
    """Walk past any Pipeline wrapping and return the underlying estimator."""
    while isinstance(model, Pipeline):
        model = model.steps[-1][1]
    return model


def _build_preprocessor(X: pd.DataFrame) -> ColumnTransformer:
    """Build a ColumnTransformer that imputes and encodes per column type.

    Numeric: median imputation. Low-cardinality categoricals: most-frequent
    imputation + one-hot. High-cardinality categoricals: most-frequent
    imputation + ordinal encoding. Unknown categories at inference time map
    to -1 (ordinal) or all-zero (one-hot), so the predict endpoint won't
    crash on previously-unseen values.
    """
    numeric_cols: list[str] = []
    one_hot_cols: list[str] = []
    ordinal_cols: list[str] = []

    for c in X.columns:
        if is_numeric_dtype(X[c]):
            numeric_cols.append(c)
        elif X[c].nunique(dropna=True) <= ONE_HOT_MAX_CARDINALITY:
            one_hot_cols.append(c)
        else:
            ordinal_cols.append(c)

    transformers: list = []
    if numeric_cols:
        transformers.append(("num", SimpleImputer(strategy="median"), numeric_cols))
    if one_hot_cols:
        transformers.append((
            "cat_low",
            Pipeline([
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False, drop="if_binary")),
            ]),
            one_hot_cols,
        ))
    if ordinal_cols:
        transformers.append((
            "cat_high",
            Pipeline([
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("encoder", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)),
            ]),
            ordinal_cols,
        ))

    return ColumnTransformer(transformers, remainder="drop")


def _wrap_with_preprocessor(X: pd.DataFrame, template):
    """Prepend a ColumnTransformer so imputation+encoding re-fit per CV fold."""
    preprocessor = _build_preprocessor(X)
    if isinstance(template, Pipeline):
        # Existing pipelines (LogReg/KNN) include an inner scaler+model; insert
        # the preprocessor first and keep the rest as a flat pipeline.
        return Pipeline([("preprocessor", preprocessor)] + list(template.steps))
    return Pipeline([("preprocessor", preprocessor), ("model", template)])


def save_model_bundle(
    run_id: str,
    model,
    feature_cols: list[str],
    problem_type: str,
    model_name: str,
    class_labels: list | None,
) -> None:
    """Pickle the fitted Pipeline (imputer + model) for the predict endpoint.

    The bundle stores a single sklearn Pipeline that handles imputation and
    prediction in one step; /runs/{id}/predict just calls model.predict(df)
    on raw input.
    """
    bundle = {
        "model": model,
        "feature_cols": feature_cols,
        "problem_type": problem_type,
        "model_name": model_name,
        "class_labels": class_labels,
    }
    joblib.dump(bundle, storage.run_dir(run_id) / "model.joblib")


def _feature_importances(model, columns: list[str]) -> list[dict]:
    """Extract top-10 feature importances from tree or linear models.

    Maps onto the *post-encoding* column names (one-hot expansion), pulled
    from the fitted preprocessor when available, so each dummy column shows
    up with its own importance instead of being silently aliased to the raw
    column name.
    """
    est = _inner_estimator(model)
    if hasattr(est, "feature_importances_"):
        imps = np.array(est.feature_importances_)
    elif hasattr(est, "coef_"):
        coef = np.array(est.coef_)
        imps = np.abs(coef[0] if coef.ndim > 1 else coef)
    else:
        return []

    expanded_cols: list[str] = list(columns)
    if isinstance(model, Pipeline):
        try:
            expanded_cols = list(model[:-1].get_feature_names_out())
        except Exception:
            pass
    if len(expanded_cols) != len(imps):
        expanded_cols = [f"feature_{i}" for i in range(len(imps))]

    pairs = sorted(zip(expanded_cols, imps.tolist()), key=lambda kv: kv[1], reverse=True)[:10]
    return [{"feature": f, "importance": round(float(i), 4)} for f, i in pairs]


def train_model(run_id: str, target: str, problem_type: str) -> dict:
    """Train all candidate models locally and save artifacts.

    Namtheg's optional Modal offload was dropped in the port (PRD 3.7): the
    sidecar is already a dedicated compute service, so training runs in
    process and the deploy story stays inside Osooly's own hosting.
    """
    df = pd.read_csv(storage.engineered_path(run_id))
    if target not in df.columns:
        raise ValueError(f"Target '{target}' missing from engineered dataset.")

    X = df.drop(columns=[target])
    y = df[target]
    feature_cols = X.columns.tolist()

    class_labels: list | None = None
    if problem_type == "classification":
        if not np.issubdtype(y.dtype, np.number):
            y, labels = pd.factorize(y)
            class_labels = labels.tolist()

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=RANDOM_STATE,
            stratify=y if len(np.unique(y)) > 1 else None,
        )
        # NOTE: no upfront imputation; each candidate is a Pipeline that imputes
        # internally, so CV folds and final fit/predict all impute on train rows only.

        # CV fold count bounded by smallest class size to avoid stratification errors.
        min_class_count = int(np.bincount(y_train.astype(int)).min())
        n_splits = max(2, min(5, min_class_count))

        # Sweep: rank all candidates by CV only. Each template is cloned so
        # module-level definitions are never mutated and concurrent runs don't
        # corrupt each other.
        all_scores: list[dict] = []
        best_name, best_template, best_cv_mean = None, None, -1.0

        for name, template in CLASSIFIERS:
            pipe = _wrap_with_preprocessor(X_train, clone(template))
            cv = cross_val_score(pipe, X_train, y_train, cv=n_splits, scoring="accuracy", n_jobs=-1)
            all_scores.append({
                "name": name,
                "cv_mean": round(float(cv.mean()), 4),
                "cv_std": round(float(cv.std()), 4),
            })
            if cv.mean() > best_cv_mean:
                best_cv_mean = float(cv.mean())
                best_name = name
                best_template = template

        # Single final fit of the winner on the full training set.
        # Must wrap with preprocessor again: best_template is the raw estimator.
        best_model = _wrap_with_preprocessor(X_train, clone(best_template))
        best_model.fit(X_train, y_train)

        preds = best_model.predict(X_test)
        best_test_acc = float(accuracy_score(y_test, preds))
        train_acc = float(accuracy_score(y_train, best_model.predict(X_train)))
        f1m = float(f1_score(y_test, preds, average="macro", zero_division=0))

        metrics = {
            "model_name": best_name,
            "score": best_test_acc,
            "score_metric": "accuracy",
            "extra": {
                "train_accuracy": train_acc,
                "overfit_gap": round(train_acc - best_test_acc, 4),
                "f1_macro": f1m,
                "cv_accuracy_mean": round(best_cv_mean, 4),
                "n_classes": int(len(np.unique(y))),
                "test_size": int(len(y_test)),
                "all_models": sorted(all_scores, key=lambda x: x["cv_mean"], reverse=True),
            },
        }
        np.save(storage.run_dir(run_id) / "y_test.npy", y_test)
        np.save(storage.run_dir(run_id) / "y_pred.npy", preds)

    else:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=RANDOM_STATE,
        )
        # NOTE: no upfront imputation; see classification branch above.

        # Cap CV folds by training set size to avoid degenerate folds on tiny datasets.
        n_splits = max(2, min(5, len(X_train) // 10))

        all_scores: list[dict] = []
        best_name, best_template, best_cv_mean = None, None, float("-inf")

        for name, template in REGRESSORS:
            pipe = _wrap_with_preprocessor(X_train, clone(template))
            cv = cross_val_score(pipe, X_train, y_train, cv=n_splits, scoring="r2", n_jobs=-1)
            all_scores.append({
                "name": name,
                "cv_mean": round(float(cv.mean()), 4),
                "cv_std": round(float(cv.std()), 4),
            })
            if cv.mean() > best_cv_mean:
                best_cv_mean = float(cv.mean())
                best_name = name
                best_template = template

        best_model = _wrap_with_preprocessor(X_train, clone(best_template))
        best_model.fit(X_train, y_train)

        preds = best_model.predict(X_test)
        best_test_r2 = float(r2_score(y_test, preds))
        train_r2 = float(r2_score(y_train, best_model.predict(X_train)))
        rmse = float(root_mean_squared_error(y_test, preds))
        mae = float(mean_absolute_error(y_test, preds))

        metrics = {
            "model_name": best_name,
            "score": best_test_r2,
            "score_metric": "r2",
            "extra": {
                "train_r2": train_r2,
                "overfit_gap": round(train_r2 - best_test_r2, 4),
                "rmse": rmse,
                "mae": mae,
                "cv_r2_mean": round(best_cv_mean, 4),
                "test_size": int(len(y_test)),
                "all_models": sorted(all_scores, key=lambda x: x["cv_mean"], reverse=True),
            },
        }
        np.save(storage.run_dir(run_id) / "y_test.npy", np.asarray(y_test))
        np.save(storage.run_dir(run_id) / "y_pred.npy", preds)

    metrics["extra"]["top_features"] = _feature_importances(best_model, feature_cols)
    storage.write_json(run_id, "metrics.json", metrics)
    save_model_bundle(
        run_id,
        model=best_model,
        feature_cols=feature_cols,
        problem_type=problem_type,
        model_name=best_name,
        class_labels=class_labels,
    )
    return metrics


def get_classifier(model_name: str, params: dict):
    rs = 42
    if model_name == "RandomForest":
        return RandomForestClassifier(
            n_estimators=int(params.get("n_estimators", 200)),
            max_depth=params.get("max_depth", None),
            min_samples_split=int(params.get("min_samples_split", 2)),
            random_state=rs,
            n_jobs=-1
        )
    elif model_name == "ExtraTrees":
        return ExtraTreesClassifier(
            n_estimators=int(params.get("n_estimators", 200)),
            max_depth=params.get("max_depth", None),
            random_state=rs,
            n_jobs=-1
        )
    elif model_name == "GradientBoosting":
        return GradientBoostingClassifier(
            n_estimators=int(params.get("n_estimators", 200)),
            learning_rate=float(params.get("learning_rate", 0.1)),
            max_depth=int(params.get("max_depth", 3)),
            n_iter_no_change=10,
            validation_fraction=0.1,
            tol=1e-4,
            random_state=rs
        )
    elif model_name == "LogisticRegression":
        return Pipeline([
            ("scaler", StandardScaler()),
            ("model", LogisticRegression(
                C=float(params.get("C", 1.0)),
                max_iter=1000,
                random_state=rs,
                n_jobs=-1
            ))
        ])
    elif model_name == "KNN":
        return Pipeline([
            ("scaler", StandardScaler()),
            ("model", KNeighborsClassifier(
                n_neighbors=int(params.get("n_neighbors", 5)),
                weights=params.get("weights", "uniform"),
                n_jobs=-1
            ))
        ])
    else:
        raise ValueError(f"Unknown classifier model_name: {model_name}")


def get_regressor(model_name: str, params: dict):
    rs = 42
    if model_name == "RandomForest":
        return RandomForestRegressor(
            n_estimators=int(params.get("n_estimators", 200)),
            max_depth=params.get("max_depth", None),
            min_samples_split=int(params.get("min_samples_split", 2)),
            random_state=rs,
            n_jobs=-1
        )
    elif model_name == "ExtraTrees":
        return ExtraTreesRegressor(
            n_estimators=int(params.get("n_estimators", 200)),
            max_depth=params.get("max_depth", None),
            random_state=rs,
            n_jobs=-1
        )
    elif model_name == "GradientBoosting":
        return GradientBoostingRegressor(
            n_estimators=int(params.get("n_estimators", 200)),
            learning_rate=float(params.get("learning_rate", 0.1)),
            max_depth=int(params.get("max_depth", 3)),
            n_iter_no_change=10,
            validation_fraction=0.1,
            tol=1e-4,
            random_state=rs
        )
    elif model_name == "Ridge":
        return Pipeline([
            ("scaler", StandardScaler()),
            ("model", Ridge(alpha=float(params.get("alpha", 1.0))))
        ])
    elif model_name == "KNN":
        return Pipeline([
            ("scaler", StandardScaler()),
            ("model", KNeighborsRegressor(
                n_neighbors=int(params.get("n_neighbors", 5)),
                weights=params.get("weights", "uniform"),
                n_jobs=-1
            ))
        ])
    else:
        raise ValueError(f"Unknown regressor model_name: {model_name}")


def train_champion_with_params(run_id: str, target: str, problem_type: str, model_name: str, params: dict) -> dict:
    df = pd.read_csv(storage.engineered_path(run_id))
    if target not in df.columns:
        raise ValueError(f"Target '{target}' missing from engineered dataset.")

    X = df.drop(columns=[target])
    y = df[target]
    feature_cols = X.columns.tolist()

    class_labels: list | None = None
    if problem_type == "classification":
        if not np.issubdtype(y.dtype, np.number):
            y, labels = pd.factorize(y)
            class_labels = labels.tolist()

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=RANDOM_STATE,
            stratify=y if len(np.unique(y)) > 1 else None,
        )

        min_class_count = int(np.bincount(y_train.astype(int)).min())
        n_splits = max(2, min(5, min_class_count))

        model = _wrap_with_preprocessor(X_train, get_classifier(model_name, params))
        cv = cross_val_score(clone(model), X_train, y_train, cv=n_splits, scoring="accuracy", n_jobs=-1)
        model.fit(X_train, y_train)
        test_acc = float(accuracy_score(y_test, model.predict(X_test)))
        cv_mean = float(cv.mean())
        cv_std = float(cv.std())

        return {
            "cv_mean": round(cv_mean, 4),
            "cv_std": round(cv_std, 4),
            "test_score": round(test_acc, 4),
            "model": model,
            "feature_cols": feature_cols,
            "class_labels": class_labels,
            "y_test": y_test,
            "preds": model.predict(X_test),
            "train_score": float(accuracy_score(y_train, model.predict(X_train))),
            "f1_macro": float(f1_score(y_test, model.predict(X_test), average="macro", zero_division=0)),
            "n_classes": int(len(np.unique(y))),
            "test_size": int(len(y_test))
        }
    else:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=RANDOM_STATE,
        )

        n_splits = max(2, min(5, len(X_train) // 10))

        model = _wrap_with_preprocessor(X_train, get_regressor(model_name, params))
        cv = cross_val_score(clone(model), X_train, y_train, cv=n_splits, scoring="r2", n_jobs=-1)
        model.fit(X_train, y_train)
        test_r2 = float(r2_score(y_test, model.predict(X_test)))
        cv_mean = float(cv.mean())
        cv_std = float(cv.std())

        return {
            "cv_mean": round(cv_mean, 4),
            "cv_std": round(cv_std, 4),
            "test_score": round(test_r2, 4),
            "model": model,
            "feature_cols": feature_cols,
            "class_labels": None,
            "y_test": y_test,
            "preds": model.predict(X_test),
            "train_score": float(r2_score(y_train, model.predict(X_train))),
            "rmse": float(root_mean_squared_error(y_test, model.predict(X_test))),
            "mae": float(mean_absolute_error(y_test, model.predict(X_test))),
            "test_size": int(len(y_test))
        }
