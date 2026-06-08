import base64
import io
import os
import logging

logger = logging.getLogger(__name__)


def image_to_base64(file_bytes: bytes) -> str:
    return base64.b64encode(file_bytes).decode("utf-8")


def get_file_type(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".pdf":
        return "pdf"
    elif ext in [".jpg", ".jpeg", ".png", ".webp"]:
        return "image"
    return "unknown"


def _render_page_as_image_base64(pdf_bytes: bytes, page_num: int = 0, dpi: int = 150) -> str | None:
    """Render a single PDF page to a PNG image using PyMuPDF (fitz). Returns base64 or None."""
    try:
        import fitz  # PyMuPDF

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if page_num >= len(doc):
            page_num = 0
        page = doc[page_num]
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("png")
        return base64.b64encode(img_bytes).decode("utf-8")
    except Exception as e:
        logger.warning("PyMuPDF render failed: %s", e)
        return None


def extract_text_from_pdf(file_bytes: bytes) -> tuple[str, list[int]]:
    """
    Extract text from PDF using pdfplumber (better layout handling than PyPDF2).
    Also returns a list of page indices that are image-heavy (low text / contain images).
    Falls back to PyPDF2 if pdfplumber is unavailable.

    Returns:
        (text: str, image_heavy_pages: list[int])
    """
    image_heavy_pages: list[int] = []

    # ── pdfplumber (preferred) ──────────────────────────────────────────────
    try:
        import pdfplumber

        pages_text: list[str] = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text() or ""
                # Detect image-heavy pages: very little text but has image objects
                has_images = bool(page.images)
                if has_images and len(page_text.strip()) < 120:
                    image_heavy_pages.append(i)
                pages_text.append(page_text)

        full_text = "\n\n".join(t for t in pages_text if t.strip())
        return full_text.strip(), image_heavy_pages

    except ImportError:
        logger.warning("pdfplumber not available, falling back to PyPDF2")
    except Exception as e:
        logger.warning("pdfplumber failed: %s — falling back to PyPDF2", e)

    # ── PyPDF2 fallback ────────────────────────────────────────────────────
    try:
        import PyPDF2

        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        pages_text = []
        for page in reader.pages:
            pages_text.append(page.extract_text() or "")
        full_text = "\n".join(pages_text)
        return full_text.strip(), []
    except Exception as e:
        logger.error("PyPDF2 fallback also failed: %s", e)
        return "", []


def process_file_for_ai(file_bytes: bytes, filename: str) -> dict:
    """
    Process an uploaded file and return a dict ready for AI consumption.

    For PDFs:
        - text extracted via pdfplumber
        - image_heavy_pages: list of page indices with diagrams/images
        - first_page_b64: base64 of the first page rendered as PNG (for vision AI)

    For images:
        - base64 of the image
    """
    file_type = get_file_type(filename)

    if file_type == "pdf":
        extracted_text, image_heavy_pages = extract_text_from_pdf(file_bytes)

        # Always render page 0 as image — used when text is scarce or for diagram context
        first_page_b64 = _render_page_as_image_base64(file_bytes, page_num=0)

        return {
            "type": "pdf",
            "content": extracted_text,
            "image_heavy_pages": image_heavy_pages,
            "first_page_b64": first_page_b64,  # may be None if PyMuPDF not installed
        }

    elif file_type == "image":
        b64 = image_to_base64(file_bytes)
        return {"type": "image", "base64": b64}

    else:
        return {"type": "unknown", "content": ""}
