from sklearn.ensemble import ExtraTreesClassifier, GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

_RS = 42

# Sweep-phase templates: deliberately lean estimator counts so the comparison
# loop stays fast. train.py re-fits the winner on the full training set after
# the sweep, so lowering this number here does not degrade final model quality.
CLASSIFIERS: list[tuple[str, object]] = [
    (
        "RandomForest",
        RandomForestClassifier(n_estimators=100, random_state=_RS, n_jobs=-1),
    ),
    (
        "ExtraTrees",
        ExtraTreesClassifier(n_estimators=100, random_state=_RS, n_jobs=-1),
    ),
    (
        "GradientBoosting",
        # n_iter_no_change + validation_fraction enable early stopping so the model
        # doesn't blindly run all rounds on small datasets and overfit.
        GradientBoostingClassifier(
            n_estimators=150,
            n_iter_no_change=10,
            validation_fraction=0.1,
            tol=1e-4,
            random_state=_RS,
        ),
    ),
    (
        "LogisticRegression",
        Pipeline([
            ("scaler", StandardScaler()),
            ("model", LogisticRegression(max_iter=500, random_state=_RS, n_jobs=-1)),
        ]),
    ),
    (
        "KNN",
        Pipeline([
            ("scaler", StandardScaler()),
            ("model", KNeighborsClassifier(n_neighbors=5, n_jobs=-1)),
        ]),
    ),
]
