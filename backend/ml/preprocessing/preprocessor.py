"""
Data Preprocessing Pipeline for Railway Block Planning Model
Handles feature extraction, encoding, scaling, and transformation for training and inference.
"""

import os
import pandas as pd
import numpy as np
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

NUMERICAL_FEATURES = [
    "work_duration_minutes",
    "candidate_start_minute",
    "candidate_end_minute",
    "train_count_in_window",
    "vip_train_count",
    "freight_train_count",
    "passenger_train_count",
    "max_train_priority",
    "corridor_availability_score",
    "existing_scheduled_blocks_count",
    "other_department_activity",
    "priority_score",
    "historical_avg_delay_minutes"
]

CATEGORICAL_FEATURES = [
    "department",
    "work_type",
    "day_of_week",
    "crew_type_required",
    "equipment_required",
    "maintenance_priority",
    "division"
]

TARGET_COLUMNS = [
    "actual_delay_caused_minutes",
    "actual_affected_trains",
    "block_efficiency_score"
]


def build_preprocessor() -> ColumnTransformer:
    """Creates a ColumnTransformer to normalize numerical features and encode categorical variables."""
    numerical_transformer = Pipeline(steps=[
        ("scaler", StandardScaler())
    ])

    categorical_transformer = Pipeline(steps=[
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False))
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numerical_transformer, NUMERICAL_FEATURES),
            ("cat", categorical_transformer, CATEGORICAL_FEATURES)
        ]
    )
    return preprocessor


def prepare_training_data(df: pd.DataFrame):
    """Prepares X and y matrices from historical block DataFrame."""
    # Ensure all columns present
    for col in NUMERICAL_FEATURES:
        if col not in df.columns:
            df[col] = 0.0
    for col in CATEGORICAL_FEATURES:
        if col not in df.columns:
            df[col] = "UNKNOWN"

    X = df[NUMERICAL_FEATURES + CATEGORICAL_FEATURES].copy()
    y_delay = df["actual_delay_caused_minutes"].values
    y_affected = df["actual_affected_trains"].values
    y_score = df["block_efficiency_score"].values

    return X, y_delay, y_affected, y_score


def extract_features_for_candidate(
    section_dict: dict,
    department: str,
    work_type: str,
    duration_minutes: int,
    date_str: str,
    day_of_week: str,
    start_minute: int,
    trains_in_slot: list,
    availability_score: float,
    priority_str: str,
    priority_score: int,
    crew_type: str,
    equipment: str,
    existing_blocks_count: int = 0,
    other_dept_activity: int = 0,
    hist_avg_delay: float = 4.5
) -> pd.DataFrame:
    """Formats a single candidate slot into a DataFrame matching preprocessor features."""
    end_minute = start_minute + duration_minutes
    train_count = len(trains_in_slot)
    vip_count = sum(1 for t in trains_in_slot if float(t.get("priority_score", 0)) >= 9.0)
    freight_count = sum(1 for t in trains_in_slot if "freight" in str(t.get("train_type", "")).lower())
    passenger_count = train_count - freight_count
    max_prio = max([float(t.get("priority_score", 1.0)) for t in trains_in_slot], default=1.0)

    row = {
        "work_duration_minutes": float(duration_minutes),
        "candidate_start_minute": float(start_minute),
        "candidate_end_minute": float(end_minute),
        "train_count_in_window": float(train_count),
        "vip_train_count": float(vip_count),
        "freight_train_count": float(freight_count),
        "passenger_train_count": float(passenger_count),
        "max_train_priority": float(max_prio),
        "corridor_availability_score": float(availability_score),
        "existing_scheduled_blocks_count": float(existing_blocks_count),
        "other_department_activity": float(other_dept_activity),
        "priority_score": float(priority_score),
        "historical_avg_delay_minutes": float(hist_avg_delay),
        "department": department,
        "work_type": work_type,
        "day_of_week": day_of_week,
        "crew_type_required": crew_type,
        "equipment_required": equipment,
        "maintenance_priority": priority_str,
        "division": section_dict.get("division", "Vijayawada")
    }

    return pd.DataFrame([row])
