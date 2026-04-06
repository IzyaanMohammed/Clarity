import os
import httpx
import logging
import json
import asyncio
from typing import AsyncGenerator
from dotenv import load_dotenv

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
load_dotenv(os.path.join(parent_dir, '.env'))

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# ── Model Routing Table ────────────────────────────────────────────────────────
# fast   → Mistral-family free model : 1-mark Q&A, MCQs, flashcards
# vision → free image-capable model  : image/PDF uploads, handwritten notes
# smart  → larger free model         : summaries, 5-mark answers, predictions
# fallback → free image-capable model
MODELS = {
    "fast":     "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
    "vision":   "qwen/qwen3.6-plus:free",
    "smart":    "openai/gpt-oss-120b:free",
    "fallback": "qwen/qwen3.6-plus:free",
}

# ── Retry Configuration ────────────────────────────────────────────────────────
MAX_RETRIES = 3  # Total attempts per model
BASE_DELAY = 0.5  # Initial backoff in seconds (500ms)
MAX_DELAY = 8.0  # Cap backoff at 8 seconds
BACKOFF_MULTIPLIER = 2  # Exponential: 0.5s → 1s → 2s → 4s...

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _call_model(messages: list, model: str, attempt: int = 1) -> tuple[str | None, int]:
    """
    Single attempt to call a model with exponential backoff retry.
    Returns (response, attempts_used) or (None, attempts_used) on final failure.
    """
    if not OPENROUTER_API_KEY:
        logger.error("❌ OPENROUTER_API_KEY is not set in .env")
        return None, 1

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://clarity.ai",
        "X-Title": "Clarity - CBSE Study Assistant",
    }
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": 2048,
        "temperature": 0.7,
    }

    for retry in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:  # Reduce timeout to 30s
                response = await client.post(
                    url,
                    headers=headers,
                    content=json.dumps(payload),
                    timeout=30.0,
                )

            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                logger.info(f"✅ [{model}] responded on attempt {retry + 1} ({len(content)} chars)")
                return content, retry + 1

            # 429 = rate limited, 503 = model unavailable — retry with backoff
            if response.status_code in [429, 503]:
                if retry < MAX_RETRIES - 1:
                    delay = min(BASE_DELAY * (BACKOFF_MULTIPLIER ** retry), MAX_DELAY)
                    logger.warning(
                        f"⚠️ [{model}] HTTP {response.status_code} (attempt {retry + 1}/{MAX_RETRIES}). "
                        f"Retrying in {delay:.1f}s..."
                    )
                    await asyncio.sleep(delay)
                    continue
                else:
                    logger.warning(f"⚠️ [{model}] HTTP {response.status_code} after {MAX_RETRIES} attempts")
                    return None, MAX_RETRIES
            else:
                # Other errors: don't retry, move to fallback
                logger.error(f"❌ [{model}] HTTP {response.status_code}: {response.text[:200]}")
                return None, retry + 1

        except httpx.TimeoutException:
            if retry < MAX_RETRIES - 1:
                delay = min(BASE_DELAY * (BACKOFF_MULTIPLIER ** retry), MAX_DELAY)
                logger.warning(
                    f"⏱️ [{model}] timeout (attempt {retry + 1}/{MAX_RETRIES}). "
                    f"Retrying in {delay:.1f}s..."
                )
                await asyncio.sleep(delay)
                continue
            else:
                logger.error(f"⏱️ [{model}] timeout after {MAX_RETRIES} attempts")
                return None, MAX_RETRIES
        
        except Exception as e:
            logger.error(f"❌ [{model}] unexpected error (attempt {retry + 1}): {str(e)}")
            return None, retry + 1

    return None, MAX_RETRIES


async def ask_openrouter(messages: list, task_type: str = "fast") -> str:
    """
    Route to the right model with automatic 3-step fallback chain + retry logic.
    Each model automatically retries up to 3 times with exponential backoff before fallback.

    task_type:
        "fast"   → Mistral (default — MCQs, 1-mark, definitions)
        "vision" → Qwen (file uploads, images, handwritten notes)
        "smart"  → GPT-OSS (summaries, 5-mark, complex explanations)
    """
    # Step 1 — pick primary model and retry with exponential backoff
    primary = MODELS.get(task_type, MODELS["fast"])
    result, attempts = await _call_model(messages, primary)
    if result:
        logger.info(f"✅ PRIMARY MODEL SUCCESS [{primary}] after {attempts} attempt(s)")
        return result
    
    logger.warning(f"⚠️ Primary model failed after {attempts} attempts → trying fallback #1")

    # Step 2 — fall back to Qwen (good all-rounder, handles vision too)
    if primary != MODELS["fallback"]:
        result, attempts = await _call_model(messages, MODELS["fallback"])
        if result:
            logger.info(f"✅ FALLBACK #1 SUCCESS [{MODELS['fallback']}] after {attempts} attempt(s)")
            return result
        logger.warning(f"⚠️ Fallback #1 failed after {attempts} attempts → trying fallback #2")

    # Step 3 — last resort: Mistral (lightest, most likely to respond under load)
    if primary != MODELS["fast"]:
        result, attempts = await _call_model(messages, MODELS["fast"])
        if result:
            logger.info(f"✅ FALLBACK #2 SUCCESS [{MODELS['fast']}] after {attempts} attempt(s)")
            return result
        logger.warning(f"⚠️ Fallback #2 failed after {attempts} attempts → returning teacher fallback")

    # All models failed after retries
    logger.error("🔥 ALL MODELS EXHAUSTED after retries. Returning teacher fallback message.")
    return (
        "💡 **Clarity Tutor**: Our AI engines are taking a 30-second chai break ☕. "
        "Please retry — your CBSE prep is too important to wait long!\n\n"
        "⏳ *Tip: If this keeps happening, try breaking your question into smaller parts.*"
    )


async def _stream_model(messages: list, model: str) -> AsyncGenerator[str, None]:
    """Stream tokens from a single model with retry on transient errors. Yields token chunks."""
    if not OPENROUTER_API_KEY:
        logger.error("OPENROUTER_API_KEY missing for stream request")
        return

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://clarity.ai",
        "X-Title": "Clarity - CBSE Study Assistant",
    }
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": 2048,
        "temperature": 0.7,
        "stream": True,
    }

    for retry in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream(
                    "POST", url, headers=headers, content=json.dumps(payload)
                ) as response:
                    if response.status_code == 200:
                        async for raw_line in response.aiter_lines():
                            if not raw_line or not raw_line.startswith("data: "):
                                continue
                            data = raw_line[6:].strip()
                            if data == "[DONE]":
                                break

                            try:
                                parsed = json.loads(data)
                                delta = parsed["choices"][0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                            except Exception:
                                continue
                        logger.info(f"✅ Stream [{model}] completed on attempt {retry + 1}")
                        return
                    
                    # Transient errors: retry with backoff
                    if response.status_code in [429, 503] and retry < MAX_RETRIES - 1:
                        delay = min(BASE_DELAY * (BACKOFF_MULTIPLIER ** retry), MAX_DELAY)
                        logger.warning(
                            f"⚠️ Stream [{model}] HTTP {response.status_code} (attempt {retry + 1}). "
                            f"Retrying in {delay:.1f}s..."
                        )
                        await asyncio.sleep(delay)
                        continue
                    else:
                        body = await response.aread()
                        logger.error(
                            f"Stream [{model}] HTTP {response.status_code}: {body[:200]}"
                        )
                        return

        except httpx.TimeoutException:
            if retry < MAX_RETRIES - 1:
                delay = min(BASE_DELAY * (BACKOFF_MULTIPLIER ** retry), MAX_DELAY)
                logger.warning(
                    f"⏱️ Stream [{model}] timeout (attempt {retry + 1}). "
                    f"Retrying in {delay:.1f}s..."
                )
                await asyncio.sleep(delay)
                continue
            else:
                logger.error(f"Stream [{model}] timeout after {MAX_RETRIES} attempts")
                return
        
        except Exception as e:
            logger.error(f"Stream [{model}] error (attempt {retry + 1}): {str(e)}")
            if retry < MAX_RETRIES - 1:
                delay = min(BASE_DELAY * (BACKOFF_MULTIPLIER ** retry), MAX_DELAY)
                await asyncio.sleep(delay)
                continue
            else:
                return


async def ask_openrouter_stream(
    messages: list, task_type: str = "fast"
) -> AsyncGenerator[str, None]:
    """
    Route and stream tokens from OpenRouter with automatic fallback and retry logic.
    Each model gets retried before fallback. Streams tokens as they arrive.
    """
    primary = MODELS.get(task_type, MODELS["fast"])
    tried_primary = False
    tried_fallback1 = False

    # Step 1 — try primary model
    logger.info(f"🔄 Streaming from primary model [{primary}]")
    async for chunk in _stream_model(messages, primary):
        tried_primary = True
        yield chunk

    if tried_primary:
        return  # Successfully streamed from primary

    # Step 2 — fall back to Qwen
    logger.warning(f"Primary model failed → streaming from fallback #1 [{MODELS['fallback']}]")
    if primary != MODELS["fallback"]:
        async for chunk in _stream_model(messages, MODELS["fallback"]):
            tried_fallback1 = True
            yield chunk

    if tried_fallback1:
        return

    # Step 3 — last resort: Mistral
    logger.warning(f"Fallback #1 failed → streaming from fallback #2 [{MODELS['fast']}]")
    if primary != MODELS["fast"]:
        async for chunk in _stream_model(messages, MODELS["fast"]):
            yield chunk
            return

    # All streaming attempts exhausted
    logger.error("🔥 All streaming attempts exhausted")
    yield (
        "💡 **Clarity Tutor**: Real-time streaming is temporarily unavailable. "
        "Please retry in a moment — our AI servers are refreshing!"
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
