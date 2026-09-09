"""
Asset Master Registry Service
Canonical Asset Master Registry for RailBlock AI.

Reconciles and unifies railway infrastructure assets across the three siloed
maintenance departments:
- TMS (Civil Engineering / P-Way)
- SMMS (Signalling & Telecom / S&T)
- TDMS (Traction / TRD 25kV OHE)

Performs deterministic spatial clustering (<= 100m / 0.1km tolerance) on the same corridor
to merge co-located equipment into canonical physical assets with cross-references.
"""

import os
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field, asdict
from collections import defaultdict
from app.services.file_repository import file_repo

logger = logging.getLogger("AssetMasterRegistry")

CRITICALITY_RANK = {
    "CRITICAL": 4,
    "HIGH": 3,
    "MEDIUM": 2,
    "LOW": 1
}

STATUS_RANK = {
    "DEFECT_LOGGED": 3,
    "MAINTENANCE_DUE": 2,
    "OPERATIONAL": 1
}

DEPARTMENT_MAP = {
    "tms": "Engineering",
    "engineering": "Engineering",
    "civil": "Engineering",
    "p-way": "Engineering",
    "smms": "S&T",
    "s&t": "S&T",
    "signalling": "S&T",
    "signals & telecom": "S&T",
    "tdms": "Traction",
    "traction": "Traction",
    "trd": "Traction",
    "electrical": "Traction"
}


@dataclass
class CrossReference:
    TMS_id: Optional[str] = None
    SMMS_id: Optional[str] = None
    TDMS_id: Optional[str] = None


@dataclass
class ReconciliationMetadata:
    is_merged: bool = False
    component_count: int = 1
    merged_departments: List[str] = field(default_factory=list)
    raw_ids: List[str] = field(default_factory=list)
    km_span: float = 0.0


@dataclass
class CanonicalAsset:
    asset_id: str
    asset_type: str
    subtype: str
    station: str
    division: str
    zone: str
    corridor_id: str
    km: float
    owning_departments: List[str]
    owning_department: str
    install_date: str
    condition_score: float
    criticality: str
    status: str
    cross_reference: Dict[str, Optional[str]]
    reconciliation_metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class AssetRegistryService:
    def __init__(self):
        self._registry: List[Dict[str, Any]] = []
        self._raw_id_to_canonical: Dict[str, Dict[str, Any]] = {}
        self._dept_raw_to_canonical: Dict[Tuple[str, str], Dict[str, Any]] = {}
        self._canonical_id_to_asset: Dict[str, Dict[str, Any]] = {}
        self._corridor_index: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self._summary: Dict[str, Any] = {}
        self._is_initialized = False

    def initialize(self, force_rebuild: bool = False) -> None:
        """
        Initializes the registry from storage or triggers reconciliation.
        """
        if self._is_initialized and not force_rebuild:
            return

        existing = file_repo.get_asset_master_registry()
        if existing and not force_rebuild:
            self._registry = existing
            self._build_in_memory_indices()
            self._generate_summary()
            self._is_initialized = True
            logger.info(f"Loaded {len(self._registry)} canonical assets from storage.")
        else:
            self.build_and_save_registry()

    def build_and_save_registry(self) -> Dict[str, Any]:
        """
        Reconciles raw assets from TMS, SMMS, and TDMS and writes
        data/03_unified/asset_master_registry.json.
        """
        tms_raw = file_repo.get_raw_tms_assets()
        smms_raw = file_repo.get_raw_smms_assets()
        tdms_raw = file_repo.get_raw_tdms_assets()

        canonical_list = self.reconcile_raw_assets(tms_raw, smms_raw, tdms_raw, spatial_tolerance_km=0.10)
        self._registry = canonical_list
        self._build_in_memory_indices()
        self._generate_summary()
        self._is_initialized = True

        # Save to FileRepository
        file_repo.save_asset_master_registry(self._registry)
        logger.info(
            f"Canonical Asset Master Registry built: {len(self._registry)} assets "
            f"({self._summary.get('multi_department_merged', 0)} multi-department merges)."
        )
        return self._summary

    def reconcile_raw_assets(
        self,
        tms_assets: List[Dict[str, Any]],
        smms_assets: List[Dict[str, Any]],
        tdms_assets: List[Dict[str, Any]],
        spatial_tolerance_km: float = 0.10
    ) -> List[Dict[str, Any]]:
        """
        Core reconciliation algorithm:
        1. Normalizes and tags all raw records with department and source.
        2. Partitions by corridor_id.
        3. Spatially clusters records within tolerance, ensuring at most one asset
           per department in any physical cluster.
        4. Aggregates metadata into canonical Asset objects.
        """
        tagged_records: List[Dict[str, Any]] = []

        for a in tms_assets:
            rec = dict(a)
            rec["_dept"] = "Engineering"
            rec["_src"] = "TMS"
            tagged_records.append(rec)

        for a in smms_assets:
            rec = dict(a)
            rec["_dept"] = "S&T"
            rec["_src"] = "SMMS"
            tagged_records.append(rec)

        for a in tdms_assets:
            rec = dict(a)
            rec["_dept"] = "Traction"
            rec["_src"] = "TDMS"
            tagged_records.append(rec)

        # Group by corridor
        corridor_groups = defaultdict(list)
        for r in tagged_records:
            corr = (r.get("corridor_id") or "C01").strip().upper()
            corridor_groups[corr].append(r)

        dept_order = {"Engineering": 0, "S&T": 1, "Traction": 2}
        canonical_assets: List[Dict[str, Any]] = []
        global_counter = 1

        for corridor_id in sorted(corridor_groups.keys()):
            records = corridor_groups[corridor_id]
            # Deterministic ordering: km ascending, then department order, then raw asset_id
            records.sort(
                key=lambda x: (
                    round(float(x.get("km", 0.0)), 4),
                    dept_order.get(x.get("_dept", ""), 9),
                    x.get("asset_id", "")
                )
            )

            clusters: List[List[Dict[str, Any]]] = []
            for item in records:
                try:
                    item_km = float(item.get("km", 0.0))
                except (ValueError, TypeError):
                    item_km = 0.0

                item_dept = item.get("_dept", "Engineering")

                best_cluster: Optional[List[Dict[str, Any]]] = None
                best_distance = float("inf")

                for cluster in clusters:
                    cluster_depts = [x["_dept"] for x in cluster]
                    # Exactly one item per department in a cluster
                    if item_dept in cluster_depts:
                        continue

                    # Check spatial distance to all components in the cluster
                    all_within = True
                    for c_item in cluster:
                        try:
                            c_km = float(c_item.get("km", 0.0))
                        except (ValueError, TypeError):
                            c_km = 0.0
                        if abs(c_km - item_km) > (spatial_tolerance_km + 1e-6):
                            all_within = False
                            break

                    if all_within:
                        avg_cluster_km = sum(float(x.get("km", 0.0)) for x in cluster) / len(cluster)
                        dist = abs(avg_cluster_km - item_km)
                        if dist < best_distance:
                            best_distance = dist
                            best_cluster = cluster

                if best_cluster is not None:
                    best_cluster.append(item)
                else:
                    clusters.append([item])

            # Now build canonical asset records for this corridor
            for cluster in clusters:
                # Sort cluster components: Engineering > S&T > Traction
                cluster.sort(key=lambda x: dept_order.get(x.get("_dept", ""), 9))

                # Compute representative KM (average rounded to 2 decimals)
                kms = [float(x.get("km", 0.0)) for x in cluster]
                avg_km = round(sum(kms) / len(kms), 2)

                canonical_id = f"CAN-AST-{corridor_id}-{avg_km:06.2f}-{global_counter:04d}"
                global_counter += 1

                # Departments
                owning_depts = [x["_dept"] for x in cluster]
                owning_dept_str = ", ".join(owning_depts)

                # Cross references
                cross_ref = {
                    "TMS_id": next((x["asset_id"] for x in cluster if x["_src"] == "TMS"), None),
                    "SMMS_id": next((x["asset_id"] for x in cluster if x["_src"] == "SMMS"), None),
                    "TDMS_id": next((x["asset_id"] for x in cluster if x["_src"] == "TDMS"), None),
                }

                # Primary asset type & subtype
                # Physical track anchors asset type if present, else S&T, else Traction
                primary = cluster[0]
                asset_type = primary.get("asset_type", "RAIL_GENERIC")
                
                # Composite descriptive subtype
                subtypes = [x.get("subtype", "").strip() for x in cluster if x.get("subtype")]
                unique_subtypes = []
                for s in subtypes:
                    if s and s not in unique_subtypes:
                        unique_subtypes.append(s)
                subtype_desc = " + ".join(unique_subtypes) if unique_subtypes else primary.get("subtype", "")

                # Station, Division, Zone
                station = next((x.get("station") for x in cluster if x.get("station")), "BZA")
                division = next((x.get("division") for x in cluster if x.get("division")), "Vijayawada")
                zone = next((x.get("zone") for x in cluster if x.get("zone")), "SCoR")

                # Install Date: earliest non-empty date
                install_dates = [
                    x.get("installation_date") or x.get("install_date")
                    for x in cluster
                    if (x.get("installation_date") or x.get("install_date"))
                ]
                earliest_install = min(install_dates) if install_dates else "2018-01-01"

                # Condition Score: lowest condition score determines physical risk
                cond_scores = []
                for x in cluster:
                    try:
                        cs = float(x.get("condition_score", 70.0))
                        cond_scores.append(cs)
                    except (ValueError, TypeError):
                        pass
                lowest_cond = min(cond_scores) if cond_scores else 70.0

                # Criticality: highest severity
                crit_scores = [CRITICALITY_RANK.get(str(x.get("criticality", "")).upper(), 2) for x in cluster]
                max_crit_score = max(crit_scores) if crit_scores else 2
                crit_label = next((k for k, v in CRITICALITY_RANK.items() if v == max_crit_score), "MEDIUM")

                # Status: highest severity
                stat_scores = [STATUS_RANK.get(str(x.get("status", "")).upper(), 1) for x in cluster]
                max_stat_score = max(stat_scores) if stat_scores else 1
                stat_label = next((k for k, v in STATUS_RANK.items() if v == max_stat_score), "OPERATIONAL")

                # Reconciliation Metadata
                km_span = round(max(kms) - min(kms), 3) if kms else 0.0
                raw_ids = [x.get("asset_id", "") for x in cluster]

                reconcil_meta = {
                    "is_merged": len(cluster) > 1,
                    "component_count": len(cluster),
                    "merged_departments": owning_depts,
                    "raw_ids": raw_ids,
                    "km_span": km_span
                }

                canonical_obj = CanonicalAsset(
                    asset_id=canonical_id,
                    asset_type=asset_type,
                    subtype=subtype_desc,
                    station=station,
                    division=division,
                    zone=zone,
                    corridor_id=corridor_id,
                    km=avg_km,
                    owning_departments=owning_depts,
                    owning_department=owning_dept_str,
                    install_date=earliest_install,
                    condition_score=lowest_cond,
                    criticality=crit_label,
                    status=stat_label,
                    cross_reference=cross_ref,
                    reconciliation_metadata=reconcil_meta
                )
                canonical_assets.append(canonical_obj.to_dict())

        return canonical_assets

    def _build_in_memory_indices(self) -> None:
        """
        Builds lookup dictionaries and spatial corridor indices for O(1) resolutions.
        """
        self._raw_id_to_canonical.clear()
        self._dept_raw_to_canonical.clear()
        self._canonical_id_to_asset.clear()
        self._corridor_index.clear()

        for asset in self._registry:
            cid = asset["asset_id"]
            self._canonical_id_to_asset[cid] = asset
            self._corridor_index[asset["corridor_id"]].append(asset)

            # Map raw IDs from cross reference
            xref = asset.get("cross_reference", {})
            for key, raw_id in xref.items():
                if raw_id:
                    self._raw_id_to_canonical[raw_id] = asset
                    dept = "Engineering" if "TMS" in key else ("S&T" if "SMMS" in key else "Traction")
                    self._dept_raw_to_canonical[(dept.lower(), raw_id.upper())] = asset

            # Also check reconciliation_metadata raw_ids
            raw_ids = asset.get("reconciliation_metadata", {}).get("raw_ids", [])
            for r in raw_ids:
                if r:
                    self._raw_id_to_canonical[r] = asset

        # Sort spatial corridor index by km for fast spatial lookup
        for corr in self._corridor_index:
            self._corridor_index[corr].sort(key=lambda x: x["km"])

    def _generate_summary(self) -> None:
        """
        Generates reconciliation audit statistics.
        """
        total = len(self._registry)
        merged = [a for a in self._registry if a.get("reconciliation_metadata", {}).get("is_merged")]
        single = [a for a in self._registry if not a.get("reconciliation_metadata", {}).get("is_merged")]

        dept_overlap = defaultdict(int)
        for a in merged:
            depts = tuple(sorted(a.get("owning_departments", [])))
            dept_overlap[" + ".join(depts)] += 1

        corridor_counts = defaultdict(int)
        for a in self._registry:
            corridor_counts[a["corridor_id"]] += 1

        self._summary = {
            "total_canonical_assets": total,
            "multi_department_merged": len(merged),
            "single_department_only": len(single),
            "department_overlap_breakdown": dict(dept_overlap),
            "corridor_distribution": dict(corridor_counts),
            "total_raw_assets_reconciled": sum(
                a.get("reconciliation_metadata", {}).get("component_count", 1) for a in self._registry
            )
        }

    def get_all_assets(self) -> List[Dict[str, Any]]:
        if not self._is_initialized:
            self.initialize()
        return self._registry

    def get_summary(self) -> Dict[str, Any]:
        if not self._is_initialized:
            self.initialize()
        return self._summary

    def get_canonical_asset(self, canonical_id: str) -> Optional[Dict[str, Any]]:
        if not self._is_initialized:
            self.initialize()
        return self._canonical_id_to_asset.get(canonical_id)

    def get_canonical_by_dept_id(self, department: str, raw_id: str) -> Optional[Dict[str, Any]]:
        if not self._is_initialized:
            self.initialize()
        norm_dept = DEPARTMENT_MAP.get(department.strip().lower(), department.strip()).lower()
        match = self._dept_raw_to_canonical.get((norm_dept, raw_id.strip().upper()))
        if match:
            return match
        return self._raw_id_to_canonical.get(raw_id.strip())

    def find_canonical_by_location(
        self,
        corridor_id: str,
        km: float,
        tolerance_km: float = 0.10
    ) -> Optional[Dict[str, Any]]:
        """
        Spatial search: finds the closest canonical asset on the corridor within tolerance.
        """
        if not self._is_initialized:
            self.initialize()
        corr = corridor_id.strip().upper()
        candidates = self._corridor_index.get(corr, [])
        best_match = None
        best_distance = float("inf")

        for asset in candidates:
            dist = abs(asset["km"] - km)
            if dist <= (tolerance_km + 1e-6) and dist < best_distance:
                best_distance = dist
                best_match = asset

        return best_match

    def resolve_asset(
        self,
        raw_id: Optional[str],
        source_system: Optional[str] = None,
        corridor_id: Optional[str] = None,
        km: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Robust resolver for incoming maintenance jobs.
        1. Tries exact raw_id lookup in registry cross-references.
        2. Tries department + raw_id.
        3. Tries corridor + km spatial search within 0.10 km.
        4. Fallback: generates consistent canonical object if unmapped.
        """
        if not self._is_initialized:
            self.initialize()

        # 1. Exact raw ID match
        if raw_id:
            raw_clean = str(raw_id).strip()
            if raw_clean in self._raw_id_to_canonical:
                return self._raw_id_to_canonical[raw_clean]

            # 2. Dept + raw ID match
            if source_system:
                norm_dept = DEPARTMENT_MAP.get(source_system.strip().lower(), source_system.strip()).lower()
                dept_match = self._dept_raw_to_canonical.get((norm_dept, raw_clean.upper()))
                if dept_match:
                    return dept_match

        # 3. Spatial fallback
        if corridor_id is not None and km is not None:
            spatial_match = self.find_canonical_by_location(corridor_id, km, tolerance_km=0.10)
            if spatial_match:
                return spatial_match

        # 4. Fallback synthetic representation
        clean_corridor = (corridor_id or "C01").strip().upper()
        clean_km = float(km) if km is not None else 0.0
        fallback_dept = DEPARTMENT_MAP.get((source_system or "").strip().lower(), "Engineering")

        return {
            "asset_id": f"CAN-AST-{clean_corridor}-{clean_km:06.2f}-UNMAPPED",
            "asset_type": "RAIL_GENERIC",
            "subtype": "Unmapped Field Equipment",
            "station": "OGL",
            "division": "Vijayawada",
            "zone": "SCoR",
            "corridor_id": clean_corridor,
            "km": clean_km,
            "owning_departments": [fallback_dept],
            "owning_department": fallback_dept,
            "install_date": "2020-01-01",
            "condition_score": 70.0,
            "criticality": "MEDIUM",
            "status": "OPERATIONAL",
            "cross_reference": {
                f"{source_system or 'TMS'}_id": raw_id
            },
            "reconciliation_metadata": {
                "is_merged": False,
                "component_count": 1,
                "merged_departments": [fallback_dept],
                "raw_ids": [raw_id] if raw_id else [],
                "km_span": 0.0
            }
        }


asset_registry_service = AssetRegistryService()
