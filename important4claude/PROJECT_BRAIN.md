# Clarity Project Brain (Minimal Complete Context)

This file explains the system; code-level reference is included in:
- `BACKEND_REFERENCE.py`
- `FRONTEND_REFERENCE.tsx`
- `API_CONTRACTS.json`

If you share only this folder, an AI still gets architecture + endpoint contracts + representative implementation structure.

## 1) Product Intent
Clarity is a CBSE-focused AI study platform with:
- Ask AI tutoring
- Practice generation + grading
- Progress tracking + daily missions
- Summaries/formula sheets/plans
- Studio video and mindmap generation
- OCR + textbook ingestion
- Auth, profile, materials, and snapshot sync

Primary users: school students preparing for board exams.

## 2) System Architecture
- Frontend: React + TypeScript + Vite (`project/`)
- Backend: FastAPI (`ncertai-backend/`)
- DB: SQLite (`ncertai-backend/clarity.db`) via `services/database.py`
- AI gateway: OpenRouter (`services/openrouter.py`)
- Media generation: ffmpeg + PIL (`services/video_generator.py`, `routes/creative.py`)

## 3) Runtime Model
- Frontend talks to backend under `/api/v1/*`
- Dev proxy in Vite maps `/api` to backend target
- Bearer token auth in most user-scoped endpoints
- Progress and materials persisted in SQLite

## 4) Key Backend Domains
- `routes/auth.py`
  - register/login/me/logout
  - curriculum catalog
  - materials and snapshot sync
- `routes/qa.py`
  - ask and streaming ask
- `routes/practice.py`
  - question generation, grading, flashcards, readiness, notifications, mock schedule
- `routes/progress.py`
  - logs/stats/parent report/daily mission
- `routes/summary.py`
  - chapter summary/formula sheet/daily plan
- `routes/upload.py`
  - OCR + textbook extraction
- `routes/creative.py`
  - video generation and mindmap endpoints

## 5) Key Frontend Domains
- `src/App.tsx` - routes + protected layout + session hydrator
- `src/api/index.ts` - full API contracts and request functions
- `src/utils/storage.ts` - local storage state + write-through sync hooks
- `src/hooks/useCurriculumCatalog.ts` - curriculum remote/local fallback
- `src/pages/*` - product surfaces (Dashboard, AskAI, Practice, Studio, OCR, etc.)

## 6) Important Current Constraints
- Some environments fail to bind backend on 8000; 8010 is used as fallback.
- Video external stock retrieval can fail (provider/network variability).
- Creative route has a fallback renderer; telemetry must be checked to know which path ran.
- README has stale port references (mentions 8001) and should be aligned with actual dev flow.

## 7) Known Risks / Tech Debt
- `main.py` has a global exception handler returning HTTP 200 for exceptions; hides real failures and weakens observability.
- Security hardening still needed (session lifecycle/expiry, stricter auth checks in all paths, consistent input validation).
- OpenRouter config and fallback logic is robust but still cost/perf sensitive and provider dependent.
- Local artifacts and generated files can pollute repo if not ignored.

## 8) Video Generation Reality
- External footage path:
  - Fetch external video clips by topic variants
  - Build montage segments per slide
  - Emit manifest + headers (`external_video_count`, `montage_segments_total`, etc.)
- Fallback path:
  - Generates slide-based clip if HQ path errors
  - Should write manifest to avoid zeroed telemetry ambiguity
- Practical conclusion:
  - If external segments remain 0, environment likely blocks providers; quality then depends on procedural fallback sophistication.

## 9) What an AI Agent Should Do First
1. Validate backend+frontend are reachable (`/health`, browser app load)
2. Verify auth/login flow and curriculum fetch
3. Run smoke tests (`py -3 -m smoke_endpoints`)
4. Test Studio video endpoint and inspect response headers/manifest
5. Fix high-severity issues before adding features:
   - Exception handling correctness
   - Auth consistency
   - CORS/dev proxy consistency
   - Video fallback quality and telemetry trustworthiness

## 10) Definition of "Healthy"
- Backend starts cleanly and serves `/health`
- Frontend has no blocking CORS or auth hydration errors
- Smoke tests pass end-to-end
- Studio returns playable MP4 and non-misleading telemetry
- Progress/stats and materials sync work with token auth
