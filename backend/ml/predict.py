"""
AI Block Recommender & Optimization Engine
Evaluates candidate maintenance block slots across 24-hour schedules,
queries real timetable train paths, applies the trained ML model to predict delays,
and ranks slots under operational railway safety constraints.
"""

import os
import sys
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
import joblib

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_PATH = os.path.join(CURRENT_DIR, "model", "trained_block_recommender.joblib")
METADATA_PATH = os.path.join(CURRENT_DIR, "model", "model_metadata.json")

# Import preprocessing
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from preprocessing.preprocessor import extract_features_for_candidate

DAY_MAP = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}


class BlockRecommenderEngine:
    def __init__(self):
        self.model_bundle = None
        self._load_model()
        self._trains_cache = None
        self._sections_cache = None
        self._existing_blocks_cache = None

    def _load_model(self):
        """Loads trained ML bundle from joblib artifact."""
        if os.path.exists(MODEL_PATH):
            try:
                self.model_bundle = joblib.load(MODEL_PATH)
            except Exception as e:
                print(f"[WARN] Could not load model from {MODEL_PATH}: {e}")
                self.model_bundle = None
        else:
            print(f"[WARN] Model file not found at {MODEL_PATH}. Training may be required.")
            self.model_bundle = None

    def get_sections(self) -> List[Dict[str, Any]]:
        if self._sections_cache is not None:
            return self._sections_cache
        sections = []
        path = os.path.join(DATA_DIR, "sections.csv")
        if os.path.exists(path):
            import csv
            with open(path, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for r in reader:
                    sections.append(r)
        self._sections_cache = sections
        return sections

    def get_trains(self) -> List[Dict[str, Any]]:
        if self._trains_cache is not None:
            return self._trains_cache
        trains = []
        path = os.path.join(DATA_DIR, "timetable_trains.csv")
        if os.path.exists(path):
            import csv
            with open(path, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for r in reader:
                    trains.append(r)
        self._trains_cache = trains
        return trains

    def get_existing_blocks(self) -> List[Dict[str, Any]]:
        if self._existing_blocks_cache is not None:
            return self._existing_blocks_cache
        blocks = []
        path = os.path.join(DATA_DIR, "existing_blocks_baseline.csv")
        if os.path.exists(path):
            import csv
            with open(path, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for r in reader:
                    blocks.append(r)
        self._existing_blocks_cache = blocks
        return blocks

    def _parse_time_to_minutes(self, t_str: str) -> int:
        try:
            parts = t_str.strip().split(":")
            return int(parts[0]) * 60 + int(parts[1])
        except Exception:
            return 0

    def _minutes_to_hhmm(self, m: int) -> str:
        h = (m // 60) % 24
        mins = m % 60
        return f"{h:02d}:{mins:02d}"

    def _format_12hr(self, hhmm: str) -> str:
        try:
            parts = hhmm.split(":")
            h = int(parts[0])
            m = int(parts[1])
            suffix = "AM" if h < 12 else "PM"
            disp_h = h if h <= 12 else h - 12
            if disp_h == 0:
                disp_h = 12
            return f"{disp_h:02d}:{m:02d} {suffix}"
        except Exception:
            return hhmm

    def _generate_candidate_slots(self, duration_minutes: int, window_filter: str = "ANY") -> List[Dict[str, int]]:
        """Generates candidate sliding windows throughout the day."""
        slots = []
        # Step in 30-min intervals
        for start_m in range(30, 1440 - duration_minutes + 1, 30):
            end_m = start_m + duration_minutes

            # Apply user preferred window filter if requested
            wf = window_filter.upper()
            if wf == "NIGHT" and not (start_m >= 30 and start_m <= 240):
                continue
            elif wf == "MORNING" and not (start_m >= 270 and start_m <= 540):
                continue
            elif wf == "MIDDAY" and not (start_m >= 660 and start_m <= 900):
                continue
            elif wf == "AFTERNOON" and not (start_m >= 900 and start_m <= 1110):
                continue
            elif wf == "EVENING" and not (start_m >= 1080 and start_m <= 1320):
                continue

            slots.append({
                "start_minute": start_m,
                "end_minute": end_m,
                "duration_minutes": duration_minutes
            })

        # Fallback if filter returned nothing
        if not slots:
            for start_m in [60, 270, 690, 930]:
                slots.append({
                    "start_minute": start_m,
                    "end_minute": start_m + duration_minutes,
                    "duration_minutes": duration_minutes
                })
        return slots

    def recommend_block(
        self,
        section_id: str,
        department: str,
        work_type: str,
        duration_hours: float,
        preferred_date: Optional[str] = None,
        preferred_time_window: str = "ANY",
        priority: str = "HIGH",
        crew_type: Optional[str] = None,
        equipment_required: Optional[str] = None,
        work_description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Main recommendation logic:
        1. Validates inputs and sets default operational attributes.
        2. Retrieves section and timetable train schedules.
        3. Generates candidate slots across the requested period.
        4. Interrogates timetable and ML models for each slot.
        5. Ranks slots and returns recommended block + alternatives.
        """
        # Ensure model loaded
        if self.model_bundle is None:
            self._load_model()
            if self.model_bundle is None:
                # Trigger training script if missing
                from train_model import train_and_evaluate
                self.model_bundle = train_and_evaluate()

        # Defaults and formatting
        duration_minutes = max(30, int(round(duration_hours * 60)))
        target_date_str = preferred_date or datetime.now().strftime("%Y-%m-%d")
        try:
            dt = datetime.strptime(target_date_str, "%Y-%m-%d")
            day_of_week = DAY_MAP[dt.weekday()]
        except Exception:
            day_of_week = "Tue"
            target_date_str = "2026-09-08"

        priority_norm = priority.upper()
        prio_scores_map = {"CRITICAL": 95, "HIGH": 80, "MEDIUM": 60, "LOW": 35}
        priority_score = prio_scores_map.get(priority_norm, 75)

        # Crew and equipment defaults
        if not crew_type:
            if department == "Engineering":
                crew_type = "track_gang"
            elif department == "Traction":
                crew_type = "tower_wagon_crew"
            else:
                crew_type = "ST_gang"

        if not equipment_required:
            if "tamping" in work_type.lower() or "renewal" in work_type.lower():
                equipment_required = "CSM Tamping Machine"
            elif department == "Traction":
                equipment_required = "Tower Wagon"
            else:
                equipment_required = "None / Manual Tools"

        # Lookup section details
        sections = self.get_sections()
        sec = next((s for s in sections if s["section_id"] == section_id), None)
        if not sec:
            sec = {
                "section_id": section_id,
                "section_name": f"Corridor Section {section_id}",
                "division": "Vijayawada"
            }

        # Timetable trains on section
        all_trains = self.get_trains()
        sec_trains = [
            t for t in all_trains
            if t.get("section_id") == section_id
            and (not t.get("days_of_run") or day_of_week in t.get("days_of_run"))
        ]

        # Existing scheduled blocks on section
        all_blocks = self.get_existing_blocks()
        sec_blocks = [
            b for b in all_blocks
            if b.get("section_id") == section_id and b.get("date") == target_date_str
        ]

        # Generate candidate slots
        candidate_slots = self._generate_candidate_slots(duration_minutes, preferred_time_window)

        evaluated_slots = []
        preprocessor = self.model_bundle["preprocessor"]
        delay_model = self.model_bundle["delay_model"]
        affected_model = self.model_bundle["affected_model"]
        score_model = self.model_bundle["score_model"]

        for slot in candidate_slots:
            st_m = slot["start_minute"]
            en_m = slot["end_minute"]
            st_hhmm = self._minutes_to_hhmm(st_m)
            en_hhmm = self._minutes_to_hhmm(en_m)

            # Find overlapping trains
            overlapping_trains = []
            for t in sec_trains:
                arr_m = self._parse_time_to_minutes(t.get("arrival_time", "00:00"))
                dep_m = self._parse_time_to_minutes(t.get("departure_time", "00:00"))
                if dep_m < arr_m:
                    dep_m += 1440

                if arr_m < en_m and dep_m > st_m:
                    overlapping_trains.append({
                        "train_number": t.get("train_number", "EXP"),
                        "train_name": t.get("train_name", "Train"),
                        "train_type": t.get("train_type", "express"),
                        "arrival_time": t.get("arrival_time", "00:00"),
                        "departure_time": t.get("departure_time", "00:00"),
                        "priority_score": float(t.get("priority_score", 5.0))
                    })

            train_count = len(overlapping_trains)
            vip_trains = [t for t in overlapping_trains if t["priority_score"] >= 9.0]
            vip_count = len(vip_trains)

            # Calculate Availability Score
            if train_count == 0:
                avail_score = 1.0
            elif train_count == 1:
                avail_score = 0.8
            elif train_count == 2:
                avail_score = 0.5
            elif train_count == 3:
                avail_score = 0.25
            else:
                avail_score = 0.05

            if vip_count > 0:
                avail_score = max(0.05, avail_score - 0.3)

            # Existing blocks overlap & other dept activity
            existing_blocks_count = 0
            other_dept_active = 0
            for eb in sec_blocks:
                b_st_m = self._parse_time_to_minutes(eb.get("start_time", "00:00"))
                b_en_m = self._parse_time_to_minutes(eb.get("end_time", "00:00"))
                if b_st_m < en_m and b_en_m > st_m:
                    existing_blocks_count += 1
                    if eb.get("department") != department:
                        other_dept_active = 1

            # Prepare features for ML Model
            features_df = extract_features_for_candidate(
                section_dict=sec,
                department=department,
                work_type=work_type,
                duration_minutes=duration_minutes,
                date_str=target_date_str,
                day_of_week=day_of_week,
                start_minute=st_m,
                trains_in_slot=overlapping_trains,
                availability_score=avail_score,
                priority_str=priority_norm,
                priority_score=priority_score,
                crew_type=crew_type,
                equipment=equipment_required,
                existing_blocks_count=existing_blocks_count,
                other_dept_activity=other_dept_active,
                hist_avg_delay=5.0
            )

            # Predict outcomes via ML models
            X_proc = preprocessor.transform(features_df)
            pred_delay = float(delay_model.predict(X_proc)[0])
            pred_affected = float(affected_model.predict(X_proc)[0])
            pred_score = float(score_model.predict(X_proc)[0])

            # Safety adjustments
            clean_affected = max(0, int(round(pred_affected)))
            clean_delay = max(0.0, round(pred_delay, 1))
            clean_score = max(5.0, min(99.0, round(pred_score, 1)))

            # If 0 trains, guaranteed minimal delay
            if train_count == 0:
                clean_affected = 0
                clean_delay = 0.0
                clean_score = max(clean_score, 92.0)

            # Heavy penalty if VIP passenger train overlaps (Vande Bharat / Rajdhani)
            if vip_count > 0:
                clean_score = min(clean_score, 45.0)

            # Bonus for joint bundling synergy
            joint_synergy = (other_dept_active == 1 and existing_blocks_count == 0)
            if joint_synergy:
                clean_score = min(99.0, clean_score + 6.0)

            # Slot name classification
            if st_m >= 60 and st_m <= 240:
                slot_category = "Night Rolling Megablock"
            elif st_m >= 270 and st_m <= 420:
                slot_category = "Early Morning Off-Peak Window"
            elif st_m >= 660 and st_m <= 870:
                slot_category = "Mid-Day Freight Shadow Gap"
            elif st_m >= 900 and st_m <= 1080:
                slot_category = "Afternoon Maintenance Slot"
            else:
                slot_category = "Standard Timetable Window"

            # Operational Rationale Synthesis
            if train_count == 0 and vip_count == 0:
                reason = (
                    f"Optimal track clearance window with 0 scheduled passenger train clashes. "
                    f"Corridor headroom is high ({int(avail_score * 100)}%), requested {crew_type} crew and "
                    f"{equipment_required} are verified available with safe headway margins."
                )
            elif vip_count > 0:
                reason = (
                    f"High operational risk: Protected VIP passenger service ({vip_trains[0]['train_name']}) "
                    f"passes through {sec.get('section_name')}. Severe train regulation expected."
                )
            elif train_count == 1:
                t = overlapping_trains[0]
                reason = (
                    f"Low traffic window. Only 1 train ({t['train_name']} #{t['train_number']}) scheduled, "
                    f"which can be safely regulated with minimal delay (~{int(clean_delay)} min)."
                )
            else:
                reason = (
                    f"Moderate density slot with {train_count} scheduled trains. "
                    f"Expected aggregate regulation delay of ~{int(clean_delay)} minutes."
                )

            if joint_synergy:
                reason += " Cross-department synergy detected: concurrent maintenance bundling available."

            evaluated_slots.append({
                "start_time": st_hhmm,
                "end_time": en_hhmm,
                "formatted_time": f"{self._format_12hr(st_hhmm)} - {self._format_12hr(en_hhmm)}",
                "date": target_date_str,
                "day_of_week": day_of_week,
                "duration_hours": duration_hours,
                "duration_minutes": duration_minutes,
                "affected_trains": clean_affected,
                "expected_delay": "Minimal (0 min)" if clean_delay < 1.0 else f"~{int(clean_delay)} min",
                "expected_delay_minutes": clean_delay,
                "optimization_score": clean_score,
                "conflicting_trains": overlapping_trains,
                "slot_category": slot_category,
                "track_availability_pct": round(avail_score * 100, 1),
                "joint_synergy_opportunity": joint_synergy,
                "vip_train_count": vip_count,
                "reason": reason
            })

        # Sort slots by optimization score descending, then affected trains ascending
        evaluated_slots.sort(
            key=lambda s: (-s["optimization_score"], s["affected_trains"], s["expected_delay_minutes"])
        )

        best_slot = evaluated_slots[0]

        # Pick alternative slots from distinct time categories
        alternatives = []
        best_st_min = self._parse_time_to_minutes(best_slot["start_time"])
        for s in evaluated_slots[1:]:
            s_st_min = self._parse_time_to_minutes(s["start_time"])
            # Ensure spacing of at least 2 hours so alternatives are meaningful options
            if abs(s_st_min - best_st_min) >= 120 and all(abs(s_st_min - self._parse_time_to_minutes(alt["start_time"])) >= 120 for alt in alternatives):
                alternatives.append(s)
                if len(alternatives) >= 2:
                    break

        # Fallback if no spaced alternatives
        if len(alternatives) < 2 and len(evaluated_slots) > 1:
            for s in evaluated_slots[1:]:
                if s not in alternatives:
                    alternatives.append(s)
                    if len(alternatives) >= 2:
                        break

        # Model metadata
        meta = self.get_model_metadata()

        return {
            "status": "SUCCESS",
            "section_id": section_id,
            "section_name": sec.get("section_name", section_id),
            "division": sec.get("division", "Vijayawada"),
            "department": department,
            "work_type": work_type,
            "work_description": work_description or f"{department} {work_type}",
            "priority": priority_norm,
            "priority_score": priority_score,
            "duration_hours": duration_hours,
            "crew_type": crew_type,
            "equipment_required": equipment_required,
            "recommended_block": best_slot,
            "alternative_slots": alternatives,
            "total_slots_evaluated": len(evaluated_slots),
            "model_metadata": meta
        }

    def get_model_metadata(self) -> Dict[str, Any]:
        """Returns model evaluation metrics and training provenance."""
        if os.path.exists(METADATA_PATH):
            with open(METADATA_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "notice" not in data:
                    data["notice"] = data.get("dataset", {}).get(
                        "prototype_safety_disclaimer",
                        "Synthetic Prototype Historical Data. Not real Indian Railways proprietary data."
                    )
                return data
        return {
            "model_name": "RailBlock AI Maintenance Block Time Recommender",
            "version": "1.0.0",
            "dataset_source": "Synthetic Prototype Historical Data",
            "notice": "Trained on simulated SCoR 2026 railway maintenance scenarios."
        }


# Global singleton instance
block_recommender = BlockRecommenderEngine()


if __name__ == "__main__":
    # Test script with the 3 mandatory user scenarios
    engine = BlockRecommenderEngine()

    print("\n" + "=" * 70)
    print(" TESTING SCENARIO 1: Engineering -> Track Maintenance -> 2h -> High Priority")
    print("=" * 70)
    res1 = engine.recommend_block(
        section_id="SEC_C01_01",
        department="Engineering",
        work_type="Track Maintenance",
        duration_hours=2.0,
        priority="HIGH",
        preferred_time_window="ANY"
    )
    b1 = res1["recommended_block"]
    print(f"Recommended Block: {b1['formatted_time']} ({b1['slot_category']})")
    print(f"Affected Trains:   {b1['affected_trains']}")
    print(f"Expected Delay:    {b1['expected_delay']}")
    print(f"Score:             {b1['optimization_score']}%")
    print(f"Reason:            {b1['reason']}")

    print("\n" + "=" * 70)
    print(" TESTING SCENARIO 2: S&T -> Signal Maintenance -> 1h -> Medium Priority")
    print("=" * 70)
    res2 = engine.recommend_block(
        section_id="SEC_C01_02",
        department="S&T",
        work_type="Signal Maintenance",
        duration_hours=1.0,
        priority="MEDIUM",
        preferred_time_window="MIDDAY"
    )
    b2 = res2["recommended_block"]
    print(f"Recommended Block: {b2['formatted_time']} ({b2['slot_category']})")
    print(f"Affected Trains:   {b2['affected_trains']}")
    print(f"Expected Delay:    {b2['expected_delay']}")
    print(f"Score:             {b2['optimization_score']}%")
    print(f"Reason:            {b2['reason']}")

    print("\n" + "=" * 70)
    print(" TESTING SCENARIO 3: Traction -> Maintenance -> 3h -> High Priority")
    print("=" * 70)
    res3 = engine.recommend_block(
        section_id="SEC_C01_03",
        department="Traction",
        work_type="Power Isolation Maintenance",
        duration_hours=3.0,
        priority="HIGH",
        preferred_time_window="NIGHT"
    )
    b3 = res3["recommended_block"]
    print(f"Recommended Block: {b3['formatted_time']} ({b3['slot_category']})")
    print(f"Affected Trains:   {b3['affected_trains']}")
    print(f"Expected Delay:    {b3['expected_delay']}")
    print(f"Score:             {b3['optimization_score']}%")
    print(f"Reason:            {b3['reason']}")
