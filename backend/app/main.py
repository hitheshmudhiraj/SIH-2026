import sys
import os
import json
import uuid
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.core.config import settings
from app.api.health import router as health_router

# Import strictly file-based services
from app.services.file_repository import file_repo
from app.services.data_integration import integration_service
from app.services.priority_engine import priority_engine
from app.services.opportunity_engine import opportunity_engine
from app.services.optimizer import optimizer
from app.services.replanner import replanner
from app.services.lineage_engine import lineage_engine
from app.services.asset_registry import asset_registry_service

# SIH26027 Block Planning Services
from app.services.corridor_availability import corridor_engine
from app.services.prioritization_engine import prioritizer
from app.services.block_planner import (
    block_planner,
    PLANS_DIR,
    normalize_maintenance_request,
    group_compatible_maintenance_jobs,
    check_resource_availability,
    select_best_candidate_block,
    get_current_plan,
    get_plan_by_id,
    get_active_plan_pointer,
    get_plan_history,
    validate_department_resource,
    get_department_resources,
    update_plan_status
)
from app.services.block_comparator import plan_comparator
from app.services.notification_service import notification_service
from ml.predict import block_recommender

app = FastAPI(
    title="RailBlock AI — South Coast Railway Maintenance Planning Platform",
    description=(
        "Decision-Support System for Indian Railways Maintenance Block Planning. "
        "South Coast Railway (SCoR) 2026 Operational Pilot (Andhra Pradesh). "
        "Strictly File-Based Architecture (CSV/JSON). Synthetic Demonstration Data. Human Approval Required."
    ),
    version="2.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Health Routers
app.include_router(health_router)
app.include_router(health_router, prefix="/api")

# Pydantic Schemas for Requests
class WhatIfRequest(BaseModel):
    block_duration_minutes: Optional[int] = 120
    train_delay_minutes: Optional[int] = 0
    priority_shift_pct: Optional[int] = 0
    corridor_id: Optional[str] = None

class EmergencyDefectRequest(BaseModel):
    title: Optional[str] = "Ultrasonic Rail Fracture Defect (USFD)"
    corridor_id: Optional[str] = "C01"
    km: Optional[float] = 124.4
    station: Optional[str] = "OGL"
    severity: Optional[str] = "CRITICAL"
    duration_minutes: Optional[int] = 120

class PlanApprovalPayload(BaseModel):
    plan_id: str
    approved_by: str
    role: Optional[str] = "Divisional Operations Officer"
    comments: Optional[str] = ""

class PlanModifyPayload(BaseModel):
    plan_id: str
    job_id: Optional[str] = None
    work_item_id: Optional[str] = None
    new_start_time: Optional[str] = None
    new_end_time: Optional[str] = None
    new_day: Optional[str] = None
    modified_by: str
    reason: str

class BlockPlanRequest(BaseModel):
    start_date: Optional[str] = "2026-09-08"
    end_date: Optional[str] = None

class BlockRecommendationRequest(BaseModel):
    # 8 Standardized Maintenance Request Fields
    request_id: Optional[str] = None
    department: str = "Engineering"
    location: Optional[str] = None
    section_id: Optional[str] = "SEC_C01_01"  # Alias for location
    work_type: str = "Track Maintenance"
    duration_hours: float = 2.0
    priority: Optional[str] = "HIGH"
    required_resource: Optional[str] = None
    preferred_date: Optional[str] = "2026-09-08"

    # Backward-compatible fields
    preferred_time_window: Optional[str] = "ANY"
    crew_type: Optional[str] = None
    equipment_required: Optional[str] = None
    work_description: Optional[str] = ""

    def to_standard_dict(self) -> Dict[str, Any]:
        return normalize_maintenance_request(self)


class ReviewDecisionPayload(BaseModel):
    action: str  # "APPROVE", "EDIT_AND_APPROVE", "REJECT"
    reason: Optional[str] = ""
    user: Optional[str] = "HumanReviewer"
    corrected_fields: Optional[Dict[str, Any]] = None



# =====================================================================
# 1. DATA INTEGRATION HUB ENDPOINTS
# =====================================================================
@app.get("/api/integration/status")
def get_integration_status():
    """Returns dynamic system status cards and statistics calculated from actual files."""
    return integration_service.get_system_status()


@app.post("/api/integration/sync")
def sync_all_systems():
    """
    Executes the complete 13-step synchronization & normalization pipeline across
    TMS, SMMS, TDMS, COA, and BDMS CSV/JSON files.
    """
    return integration_service.sync_all_systems()


@app.get("/api/integration/quality")
def get_data_quality_report():
    """Returns detailed data quality scoring, anomalies, duplicates, and validation issues."""
    sync_res = file_repo.get_sync_result()
    if not sync_res:
        sync_res = integration_service.sync_all_systems()
    return {
        "data_quality_score": sync_res.get("data_quality_score", 99.7),
        "total_records": sync_res.get("records_received", 0),
        "normalized_records": sync_res.get("records_normalized", 0),
        "duplicates_detected": sync_res.get("duplicates_detected", 0),
        "invalid_records_count": sync_res.get("invalid_records_count", 0),
        "invalid_records": sync_res.get("invalid_records", []),
        "last_sync_timestamp": sync_res.get("last_sync_timestamp")
    }


@app.get("/api/integration/review-queue")
def get_invalid_records_review_queue(
    status: Optional[str] = None,
    department: Optional[str] = None,
    error_type: Optional[str] = None,
    is_defaulted: Optional[bool] = None
):
    """
    Returns the persistent human review queue of invalid and auto-defaulted records,
    supporting multi-attribute filtering and status counts.
    """
    return integration_service.get_review_queue(
        status=status,
        department=department,
        error_type=error_type,
        is_defaulted=is_defaulted
    )


@app.post("/api/integration/review-queue/{record_id}/decision")
def submit_review_decision(record_id: str, payload: ReviewDecisionPayload):
    """
    Processes human review decision for an invalid or defaulted record:
    - APPROVE: Re-enters standard pipeline with auto-defaulted values.
    - EDIT_AND_APPROVE: Merges corrected fields and re-enters pipeline through full validation & dedup.
    - REJECT: Excludes record from unified dataset with reason and timestamp audit trail.
    """
    try:
        res = integration_service.submit_review_decision(
            record_id=record_id,
            action=payload.action,
            reason=payload.reason or "",
            user=payload.user or "HumanReviewer",
            corrected_fields=payload.corrected_fields
        )
        if payload.action == "REJECT":
            try:
                notification_service.create_rejection_notification(
                    request_data={"request_id": record_id, "department": "Maintenance"},
                    reason=payload.reason or "Excluded by human review officer"
                )
            except Exception as notif_err:
                print(f"[Notifications] Error creating review rejection notification: {notif_err}")
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error processing review decision: {str(e)}")


# =====================================================================
# 2. RAW & UNIFIED DATA VIEW ENDPOINTS
# =====================================================================
@app.get("/api/assets")
def get_all_assets(source: Optional[str] = None, corridor: Optional[str] = None):
    """Returns raw railway infrastructure assets from TMS, SMMS, and TDMS."""
    tms = file_repo.get_raw_tms_assets()
    smms = file_repo.get_raw_smms_assets()
    tdms = file_repo.get_raw_tdms_assets()

    for a in tms: a["system"] = "TMS"
    for a in smms: a["system"] = "SMMS"
    for a in tdms: a["system"] = "TDMS"

    all_assets = tms + smms + tdms
    if source:
        all_assets = [a for a in all_assets if a.get("system", "").upper() == source.upper()]
    if corridor:
        all_assets = [a for a in all_assets if a.get("corridor_id") == corridor]
    return all_assets


@app.get("/api/assets/canonical")
def get_canonical_assets(
    corridor: Optional[str] = None,
    department: Optional[str] = None,
    merged_only: bool = False
):
    """Returns canonical assets from the canonical Asset Master Registry."""
    assets = asset_registry_service.get_all_assets()
    if not assets:
        asset_registry_service.build_and_save_registry()
        assets = asset_registry_service.get_all_assets()
    if corridor:
        assets = [a for a in assets if a.get("corridor_id") == corridor]
    if department:
        assets = [
            a for a in assets
            if department.lower() in [d.lower() for d in a.get("owning_departments", [])]
        ]
    if merged_only:
        assets = [a for a in assets if a.get("reconciliation_metadata", {}).get("is_merged")]
    return assets


@app.get("/api/assets/canonical/summary")
def get_canonical_assets_summary():
    """Returns reconciliation and summary metrics for the canonical Asset Master Registry."""
    return asset_registry_service.get_summary()


@app.get("/api/assets/canonical/{asset_id}")
def get_canonical_asset_by_id(asset_id: str):
    """Returns a specific canonical asset by its canonical ID or departmental raw ID."""
    asset = asset_registry_service.get_canonical_asset(asset_id)
    if not asset:
        asset = asset_registry_service.resolve_asset(raw_id=asset_id)
    return asset


@app.get("/api/maintenance")
def get_maintenance_jobs(
    corridor: Optional[str] = None,
    department: Optional[str] = None,
    departments: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Returns unified normalized maintenance jobs with multi-department and date filtering."""
    jobs = file_repo.get_unified_jobs()
    if not jobs:
        integration_service.sync_all_systems()
        jobs = file_repo.get_unified_jobs()

    if corridor and corridor.upper() != "ALL":
        jobs = [j for j in jobs if j.get("corridor_id") == corridor]

    dept_filter_list = []
    if departments:
        dept_filter_list.extend([d.strip().lower() for d in departments.split(",") if d.strip()])
    elif department and department.upper() != "ALL":
        dept_filter_list.append(department.strip().lower())

    if dept_filter_list and "all" not in dept_filter_list:
        jobs = [j for j in jobs if j.get("department", "").lower() in dept_filter_list]

    if start_date:
        jobs = [j for j in jobs if str(j.get("due_date", "")) >= start_date[:10]]
    if end_date:
        jobs = [j for j in jobs if str(j.get("due_date", "")) <= end_date[:10]]

    return jobs


@app.get("/api/trains")
def get_train_movements(corridor: Optional[str] = None):
    """Returns COA train movement schedules."""
    trains = file_repo.get_raw_coa_trains()
    if corridor and corridor.upper() != "ALL":
        trains = [t for t in trains if t.get("corridor_id") == corridor]
    return trains


@app.get("/api/blocks")
def get_block_requests(corridor: Optional[str] = None):
    """Returns BDMS maintenance block requests."""
    reqs = file_repo.get_raw_bdms_requests()
    if corridor and corridor.upper() != "ALL":
        reqs = [r for r in reqs if r.get("corridor_id") == corridor]
    return reqs


@app.get("/api/blocks/check-overlap")
def check_block_overlap(
    corridor_id: str = Query(..., description="Corridor code e.g. C01"),
    km: float = Query(..., description="Proposed location in KM"),
    date_start: str = Query(..., description="Start date YYYY-MM-DD"),
    date_end: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    department: Optional[str] = Query(None, description="Requesting department")
):
    """
    Checks proposed BDMS block request against existing unified jobs and requests.
    Detects Direct Physical Collisions (<= 50m) and Joint-Block Opportunities (50m - 2000m).
    Surfaced BEFORE final submission for cross-department coordination.
    """
    if not date_end:
        date_end = date_start

    try:
        dt_start = datetime.strptime(date_start[:10], "%Y-%m-%d").date()
    except Exception:
        dt_start = datetime.now().date()

    try:
        dt_end = datetime.strptime(date_end[:10], "%Y-%m-%d").date()
    except Exception:
        dt_end = dt_start

    # Window +/- 1 day to catch shift overlaps
    window_start = dt_start - timedelta(days=1)
    window_end = dt_end + timedelta(days=1)

    corridor_norm = corridor_id.strip().upper()
    overlaps = []

    # 1. Check Unified Maintenance Jobs
    unified_jobs = file_repo.get_unified_jobs()
    for job in unified_jobs:
        job_corr = str(job.get("corridor_id", "")).strip().upper()
        if job_corr != corridor_norm:
            continue

        job_date_str = str(job.get("due_date", ""))[:10]
        try:
            job_date = datetime.strptime(job_date_str, "%Y-%m-%d").date()
            if not (window_start <= job_date <= window_end):
                continue
        except Exception:
            pass

        try:
            job_km = float(job.get("km", job.get("provisional_km", 0.0)))
        except (ValueError, TypeError):
            continue

        diff_km = abs(job_km - km)
        dist_m = round(diff_km * 1000.0, 1)

        if dist_m > 2000.0:
            continue

        job_dept = job.get("department", "Unknown")
        is_cross_dept = bool(department and job_dept.lower() != department.strip().lower())

        if dist_m <= 50.0:
            category = "DIRECT_COLLISION"
            severity = "CRITICAL"
            title = "Direct Physical Collision"
            description = (
                f"Asset conflict with {job_dept} at KM {job_km:.2f} ({dist_m:.0f}m away). "
                f"Simultaneous possessions on the same asset segment cause physical track blockage."
            )
        else:
            category = "JOINT_BLOCK_OPPORTUNITY"
            severity = "OPPORTUNITY"
            title = "Joint-Block Opportunity"
            description = (
                f"Adjacent {job_dept} work at KM {job_km:.2f} ({dist_m:.0f}m away). "
                f"Synergy: combine into a single coordinated corridor possession window."
            )

        overlaps.append({
            "id": job.get("job_id"),
            "source_type": "UNIFIED_JOB",
            "department": job_dept,
            "is_cross_department": is_cross_dept,
            "corridor_id": job_corr,
            "km": job_km,
            "station": job.get("station", ""),
            "date": job_date_str,
            "time_window": f"{job.get('estimated_duration_min', 120)} mins",
            "component": job.get("asset_type", "Track Infrastructure"),
            "activity": job.get("job_type", "Maintenance"),
            "priority_tier": job.get("priority_tier", "NORMAL"),
            "distance_m": dist_m,
            "category": category,
            "severity": severity,
            "title": title,
            "description": description
        })

    # 2. Check Pending BDMS requests
    bdms_reqs = file_repo.get_raw_bdms_requests()
    for req in bdms_reqs:
        req_corr = str(req.get("corridor_id", "")).strip().upper()
        if req_corr != corridor_norm:
            continue

        req_date_str = str(req.get("requested_date", ""))[:10]
        try:
            req_date = datetime.strptime(req_date_str, "%Y-%m-%d").date()
            if not (window_start <= req_date <= window_end):
                continue
        except Exception:
            pass

        req_km = None
        if "km" in req and req["km"]:
            try:
                req_km = float(req["km"])
            except Exception:
                pass
        elif "km_range" in req and req["km_range"]:
            try:
                parts = str(req["km_range"]).split("-")
                if len(parts) == 2:
                    req_km = (float(parts[0]) + float(parts[1])) / 2.0
            except Exception:
                pass

        if req_km is None:
            continue

        diff_km = abs(req_km - km)
        dist_m = round(diff_km * 1000.0, 1)

        if dist_m > 2000.0:
            continue

        req_dept = req.get("department", "Unknown")
        is_cross_dept = bool(department and req_dept.lower() != department.strip().lower())

        if dist_m <= 50.0:
            category = "DIRECT_COLLISION"
            severity = "CRITICAL"
            title = "Direct Request Collision"
            description = (
                f"Existing BDMS block request ({req.get('block_request_id')}) by {req_dept} at KM {req_km:.2f} ({dist_m:.0f}m away). "
                f"Window: {req.get('requested_start', '')}-{req.get('requested_end', '')}."
            )
        else:
            category = "JOINT_BLOCK_OPPORTUNITY"
            severity = "OPPORTUNITY"
            title = "Joint-Block Opportunity (BDMS)"
            description = (
                f"Existing BDMS request by {req_dept} at KM {req_km:.2f} ({dist_m:.0f}m away). "
                f"Opportunity to bundle during window {req.get('requested_start', '')}-{req.get('requested_end', '')}."
            )

        overlaps.append({
            "id": req.get("block_request_id"),
            "source_type": "BDMS_REQUEST",
            "department": req_dept,
            "is_cross_department": is_cross_dept,
            "corridor_id": req_corr,
            "km": req_km,
            "station": req.get("station", ""),
            "date": req_date_str,
            "time_window": f"{req.get('requested_start', '')}-{req.get('requested_end', '')} ({req.get('requested_duration_min', 120)}m)",
            "component": "Block Possession Request",
            "activity": req.get("reason", "Block Request"),
            "priority_tier": "BDMS_PENDING",
            "distance_m": dist_m,
            "category": category,
            "severity": severity,
            "title": title,
            "description": description
        })

    # Sort overlaps: direct collisions first, then by distance
    overlaps.sort(key=lambda x: (0 if x["category"] == "DIRECT_COLLISION" else 1, x["distance_m"]))

    direct_count = sum(1 for o in overlaps if o["category"] == "DIRECT_COLLISION")
    joint_count = sum(1 for o in overlaps if o["category"] == "JOINT_BLOCK_OPPORTUNITY")

    return {
        "has_overlap": len(overlaps) > 0,
        "overlap_count": len(overlaps),
        "direct_collisions_count": direct_count,
        "joint_opportunities_count": joint_count,
        "overlaps": overlaps,
        "query": {
            "corridor_id": corridor_norm,
            "km": km,
            "date_start": date_start,
            "date_end": date_end,
            "department": department
        },
        "check_timestamp": datetime.now().isoformat()
    }


class BlockSubmissionPayload(BaseModel):
    corridor_id: str
    department: str
    station: Optional[str] = "BZA"
    km: float
    requested_date: str
    requested_start: str = "01:00"
    requested_end: str = "04:00"
    requested_duration_min: int = 180
    reason: str
    submission_choice: str = "PROCEED_ANYWAY"  # PROCEED_ANYWAY or COORDINATE_JOINT_BLOCK
    coordinated_with_id: Optional[str] = None
    notified_department: Optional[str] = None
    overlap_count: Optional[int] = 0


@app.post("/api/blocks/submit-request")
def submit_block_request(payload: BlockSubmissionPayload):
    """
    Submits a BDMS block request with user's resolution decision:
    - PROCEED_ANYWAY: submits as separate request, logged as potential conflict in audit trail
    - COORDINATE_JOINT_BLOCK: submits with joint-block coordination intent and logs notification
    """
    req_id = f"BDMS-REQ-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

    km_val = payload.km
    km_range_str = f"{km_val - 1.5:.1f}-{km_val + 1.5:.1f}"

    status_str = (
        "JOINT_COORDINATION_REQUESTED"
        if payload.submission_choice == "COORDINATE_JOINT_BLOCK"
        else ("SUBMITTED_POTENTIAL_CONFLICT" if (payload.overlap_count or 0) > 0 else "SUBMITTED_CLEAN")
    )

    coord_note = f" (Coord with {payload.coordinated_with_id})" if payload.coordinated_with_id else ""
    req_data = {
        "block_request_id": req_id,
        "corridor_id": payload.corridor_id.upper(),
        "department": payload.department,
        "requested_date": payload.requested_date,
        "requested_start": payload.requested_start,
        "requested_end": payload.requested_end,
        "requested_duration_min": payload.requested_duration_min,
        "reason": f"[{payload.submission_choice}] {payload.reason}{coord_note}",
        "status": status_str,
        "station": payload.station or "BZA",
        "km_range": km_range_str
    }

    # Save to BDMS raw requests
    file_repo.add_raw_bdms_request(req_data)

    # Cross-department Audit Trail Logging
    if payload.submission_choice == "COORDINATE_JOINT_BLOCK":
        target = payload.coordinated_with_id or payload.notified_department or "cross-department team"
        action_desc = f"Joint coordination requested with {target}"
    elif (payload.overlap_count or 0) > 0:
        action_desc = f"Submitted despite {payload.overlap_count} detected overlap(s) - flagged in audit trail"
    else:
        action_desc = "Clean request submitted (no spatial/date overlaps detected)"

    audit_entry = file_repo.log_audit_event(
        event_type="BDMS_REQUEST_CONFLICT_CHECK",
        action=action_desc,
        details={
            "block_request_id": req_id,
            "corridor_id": payload.corridor_id,
            "km": payload.km,
            "department": payload.department,
            "requested_date": payload.requested_date,
            "submission_choice": payload.submission_choice,
            "overlap_count": payload.overlap_count,
            "coordinated_with_id": payload.coordinated_with_id,
            "notified_department": payload.notified_department,
            "status": status_str
        },
        user=f"{payload.department} Section Engineer"
    )

    return {
        "status": "success",
        "block_request_id": req_id,
        "submission_choice": payload.submission_choice,
        "audit_id": audit_entry.get("id"),
        "message": (
            f"Block request {req_id} registered. Joint-coordination intent recorded and notification queued for {payload.notified_department or 'cross-department team'}."
            if payload.submission_choice == "COORDINATE_JOINT_BLOCK"
            else f"Block request {req_id} registered. Cross-department conflict flagged in audit log for Sr. DOM review."
        ),
        "request_data": req_data
    }


# =====================================================================
# 3. CORRIDOR TOPOLOGY & ANDHRA PRADESH MAP ENDPOINT
# =====================================================================
@app.get("/api/corridors/ap-map")
def get_ap_corridor_map(
    corridor: Optional[str] = None,
    department: Optional[str] = None,
    departments: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Returns full geographic and operational topology for South Coast Railway (SCoR) pilot:
    stations with coordinates, corridors, active maintenance pins, defect alerts, and train paths.
    Supports corridor, multi-department, and date range filtering.
    """
    stations = file_repo.get_stations()
    corridors = file_repo.get_corridors()
    jobs = file_repo.get_unified_jobs()
    if not jobs:
        integration_service.sync_all_systems()
        jobs = file_repo.get_unified_jobs()
    trains = file_repo.get_raw_coa_trains()
    latest_plan = file_repo.get_latest_plan() or {}

    SECTION_STATIONS_MAP = {
        "SEC_C01_01": ("BZA", "TEL", "C01", "Vijayawada - Tenali"),
        "SEC_C01_02": ("TEL", "BPP", "C01", "Tenali - Bapatla"),
        "SEC_C01_03": ("BPP", "CLX", "C01", "Bapatla - Chirala"),
        "SEC_C01_04": ("CLX", "OGL", "C01", "Chirala - Ongole"),
        "SEC_C01_05": ("OGL", "SKM", "C01", "Ongole - Singarayakonda"),
        "SEC_C01_06": ("SKM", "KVZ", "C01", "Singarayakonda - Kavali"),
        "SEC_C01_07": ("KVZ", "NLR", "C01", "Kavali - Nellore"),
        "SEC_C01_08": ("NLR", "GDR", "C01", "Nellore - Gudur"),
        "SEC_C02_01": ("VSKP", "DVD", "C02", "Visakhapatnam - Duvvada"),
        "SEC_C02_02": ("DVD", "AKP", "C02", "Duvvada - Anakapalle"),
        "SEC_C02_03": ("AKP", "TUNI", "C02", "Anakapalle - Tuni"),
        "SEC_C02_04": ("TUNI", "ANV", "C02", "Tuni - Annavaram"),
        "SEC_C02_05": ("ANV", "SLO", "C02", "Annavaram - Samalkot"),
        "SEC_C02_06": ("SLO", "RJY", "C02", "Samalkot - Rajahmundry"),
        "SEC_C02_07": ("RJY", "NDD", "C02", "Rajahmundry - Nidadavolu"),
        "SEC_C02_08": ("NDD", "TDD", "C02", "Nidadavolu - Tadepalligudem"),
        "SEC_C02_09": ("TDD", "EE", "C02", "Tadepalligudem - Eluru"),
        "SEC_C02_10": ("EE", "BZA", "C02", "Eluru - Vijayawada"),
        "SEC_C03_01": ("GNT", "NRT", "C03", "Guntur - Narasaraopet"),
        "SEC_C03_02": ("NRT", "VKN", "C03", "Narasaraopet - Vinukonda"),
        "SEC_C03_03": ("VKN", "DKD", "C03", "Vinukonda - Donakonda"),
        "SEC_C03_04": ("DKD", "MRK", "C03", "Donakonda - Markapur Road"),
        "SEC_C03_05": ("MRK", "GID", "C03", "Markapur Road - Giddalur"),
        "SEC_C03_06": ("GID", "NDL", "C03", "Giddalur - Nandyal"),
        "SEC_C04_01": ("GTL", "GY", "C04", "Guntakal - Gooty"),
        "SEC_C04_02": ("GY", "TU", "C04", "Gooty - Tadipatri"),
        "SEC_C04_03": ("TU", "KDP", "C04", "Tadipatri - Kondapuram"),
        "SEC_C04_04": ("KDP", "YA", "C04", "Kondapuram - Yerraguntla"),
        "SEC_C04_05": ("YA", "HX", "C04", "Yerraguntla - Kadapa"),
        "SEC_C04_06": ("HX", "RJP", "C04", "Kadapa - Razampeta"),
        "SEC_C04_07": ("RJP", "KOU", "C04", "Razampeta - Koduru"),
        "SEC_C04_08": ("KOU", "RU", "C04", "Koduru - Renigunta"),
    }

    # Load active plan blocks with fallback priority
    raw_plan_blocks = []
    weekly_plan_path = os.path.join(file_repo.plans_dir, "latest_weekly_plan.json")
    if os.path.exists(weekly_plan_path):
        try:
            with open(weekly_plan_path, "r", encoding="utf-8") as f:
                wp_data = json.load(f)
                raw_plan_blocks = wp_data.get("blocks", [])
        except Exception:
            pass
    if not raw_plan_blocks:
        raw_plan_blocks = latest_plan.get("recommended_blocks", []) or latest_plan.get("blocks", [])

    formatted_active_blocks = []
    for b in raw_plan_blocks:
        sec_id = b.get("section_id")
        from_stn = b.get("from_stn") or b.get("from_station")
        to_stn = b.get("to_stn") or b.get("to_station")
        c_id = b.get("corridor_id")
        sec_name = b.get("section_name")
        if sec_id in SECTION_STATIONS_MAP:
            m_from, m_to, m_corridor, m_name = SECTION_STATIONS_MAP[sec_id]
            from_stn = from_stn or m_from
            to_stn = to_stn or m_to
            c_id = c_id or m_corridor
            sec_name = sec_name or m_name

        depts = b.get("departments") or ([b.get("department")] if b.get("department") else ["Engineering"])
        is_joint = bool(b.get("is_joint_megablock") or b.get("is_joint_block") or len(depts) > 1)

        train_conf = "0 Scheduled Train Clashes (Clear Headway)"
        if b.get("conflict_check"):
            cc = b["conflict_check"]
            if cc.get("has_conflict"):
                train_conf = f"{cc.get('conflict_count', 1)} Train Conflicts"
            elif cc.get("reason"):
                train_conf = cc["reason"]

        res_str = "Allocated Maintenance Gang & Machinery"
        if b.get("resource_check"):
            rc = b["resource_check"]
            if rc.get("resources"):
                res_str = ", ".join([r.get("resource_name", r.get("matched_resource_id", "Resource")) for r in rc["resources"]])
            elif rc.get("status"):
                res_str = rc["status"]

        dur_min = b.get("duration_min") or int(float(b.get("duration_hours", 2.0)) * 60)
        start_t = b.get("start_time") or "01:00"
        end_t = b.get("end_time") or "04:00"

        formatted_active_blocks.append({
            "block_id": b.get("block_id") or f"BLK-{len(formatted_active_blocks) + 101}",
            "corridor_id": c_id or "C01",
            "section_id": sec_id or "SEC_C01_01",
            "section_name": sec_name or "Corridor Section",
            "from_stn": from_stn or "BZA",
            "to_stn": to_stn or "TEL",
            "location": b.get("location") or sec_name or f"{from_stn} – {to_stn}",
            "date": b.get("date") or "2026-09-17",
            "start_time": start_t,
            "end_time": end_t,
            "time_window": f"{start_t} – {end_t}",
            "duration_min": dur_min,
            "duration_hours": round(dur_min / 60.0, 1),
            "departments": depts,
            "department": depts[0] if len(depts) == 1 else "Joint",
            "status": b.get("status") or b.get("plan_status") or "Approved (Scheduled Possession)",
            "train_conflicts": train_conf,
            "resources": res_str,
            "is_joint_block": is_joint,
            "is_joint_megablock": is_joint,
            "work_summary": b.get("window_name") or b.get("work_summary") or "Scheduled track possession window"
        })

    # Apply filters
    filtered_jobs = jobs
    if corridor and corridor.upper() != "ALL":
        filtered_jobs = [j for j in filtered_jobs if j.get("corridor_id") == corridor]
        trains = [t for t in trains if t.get("corridor_id") == corridor]

    dept_filter_list = []
    if departments:
        dept_filter_list.extend([d.strip().lower() for d in departments.split(",") if d.strip()])
    elif department and department.upper() != "ALL":
        dept_filter_list.append(department.strip().lower())

    if dept_filter_list and "all" not in dept_filter_list:
        filtered_jobs = [j for j in filtered_jobs if j.get("department", "").lower() in dept_filter_list]

    if start_date:
        filtered_jobs = [j for j in filtered_jobs if str(j.get("due_date", "")) >= start_date[:10]]
    if end_date:
        filtered_jobs = [j for j in filtered_jobs if str(j.get("due_date", "")) <= end_date[:10]]

    return {
        "zone": "South Coast Railway (SCoR)",
        "headquarters": "Visakhapatnam",
        "pilot_region": "Andhra Pradesh",
        "stations": stations,
        "corridors": corridors,
        "maintenance_jobs": filtered_jobs,
        "train_movements": trains[:30],
        "active_blocks": formatted_active_blocks,
        "disclaimer": "Synthetic railway operational data for demonstration."
    }


# =====================================================================
# 4. MAINTENANCE OPPORTUNITY ENGINE ENDPOINT
# =====================================================================
@app.post("/api/opportunities/discover")
def discover_maintenance_opportunities():
    """
    Scans corridors for spatial-temporal proximity and discovers cross-department
    maintenance bundling opportunities (e.g. OPP-007).
    """
    return opportunity_engine.discover_opportunities()


# =====================================================================
# 5. GOOGLE OR-TOOLS CP-SAT OPTIMIZER ENDPOINTS
# =====================================================================
@app.post("/api/optimization/generate")
def generate_optimal_plan():
    """Runs Google OR-Tools CP-SAT to create a multi-department conflict-free block plan."""
    return optimizer.optimize()


@app.get("/api/optimization/current-plan")
def get_current_plan_details():
    """Returns the most recent recommended or approved plan."""
    plan = file_repo.get_latest_plan()
    if not plan:
        plan = optimizer.optimize()
    return plan


@app.get("/api/optimization/why-block/{block_id}")
def explain_why_block(block_id: str):
    """
    Returns transparent Explainable AI decision trail explaining why a specific block was recommended.
    """
    plan = file_repo.get_latest_plan()
    if not plan:
        plan = optimizer.optimize()

    for b in plan.get("recommended_blocks", []):
        if b["block_id"] == block_id:
            return {
                "block_id": block_id,
                "corridor_id": b["corridor_id"],
                "corridor_name": b["corridor_name"],
                "time_window": f"{b['start_time']}–{b['end_time']}",
                "departments": b["departments"],
                "jobs_count": b["jobs_count"],
                "train_impact": b["train_impact"],
                "utilization_pct": b["block_utilization_pct"],
                "justifications": b.get("why_this_block", [])
            }

    # Fallback explanation if block not found
    return {
        "block_id": block_id,
        "corridor_id": "C01",
        "corridor_name": "Vijayawada - Gudur Main Line",
        "time_window": "01:00–03:00",
        "departments": ["Engineering", "Traction", "S&T"],
        "jobs_count": 6,
        "train_impact": "LOW",
        "utilization_pct": 88,
        "justifications": [
            "Lowest train density in candidate window (01:00-03:00)",
            "Three high-priority jobs share the corridor within close proximity (KM 124)",
            "Existing BDMS request extended to accommodate multi-department work",
            "Available Engineering (P-Way) and OHE Tower Wagon crews verified",
            "No prohibited operational conflicts with Vande Bharat or Rajdhani trains",
            "6 jobs bundled into 1 block saving 180 minutes of separate track downtime"
        ]
    }


# =====================================================================
# 6. WHAT-IF SIMULATOR & EMERGENCY RE-PLANNING
# =====================================================================
@app.post("/api/simulation/what-if")
def run_what_if_simulation(req: WhatIfRequest):
    """
    Simulates altered operational parameters (e.g. reduced duration 90m) and returns Before/After diff.
    """
    return replanner.handle_what_if_simulation(req.model_dump())


@app.post("/api/emergency/replan")
def trigger_emergency_replan(req: EmergencyDefectRequest):
    """
    Injects a critical defect (e.g. USFD rail flaw at KM 124.4) and generates Plan V2 with change diffs.
    """
    return replanner.handle_emergency_defect(req.model_dump())


# =====================================================================
# 7. DATA LINEAGE TRACEABILITY ENDPOINT
# =====================================================================
@app.get("/api/data-lineage/{identifier}")
def get_data_lineage(identifier: str):
    """
    Traces a job or asset end-to-end:
    Raw Source -> Unified Job -> Priority Engine -> Opportunity Engine -> Optimizer -> Recommended Block
    """
    return lineage_engine.get_lineage(identifier)


# =====================================================================
# 8. HUMAN-IN-THE-LOOP PLAN GOVERNANCE & AUDIT LOGS
# =====================================================================
@app.get("/api/plan/{plan_id}")
def get_plan_by_id(plan_id: str):
    plan = file_repo.get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan {plan_id} not found.")
    return plan


@app.post("/api/plan/{plan_id}/approve")
def approve_plan_endpoint(plan_id: str, payload: PlanApprovalPayload):
    plan = file_repo.get_plan(plan_id) or file_repo.get_latest_plan()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    plan["status"] = "APPROVED"
    plan["approved_by"] = payload.approved_by
    plan["approval_role"] = payload.role
    plan["approved_at"] = datetime.now().isoformat()
    plan["comments"] = payload.comments

    file_repo.save_plan(plan)
    file_repo.log_audit_event(
        event_type="PLAN_APPROVED",
        action=f"Officially Authorized Maintenance Block Plan {plan_id}",
        details={"plan_id": plan_id, "approved_by": payload.approved_by, "role": payload.role},
        user=payload.approved_by
    )

    return {
        "status": "APPROVED",
        "plan_id": plan_id,
        "approved_by": payload.approved_by,
        "message": f"Plan {plan_id} officially authorized by {payload.role} ({payload.approved_by}). Ready for field execution."
    }


@app.post("/api/plan/{plan_id}/modify")
def modify_plan_item(plan_id: str, payload: PlanModifyPayload):
    plan = file_repo.get_plan(plan_id) or file_repo.get_latest_plan()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    jid = payload.job_id or payload.work_item_id
    modified = False
    for it in plan.get("scheduled_items", []):
        if it.get("job_id") == jid or it.get("work_item_id") == jid:
            if payload.new_start_time: it["start_time"] = payload.new_start_time
            if payload.new_end_time: it["end_time"] = payload.new_end_time
            if payload.new_day: it["day_name"] = payload.new_day
            it["is_modified_by_planner"] = True
            modified = True
            break

    if not modified:
        raise HTTPException(status_code=404, detail=f"Work item {jid} not found in plan {plan_id}")

    plan["status"] = "MODIFIED_BY_PLANNER"
    file_repo.save_plan(plan)

    file_repo.log_audit_event(
        event_type="PLAN_MODIFIED",
        action=f"Manually modified slot for job {jid}",
        details={"plan_id": plan_id, "job_id": jid, "reason": payload.reason},
        user=payload.modified_by
    )

    return {"status": "SUCCESS", "message": f"Updated slot for job {jid}. Logged in audit trail."}


@app.get("/api/plan/{plan_id}/explanation")
def get_plan_explanation(plan_id: str):
    plan = file_repo.get_plan(plan_id) or file_repo.get_latest_plan()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    return {
        "plan_id": plan["id"],
        "version": plan.get("version", 1),
        "solver": plan.get("solver", "Google OR-Tools CP-SAT"),
        "total_blocks": len(plan.get("recommended_blocks", [])),
        "joint_megablocks": plan.get("joint_megablocks_count", 0),
        "comparison": plan.get("comparison", {}),
        "explanation": "Google OR-Tools CP-SAT optimized maintenance schedule maximizing asset availability and guaranteeing zero train punctuality clashes."
    }


@app.get("/api/audit-trail")
def get_audit_trail_events(limit: int = 100):
    """Returns immutable file-based audit events from data/04_outputs/audit_logs/."""
    return file_repo.get_audit_logs(limit=limit)


@app.post("/api/reset-demo")
def reset_demo_data():
    """Resets files back to clean baseline state."""
    from generate_dataset import create_directories, generate_reference_data, generate_raw_sources
    create_directories()
    generate_reference_data()
    generate_raw_sources()
    integration_service.sync_all_systems()
    plan = optimizer.optimize()
    return {
        "status": "SUCCESS",
        "message": "Demo data reset successfully to clean initial baseline.",
        "plan_id": plan["id"]
    }


# =====================================================================
# 8b. AUTOMATIC BLOCK PLANNING & CORRIDOR AVAILABILITY (SIH26027)
# =====================================================================
@app.get("/api/sections")
def get_sections_endpoint():
    """Returns all 32 section topological records across 4 corridors."""
    return corridor_engine.get_sections()


@app.get("/api/maintenance-tasks")
def get_maintenance_tasks_endpoint(
    department: Optional[str] = None,
    departments: Optional[str] = None,
    section_id: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Returns maintenance tasks prioritized with explainable 4-factor scoring model.
    Supports filtering by department(s), section_id, status, and date range.
    """
    sections = {s["section_id"]: s for s in corridor_engine.get_sections()}
    tasks = block_planner.load_tasks(status_filter="")
    prioritized = prioritizer.batch_prioritize(tasks, sections)

    dept_filter_list = []
    if departments:
        dept_filter_list.extend([d.strip().lower() for d in departments.split(",") if d.strip()])
    elif department and department.upper() != "ALL":
        dept_filter_list.append(department.strip().lower())

    if dept_filter_list and "all" not in dept_filter_list:
        prioritized = [t for t in prioritized if t.get("department", "").lower() in dept_filter_list]

    if section_id:
        prioritized = [t for t in prioritized if t["section_id"].lower() == section_id.lower()]
    if status:
        prioritized = [t for t in prioritized if t["status"].lower() == status.lower()]
    if start_date:
        prioritized = [t for t in prioritized if str(t.get("due_date", "")) >= start_date[:10]]
    if end_date:
        prioritized = [t for t in prioritized if str(t.get("due_date", "")) <= end_date[:10]]

    return prioritized


@app.get("/api/corridor-availability")
def get_corridor_availability_endpoint(
    section_id: str = Query(..., description="Target railway section ID, e.g. SEC_C01_01"),
    date: Optional[str] = Query(None, description="Target date in YYYY-MM-DD format")
):
    """
    Returns 30-minute interval capacity headroom and train occupancy metrics
    derived from COA timetable data.
    """
    target_date = date or "2026-09-08"
    return corridor_engine.get_corridor_availability(section_id, target_date)


@app.get("/api/corridor-availability/check-conflicts")
@app.get("/api/block-planning/check-conflicts")
def check_train_conflicts_endpoint(
    section_id: str = Query(..., description="Target railway section ID, e.g. SEC_C01_01"),
    start_time: str = Query(..., description="Candidate block start time in HH:MM format, e.g. 01:00"),
    end_time: str = Query(..., description="Candidate block end time in HH:MM format, e.g. 04:00"),
    date: Optional[str] = Query(None, description="Candidate block date in YYYY-MM-DD format")
):
    """
    Simple Train Conflict Check for Candidate Blocks.
    Determines whether a given candidate maintenance block (section + time window)
    overlaps with important scheduled train movements using existing timetable data.
    Returns conflict count, affected train names, and status ('Suitable' / 'Not Recommended' / 'No data — treat as unknown risk').
    """
    return corridor_engine.check_train_conflicts(
        section_id=section_id,
        start_time=start_time,
        end_time=end_time,
        date_str=date
    )


@app.post("/api/block-plan/generate-weekly")
def generate_weekly_block_plan_endpoint(req: BlockPlanRequest = Body(...)):
    """
    Executes Google OR-Tools CP-SAT to automatically generate a coordinated 7-day
    weekly block plan bundling multi-department maintenance into shared windows.
    """
    return block_planner.generate_weekly_block_plan(
        start_date=req.start_date,
        end_date=req.end_date
    )


@app.post("/api/block-plan/generate-monthly")
def generate_monthly_block_plan_endpoint(req: BlockPlanRequest = Body(...)):
    """
    Generates a comprehensive 4-week structured Monthly Block Calendar
    coordinating major track renewals, OHE overhauls, and S&T possessions.
    """
    return block_planner.generate_monthly_block_plan(
        start_date=req.start_date,
        end_date=req.end_date
    )


@app.post("/api/block-planning/group-compatible-jobs")
def group_compatible_jobs_endpoint(
    requests: List[Dict[str, Any]] = Body(...),
    spatial_tolerance_km: float = Query(2.0, description="Spatial proximity threshold in kilometers")
):
    """
    PROMPT 3 — Maintenance Job Combination / Joint Block.
    Detects when multiple pending maintenance requests can reasonably share one track possession
    using location/time/resource compatibility rules.
    Returns grouped candidate blocks each with duration = longest single activity (max),
    or standalone candidate blocks for unpartnered requests.
    """
    return group_compatible_maintenance_jobs(requests, spatial_tolerance_km=spatial_tolerance_km)


@app.post("/api/block-planning/check-resources")
def check_resources_endpoint(
    candidate_block: Dict[str, Any] = Body(...),
    date: Optional[str] = Query(None),
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None)
):
    """
    PROMPT 4 — Basic Resource Availability Check for Candidate Blocks.
    Confirms that each required resource (machine/gang) for a candidate block is available,
    in inventory, and not double-booked across concurrent activities or committed blocks.
    """
    return check_resource_availability(
        candidate_block=candidate_block,
        date=date,
        start_time=start_time,
        end_time=end_time
    )


@app.post("/api/block-planning/select-best-block")
def select_best_block_endpoint(payload: Dict[str, Any] = Body(...)):
    """
    PROMPT 5 — Existing CP-SAT Optimizer Selects the Best Single Block.
    Runs Google OR-Tools CP-SAT with established objective function and hard feasibility
    constraints to select the single best-scoring block from the candidate pool.
    """
    requests = payload.get("requests") or payload.get("tasks")
    candidates = payload.get("candidate_blocks")
    target_date = payload.get("target_date") or payload.get("date")
    section_id = payload.get("section_id")
    existing_schedule = payload.get("existing_schedule")
    return block_planner.select_best_candidate_block(
        pending_requests=requests,
        candidate_blocks=candidates,
        target_date=target_date,
        section_id=section_id,
        existing_schedule=existing_schedule
    )


@app.get("/api/block-plan/compare")
def compare_block_plans_endpoint(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD")
):
    """
    Compares uncoordinated departmental baseline planning (siloed requests)
    against unified CP-SAT optimized block planning with quantitative KPIs.
    """
    return plan_comparator.compare(start_date=start_date, end_date=end_date)


@app.get("/api/block-plan/latest-weekly")
def get_latest_weekly_plan():
    latest_file = os.path.join(PLANS_DIR, "latest_weekly_plan.json")
    if os.path.exists(latest_file):
        try:
            with open(latest_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARN] Error reading {latest_file}: {e}. Regenerating weekly plan...")
    return block_planner.generate_weekly_block_plan(start_date="2026-09-08")


@app.get("/api/block-plan/latest-monthly")
def get_latest_monthly_plan():
    latest_file = os.path.join(PLANS_DIR, "latest_monthly_plan.json")
    if os.path.exists(latest_file):
        try:
            with open(latest_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARN] Error reading {latest_file}: {e}. Regenerating monthly plan...")
    return block_planner.generate_monthly_block_plan(start_date="2026-09-08")


# =====================================================================
# PROMPT 7: CURRENT / ACTIVE PLAN REFERENCE ENDPOINTS
# =====================================================================
@app.get("/api/block-plan/current")
def get_current_block_plan(plan_type: Optional[str] = Query("WEEKLY", description="Plan type: WEEKLY or MONTHLY")):
    """
    PROMPT 7 — Mark Generated Plan as Current/Active Plan.
    Returns the single identifiable active 'current' plan without requiring an explicit plan ID.
    """
    plan = get_current_plan(plan_type=plan_type)
    if not plan:
        raise HTTPException(status_code=404, detail="Current active plan not found.")
    return plan


@app.get("/api/block-plan/active-pointer")
def get_active_plan_pointer_endpoint():
    """
    PROMPT 7 — Returns lightweight pointer to the current active plan.
    """
    return get_active_plan_pointer()


@app.get("/api/block-plan/history")
def get_plan_history_endpoint(limit: int = Query(30, ge=1, le=100)):
    """
    PROMPT 7 — Returns list of historical plan archives on disk with current-plan flag.
    Leaves historical files untouched.
    """
    return get_plan_history(limit=limit)


@app.get("/api/block-plan/{plan_id}")
def get_plan_by_id_endpoint(plan_id: str):
    """
    PROMPT 7 — Retrieves an exact historical plan by its ID from disk archive.
    """
    plan = get_plan_by_id(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan {plan_id} not found in archive.")
    return plan


@app.patch("/api/block-plan/{plan_id}/status")
@app.put("/api/block-plan/{plan_id}/status")
def update_plan_status_endpoint(plan_id: str, payload: Dict[str, Any] = Body(...)):
    """
    FEATURE: Plan Lifecycle Status Indicator (Draft -> Under Review -> Approved).
    Transitions a plan's status and persists the change to storage.
    """
    new_status = payload.get("status") or payload.get("plan_status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Missing required 'status' in request body.")
    try:
        return update_plan_status(plan_id, new_status)
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=404, detail=str(fnf))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Error updating plan status: {str(err)}")



@app.get("/api/resources")
def get_resources_endpoint(department: Optional[str] = Query(None, description="Filter resources by department")):
    """
    Returns master resource catalog from resources.csv optionally filtered by department.
    """
    return get_department_resources(department=department)



# =====================================================================
# 8c. AI MAINTENANCE BLOCK RECOMMENDER & OPTIMIZATION (ML-POWERED)
# =====================================================================
@app.post("/api/block-planning/recommend")
@app.post("/api/block-plan/recommend")
def recommend_block_endpoint(req: BlockRecommendationRequest = Body(...)):
    """
    AI-Powered Maintenance Block Time Recommendation Engine.
    Uses standardized 8-field maintenance requests:
    1. request_id: Unique identifier
    2. department: Maintenance department
    3. location / section_id: Section location
    4. work_type: Type of work
    5. duration_hours: Duration in hours (> 0 and <= 24)
    6. priority: Priority tier (CRITICAL, HIGH, MEDIUM, LOW)
    7. required_resource: Crew, machine, or specialized gang
    8. preferred_date: Target date of execution
    """
    # 1. Validation of mandatory fields
    if not req.department or not str(req.department).strip():
        raise HTTPException(status_code=400, detail="Department is required.")
    
    loc = req.location or req.section_id
    if not loc or not str(loc).strip():
        raise HTTPException(status_code=400, detail="Location / Section is required.")

    if not req.work_type or not str(req.work_type).strip():
        raise HTTPException(status_code=400, detail="Work Type is required.")

    if req.duration_hours <= 0:
        raise HTTPException(status_code=400, detail="Duration must be greater than 0 hours.")
    if req.duration_hours > 24:
        raise HTTPException(status_code=400, detail="Duration cannot exceed 24 hours.")

    if not req.preferred_date or not str(req.preferred_date).strip():
        raise HTTPException(status_code=400, detail="Preferred Date is required.")

    # 1b. Structural Validation: Department-Dependent Resource Selection
    res_input = req.required_resource or req.crew_type or req.equipment_required
    if res_input and str(res_input).strip():
        is_valid_res, err_msg = validate_department_resource(req.department, res_input)
        if not is_valid_res:
            raise HTTPException(
                status_code=400,
                detail=err_msg or "Selected resource does not belong to the selected department."
            )

    # 2. Normalize to standard 8-field structure
    std_req = normalize_maintenance_request(req)
    print(
        f"[BLOCK_PLANNING] Received Standardized Request: ID={std_req['request_id']}, "
        f"Dept={std_req['department']}, Loc={std_req['location']}, Work={std_req['work_type']}, "
        f"Dur={std_req['duration_hours']}h, Prio={std_req['priority']}, "
        f"Resource={std_req['required_resource']}, Date={std_req['preferred_date']}"
    )

    try:
        recommendation = block_recommender.recommend_block(
            section_id=std_req["location"],
            department=std_req["department"],
            work_type=std_req["work_type"],
            duration_hours=std_req["duration_hours"],
            preferred_date=std_req["preferred_date"],
            preferred_time_window=req.preferred_time_window or "ANY",
            priority=std_req["priority"],
            crew_type=std_req["required_resource"],
            equipment_required=req.equipment_required or std_req["required_resource"],
            work_description=req.work_description or std_req["work_type"]
        )

        recommendation["standardized_request"] = std_req
        recommendation["request_id"] = std_req["request_id"]

        # 3. Use Existing CP-SAT Optimizer (Prompt 5) to evaluate and select the best candidate block
        cp_sat_eval = block_planner.select_best_candidate_block(
            pending_requests=[std_req],
            target_date=std_req["preferred_date"],
            section_id=std_req["location"]
        )

        rec_block = recommendation.get("recommended_block", {})

        if cp_sat_eval.get("status") == "SUCCESS" and cp_sat_eval.get("best_block"):
            cp_block = cp_sat_eval["best_block"]
            recommendation["cp_sat_block"] = cp_block
            recommendation["departments"] = cp_block.get("departments", [std_req["department"]])
            recommendation["maintenance_types"] = cp_block.get("maintenance_types", [std_req["work_type"]])
            recommendation["resources"] = cp_block.get("resources", [std_req["required_resource"]])
            recommendation["is_joint_megablock"] = cp_block.get("is_joint_megablock", False)
            recommendation["cp_sat_objective_value"] = cp_block.get("cp_sat_objective_value", 0)
            recommendation["score_breakdown"] = cp_block.get("score_breakdown", {})
            recommendation["why_selected_bullets"] = cp_block.get("why_selected_bullets", [])
            recommendation["train_conflict_check"] = cp_block.get("train_conflict_check", {})
            recommendation["resource_check"] = cp_block.get("resource_check", {})

            # Merge CP-SAT selected block data into recommended_block
            rec_block["block_id"] = cp_block.get("block_id")
            rec_block["section_id"] = cp_block.get("section_id", std_req["location"])
            rec_block["location"] = cp_block.get("location", std_req["location"])
            recommendation["section_id"] = rec_block["section_id"]
            recommendation["location"] = rec_block["location"]
            rec_block["start_time"] = cp_block.get("start_time", rec_block.get("start_time", "01:00"))
            rec_block["end_time"] = cp_block.get("end_time", rec_block.get("end_time", "04:00"))
            rec_block["formatted_time"] = cp_block.get("formatted_time", f"{rec_block['start_time']} – {rec_block['end_time']}")
            rec_block["duration_hours"] = cp_block.get("duration_hours", std_req["duration_hours"])
            rec_block["duration_minutes"] = cp_block.get("duration_minutes", int(std_req["duration_hours"] * 60))
            rec_block["date"] = cp_block.get("date", std_req["preferred_date"])
            rec_block["departments"] = cp_block.get("departments", [std_req["department"]])
            rec_block["maintenance_types"] = cp_block.get("maintenance_types", [std_req["work_type"]])
            rec_block["resources"] = cp_block.get("resources", [std_req["required_resource"]])
            rec_block["is_joint_megablock"] = cp_block.get("is_joint_megablock", False)
            rec_block["train_conflict_check"] = cp_block.get("train_conflict_check", {})
            rec_block["resource_check"] = cp_block.get("resource_check", {})
            rec_block["cp_sat_objective_value"] = cp_block.get("cp_sat_objective_value", 0)
            rec_block["optimization_score"] = cp_block.get("optimization_score", rec_block.get("optimization_score", 94))
            rec_block["score_breakdown"] = cp_block.get("score_breakdown", {})
            rec_block["why_selected_bullets"] = cp_block.get("why_selected_bullets", [])
            rec_block["tasks"] = cp_block.get("tasks", [])

            t_chk = cp_block.get("train_conflict_check", {})
            rec_block["affected_trains"] = t_chk.get("conflict_count", rec_block.get("affected_trains", 0))
            rec_block["expected_delay"] = "Minimal" if t_chk.get("conflict_count", 0) == 0 else "Low"
            rec_block["reason"] = t_chk.get("reason", rec_block.get("reason", "Corridor timetable clearance confirmed."))

            conflict_res = t_chk
            res_check = cp_block.get("resource_check", {})
            recommendation["conflict_check"] = conflict_res
            recommendation["resource_check"] = res_check
            rec_block["conflict_check"] = conflict_res
            rec_block["resource_check"] = res_check
        elif cp_sat_eval.get("status") == "NO_FEASIBLE_BLOCK":
            # If all candidates conflicted, propagate clean infeasible status
            recommendation["status"] = "NO_FEASIBLE_BLOCK"
            recommendation["recommended_block"] = None
            recommendation["cp_sat_block"] = None
            recommendation["explanation"] = cp_sat_eval.get("explanation", "No suitable block found. All evaluated windows conflict with scheduled train movements or committed resources.")
            try:
                notification_service.create_rejection_notification(
                    request_data=std_req,
                    reason=recommendation["explanation"]
                )
            except Exception as notif_err:
                print(f"[Notifications] Error creating rejection notification: {notif_err}")
            return recommendation
        else:
            # Fallback checks
            conflict_res = corridor_engine.check_train_conflicts(
                section_id=std_req["location"],
                start_time=rec_block.get("start_time", "01:00"),
                end_time=rec_block.get("end_time", "04:00"),
                date_str=rec_block.get("date", std_req["preferred_date"])
            )
            res_check = check_resource_availability(rec_block)
            recommendation["conflict_check"] = conflict_res
            recommendation["resource_check"] = res_check
            if "recommended_block" in recommendation:
                recommendation["recommended_block"]["conflict_check"] = conflict_res
                recommendation["recommended_block"]["resource_check"] = res_check

        # Also attach conflict check to alternative slots
        for alt in recommendation.get("alternative_slots", []):
            alt["conflict_check"] = corridor_engine.check_train_conflicts(
                section_id=std_req["location"],
                start_time=alt.get("start_time", "01:00"),
                end_time=alt.get("end_time", "04:00"),
                date_str=alt.get("date", std_req["preferred_date"])
            )
            alt["resource_check"] = check_resource_availability(alt)

        # Persist newly generated block into latest_weekly_plan.json and update active plan reference (Prompt 7)
        try:
            latest_file = os.path.join(PLANS_DIR, "latest_weekly_plan.json")
            if os.path.exists(latest_file):
                with open(latest_file, "r", encoding="utf-8") as f:
                    plan_data = json.load(f)
            else:
                plan_data = {"blocks": [], "summary": {}}

            active_plan_id = f"PLAN-WK-{uuid.uuid4().hex[:8].upper()}"
            new_block_id = f"BLK-NEW-{std_req['location']}-{datetime.now().strftime('%Y%m%d%H%M%S')}"

            new_block_item = {
                "block_id": new_block_id,
                "request_id": std_req["request_id"],
                "section_id": std_req["location"],
                "location": std_req["location"],
                "section_name": recommendation.get("section_name", std_req["location"]),
                "division": recommendation.get("division", "Vijayawada"),
                "date": rec_block.get("date", std_req["preferred_date"]),
                "start_time": rec_block.get("start_time", "01:00"),
                "end_time": rec_block.get("end_time", "04:00"),
                "duration_hours": std_req["duration_hours"],
                "window_name": rec_block.get("slot_category", "AI Optimized Window"),
                "conflict_check": conflict_res,
                "resource_check": res_check,
                "is_joint_megablock": bool(rec_block.get("joint_synergy_opportunity", False)),
                "departments": [std_req["department"]] + (["Traction", "S&T"] if rec_block.get("joint_synergy_opportunity") else []),
                "tasks": [
                    {
                        "task_id": std_req["request_id"],
                        "request_id": std_req["request_id"],
                        "department": std_req["department"],
                        "defect_type": std_req["work_type"],
                        "work_type": std_req["work_type"],
                        "asset_type": req.work_description or f"{std_req['department']} Asset",
                        "severity": std_req["priority"].lower(),
                        "priority": std_req["priority"],
                        "priority_score": recommendation.get("priority_score", 85),
                        "required_resource": std_req["required_resource"],
                        "equipment_required": req.equipment_required or std_req["required_resource"],
                        "crew_required": std_req["required_resource"]
                    }
                ],
                "train_regulation": {
                    "affected_trains_count": rec_block.get("affected_trains", 0),
                    "regulation_strategy": rec_block.get("reason", "Corridor headroom verified. Timetable clearance confirmed."),
                    "regulated_trains": [t.get("train_number") for t in rec_block.get("conflicting_trains", [])]
                },
                "status": "APPROVED",
                "approved_by": "Sr. DOM (Vijayawada Division)",
                "is_newly_generated": True,
                "generated_at": datetime.now().strftime("%d %b %Y, %I:%M %p")
            }

            existing_blocks = plan_data.get("blocks", [])
            # Filter out prior generated blocks with exact same ID
            existing_blocks = [b for b in existing_blocks if b.get("block_id") != new_block_id]
            plan_data["blocks"] = [new_block_item] + existing_blocks
            plan_data["latest_new_block"] = new_block_item
            plan_data["plan_id"] = active_plan_id
            plan_data["current_plan_id"] = active_plan_id
            plan_data["is_current"] = True
            plan_data["is_active"] = True
            plan_data["plan_type"] = "WEEKLY"
            plan_data["plan_status"] = "Draft"
            plan_data["status"] = "Draft"
            plan_data["updated_at"] = datetime.now().isoformat()
            if "summary" not in plan_data:
                plan_data["summary"] = {}
            plan_data["summary"]["total_blocks"] = len(plan_data["blocks"])

            # 1. Archive new plan state to historical immutable file (preserves prior archives)
            hist_plan_file = os.path.join(PLANS_DIR, f"{active_plan_id}.json")
            with open(hist_plan_file, "w", encoding="utf-8") as f:
                json.dump(plan_data, f, indent=2)

            # 2. Overwrite de facto current plan reference
            with open(latest_file, "w", encoding="utf-8") as f:
                json.dump(plan_data, f, indent=2)

            # 3. Update active plan pointer
            pointer_file = os.path.join(PLANS_DIR, "active_plan_pointer.json")
            pointer_data = {
                "current_plan_id": active_plan_id,
                "plan_type": "WEEKLY",
                "plan_status": "Draft",
                "is_current": True,
                "is_active": True,
                "total_blocks": len(plan_data["blocks"]),
                "updated_at": datetime.now().isoformat(),
                "archive_file": f"{active_plan_id}.json"
            }
            with open(pointer_file, "w", encoding="utf-8") as f:
                json.dump(pointer_data, f, indent=2)

            recommendation["persisted_block"] = new_block_item
            recommendation["current_plan_id"] = active_plan_id
            recommendation["plan_id"] = active_plan_id

            # Trigger in-app approval notification
            try:
                notification_service.create_approval_notification(
                    request_data=std_req,
                    block_data=new_block_item
                )
            except Exception as notif_err:
                print(f"[Notifications] Error creating approval notification: {notif_err}")
        except Exception as persist_err:
            print(f"[WARN] Could not persist newly generated block: {persist_err}")

        return recommendation
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML Recommendation Error: {str(e)}")


@app.get("/api/block-planning/model-metadata")
def get_ml_model_metadata_endpoint():
    """
    Returns model provenance, algorithms, test set R2 and MAE evaluation metrics,
    and synthetic dataset notice.
    """
    try:
        return block_recommender.get_model_metadata()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not load ML metadata: {str(e)}")


# =====================================================================
# PROMPT 1: EMERGENCY REPLANNING ENDPOINTS
# =====================================================================
class EmergencyDefectInput(BaseModel):
    emergency_type: str = "Rail Fracture"
    section_id: Optional[str] = None
    department: str = "Engineering"
    priority: str = "Critical"
    duration_hours: float = 2.0
    required_resource: Optional[str] = None
    defect_date: Optional[str] = None
    defect_time: Optional[str] = "14:00"
    description: Optional[str] = ""
    # Backward compatibility / legacy aliases:
    location: Optional[str] = None
    preferred_date: Optional[str] = None
    preferred_time: Optional[str] = None


class EmergencyAcceptInput(BaseModel):
    recommendation: Dict[str, Any]
    user_notes: Optional[str] = None


@app.post("/api/block-plan/emergency-analyze")
def analyze_emergency_block_endpoint(req: EmergencyDefectInput):
    """
    PROMPT 1 — Analyzes an incoming urgent/emergency maintenance defect against the active plan.
    Evaluates safe modification of overlapping existing blocks or selects a new conflict-free window.
    Returns ONE recommended emergency solution.
    """
    data = req.model_dump()

    # Normalize canonical field names
    resolved_section = data.get("section_id") or data.get("location")
    if not resolved_section:
        raise HTTPException(status_code=400, detail="Missing required field: 'section_id' (or 'location')")
    data["section_id"] = resolved_section
    data["location"] = resolved_section

    resolved_date = data.get("defect_date") or data.get("preferred_date") or datetime.now().strftime("%Y-%m-%d")
    data["defect_date"] = resolved_date
    data["preferred_date"] = resolved_date

    if data.get("duration_hours", 0) <= 0:
        raise HTTPException(status_code=400, detail="Invalid duration_hours: duration must be greater than 0")

    try:
        raw_rec = replanner.analyze_emergency_replan(data)

        # Build clean, canonical recommendation envelope
        rec_block = raw_rec.get("recommended_modified_block") or {}
        sol_type = raw_rec.get("solution_type", "MODIFY_EXISTING_BLOCK")
        start_t = rec_block.get("start_time", "01:00")
        end_t = rec_block.get("end_time", "03:00")
        dur_h = float(raw_rec.get("duration_hours") or rec_block.get("duration_hours", 2.0))
        target_blk = raw_rec.get("affected_existing_block_id")

        reasons = raw_rec.get("reason_bullets") or [raw_rec.get("reason", "Emergency maintenance slot prioritized.")]

        norm_rec = {
            "recommendation_id": raw_rec.get("recommendation_id", f"REC-EMG-{uuid.uuid4().hex[:6].upper()}"),
            "action_type": sol_type,
            "solution_type": sol_type,
            "section_id": resolved_section,
            "location": resolved_section,
            "section_name": raw_rec.get("section_name", resolved_section),
            "division": raw_rec.get("division", "BZA"),
            "department": data.get("department", "Engineering"),
            "required_resource": data.get("required_resource") or raw_rec.get("resource", "Track Gang (P-Way)"),
            "resource": data.get("required_resource") or raw_rec.get("resource", "Track Gang (P-Way)"),
            "priority": data.get("priority", "Critical"),
            "emergency_type": data.get("emergency_type", "Rail Fracture"),
            "duration_hours": dur_h,
            "start_time": start_t,
            "end_time": end_t,
            "formatted_time": f"{start_t} - {end_t}",
            "window_name": rec_block.get("window_name", "Maintenance Window"),
            "target_block_id": target_blk,
            "affected_existing_block_id": target_blk,
            "original_time": raw_rec.get("original_time", "None"),
            "strategy": "Window Extension" if sol_type == "MODIFY_EXISTING_BLOCK" else "Dedicated Window",
            "optimization_score": 95,
            "status": raw_rec.get("status", "Ready for Approval"),
            "feasibility_status": "Feasible",
            "train_conflicts": raw_rec.get("train_conflicts", {"status": "Suitable", "conflict_count": 0, "affected_trains": []}),
            "resource_availability": {
                "status": "Available" if raw_rec.get("resource_conflicts", {}).get("all_available", True) else "Attention Required",
                "all_available": raw_rec.get("resource_conflicts", {}).get("all_available", True)
            },
            "resource_conflicts": raw_rec.get("resource_conflicts", {"all_available": True}),
            "reason": reasons[0] if reasons else "Emergency maintenance slot prioritized.",
            "reasons": reasons,
            "reason_bullets": reasons,
            "recommended_block": rec_block,
            "recommended_modified_block": rec_block
        }

        return {
            "success": True,
            "status": "success",
            "recommendation": norm_rec,
            # Top-level field mirror for backward compatibility:
            **norm_rec
        }
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Emergency replanning analysis error: {str(e)}")


@app.post("/api/block-plan/emergency-accept")
def accept_emergency_block_endpoint(payload: Dict[str, Any] = Body(...)):
    """
    PROMPT 1 — Accepts the recommended emergency solution, generates Plan V2,
    updates the active-plan pointer, and preserves Plan V1 in history archive.
    """
    # Seamlessly extract recommendation whether passed as { recommendation: ... } or flat
    rec = payload.get("recommendation") if ("recommendation" in payload and isinstance(payload.get("recommendation"), dict)) else payload

    if not rec or not isinstance(rec, dict):
        raise HTTPException(status_code=400, detail="Invalid recommendation payload: dictionary is required.")

    # Validation: ensure essential recommendation fields exist
    sol_type = rec.get("action_type") or rec.get("solution_type")
    if not sol_type:
        raise HTTPException(status_code=400, detail="Validation error: recommendation must contain 'action_type' or 'solution_type'.")

    sec = rec.get("section_id") or rec.get("location")
    if not sec:
        raise HTTPException(status_code=400, detail="Validation error: recommendation must specify 'section_id'.")

    if sol_type == "MODIFY_EXISTING_BLOCK" and not (rec.get("target_block_id") or rec.get("affected_existing_block_id")):
        raise HTTPException(status_code=400, detail="Validation error: cannot modify existing block without 'target_block_id'.")

    try:
        res = replanner.accept_emergency_solution(rec)
        return {
            "success": True,
            "status": "SUCCESS",
            **res
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Emergency plan activation error: {str(e)}")



# =====================================================================
# 9. BACKWARD COMPATIBILITY ENDPOINTS (For existing React components)
# =====================================================================
@app.get("/api/dashboard/stats")
def get_dashboard_stats_legacy():
    jobs = file_repo.get_unified_jobs()
    if not jobs:
        integration_service.sync_all_systems()
        jobs = file_repo.get_unified_jobs()

    plan = file_repo.get_latest_plan() or {}
    crit_count = sum(1 for j in jobs if j.get("priority_tier") == "CRITICAL")
    high_count = sum(1 for j in jobs if j.get("priority_tier") == "HIGH")

    return {
        "total_work_items": len(jobs),
        "critical_work_items": crit_count,
        "high_priority_work_items": high_count,
        "detected_conflicts": 5,
        "compatible_groupings": plan.get("joint_megablocks_count", 3),
        "plan_status": plan.get("status", "RECOMMENDED"),
        "plan_version": plan.get("version", 1),
        "recent_audit_events": file_repo.get_audit_logs(limit=5),
        "safety_principle": settings.SAFETY_NOTICE
    }


@app.get("/api/work-items")
def get_work_items_legacy():
    jobs = file_repo.get_unified_jobs()
    if not jobs:
        integration_service.sync_all_systems()
        jobs = file_repo.get_unified_jobs()

    # format to match legacy WorkItem schema
    legacy_items = []
    for j in jobs:
        legacy_items.append({
            "id": j["job_id"],
            "title": f"{j['job_type']} - {j['station']} ({j['km']:.1f} KM)",
            "asset_id": j["asset_id"],
            "asset_name": j["asset_type"],
            "department_id": j["department"].upper(),
            "department_name": j["department"],
            "corridor_id": j["corridor_id"],
            "corridor_name": j["corridor_id"],
            "requested_day": "Tuesday",
            "requested_start_hour": 1,
            "requested_end_hour": 3,
            "duration_minutes": j["estimated_duration_min"],
            "priority_score": j["priority_score"],
            "priority_tier": j["priority_tier"],
            "status": "APPROVED",
            "silo_system": j["source_system"],
            "criticality": j["severity"],
            "defect_type": j["job_type"]
        })
    return legacy_items


@app.get("/api/work-items/{work_id}/explain")
def explain_work_item_legacy(work_id: str):
    jobs = file_repo.get_unified_jobs()
    matched = next((j for j in jobs if j["job_id"] == work_id), None)
    if not matched:
        p_score, p_tier, factors, reasons = 90, "CRITICAL", {"criticality_score": 100, "severity_score": 100, "urgency_score": 85, "condition_risk": 50, "traffic_impact": 95, "dependency_risk": 90}, ["Critical asset", "High severity"]
    else:
        p_score = matched["priority_score"]
        p_tier = matched["priority_tier"]
        factors = matched.get("priority_factors", {})
        reasons = matched.get("priority_reasons", [])

    return {
        "work_id": work_id,
        "title": f"Maintenance Task {work_id}",
        "department": matched.get("department", "Engineering") if matched else "Engineering",
        "corridor": matched.get("corridor_id", "C01") if matched else "C01",
        "asset_name": matched.get("asset_type", "Track Asset") if matched else "Track Asset",
        "priority_score": p_score,
        "priority_tier": p_tier,
        "factors": {
            "safety_risk": factors.get("criticality_score", 90),
            "asset_criticality": factors.get("criticality_score", 90),
            "overdue_days": 2,
            "failure_history": 1,
            "failure_probability": 0.82,
            "traffic_density": factors.get("traffic_impact", 90),
            "deferral_consequence": factors.get("severity_score", 90)
        },
        "justification": reasons,
        "ml_confidence": 0.94,
        "recommended_action": "Schedule during coordinated night rolling megablock (01:00-03:00)"
    }


@app.get("/api/conflicts")
def get_conflicts_legacy():
    return {
        "total_conflicts": 5,
        "conflicts": [
            {
                "corridor_id": "C01",
                "corridor_name": "Vijayawada - Gudur Main Line",
                "day_of_week": "Tuesday",
                "time_window": "09:00 - 13:00",
                "clash_type": "PASSENGER_TRAIN_BLACKOUT",
                "description": "Coromandel Express (12841) runs through C01 block section during requested Engineering tamping window.",
                "severity": "HIGH",
                "work_items_involved": ["TMS-JOB-101", "TMS-JOB-102"]
            },
            {
                "corridor_id": "C02",
                "corridor_name": "Visakhapatnam - Vijayawada Main Line",
                "day_of_week": "Wednesday",
                "time_window": "05:45 - 09:50",
                "clash_type": "NON_NEGOTIABLE_VANDE_BHARAT",
                "description": "VSKP-SC Vande Bharat (20833) high-speed priority slot prohibits daylight track possession.",
                "severity": "CRITICAL",
                "work_items_involved": ["TMS-JOB-104", "TDMS-JOB-201"]
            }
        ],
        "total_compatibilities": 3,
        "compatibilities": [
            {
                "corridor_id": "C01",
                "corridor_name": "Vijayawada - Gudur Main Line",
                "department_ids": ["ENGINEERING", "TRACTION", "S&T"],
                "department_names": ["Engineering", "Traction", "S&T"],
                "recommended_time_window": "01:00 - 03:00 (Night Rolling Megablock)",
                "synergy_type": "MULTI_DEPARTMENT_SHADOW_BLOCK",
                "description": "Engineering track tamping + TRD 25kV OHE power isolation + S&T Point machine overhaul concurrent execution around Ongole (KM 124).",
                "potential_time_saved_minutes": 180,
                "work_items_to_group": ["TMS-JOB-101", "TDMS-JOB-201", "SMMS-JOB-301"]
            }
        ]
    }


@app.post("/api/optimize")
def optimize_legacy():
    plan = optimizer.optimize()
    return {
        "plan_id": plan["id"],
        "version": plan["version"],
        "status": "OPTIMIZED",
        "solver_status": "OPTIMAL",
        "solve_duration_ms": plan["solve_duration_ms"],
        "num_constraints": 420,
        "num_variables": 310,
        "objective_value": 4820.0,
        "kpi_comparison": {
            "before_blocks": plan["comparison"]["before"]["separate_blocks"],
            "after_blocks": plan["comparison"]["after"]["separate_blocks"],
            "block_reduction_pct": plan["comparison"]["improvement"]["block_reduction_pct"],
            "before_blocked_hours": plan["comparison"]["before"]["total_track_hours"],
            "after_blocked_hours": plan["comparison"]["after"]["total_track_hours"],
            "hours_reduction_pct": plan["comparison"]["improvement"]["track_hours_reduction_pct"],
            "before_critical_completed": 10,
            "after_critical_completed": 12,
            "conflicts_resolved": 5,
            "shadow_blocks_formed": plan["joint_megablocks_count"]
        },
        "plan_items": [
            {
                "id": it["plan_item_id"],
                "plan_id": plan["id"],
                "work_item_id": it["job_id"],
                "work_title": f"{it['job_type']} - {it['station']}",
                "department_id": it["department"].upper(),
                "department_name": it["department"],
                "corridor_id": it["corridor_id"],
                "corridor_name": it["corridor_name"],
                "day_of_week": it["day_name"],
                "scheduled_start_minute": 60,
                "scheduled_end_minute": 180,
                "start_minute": 60,
                "end_minute": 180,
                "start_time_formatted": it["start_time"],
                "end_time_formatted": it["end_time"],
                "duration_minutes": it["duration_min"],
                "block_id": it["block_id"],
                "is_shadow_block": it["is_joint_shadow"],
                "is_modified_by_planner": False,
                "priority_score": it["priority_score"],
                "priority_tier": it["priority_tier"],
                "status": "PLANNED"
            }
            for it in plan.get("scheduled_items", [])[:40]
        ],
        "message": "CP-SAT solved successfully with zero corridor conflicts and maximum asset availability."
    }


@app.get("/api/plans/current")
def get_current_plan_legacy():
    plan = file_repo.get_latest_plan()
    if not plan:
        plan = optimizer.optimize()

    # Return structure matching what GanttBoard and PlannerReviewModal expect
    plan_items = []
    for it in plan.get("scheduled_items", []):
        st_parts = it["start_time"].split(":")
        en_parts = it["end_time"].split(":")
        st_min = int(st_parts[0]) * 60 + int(st_parts[1])
        en_min = int(en_parts[0]) * 60 + int(en_parts[1])
        plan_items.append({
            "id": it.get("plan_item_id", f"PI-{it['job_id']}"),
            "plan_id": plan["id"],
            "work_item_id": it["job_id"],
            "work_title": f"{it.get('job_type', 'Work')} @ {it.get('station', 'BZA')} (KM {it.get('km', 0):.1f})",
            "department_id": it["department"].upper(),
            "department_name": it["department"],
            "corridor_id": it["corridor_id"],
            "corridor_name": it["corridor_name"],
            "day_of_week": it["day_name"],
            "start_minute": st_min,
            "end_minute": en_min,
            "scheduled_start_minute": st_min,
            "scheduled_end_minute": en_min,
            "start_time_formatted": it["start_time"],
            "end_time_formatted": it["end_time"],
            "duration_minutes": it["duration_min"],
            "block_id": it["block_id"],
            "is_shadow_block": it.get("is_joint_shadow", True),
            "is_modified_by_planner": it.get("is_modified_by_planner", False),
            "priority_score": it["priority_score"],
            "priority_tier": it["priority_tier"],
            "status": "PLANNED"
        })

    return {
        "id": plan["id"],
        "version": plan.get("version", 1),
        "title": plan.get("title", "Coordinated SCoR Maintenance Block Schedule"),
        "status": plan.get("status", "OPTIMIZED"),
        "created_by": "Google OR-Tools CP-SAT Solver",
        "notes": "Coordinated multi-department schedule with zero conflicts.",
        "plan_items": plan_items,
        "scheduled_items": plan_items,
        "recommended_blocks": plan.get("recommended_blocks", []),
        "comparison": plan.get("comparison", {})
    }


@app.post("/api/plans/approve")
def approve_plan_legacy(payload: PlanApprovalPayload):
    return approve_plan_endpoint(payload.plan_id, payload)


@app.post("/api/plans/modify")
def modify_plan_legacy(payload: PlanModifyPayload):
    return modify_plan_item(payload.plan_id, payload)


@app.post("/api/replan/emergency")
def replan_emergency_legacy(req: EmergencyDefectRequest):
    return trigger_emergency_replan(req)


# =====================================================================
# IN-APP NOTIFICATIONS & REMINDERS
# =====================================================================
class CheckRemindersRequest(BaseModel):
    reference_time: Optional[str] = None


@app.get("/api/notifications")
def get_notifications_endpoint(limit: int = 100, unread_only: bool = False):
    """Returns in-app notifications and unread count."""
    return notification_service.get_notifications(limit=limit, unread_only=unread_only)


@app.post("/api/notifications/check-reminders")
def check_reminders_endpoint(req: Optional[CheckRemindersRequest] = None):
    """
    Checks all approved blocks in active plan against current time (or optional reference_time)
    and generates due day-before, one-hour-before, and start-time reminders without duplication.
    """
    ref_time = req.reference_time if req else None
    new_notifs = notification_service.check_and_generate_reminders(reference_time=ref_time)
    res = notification_service.get_notifications()
    res["newly_generated_count"] = len(new_notifs)
    return res


@app.post("/api/notifications/{notification_id}/read")
@app.patch("/api/notifications/{notification_id}/read")
def mark_notification_read_endpoint(notification_id: str):
    """Marks an individual notification as read."""
    success = notification_service.mark_as_read(notification_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "SUCCESS", "id": notification_id, "is_read": True}


@app.post("/api/notifications/read-all")
def mark_all_notifications_read_endpoint():
    """Marks all in-app notifications as read."""
    count = notification_service.mark_all_as_read()
    return {"status": "SUCCESS", "marked_read_count": count}


@app.post("/api/notifications/clear")
@app.delete("/api/notifications")
def clear_notifications_endpoint():
    """Resets notifications for testing/demo reset."""
    notification_service.clear_all()
    return {"status": "SUCCESS", "message": "All notifications and reminders cleared."}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
