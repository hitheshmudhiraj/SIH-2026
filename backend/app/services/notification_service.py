"""
In-App Notifications & Reminders Service
Covers:
1. Block Request Approved
2. Block Request Rejected
3. Day-Before Reminder (computed strictly from actual scheduled date)
4. One-Hour-Before Reminder (computed strictly from actual scheduled time)
5. Start-Time Notification (computed strictly from actual scheduled time)

Strictly in-app only, file-based persistence at data/04_outputs/notifications/notifications.json.
Deduplication tracked per block and reminder type.
"""

import os
import json
import uuid
import threading
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")
NOTIFICATIONS_DIR = os.path.join(DATA_DIR, "04_outputs", "notifications")
NOTIFICATIONS_FILE = os.path.join(NOTIFICATIONS_DIR, "notifications.json")
PLANS_DIR = os.path.join(DATA_DIR, "04_outputs", "plans")

file_lock = threading.Lock()


class NotificationService:
    def __init__(self):
        os.makedirs(NOTIFICATIONS_DIR, exist_ok=True)
        if not os.path.exists(NOTIFICATIONS_FILE):
            self._save_store({"notifications": [], "fired_reminders": {}})

    def _read_store(self) -> Dict[str, Any]:
        with file_lock:
            if not os.path.exists(NOTIFICATIONS_FILE):
                return {"notifications": [], "fired_reminders": {}}
            try:
                with open(NOTIFICATIONS_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[NotificationService] Error reading {NOTIFICATIONS_FILE}: {e}")
                return {"notifications": [], "fired_reminders": {}}

    def _save_store(self, data: Dict[str, Any]):
        with file_lock:
            os.makedirs(NOTIFICATIONS_DIR, exist_ok=True)
            temp_file = f"{NOTIFICATIONS_FILE}.tmp"
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            os.replace(temp_file, NOTIFICATIONS_FILE)

    def get_notifications(self, limit: int = 100, unread_only: bool = False) -> Dict[str, Any]:
        store = self._read_store()
        all_notifs = store.get("notifications", [])
        
        unread_count = sum(1 for n in all_notifs if not n.get("is_read", False))

        if unread_only:
            filtered = [n for n in all_notifs if not n.get("is_read", False)]
        else:
            filtered = all_notifs

        return {
            "notifications": filtered[:limit],
            "total_count": len(all_notifs),
            "unread_count": unread_count
        }

    def create_notification(
        self,
        notif_type: str,
        title: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None,
        block_id: Optional[str] = None,
        department: Optional[str] = None,
        location: Optional[str] = None,
        scheduled_date: Optional[str] = None,
        scheduled_time: Optional[str] = None,
        scheduled_start_iso: Optional[str] = None,
        rejection_reason: Optional[str] = None
    ) -> Dict[str, Any]:
        store = self._read_store()
        
        entry = {
            "id": f"NOTIF-{uuid.uuid4().hex[:8].upper()}",
            "type": notif_type,
            "title": title,
            "message": message,
            "request_id": request_id,
            "block_id": block_id,
            "department": department,
            "location": location,
            "scheduled_date": scheduled_date,
            "scheduled_time": scheduled_time,
            "scheduled_start_iso": scheduled_start_iso,
            "rejection_reason": rejection_reason,
            "details": details or {},
            "is_read": False,
            "created_at": datetime.now().isoformat(),
            "read_at": None
        }

        notifs = store.get("notifications", [])
        notifs.insert(0, entry)
        # Cap notifications at 500 items
        store["notifications"] = notifs[:500]
        self._save_store(store)
        return entry

    def create_approval_notification(self, request_data: Dict[str, Any], block_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generates Block Request Approved notification with:
        Request ID, Department, Section/Location, Scheduled Date, Scheduled Time, Block ID
        """
        req_id = request_data.get("request_id") or block_data.get("request_id") or "N/A"
        dept = request_data.get("department") or (block_data.get("departments", ["Engineering"])[0] if block_data.get("departments") else "Engineering")
        loc = request_data.get("location") or request_data.get("section_id") or block_data.get("section_id") or block_data.get("location") or "N/A"
        date_str = block_data.get("date") or request_data.get("preferred_date") or "N/A"
        time_str = block_data.get("formatted_time") or f"{block_data.get('start_time', '01:00')} – {block_data.get('end_time', '04:00')}"
        block_id = block_data.get("block_id") or "N/A"

        start_time = block_data.get("start_time", "01:00")
        scheduled_iso = None
        if date_str != "N/A" and start_time:
            try:
                scheduled_iso = f"{date_str}T{start_time}:00"
            except Exception:
                pass

        title = "Block Request Approved"
        message = (
            f"Block request {req_id} for {dept} at {loc} has been approved. "
            f"Scheduled window: {date_str} ({time_str}). Block ID: {block_id}."
        )

        details = {
            "request_id": req_id,
            "department": dept,
            "location": loc,
            "scheduled_date": date_str,
            "scheduled_time": time_str,
            "block_id": block_id,
            "duration_hours": block_data.get("duration_hours", request_data.get("duration_hours", 3.0)),
            "is_joint_megablock": block_data.get("is_joint_megablock", False)
        }

        return self.create_notification(
            notif_type="BLOCK_REQUEST_APPROVED",
            title=title,
            message=message,
            details=details,
            request_id=req_id,
            block_id=block_id,
            department=dept,
            location=loc,
            scheduled_date=date_str,
            scheduled_time=time_str,
            scheduled_start_iso=scheduled_iso
        )

    def create_rejection_notification(self, request_data: Dict[str, Any], reason: Optional[str] = None) -> Dict[str, Any]:
        """
        Generates Block Request Rejected notification with simple reason where available.
        """
        req_id = request_data.get("request_id") or "N/A"
        dept = request_data.get("department") or "Engineering"
        loc = request_data.get("location") or request_data.get("section_id") or "N/A"
        date_str = request_data.get("preferred_date") or "N/A"
        rej_reason = reason or "No feasible slot found. Timetable clearance conflicts or resource unavailability."

        title = "Block Request Rejected"
        message = (
            f"Block request {req_id} for {dept} at {loc} could not be approved. "
            f"Reason: {rej_reason}"
        )

        details = {
            "request_id": req_id,
            "department": dept,
            "location": loc,
            "preferred_date": date_str,
            "rejection_reason": rej_reason
        }

        return self.create_notification(
            notif_type="BLOCK_REQUEST_REJECTED",
            title=title,
            message=message,
            details=details,
            request_id=req_id,
            department=dept,
            location=loc,
            rejection_reason=rej_reason
        )

    def check_and_generate_reminders(self, reference_time: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Scans all approved blocks from current active plan and generates time-based reminders:
        1. Day-Before Reminder: generated once, on the day before the block's actual scheduled date.
        2. One-Hour-Before Reminder: generated once, 1 hour before scheduled start time.
        3. Start-Time Notification: generated once, at scheduled start time.

        Strictly avoids duplicate reminders per block via fired_reminders registry.
        Does not generate reminders for blocks that were already past when approved.
        """
        # Determine current comparison datetime
        if reference_time:
            try:
                now_dt = datetime.fromisoformat(reference_time)
            except Exception:
                try:
                    now_dt = datetime.strptime(reference_time, "%Y-%m-%d %H:%M:%S")
                except Exception:
                    now_dt = datetime.now()
        else:
            now_dt = datetime.now()

        # Load active plan blocks
        active_blocks = self._load_active_plan_blocks()
        if not active_blocks:
            return []

        store = self._read_store()
        fired_reminders = store.get("fired_reminders", {})
        new_notifications = []

        for block in active_blocks:
            status = str(block.get("status", "")).upper()
            # Only consider approved blocks
            if status not in ["APPROVED", "ACTIVE"]:
                continue

            block_id = block.get("block_id")
            if not block_id:
                continue

            date_str = block.get("date")
            start_time_str = block.get("start_time", "01:00")
            if not date_str or not start_time_str:
                continue

            try:
                # Parse scheduled start datetime
                scheduled_start_dt = datetime.strptime(f"{date_str} {start_time_str}", "%Y-%m-%d %H:%M")
            except Exception:
                continue

            req_id = block.get("request_id") or "N/A"
            dept = (block.get("departments") or ["Engineering"])[0] if isinstance(block.get("departments"), list) else block.get("department", "Engineering")
            loc = block.get("section_id") or block.get("location") or "N/A"
            time_formatted = block.get("formatted_time") or f"{start_time_str} – {block.get('end_time', '04:00')}"

            # 1. Day-Before Reminder: Due on the day before the block's scheduled date
            # Specifically: starts at 00:00 on scheduled_start_dt.date() - 1 day, until scheduled start
            day_before_key = f"{block_id}:DAY_BEFORE"
            if day_before_key not in fired_reminders:
                scheduled_date_obj = scheduled_start_dt.date()
                day_before_date = scheduled_date_obj - timedelta(days=1)
                
                # Check if current time has reached or passed the day before (and is before or at start)
                if now_dt.date() >= day_before_date:
                    notif = {
                        "id": f"NOTIF-{uuid.uuid4().hex[:8].upper()}",
                        "type": "REMINDER_DAY_BEFORE",
                        "title": "Day-Before Maintenance Reminder",
                        "message": (
                            f"Reminder: Scheduled maintenance block {block_id} for {dept} at {loc} "
                            f"is scheduled for tomorrow ({date_str}) at {start_time_str}. "
                            f"Verify gang readiness and resource allocation."
                        ),
                        "request_id": req_id,
                        "block_id": block_id,
                        "department": dept,
                        "location": loc,
                        "scheduled_date": date_str,
                        "scheduled_time": time_formatted,
                        "scheduled_start_iso": scheduled_start_dt.isoformat(),
                        "details": {
                            "block_id": block_id,
                            "request_id": req_id,
                            "department": dept,
                            "location": loc,
                            "scheduled_date": date_str,
                            "scheduled_time": time_formatted,
                            "reminder_stage": "DAY_BEFORE"
                        },
                        "is_read": False,
                        "created_at": now_dt.isoformat(),
                        "read_at": None
                    }
                    new_notifications.append(notif)
                    fired_reminders[day_before_key] = now_dt.isoformat()

            # 2. One-Hour-Before Reminder: Due exactly 1 hour before scheduled start time
            one_hour_key = f"{block_id}:ONE_HOUR_BEFORE"
            if one_hour_key not in fired_reminders:
                one_hour_before_dt = scheduled_start_dt - timedelta(hours=1)
                if now_dt >= one_hour_before_dt:
                    notif = {
                        "id": f"NOTIF-{uuid.uuid4().hex[:8].upper()}",
                        "type": "REMINDER_ONE_HOUR_BEFORE",
                        "title": "1-Hour Maintenance Block Alert",
                        "message": (
                            f"Urgent Alert: Maintenance block {block_id} commences in 1 hour at {start_time_str} "
                            f"on section {loc} ({dept}). Ensure track isolation protocol is primed."
                        ),
                        "request_id": req_id,
                        "block_id": block_id,
                        "department": dept,
                        "location": loc,
                        "scheduled_date": date_str,
                        "scheduled_time": time_formatted,
                        "scheduled_start_iso": scheduled_start_dt.isoformat(),
                        "details": {
                            "block_id": block_id,
                            "request_id": req_id,
                            "department": dept,
                            "location": loc,
                            "scheduled_date": date_str,
                            "scheduled_time": time_formatted,
                            "reminder_stage": "ONE_HOUR_BEFORE"
                        },
                        "is_read": False,
                        "created_at": now_dt.isoformat(),
                        "read_at": None
                    }
                    new_notifications.append(notif)
                    fired_reminders[one_hour_key] = now_dt.isoformat()

            # 3. Start-Time Notification: Due at scheduled start time
            start_time_key = f"{block_id}:START_TIME"
            if start_time_key not in fired_reminders:
                if now_dt >= scheduled_start_dt:
                    notif = {
                        "id": f"NOTIF-{uuid.uuid4().hex[:8].upper()}",
                        "type": "NOTIFICATION_START_TIME",
                        "title": "Block Start-Time Notification",
                        "message": (
                            f"Maintenance block {block_id} window is now LIVE on {loc}. "
                            f"Active execution from {time_formatted}. Track possession granted."
                        ),
                        "request_id": req_id,
                        "block_id": block_id,
                        "department": dept,
                        "location": loc,
                        "scheduled_date": date_str,
                        "scheduled_time": time_formatted,
                        "scheduled_start_iso": scheduled_start_dt.isoformat(),
                        "details": {
                            "block_id": block_id,
                            "request_id": req_id,
                            "department": dept,
                            "location": loc,
                            "scheduled_date": date_str,
                            "scheduled_time": time_formatted,
                            "reminder_stage": "START_TIME"
                        },
                        "is_read": False,
                        "created_at": now_dt.isoformat(),
                        "read_at": None
                    }
                    new_notifications.append(notif)
                    fired_reminders[start_time_key] = now_dt.isoformat()

        if new_notifications:
            notifs = store.get("notifications", [])
            # Prepend newest notifications first
            for n in new_notifications:
                notifs.insert(0, n)
            store["notifications"] = notifs[:500]
            store["fired_reminders"] = fired_reminders
            self._save_store(store)

        return new_notifications

    def mark_as_read(self, notification_id: str) -> bool:
        store = self._read_store()
        found = False
        for n in store.get("notifications", []):
            if n.get("id") == notification_id:
                n["is_read"] = True
                n["read_at"] = datetime.now().isoformat()
                found = True
                break
        if found:
            self._save_store(store)
        return found

    def mark_all_as_read(self) -> int:
        store = self._read_store()
        count = 0
        now_str = datetime.now().isoformat()
        for n in store.get("notifications", []):
            if not n.get("is_read", False):
                n["is_read"] = True
                n["read_at"] = now_str
                count += 1
        if count > 0:
            self._save_store(store)
        return count

    def clear_all(self):
        """Resets the store for testing or demo reset."""
        self._save_store({"notifications": [], "fired_reminders": {}})

    def _load_active_plan_blocks(self) -> List[Dict[str, Any]]:
        """Loads blocks from active weekly plan."""
        latest_file = os.path.join(PLANS_DIR, "latest_weekly_plan.json")
        if os.path.exists(latest_file):
            try:
                with open(latest_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return data.get("blocks", [])
            except Exception as e:
                print(f"[NotificationService] Error loading latest_weekly_plan: {e}")
        return []


notification_service = NotificationService()
