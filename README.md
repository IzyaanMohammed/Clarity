# Clarity: CBSE Student OS

Clarity is a proactive CBSE study ecosystem with a Daily Mission engine, adaptive practice, exam-readiness tracking, OCR workflows, and AI-driven tutoring.

## Product Tiers

- Free
	- NCERT chapter summaries and standard practice
	- 10 deep-dive AI questions/day
	- Community flashcard viewer
- Pro
	- Unlimited chat, practice generation, and summaries
	- Handwriting OCR pre-check
	- Video-to-study-guide generation
- Pro Max
	- Proactive Master AI tutor flows
	- Exam Simulation workflows
	- Parent transparency and readiness insights

## Local Development

### Backend
```bash
cd ncertai-backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd project
npm install
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:8000

## Production with Docker

1. Create root `.env` with at least:
```bash
OPENROUTER_API_KEY=your_key_here
```

2. Build and run:
```bash
docker compose up --build
```

3. Open:
- App: http://localhost:8080
- API health: http://localhost:8000/health

## Production Notes

- Backend uses environment-driven CORS via `CLARITY_CORS_ORIGINS`.
- Security headers are enabled in backend middleware.
- Global server failures now return proper 500 responses.
- SQLite persists through the Docker volume `clarity_data`.
