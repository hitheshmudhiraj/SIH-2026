"""
Model Evaluation Metrics for Train Block Planning Recommender
Computes R^2, MAE, RMSE, and operational accuracy metrics on test sets.
"""

import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score


def compute_regression_metrics(y_true, y_pred, metric_prefix=""):
    """Calculates R2, MAE, RMSE, and operational tolerance accuracy."""
    mae = float(mean_absolute_error(y_true, y_pred))
    mse = float(mean_squared_error(y_true, y_pred))
    rmse = float(np.sqrt(mse))
    r2 = float(r2_score(y_true, y_pred))

    # Tolerance accuracy within 5 units or 10%
    abs_diff = np.abs(y_true - y_pred)
    within_5_units = float(np.mean(abs_diff <= 5.0) * 100.0)

    prefix = f"{metric_prefix}_" if metric_prefix else ""
    return {
        f"{prefix}mae": round(mae, 3),
        f"{prefix}rmse": round(rmse, 3),
        f"{prefix}r2": round(r2, 4),
        f"{prefix}within_tolerance_pct": round(within_5_units, 2)
    }


def evaluate_all_models(models_bundle: dict, X_test, y_test_delay, y_test_affected, y_test_score) -> dict:
    """Evaluates all three submodels and outputs a consolidated report."""
    preprocessor = models_bundle["preprocessor"]
    delay_model = models_bundle["delay_model"]
    affected_model = models_bundle["affected_model"]
    score_model = models_bundle["score_model"]

    X_test_proc = preprocessor.transform(X_test)

    pred_delay = delay_model.predict(X_test_proc)
    pred_affected = affected_model.predict(X_test_proc)
    pred_score = score_model.predict(X_test_proc)

    metrics_delay = compute_regression_metrics(y_test_delay, pred_delay, "delay")
    metrics_affected = compute_regression_metrics(y_test_affected, pred_affected, "affected_trains")
    metrics_score = compute_regression_metrics(y_test_score, pred_score, "efficiency_score")

    combined = {
        **metrics_delay,
        **metrics_affected,
        **metrics_score,
        "overall_r2": round(float(np.mean([metrics_delay["delay_r2"], metrics_affected["affected_trains_r2"], metrics_score["efficiency_score_r2"]])), 4)
    }
    return combined
