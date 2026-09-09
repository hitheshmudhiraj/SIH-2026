"""
Historical Block Planning Dataset Generator (Synthetic Prototype Data)
Generates realistic historical maintenance block decisions and operational outcomes
for South Coast Railway (SCoR) 2026 prototype corridors.

SAFETY NOTICE:
This dataset is synthetically generated for demonstration and model training.
It does NOT represent real Indian Railways operational proprietary data.
"""

import os
import csv
import json
import random
import math
from datetime import datetime, timedelta

# Paths
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")
ML_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT_CSV = os.path.join(os.path.dirname(__file__), "historical_block_data.csv")
OUTPUT_METADATA = os.path.join(os.path.dirname(__file__), "dataset_metadata.json")

random.seed(42)

DEPARTMENTS = ["Engineering", "S&T", "Traction"]

WORK_TYPES_BY_DEPT = {
    "Engineering": [
        ("Track Maintenance", "track_gang", "None / Manual Tools", 120),
        ("Turnout Overhaul", "track_gang", "CSM Tamping Machine", 180),
        ("Rail Renewal", "track_gang", "CSM Tamping Machine", 240),
        ("Sleeper Replacement", "track_gang", "Ballast Regulator", 180),
        ("Weld Rectification", "track_gang", "USFD Flaw Detector", 90),
        ("Deep Screening Ballast", "track_gang", "Ballast Regulator", 210),
    ],
    "S&T": [
        ("Signal Maintenance", "ST_gang", "None / Manual Tools", 60),
        ("Point Machine Overhaul", "ST_gang", "Testing Van", 90),
        ("Track Circuit Testing", "ST_gang", "None / Manual Tools", 75),
        ("Axle Counter Replacement", "ST_gang", "Testing Van", 120),
        ("Interlocking Inspection", "ST_gang", "None / Manual Tools", 90),
        ("Cable Jointing & OFC", "ST_gang", "Testing Van", 150),
    ],
    "Traction": [
        ("OHE Inspection", "tower_wagon_crew", "Tower Wagon", 120),
        ("Power Isolation Maintenance", "tower_wagon_crew", "Tower Wagon", 180),
        ("Cantilever Adjustment", "tower_wagon_crew", "Tower Wagon", 150),
        ("Contact Wire Height Regulation", "tower_wagon_crew", "Tower Wagon", 180),
        ("Insulator Washing & Replacement", "tower_wagon_crew", "Tower Wagon", 120),
        ("Substation Transformer Overhaul", "specialist_team", "None / Manual Tools", 240),
    ]
}

TIME_WINDOWS = [
    ("NIGHT_MEGABLOCK", "01:00", "04:00", 60, 240, 0.95, 0.2),       # Slot 01:00 - 04:00 (Lowest traffic)
    ("EARLY_MORNING", "04:30", "07:00", 270, 420, 0.85, 0.6),        # Slot 04:30 - 07:00
    ("PEAK_MORNING", "07:30", "10:30", 450, 630, 0.30, 3.2),         # Slot 07:30 - 10:30 (High congestion)
    ("MIDDAY_FREIGHT_GAP", "11:30", "14:30", 690, 870, 0.80, 0.8),   # Slot 11:30 - 14:30 (Freight gap)
    ("AFTERNOON_SLOT", "15:00", "17:30", 900, 1050, 0.65, 1.5),      # Slot 15:00 - 17:30 (Secondary window)
    ("PEAK_EVENING", "17:45", "21:00", 1065, 1260, 0.25, 3.8),       # Slot 17:45 - 21:00 (High congestion)
    ("LATE_NIGHT", "21:30", "23:45", 1290, 1425, 0.75, 1.0),         # Slot 21:30 - 23:45
]

DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def load_sections():
    sections_path = os.path.join(DATA_DIR, "sections.csv")
    sections = []
    if os.path.exists(sections_path):
        with open(sections_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                sections.append(r)
    return sections


def load_trains():
    trains_path = os.path.join(DATA_DIR, "timetable_trains.csv")
    trains = []
    if os.path.exists(trains_path):
        with open(trains_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                trains.append(r)
    return trains


def minutes_to_hhmm(m: int) -> str:
    h = (m // 60) % 24
    mins = m % 60
    return f"{h:02d}:{mins:02d}"


def generate_dataset(num_records: int = 3500):
    sections = load_sections()
    trains = load_trains()

    if not sections:
        sections = [{"section_id": f"SEC_C01_0{i}", "section_name": f"Section {i}", "division": "Vijayawada"} for i in range(1, 9)]

    fieldnames = [
        "block_id",
        "section_id",
        "section_name",
        "division",
        "department",
        "work_type",
        "work_duration_minutes",
        "date",
        "day_of_week",
        "requested_time_window",
        "candidate_start_time",
        "candidate_end_time",
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
        "crew_type_required",
        "equipment_required",
        "maintenance_priority",
        "priority_score",
        "historical_avg_delay_minutes",
        "actual_affected_trains",
        "actual_delay_caused_minutes",
        "block_efficiency_score",
        "is_optimal_slot"
    ]

    base_date = datetime(2026, 7, 1)
    records = []

    for i in range(1, num_records + 1):
        sec = random.choice(sections)
        dept = random.choice(DEPARTMENTS)
        work_info = random.choice(WORK_TYPES_BY_DEPT[dept])
        work_type, crew_type, equip, default_dur = work_info

        # Duration variance
        dur = max(45, default_dur + random.choice([-30, -15, 0, 0, 15, 30]))

        # Random date across 60 days
        date_offset = random.randint(0, 60)
        curr_date = base_date + timedelta(days=date_offset)
        day_of_week = DAYS_OF_WEEK[curr_date.weekday()]
        date_str = curr_date.strftime("%Y-%m-%d")

        # Candidate time window
        win_name, win_start_str, win_end_str, win_start_m, win_end_m, base_avail, avg_trains_lambda = random.choice(TIME_WINDOWS)

        # Random start minute within window
        max_start = max(win_start_m, win_end_m - dur)
        if max_start <= win_start_m:
            cand_start_m = win_start_m
        else:
            cand_start_m = random.randint(win_start_m, max_start)
        cand_end_m = cand_start_m + dur

        cand_start_str = minutes_to_hhmm(cand_start_m)
        cand_end_str = minutes_to_hhmm(cand_end_m)

        # Check trains from timetable
        sec_trains = [t for t in trains if t.get("section_id") == sec.get("section_id")]
        
        train_count = 0
        vip_count = 0
        freight_count = 0
        passenger_count = 0
        max_prio = 1.0

        for t in sec_trains:
            try:
                dor = t.get("days_of_run", "")
                if dor and day_of_week not in dor:
                    continue

                arr_parts = t.get("arrival_time", "00:00").split(":")
                dep_parts = t.get("departure_time", "00:00").split(":")
                arr_m = int(arr_parts[0]) * 60 + int(arr_parts[1])
                dep_m = int(dep_parts[0]) * 60 + int(dep_parts[1])
                if dep_m < arr_m:
                    dep_m += 1440

                if arr_m < cand_end_m and dep_m > cand_start_m:
                    train_count += 1
                    prio = float(t.get("priority_score", 5))
                    if prio > max_prio:
                        max_prio = prio
                    if prio >= 9.0:
                        vip_count += 1
                    ttype = t.get("train_type", "express").lower()
                    if "freight" in ttype or "rake" in ttype or "goods" in ttype:
                        freight_count += 1
                    else:
                        passenger_count += 1
            except Exception:
                continue

        # Adjust for peak vs night traffic
        if train_count == 0 and "PEAK" in win_name:
            train_count = random.randint(2, 5)
            passenger_count = train_count - 1
            freight_count = 1
            vip_count = 1 if random.random() < 0.4 else 0
            max_prio = 10.0 if vip_count > 0 else random.choice([7.0, 8.0])
        elif train_count == 0 and "NIGHT" in win_name:
            if random.random() < 0.25:
                train_count = 1
                freight_count = 1
                max_prio = 3.0

        # Section Availability Score
        if train_count == 0:
            avail_score = round(random.uniform(0.92, 1.0), 3)
        elif train_count == 1:
            avail_score = round(random.uniform(0.78, 0.88), 3)
        elif train_count == 2:
            avail_score = round(random.uniform(0.50, 0.68), 3)
        elif train_count == 3:
            avail_score = round(random.uniform(0.25, 0.45), 3)
        else:
            avail_score = round(random.uniform(0.05, 0.20), 3)

        if vip_count > 0:
            avail_score = max(0.05, round(avail_score - 0.25, 3))

        # Maintenance Priority
        prio_choice = random.choices(
            ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
            weights=[0.15, 0.35, 0.35, 0.15]
        )[0]

        if prio_choice == "CRITICAL":
            prio_score = random.randint(86, 100)
        elif prio_choice == "HIGH":
            prio_score = random.randint(70, 85)
        elif prio_choice == "MEDIUM":
            prio_score = random.randint(45, 69)
        else:
            prio_score = random.randint(20, 44)

        existing_blocks_count = 1 if random.random() < 0.18 else 0
        other_dept_act = 1 if random.random() < 0.22 else 0
        hist_delay_avg = round(random.uniform(1.5, 12.0), 1)

        # Outcomes
        if train_count == 0:
            actual_affected = 0
            actual_delay = 0.0
        else:
            base_train_delay = random.uniform(8.0, 18.0)
            actual_affected = train_count
            if vip_count > 0:
                actual_delay = round(vip_count * random.uniform(25.0, 45.0) + (train_count - vip_count) * base_train_delay, 1)
            else:
                actual_delay = round(train_count * base_train_delay + (dur / 60.0) * 3.0, 1)

        if existing_blocks_count > 0:
            actual_delay = round(actual_delay + random.uniform(15.0, 30.0), 1)
            actual_affected += 1

        # Composite Block Efficiency / Optimization Score (0 - 100)
        raw_score = 100.0
        raw_score -= (actual_affected * 12.0)
        raw_score -= (actual_delay * 1.2)
        raw_score += (avail_score * 20.0 - 10.0)
        if other_dept_act == 1 and dept in ["Engineering", "Traction"]:
            raw_score += 10.0
        if existing_blocks_count > 0:
            raw_score -= 25.0
        if vip_count > 0:
            raw_score -= 35.0

        if prio_score >= 80 and actual_affected == 0:
            raw_score += 6.0

        efficiency_score = round(max(5.0, min(99.0, raw_score + random.uniform(-2.5, 2.5))), 1)
        is_optimal = (efficiency_score >= 85.0 and actual_affected <= 1 and vip_count == 0 and existing_blocks_count == 0)

        records.append({
            "block_id": f"HIST-BLK-{i:05d}",
            "section_id": sec.get("section_id", "SEC_C01_01"),
            "section_name": sec.get("section_name", "Vijayawada - Tenali"),
            "division": sec.get("division", "Vijayawada"),
            "department": dept,
            "work_type": work_type,
            "work_duration_minutes": dur,
            "date": date_str,
            "day_of_week": day_of_week,
            "requested_time_window": win_name,
            "candidate_start_time": cand_start_str,
            "candidate_end_time": cand_end_str,
            "candidate_start_minute": cand_start_m,
            "candidate_end_minute": cand_end_m,
            "train_count_in_window": train_count,
            "vip_train_count": vip_count,
            "freight_train_count": freight_count,
            "passenger_train_count": passenger_count,
            "max_train_priority": max_prio,
            "corridor_availability_score": avail_score,
            "existing_scheduled_blocks_count": existing_blocks_count,
            "other_department_activity": other_dept_act,
            "crew_type_required": crew_type,
            "equipment_required": equip,
            "maintenance_priority": prio_choice,
            "priority_score": prio_score,
            "historical_avg_delay_minutes": hist_delay_avg,
            "actual_affected_trains": actual_affected,
            "actual_delay_caused_minutes": actual_delay,
            "block_efficiency_score": efficiency_score,
            "is_optimal_slot": 1 if is_optimal else 0
        })

    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)
    with open(OUTPUT_CSV, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)

    metadata = {
        "dataset_name": "Historical Train Maintenance Block Planning Scenarios",
        "description": "Synthetic demonstration dataset modeling South Coast Railway corridors, train timetable density, operational possession conflicts, delays, and block optimization scores.",
        "created_at": datetime.now().isoformat(),
        "total_records": len(records),
        "fields_count": len(fieldnames),
        "field_names": fieldnames,
        "departments": DEPARTMENTS,
        "corridors_covered": list(set(r["division"] for r in records)),
        "avg_efficiency_score": round(sum(r["block_efficiency_score"] for r in records) / len(records), 2),
        "zero_clash_blocks_pct": round(100.0 * sum(1 for r in records if r["actual_affected_trains"] == 0) / len(records), 2),
        "synthetic_prototype_notice": "Synthetically generated for Smart India Hackathon 2026 RailBlock AI decision-support prototype. Human railway authority approval required."
    }
    with open(OUTPUT_METADATA, mode="w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"[OK] Generated {len(records)} historical block records to {OUTPUT_CSV}")
    print(f"[OK] Saved dataset metadata to {OUTPUT_METADATA}")
    return OUTPUT_CSV


if __name__ == "__main__":
    generate_dataset(3500)
