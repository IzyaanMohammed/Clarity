import json
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

KNOWLEDGE_BASE_DIR = Path(__file__).resolve().parents[1] / "knowledge"

def get_ncert_context(class_num: str, subject: str, chapter: str, query: str = "") -> str:
    """
    Finds relevant NCERT snippets from local knowledge base to inject into prompts.
    This saves credits by only sending the necessary text for a specific query.
    """
    # Normalize filename: e.g., science_class10_light.json
    # We use a simple mapping or naming convention
    filename = f"{subject.lower()}_class{class_num}_{chapter.lower()}".replace(" ", "_").replace("\u2013", "").replace("-", "")
    # Try to find a match that starts with the subject/class
    target_file = None
    if os.path.exists(KNOWLEDGE_BASE_DIR):
        for f in os.listdir(KNOWLEDGE_BASE_DIR):
            if f.endswith(".json") and subject.lower() in f.lower() and f"class{class_num}" in f.lower():
                # Check if chapter name (simplified) is in filename
                clean_chapter = chapter.lower().replace(" ", "").replace("\u2013", "").replace("-", "")
                if clean_chapter[:10] in f.lower().replace("_", ""): # Partial match
                    target_file = KNOWLEDGE_BASE_DIR / f
                    break
    
    if not target_file or not target_file.exists():
        logger.debug(f"No local NCERT knowledge file found for {subject} Class {class_num} {chapter}")
        return ""

    try:
        with open(target_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            concepts = data.get("concepts", [])
            
            # Simple keyword-based retrieval
            relevant_snippets = []
            query_lower = query.lower()
            
            for concept in concepts:
                # If query is empty, we might return all key concepts (limited)
                # If query exists, we match against title and keywords
                if not query:
                    relevant_snippets.append(f"### {concept['title']}\n{concept['ncert_text']}")
                    continue
                
                match = False
                if concept['title'].lower() in query_lower:
                    match = True
                else:
                    for kw in concept.get("keywords", []):
                        if kw.lower() in query_lower:
                            match = True
                            break
                
                if match:
                    relevant_snippets.append(f"### {concept['title']}\n{concept['ncert_text']}")
            
            if not relevant_snippets:
                # Fallback: just return the first 2-3 concepts as general context
                for concept in concepts[:2]:
                    relevant_snippets.append(f"### {concept['title']}\n{concept['ncert_text']}")
            
            context_block = "\n\nOFFICIAL NCERT TEXTBOOK EXCERPTS:\n" + "\n".join(relevant_snippets)
            return context_block

    except Exception as e:
        logger.error(f"Error retrieving NCERT context: {e}")
        return ""
