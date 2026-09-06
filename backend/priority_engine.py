import numpy as np
from typing import Dict, Any, Tuple, List
from sklearn.linear_model import LogisticRegression


class PriorityEngine:
    def __init__(self):
        # Train an interpretable Logistic Regression model for Predicted Failure Probability
        self.ml_model = LogisticRegression()
        self._train_calibrated_ml_model()

    def _train_calibrated_ml_model(self):
        """
        Trains an interpretable classifier on synthetic historical failure data.
        Features:
        [asset_age_years, past_defects_count, overdue_ratio, gmt_density, days_since_last_inspection]
        Target:
        1 if asset experienced in-service failure within 30 days, else 0
        """
        np.random.seed(42)
        n_samples = 400
        
        # Synthetic realistic feature distributions
        asset_age = np.random.uniform(1, 35, n_samples)
        past_defects = np.random.poisson(2.5, n_samples)
        overdue_ratio = np.random.uniform(0, 3.0, n_samples)
        gmt_density = np.random.uniform(10, 80, n_samples)
        days_since_insp = np.random.uniform(10, 365, n_samples)
        
        X = np.column_stack([asset_age, past_defects, overdue_ratio, gmt_density, days_since_insp])
        
        # Ground truth failure risk logit
        z = (
            -3.5 
            + 0.04 * asset_age 
            + 0.45 * past_defects 
            + 0.70 * overdue_ratio 
            + 0.02 * gmt_density 
            + 0.005 * days_since_insp
        )
        prob = 1.0 / (1.0 + np.exp(-z))
        y = (prob > 0.45).astype(int)
        
        self.ml_model.fit(X, y)

    def predict_failure_probability(self, asset_age: float, past_defects: int, overdue_days: int, gmt: float, days_since_insp: int = 90) -> float:
        overdue_ratio = max(0.0, overdue_days / 30.0)
        X_sample = np.array([[asset_age, past_defects, overdue_ratio, gmt, days_since_insp]])
        prob = float(self.ml_model.predict_proba(X_sample)[0][1])
        return round(prob, 3)

    def compute_priority(self, work_item: Dict[str, Any]) -> Tuple[int, str, Dict[str, float], List[str]]:
        """
        Transparent 7-factor explainable scoring model.
        Max score = 100 points.
        
        Factor Weights:
        1. Safety Risk: max 25 points
        2. Asset Criticality: max 20 points
        3. Overdue Days: max 15 points
        4. Failure History: max 15 points
        5. Predicted Failure Probability (ML): max 15 points
        6. Traffic Density (Corridor GMT): max 10 points
        7. Deferral Consequence: max 10 points
        """
        justifications = []

        # 1. Safety Risk (0 to 25 pts)
        raw_safety = work_item.get("safety_risk_rating", 15)  # scale 0 to 25
        safety_score = min(25.0, max(0.0, float(raw_safety)))
        if safety_score >= 20:
            justifications.append(f"High safety hazard ({safety_score:.0f}/25 pts) - immediate structural/derailment prevention risk.")
        elif safety_score >= 12:
            justifications.append(f"Moderate safety impact ({safety_score:.0f}/25 pts) - standard statutory precaution required.")

        # 2. Asset Criticality (0 to 20 pts)
        raw_asset_crit = work_item.get("asset_criticality_rating", 12)  # scale 0 to 20
        asset_crit_score = min(20.0, max(0.0, float(raw_asset_crit)))
        if asset_crit_score >= 16:
            justifications.append(f"Critical asset node ({asset_crit_score:.0f}/20 pts) on primary trunk route / turnout junction.")

        # 3. Overdue Days (0 to 15 pts)
        overdue_days = work_item.get("overdue_days", 0)
        # 0 days = 0 pts; 1-7 days = 6 pts; 8-14 days = 10 pts; 15-30 days = 13 pts; >30 days = 15 pts
        if overdue_days <= 0:
            overdue_score = 0.0
        elif overdue_days <= 7:
            overdue_score = 6.0
        elif overdue_days <= 14:
            overdue_score = 10.0
        elif overdue_days <= 30:
            overdue_score = 13.0
        else:
            overdue_score = 15.0
            
        if overdue_days > 0:
            justifications.append(f"Statutory schedule overdue by {overdue_days} days (+{overdue_score:.0f}/15 pts).")

        # 4. Failure History (0 to 15 pts)
        history_count = work_item.get("failure_history_count", 0)
        # 0 = 0 pts; 1 = 5 pts; 2 = 8 pts; 3 = 11 pts; >=4 = 15 pts
        if history_count == 0:
            history_score = 0.0
        elif history_count == 1:
            history_score = 5.0
        elif history_count == 2:
            history_score = 8.0
        elif history_count == 3:
            history_score = 11.0
        else:
            history_score = 15.0

        if history_count >= 2:
            justifications.append(f"Asset has recurrent defect history ({history_count} previous incidents in 12 months, +{history_score:.0f}/15 pts).")

        # 5. Predicted Failure Probability (ML calibrated, 0 to 15 pts)
        fail_prob = work_item.get("failure_probability", 0.25)
        # Scale 0.0 - 1.0 to 0 - 15 pts
        prob_score = round(min(15.0, max(0.0, fail_prob * 15.0)), 1)
        if fail_prob >= 0.70:
            justifications.append(f"ML predictive failure model indicates high failure likelihood of {fail_prob*100:.0f}% (+{prob_score:.0f}/15 pts).")
        elif fail_prob >= 0.40:
            justifications.append(f"ML predictive failure model indicates elevated failure likelihood of {fail_prob*100:.0f}% (+{prob_score:.0f}/15 pts).")

        # 6. Traffic Density / Corridor GMT (0 to 10 pts)
        density_factor = work_item.get("traffic_density_factor", 1.0)
        # density_factor typically 0.5 to 1.5 -> scaled to 0-10
        density_score = round(min(10.0, max(0.0, (density_factor / 1.5) * 10.0)), 1)
        if density_factor >= 1.2:
            justifications.append(f"High-density traffic corridor with heavy freight/passenger load (+{density_score:.0f}/10 pts).")

        # 7. Deferral Consequence (0 to 10 pts)
        raw_deferral = work_item.get("deferral_consequence_rating", 5)  # scale 0 to 10
        deferral_score = min(10.0, max(0.0, float(raw_deferral)))
        if deferral_score >= 8:
            justifications.append(f"Severe deferral penalty (+{deferral_score:.0f}/10 pts) - will force 30 km/h Temporary Speed Restriction (TSR).")

        # Total Calculation
        total_score = round(
            safety_score 
            + asset_crit_score 
            + overdue_score 
            + history_score 
            + prob_score 
            + density_score 
            + deferral_score
        )
        total_score = int(min(100, max(0, total_score)))

        # Tier Classification
        if total_score >= 80:
            tier = "CRITICAL"
        elif total_score >= 65:
            tier = "HIGH"
        elif total_score >= 45:
            tier = "MEDIUM"
        else:
            tier = "LOW"

        factors_breakdown = {
            "safety_risk": safety_score,
            "asset_criticality": asset_crit_score,
            "overdue_days": overdue_score,
            "failure_history": history_score,
            "failure_probability": prob_score,
            "traffic_density": density_score,
            "deferral_consequence": deferral_score,
            "total": float(total_score)
        }

        return total_score, tier, factors_breakdown, justifications


priority_engine = PriorityEngine()
