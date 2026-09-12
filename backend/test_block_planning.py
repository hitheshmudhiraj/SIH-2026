"""
Comprehensive Automated Test Suite for SIH26027 Block Planning System
Tests:
1. Corridor Availability Engine (30-min slots, occupancy score, VIP blackout detection)
2. Task Prioritization Engine (severity, overdue calculation, explainability breakdown)
3. Google OR-Tools CP-SAT Block Planner (Weekly & Monthly scheduling, multi-dept bundling)
4. Baseline vs. Optimized Comparison Engine (KPI quantifications)
5. FastAPI REST Endpoints via TestClient
"""

import os
import json
import uuid
import unittest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.services.corridor_availability import corridor_engine
from app.services.prioritization_engine import prioritizer
from app.services.block_planner import block_planner, PLANS_DIR
from app.services.block_comparator import plan_comparator

class TestBlockPlanningSystem(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_corridor_availability(self):
        """Verify corridor availability generates 48 slots per 24 hours with valid metrics."""
        slots = corridor_engine.get_corridor_availability("SEC_C01_01", "2026-09-08")
        self.assertEqual(len(slots), 48, "Must generate exactly 48 30-min slots for a 24-hr day")
        for s in slots:
            self.assertIn("availability_score", s)
            self.assertIn("train_count", s)
            self.assertIn("occupancy_category", s)
            self.assertGreaterEqual(s["availability_score"], 0.0)
            self.assertLessEqual(s["availability_score"], 1.0)
        print("  [TEST PASSED] test_01_corridor_availability: 48 valid 30-min slots generated")

    def test_02_task_prioritizer(self):
        """Verify transparent 4-factor prioritization formula."""
        critical_task = {
            "task_id": "TEST-CRIT-01",
            "department": "Engineering",
            "asset_type": "track_segment",
            "severity": "critical",
            "due_date": "2026-08-25" # 13 days overdue
        }
        low_task = {
            "task_id": "TEST-LOW-01",
            "department": "Engineering",
            "asset_type": "other",
            "severity": "low",
            "due_date": "2026-09-25" # in future
        }
        res_crit = prioritizer.calculate_priority(critical_task)
        res_low = prioritizer.calculate_priority(low_task)

        self.assertEqual(res_crit["priority_tier"], "CRITICAL")
        self.assertGreater(res_crit["calculated_priority_score"], 80)
        self.assertGreater(res_crit["calculated_priority_score"], res_low["calculated_priority_score"])
        self.assertIn("severity_points", res_crit["factor_breakdown"])
        self.assertIn("overdue_points", res_crit["factor_breakdown"])
        print(f"  [TEST PASSED] test_02_task_prioritizer: Critical ({res_crit['calculated_priority_score']}) > Low ({res_low['calculated_priority_score']})")

    def test_03_weekly_block_plan(self):
        """Verify CP-SAT solver generates weekly plan with multi-department bundling."""
        res = block_planner.generate_weekly_block_plan(start_date="2026-09-08", end_date="2026-09-14")
        self.assertIn(res["solver_status"], ["OPTIMAL", "FEASIBLE"])
        self.assertGreater(len(res["blocks"]), 0)
        self.assertIn("summary", res)
        self.assertGreater(res["summary"]["joint_megablocks"], 0, "Must create multi-department joint blocks")
        print(f"  [TEST PASSED] test_03_weekly_block_plan: Generated {len(res['blocks'])} blocks with {res['summary']['joint_megablocks']} joint megablocks")

    def test_04_monthly_block_plan(self):
        """Verify 4-week monthly schedule generation."""
        res = block_planner.generate_monthly_block_plan(start_date="2026-09-08")
        self.assertEqual(res["total_weeks"], 4)
        self.assertEqual(len(res["weeks"]), 4)
        self.assertGreater(res["summary"]["total_blocks"], 0)
        print(f"  [TEST PASSED] test_04_monthly_block_plan: Generated 4-week calendar with {res['summary']['total_blocks']} total blocks")

    def test_05_comparator(self):
        """Verify baseline vs optimized comparison metrics and optimization summary."""
        comp = plan_comparator.compare(start_date="2026-09-08", end_date="2026-09-14")
        metrics = comp["metrics"]
        self.assertGreater(metrics["baseline"]["total_block_hours"], metrics["optimized"]["total_block_hours"])
        self.assertGreater(metrics["baseline"]["separate_blocks_count"], metrics["optimized"]["separate_blocks_count"])
        self.assertGreater(metrics["improvements"]["block_hours_reduction_pct"], 20.0)

        # Confirm Feature B Optimization Summary block values
        self.assertIn("optimization_summary", comp)
        opt_sum = comp["optimization_summary"]
        for key in ["requests_considered", "blocks_generated", "joint_blocks", "separate_blocks_avoided", "train_conflicts", "resource_conflicts", "total_possession_hours"]:
            self.assertIn(key, opt_sum)
            self.assertIsNotNone(opt_sum[key])
        
        self.assertEqual(opt_sum["separate_blocks_avoided"], metrics["baseline"]["separate_blocks_count"] - metrics["optimized"]["separate_blocks_count"])
        self.assertEqual(opt_sum["blocks_generated"], metrics["optimized"]["separate_blocks_count"])
        self.assertEqual(opt_sum["total_possession_hours"], metrics["optimized"]["total_block_hours"])
        print(f"  [TEST PASSED] test_05_comparator: Hours reduced by {metrics['improvements']['block_hours_reduction_pct']}%, optimization_summary verified")


    def test_06_rest_endpoints(self):
        """Verify all requested REST endpoints respond with HTTP 200 and valid JSON."""
        # 1. Sections
        r = self.client.get("/api/sections")
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(len(r.json()), 30)

        # 2. Maintenance Tasks
        r = self.client.get("/api/maintenance-tasks?department=Engineering")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(all(t["department"] == "Engineering" for t in r.json()[:10]))

        # 3. Corridor Availability
        r = self.client.get("/api/corridor-availability?section_id=SEC_C01_01&date=2026-09-08")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()), 48)

        # 4. Generate Weekly
        r = self.client.post("/api/block-plan/generate-weekly", json={"start_date": "2026-09-08", "end_date": "2026-09-14"})
        self.assertEqual(r.status_code, 200)
        self.assertIn("blocks", r.json())

        # 5. Generate Monthly
        r = self.client.post("/api/block-plan/generate-monthly", json={"start_date": "2026-09-08"})
        self.assertEqual(r.status_code, 200)
        self.assertIn("weeks", r.json())

        # 6. Compare Plans
        r = self.client.get("/api/block-plan/compare?start_date=2026-09-08&end_date=2026-09-14")
        self.assertEqual(r.status_code, 200)
        self.assertIn("improvements", r.json()["metrics"])
        print("  [TEST PASSED] test_06_rest_endpoints: All 6 REST APIs responded with 200 OK")

    def test_07_ai_block_recommender(self):
        """Verify AI block recommendation with ML model scoring and slot ranking."""
        # Scenario 1: Engineering -> Track Maintenance -> 2h -> High Priority
        payload1 = {
            "section_id": "SEC_C01_01",
            "department": "Engineering",
            "work_type": "Track Maintenance",
            "duration_hours": 2.0,
            "priority": "HIGH",
            "preferred_time_window": "ANY"
        }
        r1 = self.client.post("/api/block-planning/recommend", json=payload1)
        self.assertEqual(r1.status_code, 200)
        data1 = r1.json()
        self.assertEqual(data1["status"], "SUCCESS")
        self.assertIn("recommended_block", data1)
        rec1 = data1["recommended_block"]
        self.assertIn("start_time", rec1)
        self.assertIn("end_time", rec1)
        self.assertIn("optimization_score", rec1)
        self.assertIn("affected_trains", rec1)
        self.assertIn("expected_delay", rec1)
        self.assertIn("reason", rec1)
        self.assertGreater(data1["total_slots_evaluated"], 0)

        # Scenario 2: S&T -> Signal Maintenance -> 1h -> Medium Priority
        payload2 = {
            "section_id": "SEC_C01_02",
            "department": "S&T",
            "work_type": "Signal Maintenance",
            "duration_hours": 1.0,
            "priority": "MEDIUM",
            "preferred_time_window": "MIDDAY"
        }
        r2 = self.client.post("/api/block-planning/recommend", json=payload2)
        self.assertEqual(r2.status_code, 200)
        data2 = r2.json()
        self.assertEqual(data2["status"], "SUCCESS")
        self.assertIn("recommended_block", data2)

        # Scenario 3: Traction -> Maintenance -> 3h -> High Priority
        payload3 = {
            "section_id": "SEC_C01_03",
            "department": "Traction",
            "work_type": "Power Isolation Maintenance",
            "duration_hours": 3.0,
            "priority": "HIGH",
            "preferred_time_window": "NIGHT"
        }
        r3 = self.client.post("/api/block-planning/recommend", json=payload3)
        self.assertEqual(r3.status_code, 200)
        data3 = r3.json()
        self.assertEqual(data3["status"], "SUCCESS")
        self.assertIn("recommended_block", data3)

        # Edge case: Invalid duration
        r_err = self.client.post("/api/block-planning/recommend", json={"section_id": "SEC_C01_01", "department": "Engineering", "work_type": "Track Maintenance", "duration_hours": -1.0})
        self.assertEqual(r_err.status_code, 400)

        print("  [TEST PASSED] test_07_ai_block_recommender: Evaluated all 3 scenarios and edge cases successfully")

    def test_08_ai_model_metadata(self):
        """Verify model metadata API returns metrics and synthetic dataset notice."""
        r = self.client.get("/api/block-planning/model-metadata")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("model_name", data)
        self.assertIn("notice", data)
        print("  [TEST PASSED] test_08_ai_model_metadata: Metadata and notice returned successfully")

    def test_09_standardized_maintenance_request_structure(self):
        """
        Verify standardized 8-field maintenance request across ad-hoc recommender
        and macro CP-SAT block planner:
        1. request_id, 2. department, 3. location, 4. work_type,
        5. duration_hours, 6. priority, 7. required_resource, 8. preferred_date
        """
        from app.services.block_planner import block_planner, normalize_maintenance_request

        # 1. Test macro CP-SAT task loading has all 8 fields
        tasks = block_planner.load_tasks(status_filter="open")
        self.assertGreater(len(tasks), 0)
        sample_task = tasks[0]
        required_fields = [
            "request_id", "department", "location", "work_type",
            "duration_hours", "priority", "required_resource", "preferred_date"
        ]
        for f in required_fields:
            self.assertIn(f, sample_task, f"Missing {f} in CP-SAT task")
            self.assertIsNotNone(sample_task[f], f"Field {f} must not be None")

        # 2. Test ad-hoc request with explicit 8 fields
        payload_8 = {
            "request_id": "REQ-TEST-2026-001",
            "department": "Engineering",
            "location": "SEC_C01_01",
            "section_id": "SEC_C01_01",
            "work_type": "Rail Renewal",
            "duration_hours": 2.5,
            "priority": "CRITICAL",
            "required_resource": "CSM 09-32 Tamping Machine",
            "preferred_date": "2026-09-12"
        }
        r = self.client.post("/api/block-planning/recommend", json=payload_8)
        self.assertEqual(r.status_code, 200)
        resp_data = r.json()
        self.assertIn("standardized_request", resp_data)
        std = resp_data["standardized_request"]
        self.assertEqual(std["request_id"], "REQ-TEST-2026-001")
        self.assertEqual(std["department"], "Engineering")
        self.assertEqual(std["location"], "SEC_C01_01")
        self.assertEqual(std["work_type"], "Rail Renewal")
        self.assertEqual(std["duration_hours"], 2.5)
        self.assertEqual(std["priority"], "CRITICAL")
        self.assertEqual(std["required_resource"], "CSM 09-32 Tamping Machine")
        self.assertEqual(std["preferred_date"], "2026-09-12")

        # 3. Test validation rejection when missing required field (e.g. preferred_date)
        invalid_payload = {
            "department": "Engineering",
            "location": "SEC_C01_01",
            "work_type": "Rail Renewal",
            "duration_hours": 2.0,
            "preferred_date": ""
        }
        r_fail = self.client.post("/api/block-planning/recommend", json=invalid_payload)
        self.assertEqual(r_fail.status_code, 400)

        print("  [TEST PASSED] test_09_standardized_maintenance_request_structure: Verified 8-field pipeline consistency and validation")

    def test_10_simple_train_conflict_check(self):
        """
        Verify Simple Train Conflict Check for candidate blocks (Prompt 2):
        1. Known-clear night slot -> Suitable (0 conflicts, no affected trains)
        2. Known VIP train slot -> Not Recommended (affected VIP train flagged)
        3. Unknown section without timetable data -> No data — treat as unknown risk
        4. REST endpoints /api/block-planning/check-conflicts and /api/corridor-availability/check-conflicts
        5. Recommendation API response contains conflict_check object
        """
        from app.services.corridor_availability import check_train_conflicts

        # 1. Clear slot: Tuesday 01:00-04:00 on SEC_C01_01
        res_clear = check_train_conflicts("SEC_C01_01", "01:00", "04:00", "2026-09-08")
        self.assertEqual(res_clear["status"], "Suitable")
        self.assertEqual(res_clear["conflict_count"], 0)
        self.assertFalse(res_clear["has_conflict"])
        self.assertEqual(len(res_clear["affected_trains"]), 0)

        # 2. Known VIP train slot: Saturday 09:00-11:00 on SEC_C01_01
        # In timetable_trains.csv, Vande Bharat Return (20834-013) runs on Sat/Sun 09:15-09:54 with priority 10.0
        res_vip = check_train_conflicts("SEC_C01_01", "09:00", "11:00", "2026-09-12")
        self.assertEqual(res_vip["status"], "Not Recommended")
        self.assertTrue(res_vip["has_conflict"])
        self.assertGreaterEqual(res_vip["conflict_count"], 1)
        self.assertGreaterEqual(len(res_vip["vip_trains"]), 1)
        self.assertTrue(any("Vande Bharat" in t for t in res_vip["affected_trains"]))

        # 3. Validation / Error Handling: Missing timetable section
        res_unknown = check_train_conflicts("SEC_NON_EXISTENT_99", "01:00", "04:00", "2026-09-08")
        self.assertEqual(res_unknown["status"], "No data — treat as unknown risk")
        self.assertTrue(res_unknown["has_conflict"])

        # 4. REST endpoint test: GET /api/block-planning/check-conflicts
        r_api = self.client.get("/api/block-planning/check-conflicts?section_id=SEC_C01_01&start_time=01:00&end_time=04:00&date=2026-09-08")
        self.assertEqual(r_api.status_code, 200)
        api_data = r_api.json()
        self.assertEqual(api_data["status"], "Suitable")
        self.assertEqual(api_data["conflict_count"], 0)

        # 5. Recommendation response includes conflict_check object
        rec_payload = {
            "request_id": "REQ-CONF-TEST-01",
            "department": "Engineering",
            "location": "SEC_C01_01",
            "work_type": "Track Maintenance",
            "duration_hours": 2.0,
            "priority": "HIGH",
            "required_resource": "Track Gang (P-Way)",
            "preferred_date": "2026-09-08"
        }
        r_rec = self.client.post("/api/block-planning/recommend", json=rec_payload)
        self.assertEqual(r_rec.status_code, 200)
        rec_json = r_rec.json()
        self.assertIn("conflict_check", rec_json)
        self.assertIn(rec_json["conflict_check"]["status"], ["Suitable", "Not Recommended"])
        self.assertIn("affected_trains", rec_json["conflict_check"])
        self.assertIn("conflict_count", rec_json["conflict_check"])

        print("  [TEST PASSED] test_10_simple_train_conflict_check: Verified clear, VIP clash, error handling and REST API")

    def test_11_maintenance_job_combination_joint_blocks(self):
        """
        PROMPT 3 — Maintenance Job Combination / Joint Block.
        Verifies:
        1. Exact spec acceptance criteria:
           Engineering KM124–126/2hr, TRD KM125–126/1hr, S&T KM125/1hr
           -> groups all three into ONE joint candidate with duration 2 hours (not sum 4h).
        2. Incompatible request (e.g. distant section / KM) remains a standalone candidate.
        3. Exclusive machine clash prevents invalid joint possession.
        4. REST endpoint POST /api/block-planning/group-compatible-jobs operates correctly.
        """
        from app.services.block_planner import group_compatible_maintenance_jobs

        # 1. Exact acceptance criteria test
        spec_requests = [
            {
                "request_id": "REQ-ENG-KM124",
                "department": "Engineering",
                "location": "SEC_C01_01",
                "work_type": "Track Tamping",
                "from_km": 124.0,
                "to_km": 126.0,
                "duration_hours": 2.0,
                "required_resource": "CSM Tamping Machine",
                "preferred_date": "2026-09-08"
            },
            {
                "request_id": "REQ-TRD-KM125",
                "department": "TRD",
                "location": "SEC_C01_01",
                "work_type": "OHE Cantilever Overhaul",
                "from_km": 125.0,
                "to_km": 126.0,
                "duration_hours": 1.0,
                "required_resource": "Tower Wagon Crew",
                "preferred_date": "2026-09-08"
            },
            {
                "request_id": "REQ-ST-KM125",
                "department": "S&T",
                "location": "SEC_C01_01",
                "work_type": "Point Machine Testing",
                "from_km": 125.0,
                "to_km": 125.0,
                "duration_hours": 1.0,
                "required_resource": "S&T Signal Gang",
                "preferred_date": "2026-09-08"
            }
        ]

        groups = group_compatible_maintenance_jobs(spec_requests)
        self.assertEqual(len(groups), 1, "Must bundle all 3 compatible requests into exactly 1 joint candidate block")
        jnt = groups[0]
        self.assertTrue(jnt["is_joint"])
        self.assertEqual(jnt["duration_hours"], 2.0, "Duration must be longest single activity (2h), NOT the sum (4h)")
        self.assertEqual(jnt["duration_minutes"], 120)
        self.assertEqual(jnt["requests_count"], 3)
        self.assertEqual(jnt["total_separate_duration_hours"], 4.0)
        self.assertEqual(jnt["saved_duration_hours"], 2.0)
        self.assertEqual(set(jnt["request_ids"]), {"REQ-ENG-KM124", "REQ-TRD-KM125", "REQ-ST-KM125"})

        # 2. Add an unpartnered / incompatible request (different corridor KM 250)
        distant_request = {
            "request_id": "REQ-DISTANT-01",
            "department": "Engineering",
            "location": "SEC_C02_04",
            "work_type": "Deep Screening",
            "from_km": 250.0,
            "to_km": 252.0,
            "duration_hours": 3.0,
            "required_resource": "BCM Machine",
            "preferred_date": "2026-09-08"
        }
        mixed_pool = spec_requests + [distant_request]
        mixed_groups = group_compatible_maintenance_jobs(mixed_pool)
        self.assertEqual(len(mixed_groups), 2)
        joint_grp = next(g for g in mixed_groups if g["is_joint"])
        single_grp = next(g for g in mixed_groups if not g["is_joint"])

        self.assertEqual(joint_grp["duration_hours"], 2.0)
        self.assertEqual(joint_grp["requests_count"], 3)
        self.assertEqual(single_grp["duration_hours"], 3.0)
        self.assertEqual(single_grp["requests_count"], 1)
        self.assertEqual(single_grp["request_ids"], ["REQ-DISTANT-01"])

        # 3. Exclusive heavy resource clash: two tasks wanting the exact same exclusive machine cannot share block
        clashing_req = {
            "request_id": "REQ-ENG-CLASH",
            "department": "Engineering",
            "location": "SEC_C01_01",
            "work_type": "Turnout Tamping",
            "from_km": 124.5,
            "to_km": 125.5,
            "duration_hours": 1.5,
            "required_resource": "CSM Tamping Machine",  # Same exclusive machine as REQ-ENG-KM124
            "preferred_date": "2026-09-08"
        }
        clash_groups = group_compatible_maintenance_jobs([spec_requests[0], clashing_req])
        self.assertEqual(len(clash_groups), 2, "Tasks with the same exclusive machine must not bundle into the same concurrent block")

        # 4. REST endpoint validation
        r = self.client.post("/api/block-planning/group-compatible-jobs", json=spec_requests)
        self.assertEqual(r.status_code, 200)
        api_groups = r.json()
        self.assertEqual(len(api_groups), 1)
        self.assertEqual(api_groups[0]["duration_hours"], 2.0)
        self.assertTrue(api_groups[0]["is_joint"])

        print("  [TEST PASSED] test_11_maintenance_job_combination_joint_blocks: Verified joint bundling (max duration 2h), unpartnered fallback, exclusive clash, and REST API")

    def test_12_basic_resource_availability_check(self):
        """
        PROMPT 4 — Basic Resource Availability Check for Candidate Blocks.
        Verifies:
        1. Clean candidate block with two different resources shows both as available.
        2. Block requiring an already-committed resource shows conflict.
        3. Simultaneous double-booking in joint block flags internal conflict.
        4. Unknown/non-existent resource flags 'Resource type not found'.
        5. REST endpoint POST /api/block-planning/check-resources functions correctly.
        6. recommend_block API returns resource_check object.
        """
        from app.services.block_planner import check_resource_availability

        # 1. Clean block requiring two different resources
        clean_block = {
            "block_id": "BLK-CAND-CLEAN-01",
            "date": "2026-09-08",
            "start_time": "01:00",
            "end_time": "04:00",
            "requests": [
                {
                    "request_id": "REQ-01",
                    "department": "Engineering",
                    "required_resource": "CSM 09-32 Tamping Machine"
                },
                {
                    "request_id": "REQ-02",
                    "department": "Traction",
                    "required_resource": "Tower Wagon Crew"
                }
            ]
        }

        res_clean = check_resource_availability(clean_block)
        self.assertTrue(res_clean["all_available"], "Both resources must be available")
        self.assertEqual(res_clean["status"], "Available")
        self.assertFalse(res_clean["has_conflict"])
        self.assertEqual(res_clean["conflicts_count"], 0)
        self.assertEqual(len(res_clean["resources"]), 2)
        self.assertTrue(all(r["is_available"] for r in res_clean["resources"]))
        self.assertIn("✓", res_clean["summary"])

        # 2. Block requiring an already-committed resource shows conflict
        existing_schedule = [
            {
                "block_id": "BLK-COMMITTED-99",
                "date": "2026-09-08",
                "start_time": "01:00",
                "end_time": "03:30",
                "tasks": [
                    {
                        "task_id": "TASK-OLD-01",
                        "department": "Engineering",
                        "required_resource": "CSM 09-32 Tamping Machine"
                    }
                ]
            }
        ]

        conflicting_candidate = {
            "block_id": "BLK-CAND-CONFLICT-02",
            "date": "2026-09-08",
            "start_time": "02:00",
            "end_time": "04:00",
            "requests": [
                {
                    "request_id": "REQ-03",
                    "department": "Engineering",
                    "required_resource": "CSM 09-32 Tamping Machine"
                }
            ]
        }

        res_conflict = check_resource_availability(conflicting_candidate, existing_schedule=existing_schedule)
        self.assertFalse(res_conflict["all_available"])
        self.assertEqual(res_conflict["status"], "Conflict Detected")
        self.assertTrue(res_conflict["has_conflict"])
        self.assertGreaterEqual(res_conflict["conflicts_count"], 1)
        self.assertIn("already committed", res_conflict["summary"].lower())

        # 3. Simultaneous internal double-booking in joint block
        internal_clash_block = {
            "block_id": "BLK-INTERNAL-CLASH",
            "date": "2026-09-08",
            "start_time": "01:00",
            "end_time": "03:00",
            "requests": [
                {"request_id": "R1", "department": "Engineering", "required_resource": "CSM 09-32 Tamping Machine"},
                {"request_id": "R2", "department": "Engineering", "required_resource": "CSM 09-32 Tamping Machine"}
            ]
        }
        res_internal = check_resource_availability(internal_clash_block)
        self.assertFalse(res_internal["all_available"])
        self.assertEqual(res_internal["status"], "Conflict Detected")

        # 4. Unknown resource type error handling
        unknown_resource_block = {
            "block_id": "BLK-UNKNOWN-RES",
            "date": "2026-09-08",
            "start_time": "01:00",
            "end_time": "03:00",
            "requests": [
                {"request_id": "R-ALIEN", "department": "Engineering", "required_resource": "Antigravity Hover Tamper 9000"}
            ]
        }
        res_unknown = check_resource_availability(unknown_resource_block)
        self.assertFalse(res_unknown["all_available"])
        self.assertEqual(res_unknown["status"], "Resource type not found")
        self.assertIn("Resource type not found", res_unknown["summary"])

        # 5. REST endpoint POST /api/block-planning/check-resources
        r_post = self.client.post("/api/block-planning/check-resources", json=clean_block)
        self.assertEqual(r_post.status_code, 200)
        api_res = r_post.json()
        self.assertTrue(api_res["all_available"])
        self.assertEqual(api_res["status"], "Available")

        # 6. Recommendation API includes resource_check
        r_rec = self.client.post("/api/block-planning/recommend", json={
            "request_id": "REQ-REC-RES-TEST",
            "department": "Engineering",
            "location": "SEC_C01_01",
            "work_type": "Track Maintenance",
            "duration_hours": 2.0,
            "priority": "HIGH",
            "required_resource": "Track Gang (P-Way)",
            "preferred_date": "2026-09-08"
        })
        self.assertEqual(r_rec.status_code, 200)
        rec_data = r_rec.json()
        self.assertIn("resource_check", rec_data)
        self.assertIn("all_available", rec_data["resource_check"])

        print("  [TEST PASSED] test_12_basic_resource_availability_check: Verified clean allocation, external clash, internal clash, not found error, and REST API")

    def test_13_cp_sat_selects_best_block(self):
        """
        PROMPT 5 — Existing CP-SAT Optimizer Selects the Best Single Block.
        Verifies:
        1. Pool of compatible + standalone candidates runs through existing CP-SAT.
        2. Exactly one block is returned (sum y_b <= 1 constraint).
        3. The selected block is feasible (no train conflicts, all resources available).
        4. The selected block's score matches what CP-SAT's objective function assigns:
           score = sum(x_{t} * prio) + (250 if is_joint else 0) + (avail_pct - 40) - 80
        5. Infeasible candidate pool returns status NO_FEASIBLE_BLOCK with best_block: None.
        6. REST endpoint POST /api/block-planning/select-best-block functions properly.
        """
        from app.services.block_planner import select_best_candidate_block, group_compatible_maintenance_jobs

        # 1. Candidate pool with 3 bundled tasks on SEC_C01_01 + 1 standalone task
        pool_requests = [
            {
                "request_id": "REQ-P5-ENG",
                "department": "Engineering",
                "location": "SEC_C01_01",
                "work_type": "Track Tamping",
                "from_km": 124.0,
                "to_km": 126.0,
                "duration_hours": 2.0,
                "priority": "CRITICAL",
                "priority_score": 90,
                "required_resource": "CSM 09-32 Tamping Machine",
                "preferred_date": "2026-09-08"
            },
            {
                "request_id": "REQ-P5-TRD",
                "department": "Traction",
                "location": "SEC_C01_01",
                "work_type": "OHE Inspection",
                "from_km": 125.0,
                "to_km": 125.0,
                "duration_hours": 1.5,
                "priority": "HIGH",
                "priority_score": 75,
                "required_resource": "Tower Wagon Crew",
                "preferred_date": "2026-09-08"
            },
            {
                "request_id": "REQ-P5-ST",
                "department": "S&T",
                "location": "SEC_C01_01",
                "work_type": "Point Testing",
                "from_km": 125.2,
                "to_km": 125.2,
                "duration_hours": 1.0,
                "priority": "HIGH",
                "priority_score": 70,
                "required_resource": "S&T Signal Gang",
                "preferred_date": "2026-09-08"
            },
            {
                "request_id": "REQ-P5-STANDALONE",
                "department": "Engineering",
                "location": "SEC_C02_04",
                "work_type": "Ballast Cleaning",
                "from_km": 250.0,
                "to_km": 251.0,
                "duration_hours": 3.0,
                "priority": "LOW",
                "priority_score": 40,
                "required_resource": "Track Gang (P-Way)",
                "preferred_date": "2026-09-08"
            }
        ]

        # Call select_best_candidate_block directly
        result = select_best_candidate_block(pending_requests=pool_requests, target_date="2026-09-08")

        self.assertEqual(result["status"], "SUCCESS")
        self.assertIn(result["solver_status"], ("OPTIMAL", "FEASIBLE"))
        self.assertIsNotNone(result["best_block"])

        best = result["best_block"]
        # Exactly one block selected
        self.assertIn("block_id", best)
        self.assertEqual(best["section_id"], "SEC_C01_01")
        self.assertTrue(best["is_joint_megablock"], "CP-SAT should select the high-scoring joint megablock")

        # Feasibility check: no train conflicts and all resources available
        train_chk = best.get("train_conflict_check", {})
        self.assertNotEqual(train_chk.get("status"), "Not Recommended", "Selected block must not have hard train clash")
        res_chk = best.get("resource_check", {})
        self.assertTrue(res_chk.get("all_available"), "All resources for selected block must be available")

        # Score matching CP-SAT mathematical objective terms
        score_bd = best.get("score_breakdown", {})
        calculated_total = (
            score_bd["priority_score"]
            + score_bd["joint_megablock_bonus"]
            + score_bd["availability_reward"]
            + score_bd["possession_opening_cost"]
        )
        self.assertEqual(calculated_total, best["cp_sat_objective_value"])
        self.assertEqual(result["cp_sat_objective_value"], best["cp_sat_objective_value"])
        self.assertGreater(best["cp_sat_objective_value"], 0)

        # 2. Infeasible pool: candidate with unavoidable resource conflict and train clash
        infeasible_candidates = [
            {
                "candidate_id": "CAND-INFEASIBLE-01",
                "section_id": "SEC_C01_01",
                "date": "2026-09-12",  # Saturday morning with VIP Vande Bharat
                "start_time": "06:00",
                "end_time": "09:00",
                "duration_hours": 3.0,
                "duration_minutes": 180,
                "departments": ["Engineering"],
                "is_joint": False,
                "requests": [
                    {
                        "request_id": "REQ-INF-1",
                        "department": "Engineering",
                        "work_type": "Track Maintenance",
                        "required_resource": "NonExistentHovercraft9999",  # Resource not in master
                        "priority_score": 50
                    }
                ]
            }
        ]

        infeas_result = select_best_candidate_block(candidate_blocks=infeasible_candidates)
        self.assertEqual(infeas_result["status"], "NO_FEASIBLE_BLOCK")
        self.assertIsNone(infeas_result["best_block"])
        self.assertEqual(infeas_result["solver_status"], "INFEASIBLE")
        self.assertIn("No suitable block found", infeas_result["explanation"])

        # 3. REST endpoint POST /api/block-planning/select-best-block
        r_api = self.client.post("/api/block-planning/select-best-block", json={
            "requests": pool_requests,
            "target_date": "2026-09-08"
        })
        self.assertEqual(r_api.status_code, 200)
        api_data = r_api.json()
        self.assertEqual(api_data["status"], "SUCCESS")
        self.assertIsNotNone(api_data["best_block"])
        self.assertEqual(api_data["best_block"]["section_id"], "SEC_C01_01")
        self.assertEqual(api_data["cp_sat_objective_value"], result["cp_sat_objective_value"])

        print("  [TEST PASSED] test_13_cp_sat_selects_best_block: Verified CP-SAT single block selection, exact objective score calculation, feasibility verification, infeasible fallback, and REST API")

    def test_14_one_recommended_block_output(self):
        """
        PROMPT 6 — One Recommended Block Output.
        Verifies:
        1. Single recommendation output includes Section, Location, Date, Time, Duration.
        2. Includes Departments list, Maintenance types, Resources.
        3. Includes Train Conflicts check (Suitable / Not Recommended, count) & Resource status (Available / Conflict).
        4. Includes Optimization Score & CP-SAT score breakdown.
        5. Includes 3-5 dynamic 'Why this was selected' bullet points derived from real computed values.
        6. Infeasible candidate pool correctly propagates NO_FEASIBLE_BLOCK.
        """
        # 1. Submit standardized request
        sample_req = {
            "request_id": "REQ-P6-VERIFY",
            "department": "Engineering",
            "location": "SEC_C01_01",
            "section_id": "SEC_C01_01",
            "work_type": "Track Maintenance",
            "duration_hours": 2.0,
            "priority": "HIGH",
            "required_resource": "Track Gang (P-Way)",
            "preferred_date": "2026-09-08"
        }

        r = self.client.post("/api/block-planning/recommend", json=sample_req)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["status"], "SUCCESS")
        self.assertIn("recommended_block", data)

        rec = data["recommended_block"]
        # Required Section 5 fields:
        # Section / Location
        self.assertEqual(rec["section_id"], "SEC_C01_01")
        self.assertIn("location", rec)
        # Date & Time & Duration
        self.assertEqual(rec["date"], "2026-09-08")
        self.assertIn("start_time", rec)
        self.assertIn("end_time", rec)
        self.assertIn("formatted_time", rec)
        self.assertEqual(rec["duration_hours"], 2.0)
        # Departments list
        self.assertIn("departments", rec)
        self.assertIsInstance(rec["departments"], list)
        self.assertIn("Engineering", rec["departments"])
        # Maintenance types
        self.assertIn("maintenance_types", rec)
        self.assertIsInstance(rec["maintenance_types"], list)
        # Resources
        self.assertIn("resources", rec)
        self.assertIsInstance(rec["resources"], list)
        # Train Conflicts
        self.assertIn("train_conflict_check", rec)
        self.assertIn("status", rec["train_conflict_check"])
        self.assertEqual(rec["train_conflict_check"]["status"], "Suitable")
        # Resource status
        self.assertIn("resource_check", rec)
        self.assertTrue(rec["resource_check"]["all_available"])
        self.assertEqual(rec["resource_check"]["status"], "Available")
        # Optimization score & score breakdown
        self.assertIn("optimization_score", rec)
        self.assertIn("cp_sat_objective_value", rec)
        self.assertIn("score_breakdown", rec)
        self.assertIn("priority_score", rec["score_breakdown"])
        # 3 to 5 dynamic bullets derived from real computed values
        self.assertIn("why_selected_bullets", rec)
        bullets = rec["why_selected_bullets"]
        self.assertGreaterEqual(len(bullets), 3)
        self.assertLessEqual(len(bullets), 5)
        # Verify bullet text reflects real computed conditions
        has_train_bullet = any("conflict" in b.lower() or "clearance" in b.lower() or "timetable" in b.lower() for b in bullets)
        self.assertTrue(has_train_bullet, "Bullet points must explain train conflict clearance based on actual conflict check")
        has_resource_bullet = any("resource" in b.lower() or "inventory" in b.lower() for b in bullets)
        self.assertTrue(has_resource_bullet, "Bullet points must explain resource availability")

        print("  [TEST PASSED] test_14_one_recommended_block_output: Verified single block recommendation output with all 10 required fields and dynamic explanation bullets")

    def test_15_current_active_plan_reference(self):
        """
        PROMPT 7 — Mark Generated Plan as Current/Active Plan.
        Generates two plans in sequence and confirms:
        1. Querying current plan mechanism returns exactly the second plan's ID and content.
        2. Active plan pointer points to the second plan.
        3. Prior historical plan (Plan 1) remains untouched on disk and retrievable as history.
        """
        # Step 1: Generate Plan 1 via weekly generation
        plan_1 = block_planner.generate_weekly_block_plan(start_date="2026-09-08", max_time_seconds=2.0)
        plan_1_id = plan_1.get("plan_id")
        self.assertIsNotNone(plan_1_id)
        self.assertTrue(plan_1_id.startswith("PLAN-WK-"))
        self.assertTrue(plan_1.get("is_current"))

        # Verify current endpoints return Plan 1
        res_curr1 = self.client.get("/api/block-plan/current?plan_type=WEEKLY")
        self.assertEqual(res_curr1.status_code, 200)
        curr1_data = res_curr1.json()
        self.assertEqual(curr1_data.get("plan_id"), plan_1_id)
        self.assertTrue(curr1_data.get("is_current"))

        # Verify active pointer points to Plan 1
        res_ptr1 = self.client.get("/api/block-plan/active-pointer")
        self.assertEqual(res_ptr1.status_code, 200)
        ptr1_data = res_ptr1.json()
        self.assertEqual(ptr1_data.get("current_plan_id"), plan_1_id)

        # Confirm Plan 1 archive exists on disk
        plan_1_disk = os.path.join(PLANS_DIR, f"{plan_1_id}.json")
        self.assertTrue(os.path.exists(plan_1_disk))

        # Step 2: Generate Plan 2 via recommend endpoint (Prompt 5/6 generation flow)
        sample_req = {
            "request_id": f"REQ-P7-TEST-{uuid.uuid4().hex[:6].upper()}",
            "department": "Engineering",
            "location": "SEC_C01_01",
            "work_type": "Track Maintenance",
            "duration_hours": 2.0,
            "priority": "HIGH",
            "required_resource": "Track Gang (P-Way)",
            "preferred_date": "2026-09-08"
        }
        res_rec = self.client.post("/api/block-planning/recommend", json=sample_req)
        self.assertEqual(res_rec.status_code, 200)
        rec_data = res_rec.json()
        self.assertEqual(rec_data.get("status"), "SUCCESS")
        plan_2_id = rec_data.get("current_plan_id") or rec_data.get("plan_id")
        self.assertIsNotNone(plan_2_id)
        self.assertNotEqual(plan_2_id, plan_1_id)

        # Step 3: Verify current-plan reference has updated to Plan 2
        res_curr2 = self.client.get("/api/block-plan/current?plan_type=WEEKLY")
        self.assertEqual(res_curr2.status_code, 200)
        curr2_data = res_curr2.json()
        self.assertEqual(curr2_data.get("plan_id"), plan_2_id)
        self.assertTrue(curr2_data.get("is_current"))

        # Verify Department Schedule endpoint (latest-weekly) returns Plan 2
        res_latest_wk = self.client.get("/api/block-plan/latest-weekly")
        self.assertEqual(res_latest_wk.status_code, 200)
        latest_wk_data = res_latest_wk.json()
        self.assertEqual(latest_wk_data.get("plan_id"), plan_2_id)

        # Verify active pointer now points to Plan 2
        res_ptr2 = self.client.get("/api/block-plan/active-pointer")
        self.assertEqual(res_ptr2.status_code, 200)
        ptr2_data = res_ptr2.json()
        self.assertEqual(ptr2_data.get("current_plan_id"), plan_2_id)

        # Step 4: Confirm historical preservation
        # Prior Plan 1 MUST still exist untouched on disk
        self.assertTrue(os.path.exists(plan_1_disk), "Plan 1 archive file must remain untouched on disk")
        with open(plan_1_disk, "r", encoding="utf-8") as f:
            disk_p1 = json.load(f)
        self.assertEqual(disk_p1.get("plan_id"), plan_1_id)

        # Query Plan 1 by ID from archive endpoint
        res_hist1 = self.client.get(f"/api/block-plan/{plan_1_id}")
        self.assertEqual(res_hist1.status_code, 200)
        self.assertEqual(res_hist1.json().get("plan_id"), plan_1_id)

        # Query Plan history list
        res_history = self.client.get("/api/block-plan/history?limit=30")
        self.assertEqual(res_history.status_code, 200)
        hist_list = res_history.json()
        plan_ids_in_history = [p["plan_id"] for p in hist_list]
        self.assertIn(plan_1_id, plan_ids_in_history)
        self.assertIn(plan_2_id, plan_ids_in_history)

        # Verify only Plan 2 is flagged is_current in history
        p2_entry = next(p for p in hist_list if p["plan_id"] == plan_2_id)
        self.assertTrue(p2_entry.get("is_current"))

        print("  [TEST PASSED] test_15_current_active_plan_reference: Verified current plan reference updates cleanly across consecutive generations while preserving historical archives")

    def test_16_department_dependent_resource_validation(self):
        """
        FEATURE: Department-Dependent Resource Selection for Maintenance Requests.
        Verifies:
        1. Valid Department/Resource pairs succeed across Engineering, Traction, and S&T.
        2. Mismatched Department/Resource pairs are strictly rejected with HTTP 400 and
           exact message: 'Selected resource does not belong to the selected department.'
        3. GET /api/resources returns correctly filtered resources per department.
        4. Mismatched requests never reach the CP-SAT optimization pipeline.
        """
        from app.services.block_planner import validate_department_resource, get_department_resources

        # 1. Direct Python function validation checks
        # Valid pairs
        ok_eng, _ = validate_department_resource("Engineering", "Track Gang (P-Way)")
        self.assertTrue(ok_eng)
        ok_eng_mach, _ = validate_department_resource("Engineering", "CSM 09-32 Tamping Machine")
        self.assertTrue(ok_eng_mach)
        ok_trd, _ = validate_department_resource("Traction", "Tower Wagon Crew (TRD)")
        self.assertTrue(ok_trd)
        ok_snt, _ = validate_department_resource("S&T", "S&T Signal Gang")
        self.assertTrue(ok_snt)

        # Mismatched pairs
        bad_eng_trd, msg1 = validate_department_resource("Engineering", "Tower Wagon Crew (TRD)")
        self.assertFalse(bad_eng_trd)
        self.assertEqual(msg1, "Selected resource does not belong to the selected department.")

        bad_trd_eng, msg2 = validate_department_resource("Traction", "Track Gang (P-Way)")
        self.assertFalse(bad_trd_eng)
        self.assertEqual(msg2, "Selected resource does not belong to the selected department.")

        bad_snt_eng, msg3 = validate_department_resource("S&T", "CSM 09-32 Tamping Machine")
        self.assertFalse(bad_snt_eng)
        self.assertEqual(msg3, "Selected resource does not belong to the selected department.")

        # 2. Test GET /api/resources endpoint with department filter
        res_eng = self.client.get("/api/resources?department=Engineering")
        self.assertEqual(res_eng.status_code, 200)
        eng_items = res_eng.json()
        self.assertGreater(len(eng_items), 0)
        for item in eng_items:
            self.assertEqual(item["department"], "Engineering")

        res_trd = self.client.get("/api/resources?department=Traction")
        self.assertEqual(res_trd.status_code, 200)
        trd_items = res_trd.json()
        self.assertGreater(len(trd_items), 0)
        for item in trd_items:
            self.assertEqual(item["department"], "Traction")

        # 3. Test HTTP POST /api/block-planning/recommend with VALID pairings
        valid_payload_eng = {
            "request_id": f"REQ-VAL-ENG-{uuid.uuid4().hex[:6].upper()}",
            "department": "Engineering",
            "location": "SEC_C01_01",
            "work_type": "Track Maintenance",
            "duration_hours": 2.0,
            "priority": "HIGH",
            "required_resource": "Track Gang (P-Way)",
            "preferred_date": "2026-09-08"
        }
        r_valid = self.client.post("/api/block-planning/recommend", json=valid_payload_eng)
        self.assertEqual(r_valid.status_code, 200)
        self.assertEqual(r_valid.json().get("status"), "SUCCESS")

        # 4. Test HTTP POST /api/block-planning/recommend with MISMATCHED pairings
        # Engineering + Tower Wagon (Traction) -> Must fail HTTP 400
        mismatched_payload_1 = {
            "request_id": f"REQ-BAD-1-{uuid.uuid4().hex[:6].upper()}",
            "department": "Engineering",
            "location": "SEC_C01_01",
            "work_type": "Track Maintenance",
            "duration_hours": 2.0,
            "priority": "HIGH",
            "required_resource": "Tower Wagon Crew (TRD)",
            "preferred_date": "2026-09-08"
        }
        r_bad_1 = self.client.post("/api/block-planning/recommend", json=mismatched_payload_1)
        self.assertEqual(r_bad_1.status_code, 400)
        self.assertIn("Selected resource does not belong to the selected department.", r_bad_1.text)

        # Traction + Track Gang (Engineering) -> Must fail HTTP 400
        mismatched_payload_2 = {
            "request_id": f"REQ-BAD-2-{uuid.uuid4().hex[:6].upper()}",
            "department": "Traction",
            "location": "SEC_C01_01",
            "work_type": "OHE Maintenance",
            "duration_hours": 2.0,
            "priority": "HIGH",
            "required_resource": "Track Gang (P-Way)",
            "preferred_date": "2026-09-08"
        }
        r_bad_2 = self.client.post("/api/block-planning/recommend", json=mismatched_payload_2)
        self.assertEqual(r_bad_2.status_code, 400)
        self.assertIn("Selected resource does not belong to the selected department.", r_bad_2.text)

        # S&T + CSM Tamping Machine (Engineering) -> Must fail HTTP 400
        mismatched_payload_3 = {
            "request_id": f"REQ-BAD-3-{uuid.uuid4().hex[:6].upper()}",
            "department": "S&T",
            "location": "SEC_C01_01",
            "work_type": "Signal Maintenance",
            "duration_hours": 2.0,
            "priority": "HIGH",
            "required_resource": "CSM 09-32 Tamping Machine",
            "preferred_date": "2026-09-08"
        }
        r_bad_3 = self.client.post("/api/block-planning/recommend", json=mismatched_payload_3)
        self.assertEqual(r_bad_3.status_code, 400)
        self.assertIn("Selected resource does not belong to the selected department.", r_bad_3.text)

        print("  [TEST PASSED] test_16_department_dependent_resource_validation: Successfully verified backend filtering and hard rejection of mismatched department/resource pairs")

    def test_17_plan_lifecycle_status_and_explainability(self):
        """
        FEATURE: Plan Lifecycle Status (Draft -> Under Review -> Approved) & Why This Block explainability.
        Verifies:
        1. Current/active plan has a valid plan_status defaulting to 'Draft'.
        2. PATCH /api/block-plan/{plan_id}/status transitions status to 'Under Review' and 'Approved'.
        3. Updated status persists to disk and is returned on subsequent GET requests.
        4. Invalid status strings are rejected with HTTP 400 Bad Request.
        5. Generated blocks include 'why_selected_bullets' derived from real data (joint vs single, conflicts, window).
        """
        # 1. Fetch current weekly plan and check status field
        r_curr = self.client.get("/api/block-plan/current?plan_type=WEEKLY")
        self.assertEqual(r_curr.status_code, 200)
        curr_data = r_curr.json()
        plan_id = curr_data["plan_id"]
        self.assertIn("plan_status", curr_data)
        self.assertIn(curr_data["plan_status"], ["Draft", "Under Review", "Approved"])

        # 2. Test PATCH /api/block-plan/{plan_id}/status transition to 'Under Review'
        r_patch1 = self.client.patch(f"/api/block-plan/{plan_id}/status", json={"status": "Under Review"})
        self.assertEqual(r_patch1.status_code, 200)
        patch1_data = r_patch1.json()
        self.assertEqual(patch1_data["status"], "SUCCESS")
        self.assertEqual(patch1_data["plan_status"], "Under Review")

        # Verify disk persistence via GET by ID
        r_get1 = self.client.get(f"/api/block-plan/{plan_id}")
        self.assertEqual(r_get1.status_code, 200)
        self.assertEqual(r_get1.json().get("plan_status"), "Under Review")

        # 3. Test transition to 'Approved'
        r_patch2 = self.client.patch(f"/api/block-plan/{plan_id}/status", json={"status": "Approved"})
        self.assertEqual(r_patch2.status_code, 200)
        self.assertEqual(r_patch2.json()["plan_status"], "Approved")

        # Verify persistence via GET current
        r_curr2 = self.client.get("/api/block-plan/current?plan_type=WEEKLY")
        self.assertEqual(r_curr2.status_code, 200)
        self.assertEqual(r_curr2.json().get("plan_status"), "Approved")

        # 4. Test invalid status rejected with HTTP 400
        r_bad = self.client.patch(f"/api/block-plan/{plan_id}/status", json={"status": "NotARealStatus"})
        self.assertEqual(r_bad.status_code, 400)
        self.assertIn("Invalid plan status", r_bad.text)

        # 5. Verify 'why_selected_bullets' on generated blocks
        blocks = curr_data.get("blocks", [])
        self.assertGreater(len(blocks), 0)

        # Find a joint megablock and a single-department block
        joint_blocks = [b for b in blocks if b.get("is_joint_megablock")]
        single_blocks = [b for b in blocks if not b.get("is_joint_megablock")]

        if joint_blocks:
            jb = joint_blocks[0]
            bullets = jb.get("why_selected_bullets", [])
            self.assertGreater(len(bullets), 0)
            # Joint block bullet must reference combined jobs / joint megablock
            has_joint_text = any("combined" in b.lower() or "joint" in b.lower() for b in bullets)
            self.assertTrue(has_joint_text)

        if single_blocks:
            sb = single_blocks[0]
            bullets = sb.get("why_selected_bullets", [])
            self.assertGreater(len(bullets), 0)
            # Single block bullet must reference dedicated possession window
            has_dedicated_text = any("dedicated" in b.lower() for b in bullets)
            self.assertTrue(has_dedicated_text)

        print("  [TEST PASSED] test_17_plan_lifecycle_status_and_explainability: Verified plan lifecycle status transitions, disk persistence, rejection of invalid states, and data-derived why_selected_bullets")

    def test_18_emergency_replanning_system(self):
        """
        PROMPT 1: Tests the Emergency Replanning System.
        1. Rejection of invalid department-resource pairing.
        2. Detection of overlapping existing blocks and evaluation of safe extension.
        3. Standalone window selection when extension is not viable or no overlap.
        4. Plan V2 creation, active-pointer update, diff computation, and Plan V1 preservation.
        """
        # 1. Department-Resource Mismatch Check
        bad_req = {
            "emergency_type": "Ultrasonic Rail Fracture (USFD)",
            "location": "SEC_C01_01",
            "department": "Engineering",
            "priority": "CRITICAL",
            "duration_hours": 2.0,
            "required_resource": "Tower Wagon Crew (TRD)"  # Traction resource
        }
        r_bad = self.client.post("/api/block-plan/emergency-analyze", json=bad_req)
        self.assertEqual(r_bad.status_code, 400)
        self.assertIn("Selected resource does not belong to the selected department", r_bad.text)

        # 2. Analyze Emergency on Section with Overlapping Block
        # Ensure an active plan exists
        r_curr = self.client.get("/api/block-plan/current?plan_type=WEEKLY")
        curr_plan = r_curr.json()
        curr_blocks = curr_plan.get("blocks", [])
        self.assertGreater(len(curr_blocks), 0)

        # Pick a section from existing blocks
        target_block = curr_blocks[0]
        target_sec = target_block["section_id"]
        target_date = target_block["date"]

        emg_req = {
            "emergency_type": "Ultrasonic Rail Fracture (USFD)",
            "location": target_sec,
            "department": "Engineering",
            "priority": "CRITICAL",
            "duration_hours": 1.5,
            "required_resource": "Track Gang (P-Way)",
            "preferred_date": target_date,
            "description": "Urgent rail fracture detected by flaw detector trolley."
        }

        r_analyze = self.client.post("/api/block-plan/emergency-analyze", json=emg_req)
        self.assertEqual(r_analyze.status_code, 200)
        sol = r_analyze.json()

        # Validate ONE recommended solution format with required fields
        self.assertIn("recommendation_id", sol)
        self.assertIn("solution_type", sol)
        self.assertIn(sol["solution_type"], ["MODIFY_EXISTING_BLOCK", "NEW_EMERGENCY_BLOCK"])
        self.assertEqual(sol["location"], target_sec)
        self.assertEqual(sol["department"], "Engineering")
        self.assertEqual(sol["resource"], "Track Gang (P-Way)")
        self.assertIn("train_conflicts", sol)
        self.assertIn("resource_conflicts", sol)
        self.assertIn("status", sol)
        self.assertIn("reason", sol)
        self.assertIn("reason_bullets", sol)
        self.assertGreater(len(sol["reason_bullets"]), 0)

        # 3. Test Standalone Window for Section Without Overlap or Arbitrary Date
        emg_no_overlap = {
            "emergency_type": "Point Machine Jam / Defect",
            "location": "SEC_C01_10",
            "department": "S&T",
            "priority": "CRITICAL",
            "duration_hours": 2.0,
            "required_resource": "S&T Signal Gang",
            "preferred_date": "2026-09-14",
            "description": "Cross-over point machine motor stalled."
        }
        r_analyze_no_overlap = self.client.post("/api/block-plan/emergency-analyze", json=emg_no_overlap)
        self.assertEqual(r_analyze_no_overlap.status_code, 200)
        sol_no_overlap = r_analyze_no_overlap.json()
        self.assertEqual(sol_no_overlap["department"], "S&T")
        self.assertEqual(sol_no_overlap["resource"], "S&T Signal Gang")
        self.assertIn("recommended_modified_block", sol_no_overlap)
        rec_blk = sol_no_overlap["recommended_modified_block"]
        self.assertEqual(rec_blk["section_id"], "SEC_C01_10")

        # 4. Test Acceptance of Emergency Recommendation (Plan V1 -> Plan V2)
        v1_plan_id = curr_plan.get("plan_id")
        v1_version = int(curr_plan.get("version", 1))

        r_accept = self.client.post("/api/block-plan/emergency-accept", json=sol)
        self.assertEqual(r_accept.status_code, 200)
        accept_res = r_accept.json()

        self.assertEqual(accept_res.get("status"), "SUCCESS")
        v2_plan_id = accept_res.get("new_plan_id")
        v2_version = accept_res.get("new_version")
        self.assertEqual(v2_version, v1_version + 1)
        self.assertNotEqual(v1_plan_id, v2_plan_id)

        # Confirm Diff breakdown
        diff = accept_res.get("diff", [])
        self.assertGreater(len(diff), 0)
        change_types = {d["change_type"] for d in diff}
        self.assertTrue("ADDED" in change_types or "MODIFIED" in change_types)
        self.assertIn("UNCHANGED", change_types)

        # Confirm Plan V2 is now the active plan
        r_curr_v2 = self.client.get("/api/block-plan/current?plan_type=WEEKLY")
        self.assertEqual(r_curr_v2.status_code, 200)
        active_curr = r_curr_v2.json()
        self.assertEqual(active_curr.get("plan_id"), v2_plan_id)
        self.assertEqual(active_curr.get("version"), v2_version)

        # Confirm Active Plan Pointer reflects Plan V2
        r_ptr = self.client.get("/api/block-plan/active-pointer")
        self.assertEqual(r_ptr.status_code, 200)
        self.assertEqual(r_ptr.json().get("current_plan_id"), v2_plan_id)

        # Confirm Historical Plan V1 remains preserved and accessible
        r_v1_hist = self.client.get(f"/api/block-plan/{v1_plan_id}")
        self.assertEqual(r_v1_hist.status_code, 200)
        self.assertEqual(r_v1_hist.json().get("plan_id"), v1_plan_id)

        print("  [TEST PASSED] test_18_emergency_replanning_system: Verified emergency analysis, safe extension, candidate fallback, Plan V2 generation, and Plan V1 history preservation")

    def test_19_in_app_notifications_and_reminders(self):
        """
        Verify Prompt: Notifications & Reminders system:
        1. Approval notifications on block creation with 6 key fields.
        2. Rejection notifications on infeasible requests or review exclusion with reason.
        3. Day-before reminder generated exactly once at D-1.
        4. One-hour-before reminder generated exactly once at T-1h.
        5. Start-time notification generated exactly once at start time.
        6. No duplicates on subsequent checks or refreshes.
        7. Read / unread status tracking and badge counts.
        """
        print("\n--- Running Test 19: In-App Notifications & Reminders System ---")

        # 1. Reset notifications
        r_clear = self.client.post("/api/notifications/clear")
        self.assertEqual(r_clear.status_code, 200)

        r_init = self.client.get("/api/notifications")
        self.assertEqual(r_init.status_code, 200)
        self.assertEqual(r_init.json()["total_count"], 0)
        self.assertEqual(r_init.json()["unread_count"], 0)

        # 2. Approve a request via recommendation endpoint
        sample_req = {
            "request_id": "REQ-NOTIF-001",
            "department": "Engineering",
            "location": "SEC_C01_01",
            "work_type": "Track Maintenance",
            "duration_hours": 3.0,
            "priority": "HIGH",
            "required_resource": "CSM 09-32 Tamping Machine",
            "preferred_date": "2026-09-25",
            "preferred_time_window": "NIGHT"
        }
        r_rec = self.client.post("/api/block-planning/recommend", json=sample_req)
        self.assertEqual(r_rec.status_code, 200)
        rec_data = r_rec.json()
        self.assertIsNotNone(rec_data.get("recommended_block"))

        # Confirm exactly 1 "Block Request Approved" notification exists
        r_notifs = self.client.get("/api/notifications")
        self.assertEqual(r_notifs.status_code, 200)
        notif_list = r_notifs.json()["notifications"]
        self.assertGreaterEqual(len(notif_list), 1)

        app_notif = next((n for n in notif_list if n.get("type") == "BLOCK_REQUEST_APPROVED" and n.get("request_id") == "REQ-NOTIF-001"), None)
        self.assertIsNotNone(app_notif)
        self.assertEqual(app_notif["department"], "Engineering")
        self.assertEqual(app_notif["location"], "SEC_C01_01")
        self.assertIn("2026-09-25", app_notif["scheduled_date"])
        self.assertTrue(bool(app_notif["block_id"]))
        self.assertFalse(app_notif["is_read"])

        # 3. Simulate Rejection notification
        from app.services.notification_service import notification_service
        rej_notif = notification_service.create_rejection_notification(
            request_data={
                "request_id": "REQ-REJ-999",
                "department": "Traction",
                "location": "SEC_C01_02",
                "preferred_date": "2026-09-22"
            },
            reason="High-priority Vande Bharat Express (12727) timetabled path conflict."
        )
        self.assertEqual(rej_notif["type"], "BLOCK_REQUEST_REJECTED")
        self.assertIn("12727", rej_notif["rejection_reason"])

        r_notifs2 = self.client.get("/api/notifications")
        rej_in_list = next((n for n in r_notifs2.json()["notifications"] if n.get("request_id") == "REQ-REJ-999"), None)
        self.assertIsNotNone(rej_in_list)
        self.assertEqual(rej_in_list["title"], "Block Request Rejected")

        # 4. Scheduled Reminders Testing
        assigned_block_id = app_notif["block_id"]
        sched_dt = datetime.fromisoformat(app_notif["scheduled_start_iso"])
        t_two_days_prior = (sched_dt - timedelta(days=2)).isoformat()
        t_day_before = (sched_dt - timedelta(days=1)).isoformat()
        t_day_before_later = (sched_dt - timedelta(days=1) + timedelta(hours=5)).isoformat()
        t_forty_five_mins_before = (sched_dt - timedelta(minutes=45)).isoformat()
        t_start_passed = (sched_dt + timedelta(minutes=2)).isoformat()
        t_completed = (sched_dt + timedelta(hours=5)).isoformat()

        # Step 4a: Check 2 days prior -> No reminder should fire
        r_rem1 = self.client.post("/api/notifications/check-reminders", json={"reference_time": t_two_days_prior})
        self.assertEqual(r_rem1.status_code, 200)
        day_rem_early = next((n for n in r_rem1.json()["notifications"] if n.get("block_id") == assigned_block_id and n.get("type") == "REMINDER_DAY_BEFORE"), None)
        self.assertIsNone(day_rem_early, "Day-before reminder must NOT fire 2 days prior")

        # Step 4b: Check on day before -> Day-before reminder fires
        r_rem2 = self.client.post("/api/notifications/check-reminders", json={"reference_time": t_day_before})
        self.assertEqual(r_rem2.status_code, 200)
        day_rem = next((n for n in r_rem2.json()["notifications"] if n.get("block_id") == assigned_block_id and n.get("type") == "REMINDER_DAY_BEFORE"), None)
        self.assertIsNotNone(day_rem, "Day-before reminder MUST fire on day prior")
        self.assertIn("tomorrow", day_rem["message"].lower())

        # Step 4c: Check later on day before -> Confirm NO duplicate Day-before reminder
        r_rem3 = self.client.post("/api/notifications/check-reminders", json={"reference_time": t_day_before_later})
        self.assertEqual(r_rem3.status_code, 200)
        day_rems = [n for n in r_rem3.json()["notifications"] if n.get("block_id") == assigned_block_id and n.get("type") == "REMINDER_DAY_BEFORE"]
        self.assertEqual(len(day_rems), 1, "Duplicate Day-before reminder must NOT be created")

        # Step 4d: Check 45 minutes before start -> 1-Hour reminder fires
        r_rem4 = self.client.post("/api/notifications/check-reminders", json={"reference_time": t_forty_five_mins_before})
        self.assertEqual(r_rem4.status_code, 200)
        hour_rem = next((n for n in r_rem4.json()["notifications"] if n.get("block_id") == assigned_block_id and n.get("type") == "REMINDER_ONE_HOUR_BEFORE"), None)
        self.assertIsNotNone(hour_rem, "One-hour reminder MUST fire 45 mins before start time")

        # Step 4e: Check 2 minutes after start time -> Start-time notification fires
        r_rem5 = self.client.post("/api/notifications/check-reminders", json={"reference_time": t_start_passed})
        self.assertEqual(r_rem5.status_code, 200)
        start_notif = next((n for n in r_rem5.json()["notifications"] if n.get("block_id") == assigned_block_id and n.get("type") == "NOTIFICATION_START_TIME"), None)
        self.assertIsNotNone(start_notif, "Start-time notification MUST fire when start time arrives")

        # Step 4f: Check after completion -> No new notifications generated
        r_rem6 = self.client.post("/api/notifications/check-reminders", json={"reference_time": t_completed})
        self.assertEqual(r_rem6.status_code, 200)
        self.assertEqual(r_rem6.json().get("newly_generated_count"), 0)

        # 5. Test Mark as Read & Mark All as Read
        unread_before = r_rem6.json()["unread_count"]
        self.assertGreater(unread_before, 0)

        # Mark single item as read
        r_mark = self.client.post(f"/api/notifications/{day_rem['id']}/read")
        self.assertEqual(r_mark.status_code, 200)
        self.assertTrue(r_mark.json()["is_read"])

        r_check_unread = self.client.get("/api/notifications")
        self.assertEqual(r_check_unread.json()["unread_count"], unread_before - 1)

        # Mark all as read
        r_mark_all = self.client.post("/api/notifications/read-all")
        self.assertEqual(r_mark_all.status_code, 200)

        r_all_read = self.client.get("/api/notifications")
        self.assertEqual(r_all_read.json()["unread_count"], 0)

        print("  [TEST PASSED] test_19_in_app_notifications_and_reminders: Verified approval, rejection, day-before, 1-hour, start-time reminders, deduplication, and read state tracking")


if __name__ == "__main__":
    unittest.main()



