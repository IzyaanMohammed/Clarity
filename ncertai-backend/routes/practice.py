from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
from typing import Optional
import asyncio
import re
from pathlib import Path
from pydantic import BaseModel
from models.schemas import (
    PracticeRequest,
    PracticeResponse,
    GradeRequest,
    GradeResponse,
    FlashcardRequest,
    FlashcardResponse,
    FlashcardItem,
    ChapterReadinessResponse,
    ResourceStackResponse,
    StudyNotificationResponse,
    MockScheduleResponse,
)
from services.openrouter import ask_openrouter, ask_openrouter_stream
from services.database import fetch_progress_logs, get_user_profile, get_username_by_token, increment_exam_simulations
from services.worksheet_discovery import merge_local_and_remote_worksheets
from services.youtube_resource import get_best_cbse_videos
from utils.curriculum import load_curriculum_catalog
from utils.rate_limiter import check_rate_limit, increment_usage
from utils.auth import require_pro_max_username
from utils.textbook_fetcher import get_textbook_chapter_text
import logging
import json
from datetime import datetime, date, timedelta
from urllib.parse import parse_qs, urlparse
import uuid

try:
    from youtube_transcript_api import YouTubeTranscriptApi
except Exception:  # pragma: no cover - optional dependency in local dev
    YouTubeTranscriptApi = None

router = APIRouter()
logger = logging.getLogger(__name__)


class ExamSimStartRequest(BaseModel):
    class_num: str
    subject: str
    scope: str = "single-chapter"  # single-chapter | multi-chapter | full-subject
    chapter: str = ""
    chapters: list[str] = []
    mode: str = "full-mock"  # full-mock | section-drill
    duration_minutes: int = 180
    question_count: int = 10
    total_marks: int = 80
    stick_to_textbook: Optional[bool] = False


class ExamSimAnswerItem(BaseModel):
    question_id: str = ""
    question: str
    marks_available: int = 5
    answer_text: str


class ExamSimSubmitRequest(BaseModel):
    session_id: str
    class_num: str
    subject: str
    scope: str = "single-chapter"
    chapter: str = ""
    chapters: list[str] = []
    mode: str = "full-mock"
    answers: list[ExamSimAnswerItem] = []


def _resolve_user_tier(username: str) -> str:
    profile = get_user_profile(username)
    if not profile:
        return "free"
    return profile.get("subscription_tier") or profile.get("subscriptionTier") or "free"


def _extract_youtube_video_id(video_id: str = "", video_url: str = "") -> str:
    direct = str(video_id or "").strip()
    if direct and re.fullmatch(r"[A-Za-z0-9_-]{6,}", direct):
        return direct

    raw_url = str(video_url or "").strip()
    if not raw_url:
        return ""

    try:
        parsed = urlparse(raw_url)
        host = (parsed.netloc or "").lower()
        path = (parsed.path or "").strip("/")
        if "youtu.be" in host and path:
            return path
        if "youtube.com" in host:
            if path == "watch":
                query = parse_qs(parsed.query or "")
                candidate = (query.get("v") or [""])[0]
                if candidate:
                    return candidate
            if path.startswith("embed/"):
                return path.split("/")[-1]
    except Exception:
        return ""
    return ""


def _format_seconds(seconds: float | int) -> str:
    total = max(0, int(float(seconds or 0)))
    mins = total // 60
    secs = total % 60
    return f"{mins:02d}:{secs:02d}"


def _fetch_video_transcript_entries(video_id: str) -> list[dict]:
    if YouTubeTranscriptApi is None:
        raise HTTPException(
            status_code=503,
            detail="Transcript feature unavailable. Install youtube-transcript-api in backend environment.",
        )
    try:
        entries = YouTubeTranscriptApi().fetch(video_id, languages=["en", "en-IN", "hi"])
        cleaned = []
        for row in entries:
            text = ""
            start = 0.0
            duration = 0.0
            if isinstance(row, dict):
                text = str(row.get("text") or "").strip()
                start = float(row.get("start") or 0.0)
                duration = float(row.get("duration") or 0.0)
            else:
                text = str(getattr(row, "text", "") or "").strip()
                start = float(getattr(row, "start", 0.0))
                duration = float(getattr(row, "duration", 0.0))

            if not text:
                continue
            cleaned.append(
                {
                    "start": start,
                    "duration": duration,
                    "text": text,
                }
            )
        if not cleaned:
            raise HTTPException(status_code=404, detail="Transcript was found but empty for this video.")
        return cleaned
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Could not fetch transcript for this video: {str(exc)}") from exc


def _extract_first_json_object(raw: str) -> dict:
    text = str(raw or "").strip()
    if not text:
        return {}
    try:
        return json.loads(text)
    except Exception:
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return {}
    try:
        return json.loads(match.group(0))
    except Exception:
        return {}


def _fallback_video_intelligence(transcript_entries: list[dict], moment_count: int, subject: str = "Science", chapter: str = "Chapter") -> dict:
    chapter_lower = chapter.lower().strip()
    
    # 1. High-quality chapter-specific fallbacks
    if "life processes" in chapter_lower:
        return {
            "key_moments": [
                {
                    "timestamp_seconds": 30,
                    "timestamp_label": "00:30",
                    "subtopic": "Intro to Nutrition & Photosynthesis",
                    "important_point": "Photosynthesis is the autotrophic process where green plants convert solar energy into chemical energy using CO2, H2O, and chlorophyll, producing glucose and releasing O2.",
                    "keywords": ["autotrophic", "photosynthesis", "chlorophyll", "stomata"],
                    "coach_note": "Write down the balanced chemical equation for photosynthesis from memory.",
                    "exam_answer_frame": "Balanced Equation -> Raw materials -> Three main steps of photosynthesis -> Importance.",
                    "common_trap": "Forgetting to write the raw materials (chlorophyll, sunlight) above/below the arrow in the balanced equation.",
                    "memory_hook": "Sunlight + CO2 + H2O -> Glucose + Oxygen (Needs Chlorophyll)"
                },
                {
                    "timestamp_seconds": 180,
                    "timestamp_label": "03:00",
                    "subtopic": "Alimentary Canal & Digestion",
                    "important_point": "The small intestine is the site of complete digestion of carbohydrates, proteins, and fats. It receives secretions like bile (liver) and pancreatic juice containing trypsin and lipase.",
                    "keywords": ["villi", "peristalsis", "trypsin", "lipase", "bile"],
                    "coach_note": "Draw a quick flowchart mapping the action of salivary amylase, pepsin, trypsin, and lipase.",
                    "exam_answer_frame": "Organ name -> Secreted juice/enzyme -> Action on food type -> Resulting product.",
                    "common_trap": "Confusing pepsin (active in acidic stomach) with trypsin (active in alkaline small intestine).",
                    "memory_hook": "Pepsin = Stomach (Acid), Trypsin = Pancreas/Intestine (Base)"
                },
                {
                    "timestamp_seconds": 420,
                    "timestamp_label": "07:00",
                    "subtopic": "Respiration Pathways",
                    "important_point": "Aerobic respiration in mitochondria yields 36/38 ATP. Anaerobic respiration in muscle cells yields lactic acid + 2 ATP, causing muscle cramps due to oxygen debt.",
                    "keywords": ["aerobic", "anaerobic", "pyruvate", "mitochondria", "lactic acid"],
                    "coach_note": "List the three pathways of glucose breakdown (presence, absence, and lack of oxygen).",
                    "exam_answer_frame": "Glucose (6C) -> Pyruvate (3C) in cytoplasm -> Three separate paths based on O2 availability.",
                    "common_trap": "Writing that anaerobic respiration in yeast produces lactic acid (it produces ethanol and CO2 instead).",
                    "memory_hook": "Yeast = Ethanol, Muscle = Lactic Acid, Mitochondria = CO2 + H2O"
                },
                {
                    "timestamp_seconds": 720,
                    "timestamp_label": "12:00",
                    "subtopic": "Double Circulation in Humans",
                    "important_point": "Blood flows through the heart twice in one complete cycle: pulmonary circulation (heart to lungs and back) and systemic circulation (heart to body and back), preventing oxygenated and deoxygenated blood mixing.",
                    "keywords": ["double circulation", "ventricles", "atria", "pulmonary artery", "aorta"],
                    "coach_note": "Draw a schematic outline showing blood flow through the four chambers of the heart.",
                    "exam_answer_frame": "Right side (deoxygenated) -> Lungs -> Left side (oxygenated) -> Body -> Right side.",
                    "common_trap": "Thinking arteries always carry oxygenated blood; remember the pulmonary artery carries deoxygenated blood.",
                    "memory_hook": "Artery = Away from heart. Vein = Valve-protected returning flow."
                },
                {
                    "timestamp_seconds": 1080,
                    "timestamp_label": "18:00",
                    "subtopic": "Excretory System & Nephron",
                    "important_point": "The nephron performs ultrafiltration in Bowman's capsule, selective reabsorption of glucose/amino acids/salts/water in the tubule, and tubular secretion to form urine.",
                    "keywords": ["nephron", "glomerulus", "reabsorption", "filtration", "ureter"],
                    "coach_note": "Recall and write down the three steps of urine formation in the kidney.",
                    "exam_answer_frame": "Glomerular Filtration -> Tubular Reabsorption -> Tubular Secretion -> Collection.",
                    "common_trap": "Confounded ureter (kidney to bladder) and urethra (bladder to outside) in excretion flowcharts.",
                    "memory_hook": "Glomerulus filters, Tubule reabsorbs what the body needs back."
                }
            ][:moment_count],
            "quiz": [
                {
                    "question": "Which of the following is the site of complete digestion of food in humans?",
                    "options": ["Mouth", "Stomach", "Small Intestine", "Large Intestine"],
                    "answer_index": 2,
                    "explanation": "The small intestine receives pancreatic juice and bile, completing carbohydrate, protein, and fat digestion.",
                },
                {
                    "question": "What is the breakdown product of glucose in the cytoplasm before respiration?",
                    "options": ["Ethanol", "Lactic Acid", "Pyruvate", "Carbon Dioxide"],
                    "answer_index": 2,
                    "explanation": "Glucose (a 6-carbon molecule) is first broken down into Pyruvate (a 3-carbon molecule) in the cytoplasm.",
                },
                {
                    "question": "Which blood vessel carries oxygenated blood from the lungs to the heart?",
                    "options": ["Pulmonary Artery", "Pulmonary Vein", "Aorta", "Vena Cava"],
                    "answer_index": 1,
                    "explanation": "The pulmonary vein is an exception and carries oxygenated blood from the lungs back to the left atrium of the heart.",
                }
            ],
        }
    elif "control and coordination" in chapter_lower:
        return {
            "key_moments": [
                {
                    "timestamp_seconds": 30,
                    "timestamp_label": "00:30",
                    "subtopic": "Reflex Arc & Synapse",
                    "important_point": "A reflex arc is the shortest pathway of reflex action: Receptor -> Sensory Neuron -> Spinal Cord (Relay Neuron) -> Motor Neuron -> Effector. At the synapse, electrical impulses are converted to chemical signals.",
                    "keywords": ["reflex arc", "synapse", "neurotransmitter", "receptor", "sensory neuron"],
                    "coach_note": "Draw the pathway of a reflex arc when touching a hot object.",
                    "exam_answer_frame": "Receptor (Skin) -> Sensory -> Spinal Cord -> Motor -> Effector (Muscle).",
                    "common_trap": "Labeling the brain as the main center of reflex arcs instead of the spinal cord.",
                    "memory_hook": "Sensor -> In (Sensory) -> Cord -> Out (Motor) -> Muscle"
                },
                {
                    "timestamp_seconds": 180,
                    "timestamp_label": "03:00",
                    "subtopic": "Human Brain Divisions",
                    "important_point": "The brain has three parts: Forebrain (cerebrum for learning/thinking), Midbrain (reflexes for head/eye movements), and Hindbrain (cerebellum for balance, medulla for involuntary centers like breathing, pons).",
                    "keywords": ["cerebrum", "cerebellum", "medulla", "hypothalamus", "hindbrain"],
                    "coach_note": "State which brain part coordinates voluntary movements like walking in a straight line.",
                    "exam_answer_frame": "Identify the action (voluntary/involuntary) -> Attribute to Cerebrum or Cerebellum/Medulla.",
                    "common_trap": "Misspelling cerebrum and cerebellum or reversing their functions in posture control.",
                    "memory_hook": "Cerebellum = Balance (Gymnastics/Posture), Cerebrum = Smart thoughts"
                },
                {
                    "timestamp_seconds": 420,
                    "timestamp_label": "07:00",
                    "subtopic": "Plant Hormones (Phytohormones)",
                    "important_point": "Auxins promote cell growth and cause phototropism. Gibberellins promote stem growth. Cytokinins stimulate rapid cell division. Abscisic acid inhibits growth, causing leaf wilting.",
                    "keywords": ["auxin", "gibberellin", "cytokinin", "abscisic acid", "growth inhibitor"],
                    "coach_note": "Match each phytohormone with its growth promoting or growth inhibiting role.",
                    "exam_answer_frame": "Name of hormone -> Primary growth effect -> Exam example of plant response.",
                    "common_trap": "Listing Abscisic acid as a growth promoter; it is the classic growth inhibitor.",
                    "memory_hook": "Auxin = Upwards/Sunlight, Abscisic Acid = Abandon leaves (Wilting)"
                },
                {
                    "timestamp_seconds": 720,
                    "timestamp_label": "12:00",
                    "subtopic": "Tropic & Nastic Movements",
                    "important_point": "Tropic movements are directional growth responses (Phototropism, Geotropism, Hydrotropism, Chemotropism). Nastic movements are non-directional growth-independent responses (e.g., touch-sensitive mimosa).",
                    "keywords": ["tropic", "nastic", "chemotropism", "geotropism", "mimosa"],
                    "coach_note": "Give one example of chemotropism in plant fertilization.",
                    "exam_answer_frame": "Definition of tropic/nastic -> Directional status -> Specific plant example.",
                    "common_trap": "Thinking mimosa leaf folding is a tropic movement (it is nastic/thigmonastic).",
                    "memory_hook": "Tropic = Towards/Away (Directional), Nastic = Non-directional"
                },
                {
                    "timestamp_seconds": 1080,
                    "timestamp_label": "18:00",
                    "subtopic": "Endocrine Glands & Hormones",
                    "important_point": "Hormones are chemical messengers secreted directly into blood: Thyroid (thyroxine - metabolism), Pancreas (insulin - glucose level), Adrenal (adrenaline - emergency response). Regulated via feedback loops.",
                    "keywords": ["thyroxine", "insulin", "adrenaline", "pituitary", "feedback mechanism"],
                    "coach_note": "Describe how blood sugar levels regulate insulin production using feedback loops.",
                    "exam_answer_frame": "High Glucose -> Pancreas detects -> Secretes insulin -> Level drops -> Secretion decreases.",
                    "common_trap": "Failing to explain how the 'feedback' actually turns off or decreases hormone production.",
                    "memory_hook": "Feedback = Thermostat (high levels turn off the gland)"
                }
            ][:moment_count],
            "quiz": [
                {
                    "question": "Which hormone is responsible for the wilting of leaves in plants?",
                    "options": ["Auxin", "Gibberellin", "Cytokinin", "Abscisic Acid"],
                    "answer_index": 3,
                    "explanation": "Abscisic acid is a plant growth inhibitor that causes dormancy, wilting of leaves, and detachment of fruits.",
                },
                {
                    "question": "What is the correct pathway of a reflex arc?",
                    "options": [
                        "Receptor -> Motor Neuron -> Spinal Cord -> Sensory Neuron -> Effector",
                        "Receptor -> Sensory Neuron -> Spinal Cord -> Motor Neuron -> Effector",
                        "Spinal Cord -> Receptor -> Sensory Neuron -> Motor Neuron -> Effector",
                        "Receptor -> Sensory Neuron -> Brain -> Motor Neuron -> Effector"
                    ],
                    "answer_index": 1,
                    "explanation": "A reflex action pathway goes from Receptor -> Sensory Neuron -> Spinal Cord -> Motor Neuron -> Effector (muscle/gland).",
                },
                {
                    "question": "Which part of the human brain controls posture and balance of the body?",
                    "options": ["Cerebrum", "Cerebellum", "Medulla", "Pons"],
                    "answer_index": 1,
                    "explanation": "The cerebellum in the hindbrain is responsible for coordinating voluntary movements and maintaining body posture and balance.",
                }
            ],
        }
    elif "light" in chapter_lower or "reflection" in chapter_lower or "refraction" in chapter_lower:
        return {
            "key_moments": [
                {
                    "timestamp_seconds": 30,
                    "timestamp_label": "00:30",
                    "subtopic": "Reflection of Light & Spherical Mirrors",
                    "important_point": "Concave mirrors converge light and form real, inverted images (except when placed within focus, forming virtual, erect images). Convex mirrors always form virtual, erect, and diminished images.",
                    "keywords": ["concave mirror", "reflection", "ray diagram", "focus"],
                    "coach_note": "Draw the ray diagram for a concave mirror when the object is placed between F and C.",
                    "exam_answer_frame": "Mirror Type -> Object Position -> Image Position -> Nature and Size of Image.",
                    "common_trap": "Forgetting that u (object distance) is always negative under Cartesian sign convention.",
                    "memory_hook": "Concave = Converging (mostly real), Convex = Diverging (always virtual/diminished)"
                },
                {
                    "timestamp_seconds": 180,
                    "timestamp_label": "03:00",
                    "subtopic": "Refraction & Snell's Law",
                    "important_point": "Refraction is the bending of light at the boundary of two media. Snell's law states that the ratio of sine of angle of incidence to sine of angle of refraction is constant (sin i / sin r = refractive index).",
                    "keywords": ["refraction", "snell's law", "refractive index", "bending"],
                    "coach_note": "State the two laws of refraction of light.",
                    "exam_answer_frame": "Incident/Refracted ray and normal lie in same plane -> sin i / sin r = constant -> refractive index formula.",
                    "common_trap": "Thinking light bends towards the normal when passing from dense to rare (it bends away from the normal).",
                    "memory_hook": "Rare to Dense = Towards Normal, Dense to Rare = Away from Normal"
                },
                {
                    "timestamp_seconds": 420,
                    "timestamp_label": "07:00",
                    "subtopic": "Lens Formula & Magnification",
                    "important_point": "The lens formula is 1/v - 1/u = 1/f. Magnification m = v/u. The power of a lens is P = 1/f (in meters), measured in Dioptres (D).",
                    "keywords": ["lens formula", "magnification", "power of lens", "dioptre"],
                    "coach_note": "Write the lens formula and calculate the power of a lens with focal length +25 cm.",
                    "exam_answer_frame": "Write formula -> Plug values with signs -> Solve for v or f -> Calculate magnification.",
                    "common_trap": "Confusing mirror magnification (m = -v/u) with lens magnification (m = v/u).",
                    "memory_hook": "Lens has minus in formula (1/v-1/u) but plus in magnification (v/u)"
                }
            ][:moment_count],
            "quiz": [
                {
                    "question": "A concave mirror has a focal length of 15 cm. If an object is placed 10 cm in front of it, what is the nature of the image?",
                    "options": [
                        "Real and inverted",
                        "Virtual and erect",
                        "Real and erect",
                        "Virtual and inverted"
                    ],
                    "answer_index": 1,
                    "explanation": "Since the object is placed within the focal length (10 cm < 15 cm), it lies between the pole and the focus of the concave mirror, forming a virtual and erect image behind the mirror.",
                },
                {
                    "question": "Snell's Law is mathematically represented as which of the following?",
                    "options": [
                        "sin i * sin r = constant",
                        "sin i / sin r = constant",
                        "sin r / sin i = constant",
                        "sin i + sin r = constant"
                    ],
                    "answer_index": 1,
                    "explanation": "Snell's Law states that the ratio of the sine of the angle of incidence (i) to the sine of the angle of refraction (r) is a constant value.",
                },
                {
                    "question": "What is the power of a convex lens having a focal length of 50 cm?",
                    "options": ["+2.0 D", "-2.0 D", "+0.5 D", "+5.0 D"],
                    "answer_index": 0,
                    "explanation": "Power P = 1 / f (in meters). Since f = 50 cm = 0.5 m, P = 1 / 0.5 = +2.0 D (positive for convex lens).",
                }
            ],
        }
    elif "acid" in chapter_lower or "base" in chapter_lower or "salt" in chapter_lower:
        return {
            "key_moments": [
                {
                    "timestamp_seconds": 30,
                    "timestamp_label": "00:30",
                    "subtopic": "Indicators & Chemical Properties",
                    "important_point": "Acids turn blue litmus red and release H+ ions in solution. Bases turn red litmus blue and release OH- ions. Indicators change color or odor (olfactory) in acid/base media.",
                    "keywords": ["indicator", "litmus", "H+ ions", "olfactory"],
                    "coach_note": "Recall and list two natural and two synthetic acid-base indicators.",
                    "exam_answer_frame": "Definition of indicator -> Litmus color changes -> Synthetic examples (methyl orange, phenolphthalein).",
                    "common_trap": "Forgetting that dry HCl gas does not change the color of dry litmus paper because H+ ions are only formed in aqueous solution.",
                    "memory_hook": "Acid = Blue to Red (Danger/Burn), Base = Red to Blue (Bitter/Basic)"
                },
                {
                    "timestamp_seconds": 180,
                    "timestamp_label": "03:00",
                    "subtopic": "pH Scale & Neutralization",
                    "important_point": "pH is a measure of hydrogen ion concentration. Neutralization is the reaction between an acid and a base to produce salt and water (Acid + Base -> Salt + Water).",
                    "keywords": ["pH scale", "neutralization", "salt", "water"],
                    "coach_note": "Write the balanced chemical equation for neutralization of NaOH and HCl.",
                    "exam_answer_frame": "Reactants (acid + base) -> Products (salt + water) -> State symbols -> Energy change.",
                    "common_trap": "Thinking that neutralization is always neutral; salts of strong acids + weak bases are actually acidic (pH < 7).",
                    "memory_hook": "Neutralization: H+ (from acid) + OH- (from base) -> H2O (water)"
                },
                {
                    "timestamp_seconds": 420,
                    "timestamp_label": "07:00",
                    "subtopic": "Common Salts & Compounds",
                    "important_point": "Common salt (NaCl) is a raw material for making Sodium Hydroxide (Chlor-alkali process), Baking Soda (NaHCO3), Washing Soda (Na2CO3.10H2O), and Bleaching Powder (CaOCl2).",
                    "keywords": ["chlor-alkali", "baking soda", "washing soda", "bleaching powder"],
                    "coach_note": "Write the chemical names and formulas of baking soda and washing soda.",
                    "exam_answer_frame": "Compound Name -> Common Name -> Chemical Formula -> Primary industrial/domestic use.",
                    "common_trap": "Confusing Baking Soda (Sodium Hydrogencarbonate, NaHCO3) with Baking Powder (mixture of baking soda and a mild edible acid like tartaric acid).",
                    "memory_hook": "Baking soda has Hydrogen (NaHCO3) because you need it to rise/bake!"
                }
            ][:moment_count],
            "quiz": [
                {
                    "question": "Which of the following acids is present in tomato?",
                    "options": ["Methanoic acid", "Citric acid", "Oxalic acid", "Lactic acid"],
                    "answer_index": 2,
                    "explanation": "Oxalic acid is naturally present in tomatoes. Methanoic acid is in ant stings, citric acid is in lemons, and lactic acid is in sour milk/curd.",
                },
                {
                    "question": "What happens when a solution of an acid is mixed with a solution of a base in a test tube?",
                    "options": [
                        "The temperature of the solution decreases",
                        "The temperature of the solution increases",
                        "The temperature of the solution remains the same",
                        "Salt formation does not occur"
                    ],
                    "answer_index": 1,
                    "explanation": "Neutralization is an exothermic reaction, which releases heat and increases the temperature of the solution.",
                },
                {
                    "question": "Which of the following salts does not contain water of crystallization?",
                    "options": ["Blue vitriol", "Baking soda", "Washing soda", "Gypsum"],
                    "answer_index": 1,
                    "explanation": "Baking soda (NaHCO3) does not contain water of crystallization. Blue vitriol (CuSO4.5H2O), Washing soda (Na2CO3.10H2O), and Gypsum (CaSO4.2H2O) all contain water of crystallization.",
                }
            ],
        }
    elif "chemical reaction" in chapter_lower or "chemical equation" in chapter_lower:
        return {
            "key_moments": [
                {
                    "timestamp_seconds": 30,
                    "timestamp_label": "00:30",
                    "subtopic": "Chemical Equations & Balancing",
                    "important_point": "A balanced chemical equation has an equal number of atoms of each element on both reactants and products sides, satisfying the Law of Conservation of Mass.",
                    "keywords": ["reactants", "products", "balancing", "conservation of mass"],
                    "coach_note": "Write down and balance: Fe + H2O -> Fe3O4 + H2.",
                    "exam_answer_frame": "Unbalanced Equation -> List atom counts -> Apply coefficients -> Balanced Equation.",
                    "common_trap": "Changing the chemical formulas of reactants or products to balance equations.",
                    "memory_hook": "Balancing = Equal atoms on LHS and RHS"
                },
                {
                    "timestamp_seconds": 180,
                    "timestamp_label": "03:00",
                    "subtopic": "Types of Chemical Reactions",
                    "important_point": "Combination (A+B->AB), Decomposition (AB->A+B), Displacement (more reactive displaces less), Double Displacement (ion exchange).",
                    "keywords": ["combination", "decomposition", "displacement", "precipitation"],
                    "coach_note": "Write the reaction for photolytic decomposition of silver chloride.",
                    "exam_answer_frame": "Identify reaction type -> Write chemical equation -> State observation (e.g. gray silver formation).",
                    "common_trap": "Confusing single displacement with double displacement (which usually forms a precipitate).",
                    "memory_hook": "Decomposition = Break down, Displacement = Kick out lower metal"
                },
                {
                    "timestamp_seconds": 420,
                    "timestamp_label": "07:00",
                    "subtopic": "Oxidation, Reduction & Corrosion",
                    "important_point": "Oxidation is gain of oxygen/loss of hydrogen. Reduction is loss of oxygen/gain of hydrogen. Redox reactions involve both.",
                    "keywords": ["oxidation", "reduction", "redox", "rancidity", "corrosion"],
                    "coach_note": "Identify the oxidizing and reducing agents in: CuO + H2 -> Cu + H2O.",
                    "exam_answer_frame": "Identify species oxidized/reduced -> State oxygen gain/loss -> Identify agents.",
                    "common_trap": "Writing the product species as the oxidizing or reducing agent (agents are always reactants).",
                    "memory_hook": "Oxidation = Oxygen gain, Reduction = Reduced oxygen count"
                }
            ][:moment_count],
            "quiz": [
                {
                    "question": "Which of the following is a decomposition reaction?",
                    "options": ["2H2 + O2 -> 2H2O", "CaCO3 -> CaO + CO2", "Zn + CuSO4 -> ZnSO4 + Cu", "NaOH + HCl -> NaCl + H2O"],
                    "answer_index": 1,
                    "explanation": "CaCO3 breaking down into CaO and CO2 upon heating is a thermal decomposition reaction.",
                },
                {
                    "question": "What happens when dilute hydrochloric acid is added to iron filings?",
                    "options": ["Hydrogen gas and iron chloride are produced", "Chlorine gas and iron hydroxide are produced", "No reaction takes place", "Iron salt and water are produced"],
                    "answer_index": 0,
                    "explanation": "Iron is more reactive than hydrogen, so it displaces hydrogen from HCl to form Iron(II) chloride and Hydrogen gas.",
                },
                {
                    "question": "In the reaction CuO + H2 -> Cu + H2O, which substance is oxidized?",
                    "options": ["CuO", "H2", "Cu", "H2O"],
                    "answer_index": 1,
                    "explanation": "Hydrogen (H2) gains oxygen to form H2O, so it is oxidized. CuO loses oxygen, so it is reduced.",
                }
            ],
        }
    elif "metal" in chapter_lower:
        return {
            "key_moments": [
                {
                    "timestamp_seconds": 30,
                    "timestamp_label": "00:30",
                    "subtopic": "Physical & Chemical Properties of Metals",
                    "important_point": "Metals are malleable, ductile, sonorous, and conduct heat/electricity. They react with oxygen to form basic metal oxides. Amphoteric oxides react with both acids and bases.",
                    "keywords": ["amphoteric oxide", "malleability", "ductility", "metal oxide"],
                    "coach_note": "Write the reactions of Al2O3 with HCl and NaOH to show its amphoteric nature.",
                    "exam_answer_frame": "Define amphoteric -> Write reaction with acid -> Write reaction with base -> Formed salts.",
                    "common_trap": "Thinking all metal oxides are only basic; remember Al2O3 and ZnO are amphoteric.",
                    "memory_hook": "Amphoteric = Reacts with both Acid and Base"
                },
                {
                    "timestamp_seconds": 180,
                    "timestamp_label": "03:00",
                    "subtopic": "Reactivity Series & Ionic Bonding",
                    "important_point": "The reactivity series ranks metals by reactivity. Metals react with non-metals by transferring electrons, forming ionic compounds with high melting points and electrical conductivity in molten/aqueous states.",
                    "keywords": ["reactivity series", "ionic bond", "electrovalent", "electron transfer"],
                    "coach_note": "Show the formation of NaCl and MgCl2 by transfer of electrons.",
                    "exam_answer_frame": "Draw electron dot structure -> Show electron transfer arrows -> Write ions -> Ionic formula.",
                    "common_trap": "Forgetting to write the charges on the final ions in ionic compound representations.",
                    "memory_hook": "Ionic = Transfer of electrons (creates strong attraction forces)"
                },
                {
                    "timestamp_seconds": 420,
                    "timestamp_label": "07:00",
                    "subtopic": "Extraction of Metals",
                    "important_point": "Metals are extracted based on reactivity: low (heating sulfides), medium (calcination/roasting followed by reduction), high (electrolytic reduction).",
                    "keywords": ["calcination", "roasting", "electrolytic reduction", "galvanization"],
                    "coach_note": "Differentiate between roasting and calcination reactions.",
                    "exam_answer_frame": "Roasting (heating in excess air for sulfides) vs Calcination (heating in limited air for carbonates).",
                    "common_trap": "Writing that highly reactive metals like Sodium can be reduced using carbon.",
                    "memory_hook": "Roasting = Sulfide + Oxygen, Calcination = Carbonate + No Oxygen"
                }
            ][:moment_count],
            "quiz": [
                {
                    "question": "Which of the following pairs will give displacement reactions?",
                    "options": ["NaCl solution and copper metal", "MgCl2 solution and aluminium metal", "FeSO4 solution and silver metal", "AgNO3 solution and copper metal"],
                    "answer_index": 3,
                    "explanation": "Copper is more reactive than silver and lies above it in the reactivity series, so it displaces silver from AgNO3.",
                },
                {
                    "question": "Amphoteric oxides are metal oxides that react with which of the following?",
                    "options": ["Acids only", "Bases only", "Both acids and bases", "Neither acids nor bases"],
                    "answer_index": 2,
                    "explanation": "Amphoteric oxides like aluminium oxide and zinc oxide react with both acids and bases to produce salt and water.",
                },
                {
                    "question": "Which method is suitable for preventing an iron frying pan from rusting?",
                    "options": ["Applying grease", "Applying paint", "Applying a coating of zinc", "All of the above"],
                    "answer_index": 2,
                    "explanation": "Applying a coating of zinc (galvanization) is the best method for a frying pan because paint and grease will burn/melt off during cooking.",
                }
            ],
        }
    elif "carbon" in chapter_lower:
        return {
            "key_moments": [
                {
                    "timestamp_seconds": 30,
                    "timestamp_label": "00:30",
                    "subtopic": "Covalent Bonding & Versatile Nature",
                    "important_point": "Carbon forms covalent bonds by sharing electrons to achieve stability. Its versatile nature is due to tetravalency (4 valence electrons) and catenation (ability to form long chains/rings).",
                    "keywords": ["covalent bond", "catenation", "tetravalency", "electron sharing"],
                    "coach_note": "Draw the electron dot structure of methane (CH4) and carbon dioxide (CO2).",
                    "exam_answer_frame": "Define covalent bond -> Explain sharing -> State catenation & tetravalency as reasons for carbon compound diversity.",
                    "common_trap": "Drawing ionic charges for carbon compounds; carbon sharing electrons does not form ions.",
                    "memory_hook": "Catenation = Chain formation. Tetravalency = Four bonds."
                },
                {
                    "timestamp_seconds": 180,
                    "timestamp_label": "03:00",
                    "subtopic": "Homologous Series & Saturated/Unsaturated Hydrocarbons",
                    "important_point": "Saturated hydrocarbons (alkanes) have single bonds. Unsaturated (alkenes, alkynes) have double/triple bonds. A homologous series shares a general formula, differs by -CH2- group, and has similar chemical properties.",
                    "keywords": ["alkane", "alkene", "alkyne", "homologous series", "functional group"],
                    "coach_note": "Write the molecular formulas for the first three members of the alkene homologous series.",
                    "exam_answer_frame": "Identify general formula (CnH2n for alkenes) -> Substitute n=2,3,4 -> Name compounds (ethene, propene, butene).",
                    "common_trap": "Writing methene (n=1) as the first alkene.",
                    "memory_hook": "Ane = Single bond, Ene = Double bond, Yne = Triple bond"
                },
                {
                    "timestamp_seconds": 420,
                    "timestamp_label": "07:00",
                    "subtopic": "Chemical Properties & Important Compounds",
                    "important_point": "Carbon compounds undergo combustion, oxidation, addition (hydrogenation of oils), and substitution reactions. Ethanol and Ethanoic acid are key compounds.",
                    "keywords": ["combustion", "addition reaction", "esterification", "saponification", "soap micelle"],
                    "coach_note": "Write the chemical equations for esterification and saponification.",
                    "exam_answer_frame": "Esterification (Ethanol + Ethanoic Acid -> Ester + Water) -> Saponification (Ester + NaOH -> Soap + Alcohol).",
                    "common_trap": "Confusing addition reactions with substitution reactions.",
                    "memory_hook": "Esterification = Acid + Alcohol -> Sweet-smelling Ester"
                }
            ][:moment_count],
            "quiz": [
                {
                    "question": "Which of the following is the unique property of carbon that allows it to form long chain compounds?",
                    "options": ["Tetravalency", "Catenation", "Covalent bonding", "Combustibility"],
                    "answer_index": 1,
                    "explanation": "Catenation is the ability of carbon atoms to link with other carbon atoms to form long chains, branched chains, or closed rings.",
                },
                {
                    "question": "What is the general formula of the Alkynes homologous series?",
                    "options": ["CnH2n+2", "CnH2n", "CnH2n-2", "CnH2n-1"],
                    "answer_index": 2,
                    "explanation": "Alkanes are CnH2n+2, Alkenes are CnH2n, and Alkynes (containing a triple bond) are CnH2n-2.",
                },
                {
                    "question": "Which gas is released when ethanoic acid reacts with sodium hydrogencarbonate?",
                    "options": ["Hydrogen gas", "Oxygen gas", "Carbon dioxide gas", "Nitrogen gas"],
                    "answer_index": 2,
                    "explanation": "Ethanoic acid reacts with metal carbonates/hydrogencarbonates to produce a salt, water, and carbon dioxide gas.",
                }
            ],
        }
    elif "electricity" in chapter_lower:
        return {
            "key_moments": [
                {
                    "timestamp_seconds": 30,
                    "timestamp_label": "00:30",
                    "subtopic": "Electric Current & Ohm's Law",
                    "important_point": "Electric current (I = Q/t) is the rate of charge flow. Ohm's Law states potential difference is proportional to current at constant temperature (V = IR). Resistance R depends on length, area, and resistivity (R = ρl/A).",
                    "keywords": ["ohm's law", "resistance", "resistivity", "current", "potential difference"],
                    "coach_note": "State Ohm's law and write the formula relating resistance to resistivity.",
                    "exam_answer_frame": "State Ohm's Law -> Write V=IR equation -> Define factors affecting R -> Explain resistivity l/A relation.",
                    "common_trap": "Thinking resistivity changes when the length or area of a wire changes.",
                    "memory_hook": "V = I * R (Ohm's Law). Resistivity = Constant for a given material."
                },
                {
                    "timestamp_seconds": 180,
                    "timestamp_label": "03:00",
                    "subtopic": "Series & Parallel Combinations",
                    "important_point": "In series connection, current remains same, voltages divide (Rs = R1 + R2 + R3). In parallel connection, voltage remains same, currents divide (1/Rp = 1/R1 + 1/R2 + 1/R3).",
                    "keywords": ["series circuit", "parallel circuit", "equivalent resistance", "voltage division"],
                    "coach_note": "Calculate the equivalent resistance of 3 resistors of 6 ohms connected in parallel.",
                    "exam_answer_frame": "Write formula -> Plug resistor values -> Calculate reciprocal sum -> Invert to get equivalent resistance.",
                    "common_trap": "Forgetting to take the reciprocal of the final sum to get Rp.",
                    "memory_hook": "Series adds directly, Parallel adds reciprocals"
                },
                {
                    "timestamp_seconds": 420,
                    "timestamp_label": "07:00",
                    "subtopic": "Joule's Heating & Electric Power",
                    "important_point": "Joule's law of heating: H = I^2Rt. Electric power P = VI = I^2R = V^2/R. Commercial unit of energy is Kilowatt-hour (1 kWh = 3.6 x 10^6 Joules).",
                    "keywords": ["joule's heating", "electric power", "kilowatt-hour", "fuse wire"],
                    "coach_note": "Calculate the heat produced in a 5 ohm resistor when 2 A current flows through it for 10 seconds.",
                    "exam_answer_frame": "Identify variables -> Use H = I^2Rt formula -> Calculate heat -> State answer in Joules.",
                    "common_trap": "Using time in minutes; always convert time to seconds for heat calculations in Joules.",
                    "memory_hook": "Heat = Current squared * Resistance * Time"
                }
            ][:moment_count],
            "quiz": [
                {
                    "question": "How does the resistance of a cylindrical conductor change if its length is doubled and area of cross-section is halved?",
                    "options": ["Remains the same", "Doubles", "Becomes four times", "Halves"],
                    "answer_index": 2,
                    "explanation": "R = ρl/A. If l is replaced by 2l and A by A/2, the new resistance becomes R' = ρ(2l)/(A/2) = 4(ρl/A) = 4R.",
                },
                {
                    "question": "Three resistors of 2 ohms, 3 ohms, and 6 ohms are connected in parallel. What is their equivalent resistance?",
                    "options": ["11 ohms", "1 ohm", "1.5 ohms", "3 ohms"],
                    "answer_index": 1,
                    "explanation": "1/Rp = 1/2 + 1/3 + 1/6 = (3 + 2 + 1)/6 = 6/6 = 1. So Rp = 1 ohm.",
                },
                {
                    "question": "A commercial unit of electric energy, 1 kWh, is equal to how many Joules?",
                    "options": ["3.6 x 10^5 J", "3.6 x 10^6 J", "36 x 10^6 J", "3.6 x 10^4 J"],
                    "answer_index": 1,
                    "explanation": "1 kWh = 1000 W x 3600 s = 3,600,000 J = 3.6 x 10^6 Joules.",
                }
            ],
        }
    elif "triangles" in chapter_lower:
        return {
            "key_moments": [
                {
                    "timestamp_seconds": 30,
                    "timestamp_label": "00:30",
                    "subtopic": "Similarity Criteria of Triangles",
                    "important_point": "Two triangles are similar if their corresponding angles are equal and corresponding sides are in the same ratio. Similarity criteria are AAA, SSS, and SAS.",
                    "keywords": ["similarity", "congruence", "proportional sides", "similarity criteria"],
                    "coach_note": "Write down the difference between similarity and congruence in geometric figures.",
                    "exam_answer_frame": "Statement of Criteria -> Side ratios -> Equal angles -> Similarity declaration.",
                    "common_trap": "Assuming SAS similarity applies when the equal angle is not strictly included between the proportional sides.",
                    "memory_hook": "Similar = Same Shape, Different Size. Sides are proportional."
                },
                {
                    "timestamp_seconds": 180,
                    "timestamp_label": "03:00",
                    "subtopic": "Basic Proportionality Theorem (BPT)",
                    "important_point": "BPT (Thales Theorem): If a line is drawn parallel to one side of a triangle intersecting the other two sides, it divides them in the same ratio (AD/DB = AE/EC).",
                    "keywords": ["basic proportionality theorem", "thales theorem", "parallel line", "ratio"],
                    "coach_note": "State BPT and write down its converse statement.",
                    "exam_answer_frame": "Triangle sketch -> Parallel line declaration -> Ratio equation -> Proof steps using areas.",
                    "common_trap": "Using BPT incorrectly when the line is not given or proven to be parallel to one side.",
                    "memory_hook": "DE || BC  ===>  AD/DB = AE/EC"
                },
                {
                    "timestamp_seconds": 420,
                    "timestamp_label": "07:00",
                    "subtopic": "Solving AAA and SAS Problems",
                    "important_point": "AA similarity is the most common tool: if two angles of one triangle are equal to two angles of another, the triangles are similar.",
                    "keywords": ["AA similarity", "corresponding angles", "proportionality ratio"],
                    "coach_note": "Solve a quick example: if angle A=D and B=E, and AB=4, DE=8, BC=5, find EF.",
                    "exam_answer_frame": "Identify equal angles -> Prove similarity by AA -> Setup proportion ratio -> Solve for unknown.",
                    "common_trap": "Setting up the side ratio incorrectly (e.g. putting numerator and denominator from the wrong triangles).",
                    "memory_hook": "AAA matches angles. Ratio matches corresponding sides."
                },
                {
                    "timestamp_seconds": 720,
                    "timestamp_label": "12:00",
                    "subtopic": "Ratio of Areas of Similar Triangles",
                    "important_point": "The ratio of the areas of two similar triangles is equal to the square of the ratio of their corresponding sides: Area(ABC)/Area(PQR) = (AB/PQ)^2.",
                    "keywords": ["area ratio", "square of sides", "similar triangles"],
                    "coach_note": "Calculate the area ratio of two similar triangles whose side ratio is 3:5.",
                    "exam_answer_frame": "State similarity -> Apply Area Theorem -> Square the side ratio -> Solve.",
                    "common_trap": "Forgetting to square the side ratio when calculating the area ratio.",
                    "memory_hook": "Side Ratio = s1/s2  ===>  Area Ratio = (s1/s2)^2"
                },
                {
                    "timestamp_seconds": 1080,
                    "timestamp_label": "18:00",
                    "subtopic": "Pythagoras Theorem & Converse",
                    "important_point": "Pythagoras Theorem states AC^2 = AB^2 + BC^2 in a right triangle. The converse states that if AC^2 = AB^2 + BC^2, the angle opposite to side AC is 90 degrees.",
                    "keywords": ["pythagoras theorem", "right triangle", "hypotenuse", "converse theorem"],
                    "coach_note": "Write down the proof outline of Pythagoras theorem using similar triangles.",
                    "exam_answer_frame": "Right triangle setup -> Draw perpendicular from right angle to hypotenuse -> Prove similarity -> Add equations.",
                    "common_trap": "Assuming a triangle is right-angled without using the converse criteria.",
                    "memory_hook": "Hypotenuse^2 = Side1^2 + Side2^2"
                }
            ][:moment_count],
            "quiz": [
                {
                    "question": "In triangle ABC, D and E are points on AB and AC such that DE is parallel to BC. If AD = 2 cm, DB = 3 cm, and AE = 4 cm, find EC.",
                    "options": ["2 cm", "6 cm", "5 cm", "8 cm"],
                    "answer_index": 1,
                    "explanation": "By Basic Proportionality Theorem, AD/DB = AE/EC. So 2/3 = 4/EC => EC = 12/2 = 6 cm.",
                },
                {
                    "question": "If two similar triangles have corresponding sides in the ratio 4:9, what is the ratio of their areas?",
                    "options": ["2:3", "4:9", "16:81", "8:18"],
                    "answer_index": 2,
                    "explanation": "The ratio of the areas of similar triangles is the square of the ratio of their corresponding sides: (4/9)^2 = 16/81.",
                },
                {
                    "question": "Which of the following is NOT a criterion for similarity of two triangles?",
                    "options": ["AAA", "SAS", "SSS", "RHS"],
                    "answer_index": 3,
                    "explanation": "RHS is a congruence criterion. For similarity, AAA, SSS, and SAS are the standard criteria.",
                }
            ],
        }

    # 2. General backup dynamically templated using the selected chapter name
    if not transcript_entries:
        return {
            "key_moments": [
                {
                    "timestamp_seconds": 30,
                    "timestamp_label": "00:30",
                    "subtopic": f"Core Principles of {chapter}",
                    "important_point": f"Establish a strong foundation for the core processes of {chapter} by mastering the main terminology, formulas, and diagrams.",
                    "keywords": [w.lower() for w in re.findall(r"[A-Za-z]+", chapter)[:4]],
                    "coach_note": f"Write down the primary formula or law governing the main concepts of {chapter}.",
                    "exam_answer_frame": "State law/definition -> Draw supporting diagram or write equation -> Apply to board exam case.",
                    "common_trap": f"Mixing up core terms in {chapter} (e.g. confusing reactants vs products or sign conventions).",
                    "memory_hook": f"Note down the 3 main keywords of the {chapter} definition."
                },
                {
                    "timestamp_seconds": 180,
                    "timestamp_label": "03:00",
                    "subtopic": f"Working Mechanisms of {chapter}",
                    "important_point": f"This process is a high-weightage topic for {chapter} in board exams. Focus on sequential steps, reactants/products, or variables.",
                    "keywords": ["mechanism", "steps", "derivation"],
                    "coach_note": f"List the 3 sequential steps of this {chapter} mechanism.",
                    "exam_answer_frame": "Setup equation/scenario -> State conditions -> Deduce step-by-step -> Final outcome.",
                    "common_trap": "Skipping intermediate calculation steps or state symbols, which leads to losing step marks.",
                    "memory_hook": f"Visualize the step-by-step flowchart of {chapter} in your mind."
                },
                {
                    "timestamp_seconds": 420,
                    "timestamp_label": "07:00",
                    "subtopic": f"Exam Applications for {chapter}",
                    "important_point": f"Apply {chapter} principles to solve real-world problems and board-style case studies.",
                    "keywords": ["application", "board-exam", "numerical"],
                    "coach_note": f"Think of one practical application of {chapter} in daily life or industry.",
                    "exam_answer_frame": "Identify values -> Select appropriate formula -> Solve and state units clearly.",
                    "common_trap": "Forgetting to write the SI unit or final chemical state in the final answer.",
                    "memory_hook": f"Recall the SI units and variables for all {chapter} equations."
                }
            ][:moment_count],
            "quiz": [
                {
                    "question": f"Which of the following is the most important concept in the study of '{chapter}'?",
                    "options": [
                        f"The fundamental scientific principles and laws of {chapter}",
                        "Random memorization of historical facts",
                        "Unrelated trivia and statistics",
                        "Passive reading without active practice"
                    ],
                    "answer_index": 0,
                    "explanation": f"To master {chapter}, one must focus on the core scientific principles and laws defined in the NCERT syllabus.",
                },
                {
                    "question": f"What is a common mistake students make in board exam answers for '{chapter}'?",
                    "options": [
                        "Forgetting to write intermediate steps or specific keyword terms",
                        "Writing too neatly",
                        "Explaining with examples",
                        "Drawing neat, labeled diagrams"
                    ],
                    "answer_index": 0,
                    "explanation": f"CBSE examiners look for specific NCERT keywords and structured, step-by-step explanations for {chapter}.",
                },
                {
                    "question": f"What is the best way to prepare for CBSE questions on '{chapter}'?",
                    "options": [
                        "Practice drawing diagrams, writing equations, and solving numericals",
                        "Reading the chapter passively once",
                        "Only watching video summaries without writing",
                        "Skipping the NCERT exercises"
                    ],
                    "answer_index": 0,
                    "explanation": f"Active writing practice, drawing labeled diagrams, and solving NCERT exercises are essential to score full marks in {chapter}.",
                }
            ],
        }

    # 3. Sample from transcript if transcript is available
    step = max(1, len(transcript_entries) // max(1, moment_count))
    sampled = [transcript_entries[idx] for idx in range(0, len(transcript_entries), step)][:moment_count]
    moments = []
    for idx, item in enumerate(sampled, start=1):
        text = str(item.get("text") or "").strip()
        words = [w for w in re.findall(r"[A-Za-z][A-Za-z0-9-]{2,}", text)[:5]]
        moments.append(
            {
                "timestamp_seconds": int(float(item.get("start") or 0)),
                "timestamp_label": _format_seconds(float(item.get("start") or 0)),
                "subtopic": f"Lesson Detail {idx} - {chapter}",
                "important_point": text[:180] if text else f"Important concept context in {chapter}.",
                "keywords": words if words else [chapter.lower(), "topic"],
                "coach_note": f"Pause here and summarize this {chapter} detail in your own words.",
                "exam_answer_frame": "Definition -> core process -> one chapter example -> conclusion line.",
                "common_trap": "Students often write generic theory but miss chapter-specific keywords.",
                "memory_hook": f"Use a 3-word hook from this {chapter} timestamp to recall it.",
            }
        )

    quiz = [
        {
            "question": f"According to the {chapter} lesson, what should you do when a key concept is explained?",
            "options": [
                "Pause and summarize it in your own words",
                "Skip ahead immediately",
                "Memorize without understanding",
                "Ignore timestamps",
            ],
            "answer_index": 0,
            "explanation": "Active recall during explanation improves long-term retention.",
        },
        {
            "question": f"What is the best way to convert this {chapter} video into board exam marks?",
            "options": [
                "Use chapter keywords and structured answers",
                "Watch passively only once",
                "Avoid writing any notes",
                "Focus only on animation quality",
            ],
            "answer_index": 0,
            "explanation": "Board marks come from structured, keyword-rich written responses.",
        },
        {
            "question": f"When should you start your follow-up practice drill for {chapter}?",
            "options": [
                "After completing the key moments",
                "Before watching any content",
                "Only a week later",
                "Never",
            ],
            "answer_index": 0,
            "explanation": f"Immediate drill after watching reinforces understanding and recall of {chapter} concepts.",
        },
    ]
    return {"key_moments": moments, "quiz": quiz}


async def _build_video_intelligence_with_ai(
    class_num: str,
    subject: str,
    chapter: str,
    transcript_entries: list[dict],
    plan_tier: str,
) -> dict:
    moment_count = 2
    joined = []
    for row in transcript_entries[:220]:
        ts = _format_seconds(float(row.get("start") or 0))
        joined.append(f"[{ts}] {str(row.get('text') or '').strip()}")
    transcript_block = "\n".join(joined)[:12000]

    if not transcript_entries:
        prompt = (
            f"You are an expert CBSE learning strategist. We don't have the transcript for this video on Class {class_num} {subject}, chapter '{chapter}'.\n"
            f"Generate exactly two (2) points to remember from the lesson. These points should NOT be generic highlights, but rather specific concepts/points that are difficult, tricky, or likely to come in CBSE board exams unexpectedly (unexpected traps/questions).\n"
            f"Return strict JSON only.\n"
            f"JSON schema: {{\n"
            f"  \"key_moments\": [{{\n"
            f"    \"subtopic\": string,\n"
            f"    \"important_point\": string,\n"
            f"    \"keywords\": string[],\n"
            f"    \"coach_note\": string,\n"
            f"    \"exam_answer_frame\": string,\n"
            f"    \"common_trap\": string,\n"
            f"    \"memory_hook\": string\n"
            f"  }}],\n"
            f"  \"quiz\": [{{\n"
            f"    \"question\": string,\n"
            f"    \"options\": [string, string, string, string],\n"
            f"    \"answer_index\": 0-3,\n"
            f"    \"explanation\": string\n"
            f"  }}]\n"
            f"}}\n"
            f"Rules:\n"
            f"- Give exactly 2 points to remember under the \"key_moments\" list with non-repeating subtopics.\n"
            f"- Do NOT include any timestamp fields or mention video times in your output.\n"
            f"- quiz must contain exactly 3 high-quality board-style questions based on these chapter topics.\n"
            f"- Keep important_point short and exam-focused (max 2 lines).\n"
            f"- coach_note must be an immediate action student can do in 20-40 seconds (like writing down a formula or visualizing a process).\n"
            f"- exam_answer_frame must provide a board-style answer structure specific to this subtopic.\n"
            f"- common_trap must describe one likely mistake (e.g. confusing double circulation, mixing up reflex arc steps, forgetting sign conventions) and how to avoid it.\n"
            f"- memory_hook must be a crisp recall trigger (phrase, acronym, or analogy).\n"
            f"- Do NOT say generic advice; include specific chemical reactions, formulas, biological processes, or mathematical steps relevant to '{chapter}'."
        )
    else:
        prompt = (
            f"You are an expert CBSE learning strategist. Analyze this video transcript for Class {class_num} {subject}, chapter '{chapter}'.\n"
            f"Identify and generate exactly two (2) points to remember from the lesson (specifically focusing on tricky, difficult, or unexpectedly asked CBSE board exam topics/traps).\n"
            f"Return strict JSON only.\n"
            f"JSON schema: {{\n"
            f"  \"key_moments\": [{{\n"
            f"    \"subtopic\": string,\n"
            f"    \"important_point\": string,\n"
            f"    \"keywords\": string[],\n"
            f"    \"coach_note\": string,\n"
            f"    \"exam_answer_frame\": string,\n"
            f"    \"common_trap\": string,\n"
            f"    \"memory_hook\": string\n"
            f"  }}],\n"
            f"  \"quiz\": [{{\n"
            f"    \"question\": string,\n"
            f"    \"options\": [string, string, string, string],\n"
            f"    \"answer_index\": 0-3,\n"
            f"    \"explanation\": string\n"
            f"  }}]\n"
            f"}}\n"
            f"Rules:\n"
            f"- Give exactly 2 points to remember under the \"key_moments\" list with non-repeating subtopics.\n"
            f"- Do NOT include any timestamp fields or mention video times in your output.\n"
            f"- quiz must contain exactly 3 questions based only on transcript evidence.\n"
            f"- Keep important_point short and exam-focused (max 2 lines).\n"
            f"- coach_note must be an immediate action student can do in 20-40 seconds.\n"
            f"- exam_answer_frame must provide a board-style answer structure specific to this subtopic.\n"
            f"- common_trap must describe one likely mistake and how to avoid it.\n"
            f"- memory_hook must be a crisp recall trigger (phrase, analogy, or pattern).\n"
            f"- Avoid generic advice; include chapter-specific terms from transcript wherever possible.\n"
            f"Transcript:\n{transcript_block}"
        )

    try:
        raw = await asyncio.wait_for(
            ask_openrouter(
                [
                    {"role": "system", "content": "You transform transcript content into exam-oriented learning scaffolds."},
                    {"role": "user", "content": prompt},
                ],
                task_type="smart",
            ),
            timeout=22,
        )
        parsed = _extract_first_json_object(raw)
    except Exception:
        parsed = {}

    if not isinstance(parsed, dict):
        parsed = {}

    fallback = _fallback_video_intelligence(transcript_entries, moment_count, subject=subject, chapter=chapter)
    key_moments = parsed.get("key_moments") if isinstance(parsed.get("key_moments"), list) else fallback["key_moments"]
    quiz = parsed.get("quiz") if isinstance(parsed.get("quiz"), list) else fallback["quiz"]

    normalized_moments = []
    for item in key_moments[:moment_count]:
        if not isinstance(item, dict):
            continue
        normalized_moments.append(
            {
                "timestamp_seconds": 0,
                "timestamp_label": "",
                "subtopic": str(item.get("subtopic") or "Key concept").strip(),
                "important_point": str(item.get("important_point") or "").strip() or "Important exam-focused explanation.",
                "keywords": [str(k).strip() for k in (item.get("keywords") or []) if str(k).strip()][:7],
                "coach_note": str(item.get("coach_note") or "Pause and summarize this in your own words.").strip(),
                "exam_answer_frame": str(item.get("exam_answer_frame") or "Definition -> key concept -> chapter example -> final takeaway.").strip(),
                "common_trap": str(item.get("common_trap") or "Do not skip keywords from this concept in final answers.").strip(),
                "memory_hook": str(item.get("memory_hook") or "Create a 3-word recall cue from this moment.").strip(),
            }
        )
    if not normalized_moments:
        normalized_moments = fallback["key_moments"][:moment_count]
    while len(normalized_moments) < moment_count:
        normalized_moments.append(fallback["key_moments"][len(normalized_moments) % len(fallback["key_moments"])])

    normalized_quiz = []
    for item in quiz[:3]:
        if not isinstance(item, dict):
            continue
        options = item.get("options") if isinstance(item.get("options"), list) else []
        cleaned_options = [str(opt).strip() for opt in options if str(opt).strip()][:4]
        while len(cleaned_options) < 4:
            cleaned_options.append(f"Option {len(cleaned_options) + 1}")
        answer_index = int(item.get("answer_index") or 0)
        normalized_quiz.append(
            {
                "question": str(item.get("question") or "What is the key idea from the video?").strip(),
                "options": cleaned_options,
                "answer_index": max(0, min(answer_index, 3)),
                "explanation": str(item.get("explanation") or "This answer matches the transcript's core explanation.").strip(),
            }
        )
    if len(normalized_quiz) < 3:
        normalized_quiz = fallback["quiz"]

    return {
        "plan_tier": plan_tier,
        "feature_mode": "pro-max" if plan_tier == "pro_max" else "pro",
        "key_moments": normalized_moments,
        "quiz": normalized_quiz[:3],
        "transcript_stats": {
            "segments": len(transcript_entries),
            "duration_seconds": int(max((float(item.get("start") or 0.0) for item in transcript_entries), default=0.0)),
        },
    }


def _fallback_exam_questions(subject: str, chapters: list[str], count: int) -> list[str]:
    import random
    papers = _load_past_papers()
    
    # 1. Collect questions that match the selected chapters
    matching_questions = []
    chapters_lower = {str(ch).strip().lower() for ch in chapters if str(ch).strip()}
    for paper in papers:
        if str(paper.get("subject", "")).lower() == subject.lower():
            p_chapter = str(paper.get("chapter", "")).strip().lower()
            if p_chapter in chapters_lower:
                for q in paper.get("questions", []):
                    if isinstance(q, str) and q.strip() and _is_valid_question(q):
                        matching_questions.append(q.strip())
                        
    # Deduplicate matching questions
    matching_questions = list(dict.fromkeys(matching_questions))
    random.shuffle(matching_questions)
    
    # If we have enough matching questions, return them!
    if len(matching_questions) >= count:
        return matching_questions[:count]
        
    # 2. If we need more questions, collect from other chapters of the same subject
    other_questions = []
    for paper in papers:
        if str(paper.get("subject", "")).lower() == subject.lower():
            p_chapter = str(paper.get("chapter", "")).strip().lower()
            if p_chapter not in chapters_lower:
                for q in paper.get("questions", []):
                    if isinstance(q, str) and q.strip() and _is_valid_question(q):
                        other_questions.append(q.strip())
                        
    other_questions = list(dict.fromkeys(other_questions))
    other_questions = [q for q in other_questions if q not in matching_questions]
    random.shuffle(other_questions)
    
    combined = matching_questions + other_questions
    
    if len(combined) >= count:
        return combined[:count]
    elif combined:
        # Pad by repeating questions from the combined pool
        while len(combined) < count:
            combined.append(random.choice(combined))
        return combined
        
    # 3. Seed fallback if no past papers exist
    chapter_label = ", ".join(chapters[:3]) if chapters else "Core chapters"
    seed = [
        f"What is the most fundamental concept in {chapter_label}, and why is it significant in {subject}?",
        f"Provide a comprehensive, board-style explanation of a key topic from {chapter_label}, including a relevant textbook example.",
        f"Choose two closely related but distinct ideas from {chapter_label} and state three key differences between them.",
        f"Describe a real-world application or numerical problem based on {chapter_label} and show the step-by-step solution.",
        f"Explain a frequently tested 5-mark question from {chapter_label}. Ensure your answer is structured logically with headings.",
    ]
    out: list[str] = []
    idx = 0
    while len(out) < count:
        out.append(seed[idx % len(seed)])
        idx += 1
    return out[:count]


def _resolve_exam_scope_chapters(request: ExamSimStartRequest) -> tuple[str, list[str]]:
    scope = str(request.scope or "single-chapter").strip().lower()
    if scope not in {"single-chapter", "multi-chapter", "full-subject"}:
        scope = "single-chapter"

    if scope == "single-chapter":
        chapter = str(request.chapter or "").strip()
        if not chapter:
            raise HTTPException(status_code=422, detail="chapter is required for single-chapter mode")
        return scope, [chapter]

    if scope == "multi-chapter":
        chapters = [str(ch).strip() for ch in (request.chapters or []) if str(ch).strip()]
        chapters = list(dict.fromkeys(chapters))
        if not chapters:
            raise HTTPException(status_code=422, detail="Select at least one chapter for multi-chapter mode")
        return scope, chapters

    catalog = load_curriculum_catalog()
    subject_map = catalog.get(str(request.class_num), {})
    found_subject = None
    for key in subject_map.keys():
        if str(key).strip().lower() == str(request.subject).strip().lower():
            found_subject = key
            break
    chapters = [str(ch).strip() for ch in (subject_map.get(found_subject or "", []) or []) if str(ch).strip()]
    if not chapters and str(request.chapter or "").strip():
        chapters = [str(request.chapter).strip()]
    if not chapters:
        raise HTTPException(status_code=422, detail="No curriculum chapters found for full-subject mode")
    return scope, chapters


def _build_marks_distribution(total_marks: int, question_count: int) -> list[int]:
    allowed = [1, 2, 3, 5]
    count = max(3, min(int(question_count or 10), 30))
    target = max(count, min(int(total_marks or 80), 200))

    distribution: list[int] = []
    remaining_marks = target
    remaining_questions = count

    for _ in range(count):
        remaining_questions = max(1, remaining_questions)
        avg = remaining_marks / remaining_questions
        candidates = sorted(allowed, key=lambda x: abs(x - avg))
        chosen = candidates[0]

        for marks in candidates:
            rest_marks = remaining_marks - marks
            rest_q = remaining_questions - 1
            min_rest = rest_q * min(allowed)
            max_rest = rest_q * max(allowed)
            if rest_q == 0 or (min_rest <= rest_marks <= max_rest):
                chosen = marks
                break

        distribution.append(chosen)
        remaining_marks -= chosen
        remaining_questions -= 1

    if remaining_marks != 0 and distribution:
        distribution[-1] = max(1, min(5, distribution[-1] + remaining_marks))

    return distribution


async def _generate_exam_questions(request: ExamSimStartRequest, chapters: list[str], marks_distribution: list[int]) -> list[dict]:
    count = len(marks_distribution)
    chapter_scope = ", ".join(chapters[:8])
    stick_to_textbook = getattr(request, 'stick_to_textbook', False)
    
    textbook_instruction = ""
    if stick_to_textbook:
        textbook_instruction = (
            "- STICK STRICTLY TO TEXTBOOK EXERCISES: The questions MUST be directly based on the exercises, "
            "worked examples, and direct text found in the provided NCERT textbook content. "
            "For Mathematics, use the exact numerical techniques, formulas, and structural patterns "
            "used in the textbook examples/exercises. Do not invent new theoretical scenarios outside "
            "the provided chapter content."
        )
    else:
        textbook_instruction = (
            "- CREATIVE & UNIQUE QUESTIONS: Generate creative, unique, and competency-based questions "
            "(HOTS - Higher Order Thinking Skills) that test the same underlying concepts and definitions "
            "from the textbook, but present them in new, application-oriented scenarios. "
            "Do not directly copy textbook exercises."
        )

    prompt = (
        f"Create {count} CBSE board-style questions for Class {request.class_num} (Grade {request.class_num}) {request.subject}.\n\n"
        f"CRITICAL COVERAGE REQUIREMENT:\n"
        f"- You MUST strictly and only generate questions from these specific chapter(s): {chapter_scope}.\n"
        f"- DO NOT include any questions from other chapters of the {request.subject} syllabus. For example, if Science is requested and coverage is chemistry chapters, do not generate physics or biology questions.\n"
        f"- NO DRAWING/DIAGRAM/LABEL QUESTIONS: Do NOT generate questions that ask the student to draw, diagram, label, sketch, plot, or construct charts/graphs/figures. All questions must be solvable purely via text answers or numerical calculations.\n\n"
        f"Details:\n"
        f"- Mode: {request.mode}.\n"
        f"- Rigor & Syllabus: MUST match Class {request.class_num} standard exactly.\n"
        f"- Style: Vary question command words (define/explain/derive/justify/compare/evaluate).\n"
        f"- {textbook_instruction}\n"
        "Return ONLY the numbered questions (1. 2. 3. ...), no heading, no explanation, no preamble."
    )

    
    # Load textbook contents for the chapters
    textbook_contexts = []
    for ch in chapters[:4]:
        try:
            text_content = await get_textbook_chapter_text(request.class_num, request.subject, ch)
            if text_content:
                textbook_contexts.append(f"Chapter: {ch}\n{text_content[:15000]}")
        except Exception as e:
            logger.error(f"Error fetching textbook for chapter {ch}: {e}")
            
    messages = []
    if textbook_contexts:
        combined_textbook = "\n\n---\n\n".join(textbook_contexts)
        messages.append({
            "role": "system",
            "content": (
                f"You are a strict CBSE paper setter. You are provided with the official NCERT textbook "
                f"context for the chapters in scope. Use this as the source of truth for terminology, "
                f"concepts, equations, and exercises:\n\n{combined_textbook}"
            )
        })
    else:
        messages.append({"role": "system", "content": "You are a strict CBSE paper setter."})
        
    messages.append({"role": "user", "content": prompt})

    try:
        raw = await asyncio.wait_for(
            ask_openrouter(
                messages,
                task_type="smart",
            ),
            timeout=25,
        )
        parsed = _extract_questions(raw)
        if len(parsed) >= 3:
            questions = parsed[:count]
            out: list[dict] = []
            for idx, question in enumerate(questions):
                marks = int(marks_distribution[idx])
                chapter = chapters[idx % len(chapters)] if chapters else "General"
                out.append(
                    {
                        "question_id": f"q{idx + 1}",
                        "question": question,
                        "marks": marks,
                        "chapter": chapter,
                    }
                )
            return out
    except Exception:
        pass

    fallback_items = _fallback_exam_questions(request.subject, chapters, count)
    out: list[dict] = []
    for idx, question in enumerate(fallback_items):
        marks = int(marks_distribution[idx])
        chapter = chapters[idx % len(chapters)] if chapters else "General"
        out.append(
            {
                "question_id": f"q{idx + 1}",
                "question": question,
                "marks": marks,
                "chapter": chapter,
            }
        )
    return out


def _score_exam_answers(answers: list[ExamSimAnswerItem]) -> dict:
    if not answers:
        return {
            "total_questions": 0,
            "attempted": 0,
            "total_marks": 0,
            "marks_awarded": 0,
            "accuracy_percent": 0,
            "step_mark_losses": [],
            "recovery_plan": [
                "Attempt at least 5 questions next session.",
                "Write answers in pointwise board format.",
                "Review one weak chapter using Daily Mission.",
            ],
        }

    attempted = 0
    marks_awarded = 0
    total_marks = sum(max(1, min(int(item.marks_available or 5), 10)) for item in answers)
    step_mark_losses: list[dict[str, str]] = []

    for item in answers:
        answer = str(item.answer_text or "").strip()
        if answer:
            attempted += 1
        marks_available = max(1, min(int(item.marks_available or 5), 10))
        word_count = len(answer.split())
        if word_count >= 55:
            score = marks_available
        elif word_count >= 35:
            score = max(1, int(round(marks_available * 0.8)))
        elif word_count >= 20:
            score = max(1, int(round(marks_available * 0.6)))
        elif word_count >= 10:
            score = max(1, int(round(marks_available * 0.4)))
        elif word_count > 0:
            score = 1
        else:
            score = 0
        marks_awarded += score
        if score < max(1, int(round(marks_available * 0.7))):
            step_mark_losses.append(
                {
                    "question": item.question[:110],
                    "lost_reason": "Missing stepwise structure or key chapter terminology.",
                    "fix": "Use definition -> explanation -> example -> conclusion format.",
                }
            )

    accuracy = int(round((marks_awarded / max(1, total_marks)) * 100))
    recovery_plan = [
        "Rewrite the two weakest answers in proper board format.",
        "Revise chapter keywords and include one example per long answer.",
        "Take a 20-minute section drill tomorrow to recover step marks.",
    ]

    return {
        "total_questions": len(answers),
        "attempted": attempted,
        "total_marks": total_marks,
        "marks_awarded": marks_awarded,
        "accuracy_percent": accuracy,
        "step_mark_losses": step_mark_losses[:6],
        "recovery_plan": recovery_plan,
    }


def _extract_token(authorization: Optional[str]) -> str:
    if not authorization:
        return ""
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return authorization.strip()


def _require_non_empty(text: str, field_name: str):
    if not str(text or "").strip():
        raise HTTPException(status_code=422, detail=f"Please specify mandatory field: {field_name}")


PAST_PAPERS_FILE = Path(__file__).resolve().parent.parent / "data" / "past_papers.json"


def _build_paper_source_link(paper: dict) -> str:
    class_num = str(paper.get("class_num", "")).strip()
    subject = str(paper.get("subject", "")).strip()
    year = str(paper.get("year", "")).strip()
    chapter = str(paper.get("chapter", "")).strip()

    # Prefer official CBSE sample paper portals for common board classes.
    if class_num == "10":
        return "https://cbseacademic.nic.in/SQP_CLASSX_2023-24.html"
    if class_num == "12":
        return "https://cbseacademic.nic.in/SQP_CLASSXII_2023-24.html"

    # Fallback to a focused search query for chapter-specific real paper PDFs.
    query = f"CBSE Class {class_num} {subject} {chapter} {year} question paper pdf"
    return f"https://www.google.com/search?q={query.replace(' ', '+')}"


def _load_past_papers() -> list[dict]:
    if not PAST_PAPERS_FILE.exists():
        return []
    try:
        return json.loads(PAST_PAPERS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def _derive_worksheets_from_papers(
    class_num: str,
    subject: str,
    chapter: str | None = None,
    limit: int = 24,
) -> list[dict]:
    papers = _load_past_papers()
    filtered = [
        p for p in papers
        if str(p.get("class_num", "")) == str(class_num)
        and str(p.get("subject", "")).lower() == subject.lower()
        and (chapter is None or str(p.get("chapter", "")).lower() == chapter.lower())
    ]

    worksheets: list[dict] = []
    for paper in filtered:
        questions = [q for q in paper.get("questions", []) if isinstance(q, str) and q.strip()]
        if not questions:
            continue

        title = f"CBSE {paper.get('year', '')} Worksheet: {paper.get('chapter', 'General')}"
        worksheets.append(
            {
                "id": f"ws_{paper.get('id')}",
                "title": title,
                "class_num": str(paper.get("class_num", class_num)),
                "subject": paper.get("subject", subject),
                "chapter": paper.get("chapter", "General"),
                "question_type": "past-paper",
                "difficulty": paper.get("difficulty", "Medium"),
                "num_questions": min(len(questions), 10),
                "board": paper.get("board", "CBSE"),
                "year": int(paper.get("year", 0) or 0),
                "source_paper_id": paper.get("id"),
                "pdf_url": paper.get("worksheet_pdf_url") or paper.get("pdf_url") or paper.get("source_url"),
                "source_url": paper.get("source_url") or _build_paper_source_link(paper),
                "questions": questions[:10],
            }
        )

    worksheets.sort(key=lambda w: (w.get("year", 0), w.get("chapter", "")), reverse=True)
    return worksheets[: max(1, min(limit, 100))]


def _is_valid_question(text: str) -> bool:
    q = re.sub(r"\s+", " ", text).strip()
    if len(q) < 20:
        return False
    if len(q.split()) < 5:
        return False
    if re.match(r"^\*{0,2}\s*(multiple\s+choice\s+question|question\s*\(?\d*-?mark)", q, re.I):
        return False
    if re.match(r"^#+\s*", q):
        return False
    if re.search(r"[\/+\-*=^:]\s*$", q):
        return False
    if q.lower().endswith((" and", " or", " of", " in", " to", " is", " are", " the", " a")):
        return False
        
    # Filter out questions that ask to draw, diagram, or label
    lowered = q.lower()
    blocked_keywords = ["draw ", " draw", "diagram", "label ", " label", "sketch ", " sketch", "construct ", "trace ", "plot "]
    if any(keyword in lowered for keyword in blocked_keywords):
        return False
        
    return True



def _extract_questions(raw_response: str) -> list[str]:
    numbered_blocks = re.findall(r"(?:^|\n)\s*\d+[\.)]\s+([\s\S]*?)(?=(?:\n\s*\d+[\.)]\s+)|$)", raw_response)
    questions = [re.sub(r"\s+", " ", q).strip() for q in numbered_blocks if q.strip()]

    if not questions:
        questions = [
            re.sub(r"\s+", " ", line).strip()
            for line in raw_response.split('\n')
            if line.strip()
        ]

    return [q for q in questions if _is_valid_question(q)]


def _subject_randomization_clause(subject: str, question_type: str) -> str:
    subject_l = str(subject or "").strip().lower()
    if subject_l in {"science", "physics", "chemistry", "biology"}:
        if question_type in {"mixed", "variety", "past-paper"}:
            return (
                "Ensure good variation across Physics, Chemistry, and Biology concepts where chapter scope allows. "
                "Do not repeat the same concept phrasing."
            )
        return "Use a chapter-faithful concept from the relevant science branch with no repetition."
    if subject_l in {"maths", "mathematics"}:
        return "Mix algebra, arithmetic, geometry, and application styles where chapter scope allows."
    return "Ensure diverse, non-repetitive board-style framing across the generated questions."


def _fallback_questions(request: PracticeRequest, count: int) -> list[str]:
    import random
    chapter = request.chapter
    subject = request.subject
    
    papers = _load_past_papers()
    
    # 1. Collect matching questions
    matching_questions = []
    chapter_lower = str(chapter).strip().lower()
    for paper in papers:
        if str(paper.get("subject", "")).lower() == subject.lower():
            if str(paper.get("chapter", "")).strip().lower() == chapter_lower:
                for q in paper.get("questions", []):
                    if isinstance(q, str) and q.strip() and _is_valid_question(q):
                        matching_questions.append(q.strip())
                        
    matching_questions = list(dict.fromkeys(matching_questions))
    random.shuffle(matching_questions)
    
    if len(matching_questions) >= count:
        return matching_questions[:count]
        
    # 2. Collect other questions
    other_questions = []
    for paper in papers:
        if str(paper.get("subject", "")).lower() == subject.lower():
            if str(paper.get("chapter", "")).strip().lower() != chapter_lower:
                for q in paper.get("questions", []):
                    if isinstance(q, str) and q.strip() and _is_valid_question(q):
                        other_questions.append(q.strip())
                        
    other_questions = list(dict.fromkeys(other_questions))
    other_questions = [q for q in other_questions if q not in matching_questions]
    random.shuffle(other_questions)
    
    combined = matching_questions + other_questions
    if len(combined) >= count:
        return combined[:count]
    elif combined:
        while len(combined) < count:
            combined.append(random.choice(combined))
        return combined

    if request.question_type == "1-mark":
        bank = [
            f"What is the primary definition of the most important term in '{chapter}'?",
            f"State a crucial NCERT fact from '{chapter}' that is often tested in board exams.",
            f"What is the main difference between the two primary concepts in '{chapter}'?",
            f"Identify a common student mistake when applying the principles of '{chapter}' and explain the correct approach.",
        ]
    elif request.question_type == "3-mark":
        bank = [
            f"Explain three critical points regarding the main topic of '{chapter}'. Use clear subheadings.",
            f"Differentiate between two related phenomena in '{chapter}' by providing at least three valid points of contrast.",
            f"Describe the most important process from '{chapter}' in three logical steps, using correct NCERT terminology.",
            f"Provide a 3-mark explanation on a key concept from '{chapter}' and support it with a textbook example.",
        ]
    elif request.question_type == "5-mark":
        bank = [
            f"Write a detailed 5-mark answer explaining a major concept from '{chapter}', including labeled diagram points if applicable.",
            f"Explain the full mechanism of a critical topic from '{chapter}', detailing its causes and outcomes.",
            f"Answer a 5-mark board question from '{chapter}' by providing a definition, detailed explanation, and practical application.",
            f"Discuss a high-weightage topic from '{chapter}' and explain one real-life implication of this concept.",
        ]
    elif request.question_type == "mcq":
        bank = [
            f"Which of the following best describes the core principle of '{chapter}'? A) ... B) ... C) ... D) ...",
            f"According to the NCERT text for '{chapter}', which statement is correct? A) ... B) ... C) ... D) ...",
            f"Choose the most accurate conclusion for a key experiment in '{chapter}': A) ... B) ... C) ... D) ...",
            f"Which scenario correctly applies the main formula or rule from '{chapter}'? A) ... B) ... C) ... D) ...",
        ]
    else:
        bank = [
            f"Explain a core concept from '{chapter}' that tests your fundamental understanding of {subject}.",
            f"Read a short context related to '{chapter}' and answer the corresponding competency-based question.",
            f"Solve this past-paper style question based on the advanced topics in '{chapter}'.",
            f"Analyze a complex scenario related to '{chapter}' using higher-order thinking skills and reasoning.",
        ]

    questions: list[str] = []
    idx = 0
    while len(questions) < count:
        questions.append(bank[idx % len(bank)])
        idx += 1
    return questions[:count]


def _fallback_flashcards(request: FlashcardRequest) -> list[FlashcardItem]:
    chapter = request.chapter
    subject = request.subject
    base = [
        (
            f"Define one core concept from {chapter} in {subject}.",
            "Use exact NCERT wording in 1-2 lines.",
        ),
        (
            f"State one important board point from {chapter}.",
            "Write the point and add one small example.",
        ),
        (
            f"What is one common mistake students make in {chapter}?",
            "Mention the mistake and the correct version.",
        ),
        (
            f"Write one quick revision cue for {chapter}.",
            "Use a short memory hook with a key term.",
        ),
    ]

    cards: list[FlashcardItem] = []
    idx = 0
    while len(cards) < request.count:
        q, a = base[idx % len(base)]
        cards.append(FlashcardItem(question=q, answer=a))
        idx += 1
    return cards[: request.count]


def _fallback_grade_response(request: GradeRequest) -> str:
    awarded = max(1, min(request.marks_available, int(round(request.marks_available * 0.6))))
    return (
        f"MARKS: {awarded}/{request.marks_available}\n"
        "WHAT WAS GOOD: Attempt shows understanding of the chapter basics and relevant terminology.\n"
        "WHAT WAS MISSING: Add clearer stepwise structure, one concrete example, and precise NCERT keywords.\n"
        "MODEL ANSWER: Start with definition, explain key points in order, include one correct example, and end with a concise conclusion."
    )


def _analyze_mistake(question: str, user_answer: str, response_text: str, marks_available: int) -> dict:
    q = question.lower()
    answer = user_answer.lower()
    feedback = response_text.lower()
    score_hint = 0
    marks_match = re.search(r"MARKS:\s*(\d+)\/(\d+)", response_text, re.I)
    if marks_match:
        try:
            score_hint = int(round((int(marks_match.group(1)) / max(1, int(marks_match.group(2)))) * 100))
        except Exception:
            score_hint = 0

    if score_hint >= 99:
        weak_skill = "mastery-maintenance"
        micro = "Perfect response. Preserve this with one quick spaced recall tomorrow."
        related = f"Solve one similar confidence-check question for: {question[:70].rstrip(' ?.')}."
    elif any(key in q for key in ["define", "what is", "meaning", "state"]):
        weak_skill = "definition precision"
        micro = "Use the exact textbook term first, then add one concise line of meaning."
        related = f"Define {question[:70].rstrip(' ?.') } in one sentence, then add one example."
    elif any(key in q for key in ["why", "how", "explain", "describe"]):
        weak_skill = "concept flow"
        micro = "This needs a stepwise explanation: cause, process, and result."
        related = f"Explain the same concept from '{question[:60]}' in 3 ordered points."
    elif any(key in q for key in ["compare", "difference", "distinguish"]):
        weak_skill = "comparison structure"
        micro = "Use a point-by-point comparison instead of a paragraph."
        related = f"Write two differences between the two ideas used in: {question[:60]}."
    elif any(key in q for key in ["calculate", "find", "numerical", "formula"]):
        weak_skill = "formula application"
        micro = "Check formula choice, substitution, and units in order."
        related = f"Solve a similar numerical from '{question[:60]}' with all units shown."
    else:
        weak_skill = "answer structure"
        micro = "Your answer needs a tighter board-exam structure and one stronger chapter keyword."
        related = f"Rewrite the answer to '{question[:60]}' using 3 exam-ready bullet points."

    due_date = (date.today() + timedelta(days=2)).isoformat()
    flashcard_due = f"Review this as a flashcard on {due_date}: {question[:90]}"
    if score_hint >= 99:
        flashcard_due = f"Mastery check in 3 days: {question[:90]}"
    elif score_hint >= 75:
        flashcard_due = f"Quick flashcard review tomorrow: {question[:90]}"

    if marks_available <= 1:
        related = f"State the exact definition or fact for: {question[:80]}"

    if "missing" in feedback and "keyword" in feedback:
        weak_skill = "keyword recall"

    return {
        "micro_explanation": micro,
        "related_question": related,
        "flashcard_due": flashcard_due,
        "weak_skill": weak_skill,
    }


def _chapter_readiness_metrics(user_data: list[dict], chapter: str) -> dict:
    chapter_rows = [i for i in user_data if str(i.get("chapter") or "").lower() == chapter.lower()]
    if not chapter_rows:
        return {
            "accuracy": 35,
            "recency": 30,
            "speed": 35,
            "confidence": 30,
            "readiness_score": 32,
            "priority": "high",
        }

    scored = [i for i in chapter_rows if isinstance(i.get("score"), (int, float))]
    accuracy = int(round(sum(i["score"] for i in scored) / len(scored))) if scored else 45

    latest = max(datetime.fromisoformat(i["timestamp"]) for i in chapter_rows if i.get("timestamp"))
    days_since = max(0, (datetime.now() - latest).days)
    recency = max(20, 100 - (days_since * 12))

    speed = 70 if len(chapter_rows) >= 4 else 52 if len(chapter_rows) >= 2 else 40
    confidence = 55 if accuracy >= 70 else 42 if accuracy >= 45 else 30
    readiness_score = int(round((accuracy * 0.45) + (recency * 0.2) + (speed * 0.15) + (confidence * 0.2)))
    priority = "high" if readiness_score < 45 else "medium" if readiness_score < 70 else "low"

    return {
        "accuracy": accuracy,
        "recency": recency,
        "speed": speed,
        "confidence": confidence,
        "readiness_score": readiness_score,
        "priority": priority,
    }


def _chapter_resource_stack(chapter: str, subject: str) -> dict:
    return {
        "textbook_section": f"Open the NCERT section for {chapter} in {subject} and read the worked examples first.",
        "explanation": f"One fast explanation: master the core idea of {chapter}, then connect it to one board-style example.",
        "worksheet": {
            "title": f"{chapter} Practice Worksheet",
            "question_type": "past-paper",
            "num_questions": 5,
            "route": "/practice",
            "state": {
                "subject": subject,
                "chapter": chapter,
                "questionType": "past-paper",
                "numQuestions": 5,
            },
        },
        "test": {
            "title": f"{chapter} Quick Test",
            "question_type": "mixed",
            "num_questions": 8,
            "route": "/practice",
            "state": {
                "subject": subject,
                "chapter": chapter,
                "questionType": "mixed",
                "numQuestions": 8,
            },
        },
    }


def _clarity_video_booster(class_num: str, subject: str, chapter: str) -> dict:
    papers = _load_past_papers()
    real_questions = []
    for paper in papers:
        if str(paper.get("subject", "")).lower() == subject.lower() and str(paper.get("chapter", "")).lower() == chapter.lower():
            for q in paper.get("questions", []):
                if isinstance(q, str) and q.strip() and _is_valid_question(q):
                    real_questions.append(q.strip())
                    
    import random
    if len(real_questions) >= 2:
        sampled = random.sample(real_questions, 2)
        active_recall = [
            f"Active Recall Q1: {sampled[0]}",
            f"Active Recall Q2: {sampled[1]}",
            "List 2 mistakes you made while self-explaining and fix them before the drill."
        ]
    else:
        active_recall = [
            f"What is the most important concept taught about {chapter}?",
            f"Describe one real-world application of the concepts from {chapter}.",
            "List 2 mistakes you made while self-explaining and fix them before the drill."
        ]

    return {
        "positioning": "Watch on YouTube, but use Clarity to convert watching into marks.",
        "checkpoints": [
            "Checkpoint 1: Write a one-line NCERT definition before watching 5 minutes.",
            "Checkpoint 2: Pause at every process explanation and write 3 step keywords.",
            "Checkpoint 3: Summarize the chapter in exactly 5 exam-safe bullets.",
        ],
        "exam_traps": [
            "Students copy examples but miss textbook terminology.",
            "Answers stay conceptual but skip mark-command words like define/explain/justify.",
            "No final concluding line, which costs board marks in 3 and 5 markers.",
        ],
        "instant_drill": {
            "title": f"{chapter} Clarity Drill",
            "route": "/practice",
            "state": {
                "subject": subject,
                "chapter": chapter,
                "questionType": "past-paper",
                "numQuestions": 8,
            },
        },
        "active_recall": active_recall,
        "class_num": str(class_num),
    }


def _study_notifications(user_data: list[dict]) -> list[dict]:
    notifications: list[dict] = []
    if not user_data:
        return notifications

    last_activity = max(datetime.fromisoformat(i["timestamp"]) for i in user_data if i.get("timestamp"))
    if (datetime.now() - last_activity).days >= 2:
        notifications.append({
            "title": "Revision overdue",
            "message": "You have not studied in the last 48 hours. A short practice run will protect your streak.",
            "severity": "medium",
            "action": "Start a 10-minute recovery practice",
        })

    weak_topics = [i for i in user_data if isinstance(i.get("score"), (int, float)) and i.get("score", 100) < 50]
    if weak_topics:
        topic = str(weak_topics[0].get("chapter") or "a weak chapter")
        notifications.append({
            "title": "Weak chapter detected",
            "message": f"{topic} is below target. Move it to today's top priority.",
            "severity": "high",
            "action": f"Open resources for {topic}",
        })

    if len({i.get("chapter") for i in user_data if i.get("chapter")}) >= 3:
        notifications.append({
            "title": "Mock test due",
            "message": "You have enough activity to benefit from a weekly mock test today.",
            "severity": "medium",
            "action": "Launch a mixed mock test",
        })

    return notifications[:3]


@router.post("/flashcards", response_model=FlashcardResponse)
async def generate_flashcards(request: FlashcardRequest, x_user_id: str = Header(None)):
    _require_non_empty(request.class_num, "class_num")
    _require_non_empty(request.subject, "subject")
    _require_non_empty(request.chapter, "chapter")
    if x_user_id and not check_rate_limit(x_user_id, "question"):
        raise HTTPException(
            status_code=429,
            detail="Daily flashcard limit reached. Upgrade to Pro for unlimited revision packs!",
        )

    prompt = (
        f"Create exactly {request.count} CBSE revision flashcards for Class {request.class_num} "
        f"{request.subject}, Chapter: {request.chapter}.\n\n"
        "Output format rules:\n"
        "- One flashcard per line\n"
        "- Use this exact format: Q: <question> | A: <answer>\n"
        "- Keep answer concise and exam-ready\n"
        "- Use NCERT terms"
    )

    messages = [
        {
            "role": "system",
            "content": (
                f"You are Clarity, a CBSE tutor for Class {request.class_num} {request.subject}. "
                "Create high-quality board revision flashcards."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    response = await ask_openrouter(messages, task_type="fast")

    flashcards = []
    for raw in response.splitlines():
        line = raw.strip()
        if not line or "Q:" not in line or "| A:" not in line:
            continue
        q_part, a_part = line.split("| A:", 1)
        question = q_part.replace("Q:", "", 1).strip(" -\t")
        answer = a_part.strip()
        if question and answer:
            flashcards.append(FlashcardItem(question=question, answer=answer))

    if not flashcards:
        fallback_lines = [l.strip("- ") for l in response.splitlines() if l.strip()]
        for line in fallback_lines[: request.count]:
            flashcards.append(
                FlashcardItem(
                    question=line[:120],
                    answer="Review this concept from the chapter and write a 1-mark response.",
                )
            )

    if x_user_id:
        increment_usage(x_user_id, "question")

    return FlashcardResponse(flashcards=flashcards[: request.count])


@router.post("/flashcards-stream")
async def generate_flashcards_stream(request: FlashcardRequest, x_user_id: str = Header(None)):
    _require_non_empty(request.class_num, "class_num")
    _require_non_empty(request.subject, "subject")
    _require_non_empty(request.chapter, "chapter")
    if x_user_id and not check_rate_limit(x_user_id, "question"):
        raise HTTPException(
            status_code=429,
            detail="Daily flashcard limit reached. Upgrade to Pro for unlimited revision packs!",
        )

    prompt = (
        f"Create exactly {request.count} CBSE revision flashcards for Class {request.class_num} "
        f"{request.subject}, Chapter: {request.chapter}.\n\n"
        "Output format rules:\n"
        "- One flashcard per line\n"
        "- Use this exact format: Q: <question> | A: <answer>\n"
        "- Keep answer concise and exam-ready\n"
        "- Use NCERT terms"
    )

    messages = [
        {
            "role": "system",
            "content": (
                f"You are Clarity, a CBSE tutor for Class {request.class_num} {request.subject}. "
                "Create high-quality board revision flashcards."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    async def event_generator():
        try:
            async for token in ask_openrouter_stream(messages, task_type="fast"):
                yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
        except Exception as exc:
            logger.error("Flashcards stream failed, emitting fallback: %s", str(exc))
            fallback_cards = _fallback_flashcards(request)
            fallback_text = "\n".join([f"Q: {c.question} | A: {c.answer}" for c in fallback_cards])
            yield f"data: {json.dumps({'token': fallback_text, 'done': False})}\n\n"
        if x_user_id:
            increment_usage(x_user_id, "question")
        yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/generate", response_model=PracticeResponse)
async def generate_questions(request: PracticeRequest, x_user_id: str = Header(None)):
    _require_non_empty(request.class_num, "class_num")
    _require_non_empty(request.subject, "subject")
    _require_non_empty(request.chapter, "chapter")
    if x_user_id and not check_rate_limit(x_user_id, "question"):
        raise HTTPException(status_code=429, detail="Daily limit reached. Upgrade to Pro for unlimited practice! 🚀")

    # Determine mark type for better prompting
    mark_instructions = {
        "1-mark": "very short, single-sentence answer questions (definitions, fill-in-the-blank style)",
        "3-mark": "short answer questions requiring 3 distinct points",
        "5-mark": "long answer questions requiring detailed explanations with diagrams described",
        "mixed":  "a mix of 1-mark, 3-mark and 5-mark questions — label each with [1 Mark], [3 Marks], [5 Marks]",
        "mcq":    "MCQ questions with 4 options (A-D). Format each question exactly as:\n[Number]. [Question Text]\nA) [Option A]\nB) [Option B]\nC) [Option C]\nD) [Option D]\nAnswer: [Correct Option Letter]\n\nDo not write explanation, and keep the formats uniform.",
        "fill-blanks": "Fill in the blank questions. Format each question exactly as:\n[Number]. [Sentence with a single blank represented as '________' (8 underscores)]\nAnswer: [Correct Word/Phrase]\n\nDo not write explanation, and keep the formats uniform.",
        "match-following": "Match the following questions. Format each question exactly as:\n[Number]. Match Column A with Column B:\nColumn A:\n1) [Item 1]\n2) [Item 2]\n3) [Item 3]\nColumn B:\nA) [Matching Item A]\nB) [Matching Item B]\nC) [Matching Item C]\nAnswer: 1-[A-C], 2-[A-C], 3-[A-C]\n\nDo not write explanation, and keep the formats uniform.",
        "variety": (
            "a varied mix of CBSE board questions including a random selection of:\n"
            "- Multiple Choice Questions (MCQs), formatted exactly as:\n"
            "[Number]. [Question Text]\nA) [Option A]\nB) [Option B]\nC) [Option C]\nD) [Option D]\nAnswer: [Correct Option Letter]\n\n"
            "- Fill in the blank questions, formatted exactly as:\n"
            "[Number]. [Sentence with a single blank represented as '________' (8 underscores)]\nAnswer: [Correct Word/Phrase]\n\n"
            "- Match the following questions, formatted exactly as:\n"
            "[Number]. Match Column A with Column B:\nColumn A:\n1) [Item 1]\n2) [Item 2]\n3) [Item 3]\nColumn B:\nA) [Matching Item A]\nB) [Matching Item B]\nC) [Matching Item C]\nAnswer: 1-[A-C], 2-[A-C], 3-[A-C]\n\n"
            "- Short/long answer conceptual/competency questions (1-mark, 3-mark, or 5-mark items)\n\n"
            "Ensure a diverse selection of these formats across the generated list. Do not write explanation, and keep the formats uniform."
        ),
        "past-paper": "past-paper style board questions with realistic CBSE phrasing and mark tags",
    }
    style = mark_instructions.get(request.question_type, mark_instructions["mixed"])
    variation_clause = _subject_randomization_clause(request.subject, request.question_type)
    
    stick_to_textbook = getattr(request, 'stick_to_textbook', False)
    
    # Fetch textbook text
    textbook_context = ""
    try:
        from services.database import get_custom_textbook_content
        if x_user_id:
            textbook_context = get_custom_textbook_content(x_user_id, int(request.class_num), request.subject, request.chapter) or ""
        if not textbook_context:
            textbook_context = await get_textbook_chapter_text(request.class_num, request.subject, request.chapter)
    except Exception as e:
        logger.error(f"Error fetching textbook context: {e}")

    textbook_instruction = ""
    if stick_to_textbook:
        textbook_instruction = (
            "- STICK STRICTLY TO TEXTBOOK EXERCISES: The questions MUST be directly based on the exercises, "
            "worked examples, and direct text found in the provided NCERT textbook content. "
            "For Mathematics, use the exact numerical techniques, formulas, and structural patterns "
            "used in the textbook examples/exercises. Do not invent new theoretical scenarios outside "
            "the provided chapter content."
        )
    else:
        textbook_instruction = (
            "- CREATIVE & UNIQUE QUESTIONS: Generate creative, unique, and competency-based questions "
            "(HOTS - Higher Order Thinking Skills) that test the same underlying concepts and definitions "
            "from the textbook, but present them in new, application-oriented scenarios. "
            "Do not directly copy textbook exercises."
        )

    prompt = (
        f"Generate exactly {request.num_questions} CBSE board-style {style} "
        f"for Class {request.class_num} (Grade {request.class_num}) {request.subject}.\n\n"
        f"CRITICAL COVERAGE REQUIREMENT:\n"
        f"- You MUST strictly and only generate questions from the specified chapter: {request.chapter}.\n"
        f"- DO NOT include questions from other chapters of the {request.subject} syllabus.\n"
        f"- NO DRAWING/DIAGRAM/LABEL QUESTIONS: Do NOT generate questions that ask the student to draw, diagram, label, sketch, plot, or construct charts/graphs/figures. All questions must be solvable purely via text answers or numerical calculations.\n\n"
        f"Rigor & Standard:\n"
        f"- The question rigor, level, and syllabus MUST exactly match the Class {request.class_num} standard. "
        f"Do not include concepts or techniques from higher classes.\n\n"
        f"Rules:\n"
        f"- Number each question: 1. 2. 3. ...\n"
        f"- Questions must match past CBSE board paper patterns\n"
        f"- Do NOT include answers (except for MCQs)\n"
        f"- Use exact NCERT terminology\n"
        f"{textbook_instruction}\n"
        f"- {variation_clause}\n"
        f"- Return ONLY the numbered questions, no preamble"
    )


    messages = []
    if textbook_context:
        messages.append({
            "role": "system",
            "content": (
                f"You are an experienced CBSE exam paper setter. You are provided with the official NCERT textbook "
                f"chapter text for Class {request.class_num} {request.subject}, Chapter: {request.chapter}.\n"
                f"Use this text as your sole source of truth for definitions, terminology, and content:\n\n"
                f"{textbook_context[:30000]}"
            )
        })
    else:
        messages.append({
            "role": "system",
            "content": f"You are an experienced CBSE exam paper setter for Class {request.class_num} {request.subject}."
        })
        
    messages.append({"role": "user", "content": prompt})

    # Variety/long-form generation benefits from stronger reasoning.
    task_type = "smart" if request.question_type in ("5-mark", "mixed", "variety", "past-paper") else "fast"
    logger.info(f"Practice generate → task_type={task_type}, type={request.question_type}")

    response = await ask_openrouter(messages, task_type=task_type)

    questions = _extract_questions(response)

    if len(questions) < request.num_questions:
        # One repair pass: ask the model to rewrite malformed output into clean, complete questions.
        repair_prompt = (
            f"The following generated question set is malformed. Rewrite it into exactly {request.num_questions} "
            f"complete CBSE board-style questions for Class {request.class_num} {request.subject}, Chapter: {request.chapter}.\n\n"
            "Rules:\n"
            "- Keep each question complete and grammatically correct\n"
            "- Do NOT include answers\n"
            "- Number as 1. 2. 3. ...\n"
            "- Return ONLY the final numbered list\n\n"
            f"Malformed content:\n{response}"
        )
        repaired = await ask_openrouter(
            [
                {
                    "role": "system",
                    "content": "You clean and normalize CBSE exam question lists.",
                },
                {"role": "user", "content": repair_prompt},
            ],
            task_type="smart",
        )
        repaired_questions = _extract_questions(repaired)
        if repaired_questions:
            questions = repaired_questions

    if len(questions) < request.num_questions:
        missing = request.num_questions - len(questions)
        questions.extend(_fallback_questions(request, missing))

    if x_user_id:
        increment_usage(x_user_id, "question")

    return PracticeResponse(questions=questions[:request.num_questions])


@router.post("/generate-stream")
async def generate_questions_stream(request: PracticeRequest, x_user_id: str = Header(None)):
    _require_non_empty(request.class_num, "class_num")
    _require_non_empty(request.subject, "subject")
    _require_non_empty(request.chapter, "chapter")
    if x_user_id and not check_rate_limit(x_user_id, "question"):
        raise HTTPException(status_code=429, detail="Daily limit reached. Upgrade to Pro for unlimited practice! 🚀")

    mark_instructions = {
        "1-mark": "very short, single-sentence answer questions (definitions, fill-in-the-blank style)",
        "3-mark": "short answer questions requiring 3 distinct points",
        "5-mark": "long answer questions requiring detailed explanations with diagrams described",
        "mixed":  "a mix of 1-mark, 3-mark and 5-mark questions — label each with [1 Mark], [3 Marks], [5 Marks]",
        "mcq":    "MCQ questions with 4 options (A-D). Format each question exactly as:\n[Number]. [Question Text]\nA) [Option A]\nB) [Option B]\nC) [Option C]\nD) [Option D]\nAnswer: [Correct Option Letter]\n\nDo not write explanation, and keep the formats uniform.",
        "fill-blanks": "Fill in the blank questions. Format each question exactly as:\n[Number]. [Sentence with a single blank represented as '________' (8 underscores)]\nAnswer: [Correct Word/Phrase]\n\nDo not write explanation, and keep the formats uniform.",
        "match-following": "Match the following questions. Format each question exactly as:\n[Number]. Match Column A with Column B:\nColumn A:\n1) [Item 1]\n2) [Item 2]\n3) [Item 3]\nColumn B:\nA) [Matching Item A]\nB) [Matching Item B]\nC) [Matching Item C]\nAnswer: 1-[A-C], 2-[A-C], 3-[A-C]\n\nDo not write explanation, and keep the formats uniform.",
        "variety": (
            "a varied mix of CBSE board questions including a random selection of:\n"
            "- Multiple Choice Questions (MCQs), formatted exactly as:\n"
            "[Number]. [Question Text]\nA) [Option A]\nB) [Option B]\nC) [Option C]\nD) [Option D]\nAnswer: [Correct Option Letter]\n\n"
            "- Fill in the blank questions, formatted exactly as:\n"
            "[Number]. [Sentence with a single blank represented as '________' (8 underscores)]\nAnswer: [Correct Word/Phrase]\n\n"
            "- Match the following questions, formatted exactly as:\n"
            "[Number]. Match Column A with Column B:\nColumn A:\n1) [Item 1]\n2) [Item 2]\n3) [Item 3]\nColumn B:\nA) [Matching Item A]\nB) [Matching Item B]\nC) [Matching Item C]\nAnswer: 1-[A-C], 2-[A-C], 3-[A-C]\n\n"
            "- Short/long answer conceptual/competency questions (1-mark, 3-mark, or 5-mark items)\n\n"
            "Ensure a diverse selection of these formats across the generated list. Do not write explanation, and keep the formats uniform."
        ),
        "past-paper": "past-paper style board questions with realistic CBSE phrasing and mark tags",
    }
    style = mark_instructions.get(request.question_type, mark_instructions["mixed"])
    variation_clause = _subject_randomization_clause(request.subject, request.question_type)
    
    stick_to_textbook = getattr(request, 'stick_to_textbook', False)
    
    # Fetch textbook text
    textbook_context = ""
    try:
        from services.database import get_custom_textbook_content
        if x_user_id:
            textbook_context = get_custom_textbook_content(x_user_id, int(request.class_num), request.subject, request.chapter) or ""
        if not textbook_context:
            textbook_context = await get_textbook_chapter_text(request.class_num, request.subject, request.chapter)
    except Exception as e:
        logger.error(f"Error fetching textbook context: {e}")

    textbook_instruction = ""
    if stick_to_textbook:
        textbook_instruction = (
            "- STICK STRICTLY TO TEXTBOOK EXERCISES: The questions MUST be directly based on the exercises, "
            "worked examples, and direct text found in the provided NCERT textbook content. "
            "For Mathematics, use the exact numerical techniques, formulas, and structural patterns "
            "used in the textbook examples/exercises. Do not invent new theoretical scenarios outside "
            "the provided chapter content."
        )
    else:
        textbook_instruction = (
            "- CREATIVE & UNIQUE QUESTIONS: Generate creative, unique, and competency-based questions "
            "(HOTS - Higher Order Thinking Skills) that test the same underlying concepts and definitions "
            "from the textbook, but present them in new, application-oriented scenarios. "
            "Do not directly copy textbook exercises."
        )

    prompt = (
        f"Generate exactly {request.num_questions} CBSE board-style {style} "
        f"for Class {request.class_num} (Grade {request.class_num}) {request.subject}.\n\n"
        f"CRITICAL COVERAGE REQUIREMENT:\n"
        f"- You MUST strictly and only generate questions from the specified chapter: {request.chapter}.\n"
        f"- DO NOT include questions from other chapters of the {request.subject} syllabus.\n"
        f"- NO DRAWING/DIAGRAM/LABEL QUESTIONS: Do NOT generate questions that ask the student to draw, diagram, label, sketch, plot, or construct charts/graphs/figures. All questions must be solvable purely via text answers or numerical calculations.\n\n"
        f"Rigor & Standard:\n"
        f"- The question rigor, level, and syllabus MUST exactly match the Class {request.class_num} standard. "
        f"Do not include concepts or techniques from higher classes.\n\n"
        f"Rules:\n"
        f"- Number each question: 1. 2. 3. ...\n"
        f"- Questions must match past CBSE board paper patterns\n"
        f"- Do NOT include answers (except for MCQs)\n"
        f"- Use exact NCERT terminology\n"
        f"{textbook_instruction}\n"
        f"- {variation_clause}\n"
        f"- Return ONLY the numbered questions, no preamble"
    )


    messages = []
    if textbook_context:
        messages.append({
            "role": "system",
            "content": (
                f"You are an experienced CBSE exam paper setter. You are provided with the official NCERT textbook "
                f"chapter text for Class {request.class_num} {request.subject}, Chapter: {request.chapter}.\n"
                f"Use this text as your sole source of truth for definitions, terminology, and content:\n\n"
                f"{textbook_context[:30000]}"
            )
        })
    else:
        messages.append({
            "role": "system",
            "content": f"You are an experienced CBSE exam paper setter for Class {request.class_num} {request.subject}."
        })
        
    messages.append({"role": "user", "content": prompt})
    task_type = "smart" if request.question_type in ("5-mark", "mixed", "variety", "past-paper") else "fast"

    async def event_generator():
        try:
            async for token in ask_openrouter_stream(messages, task_type=task_type):
                yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
        except Exception as exc:
            logger.error("Practice generate stream failed, emitting fallback: %s", str(exc))
            fallback_questions = _fallback_questions(request, request.num_questions)
            fallback_text = "\n".join([f"{idx + 1}. {q}" for idx, q in enumerate(fallback_questions)])
            yield f"data: {json.dumps({'token': fallback_text, 'done': False})}\n\n"
        if x_user_id:
            increment_usage(x_user_id, "question")
        yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/grade", response_model=GradeResponse)
async def grade_answer(request: GradeRequest, x_user_id: str = Header(None)):
    _require_non_empty(request.class_num, "class_num")
    _require_non_empty(request.subject, "subject")
    _require_non_empty(request.question, "question")
    _require_non_empty(request.user_answer, "user_answer")
    
    personality = request.teacher_personality or "Kind"
    prompt = f"""You are a {personality} teacher grading a student's answer.

QUESTION: {request.question}
STUDENT'S ANSWER: {request.user_answer}
TOTAL MARKS AVAILABLE: {request.marks_available}
CLASS: {request.class_num} | SUBJECT: {request.subject}

Grade this answer. Be supportive, lenient, and use common sense like a kind teacher.
- If the question is a "Match the Following" question:
  * Check the student's answer for each pairing.
  * In "WHAT WAS GOOD", list the pairs that the student got correct.
  * In "WHAT WAS MISSING", list the pairs that the student got wrong, explain why, and write out the correct pairings.
  * In "MODEL ANSWER", output the complete, correct matching list (e.g., a - 2, b - 4, c - 1, d - 3).
- For short answers/fill-in-the-blanks, be extremely lenient with typos, spelling variations, plural/singular forms (e.g., accepting "dendrites" for "dendrite"), and grammar as long as the concept is correct.

Return your response in this EXACT format (no extra text):
MARKS: X/{request.marks_available}
WHAT WAS GOOD: [specific points or pairings the student got right]
WHAT WAS MISSING: [specific points or pairings that were missing or incorrect]
MODEL ANSWER: [the ideal answer/pairings to get full marks]"""

    messages = [
        {
            "role": "system",
            "content": (
                f"You are a kind and supportive school teacher. Your personality is {personality}. "
                "Grade answers with common sense and leniency. Give full credit for correct conceptual understanding "
                "even if there are minor spelling mistakes, plural/singular variations (e.g., 'dendrites' vs 'dendrite'), typos, or bad grammar. "
                "For Match the Following questions, explicitly state which pairings were correct and incorrect, and provide the correct mappings. "
                "Always return in the exact format requested."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    # Grading needs intelligence — always use smart model
    logger.info(f"Practice grade → task_type=smart, marks={request.marks_available}")
    response = await ask_openrouter(messages, task_type="smart")

    # Parse the structured response
    marks_match = re.search(r'MARKS:\s*(\d+)/(\d+)', response)
    good_match = re.search(r'WHAT WAS GOOD:\s*(.*?)(?=WHAT WAS MISSING:|$)', response, re.DOTALL)
    missing_match = re.search(r'WHAT WAS MISSING:\s*(.*?)(?=MODEL ANSWER:|$)', response, re.DOTALL)
    model_match = re.search(r'MODEL ANSWER:\s*(.*)', response, re.DOTALL)

    marks_awarded = int(marks_match.group(1)) if marks_match else 0
    total_marks = int(marks_match.group(2)) if marks_match else request.marks_available
    good_text = good_match.group(1).strip() if good_match else "Attempted the question."
    missing_text = missing_match.group(1).strip() if missing_match else "Review the chapter concepts."
    model_answer = model_match.group(1).strip() if model_match else "Refer to your NCERT textbook."

    feedback = f"Good: {good_text}\nMissing: {missing_text}"
    revision = _analyze_mistake(request.question, request.user_answer, response, request.marks_available)

    return GradeResponse(
        marks_awarded=marks_awarded,
        total_marks=total_marks,
        feedback=feedback,
        model_answer=model_answer,
        micro_explanation=revision["micro_explanation"],
        related_question=revision["related_question"],
        flashcard_due=revision["flashcard_due"],
        weak_skill=revision["weak_skill"],
    )


@router.post("/grade-stream")
async def grade_answer_stream(request: GradeRequest, x_user_id: str = Header(None)):
    _require_non_empty(request.class_num, "class_num")
    _require_non_empty(request.subject, "subject")
    _require_non_empty(request.question, "question")
    _require_non_empty(request.user_answer, "user_answer")
    
    personality = request.teacher_personality or "Kind"
    prompt = f"""You are a {personality} teacher grading a student's answer.

QUESTION: {request.question}
STUDENT'S ANSWER: {request.user_answer}
TOTAL MARKS AVAILABLE: {request.marks_available}
CLASS: {request.class_num} | SUBJECT: {request.subject}

Grade this answer. Be supportive, lenient, and use common sense like a kind teacher.
- If the question is a "Match the Following" question:
  * Check the student's answer for each pairing.
  * In "WHAT WAS GOOD", list the pairs that the student got correct.
  * In "WHAT WAS MISSING", list the pairs that the student got wrong, explain why, and write out the correct pairings.
  * In "MODEL ANSWER", output the complete, correct matching list (e.g., a - 2, b - 4, c - 1, d - 3).
- For short answers/fill-in-the-blanks, be extremely lenient with typos, spelling variations, plural/singular forms (e.g., accepting "dendrites" for "dendrite"), and grammar as long as the concept is correct.

Return your response in this EXACT format (no extra text):
MARKS: X/{request.marks_available}
WHAT WAS GOOD: [specific points or pairings the student got right]
WHAT WAS MISSING: [specific points or pairings that were missing or incorrect]
MODEL ANSWER: [the ideal answer/pairings to get full marks]"""

    messages = [
        {
            "role": "system",
            "content": (
                f"You are a kind and supportive school teacher. Your personality is {personality}. "
                "Grade answers with common sense and leniency. Give full credit for correct conceptual understanding "
                "even if there are minor spelling mistakes, plural/singular variations (e.g., 'dendrites' vs 'dendrite'), typos, or bad grammar. "
                "For Match the Following questions, explicitly state which pairings were correct and incorrect, and provide the correct mappings. "
                "Always return in the exact format requested."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    async def event_generator():
        response_text = ""
        try:
            async for token in ask_openrouter_stream(messages, task_type="smart"):
                response_text += token
                yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
        except Exception as exc:
            logger.error("Practice grade stream failed, emitting fallback: %s", str(exc))
            response_text = _fallback_grade_response(request)
            yield f"data: {json.dumps({'token': response_text, 'done': False})}\n\n"

        revision = _analyze_mistake(request.question, request.user_answer, response_text, request.marks_available)
        revision_lines = [
            f"### Micro Explanation\n{revision['micro_explanation']}",
            f"### Related Question\n{revision['related_question']}",
            f"### Flashcard Due\n{revision['flashcard_due']}",
            f"### Weak Skill\n{revision['weak_skill']}",
        ]
        for line in revision_lines:
            payload = {"token": "\n" + line, "done": False}
            yield f"data: {json.dumps(payload)}\n\n"
        yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/past-papers")
async def list_past_papers(class_num: str, subject: str, chapter: str | None = None, limit: int = 50):
    papers = _load_past_papers()
    filtered = [
        p for p in papers
        if str(p.get("class_num", "")) == str(class_num)
        and str(p.get("subject", "")).lower() == subject.lower()
        and (chapter is None or str(p.get("chapter", "")).lower() == chapter.lower())
    ]

    normalized = []
    for p in filtered[: max(1, min(limit, 200))]:
        item = dict(p)
        item["pdf_url"] = item.get("pdf_url")
        item["source_url"] = item.get("source_url") or _build_paper_source_link(item)
        normalized.append(item)

    return {"papers": normalized}


@router.get("/past-paper-questions")
async def get_past_paper_questions(paper_id: str):
    papers = _load_past_papers()
    for paper in papers:
        if str(paper.get("id")) == str(paper_id):
            return {
                "paper": {
                    "id": paper.get("id"),
                    "year": paper.get("year"),
                    "board": paper.get("board"),
                    "subject": paper.get("subject"),
                    "chapter": paper.get("chapter"),
                    "difficulty": paper.get("difficulty"),
                    "pdf_url": paper.get("pdf_url"),
                    "source_url": paper.get("source_url") or _build_paper_source_link(paper),
                },
                "questions": paper.get("questions", []),
            }
    raise HTTPException(status_code=404, detail="Past paper not found")


@router.get("/chapter-readiness", response_model=ChapterReadinessResponse)
async def chapter_readiness(chapter: str, authorization: Optional[str] = Header(default=None)):
    username = get_username_by_token(_extract_token(authorization)) if authorization else None
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")
    user_data = fetch_progress_logs(username)
    metrics = _chapter_readiness_metrics(user_data, chapter)
    return ChapterReadinessResponse(chapter=chapter, **metrics)


@router.get("/resource-stack", response_model=ResourceStackResponse)
async def resource_stack(subject: str, chapter: str, authorization: Optional[str] = Header(default=None)):
    username = get_username_by_token(_extract_token(authorization)) if authorization else None
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")
    stack = _chapter_resource_stack(chapter, subject)
    return ResourceStackResponse(
        chapter=chapter,
        subject=subject,
        textbook_section=stack["textbook_section"],
        explanation=stack["explanation"],
        worksheet=stack["worksheet"],
        test=stack["test"],
    )


@router.get("/video-resource-stack")
async def video_resource_stack(
    class_num: str,
    subject: str,
    chapter: str,
    limit: int = 5,
    authorization: Optional[str] = Header(default=None),
):
    username = get_username_by_token(_extract_token(authorization)) if authorization else None
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")

    _require_non_empty(class_num, "class_num")
    _require_non_empty(subject, "subject")
    _require_non_empty(chapter, "chapter")

    results = get_best_cbse_videos(subject=subject, grade=class_num, chapter=chapter, limit=limit)
    return {
        "class_num": str(class_num),
        "subject": subject,
        "chapter": chapter,
        "query": results.get("query", ""),
        "query_url": results.get("query_url", ""),
        "videos": results.get("videos", []),
        "clarity_booster": _clarity_video_booster(class_num=class_num, subject=subject, chapter=chapter),
    }


@router.get("/video-learning-assist")
async def video_learning_assist(
    class_num: str,
    subject: str,
    chapter: str,
    video_id: str = "",
    video_url: str = "",
    authorization: Optional[str] = Header(default=None),
):
    username = get_username_by_token(_extract_token(authorization)) if authorization else None
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")

    _require_non_empty(class_num, "class_num")
    _require_non_empty(subject, "subject")
    _require_non_empty(chapter, "chapter")

    tier = _resolve_user_tier(username)
    if tier not in ("pro", "pro_max"):
        raise HTTPException(status_code=403, detail="Video learning assist is a premium feature. Please upgrade to Pro/Pro Max.")

    resolved_video_id = _extract_youtube_video_id(video_id=video_id, video_url=video_url)
    if not resolved_video_id:
        raise HTTPException(status_code=422, detail="A valid YouTube video id or url is required")

    try:
        transcript_entries = _fetch_video_transcript_entries(resolved_video_id)
    except HTTPException as e:
        logger.warning(f"Transcript unavailable for {resolved_video_id}: {e.detail}")
        transcript_entries = []

    intelligence = await _build_video_intelligence_with_ai(
        class_num=class_num,
        subject=subject,
        chapter=chapter,
        transcript_entries=transcript_entries,
        plan_tier=tier,
    )

    return {
        "class_num": str(class_num),
        "subject": subject,
        "chapter": chapter,
        "video_id": resolved_video_id,
        **intelligence,
    }


@router.get("/mock-schedule", response_model=MockScheduleResponse)
async def mock_schedule(authorization: Optional[str] = Header(default=None)):
    username = get_username_by_token(_extract_token(authorization)) if authorization else None
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")
    user_data = fetch_progress_logs(username)
    weak_topics = [str(i.get("chapter") or "").strip() for i in user_data if isinstance(i.get("score"), (int, float)) and i.get("score", 100) < 50]
    last_mock = None
    for item in reversed(user_data):
        if item.get("action") == "practice":
            last_mock = item.get("timestamp")
            break
    last_mock_date = datetime.fromisoformat(last_mock) if last_mock else datetime.now() - timedelta(days=7)
    next_mock_date = (last_mock_date + timedelta(days=7)).date().isoformat()
    readiness = _chapter_readiness_metrics(user_data, weak_topics[0] if weak_topics else (user_data[-1].get("chapter") if user_data else "Core Concepts"))
    difficulty = "easy" if readiness["readiness_score"] < 45 else "medium" if readiness["readiness_score"] < 70 else "hard"
    recovery_plan = [
        "Review one weak chapter for 20 minutes",
        "Solve 5 board-style questions under time",
        "Revise mistakes as flashcards for tomorrow",
    ]
    return MockScheduleResponse(
        next_mock_date=next_mock_date,
        difficulty=difficulty,
        readiness_score=readiness["readiness_score"],
        weak_skills=weak_topics[:5],
        recovery_plan=recovery_plan,
    )


@router.get("/notifications")
async def proactive_notifications(authorization: Optional[str] = Header(default=None)):
    username = get_username_by_token(_extract_token(authorization)) if authorization else None
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")
    user_data = fetch_progress_logs(username)
    return {"notifications": _study_notifications(user_data)}


@router.get("/explain-question")
async def explain_question(question: str, chapter: str, subject: str):
    _require_non_empty(subject, "subject")
    _require_non_empty(chapter, "chapter")
    _require_non_empty(question, "question")
    prompt = (
        f"Explain this question for Class 9-12 {subject} students from chapter '{chapter}'.\n"
        f"Question: {question}\n\n"
        "Return exactly these sections:\n"
        "## Concept Behind It\n"
        "## Why Each Option/Part Is Right or Wrong\n"
        "## Similar Pattern Question\n"
        "Keep it concise, exam-aligned, and board-friendly."
    )
    messages = [
        {"role": "system", "content": "You are an NCERT tutor who explains questions deeply but briefly."},
        {"role": "user", "content": prompt},
    ]
    answer = await ask_openrouter(messages, task_type="smart")
    return {"explanation": answer}


@router.get("/worksheets")
async def list_worksheets(
    class_num: str,
    subject: str,
    chapter: str | None = None,
    limit: int = 24,
    refresh: bool = False,
):
    local_worksheets = _derive_worksheets_from_papers(class_num, subject, chapter, limit)
    merged = merge_local_and_remote_worksheets(
        local_items=local_worksheets,
        class_num=class_num,
        subject=subject,
        chapter=chapter,
        limit=limit,
        force_refresh=refresh,
    )
    return {"worksheets": merged}


@router.post("/exam-simulation/start")
async def exam_simulation_start(request: ExamSimStartRequest, authorization: Optional[str] = Header(default=None)):
    from utils.auth import require_auth_username
    username = require_auth_username(authorization)
    
    tier = _resolve_user_tier(username)
    profile = get_user_profile(username)
    exam_simulations_count = profile.get("exam_simulations_count", 0) if profile else 0
    
    if tier == "free":
        raise HTTPException(status_code=403, detail="Mock exams are a premium feature. Please upgrade to Pro/Pro Max.")
    
    increment_exam_simulations(username)

    _require_non_empty(request.class_num, "class_num")
    _require_non_empty(request.subject, "subject")

    scope, selected_chapters = _resolve_exam_scope_chapters(request)
    question_count = max(3, min(int(request.question_count or 10), 30))
    marks_distribution = _build_marks_distribution(int(request.total_marks or 80), question_count)
    questions = await _generate_exam_questions(request, selected_chapters, marks_distribution)
    session_id = f"sim_{uuid.uuid4().hex[:12]}"
    duration = max(20, min(int(request.duration_minutes or 180), 240))
    total_marks = sum(item.get("marks", 0) for item in questions)
    return {
        "session_id": session_id,
        "mode": request.mode,
        "scope": scope,
        "duration_minutes": duration,
        "subject": request.subject,
        "chapter": selected_chapters[0] if selected_chapters else "",
        "chapters": selected_chapters,
        "total_marks": total_marks,
        "questions": questions,
    }


@router.post("/exam-simulation/submit")
async def exam_simulation_submit(request: ExamSimSubmitRequest, authorization: Optional[str] = Header(default=None)):
    require_pro_max_username(authorization)

    _require_non_empty(request.session_id, "session_id")
    _require_non_empty(request.subject, "subject")
    if str(request.scope or "single-chapter") == "single-chapter":
        _require_non_empty(request.chapter, "chapter")

    result = _score_exam_answers(request.answers)
    return {
        "session_id": request.session_id,
        "mode": request.mode,
        "scope": request.scope,
        "subject": request.subject,
        "chapter": request.chapter,
        "chapters": request.chapters,
        **result,
    }
