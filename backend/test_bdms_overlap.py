import sys
import os
import unittest

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.services.file_repository import file_repo

class TestBdmsOverlap(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_direct_collision_detection(self):
        # TMS-JOB-101 is on C01, KM 124.4, due_date 2026-09-09, department Engineering
        # Querying C01 at KM 124.42 (20 meters away) on 2026-09-09 for Traction
        response = self.client.get("/api/blocks/check-overlap", params={
            "corridor_id": "C01",
            "km": 124.42,
            "date_start": "2026-09-09",
            "date_end": "2026-09-09",
            "department": "Traction"
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["has_overlap"])
        self.assertGreaterEqual(data["direct_collisions_count"], 1)
        
        # Check first overlap has DIRECT_COLLISION
        first_collision = next((o for o in data["overlaps"] if o["category"] == "DIRECT_COLLISION"), None)
        self.assertIsNotNone(first_collision)
        self.assertLessEqual(first_collision["distance_m"], 50.0)
        self.assertTrue(first_collision["is_cross_department"])

    def test_joint_opportunity_detection(self):
        # Querying C01 at KM 125.0 (600 meters from KM 124.4) on 2026-09-09
        response = self.client.get("/api/blocks/check-overlap", params={
            "corridor_id": "C01",
            "km": 125.0,
            "date_start": "2026-09-09",
            "date_end": "2026-09-09",
            "department": "S&T"
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["has_overlap"])
        self.assertGreaterEqual(data["joint_opportunities_count"], 1)
        
        joint_opp = next((o for o in data["overlaps"] if o["category"] == "JOINT_BLOCK_OPPORTUNITY"), None)
        self.assertIsNotNone(joint_opp)
        self.assertGreater(joint_opp["distance_m"], 50.0)
        self.assertLessEqual(joint_opp["distance_m"], 2000.0)

    def test_no_overlap_clear_corridor(self):
        # Querying KM 999.0 on C01 where nothing exists
        response = self.client.get("/api/blocks/check-overlap", params={
            "corridor_id": "C01",
            "km": 999.0,
            "date_start": "2026-09-09",
            "date_end": "2026-09-09",
            "department": "Engineering"
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertFalse(data["has_overlap"])
        self.assertEqual(data["overlap_count"], 0)

    def test_submit_proceed_anyway_audit_log(self):
        payload = {
            "corridor_id": "C01",
            "department": "Traction",
            "station": "OGL",
            "km": 124.42,
            "requested_date": "2026-09-09",
            "requested_start": "02:00",
            "requested_end": "05:00",
            "requested_duration_min": 180,
            "reason": "Emergency OHE inspection near Ongole",
            "submission_choice": "PROCEED_ANYWAY",
            "overlap_count": 1
        }
        res = self.client.post("/api/blocks/submit-request", json=payload)
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["submission_choice"], "PROCEED_ANYWAY")
        
        # Verify audit trail contains the event
        audit_logs = file_repo.get_audit_logs(limit=10)
        matched = next((a for a in audit_logs if a.get("details", {}).get("block_request_id") == body["block_request_id"]), None)
        self.assertIsNotNone(matched)
        self.assertEqual(matched["event_type"], "BDMS_REQUEST_CONFLICT_CHECK")
        self.assertEqual(matched["details"]["submission_choice"], "PROCEED_ANYWAY")

    def test_submit_coordinate_joint_block_audit_log(self):
        payload = {
            "corridor_id": "C01",
            "department": "S&T",
            "station": "OGL",
            "km": 125.0,
            "requested_date": "2026-09-09",
            "requested_start": "01:00",
            "requested_end": "04:00",
            "requested_duration_min": 180,
            "reason": "Axle counter testing adjacent to tamping",
            "submission_choice": "COORDINATE_JOINT_BLOCK",
            "coordinated_with_id": "TMS-JOB-101",
            "notified_department": "Engineering",
            "overlap_count": 1
        }
        res = self.client.post("/api/blocks/submit-request", json=payload)
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["submission_choice"], "COORDINATE_JOINT_BLOCK")
        
        # Verify audit trail
        audit_logs = file_repo.get_audit_logs(limit=10)
        matched = next((a for a in audit_logs if a.get("details", {}).get("block_request_id") == body["block_request_id"]), None)
        self.assertIsNotNone(matched)
        self.assertIn("Joint coordination requested", matched["action"])
        self.assertEqual(matched["details"]["coordinated_with_id"], "TMS-JOB-101")

if __name__ == "__main__":
    unittest.main()
