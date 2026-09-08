"""
AI Maintenance Priority Engine
Explainable Mathematical Scoring Model for Indian Railways Assets
Calculates priority_score (0-100) using 6 transparent operational factors.
"""
from typing import Dict, Any, Tuple, List
from datetime import datetime

class PriorityEngine:
    """
    Weighted Explainable Priority Calculation:
    Priority = 0.25 * Criticality + 0.20 * Severity + 0.20 * Urgency +
               0.15 * ConditionRisk + 0.10 * TrafficImpact + 0.10 * DependencyRisk
    """

    CRITICALITY_WEIGHTS = {
        "CRITICAL": 100,
        "HIGH": 75,
        "MEDIUM": 50,
        "LOW": 25
    }

    SEVERITY_WEIGHTS = {
        "CRITICAL": 100,
        "HIGH": 75,
        "MEDIUM": 50,
        "LOW": 20
    }

    CORRIDOR_TRAFFIC = {
        "C01": 95, # BZA-GDR Main Trunk (Heavy High Density Network)
        "C02": 90, # VSKP-BZA Coastal Trunk Line
        "C04": 80, # GTL-RU Freight & Express Link
        "C03": 60  # GNT-NDL Single / Branch Line
    }

    def compute_priority(self, job: Dict[str, Any], asset: Dict[str, Any] = None) -> Tuple[int, str, Dict[str, float], List[str]]:
        reasons = []

        # 1. Criticality Factor (0-100)
        crit_str = str(job.get("criticality") or (asset.get("criticality") if asset else "MEDIUM")).upper()
        crit_score = self.CRITICALITY_WEIGHTS.get(crit_str, 50)
        if crit_score >= 75:
            reasons.append(f"{crit_str.capitalize()} railway asset criticality designation")

        # 2. Defect Severity Factor (0-100)
        sev_str = str(job.get("severity", "MEDIUM")).upper()
        sev_score = self.SEVERITY_WEIGHTS.get(sev_str, 50)
        if sev_score >= 75:
            reasons.append(f"{sev_str.capitalize()} defect severity level requiring prompt possession")

        # 3. Urgency / Days to Due Date Factor (0-100)
        due_date_str = job.get("due_date", "")
        urgency_score = 50.0
        days_left = 5
        if due_date_str:
            try:
                due_dt = datetime.strptime(due_date_str[:10], "%Y-%m-%d")
                now_dt = datetime.now()
                delta_days = (due_dt.date() - now_dt.date()).days
                days_left = delta_days
                if delta_days <= 1:
                    urgency_score = 100.0
                    reasons.append("Maintenance due immediately (overdue or <= 24 hours)")
                elif delta_days <= 3:
                    urgency_score = 85.0
                    reasons.append(f"Maintenance due within {delta_days} days")
                elif delta_days <= 7:
                    urgency_score = 65.0
                    reasons.append("Maintenance due within upcoming weekly cycle")
                else:
                    urgency_score = 35.0
            except Exception:
                urgency_score = 50.0

        # 4. Condition Score Risk (0-100, where condition score 0 is worst, 100 is best)
        raw_cond = job.get("condition_score") or (asset.get("condition_score") if asset else 70)
        try:
            cond_val = float(raw_cond)
        except Exception:
            cond_val = 70.0
        # Invert condition so that poor condition (e.g. 50) gives higher risk (50 risk points)
        condition_risk = max(0.0, min(100.0, 100.0 - cond_val))
        if condition_risk >= 40:
            reasons.append(f"Depreciated asset condition score ({cond_val:.0f}/100) warrants intervention")

        # 5. Corridor Traffic Importance (0-100)
        c_id = job.get("corridor_id", "C01")
        traffic_score = self.CORRIDOR_TRAFFIC.get(c_id, 70)
        if traffic_score >= 85:
            reasons.append(f"High traffic density corridor ({c_id}) with tight headway constraints")

        # 6. Asset Dependency / Job Type Risk (0-100)
        job_type = str(job.get("job_type", "")).upper()
        if any(k in job_type for k in ["WELD", "USFD", "ISOLATOR", "INTERLOCKING", "TAMPING", "FRACTURE"]):
            dependency_risk = 90.0
            reasons.append(f"Safety-critical task ({job_type}) impacting corridor throughput")
        else:
            dependency_risk = 50.0

        # Weighted calculation
        final_score = (
            0.25 * crit_score +
            0.20 * sev_score +
            0.20 * urgency_score +
            0.15 * condition_risk +
            0.10 * traffic_score +
            0.10 * dependency_risk
        )
        final_int = int(round(max(10, min(100, final_score))))

        tier = "CRITICAL" if final_int >= 85 else ("HIGH" if final_int >= 70 else ("MEDIUM" if final_int >= 50 else "LOW"))

        factor_breakdown = {
            "criticality_score": float(crit_score),
            "severity_score": float(sev_score),
            "urgency_score": float(urgency_score),
            "condition_risk": float(condition_risk),
            "traffic_impact": float(traffic_score),
            "dependency_risk": float(dependency_risk)
        }

        return final_int, tier, factor_breakdown, reasons

priority_engine = PriorityEngine()
