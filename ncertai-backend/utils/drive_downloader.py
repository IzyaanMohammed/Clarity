import httpx
import re
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

TN_BOOK_URLS = {
    "11": {
        "EN": {
            "physics": [
                "https://drive.google.com/file/d/1gPm6SqSPzqqSYPtr7p1hb8H8liJfzyzI/view?usp=drivesdk",
                "https://drive.google.com/file/d/1t18PLQjnmz3LbyHv6KcvCVaApRGZozWQ/view?usp=drivesdk"
            ],
            "chemistry": [
                "https://drive.google.com/file/d/1Jk3r4naN2lepCZWCEfVkwKJqRQVyRpmP/view?usp=drivesdk",
                "https://drive.google.com/file/d/1TYM3G81puqOPLPgo5-k7FWgy3GaF8bAF/view?usp=drivesdk"
            ],
            "maths": [
                "https://drive.google.com/file/d/12u6WLVsxzxvSRUa6KlaQz4vi8cxwZ6xS/view?usp=drivesdk",
                "https://drive.google.com/file/d/1untv9Niccely-Gbu81onCZVS2TyCp45D/view?usp=drivesdk"
            ],
            "biology": [
                "https://drive.google.com/open?id=12XgCJHeMxbHnzs1rNKuP3v8rb29Lj8Eh"
            ]
        },
        "TM": {
            "physics": [
                "https://drive.google.com/file/d/1wmJfIHz0hadMunraadkGm2QLKNYo18oL/view?usp=drivesdk",
                "https://drive.google.com/file/d/1PauH72i55BHEqQCp_9q_u5l1-ajOf3E_/view?usp=drivesdk"
            ],
            "chemistry": [
                "https://drive.google.com/file/d/1WoXpcHqBUfzgt9jyjVRqaoYBO7xkjVUp/view?usp=drivesdk",
                "https://drive.google.com/file/d/1WRprAZZrELgZSvvz68ahmyMt25RE9zeZ/view?usp=drivesdk"
            ],
            "maths": [
                "https://drive.google.com/file/d/1dF5CqgC_C7CkjxZ77mOZukp8t6nfM5Wc/view?usp=drivesdk",
                "https://drive.google.com/file/d/16Zs5CYLdcHrnHFQPUtO3zu67zO2PTfXK/view?usp=drivesdk"
            ],
            "biology": [
                "https://drive.google.com/open?id=1CpzOUsSuNrh4YrXmmQdme5aXFPm2ieAM"
            ]
        }
    },
    "12": {
        "EN": {
            "physics": [
                "https://drive.google.com/file/d/1fCGFMpgWHYwnDwj1C2q7ZnKzSvuJnTpC/view?usp=drivesdk",
                "https://drive.google.com/file/d/1Wym407rJT8FWOOwnwGEOLVrA0VDJmQYv/view?usp=drivesdk"
            ],
            "chemistry": [
                "https://drive.google.com/file/d/1KWtBVDVWbnYk3DQN4iDXmz0A7vulrVm0/view?usp=drivesdk",
                "https://drive.google.com/file/d/1xgADsJ_eEO70BYhE2UHtLtYlL1H18Mfv/view?usp=drivesdk"
            ],
            "maths": [
                "https://drive.google.com/file/d/1_auJ33Wb1pI2_DxahdqJ1poiRUh6hqvm/view?usp=drivesdk",
                "https://drive.google.com/file/d/1EpNZmRikhWY6zsYRMnAtC4N_K6S3iB34/view?usp=drivesdk"
            ],
            "biology": [
                "https://drive.google.com/open?id=12XgCJHeMxbHnzs1rNKuP3v8rb29Lj8Eh"
            ],
            "english": [
                "https://drive.google.com/file/d/1AGMM_G3KdHQHyrOkoDm3WtWvNzdalTy-/view?usp=drivesdk"
            ]
        },
        "TM": {
            "physics": [
                "https://drive.google.com/file/d/1nzxJjUlCVT1zq9AUpsKt_U0WodvdwN0i/view?usp=drivesdk",
                "https://drive.google.com/file/d/1p35m1UvmQ0dOuSeIkb85Ts61c9wUnAWu/view?usp=drivesdk"
            ],
            "chemistry": [
                "https://drive.google.com/file/d/1ccbMFwxbuMb2faR1grzllxeu9PWbyXqZ/view?usp=drivesdk",
                "https://drive.google.com/file/d/1gVJ82Mw8At8Dxedk-UYWBBL6ahazzOEq/view?usp=drivesdk"
            ],
            "maths": [
                "https://drive.google.com/file/d/1bqvhf4I90dxYhc9t2-rUJZ_e3O1cEG9Z/view?usp=drivesdk",
                "https://drive.google.com/file/d/1K_9vIHAodERyxUyoDiBU7VlWxPhY5C7P/view?usp=drivesdk"
            ],
            "biology": [
                "https://drive.google.com/open?id=1CpzOUsSuNrh4YrXmmQdme5aXFPm2ieAM"
            ],
            "english": [
                "https://drive.google.com/file/d/19apXLahKV9V3K-FAatG1Qgy0b_Y6spIH/view?usp=drivesdk"
            ]
        }
    }
}

def extract_drive_id(url: str) -> str:
    """
    Extract file ID from Google Drive URLs.
    """
    if "drive.google.com" not in url:
        return ""
    m = re.search(r"/file/d/([a-zA-Z0-9_-]+)", url)
    if m:
        return m.group(1)
    m = re.search(r"[?&]id=([a-zA-Z0-9_-]+)", url)
    if m:
        return m.group(1)
    return ""

def get_tn_volume_for_chapter(cls_num_str: str, subject: str, chapter_idx: int) -> int:
    """
    Resolve which volume is needed based on class, subject and chapter index.
    """
    subj = subject.lower()
    cls = cls_num_str.split("_")[0]
    if cls == "11":
        if "physics" in subj:
            return 1 if chapter_idx <= 5 else 2
        elif "chemistry" in subj:
            return 1 if chapter_idx <= 7 else 2
        elif "math" in subj:
            return 1 if chapter_idx <= 6 else 2
    elif cls == "12":
        if "physics" in subj:
            return 1 if chapter_idx <= 5 else 2
        elif "chemistry" in subj:
            return 1 if chapter_idx <= 5 else 2
        elif "math" in subj:
            return 1 if chapter_idx <= 6 else 2
    return 1

def get_tn_book_url(class_num: str, subject: str, medium: str, volume: int = 1) -> str:
    """
    Retrieve direct Google Drive URL for the specific textbook volume.
    """
    cls = str(class_num).strip()
    subj = str(subject).strip().lower()
    med = str(medium).strip().upper()
    
    if "math" in subj:
        subj = "maths"
        
    cls_data = TN_BOOK_URLS.get(cls, {})
    med_data = cls_data.get(med, {})
    urls = med_data.get(subj, [])
    
    if not urls:
        return ""
        
    vol_idx = max(0, min(volume - 1, len(urls) - 1))
    return urls[vol_idx]

async def download_file(url: str, dest_path: Path) -> bool:
    """
    Download a file from a URL (Google Drive or direct CloudFront/HTTP links).
    Caches on disk at dest_path.
    """
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    
    drive_id = extract_drive_id(url)
    if drive_id:
        return await download_from_google_drive(drive_id, dest_path)
    
    # Otherwise standard HTTP download
    logger.info(f"Downloading direct link: {url}")
    try:
        async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
            async with client.stream("GET", url) as response:
                if response.status_code != 200:
                    logger.error(f"Failed to download direct link: status={response.status_code}")
                    return False
                with open(dest_path, "wb") as f:
                    async for chunk in response.iter_bytes(chunk_size=8192):
                        f.write(chunk)
        logger.info(f"Direct download successful: {dest_path.name}")
        return True
    except Exception as e:
        logger.error(f"Error downloading direct link: {e}")
        return False

async def download_from_google_drive(file_id: str, dest_path: Path) -> bool:
    """
    Download a file from Google Drive using the web confirmation mechanism for large files.
    """
    logger.info(f"Downloading from Google Drive ID: {file_id}")
    
    base_url = "https://docs.google.com/uc"
    params = {"export": "download", "id": file_id}
    
    try:
        async with httpx.AsyncClient(timeout=180.0, follow_redirects=True) as client:
            resp = await client.get(base_url, params=params)
            
            confirm_token = None
            html = resp.text
            
            m = re.search(r'confirm=([a-zA-Z0-9_-]+)', html)
            if m:
                confirm_token = m.group(1)
            else:
                m = re.search(r'name="confirm"\s+value="([a-zA-Z0-9_-]+)"', html)
                if m:
                    confirm_token = m.group(1)
                    
            if confirm_token:
                logger.info(f"Found Google Drive confirm token: {confirm_token}")
                params["confirm"] = confirm_token
                resp = await client.get(base_url, params=params)
                
            # Write to disk
            if resp.status_code == 200 and len(resp.content) > 1000:
                content_prefix = resp.content[:4]
                if content_prefix == b"%PDF" or "pdf" in resp.headers.get("content-type", "").lower():
                    dest_path.write_bytes(resp.content)
                    logger.info(f"Google Drive download successful: {dest_path.name} ({len(resp.content)//1024} KB)")
                    return True
                else:
                    logger.error(f"Downloaded content from Drive is not a PDF! First 100 chars: {resp.content[:100]}")
                    return False
            else:
                logger.error(f"Google Drive download failed with status={resp.status_code}")
                return False
    except Exception as e:
        logger.error(f"Error downloading from Google Drive: {e}")
        return False
