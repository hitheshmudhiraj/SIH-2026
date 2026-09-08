"""
RailBlock AI — Root Synthetic Data Generator Wrapper
Delegates to backend/generate_synthetic_data.py
"""
import os
import sys

BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
sys.path.insert(0, BACKEND_DIR)

from generate_synthetic_data import main

if __name__ == "__main__":
    main()
