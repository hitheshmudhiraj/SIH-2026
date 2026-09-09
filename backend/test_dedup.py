"""
Unit & Integration Test Suite: Maintenance Job Deduplication Engine
Tests:
1. Configurable matching tolerances (module constants)
2. Exact match rule (same canonical asset + job_type + overlapping date window -> keeps newer source, drops stale, tags survivor)
3. Near-match rule (different/missing asset + same corridor + distance <= 100m + date diff <= 2d + similar job_type -> flags both, queues for review, no drops)
4. Non-duplicate cases (distance > 100m or different corridor or distinct job_type -> neither dropped nor flagged)
5. Review queue file persistence (data/03_unified/dedup_review_queue.json)
6. Full sync_all_systems integration and summary reporting
"""

import os
import sys
import json
from datetime import datetime

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.services.file_repository import file_repo
from app.services.data_integration import (
    integration_service,
    compute_job_type_similarity,
    DEDUP_SPATIAL_TOLERANCE_KM,
    DEDUP_EXACT_DATE_WINDOW_DAYS,
    DEDUP_NEAR_DATE_WINDOW_DAYS,
    DEDUP_JOB_TYPE_SIMILARITY_THRESHOLD,
    SOURCE_SYSTEM_RECENCY_ORDER
)

def test_configurable_constants():
    print("--- Testing Configurable Constants ---")
    assert DEDUP_SPATIAL_TOLERANCE_KM == 0.100, f"Expected 0.100 km (100m), got {DEDUP_SPATIAL_TOLERANCE_KM}"
    assert DEDUP_EXACT_DATE_WINDOW_DAYS == 1, f"Expected 1 day exact window, got {DEDUP_EXACT_DATE_WINDOW_DAYS}"
    assert DEDUP_NEAR_DATE_WINDOW_DAYS == 2, f"Expected 2 day near window, got {DEDUP_NEAR_DATE_WINDOW_DAYS}"
    assert DEDUP_JOB_TYPE_SIMILARITY_THRESHOLD == 0.60, f"Expected 0.60 threshold, got {DEDUP_JOB_TYPE_SIMILARITY_THRESHOLD}"
    assert SOURCE_SYSTEM_RECENCY_ORDER["TMS"] > SOURCE_SYSTEM_RECENCY_ORDER["SMMS"] > SOURCE_SYSTEM_RECENCY_ORDER["TDMS"]
    print("[PASS] Configurable constants properly defined and typed.")

def test_job_type_similarity():
    print("--- Testing Job Type Similarity Engine ---")
    # Exact matches
    assert compute_job_type_similarity("TRACK_TAMPING", "TRACK_TAMPING") == 1.0
    assert compute_job_type_similarity("track-tamping", "TRACK_TAMPING") == 1.0

    # High similarity / token overlaps
    sim1 = compute_job_type_similarity("TRACK_TAMPING_DEEP_SCREENING", "TRACK_TAMPING")
    assert sim1 >= DEDUP_JOB_TYPE_SIMILARITY_THRESHOLD, f"Expected >= 0.60, got {sim1}"

    sim2 = compute_job_type_similarity("RAIL_FLAW_WELD_REPAIR", "RAIL_FLAW_WELDING_REPAIR")
    assert sim2 >= DEDUP_JOB_TYPE_SIMILARITY_THRESHOLD, f"Expected >= 0.60, got {sim2}"

    # Completely different job types
    sim_diff = compute_job_type_similarity("TRACK_TAMPING", "OHE_POWER_ISOLATION")
    assert sim_diff < DEDUP_JOB_TYPE_SIMILARITY_THRESHOLD, f"Expected < 0.60, got {sim_diff}"
    print(f"[PASS] Job type similarity validated (Exact=1.0, TokenOverlap={sim1:.2f}, Diff={sim_diff:.2f}).")

def test_exact_match_deduplication():
    print("--- Testing Exact Match Deduplication ---")
    # Create two synthetic jobs referencing identical canonical asset and job type on same date
    # TMS (recency rank 3) vs TDMS (recency rank 1)
    tms_job = {
        "job_id": "TEST-TMS-EXACT-01",
        "canonical_asset_id": "CAN-AST-C01-124.60-0023",
        "raw_asset_id": "TMS-C01-PNT-1043",
        "job_type": "POINT_MACHINE_OVERHAUL",
        "due_date": "2026-09-10",
        "source_system": "TMS",
        "corridor_id": "C01",
        "km": 124.6,
        "department": "Engineering",
        "priority_score": 85,
        "data_quality_issues": []
    }
    tdms_job = {
        "job_id": "TEST-TDMS-EXACT-01",
        "canonical_asset_id": "CAN-AST-C01-124.60-0023",
        "raw_asset_id": "TDMS-C01-ISO-0202",
        "job_type": "POINT_MACHINE_OVERHAUL",
        "due_date": "2026-09-10",
        "source_system": "TDMS",
        "corridor_id": "C01",
        "km": 124.6,
        "department": "Traction",
        "priority_score": 82,
        "data_quality_issues": []
    }

    survivors, dropped, queue = integration_service.deduplicate_jobs(
        [tms_job, tdms_job],
        sync_timestamp="2026-09-08T20:00:00"
    )

    # Exactly one record survived
    assert len(survivors) == 1, f"Expected 1 survivor, got {len(survivors)}"
    # Survivor must be TMS because TMS recency > TDMS recency
    survivor = survivors[0]
    assert survivor["job_id"] == "TEST-TMS-EXACT-01"
    assert survivor["source_system"] == "TMS"

    # Survivor must have data_quality_issues tag
    assert "duplicate_dropped:TDMS" in survivor["data_quality_issues"], (
        f"Missing 'duplicate_dropped:TDMS' tag: {survivor['data_quality_issues']}"
    )

    # Dropped list must contain TDMS record with audit fields
    assert len(dropped) == 1, f"Expected 1 dropped record, got {len(dropped)}"
    drop_item = dropped[0]
    assert drop_item["dropped_job_id"] == "TEST-TDMS-EXACT-01"
    assert drop_item["retained_job_id"] == "TEST-TMS-EXACT-01"
    assert drop_item["source_system_dropped"] == "TDMS"
    assert drop_item["source_system_retained"] == "TMS"
    assert "Exact match on canonical asset" in drop_item["reason"]

    # No near-matches generated
    assert len(queue) == 0, f"Expected 0 review queue items, got {len(queue)}"
    print("[PASS] Exact match deduplication dropped TDMS record, retained TMS record, and tagged survivor.")

def test_near_match_deduplication():
    print("--- Testing Near-Match Deduplication ---")
    # Two jobs on same corridor, distance 80m (0.08 km <= 0.100 km), date diff 1 day (<= 2 days),
    # similar job type, but DIFFERENT/MISSING canonical asset IDs
    job_eng = {
        "job_id": "TEST-ENG-NEAR-01",
        "canonical_asset_id": "CAN-AST-C01-050.10-0011",
        "raw_asset_id": "ENG-501",
        "job_type": "RAIL_FLAW_WELD_REPAIR",
        "due_date": "2026-09-12",
        "source_system": "TMS",
        "corridor_id": "C01",
        "km": 50.10,
        "department": "Engineering",
        "priority_score": 75,
        "data_quality_issues": []
    }
    job_sig = {
        "job_id": "TEST-SIG-NEAR-01",
        "canonical_asset_id": "CAN-AST-C01-050.18-0012",  # Different asset (80m away)
        "raw_asset_id": "SMMS-502",
        "job_type": "RAIL_FLAW_WELDING_REPAIR",           # Similar job type
        "due_date": "2026-09-13",                         # 1 day difference
        "source_system": "SMMS",
        "corridor_id": "C01",
        "km": 50.18,
        "department": "S&T",
        "priority_score": 70,
        "data_quality_issues": []
    }

    survivors, dropped, queue = integration_service.deduplicate_jobs(
        [job_eng, job_sig],
        sync_timestamp="2026-09-08T20:00:00"
    )

    # Neither record should be dropped!
    assert len(survivors) == 2, f"Near matches should not be dropped! Got {len(survivors)}"
    assert len(dropped) == 0, f"Expected 0 dropped records, got {len(dropped)}"

    # Both survivors must be flagged
    assert "probable_duplicate:flagged" in survivors[0]["data_quality_issues"]
    assert "probable_duplicate:flagged" in survivors[1]["data_quality_issues"]

    # Exactly 1 review queue item
    assert len(queue) == 1, f"Expected 1 review queue item, got {len(queue)}"
    rev = queue[0]
    assert rev["flag_type"] == "probable_duplicate"
    assert rev["corridor_id"] == "C01"
    assert rev["km_distance_m"] == 80.0
    assert rev["date_difference_days"] == 1
    assert rev["job_type_similarity"] >= DEDUP_JOB_TYPE_SIMILARITY_THRESHOLD
    assert rev["review_status"] == "PENDING_REVIEW"
    assert rev["job_a"]["job_id"] == "TEST-ENG-NEAR-01"
    assert rev["job_b"]["job_id"] == "TEST-SIG-NEAR-01"
    print(f"[PASS] Near-match flagged both records with 'probable_duplicate:flagged' and enqueued review item (dist={rev['km_distance_m']}m).")

def test_non_duplicate_isolation():
    print("--- Testing Non-Duplicate Isolation ---")
    # Jobs far apart (> 100m) or on different corridors
    job1 = {
        "job_id": "TEST-DISTINCT-01",
        "canonical_asset_id": "CAN-AST-C01-010.00-0001",
        "job_type": "BALLAST_CLEANING",
        "due_date": "2026-09-15",
        "source_system": "TMS",
        "corridor_id": "C01",
        "km": 10.0,
        "department": "Engineering",
        "priority_score": 60,
        "data_quality_issues": []
    }
    job2 = {
        "job_id": "TEST-DISTINCT-02",
        "canonical_asset_id": "CAN-AST-C01-011.50-0002",  # 1.5 km away!
        "job_type": "BALLAST_CLEANING",
        "due_date": "2026-09-15",
        "source_system": "TMS",
        "corridor_id": "C01",
        "km": 11.5,
        "department": "Engineering",
        "priority_score": 60,
        "data_quality_issues": []
    }
    survivors, dropped, queue = integration_service.deduplicate_jobs(
        [job1, job2],
        sync_timestamp="2026-09-08T20:00:00"
    )
    assert len(survivors) == 2
    assert len(dropped) == 0
    assert len(queue) == 0
    assert "probable_duplicate:flagged" not in survivors[0]["data_quality_issues"]
    assert "probable_duplicate:flagged" not in survivors[1]["data_quality_issues"]
    print("[PASS] Distinct jobs separated by distance are completely untouched.")

def test_full_pipeline_sync_and_persistence():
    print("--- Testing Full Pipeline Sync & Persistence ---")
    sync_summary = integration_service.sync_all_systems()

    # Verify summary structure
    assert "total_records_in" in sync_summary
    assert "exact_duplicates_resolved" in sync_summary
    assert "probable_duplicates_flagged" in sync_summary
    assert "net_unique_records_out" in sync_summary
    assert "exact_duplicates_dropped" in sync_summary
    assert "probable_duplicates_review_count" in sync_summary

    total_in = sync_summary["total_records_in"]
    exact_drop = sync_summary["exact_duplicates_resolved"]
    net_out = sync_summary["net_unique_records_out"]
    review_count = sync_summary["probable_duplicates_flagged"]

    print(f"Sync Results: Total In={total_in}, Exact Dropped={exact_drop}, Review Queue Items={review_count}, Net Out={net_out}")
    assert net_out == total_in - exact_drop, f"Net unique ({net_out}) must equal Total ({total_in}) minus Exact Dropped ({exact_drop})"

    # Verify file persistence: dedup_review_queue.json
    review_queue = file_repo.get_dedup_review_queue()
    assert isinstance(review_queue, list)
    assert len(review_queue) == review_count
    print(f"[PASS] Review queue file persisted at data/03_unified/dedup_review_queue.json with {len(review_queue)} items.")

    # Verify unified_maintenance_jobs.json has been written and loads cleanly
    unified_jobs = file_repo.get_unified_jobs()
    assert len(unified_jobs) == net_out
    print(f"[PASS] Unified jobs file persisted at data/03_unified/unified_maintenance_jobs.json with {len(unified_jobs)} clean records.")

def run_all_tests():
    print("==================================================================")
    print("  MAINTENANCE JOB DEDUPLICATION ENGINE TEST SUITE")
    print("==================================================================")
    test_configurable_constants()
    test_job_type_similarity()
    test_exact_match_deduplication()
    test_near_match_deduplication()
    test_non_duplicate_isolation()
    test_full_pipeline_sync_and_persistence()
    print("==================================================================")
    print("  ALL DEDUPLICATION ENGINE TESTS PASSED SUCCESSFULLY! [6/6]")
    print("==================================================================")

if __name__ == "__main__":
    run_all_tests()
