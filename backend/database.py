import os
import json
import sqlite3
from typing import List, Dict, Any, Optional
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_KEY", ""))

DB_FILE = os.path.join(os.path.dirname(__file__), "railblock_local.db")


class DatabaseRepository:
    def __init__(self):
        self.supabase_client = None
        if SUPABASE_URL and SUPABASE_KEY:
            try:
                from supabase import create_client
                self.supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
                print("[DATABASE] Connected to remote Supabase PostgreSQL instance.")
            except Exception as e:
                print(f"[DATABASE WARNING] Supabase connection failed: {e}. Falling back to local engine.")
                self.supabase_client = None

        if not self.supabase_client:
            print(f"[DATABASE] Running with local persistence repository: {DB_FILE}")
            self._init_sqlite()

    def _get_conn(self):
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_sqlite(self):
        conn = self._get_conn()
        cur = conn.cursor()
        
        cur.executescript("""
        CREATE TABLE IF NOT EXISTS departments (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            silo_system TEXT NOT NULL,
            color_code TEXT NOT NULL,
            description TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS corridors (
            id TEXT PRIMARY KEY,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            division TEXT NOT NULL,
            zone TEXT NOT NULL,
            length_km REAL NOT NULL,
            track_type TEXT DEFAULT 'DOUBLE_LINE',
            gmt_annual REAL NOT NULL,
            speed_limit_kmph INTEGER DEFAULT 130,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS assets (
            id TEXT PRIMARY KEY,
            corridor_id TEXT,
            name TEXT NOT NULL,
            asset_type TEXT NOT NULL,
            km_post TEXT NOT NULL,
            installed_year INTEGER NOT NULL,
            last_inspected_date TEXT,
            condition_rating TEXT DEFAULT 'GOOD',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS work_items (
            id TEXT PRIMARY KEY,
            source_system TEXT NOT NULL,
            department_id TEXT,
            corridor_id TEXT,
            asset_id TEXT,
            title TEXT NOT NULL,
            description TEXT,
            work_type TEXT NOT NULL,
            duration_minutes INTEGER NOT NULL,
            required_resource TEXT,
            requested_date TEXT NOT NULL,
            requested_day TEXT NOT NULL,
            requested_start_hour INTEGER NOT NULL,
            requested_end_hour INTEGER NOT NULL,
            safety_risk_rating INTEGER DEFAULT 15,
            asset_criticality_rating INTEGER DEFAULT 12,
            overdue_days INTEGER DEFAULT 0,
            failure_history_count INTEGER DEFAULT 0,
            failure_probability REAL DEFAULT 0.25,
            traffic_density_factor REAL DEFAULT 1.0,
            deferral_consequence_rating INTEGER DEFAULT 5,
            priority_score INTEGER DEFAULT 50,
            priority_tier TEXT DEFAULT 'MEDIUM',
            priority_factors TEXT,
            status TEXT DEFAULT 'PENDING',
            is_emergency INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS timetable_windows (
            id TEXT PRIMARY KEY,
            corridor_id TEXT,
            day_of_week TEXT NOT NULL,
            train_number TEXT NOT NULL,
            train_name TEXT NOT NULL,
            train_type TEXT NOT NULL,
            blackout_start_minute INTEGER NOT NULL,
            blackout_end_minute INTEGER NOT NULL,
            is_critical_punctuality INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS department_resources (
            id TEXT PRIMARY KEY,
            department_id TEXT,
            resource_type TEXT NOT NULL,
            resource_name TEXT NOT NULL,
            total_available_units INTEGER DEFAULT 1,
            hourly_cost_inr REAL DEFAULT 15000.0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS plans (
            id TEXT PRIMARY KEY,
            version INTEGER DEFAULT 1,
            title TEXT NOT NULL,
            horizon_start_date TEXT NOT NULL,
            horizon_end_date TEXT NOT NULL,
            status TEXT DEFAULT 'DRAFT',
            created_by TEXT DEFAULT 'CP-SAT Optimizer',
            approved_by TEXT,
            approved_at TEXT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS plan_items (
            id TEXT PRIMARY KEY,
            plan_id TEXT,
            work_item_id TEXT,
            corridor_id TEXT,
            day_of_week TEXT NOT NULL,
            scheduled_start_minute INTEGER NOT NULL,
            scheduled_end_minute INTEGER NOT NULL,
            block_id TEXT NOT NULL,
            is_shadow_block INTEGER DEFAULT 0,
            is_modified_by_planner INTEGER DEFAULT 0,
            status TEXT DEFAULT 'PLANNED',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS plan_modifications (
            id TEXT PRIMARY KEY,
            plan_id TEXT,
            work_item_id TEXT,
            modified_by TEXT NOT NULL,
            previous_schedule TEXT NOT NULL,
            new_schedule TEXT NOT NULL,
            reason TEXT NOT NULL,
            modified_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            event_type TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            user_id TEXT DEFAULT 'SYSTEM',
            action TEXT NOT NULL,
            details TEXT NOT NULL,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS optimization_runs (
            id TEXT PRIMARY KEY,
            plan_id TEXT,
            solver_name TEXT DEFAULT 'Google OR-Tools CP-SAT',
            status TEXT NOT NULL,
            solve_duration_ms INTEGER NOT NULL,
            num_constraints INTEGER NOT NULL,
            num_variables INTEGER NOT NULL,
            objective_value REAL NOT NULL,
            before_metrics TEXT NOT NULL,
            after_metrics TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS kpi_snapshots (
            id TEXT PRIMARY KEY,
            plan_id TEXT,
            phase TEXT NOT NULL,
            separate_blocks_count INTEGER NOT NULL,
            total_blocked_hours REAL NOT NULL,
            critical_work_completed INTEGER NOT NULL,
            total_work_completed INTEGER NOT NULL,
            conflicts_count INTEGER NOT NULL,
            compatible_groupings_used INTEGER NOT NULL,
            high_priority_completed INTEGER NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        """)
        conn.commit()
        conn.close()

    # --- Audit Log Helpers ---
    def record_audit(self, event_type: str, entity_type: str, entity_id: str, action: str, details: Dict[str, Any], user_id: str = "SYSTEM"):
        import uuid
        log_id = f"AUD-{uuid.uuid4().hex[:8].upper()}"
        ts = datetime.utcnow().isoformat()
        
        conn = self._get_conn()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO audit_logs (id, event_type, entity_type, entity_id, user_id, action, details, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (log_id, event_type, entity_type, entity_id, user_id, action, json.dumps(details), ts)
        )
        conn.commit()
        conn.close()

    def get_audit_logs(self, limit: int = 100) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        cur = conn.cursor()
        cur.execute("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?", (limit,))
        rows = cur.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            try:
                d["details"] = json.loads(d["details"])
            except Exception:
                pass
            result.append(d)
        conn.close()
        return result

    # --- Work Items ---
    def get_work_items(self) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT w.*, d.name as department_name, c.name as corridor_name, a.name as asset_name
            FROM work_items w
            LEFT JOIN departments d ON w.department_id = d.id
            LEFT JOIN corridors c ON w.corridor_id = c.id
            LEFT JOIN assets a ON w.asset_id = a.id
            ORDER BY w.priority_score DESC
        """)
        rows = cur.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            if d.get("priority_factors"):
                try:
                    d["priority_factors"] = json.loads(d["priority_factors"])
                except Exception:
                    pass
            d["is_emergency"] = bool(d.get("is_emergency"))
            result.append(d)
        conn.close()
        return result

    def get_work_item(self, work_id: str) -> Optional[Dict[str, Any]]:
        conn = self._get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT w.*, d.name as department_name, c.name as corridor_name, a.name as asset_name
            FROM work_items w
            LEFT JOIN departments d ON w.department_id = d.id
            LEFT JOIN corridors c ON w.corridor_id = c.id
            LEFT JOIN assets a ON w.asset_id = a.id
            WHERE w.id = ?
        """, (work_id,))
        row = cur.fetchone()
        conn.close()
        if not row:
            return None
        d = dict(row)
        if d.get("priority_factors"):
            try:
                d["priority_factors"] = json.loads(d["priority_factors"])
            except Exception:
                pass
        d["is_emergency"] = bool(d.get("is_emergency"))
        return d

    def update_work_item_priority(self, work_id: str, score: int, tier: str, factors: Dict[str, float]):
        conn = self._get_conn()
        cur = conn.cursor()
        cur.execute(
            """UPDATE work_items 
               SET priority_score = ?, priority_tier = ?, priority_factors = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (score, tier, json.dumps(factors), work_id)
        )
        conn.commit()
        conn.close()

    def insert_work_item(self, item: Dict[str, Any]):
        conn = self._get_conn()
        cur = conn.cursor()
        factors_str = json.dumps(item.get("priority_factors")) if isinstance(item.get("priority_factors"), dict) else item.get("priority_factors", "{}")
        cur.execute(
            """INSERT OR REPLACE INTO work_items (
                id, source_system, department_id, corridor_id, asset_id, title, description,
                work_type, duration_minutes, required_resource, requested_date, requested_day,
                requested_start_hour, requested_end_hour, safety_risk_rating, asset_criticality_rating,
                overdue_days, failure_history_count, failure_probability, traffic_density_factor,
                deferral_consequence_rating, priority_score, priority_tier, priority_factors,
                status, is_emergency
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                item["id"], item["source_system"], item["department_id"], item["corridor_id"],
                item.get("asset_id", "A-GENERIC"), item["title"], item.get("description", ""),
                item["work_type"], item["duration_minutes"], item.get("required_resource"),
                item["requested_date"], item.get("requested_day", "Monday"),
                item["requested_start_hour"], item["requested_end_hour"],
                item.get("safety_risk_rating", 15), item.get("asset_criticality_rating", 12),
                item.get("overdue_days", 0), item.get("failure_history_count", 0),
                item.get("failure_probability", 0.25), item.get("traffic_density_factor", 1.0),
                item.get("deferral_consequence_rating", 5), item.get("priority_score", 50),
                item.get("priority_tier", "MEDIUM"), factors_str,
                item.get("status", "PENDING"), 1 if item.get("is_emergency") else 0
            )
        )
        conn.commit()
        conn.close()

    # --- Corridors & Departments ---
    def get_corridors(self) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        cur = conn.cursor()
        cur.execute("SELECT * FROM corridors ORDER BY code ASC")
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows

    def get_departments(self) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        cur = conn.cursor()
        cur.execute("SELECT * FROM departments ORDER BY silo_system ASC")
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows

    def get_timetable_windows(self) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        cur = conn.cursor()
        cur.execute("SELECT * FROM timetable_windows ORDER BY blackout_start_minute ASC")
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows

    def get_resources(self) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        cur = conn.cursor()
        cur.execute("SELECT * FROM department_resources")
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows

    # --- Plans and Plan Items ---
    def save_plan(self, plan_data: Dict[str, Any], items: List[Dict[str, Any]], before_kpis: Dict[str, Any], after_kpis: Dict[str, Any]):
        conn = self._get_conn()
        cur = conn.cursor()
        
        # Save Plan
        cur.execute(
            """INSERT OR REPLACE INTO plans (id, version, title, horizon_start_date, horizon_end_date, status, created_by, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                plan_data["id"], plan_data.get("version", 1), plan_data["title"],
                plan_data["horizon_start_date"], plan_data["horizon_end_date"],
                plan_data.get("status", "OPTIMIZED"), plan_data.get("created_by", "CP-SAT Optimizer"),
                plan_data.get("notes", "")
            )
        )

        # Clear old items if updating same plan id
        cur.execute("DELETE FROM plan_items WHERE plan_id = ?", (plan_data["id"],))

        for it in items:
            cur.execute(
                """INSERT INTO plan_items (
                    id, plan_id, work_item_id, corridor_id, day_of_week,
                    scheduled_start_minute, scheduled_end_minute, block_id,
                    is_shadow_block, is_modified_by_planner, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    it["id"], plan_data["id"], it["work_item_id"], it["corridor_id"],
                    it["day_of_week"], it["scheduled_start_minute"], it["scheduled_end_minute"],
                    it["block_id"], 1 if it.get("is_shadow_block") else 0,
                    1 if it.get("is_modified_by_planner") else 0, it.get("status", "PLANNED")
                )
            )

        # Save KPI Snapshots
        import uuid
        cur.execute(
            """INSERT INTO kpi_snapshots (
                id, plan_id, phase, separate_blocks_count, total_blocked_hours,
                critical_work_completed, total_work_completed, conflicts_count,
                compatible_groupings_used, high_priority_completed
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                f"KPI-B-{uuid.uuid4().hex[:6]}", plan_data["id"], "BEFORE_OPTIMIZATION",
                before_kpis["separate_blocks_count"], before_kpis["total_blocked_hours"],
                before_kpis["critical_work_completed"], before_kpis["total_work_completed"],
                before_kpis["conflicts_count"], before_kpis["compatible_groupings_used"],
                before_kpis.get("high_priority_completed", 0)
            )
        )
        cur.execute(
            """INSERT INTO kpi_snapshots (
                id, plan_id, phase, separate_blocks_count, total_blocked_hours,
                critical_work_completed, total_work_completed, conflicts_count,
                compatible_groupings_used, high_priority_completed
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                f"KPI-A-{uuid.uuid4().hex[:6]}", plan_data["id"], "AFTER_OPTIMIZATION",
                after_kpis["separate_blocks_count"], after_kpis["total_blocked_hours"],
                after_kpis["critical_work_completed"], after_kpis["total_work_completed"],
                after_kpis["conflicts_count"], after_kpis["compatible_groupings_used"],
                after_kpis.get("high_priority_completed", 0)
            )
        )

        conn.commit()
        conn.close()

    def get_latest_plan(self) -> Optional[Dict[str, Any]]:
        conn = self._get_conn()
        cur = conn.cursor()
        cur.execute("SELECT * FROM plans ORDER BY version DESC, updated_at DESC LIMIT 1")
        plan_row = cur.fetchone()
        if not plan_row:
            conn.close()
            return None
        
        plan = dict(plan_row)
        
        # Get items with joined work_item details
        cur.execute("""
            SELECT pi.*, w.title as work_title, w.priority_score, w.priority_tier,
                   w.department_id, d.name as department_name, c.name as corridor_name
            FROM plan_items pi
            JOIN work_items w ON pi.work_item_id = w.id
            LEFT JOIN departments d ON w.department_id = d.id
            LEFT JOIN corridors c ON pi.corridor_id = c.id
            WHERE pi.plan_id = ?
            ORDER BY pi.day_of_week, pi.scheduled_start_minute
        """, (plan["id"],))
        
        items = []
        for r in cur.fetchall():
            it = dict(r)
            it["is_shadow_block"] = bool(it.get("is_shadow_block"))
            it["is_modified_by_planner"] = bool(it.get("is_modified_by_planner"))
            # Format time strings
            start_m = it["scheduled_start_minute"]
            end_m = it["scheduled_end_minute"]
            it["start_time_formatted"] = f"{start_m // 60:02d}:{start_m % 60:02d}"
            it["end_time_formatted"] = f"{end_m // 60:02d}:{end_m % 60:02d}"
            it["duration_minutes"] = end_m - start_m
            items.append(it)
            
        plan["items"] = items

        # Get KPI Snapshots for this plan
        cur.execute("SELECT * FROM kpi_snapshots WHERE plan_id = ? ORDER BY created_at ASC", (plan["id"],))
        kpi_rows = [dict(r) for r in cur.fetchall()]
        plan["kpis"] = kpi_rows
        
        conn.close()
        return plan

    def modify_plan_item(self, plan_id: str, work_item_id: str, new_day: str, new_start: int, new_end: int, user: str, reason: str):
        conn = self._get_conn()
        cur = conn.cursor()
        
        # Get previous state
        cur.execute("SELECT * FROM plan_items WHERE plan_id = ? AND work_item_id = ?", (plan_id, work_item_id))
        prev_row = cur.fetchone()
        if not prev_row:
            conn.close()
            raise ValueError("Plan item not found.")
        prev_dict = dict(prev_row)
        
        # Update plan item
        cur.execute("""
            UPDATE plan_items
            SET day_of_week = ?, scheduled_start_minute = ?, scheduled_end_minute = ?, is_modified_by_planner = 1
            WHERE plan_id = ? AND work_item_id = ?
        """, (new_day, new_start, new_end, plan_id, work_item_id))

        # Update plan status to MODIFIED
        cur.execute("UPDATE plans SET status = 'MODIFIED', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (plan_id,))

        # Record Modification
        import uuid
        mod_id = f"MOD-{uuid.uuid4().hex[:6]}"
        prev_schedule = {
            "day": prev_dict["day_of_week"],
            "start_minute": prev_dict["scheduled_start_minute"],
            "end_minute": prev_dict["scheduled_end_minute"]
        }
        new_schedule = {
            "day": new_day,
            "start_minute": new_start,
            "end_minute": new_end
        }
        cur.execute("""
            INSERT INTO plan_modifications (id, plan_id, work_item_id, modified_by, previous_schedule, new_schedule, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (mod_id, plan_id, work_item_id, user, json.dumps(prev_schedule), json.dumps(new_schedule), reason))

        conn.commit()
        conn.close()

        # Record Audit
        self.record_audit(
            event_type="PLANNER_MODIFY",
            entity_type="PLAN_ITEM",
            entity_id=work_item_id,
            action=f"Planner modified schedule slot for {work_item_id}",
            details={
                "plan_id": plan_id,
                "previous_slot": f"{prev_schedule['day']} {prev_schedule['start_minute']//60:02d}:{prev_schedule['start_minute']%60:02d}",
                "new_slot": f"{new_schedule['day']} {new_schedule['start_minute']//60:02d}:{new_schedule['start_minute']%60:02d}",
                "reason": reason,
                "modified_by": user
            },
            user_id=user
        )

    def approve_plan(self, plan_id: str, approved_by: str, comments: str = ""):
        conn = self._get_conn()
        cur = conn.cursor()
        ts = datetime.utcnow().isoformat()
        cur.execute("""
            UPDATE plans
            SET status = 'APPROVED', approved_by = ?, approved_at = ?, notes = ?, updated_at = ?
            WHERE id = ?
        """, (approved_by, ts, comments, ts, plan_id))
        conn.commit()
        conn.close()

        self.record_audit(
            event_type="PLAN_APPROVE",
            entity_type="PLAN",
            entity_id=plan_id,
            action=f"Plan {plan_id} approved by {approved_by}",
            details={"approved_by": approved_by, "comments": comments, "timestamp": ts},
            user_id=approved_by
        )


db = DatabaseRepository()
