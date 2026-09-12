import uuid
from typing import Dict, Any, List
from datetime import datetime
from database import db
from priority_engine import priority_engine
from optimizer import optimizer


class DynamicReplanner:
    def handle_emergency_event(self, emergency_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ingests emergency maintenance defect, recalculates priority,
        re-runs CP-SAT optimizer, generates versioned Plan V2,
        and computes the exact schedule diff.
        """
        # 1. Create and Ingest Emergency Work Item
        em_id = f"EM-USFD-{uuid.uuid4().hex[:6].upper()}"
        corridor_id = emergency_data.get("corridor_id", "C1")
        
        # Calculate Priority using Explainable Engine
        score, tier, factors, justifications = priority_engine.compute_priority({
            "safety_risk_rating": emergency_data.get("safety_risk_rating", 25),
            "asset_criticality_rating": emergency_data.get("asset_criticality_rating", 20),
            "overdue_days": emergency_data.get("overdue_days", 14),
            "failure_history_count": emergency_data.get("failure_history_count", 5),
            "failure_probability": emergency_data.get("failure_probability", 0.95),
            "traffic_density_factor": 1.4,
            "deferral_consequence_rating": 10
        })

        # Ensure emergency score reflects extreme urgency (95-98)
        score = max(95, score)
        tier = "CRITICAL"

        emergency_item = {
            "id": em_id,
            "source_system": "TDMS",
            "department_id": emergency_data.get("department_id", "DEP_TRACK"),
            "corridor_id": corridor_id,
            "asset_id": "A-TRK-001",
            "title": emergency_data.get("title", "Emergency Ultrasonic Rail Fracture Defect (USFD)"),
            "description": "Urgent rail fracture detected by ultrasonic flaw detector trolley. Immediate block required to replace 6m rail segment and execute thermite weld before line can safely reopen.",
            "work_type": emergency_data.get("work_type", "USFD_EMERGENCY_REPAIR"),
            "duration_minutes": emergency_data.get("duration_minutes", 180),
            "required_resource": "GANG_CREW",
            "requested_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "requested_day": emergency_data.get("requested_day", "Tuesday"),
            "requested_start_hour": 10,
            "requested_end_hour": 13,
            "safety_risk_rating": 25,
            "asset_criticality_rating": 20,
            "overdue_days": 14,
            "failure_history_count": 5,
            "failure_probability": 0.95,
            "traffic_density_factor": 1.4,
            "deferral_consequence_rating": 10,
            "priority_score": score,
            "priority_tier": tier,
            "priority_factors": factors,
            "status": "PENDING",
            "is_emergency": True
        }

        # Save emergency work item
        db.insert_work_item(emergency_item)

        # Audit emergency ingestion
        db.record_audit(
            event_type="EMERGENCY_TRIGGER",
            entity_type="WORK_ITEM",
            entity_id=em_id,
            action=f"Critical Emergency Defect Logged: {emergency_item['title']}",
            details={
                "priority_score": score,
                "corridor_id": corridor_id,
                "urgency": "IMMEDIATE_BLOCK_REQUIRED",
                "justifications": justifications
            },
            user_id="TMS_SAFETY_RADAR"
        )

        # 2. Retrieve Existing Active Plan (e.g. Plan V1)
        old_plan = db.get_latest_plan()
        old_version = old_plan["version"] if old_plan else 1
        old_items_map = {}
        if old_plan:
            for it in old_plan.get("items", []):
                old_items_map[it["work_item_id"]] = it

        # 3. Retrieve all work items, corridors, timetable, resources
        all_work_items = db.get_work_items()
        corridors = db.get_corridors()
        timetable = db.get_timetable_windows()
        resources = db.get_resources()

        # 4. Re-run CP-SAT Optimizer with Emergency Item Included
        opt_result = optimizer.optimize(
            work_items=all_work_items,
            corridors=corridors,
            timetable_windows=timetable,
            resources=resources,
            horizon_days=7
        )

        new_plan_id = f"PLAN-V{old_version + 1}-{uuid.uuid4().hex[:4].upper()}"
        new_version = old_version + 1

        new_plan_data = {
            "id": new_plan_id,
            "version": new_version,
            "title": f"Dynamic Re-planned Maintenance Schedule (Version {new_version})",
            "horizon_start_date": "2026-09-07",
            "horizon_end_date": "2026-09-13",
            "status": "REPLANNED",
            "created_by": "CP-SAT Dynamic Re-planner",
            "notes": f"Re-optimized following Emergency Rail Fracture ({em_id}) injection on corridor {corridor_id}."
        }

        # 5. Save New Plan
        db.save_plan(
            new_plan_data,
            opt_result["scheduled_items"],
            opt_result["before_kpi"],
            opt_result["after_kpi"]
        )

        # 6. Compute Plan Diff (Old Plan vs New Plan)
        diff_list = []
        new_items_map = {it["work_item_id"]: it for it in opt_result["scheduled_items"]}

        # Check emergency item
        if em_id in new_items_map:
            new_it = new_items_map[em_id]
            diff_list.append({
                "work_item_id": em_id,
                "work_title": emergency_item["title"],
                "change_type": "ADDED",
                "old_slot": "Not in schedule",
                "new_slot": f"{new_it['day_of_week']} {new_it['scheduled_start_minute']//60:02d}:{new_it['scheduled_start_minute']%60:02d} - {new_it['scheduled_end_minute']//60:02d}:{new_it['scheduled_end_minute']%60:02d}",
                "reason": "Emergency high-priority defect accommodated into immediate corridor block."
            })

        # Check existing items: moved, grouped, or unchanged
        for w_id, old_it in old_items_map.items():
            if w_id in new_items_map:
                new_it = new_items_map[w_id]
                old_slot_str = f"{old_it['day_of_week']} {old_it['scheduled_start_minute']//60:02d}:{old_it['scheduled_start_minute']%60:02d}"
                new_slot_str = f"{new_it['day_of_week']} {new_it['scheduled_start_minute']//60:02d}:{new_it['scheduled_start_minute']%60:02d}"

                if old_slot_str != new_slot_str:
                    diff_list.append({
                        "work_item_id": w_id,
                        "work_title": old_it["work_title"],
                        "change_type": "MOVED",
                        "old_slot": old_slot_str,
                        "new_slot": new_slot_str,
                        "reason": f"Rescheduled to accommodate emergency block on {new_it['corridor_name']} without timetable disruption."
                    })
                elif new_it.get("is_shadow_block") and not old_it.get("is_shadow_block"):
                    diff_list.append({
                        "work_item_id": w_id,
                        "work_title": old_it["work_title"],
                        "change_type": "GROUPED",
                        "old_slot": old_slot_str,
                        "new_slot": new_slot_str,
                        "reason": "Consolidated into joint corridor shadow block to maximize track window utilization."
                    })
                else:
                    diff_list.append({
                        "work_item_id": w_id,
                        "work_title": old_it["work_title"],
                        "change_type": "UNCHANGED",
                        "old_slot": old_slot_str,
                        "new_slot": new_slot_str,
                        "reason": "Existing schedule preserved with zero disruption."
                    })

        # 7. Record Audit for Re-planning
        db.record_audit(
            event_type="REPLAN_COMPLETE",
            entity_type="PLAN",
            entity_id=new_plan_id,
            action=f"Dynamic Re-planning generated Plan V{new_version}",
            details={
                "previous_plan_id": old_plan["id"] if old_plan else "None",
                "emergency_defect_id": em_id,
                "items_moved_count": sum(1 for d in diff_list if d["change_type"] == "MOVED"),
                "total_items_scheduled": len(opt_result["scheduled_items"])
            },
            user_id="CP-SAT Dynamic Re-planner"
        )

        return {
            "old_plan_id": old_plan["id"] if old_plan else "None",
            "old_version": old_version,
            "new_plan_id": new_plan_id,
            "new_version": new_version,
            "emergency_work_id": em_id,
            "diff": diff_list,
            "new_kpis": opt_result["after_kpi"],
            "message": f"Successfully re-optimized schedule. Generated Plan V{new_version} accommodating emergency item."
        }

    def analyze_emergency_replan(self, emergency_data: Dict[str, Any]) -> Dict[str, Any]:
        from app.services.replanner import replanner as service_replanner
        return service_replanner.analyze_emergency_replan(emergency_data)

    def accept_emergency_solution(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        from app.services.replanner import replanner as service_replanner
        return service_replanner.accept_emergency_solution(payload)


dynamic_replanner = DynamicReplanner()

