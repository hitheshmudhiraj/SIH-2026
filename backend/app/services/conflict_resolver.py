"""
Cross-Department Data Conflict Detection & Resolution Service
Detects cases where TMS, SMMS, and TDMS report contradictory facts about the
same canonical physical asset (location mismatch > 50m, condition score mismatch, etc.)
and generates provisional resolutions pending human review.
"""

import os
import uuid
from typing import Dict, Any, List, Tuple, Optional, Set
from datetime import datetime
from app.services.file_repository import file_repo

# =====================================================================
# CONFIGURABLE CONFLICT TOLERANCES & RECENCY PRECEDENCE
# =====================================================================
CONFLICT_LOCATION_TOLERANCE_KM: float = 0.050   # 50 meters spatial tolerance
CONFLICT_CONDITION_SCORE_TOLERANCE: float = 5.0 # Delta > 5.0 points triggers condition mismatch

# Source system recency ranking: higher = more recent / higher precedence.
# Per railway SOP, Track Management System (TMS) takes precedence for permanent way infrastructure,
# followed by SMMS, then TDMS.
SOURCE_SYSTEM_RECENCY_ORDER: Dict[str, int] = {
    "TMS": 3,
    "SMMS": 2,
    "TDMS": 1,
    "COA": 0,
    "BDMS": 0
}

DEPT_TO_SOURCE: Dict[str, str] = {
    "Engineering": "TMS",
    "S&T": "SMMS",
    "Traction": "TDMS"
}

SOURCE_TO_DEPT: Dict[str, str] = {
    "TMS": "Engineering",
    "SMMS": "S&T",
    "TDMS": "Traction"
}


class ConflictResolverService:
    def __init__(
        self,
        location_tolerance_km: float = CONFLICT_LOCATION_TOLERANCE_KM,
        condition_tolerance: float = CONFLICT_CONDITION_SCORE_TOLERANCE
    ):
        self.location_tolerance_km = location_tolerance_km
        self.condition_tolerance = condition_tolerance

    def _determine_winning_report(self, reports: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Picks the provisional winner using 'most recently synced source wins'
        based on SOURCE_SYSTEM_RECENCY_ORDER, tie-breaking by report timestamp.
        """
        def sort_key(r):
            source = r.get("source_system", "TMS")
            recency_rank = SOURCE_SYSTEM_RECENCY_ORDER.get(source, 0)
            timestamp_str = str(r.get("report_timestamp", ""))
            return (recency_rank, timestamp_str)

        sorted_reports = sorted(reports, key=sort_key, reverse=True)
        return sorted_reports[0] if sorted_reports else reports[0]

    def detect_and_resolve_conflicts(
        self,
        candidate_jobs: List[Dict[str, Any]],
        canonical_assets: Optional[List[Dict[str, Any]]] = None,
        sync_timestamp: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
        """
        Detects contradictory facts across departments on the same canonical asset.

        Args:
            candidate_jobs: List of enriched UnifiedJob dictionaries.
            canonical_assets: Optional list of canonical assets (loaded from file_repo if omitted).
            sync_timestamp: ISO timestamp for the current sync run.

        Returns:
            Tuple of:
            - updated_jobs: candidate_jobs tagged with data_quality_issues
            - conflict_log: list of detailed conflict records
            - conflict_summary: aggregated metrics and breakdowns
        """
        if sync_timestamp is None:
            sync_timestamp = datetime.now().isoformat()

        if canonical_assets is None:
            canonical_assets = file_repo.get_asset_master_registry()

        # Build lookup for raw assets to access original department reports
        raw_assets_by_id: Dict[str, Dict[str, Any]] = {}
        for a in file_repo.get_raw_tms_assets():
            raw_assets_by_id[a["asset_id"]] = {**a, "_source": "TMS", "_dept": "Engineering"}
        for a in file_repo.get_raw_smms_assets():
            raw_assets_by_id[a["asset_id"]] = {**a, "_source": "SMMS", "_dept": "S&T"}
        for a in file_repo.get_raw_tdms_assets():
            raw_assets_by_id[a["asset_id"]] = {**a, "_source": "TDMS", "_dept": "Traction"}

        conflict_log: List[Dict[str, Any]] = []
        conflicts_by_asset_id: Dict[str, List[Dict[str, Any]]] = {}

        field_type_counts: Dict[str, int] = {
            "location mismatch": 0,
            "condition mismatch": 0,
            "other": 0
        }
        dept_pair_counts: Dict[str, int] = {}

        for asset in canonical_assets:
            c_aid = asset.get("asset_id")
            cross_ref = asset.get("cross_reference", {})
            reconcil_meta = asset.get("reconciliation_metadata", {})
            raw_ids = reconcil_meta.get("raw_ids", [])

            # Check if canonical asset has cross-references from 2+ departments
            present_refs = {k: v for k, v in cross_ref.items() if v}
            merged_depts = reconcil_meta.get("merged_departments", asset.get("owning_departments", []))

            if len(present_refs) < 2 and len(merged_depts) < 2 and len(raw_ids) < 2:
                continue

            # Gather raw component reports
            components: List[Dict[str, Any]] = []
            for raw_id in raw_ids:
                if raw_id in raw_assets_by_id:
                    components.append(raw_assets_by_id[raw_id])

            # If not in reconcil_meta raw_ids, check cross_ref IDs
            if not components:
                for src_key, raw_id in present_refs.items():
                    if raw_id and raw_id in raw_assets_by_id:
                        components.append(raw_assets_by_id[raw_id])

            if len(components) < 2:
                continue

            # 1. Location / KM mismatch check
            km_reports = []
            for comp in components:
                try:
                    km_val = float(comp.get("km", 0.0))
                except (ValueError, TypeError):
                    km_val = 0.0
                ts = comp.get("installation_date") or comp.get("install_date") or sync_timestamp
                km_reports.append({
                    "department": comp.get("_dept", "Engineering"),
                    "source_system": comp.get("_source", "TMS"),
                    "raw_asset_id": comp.get("asset_id", ""),
                    "reported_value": km_val,
                    "report_timestamp": ts
                })

            # Check pairwise KM discrepancies
            km_conflict_found = False
            for i in range(len(km_reports)):
                for j in range(i + 1, len(km_reports)):
                    rep_a = km_reports[i]
                    rep_b = km_reports[j]
                    diff_km = abs(rep_a["reported_value"] - rep_b["reported_value"])
                    if diff_km > (self.location_tolerance_km + 1e-6):
                        km_conflict_found = True
                        pair_name = f"{rep_a['department']} vs {rep_b['department']}"
                        dept_pair_counts[pair_name] = dept_pair_counts.get(pair_name, 0) + 1

            if km_conflict_found:
                field_type_counts["location mismatch"] += 1
                winner = self._determine_winning_report(km_reports)
                conflict_entry = {
                    "conflict_id": f"CONF-LOC-{uuid.uuid4().hex[:8].upper()}",
                    "detected_at": sync_timestamp,
                    "asset_id": c_aid,
                    "corridor_id": asset.get("corridor_id", ""),
                    "field_in_conflict": "km",
                    "field_type": "location mismatch",
                    "tolerance_threshold": f"{int(self.location_tolerance_km * 1000)}m ({self.location_tolerance_km} km)",
                    "department_reports": km_reports,
                    "provisional_resolution": {
                        "status": "PROVISIONAL_PENDING_HUMAN_REVIEW",
                        "winning_department": winner["department"],
                        "winning_source": winner["source_system"],
                        "resolved_value": winner["reported_value"],
                        "resolution_rule": "most_recently_synced_source_wins",
                        "note": f"Provisional resolution pending human review. Selected {winner['source_system']} value ({winner['reported_value']} km) downstream."
                    }
                }
                conflict_log.append(conflict_entry)
                conflicts_by_asset_id.setdefault(c_aid, []).append(conflict_entry)

            # 2. Condition Score mismatch check
            cond_reports = []
            for comp in components:
                try:
                    c_val = float(comp.get("condition_score", 70.0))
                except (ValueError, TypeError):
                    c_val = 70.0
                ts = comp.get("installation_date") or comp.get("install_date") or sync_timestamp
                cond_reports.append({
                    "department": comp.get("_dept", "Engineering"),
                    "source_system": comp.get("_source", "TMS"),
                    "raw_asset_id": comp.get("asset_id", ""),
                    "reported_value": c_val,
                    "report_timestamp": ts
                })

            cond_conflict_found = False
            for i in range(len(cond_reports)):
                for j in range(i + 1, len(cond_reports)):
                    rep_a = cond_reports[i]
                    rep_b = cond_reports[j]
                    diff_score = abs(rep_a["reported_value"] - rep_b["reported_value"])
                    if diff_score > self.condition_tolerance:
                        cond_conflict_found = True
                        pair_name = f"{rep_a['department']} vs {rep_b['department']}"
                        dept_pair_counts[pair_name] = dept_pair_counts.get(pair_name, 0) + 1

            if cond_conflict_found:
                field_type_counts["condition mismatch"] += 1
                winner = self._determine_winning_report(cond_reports)
                conflict_entry = {
                    "conflict_id": f"CONF-CND-{uuid.uuid4().hex[:8].upper()}",
                    "detected_at": sync_timestamp,
                    "asset_id": c_aid,
                    "corridor_id": asset.get("corridor_id", ""),
                    "field_in_conflict": "condition_score",
                    "field_type": "condition mismatch",
                    "tolerance_threshold": f"{self.condition_tolerance} points",
                    "department_reports": cond_reports,
                    "provisional_resolution": {
                        "status": "PROVISIONAL_PENDING_HUMAN_REVIEW",
                        "winning_department": winner["department"],
                        "winning_source": winner["source_system"],
                        "resolved_value": winner["reported_value"],
                        "resolution_rule": "most_recently_synced_source_wins",
                        "note": f"Provisional resolution pending human review. Selected {winner['source_system']} value ({winner['reported_value']}) downstream."
                    }
                }
                conflict_log.append(conflict_entry)
                conflicts_by_asset_id.setdefault(c_aid, []).append(conflict_entry)

            # 3. Other shared fields (status / criticality)
            stat_reports = []
            for comp in components:
                st = str(comp.get("status", "")).strip().upper()
                if st:
                    ts = comp.get("installation_date") or comp.get("install_date") or sync_timestamp
                    stat_reports.append({
                        "department": comp.get("_dept", "Engineering"),
                        "source_system": comp.get("_source", "TMS"),
                        "raw_asset_id": comp.get("asset_id", ""),
                        "reported_value": st,
                        "report_timestamp": ts
                    })

            distinct_statuses = {r["reported_value"] for r in stat_reports}
            if len(distinct_statuses) > 1:
                field_type_counts["other"] += 1
                winner = self._determine_winning_report(stat_reports)
                conflict_entry = {
                    "conflict_id": f"CONF-OTH-{uuid.uuid4().hex[:8].upper()}",
                    "detected_at": sync_timestamp,
                    "asset_id": c_aid,
                    "corridor_id": asset.get("corridor_id", ""),
                    "field_in_conflict": "status",
                    "field_type": "other",
                    "tolerance_threshold": "exact match",
                    "department_reports": stat_reports,
                    "provisional_resolution": {
                        "status": "PROVISIONAL_PENDING_HUMAN_REVIEW",
                        "winning_department": winner["department"],
                        "winning_source": winner["source_system"],
                        "resolved_value": winner["reported_value"],
                        "resolution_rule": "most_recently_synced_source_wins",
                        "note": f"Provisional status pending human review. Selected {winner['source_system']} ({winner['reported_value']})."
                    }
                }
                conflict_log.append(conflict_entry)
                conflicts_by_asset_id.setdefault(c_aid, []).append(conflict_entry)

        # -----------------------------------------------------------------
        # Tag affected UnifiedJob records with data_quality_issues
        # -----------------------------------------------------------------
        for job in candidate_jobs:
            j_aid = job.get("canonical_asset_id") or job.get("asset_id")
            if not j_aid or j_aid not in conflicts_by_asset_id:
                continue

            asset_conflicts = conflicts_by_asset_id[j_aid]
            job_issues = job.setdefault("data_quality_issues", [])

            for conf in asset_conflicts:
                reports = conf.get("department_reports", [])
                depts = sorted(list({r["department"] for r in reports}))
                sources = sorted(list({r["source_system"] for r in reports}))
                f_name = conf.get("field_in_conflict", "field")

                # Generate tags matching required format: field_mismatch_<DEPT1>_<DEPT2>
                for i in range(len(depts)):
                    for j in range(i + 1, len(depts)):
                        d1, d2 = depts[i], depts[j]
                        tag1 = f"field_mismatch_{d1}_{d2}"
                        tag1_upper = f"field_mismatch_{d1.upper()}_{d2.upper()}"
                        tag_field = f"{f_name}_mismatch_{d1}_{d2}"
                        if tag1 not in job_issues:
                            job_issues.append(tag1)
                        if tag1_upper not in job_issues:
                            job_issues.append(tag1_upper)
                        if tag_field not in job_issues:
                            job_issues.append(tag_field)

                for i in range(len(sources)):
                    for j in range(i + 1, len(sources)):
                        s1, s2 = sources[i], sources[j]
                        tag_src = f"field_mismatch_{s1}_{s2}"
                        if tag_src not in job_issues:
                            job_issues.append(tag_src)

                # Use provisional resolution downstream to maintain pipeline continuity
                prov = conf.get("provisional_resolution", {})
                if f_name == "km" and prov.get("resolved_value") is not None:
                    job["provisional_km"] = prov["resolved_value"]

        # Conflict summary
        total_conflicts = len(conflict_log)
        conflict_summary = {
            "total_conflicts_detected": total_conflicts,
            "breakdown_by_field_type": {
                "location_mismatch": field_type_counts["location mismatch"],
                "condition_mismatch": field_type_counts["condition mismatch"],
                "other": field_type_counts["other"]
            },
            "breakdown_by_department_pair": dept_pair_counts,
            "provisional_resolutions_count": total_conflicts,
            "status": "PROVISIONAL_RESOLUTIONS_APPLIED" if total_conflicts > 0 else "NO_CONFLICTS"
        }

        return candidate_jobs, conflict_log, conflict_summary

conflict_resolver = ConflictResolverService()
