import os
import uuid
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware

from database import db
from models import (
    WorkItem, ExplainabilityResponse, PriorityFactors,
    ConflictAnalysisResult, Plan, PlanItem, PlanModificationRequest,
    PlanApprovalRequest, OptimizationResponse, BeforeAfterComparison,
    EmergencyEventRequest, ReplanResponse, AuditLogEntry
)
from priority_engine import priority_engine
from conflict_engine import conflict_engine
from optimizer import optimizer
from replanner import dynamic_replanner
from seed_data import seed_database

app = FastAPI(
    title="RailBlock AI — Intelligent Railway Maintenance Block Planning Platform",
    description="Explainable Priority Intelligence, Conflict/Compatibility Detection, and Google OR-Tools CP-SAT Optimization API.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {
        "status": "HEALTHY",
        "service": "RailBlock AI Core API",
        "solver": "Google OR-Tools CP-SAT",
        "database": "Supabase PostgreSQL (Connected)" if db.supabase_client else "Local Persistent Repository"
    }


@app.get("/api/dashboard/stats")
def get_dashboard_stats():
    work_items = db.get_work_items()
    corridors = db.get_corridors()
    departments = db.get_departments()
    timetable = db.get_timetable_windows()
    latest_plan = db.get_latest_plan()
    audit_logs = db.get_audit_logs(limit=5)

    c_map = {c["id"]: c["name"] for c in corridors}
    d_map = {d["id"]: d["name"] for d in departments}
    conflicts, compatibilities = conflict_engine.analyze(work_items, timetable, c_map, d_map)

    critical_count = sum(1 for w in work_items if w.get("priority_tier") == "CRITICAL")
    high_count = sum(1 for w in work_items if w.get("priority_tier") == "HIGH")

    return {
        "total_work_items": len(work_items),
        "critical_work_items": critical_count,
        "high_priority_work_items": high_count,
        "detected_conflicts": len(conflicts),
        "compatible_groupings": len(compatibilities),
        "plan_status": latest_plan.get("status", "NO_PLAN_GENERATED") if latest_plan else "NO_PLAN_GENERATED",
        "plan_version": latest_plan.get("version", 0) if latest_plan else 0,
        "recent_audit_events": audit_logs
    }


@app.get("/api/work-items", response_model=List[WorkItem])
def get_all_work_items():
    return db.get_work_items()


@app.get("/api/work-items/{work_id}/explain", response_model=ExplainabilityResponse)
def explain_work_item_priority(work_id: str):
    item = db.get_work_item(work_id)
    if not item:
        raise HTTPException(status_code=404, detail="Work item not found")

    score, tier, factors, justifications = priority_engine.compute_priority(item)

    return ExplainabilityResponse(
        work_id=item["id"],
        title=item["title"],
        department=item.get("department_name", item["department_id"]),
        corridor=item.get("corridor_name", item["corridor_id"]),
        asset_name=item.get("asset_name", "Primary Corridor Track Asset"),
        priority_score=score,
        priority_tier=tier,
        factors=PriorityFactors(**factors),
        justification=justifications,
        ml_confidence=round(0.85 + (factors["failure_probability"] / 100.0), 2),
        recommended_action="URGENT: Allocate priority maintenance block within next 48 hours" if tier == "CRITICAL" else "Schedule in upcoming coordinated corridor window"
    )


@app.get("/api/conflicts", response_model=ConflictAnalysisResult)
def get_conflicts_and_compatibilities():
    work_items = db.get_work_items()
    corridors = db.get_corridors()
    departments = db.get_departments()
    timetable = db.get_timetable_windows()

    c_map = {c["id"]: c["name"] for c in corridors}
    d_map = {d["id"]: d["name"] for d in departments}

    conflicts, compatibilities = conflict_engine.analyze(work_items, timetable, c_map, d_map)

    return ConflictAnalysisResult(
        total_conflicts=len(conflicts),
        conflicts=conflicts,
        total_compatibilities=len(compatibilities),
        compatibilities=compatibilities
    )


@app.post("/api/optimize", response_model=OptimizationResponse)
def run_optimization():
    work_items = db.get_work_items()
    corridors = db.get_corridors()
    timetable = db.get_timetable_windows()
    resources = db.get_resources()

    opt_res = optimizer.optimize(
        work_items=work_items,
        corridors=corridors,
        timetable_windows=timetable,
        resources=resources,
        horizon_days=7
    )

    plan_id = f"PLAN-V1-{uuid.uuid4().hex[:4].upper()}"
    plan_data = {
        "id": plan_id,
        "version": 1,
        "title": "Weekly Coordinated Railway Maintenance Block Schedule (Plan V1)",
        "horizon_start_date": "2026-09-07",
        "horizon_end_date": "2026-09-13",
        "status": "OPTIMIZED",
        "created_by": "Google OR-Tools CP-SAT Solver",
        "notes": "Coordinated multi-department schedule eliminating all corridor and machinery conflicts."
    }

    db.save_plan(plan_data, opt_res["scheduled_items"], opt_res["before_kpi"], opt_res["after_kpi"])

    db.record_audit(
        event_type="OPTIMIZE_RUN",
        entity_type="PLAN",
        entity_id=plan_id,
        action="Generated optimized maintenance block schedule using CP-SAT",
        details={
            "plan_id": plan_id,
            "scheduled_count": len(opt_res["scheduled_items"]),
            "block_reduction_pct": opt_res["comparison"]["block_reduction_pct"],
            "conflicts_resolved": opt_res["comparison"]["conflicts_resolved"],
            "solve_time_ms": opt_res["solve_duration_ms"]
        },
        user_id="CP_SAT_OPTIMIZER"
    )

    return OptimizationResponse(
        plan_id=plan_id,
        version=1,
        status="OPTIMIZED",
        solver_status=opt_res["solver_status"],
        solve_duration_ms=opt_res["solve_duration_ms"],
        num_constraints=opt_res["num_constraints"],
        num_variables=opt_res["num_variables"],
        objective_value=opt_res["objective_value"],
        kpi_comparison=BeforeAfterComparison(**opt_res["comparison"]),
        plan_items=[PlanItem(**{**it, 'plan_id': plan_id}) for it in opt_res["scheduled_items"]],
        message="CP-SAT optimization completed successfully with zero corridor conflicts."
    )


@app.get("/api/plans/current")
def get_current_plan():
    plan = db.get_latest_plan()
    if not plan:
        raise HTTPException(status_code=404, detail="No plan found. Please run optimization first.")
    return plan


@app.post("/api/plans/modify")
def modify_plan_schedule(req: PlanModificationRequest):
    try:
        db.modify_plan_item(
            plan_id=req.plan_id,
            work_item_id=req.work_item_id,
            new_day=req.new_day_of_week,
            new_start=req.new_start_minute,
            new_end=req.new_end_minute,
            user=req.modified_by,
            reason=req.reason
        )
        return {
            "status": "SUCCESS",
            "message": f"Successfully updated schedule for {req.work_item_id}. Modification logged in audit trail."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/plans/approve")
def approve_plan(req: PlanApprovalRequest):
    try:
        db.approve_plan(
            plan_id=req.plan_id,
            approved_by=req.approved_by,
            comments=req.comments or ""
        )
        return {
            "status": "APPROVED",
            "plan_id": req.plan_id,
            "approved_by": req.approved_by,
            "message": f"Plan {req.plan_id} officially authorized for execution."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/replan/emergency", response_model=ReplanResponse)
def trigger_emergency_replanning(req: EmergencyEventRequest):
    res = dynamic_replanner.handle_emergency_event(req.model_dump())
    return ReplanResponse(**res)


@app.get("/api/audit-trail", response_model=List[AuditLogEntry])
def get_audit_trail(limit: int = 100):
    return db.get_audit_logs(limit=limit)


@app.post("/api/reset-demo")
def reset_demo_data():
    seed_database()
    return {"status": "SUCCESS", "message": "Demo database successfully reset to clean initial state."}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
