import os
import httpx
import logging
import json
from dotenv import load_dotenv

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
load_dotenv(os.path.join(parent_dir, '.env'))

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
PRIMARY_MODEL = "google/gemini-2.0-flash-lite-preview-02-05:free"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def ask_openrouter(messages: list, task_type: str = "text") -> str:
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": PRIMARY_MODEL,
        "messages": messages
    }
    
    # DEBUG: Log the exact string being sent
    json_payload = json.dumps(payload)
    logger.info(f"Sending JSON Payload: {json_payload}")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, content=json_payload, timeout=60.0)
            
            if response.status_code == 200:
                data = response.json()
                return data["choices"][0]["message"]["content"]
            
            logger.error(f"OpenRouter Error {response.status_code}: {response.text}")
            return f"💡 **Tutor Error ({response.status_code})**: Check your OpenRouter dashboard."
                
    except Exception as e:
        logger.error(f"Request Exception: {str(e)}")
        return "💡 **Tutor Note**: Network issue."
