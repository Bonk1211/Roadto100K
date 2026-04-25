#!/usr/bin/env python3
"""
Test PostgreSQL connectivity against AWS RDS.
"""

import os
import sys
import psycopg2
from dotenv import load_dotenv

# Load .env file
load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    print("❌ DATABASE_URL not set. Set it in .env file.")
    sys.exit(1)

print(f"📍 Testing connection to: {DATABASE_URL.split('@')[1].split('/')[0]}")

try:
    print("🔌 Connecting...")
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    print("✅ Connection successful!")
    
    # Test query
    cursor.execute("SELECT version();")
    version = cursor.fetchone()
    print(f"📦 PostgreSQL version: {version[0]}")
    
    # Check if our alerts table exists
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'alerts'
        );
    """)
    table_exists = cursor.fetchone()[0]
    
    if table_exists:
        print("✅ 'alerts' table exists")
        cursor.execute("SELECT COUNT(*) FROM alerts;")
        count = cursor.fetchone()[0]
        print(f"   Records in alerts: {count}")
    else:
        print("⚠️  'alerts' table does not exist yet")
        print("   Run pg_init_tables() to create schema")
    
    cursor.close()
    conn.close()
    
    print("\n✅ All connectivity tests passed!")
    sys.exit(0)
    
except psycopg2.OperationalError as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
