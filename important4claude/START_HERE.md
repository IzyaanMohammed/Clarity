# Clarity - Start Here (AI Context Pack)

This folder is a minimal high-signal pack for an AI agent (Claude/Copilot/etc.) to understand the project quickly.

## Running Services (current local)
- Frontend: http://localhost:5173
- Backend: http://localhost:8010

## Read Order (2 files)
1. `PROJECT_BRAIN.md` - full system understanding (product, architecture, API map, data flow, known issues)
2. `KEY_FILES_MINIMAL.md` - exact file paths to inspect in priority order

## Quick Commands
- Backend:
  - `py -3 -m uvicorn main:app --host 0.0.0.0 --port 8010 --app-dir D:\Desktop\clarity\ncertai-backend`
- Frontend:
  - `$env:VITE_API_URL='http://localhost:8010'; npm --prefix D:\Desktop\clarity\project run dev -- --host 0.0.0.0 --port 5173`
- Smoke test:
  - `cd D:\Desktop\clarity\ncertai-backend`
  - `py -3 -m smoke_endpoints`

## Why this pack exists
The repository has many files and some legacy/staging artifacts. This pack points to the minimum set needed to reason about core behavior without losing critical context.
