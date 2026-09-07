from datetime import datetime
from fastapi import APIRouter
from app.core.config import settings
from app.db.supabase_client import test_supabase_connection

router = APIRouter(tags=["Health"])


@router.get("/health")
def get_service_health():
    """
    Standard foundation health check.
    Returns service name, timestamp, and status.
    """
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "service": settings.SERVICE_NAME,
        "safety_principle": "HUMAN_APPROVAL_REQUIRED"
    }


@router.get("/health/db")
def get_database_health():
    """
    Database connection round-trip check.
    Reports Supabase connection status gracefully without crashing if unconfigured.
    """
    db_status = test_supabase_connection()
    return {
        **db_status,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
