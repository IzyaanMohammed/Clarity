from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Header, Query
import httpx
import re
from typing import Optional
from models.schemas import UploadResponse
from services.openrouter import ask_openrouter
from services.file_processor import process_file_for_ai, _render_page_as_image_base64
from services.database import get_user_profile, increment_ocr_uploads
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
    if x_user_id:
        profile = get_user_profile(x_user_id)
        if profile:
            tier = profile.get("subscription_tier", "free")
            ocr_count = profile.get("ocr_uploads_count", 0)
            if tier == "free" and ocr_count >= 20:
                raise HTTPException(
                    status_code=403,
                    detail="Free OCR limit reached (20/20 scans). Please upgrade to Pro for unlimited uploads! 📚",
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
            increment_ocr_uploads(x_user_id)
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
    """
    Extract NCERT textbook chapter text via PDF download.
    NO r.jina, NO HTML scraping — downloads the actual PDF from ncert.nic.in/textbook/pdf/
    and extracts text using pdfplumber.

    The URL format is: https://ncert.nic.in/textbook.php?<book_code>=<local_ch>-<max_ch>
    We parse out the book_code and chapter number, then fetch the PDF directly.
    """
    # Parse book_code and chapter number from NCERT URL
    # URL pattern: https://ncert.nic.in/textbook.php?<book_code>=<local_ch>-<max_ch>
    match = re.search(r"[?&]([a-z0-9]+)=(\d+)-(\d+)", url, flags=re.IGNORECASE)
    if not match:
        raise HTTPException(status_code=400, detail="Could not parse NCERT book code from URL.")

    book_code = match.group(1)
    local_ch = int(match.group(2))

    # Override chapter number if chapter_index was provided (e.g. from the chapter selector)
    if chapter_index is not None and chapter_index > 0:
        local_ch = chapter_index

    # Automatically resolve correct split-book part and local chapter
    from utils.textbook_fetcher import resolve_actual_ncert_filename
    book_code, local_ch = resolve_actual_ncert_filename(book_code, local_ch)

    if book_code.startswith("tn"):
        medium = "EN" if book_code.startswith("tnen") else "TM"
        rest = book_code[4:]
        cls_num = "10"
        for c in ["8", "9", "11", "12"]:
            if rest.startswith(c):
                cls_num = c
                rest = rest[len(c):]
                break

        subject = "Science"
        if rest.startswith("sc"):
            subject = "Science"
        elif rest.startswith("ma"):
            subject = "Maths"
        elif rest.startswith("ph"):
            subject = "Physics"
        elif rest.startswith("ch"):
            subject = "Chemistry"
        elif rest.startswith("bi"):
            subject = "Biology"
            
        class_num = f"{cls_num}_TN_{medium}"

        from utils.curriculum import load_curriculum_catalog
        catalog = load_curriculum_catalog()
        chapters = catalog.get(class_num, {}).get(subject, [])
        
        if 1 <= local_ch <= len(chapters):
            chapter = chapters[local_ch - 1]
        else:
            raise HTTPException(status_code=404, detail=f"Chapter {local_ch} not found in curriculum catalog for class {class_num} {subject}")

        from utils.textbook_fetcher import get_tamil_nadu_chapter_text
        text = await get_tamil_nadu_chapter_text(class_num, subject, chapter)
        
        if not text:
            raise HTTPException(status_code=502, detail="Could not extract Tamil Nadu Board textbook content.")
            
        if max_chars > 0:
            text = text[:max_chars]
            
        return {
            "source_url": url,
            "mirror_url": url,
            "content": text,
        }

    try:
        from utils.textbook_fetcher import _download_ncert_pdf, _extract_text_from_pdf_bytes

        pdf_bytes = _download_ncert_pdf(book_code, local_ch)
        if not pdf_bytes:
            raise HTTPException(status_code=502, detail="NCERT PDF could not be downloaded. Please use the Original PDF tab instead.")

        text, _ = _extract_text_from_pdf_bytes(pdf_bytes)

        if len(text.strip()) < 80:
            raise HTTPException(status_code=502, detail="PDF text extraction yielded too little content. Switch to the Original PDF tab to read visually.")

        if max_chars > 0:
            text = text[:max_chars]

        return {
            "source_url": url,
            "mirror_url": url,
            "content": text,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Textbook PDF extraction failed: %s", exc)
        raise HTTPException(status_code=500, detail="Could not extract textbook content from PDF.")





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


@router.post("/custom-textbook")
async def upload_custom_textbook(
    file: UploadFile = File(...),
    class_num: str = Form(...),
    subject: str = Form(...),
    chapter: str = Form(...),
    x_user_id: str = Header(None),
):
    """Upload a custom textbook PDF.

    Extraction strategy:
    1. pdfplumber extracts text + detects image-heavy pages (diagrams, figures)
    2. For each image-heavy page (low text, has image objects), we render the
       page via PyMuPDF and send it to AI vision to generate a plain-English
       description that is merged back into the stored text.
    3. The stored text_content therefore includes descriptions of ALL diagrams,
       chemical structures, circuit diagrams, and math figures — not just raw text.
    """
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    file_bytes = await file.read()
    content_data = process_file_for_ai(file_bytes, file.filename)
    if content_data["type"] != "pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported for textbooks")

    text_content = (content_data.get("content") or "").strip()
    image_heavy_pages: list = content_data.get("image_heavy_pages", [])

    # ── AI Vision for image-heavy pages ───────────────────────────────────────
    # For each page that is mostly images (diagrams, figures, labeled structures),
    # render it and ask the vision model to describe it in educational terms.
    diagram_descriptions: list[str] = []
    if image_heavy_pages:
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            for page_idx in image_heavy_pages[:6]:  # cap at 6 pages to avoid token blowout
                page_b64 = _render_page_as_image_base64(file_bytes, page_num=page_idx, dpi=120)
                if not page_b64:
                    continue
                vision_messages = [
                    {
                        "role": "system",
                        "content": (
                            "You are a precise educational content extractor. "
                            "Given a textbook page image, describe ALL diagrams, figures, labeled structures, "
                            "chemical equations, mathematical formulas, tables, and graphs in plain text. "
                            "Preserve all labels, numbers, variable names and arrows. "
                            "Output as a clean markdown description with LaTeX math wrapped in $..$ or $$..$$. "
                            "Do NOT describe the page layout — focus on scientific/educational content."
                        ),
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/png;base64,{page_b64}"},
                            },
                            {
                                "type": "text",
                                "text": f"Describe all educational content on this textbook page (Class {class_num}, {subject}, {chapter}). Include all diagrams, chemical formulas, math expressions, and figure labels.",
                            },
                        ],
                    },
                ]
                description = await ask_openrouter(vision_messages, task_type="vision")
                if description and description.strip():
                    diagram_descriptions.append(
                        f"\n\n---\n**[Diagram / Figure — Page {page_idx + 1}]**\n\n{description.strip()}\n"
                    )
        except ImportError:
            logger.warning("PyMuPDF not available; skipping diagram vision extraction")
        except Exception as e:
            logger.error("Vision extraction for diagrams failed: %s", e)

    # Merge diagram descriptions into text content
    if diagram_descriptions:
        text_content = text_content + "\n" + "".join(diagram_descriptions)

    # Require at least some content (text OR diagram descriptions)
    if len(text_content.strip()) < 30:
        raise HTTPException(
            status_code=422,
            detail="PDF contains too little extractable content (text or images).",
        )

    from pathlib import Path
    import os
    is_vercel = os.getenv("VERCEL") == "1" or "VERCEL" in os.environ
    if is_vercel:
        dest_dir = Path("/tmp") / "data" / "custom_textbooks" / x_user_id
    else:
        dest_dir = Path(__file__).resolve().parents[1] / "data" / "custom_textbooks" / x_user_id
    os.makedirs(dest_dir, exist_ok=True)


    safe_filename = "".join([c if c.isalnum() or c in (".", "-", "_") else "_" for c in file.filename])
    filepath = dest_dir / safe_filename
    with open(filepath, "wb") as f:
        f.write(file_bytes)

    from services.database import save_custom_textbook
    textbook_id = save_custom_textbook(
        username=x_user_id,
        class_num=class_num,
        subject=subject,
        chapter=chapter,
        filename=file.filename,
        filepath=str(filepath),
        text_content=text_content,
    )
    return {
        "id": textbook_id,
        "filename": file.filename,
        "class_num": class_num,
        "subject": subject,
        "chapter": chapter,
        "status": "success",
        "diagram_pages_processed": len(diagram_descriptions),
    }


@router.get("/custom-textbooks")
async def list_custom_textbooks(
    class_num: Optional[str] = None,
    subject: Optional[str] = None,
    x_user_id: str = Header(None),
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    from services.database import get_custom_textbooks
    items = get_custom_textbooks(x_user_id, class_num, subject)
    return {"textbooks": items}


@router.delete("/custom-textbook/{textbook_id}")
async def remove_custom_textbook(
    textbook_id: int,
    x_user_id: str = Header(None),
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    from services.database import delete_custom_textbook, get_custom_textbooks
    all_user_books = get_custom_textbooks(x_user_id)
    matching = [b for b in all_user_books if b["id"] == textbook_id]
    if not matching:
        raise HTTPException(status_code=404, detail="Textbook not found or unauthorized")
        
    book = matching[0]
    try:
        import os
        if os.path.exists(book["filepath"]):
            os.remove(book["filepath"])
    except Exception as e:
        logger.error(f"Error removing custom textbook file from disk: {e}")
        
    delete_custom_textbook(x_user_id, textbook_id)
    return {"status": "success", "message": "Custom textbook deleted"}


@router.get("/custom-textbook/{textbook_id}/pdf")
async def get_custom_textbook_pdf(
    textbook_id: int,
    token: Optional[str] = Query(default=None),
    x_user_id: Optional[str] = Header(None),
    authorization: Optional[str] = Header(default=None),
):
    """
    Serve a custom textbook PDF inline.
    Accepts auth via:
      - X-User-Id header (internal server-to-server)
      - Authorization: Bearer <token> header (frontend fetchPdfBlob)
      - ?token= query param (legacy iframe src)
    """
    from utils.auth import require_auth_username
    from fastapi.responses import FileResponse

    username = x_user_id

    # Try Authorization: Bearer header first (used by frontend fetchPdfBlob)
    if not username and authorization:
        try:
            username = require_auth_username(authorization)
        except Exception:
            pass

    # Fallback to ?token= query param (legacy)
    if not username and token:
        try:
            username = require_auth_username(f"Bearer {token}")
        except Exception:
            pass

    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")

    from services.database import get_custom_textbooks
    books = get_custom_textbooks(username)
    matching = [b for b in books if b["id"] == textbook_id]
    if not matching:
        raise HTTPException(status_code=404, detail="File not found")

    filepath = matching[0]["filepath"]
    filename = matching[0].get("filename", "textbook.pdf")
    safe_filename = "".join(c if c.isalnum() or c in ("-", "_", ".") else "_" for c in filename)

    return FileResponse(
        filepath,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{safe_filename}"',
            "Cache-Control": "private, max-age=86400",
            "X-Frame-Options": "",
        },
        filename=safe_filename,
    )



@router.get("/custom-textbook/{textbook_id}/content")
async def get_custom_textbook_text_content(
    textbook_id: int,
    x_user_id: str = Header(None)
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    from services.database import _connect
    with _connect() as conn:
        row = conn.execute(
            "SELECT text_content FROM custom_textbooks WHERE username = ? AND id = ?",
            (x_user_id, textbook_id)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Custom textbook not found")
    return {"content": row["text_content"]}


def get_fallback_pdf():
    try:
        import PyPDF2
        import io
        writer = PyPDF2.PdfWriter()
        writer.add_blank_page(width=595, height=842)
        pdf_bytes_io = io.BytesIO()
        writer.write(pdf_bytes_io)
        return pdf_bytes_io.getvalue()
    except Exception:
        return (
            b"%PDF-1.4\n"
            b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
            b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
            b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> /Contents 4 0 R >>\nendobj\n"
            b"4 0 obj\n<< /Length 54 >>\nstream\n"
            b"BT /F1 12 Tf 72 712 Td (Document placeholder - Try refreshing again later) Tj ET\n"
            b"endstream\n"
            b"endobj\n"
            b"xref\n"
            b"0 5\n"
            b"0000000000 65535 f\n"
            b"0000000009 00000 n\n"
            b"0000000056 00000 n\n"
            b"0000000111 00000 n\n"
            b"0000000212 00000 n\n"
            b"trailer\n<< /Size 5 /Root 1 0 R >>\n"
            b"startxref\n"
            b"315\n"
            b"%%EOF"
        )


@router.get("/ncert-pdf-proxy")
async def proxy_ncert_pdf(book_code: str, chapter_num: int):
    """
    Download an NCERT chapter PDF from ncert.nic.in/textbook/pdf/ and serve it inline.
    PDFs are cached on disk after the first download.
    Uses browser-like headers to avoid NCERT server connection resets.
    """
    from fastapi.responses import FileResponse
    from fastapi import Response
    from pathlib import Path
    import os

    response_headers = {
        "Content-Disposition": f'inline; filename="{book_code}{chapter_num:02d}.pdf"',
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Frame-Options": "",
    }

    # Intercept Tamil Nadu Board requests BEFORE resolve_actual_ncert_filename
    if book_code.startswith("tn"):
        is_vercel = os.getenv("VERCEL") == "1" or "VERCEL" in os.environ
        if is_vercel:
            cache_dir = Path("/tmp") / "data" / "ncert_pdf_cache"
        else:
            cache_dir = Path(__file__).resolve().parents[1] / "data" / "ncert_pdf_cache"
        os.makedirs(cache_dir, exist_ok=True)
        
        filename = f"{book_code}{chapter_num:02d}.pdf"
        cache_path = cache_dir / filename

        if cache_path.exists():
            logger.info(f"TN PDF cache hit: {filename}")
            return FileResponse(cache_path, media_type="application/pdf", headers=response_headers, filename=filename)

        # Parse book_code to class_num, subject, medium
        medium = "EN" if book_code.startswith("tnen") else "TM"
        rest = book_code[4:]
        cls_num = "10"
        for c in ["8", "9", "11", "12"]:
            if rest.startswith(c):
                cls_num = c
                rest = rest[len(c):]
                break

        subject = "Science"
        if rest.startswith("sc"):
            subject = "Science"
        elif rest.startswith("ma"):
            subject = "Maths"
        elif rest.startswith("ph"):
            subject = "Physics"
        elif rest.startswith("ch"):
            subject = "Chemistry"
        elif rest.startswith("bi"):
            subject = "Biology"

        class_num_key = f"{cls_num}_TN_{medium}"

        # Resolve chapter name from catalog
        from utils.curriculum import load_curriculum_catalog
        catalog = load_curriculum_catalog()
        chapters = catalog.get(class_num_key, {}).get(subject, [])

        chapter = None
        if 1 <= chapter_num <= len(chapters):
            chapter = chapters[chapter_num - 1]

        # Resolve volume index
        volume = 1
        if cls_num in ["11", "12"]:
            from utils.drive_downloader import get_tn_volume_for_chapter
            volume = get_tn_volume_for_chapter(class_num_key, subject, chapter_num)

        if cls_num in ["11", "12"]:
            if subject.lower() in ["physics", "chemistry", "maths"]:
                expected_pdf_name = f"Class_{cls_num}_{subject}_Volume_{volume}_{medium}_Medium.pdf"
            else:
                expected_pdf_name = f"Class_{cls_num}_{subject}_{medium}_Medium.pdf"
        else:
            expected_pdf_name = f"Class_{cls_num}_{subject}_{medium}_Medium.pdf"

        # Locate local PDF in tamilnaduboard/medium
        tn_dir = Path(__file__).resolve().parents[1] / "tamilnaduboard" / medium
        if not tn_dir.exists():
            tn_dir = Path(__file__).resolve().parents[2] / "tamilnaduboard" / medium
        if not tn_dir.exists():
            tn_dir = Path("./tamilnaduboard") / medium

        pdf_path = tn_dir / expected_pdf_name

        # On-demand download for Grades 11 and 12
        if cls_num in ["11", "12"] and not pdf_path.exists():
            logger.info(f"TN Book {expected_pdf_name} not found locally. Initiating download...")
            from utils.drive_downloader import get_tn_book_url, download_file
            download_url = get_tn_book_url(cls_num, subject, medium, volume)
            if download_url:
                # Run download in async context
                success = await download_file(download_url, pdf_path)
                if not success:
                    logger.error(f"Failed to download book from {download_url}")
            else:
                logger.error(f"No download URL found for Class {cls_num} {subject} {medium} Vol {volume}")

        # Fuzzy glob search fallback if exact expected name not found
        if not pdf_path.exists() and tn_dir.exists():
            for f in tn_dir.glob("*.pdf"):
                f_name = f.name.lower()
                if cls_num in f_name:
                    if cls_num in ["11", "12"]:
                        vol_str = f"vol_{volume}"
                        if (vol_str in f_name) and (subject.lower() in f_name or (subject.lower() == "maths" and "mathematics" in f_name)):
                            pdf_path = f
                            break
                    else:
                        if (subject.lower() in f_name or (subject.lower() == "maths" and "mathematics" in f_name)):
                            pdf_path = f
                            break

        if not pdf_path or not pdf_path.exists():
            logger.error(f"TN Board PDF not found for {subject} {medium} Class {cls_num}")
            placeholder_pdf = get_fallback_pdf()
            return Response(content=placeholder_pdf, media_type="application/pdf", headers=response_headers)

        # Slice the PDF
        start_page = -1
        if chapter:
            try:
                import PyPDF2
                with open(pdf_path, "rb") as f_pdf:
                    reader = PyPDF2.PdfReader(f_pdf)
                    num_pages = len(reader.pages)
                    # Search page content
                    for page_idx in range(10, num_pages):
                        page_text = reader.pages[page_idx].extract_text() or ""
                        if chapter.lower() in page_text.lower():
                            start_page = page_idx
                            break
            except Exception as e:
                logger.warning(f"PyPDF2 search failed for start page: {e}")

        # Fallback start page if title search failed
        if start_page == -1:
            start_page = 20 + (chapter_num - 1) * 20
            logger.warning(f"Chapter title '{chapter}' not found in PDF pages. Defaulting start page to {start_page}.")

        # Find the next chapter start page to identify the end of current chapter
        end_page = -1
        if chapter and chapter_num < len(chapters):
            next_chapter = chapters[chapter_num]
            try:
                import PyPDF2
                with open(pdf_path, "rb") as f_pdf:
                    reader = PyPDF2.PdfReader(f_pdf)
                    # Search starting from start_page + 1
                    for page_idx in range(start_page + 1, len(reader.pages)):
                        page_text = reader.pages[page_idx].extract_text() or ""
                        if next_chapter.lower() in page_text.lower():
                            end_page = page_idx
                            break
            except Exception:
                pass

        if end_page == -1 or end_page <= start_page:
            try:
                import PyPDF2
                with open(pdf_path, "rb") as f_pdf:
                    reader = PyPDF2.PdfReader(f_pdf)
                    end_page = min(start_page + 25, len(reader.pages))
            except Exception:
                end_page = start_page + 25

        # Perform the actual page slicing and save to cache
        try:
            import PyPDF2
            writer = PyPDF2.PdfWriter()
            with open(pdf_path, "rb") as f_pdf:
                reader = PyPDF2.PdfReader(f_pdf)
                total_p = len(reader.pages)
                sp = max(0, min(start_page, total_p - 1))
                ep = max(sp + 1, min(end_page, total_p))
                
                for p_idx in range(sp, ep):
                    writer.add_page(reader.pages[p_idx])
                    
                with open(cache_path, "wb") as f_out:
                    writer.write(f_out)
                    
            logger.info(f"Sliced and cached TN Board PDF: {filename} (pages {sp} to {ep})")
            return FileResponse(cache_path, media_type="application/pdf", headers=response_headers, filename=filename)
        except Exception as e:
            logger.error(f"Failed to slice TN Board PDF {filename}: {e}")
            try:
                if pdf_path.exists():
                    return FileResponse(pdf_path, media_type="application/pdf", headers=response_headers, filename=pdf_path.name)
            except Exception:
                pass
            placeholder_pdf = get_fallback_pdf()
            return Response(content=placeholder_pdf, media_type="application/pdf", headers=response_headers)

    from utils.textbook_fetcher import resolve_actual_ncert_filename
    book_code, chapter_num = resolve_actual_ncert_filename(book_code, chapter_num)

    chapter_num = max(1, chapter_num)
    padded = f"{chapter_num:02d}"
    filename = f"{book_code}{padded}.pdf"

    is_vercel = os.getenv("VERCEL") == "1" or "VERCEL" in os.environ
    if is_vercel:
        cache_dir = Path("/tmp") / "data" / "ncert_pdf_cache"
    else:
        cache_dir = Path(__file__).resolve().parents[1] / "data" / "ncert_pdf_cache"
    os.makedirs(cache_dir, exist_ok=True)
    cache_path = cache_dir / filename

    response_headers = {
        "Content-Disposition": f'inline; filename="{filename}"',
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Frame-Options": "",
    }

    if cache_path.exists():
        logger.info(f"NCERT PDF cache hit: {filename}")
        return FileResponse(cache_path, media_type="application/pdf", headers=response_headers, filename=filename)

    ncert_pdf_url = f"https://ncert.nic.in/textbook/pdf/{filename}"
    logger.info(f"Proxying NCERT PDF: {ncert_pdf_url}")

    # NCERT server requires browser-like headers or it closes the connection
    browser_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/pdf,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://ncert.nic.in/textbook.php",
    }

    try:
        import asyncio
    except ImportError:
        import asyncio

    retries = 3
    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=45.0, follow_redirects=True, headers=browser_headers) as client:
                response = await client.get(ncert_pdf_url)
                ctype = response.headers.get("content-type", "")
                is_pdf = "pdf" in ctype or (len(response.content) > 4 and response.content[:4] == b"%PDF")
                if response.status_code == 200 and is_pdf:
                    cache_path.write_bytes(response.content)
                    logger.info(f"Cached {filename} ({len(response.content) // 1024} KB)")
                    return FileResponse(cache_path, media_type="application/pdf", headers=response_headers, filename=filename)
                else:
                    logger.warning(f"NCERT PDF download attempt {attempt+1} failed: status={response.status_code} ctype={ctype}")
                    if attempt == retries - 1:
                        placeholder_pdf = get_fallback_pdf()
                        return Response(content=placeholder_pdf, media_type="application/pdf", headers=response_headers)
        except Exception as e:
            logger.warning(f"NCERT PDF download attempt {attempt+1} got exception: {e}")
            if attempt == retries - 1:
                logger.error(f"Error proxying NCERT PDF {filename} after {retries} attempts: ", exc_info=True)
                placeholder_pdf = get_fallback_pdf()
                return Response(content=placeholder_pdf, media_type="application/pdf", headers=response_headers)
        # Wait a bit before retrying
        await asyncio.sleep(1.0)



