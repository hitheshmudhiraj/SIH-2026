import json
from app.services.data_integration import integration_service
from app.services.file_repository import file_repo

def test_sync_populates_persistent_review_queue():
    # Execute full sync
    sync_res = integration_service.sync_all_systems()
    assert sync_res is not None
    assert "invalid_records" in sync_res

    # Query review queue
    q = integration_service.get_review_queue()
    assert q["total"] >= 1
    assert "records" in q
    
    # Check that invalid records include raw_source, validation_errors / defaults_applied
    records = q["records"]
    tms_invalid = next((r for r in records if "TMS-JOB-155" in r.get("job_id", "")), None)
    assert tms_invalid is not None, "TMS-JOB-155 must be in review queue"
    assert tms_invalid["has_validation_errors"] is True
    assert len(tms_invalid["validation_errors"]) > 0
    assert "raw_source" in tms_invalid
    assert tms_invalid["error_type"] == "MISSING_ASSET_ID"
    
    # Check auto-defaulted record
    smms_defaulted = next((r for r in records if "SMMS-JOB-341" in r.get("job_id", "")), None)
    assert smms_defaulted is not None, "SMMS-JOB-341 must be in review queue"
    assert smms_defaulted["is_defaulted"] is True
    assert len(smms_defaulted["defaults_applied"]) > 0
    assert smms_defaulted["error_type"] == "DEFAULTED_DURATION"
    print("test_sync_populates_persistent_review_queue PASSED")

def test_approve_auto_defaulted_record():
    q = integration_service.get_review_queue()
    smms_defaulted = next((r for r in q["records"] if "SMMS-JOB-341" in r.get("job_id", "")), None)
    assert smms_defaulted is not None

    rec_id = smms_defaulted["id"]
    res = integration_service.submit_review_decision(
        record_id=rec_id,
        action="APPROVE",
        reason="Verified 60 min duration is adequate for axle counter check",
        user="TestOfficer"
    )
    assert res["success"] is True
    
    # Verify in persistent store
    updated_q = integration_service.get_review_queue()
    updated_rec = next((r for r in updated_q["records"] if r["id"] == rec_id), None)
    assert updated_rec["status"] == "APPROVED"
    assert updated_rec["review_decision"]["decided_by"] == "TestOfficer"
    
    # Verify in unified maintenance jobs
    unified = file_repo.get_unified_jobs()
    job = next((j for j in unified if j["job_id"] == "SMMS-JOB-341"), None)
    assert job is not None
    assert job["estimated_duration_min"] == 60
    assert job["is_valid"] is True
    print("test_approve_auto_defaulted_record PASSED")

def test_edit_and_approve_invalid_record():
    q = integration_service.get_review_queue()
    tms_invalid = next((r for r in q["records"] if "TMS-JOB-155" in r.get("job_id", "")), None)
    assert tms_invalid is not None

    rec_id = tms_invalid["id"]
    # Edit and approve with a valid asset_id and km
    res = integration_service.submit_review_decision(
        record_id=rec_id,
        action="EDIT_AND_APPROVE",
        reason="Corrected asset ID from typo TMS-UNKNOWN-001 to valid TMS-C01-TRK-0001",
        user="SeniorTrackInspector",
        corrected_fields={
            "asset_id": "TMS-C01-TRK-0001",
            "corridor_id": "C01",
            "km": 12.4
        }
    )
    assert res["success"] is True
    assert res["job"]["asset_id"] is not None
    assert res["job"]["canonical_asset_id"] is not None

    # Check review queue status
    updated_q = integration_service.get_review_queue()
    updated_rec = next((r for r in updated_q["records"] if r["id"] == rec_id), None)
    assert updated_rec["status"] == "EDITED_AND_APPROVED"
    assert updated_rec["has_validation_errors"] is False

    # Check unified jobs contains corrected job
    unified = file_repo.get_unified_jobs()
    job = next((j for j in unified if j["job_id"] == "TMS-JOB-155"), None)
    assert job is not None
    assert job["raw_asset_id"] == "TMS-C01-TRK-0001"
    assert job["canonical_asset_id"] is not None
    print("test_edit_and_approve_invalid_record PASSED")

def test_reject_record():
    # Now reject TMS-JOB-155
    res = integration_service.submit_review_decision(
        record_id="INV-REC-TMS-JOB-155",
        action="REJECT",
        reason="Duplicate work order already handled by local team",
        user="DutyOfficer"
    )
    assert res["success"] is True
    assert res["action"] == "REJECT"

    # Verify excluded from unified jobs
    unified = file_repo.get_unified_jobs()
    job = next((j for j in unified if j["job_id"] == "TMS-JOB-155"), None)
    assert job is None, "Rejected job must be excluded from unified jobs"

    # Verify review queue records rejection
    q = integration_service.get_review_queue(status="REJECTED")
    rec = next((r for r in q["records"] if "TMS-JOB-155" in r.get("job_id", "")), None)
    assert rec is not None
    assert rec["status"] == "REJECTED"
    assert rec["rejection_reason"] == "Duplicate work order already handled by local team"
    assert rec["rejection_timestamp"] is not None

    # Re-syncing must still exclude the rejected record
    sync_res = integration_service.sync_all_systems()
    unified_after_sync = file_repo.get_unified_jobs()
    assert not any(j["job_id"] == "TMS-JOB-155" for j in unified_after_sync)
    print("test_reject_record PASSED")

if __name__ == "__main__":
    test_sync_populates_persistent_review_queue()
    test_approve_auto_defaulted_record()
    test_edit_and_approve_invalid_record()
    test_reject_record()
    print("ALL REVIEW QUEUE UNIT TESTS PASSED!")
