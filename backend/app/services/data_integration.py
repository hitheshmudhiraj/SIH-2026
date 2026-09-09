"""
Data Integration Hub & Normalization Service
Integrates TMS, SMMS, TDMS, COA, and BDMS CSV/JSON files.
Validates schemas, normalizes fields, detects duplicates, evaluates data quality,
and produces unified maintenance jobs.
"""
import os
import re
import uuid
from typing import Dict, Any, List, Tuple, Optional, Set
from datetime import datetime
from difflib import SequenceMatcher
from app.services.file_repository import file_repo
from app.services.priority_engine import priority_engine
from app.services.asset_registry import asset_registry_service
from app.services.conflict_resolver import conflict_resolver

# =====================================================================
# DEDUPLICATION & COLLISION HANDLING CONFIGURABLE TOLERANCES
# =====================================================================
DEDUP_SPATIAL_TOLERANCE_KM: float = 0.100       # 100m default spatial tolerance
DEDUP_EXACT_DATE_WINDOW_DAYS: int = 1          # Overlapping date window (days) for exact match
DEDUP_NEAR_DATE_WINDOW_DAYS: int = 2           # Adjacent date window (days) for near-match
DEDUP_JOB_TYPE_SIMILARITY_THRESHOLD: float = 0.60  # Minimum similarity ratio to flag probable duplicates

# Recency priority for resolving duplicate conflicts: higher number = more recent / higher precedence.
# TMS (Track Management System / P-Way) is considered primary source of truth, followed by SMMS, then TDMS.
SOURCE_SYSTEM_RECENCY_ORDER: Dict[str, int] = {
    "TMS": 3,
    "SMMS": 2,
    "TDMS": 1,
    "COA": 0,
    "BDMS": 0
}

def compute_job_type_similarity(type1: str, type2: str) -> float:
    """
    Computes a normalized similarity score [0.0 - 1.0] between two job type strings.
    Handles underscores, hyphens, spacing, and abbreviations.
    """
    t1 = str(type1 or "").strip().upper().replace("-", "_")
    t2 = str(type2 or "").strip().upper().replace("-", "_")
    if not t1 or not t2:
        return 0.0
    if t1 == t2:
        return 1.0

    tokens1 = set(filter(None, t1.split("_")))
    tokens2 = set(filter(None, t2.split("_")))
    if not tokens1 or not tokens2:
        return 0.0

    jaccard = len(tokens1 & tokens2) / len(tokens1 | tokens2)
    seq_ratio = SequenceMatcher(None, t1, t2).ratio()
    return max(jaccard, seq_ratio)

def parse_date_safe(date_str: str) -> datetime:
    """
    Safely parses a date string into a datetime object. Defaults to today's date if invalid.
    """
    try:
        return datetime.strptime(str(date_str)[:10], "%Y-%m-%d")
    except Exception:
        return datetime.now()

class DataIntegrationService:
    DEPARTMENT_MAPPING = {
        "engineering": "Engineering",
        "civil_engg": "Engineering",
        "p-way": "Engineering",
        "civil": "Engineering",
        "track": "Engineering",
        "traction": "Traction",
        "trd": "Traction",
        "electrical": "Traction",
        "ohe": "Traction",
        "s&t": "S&T",
        "signals": "S&T",
        "telecom": "S&T",
        "signal": "S&T"
    }

    SEVERITY_MAPPING = {
        "critical": "CRITICAL",
        "crit": "CRITICAL",
        "high": "HIGH",
        "medium": "MEDIUM",
        "med": "MEDIUM",
        "low": "LOW",
        "routine": "LOW"
    }

    VALID_CORRIDORS = {"C01", "C02", "C03", "C04"}
    VALID_SOURCES = {"TMS", "SMMS", "TDMS", "COA", "BDMS"}

    def get_system_status(self) -> Dict[str, Any]:
        """
        Calculates dynamic card stats from actual raw CSV files.
        """
        # Read raw sources
        tms_assets = file_repo.get_raw_tms_assets()
        tms_maint = file_repo.get_raw_tms_maintenance()
        smms_assets = file_repo.get_raw_smms_assets()
        smms_maint = file_repo.get_raw_smms_maintenance()
        tdms_assets = file_repo.get_raw_tdms_assets()
        tdms_maint = file_repo.get_raw_tdms_maintenance()
        coa_trains = file_repo.get_raw_coa_trains()
        bdms_reqs = file_repo.get_raw_bdms_requests()

        sync_meta = file_repo.get_sync_result()
        last_sync = sync_meta.get("last_sync_timestamp", "Not Synchronized")

        # Quick validation counts per system
        def count_valid(records, req_keys):
            v = 0
            for r in records:
                if all(r.get(k) for k in req_keys):
                    v += 1
            return v

        tms_total = len(tms_maint)
        tms_valid = count_valid(tms_maint, ["job_id", "asset_id", "corridor_id", "km"])

        smms_total = len(smms_maint)
        smms_valid = count_valid(smms_maint, ["job_id", "asset_id", "corridor_id", "km"])

        tdms_total = len(tdms_maint)
        tdms_valid = count_valid(tdms_maint, ["job_id", "asset_id", "corridor_id", "km"])

        coa_total = len(coa_trains)
        coa_valid = count_valid(coa_trains, ["train_id", "corridor_id", "entry_time", "exit_time"])

        bdms_total = len(bdms_reqs)
        bdms_valid = count_valid(bdms_reqs, ["block_request_id", "corridor_id", "requested_duration_min"])

        return {
            "systems": [
                {
                    "source_system": "TMS",
                    "full_name": "Track Management System",
                    "department": "Engineering (P-Way)",
                    "adapter_type": "CSV File / P-Way REST Ingestion",
                    "file_path": "data/01_raw_sources/TMS/tms_maintenance.csv",
                    "total_records": tms_total,
                    "valid_records": tms_valid,
                    "status": "CONNECTED",
                    "last_sync": last_sync,
                    "validation_rate_pct": round((tms_valid / max(1, tms_total)) * 100, 1),
                    "assets_count": len(tms_assets)
                },
                {
                    "source_system": "SMMS",
                    "full_name": "Signalling & Telecom Maintenance System",
                    "department": "S&T (Signals & Telecom)",
                    "adapter_type": "CSV File / S&T Relay Room Telemetry",
                    "file_path": "data/01_raw_sources/SMMS/smms_maintenance.csv",
                    "total_records": smms_total,
                    "valid_records": smms_valid,
                    "status": "CONNECTED",
                    "last_sync": last_sync,
                    "validation_rate_pct": round((smms_valid / max(1, smms_total)) * 100, 1),
                    "assets_count": len(smms_assets)
                },
                {
                    "source_system": "TDMS",
                    "full_name": "Traction Distribution Management System",
                    "department": "Traction (TRD / 25kV OHE)",
                    "adapter_type": "CSV File / SCADA Traction Ingestion",
                    "file_path": "data/01_raw_sources/TDMS/tdms_maintenance.csv",
                    "total_records": tdms_total,
                    "valid_records": tdms_valid,
                    "status": "CONNECTED",
                    "last_sync": last_sync,
                    "validation_rate_pct": round((tdms_valid / max(1, tdms_total)) * 100, 1),
                    "assets_count": len(tdms_assets)
                },
                {
                    "source_system": "COA",
                    "full_name": "Control Office Application",
                    "department": "Train Operations / Section Controllers",
                    "adapter_type": "CSV File / Timetable Feeds",
                    "file_path": "data/01_raw_sources/COA/coa_train_movements.csv",
                    "total_records": coa_total,
                    "valid_records": coa_valid,
                    "status": "CONNECTED",
                    "last_sync": last_sync,
                    "validation_rate_pct": round((coa_valid / max(1, coa_total)) * 100, 1),
                    "trains_count": coa_total
                },
                {
                    "source_system": "BDMS",
                    "full_name": "Block Demand Management System",
                    "department": "All Field Units (Block Requisitions)",
                    "adapter_type": "CSV File / Field e-Requisition Desk",
                    "file_path": "data/01_raw_sources/BDMS/bdms_block_requests.csv",
                    "total_records": bdms_total,
                    "valid_records": bdms_valid,
                    "status": "CONNECTED",
                    "last_sync": last_sync,
                    "validation_rate_pct": round((bdms_valid / max(1, bdms_total)) * 100, 1),
                    "requests_count": bdms_total
                }
            ],
            "total_records_ingested": tms_total + smms_total + tdms_total + coa_total + bdms_total,
            "total_assets_tracked": len(tms_assets) + len(smms_assets) + len(tdms_assets),
            "canonical_assets_count": len(file_repo.get_asset_master_registry()),
            "last_sync": last_sync,
            "data_quality_score": sync_meta.get("data_quality_score", 96.8)
        }



    def deduplicate_jobs(
        self,
        candidate_jobs: List[Dict[str, Any]],
        sync_timestamp: str
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Applies explicit two-tier deduplication logic:
        1. Exact Match Rule:
           Two records with the same canonical asset_id (via Asset Master Registry),
           identical normalized job_type, and overlapping date window
           (<= DEDUP_EXACT_DATE_WINDOW_DAYS). Keeps record from the most recently
           synced source system (per SOURCE_SYSTEM_RECENCY_ORDER); drops the other,
           tags survivor with 'duplicate_dropped:<source>', and logs dropped details.
        2. Near-Match Rule:
           Two records with different/missing asset_id but same corridor_id,
           spatial km within tolerance (<= DEDUP_SPATIAL_TOLERANCE_KM), adjacent
           date window (<= DEDUP_NEAR_DATE_WINDOW_DAYS), and similar job_type
           (similarity >= DEDUP_JOB_TYPE_SIMILARITY_THRESHOLD).
           Flags both with 'probable_duplicate:flagged' and enqueues in
           dedup_review_queue without dropping either.

        Returns:
            (surviving_jobs, exact_duplicates_dropped, dedup_review_queue)
        """
        exact_duplicates_dropped: List[Dict[str, Any]] = []
        dedup_review_queue: List[Dict[str, Any]] = []

        # --- Phase 1: Exact Match Deduplication ---
        asset_job_groups: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
        no_canonical_asset_jobs: List[Dict[str, Any]] = []

        for job in candidate_jobs:
            c_aid = job.get("canonical_asset_id")
            if c_aid and "UNMAPPED" not in str(c_aid).upper():
                key = (c_aid, str(job.get("job_type", "")).strip().upper())
                asset_job_groups.setdefault(key, []).append(job)
            else:
                no_canonical_asset_jobs.append(job)

        surviving_jobs: List[Dict[str, Any]] = list(no_canonical_asset_jobs)

        for (c_aid, j_type), group in asset_job_groups.items():
            if len(group) == 1:
                surviving_jobs.append(group[0])
                continue

            # Sort chronologically by due date
            sorted_group = sorted(group, key=lambda j: parse_date_safe(j.get("due_date", "")))

            clusters: List[List[Dict[str, Any]]] = []
            for job in sorted_group:
                j_date = parse_date_safe(job.get("due_date", ""))
                placed = False
                for cluster in clusters:
                    if any(abs((j_date - parse_date_safe(c_job.get("due_date", ""))).days) <= DEDUP_EXACT_DATE_WINDOW_DAYS for c_job in cluster):
                        cluster.append(job)
                        placed = True
                        break
                if not placed:
                    clusters.append([job])

            for cluster in clusters:
                if len(cluster) == 1:
                    surviving_jobs.append(cluster[0])
                    continue

                # Multiple exact duplicates in this cluster:
                # Retain record with highest source recency rank, tie-break on priority_score
                cluster.sort(
                    key=lambda j: (
                        SOURCE_SYSTEM_RECENCY_ORDER.get(j.get("source_system", ""), 0),
                        j.get("priority_score", 0)
                    ),
                    reverse=True
                )
                survivor = cluster[0]
                dropped_records = cluster[1:]
                survivor_date = parse_date_safe(survivor.get("due_date", ""))

                for dropped in dropped_records:
                    dropped_date = parse_date_safe(dropped.get("due_date", ""))
                    diff_days = abs((survivor_date - dropped_date).days)
                    dropped_source = dropped.get("source_system", "UNKNOWN")

                    # Add tag to survivor data_quality_issues
                    tag = f"duplicate_dropped:{dropped_source}"
                    if tag not in survivor.setdefault("data_quality_issues", []):
                        survivor["data_quality_issues"].append(tag)

                    exact_duplicates_dropped.append({
                        "dropped_job_id": dropped.get("job_id"),
                        "retained_job_id": survivor.get("job_id"),
                        "canonical_asset_id": c_aid,
                        "job_type": j_type,
                        "source_system_dropped": dropped_source,
                        "source_system_retained": survivor.get("source_system"),
                        "dropped_due_date": dropped.get("due_date"),
                        "retained_due_date": survivor.get("due_date"),
                        "date_difference_days": diff_days,
                        "reason": (
                            f"Exact match on canonical asset '{c_aid}' and job_type '{j_type}' "
                            f"within {DEDUP_EXACT_DATE_WINDOW_DAYS}-day window ({diff_days}d diff). "
                            f"Retained {survivor.get('source_system')} over {dropped_source} "
                            f"based on source recency priority ranking."
                        )
                    })

                surviving_jobs.append(survivor)

        # --- Phase 2: Near-Match Deduplication ---
        num_survivors = len(surviving_jobs)
        for i in range(num_survivors):
            job_a = surviving_jobs[i]
            c_aid_a = job_a.get("canonical_asset_id")
            km_a = float(job_a.get("km", 0.0))
            date_a = parse_date_safe(job_a.get("due_date", ""))
            corridor_a = job_a.get("corridor_id")

            for j in range(i + 1, num_survivors):
                job_b = surviving_jobs[j]
                corridor_b = job_b.get("corridor_id")

                # Must be on same corridor
                if corridor_a != corridor_b:
                    continue

                c_aid_b = job_b.get("canonical_asset_id")

                # Near-match applies to different or missing asset_ids
                if c_aid_a and c_aid_b and c_aid_a == c_aid_b:
                    continue

                # Check spatial distance
                km_b = float(job_b.get("km", 0.0))
                dist_km = abs(km_a - km_b)
                if dist_km > DEDUP_SPATIAL_TOLERANCE_KM:
                    continue

                # Check date window
                date_b = parse_date_safe(job_b.get("due_date", ""))
                date_diff = abs((date_a - date_b).days)
                if date_diff > DEDUP_NEAR_DATE_WINDOW_DAYS:
                    continue

                # Check job type similarity
                sim_score = compute_job_type_similarity(job_a.get("job_type", ""), job_b.get("job_type", ""))
                if sim_score < DEDUP_JOB_TYPE_SIMILARITY_THRESHOLD:
                    continue

                # Probable duplicate match identified: flag both, do not drop
                flag_tag = "probable_duplicate:flagged"
                if flag_tag not in job_a.setdefault("data_quality_issues", []):
                    job_a["data_quality_issues"].append(flag_tag)
                if flag_tag not in job_b.setdefault("data_quality_issues", []):
                    job_b["data_quality_issues"].append(flag_tag)

                review_entry = {
                    "review_id": f"DEDUP-REV-{uuid.uuid4().hex[:8].upper()}",
                    "detected_at": sync_timestamp,
                    "flag_type": "probable_duplicate",
                    "corridor_id": corridor_a,
                    "km_distance_m": round(dist_km * 1000.0, 1),
                    "date_difference_days": date_diff,
                    "job_type_similarity": round(sim_score, 3),
                    "job_a": {
                        "job_id": job_a.get("job_id"),
                        "source_system": job_a.get("source_system"),
                        "department": job_a.get("department"),
                        "raw_asset_id": job_a.get("raw_asset_id", ""),
                        "canonical_asset_id": c_aid_a,
                        "km": km_a,
                        "station": job_a.get("station"),
                        "due_date": job_a.get("due_date"),
                        "job_type": job_a.get("job_type"),
                        "priority_score": job_a.get("priority_score")
                    },
                    "job_b": {
                        "job_id": job_b.get("job_id"),
                        "source_system": job_b.get("source_system"),
                        "department": job_b.get("department"),
                        "raw_asset_id": job_b.get("raw_asset_id", ""),
                        "canonical_asset_id": c_aid_b,
                        "km": km_b,
                        "station": job_b.get("station"),
                        "due_date": job_b.get("due_date"),
                        "job_type": job_b.get("job_type"),
                        "priority_score": job_b.get("priority_score")
                    },
                    "review_status": "PENDING_REVIEW",
                    "resolution": None
                }
                dedup_review_queue.append(review_entry)

        return surviving_jobs, exact_duplicates_dropped, dedup_review_queue

    def get_dedup_review_queue(self) -> List[Dict[str, Any]]:
        """
        Retrieves the deduplication review queue from storage.
        """
        return file_repo.get_dedup_review_queue()

    def sync_all_systems(self) -> Dict[str, Any]:
        """
        Executes the complete synchronization, normalization, deduplication & enrichment pipeline.
        Saves output to:
          - data/03_unified/unified_maintenance_jobs.json
          - data/03_unified/dedup_review_queue.json
          - data/03_unified/integration_sync_result.json
        """
        sync_timestamp = datetime.now().isoformat()

        # Step 0: Ensure canonical Asset Master Registry is reconciled and active
        registry_summary = asset_registry_service.build_and_save_registry()

        # Step 1: Read every CSV/JSON source file
        tms_assets = {a["asset_id"]: a for a in file_repo.get_raw_tms_assets()}
        tms_maint = file_repo.get_raw_tms_maintenance()

        smms_assets = {a["asset_id"]: a for a in file_repo.get_raw_smms_assets()}
        smms_maint = file_repo.get_raw_smms_maintenance()

        tdms_assets = {a["asset_id"]: a for a in file_repo.get_raw_tdms_assets()}
        tdms_maint = file_repo.get_raw_tdms_maintenance()

        coa_trains = file_repo.get_raw_coa_trains()
        bdms_requests = file_repo.get_raw_bdms_requests()

        all_assets = {**tms_assets, **smms_assets, **tdms_assets}

        raw_maintenance_pool = []
        for r in tms_maint:
            r["_source"] = "TMS"
            raw_maintenance_pool.append(r)
        for r in tdms_maint:
            r["_source"] = "TDMS"
            raw_maintenance_pool.append(r)
        for r in smms_maint:
            r["_source"] = "SMMS"
            raw_maintenance_pool.append(r)

        total_received = len(raw_maintenance_pool)
        seen_job_ids = set()
        gen_id_count = 0
        invalid_records = []
        candidate_jobs = []

        # Step 1.5: Load existing persistent review queue to preserve human decisions across syncs
        existing_invalid = file_repo.get_invalid_records()
        existing_by_job = {r.get("job_id"): r for r in existing_invalid if r.get("job_id")}
        persisted_review_map: Dict[str, Dict[str, Any]] = dict(existing_by_job)

        # Step 2: Validate, normalize, and enrich raw maintenance records
        for raw in raw_maintenance_pool:
            job_id = raw.get("job_id") or raw.get("id") or raw.get("maintenance_id")
            source_sys = raw.get("source_system") or raw.get("_source", "TMS")

            # Ensure non-empty ID
            if not job_id:
                gen_id_count += 1
                job_id = f"JOB-{source_sys}-{gen_id_count}"
            elif job_id in seen_job_ids:
                gen_id_count += 1
                job_id = f"{job_id}_DUP_{gen_id_count}"
            seen_job_ids.add(job_id)

            # Check if this record was explicitly REJECTED by human operator in review queue
            existing_entry = existing_by_job.get(job_id)
            if existing_entry and existing_entry.get("status") == "REJECTED":
                # Strictly exclude from unified candidate jobs
                continue

            # Check if this record was EDITED_AND_APPROVED or APPROVED by operator
            if existing_entry and existing_entry.get("status") in ["APPROVED", "EDITED_AND_APPROVED"]:
                corrected_raw = existing_entry.get("review_decision", {}).get("corrected_raw_source")
                if corrected_raw:
                    raw = corrected_raw

            # Check required fields
            asset_id = raw.get("asset_id") or raw.get("track_id") or raw.get("ohe_id") or raw.get("equipment_id")
            corridor_id = raw.get("corridor_id") or "C01"
            km_val = raw.get("km")
            station = raw.get("station", "OGL")

            # Validation errors and auto-default tracking
            validation_errors: List[Dict[str, Any]] = []
            defaults_applied: List[Dict[str, Any]] = []
            issues: List[str] = []

            # Asset ID validation
            if not asset_id or "UNKNOWN" in str(asset_id):
                validation_errors.append({
                    "field": "asset_id",
                    "raw_value": str(asset_id) if asset_id is not None else "",
                    "message": "Unknown or missing asset_id (requires canonical asset mapping)"
                })
                issues.append("Unknown or missing asset_id")

            # Corridor validation
            if corridor_id not in self.VALID_CORRIDORS:
                validation_errors.append({
                    "field": "corridor_id",
                    "raw_value": str(corridor_id),
                    "message": f"Invalid corridor_id '{corridor_id}' (must be C01, C02, C03, or C04)"
                })
                issues.append(f"Invalid corridor_id: {corridor_id}")

            # KM Location validation
            try:
                km_num = float(km_val) if km_val is not None and str(km_val).strip() != "" else None
                if km_num is None:
                    km_num = 0.0
                    defaults_applied.append({
                        "field": "km",
                        "defaulted_value": 0.0,
                        "original_value": km_val,
                        "reason": "Missing KM location defaulted to 0.0"
                    })
            except ValueError:
                km_num = 0.0
                validation_errors.append({
                    "field": "km",
                    "raw_value": str(km_val),
                    "message": f"Non-numeric KM location value '{km_val}'"
                })
                issues.append("Invalid KM location value")

            # Duration validation & defaulting
            raw_dur = raw.get("estimated_duration_min")
            if raw_dur is None or str(raw_dur).strip() == "":
                duration_min = 60
                defaults_applied.append({
                    "field": "estimated_duration_min",
                    "defaulted_value": 60,
                    "original_value": raw_dur,
                    "reason": "Missing duration defaulted to 60 min standard maintenance window"
                })
                issues.append("Missing duration, defaulted to 60 min")
            else:
                try:
                    duration_min = int(raw_dur)
                    if duration_min <= 0:
                        duration_min = 60
                        defaults_applied.append({
                            "field": "estimated_duration_min",
                            "defaulted_value": 60,
                            "original_value": raw_dur,
                            "reason": f"Non-positive duration ({raw_dur}) defaulted to 60 min"
                        })
                        issues.append(f"Non-positive duration, defaulted to 60 min")
                except ValueError:
                    duration_min = 60
                    defaults_applied.append({
                        "field": "estimated_duration_min",
                        "defaulted_value": 60,
                        "original_value": raw_dur,
                        "reason": f"Non-numeric duration '{raw_dur}' defaulted to 60 min"
                    })
                    issues.append("Non-numeric duration, defaulted to 60 min")

            # Normalize Department
            raw_dept = str(raw.get("department", "Engineering")).strip().lower()
            dept_normalized = self.DEPARTMENT_MAPPING.get(raw_dept, "Engineering")

            # Normalize Severity
            raw_sev = str(raw.get("severity", "MEDIUM")).strip().lower()
            sev_normalized = self.SEVERITY_MAPPING.get(raw_sev, "MEDIUM")

            # Normalize Due Date & defaulting
            raw_due = raw.get("due_date", "")
            today_str = datetime.now().strftime("%Y-%m-%d")
            if not raw_due or str(raw_due).strip() == "":
                parsed_due = today_str
                defaults_applied.append({
                    "field": "due_date",
                    "defaulted_value": today_str,
                    "original_value": raw_due,
                    "reason": "Missing due_date defaulted to current operational date"
                })
                issues.append("Missing due_date, defaulted to today")
            else:
                try:
                    parsed_due = datetime.strptime(str(raw_due)[:10], "%Y-%m-%d").strftime("%Y-%m-%d")
                except Exception:
                    parsed_due = today_str
                    defaults_applied.append({
                        "field": "due_date",
                        "defaulted_value": today_str,
                        "original_value": raw_due,
                        "reason": f"Non-standard date format '{raw_due}', normalized to current operational date"
                    })
                    issues.append("Non-standard date format, normalized to current date")

            # Classify error type
            if validation_errors:
                field_names = [e["field"] for e in validation_errors]
                if "asset_id" in field_names:
                    err_type = "MISSING_ASSET_ID"
                elif "corridor_id" in field_names:
                    err_type = "INVALID_CORRIDOR"
                elif "km" in field_names:
                    err_type = "INVALID_LOCATION"
                else:
                    err_type = "SCHEMA_VALIDATION_ERROR"
            elif defaults_applied:
                default_fields = [d["field"] for d in defaults_applied]
                if "estimated_duration_min" in default_fields:
                    err_type = "DEFAULTED_DURATION"
                elif "due_date" in default_fields:
                    err_type = "DEFAULTED_DATE"
                else:
                    err_type = "AUTO_DEFAULTED_FIELD"
            else:
                err_type = "CLEAN"

            # Step 3: Resolve canonical asset from the Asset Master Registry
            canonical_asset = asset_registry_service.resolve_asset(
                raw_id=asset_id,
                source_system=source_sys,
                corridor_id=corridor_id,
                km=km_num
            )
            canonical_asset_id = canonical_asset.get("asset_id")
            asset_type = canonical_asset.get("asset_type") or "RAIL_GENERIC"
            owning_depts = canonical_asset.get("owning_departments") or [dept_normalized]
            cross_ref = canonical_asset.get("cross_reference") or {}
            condition_score = canonical_asset.get("condition_score", 70.0)
            criticality = canonical_asset.get("criticality", "MEDIUM")

            # Calculate explainable priority using canonical asset context
            p_score, p_tier, factors, reasons = priority_engine.compute_priority(
                {
                    "criticality": criticality,
                    "severity": sev_normalized,
                    "due_date": parsed_due,
                    "condition_score": condition_score,
                    "corridor_id": corridor_id,
                    "job_type": raw.get("job_type", "GENERAL_MAINTENANCE")
                },
                canonical_asset
            )

            is_valid = len(validation_errors) == 0
            has_issues = len(validation_errors) > 0 or len(defaults_applied) > 0

            # Record in invalid / defaulted review queue store
            if has_issues:
                existing_record = existing_by_job.get(job_id)
                rec_status = existing_record.get("status", "PENDING_REVIEW") if existing_record else "PENDING_REVIEW"
                review_entry = {
                    "id": f"INV-REC-{job_id}",
                    "job_id": job_id,
                    "source_system": source_sys,
                    "department": dept_normalized,
                    "corridor_id": corridor_id,
                    "station": station,
                    "km": km_num,
                    "job_type": raw.get("job_type", "GENERAL_MAINTENANCE"),
                    "status": rec_status,
                    "detected_at": existing_record.get("detected_at", sync_timestamp) if existing_record else sync_timestamp,
                    "raw_source": dict(raw),
                    "validation_errors": validation_errors,
                    "has_validation_errors": len(validation_errors) > 0,
                    "is_defaulted": len(defaults_applied) > 0,
                    "defaults_applied": defaults_applied,
                    "error_type": err_type,
                    "review_decision": existing_record.get("review_decision") if existing_record else None,
                    "rejection_reason": existing_record.get("rejection_reason") if existing_record else None,
                    "rejection_timestamp": existing_record.get("rejection_timestamp") if existing_record else None
                }
                persisted_review_map[job_id] = review_entry
                invalid_records.append(review_entry)

            # Common MaintenanceJob Unified Object with canonical asset enrichment
            unified_job = {
                "job_id": job_id,
                "asset_id": canonical_asset_id or asset_id or "TMS-UNMAPPED-ASSET",
                "canonical_asset_id": canonical_asset_id,
                "raw_asset_id": asset_id or "",
                "asset_type": asset_type,
                "owning_departments": owning_depts,
                "asset_cross_reference": cross_ref,
                "department": dept_normalized,
                "source_system": source_sys,
                "corridor_id": corridor_id,
                "station": station,
                "km": km_num,
                "job_type": raw.get("job_type", "GENERAL_MAINTENANCE"),
                "severity": sev_normalized,
                "priority_score": p_score,
                "priority_tier": p_tier,
                "priority_factors": factors,
                "priority_reasons": reasons,
                "due_date": parsed_due,
                "estimated_duration_min": duration_min,
                "crew_required": raw.get("crew_required", "CREW-ENG-BZA-01"),
                "equipment_required": raw.get("equipment_required", "STANDARD_TOOLKIT"),
                "block_required": "YES",
                "status": "NORMALIZED",
                "is_valid": is_valid,
                "data_quality_issues": issues
            }
            candidate_jobs.append(unified_job)

        # Persist updated invalid / defaulted review records to storage
        file_repo.save_invalid_records(list(persisted_review_map.values()))

        # Step 3.5: Detect & Resolve Cross-Department Data Conflicts on Canonical Assets
        candidate_jobs, conflict_log, conflict_summary = conflict_resolver.detect_and_resolve_conflicts(
            candidate_jobs=candidate_jobs,
            sync_timestamp=sync_timestamp
        )
        file_repo.save_conflict_log(conflict_log)

        # Step 4: Two-Tier Deduplication & Collision Handling
        normalized_jobs, exact_duplicates_dropped, dedup_review_queue = self.deduplicate_jobs(
            candidate_jobs=candidate_jobs,
            sync_timestamp=sync_timestamp
        )

        # Step 5: Save unified jobs and review queue to persistent storage
        file_repo.save_unified_jobs(normalized_jobs)
        file_repo.save_dedup_review_queue(dedup_review_queue)

        # Count cross-department matches (same corridor, nearby km within 2.0 km)
        cross_dept_matches = 0
        for i in range(len(normalized_jobs)):
            for j in range(i + 1, len(normalized_jobs)):
                j1 = normalized_jobs[i]
                j2 = normalized_jobs[j]
                if j1["corridor_id"] == j2["corridor_id"] and j1["department"] != j2["department"]:
                    if abs(j1["km"] - j2["km"]) <= 2.0:
                        cross_dept_matches += 1

        # Calculate Data Quality Score
        total_fields_checked = total_received * 8
        error_penalty = len(invalid_records) * 3 + len(exact_duplicates_dropped) * 2 + len(conflict_log)
        quality_score = round(max(85.0, min(100.0, 100.0 - (error_penalty / max(1, total_fields_checked) * 100))), 1)

        sync_summary = {
            "last_sync_timestamp": sync_timestamp,
            "total_records_in": len(candidate_jobs),
            "exact_duplicates_resolved": len(exact_duplicates_dropped),
            "probable_duplicates_flagged": len(dedup_review_queue),
            "net_unique_records_out": len(normalized_jobs),
            "exact_duplicates_dropped": exact_duplicates_dropped,
            "probable_duplicates_review_count": len(dedup_review_queue),
            "records_received": total_received,
            "records_normalized": len(normalized_jobs),
            "duplicates_detected": len(exact_duplicates_dropped),
            "invalid_records_count": len(invalid_records),
            "cross_department_matches": cross_dept_matches,
            "data_quality_score": quality_score,
            "asset_registry_summary": registry_summary,
            "conflict_summary": conflict_summary,
            "total_conflicts_detected": conflict_summary.get("total_conflicts_detected", 0),
            "conflicts_logged_count": len(conflict_log),
            "breakdown": {
                "tms_records": len(tms_maint),
                "tdms_records": len(tdms_maint),
                "smms_records": len(smms_maint),
                "coa_train_movements": len(coa_trains),
                "bdms_block_requests": len(bdms_requests)
            },
            "invalid_records": invalid_records
        }

        # Save sync summary
        file_repo.save_sync_result(sync_summary)

        # Log audit
        file_repo.log_audit_event(
            event_type="INTEGRATION_SYNC",
            action="Executed Unified Synchronization, Deduplication & Conflict Detection across 5 Railway Systems",
            details={
                "total_records_in": len(candidate_jobs),
                "exact_duplicates_resolved": len(exact_duplicates_dropped),
                "probable_duplicates_flagged": len(dedup_review_queue),
                "net_unique_records_out": len(normalized_jobs),
                "quality_score": quality_score,
                "cross_dept_matches": cross_dept_matches,
                "canonical_assets": registry_summary.get("total_canonical_assets", 0),
                "multi_dept_merged_assets": registry_summary.get("multi_department_merged", 0),
                "conflicts_detected": conflict_summary.get("total_conflicts_detected", 0)
            },
            user="DataIntegrationHub"
        )

        return sync_summary

    # =====================================================================
    # HUMAN REVIEW QUEUE QUERY & DECISION HANDLING
    # =====================================================================
    def get_review_queue(
        self,
        status: Optional[str] = None,
        department: Optional[str] = None,
        error_type: Optional[str] = None,
        is_defaulted: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Retrieves the persistent review queue for invalid and auto-defaulted records,
        with multi-attribute filtering and status breakdown metrics.
        """
        records = file_repo.get_invalid_records()

        # If empty on first access, trigger initial sync to populate
        if not records:
            self.sync_all_systems()
            records = file_repo.get_invalid_records()

        total = len(records)
        pending_count = sum(1 for r in records if r.get("status") == "PENDING_REVIEW")
        approved_count = sum(1 for r in records if r.get("status") in ["APPROVED", "EDITED_AND_APPROVED"])
        rejected_count = sum(1 for r in records if r.get("status") == "REJECTED")

        # Apply filters
        filtered = list(records)
        if status and status.upper() != "ALL":
            filtered = [r for r in filtered if r.get("status", "").upper() == status.upper()]
        if department and department.upper() != "ALL":
            filtered = [r for r in filtered if r.get("department", "").lower() == department.lower()]
        if error_type and error_type.upper() != "ALL":
            filtered = [r for r in filtered if r.get("error_type", "").upper() == error_type.upper()]
        if is_defaulted is not None:
            filtered = [r for r in filtered if bool(r.get("is_defaulted")) == is_defaulted]

        # Sort with PENDING_REVIEW first, then newest detected_at
        filtered.sort(
            key=lambda r: (
                0 if r.get("status") == "PENDING_REVIEW" else 1,
                r.get("detected_at", "")
            ),
            reverse=True
        )

        return {
            "total": total,
            "pending_count": pending_count,
            "approved_count": approved_count,
            "rejected_count": rejected_count,
            "filtered_count": len(filtered),
            "records": filtered
        }

    def submit_review_decision(
        self,
        record_id: str,
        action: str,
        reason: str = "",
        user: str = "Operator",
        corrected_fields: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Submits a human review decision (APPROVE, EDIT_AND_APPROVE, REJECT).
        - APPROVE: Re-enters standard pipeline with auto-defaulted values.
        - EDIT_AND_APPROVE: Merges operator corrections and re-runs complete pipeline.
        - REJECT: Excludes record from unified jobs and logs rejection reason + timestamp.
        """
        records = file_repo.get_invalid_records()
        target = None
        for r in records:
            if r.get("id") == record_id or r.get("job_id") == record_id:
                target = r
                break

        if not target:
            raise ValueError(f"Review record '{record_id}' not found in invalid_records store.")

        action_clean = str(action).strip().upper()

        if action_clean == "REJECT":
            return self.reject_record(record_id=target.get("id", record_id), reason=reason, user=user)

        elif action_clean in ["APPROVE", "EDIT_AND_APPROVE"]:
            raw_to_process = dict(target.get("raw_source") or {})
            if corrected_fields and isinstance(corrected_fields, dict):
                raw_to_process.update(corrected_fields)

            return self.reprocess_reviewed_record(
                raw=raw_to_process,
                record_id=target.get("id", record_id),
                action=action_clean,
                user=user,
                comments=reason
            )
        else:
            raise ValueError(f"Invalid review action '{action}'. Must be APPROVE, EDIT_AND_APPROVE, or REJECT.")

    def reprocess_reviewed_record(
        self,
        raw: Dict[str, Any],
        record_id: str,
        action: str,
        user: str = "Operator",
        comments: str = ""
    ) -> Dict[str, Any]:
        """
        Reprocesses an approved or edited record through the full standard pipeline:
        Validation -> Schema Normalization -> Canonical Asset Resolution -> Explainable Priority -> Deduplication.
        """
        job_id = raw.get("job_id") or raw.get("id")
        source_sys = raw.get("source_system") or raw.get("_source", "TMS")

        # 1. Validation check
        asset_id = raw.get("asset_id") or raw.get("track_id") or raw.get("ohe_id") or raw.get("equipment_id")
        corridor_id = raw.get("corridor_id") or "C01"
        km_val = raw.get("km")

        validation_errors = []
        if not asset_id or "UNKNOWN" in str(asset_id):
            validation_errors.append({
                "field": "asset_id",
                "message": "Asset ID is still missing or marked UNKNOWN",
                "raw_value": str(asset_id)
            })
        if corridor_id not in self.VALID_CORRIDORS:
            validation_errors.append({
                "field": "corridor_id",
                "message": f"Corridor '{corridor_id}' is invalid (expected C01, C02, C03, or C04)",
                "raw_value": str(corridor_id)
            })
        try:
            km_num = float(km_val) if km_val is not None and str(km_val).strip() != "" else 0.0
        except ValueError:
            km_num = 0.0
            validation_errors.append({
                "field": "km",
                "message": f"Non-numeric KM value '{km_val}'",
                "raw_value": str(km_val)
            })

        if validation_errors:
            return {
                "success": False,
                "message": "Validation failed on submitted record corrections.",
                "errors": validation_errors
            }

        # 2. Normalization
        raw_dept = str(raw.get("department", "Engineering")).strip().lower()
        dept_normalized = self.DEPARTMENT_MAPPING.get(raw_dept, "Engineering")

        raw_sev = str(raw.get("severity", "MEDIUM")).strip().lower()
        sev_normalized = self.SEVERITY_MAPPING.get(raw_sev, "MEDIUM")

        raw_dur = raw.get("estimated_duration_min") or raw.get("duration") or 60
        try:
            duration_min = max(15, int(raw_dur))
        except ValueError:
            duration_min = 60

        raw_due = raw.get("due_date", "")
        try:
            parsed_due = datetime.strptime(str(raw_due)[:10], "%Y-%m-%d").strftime("%Y-%m-%d")
        except Exception:
            parsed_due = datetime.now().strftime("%Y-%m-%d")

        station = raw.get("station", "OGL")

        # 3. Canonical asset resolution from Asset Master Registry
        canonical_asset = asset_registry_service.resolve_asset(
            raw_id=asset_id,
            source_system=source_sys,
            corridor_id=corridor_id,
            km=km_num
        )
        canonical_asset_id = canonical_asset.get("asset_id")
        asset_type = canonical_asset.get("asset_type") or "RAIL_GENERIC"
        owning_depts = canonical_asset.get("owning_departments") or [dept_normalized]
        cross_ref = canonical_asset.get("cross_reference") or {}
        condition_score = canonical_asset.get("condition_score", 70.0)
        criticality = canonical_asset.get("criticality", "MEDIUM")

        # 4. Explainable priority computation
        p_score, p_tier, factors, reasons = priority_engine.compute_priority(
            {
                "criticality": criticality,
                "severity": sev_normalized,
                "due_date": parsed_due,
                "condition_score": condition_score,
                "corridor_id": corridor_id,
                "job_type": raw.get("job_type", "GENERAL_MAINTENANCE")
            },
            canonical_asset
        )

        unified_job = {
            "job_id": job_id,
            "asset_id": canonical_asset_id or asset_id,
            "canonical_asset_id": canonical_asset_id,
            "raw_asset_id": asset_id or "",
            "asset_type": asset_type,
            "owning_departments": owning_depts,
            "asset_cross_reference": cross_ref,
            "department": dept_normalized,
            "source_system": source_sys,
            "corridor_id": corridor_id,
            "station": station,
            "km": km_num,
            "job_type": raw.get("job_type", "GENERAL_MAINTENANCE"),
            "severity": sev_normalized,
            "priority_score": p_score,
            "priority_tier": p_tier,
            "priority_factors": factors,
            "priority_reasons": reasons,
            "due_date": parsed_due,
            "estimated_duration_min": duration_min,
            "crew_required": raw.get("crew_required", "CREW-ENG-BZA-01"),
            "equipment_required": raw.get("equipment_required", "STANDARD_TOOLKIT"),
            "block_required": "YES",
            "status": "NORMALIZED",
            "is_valid": True,
            "data_quality_issues": [f"reviewed_by_human:{action}"]
        }

        # 5. Deduplication check against existing unified jobs
        existing_jobs = file_repo.get_unified_jobs()
        # Remove previous version if present
        filtered_existing = [j for j in existing_jobs if j.get("job_id") != job_id]

        surviving_jobs, exact_dropped, dedup_queue = self.deduplicate_jobs(
            candidate_jobs=[unified_job] + filtered_existing,
            sync_timestamp=datetime.now().isoformat()
        )
        file_repo.save_unified_jobs(surviving_jobs)

        # 6. Update persistent invalid_records store
        all_reviews = file_repo.get_invalid_records()
        now_iso = datetime.now().isoformat()
        for r in all_reviews:
            if r.get("id") == record_id or r.get("job_id") == job_id:
                r["status"] = "EDITED_AND_APPROVED" if action == "EDIT_AND_APPROVE" else "APPROVED"
                r["review_decision"] = {
                    "action": action,
                    "decided_by": user,
                    "decided_at": now_iso,
                    "comments": comments,
                    "corrected_raw_source": raw
                }
                r["raw_source"] = raw
                r["validation_errors"] = []
                r["has_validation_errors"] = False
                break
        file_repo.save_invalid_records(all_reviews)

        # 7. Audit Logging
        file_repo.log_audit_event(
            event_type="REVIEW_QUEUE_INGEST",
            action=f"Ingested reviewed record {job_id} into unified dataset via {action}",
            details={
                "record_id": record_id,
                "job_id": job_id,
                "action": action,
                "canonical_asset_id": canonical_asset_id,
                "priority_score": p_score,
                "priority_tier": p_tier,
                "user": user,
                "comments": comments
            },
            user=user
        )

        return {
            "success": True,
            "action": action,
            "message": f"Record {job_id} successfully validated, normalized, and ingested into Unified Maintenance dataset.",
            "job": unified_job,
            "canonical_asset_id": canonical_asset_id,
            "priority_score": p_score
        }

    def reject_record(
        self,
        record_id: str,
        reason: str = "",
        user: str = "Operator"
    ) -> Dict[str, Any]:
        """
        Rejects an invalid or defaulted record:
        - Excludes it strictly from unified maintenance jobs.
        - Persists rejection reason, timestamp, and reviewer.
        - Emits an audit trail event.
        """
        all_reviews = file_repo.get_invalid_records()
        target = None
        now_iso = datetime.now().isoformat()

        for r in all_reviews:
            if r.get("id") == record_id or r.get("job_id") == record_id:
                r["status"] = "REJECTED"
                r["rejection_reason"] = reason or "Rejected by human reviewer"
                r["rejection_timestamp"] = now_iso
                r["review_decision"] = {
                    "action": "REJECT",
                    "decided_by": user,
                    "decided_at": now_iso,
                    "reason": r["rejection_reason"]
                }
                target = r
                break

        if not target:
            raise ValueError(f"Review record '{record_id}' not found in invalid_records store.")

        file_repo.save_invalid_records(all_reviews)

        # Strictly exclude from unified_maintenance_jobs.json
        job_id = target.get("job_id")
        unified_jobs = file_repo.get_unified_jobs()
        filtered_jobs = [j for j in unified_jobs if j.get("job_id") != job_id]
        if len(filtered_jobs) != len(unified_jobs):
            file_repo.save_unified_jobs(filtered_jobs)

        # Log audit trail event
        file_repo.log_audit_event(
            event_type="REVIEW_QUEUE_REJECT",
            action=f"Rejected record {job_id} from unified maintenance dataset",
            details={
                "record_id": record_id,
                "job_id": job_id,
                "source_system": target.get("source_system"),
                "department": target.get("department"),
                "rejection_reason": target["rejection_reason"],
                "rejection_timestamp": now_iso
            },
            user=user
        )

        return {
            "success": True,
            "action": "REJECT",
            "message": f"Record {job_id} rejected and excluded from unified maintenance dataset.",
            "record": target
        }

integration_service = DataIntegrationService()
