import os
import httpx
import logging
import json
from dotenv import load_dotenv

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
load_dotenv(os.path.join(parent_dir, '.env'))

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# ── Model Routing Table ────────────────────────────────────────────────────────
# fast   → Mistral 7B      : 1-mark Q&A, MCQs, flashcards, definitions
# vision → Gemini Flash    : image/PDF uploads, handwritten notes, OCR
# smart  → Gemini 2.5 Pro  : summaries, 5-mark answers, predictions, explanations
# fallback → Gemini Flash  : catches whatever the primary drops
MODELS = {
    "fast":     "mistralai/mistral-7b-instruct:free",
    "vision":   "google/gemini-2.0-flash-exp:free",
    "smart":    "google/gemini-2.5-pro-exp-03-25:free",
    "fallback": "google/gemini-2.0-flash-exp:free",
}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _call_model(messages: list, model: str) -> str | None:
    """Single attempt to call a model. Returns None on any failure."""
    if not OPENROUTER_API_KEY:
        logger.error("❌ OPENROUTER_API_KEY is not set in .env")
        return None

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ncertai.com",
        "X-Title": "NcertAI - CBSE Study Assistant",
    }
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": 2048,
        "temperature": 0.7,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers=headers,
                content=json.dumps(payload),
                timeout=60.0,
            )

        if response.status_code == 200:
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            logger.info(f"✅ [{model}] responded ({len(content)} chars)")
            return content

        # 429 = rate limited, 503 = model unavailable — both worth falling back from
        logger.warning(
            f"⚠️ [{model}] HTTP {response.status_code}: {response.text[:300]}"
        )
        return None

    except httpx.TimeoutException:
        logger.error(f"⏱️ [{model}] timed out after 60s")
        return None
    except Exception as e:
        logger.error(f"❌ [{model}] unexpected error: {str(e)}")
        return None


async def ask_openrouter(messages: list, task_type: str = "fast") -> str:
    """
    Route to the right model with automatic 3-step fallback chain.

    task_type:
        "fast"   → Mistral 7B   (default — MCQs, 1-mark, definitions)
        "vision" → Gemini Flash  (file uploads, images, handwritten notes)
        "smart"  → Gemini 2.5   (summaries, 5-mark, complex explanations)
    """
    # Step 1 — pick primary model
    primary = MODELS.get(task_type, MODELS["fast"])
    result = await _call_model(messages, primary)
    if result:
        return result

    # Step 2 — fall back to Gemini Flash (good all-rounder, handles vision too)
    if primary != MODELS["fallback"]:
        logger.warning(f"Primary [{primary}] failed → falling back to Gemini Flash")
        result = await _call_model(messages, MODELS["fallback"])
        if result:
            return result

    # Step 3 — last resort: Mistral (lightest, most likely to respond under load)
    if primary != MODELS["fast"]:
        logger.warning("Gemini Flash also failed → last resort Mistral")
        result = await _call_model(messages, MODELS["fast"])
        if result:
            return result

    logger.error("🔥 All 3 models failed. Returning teacher fallback message.")
    return (
        "💡 **NcertAI Tutor**: Our AI engines are taking a 30-second chai break ☕. "
        "Please retry — your CBSE prep is too important to wait long!"
    )


def detect_task_type(question: str, marks: int = 0) -> str:
    """
    Automatically detect which model to use based on question content.
    Call this from routes instead of hardcoding task_type.
    """
    q = question.lower()

    # Vision tasks — never auto-detected (always explicit from upload route)

    # Smart tasks — long-form, analytical
    smart_keywords = [
        "explain", "describe", "discuss", "compare", "differentiate",
        "elaborate", "analyse", "analyze", "summary", "summarise", "summarize",
        "5 mark", "5-mark", "long answer", "in detail", "significance",
        "importance", "causes", "effects", "advantages", "disadvantages",
        "how does", "why does", "mechanism", "process of",
    ]
    if marks >= 5 or any(k in q for k in smart_keywords):
        return "smart"

    # Fast tasks — short, factual
    fast_keywords = [
        "define", "what is", "full form", "formula", "1 mark", "1-mark",
        "mcq", "true or false", "fill in the blank", "name the",
        "state the", "write the", "which",
    ]
    if marks <= 1 or any(k in q for k in fast_keywords):
        return "fast"

    # 3-mark answers — Gemini Flash is fine
    if 2 <= marks <= 3:
        return "fast"

    # Default — fast is good enough and cheaper on rate limits
    return "fast"
