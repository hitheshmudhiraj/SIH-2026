"""
Corridor Availability Engine
Calculates capacity headroom and train occupancy per section in 30-minute time slots (48 slots/day).
Derives availability metrics from timetable schedules (arrival/departure, days of run, train type).
Exposes get_corridor_availability() and generates corridor_availability.csv / .json.
"""

import os
import csv
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")

DAY_MAP = {
    0: "Mon",
    1: "Tue",
    2: "Wed",
    3: "Thu",
    4: "Fri",
    5: "Sat",
    6: "Sun"
}

def parse_time_to_minutes(time_str: str) -> int:
    """Parses 'HH:MM' into minutes since midnight."""
    try:
        parts = time_str.strip().split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return 0

def minutes_to_time_str(mins: int) -> str:
    """Converts minutes since midnight to 'HH:MM'."""
    h = (mins // 60) % 24
    m = mins % 60
    return f"{h:02d}:{m:02d}"

class CorridorAvailabilityEngine:
    def __init__(self, data_dir: Optional[str] = None):
        self.data_dir = data_dir or DATA_DIR
        self._trains_cache: Optional[List[Dict[str, Any]]] = None
        self._sections_cache: Optional[List[Dict[str, Any]]] = None

    def get_sections(self) -> List[Dict[str, Any]]:
        if self._sections_cache is not None:
            return self._sections_cache
        
        path = os.path.join(self.data_dir, "sections.csv")
        sections = []
        if os.path.exists(path):
            with open(path, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for r in reader:
                    sections.append({
                        "section_id": r["section_id"],
                        "section_name": r.get("section_name", ""),
                        "from_station": r.get("from_station", ""),
                        "to_station": r.get("to_station", ""),
                        "length_km": float(r.get("length_km", 0.0)),
                        "division": r.get("division", ""),
                        "zone": r.get("zone", ""),
                        "max_speed_kmph": int(r.get("max_speed_kmph", 110)),
                        "track_type": r.get("track_type", "double"),
                        "electrified": str(r.get("electrified", "True")).lower() == "true"
                    })
        self._sections_cache = sections
        return sections

    def get_trains(self) -> List[Dict[str, Any]]:
        if self._trains_cache is not None:
            return self._trains_cache

        path = os.path.join(self.data_dir, "timetable_trains.csv")
        trains = []
        if os.path.exists(path):
            with open(path, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for r in reader:
                    trains.append({
                        "train_number": r["train_number"],
                        "train_name": r.get("train_name", ""),
                        "train_type": r.get("train_type", "express"),
                        "days_of_run": [d.strip() for d in r.get("days_of_run", "").replace('"', '').split(",") if d.strip()],
                        "section_id": r.get("section_id", ""),
                        "arrival_time": r.get("arrival_time", "00:00"),
                        "departure_time": r.get("departure_time", "00:00"),
                        "direction": r.get("direction", "UP"),
                        "priority_score": float(r.get("priority_score", 5))
                    })
        self._trains_cache = trains
        return trains

    def get_corridor_availability(
        self,
        section_id: str,
        date_str: str,
        slot_duration_minutes: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Calculates corridor availability profile for a section on a given date.
        Returns 48 slots (for 30-min intervals) with:
          - section_id
          - date
          - slot_start (HH:MM)
          - slot_end (HH:MM)
          - train_count
          - availability_score (0.0 to 1.0, where 1.0 is completely open)
          - occupancy_category (HIGH, MEDIUM, LOW)
          - active_trains (list of train summary info)
        """
        all_trains = self.get_trains()
        section_trains = [t for t in all_trains if t["section_id"] == section_id]

        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d")
            day_abbr = DAY_MAP[target_date.weekday()]
        except Exception:
            day_abbr = "Mon"
            date_str = datetime.now().strftime("%Y-%m-%d")

        # Filter trains that run on this day of week
        running_trains = []
        for t in section_trains:
            if not t["days_of_run"] or day_abbr in t["days_of_run"]:
                running_trains.append(t)

        slots = []
        total_minutes = 24 * 60
        num_slots = total_minutes // slot_duration_minutes

        for s_idx in range(num_slots):
            slot_start_m = s_idx * slot_duration_minutes
            slot_end_m = slot_start_m + slot_duration_minutes

            slot_start_str = minutes_to_time_str(slot_start_m)
            slot_end_str = minutes_to_time_str(slot_end_m)

            # Check trains overlapping this window
            trains_in_slot = []
            for t in running_trains:
                t_arr = parse_time_to_minutes(t["arrival_time"])
                t_dep = parse_time_to_minutes(t["departure_time"])

                # Handle train crossing midnight
                if t_dep < t_arr:
                    t_dep += 1440

                # Train overlap with slot
                if t_arr < slot_end_m and t_dep > slot_start_m:
                    trains_in_slot.append(t)

            train_count = len(trains_in_slot)

            # Compute Availability Score
            # 0 trains: 1.0 (Completely available)
            # 1 train:  0.8
            # 2 trains: 0.5
            # 3 trains: 0.25
            # 4+ trains: 0.05
            if train_count == 0:
                availability_score = 1.0
                occupancy_category = "HIGH_AVAILABILITY"
            elif train_count == 1:
                availability_score = 0.8
                occupancy_category = "MEDIUM_HIGH_AVAILABILITY"
            elif train_count == 2:
                availability_score = 0.5
                occupancy_category = "MEDIUM_AVAILABILITY"
            elif train_count == 3:
                availability_score = 0.25
                occupancy_category = "LOW_AVAILABILITY"
            else:
                availability_score = 0.05
                occupancy_category = "CORRIDOR_CONGESTED"

            # If an ultra-high priority train (e.g. Vande Bharat / Rajdhani with priority >= 9) passes, lower availability
            has_vip_train = any(t.get("priority_score", 0) >= 9 for t in trains_in_slot)
            if has_vip_train:
                availability_score = max(0.0, availability_score - 0.3)
                occupancy_category = "PROTECTED_BLACKOUT"

            slots.append({
                "section_id": section_id,
                "date": date_str,
                "slot_start": slot_start_str,
                "slot_end": slot_end_str,
                "slot_start_minute": slot_start_m,
                "slot_end_minute": slot_end_m,
                "train_count": train_count,
                "availability_score": round(availability_score, 2),
                "occupancy_category": occupancy_category,
                "active_trains": [
                    {
                        "train_number": t["train_number"],
                        "train_name": t["train_name"],
                        "train_type": t["train_type"],
                        "direction": t["direction"],
                        "priority": t["priority_score"]
                    }
                    for t in trains_in_slot
                ]
            })

        return slots

    def precompute_and_save_availability(
        self,
        start_date: Optional[str] = None,
        days_count: int = 7
    ) -> str:
        """
        Precomputes corridor availability for all sections over a 7-day or specified window
        and writes corridor_availability.csv and corridor_availability.json.
        """
        sections = self.get_sections()
        if not start_date:
            start_date = datetime.now().strftime("%Y-%m-%d")

        base_dt = datetime.strptime(start_date, "%Y-%m-%d")
        all_rows = []

        for d in range(days_count):
            cur_date = (base_dt + timedelta(days=d)).strftime("%Y-%m-%d")
            for sec in sections:
                sec_id = sec["section_id"]
                slots = self.get_corridor_availability(sec_id, cur_date)
                for s in slots:
                    all_rows.append({
                        "section_id": s["section_id"],
                        "date": s["date"],
                        "slot_start": s["slot_start"],
                        "slot_end": s["slot_end"],
                        "train_count": s["train_count"],
                        "availability_score": s["availability_score"]
                    })

        csv_path = os.path.join(self.data_dir, "corridor_availability.csv")
        json_path = os.path.join(self.data_dir, "corridor_availability.json")

        if all_rows:
            with open(csv_path, mode="w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=["section_id", "date", "slot_start", "slot_end", "train_count", "availability_score"])
                writer.writeheader()
                writer.writerows(all_rows)

            with open(json_path, mode="w", encoding="utf-8") as f:
                json.dump(all_rows[:1000], f, indent=2)

        return csv_path

corridor_engine = CorridorAvailabilityEngine()
