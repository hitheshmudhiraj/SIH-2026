"""
Synthetic Andhra Pradesh Railway Dataset Generator
South Coast Railway (SCoR) 2026 Context
Generates realistic file-based data across TMS, SMMS, TDMS, COA, BDMS, and Reference directories.
"""
import os
import json
import csv
from datetime import datetime, timedelta

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")

def create_directories():
    dirs = [
        os.path.join(DATA_DIR, "01_raw_sources", "TMS"),
        os.path.join(DATA_DIR, "01_raw_sources", "SMMS"),
        os.path.join(DATA_DIR, "01_raw_sources", "TDMS"),
        os.path.join(DATA_DIR, "01_raw_sources", "COA"),
        os.path.join(DATA_DIR, "01_raw_sources", "BDMS"),
        os.path.join(DATA_DIR, "02_reference"),
        os.path.join(DATA_DIR, "03_unified"),
        os.path.join(DATA_DIR, "04_outputs", "audit_logs"),
        os.path.join(DATA_DIR, "04_outputs", "plans"),
        os.path.join(DATA_DIR, "04_outputs", "simulations"),
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)
    print("[INIT] Created data directory structure.")

def generate_reference_data():
    # 1. Stations in Andhra Pradesh (South Coast Railway)
    stations = [
        # C01: Vijayawada - Gudur (BZA Division)
        {"code": "BZA", "name": "Vijayawada Junction", "division": "Vijayawada", "zone": "SCoR", "km_mark": 0.0, "latitude": 16.5186, "longitude": 80.6198, "junction": True, "corridors": ["C01", "C02", "C03"]},
        {"code": "TEL", "name": "Tenali Junction", "division": "Vijayawada", "zone": "SCoR", "km_mark": 31.5, "latitude": 16.2428, "longitude": 80.6402, "junction": True, "corridors": ["C01", "C03"]},
        {"code": "BPP", "name": "Bapatla", "division": "Vijayawada", "zone": "SCoR", "km_mark": 74.0, "latitude": 15.9042, "longitude": 80.4674, "junction": False, "corridors": ["C01"]},
        {"code": "CLX", "name": "Chirala", "division": "Vijayawada", "zone": "SCoR", "km_mark": 89.2, "latitude": 15.8246, "longitude": 80.3522, "junction": False, "corridors": ["C01"]},
        {"code": "OGL", "name": "Ongole", "division": "Vijayawada", "zone": "SCoR", "km_mark": 138.6, "latitude": 15.5057, "longitude": 80.0499, "junction": False, "corridors": ["C01"]},
        {"code": "SKM", "name": "Singarayakonda", "division": "Vijayawada", "zone": "SCoR", "km_mark": 166.4, "latitude": 15.2505, "longitude": 80.0264, "junction": False, "corridors": ["C01"]},
        {"code": "KVZ", "name": "Kavali", "division": "Vijayawada", "zone": "SCoR", "km_mark": 204.3, "latitude": 14.9132, "longitude": 79.9912, "junction": False, "corridors": ["C01"]},
        {"code": "NLR", "name": "Nellore", "division": "Vijayawada", "zone": "SCoR", "km_mark": 255.0, "latitude": 14.4426, "longitude": 79.9865, "junction": False, "corridors": ["C01"]},
        {"code": "GDR", "name": "Gudur Junction", "division": "Vijayawada", "zone": "SCoR", "km_mark": 293.5, "latitude": 14.1463, "longitude": 79.8504, "junction": True, "corridors": ["C01", "C04"]},

        # C02: Visakhapatnam - Vijayawada (VSKP & BZA Divisions)
        {"code": "VSKP", "name": "Visakhapatnam Junction (HQ)", "division": "Visakhapatnam", "zone": "SCoR", "km_mark": 0.0, "latitude": 17.7215, "longitude": 83.2878, "junction": True, "corridors": ["C02"]},
        {"code": "DVD", "name": "Duvvada", "division": "Visakhapatnam", "zone": "SCoR", "km_mark": 17.2, "latitude": 17.7011, "longitude": 83.1554, "junction": False, "corridors": ["C02"]},
        {"code": "AKP", "name": "Anakapalle", "division": "Visakhapatnam", "zone": "SCoR", "km_mark": 33.1, "latitude": 17.6913, "longitude": 83.0039, "junction": False, "corridors": ["C02"]},
        {"code": "TUNI", "name": "Tuni", "division": "Vijayawada", "zone": "SCoR", "km_mark": 96.8, "latitude": 17.3562, "longitude": 82.5511, "junction": False, "corridors": ["C02"]},
        {"code": "ANV", "name": "Annavaram", "division": "Vijayawada", "zone": "SCoR", "km_mark": 113.6, "latitude": 17.2817, "longitude": 82.4087, "junction": False, "corridors": ["C02"]},
        {"code": "SLO", "name": "Samalkot Junction", "division": "Vijayawada", "zone": "SCoR", "km_mark": 150.7, "latitude": 17.0543, "longitude": 82.1698, "junction": True, "corridors": ["C02"]},
        {"code": "RJY", "name": "Rajahmundry", "division": "Vijayawada", "zone": "SCoR", "km_mark": 200.9, "latitude": 17.0005, "longitude": 81.7774, "junction": False, "corridors": ["C02"]},
        {"code": "NDD", "name": "Nidadavolu Junction", "division": "Vijayawada", "zone": "SCoR", "km_mark": 223.2, "latitude": 16.9069, "longitude": 81.6705, "junction": True, "corridors": ["C02"]},
        {"code": "TDD", "name": "Tadepalligudem", "division": "Vijayawada", "zone": "SCoR", "km_mark": 243.0, "latitude": 16.8126, "longitude": 81.5283, "junction": False, "corridors": ["C02"]},
        {"code": "EE", "name": "Eluru", "division": "Vijayawada", "zone": "SCoR", "km_mark": 290.8, "latitude": 16.7107, "longitude": 81.0952, "junction": False, "corridors": ["C02"]},

        # C03: Guntur - Tenali - Nandyal (GNT Division)
        {"code": "GNT", "name": "Guntur Junction", "division": "Guntur", "zone": "SCoR", "km_mark": 0.0, "latitude": 16.2997, "longitude": 80.4431, "junction": True, "corridors": ["C03"]},
        {"code": "NRT", "name": "Narasaraopet", "division": "Guntur", "zone": "SCoR", "km_mark": 45.4, "latitude": 16.2359, "longitude": 80.0489, "junction": False, "corridors": ["C03"]},
        {"code": "VKN", "name": "Vinukonda", "division": "Guntur", "zone": "SCoR", "km_mark": 82.9, "latitude": 16.0526, "longitude": 79.7424, "junction": False, "corridors": ["C03"]},
        {"code": "DKD", "name": "Donakonda", "division": "Guntur", "zone": "SCoR", "km_mark": 120.7, "latitude": 15.7958, "longitude": 79.4975, "junction": False, "corridors": ["C03"]},
        {"code": "MRK", "name": "Markapur Road", "division": "Guntur", "zone": "SCoR", "km_mark": 144.9, "latitude": 15.7346, "longitude": 79.2785, "junction": False, "corridors": ["C03"]},
        {"code": "GID", "name": "Giddalur", "division": "Guntur", "zone": "SCoR", "km_mark": 204.8, "latitude": 15.3789, "longitude": 78.9248, "junction": False, "corridors": ["C03"]},
        {"code": "NDL", "name": "Nandyal Junction", "division": "Guntur", "zone": "SCoR", "km_mark": 258.0, "latitude": 15.4882, "longitude": 78.4836, "junction": True, "corridors": ["C03"]},

        # C04: Guntakal - Renigunta (GTL Division)
        {"code": "GTL", "name": "Guntakal Junction", "division": "Guntakal", "zone": "SCoR", "km_mark": 0.0, "latitude": 15.1674, "longitude": 77.3712, "junction": True, "corridors": ["C04"]},
        {"code": "GY", "name": "Gooty Junction", "division": "Guntakal", "zone": "SCoR", "km_mark": 28.5, "latitude": 15.1147, "longitude": 77.6324, "junction": True, "corridors": ["C04"]},
        {"code": "TU", "name": "Tadipatri", "division": "Guntakal", "zone": "SCoR", "km_mark": 76.8, "latitude": 14.9082, "longitude": 78.0125, "junction": False, "corridors": ["C04"]},
        {"code": "KDP", "name": "Kondapuram", "division": "Guntakal", "zone": "SCoR", "km_mark": 104.2, "latitude": 14.8118, "longitude": 78.2324, "junction": False, "corridors": ["C04"]},
        {"code": "YA", "name": "Yerraguntla Junction", "division": "Guntakal", "zone": "SCoR", "km_mark": 144.9, "latitude": 14.6341, "longitude": 78.5367, "junction": True, "corridors": ["C04"]},
        {"code": "HX", "name": "Kadapa Junction", "division": "Guntakal", "zone": "SCoR", "km_mark": 184.2, "latitude": 14.4754, "longitude": 78.8258, "junction": False, "corridors": ["C04"]},
        {"code": "RJP", "name": "Razampeta", "division": "Guntakal", "zone": "SCoR", "km_mark": 235.0, "latitude": 14.1956, "longitude": 79.1554, "junction": False, "corridors": ["C04"]},
        {"code": "KOU", "name": "Koduru", "division": "Guntakal", "zone": "SCoR", "km_mark": 268.8, "latitude": 13.9574, "longitude": 79.3512, "junction": False, "corridors": ["C04"]},
        {"code": "RU", "name": "Renigunta Junction", "division": "Guntakal", "zone": "SCoR", "km_mark": 309.6, "latitude": 13.6493, "longitude": 79.5161, "junction": True, "corridors": ["C04"]},
        {"code": "TPTY", "name": "Tirupati Main", "division": "Guntakal", "zone": "SCoR", "km_mark": 319.4, "latitude": 13.6288, "longitude": 79.4192, "junction": True, "corridors": ["C04"]}
    ]

    with open(os.path.join(DATA_DIR, "02_reference", "stations.json"), "w", encoding="utf-8") as f:
        json.dump(stations, f, indent=2)

    # 2. Corridors in Andhra Pradesh
    corridors = [
        {"corridor_id": "C01", "code": "BZA-GDR", "name": "Vijayawada - Gudur Main Line", "division": "Vijayawada", "zone": "SCoR", "length_km": 293.5, "track_type": "DOUBLE_ELECTRIFIED", "gmt_annual": 48.5, "speed_limit_kmph": 130, "stations_count": 9},
        {"corridor_id": "C02", "code": "VSKP-BZA", "name": "Visakhapatnam - Vijayawada Main Line", "division": "Visakhapatnam & Vijayawada", "zone": "SCoR", "length_km": 350.2, "track_type": "DOUBLE_ELECTRIFIED", "gmt_annual": 52.0, "speed_limit_kmph": 130, "stations_count": 10},
        {"corridor_id": "C03", "code": "GNT-NDL", "name": "Guntur - Nandyal Corridor", "division": "Guntur", "zone": "SCoR", "length_km": 258.0, "track_type": "SINGLE_ELECTRIFIED", "gmt_annual": 22.4, "speed_limit_kmph": 110, "stations_count": 7},
        {"corridor_id": "C04", "code": "GTL-RU", "name": "Guntakal - Renigunta Grand Trunk Route", "division": "Guntakal", "zone": "SCoR", "length_km": 319.4, "track_type": "DOUBLE_ELECTRIFIED", "gmt_annual": 44.0, "speed_limit_kmph": 130, "stations_count": 10}
    ]

    with open(os.path.join(DATA_DIR, "02_reference", "corridors.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(corridors[0].keys()))
        writer.writeheader()
        writer.writerows(corridors)

    # 3. Crews and Equipment
    crews = [
        {"crew_id": "CREW-ENG-BZA-01", "department": "Engineering", "division": "Vijayawada", "base_station": "BZA", "crew_type": "Track Gang & Tamping Operators", "size": 18, "specialization": "USFD / Weld Repair / Track Relaying"},
        {"crew_id": "CREW-ENG-BZA-02", "department": "Engineering", "division": "Vijayawada", "base_station": "OGL", "crew_type": "P-Way Section Gang", "size": 14, "specialization": "Turnout Overhaul / Ballast Dressing"},
        {"crew_id": "CREW-TRD-BZA-01", "department": "Traction", "division": "Vijayawada", "base_station": "BZA", "crew_type": "OHE Tower Wagon Crew", "size": 8, "specialization": "25kV Catenary Adjustment & Isolators"},
        {"crew_id": "CREW-TRD-NLR-01", "department": "Traction", "division": "Vijayawada", "base_station": "NLR", "crew_type": "TRD Power Block Team", "size": 7, "specialization": "Cantilever & Contact Wire Replacement"},
        {"crew_id": "CREW-SNT-BZA-01", "department": "S&T", "division": "Vijayawada", "base_station": "BZA", "crew_type": "Signal Maintenance Wing", "size": 6, "specialization": "Electronic Interlocking & Point Motors"},
        {"crew_id": "CREW-SNT-OGL-01", "department": "S&T", "division": "Vijayawada", "base_station": "OGL", "crew_type": "Axle Counter & Track Circuit Gang", "size": 5, "specialization": "Digital Axle Counters & OFC"},
        {"crew_id": "CREW-ENG-VSKP-01", "department": "Engineering", "division": "Visakhapatnam", "base_station": "VSKP", "crew_type": "Heavy Track Relaying Gang", "size": 20, "specialization": "Flash Butt Welding & Tamping"},
        {"crew_id": "CREW-TRD-VSKP-01", "department": "Traction", "division": "Visakhapatnam", "base_station": "VSKP", "crew_type": "OHE Maintenance Crew", "size": 8, "specialization": "Pantograph Clearance & AT Station"},
        {"crew_id": "CREW-SNT-VSKP-01", "department": "S&T", "division": "Visakhapatnam", "base_station": "VSKP", "crew_type": "Signal Tech Team", "size": 6, "specialization": "Signalling Cables & Relay Testing"},
        {"crew_id": "CREW-ENG-GNT-01", "department": "Engineering", "division": "Guntur", "base_station": "GNT", "crew_type": "Track Gang", "size": 12, "specialization": "Deep Screening & Sleeper Renewal"},
        {"crew_id": "CREW-ENG-GTL-01", "department": "Engineering", "division": "Guntakal", "base_station": "GTL", "crew_type": "Machine Gang", "size": 16, "specialization": "CSM Tamping & Curve Alignment"}
    ]

    with open(os.path.join(DATA_DIR, "02_reference", "crews.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(crews[0].keys()))
        writer.writeheader()
        writer.writerows(crews)

    # 4. Dataset Manifest
    manifest = {
        "dataset_name": "Indian Railways SCoR Andhra Pradesh Synthetic Planning Dataset",
        "version": "2.0-SCoR-2026",
        "organizational_context": {
            "zone": "South Coast Railway (SCoR)",
            "headquarters": "Visakhapatnam",
            "pilot_region": "Andhra Pradesh",
            "divisions": ["Guntakal", "Guntur", "Vijayawada", "Visakhapatnam"]
        },
        "disclaimer": "SYNTHETIC DEMONSTRATION DATA ONLY. Not connected to internal CRIS/IR production networks. Generated for Smart India Hackathon block scheduling simulation.",
        "created_at": datetime.now().isoformat(),
        "systems_integrated": ["TMS", "SMMS", "TDMS", "COA", "BDMS"],
        "target_corridors": ["C01", "C02", "C03", "C04"]
    }

    with open(os.path.join(DATA_DIR, "02_reference", "dataset_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print("[REFERENCE] Reference data generated.")

def generate_raw_sources():
    # 1. TMS (Track Management System) Assets & Maintenance
    tms_assets = []
    tms_maint = []

    tms_asset_types = [
        ("RAIL_60KG", "Continuous Welded Rail (60kg UIC)", "TRACK"),
        ("TURNOUT_1_IN_12", "Points & Crossing Turnout 1-in-12", "TURNOUT"),
        ("PSC_SLEEPER", "Pre-stressed Concrete Sleepers", "SLEEPER"),
        ("GLUED_INSULATED_JOINT", "Glued Insulated Rail Joint", "JOINT"),
        ("TRANSITION_CURVE", "High-speed Transition Curve 2.2 deg", "CURVE"),
        ("EXPANSION_JOINT_SEJ", "Switch Expansion Joint (SEJ)", "JOINT")
    ]

    # Specific key assets with known KM locations for cross-department bundling
    key_tms_assets = [
        {"asset_id": "TMS-C01-TRK-1042", "asset_type": "RAIL_60KG", "subtype": "CWR Main Line Up Track", "station": "OGL", "division": "Vijayawada", "zone": "SCoR", "corridor_id": "C01", "km": 124.4, "criticality": "CRITICAL", "installation_date": "2018-03-15", "condition_score": 58, "status": "DEFECT_LOGGED"},
        {"asset_id": "TMS-C01-PNT-1043", "asset_type": "TURNOUT_1_IN_12", "subtype": "Points 102A Loop Entry", "station": "OGL", "division": "Vijayawada", "zone": "SCoR", "corridor_id": "C01", "km": 124.6, "criticality": "HIGH", "installation_date": "2019-07-22", "condition_score": 64, "status": "MAINTENANCE_DUE"},
        {"asset_id": "TMS-C01-SEJ-1044", "asset_type": "EXPANSION_JOINT_SEJ", "subtype": "SEJ 60kg Rail Joint", "station": "CLX", "division": "Vijayawada", "zone": "SCoR", "corridor_id": "C01", "km": 124.8, "criticality": "HIGH", "installation_date": "2020-01-10", "condition_score": 62, "status": "MAINTENANCE_DUE"},
        {"asset_id": "TMS-C02-TRK-2051", "asset_type": "RAIL_60KG", "subtype": "CWR Down Track SLO Section", "station": "SLO", "division": "Vijayawada", "zone": "SCoR", "corridor_id": "C02", "km": 150.4, "criticality": "CRITICAL", "installation_date": "2017-11-05", "condition_score": 55, "status": "DEFECT_LOGGED"},
        {"asset_id": "TMS-C02-TUR-2052", "asset_type": "TURNOUT_1_IN_12", "subtype": "Facing Point 11B", "station": "SLO", "division": "Vijayawada", "zone": "SCoR", "corridor_id": "C02", "km": 150.6, "criticality": "HIGH", "installation_date": "2019-04-12", "condition_score": 61, "status": "MAINTENANCE_DUE"},
        {"asset_id": "TMS-C04-TRK-4081", "asset_type": "RAIL_60KG", "subtype": "CWR Heavy Freight Line", "station": "YA", "division": "Guntakal", "zone": "SCoR", "corridor_id": "C04", "km": 144.6, "criticality": "HIGH", "installation_date": "2018-08-19", "condition_score": 60, "status": "MAINTENANCE_DUE"},
        {"asset_id": "TMS-C04-PNT-4082", "asset_type": "TURNOUT_1_IN_12", "subtype": "Yard Crossover 201A", "station": "YA", "division": "Guntakal", "zone": "SCoR", "corridor_id": "C04", "km": 144.9, "criticality": "CRITICAL", "installation_date": "2017-02-14", "condition_score": 52, "status": "DEFECT_LOGGED"}
    ]
    tms_assets.extend(key_tms_assets)

    corridor_stations = {
        "C01": [("BZA", 10.5), ("TEL", 35.0), ("BPP", 76.5), ("CLX", 92.0), ("OGL", 135.0), ("SKM", 168.0), ("KVZ", 206.0), ("NLR", 257.0), ("GDR", 290.0)],
        "C02": [("VSKP", 8.0), ("DVD", 20.5), ("AKP", 38.0), ("TUNI", 99.5), ("ANV", 115.0), ("SLO", 152.0), ("RJY", 203.0), ("NDD", 225.0), ("TDD", 245.0), ("EE", 292.0)],
        "C03": [("GNT", 12.0), ("NRT", 48.0), ("VKN", 85.0), ("DKD", 122.0), ("MRK", 147.0), ("GID", 206.0), ("NDL", 255.0)],
        "C04": [("GTL", 10.0), ("GY", 32.0), ("TU", 79.0), ("KDP", 106.0), ("YA", 146.0), ("HX", 186.0), ("RJP", 237.0), ("KOU", 270.0), ("RU", 311.0)]
    }

    count = 100
    for cid, st_list in corridor_stations.items():
        div = "Vijayawada" if cid in ("C01", "C02") else ("Guntur" if cid == "C03" else "Guntakal")
        for stn, base_km in st_list:
            for offset in [0.8, 2.4]:
                count += 1
                atype, atitle, asub = tms_asset_types[count % len(tms_asset_types)]
                tms_assets.append({
                    "asset_id": f"TMS-{cid}-{asub}-{count:04d}",
                    "asset_type": atype,
                    "subtype": f"{atitle} Section {stn}",
                    "station": stn,
                    "division": div,
                    "zone": "SCoR",
                    "corridor_id": cid,
                    "km": round(base_km + offset, 1),
                    "criticality": "CRITICAL" if count % 7 == 0 else ("HIGH" if count % 3 == 0 else "MEDIUM"),
                    "installation_date": f"201{count % 9 + 4}-0{count % 8 + 1}-15",
                    "condition_score": 50 + (count % 45),
                    "status": "OPERATIONAL" if count % 4 != 0 else "MAINTENANCE_DUE"
                })

    # TMS Maintenance Jobs (55 records)
    key_tms_jobs = [
        {
            "job_id": "TMS-JOB-101",
            "asset_id": "TMS-C01-TRK-1042",
            "department": "Engineering",
            "corridor_id": "C01",
            "station": "OGL",
            "km": 124.4,
            "job_type": "TRACK_TAMPING_DEEP_SCREENING",
            "severity": "CRITICAL",
            "priority_score": 92,
            "due_date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
            "estimated_duration_min": 120,
            "crew_required": "CREW-ENG-BZA-01",
            "equipment_required": "CSM_TAMPING_09",
            "block_required": "YES",
            "status": "APPROVED_BY_DEN",
            "source_system": "TMS"
        },
        {
            "job_id": "TMS-JOB-102",
            "asset_id": "TMS-C01-PNT-1043",
            "department": "Engineering",
            "corridor_id": "C01",
            "station": "OGL",
            "km": 124.6,
            "job_type": "TURNOUT_SLEEPER_REPLACEMENT",
            "severity": "HIGH",
            "priority_score": 84,
            "due_date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"),
            "estimated_duration_min": 90,
            "crew_required": "CREW-ENG-BZA-02",
            "equipment_required": "HYDRAULIC_RAIL_TENSOR",
            "block_required": "YES",
            "status": "PENDING_BLOCK",
            "source_system": "TMS"
        },
        {
            "job_id": "TMS-JOB-103",
            "asset_id": "TMS-C01-SEJ-1044",
            "department": "Engineering",
            "corridor_id": "C01",
            "station": "CLX",
            "km": 124.8,
            "job_type": "SWITCH_EXPANSION_JOINT_REALIGNMENT",
            "severity": "HIGH",
            "priority_score": 80,
            "due_date": (datetime.now() + timedelta(days=4)).strftime("%Y-%m-%d"),
            "estimated_duration_min": 60,
            "crew_required": "CREW-ENG-BZA-02",
            "equipment_required": "WELDING_KIT_LPG",
            "block_required": "YES",
            "status": "PENDING_BLOCK",
            "source_system": "TMS"
        },
        {
            "job_id": "TMS-JOB-104",
            "asset_id": "TMS-C02-TRK-2051",
            "department": "Engineering",
            "corridor_id": "C02",
            "station": "SLO",
            "km": 150.4,
            "job_type": "RAIL_FLAW_WELD_REPAIR",
            "severity": "CRITICAL",
            "priority_score": 90,
            "due_date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "estimated_duration_min": 105,
            "crew_required": "CREW-ENG-VSKP-01",
            "equipment_required": "FLASH_BUTT_WELDING_RIG",
            "block_required": "YES",
            "status": "PENDING_BLOCK",
            "source_system": "TMS"
        }
    ]
    tms_maint.extend(key_tms_jobs)

    for i in range(105, 155):
        asset = tms_assets[i % len(tms_assets)]
        dur = [45, 60, 90, 120, 150][i % 5]
        sev = "CRITICAL" if i % 6 == 0 else ("HIGH" if i % 3 == 0 else "MEDIUM")
        p_score = 88 if sev == "CRITICAL" else (76 if sev == "HIGH" else 62)
        tms_maint.append({
            "job_id": f"TMS-JOB-{i}",
            "asset_id": asset["asset_id"],
            "department": "Engineering",
            "corridor_id": asset["corridor_id"],
            "station": asset["station"],
            "km": asset["km"],
            "job_type": "BALLAST_CLEANING_BCM" if i % 4 == 0 else "PWAY_USFD_TESTING_REPAIR",
            "severity": sev,
            "priority_score": p_score,
            "due_date": (datetime.now() + timedelta(days=(i % 10) + 1)).strftime("%Y-%m-%d"),
            "estimated_duration_min": dur,
            "crew_required": "CREW-ENG-BZA-01" if asset["corridor_id"] in ("C01", "C02") else "CREW-ENG-GTL-01",
            "equipment_required": "BCM_CLEANER" if i % 4 == 0 else "TRACK_JACK_HEAVY",
            "block_required": "YES",
            "status": "PENDING_BLOCK",
            "source_system": "TMS"
        })

    # Add 2 slightly anomalous records for realistic Data Quality validation demo
    tms_maint.append({
        "job_id": "TMS-JOB-155",
        "asset_id": "TMS-C01-TRK-UNKNOWN",
        "department": "Civil_Engg", # unnormalized dept
        "corridor_id": "C01",
        "station": "OGL",
        "km": 124.9,
        "job_type": "EMERGENCY_BOLT_REPLACEMENT",
        "severity": "high", # unnormalized lowercase
        "priority_score": 75,
        "due_date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
        "estimated_duration_min": 45,
        "crew_required": "CREW-ENG-BZA-02",
        "equipment_required": "TORQUE_WRENCH",
        "block_required": "YES",
        "status": "PENDING_BLOCK",
        "source_system": "TMS"
    })

    with open(os.path.join(DATA_DIR, "01_raw_sources", "TMS", "tms_assets.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(tms_assets[0].keys()))
        writer.writeheader()
        writer.writerows(tms_assets)

    with open(os.path.join(DATA_DIR, "01_raw_sources", "TMS", "tms_maintenance.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(tms_maint[0].keys()))
        writer.writeheader()
        writer.writerows(tms_maint)

    print(f"[TMS] Generated {len(tms_assets)} assets, {len(tms_maint)} maintenance jobs.")

    # 2. TDMS (Traction Distribution Management System)
    tdms_assets = []
    tdms_maint = []

    key_tdms_assets = [
        {"asset_id": "TDMS-C01-OHE-0201", "asset_type": "CATENARY_CONTACT_WIRE", "subtype": "25kV AC Contact Wire Up Line", "station": "OGL", "division": "Vijayawada", "zone": "SCoR", "corridor_id": "C01", "km": 124.3, "criticality": "HIGH", "installation_date": "2016-05-18", "condition_score": 62, "status": "MAINTENANCE_DUE"},
        {"asset_id": "TDMS-C01-ISO-0202", "asset_type": "OHE_SECTION_ISOLATOR", "subtype": "Motorized Vacuum Isolator SM-102", "station": "OGL", "division": "Vijayawada", "zone": "SCoR", "corridor_id": "C01", "km": 124.6, "criticality": "CRITICAL", "installation_date": "2017-09-12", "condition_score": 56, "status": "DEFECT_LOGGED"},
        {"asset_id": "TDMS-C02-CAT-0301", "asset_type": "CATENARY_CONTACT_WIRE", "subtype": "Main Line Catenary Mast 150/12", "station": "SLO", "division": "Vijayawada", "zone": "SCoR", "corridor_id": "C02", "km": 150.5, "criticality": "HIGH", "installation_date": "2018-04-10", "condition_score": 64, "status": "MAINTENANCE_DUE"}
    ]
    tdms_assets.extend(key_tdms_assets)

    for i in range(203, 260):
        cid = ["C01", "C02", "C03", "C04"][i % 4]
        stns = corridor_stations[cid]
        stn, b_km = stns[i % len(stns)]
        tdms_assets.append({
            "asset_id": f"TDMS-{cid}-OHE-{i:04d}",
            "asset_type": "CANTILEVER_MAST" if i % 3 == 0 else ("AUTO_TENSION_AT" if i % 2 == 0 else "OHE_SECTION_ISOLATOR"),
            "subtype": f"25kV OHE Structure {stn} Bay {i%8+1}",
            "station": stn,
            "division": "Vijayawada" if cid in ("C01", "C02") else ("Guntur" if cid == "C03" else "Guntakal"),
            "zone": "SCoR",
            "corridor_id": cid,
            "km": round(b_km + (i % 6) * 0.4, 1),
            "criticality": "HIGH" if i % 3 == 0 else "MEDIUM",
            "installation_date": f"201{i%8+4}-10-20",
            "condition_score": 58 + (i % 38),
            "status": "OPERATIONAL" if i % 3 != 0 else "MAINTENANCE_DUE"
        })

    key_tdms_jobs = [
        {
            "job_id": "TDMS-JOB-201",
            "asset_id": "TDMS-C01-OHE-0201",
            "department": "Traction",
            "corridor_id": "C01",
            "station": "OGL",
            "km": 124.3,
            "job_type": "OHE_POWER_ISOLATION_AND_CONTACT_WIRE_ADJUSTMENT",
            "severity": "HIGH",
            "priority_score": 86,
            "due_date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
            "estimated_duration_min": 75,
            "crew_required": "CREW-TRD-BZA-01",
            "equipment_required": "TOWER_WAGON_RU",
            "block_required": "YES",
            "status": "SUBMITTED_TO_SR_DEE",
            "source_system": "TDMS"
        },
        {
            "job_id": "TDMS-JOB-202",
            "asset_id": "TDMS-C01-ISO-0202",
            "department": "Traction",
            "corridor_id": "C01",
            "station": "OGL",
            "km": 124.6,
            "job_type": "MOTORIZED_ISOLATOR_OVERHAUL",
            "severity": "CRITICAL",
            "priority_score": 89,
            "due_date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"),
            "estimated_duration_min": 60,
            "crew_required": "CREW-TRD-BZA-01",
            "equipment_required": "EARTHING_POLES_SET",
            "block_required": "YES",
            "status": "PENDING_BLOCK",
            "source_system": "TDMS"
        }
    ]
    tdms_maint.extend(key_tdms_jobs)

    for i in range(203, 246):
        asset = tdms_assets[i % len(tdms_assets)]
        dur = [45, 60, 75, 90][i % 4]
        sev = "HIGH" if i % 2 == 0 else "MEDIUM"
        tdms_maint.append({
            "job_id": f"TDMS-JOB-{i}",
            "asset_id": asset["asset_id"],
            "department": "Traction",
            "corridor_id": asset["corridor_id"],
            "station": asset["station"],
            "km": asset["km"],
            "job_type": "CANTILEVER_DROPPERS_REPLACEMENT" if i % 2 == 0 else "SUBSTATION_SWITCHGEAR_INSPECTION",
            "severity": sev,
            "priority_score": 82 if sev == "HIGH" else 68,
            "due_date": (datetime.now() + timedelta(days=(i % 8) + 2)).strftime("%Y-%m-%d"),
            "estimated_duration_min": dur,
            "crew_required": "CREW-TRD-BZA-01" if asset["corridor_id"] in ("C01", "C02") else "CREW-TRD-NLR-01",
            "equipment_required": "TOWER_WAGON_RU",
            "block_required": "YES",
            "status": "PENDING_BLOCK",
            "source_system": "TDMS"
        })

    with open(os.path.join(DATA_DIR, "01_raw_sources", "TDMS", "tdms_assets.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(tdms_assets[0].keys()))
        writer.writeheader()
        writer.writerows(tdms_assets)

    with open(os.path.join(DATA_DIR, "01_raw_sources", "TDMS", "tdms_maintenance.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(tdms_maint[0].keys()))
        writer.writeheader()
        writer.writerows(tdms_maint)

    print(f"[TDMS] Generated {len(tdms_assets)} assets, {len(tdms_maint)} maintenance jobs.")

    # 3. SMMS (Signal & Telecom Maintenance Management System)
    smms_assets = []
    smms_maint = []

    key_smms_assets = [
        {"asset_id": "SMMS-C01-SIG-0501", "asset_type": "POINT_MACHINE_143", "subtype": "IRS Electric Point Machine Point 102A", "station": "OGL", "division": "Vijayawada", "zone": "SCoR", "corridor_id": "C01", "km": 124.6, "criticality": "HIGH", "installation_date": "2019-02-15", "condition_score": 60, "status": "MAINTENANCE_DUE"},
        {"asset_id": "SMMS-C01-AXC-0502", "asset_type": "DIGITAL_AXLE_COUNTER", "subtype": "Dual High-Availability DAC Track Circuit", "station": "OGL", "division": "Vijayawada", "zone": "SCoR", "corridor_id": "C01", "km": 124.8, "criticality": "CRITICAL", "installation_date": "2018-11-25", "condition_score": 54, "status": "DEFECT_LOGGED"},
        {"asset_id": "SMMS-C02-INT-0601", "asset_type": "ELECTRONIC_INTERLOCKING", "subtype": "Kavach Collision Prevention Beacon & Rack", "station": "SLO", "division": "Vijayawada", "zone": "SCoR", "corridor_id": "C02", "km": 150.6, "criticality": "CRITICAL", "installation_date": "2021-08-30", "condition_score": 59, "status": "MAINTENANCE_DUE"}
    ]
    smms_assets.extend(key_smms_assets)

    for i in range(503, 560):
        cid = ["C01", "C02", "C03", "C04"][i % 4]
        stns = corridor_stations[cid]
        stn, b_km = stns[i % len(stns)]
        smms_assets.append({
            "asset_id": f"SMMS-{cid}-SIG-{i:04d}",
            "asset_type": "POINT_MACHINE_143" if i % 3 == 0 else ("DIGITAL_AXLE_COUNTER" if i % 2 == 0 else "SIGNAL_LED_MULTI_ASPECT"),
            "subtype": f"S&T Asset {stn} Relay Room Sector {i%6+1}",
            "station": stn,
            "division": "Vijayawada" if cid in ("C01", "C02") else ("Guntur" if cid == "C03" else "Guntakal"),
            "zone": "SCoR",
            "corridor_id": cid,
            "km": round(b_km + (i % 5) * 0.5, 1),
            "criticality": "HIGH" if i % 2 == 0 else "MEDIUM",
            "installation_date": f"202{i%4}-03-10",
            "condition_score": 60 + (i % 35),
            "status": "OPERATIONAL" if i % 4 != 0 else "MAINTENANCE_DUE"
        })

    key_smms_jobs = [
        {
            "job_id": "SMMS-JOB-301",
            "asset_id": "SMMS-C01-SIG-0501",
            "department": "S&T",
            "corridor_id": "C01",
            "station": "OGL",
            "km": 124.6,
            "job_type": "POINT_MACHINE_OVERHAUL_AND_OBSTRUCTION_TEST",
            "severity": "HIGH",
            "priority_score": 85,
            "due_date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
            "estimated_duration_min": 60,
            "crew_required": "CREW-SNT-BZA-01",
            "equipment_required": "DIGITAL_VOLT_AMMETER",
            "block_required": "YES",
            "status": "APPROVED_BY_DSTE",
            "source_system": "SMMS"
        },
        {
            "job_id": "SMMS-JOB-302",
            "asset_id": "SMMS-C01-AXC-0502",
            "department": "S&T",
            "corridor_id": "C01",
            "station": "OGL",
            "km": 124.8,
            "job_type": "AXLE_COUNTER_RESET_AND_COUPLING_TEST",
            "severity": "CRITICAL",
            "priority_score": 91,
            "due_date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"),
            "estimated_duration_min": 45,
            "crew_required": "CREW-SNT-OGL-01",
            "equipment_required": "OSCILLOSCOPE_CALIBRATOR",
            "block_required": "YES",
            "status": "PENDING_BLOCK",
            "source_system": "SMMS"
        }
    ]
    smms_maint.extend(key_smms_jobs)

    for i in range(303, 341):
        asset = smms_assets[i % len(smms_assets)]
        dur = [30, 45, 60][i % 3]
        sev = "HIGH" if i % 2 == 0 else "MEDIUM"
        smms_maint.append({
            "job_id": f"SMMS-JOB-{i}",
            "asset_id": asset["asset_id"],
            "department": "S&T",
            "corridor_id": asset["corridor_id"],
            "station": asset["station"],
            "km": asset["km"],
            "job_type": "INTERLOCKING_ROUTE_CHECK" if i % 2 == 0 else "LED_SIGNAL_LAMP_REPLACEMENT",
            "severity": sev,
            "priority_score": 80 if sev == "HIGH" else 65,
            "due_date": (datetime.now() + timedelta(days=(i % 7) + 2)).strftime("%Y-%m-%d"),
            "estimated_duration_min": dur,
            "crew_required": "CREW-SNT-BZA-01" if asset["corridor_id"] in ("C01", "C02") else "CREW-SNT-OGL-01",
            "equipment_required": "SAFETY_MULTIMETER",
            "block_required": "YES",
            "status": "PENDING_BLOCK",
            "source_system": "SMMS"
        })

    with open(os.path.join(DATA_DIR, "01_raw_sources", "SMMS", "smms_assets.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(smms_assets[0].keys()))
        writer.writeheader()
        writer.writerows(smms_assets)

    with open(os.path.join(DATA_DIR, "01_raw_sources", "SMMS", "smms_maintenance.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(smms_maint[0].keys()))
        writer.writeheader()
        writer.writerows(smms_maint)

    print(f"[SMMS] Generated {len(smms_assets)} assets, {len(smms_maint)} maintenance jobs.")

    # 4. COA (Control Office Application)
    coa_trains = [
        {"train_id": "20833", "train_name": "VSKP-SC Vande Bharat Express", "train_type": "VANDE_BHARAT", "corridor_id": "C02", "direction": "DOWN", "entry_time": "05:45", "exit_time": "09:50", "entry_min": 345, "exit_min": 590, "priority": "NON_NEGOTIABLE", "days": "Mon,Tue,Wed,Thu,Fri,Sat"},
        {"train_id": "20834", "train_name": "SC-VSKP Vande Bharat Express", "train_type": "VANDE_BHARAT", "corridor_id": "C02", "direction": "UP", "entry_time": "15:00", "exit_time": "19:15", "entry_min": 900, "exit_min": 1155, "priority": "NON_NEGOTIABLE", "days": "Mon,Tue,Wed,Thu,Fri,Sat"},
        {"train_id": "12760", "train_name": "Charminar Express", "train_type": "SUPERFAST", "corridor_id": "C01", "direction": "DOWN", "entry_time": "23:55", "exit_time": "04:10", "entry_min": 1435, "exit_min": 250, "priority": "HIGH", "days": "DAILY"},
        {"train_id": "12759", "train_name": "Charminar Express (Up)", "train_type": "SUPERFAST", "corridor_id": "C01", "direction": "UP", "entry_time": "20:30", "exit_time": "00:45", "entry_min": 1230, "exit_min": 45, "priority": "HIGH", "days": "DAILY"},
        {"train_id": "12841", "train_name": "Coromandel Express", "train_type": "SUPERFAST", "corridor_id": "C01", "direction": "DOWN", "entry_time": "09:20", "exit_time": "13:40", "entry_min": 560, "exit_min": 820, "priority": "HIGH", "days": "DAILY"},
        {"train_id": "12842", "train_name": "Coromandel Express (Up)", "train_type": "SUPERFAST", "corridor_id": "C01", "direction": "UP", "entry_time": "14:15", "exit_time": "18:40", "entry_min": 855, "exit_min": 1120, "priority": "HIGH", "days": "DAILY"},
        {"train_id": "12727", "train_name": "Godavari Express", "train_type": "SUPERFAST", "corridor_id": "C02", "direction": "UP", "entry_time": "17:20", "exit_time": "22:15", "entry_min": 1040, "exit_min": 1335, "priority": "HIGH", "days": "DAILY"},
        {"train_id": "12711", "train_name": "Pinakini Express", "train_type": "INTERCITY", "corridor_id": "C01", "direction": "DOWN", "entry_time": "06:10", "exit_time": "10:30", "entry_min": 370, "exit_min": 630, "priority": "MEDIUM", "days": "DAILY"},
        {"train_id": "12712", "train_name": "Pinakini Express (Up)", "train_type": "INTERCITY", "corridor_id": "C01", "direction": "UP", "entry_time": "16:10", "exit_time": "20:45", "entry_min": 970, "exit_min": 1245, "priority": "MEDIUM", "days": "DAILY"},
        {"train_id": "12797", "train_name": "Venkatadri Express", "train_type": "SUPERFAST", "corridor_id": "C04", "direction": "DOWN", "entry_time": "02:15", "exit_time": "06:45", "entry_min": 135, "exit_min": 405, "priority": "HIGH", "days": "DAILY"},
        {"train_id": "17225", "train_name": "Amaravati Express", "train_type": "EXPRESS", "corridor_id": "C03", "direction": "DOWN", "entry_time": "05:00", "exit_time": "09:30", "entry_min": 300, "exit_min": 570, "priority": "MEDIUM", "days": "DAILY"}
    ]

    train_types = ["FREIGHT_COAL_RAKE", "FREIGHT_CONTAINER", "FREIGHT_CEMENT", "PARCEL_EXPRESS", "PASSENGER_SPECIAL"]
    for i in range(12, 76):
        cid = ["C01", "C02", "C03", "C04"][i % 4]
        st_h = (i * 3 + 1) % 24
        dur_h = 3 + (i % 3)
        end_h = (st_h + dur_h) % 24
        ttype = train_types[i % len(train_types)]
        is_freight = "FREIGHT" in ttype
        coa_trains.append({
            "train_id": f"{'FRT' if is_freight else 'PAS'}-{8000 + i}",
            "train_name": f"{'Krishnapatnam Port Coal' if i%3==0 else ('Gudur Goods BoxN' if i%2==0 else 'Vizag Steel Rake')} #{i}",
            "train_type": ttype,
            "corridor_id": cid,
            "direction": "UP" if i % 2 == 0 else "DOWN",
            "entry_time": f"{st_h:02d}:15",
            "exit_time": f"{end_h:02d}:45",
            "entry_min": st_h * 60 + 15,
            "exit_min": end_h * 60 + 45,
            "priority": "LOW" if is_freight else "MEDIUM",
            "days": "DAILY"
        })

    with open(os.path.join(DATA_DIR, "01_raw_sources", "COA", "coa_train_movements.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(coa_trains[0].keys()))
        writer.writeheader()
        writer.writerows(coa_trains)

    print(f"[COA] Generated {len(coa_trains)} train movement records.")

    # 5. BDMS (Block Demand Management System)
    bdms_requests = [
        {
            "block_request_id": "BDMS-REQ-0017",
            "corridor_id": "C01",
            "department": "Engineering",
            "requested_date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
            "requested_start": "01:00",
            "requested_end": "03:00",
            "requested_duration_min": 120,
            "reason": "Routine tamping and joint testing around Ongole section (KM 124)",
            "status": "SUBMITTED_TO_SR_DOM",
            "station": "OGL",
            "km_range": "122.0-126.0"
        },
        {
            "block_request_id": "BDMS-REQ-0022",
            "corridor_id": "C02",
            "department": "Traction",
            "requested_date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
            "requested_start": "02:00",
            "requested_end": "04:00",
            "requested_duration_min": 120,
            "reason": "OHE contact wire adjustment Samalkot Jn area",
            "status": "SUBMITTED_TO_SR_DOM",
            "station": "SLO",
            "km_range": "149.0-152.0"
        }
    ]

    depts = ["Engineering", "Traction", "S&T"]
    for i in range(18, 66):
        cid = ["C01", "C02", "C03", "C04"][i % 4]
        stns = corridor_stations[cid]
        stn, b_km = stns[i % len(stns)]
        st_h = (i * 2 + 1) % 24
        dur = [90, 120, 150, 180][i % 4]
        end_h = (st_h + (dur // 60)) % 24
        bdms_requests.append({
            "block_request_id": f"BDMS-REQ-{i:04d}",
            "corridor_id": cid,
            "department": depts[i % len(depts)],
            "requested_date": (datetime.now() + timedelta(days=(i % 5) + 1)).strftime("%Y-%m-%d"),
            "requested_start": f"{st_h:02d}:00",
            "requested_end": f"{end_h:02d}:30",
            "requested_duration_min": dur,
            "reason": f"Siloed departmental maintenance request at {stn} section",
            "status": "PENDING_CP_SAT_EVALUATION",
            "station": stn,
            "km_range": f"{b_km:.1f}-{b_km + 3.0:.1f}"
        })

    with open(os.path.join(DATA_DIR, "01_raw_sources", "BDMS", "bdms_block_requests.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(bdms_requests[0].keys()))
        writer.writeheader()
        writer.writerows(bdms_requests)

    print(f"[BDMS] Generated {len(bdms_requests)} block request records.")

if __name__ == "__main__":
    create_directories()
    generate_reference_data()
    generate_raw_sources()
    print("[SUCCESS] All South Coast Railway synthetic file-based datasets generated successfully!")
