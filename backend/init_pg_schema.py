#!/usr/bin/env python3
"""
Initialize PostgreSQL schema for SafeSend alerts.
"""

import os
import sys
from dotenv import load_dotenv

# Load .env file
load_dotenv()

# Add shared to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from shared.db import pg_init_tables

try:
    print("🗄️  Initializing PostgreSQL schema...")
    pg_init_tables()
    print("✅ Schema initialized successfully!")
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
