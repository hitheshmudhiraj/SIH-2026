import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.services.block_planner import block_planner, normalize_maintenance_request

class TestStandardizedMaintenanceRequest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_load_tasks_has_all_8_fields(self):
        """Verify that CP-SAT task loader emits the exact 8 standardized fields."""
        tasks = block_planner.load_tasks(status_filter="open")
        self.assertTrue(len(tasks) > 0)
        
        sample = tasks[0]
        fields = [
            "request_id", "department", "location", "work_type",
            "duration_hours", "priority", "required_resource", "preferred_date"
        ]
        for f in fields:
            self.assertIn(f, sample)
            self.assertIsNotNone(sample[f])
            print(f"  [CP-SAT Task Field Verified] {f} = {sample[f]}")

    def test_submit_sample_request_with_8_fields(self):
        """Submit one sample request and confirm it reaches backend with all 8 fields intact."""
        sample_request = {
            "request_id": "REQ-CONFIRM-2026-9999",
            "department": "Engineering",
            "location": "SEC_C01_01",
            "section_id": "SEC_C01_01",
            "work_type": "Track Maintenance",
            "duration_hours": 2.0,
            "priority": "HIGH",
            "required_resource": "Track Gang (P-Way)",
            "preferred_date": "2026-09-18"
        }

        response = self.client.post("/api/block-planning/recommend", json=sample_request)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIn("standardized_request", data)
        std = data["standardized_request"]

        # Confirm all 8 fields are present and intact
        self.assertEqual(std["request_id"], "REQ-CONFIRM-2026-9999")
        self.assertEqual(std["department"], "Engineering")
        self.assertEqual(std["location"], "SEC_C01_01")
        self.assertEqual(std["work_type"], "Track Maintenance")
        self.assertEqual(std["duration_hours"], 2.0)
        self.assertEqual(std["priority"], "HIGH")
        self.assertEqual(std["required_resource"], "Track Gang (P-Way)")
        self.assertEqual(std["preferred_date"], "2026-09-18")

        print("  [Sample Request 8 Fields Confirmed Intact]:")
        for k in ["request_id", "department", "location", "work_type", "duration_hours", "priority", "required_resource", "preferred_date"]:
            print(f"    - {k}: {std[k]}")

    def test_validation_errors(self):
        """Confirm required fields are rejected with 400 if missing."""
        missing_date = {
            "department": "Engineering",
            "location": "SEC_C01_01",
            "work_type": "Track Maintenance",
            "duration_hours": 2.0,
            "preferred_date": ""
        }
        res = self.client.post("/api/block-planning/recommend", json=missing_date)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Preferred Date is required", res.json()["detail"])

        invalid_dur = {
            "department": "Engineering",
            "location": "SEC_C01_01",
            "work_type": "Track Maintenance",
            "duration_hours": 0,
            "preferred_date": "2026-09-18"
        }
        res2 = self.client.post("/api/block-planning/recommend", json=invalid_dur)
        self.assertEqual(res2.status_code, 400)

if __name__ == "__main__":
    unittest.main()
