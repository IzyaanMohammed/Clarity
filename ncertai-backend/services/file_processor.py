import PyPDF2
import base64
import io
import os
from PIL import Image

def extract_text_from_pdf(file_bytes: bytes) -> str:
    pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text() + "\n"
    return text.strip()

def image_to_base64(file_bytes: bytes) -> str:
    return base64.b64encode(file_bytes).decode('utf-8')

def get_file_type(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext == '.pdf':
        return "pdf"
    elif ext in ['.jpg', '.jpeg', '.png']:
        return "image"
    return "unknown"

def process_file_for_ai(file_bytes: bytes, filename: str) -> dict:
    file_type = get_file_type(filename)
    if file_type == "pdf":
        extracted_text = extract_text_from_pdf(file_bytes)
        return {"type": "pdf", "content": extracted_text}
    elif file_type == "image":
        base64_str = image_to_base64(file_bytes)
        return {"type": "image", "base64": base64_str}
    else:
        return {"type": "unknown", "content": ""}
