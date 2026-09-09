"""
Comprehensive Automated Test Suite for SIH26027 Block Planning System
Tests:
1. Corridor Availability Engine (30-min slots, occupancy score, VIP blackout detection)
2. Task Prioritization Engine (severity, overdue calculation, explainability breakdown)
3. Google OR-Tools CP-SAT Block Planner (Weekly & Monthly scheduling, multi-dept bundling)
4. Baseline vs. Optimized Comparison Engine (KPI quantifications)
5. FastAPI REST Endpoints via TestClient
"""

import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.services.corridor_availability import corridor_engine
from app.services.prioritization_engine import prioritizer
from app.services.block_planner import block_planner
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
        """Verify baseline vs optimized comparison metrics."""
        comp = plan_comparator.compare(start_date="2026-09-08", end_date="2026-09-14")
        metrics = comp["metrics"]
        self.assertGreater(metrics["baseline"]["total_block_hours"], metrics["optimized"]["total_block_hours"])
        self.assertGreater(metrics["baseline"]["separate_blocks_count"], metrics["optimized"]["separate_blocks_count"])
        self.assertGreater(metrics["improvements"]["block_hours_reduction_pct"], 20.0)
        print(f"  [TEST PASSED] test_05_comparator: Hours reduced by {metrics['improvements']['block_hours_reduction_pct']}%")

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

if __name__ == "__main__":
    unittest.main()

