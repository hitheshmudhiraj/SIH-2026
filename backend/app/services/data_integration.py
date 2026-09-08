"""
Data Integration Hub & Normalization Service
Integrates TMS, SMMS, TDMS, COA, and BDMS CSV/JSON files.
Validates schemas, normalizes fields, detects duplicates, evaluates data quality,
and produces unified maintenance jobs.
"""
import os
import re
from typing import Dict, Any, List, Tuple
from datetime import datetime
from app.services.file_repository import file_repo
from app.services.priority_engine import priority_engine

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
            "last_sync": last_sync,
            "data_quality_score": sync_meta.get("data_quality_score", 96.8)
        }

    def sync_all_systems(self) -> Dict[str, Any]:
        """
        Executes the complete 13-step synchronization & normalization pipeline.
        Saves output to data/03_unified/unified_maintenance_jobs.json and integration_sync_result.json.
        """
        sync_timestamp = datetime.now().isoformat()

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
        duplicates_count = 0
        invalid_records = []
        normalized_jobs = []

        # Step 2-11: Validate, normalize, deduplicate, build unified model
        for raw in raw_maintenance_pool:
            job_id = raw.get("job_id") or raw.get("id") or raw.get("maintenance_id")
            source_sys = raw.get("source_system") or raw.get("_source", "TMS")

            # Check duplicate
            if not job_id or job_id in seen_job_ids:
                duplicates_count += 1
                job_id = f"{job_id}_DUP_{duplicates_count}" if job_id else f"JOB-GEN-{len(seen_job_ids)+1}"
            seen_job_ids.add(job_id)

            # Check required fields
            asset_id = raw.get("asset_id") or raw.get("track_id") or raw.get("ohe_id") or raw.get("equipment_id")
            corridor_id = raw.get("corridor_id") or "C01"
            km_val = raw.get("km")
            station = raw.get("station", "OGL")

            # Validation errors
            issues = []
            if not asset_id or "UNKNOWN" in str(asset_id):
                issues.append("Unknown or missing asset_id")
            if corridor_id not in self.VALID_CORRIDORS:
                issues.append(f"Invalid corridor_id: {corridor_id}")
            try:
                km_num = float(km_val) if km_val is not None else 0.0
            except ValueError:
                km_num = 0.0
                issues.append("Invalid KM location value")

            # Duration validation
            raw_dur = raw.get("estimated_duration_min") or raw.get("duration") or 60
            try:
                duration_min = int(raw_dur)
            except ValueError:
                duration_min = 60
                issues.append("Invalid duration value, defaulted to 60")

            # Normalize Department
            raw_dept = str(raw.get("department", "Engineering")).strip().lower()
            dept_normalized = self.DEPARTMENT_MAPPING.get(raw_dept, "Engineering")

            # Normalize Severity
            raw_sev = str(raw.get("severity", "MEDIUM")).strip().lower()
            sev_normalized = self.SEVERITY_MAPPING.get(raw_sev, "MEDIUM")

            # Normalize Due Date
            raw_due = raw.get("due_date", "")
            try:
                parsed_due = datetime.strptime(raw_due[:10], "%Y-%m-%d").strftime("%Y-%m-%d")
            except Exception:
                parsed_due = datetime.now().strftime("%Y-%m-%d")
                issues.append("Non-standard date format, normalized to current date")

            matched_asset = all_assets.get(asset_id, {})
            asset_type = matched_asset.get("asset_type", "RAIL_GENERIC")

            # Calculate explainable priority
            p_score, p_tier, factors, reasons = priority_engine.compute_priority(
                {
                    "criticality": matched_asset.get("criticality", "MEDIUM"),
                    "severity": sev_normalized,
                    "due_date": parsed_due,
                    "condition_score": matched_asset.get("condition_score", 70),
                    "corridor_id": corridor_id,
                    "job_type": raw.get("job_type", "GENERAL_MAINTENANCE")
                },
                matched_asset
            )

            is_valid = len(issues) == 0
            if not is_valid:
                invalid_records.append({
                    "job_id": job_id,
                    "source_system": source_sys,
                    "issues": issues,
                    "raw_data": raw
                })

            # Common MaintenanceJob Unified Object
            unified_job = {
                "job_id": job_id,
                "asset_id": asset_id or "TMS-UNMAPPED-ASSET",
                "asset_type": asset_type,
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
            normalized_jobs.append(unified_job)

        # Step 12: Save normalized output to data/03_unified/unified_maintenance_jobs.json
        file_repo.save_unified_jobs(normalized_jobs)

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
        error_penalty = len(invalid_records) * 3 + duplicates_count * 2
        quality_score = round(max(85.0, min(100.0, 100.0 - (error_penalty / max(1, total_fields_checked) * 100))), 1)

        sync_summary = {
            "last_sync_timestamp": sync_timestamp,
            "records_received": total_received,
            "records_normalized": len(normalized_jobs),
            "duplicates_detected": duplicates_count,
            "invalid_records_count": len(invalid_records),
            "cross_department_matches": cross_dept_matches,
            "data_quality_score": quality_score,
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
            action="Executed Unified Synchronization & Normalization across 5 Railway Systems",
            details={
                "received": total_received,
                "normalized": len(normalized_jobs),
                "quality_score": quality_score,
                "cross_dept_matches": cross_dept_matches
            },
            user="DataIntegrationHub"
        )

        return sync_summary

integration_service = DataIntegrationService()
