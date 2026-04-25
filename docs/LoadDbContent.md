# Load Database Content

Use this command from the repo root to print row counts for every PostgreSQL
table:

```powershell
.\.venv\Scripts\python.exe backend\load_db_content.py
```

Or from inside `backend/`:

```powershell
..\.venv\Scripts\python.exe load_db_content.py
```

The script reads `DATABASE_URL` from `backend/.env`.
