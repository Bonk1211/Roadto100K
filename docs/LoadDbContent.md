from dotenv import load_dotenv
import os, psycopg2

load_dotenv(".env")

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()

cur.execute("""
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;
""")

tables = [row[0] for row in cur.fetchall()]

for table in tables:
    cur.execute(f'SELECT COUNT(*) FROM "{table}";')
    count = cur.fetchone()[0]
    print(f"{table}: {count} rows")

cur.close()
conn.close()

