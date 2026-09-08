"""
File Repository Service
Strictly File-Based Storage (CSV and JSON)
No SQL, No SQLite, No Supabase, No MongoDB.
"""
import os
import csv
import json
import uuid
import threading
from typing import List, Dict, Any, Optional
from datetime import datetime

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")

file_lock = threading.Lock()

class FileRepository:
    def __init__(self, data_dir: str = DATA_DIR):
        self.data_dir = data_dir
        self.raw_dir = os.path.join(data_dir, "01_raw_sources")
        self.ref_dir = os.path.join(data_dir, "02_reference")
        self.unified_dir = os.path.join(data_dir, "03_unified")
        self.outputs_dir = os.path.join(data_dir, "04_outputs")
        self.audit_dir = os.path.join(self.outputs_dir, "audit_logs")
        self.plans_dir = os.path.join(self.outputs_dir, "plans")
        self.sims_dir = os.path.join(self.outputs_dir, "simulations")
        self._ensure_dirs()

    def _ensure_dirs(self):
        for d in [self.raw_dir, self.ref_dir, self.unified_dir, self.audit_dir, self.plans_dir, self.sims_dir]:
            os.makedirs(d, exist_ok=True)

    # ---------------- CSV HELPERS ----------------
    def _read_csv(self, file_path: str) -> List[Dict[str, Any]]:
        if not os.path.exists(file_path):
            return []
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            return list(reader)

    def _write_csv(self, file_path: str, data: List[Dict[str, Any]], fieldnames: Optional[List[str]] = None):
        if not data:
            return
        if not fieldnames:
            fieldnames = list(data[0].keys())
        with open(file_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)

    # ---------------- JSON HELPERS ----------------
    def _read_json(self, file_path: str, default: Any = None) -> Any:
        if not os.path.exists(file_path):
            return default if default is not None else {}
        with open(file_path, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except Exception:
                return default if default is not None else {}

    def _write_json(self, file_path: str, data: Any):
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    # ---------------- RAW SOURCES READERS ----------------
    def get_raw_tms_assets(self) -> List[Dict[str, Any]]:
        return self._read_csv(os.path.join(self.raw_dir, "TMS", "tms_assets.csv"))

    def get_raw_tms_maintenance(self) -> List[Dict[str, Any]]:
        return self._read_csv(os.path.join(self.raw_dir, "TMS", "tms_maintenance.csv"))

    def get_raw_smms_assets(self) -> List[Dict[str, Any]]:
        return self._read_csv(os.path.join(self.raw_dir, "SMMS", "smms_assets.csv"))

    def get_raw_smms_maintenance(self) -> List[Dict[str, Any]]:
        return self._read_csv(os.path.join(self.raw_dir, "SMMS", "smms_maintenance.csv"))

    def get_raw_tdms_assets(self) -> List[Dict[str, Any]]:
        return self._read_csv(os.path.join(self.raw_dir, "TDMS", "tdms_assets.csv"))

    def get_raw_tdms_maintenance(self) -> List[Dict[str, Any]]:
        return self._read_csv(os.path.join(self.raw_dir, "TDMS", "tdms_maintenance.csv"))

    def get_raw_coa_trains(self) -> List[Dict[str, Any]]:
        return self._read_csv(os.path.join(self.raw_dir, "COA", "coa_train_movements.csv"))

    def get_raw_bdms_requests(self) -> List[Dict[str, Any]]:
        return self._read_csv(os.path.join(self.raw_dir, "BDMS", "bdms_block_requests.csv"))

    # ---------------- REFERENCE DATA READERS ----------------
    def get_stations(self) -> List[Dict[str, Any]]:
        return self._read_json(os.path.join(self.ref_dir, "stations.json"), default=[])

    def get_corridors(self) -> List[Dict[str, Any]]:
        return self._read_csv(os.path.join(self.ref_dir, "corridors.csv"))

    def get_crews(self) -> List[Dict[str, Any]]:
        return self._read_csv(os.path.join(self.ref_dir, "crews.csv"))

    def get_dataset_manifest(self) -> Dict[str, Any]:
        return self._read_json(os.path.join(self.ref_dir, "dataset_manifest.json"), default={})

    def get_sections(self) -> List[Dict[str, Any]]:
        p = os.path.join(self.data_dir, "sections.csv")
        if not os.path.exists(p):
            p = os.path.join(self.ref_dir, "sections.csv")
        return self._read_csv(p)

    def get_maintenance_tasks(self, department: Optional[str] = None, section_id: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        p = os.path.join(self.data_dir, "maintenance_tasks.csv")
        if not os.path.exists(p):
            p = os.path.join(self.ref_dir, "maintenance_tasks.csv")
        tasks = self._read_csv(p)
        if department:
            tasks = [t for t in tasks if t.get("department", "").lower() == department.lower()]
        if section_id:
            tasks = [t for t in tasks if t.get("section_id") == section_id]
        if status:
            tasks = [t for t in tasks if t.get("status", "").lower() == status.lower()]
        return tasks

    def get_timetable_trains(self, section_id: Optional[str] = None) -> List[Dict[str, Any]]:
        p = os.path.join(self.data_dir, "timetable_trains.csv")
        if not os.path.exists(p):
            p = os.path.join(self.raw_dir, "COA", "timetable_trains.csv")
        trains = self._read_csv(p)
        if section_id:
            trains = [t for t in trains if t.get("section_id") == section_id]
        return trains

    def get_resources(self, department: Optional[str] = None) -> List[Dict[str, Any]]:
        p = os.path.join(self.data_dir, "resources.csv")
        if not os.path.exists(p):
            p = os.path.join(self.ref_dir, "resources.csv")
        res = self._read_csv(p)
        if department:
            res = [r for r in res if r.get("department", "").lower() == department.lower()]
        return res

    def get_baseline_blocks(self) -> List[Dict[str, Any]]:
        p = os.path.join(self.data_dir, "existing_blocks_baseline.csv")
        if not os.path.exists(p):
            p = os.path.join(self.ref_dir, "existing_blocks_baseline.csv")
        return self._read_csv(p)

    def save_corridor_availability(self, data: List[Dict[str, Any]]):
        with file_lock:
            p_json = os.path.join(self.unified_dir, "corridor_availability.json")
            self._write_json(p_json, data)
            p_csv = os.path.join(self.data_dir, "corridor_availability.csv")
            self._write_csv(p_csv, data)

    def get_corridor_availability_data(self) -> List[Dict[str, Any]]:
        p_json = os.path.join(self.unified_dir, "corridor_availability.json")
        if os.path.exists(p_json):
            return self._read_json(p_json, default=[])
        p_csv = os.path.join(self.data_dir, "corridor_availability.csv")
        return self._read_csv(p_csv)

    # ---------------- UNIFIED LAYER READ/WRITE ----------------
    def save_unified_jobs(self, jobs: List[Dict[str, Any]]):
        with file_lock:
            p = os.path.join(self.unified_dir, "unified_maintenance_jobs.json")
            self._write_json(p, jobs)

    def get_unified_jobs(self) -> List[Dict[str, Any]]:
        p = os.path.join(self.unified_dir, "unified_maintenance_jobs.json")
        return self._read_json(p, default=[])

    def save_sync_result(self, result: Dict[str, Any]):
        with file_lock:
            p = os.path.join(self.unified_dir, "integration_sync_result.json")
            self._write_json(p, result)

    def get_sync_result(self) -> Dict[str, Any]:
        p = os.path.join(self.unified_dir, "integration_sync_result.json")
        return self._read_json(p, default={})

    def save_optimization_sample(self, result: Dict[str, Any]):
        with file_lock:
            p = os.path.join(self.unified_dir, "optimization_result_sample.json")
            self._write_json(p, result)

    def get_optimization_sample(self) -> Dict[str, Any]:
        p = os.path.join(self.unified_dir, "optimization_result_sample.json")
        return self._read_json(p, default={})

    # ---------------- OUTPUTS: AUDIT LOGS ----------------
    def log_audit_event(self, event_type: str, action: str, details: Dict[str, Any], user: str = "System"):
        with file_lock:
            audit_file = os.path.join(self.audit_dir, "audit_trail.json")
            logs = self._read_json(audit_file, default=[])
            entry = {
                "id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
                "timestamp": datetime.now().isoformat(),
                "event_type": event_type,
                "action": action,
                "user": user,
                "details": details
            }
            logs.insert(0, entry)
            self._write_json(audit_file, logs[:500])
            return entry

    def get_audit_logs(self, limit: int = 100) -> List[Dict[str, Any]]:
        audit_file = os.path.join(self.audit_dir, "audit_trail.json")
        logs = self._read_json(audit_file, default=[])
        return logs[:limit]

    # ---------------- OUTPUTS: PLANS ----------------
    def save_plan(self, plan_data: Dict[str, Any]):
        with file_lock:
            plan_id = plan_data.get("id", f"PLAN-{uuid.uuid4().hex[:6].upper()}")
            plan_file = os.path.join(self.plans_dir, f"{plan_id}.json")
            self._write_json(plan_file, plan_data)
            # also update latest_plan.json
            latest_file = os.path.join(self.plans_dir, "latest_plan.json")
            self._write_json(latest_file, plan_data)

    def get_plan(self, plan_id: str) -> Optional[Dict[str, Any]]:
        plan_file = os.path.join(self.plans_dir, f"{plan_id}.json")
        if os.path.exists(plan_file):
            return self._read_json(plan_file)
        return None

    def get_latest_plan(self) -> Optional[Dict[str, Any]]:
        latest_file = os.path.join(self.plans_dir, "latest_plan.json")
        if os.path.exists(latest_file):
            return self._read_json(latest_file)
        # fallback: find newest in plans_dir
        plan_files = [f for f in os.listdir(self.plans_dir) if f.endswith(".json") and f != "latest_plan.json"]
        if plan_files:
            plan_files.sort(reverse=True)
            return self._read_json(os.path.join(self.plans_dir, plan_files[0]))
        return None

    # ---------------- OUTPUTS: SIMULATIONS ----------------
    def save_simulation_run(self, sim_id: str, data: Dict[str, Any]):
        with file_lock:
            p = os.path.join(self.sims_dir, f"{sim_id}.json")
            self._write_json(p, data)

    def get_simulation_run(self, sim_id: str) -> Optional[Dict[str, Any]]:
        p = os.path.join(self.sims_dir, f"{sim_id}.json")
        if os.path.exists(p):
            return self._read_json(p)
        return None

file_repo = FileRepository()
