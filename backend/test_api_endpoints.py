import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000"

def get(path):
    req = urllib.request.Request(f"{BASE_URL}{path}")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def post(path, data):
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=body,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def run_tests():
    print("Testing GET /api/integration/review-queue...")
    q = get("/api/integration/review-queue")
    print(f"Total in review queue: {q['total']}, Pending: {q['pending_count']}")
    assert q["total"] >= 1
    
    # Filter by department Traction
    q_tr = get("/api/integration/review-queue?department=Traction")
    assert all(r["department"] == "Traction" for r in q_tr["records"])
    print(f"[PASS] Filter by department=Traction: found {len(q_tr['records'])} records")

    # Filter by status PENDING_REVIEW
    q_pending = get("/api/integration/review-queue?status=PENDING_REVIEW")
    assert all(r["status"] == "PENDING_REVIEW" for r in q_pending["records"])
    print(f"[PASS] Filter by status=PENDING_REVIEW: found {len(q_pending['records'])} records")

    # Trigger a sync so TDMS-JOB-248 is registered
    post("/api/integration/sync", {})

    # Check that pending record TDMS-JOB-248 is present
    q_pending = get("/api/integration/review-queue?status=PENDING_REVIEW")
    pending_tdms = next((r for r in q_pending["records"] if "TDMS-JOB-248" in r.get("job_id", "")), None)
    assert pending_tdms is not None, "TDMS-JOB-248 must be pending review"
    print(f"[PASS] Found pending record: {pending_tdms['id']} with errors: {pending_tdms['validation_errors']}")

    # Submit EDIT_AND_APPROVE decision for TDMS-JOB-248
    print("Testing POST /api/integration/review-queue/{record_id}/decision with EDIT_AND_APPROVE...")
    decision_payload = {
        "action": "EDIT_AND_APPROVE",
        "reason": "Operator corrected asset to TDMS-C01-OHE-0201 and validated 60 min duration",
        "user": "SeniorTractionInspector",
        "corrected_fields": {
            "asset_id": "TDMS-C01-OHE-0201",
            "corridor_id": "C01",
            "station": "OGL",
            "km": 124.9,
            "estimated_duration_min": 60,
            "severity": "HIGH",
            "job_type": "TRANSFORMER_OIL_TESTING"
        }
    }
    res = post(f"/api/integration/review-queue/{pending_tdms['id']}/decision", decision_payload)
    assert res["success"] is True
    print(f"[PASS] Edit & Approve successful! Canonical Asset ID: {res['job'].get('canonical_asset_id')}")

    # Check updated review queue
    q_after = get("/api/integration/review-queue")
    updated_rec = next((r for r in q_after["records"] if r["id"] == pending_tdms["id"]), None)
    assert updated_rec["status"] == "EDITED_AND_APPROVED"
    assert updated_rec["has_validation_errors"] is False
    print("[PASS] Record status updated to EDITED_AND_APPROVED in persistent store")

    # Verify unified maintenance jobs contains the reprocessed job
    jobs = get("/api/maintenance?corridor=C01")
    ingested_job = next((j for j in jobs if j.get("job_id") == "TDMS-JOB-248"), None)
    assert ingested_job is not None, "TDMS-JOB-248 must be present in unified maintenance jobs"
    assert ingested_job["raw_asset_id"] == "TDMS-C01-OHE-0201"
    assert ingested_job["estimated_duration_min"] == 60
    print("[PASS] Ingested job present in unified store with corrected fields and canonical asset linkage")
    print("[PASS] Ingested job present in unified store with corrected fields and canonical asset linkage")

    print("\n=======================================================")
    print("ALL API ENDPOINT END-TO-END TESTS PASSED SUCCESSFULLY!")
    print("=======================================================")

if __name__ == "__main__":
    run_tests()
