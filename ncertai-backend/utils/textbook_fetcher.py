"""
NCERT Textbook Chapter Text Extractor
======================================
Strategy (NO r.jina, NO HTML scraping):
  1. Resolve (class_num, subject, chapter) -> NCERT book-code + chapter number
  2. Download the chapter PDF directly: ncert.nic.in/textbook/pdf/<code><nn>.pdf
  3. Extract text with pdfplumber (falls back to PyPDF2)
  4. AI vision fallback for image-heavy pages
  5. AI generation as last resort
  6. Cache the final text to disk for instant repeat access
"""

import io
import os
import re
import logging
from pathlib import Path
from typing import Optional
from utils.curriculum import load_curriculum_catalog

logger = logging.getLogger(__name__)

import os

is_vercel = os.getenv("VERCEL") == "1" or "VERCEL" in os.environ
if is_vercel:
    DATA_DIR = Path("/tmp") / "data"
else:
    DATA_DIR = Path(__file__).resolve().parents[1] / "data"

TEXTBOOKS_CACHE_DIR = DATA_DIR / "textbooks"
NCERT_PDF_CACHE_DIR = DATA_DIR / "ncert_pdf_cache"


# ─────────────────────────────────────────────────────────────────────────────
# Book-code mapping: (class, subject_keyword) → list of (book_code, max_chapters, offset)
# Each "part" covers chapters [offset+1 .. offset+max_chapters]
# ─────────────────────────────────────────────────────────────────────────────
_BOOK_MAP: dict[str, dict[str, list[tuple[str, int, int]]]] = {
    "12": {
        "physics":        [("leph1", 8, 0), ("leph2", 6, 8)],
        "chemistry":      [("lech1", 5, 0), ("lech2", 5, 5)],
        "maths":          [("lemh1", 6, 0), ("lemh2", 7, 6)],
        "math":           [("lemh1", 6, 0), ("lemh2", 7, 6)],
        "biology":        [("lebo1", 13, 0)],
        "english":        [("lefl1", 8, 0)],
    },
    "11": {
        "physics":        [("keph1", 8, 0), ("keph2", 7, 8)],
        "chemistry":      [("kech1", 6, 0), ("kech2", 3, 6)],
        "maths":          [("kemh1", 14, 0)],
        "math":           [("kemh1", 14, 0)],
        "biology":        [("kebo1", 19, 0)],
    },
    "10": {
        "science":        [("jesc1", 13, 0)],
        "maths":          [("jemh1", 14, 0)],
        "math":           [("jemh1", 14, 0)],
        "social":         [("jess1", 7, 0)],
        "english":        [("jeff1", 9, 0)],
    },
    "9": {
        "science":        [("iesc1", 12, 0)],
        "maths":          [("iemh1", 12, 0)],
        "math":           [("iemh1", 12, 0)],
        "social":         [("ieps1", 5, 0)],
        "english":        [("iebe1", 9, 0)],
    },
    "8": {
        "science":        [("hesc1", 13, 0)],
        "maths":          [("hemh1", 13, 0)],
        "math":           [("hemh1", 13, 0)],
        "social":         [("hesp1", 8, 0)],
        "english":        [("hehd1", 8, 0)],
    },
    "7": {
        "science":        [("gesc1", 18, 0)],
        "maths":          [("gemh1", 15, 0)],
        "math":           [("gemh1", 15, 0)],
        "social":         [("gess1", 9, 0)],
        "english":        [("geeh1", 10, 0)],
    },
    "6": {
        "science":        [("fesc1", 16, 0)],
        "maths":          [("femh1", 14, 0)],
        "math":           [("femh1", 14, 0)],
        "social":         [("fess1", 9, 0)],
        "english":        [("feeh1", 10, 0)],
    },
}


def _resolve_book_parts(class_num: str, subject: str) -> Optional[list[tuple[str, int, int]]]:
    """Return the list of book parts for a class+subject, or None if not found."""
    class_parts = _BOOK_MAP.get(str(class_num), {})
    subj_lower = subject.strip().lower()
    # Exact match first
    for key, parts in class_parts.items():
        if key == subj_lower:
            return parts
    # Substring match
    for key, parts in class_parts.items():
        if key in subj_lower or subj_lower in key:
            return parts
    return None


def _resolve_book_code(class_num: str, subject: str, chapter_idx: int) -> Optional[tuple[str, int]]:
    """Return (book_code, local_chapter_number) or None."""
    parts = _resolve_book_parts(class_num, subject)
    if not parts:
        return None
    for code, max_ch, offset in parts:
        if chapter_idx <= offset + max_ch:
            local = max(1, min(chapter_idx - offset, max_ch))
            return (code, local)
    # Fallback: last part
    code, max_ch, offset = parts[-1]
    local = max(1, min(chapter_idx - offset, max_ch))
    return (code, local)


def get_ncert_url(class_num: str, subject: str, chapter: str) -> Optional[str]:
    """Resolve (class, subject, chapter) to the official NCERT textbook page URL."""
    class_num = str(class_num).strip()
    catalog = load_curriculum_catalog()
    class_catalog = catalog.get(class_num, {})

    # Find subject in catalog
    subject_key = None
    subj_lower = subject.strip().lower()
    for k in class_catalog:
        if k.lower() == subj_lower:
            subject_key = k
            break
    if not subject_key:
        for k in class_catalog:
            if subj_lower in k.lower() or k.lower() in subj_lower:
                subject_key = k
                break
    if not subject_key:
        return None

    # Find chapter index
    chapters = class_catalog[subject_key]
    chapter_lower = chapter.strip().lower()
    chapter_idx = -1
    for i, ch in enumerate(chapters):
        if ch.lower() == chapter_lower:
            chapter_idx = i + 1
            break
    if chapter_idx == -1:
        for i, ch in enumerate(chapters):
            if chapter_lower in ch.lower() or ch.lower() in chapter_lower:
                chapter_idx = i + 1
                break
    if chapter_idx == -1:
        return None

    result = _resolve_book_code(class_num, subject, chapter_idx)
    if not result:
        return None
    code, local_ch = result

    # Find max chapters for this book part
    parts = _resolve_book_parts(class_num, subject) or []
    max_ch = local_ch
    for c, m, _ in parts:
        if c == code:
            max_ch = m
            break

    return f"https://ncert.nic.in/textbook.php?{code}={local_ch}-{max_ch}"


# ─────────────────────────────────────────────────────────────────────────────
# PDF download + text extraction (synchronous helpers called from async context)
# ─────────────────────────────────────────────────────────────────────────────

def _download_ncert_pdf(book_code: str, chapter_num: int) -> Optional[bytes]:
    """Download a chapter PDF from NCERT and cache it on disk. Synchronous."""
    import httpx

    os.makedirs(NCERT_PDF_CACHE_DIR, exist_ok=True)
    padded = f"{chapter_num:02d}"
    filename = f"{book_code}{padded}.pdf"
    cache_path = NCERT_PDF_CACHE_DIR / filename

    if cache_path.exists():
        logger.info(f"NCERT PDF cache hit: {filename}")
        return cache_path.read_bytes()

    url = f"https://ncert.nic.in/textbook/pdf/{filename}"
    logger.info(f"Downloading NCERT PDF: {url}")
    
    import time
    retries = 3
    for attempt in range(retries):
        try:
            with httpx.Client(timeout=30.0, follow_redirects=True) as client:
                resp = client.get(url)
                ctype = resp.headers.get("content-type", "")
                if resp.status_code == 200 and ("pdf" in ctype or resp.content[:4] == b"%PDF"):
                    cache_path.write_bytes(resp.content)
                    logger.info(f"Cached {filename} ({len(resp.content) // 1024} KB)")
                    return resp.content
                logger.warning(f"NCERT PDF download attempt {attempt+1} failed: status={resp.status_code}, ctype={ctype}")
        except Exception as e:
            logger.warning(f"NCERT PDF download attempt {attempt+1} got exception: {e}")
            if attempt == retries - 1:
                logger.error(f"Failed to download NCERT PDF {url} after {retries} attempts: {e}")
        time.sleep(1.0)
    return None


def _extract_text_from_pdf_bytes(pdf_bytes: bytes) -> tuple[str, list[int]]:
    """
    Extract text from PDF bytes.
    Returns (text, image_heavy_pages).
    Tries pdfplumber first, falls back to PyPDF2.
    """
    image_heavy_pages: list[int] = []
    try:
        import pdfplumber
        pages_text: list[str] = []
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text() or ""
                if bool(page.images) and len(page_text.strip()) < 120:
                    image_heavy_pages.append(i)
                pages_text.append(page_text)
        full = "\n\n".join(t for t in pages_text if t.strip())
        return full.strip(), image_heavy_pages
    except ImportError:
        logger.warning("pdfplumber not available, trying PyPDF2")
    except Exception as e:
        logger.warning(f"pdfplumber failed: {e}, trying PyPDF2")

    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        text = "\n".join(p.extract_text() or "" for p in reader.pages)
        return text.strip(), []
    except Exception as e:
        logger.error(f"PyPDF2 fallback also failed: {e}")

    return "", []


async def get_tamil_nadu_chapter_text(class_num: str, subject: str, chapter: str) -> str:
    medium = "EN" if "EN" in class_num else "TM"
    safe_subject = re.sub(r"[^a-zA-Z0-9_]", "_", subject.lower())
    safe_chapter = re.sub(r"[^a-zA-Z0-9_]", "_", chapter.lower())
    cache_filename = f"class_{class_num}_{safe_subject}_{safe_chapter}.txt"
    cache_path = TEXTBOOKS_CACHE_DIR / cache_filename

    if cache_path.exists():
        try:
            cached = cache_path.read_text(encoding="utf-8")
            if len(cached.strip()) >= 80:
                logger.info(f"TN Text cache hit: {cache_filename}")
                return cached
        except Exception:
            pass

    # Look up PDF in ./tamilnaduboard/{medium}/
    tn_dir = Path(__file__).resolve().parents[2] / "tamilnaduboard" / medium
    if not tn_dir.exists():
        tn_dir = Path("./tamilnaduboard") / medium

    pdf_path = None
    if tn_dir.exists():
        for f in tn_dir.glob("*.pdf"):
            f_name = f.name.lower()
            if subject.lower() in f_name or (subject.lower() == "maths" and "mathematics" in f_name):
                pdf_path = f
                break
    
    if not pdf_path or not pdf_path.exists():
        logger.warning(f"Tamil Nadu Board PDF not found for {subject} {medium}")
        return ""

    logger.info(f"Extracting TN Board chapter '{chapter}' from {pdf_path.name}")
    start_page = -1
    try:
        import PyPDF2
        with open(pdf_path, "rb") as f_pdf:
            reader = PyPDF2.PdfReader(f_pdf)
            for page_idx in range(len(reader.pages)):
                page_text = reader.pages[page_idx].extract_text() or ""
                if chapter.lower() in page_text.lower():
                    start_page = page_idx
                    break
    except Exception as e:
        logger.warning(f"Fast PyPDF2 pre-pass failed: {e}")

    try:
        import pdfplumber
        with pdfplumber.open(pdf_path) as pdf:
            if start_page == -1:
                # Fallback to search using pdfplumber on first 80 pages
                for page_idx in range(min(80, len(pdf.pages))):
                    page_text = pdf.pages[page_idx].extract_text() or ""
                    if chapter.lower() in page_text.lower():
                        start_page = page_idx
                        break
            
            if start_page == -1:
                start_page = 30
                logger.warning(f"Chapter title '{chapter}' not found in PDF pages. Defaulting start page to 30.")

            end_page = min(start_page + 25, len(pdf.pages))
            extracted_pages = []
            for p_idx in range(start_page, end_page):
                page_text = pdf.pages[p_idx].extract_text() or ""
                extracted_pages.append(page_text)
            
            full_text = "\n\n".join(extracted_pages)
            if len(full_text.strip()) > 200:
                cache_path.write_text(full_text, encoding="utf-8")
                return full_text
    except Exception as e:
        logger.error(f"Error parsing Tamil Nadu Board PDF: {e}")
    
    return ""


async def get_textbook_chapter_text(class_num: str, subject: str, chapter: str) -> str:
    if "TN" in str(class_num):
        tn_text = await get_tamil_nadu_chapter_text(str(class_num), subject, chapter)
        if tn_text:
            return tn_text
    """
    Get NCERT chapter text by downloading the actual PDF from ncert.nic.in/textbook/pdf/
    and extracting text with pdfplumber. No r.jina. No HTML scraping.

    Falls back to AI-generated content when PDF yields too little text.
    Results are cached to disk for instant subsequent access.
    """
    safe_subject = re.sub(r"[^a-zA-Z0-9_]", "_", subject.lower())
    safe_chapter = re.sub(r"[^a-zA-Z0-9_]", "_", chapter.lower())
    cache_filename = f"class_{class_num}_{safe_subject}_{safe_chapter}.txt"

    os.makedirs(TEXTBOOKS_CACHE_DIR, exist_ok=True)
    cache_path = TEXTBOOKS_CACHE_DIR / cache_filename

    # ── 1. Return from text cache if it exists ────────────────────────────────
    if cache_path.exists():
        try:
            cached = cache_path.read_text(encoding="utf-8")
            if len(cached.strip()) >= 80:
                logger.info(f"Text cache hit: {cache_filename}")
                return cached
        except Exception as e:
            logger.error(f"Cache read failed: {e}")

    # ── 2. Resolve chapter index ──────────────────────────────────────────────
    class_num_str = str(class_num).strip()
    catalog = load_curriculum_catalog()
    class_catalog = catalog.get(class_num_str, {})

    subject_key = None
    subj_lower = subject.strip().lower()
    for k in class_catalog:
        if k.lower() == subj_lower:
            subject_key = k
            break
    if not subject_key:
        for k in class_catalog:
            if subj_lower in k.lower() or k.lower() in subj_lower:
                subject_key = k
                break

    chapter_idx = 0
    if subject_key:
        chapters = class_catalog[subject_key]
        chapter_lower = chapter.strip().lower()
        for i, ch in enumerate(chapters):
            if ch.lower() == chapter_lower or chapter_lower in ch.lower() or ch.lower() in chapter_lower:
                chapter_idx = i + 1
                break

    # ── 3. Download PDF and extract text ──────────────────────────────────────
    text = ""
    if chapter_idx > 0:
        result = _resolve_book_code(class_num_str, subject, chapter_idx)
        if result:
            book_code, local_ch = result
            logger.info(f"Resolved {class_num} {subject} ch#{chapter_idx} → {book_code}{local_ch:02d}.pdf")
            pdf_bytes = _download_ncert_pdf(book_code, local_ch)
            if pdf_bytes:
                text, image_heavy_pages = _extract_text_from_pdf_bytes(pdf_bytes)
                logger.info(f"Extracted {len(text)} chars from PDF, {len(image_heavy_pages)} image-heavy pages")

                # ── AI Vision for sparse image-heavy pages ────────────────
                if image_heavy_pages and len(text.strip()) < 2000:
                    try:
                        from services.file_processor import _render_page_as_image_base64
                        from services.openrouter import ask_openrouter
                        descriptions: list[str] = []
                        for page_idx in image_heavy_pages[:4]:
                            b64 = _render_page_as_image_base64(pdf_bytes, page_num=page_idx, dpi=120)
                            if not b64:
                                continue
                            vision_msgs = [
                                {"role": "system", "content": (
                                    "You are a precise NCERT educational content extractor. "
                                    "Describe all diagrams, chemical structures, math formulas, figures, "
                                    "and tables from this NCERT textbook page as structured markdown. "
                                    "Use LaTeX math inside $..$ or $$..$$ delimiters. "
                                    "Focus on educational content only."
                                )},
                                {"role": "user", "content": [
                                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                                    {"type": "text", "text": f"Describe educational content on this NCERT Class {class_num} {subject} - {chapter} page."},
                                ]},
                            ]
                            desc = await ask_openrouter(vision_msgs, task_type="vision")
                            if desc and desc.strip():
                                descriptions.append(f"\n\n---\n**[Figure – Page {page_idx + 1}]**\n\n{desc.strip()}\n")
                        if descriptions:
                            text = text + "\n" + "".join(descriptions)
                    except Exception as e:
                        logger.warning(f"Vision fallback failed: {e}")
        else:
            logger.warning(f"Could not resolve book code for Class {class_num_str} {subject} ch#{chapter_idx}")
    else:
        logger.warning(f"Could not find chapter '{chapter}' in catalog for Class {class_num_str} {subject}")

    # ── 4. AI fallback if text still insufficient ────────────────────────────
    if len(text.strip()) < 150:
        logger.info(f"PDF extraction insufficient ({len(text)} chars). Falling back to AI generation...")
        try:
            from services.openrouter import ask_openrouter
            prompt = (
                f"Generate a comprehensive, detailed NCERT-aligned textbook chapter for "
                f"Class {class_num} {subject}, Chapter: '{chapter}'.\n"
                "Include: key definitions, important formulas in LaTeX ($$...$$), "
                "step-by-step explanations, worked examples, and a Key Points summary.\n"
                "Format with clear headings and subheadings. Use standard CBSE vocabulary. "
                "Start directly with the chapter title."
            )
            ai_text = await ask_openrouter(
                [{"role": "user", "content": prompt}],
                task_type="smart"
            )
            if ai_text and len(ai_text.strip()) > 200:
                text = ai_text.strip()
                logger.info(f"AI generated {len(text)} chars for '{chapter}'")
        except Exception as e:
            logger.error(f"AI generation fallback failed: {e}")

    # ── 5. Cache and return ───────────────────────────────────────────────────
    if len(text.strip()) >= 80:
        try:
            cache_path.write_text(text, encoding="utf-8")
            logger.info(f"Cached text: {cache_filename}")
        except Exception as e:
            logger.error(f"Cache write failed: {e}")
        return text

    logger.warning(f"All extraction strategies failed for Class {class_num} {subject} - {chapter}")
    return ""


def resolve_actual_ncert_filename(book_code: str, chapter_num: int) -> tuple[str, int]:
    """
    Given a book_code and a global chapter_num, resolve the correct (book_code, local_chapter_num)
    by looking up in _BOOK_MAP. Since the frontend always passes the global chapter index,
    we find the subject/class parts and map the global index to the correct part and local index.
    """
    # 1. Find the parts for this book_code
    found_parts = None
    for class_num, subjects in _BOOK_MAP.items():
        for subject, parts in subjects.items():
            if any(code == book_code for code, _, _ in parts):
                found_parts = parts
                break
        if found_parts:
            break
            
    if not found_parts:
        return book_code, chapter_num
        
    # 2. Treat chapter_num as the global chapter index (1-based)
    global_chapter_idx = chapter_num
    
    # 3. Resolve to the correct book part using global_chapter_idx
    for code, max_ch, offset in found_parts:
        if global_chapter_idx <= offset + max_ch:
            local_ch = max(1, min(global_chapter_idx - offset, max_ch))
            return code, local_ch
            
    # Fallback to the last part
    code, max_ch, offset = found_parts[-1]
    local_ch = max(1, min(global_chapter_idx - offset, max_ch))
    return code, local_ch

