from database import db
from priority_engine import priority_engine

DEPARTMENTS = [
    {
        "id": "DEP_TRACK",
        "name": "Civil Engineering (P-Way / Track)",
        "silo_system": "TDMS",
        "color_code": "#EF4444",
        "description": "Track maintenance, deep screening, tamping, USFD flaw detection and rail renewals."
    },
    {
        "id": "DEP_SIGNAL",
        "name": "Signal & Telecommunications (S&T)",
        "silo_system": "SMMS",
        "color_code": "#3B82F6",
        "description": "Electronic interlocking, point machine overhauls, track circuits and axle counters."
    },
    {
        "id": "DEP_TRD",
        "name": "Electrical Traction Distribution (TRD / OHE)",
        "silo_system": "SMMS",
        "color_code": "#F59E0B",
        "description": "Overhead Equipment (OHE) contact wire tensioning, isolators and substations."
    },
    {
        "id": "DEP_BRIDGE",
        "name": "Bridges & Structures Engineering",
        "silo_system": "BDMS",
        "color_code": "#8B5CF6",
        "description": "Steel girder inspection, bearing rehabilitation and substructure scour surveys."
    },
    {
        "id": "DEP_OPS",
        "name": "Operating & Freight Traffic",
        "silo_system": "COA",
        "color_code": "#10B981",
        "description": "Freight corridors, loop clearance, rake positioning and line capacity coordination."
    },
    {
        "id": "DEP_TRAIN_MGMT",
        "name": "Train Management & Punctuality",
        "silo_system": "TMS",
        "color_code": "#EC4899",
        "description": "Timetable management, passenger express paths and punctuality monitoring."
    }
]

CORRIDORS = [
    {
        "id": "C1",
        "code": "NDLS-GZB",
        "name": "New Delhi – Ghaziabad Main Line",
        "division": "Delhi (DLI)",
        "zone": "Northern Railway (NR)",
        "length_km": 25.5,
        "track_type": "QUADRUPLE",
        "gmt_annual": 78.5,
        "speed_limit_kmph": 130
    },
    {
        "id": "C2",
        "code": "NDLS-PWL",
        "name": "New Delhi – Palwal Suburban Section",
        "division": "Delhi (DLI)",
        "zone": "Northern Railway (NR)",
        "length_km": 60.0,
        "track_type": "QUADRUPLE",
        "gmt_annual": 82.0,
        "speed_limit_kmph": 130
    },
    {
        "id": "C3",
        "code": "BRC-ST",
        "name": "Vadodara – Surat High-Density Trunk",
        "division": "Vadodara (BRC)",
        "zone": "Western Railway (WR)",
        "length_km": 129.0,
        "track_type": "DOUBLE_LINE",
        "gmt_annual": 94.0,
        "speed_limit_kmph": 160
    },
    {
        "id": "C4",
        "code": "HWH-BWN",
        "name": "Howrah – Bardhaman Chord Line",
        "division": "Howrah (HWH)",
        "zone": "Eastern Railway (ER)",
        "length_km": 95.0,
        "track_type": "QUADRUPLE",
        "gmt_annual": 72.0,
        "speed_limit_kmph": 130
    },
    {
        "id": "C5",
        "code": "MAS-AJJ",
        "name": "Chennai Central – Arakkonam Corridor",
        "division": "Chennai (MAS)",
        "zone": "Southern Railway (SR)",
        "length_km": 68.5,
        "track_type": "QUADRUPLE",
        "gmt_annual": 66.0,
        "speed_limit_kmph": 130
    },
    {
        "id": "C6",
        "code": "PNVL-ROHA",
        "name": "Panvel – Roha Konkan Gateway",
        "division": "Mumbai (BB)",
        "zone": "Central Railway (CR)",
        "length_km": 79.0,
        "track_type": "DOUBLE_LINE",
        "gmt_annual": 54.0,
        "speed_limit_kmph": 110
    }
]

ASSETS = [
    {"id": "A-TRK-001", "corridor_id": "C1", "name": "Turnout No. 101B (Diamond Crossing)", "asset_type": "TRACK_TURNOUT", "km_post": "KM 12/4", "installed_year": 2018, "condition_rating": "POOR"},
    {"id": "A-SGT-002", "corridor_id": "C1", "name": "Point Machine Motor PM-101B", "asset_type": "POINT_MACHINE", "km_post": "KM 12/6", "installed_year": 2019, "condition_rating": "FAIR"},
    {"id": "A-TRD-003", "corridor_id": "C1", "name": "OHE Tension Section Cantilever #24", "asset_type": "OHE_CATENARY", "km_post": "KM 14/2", "installed_year": 2015, "condition_rating": "POOR"},
    {"id": "A-BRG-004", "corridor_id": "C4", "name": "Yamuna Rail Bridge Steel Girder #12", "asset_type": "BRIDGE_GIRDER", "km_post": "KM 45/8", "installed_year": 2008, "condition_rating": "POOR"},
    {"id": "A-TRK-005", "corridor_id": "C2", "name": "Ballast Bed Track Km 28-31", "asset_type": "BALLAST_BED", "km_post": "KM 28/0", "installed_year": 2017, "condition_rating": "CRITICAL"},
    {"id": "A-SGT-006", "corridor_id": "C3", "name": "Dual Axle Counter System DAC-54", "asset_type": "AXLE_COUNTER", "km_post": "KM 62/1", "installed_year": 2020, "condition_rating": "GOOD"},
    {"id": "A-TRD-007", "corridor_id": "C3", "name": "Neutral Section Insulator NS-09", "asset_type": "OHE_INSULATOR", "km_post": "KM 78/3", "installed_year": 2016, "condition_rating": "CRITICAL"},
    {"id": "A-TRK-008", "corridor_id": "C5", "name": "Curved Track High Rail Flange Km 34", "asset_type": "CURVE_RAIL", "km_post": "KM 34/2", "installed_year": 2019, "condition_rating": "FAIR"},
]

TIMETABLE_WINDOWS = [
    {"id": "TT-01", "corridor_id": "C1", "day_of_week": "Monday", "train_number": "22436", "train_name": "Vande Bharat Express (NDLS-BSB)", "train_type": "VANDE_BHARAT", "blackout_start_minute": 360, "blackout_end_minute": 450, "is_critical_punctuality": True},
    {"id": "TT-02", "corridor_id": "C1", "day_of_week": "Tuesday", "train_number": "12004", "train_name": "Lucknow Shatabdi Express", "train_type": "SHATABDI", "blackout_start_minute": 370, "blackout_end_minute": 460, "is_critical_punctuality": True},
    {"id": "TT-03", "corridor_id": "C2", "day_of_week": "Monday", "train_number": "12952", "train_name": "Mumbai Rajdhani Express", "train_type": "RAJDHANI", "blackout_start_minute": 990, "blackout_end_minute": 1080, "is_critical_punctuality": True},
    {"id": "TT-04", "corridor_id": "C3", "day_of_week": "Wednesday", "train_number": "20901", "train_name": "Vande Bharat Express (MMCT-GIMB)", "train_type": "VANDE_BHARAT", "blackout_start_minute": 420, "blackout_end_minute": 510, "is_critical_punctuality": True},
    {"id": "TT-05", "corridor_id": "C4", "day_of_week": "Thursday", "train_number": "12301", "train_name": "Howrah Rajdhani Express", "train_type": "RAJDHANI", "blackout_start_minute": 1000, "blackout_end_minute": 1090, "is_critical_punctuality": True},
    {"id": "TT-06", "corridor_id": "C5", "day_of_week": "Friday", "train_number": "20607", "train_name": "Vande Bharat Express (MAS-MYS)", "train_type": "VANDE_BHARAT", "blackout_start_minute": 330, "blackout_end_minute": 420, "is_critical_punctuality": True},
]

DEPARTMENT_RESOURCES = [
    {"id": "RES-01", "department_id": "DEP_TRACK", "resource_type": "CSM_TAMPING_09", "resource_name": "Plasser CSM 09-32 Continuous Tamping Machine #44", "total_available_units": 1, "hourly_cost_inr": 28000.0},
    {"id": "RES-02", "department_id": "DEP_TRACK", "resource_type": "BCM_CLEANER", "resource_name": "Ballast Cleaning Machine BCM-800 #12", "total_available_units": 1, "hourly_cost_inr": 35000.0},
    {"id": "RES-03", "department_id": "DEP_TRD", "resource_type": "TOWER_WAGON", "resource_name": "8-Wheeler Diesel-Electric TRD Tower Wagon TW-204", "total_available_units": 2, "hourly_cost_inr": 12000.0},
    {"id": "RES-04", "department_id": "DEP_BRIDGE", "resource_type": "CRANE_140T", "resource_name": "Gottwald 140-Tonne Breakdown Rail Crane", "total_available_units": 1, "hourly_cost_inr": 45000.0},
    {"id": "RES-05", "department_id": "DEP_SIGNAL", "resource_type": "SGT_TEST_RACK", "resource_name": "Electronic Interlocking Mobile Test Rig", "total_available_units": 3, "hourly_cost_inr": 8000.0},
]

# 24 Deterministic Realistic Maintenance Work Requests from Siloed Systems
INITIAL_WORK_ITEMS = [
    {
        "id": "W001",
        "source_system": "TDMS",
        "department_id": "DEP_TRACK",
        "corridor_id": "C1",
        "asset_id": "A-TRK-001",
        "title": "Turnout No. 101B Tongue Rail Replacement & Tamping",
        "description": "Ultrasonic test detected 8mm vertical wear on switch tongue rail. Requires heavy tamping after renewal.",
        "work_type": "TAMPING",
        "duration_minutes": 180,
        "required_resource": "CSM_TAMPING_09",
        "requested_date": "2026-09-08",
        "requested_day": "Tuesday",
        "requested_start_hour": 10,
        "requested_end_hour": 13,
        "safety_risk_rating": 23,
        "asset_criticality_rating": 20,
        "overdue_days": 14,
        "failure_history_count": 3,
        "failure_probability": 0.82,
        "traffic_density_factor": 1.4,
        "deferral_consequence_rating": 9
    },
    {
        "id": "W002",
        "source_system": "SMMS",
        "department_id": "DEP_SIGNAL",
        "corridor_id": "C1",
        "asset_id": "A-SGT-002",
        "title": "Point Machine PM-101B Obstruction Test & Motor Overhaul",
        "description": "Periodic inspection of point operating mechanism and detection contacts at diamond junction.",
        "work_type": "POINT_OVERHAUL",
        "duration_minutes": 120,
        "required_resource": "SGT_TEST_RACK",
        "requested_date": "2026-09-08",
        "requested_day": "Tuesday",
        "requested_start_hour": 11,
        "requested_end_hour": 13,
        "safety_risk_rating": 18,
        "asset_criticality_rating": 17,
        "overdue_days": 10,
        "failure_history_count": 2,
        "failure_probability": 0.65,
        "traffic_density_factor": 1.3,
        "deferral_consequence_rating": 7
    },
    {
        "id": "W003",
        "source_system": "SMMS",
        "department_id": "DEP_TRD",
        "corridor_id": "C1",
        "asset_id": "A-TRD-003",
        "title": "OHE Catenary Wire Sag Calibration & Isolator Checking",
        "description": "Inspection of overhead contact wire tension and droppers between mast 14/1 and 14/18.",
        "work_type": "OHE_MAINTENANCE",
        "duration_minutes": 180,
        "required_resource": "TOWER_WAGON",
        "requested_date": "2026-09-08",
        "requested_day": "Tuesday",
        "requested_start_hour": 10,
        "requested_end_hour": 13,
        "safety_risk_rating": 21,
        "asset_criticality_rating": 18,
        "overdue_days": 21,
        "failure_history_count": 2,
        "failure_probability": 0.74,
        "traffic_density_factor": 1.4,
        "deferral_consequence_rating": 8
    },
    {
        "id": "W004",
        "source_system": "TDMS",
        "department_id": "DEP_TRACK",
        "corridor_id": "C2",
        "asset_id": "A-TRK-005",
        "title": "Deep Ballast Screening & Track Lifting Km 28-31",
        "description": "Caked ballast bed causing poor track elasticity and recurrent twist faults under 25T axle load freights.",
        "work_type": "DEEP_SCREENING",
        "duration_minutes": 240,
        "required_resource": "BCM_CLEANER",
        "requested_date": "2026-09-07",
        "requested_day": "Monday",
        "requested_start_hour": 10,
        "requested_end_hour": 14,
        "safety_risk_rating": 24,
        "asset_criticality_rating": 19,
        "overdue_days": 28,
        "failure_history_count": 4,
        "failure_probability": 0.88,
        "traffic_density_factor": 1.5,
        "deferral_consequence_rating": 9
    },
    {
        "id": "W005",
        "source_system": "TDMS",
        "department_id": "DEP_TRACK",
        "corridor_id": "C3",
        "asset_id": "A-TRK-008",
        "title": "High-Speed Curve Rail Grinding & Profiling Km 34",
        "description": "Rail surface micro-cracks and corrugation removal to prevent rolling contact fatigue (RCF).",
        "work_type": "RAIL_GRINDING",
        "duration_minutes": 180,
        "required_resource": "CSM_TAMPING_09",
        "requested_date": "2026-09-07",
        "requested_day": "Monday",
        "requested_start_hour": 10,
        "requested_end_hour": 13,
        "safety_risk_rating": 17,
        "asset_criticality_rating": 16,
        "overdue_days": 7,
        "failure_history_count": 1,
        "failure_probability": 0.45,
        "traffic_density_factor": 1.5,
        "deferral_consequence_rating": 6
    },
    {
        "id": "W006",
        "source_system": "SMMS",
        "department_id": "DEP_TRD",
        "corridor_id": "C3",
        "asset_id": "A-TRD-007",
        "title": "Neutral Section Insulator Overhaul & Flashover Inspection",
        "description": "Critical phase-break insulator experiencing carbon deposits from ceramic arcing horns.",
        "work_type": "OHE_MAINTENANCE",
        "duration_minutes": 150,
        "required_resource": "TOWER_WAGON",
        "requested_date": "2026-09-09",
        "requested_day": "Wednesday",
        "requested_start_hour": 14,
        "requested_end_hour": 17,
        "safety_risk_rating": 22,
        "asset_criticality_rating": 19,
        "overdue_days": 18,
        "failure_history_count": 3,
        "failure_probability": 0.81,
        "traffic_density_factor": 1.4,
        "deferral_consequence_rating": 8
    },
    {
        "id": "W007",
        "source_system": "BDMS",
        "department_id": "DEP_BRIDGE",
        "corridor_id": "C4",
        "asset_id": "A-BRG-004",
        "title": "Steel Girder Anti-Corrosive Epoxy Painting & Rivet Testing",
        "description": "Major rail bridge girder maintenance requiring OHE dead-wire clearance to prevent electrocution.",
        "work_type": "GIRDER_PAINTING",
        "duration_minutes": 240,
        "required_resource": "CRANE_140T",
        "requested_date": "2026-09-10",
        "requested_day": "Thursday",
        "requested_start_hour": 10,
        "requested_end_hour": 14,
        "safety_risk_rating": 19,
        "asset_criticality_rating": 18,
        "overdue_days": 15,
        "failure_history_count": 1,
        "failure_probability": 0.52,
        "traffic_density_factor": 1.3,
        "deferral_consequence_rating": 7
    },
    {
        "id": "W008",
        "source_system": "SMMS",
        "department_id": "DEP_TRD",
        "corridor_id": "C4",
        "asset_id": "A-TRD-003",
        "title": "Bridge Substation Feeder Wire Inspection (OHE Power Block)",
        "description": "Isolating 25kV feeding line across bridge span to support structural maintenance.",
        "work_type": "OHE_MAINTENANCE",
        "duration_minutes": 210,
        "required_resource": "TOWER_WAGON",
        "requested_date": "2026-09-10",
        "requested_day": "Thursday",
        "requested_start_hour": 10,
        "requested_end_hour": 14,
        "safety_risk_rating": 16,
        "asset_criticality_rating": 15,
        "overdue_days": 5,
        "failure_history_count": 0,
        "failure_probability": 0.35,
        "traffic_density_factor": 1.3,
        "deferral_consequence_rating": 5
    },
    {
        "id": "W009",
        "source_system": "SMMS",
        "department_id": "DEP_SIGNAL",
        "corridor_id": "C3",
        "asset_id": "A-SGT-006",
        "title": "Dual Axle Counter Wheel Sensor Tuning Km 62",
        "description": "Intermittent track occupancy false-alarms reported during heavy monsoon dampness.",
        "work_type": "TRACK_CIRCUIT_TEST",
        "duration_minutes": 120,
        "required_resource": "SGT_TEST_RACK",
        "requested_date": "2026-09-09",
        "requested_day": "Wednesday",
        "requested_start_hour": 14,
        "requested_end_hour": 16,
        "safety_risk_rating": 20,
        "asset_criticality_rating": 17,
        "overdue_days": 12,
        "failure_history_count": 3,
        "failure_probability": 0.72,
        "traffic_density_factor": 1.4,
        "deferral_consequence_rating": 7
    },
    {
        "id": "W010",
        "source_system": "TDMS",
        "department_id": "DEP_TRACK",
        "corridor_id": "C5",
        "asset_id": "A-TRK-008",
        "title": "Ultrasonic Rail Flaw Detection (USFD) Trolley Run",
        "description": "Continuous scanning of both up and down lines for internal transverse fatigue fractures.",
        "work_type": "ULTRASONIC_USFD",
        "duration_minutes": 180,
        "required_resource": "GANG_CREW",
        "requested_date": "2026-09-11",
        "requested_day": "Friday",
        "requested_start_hour": 10,
        "requested_end_hour": 13,
        "safety_risk_rating": 21,
        "asset_criticality_rating": 16,
        "overdue_days": 9,
        "failure_history_count": 2,
        "failure_probability": 0.68,
        "traffic_density_factor": 1.2,
        "deferral_consequence_rating": 8
    },
    {
        "id": "W011",
        "source_system": "COA",
        "department_id": "DEP_OPS",
        "corridor_id": "C2",
        "asset_id": "A-TRK-005",
        "title": "Freight Loop Line Ballast Profiling & Buffer Stop Alignment",
        "description": "Heavy container traffic marshalling yard loop line reconditioning.",
        "work_type": "BALLAST_REGULATING",
        "duration_minutes": 150,
        "required_resource": "GANG_CREW",
        "requested_date": "2026-09-11",
        "requested_day": "Friday",
        "requested_start_hour": 14,
        "requested_end_hour": 17,
        "safety_risk_rating": 12,
        "asset_criticality_rating": 13,
        "overdue_days": 4,
        "failure_history_count": 0,
        "failure_probability": 0.28,
        "traffic_density_factor": 1.1,
        "deferral_consequence_rating": 4
    },
    {
        "id": "W012",
        "source_system": "BDMS",
        "department_id": "DEP_BRIDGE",
        "corridor_id": "C6",
        "asset_id": "A-BRG-004",
        "title": "Bridge Pier Scour Depth Sensor Inspection",
        "description": "Post-monsoon river bed sounding and pier concrete jacket assessment.",
        "work_type": "PIER_SCOUR_INSPECTION",
        "duration_minutes": 120,
        "required_resource": "GANG_CREW",
        "requested_date": "2026-09-12",
        "requested_day": "Saturday",
        "requested_start_hour": 10,
        "requested_end_hour": 12,
        "safety_risk_rating": 15,
        "asset_criticality_rating": 14,
        "overdue_days": 6,
        "failure_history_count": 1,
        "failure_probability": 0.40,
        "traffic_density_factor": 1.0,
        "deferral_consequence_rating": 5
    }
]


def seed_database():
    """Seeds initial synthetic dataset into database."""
    print("[SEED] Seeding departments...")
    for d in DEPARTMENTS:
        conn = db._get_conn()
        cur = conn.cursor()
        cur.execute(
            "INSERT OR REPLACE INTO departments (id, name, silo_system, color_code, description) VALUES (?, ?, ?, ?, ?)",
            (d["id"], d["name"], d["silo_system"], d["color_code"], d["description"])
        )
        conn.commit()
        conn.close()

    print("[SEED] Seeding corridors...")
    for c in CORRIDORS:
        conn = db._get_conn()
        cur = conn.cursor()
        cur.execute(
            """INSERT OR REPLACE INTO corridors (id, code, name, division, zone, length_km, track_type, gmt_annual, speed_limit_kmph)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (c["id"], c["code"], c["name"], c["division"], c["zone"], c["length_km"], c["track_type"], c["gmt_annual"], c["speed_limit_kmph"])
        )
        conn.commit()
        conn.close()

    print("[SEED] Seeding assets...")
    for a in ASSETS:
        conn = db._get_conn()
        cur = conn.cursor()
        cur.execute(
            """INSERT OR REPLACE INTO assets (id, corridor_id, name, asset_type, km_post, installed_year, condition_rating)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (a["id"], a["corridor_id"], a["name"], a["asset_type"], a["km_post"], a["installed_year"], a["condition_rating"])
        )
        conn.commit()
        conn.close()

    print("[SEED] Seeding timetable blackout windows...")
    for tt in TIMETABLE_WINDOWS:
        conn = db._get_conn()
        cur = conn.cursor()
        cur.execute(
            """INSERT OR REPLACE INTO timetable_windows (id, corridor_id, day_of_week, train_number, train_name, train_type, blackout_start_minute, blackout_end_minute, is_critical_punctuality)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (tt["id"], tt["corridor_id"], tt["day_of_week"], tt["train_number"], tt["train_name"], tt["train_type"], tt["blackout_start_minute"], tt["blackout_end_minute"], 1 if tt["is_critical_punctuality"] else 0)
        )
        conn.commit()
        conn.close()

    print("[SEED] Seeding department resources...")
    for r in DEPARTMENT_RESOURCES:
        conn = db._get_conn()
        cur = conn.cursor()
        cur.execute(
            """INSERT OR REPLACE INTO department_resources (id, department_id, resource_type, resource_name, total_available_units, hourly_cost_inr)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (r["id"], r["department_id"], r["resource_type"], r["resource_name"], r["total_available_units"], r["hourly_cost_inr"])
        )
        conn.commit()
        conn.close()

    print("[SEED] Seeding work items with explainable priority scores...")
    for it in INITIAL_WORK_ITEMS:
        # Calculate transparent score
        score, tier, factors, justifications = priority_engine.compute_priority(it)
        it["priority_score"] = score
        it["priority_tier"] = tier
        it["priority_factors"] = factors
        db.insert_work_item(it)

        # Audit initial ingestion
        db.record_audit(
            event_type="INGESTION",
            entity_type="WORK_ITEM",
            entity_id=it["id"],
            action=f"Ingested {it['work_type']} request from {it['source_system']}",
            details={
                "source_system": it["source_system"],
                "department": it["department_id"],
                "corridor": it["corridor_id"],
                "initial_priority_score": score,
                "tier": tier
            },
            user_id=f"{it['source_system']}_GATEWAY"
        )

    print("[SEED] Initial synthetic Indian Railways database successfully populated.")


if __name__ == "__main__":
    seed_database()
