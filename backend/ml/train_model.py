"""
Model Training & Serialization Pipeline
Trains Gradient Boosting and Random Forest models on historical block planning dataset.
Evaluates on test split and serializes trained artifact using joblib.
"""

import os
import sys
import json
from datetime import datetime
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
import joblib

# Ensure path includes backend and ml
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from preprocessing.preprocessor import (
    build_preprocessor,
    prepare_training_data,
    NUMERICAL_FEATURES,
    CATEGORICAL_FEATURES
)
from evaluation.evaluate import evaluate_all_models
from dataset.generate_historical_dataset import generate_dataset

DATASET_CSV = os.path.join(CURRENT_DIR, "dataset", "historical_block_data.csv")
MODEL_DIR = os.path.join(CURRENT_DIR, "model")
MODEL_PATH = os.path.join(MODEL_DIR, "trained_block_recommender.joblib")
METRICS_PATH = os.path.join(CURRENT_DIR, "evaluation", "metrics.json")
METADATA_PATH = os.path.join(MODEL_DIR, "model_metadata.json")


def train_and_evaluate():
    print("=" * 70)
    print(" RailBlock AI: Training Maintenance Block Planning ML Models")
    print("=" * 70)

    # 1. Ensure dataset exists
    if not os.path.exists(DATASET_CSV):
        print(f"[INFO] Dataset not found at {DATASET_CSV}. Generating synthetic dataset...")
        generate_dataset(3500)

    print(f"[1/5] Loading historical dataset from {DATASET_CSV}...")
    df = pd.read_csv(DATASET_CSV)
    print(f"      Loaded {len(df)} historical block scenarios.")

    # 2. Extract features and targets
    print("[2/5] Preparing feature matrix and target variables...")
    X, y_delay, y_affected, y_score = prepare_training_data(df)

    # Train / Test split (80% train, 20% test)
    X_train, X_test, y_train_d, y_test_d, y_train_a, y_test_a, y_train_s, y_test_s = train_test_split(
        X, y_delay, y_affected, y_score, test_size=0.2, random_state=42
    )
    print(f"      Training set: {len(X_train)} samples | Test set: {len(X_test)} samples")

    # 3. Fit preprocessor
    print("[3/5] Fitting ColumnTransformer preprocessor (StandardScaler + OneHotEncoder)...")
    preprocessor = build_preprocessor()
    X_train_proc = preprocessor.fit_transform(X_train)
    X_test_proc = preprocessor.transform(X_test)
    print(f"      Transformed feature space dimension: {X_train_proc.shape[1]} features.")

    # 4. Train specialized regression models
    print("[4/5] Training machine learning ensemble models...")
    
    print("      -> Training Delay Regressor (GradientBoosting)...")
    delay_model = GradientBoostingRegressor(
        n_estimators=120,
        max_depth=5,
        learning_rate=0.08,
        min_samples_split=4,
        random_state=42
    )
    delay_model.fit(X_train_proc, y_train_d)

    print("      -> Training Affected Trains Estimator (RandomForest)...")
    affected_model = RandomForestRegressor(
        n_estimators=100,
        max_depth=7,
        min_samples_split=4,
        random_state=42
    )
    affected_model.fit(X_train_proc, y_train_a)

    print("      -> Training Optimization Score Predictor (GradientBoosting)...")
    score_model = GradientBoostingRegressor(
        n_estimators=120,
        max_depth=5,
        learning_rate=0.08,
        min_samples_split=4,
        random_state=42
    )
    score_model.fit(X_train_proc, y_train_s)

    # 5. Evaluate on test set
    print("[5/5] Evaluating models on holdout test set...")
    bundle = {
        "preprocessor": preprocessor,
        "delay_model": delay_model,
        "affected_model": affected_model,
        "score_model": score_model,
        "feature_names": NUMERICAL_FEATURES + CATEGORICAL_FEATURES
    }

    metrics = evaluate_all_models(bundle, X_test, y_test_d, y_test_a, y_test_s)
    
    print("-" * 70)
    print(" Evaluation Metrics on Test Set:")
    print(f"  Delay Minutes:     R2 = {metrics['delay_r2']:.4f} | MAE = {metrics['delay_mae']:.2f} min | Within 5min = {metrics['delay_within_tolerance_pct']}%")
    print(f"  Affected Trains:   R2 = {metrics['affected_trains_r2']:.4f} | MAE = {metrics['affected_trains_mae']:.2f} trains | Within 1 train = {metrics['affected_trains_within_tolerance_pct']}%")
    print(f"  Optimization Score:R2 = {metrics['efficiency_score_r2']:.4f} | MAE = {metrics['efficiency_score_mae']:.2f} pts | Within 5pts = {metrics['efficiency_score_within_tolerance_pct']}%")
    print(f"  Overall Ensemble R2:{metrics['overall_r2']:.4f}")
    print("-" * 70)

    # Save models bundle
    os.makedirs(MODEL_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(METRICS_PATH), exist_ok=True)

    bundle_to_save = {
        **bundle,
        "trained_at": datetime.now().isoformat(),
        "total_training_samples": len(X_train),
        "total_test_samples": len(X_test),
        "metrics": metrics,
        "model_version": "1.0.0",
        "dataset_source": "Synthetic Prototype Historical Data"
    }

    joblib.dump(bundle_to_save, MODEL_PATH)
    print(f"[OK] Saved trained model artifact to: {MODEL_PATH}")

    # Save metrics JSON
    with open(METRICS_PATH, mode="w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    print(f"[OK] Saved metrics to: {METRICS_PATH}")

    # Save model metadata JSON
    metadata = {
        "model_name": "RailBlock AI Maintenance Block Time Recommender",
        "version": "1.0.0",
        "trained_at": bundle_to_save["trained_at"],
        "algorithms": {
            "delay_model": "GradientBoostingRegressor(n_estimators=120, max_depth=5)",
            "affected_model": "RandomForestRegressor(n_estimators=100, max_depth=7)",
            "score_model": "GradientBoostingRegressor(n_estimators=120, max_depth=5)"
        },
        "metrics": metrics,
        "input_features": NUMERICAL_FEATURES + CATEGORICAL_FEATURES,
        "dataset": {
            "records": len(df),
            "source": "synthetic_historical_block_data.csv",
            "prototype_safety_disclaimer": "Simulated prototype data. Not real Indian Railways proprietary data. Final authorization required by Human Section Controller."
        }
    }
    with open(METADATA_PATH, mode="w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"[OK] Saved model metadata to: {METADATA_PATH}")

    print("=" * 70)
    print(" Training workflow completed successfully!")
    print("=" * 70)
    return bundle_to_save


if __name__ == "__main__":
    train_and_evaluate()
