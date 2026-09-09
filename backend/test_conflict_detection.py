"""
Unit & Integration Test Suite: Cross-Department Data Conflict Detection Engine
Tests:
1. Configurable matching tolerances (50m location tolerance, condition tolerance, recency precedence)
2. Location mismatch detection (km difference > 50m flagged as conflict)
3. Condition score mismatch detection (delta > 5.0 flagged as conflict)
4. Non-conflicting multi-department asset handling (within tolerance not flagged)
5. Provisional resolution assignment ('most recently synced source wins' TMS > SMMS > TDMS)
6. Affected UnifiedJob tagging with data_quality_issues ['field_mismatch_<DEPT1>_<DEPT2>']
7. Conflict log file persistence at data/03_unified/conflict_log.json
8. Full integration sync execution with conflict summary breakdown by field type & department pair
"""

import os
import sys
import json
from datetime import datetime

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.services.file_repository import file_repo
from app.services.data_integration import integration_service
from app.services.conflict_resolver import (
    conflict_resolver,
    ConflictResolverService,
    CONFLICT_LOCATION_TOLERANCE_KM,
    CONFLICT_CONDITION_SCORE_TOLERANCE,
    SOURCE_SYSTEM_RECENCY_ORDER
)

def test_configurable_constants():
    print("--- 1. Testing Configurable Conflict Constants ---")
    assert CONFLICT_LOCATION_TOLERANCE_KM == 0.050, f"Expected 0.050 km (50m), got {CONFLICT_LOCATION_TOLERANCE_KM}"
    assert CONFLICT_CONDITION_SCORE_TOLERANCE == 5.0, f"Expected 5.0 points tolerance, got {CONFLICT_CONDITION_SCORE_TOLERANCE}"
    assert SOURCE_SYSTEM_RECENCY_ORDER["TMS"] > SOURCE_SYSTEM_RECENCY_ORDER["SMMS"] > SOURCE_SYSTEM_RECENCY_ORDER["TDMS"]
    print("[PASS] Configurable constants properly defined (50m location, 5.0 condition points, TMS > SMMS > TDMS).")

def test_location_mismatch_detection():
    print("--- 2. Testing Location Mismatch (> 50m) Detection ---")
    custom_resolver = ConflictResolverService(location_tolerance_km=0.050, condition_tolerance=5.0)

    canonical_asset = {
        "asset_id": "TEST-CAN-AST-LOC-01",
        "corridor_id": "C01",
        "owning_departments": ["Engineering", "Traction"],
        "cross_reference": {
            "TMS_id": "TEST-TMS-LOC-01",
            "SMMS_id": None,
            "TDMS_id": "TEST-TDMS-LOC-01"
        },
        "reconciliation_metadata": {
            "merged_departments": ["Engineering", "Traction"],
            "raw_ids": ["TEST-TMS-LOC-01", "TEST-TDMS-LOC-01"]
        }
    }

    # TMS reports 124.40 km, TDMS reports 124.50 km (100m delta > 50m tolerance)
    candidate_job = {
        "job_id": "TEST-JOB-LOC-01",
        "canonical_asset_id": "TEST-CAN-AST-LOC-01",
        "asset_id": "TEST-CAN-AST-LOC-01",
        "department": "Engineering",
        "source_system": "TMS",
        "km": 124.40,
        "data_quality_issues": []
    }

    # Temporarily mock raw asset records lookup
    orig_tms = file_repo.get_raw_tms_assets
    orig_tdms = file_repo.get_raw_tdms_assets

    file_repo.get_raw_tms_assets = lambda: [{
        "asset_id": "TEST-TMS-LOC-01",
        "corridor_id": "C01",
        "km": 124.40,
        "condition_score": 60,
        "status": "OPERATIONAL",
        "installation_date": "2019-01-01"
    }]
    file_repo.get_raw_tdms_assets = lambda: [{
        "asset_id": "TEST-TDMS-LOC-01",
        "corridor_id": "C01",
        "km": 124.50,
        "condition_score": 60,
        "status": "OPERATIONAL",
        "installation_date": "2018-01-01"
    }]

    try:
        jobs, conflicts, summary = custom_resolver.detect_and_resolve_conflicts(
            candidate_jobs=[candidate_job],
            canonical_assets=[canonical_asset],
            sync_timestamp="2026-09-08T21:00:00"
        )

        loc_conflicts = [c for c in conflicts if c["field_type"] == "location mismatch"]
        assert len(loc_conflicts) == 1, f"Expected 1 location conflict, got {len(loc_conflicts)}"
        c = loc_conflicts[0]
        assert c["field_in_conflict"] == "km"
        assert len(c["department_reports"]) == 2
        # TMS has higher recency rank than TDMS -> TMS must win
        assert c["provisional_resolution"]["winning_department"] == "Engineering"
        assert c["provisional_resolution"]["winning_source"] == "TMS"
        assert c["provisional_resolution"]["resolved_value"] == 124.40
        assert c["provisional_resolution"]["status"] == "PROVISIONAL_PENDING_HUMAN_REVIEW"

        # Check job tagging
        assert any("field_mismatch_Engineering_Traction" in tag for tag in candidate_job["data_quality_issues"])
        print("[PASS] Location mismatch > 50m accurately flagged and provisionally resolved (TMS wins).")
    finally:
        file_repo.get_raw_tms_assets = orig_tms
        file_repo.get_raw_tdms_assets = orig_tdms

def test_condition_mismatch_detection():
    print("--- 3. Testing Condition Score Mismatch (> 5.0) Detection ---")
    custom_resolver = ConflictResolverService(location_tolerance_km=0.050, condition_tolerance=5.0)

    canonical_asset = {
        "asset_id": "TEST-CAN-AST-CND-01",
        "corridor_id": "C02",
        "owning_departments": ["Engineering", "S&T"],
        "cross_reference": {
            "TMS_id": "TEST-TMS-CND-01",
            "SMMS_id": "TEST-SMMS-CND-01",
            "TDMS_id": None
        },
        "reconciliation_metadata": {
            "merged_departments": ["Engineering", "S&T"],
            "raw_ids": ["TEST-TMS-CND-01", "TEST-SMMS-CND-01"]
        }
    }

    candidate_job = {
        "job_id": "TEST-JOB-CND-01",
        "canonical_asset_id": "TEST-CAN-AST-CND-01",
        "asset_id": "TEST-CAN-AST-CND-01",
        "department": "S&T",
        "source_system": "SMMS",
        "km": 150.0,
        "data_quality_issues": []
    }

    orig_tms = file_repo.get_raw_tms_assets
    orig_smms = file_repo.get_raw_smms_assets

    # Engineering reports 80.0, S&T reports 60.0 (delta = 20.0 > 5.0)
    file_repo.get_raw_tms_assets = lambda: [{
        "asset_id": "TEST-TMS-CND-01",
        "corridor_id": "C02",
        "km": 150.0,
        "condition_score": 80.0,
        "status": "OPERATIONAL",
        "installation_date": "2020-01-01"
    }]
    file_repo.get_raw_smms_assets = lambda: [{
        "asset_id": "TEST-SMMS-CND-01",
        "corridor_id": "C02",
        "km": 150.0,
        "condition_score": 60.0,
        "status": "OPERATIONAL",
        "installation_date": "2021-01-01"
    }]

    try:
        jobs, conflicts, summary = custom_resolver.detect_and_resolve_conflicts(
            candidate_jobs=[candidate_job],
            canonical_assets=[canonical_asset],
            sync_timestamp="2026-09-08T21:00:00"
        )

        cnd_conflicts = [c for c in conflicts if c["field_type"] == "condition mismatch"]
        assert len(cnd_conflicts) == 1, f"Expected 1 condition mismatch conflict, got {len(cnd_conflicts)}"
        c = cnd_conflicts[0]
        assert c["provisional_resolution"]["winning_department"] == "Engineering"
        assert c["provisional_resolution"]["resolved_value"] == 80.0

        # Check job tagging
        assert any("field_mismatch_Engineering_S&T" in tag for tag in candidate_job["data_quality_issues"])
        print("[PASS] Condition score mismatch flagged with provisional resolution.")
    finally:
        file_repo.get_raw_tms_assets = orig_tms
        file_repo.get_raw_smms_assets = orig_smms

def test_within_tolerance_no_conflict():
    print("--- 4. Testing Within-Tolerance Multi-Department Asset (No Conflict) ---")
    custom_resolver = ConflictResolverService(location_tolerance_km=0.050, condition_tolerance=5.0)

    canonical_asset = {
        "asset_id": "TEST-CAN-AST-OK-01",
        "corridor_id": "C01",
        "owning_departments": ["Engineering", "Traction"],
        "cross_reference": {
            "TMS_id": "TEST-TMS-OK-01",
            "SMMS_id": None,
            "TDMS_id": "TEST-TDMS-OK-01"
        },
        "reconciliation_metadata": {
            "merged_departments": ["Engineering", "Traction"],
            "raw_ids": ["TEST-TMS-OK-01", "TEST-TDMS-OK-01"]
        }
    }

    candidate_job = {
        "job_id": "TEST-JOB-OK-01",
        "canonical_asset_id": "TEST-CAN-AST-OK-01",
        "asset_id": "TEST-CAN-AST-OK-01",
        "department": "Engineering",
        "source_system": "TMS",
        "km": 100.02,
        "data_quality_issues": []
    }

    orig_tms = file_repo.get_raw_tms_assets
    orig_tdms = file_repo.get_raw_tdms_assets

    # TMS reports 100.02, TDMS reports 100.04 (delta = 20m <= 50m), condition delta = 2.0 <= 5.0
    file_repo.get_raw_tms_assets = lambda: [{
        "asset_id": "TEST-TMS-OK-01",
        "corridor_id": "C01",
        "km": 100.02,
        "condition_score": 70.0,
        "status": "OPERATIONAL",
        "installation_date": "2019-01-01"
    }]
    file_repo.get_raw_tdms_assets = lambda: [{
        "asset_id": "TEST-TDMS-OK-01",
        "corridor_id": "C01",
        "km": 100.04,
        "condition_score": 72.0,
        "status": "OPERATIONAL",
        "installation_date": "2019-01-01"
    }]

    try:
        jobs, conflicts, summary = custom_resolver.detect_and_resolve_conflicts(
            candidate_jobs=[candidate_job],
            canonical_assets=[canonical_asset]
        )

        assert len(conflicts) == 0, f"Expected 0 conflicts within tolerance, got {len(conflicts)}"
        assert len(candidate_job["data_quality_issues"]) == 0
        print("[PASS] Reports within tolerance correctly produce zero conflicts and zero job tags.")
    finally:
        file_repo.get_raw_tms_assets = orig_tms
        file_repo.get_raw_tdms_assets = orig_tdms

def test_full_pipeline_sync_and_persistence():
    print("--- 5. Testing Full Integration Sync with Conflict Detection & Persistence ---")
    sync_result = integration_service.sync_all_systems()

    assert "conflict_summary" in sync_result, "Expected conflict_summary in sync result"
    cs = sync_result["conflict_summary"]
    total_conflicts = cs.get("total_conflicts_detected", 0)
    print(f"Total Conflicts Detected in Live Corpus: {total_conflicts}")
    print(f"Breakdown by Field Type: {cs.get('breakdown_by_field_type')}")
    print(f"Breakdown by Department Pair: {cs.get('breakdown_by_department_pair')}")

    # Verify conflict_log.json was written to disk
    log_file = os.path.join(file_repo.unified_dir, "conflict_log.json")
    assert os.path.exists(log_file), f"conflict_log.json does not exist at {log_file}"

    with open(log_file, "r", encoding="utf-8") as f:
        saved_log = json.load(f)

    assert len(saved_log) == total_conflicts
    if total_conflicts > 0:
        first_entry = saved_log[0]
        assert "asset_id" in first_entry
        assert "field_in_conflict" in first_entry
        assert "department_reports" in first_entry
        assert "provisional_resolution" in first_entry
        print(f"[PASS] Sample Conflict Log verified: Asset={first_entry['asset_id']}, Field={first_entry['field_in_conflict']}, Winner={first_entry['provisional_resolution']['winning_source']}")

    # Verify unified_maintenance_jobs contains tagged records
    unified_jobs = file_repo.get_unified_jobs()
    tagged_jobs = [j for j in unified_jobs if any("field_mismatch" in issue for issue in j.get("data_quality_issues", []))]
    print(f"Unified Jobs tagged with field_mismatch: {len(tagged_jobs)}")
    if tagged_jobs:
        sample_tag = tagged_jobs[0]["data_quality_issues"]
        print(f"Sample Job ({tagged_jobs[0]['job_id']}) tags: {sample_tag}")

    print("[PASS] Full pipeline sync executed with conflict resolution and persistence validated.")

if __name__ == "__main__":
    print("==================================================================")
    print("  CROSS-DEPARTMENT CONFLICT DETECTION TEST SUITE (SIH26027)")
    print("==================================================================")
    test_configurable_constants()
    test_location_mismatch_detection()
    test_condition_mismatch_detection()
    test_within_tolerance_no_conflict()
    test_full_pipeline_sync_and_persistence()
    print("==================================================================")
    print("  ALL CONFLICT DETECTION TESTS COMPLETED SUCCESSFULLY! [5/5]")
    print("==================================================================")
