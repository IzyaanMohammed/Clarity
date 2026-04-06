from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Header
import httpx
import re
from typing import Optional
from models.schemas import UploadResponse
from services.openrouter import ask_openrouter
from services.file_processor import process_file_for_ai
from utils.rate_limiter import check_rate_limit, increment_usage
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE_MB = 10


@router.post("/ocr")
async def extract_ocr(
    file: UploadFile = File(...),
    x_user_id: str = Header(None),
):
    if x_user_id and not check_rate_limit(x_user_id, "upload"):
        raise HTTPException(
            status_code=429,
            detail="Daily upload limit reached. Upgrade to Pro for unlimited uploads! 📚",
        )

    file_bytes = await file.read()
    size_mb = len(file_bytes) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f}MB). Maximum allowed is {MAX_FILE_SIZE_MB}MB.",
        )

    content_data = process_file_for_ai(file_bytes, file.filename)

    if content_data["type"] == "pdf":
        text = (content_data.get("content") or "").strip()
        if len(text) < 20:
            raise HTTPException(status_code=422, detail="Could not extract enough OCR text from PDF.")
        if x_user_id:
            increment_usage(x_user_id, "upload")
        return {"text": text, "source": "pdf-text"}

    if content_data["type"] == "image":
        messages = [
            {
                "role": "system",
                "content": (
                    "You are an OCR extractor. Return only raw extracted text from the image. "
                    "No explanation, no markdown, no bullet points. Preserve line breaks as much as possible."
                ),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{content_data['base64']}"
                        },
                    },
                    {
                        "type": "text",
                        "text": "Extract all visible text exactly.",
                    },
                ],
            },
        ]
        text = await ask_openrouter(messages, task_type="vision")
        if x_user_id:
            increment_usage(x_user_id, "upload")
        return {"text": text.strip(), "source": "vision-ocr"}

    raise HTTPException(
        status_code=400,
        detail="Unsupported file type. Please upload a PDF, JPG, JPEG, PNG, or WEBP file.",
    )


@router.get("/textbook-content")
async def get_textbook_content(url: str, max_chars: int = 22000, chapter_index: Optional[int] = None):
    if not url.startswith("http://") and not url.startswith("https://"):
        raise HTTPException(status_code=400, detail="Invalid URL.")

    normalized = url.replace('https://', '').replace('http://', '')
    mirror_url = f"https://r.jina.ai/http://{normalized}"

    def _clean_text(raw: str) -> str:
        txt = re.sub(r"<script[\\s\\S]*?</script>", " ", raw, flags=re.IGNORECASE)
        txt = re.sub(r"<style[\\s\\S]*?</style>", " ", txt, flags=re.IGNORECASE)
        txt = re.sub(r"<[^>]+>", " ", txt)
        txt = re.sub(r"\r", "", txt)
        txt = re.sub(r"\n\s*\n\s*\n+", "\n\n", txt)
        txt = re.sub(r"[ \t]+", " ", txt)
        return txt.strip()

    def _strip_navigation_noise(raw: str) -> str:
        text = (raw or "")
        text = text.replace("\r", "\n")

        # Strip markdown/image links and bare URLs often injected by mirror extraction.
        text = re.sub(r"!?\[[^\]]*\]\(https?://[^)]+\)", " ", text)
        text = re.sub(r"\*\s*\]\(https?://[^)]+\)", " ", text)
        text = re.sub(r"https?://\S+", " ", text)

        # Remove chapter-navigation blocks like "Chapter 1 Chapter 2 ... Chapter 8".
        text = re.sub(r"(?:\*\*?\s*Chapter\s+\d+\*\*?\s*){4,}", " ", text, flags=re.IGNORECASE)

        # Drop common site chrome and footer fragments.
        stop_markers = [
            "हमसे संपर्क करें",
            "कुल आगंतुक",
            "important helpline",
            "copyright",
            "hosted by nic",
            "developed by",
            "follow ncert",
            "एनसीईआरटी का पालन करें",
            "facebook",
            "instagram",
            "linkedin",
            "youtube",
            "twitter",
        ]

        lowered = text.lower()
        for marker in stop_markers:
            idx = lowered.find(marker.lower())
            if idx != -1:
                text = text[:idx]
                lowered = text.lower()

        # Remove noisy menu-style lines.
        noisy_line_patterns = [
            r"^\s*\*\s*$",
            r"^\s*[\]\[()|!]+\s*$",
            r"\bamritmahotsav\b|\bmygov\b|\bdigitalindia\b|\beducation\.gov\b|\bswayam\b|\bepathshala\b|\bg20\b",
        ]

        cleaned_lines = []
        for line in text.split("\n"):
            ln = re.sub(r"\s+", " ", line).strip()
            if not ln:
                continue
            if any(re.search(pat, ln, flags=re.IGNORECASE) for pat in noisy_line_patterns):
                continue
            cleaned_lines.append(ln)

        text = "\n".join(cleaned_lines)

        # Keep from first chapter heading when present.
        chapter_anchor = re.search(r"\b(Chapter|CHAPTER|अध्याय)\s*\d+\b", text)
        if chapter_anchor and chapter_anchor.start() > 0:
            text = text[chapter_anchor.start():]

        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r"[ \t]{2,}", " ", text)
        return text.strip()

    def _chapter_url_from_listing(listing_url: str, idx: int) -> Optional[str]:
        # Example: textbook.php?leph1=0-8 -> textbook.php?leph1=3-8
        match = re.search(r"([?&])([a-z0-9]+)=([0-9]+)-([0-9]+)", listing_url, flags=re.IGNORECASE)
        if not match:
            return None
        key = match.group(2)
        max_ch = int(match.group(4))
        chapter = max(1, min(idx, max_ch))
        return f"https://ncert.nic.in/textbook.php?{key}={chapter}-{max_ch}"

    try:
        text = ""
        best_raw_text = ""
        source_to_fetch = url

        if chapter_index is not None and chapter_index > 0:
            chapter_url = _chapter_url_from_listing(url, chapter_index)
            if chapter_url:
                source_to_fetch = chapter_url

        normalized_source = source_to_fetch.replace('https://', '').replace('http://', '')
        mirror_source = f"https://r.jina.ai/http://{normalized_source}"

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            # Strategy 1: Jina mirror (best readable extraction).
            response = await client.get(mirror_source)
            if response.status_code == 200:
                text = response.text.strip()
                best_raw_text = text

            # Strategy 2: direct page fetch + HTML text extraction.
            if len(text) < 500:
                direct = await client.get(source_to_fetch)
                if direct.status_code == 200:
                    extracted = _clean_text(direct.text)
                    if len(extracted) > len(text):
                        text = extracted
                    if len(extracted) > len(best_raw_text):
                        best_raw_text = extracted

            # Strategy 3: if chapter fetch still noisy, retry listing page and extract textbook section.
            if len(text) < 500 and source_to_fetch != url:
                listing_mirror = await client.get(mirror_url)
                if listing_mirror.status_code == 200 and len(listing_mirror.text) > len(text):
                    text = listing_mirror.text
                if listing_mirror.status_code == 200 and len(listing_mirror.text) > len(best_raw_text):
                    best_raw_text = listing_mirror.text

        cleaned_text = _strip_navigation_noise(text)
        cleaned_best_text = _strip_navigation_noise(best_raw_text)

        # Prefer cleaned outputs only; never fall back to raw noisy mirror text.
        if len(cleaned_text) >= 80:
            text = cleaned_text
        elif len(cleaned_best_text) >= 80:
            text = cleaned_best_text
        else:
            text = cleaned_text

        # Accept concise but meaningful chapter snippets; reject near-empty extracts.
        if len(text) < 80:
            raise HTTPException(status_code=502, detail="Could not extract enough textbook text.")

        if max_chars > 0:
            text = text[:max_chars]

        return {
            "source_url": source_to_fetch,
            "mirror_url": mirror_source,
            "content": text,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Textbook content fetch failed: %s", exc)
        raise HTTPException(status_code=500, detail="Could not load textbook content right now.")


@router.post("/analyze", response_model=UploadResponse)
async def analyze_file(
    file: UploadFile = File(...),
    question: str = Form(default="Summarize this study material and explain key concepts."),
    x_user_id: str = Header(None),
):
    # Rate limit check
    if x_user_id and not check_rate_limit(x_user_id, "upload"):
        raise HTTPException(
            status_code=429,
            detail="Daily upload limit reached. Upgrade to Pro for unlimited uploads! 📚",
        )

    # File size check
    file_bytes = await file.read()
    size_mb = len(file_bytes) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f}MB). Maximum allowed is {MAX_FILE_SIZE_MB}MB.",
        )

    logger.info(f"Upload: {file.filename} ({size_mb:.2f}MB) from user={x_user_id}")

    content_data = process_file_for_ai(file_bytes, file.filename)

    if content_data["type"] == "pdf":
        if not content_data.get("content"):
            raise HTTPException(
                status_code=422,
                detail="Could not extract text from this PDF. Try uploading an image of the page instead.",
            )

        messages = [
            {
                "role": "system",
                "content": (
                    "You are Clarity analyzing a student's uploaded study material. "
                    "If it's an NCERT textbook page, identify the chapter and class. "
                    "Give a structured, exam-focused response with key points, definitions, "
                    "and a 💡 Exam tip at the end."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Here is the content extracted from the uploaded PDF:\n\n"
                    f"{content_data['content'][:8000]}\n\n"  # cap at 8k chars to avoid token overflow
                    f"Student's question: {question}"
                ),
            },
        ]
        # PDF text analysis → smart model for better comprehension
        task_type = "smart"
        extracted_text = content_data["content"]

    elif content_data["type"] == "image":
        messages = [
            {
                "role": "system",
                "content": (
                    "You are Clarity analyzing a student's uploaded image — this could be "
                    "a textbook page, handwritten notes, or a diagram. "
                    "Identify what chapter/concept it's from, explain key points, "
                    "and end with a 💡 Exam tip."
                ),
            },
            {
                "role": "user",
                "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{content_data['base64']}"
                    },
                },
                {"type": "text", "text": question},
            ],
            },
        ]
        # Images MUST use vision model
        task_type = "vision"
        extracted_text = "[Image uploaded — visual content analyzed by AI]"

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Please upload a PDF, JPG, or PNG. Got: {file.filename}",
        )

    logger.info(f"Upload analysis → task_type={task_type}")
    analysis = await ask_openrouter(messages, task_type=task_type)

    if x_user_id:
        increment_usage(x_user_id, "upload")

    return UploadResponse(analysis=analysis, extracted_text=extracted_text)
