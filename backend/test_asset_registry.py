"""
Test Suite: Canonical Asset Master Registry
Validates:
1. Schema & Field Integrity
2. Raw Ingestion (197 raw assets across TMS, SMMS, TDMS)
3. Spatial Reconciliation (<= 100m tolerance) -> 173 canonical assets
4. Multi-Department Merges (including 3-way co-location at C01 KM 124.6)
5. Cross-Reference Resolution (TMS_id, SMMS_id, TDMS_id, spatial fallback)
6. Data Integration Pipeline (jobs enriched with canonical asset metadata)
7. FastAPI Endpoints (/api/assets/canonical, summary, detail)
"""

import os
import sys
import json

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.services.file_repository import file_repo
from app.services.asset_registry import asset_registry_service
from app.services.data_integration import integration_service
from fastapi.testclient import TestClient
from app.main import app

def run_tests():
    print("==================================================================")
    print("  RUNNING ASSET MASTER REGISTRY VALIDATION TEST SUITE")
    print("==================================================================")

    # 1. Raw Ingestion Validation
    tms_raw = file_repo.get_raw_tms_assets()
    smms_raw = file_repo.get_raw_smms_assets()
    tdms_raw = file_repo.get_raw_tdms_assets()

    assert len(tms_raw) == 77, f"Expected 77 TMS assets, got {len(tms_raw)}"
    assert len(smms_raw) == 60, f"Expected 60 SMMS assets, got {len(smms_raw)}"
    assert len(tdms_raw) == 60, f"Expected 60 TDMS assets, got {len(tdms_raw)}"
    total_raw = len(tms_raw) + len(smms_raw) + len(tdms_raw)
    assert total_raw == 197, f"Expected 197 total raw assets, got {total_raw}"
    print(f"[PASS] 1. Raw Ingestion: Ingested {total_raw} raw assets (TMS=77, SMMS=60, TDMS=60).")

    # 2. Build & Reconcile Registry
    summary = asset_registry_service.build_and_save_registry()
    canonical_assets = asset_registry_service.get_all_assets()
    assert len(canonical_assets) == 173, f"Expected 173 canonical assets, got {len(canonical_assets)}"
    assert summary["total_canonical_assets"] == 173
    assert summary["multi_department_merged"] == 23
    assert summary["single_department_only"] == 150
    assert summary["total_raw_assets_reconciled"] == 197
    print(f"[PASS] 2. Spatial Reconciliation: 197 raw assets clustered into {len(canonical_assets)} canonical assets.")
    print(f"       -> {summary['multi_department_merged']} multi-department merged assets.")
    print(f"       -> {summary['single_department_only']} single-department assets.")
    print(f"       -> Department overlap breakdown: {summary['department_overlap_breakdown']}")

    # 3. Verify 3-Way Merge (Corridor C01 @ KM 124.6)
    c_tms = asset_registry_service.get_canonical_by_dept_id("Engineering", "TMS-C01-PNT-1043")
    c_smms = asset_registry_service.get_canonical_by_dept_id("S&T", "SMMS-C01-SIG-0501")
    c_tdms = asset_registry_service.get_canonical_by_dept_id("Traction", "TDMS-C01-ISO-0202")

    assert c_tms is not None, "TMS-C01-PNT-1043 not found in canonical registry"
    assert c_smms is not None, "SMMS-C01-SIG-0501 not found in canonical registry"
    assert c_tdms is not None, "TDMS-C01-ISO-0202 not found in canonical registry"

    assert c_tms["asset_id"] == c_smms["asset_id"] == c_tdms["asset_id"], (
        f"3-way co-located items must have identical canonical asset_id! "
        f"TMS={c_tms['asset_id']}, SMMS={c_smms['asset_id']}, TDMS={c_tdms['asset_id']}"
    )

    canonical_3way = c_tms
    assert set(canonical_3way["owning_departments"]) == {"Engineering", "S&T", "Traction"}
    xref = canonical_3way["cross_reference"]
    assert xref["TMS_id"] == "TMS-C01-PNT-1043"
    assert xref["SMMS_id"] == "SMMS-C01-SIG-0501"
    assert xref["TDMS_id"] == "TDMS-C01-ISO-0202"
    assert canonical_3way["criticality"] == "CRITICAL"
    assert canonical_3way["condition_score"] == 56.0  # Lowest condition score among components
    assert canonical_3way["reconciliation_metadata"]["is_merged"] is True
    assert canonical_3way["reconciliation_metadata"]["component_count"] == 3
    print(f"[PASS] 3. 3-Way Merge Verified: Canonical Asset {canonical_3way['asset_id']} co-locates:")
    print(f"       - TMS:  TMS-C01-PNT-1043 (Points 102A)")
    print(f"       - SMMS: SMMS-C01-SIG-0501 (Electric Point Machine)")
    print(f"       - TDMS: TDMS-C01-ISO-0202 (Motorized Vacuum Isolator)")
    print(f"       - Cross-Ref: {xref}")

    # 4. Lookups & Spatial Fallback
    res_direct = asset_registry_service.resolve_asset(raw_id="TMS-C01-TRK-1042")
    assert res_direct["cross_reference"]["TMS_id"] == "TMS-C01-TRK-1042"

    res_spatial = asset_registry_service.resolve_asset(
        raw_id="UNKNOWN-TEST-ID",
        corridor_id="C01",
        km=124.60
    )
    assert res_spatial["asset_id"] == canonical_3way["asset_id"], "Spatial fallback failed to resolve nearest co-located asset"

    res_fallback = asset_registry_service.resolve_asset(
        raw_id="COMPLETELY-UNMAPPED-9999",
        corridor_id="C04",
        km=999.0
    )
    assert "UNMAPPED" in res_fallback["asset_id"]
    print("[PASS] 4. Lookup and spatial fallback mechanisms validated successfully.")

    # 5. File Persistence
    reg_file = os.path.join("c:/SIH26/data/03_unified/asset_master_registry.json")
    assert os.path.exists(reg_file), "asset_master_registry.json does not exist on disk"
    with open(reg_file, "r", encoding="utf-8") as f:
        disk_data = json.load(f)
    assert len(disk_data) == 173, f"Expected 173 items in file, found {len(disk_data)}"
    print(f"[PASS] 5. File Persistence: {len(disk_data)} records verified in data/03_unified/asset_master_registry.json.")

    # 6. Data Integration Pipeline Verification
    sync_result = integration_service.sync_all_systems()
    assert sync_result["records_normalized"] == 140
    assert "asset_registry_summary" in sync_result
    jobs = file_repo.get_unified_jobs()
    assert len(jobs) == 140

    # Ensure all jobs have canonical_asset_id and cross_reference
    for j in jobs:
        assert "asset_id" in j and j["asset_id"]
        assert "canonical_asset_id" in j
        assert "raw_asset_id" in j
        assert "owning_departments" in j and isinstance(j["owning_departments"], list)
        assert "asset_cross_reference" in j and isinstance(j["asset_cross_reference"], dict)

    # Find jobs on 3-way co-located asset
    co_jobs = [j for j in jobs if j.get("asset_id") == canonical_3way["asset_id"]]
    assert len(co_jobs) >= 2, f"Expected multiple jobs mapped to co-located asset {canonical_3way['asset_id']}, got {len(co_jobs)}"
    co_depts = {j["department"] for j in co_jobs}
    print(f"[PASS] 6. Data Integration Pipeline: {len(jobs)} jobs normalized.")
    print(f"       - Found {len(co_jobs)} cross-department jobs sharing Canonical Asset {canonical_3way['asset_id']}:")
    for j in co_jobs:
        print(f"         * Job {j['job_id']} ({j['department']}) - {j['job_type']}")

    # 7. FastAPI Endpoint Verification
    client = TestClient(app)

    # /api/assets/canonical
    r = client.get("/api/assets/canonical")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    assets_api = r.json()
    assert len(assets_api) == 173

    # /api/assets/canonical?merged_only=true
    r_merged = client.get("/api/assets/canonical?merged_only=true")
    assert r_merged.status_code == 200
    assert len(r_merged.json()) == 23

    # /api/assets/canonical/summary
    r_sum = client.get("/api/assets/canonical/summary")
    assert r_sum.status_code == 200
    assert r_sum.json()["total_canonical_assets"] == 173

    # /api/assets/canonical/{asset_id}
    r_detail = client.get(f"/api/assets/canonical/{canonical_3way['asset_id']}")
    assert r_detail.status_code == 200
    assert r_detail.json()["asset_id"] == canonical_3way["asset_id"]

    print("[PASS] 7. FastAPI Endpoints: /api/assets/canonical, summary, and detail verified.")
    print("==================================================================")
    print("  ALL ASSET MASTER REGISTRY TESTS COMPLETED SUCCESSFULLY! (7/7)  ")
    print("==================================================================")

if __name__ == "__main__":
    run_tests()
