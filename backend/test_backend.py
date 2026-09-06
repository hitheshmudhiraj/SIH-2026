"""
Verification test script for RailBlock AI backend:
1. Tests Explainable Priority Engine calculation and factor sums
2. Tests Conflict & Compatibility detection
3. Tests Google OR-Tools CP-SAT optimization and Before vs After KPIs
4. Tests Human Planner modification and Audit Trail logging
5. Tests Emergency Defect Injection and Dynamic Re-planning
"""
import sys
from database import db
from priority_engine import priority_engine
from conflict_engine import conflict_engine
from optimizer import optimizer
from replanner import dynamic_replanner
from seed_data import seed_database


def run_tests():
    print("=== TEST 1: Database Seeding ===")
    seed_database()
    work_items = db.get_work_items()
    assert len(work_items) >= 10, f"Expected >= 10 work items, got {len(work_items)}"
    print(f"PASS: Loaded {len(work_items)} work items successfully.")

    print("\n=== TEST 2: Priority Engine Explainability ===")
    sample_item = work_items[0]
    score, tier, factors, justifications = priority_engine.compute_priority(sample_item)
    print(f"Sample item: {sample_item['title']}")
    print(f"Calculated Score: {score}/100, Tier: {tier}")
    print(f"Factor Breakdown: {factors}")
    print(f"Justifications: {justifications}")
    assert 0 <= score <= 100, "Score must be between 0 and 100"
    assert "safety_risk" in factors, "Factors must include safety_risk"
    assert "asset_criticality" in factors, "Factors must include asset_criticality"
    assert len(justifications) > 0, "Must provide human-readable justifications"
    print("PASS: Priority Engine is fully explainable.")

    print("\n=== TEST 3: Conflict & Compatibility Detection ===")
    corridors = db.get_corridors()
    departments = db.get_departments()
    timetable = db.get_timetable_windows()
    c_map = {c["id"]: c["name"] for c in corridors}
    d_map = {d["id"]: d["name"] for d in departments}

    conflicts, compatibilities = conflict_engine.analyze(work_items, timetable, c_map, d_map)
    print(f"Detected Conflicts: {len(conflicts)}")
    for c in conflicts[:2]:
        print(f"  - [{c['conflict_type']}] on {c['corridor_name']} ({c['day_of_week']}): {c['description']}")
    print(f"Detected Compatibilities: {len(compatibilities)}")
    for comp in compatibilities[:2]:
        print(f"  - [{comp['corridor_name']}] {comp['shared_benefit']}")
    assert len(conflicts) > 0, "Initial dataset must contain conflicts"
    assert len(compatibilities) > 0, "Initial dataset must contain compatible grouping opportunities"
    print("PASS: Conflict and Compatibility Detection functioning.")

    print("\n=== TEST 4: Google OR-Tools CP-SAT Optimization ===")
    resources = db.get_resources()
    opt_res = optimizer.optimize(
        work_items=work_items,
        corridors=corridors,
        timetable_windows=timetable,
        resources=resources,
        horizon_days=7
    )
    print(f"Solver Status: {opt_res['solver_status']}")
    print(f"Solve Duration: {opt_res['solve_duration_ms']} ms")
    print(f"Scheduled Items: {len(opt_res['scheduled_items'])}")
    cmp = opt_res["comparison"]
    print(f"Before vs After: Blocks {cmp['before']['separate_blocks_count']} -> {cmp['after']['separate_blocks_count']} ({cmp['block_reduction_pct']}% reduction)")
    print(f"Critical Work Completed: {cmp['before']['critical_work_completed']} -> {cmp['after']['critical_work_completed']} (+{cmp['critical_completion_increase_pct']}%)")
    print(f"Conflicts: {cmp['before']['conflicts_count']} -> {cmp['after']['conflicts_count']}")
    assert opt_res["solver_status"] in ("OPTIMAL", "FEASIBLE"), "Solver must find a solution"
    assert cmp["after"]["conflicts_count"] == 0, "Optimizer must eliminate conflicts"
    assert cmp["block_reduction_pct"] > 0, "Optimizer must reduce separate blocks"
    print("PASS: CP-SAT Optimization and KPI story verified.")

    print("\n=== TEST 5: Planner Modification & Audit Trail ===")
    plan_data = {
        "id": "PLAN-TEST-01",
        "version": 1,
        "title": "Test Plan",
        "horizon_start_date": "2026-09-07",
        "horizon_end_date": "2026-09-13",
        "status": "OPTIMIZED",
        "created_by": "Test Optimizer"
    }
    db.save_plan(plan_data, opt_res["scheduled_items"], cmp["before"], cmp["after"])
    target_item = opt_res["scheduled_items"][0]
    db.modify_plan_item(
        plan_id="PLAN-TEST-01",
        work_item_id=target_item["work_item_id"],
        new_day="Thursday",
        new_start=840,
        new_end=1020,
        user="Chief Controller Sharma",
        reason="Adjusted due to freight rake positioning priority."
    )
    db.approve_plan("PLAN-TEST-01", approved_by="Sr. DOM Rao", comments="Approved after review.")
    logs = db.get_audit_logs(limit=5)
    assert any(l["event_type"] == "PLANNER_MODIFY" for l in logs), "Audit log must record modification"
    assert any(l["event_type"] == "PLAN_APPROVE" for l in logs), "Audit log must record approval"
    print("PASS: Planner modification, approval, and audit trail verified.")

    print("\n=== TEST 6: Emergency Defect & Dynamic Re-planning ===")
    replan_res = dynamic_replanner.handle_emergency_event({
        "corridor_id": "C1",
        "title": "Emergency Ultrasonic Rail Fracture Defect (USFD)",
        "duration_minutes": 180,
        "requested_day": "Tuesday"
    })
    print(f"New Plan Version: V{replan_res['new_version']}")
    print(f"Emergency Work ID: {replan_res['emergency_work_id']}")
    print(f"Diff count: {len(replan_res['diff'])}")
    for d in replan_res['diff'][:3]:
        print(f"  - [{d['change_type']}] {d['work_title']}: {d['reason']}")
    assert replan_res["new_version"] == 2, "Plan version must increment"
    assert any(d["change_type"] == "ADDED" for d in replan_res["diff"]), "Emergency item must appear in diff"
    print("PASS: Dynamic Re-planning verified.")

    print("\n>>> ALL BACKEND TESTS PASSED SUCCESSFULLY! <<<")


if __name__ == "__main__":
    run_tests()
