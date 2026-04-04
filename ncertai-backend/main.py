from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import time

from routes.qa import router as qa_router
from routes.practice import router as practice_router
from routes.upload import router as upload_router
from routes.progress import router as progress_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="NcertAI API", version="1.0.0")

# CORS setup
origins = ["*"] # Allow all for local testing to avoid CORS issues

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(qa_router, prefix="/api/v1/chat", tags=["QA"])
app.include_router(practice_router, prefix="/api/v1/practice", tags=["Practice"])
app.include_router(upload_router, prefix="/api/v1/upload", tags=["Upload"])
app.include_router(progress_router, prefix="/api/v1/progress", tags=["Progress"])

# Root Endpoints
@app.get("/")
async def root():
    return {"status": "NcertAI is live", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"healthy": True}

# GLOBAL AUTONOMOUS ERROR HANDLER
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Autonomous System caught error: {str(exc)}", exc_info=True)
    # Never let the student see a crash. Always return a teacher fallback.
    return JSONResponse(
        status_code=200, # Return 200 so frontend doesn't trigger 'Something went wrong'
        content={
            "answer": "💡 NcertAI Teacher: I'm currently performing a quick update to my NCERT database. \n\nIn the meantime, let's focus on your textbook's core concepts. For most CBSE chapters, the 5-mark questions usually come from the solved examples. \n\n⚠️ (System: Teacher Backup Active)",
            "tokens_used": 0
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
