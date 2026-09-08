"""
Test Backend File-Based Services
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.file_repository import file_repo
from app.services.data_integration import integration_service
from app.services.priority_engine import priority_engine
from app.services.opportunity_engine import opportunity_engine
from app.services.optimizer import optimizer
from app.services.replanner import replanner
from app.services.lineage_engine import lineage_engine

def run_tests():
    print("--- 1. Testing Raw Files Read ---")
    tms_assets = file_repo.get_raw_tms_assets()
    tms_maint = file_repo.get_raw_tms_maintenance()
    coa_trains = file_repo.get_raw_coa_trains()
    stations = file_repo.get_stations()
    print(f"Loaded {len(tms_assets)} TMS assets, {len(tms_maint)} TMS jobs, {len(coa_trains)} COA trains, {len(stations)} stations.")
    assert len(tms_assets) > 0
    assert len(coa_trains) > 0

    print("--- 2. Testing Data Integration & Sync ---")
    sync_res = integration_service.sync_all_systems()
    print(f"Sync complete: Received={sync_res['records_received']}, Normalized={sync_res['records_normalized']}, Quality={sync_res['data_quality_score']}%, CrossDeptMatches={sync_res['cross_department_matches']}")
    assert sync_res['records_normalized'] > 100

    print("--- 3. Testing Maintenance Opportunity Discovery ---")
    opps = opportunity_engine.discover_opportunities()
    print(f"Discovered {len(opps)} opportunities.")
    assert len(opps) > 0
    top_opp = opps[0]
    print(f"Top Opportunity: {top_opp['opportunity_id']} | Depts: {top_opp['departments']} | Jobs: {top_opp['jobs_count']} | Separate work: {top_opp['total_separate_work_min']}m -> Combined block: {top_opp['required_combined_block_min']}m")

    print("--- 4. Testing Google OR-Tools CP-SAT Optimizer ---")
    plan = optimizer.optimize()
    print(f"Plan generated: ID={plan['id']} | Solve duration={plan['solve_duration_ms']}ms | Recommended Blocks={plan['total_recommended_blocks']} | Scheduled Jobs={plan['total_jobs_scheduled']}")
    assert len(plan["recommended_blocks"]) > 0

    print("--- 5. Testing 'Why This Block' Explanations ---")
    b0 = plan["recommended_blocks"][0]
    print(f"Block: {b0['block_id']} | Corridor: {b0['corridor_id']} | Time: {b0['start_time']}-{b0['end_time']}")
    for r in b0["why_this_block"]:
        print("  *", r)

    print("--- 6. Testing Dynamic What-If Simulation ---")
    sim = replanner.handle_what_if_simulation({"block_duration_minutes": 90})
    print(f"What-If complete: Before={sim['before']['blocks_count']} blocks -> After={sim['after']['blocks_count']} blocks | Explanation: {sim['explanation']}")

    print("--- 7. Testing Emergency Re-planning ---")
    emg = replanner.handle_emergency_defect({"corridor_id": "C01", "km": 124.4, "station": "OGL"})
    print(f"Emergency Re-planning: New Plan V{emg['new_version']} | Inserted={emg['diff_summary']['emergency_jobs_inserted']} | Retained={emg['diff_summary']['jobs_retained']} | Moved={emg['diff_summary']['jobs_moved']}")

    print("--- 8. Testing Data Lineage ---")
    lin = lineage_engine.get_lineage("TMS-JOB-101")
    print(f"Lineage stages: {len(lin['lineage_stages'])}")
    for s in lin["lineage_stages"]:
        print(f"  Stage {s['stage']}: {s['name']} ({s['system']})")

    print("\n[ALL TESTS PASSED SUCCESSFULLY!]")

if __name__ == "__main__":
    run_tests()
