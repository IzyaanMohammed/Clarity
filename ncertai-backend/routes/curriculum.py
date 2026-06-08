from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from typing import Optional, List
import json
import re

from utils.curriculum import load_curriculum_catalog
from utils.textbook_fetcher import get_textbook_chapter_text
from services.database import get_custom_textbook_content
from services.openrouter import ask_openrouter

router = APIRouter()


class ActiveRecallEvaluateRequest(BaseModel):
    class_num: str
    subject: str
    chapter: str
    recall_text: str


@router.get("/catalog")
async def curriculum_catalog():
    catalog = load_curriculum_catalog()
    return {"catalog": catalog}


@router.get("/subjects")
async def curriculum_subjects(class_num: str):
    catalog = load_curriculum_catalog()
    subjects = sorted((catalog.get(str(class_num)) or {}).keys())
    return {"class_num": str(class_num), "subjects": subjects}


@router.get("/chapters")
async def curriculum_chapters(class_num: str, subject: str):
    catalog = load_curriculum_catalog()
    chapter_map = catalog.get(str(class_num)) or {}
    chapters = chapter_map.get(subject) or []
    if not chapters:
        raise HTTPException(status_code=404, detail="No chapters found for the selected class and subject")
    return {
        "class_num": str(class_num),
        "subject": subject,
        "chapters": chapters,
    }


@router.get("/chapter-text")
async def get_chapter_text(
    class_num: str = Query(...),
    subject: str = Query(...),
    chapter: str = Query(...),
    x_user_id: Optional[str] = Header(None)
):
    text = ""
    # 1. Try to fetch user's custom textbook content from database if user is authenticated
    if x_user_id:
        try:
            val_class = int(class_num)
            text = get_custom_textbook_content(x_user_id, val_class, subject, chapter) or ""
        except ValueError:
            pass
    
    # 2. Fall back to fetching and scraping NCERT textbook if not found
    if not text:
        text = await get_textbook_chapter_text(class_num, subject, chapter)

    if not text:
        raise HTTPException(
            status_code=404, 
            detail="Chapter textbook text content could not be found or fetched. Please upload your custom PDF."
        )

    return {"content": text}


@router.post("/active-recall/evaluate")
async def active_recall_evaluate(
    request: ActiveRecallEvaluateRequest,
    x_user_id: Optional[str] = Header(None)
):
    # 1. Fetch the reference chapter text
    text = ""
    if x_user_id:
        try:
            val_class = int(request.class_num)
            text = get_custom_textbook_content(x_user_id, val_class, request.subject, request.chapter) or ""
        except ValueError:
            pass

    if not text:
        text = await get_textbook_chapter_text(request.class_num, request.subject, request.chapter)

    if not text:
        raise HTTPException(
            status_code=404,
            detail="Reference chapter text not found. Cannot evaluate recall."
        )

    # Clean recall text
    recall_text = request.recall_text.strip()
    if not recall_text:
        return {
            "accuracy_score": 0,
            "recalled_keywords": [],
            "missed_concepts": ["Everything (No transcript provided)"],
            "feedback_notes": "Please speak or write your summary first so I can analyze what you remember!"
        }

    # 2. Build OpenRouter prompt to compare transcript to reference text
    system_prompt = (
        "You are an expert CBSE AI evaluator grading active recall summaries against the official NCERT textbook context.\n"
        "Compare the student's recall transcript against the provided textbook content.\n"
        "Evaluate:\n"
        "1. An accuracy score from 0 to 100 based on how well they recalled the core concepts, key details, and factual accuracy.\n"
        "2. 'recalled_keywords': List of key terms or phrases from the textbook they successfully mentioned.\n"
        "3. 'missed_concepts': List of important NCERT keywords, definitions, or value points present in the textbook that they missed.\n"
        "4. 'feedback_notes': Concise, constructive coaching advice on how they can improve, highlighting what they got right and what they missed.\n\n"
        "STRICT RESPONSE FORMAT:\n"
        "Format your response as a strict JSON object with keys: 'accuracy_score', 'recalled_keywords', 'missed_concepts', 'feedback_notes'.\n"
        "Do not include any other text, markdown blocks, or explanation outside the JSON."
    )

    # Use first 15,000 characters of the textbook to fit context window safely and prevent token limit issues
    truncated_reference = text[:15000]

    user_prompt = (
        f"TEXTBOOK CONTENT REFERENCE:\n{truncated_reference}\n\n"
        f"STUDENT RECALL TRANSCRIPT:\n{recall_text}\n\n"
        "Analyze and return the strict JSON scorecard."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    raw_response = await ask_openrouter(messages, task_type="smart")
    
    # 3. Parse and normalize the JSON response
    parsed_scorecard = None
    try:
        # Strip potential markdown codeblock wrappers
        cleaned = raw_response.strip()
        if cleaned.startswith("```"):
            # strip backticks and optional json identifier
            cleaned = re.sub(r"^```(?:json)?\n", "", cleaned)
            cleaned = re.sub(r"\n```$", "", cleaned)
        
        parsed_scorecard = json.loads(cleaned.strip())
    except Exception as e:
        # Fallback parsing if LLM output wasn't perfect JSON
        # Look for JSON-like block
        match = re.search(r"\{.*\}", raw_response, re.DOTALL)
        if match:
            try:
                parsed_scorecard = json.loads(match.group(0))
            except Exception:
                pass

    if not parsed_scorecard or not isinstance(parsed_scorecard, dict):
        # Default fallback if parsing fails completely
        parsed_scorecard = {
            "accuracy_score": 50,
            "recalled_keywords": [],
            "missed_concepts": ["Check textbook for core details"],
            "feedback_notes": f"Could not parse scorecard response from AI. Raw response: {raw_response[:300]}"
        }

    # Normalize fields to guarantee structure
    scorecard = {
        "accuracy_score": int(parsed_scorecard.get("accuracy_score", 50)),
        "recalled_keywords": list(parsed_scorecard.get("recalled_keywords", [])),
        "missed_concepts": list(parsed_scorecard.get("missed_concepts", [])),
        "feedback_notes": str(parsed_scorecard.get("feedback_notes", "Good attempt! Keep reviewing your textbook."))
    }

    return scorecard

