# NcertAI Backend & Frontend

## Backend
- Python 3.11+
- FastAPI
- OpenRouter AI (LLM integration)

## Setup Backend
```bash
cd ncertai-backend
python -m venv venv
# Activate venv
pip install -r requirements.txt
uvicorn main:app --port 8001 --reload
```

## Setup Frontend
```bash
cd project
npm install
npm run dev
```

## Configuration
- Rename `.env.example` to `.env` and add your `OPENROUTER_API_KEY`.
- Backend runs on `http://localhost:8001`.
- Frontend runs on `http://localhost:5173`.
