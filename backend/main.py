"""
Railway Block Planning Platform — Decision Support System
Root entrypoint delegating to modular app.main
"""
import os
import sys

# Add root directory to python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.core.config import settings

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
