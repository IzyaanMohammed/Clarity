# Clarity - Start Here (Standalone AI Handoff)

This folder is intentionally designed so you can share only this folder with another AI and it can still understand the system.
It now contains architecture + code references + API contracts.

## Running Services (current local)
- Frontend: http://localhost:5173
- Backend: http://localhost:8010

## Read Order (4 files)
1. `PROJECT_BRAIN.md` - product + architecture + risks + behavior
2. `BACKEND_REFERENCE.py` - condensed backend reference code
3. `FRONTEND_REFERENCE.tsx` - condensed frontend reference code
4. `API_CONTRACTS.json` - endpoint/request/response schema map

## Quick Commands
- Backend:
  - `py -3 -m uvicorn main:app --host 0.0.0.0 --port 8010 --app-dir D:\Desktop\clarity\ncertai-backend`
- Frontend:
  - `$env:VITE_API_URL='http://localhost:8010'; npm --prefix D:\Desktop\clarity\project run dev -- --host 0.0.0.0 --port 5173`
- Smoke test:
  - `cd D:\Desktop\clarity\ncertai-backend`
  - `py -3 -m smoke_endpoints`

## Why this pack exists
The repository is large and has mixed maturity. This pack keeps the file count low while preserving enough code and system detail for another AI to reason and implement correctly without full repo access.
