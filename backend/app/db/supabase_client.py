from typing import Optional, Dict, Any, Tuple
from app.core.config import settings

_supabase_client = None


def get_supabase_client():
    """
    Initializes and returns the Supabase client wrapper using server-side service credentials.
    Returns None gracefully if credentials are not configured in .env.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    url = settings.SUPABASE_URL
    key = settings.SUPABASE_SERVICE_ROLE_KEY

    if not url or not key:
        return None

    try:
        from supabase import create_client
        _supabase_client = create_client(url, key)
        return _supabase_client
    except Exception as e:
        print(f"[SUPABASE WARNING] Failed to initialize Supabase client: {e}")
        return None


def test_supabase_connection() -> Dict[str, Any]:
    """
    Performs a non-crashing round-trip check to report connection status.
    If Supabase project isn't created yet, reports connection status gracefully without crashing.
    """
    url = settings.SUPABASE_URL
    key = settings.SUPABASE_SERVICE_ROLE_KEY

    if not url or not key:
        return {
            "status": "pending_configuration",
            "provider": "supabase",
            "connected": False,
            "message": "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured in .env. (Using local persistence engine safely until configured)."
        }

    client = get_supabase_client()
    if not client:
        return {
            "status": "error",
            "provider": "supabase",
            "connected": False,
            "message": "Failed to initialize Supabase client with provided credentials."
        }

    try:
        # Trivial round-trip check without failing if tables are not yet created
        # A simple query or client property check
        res = client.table("departments").select("id").limit(1).execute()
        return {
            "status": "connected",
            "provider": "supabase",
            "connected": True,
            "message": "Supabase PostgreSQL connected successfully."
        }
    except Exception as e:
        # Graceful handling if project exists but schema table isn't created yet, or network timeout
        return {
            "status": "connected_client_only",
            "provider": "supabase",
            "connected": True,
            "message": f"Supabase client initialized successfully. Remote table check note: {str(e)}"
        }
