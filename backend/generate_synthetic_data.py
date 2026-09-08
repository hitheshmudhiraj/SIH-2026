"""
Synthetic Data Generator for Indian Railways Maintenance Block Planning (SIH26027)
South Coast Railway (SCoR) & Southern Corridors context.

Generates realistic CSV datasets in data/ (and mirrored in data/02_reference/ if needed):
1. sections.csv
2. timetable_trains.csv
3. maintenance_tasks.csv
4. resources.csv
5. existing_blocks_baseline.csv
"""

import os
import csv
import json
import random
from datetime import datetime, timedelta

random.seed(42)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")
REF_DIR = os.path.join(DATA_DIR, "02_reference")
COA_DIR = os.path.join(DATA_DIR, "01_raw_sources", "COA")

def ensure_directories():
    for d in [DATA_DIR, REF_DIR, COA_DIR, os.path.join(DATA_DIR, "03_unified"), os.path.join(DATA_DIR, "04_outputs", "plans")]:
        os.makedirs(d, exist_ok=True)
    print(f"[INIT] Verified directories under {DATA_DIR}")

# ==========================================
# 1. SECTIONS (32 Sections across 4 Corridors)
# ==========================================
SECTIONS_SPEC = [
    # C01: Vijayawada - Gudur (BZA Division, 8 sections)
    ("SEC_C01_01", "Vijayawada - Tenali", "BZA", "TEL", 31.5, "Vijayawada", "SCoR", 130, "double", True),
    ("SEC_C01_02", "Tenali - Bapatla", "TEL", "BPP", 42.5, "Vijayawada", "SCoR", 130, "double", True),
    ("SEC_C01_03", "Bapatla - Chirala", "BPP", "CLX", 15.2, "Vijayawada", "SCoR", 130, "double", True),
    ("SEC_C01_04", "Chirala - Ongole", "CLX", "OGL", 49.4, "Vijayawada", "SCoR", 130, "double", True),
    ("SEC_C01_05", "Ongole - Singarayakonda", "OGL", "SKM", 27.8, "Vijayawada", "SCoR", 130, "double", True),
    ("SEC_C01_06", "Singarayakonda - Kavali", "SKM", "KVZ", 37.9, "Vijayawada", "SCoR", 130, "double", True),
    ("SEC_C01_07", "Kavali - Nellore", "KVZ", "NLR", 50.7, "Vijayawada", "SCoR", 130, "double", True),
    ("SEC_C01_08", "Nellore - Gudur", "NLR", "GDR", 38.5, "Vijayawada", "SCoR", 130, "double", True),

    # C02: Visakhapatnam - Vijayawada (VSKP & BZA Divisions, 10 sections)
    ("SEC_C02_01", "Visakhapatnam - Duvvada", "VSKP", "DVD", 17.2, "Visakhapatnam", "SCoR", 110, "double", True),
    ("SEC_C02_02", "Duvvada - Anakapalle", "DVD", "AKP", 15.9, "Visakhapatnam", "SCoR", 130, "double", True),
    ("SEC_C02_03", "Anakapalle - Tuni", "AKP", "TUNI", 63.7, "Visakhapatnam", "SCoR", 130, "double", True),
    ("SEC_C02_04", "Tuni - Annavaram", "TUNI", "ANV", 16.8, "Vijayawada", "SCoR", 130, "double", True),
    ("SEC_C02_05", "Annavaram - Samalkot", "ANV", "SLO", 37.1, "Vijayawada", "SCoR", 130, "double", True),
    ("SEC_C02_06", "Samalkot - Rajahmundry", "SLO", "RJY", 50.2, "Vijayawada", "SCoR", 130, "double", True),
    ("SEC_C02_07", "Rajahmundry - Nidadavolu", "RJY", "NDD", 22.3, "Vijayawada", "SCoR", 130, "double", True),
    ("SEC_C02_08", "Nidadavolu - Tadepalligudem", "NDD", "TDD", 19.8, "Vijayawada", "SCoR", 130, "double", True),
    ("SEC_C02_09", "Tadepalligudem - Eluru", "TDD", "EE", 47.8, "Vijayawada", "SCoR", 130, "double", True),
    ("SEC_C02_10", "Eluru - Vijayawada", "EE", "BZA", 59.4, "Vijayawada", "SCoR", 130, "double", True),

    # C03: Guntur - Nandyal (GNT Division, 6 sections)
    ("SEC_C03_01", "Guntur - Narasaraopet", "GNT", "NRT", 45.4, "Guntur", "SCoR", 110, "single", True),
    ("SEC_C03_02", "Narasaraopet - Vinukonda", "NRT", "VKN", 37.5, "Guntur", "SCoR", 110, "single", True),
    ("SEC_C03_03", "Vinukonda - Donakonda", "VKN", "DKD", 37.8, "Guntur", "SCoR", 100, "single", True),
    ("SEC_C03_04", "Donakonda - Markapur Road", "DKD", "MRK", 24.2, "Guntur", "SCoR", 100, "single", True),
    ("SEC_C03_05", "Markapur Road - Giddalur", "MRK", "GID", 59.9, "Guntur", "SCoR", 90, "single", True),
    ("SEC_C03_06", "Giddalur - Nandyal", "GID", "NDL", 53.2, "Guntur", "SCoR", 100, "single", True),

    # C04: Guntakal - Renigunta (GTL Division, 8 sections)
    ("SEC_C04_01", "Guntakal - Gooty", "GTL", "GY", 28.5, "Guntakal", "SCoR", 130, "double", True),
    ("SEC_C04_02", "Gooty - Tadipatri", "GY", "TU", 48.3, "Guntakal", "SCoR", 130, "double", True),
    ("SEC_C04_03", "Tadipatri - Kondapuram", "TU", "KDP", 27.4, "Guntakal", "SCoR", 130, "double", True),
    ("SEC_C04_04", "Kondapuram - Yerraguntla", "KDP", "YA", 40.7, "Guntakal", "SCoR", 130, "double", True),
    ("SEC_C04_05", "Yerraguntla - Kadapa", "YA", "HX", 39.3, "Guntakal", "SCoR", 130, "double", True),
    ("SEC_C04_06", "Kadapa - Razampeta", "HX", "RJP", 50.8, "Guntakal", "SCoR", 130, "double", True),
    ("SEC_C04_07", "Razampeta - Koduru", "RJP", "KOU", 33.8, "Guntakal", "SCoR", 120, "double", True),
    ("SEC_C04_08", "Koduru - Renigunta", "KOU", "RU", 40.8, "Guntakal", "SCoR", 120, "double", True),
]

def generate_sections():
    rows = []
    for s_id, s_name, f_stn, t_stn, l_km, div, zone, spd, trk, elec in SECTIONS_SPEC:
        rows.append({
            "section_id": s_id,
            "section_name": s_name,
            "from_station": f_stn,
            "to_station": t_stn,
            "length_km": l_km,
            "division": div,
            "zone": zone,
            "max_speed_kmph": spd,
            "track_type": trk,
            "electrified": elec
        })
    return rows

# ==========================================
# 2. TIMETABLE TRAINS (160 Trains)
# ==========================================
TRAIN_TEMPLATES = [
    ("20833", "Vande Bharat Express", "express", 10),
    ("20834", "Vande Bharat Return", "express", 10),
    ("12727", "Godavari Express", "express", 8),
    ("12728", "Godavari Express Return", "express", 8),
    ("12841", "Coromandel Express", "express", 9),
    ("12842", "Coromandel Express Return", "express", 9),
    ("12711", "Pinakini SF Express", "express", 7),
    ("12712", "Pinakini SF Return", "express", 7),
    ("12759", "Charminar Express", "express", 8),
    ("12760", "Charminar Express Return", "express", 8),
    ("12615", "Grand Trunk Express", "express", 8),
    ("12616", "Grand Trunk Express Return", "express", 8),
    ("17255", "Narsapur - KCG Express", "express", 6),
    ("17256", "KCG - Narsapur Express", "express", 6),
    ("12703", "Falaknuma Express", "express", 8),
    ("12704", "Falaknuma Express Return", "express", 8),
    ("12861", "Visakhapatnam Link SF", "express", 7),
    ("12862", "Visakhapatnam Link SF Return", "express", 7),
    ("07461", "Vijayawada - Ongole MEMU", "passenger", 4),
    ("07462", "Ongole - Vijayawada MEMU", "passenger", 4),
    ("07881", "Rajahmundry - VSKP Passenger", "passenger", 4),
    ("07882", "VSKP - Rajahmundry Passenger", "passenger", 4),
    ("07765", "Guntur - Nandyal DMU", "passenger", 4),
    ("07766", "Nandyal - Guntur DMU", "passenger", 4),
    ("07577", "Guntakal - Renigunta Passenger", "passenger", 4),
    ("07578", "Renigunta - Guntakal Passenger", "passenger", 4),
    ("BOXN-Coal-712", "Krishnapatnam Coal Freight", "freight", 3),
    ("BCN-Food-409", "FCI Grain Rake", "freight", 3),
    ("BTPN-POL-108", "HPCL Petroleum Special", "freight", 3),
    ("RO-RO-Auto-205", "Automobile RO-RO Freight", "freight", 3),
    ("CONT-Container-991", "CONCOR Container Rake", "freight", 3),
    ("BOXN-IronOre-334", "NMDC Iron Ore Freight", "freight", 3),
]

DAYS_PATTERNS = [
    "Mon,Tue,Wed,Thu,Fri,Sat,Sun",
    "Mon,Wed,Fri",
    "Tue,Thu,Sat",
    "Mon,Tue,Wed,Thu,Fri",
    "Sat,Sun",
    "Mon,Tue,Thu,Sat,Sun",
]

def generate_timetable_trains(sections):
    trains = []
    # Ensure every section has 5 trains scheduled throughout the day (32 * 5 = 160 trains)
    for sec in sections:
        sec_id = sec["section_id"]
        for i in range(5):
            t_num_base, t_name_base, t_type, prio = random.choice(TRAIN_TEMPLATES)
            t_num = f"{t_num_base}-{sec_id[-2:]}{i}"
            t_name = f"{t_name_base} ({sec['from_station']}-{sec['to_station']})"
            days = random.choice(DAYS_PATTERNS)
            direction = "UP" if i % 2 == 0 else "DN"

            slot_choice = random.choices(
                ["morning_peak", "midday", "evening_peak", "night"],
                weights=[35, 25, 30, 10]
            )[0]

            if slot_choice == "morning_peak":
                h_start = random.randint(6, 9)
            elif slot_choice == "midday":
                h_start = random.randint(11, 15)
            elif slot_choice == "evening_peak":
                h_start = random.randint(17, 21)
            else:
                h_start = random.randint(0, 4)

            m_start = random.choice([0, 15, 30, 45])
            dur_mins = random.randint(25, 55)

            arr_m = (h_start * 60 + m_start) % 1440
            dep_m = (arr_m + dur_mins) % 1440

            arr_time_str = f"{arr_m // 60:02d}:{arr_m % 60:02d}"
            dep_time_str = f"{dep_m // 60:02d}:{dep_m % 60:02d}"

            trains.append({
                "train_number": t_num,
                "train_name": t_name,
                "train_type": t_type,
                "days_of_run": days,
                "section_id": sec_id,
                "arrival_time": arr_time_str,
                "departure_time": dep_time_str,
                "direction": direction,
                "priority_score": prio
            })
    return trains

# ==========================================
# 3. MAINTENANCE TASKS (420 Tasks)
# ==========================================
DEFECT_TYPES = {
    "Engineering": [
        ("rail_fracture", "track_segment", "critical", 90, 120, True, "track_gang"),
        ("weld_defect", "track_segment", "high", 75, 90, True, "track_gang"),
        ("track_geometry_defect", "track_segment", "high", 70, 150, True, "tamping_machine_crew"),
        ("ballast_deficiency", "track_segment", "medium", 50, 120, True, "tamping_machine_crew"),
        ("turnout_wear", "track_segment", "high", 72, 120, False, "track_gang"),
        ("joint_defect", "track_segment", "medium", 45, 60, False, "track_gang"),
        ("USFD_flaw_detected", "track_segment", "critical", 95, 120, False, "track_gang"),
        ("sleeper_renewal_needed", "track_segment", "medium", 55, 180, True, "track_gang"),
        ("cess_repair", "track_segment", "low", 25, 90, False, "track_gang"),
    ],
    "Traction": [
        ("OHE_catenary_wear", "OHE_span", "high", 78, 120, True, "tower_wagon_crew"),
        ("isolator_contact_burnt", "OHE_span", "critical", 88, 90, False, "OHE_gang"),
        ("dropper_wire_broken", "OHE_span", "high", 70, 60, False, "OHE_gang"),
        ("cantilever_misalignment", "OHE_span", "medium", 52, 90, True, "tower_wagon_crew"),
        ("contact_wire_height_irregularity", "OHE_span", "medium", 48, 120, True, "tower_wagon_crew"),
        ("mast_bonding_missing", "OHE_span", "low", 30, 45, False, "OHE_gang"),
        ("bird_nest_hazard_OHE", "OHE_span", "medium", 40, 45, False, "OHE_gang"),
        ("transformer_bushing_hotspot", "other", "critical", 85, 120, False, "OHE_gang"),
    ],
    "S&T": [
        ("point_machine_failure", "point_machine", "critical", 92, 90, False, "ST_gang"),
        ("track_circuit_glitch", "signal", "high", 80, 60, False, "ST_gang"),
        ("axle_counter_reset_fault", "signal", "high", 75, 60, False, "ST_gang"),
        ("signal_aspect_bulb_blown", "signal", "critical", 85, 45, False, "ST_gang"),
        ("interlocking_relay_chattering", "signal", "high", 74, 90, False, "ST_gang"),
        ("signalling_cable_damaged", "cable", "high", 70, 120, False, "ST_gang"),
        ("level_crossing_boom_sensor_error", "other", "critical", 90, 75, False, "ST_gang"),
        ("telecom_OFC_attenuation_high", "cable", "low", 35, 90, False, "ST_gang"),
    ]
}

def generate_maintenance_tasks(sections, count=420):
    tasks = []
    base_date = datetime(2026, 9, 7) # Current reference baseline

    for i in range(1, count + 1):
        task_id = f"TSK-2026-{i:04d}"
        dept = random.choices(["Engineering", "Traction", "S&T"], weights=[40, 30, 30])[0]
        defect_info = random.choice(DEFECT_TYPES[dept])
        defect_type, asset_type, sev_default, base_prio, dur_default, mach_req, crew_req = defect_info

        sec = random.choice(sections)
        sec_id = sec["section_id"]
        sec_len = sec["length_km"]

        from_km = round(random.uniform(0.5, max(1.0, sec_len - 2.0)), 2)
        to_km = round(from_km + random.uniform(0.1, 1.5), 2)

        sev = random.choices(
            ["critical", "high", "medium", "low"],
            weights=[12, 28, 42, 18]
        )[0]

        sev_boost = {"critical": 35, "high": 20, "medium": 5, "low": -15}[sev]
        calc_prio = min(100, max(10, base_prio + sev_boost + random.randint(-5, 5)))

        due_cat = random.choices(["overdue", "near", "future"], weights=[20, 40, 40])[0]
        if due_cat == "overdue":
            offset = random.randint(-20, -1)
        elif due_cat == "near":
            offset = random.randint(0, 7)
        else:
            offset = random.randint(8, 35)

        due_date = (base_date + timedelta(days=offset)).strftime("%Y-%m-%d")
        status = random.choices(["open", "in_progress", "completed"], weights=[72, 16, 12])[0]
        dur = max(30, dur_default + random.choice([-15, 0, 15, 30]))

        tasks.append({
            "task_id": task_id,
            "department": dept,
            "asset_type": asset_type,
            "section_id": sec_id,
            "from_km": from_km,
            "to_km": to_km,
            "defect_type": defect_type,
            "severity": sev,
            "priority_score": calc_prio,
            "due_date": due_date,
            "estimated_duration_minutes": dur,
            "crew_type_required": crew_req,
            "machine_required": mach_req,
            "status": status
        })
    return tasks

# ==========================================
# 4. RESOURCES (30 Resources)
# ==========================================
RESOURCES_SPEC = [
    # Engineering
    ("RES-ENG-GANG-01", "crew_gang", "Engineering", "Vijayawada", 48, "Mon,Tue,Wed,Thu,Fri,Sat", 1200, "Heavy P-Way Track Maintenance Gang"),
    ("RES-ENG-GANG-02", "crew_gang", "Engineering", "Vijayawada", 48, "Mon,Tue,Wed,Thu,Fri,Sat", 1200, "Turnout & Deep Screening Gang"),
    ("RES-ENG-GANG-03", "crew_gang", "Engineering", "Visakhapatnam", 48, "Mon,Tue,Wed,Thu,Fri,Sat", 1200, "Coastal Track Welders & USFD Crew"),
    ("RES-ENG-GANG-04", "crew_gang", "Engineering", "Guntur", 48, "Mon,Tue,Wed,Thu,Fri,Sat", 1150, "Single-line Gauge & Level Maintenance Gang"),
    ("RES-ENG-GANG-05", "crew_gang", "Engineering", "Guntakal", 48, "Mon,Tue,Wed,Thu,Fri,Sat", 1200, "Grand Trunk Section P-Way Gang"),
    ("RES-ENG-MACH-01", "machine", "Engineering", "Vijayawada", 36, "Mon,Tue,Wed,Thu,Fri", 4500, "CSM 09-32 Continuous Action Tamping Machine"),
    ("RES-ENG-MACH-02", "machine", "Engineering", "Visakhapatnam", 36, "Mon,Tue,Wed,Thu,Fri", 4800, "UNIMAT 08-4S Points & Crossing Tamper"),
    ("RES-ENG-MACH-03", "machine", "Engineering", "Guntakal", 36, "Mon,Tue,Wed,Thu,Fri", 4200, "Ballast Regulating Machine (BRM)"),
    ("RES-ENG-MACH-04", "machine", "Engineering", "Vijayawada", 30, "Mon,Tue,Wed,Thu,Fri", 5200, "Dynamic Track Stabilizer (DTS)"),
    ("RES-ENG-MACH-05", "machine", "Engineering", "Guntur", 30, "Tue,Wed,Thu,Fri,Sat", 4100, "Plasser Quick Relaying System (PQRS)"),

    # Traction
    ("RES-TRD-GANG-01", "crew_gang", "Traction", "Vijayawada", 48, "Mon,Tue,Wed,Thu,Fri,Sat", 1300, "25kV OHE Catenary Gang BZA"),
    ("RES-TRD-GANG-02", "crew_gang", "Traction", "Nellore", 48, "Mon,Tue,Wed,Thu,Fri,Sat", 1250, "South Sector Sub-station & OHE Maintenance Gang"),
    ("RES-TRD-GANG-03", "crew_gang", "Traction", "Visakhapatnam", 48, "Mon,Tue,Wed,Thu,Fri,Sat", 1300, "Coastal Corrosion Mitigation TRD Team"),
    ("RES-TRD-GANG-04", "crew_gang", "Traction", "Rajahmundry", 48, "Mon,Tue,Wed,Thu,Fri,Sat", 1250, "Godavari Basin Electrification Team"),
    ("RES-TRD-GANG-05", "crew_gang", "Traction", "Guntakal", 48, "Mon,Tue,Wed,Thu,Fri,Sat", 1250, "Rayalaseema Power Isolation Crew"),
    ("RES-TRD-MACH-01", "machine", "Traction", "Vijayawada", 36, "Mon,Tue,Wed,Thu,Fri,Sat", 3800, "8-Wheeler Self-Propelled OHE Inspection Car (DETC)"),
    ("RES-TRD-MACH-02", "machine", "Traction", "Visakhapatnam", 36, "Mon,Tue,Wed,Thu,Fri,Sat", 3800, "Hydraulic Elevated Platform Tower Wagon #04"),
    ("RES-TRD-MACH-03", "machine", "Traction", "Guntakal", 36, "Mon,Tue,Wed,Thu,Fri,Sat", 3600, "Heavy Contact Wire Tensioning Winch Wagon"),
    ("RES-TRD-MACH-04", "machine", "Traction", "Guntur", 30, "Mon,Tue,Wed,Thu,Fri", 3500, "Light Inspection Tower Car #11"),
    ("RES-TRD-MACH-05", "machine", "Traction", "Nellore", 30, "Mon,Wed,Fri,Sat,Sun", 3600, "Power Block Fast Response Wagon"),

    # S&T
    ("RES-SNT-GANG-01", "crew_gang", "S&T", "Vijayawada", 48, "Mon,Tue,Wed,Thu,Fri,Sat", 1100, "Electronic Interlocking Specialized Gang"),
    ("RES-SNT-GANG-02", "crew_gang", "S&T", "Ongole", 48, "Mon,Tue,Wed,Thu,Fri,Sat", 1100, "Track Circuit & Axle Counter Squad"),
    ("RES-SNT-GANG-03", "crew_gang", "S&T", "Visakhapatnam", 48, "Mon,Tue,Wed,Thu,Fri,Sat", 1150, "Yard Point Machine Overhaul Gang"),
    ("RES-SNT-GANG-04", "crew_gang", "S&T", "Guntur", 48, "Mon,Tue,Wed,Thu,Fri,Sat", 1050, "Tokenless Block Instrument & Signal Crew"),
    ("RES-SNT-GANG-05", "crew_gang", "S&T", "Kadapa", 48, "Mon,Tue,Wed,Thu,Fri,Sat", 1100, "Level Crossing & Boom Barrier Emergency Crew"),
    ("RES-SNT-MACH-01", "machine", "S&T", "Vijayawada", 36, "Mon,Tue,Wed,Thu,Fri", 2800, "Optical Time Domain Reflectometer (OTDR) Van"),
    ("RES-SNT-MACH-02", "machine", "S&T", "Visakhapatnam", 36, "Mon,Tue,Wed,Thu,Fri", 2900, "Point Machine Torque & Stroke Calibration Vehicle"),
    ("RES-SNT-MACH-03", "machine", "S&T", "Guntakal", 30, "Mon,Tue,Wed,Thu,Fri", 2500, "Digital Track Circuit Analyzer Unit"),
    ("RES-SNT-MACH-04", "machine", "S&T", "Rajahmundry", 30, "Tue,Wed,Thu,Fri,Sat", 2600, "Underground Cable Fault Locator Mobile Unit"),
    ("RES-SNT-MACH-05", "machine", "S&T", "Guntur", 30, "Mon,Wed,Fri,Sat,Sun", 2500, "Axle Counter Multi-Channel Testing Rig"),
]

def generate_resources():
    rows = []
    for r_id, r_type, dept, div, max_h, days, cost, spec in RESOURCES_SPEC:
        rows.append({
            "resource_id": r_id,
            "resource_type": r_type,
            "department": dept,
            "base_division": div,
            "max_hours_per_week": max_h,
            "available_days": days,
            "cost_per_hour": cost,
            "specialization": spec
        })
    return rows

# ==========================================
# 5. BASELINE BLOCKS (Naive Departmental Plan)
# ==========================================
def generate_baseline_blocks(sections, tasks, count=85):
    blocks = []
    base_date = datetime(2026, 9, 7)
    open_tasks = [t for t in tasks if t["status"] == "open"]

    for b_idx in range(1, count + 1):
        block_id = f"BLK-BASE-{b_idx:03d}"
        sec = random.choice(sections)
        sec_id = sec["section_id"]
        dept = random.choice(["Engineering", "Traction", "S&T"])

        day_offset = random.randint(0, 27)
        blk_date = (base_date + timedelta(days=day_offset)).strftime("%Y-%m-%d")

        time_slot = random.choices(
            [("06:00", "08:30"), ("09:00", "12:00"), ("13:00", "15:30"), ("16:00", "18:30"), ("01:00", "03:00")],
            weights=[25, 30, 20, 15, 10]
        )[0]
        start_time, end_time = time_slot

        if start_time in ["06:00", "09:00", "16:00"]:
            affected = random.randint(3, 7)
        else:
            affected = random.randint(0, 2)

        matching_tasks = [t["task_id"] for t in open_tasks if t["section_id"] == sec_id and t["department"] == dept]
        assigned_tasks = matching_tasks[:2] if matching_tasks else [f"TSK-2026-{random.randint(1, 400):04d}"]

        blocks.append({
            "block_id": block_id,
            "section_id": sec_id,
            "date": blk_date,
            "start_time": start_time,
            "end_time": end_time,
            "department": dept,
            "reason": f"Routine {dept} independent track possession",
            "train_paths_affected": affected,
            "task_ids": ",".join(assigned_tasks)
        })
    return blocks

# ==========================================
# WRITE HELPERS
# ==========================================
def write_csv(path, rows):
    if not rows:
        return
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"  -> Wrote {len(rows)} rows to {os.path.relpath(path, BASE_DIR)}")

def main():
    print("=========================================================")
    print("  RailBlock AI: Synthetic Dataset Generation Pipeline   ")
    print("=========================================================")
    ensure_directories()

    sections = generate_sections()
    trains = generate_timetable_trains(sections)
    tasks = generate_maintenance_tasks(sections, count=420)
    resources = generate_resources()
    baseline_blocks = generate_baseline_blocks(sections, tasks, count=85)

    # 1. Primary target data files (root data/)
    write_csv(os.path.join(DATA_DIR, "sections.csv"), sections)
    write_csv(os.path.join(DATA_DIR, "timetable_trains.csv"), trains)
    write_csv(os.path.join(DATA_DIR, "maintenance_tasks.csv"), tasks)
    write_csv(os.path.join(DATA_DIR, "resources.csv"), resources)
    write_csv(os.path.join(DATA_DIR, "existing_blocks_baseline.csv"), baseline_blocks)

    # 2. Mirror into data/02_reference/ and data/01_raw_sources/ for prototype compat
    write_csv(os.path.join(REF_DIR, "sections.csv"), sections)
    write_csv(os.path.join(REF_DIR, "maintenance_tasks.csv"), tasks)
    write_csv(os.path.join(REF_DIR, "resources.csv"), resources)
    write_csv(os.path.join(REF_DIR, "existing_blocks_baseline.csv"), baseline_blocks)
    write_csv(os.path.join(COA_DIR, "timetable_trains.csv"), trains)

    # 3. Derive Corridor Availability (30-min slots across 24-hr day)
    from app.services.corridor_availability import corridor_engine
    avail_file = corridor_engine.precompute_and_save_availability(start_date="2026-09-07", days_count=7)
    print(f"  • Corridor Avail:     Precomputed 30-min slots saved to {os.path.relpath(avail_file, BASE_DIR)}")

    print("\n[SUCCESS] Dataset Generation Summary:")
    print(f"  • Sections:           {len(sections)} sections across Vijayawada, Visakhapatnam, Guntur & Guntakal")
    print(f"  • Timetable Trains:   {len(trains)} scheduled train paths")
    print(f"  • Maintenance Tasks:  {len(tasks)} tasks (Engg: 40%, TRD: 30%, S&T: 30%)")
    print(f"  • Resources:          {len(resources)} gangs and specialized machinery")
    print(f"  • Baseline Blocks:    {len(baseline_blocks)} uncoordinated departmental block requests")
    print("=========================================================\n")

if __name__ == "__main__":
    main()

