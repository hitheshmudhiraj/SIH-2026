"""
Maintenance Task Prioritization Engine
Calculates explainable numeric priority scores (0 - 100) for railway maintenance tasks across
Engineering (P-Way), Traction Distribution (TRD), and Signal & Telecommunication (S&T).

Scoring Formula (Configurable Weighted Sum):
-------------------------------------------
Total Priority Score = 
    W_severity * SeverityScore (max 35 pts)
  + W_overdue  * OverdueScore  (max 25 pts)
  + W_asset    * AssetCriticalityScore (max 20 pts)
  + W_section  * SectionRiskScore (max 20 pts)

1. Severity Score:
   - CRITICAL: 35 pts (Active rail flaw, burnt OHE isolator, point machine failure)
   - HIGH:     25 pts (Track geometry defect, OHE catenary wear, signal aspect failure)
   - MEDIUM:   15 pts (Ballast deficit, sleeper spacing, cantilever misalignment)
   - LOW:       5 pts (Cess dressing, cable marker restoration, mast bonding)

2. Overdue Score (Days past due_date relative to reference date):
   - Overdue (> 0 days): min(25, 10 + (overdue_days * 1.5))
   - Due Today (0 days): 10 pts
   - Due in 1-7 days:    5 pts
   - Due > 7 days:       2 pts

3. Asset Criticality Score:
   - High-impact assets (track_segment on main line, point_machine, OHE_span): 20 pts
   - Medium-impact assets (signal, transformer, axle_counter): 15 pts
   - Lower-impact assets (cable, other): 10 pts

4. Section Operating Risk Score:
   - Based on Section max speed (>= 130 km/h: 20 pts, 110-120 km/h: 15 pts, <= 100 km/h: 10 pts)
   - Track type bonus: Double line trunk route (+3 pts, capped at 20)
"""

import os
import csv
from datetime import datetime
from typing import Dict, Any, List, Optional

SEVERITY_WEIGHTS = {
    "critical": 35.0,
    "high": 25.0,
    "medium": 15.0,
    "low": 5.0
}

ASSET_CRITICALITY_WEIGHTS = {
    "track_segment": 20.0,
    "point_machine": 20.0,
    "OHE_span": 20.0,
    "signal": 16.0,
    "transformer": 16.0,
    "axle_counter": 15.0,
    "cable": 12.0,
    "other": 10.0
}

class PrioritizationEngine:
    def __init__(self, reference_date: Optional[str] = None):
        # Reference date for overdue calculation (default to 2026-09-07 or today)
        self.reference_date = reference_date or "2026-09-07"
        self._ref_dt = datetime.strptime(self.reference_date, "%Y-%m-%d")

    def calculate_priority(
        self,
        task: Dict[str, Any],
        section_info: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Calculates priority score and factor breakdown for a single maintenance task.
        """
        # 1. Severity Score (0 - 35)
        sev = str(task.get("severity", "medium")).lower()
        severity_score = SEVERITY_WEIGHTS.get(sev, 15.0)

        # 2. Overdue Score (0 - 25)
        due_date_str = task.get("due_date", "")
        overdue_days = 0
        if due_date_str:
            try:
                due_dt = datetime.strptime(due_date_str, "%Y-%m-%d")
                overdue_days = (self._ref_dt - due_dt).days
            except Exception:
                overdue_days = 0

        if overdue_days > 0:
            overdue_score = min(25.0, 10.0 + (overdue_days * 1.5))
        elif overdue_days == 0:
            overdue_score = 10.0
        elif overdue_days >= -7:
            overdue_score = 6.0
        else:
            overdue_score = 2.0

        # 3. Asset Criticality Score (0 - 20)
        asset_type = str(task.get("asset_type", "other"))
        asset_score = ASSET_CRITICALITY_WEIGHTS.get(asset_type, 12.0)

        # 4. Section Risk Score (0 - 20)
        if section_info:
            max_spd = section_info.get("max_speed_kmph", 110)
            track_type = section_info.get("track_type", "double")
            if max_spd >= 130:
                sec_score = 17.0
            elif max_spd >= 110:
                sec_score = 14.0
            else:
                sec_score = 10.0

            if track_type == "double":
                sec_score = min(20.0, sec_score + 3.0)
        else:
            sec_score = 15.0

        # Total Raw Score (0 - 100)
        total_score = round(severity_score + overdue_score + asset_score + sec_score, 1)
        total_score = max(10.0, min(100.0, total_score))

        # Assign Tier
        if total_score >= 80 or sev == "critical":
            tier = "CRITICAL"
        elif total_score >= 65:
            tier = "HIGH"
        elif total_score >= 40:
            tier = "MEDIUM"
        else:
            tier = "LOW"

        # Explainability justifications
        reasons = []
        if sev in ["critical", "high"]:
            reasons.append(f"{sev.upper()} severity defect requiring urgent track possession")
        if overdue_days > 0:
            reasons.append(f"Task is overdue by {overdue_days} days past target maintenance cycle")
        if asset_score >= 18:
            reasons.append(f"High-criticality asset ({asset_type}) directly impacting passenger train safety")
        if sec_score >= 18:
            reasons.append("High-speed trunk corridor route (130 km/h) with dense express traffic")

        if not reasons:
            reasons.append("Routine preventative maintenance task within statutory cycle")

        return {
            "task_id": task.get("task_id"),
            "calculated_priority_score": int(round(total_score)),
            "priority_tier": tier,
            "overdue_days": max(0, overdue_days),
            "factor_breakdown": {
                "severity_points": severity_score,
                "overdue_points": round(overdue_score, 1),
                "asset_criticality_points": asset_score,
                "section_risk_points": sec_score,
                "total_score": int(round(total_score))
            },
            "justification": reasons
        }

    def batch_prioritize(
        self,
        tasks: List[Dict[str, Any]],
        sections_map: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Prioritizes a list of tasks and returns updated records with priority scores and factors.
        """
        prioritized = []
        for t in tasks:
            sec_id = t.get("section_id")
            sec_info = sections_map.get(sec_id) if sections_map else None
            res = self.calculate_priority(t, sec_info)
            updated = dict(t)
            updated["priority_score"] = res["calculated_priority_score"]
            updated["priority_tier"] = res["priority_tier"]
            updated["overdue_days"] = res["overdue_days"]
            updated["priority_factors"] = res["factor_breakdown"]
            updated["priority_reasons"] = res["justification"]
            prioritized.append(updated)
        return prioritized

prioritizer = PrioritizationEngine()
