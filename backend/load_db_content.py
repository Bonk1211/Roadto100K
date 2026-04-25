#!/usr/bin/env python3
"""Print row counts for every public PostgreSQL table."""

import os
import sys

import psycopg2
from dotenv import load_dotenv
from psycopg2 import sql


BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BACKEND_DIR, ".env"))


def main() -> int:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL is not set. Add it to backend/.env.")
        return 1

    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    try:
        cur.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
            ORDER BY table_name;
            """
        )
        tables = [row[0] for row in cur.fetchall()]

        for table in tables:
            cur.execute(
                sql.SQL("SELECT COUNT(*) FROM {};").format(sql.Identifier(table))
            )
            count = cur.fetchone()[0]
            print(f"{table}: {count} rows")
    finally:
        cur.close()
        conn.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
