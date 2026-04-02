"""
Flight Risk Prediction Router — sklearn-based flight risk scoring for active employees.
"""

from fastapi import APIRouter, Query, HTTPException
import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

from ..data_loader import get_employees, get_history, is_loaded, load_and_process

router = APIRouter()

_model_cache: dict = {}

FEATURE_COLS = [
    "tenure_days",
    "time_in_current_role_days",
    "num_role_changes",
    "num_manager_changes",
    "num_actual_title_changes",
]


def _train_model() -> dict:
    """Train a LogisticRegression on departed vs active employees and cache it."""
    df = get_employees()

    # Build feature matrix — drop rows with NaN in feature columns
    model_df = df[FEATURE_COLS + ["is_active"]].dropna()

    if model_df.empty:
        raise HTTPException(status_code=400, detail="No data available for training")

    departed = model_df[~model_df["is_active"]]
    active = model_df[model_df["is_active"]]

    if len(departed) < 5:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough departed employees to train (found {len(departed)}, need >= 5)",
        )
    if len(active) < 1:
        raise HTTPException(status_code=400, detail="No active employees to score")

    X = model_df[FEATURE_COLS].values
    y = (~model_df["is_active"]).astype(int).values  # 1 = departed, 0 = active

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = LogisticRegression(max_iter=1000, random_state=42)
    model.fit(X_scaled, y)

    _model_cache["model"] = model
    _model_cache["scaler"] = scaler
    _model_cache["trained_at"] = pd.Timestamp.now().isoformat()
    _model_cache["train_samples"] = len(model_df)
    _model_cache["departed_count"] = len(departed)
    _model_cache["active_count"] = len(active)

    return _model_cache


def _ensure_model() -> dict:
    """Return cached model or train a new one."""
    if "model" not in _model_cache:
        _train_model()
    return _model_cache


def compute_flight_risk_sync(top_n: int = 10) -> list[dict] | None:
    """Sync helper for computing flight risk — used by chat context builder."""
    try:
        if not is_loaded():
            return None
        cache = _ensure_model()
        model: LogisticRegression = cache["model"]
        scaler: StandardScaler = cache["scaler"]

        df = get_employees()
        active = df[df["is_active"]].copy()
        if active.empty:
            return None

        features = active[FEATURE_COLS].fillna(0).values
        X_scaled = scaler.transform(features)
        risk_proba = model.predict_proba(X_scaled)
        departed_idx = list(model.classes_).index(1)
        active["risk_score"] = risk_proba[:, departed_idx]
        top = active.nlargest(top_n, "risk_score")

        return [
            {
                "job_title": str(row.get("job_title", "")),
                "department": str(row.get("department_name", "")),
                "risk_score": float(row["risk_score"]),
                "tenure_years": float(row.get("tenure_years", 0)),
                "time_in_current_role_days": int(row.get("time_in_current_role_days", 0)),
            }
            for _, row in top.iterrows()
        ]
    except Exception:
        return None


@router.get("/flight-risk")
async def get_flight_risk(top_n: int = Query(default=20, ge=1, le=500)):
    """Score active employees for flight risk and return top N highest risk."""
    if not is_loaded():
        raise HTTPException(status_code=503, detail="Data not loaded. Upload data first.")

    cache = _ensure_model()
    model: LogisticRegression = cache["model"]
    scaler: StandardScaler = cache["scaler"]

    df = get_employees()
    active = df[df["is_active"]].copy()

    if active.empty:
        return {"employees": [], "total_active": 0}

    # Score active employees
    features = active[FEATURE_COLS].fillna(0).values
    X_scaled = scaler.transform(features)
    risk_proba = model.predict_proba(X_scaled)

    # Column index for class 1 (departed)
    departed_idx = list(model.classes_).index(1)
    active = active.copy()
    active["risk_score"] = risk_proba[:, departed_idx]

    # Sort by risk descending, take top N
    top = active.nlargest(top_n, "risk_score")

    # Build feature importances
    coefficients = model.coef_[0]
    feature_importance = [
        {"feature": name, "coefficient": round(float(coef), 4)}
        for name, coef in sorted(
            zip(FEATURE_COLS, coefficients), key=lambda x: abs(x[1]), reverse=True
        )
    ]

    employees = []
    for _, row in top.iterrows():
        employees.append({
            "pk_person": str(row.get("PK_PERSON", "")),
            "job_title": str(row.get("job_title", "")),
            "department": str(row.get("department_name", "")),
            "business_unit": str(row.get("business_unit_name", "")),
            "country": str(row.get("country", "")),
            "grade": str(row.get("grade_title", "")),
            "tenure_years": float(row.get("tenure_years", 0)),
            "time_in_current_role_days": int(row.get("time_in_current_role_days", 0)),
            "num_role_changes": int(row.get("num_role_changes", 0)),
            "num_manager_changes": int(row.get("num_manager_changes", 0)),
            "num_actual_title_changes": int(row.get("num_actual_title_changes", 0)),
            "risk_score": round(float(row["risk_score"]), 4),
        })

    return {
        "employees": employees,
        "total_active": len(active),
        "model_info": {
            "trained_at": cache.get("trained_at"),
            "train_samples": cache.get("train_samples"),
            "departed_count": cache.get("departed_count"),
            "active_count": cache.get("active_count"),
        },
        "feature_importance": feature_importance,
    }


@router.get("/feature-importance")
async def get_feature_importance():
    """Return feature names and their coefficients from the trained model."""
    if not is_loaded():
        raise HTTPException(status_code=503, detail="Data not loaded. Upload data first.")

    if "model" not in _model_cache:
        raise HTTPException(
            status_code=503,
            detail="Model not trained yet. Call /flight-risk or /retrain first.",
        )

    model: LogisticRegression = _model_cache["model"]
    coefficients = model.coef_[0]
    intercept = float(model.intercept_[0])

    features = [
        {"feature": name, "coefficient": round(float(coef), 4)}
        for name, coef in sorted(
            zip(FEATURE_COLS, coefficients), key=lambda x: abs(x[1]), reverse=True
        )
    ]

    return {
        "features": features,
        "intercept": round(intercept, 4),
        "trained_at": _model_cache.get("trained_at"),
    }


@router.get("/risk-by-department")
async def get_risk_by_department():
    """Return average flight risk score per department for active employees."""
    if not is_loaded():
        raise HTTPException(status_code=503, detail="Data not loaded. Upload data first.")

    if "model" not in _model_cache:
        raise HTTPException(
            status_code=503,
            detail="Model not trained yet. Call /flight-risk or /retrain first.",
        )

    model: LogisticRegression = _model_cache["model"]
    scaler: StandardScaler = _model_cache["scaler"]

    df = get_employees()
    active = df[df["is_active"]].copy()

    if active.empty:
        return {"departments": []}

    features = active[FEATURE_COLS].fillna(0).values
    X_scaled = scaler.transform(features)
    departed_idx = list(model.classes_).index(1)
    active["risk_score"] = model.predict_proba(X_scaled)[:, departed_idx]

    dept_risk = (
        active.groupby("department_name")
        .agg(
            avg_risk_score=("risk_score", "mean"),
            max_risk_score=("risk_score", "max"),
            employee_count=("risk_score", "count"),
            high_risk_count=("risk_score", lambda x: int((x >= 0.7).sum())),
        )
        .reset_index()
        .sort_values("avg_risk_score", ascending=False)
    )

    departments = []
    for _, row in dept_risk.iterrows():
        departments.append({
            "department": str(row["department_name"]),
            "avg_risk_score": round(float(row["avg_risk_score"]), 4),
            "max_risk_score": round(float(row["max_risk_score"]), 4),
            "employee_count": int(row["employee_count"]),
            "high_risk_count": int(row["high_risk_count"]),
        })

    return {"departments": departments}


@router.post("/retrain")
async def retrain_model():
    """Clear the model cache and retrain from scratch."""
    if not is_loaded():
        raise HTTPException(status_code=503, detail="Data not loaded. Upload data first.")

    _model_cache.clear()
    cache = _train_model()

    return {
        "status": "retrained",
        "trained_at": cache.get("trained_at"),
        "train_samples": cache.get("train_samples"),
        "departed_count": cache.get("departed_count"),
        "active_count": cache.get("active_count"),
    }
