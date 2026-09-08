"""
Database Facade Wrapper Delegating to FileRepository
Ensures STRICTLY FILE-BASED ARCHITECTURE (CSV/JSON only).
No SQLite, No Supabase, No Postgres.
"""
import os
from typing import List, Dict, Any, Optional
from app.services.file_repository import file_repo

class FileBasedDatabaseFacade:
    def __init__(self):
        print("[FILE-REPOSITORY] Active Storage Engine: FileRepository (CSV & JSON). No database in use.")

    def get_departments(self) -> List[Dict[str, Any]]:
        return [
            {"id": "ENGINEERING", "name": "Engineering (P-Way)", "silo_system": "TMS", "color_code": "#f43f5e"},
            {"id": "TRACTION", "name": "Traction (TRD / OHE)", "silo_system": "TDMS", "color_code": "#0ea5e9"},
            {"id": "S&T", "name": "Signals & Telecom", "silo_system": "SMMS", "color_code": "#a855f7"},
            {"id": "OPERATIONS", "name": "Control Office Operations", "silo_system": "COA", "color_code": "#10b981"},
            {"id": "BLOCK_DESK", "name": "Block Demands", "silo_system": "BDMS", "color_code": "#f59e0b"}
        ]

    def get_corridors(self) -> List[Dict[str, Any]]:
        corrs = file_repo.get_corridors()
        return [
            {
                "id": c["corridor_id"],
                "code": c["code"],
                "name": c["name"],
                "division": c["division"],
                "zone": c["zone"],
                "length_km": float(c["length_km"]),
                "track_type": c["track_type"],
                "gmt_annual": float(c["gmt_annual"]),
                "speed_limit_kmph": int(c["speed_limit_kmph"])
            }
            for c in corrs
        ]

    def get_stations(self) -> List[Dict[str, Any]]:
        return file_repo.get_stations()

    def get_work_items(self) -> List[Dict[str, Any]]:
        jobs = file_repo.get_unified_jobs()
        if not jobs:
            from app.services.data_integration import integration_service
            integration_service.sync_all_systems()
            jobs = file_repo.get_unified_jobs()
        items = []
        for j in jobs:
            items.append({
                "id": j["job_id"],
                "title": f"{j['job_type']} @ {j['station']} (KM {j['km']:.1f})",
                "asset_id": j["asset_id"],
                "asset_name": j["asset_type"],
                "department_id": j["department"].upper(),
                "department_name": j["department"],
                "corridor_id": j["corridor_id"],
                "corridor_name": j["corridor_id"],
                "requested_day": "Tuesday",
                "requested_start_hour": 1,
                "requested_end_hour": 3,
                "duration_minutes": j["estimated_duration_min"],
                "priority_score": j["priority_score"],
                "priority_tier": j["priority_tier"],
                "status": "APPROVED",
                "silo_system": j["source_system"],
                "criticality": j["severity"],
                "defect_type": j["job_type"]
            })
        return items

    def get_work_item(self, work_id: str) -> Optional[Dict[str, Any]]:
        items = self.get_work_items()
        return next((i for i in items if i["id"] == work_id), None)

    def get_timetable_windows(self) -> List[Dict[str, Any]]:
        trains = file_repo.get_raw_coa_trains()
        windows = []
        for tr in trains:
            windows.append({
                "id": f"TT-{tr['train_id']}",
                "corridor_id": tr["corridor_id"],
                "train_number": tr["train_id"],
                "train_name": tr["train_name"],
                "day_of_week": "Tuesday",
                "blackout_start_minute": int(tr.get("entry_min", 300)),
                "blackout_end_minute": int(tr.get("exit_min", 480)),
                "is_critical_punctuality": tr.get("priority") == "NON_NEGOTIABLE",
                "train_category": tr["train_type"]
            })
        return windows

    def get_resources(self) -> List[Dict[str, Any]]:
        crews = file_repo.get_crews()
        return [{"id": c["crew_id"], "code": c["crew_id"], "name": c["crew_type"], "type": "CREW", "quantity": 1} for c in crews]

    def get_latest_plan(self) -> Optional[Dict[str, Any]]:
        return file_repo.get_latest_plan()

    def save_plan(self, plan_data: Dict[str, Any], items: List[Dict[str, Any]], before_kpi: Any, after_kpi: Any):
        file_repo.save_plan(plan_data)

    def record_audit(self, event_type: str, action: str, details: Dict[str, Any], user_id: str = "System", entity_type: str = "", entity_id: str = ""):
        file_repo.log_audit_event(event_type=event_type, action=action, details=details, user=user_id)

    def get_audit_logs(self, limit: int = 100) -> List[Dict[str, Any]]:
        return file_repo.get_audit_logs(limit=limit)

db = FileBasedDatabaseFacade()
