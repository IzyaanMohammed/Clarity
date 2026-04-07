# Key Files (Minimal but Sufficient)

## Absolute Priority (read first)
- `ncertai-backend/main.py`
- `ncertai-backend/services/database.py`
- `ncertai-backend/services/openrouter.py`
- `ncertai-backend/routes/auth.py`
- `project/src/App.tsx`
- `project/src/api/index.ts`

## Core Learning + Assessment Flow
- `ncertai-backend/routes/qa.py`
- `ncertai-backend/routes/practice.py`
- `ncertai-backend/routes/progress.py`
- `project/src/pages/AskAI.tsx`
- `project/src/pages/Practice.tsx`
- `project/src/pages/Dashboard.tsx`

## Creative/Media Flow (video quality critical)
- `ncertai-backend/routes/creative.py`
- `ncertai-backend/services/video_generator.py`
- `project/src/pages/Studio.tsx`

## Content + Upload + Planning
- `ncertai-backend/routes/upload.py`
- `ncertai-backend/routes/summary.py`
- `project/src/pages/OCR.tsx`
- `project/src/pages/Summary.tsx`
- `project/src/pages/StudyPlan.tsx`

## Shared State + UX Infrastructure
- `project/src/utils/storage.ts`
- `project/src/hooks/useCurriculumCatalog.ts`
- `project/src/components/layout/Navbar.tsx`
- `project/vite.config.ts`

## Data and Config
- `ncertai-backend/models/schemas.py`
- `ncertai-backend/requirements.txt`
- `project/package.json`
- `README.md`

## Test/Validation
- `ncertai-backend/smoke_endpoints.py`

## Legacy / lower-priority context
- `files/` (older backup-like copies; inspect only if behavior mismatch appears)
