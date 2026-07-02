from sklearn.ensemble import ExtraTreesRegressor, GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.neighbors import KNeighborsRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

_RS = 42

# Sweep-phase templates: deliberately lean estimator counts so the comparison
# loop stays fast. train.py re-fits the winner on the full training set after
# the sweep, so lowering this number here does not degrade final model quality.
REGRESSORS: list[tuple[str, object]] = [
    (
        "RandomForest",
        RandomForestRegressor(n_estimators=100, random_state=_RS, n_jobs=-1),
    ),
    (
        "ExtraTrees",
        ExtraTreesRegressor(n_estimators=100, random_state=_RS, n_jobs=-1),
    ),
    (
        "GradientBoosting",
        # n_iter_no_change + validation_fraction enable early stopping so the model
        # doesn't blindly run all rounds on small datasets and overfit.
        GradientBoostingRegressor(
            n_estimators=150,
            n_iter_no_change=10,
            validation_fraction=0.1,
            tol=1e-4,
            random_state=_RS,
        ),
    ),
    (
        "Ridge",
        Pipeline([
            ("scaler", StandardScaler()),
            ("model", Ridge()),
        ]),
    ),
    (
        "KNN",
        Pipeline([
            ("scaler", StandardScaler()),
            ("model", KNeighborsRegressor(n_neighbors=5, n_jobs=-1)),
        ]),
    ),
]
