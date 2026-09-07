import os
from typing import List
from dotenv import load_dotenv

load_dotenv()


class Settings:
    PROJECT_NAME: str = "Railway Block Planning Platform"
    SERVICE_NAME: str = "block-planning-backend"
    VERSION: str = "1.0.0"
    
    # Human-in-the-loop safety principle
    SAFETY_NOTICE: str = "PROTOTYPE — Simulated Data — Human Approval Required. Not an autonomous control system."

    # Supabase credentials (read from environment, never hardcoded)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_KEY", ""))

    # Server & CORS settings
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    CORS_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000").split(",")
        if origin.strip()
    ]


settings = Settings()
