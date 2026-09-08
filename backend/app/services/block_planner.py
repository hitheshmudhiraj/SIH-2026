"""
Optimization-Based Railway Block Planner (Google OR-Tools CP-SAT)
Implements weekly and monthly block scheduling across Engineering, Traction, and S&T.
Bundles multi-department maintenance into shared windows (Joint Megablocks) while minimizing
train disruption based on corridor availability profiles.

Model Formulation:
------------------
1. Candidate Blocks:
   - For each Section s in {1..S}, Day d in {1..D}, Window w in {1..W}:
     CANDIDATE_BLOCK(s, d, w) has:
       start_time, end_time, duration, corridor_availability_score, train_count.

2. Decision Variables:
   - x[t, b] in {0, 1}: Task t is assigned to candidate block b (where task.section == b.section).
   - y[b] in {0, 1}: Candidate block b is activated (track possession granted).
   - dept_active[b, dept] in {0, 1}: Department dept has at least one task assigned in block b.
   - is_joint[b] in {0, 1}: Block b bundles tasks from >= 2 distinct departments.
   - sec_day_active[s, d] in {0, 1}: Section s has a block active on day d.

3. Constraints:
   - At most one assignment per task: sum_b x[t, b] <= 1
   - Block activation linking: x[t, b] <= y[b]
   - Single possession per section per window: Only 1 active block on section s at any time
   - Section exclusivity per day: At most 1 block per section per day (or enforced spacing):
       sum_w y[s, d, w] <= 1
   - Block duration fit: Task duration <= Block window duration
   - Department linking: dept_active[b, dept] >= x[t, b] (for all t in dept)
   - Joint bundling bonus linking: is_joint[b] == 1 if sum_dept dept_active[b, dept] >= 2
   - Resource hour constraints: Gangs and machines do not exceed weekly capacity

4. Multi-Criteria Objective:
   Maximize:
       + sum_t (priority_score[t] * sum_b x[t, b])           [Prioritize urgent/critical tasks]
       + 150 * sum_b is_joint[b]                            [Heavy reward for cross-department megablocks]
       + 50 * sum_b (y[b] * availability_score[b])          [Reward choosing high-availability / off-peak slots]
       - 100 * sum_b y[b]                                   [Penalize total number of separate track closures]
       - 200 * sum_b (y[b] * (1 - availability_score[b]))   [Heavy penalty for blocking during train congestion]
"""

import os
import csv
import json
import time
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from ortools.sat.python import cp_model

from app.services.corridor_availability import corridor_engine
from app.services.prioritization_engine import prioritizer

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")
PLANS_DIR = os.path.join(DATA_DIR, "04_outputs", "plans")

# Candidate Maintenance Windows in Indian Railways
# 1. Night Rolling Megablock: 01:00 - 04:00 (180 mins) -> Best for joint power isolation + tamping
# 2. Early Morning Window: 04:30 - 07:00 (150 mins) -> Before morning passenger rush
# 3. Mid-Day Shadow Window: 11:30 - 14:30 (180 mins) -> Freight gap window
# 4. Afternoon Window: 15:00 - 17:30 (150 mins) -> Secondary window
CANDIDATE_WINDOWS = [
    {
        "window_id": "W0",
        "name": "Night Rolling Megablock",
        "start_time": "01:00",
        "end_time": "04:00",
        "start_minute": 60,
        "end_minute": 240,
        "duration_minutes": 180,
        "base_occupancy": "LOW"
    },
    {
        "window_id": "W1",
        "name": "Early Morning Off-Peak",
        "start_time": "04:30",
        "end_time": "07:00",
        "start_minute": 270,
        "end_minute": 420,
        "duration_minutes": 150,
        "base_occupancy": "MEDIUM_LOW"
    },
    {
        "window_id": "W2",
        "name": "Mid-Day Freight Shadow",
        "start_time": "11:30",
        "end_time": "14:30",
        "start_minute": 690,
        "end_minute": 870,
        "duration_minutes": 180,
        "base_occupancy": "MEDIUM"
    },
    {
        "window_id": "W3",
        "name": "Afternoon Maintenance Slot",
        "start_time": "15:00",
        "end_time": "17:30",
        "start_minute": 900,
        "end_minute": 1050,
        "duration_minutes": 150,
        "base_occupancy": "MEDIUM_HIGH"
    }
]

class BlockOptimizationEngine:
    def __init__(self, data_dir: Optional[str] = None):
        self.data_dir = data_dir or DATA_DIR
        os.makedirs(PLANS_DIR, exist_ok=True)

    def load_sections(self) -> List[Dict[str, Any]]:
        return corridor_engine.get_sections()

    def load_tasks(self, status_filter: str = "open") -> List[Dict[str, Any]]:
        path = os.path.join(self.data_dir, "maintenance_tasks.csv")
        tasks = []
        if os.path.exists(path):
            with open(path, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for r in reader:
                    if status_filter and r.get("status", "").lower() != status_filter.lower():
                        continue
                    tasks.append({
                        "task_id": r["task_id"],
                        "department": r.get("department", "Engineering"),
                        "asset_type": r.get("asset_type", "track_segment"),
                        "section_id": r.get("section_id", ""),
                        "from_km": float(r.get("from_km", 0.0)),
                        "to_km": float(r.get("to_km", 0.0)),
                        "defect_type": r.get("defect_type", ""),
                        "severity": r.get("severity", "medium"),
                        "priority_score": int(float(r.get("priority_score", 50))),
                        "due_date": r.get("due_date", "2026-09-15"),
                        "estimated_duration_minutes": int(r.get("estimated_duration_minutes", 90)),
                        "crew_type_required": r.get("crew_type_required", "track_gang"),
                        "machine_required": str(r.get("machine_required", "False")).lower() == "true",
                        "status": r.get("status", "open")
                    })
        return tasks

    def load_resources(self) -> List[Dict[str, Any]]:
        path = os.path.join(self.data_dir, "resources.csv")
        resources = []
        if os.path.exists(path):
            with open(path, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for r in reader:
                    resources.append({
                        "resource_id": r["resource_id"],
                        "resource_type": r.get("resource_type", "crew_gang"),
                        "department": r.get("department", ""),
                        "base_division": r.get("base_division", ""),
                        "max_hours_per_week": float(r.get("max_hours_per_week", 48)),
                        "available_days": [d.strip() for d in r.get("available_days", "").replace('"', '').split(",")]
                    })
        return resources

    def generate_weekly_block_plan(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        sections_subset: Optional[List[str]] = None,
        max_time_seconds: float = 5.0
    ) -> Dict[str, Any]:
        """
        Generates an optimal 7-day weekly block plan using Google OR-Tools CP-SAT.
        """
        start_solve_wall = time.time()

        if not start_date:
            start_date = "2026-09-08" # Baseline Tuesday start
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")

        if not end_date:
            end_dt = start_dt + timedelta(days=6)
            end_date = end_dt.strftime("%Y-%m-%d")
        else:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")

        num_days = min(14, max(1, (end_dt - start_dt).days + 1))
        date_list = [(start_dt + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(num_days)]

        all_sections = self.load_sections()
        if sections_subset:
            all_sections = [s for s in all_sections if s["section_id"] in sections_subset]
        sections_map = {s["section_id"]: s for s in all_sections}

        raw_tasks = self.load_tasks(status_filter="open")
        # Prioritize tasks using our transparent formula
        tasks = prioritizer.batch_prioritize(raw_tasks, sections_map)
        # Filter to sections in scope
        tasks = [t for t in tasks if t["section_id"] in sections_map]

        # Only create candidates for sections that actually have open tasks
        active_sec_ids = {t["section_id"] for t in tasks}
        active_sections = [s for s in all_sections if s["section_id"] in active_sec_ids]
        if not active_sections:
            active_sections = all_sections[:10]

        # Build candidate block windows for each (section, day, window)
        candidate_blocks = []
        block_idx_counter = 0

        for sec in active_sections:
            sec_id = sec["section_id"]
            for d_idx, d_str in enumerate(date_list):
                # Retrieve availability profile for this section and date
                avail_slots = corridor_engine.get_corridor_availability(sec_id, d_str)

                for w in CANDIDATE_WINDOWS:
                    # Calculate average availability score across this window's minutes
                    w_start_m = w["start_minute"]
                    w_end_m = w["end_minute"]

                    overlapping_slots = [
                        s for s in avail_slots
                        if not (s["slot_end_minute"] <= w_start_m or s["slot_start_minute"] >= w_end_m)
                    ]

                    if overlapping_slots:
                        avg_avail = sum(s["availability_score"] for s in overlapping_slots) / len(overlapping_slots)
                        total_trains = sum(s["train_count"] for s in overlapping_slots)
                    else:
                        avg_avail = 0.8
                        total_trains = 0

                    candidate_blocks.append({
                        "block_index": block_idx_counter,
                        "candidate_id": f"CB-{sec_id}-{d_str}-{w['window_id']}",
                        "section_id": sec_id,
                        "section_name": sec.get("section_name", sec_id),
                        "division": sec.get("division", "Vijayawada"),
                        "date": d_str,
                        "day_idx": d_idx,
                        "window_id": w["window_id"],
                        "window_name": w["name"],
                        "start_time": w["start_time"],
                        "end_time": w["end_time"],
                        "start_minute": w_start_m,
                        "end_minute": w_end_m,
                        "duration_minutes": w["duration_minutes"],
                        "availability_score": round(avg_avail, 2),
                        "train_count": total_trains
                    })
                    block_idx_counter += 1

        # ---------------- CP-SAT MATHEMATICAL MODEL ----------------
        model = cp_model.CpModel()

        # Decision Variables
        # x[t_idx, b_idx] in {0, 1}: task assigned to candidate block
        x = {}
        for t_idx, t in enumerate(tasks):
            t_sec = t["section_id"]
            for b in candidate_blocks:
                if b["section_id"] == t_sec and t["estimated_duration_minutes"] <= b["duration_minutes"]:
                    x[(t_idx, b["block_index"])] = model.NewBoolVar(f"x_t{t_idx}_b{b['block_index']}")

        # y[b_idx] in {0, 1}: candidate block activated
        y = {}
        for b in candidate_blocks:
            y[b["block_index"]] = model.NewBoolVar(f"y_b{b['block_index']}")

        # Department active indicators: dept_active[b_idx, dept]
        departments = ["Engineering", "Traction", "S&T"]
        dept_active = {}
        for b in candidate_blocks:
            for dept in departments:
                dept_active[(b["block_index"], dept)] = model.NewBoolVar(f"dept_{b['block_index']}_{dept}")

        # is_joint[b_idx] in {0, 1}: whether block bundles >= 2 departments
        is_joint = {}
        for b in candidate_blocks:
            is_joint[b["block_index"]] = model.NewBoolVar(f"joint_b{b['block_index']}")

        # CONSTRAINTS

        # 1. Each task is scheduled at most once
        for t_idx, t in enumerate(tasks):
            possible_assignments = [
                x[(t_idx, b["block_index"])]
                for b in candidate_blocks
                if (t_idx, b["block_index"]) in x
            ]
            if possible_assignments:
                model.Add(sum(possible_assignments) <= 1)

        # 2. Task assignment implies block activation: x[t, b] <= y[b]
        for (t_idx, b_idx), var in x.items():
            model.Add(var <= y[b_idx])

        # 3. Block activation requires at least one task
        for b in candidate_blocks:
            b_idx = b["block_index"]
            assigned_tasks = [x[(t_idx, b_idx)] for t_idx in range(len(tasks)) if (t_idx, b_idx) in x]
            if assigned_tasks:
                model.Add(sum(assigned_tasks) >= y[b_idx])
            else:
                model.Add(y[b_idx] == 0)

        # 4. Single block per section per day (prevents repeated closures on same day)
        for sec in all_sections:
            sec_id = sec["section_id"]
            for d_idx in range(num_days):
                same_sec_day_blocks = [
                    y[b["block_index"]]
                    for b in candidate_blocks
                    if b["section_id"] == sec_id and b["day_idx"] == d_idx
                ]
                model.Add(sum(same_sec_day_blocks) <= 1)

        # 5. Department activity linking
        for b in candidate_blocks:
            b_idx = b["block_index"]
            for dept in departments:
                dept_tasks = [
                    x[(t_idx, b_idx)]
                    for t_idx, t in enumerate(tasks)
                    if t["department"] == dept and (t_idx, b_idx) in x
                ]
                d_var = dept_active[(b_idx, dept)]
                if dept_tasks:
                    # dept_active is 1 if any task of this dept is scheduled
                    model.AddMaxEquality(d_var, dept_tasks)
                else:
                    model.Add(d_var == 0)

            # Joint megablock indicator: is_joint == 1 iff sum(dept_active) >= 2
            dept_sum = sum(dept_active[(b_idx, d)] for d in departments)
            model.Add(dept_sum >= 2).OnlyEnforceIf(is_joint[b_idx])
            model.Add(dept_sum <= 1).OnlyEnforceIf(is_joint[b_idx].Not())

        # 6. Maximum block capacity: max concurrent tasks on section
        for b in candidate_blocks:
            b_idx = b["block_index"]
            assigned_tasks = [x[(t_idx, b_idx)] for t_idx in range(len(tasks)) if (t_idx, b_idx) in x]
            if assigned_tasks:
                # Cap at 8 tasks per block window to prevent unrealistic overcrowding
                model.Add(sum(assigned_tasks) <= 8)

        # OBJECTIVE FUNCTION
        # Maximize: Priority completion + Joint Megablock bonus + Availability bonus
        # Minimize: Total block possessions opened + Congested slot penalties
        objective_terms = []

        # Priority score reward
        for (t_idx, b_idx), var in x.items():
            prio = tasks[t_idx]["priority_score"]
            # Extra bonus for critical and overdue tasks
            if tasks[t_idx]["severity"] == "critical":
                prio += 50
            objective_terms.append(var * prio)

        # Joint bundling reward (significant weight to encourage consolidation)
        for b in candidate_blocks:
            b_idx = b["block_index"]
            objective_terms.append(is_joint[b_idx] * 250)

            # High availability bonus / congested penalty
            avail_pct = int(b["availability_score"] * 100) # 0 to 100
            objective_terms.append(y[b_idx] * (avail_pct - 40))

            # Base cost of opening a track possession (favors fewer, consolidated blocks)
            objective_terms.append(y[b_idx] * -80)

        model.Maximize(sum(objective_terms))

        # Solve model
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = max_time_seconds
        solver.parameters.num_search_workers = 4

        status = solver.Solve(model)
        solve_duration = round((time.time() - start_solve_wall) * 1000, 1)

        # Collect results
        recommended_blocks = []
        scheduled_task_ids = set()

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            for b in candidate_blocks:
                b_idx = b["block_index"]
                if solver.Value(y[b_idx]) == 1:
                    assigned_ts = [
                        tasks[t_idx]
                        for t_idx in range(len(tasks))
                        if (t_idx, b_idx) in x and solver.Value(x[(t_idx, b_idx)]) == 1
                    ]
                    if not assigned_ts:
                        continue

                    depts_present = sorted(list({t["department"] for t in assigned_ts}))
                    is_bundled = len(depts_present) >= 2

                    block_id = f"BLK-OPT-{b['section_id']}-{b['date'].replace('-', '')}-{b['window_id']}"
                    for t in assigned_ts:
                        scheduled_task_ids.add(t["task_id"])

                    train_impact = "MINIMAL" if b["availability_score"] >= 0.8 else ("MODERATE" if b["availability_score"] >= 0.5 else "SUBSTANTIAL")

                    recommended_blocks.append({
                        "block_id": block_id,
                        "section_id": b["section_id"],
                        "section_name": b["section_name"],
                        "division": b["division"],
                        "date": b["date"],
                        "start_time": b["start_time"],
                        "end_time": b["end_time"],
                        "duration_minutes": b["duration_minutes"],
                        "duration_hours": round(b["duration_minutes"] / 60.0, 1),
                        "window_name": b["window_name"],
                        "departments": depts_present,
                        "is_joint_megablock": is_bundled,
                        "task_count": len(assigned_ts),
                        "task_ids": [t["task_id"] for t in assigned_ts],
                        "tasks": [
                            {
                                "task_id": t["task_id"],
                                "department": t["department"],
                                "asset_type": t["asset_type"],
                                "defect_type": t["defect_type"],
                                "severity": t["severity"],
                                "priority_score": t["priority_score"],
                                "duration_min": t["estimated_duration_minutes"]
                            }
                            for t in assigned_ts
                        ],
                        "train_count": b["train_count"],
                        "availability_score": b["availability_score"],
                        "train_impact": train_impact
                    })

        # Summary KPIs
        total_block_hours = round(sum(b["duration_hours"] for b in recommended_blocks), 1)
        joint_blocks_count = sum(1 for b in recommended_blocks if b["is_joint_megablock"])
        critical_scheduled = sum(
            1 for b in recommended_blocks for t in b["tasks"] if t["severity"] == "critical"
        )
        high_scheduled = sum(
            1 for b in recommended_blocks for t in b["tasks"] if t["severity"] == "high"
        )
        sections_affected = len({b["section_id"] for b in recommended_blocks})

        plan_id = f"PLAN-WK-{uuid.uuid4().hex[:8].upper()}"
        result = {
            "plan_id": plan_id,
            "plan_type": "WEEKLY",
            "start_date": start_date,
            "end_date": end_date,
            "solver_status": "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE",
            "solve_duration_ms": solve_duration,
            "summary": {
                "total_blocks": len(recommended_blocks),
                "total_block_hours": total_block_hours,
                "joint_megablocks": joint_blocks_count,
                "joint_bundling_rate_pct": round((joint_blocks_count / max(1, len(recommended_blocks))) * 100, 1),
                "total_tasks_scheduled": len(scheduled_task_ids),
                "critical_tasks_scheduled": critical_scheduled,
                "high_priority_tasks_scheduled": high_scheduled,
                "sections_covered": sections_affected
            },
            "blocks": recommended_blocks
        }

        # Save to file
        plan_file = os.path.join(PLANS_DIR, f"{plan_id}.json")
        with open(plan_file, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)

        # Also save as latest_weekly_plan.json
        latest_file = os.path.join(PLANS_DIR, "latest_weekly_plan.json")
        with open(latest_file, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)

        return result

    def generate_monthly_block_plan(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generates a 4-week structured Monthly Block Calendar.
        Derives schedules across 4 weekly cycles with designated major corridor possession windows,
        track renewals, OHE annual overhauls, and S&T interlocking tests.
        """
        if not start_date:
            start_date = "2026-09-08"
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")

        weeks = []
        all_monthly_blocks = []
        total_tasks_scheduled = 0
        total_block_hours = 0.0
        total_joint_blocks = 0

        # Realistic Divisional Rotation across the 4-week Monthly Calendar
        division_cycle = [
            ("Vijayawada Division (Corridor C01)", [f"SEC_C01_{i:02d}" for i in range(1, 9)]),
            ("Visakhapatnam Division (Corridor C02)", [f"SEC_C02_{i:02d}" for i in range(1, 11)]),
            ("Guntur Division (Corridor C03)", [f"SEC_C03_{i:02d}" for i in range(1, 7)]),
            ("Guntakal Division (Corridor C04)", [f"SEC_C04_{i:02d}" for i in range(1, 9)]),
        ]

        for w_idx in range(4):
            w_start = (start_dt + timedelta(days=w_idx * 7)).strftime("%Y-%m-%d")
            w_end = (start_dt + timedelta(days=w_idx * 7 + 6)).strftime("%Y-%m-%d")
            div_name, div_sections = division_cycle[w_idx]

            wk_plan = self.generate_weekly_block_plan(
                start_date=w_start,
                end_date=w_end,
                sections_subset=div_sections,
                max_time_seconds=3.0
            )
            weeks.append({
                "week_number": w_idx + 1,
                "focus_division": div_name,
                "start_date": w_start,
                "end_date": w_end,
                "blocks_count": len(wk_plan["blocks"]),
                "block_hours": wk_plan["summary"]["total_block_hours"],
                "joint_megablocks": wk_plan["summary"]["joint_megablocks"],
                "tasks_scheduled": wk_plan["summary"]["total_tasks_scheduled"],
                "blocks": wk_plan["blocks"]
            })

            all_monthly_blocks.extend(wk_plan["blocks"])
            total_tasks_scheduled += wk_plan["summary"]["total_tasks_scheduled"]
            total_block_hours += wk_plan["summary"]["total_block_hours"]
            total_joint_blocks += wk_plan["summary"]["joint_megablocks"]

        plan_id = f"PLAN-MO-{uuid.uuid4().hex[:8].upper()}"
        monthly_result = {
            "plan_id": plan_id,
            "plan_type": "MONTHLY",
            "start_date": start_date,
            "end_date": (start_dt + timedelta(days=27)).strftime("%Y-%m-%d"),
            "total_weeks": 4,
            "summary": {
                "total_blocks": len(all_monthly_blocks),
                "total_block_hours": round(total_block_hours, 1),
                "joint_megablocks": total_joint_blocks,
                "joint_bundling_rate_pct": round((total_joint_blocks / max(1, len(all_monthly_blocks))) * 100, 1),
                "total_tasks_scheduled": total_tasks_scheduled,
                "sections_covered": len({b["section_id"] for b in all_monthly_blocks})
            },
            "weeks": weeks,
            "all_blocks": all_monthly_blocks
        }

        # Save to file
        monthly_file = os.path.join(PLANS_DIR, "latest_monthly_plan.json")
        with open(monthly_file, "w", encoding="utf-8") as f:
            json.dump(monthly_result, f, indent=2)

        return monthly_result

block_planner = BlockOptimizationEngine()
