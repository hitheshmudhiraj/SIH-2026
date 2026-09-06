from typing import List, Dict, Any, Tuple
import uuid


class ConflictEngine:
    def analyze(
        self,
        work_items: List[Dict[str, Any]],
        timetable_windows: List[Dict[str, Any]],
        corridors_map: Dict[str, str],  # id -> name
        departments_map: Dict[str, str]  # id -> name
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Detects uncoordinated conflicts and identifies grouping compatibility opportunities.
        """
        conflicts = []
        compatibilities = []
        
        # 1. Spatial & Temporal Corridor Overlaps (Uncoordinated Baseline Requests)
        for i in range(len(work_items)):
            for j in range(i + 1, len(work_items)):
                w1 = work_items[i]
                w2 = work_items[j]

                # Same corridor and same requested day
                if w1["corridor_id"] == w2["corridor_id"] and w1.get("requested_day") == w2.get("requested_day"):
                    # Check hour overlap
                    start1 = w1["requested_start_hour"] * 60
                    end1 = w1["requested_end_hour"] * 60
                    start2 = w2["requested_start_hour"] * 60
                    end2 = w2["requested_end_hour"] * 60

                    # Overlap condition: start1 < end2 and start2 < end1
                    if start1 < end2 and start2 < end1:
                        # Check if incompatible or conflicting
                        overlap_start = max(start1, start2)
                        overlap_end = min(end1, end2)
                        
                        conf_id = f"CONF-{uuid.uuid4().hex[:6].upper()}"
                        corridor_name = corridors_map.get(w1["corridor_id"], w1["corridor_id"])
                        dep1 = departments_map.get(w1["department_id"], w1["department_id"])
                        dep2 = departments_map.get(w2["department_id"], w2["department_id"])

                        conflicts.append({
                            "conflict_id": conf_id,
                            "corridor_id": w1["corridor_id"],
                            "corridor_name": corridor_name,
                            "day_of_week": w1.get("requested_day", "Monday"),
                            "start_time": f"{overlap_start//60:02d}:{overlap_start%60:02d}",
                            "end_time": f"{overlap_end//60:02d}:{overlap_end%60:02d}",
                            "conflict_type": "CORRIDOR_OVERLAP",
                            "work_item_ids": [w1["id"], w2["id"]],
                            "work_titles": [w1["title"], w2["title"]],
                            "departments": [dep1, dep2],
                            "description": f"Uncoordinated corridor contention between {dep1} and {dep2} on {corridor_name}. Both request track possession simultaneously without joint block authorization.",
                            "severity": "HIGH"
                        })

                # Resource Contention (Different corridors or same, requiring same specialized machine)
                res1 = w1.get("required_resource")
                res2 = w2.get("required_resource")
                if res1 and res2 and res1 == res2 and res1 in ["CSM_TAMPING_09", "BCM_CLEANER", "CRANE_140T"]:
                    if w1.get("requested_day") == w2.get("requested_day") and w1["id"] != w2["id"]:
                        start1 = w1["requested_start_hour"] * 60
                        end1 = w1["requested_end_hour"] * 60
                        start2 = w2["requested_start_hour"] * 60
                        end2 = w2["requested_end_hour"] * 60
                        if start1 < end2 and start2 < end1:
                            conf_id = f"CONF-RES-{uuid.uuid4().hex[:6].upper()}"
                            dep1 = departments_map.get(w1["department_id"], w1["department_id"])
                            dep2 = departments_map.get(w2["department_id"], w2["department_id"])
                            conflicts.append({
                                "conflict_id": conf_id,
                                "corridor_id": w1["corridor_id"],
                                "corridor_name": corridors_map.get(w1["corridor_id"], w1["corridor_id"]),
                                "day_of_week": w1.get("requested_day", "Monday"),
                                "start_time": f"{max(start1, start2)//60:02d}:00",
                                "end_time": f"{min(end1, end2)//60:02d}:00",
                                "conflict_type": "RESOURCE_CONTENTION",
                                "work_item_ids": [w1["id"], w2["id"]],
                                "work_titles": [w1["title"], w2["title"]],
                                "departments": [dep1, dep2],
                                "description": f"Heavy machine clash: Both items require {res1}. Only 1 machine unit is available in the division.",
                                "severity": "HIGH"
                            })

        # 2. Timetable Interference Conflicts (Requested window hits passenger train blackout)
        for w in work_items:
            w_day = w.get("requested_day", "Monday")
            w_start = w["requested_start_hour"] * 60
            w_end = w["requested_end_hour"] * 60
            for tt in timetable_windows:
                if tt["corridor_id"] == w["corridor_id"] and tt["day_of_week"] == w_day:
                    tt_start = tt["blackout_start_minute"]
                    tt_end = tt["blackout_end_minute"]
                    if w_start < tt_end and tt_start < w_end:
                        conf_id = f"CONF-TT-{uuid.uuid4().hex[:6].upper()}"
                        c_name = corridors_map.get(w["corridor_id"], w["corridor_id"])
                        dep_name = departments_map.get(w["department_id"], w["department_id"])
                        conflicts.append({
                            "conflict_id": conf_id,
                            "corridor_id": w["corridor_id"],
                            "corridor_name": c_name,
                            "day_of_week": w_day,
                            "start_time": f"{max(w_start, tt_start)//60:02d}:{max(w_start, tt_start)%60:02d}",
                            "end_time": f"{min(w_end, tt_end)//60:02d}:{min(w_end, tt_end)%60:02d}",
                            "conflict_type": "TIMETABLE_INTERFERENCE",
                            "work_item_ids": [w["id"]],
                            "work_titles": [w["title"]],
                            "departments": [dep_name],
                            "description": f"Timetable clash with {tt['train_type']} #{tt['train_number']} ({tt['train_name']}). Block cannot be granted without disrupting high-priority passenger punctuality.",
                            "severity": "HIGH"
                        })

        # 3. Compatibility & Shared Grouping Opportunities (Shadow Blocks)
        # Compatible pairings:
        # - Track Maintenance (TDMS) + S&T Signal Inspection (SMMS) on same corridor
        # - OHE Power Block (SMMS_TRD) + Track Bridge Inspection (BDMS) on same corridor
        # - Turnout Tamping + Point Machine Motor Overhaul
        grouped_pairs = set()
        for i in range(len(work_items)):
            for j in range(i + 1, len(work_items)):
                w1 = work_items[i]
                w2 = work_items[j]

                if w1["corridor_id"] == w2["corridor_id"] and w1["department_id"] != w2["department_id"]:
                    pair_key = tuple(sorted([w1["id"], w2["id"]]))
                    if pair_key in grouped_pairs:
                        continue

                    # Check compatibility conditions
                    types = {w1["work_type"], w2["work_type"]}
                    is_compatible = False
                    reason = ""
                    saved_hrs = 2.5

                    if ("TAMPING" in types or "DEEP_SCREENING" in types or "RAIL_WELDING" in types) and ("POINT_OVERHAUL" in types or "TRACK_CIRCUIT_TEST" in types or "SIGNAL_INTERLOCKING" in types):
                        is_compatible = True
                        reason = "Track renewal and S&T point machine calibration can share a single track possession window without mutual interference."
                    elif "OHE_MAINTENANCE" in types and ("GIRDER_PAINTING" in types or "BRIDGE_BEARING_REHAB" in types or "TAMPING" in types):
                        is_compatible = True
                        reason = "OHE power isolation block creates an ideal zero-voltage window for structural bridge works or track geometry correction."
                        saved_hrs = 3.0
                    elif ("ULTRASONIC_USFD" in types or "RAIL_GRINDING" in types) and ("OHE_INSPECTION" in types or "POINT_OVERHAUL" in types):
                        is_compatible = True
                        reason = "Rolling shadow block: non-intrusive rail flaw testing and overhead catenary contact wire profiling can operate co-directionally."
                        saved_hrs = 2.0

                    if is_compatible:
                        grouped_pairs.add(pair_key)
                        compat_id = f"COMPAT-{uuid.uuid4().hex[:6].upper()}"
                        c_name = corridors_map.get(w1["corridor_id"], w1["corridor_id"])
                        dep1 = departments_map.get(w1["department_id"], w1["department_id"])
                        dep2 = departments_map.get(w2["department_id"], w2["department_id"])

                        compatibilities.append({
                            "group_id": compat_id,
                            "corridor_id": w1["corridor_id"],
                            "corridor_name": c_name,
                            "suggested_day": w1.get("requested_day", "Tuesday"),
                            "suggested_start_time": f"{w1['requested_start_hour']:02d}:00",
                            "suggested_end_time": f"{max(w1['requested_end_hour'], w2['requested_end_hour']):02d}:00",
                            "compatible_work_ids": [w1["id"], w2["id"]],
                            "work_titles": [w1["title"], w2["title"]],
                            "departments": [dep1, dep2],
                            "shared_benefit": reason,
                            "estimated_saved_hours": saved_hrs
                        })

        return conflicts, compatibilities


conflict_engine = ConflictEngine()
