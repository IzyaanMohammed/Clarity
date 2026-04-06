from fastapi import APIRouter, HTTPException

from utils.curriculum import load_curriculum_catalog

router = APIRouter()


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
