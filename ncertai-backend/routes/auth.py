from typing import Optional, Literal
import os
import json
import random
import re
import secrets
import hashlib
import hmac
import time

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from services.database import (
    create_parent_session,
    create_session,
    create_user,
    delete_parent_session,
    delete_session,
    get_user_snapshot,
    get_study_materials,
    get_user_profile,
    get_parent_account_by_student,
    get_parent_account_by_email,
    save_diagnostic_assessment,
    get_username_by_token,
    save_user_snapshot,
    set_user_subscription_tier,
    set_user_subscription,
    reset_parent_credentials,
    upsert_parent_account,
    upsert_study_material,
    update_user_profile,
    verify_parent_user,
    verify_user,
    update_streak,
)
from utils.curriculum import load_curriculum_catalog
from services.report_generator import send_parent_welcome_credentials_email

router = APIRouter()


ALLOWED_SUBSCRIPTION_TIERS = {"free", "pro", "pro_max"}


@router.get("/locations")
async def get_locations():
    return {
        "countries": ["India", "UAE", "USA", "UK"],
        "states": ["Tamil Nadu", "Delhi", "Maharashtra", "Dubai", "Abu Dhabi"],
        "cities": ["Chennai", "New Delhi", "Mumbai", "Dubai", "Abu Dhabi"]
    }
@router.get("/parent-credentials")
async def get_parent_credentials(x_user_id: str = Header(...)):
    from services.database import get_parent_account_by_student, reset_parent_credentials
    import secrets
    account = get_parent_account_by_student(x_user_id)
    if account:
        p_pass = account.get("plain_password")
        if not p_pass or p_pass == "********":
            p_pass = secrets.token_urlsafe(9)
            reset_parent_credentials(x_user_id, p_pass)
        return {
            "email": account.get("parent_email", ""),
            "password": p_pass
        }
    return {"email": "", "password": ""}


@router.post("/send-parent-credentials")
async def send_parent_credentials(x_user_id: str = Header(...)):
    from services.database import get_parent_account_by_student, reset_parent_credentials
    from services.report_generator import send_parent_welcome_credentials_email
    import secrets
    
    account = get_parent_account_by_student(x_user_id)
    if not account:
        return {"sent": False, "message": "No parent account linked."}
        
    p_email = account.get("parent_email", "")
    p_pass = account.get("plain_password")
    if not p_pass or p_pass == "********":
        p_pass = secrets.token_urlsafe(9)
        reset_parent_credentials(x_user_id, p_pass)
        
    res = send_parent_welcome_credentials_email(x_user_id, p_email, p_pass)
    return res


def _normalize_subscription_tier(value: Optional[str]) -> str:
    tier = str(value or "pro").strip().lower()
    if tier not in ALLOWED_SUBSCRIPTION_TIERS:
        return "pro"
    return tier


def _client_can_self_assign_tiers() -> bool:
    value = os.getenv("CLARITY_ALLOW_SELF_ASSIGNED_TIERS", "1").strip().lower()
    return value in {"1", "true", "yes", "on"}


def _resolve_subscription_tier(username: str, requested_tier: Optional[str]) -> str:
    requested = _normalize_subscription_tier(requested_tier)
    if _client_can_self_assign_tiers():
        return requested

    existing = get_user_profile(username)
    if existing:
        stored = _normalize_subscription_tier(existing.get("subscription_tier"))
        if stored in {"pro", "pro_max"}:
            return stored
    return "free"


class AuthProfile(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    class_num: str | int = Field(alias="class")
    subjects: list[str] = []
    subscriptionTier: Literal["free", "pro", "pro_max"] = "free"
    school: Optional[str] = None
    learningStyle: Optional[str] = None
    goal: Optional[str] = None
    studyHours: Optional[str] = None
    focusAreas: Optional[str] = None
    examBoard: Optional[str] = None
    preferredLanguage: Optional[str] = None
    preferredPace: Optional[str] = None
    confidenceLevel: Optional[str] = None
    revisionFrequency: Optional[str] = None
    parentEmail: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    teacherPersonality: Optional[str] = None
    city: Optional[str] = None
    points: Optional[int] = 0
    teacherPersonality: Optional[str] = "Kind"
    focusChapters: Optional[dict[str, list[str]]] = None


class RegisterRequest(BaseModel):
    profile: AuthProfile
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    name: str
    password: str


class ParentLoginRequest(BaseModel):
    email: str
    password: str


class ParentResendCredentialsRequest(BaseModel):
    pass


class StudyMaterialRequest(BaseModel):
    id: str
    type: str
    title: str
    subject: Optional[str] = None
    chapter: Optional[str] = None
    content: Optional[str] = None
    url: Optional[str] = None
    imageDataUrl: Optional[str] = None
    createdAt: int


class SnapshotRequest(BaseModel):
    payload: dict


class DiagnosticAnswerItem(BaseModel):
    question_id: str
    selected_option: str


class DiagnosticRequest(BaseModel):
    class_num: str
    subject: Optional[str] = None
    answers: list[DiagnosticAnswerItem]


class BillingCheckoutRequest(BaseModel):
    plan: Literal["pro", "pro_max"]


def _billing_price_env_name(plan: str) -> str:
    if plan == "pro_max":
        return "STRIPE_PRICE_ID_PRO_MAX"
    return "STRIPE_PRICE_ID_PRO"


def _billing_public_config() -> dict[str, dict[str, str]]:
    return {
        "pro": {
            "label": "Pro",
            "monthly": "50 AED",
            "yearly": "500 AED",
        },
        "pro_max": {
            "label": "Pro Max",
            "monthly": "350 AED",
            "yearly": "3500 AED",
        },
    }


def _verify_stripe_signature(payload: bytes, signature_header: str, secret: str, tolerance_seconds: int = 300) -> bool:
    if not signature_header or not secret:
        return False

    pieces: dict[str, list[str]] = {}
    for item in signature_header.split(","):
        if "=" not in item:
            continue
        key, value = item.split("=", 1)
        pieces.setdefault(key.strip(), []).append(value.strip())

    timestamp = (pieces.get("t") or [""])[0]
    if not timestamp.isdigit():
        return False

    signed_payload = f"{timestamp}.{payload.decode('utf-8')}"
    expected_signature = hmac.new(secret.encode("utf-8"), signed_payload.encode("utf-8"), hashlib.sha256).hexdigest()
    stripe_signatures = pieces.get("v1") or []
    if not any(secrets.compare_digest(expected_signature, signature) for signature in stripe_signatures):
        return False

    try:
        age = abs(int(time.time()) - int(timestamp))
    except Exception:
        return False
    return age <= tolerance_seconds


def _resolve_lower_class(curriculum: dict[str, dict[str, list[str]]], class_num: str) -> str:
    cleaned = str(class_num).strip()
    if "TN" in cleaned:
        # Extract the numeric grade part (e.g., "10_TN_EN" -> "10", "8_TN_TM" -> "8")
        grade_str = cleaned.split("_")[0]
        try:
            grade = max(1, int(grade_str) - 1)
        except Exception:
            grade = 9
        return str(grade)
    try:
        target = max(1, int(cleaned) - 1)
    except Exception:
        target = 8
    return str(target)


def _fallback_lower_grade_chapters(diagnostic_class: str, subject: str) -> list[str]:
    subj = (subject or "").strip().lower()
    if subj == "science":
        if diagnostic_class == "7":
            return [
                "Nutrition in Plants",
                "Nutrition in Animals",
                "Heat",
                "Acids, Bases and Salts",
                "Light",
            ]
        if diagnostic_class == "8":
            return [
                "Crop Production and Management",
                "Microorganisms: Friend and Foe",
                "Force and Pressure",
                "Friction",
                "Light",
            ]
        return [
            "Matter in Our Surroundings",
            "Is Matter Around Us Pure",
            "Atoms and Molecules",
            "Structure of the Atom",
            "The Fundamental Unit of Life",
        ]

    if subj in {"maths", "mathematics"}:
        if diagnostic_class == "7":
            return [
                "Integers",
                "Fractions and Decimals",
                "Simple Equations",
                "Lines and Angles",
                "The Triangle and its Properties",
            ]
        if diagnostic_class == "8":
            return [
                "Rational Numbers",
                "Linear Equations in One Variable",
                "Comparing Quantities",
                "Algebraic Expressions and Identities",
                "Mensuration",
            ]
        return [
            "Number Systems",
            "Polynomials",
            "Linear Equations in Two Variables",
            "Triangles",
            "Surface Areas and Volumes",
        ]

    if subj in {"social science", "social", "sst"}:
        if diagnostic_class == "7":
            return [
                "Tracing Changes Through A Thousand Years",
                "The Delhi Sultans",
                "The Mughal Empire",
                "Our Environment",
                "Women Change the World",
            ]
        if diagnostic_class == "8":
            return [
                "Resources",
                "The Indian Constitution",
                "Colonialism and the City",
                "Agriculture",
                "Judiciary",
            ]
        return [
            "Democratic Politics",
            "India - Size and Location",
            "The French Revolution",
            "What is Democracy? Why Democracy?",
            "People as Resource",
        ]

    if subj == "english":
        if diagnostic_class == "7":
            return [
                "Basic Grammar Rules",
                "Sentence Structure",
                "Reading Comprehension",
                "Punctuation Marks",
                "Vocabulary & Meanings",
            ]
        if diagnostic_class == "8":
            return [
                "Grammar Foundations",
                "Reading Comprehension",
                "Vocabulary in Context",
                "Sentence Transformation",
                "Letter Writing",
            ]
        return [
            "Reading Skills",
            "Writing Skills",
            "Grammar and Editing",
            "Poetry Interpretation",
            "Prose Analysis",
        ]

    return [
        "Core Concepts",
        "Fundamentals",
        "Applications",
        "Problem Solving",
        "Revision",
    ]


def _normalize_diagnostic_subject(subject: Optional[str], subject_map: dict[str, list[str]]) -> str:
    requested = (subject or "").strip()
    normalized = requested.lower()
    available = {name.lower(): name for name in subject_map.keys()}

    if requested and requested in subject_map:
        return requested

    if normalized in {"physics", "chemistry", "biology", "science"}:
        for key in subject_map.keys():
            if key.lower() == "science":
                return key

    if normalized in {"maths", "mathematics"}:
        for key in subject_map.keys():
            if key.lower() == "maths":
                return key

    if normalized in {"social science", "social", "sst"}:
        for key in subject_map.keys():
            if key.lower() == "social science":
                return key

    if normalized == "english":
        for key in subject_map.keys():
            if key.lower() == "english":
                return key

    if normalized in available:
        return available[normalized]

    # Prefer STEM subjects by default so diagnostic is concept-heavy for boards.
    for preferred in ("physics", "chemistry", "biology", "maths", "science"):
        for key in subject_map.keys():
            if key.lower() == preferred:
                return key

    keys = list(subject_map.keys())
    if keys:
        return random.choice(keys)
    return requested or "Science"


def _chapter_diagnostic_item(chapter: str, subject: str, idx: int) -> tuple[str, list[dict[str, str]], str]:
    chapter_l = chapter.lower()
    subject_l = (subject or "").strip().lower()

    if subject_l == "science" or subject_l in {"physics", "chemistry", "biology"}:
        if "crop production" in chapter_l:
            return (
                "Which of these is a kharif crop?",
                [
                    {"key": "A", "text": "Rice"},
                    {"key": "B", "text": "Gram"},
                    {"key": "C", "text": "Wheat"},
                    {"key": "D", "text": "Mustard"},
                ],
                "A",
            )

        if "microorganisms" in chapter_l:
            return (
                "Which microorganism is used to set curd from milk?",
                [
                    {"key": "A", "text": "Yeast"},
                    {"key": "B", "text": "Lactobacillus"},
                    {"key": "C", "text": "Plasmodium"},
                    {"key": "D", "text": "Amoeba"},
                ],
                "B",
            )

        if "force and pressure" in chapter_l or chapter_l == "force and pressure":
            return (
                "Pressure is defined as: ",
                [
                    {"key": "A", "text": "Force multiplied by area"},
                    {"key": "B", "text": "Force per unit area"},
                    {"key": "C", "text": "Mass per unit volume"},
                    {"key": "D", "text": "Distance per unit time"},
                ],
                "B",
            )

        if "friction" in chapter_l:
            return (
                "Which action reduces friction in machines?",
                [
                    {"key": "A", "text": "Adding oil or grease"},
                    {"key": "B", "text": "Roughening the surface"},
                    {"key": "C", "text": "Increasing contact area"},
                    {"key": "D", "text": "Increasing weight"},
                ],
                "A",
            )

        if "light" in chapter_l:
            return (
                "An image formed by a plane mirror is: ",
                [
                    {"key": "A", "text": "Real and inverted"},
                    {"key": "B", "text": "Virtual and erect"},
                    {"key": "C", "text": "Real and magnified"},
                    {"key": "D", "text": "Virtual and diminished"},
                ],
                "B",
            )

        if "cell" in chapter_l or "fundamental unit of life" in chapter_l:
            return (
                "The cell is called the basic structural unit of life because it: ",
                [
                    {"key": "A", "text": "Performs all life functions in living organisms"},
                    {"key": "B", "text": "Is found only in plants"},
                    {"key": "C", "text": "Has no membrane"},
                    {"key": "D", "text": "Cannot divide"},
                ],
                "A",
            )

        if "tissue" in chapter_l:
            return (
                "A tissue is a group of cells that: ",
                [
                    {"key": "A", "text": "Perform the same function"},
                    {"key": "B", "text": "Are always identical in shape"},
                    {"key": "C", "text": "Have no nucleus"},
                    {"key": "D", "text": "Live only in water"},
                ],
                "A",
            )

        if "matter" in chapter_l:
            return (
                "Matter is best defined as: ",
                [
                    {"key": "A", "text": "Anything that has mass and occupies space"},
                    {"key": "B", "text": "Anything that gives light"},
                    {"key": "C", "text": "Anything that moves on its own"},
                    {"key": "D", "text": "Only solids around us"},
                ],
                "A",
            )

        if "atom" in chapter_l:
            return (
                "An atom consists of: ",
                [
                    {"key": "A", "text": "Only electrons"},
                    {"key": "B", "text": "Nucleus and electrons"},
                    {"key": "C", "text": "Only protons"},
                    {"key": "D", "text": "Only neutrons"},
                ],
                "B",
            )

        if "motion" in chapter_l:
            return (
                "The slope of a distance-time graph gives: ",
                [
                    {"key": "A", "text": "Speed"},
                    {"key": "B", "text": "Force"},
                    {"key": "C", "text": "Mass"},
                    {"key": "D", "text": "Pressure"},
                ],
                "A",
            )

        if "force and laws of motion" in chapter_l:
            return (
                "Newton's first law is also called the law of: ",
                [
                    {"key": "A", "text": "Action and reaction"},
                    {"key": "B", "text": "Inertia"},
                    {"key": "C", "text": "Universal gravitation"},
                    {"key": "D", "text": "Conservation of energy"},
                ],
                "B",
            )

        if "gravitation" in chapter_l:
            return (
                "The force of attraction between any two masses is called: ",
                [
                    {"key": "A", "text": "Friction"},
                    {"key": "B", "text": "Magnetism"},
                    {"key": "C", "text": "Gravitation"},
                    {"key": "D", "text": "Pressure"},
                ],
                "C",
            )

        if "work and energy" in chapter_l:
            return (
                "Work is done when: ",
                [
                    {"key": "A", "text": "Force causes displacement"},
                    {"key": "B", "text": "Mass remains constant"},
                    {"key": "C", "text": "Temperature falls"},
                    {"key": "D", "text": "Pressure increases"},
                ],
                "A",
            )

        if "sound" in chapter_l:
            return (
                "Sound is produced by: ",
                [
                    {"key": "A", "text": "Vibrating objects"},
                    {"key": "B", "text": "Magnetic fields"},
                    {"key": "C", "text": "Stationary objects"},
                    {"key": "D", "text": "Only liquids"},
                ],
                "A",
            )

        if "improvement in food resources" in chapter_l:
            return (
                "Which of these is a correct example of a kharif crop?",
                [
                    {"key": "A", "text": "Rice"},
                    {"key": "B", "text": "Gram"},
                    {"key": "C", "text": "Pea"},
                    {"key": "D", "text": "Mustard"},
                ],
                "A",
            )

    if "equation" in chapter_l and "two variables" not in chapter_l:
        return (
            "A linear equation in one variable has: ",
            [
                {"key": "A", "text": "Highest power of variable equal to 1"},
                {"key": "B", "text": "Highest power of variable equal to 2"},
                {"key": "C", "text": "No variable"},
                {"key": "D", "text": "More than two variables always"},
            ],
            "A",
        )

    if "rational" in chapter_l:
        return (
            "A rational number can be written as: ",
            [
                {"key": "A", "text": "p/q where q not equal to 0"},
                {"key": "B", "text": "p + q only"},
                {"key": "C", "text": "Only an integer"},
                {"key": "D", "text": "A square root only"},
            ],
            "A",
        )

    if "percentage" in chapter_l or "comparing quantities" in chapter_l:
        return (
            "A percentage means: ",
            [
                {"key": "A", "text": "Per hundred"},
                {"key": "B", "text": "Per thousand"},
                {"key": "C", "text": "Per million"},
                {"key": "D", "text": "Per square unit"},
            ],
            "A",
        )

    if "identity" in chapter_l or "algebraic expressions" in chapter_l:
        return (
            "The expansion of (a + b)^2 is: ",
            [
                {"key": "A", "text": "a^2 + 2ab + b^2"},
                {"key": "B", "text": "a^2 - b^2"},
                {"key": "C", "text": "a^2 + b^2"},
                {"key": "D", "text": "2a + 2b"},
            ],
            "A",
        )

    if "mensuration" in chapter_l or "surface area" in chapter_l:
        return (
            "The area of a rectangle is: ",
            [
                {"key": "A", "text": "Length × breadth"},
                {"key": "B", "text": "2(length + breadth)"},
                {"key": "C", "text": "Length + breadth"},
                {"key": "D", "text": "Length ÷ breadth"},
            ],
            "A",
        )

    if "number system" in chapter_l:
        return (
            "An irrational number is: ",
            [
                {"key": "A", "text": "A number that cannot be expressed as p/q"},
                {"key": "B", "text": "A whole number only"},
                {"key": "C", "text": "A number with no decimal form"},
                {"key": "D", "text": "A negative integer only"},
            ],
            "A",
        )

    if "polynomial" in chapter_l:
        return (
            "The degree of a polynomial is determined by: ",
            [
                {"key": "A", "text": "The highest power of the variable"},
                {"key": "B", "text": "The number of terms only"},
                {"key": "C", "text": "The constant term only"},
                {"key": "D", "text": "The largest coefficient only"},
            ],
            "A",
        )

    if "coordinate geometry" in chapter_l:
        return (
            "A point in the coordinate plane is located by: ",
            [
                {"key": "A", "text": "An ordered pair (x, y)"},
                {"key": "B", "text": "Only a single number"},
                {"key": "C", "text": "A fraction only"},
                {"key": "D", "text": "A square root only"},
            ],
            "A",
        )

    if "linear equations in two variables" in chapter_l:
        return (
            "A linear equation in two variables is commonly written as: ",
            [
                {"key": "A", "text": "ax + by = c"},
                {"key": "B", "text": "x^2 + y^2 = c"},
                {"key": "C", "text": "a/x + b/y = c"},
                {"key": "D", "text": "ax^2 + by = c"},
            ],
            "A",
        )

    if "euclid" in chapter_l:
        return (
            "Euclid's geometry is built on: ",
            [
                {"key": "A", "text": "Axioms and postulates"},
                {"key": "B", "text": "Graphs and tables"},
                {"key": "C", "text": "Trigonometric ratios"},
                {"key": "D", "text": "Only measurement units"},
            ],
            "A",
        )

    if "lines and angles" in chapter_l:
        return (
            "Vertically opposite angles are: ",
            [
                {"key": "A", "text": "Equal"},
                {"key": "B", "text": "Always supplementary"},
                {"key": "C", "text": "Always acute"},
                {"key": "D", "text": "Always obtuse"},
            ],
            "A",
        )

    if "triangles" in chapter_l:
        return (
            "The sum of angles in a triangle is: ",
            [
                {"key": "A", "text": "180 degrees"},
                {"key": "B", "text": "90 degrees"},
                {"key": "C", "text": "270 degrees"},
                {"key": "D", "text": "360 degrees"},
            ],
            "A",
        )

    if "quadrilateral" in chapter_l:
        return (
            "The sum of interior angles in a quadrilateral is: ",
            [
                {"key": "A", "text": "360 degrees"},
                {"key": "B", "text": "180 degrees"},
                {"key": "C", "text": "270 degrees"},
                {"key": "D", "text": "540 degrees"},
            ],
            "A",
        )

    if "circle" in chapter_l:
        return (
            "A tangent to a circle at the point of contact is: ",
            [
                {"key": "A", "text": "Perpendicular to the radius"},
                {"key": "B", "text": "Parallel to the diameter"},
                {"key": "C", "text": "Equal to the chord"},
                {"key": "D", "text": "Always a secant"},
            ],
            "A",
        )

    if "heron" in chapter_l:
        return (
            "Heron's formula uses: ",
            [
                {"key": "A", "text": "The semi-perimeter and side lengths"},
                {"key": "B", "text": "Only the height"},
                {"key": "C", "text": "Only the radius"},
                {"key": "D", "text": "Only the diagonal"},
            ],
            "A",
        )

    if "statistics" in chapter_l:
        return (
            "The mean of a data set is: ",
            [
                {"key": "A", "text": "Sum of values divided by number of values"},
                {"key": "B", "text": "Largest value minus smallest value"},
                {"key": "C", "text": "The middle value always"},
                {"key": "D", "text": "The most frequent value only"},
            ],
            "A",
        )

    if "democracy" in chapter_l:
        return (
            "A key feature of democracy is: ",
            [
                {"key": "A", "text": "Rule by one leader without elections"},
                {"key": "B", "text": "No citizen participation"},
                {"key": "C", "text": "Government chosen by people through elections"},
                {"key": "D", "text": "No constitution"},
            ],
            "C",
        )

    if "french revolution" in chapter_l:
        return (
            "The French Revolution challenged: ",
            [
                {"key": "A", "text": "Absolute monarchy and privilege"},
                {"key": "B", "text": "Only trade rules"},
                {"key": "C", "text": "School uniforms"},
                {"key": "D", "text": "Village irrigation"},
            ],
            "A",
        )

    if "socialism" in chapter_l or "russian revolution" in chapter_l:
        return (
            "A central idea of socialism was: ",
            [
                {"key": "A", "text": "Greater equality in society"},
                {"key": "B", "text": "Rule by kings forever"},
                {"key": "C", "text": "No government at all"},
                {"key": "D", "text": "Only private armies"},
            ],
            "A",
        )

    if "nazism" in chapter_l or "hitler" in chapter_l:
        return (
            "Nazi rule depended heavily on: ",
            [
                {"key": "A", "text": "Propaganda and dictatorship"},
                {"key": "B", "text": "Open elections every week"},
                {"key": "C", "text": "No police force"},
                {"key": "D", "text": "Only local village councils"},
            ],
            "A",
        )

    if "forest society" in chapter_l or "colonialism" in chapter_l:
        return (
            "Colonial forest policies mainly aimed to: ",
            [
                {"key": "A", "text": "Control and exploit forest resources"},
                {"key": "B", "text": "Leave all forests untouched"},
                {"key": "C", "text": "Turn forests into cities"},
                {"key": "D", "text": "Ban all roads"},
            ],
            "A",
        )

    if "pastoralists" in chapter_l:
        return (
            "Pastoralists usually move with their herds to: ",
            [
                {"key": "A", "text": "Find grazing and water"},
                {"key": "B", "text": "Avoid all work"},
                {"key": "C", "text": "Sell textbooks"},
                {"key": "D", "text": "Build factories"},
            ],
            "A",
        )

    if "india - size and location" in chapter_l or "size and location" in chapter_l:
        return (
            "India lies mainly in the: ",
            [
                {"key": "A", "text": "Northern Hemisphere"},
                {"key": "B", "text": "Southern Hemisphere"},
                {"key": "C", "text": "Western Hemisphere only"},
                {"key": "D", "text": "Antarctic Zone"},
            ],
            "A",
        )

    if "physical features" in chapter_l:
        return (
            "The Himalayas are classified as: ",
            [
                {"key": "A", "text": "Young fold mountains"},
                {"key": "B", "text": "Old block mountains"},
                {"key": "C", "text": "Plateaus"},
                {"key": "D", "text": "Volcanic islands"},
            ],
            "A",
        )

    if "drainage" in chapter_l:
        return (
            "A river basin is the area drained by a: ",
            [
                {"key": "A", "text": "River and its tributaries"},
                {"key": "B", "text": "Desert and oasis"},
                {"key": "C", "text": "Mountain peak"},
                {"key": "D", "text": "Forest only"},
            ],
            "A",
        )

    if "climate" in chapter_l:
        return (
            "The Indian monsoon is marked by: ",
            [
                {"key": "A", "text": "Seasonal reversal of winds"},
                {"key": "B", "text": "No rainfall at all"},
                {"key": "C", "text": "Only snowfall"},
                {"key": "D", "text": "Permanent dry weather"},
            ],
            "A",
        )

    if "natural vegetation" in chapter_l:
        return (
            "Tropical rainforests are found in areas with: ",
            [
                {"key": "A", "text": "Heavy rainfall and warm climate"},
                {"key": "B", "text": "Very low rainfall only"},
                {"key": "C", "text": "Permanent snow cover"},
                {"key": "D", "text": "No sunlight"},
            ],
            "A",
        )

    if "population" in chapter_l:
        return (
            "Population density means: ",
            [
                {"key": "A", "text": "People per square kilometre"},
                {"key": "B", "text": "People per family"},
                {"key": "C", "text": "People per village only"},
                {"key": "D", "text": "Birth rate minus death rate"},
            ],
            "A",
        )

    if "electoral" in chapter_l:
        return (
            "Elections in a democracy are used to: ",
            [
                {"key": "A", "text": "Choose representatives"},
                {"key": "B", "text": "Cancel all laws"},
                {"key": "C", "text": "Close courts"},
                {"key": "D", "text": "Remove all voters"},
            ],
            "A",
        )

    if "working of institutions" in chapter_l:
        return (
            "The Prime Minister works with the: ",
            [
                {"key": "A", "text": "Council of Ministers"},
                {"key": "B", "text": "Only the army"},
                {"key": "C", "text": "Village panchayats only"},
                {"key": "D", "text": "School board"},
            ],
            "A",
        )

    if "democratic rights" in chapter_l:
        return (
            "Fundamental rights mainly protect citizens from: ",
            [
                {"key": "A", "text": "Arbitrary state action"},
                {"key": "B", "text": "Homework"},
                {"key": "C", "text": "Weather changes"},
                {"key": "D", "text": "Sports events"},
            ],
            "A",
        )

    if "village palampur" in chapter_l:
        return (
            "Multiple cropping means: ",
            [
                {"key": "A", "text": "Growing more than one crop on the same land in a year"},
                {"key": "B", "text": "Growing only one crop forever"},
                {"key": "C", "text": "Using only imported seeds"},
                {"key": "D", "text": "Selling crops without harvest"},
            ],
            "A",
        )

    if "people as resource" in chapter_l:
        return (
            "Human capital refers to: ",
            [
                {"key": "A", "text": "People with education and skills"},
                {"key": "B", "text": "Only money in banks"},
                {"key": "C", "text": "Only factory machines"},
                {"key": "D", "text": "Land and water only"},
            ],
            "A",
        )

    if "poverty" in chapter_l:
        return (
            "The poverty line is used to: ",
            [
                {"key": "A", "text": "Identify minimum income or consumption needed"},
                {"key": "B", "text": "Set school exam dates"},
                {"key": "C", "text": "Measure rainfall"},
                {"key": "D", "text": "Choose crop seeds"},
            ],
            "A",
        )

    if "food security" in chapter_l:
        return (
            "The Public Distribution System helps ensure: ",
            [
                {"key": "A", "text": "Access to food grains"},
                {"key": "B", "text": "Only luxury goods"},
                {"key": "C", "text": "Sports equipment"},
                {"key": "D", "text": "Transport permits"},
            ],
            "A",
        )

    if "constitution" in chapter_l:
        return (
            "The Constitution primarily provides: ",
            [
                {"key": "A", "text": "Rules and principles to govern the country"},
                {"key": "B", "text": "Only cultural stories"},
                {"key": "C", "text": "Only tax collection data"},
                {"key": "D", "text": "Only election dates"},
            ],
            "A",
        )

    if "resources" in chapter_l:
        return (
            "A resource is best described as: ",
            [
                {"key": "A", "text": "Anything with utility and value"},
                {"key": "B", "text": "Only a natural material"},
                {"key": "C", "text": "Only a man-made object"},
                {"key": "D", "text": "Anything expensive"},
            ],
            "A",
        )

    if "agriculture" in chapter_l:
        return (
            "Kharif crops are usually sown: ",
            [
                {"key": "A", "text": "In the rainy season"},
                {"key": "B", "text": "In winter only"},
                {"key": "C", "text": "After harvest"},
                {"key": "D", "text": "Only in greenhouses"},
            ],
            "A",
        )

    if "judiciary" in chapter_l:
        return (
            "The Supreme Court is: ",
            [
                {"key": "A", "text": "The highest court in India"},
                {"key": "B", "text": "A local school court"},
                {"key": "C", "text": "Only a parliament committee"},
                {"key": "D", "text": "A state police office"},
            ],
            "A",
        )

    if "grammar" in chapter_l or "sentence" in chapter_l:
        return (
            "A noun is: ",
            [
                {"key": "A", "text": "A naming word"},
                {"key": "B", "text": "An action word"},
                {"key": "C", "text": "A joining word"},
                {"key": "D", "text": "A describing word only"},
            ],
            "A",
        )

    if "sentence transformation" in chapter_l:
        return (
            "Sentence transformation usually keeps: ",
            [
                {"key": "A", "text": "The same meaning"},
                {"key": "B", "text": "Only the same punctuation"},
                {"key": "C", "text": "Only the same length"},
                {"key": "D", "text": "Only the same rhyme"},
            ],
            "A",
        )

    if "letter writing" in chapter_l:
        return (
            "A formal letter usually begins with: ",
            [
                {"key": "A", "text": "Sender's address and date"},
                {"key": "B", "text": "A poem title"},
                {"key": "C", "text": "A table of contents"},
                {"key": "D", "text": "An index number"},
            ],
            "A",
        )

    if "the fun they had" in chapter_l:
        return (
            "The lesson contrasts traditional school with: ",
            [
                {"key": "A", "text": "Future computer-based schooling"},
                {"key": "B", "text": "Outdoor sports coaching"},
                {"key": "C", "text": "Home science labs"},
                {"key": "D", "text": "Music classes only"},
            ],
            "A",
        )

    if "if i were you" in chapter_l:
        return (
            "The play mainly shows how the protagonist survives by: ",
            [
                {"key": "A", "text": "Bluffing the intruder"},
                {"key": "B", "text": "Calling the police immediately"},
                {"key": "C", "text": "Running into the forest"},
                {"key": "D", "text": "Hiding without speaking"},
            ],
            "A",
        )

    if "the sound of music" in chapter_l:
        return (
            "Evelyn Glennie is known for becoming a great: ",
            [
                {"key": "A", "text": "Percussionist"},
                {"key": "B", "text": "Novelist"},
                {"key": "C", "text": "Painter"},
                {"key": "D", "text": "Astronaut"},
            ],
            "A",
        )

    if "the little girl" in chapter_l:
        return (
            "The chapter mainly explores the girl's: ",
            [
                {"key": "A", "text": "Fear and changing relationship with her father"},
                {"key": "B", "text": "Love for travel"},
                {"key": "C", "text": "Interest in cricket"},
                {"key": "D", "text": "Training as a doctor"},
            ],
            "A",
        )

    if "a truly beautiful mind" in chapter_l:
        return (
            "The chapter presents Einstein as someone driven by: ",
            [
                {"key": "A", "text": "Curiosity and imagination"},
                {"key": "B", "text": "Fear of mathematics"},
                {"key": "C", "text": "Competition in sports"},
                {"key": "D", "text": "Memorization only"},
            ],
            "A",
        )

    if "the snake and the mirror" in chapter_l:
        return (
            "The chapter is best remembered as a: ",
            [
                {"key": "A", "text": "Humorous personal anecdote"},
                {"key": "B", "text": "Historical essay"},
                {"key": "C", "text": "Science report"},
                {"key": "D", "text": "Poem about nature"},
            ],
            "A",
        )

    if "reach for the top" in chapter_l:
        return (
            "Santosh Yadav is celebrated for: ",
            [
                {"key": "A", "text": "Mountaineering and determination"},
                {"key": "B", "text": "Writing fiction"},
                {"key": "C", "text": "Playing chess"},
                {"key": "D", "text": "Inventing machines"},
            ],
            "A",
        )

    if any(marker in chapter_l for marker in ["poem", "wind", "rain on the roof", "road not taken", "lake isle", "no men are foreign", "on killing a tree", "slumber did my spirit seal"]):
        return (
            "A poem is usually studied first for its: ",
            [
                {"key": "A", "text": "Theme, imagery, and tone"},
                {"key": "B", "text": "Only chapter summary"},
                {"key": "C", "text": "Only footnotes"},
                {"key": "D", "text": "Only spelling list"},
            ],
            "A",
        )

    if "kathmandu" in chapter_l:
        return (
            "'Kathmandu' is best described as a: ",
            [
                {"key": "A", "text": "Travelogue"},
                {"key": "B", "text": "Lab report"},
                {"key": "C", "text": "Speech transcript"},
                {"key": "D", "text": "News bulletin"},
            ],
            "A",
        )

    if "my childhood" in chapter_l:
        return (
            "'My Childhood' is an example of: ",
            [
                {"key": "A", "text": "An autobiography"},
                {"key": "B", "text": "A fantasy story"},
                {"key": "C", "text": "A poem"},
                {"key": "D", "text": "A debate"},
            ],
            "A",
        )

    if "vocabulary in context" in chapter_l:
        return (
            "The meaning of a word in context is best found by: ",
            [
                {"key": "A", "text": "Reading the surrounding sentence"},
                {"key": "B", "text": "Ignoring the sentence"},
                {"key": "C", "text": "Counting the letters"},
                {"key": "D", "text": "Looking at the page color"},
            ],
            "A",
        )

    if "reading" in chapter_l or "comprehension" in chapter_l:
        return (
            "Skimming a passage helps you: ",
            [
                {"key": "A", "text": "Get the main idea quickly"},
                {"key": "B", "text": "Memorize every word perfectly"},
                {"key": "C", "text": "Avoid the passage entirely"},
                {"key": "D", "text": "Find only grammar errors"},
            ],
            "A",
        )

    if "vocabulary" in chapter_l:
        return (
            "A synonym of 'rapid' is: ",
            [
                {"key": "A", "text": "Fast"},
                {"key": "B", "text": "Slow"},
                {"key": "C", "text": "Lazy"},
                {"key": "D", "text": "Bright"},
            ],
            "A",
        )

    if "matter" in chapter_l:
        return (
            "Matter is best defined as: ",
            [
                {"key": "A", "text": "Anything that has mass and occupies space"},
                {"key": "B", "text": "Anything that gives light"},
                {"key": "C", "text": "Anything that moves on its own"},
                {"key": "D", "text": "Only solids around us"},
            ],
            "A",
        )

    # Generic chapter-concept diagnostic fallback.
    return (
        f"In chapter '{chapter}', what is the most important concept to understand first?",
        [
            {"key": "A", "text": "The chapter's core definition or rule"},
            {"key": "B", "text": "Only the hardest problems first"},
            {"key": "C", "text": "The chapter index page"},
            {"key": "D", "text": "The last exercise only"},
        ],
        "A",
    )


def _build_diagnostic_questions(class_num: str, subject: Optional[str]) -> tuple[list[dict], dict[str, str], dict[str, str]]:
    curriculum = load_curriculum_catalog()
    diagnostic_class = _resolve_lower_class(curriculum, class_num)
    subject_map = curriculum.get(diagnostic_class) or {}

    # For TN Board, if the resolved lower class isn't in TN catalog, use the TN class directly
    if not subject_map and "TN" in str(class_num):
        subject_map = curriculum.get(str(class_num)) or {}
        diagnostic_class = str(class_num)

    if diagnostic_class == "8":
        questions = [
            {
                "id": "q1",
                "chapter": "Science",
                "prompt": "Which of the following is a physical change?",
                "options": [
                    {"key": "A", "text": "Burning of paper"},
                    {"key": "B", "text": "Rusting of iron"},
                    {"key": "C", "text": "Melting of ice"},
                    {"key": "D", "text": "Digestion of food"}
                ]
            },
            {
                "id": "q2",
                "chapter": "Maths",
                "prompt": "A number is divisible by both 2 and 3. Which of the following could be the number?",
                "options": [
                    {"key": "A", "text": "45"},
                    {"key": "B", "text": "52"},
                    {"key": "C", "text": "78"},
                    {"key": "D", "text": "95"}
                ]
            },
            {
                "id": "q3",
                "chapter": "Civics",
                "prompt": "Why do people elect representatives in a democracy?",
                "options": [
                    {"key": "A", "text": "To avoid paying taxes"},
                    {"key": "B", "text": "To make laws and take decisions on behalf of citizens"},
                    {"key": "C", "text": "To control the media"},
                    {"key": "D", "text": "To own public property"}
                ]
            },
            {
                "id": "q4",
                "chapter": "English",
                "prompt": "Choose the sentence with the correct punctuation.",
                "options": [
                    {"key": "A", "text": "What a beautiful day."},
                    {"key": "B", "text": "What a beautiful day?"},
                    {"key": "C", "text": "What a beautiful day!"},
                    {"key": "D", "text": "What a beautiful day,"}
                ]
            },
            {
                "id": "q5",
                "chapter": "Maths",
                "prompt": "If all squares are rectangles, which statement is definitely true?",
                "options": [
                    {"key": "A", "text": "All rectangles are squares."},
                    {"key": "B", "text": "Some rectangles are squares."},
                    {"key": "C", "text": "No rectangle is a square."},
                    {"key": "D", "text": "Squares and rectangles are unrelated."}
                ]
            }
        ]
        answer_key = {"q1": "C", "q2": "C", "q3": "B", "q4": "C", "q5": "B"}
        meta = {"diagnostic_class": "8", "diagnostic_subject": "Mixed"}
        return questions, answer_key, meta


    requested_subject = (subject or "").strip().lower()
    mixed_mode = requested_subject in {"", "mixed", "random", "stem"}

    if mixed_mode and subject_map:
        preferred = ["Science", "Maths", "Mathematics", "Physics", "Chemistry", "Biology"]
        available_lookup = {name.lower(): name for name in subject_map.keys()}
        selected_subjects: list[str] = []
        for item in preferred:
            match = available_lookup.get(item.lower())
            if match and match not in selected_subjects:
                selected_subjects.append(match)
        if not selected_subjects:
            selected_subjects = list(subject_map.keys())[:2] or ["Science"]

        chapter_pairs: list[tuple[str, str]] = []
        for subject_name in selected_subjects:
            chapters = [str(ch).strip() for ch in subject_map.get(subject_name, []) if str(ch).strip()]
            if not chapters:
                chapters = _fallback_lower_grade_chapters(diagnostic_class, subject_name)
            random.shuffle(chapters)
            for chapter in chapters[:3]:
                chapter_pairs.append((subject_name, chapter))

        random.shuffle(chapter_pairs)
        base_pairs = chapter_pairs[:5]
        while len(base_pairs) < 5 and chapter_pairs:
            base_pairs.append(chapter_pairs[len(base_pairs) % len(chapter_pairs)])

        answer_key: dict[str, str] = {}
        questions: list[dict] = []
        for idx, (subject_name, chapter) in enumerate(base_pairs, start=1):
            qid = f"q{idx}"
            prompt, option_seed, correct = _chapter_diagnostic_item(chapter, subject_name, idx)
            answer_key[qid] = correct
            rotation = (idx - 1) % 4
            ordered_options = option_seed[rotation:] + option_seed[:rotation]
            questions.append(
                {
                    "id": qid,
                    "chapter": f"{subject_name} • {chapter}",
                    "prompt": f"Class {diagnostic_class} {subject_name}: {prompt}",
                    "options": ordered_options,
                }
            )

        return questions, answer_key, {
            "diagnostic_class": diagnostic_class,
            "diagnostic_subject": "Mixed STEM",
        }

    diagnostic_subject = _normalize_diagnostic_subject(subject, subject_map)

    chapters = [str(ch).strip() for ch in subject_map.get(diagnostic_subject, []) if str(ch).strip()]
    if not chapters:
        chapters = _fallback_lower_grade_chapters(diagnostic_class, diagnostic_subject)

    chapter_pool = list(dict.fromkeys(chapters))
    random.shuffle(chapter_pool)
    base = chapter_pool[:5]
    while len(base) < 5:
        base.append(chapter_pool[len(base) % len(chapter_pool)])

    answer_key: dict[str, str] = {}
    questions: list[dict] = []
    for idx, chapter in enumerate(base, start=1):
        qid = f"q{idx}"
        prompt, option_seed, correct = _chapter_diagnostic_item(chapter, diagnostic_subject, idx)
        answer_key[qid] = correct
        # Rotate display order so answer position is not constant.
        rotation = (idx - 1) % 4
        ordered_options = option_seed[rotation:] + option_seed[:rotation]

        prompt = f"Class {diagnostic_class} {diagnostic_subject}: {prompt}"

        questions.append(
            {
                "id": qid,
                "chapter": chapter,
                "prompt": prompt,
                "options": ordered_options,
            }
        )

    meta = {
        "diagnostic_class": diagnostic_class,
        "diagnostic_subject": diagnostic_subject,
    }
    return questions, answer_key, meta


def _extract_token(authorization: Optional[str]) -> str:
    if not authorization:
        return ""
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return authorization.strip()


def _auth_username(authorization: Optional[str]) -> str:
    token = _extract_token(authorization)
    username = get_username_by_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        from utils.context import board_var, language_var
        profile = get_user_profile(username) or {}
        board_var.set(profile.get("exam_board") or "CBSE")
        language_var.set(profile.get("preferred_language") or "English")
    except Exception:
        pass
    return username


def _normalize_parent_email(value: Optional[str]) -> Optional[str]:
    """Validate and normalize parent email. Returns None if not provided."""
    email = (value or "").strip().lower()
    if not email:
        return None  # Parent email is optional
    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        raise HTTPException(status_code=422, detail="Parent email is invalid")
    return email


@router.post("/register")
async def register(request: RegisterRequest):
    profile_data = request.profile.model_dump(by_alias=False)
    parent_email = _normalize_parent_email(request.profile.parentEmail)
    subscription_tier = _resolve_subscription_tier(request.profile.name.strip(), request.profile.subscriptionTier)
    profile_data["parentEmail"] = parent_email or ""
    profile_data["class"] = request.profile.class_num
    profile_data["subjects_json"] = json.dumps(request.profile.subjects or [])
    profile_data["subscriptionTier"] = subscription_tier

    ok = create_user(request.profile.name.strip(), request.password, profile_data)
    if not ok:
        raise HTTPException(status_code=409, detail="User already exists. Please login.")

    username = request.profile.name.strip()
    token = create_session(username)
    # Create parent login credentials only when parent email is provided.
    if parent_email:
        parent_password = secrets.token_urlsafe(9)
        try:
            upsert_parent_account(username, parent_email, parent_password)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        try:
            send_parent_welcome_credentials_email(username, parent_email, parent_password)
        except Exception as e:
            print(f"Swallowed parent credentials email error: {e}")

    return {
        "token": token,
        "user": {
            "name": username,
            "class": request.profile.class_num,
            "subjects": request.profile.subjects,
            "subscriptionTier": subscription_tier,
            "subscriptionStatus": "inactive",
            "trialStart": None,
            "trialEnd": None,
            "subscriptionEnd": None,
            "school": request.profile.school,
            "learningStyle": request.profile.learningStyle,
            "goal": request.profile.goal,
            "studyHours": request.profile.studyHours,
            "focusAreas": request.profile.focusAreas,
            "examBoard": request.profile.examBoard,
            "preferredLanguage": request.profile.preferredLanguage,
            "preferredPace": request.profile.preferredPace,
            "confidenceLevel": request.profile.confidenceLevel,
            "revisionFrequency": request.profile.revisionFrequency,
            "parentEmail": parent_email,
            "teacherPersonality": request.profile.teacherPersonality,
            "focusChapters": request.profile.focusChapters or {},
            "country": request.profile.country or "India",
            "state": request.profile.state or "Delhi",
            "city": request.profile.city or "New Delhi",
            "points": 0,
        },
    }


@router.post("/login")
async def login(request: LoginRequest):
    username = request.name.strip()
    if not verify_user(username, request.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    row = get_user_profile(username)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    subjects = []
    try:
        subjects = json.loads(row.get("subjects_json") or "[]")
    except Exception:
        subjects = []

    token = create_session(username)
    return {
        "token": token,
        "user": {
            "name": username,
            "class": row.get("class_num") or 10,
            "subjects": subjects,
            "subscriptionTier": row.get("subscription_tier") or "pro",
            "subscriptionStatus": row.get("subscription_status") or "inactive",
            "trialStart": row.get("trial_start"),
            "trialEnd": row.get("trial_end"),
            "subscriptionEnd": row.get("subscription_end"),
            "school": row.get("school"),
            "learningStyle": row.get("learning_style"),
            "goal": row.get("goal"),
            "studyHours": row.get("study_hours"),
            "focusAreas": row.get("focus_areas"),
            "examBoard": row.get("exam_board"),
            "preferredLanguage": row.get("preferred_language"),
            "preferredPace": row.get("preferred_pace"),
            "confidenceLevel": row.get("confidence_level"),
            "revisionFrequency": row.get("revision_frequency"),
            "parentEmail": row.get("parent_email"),
            "teacherPersonality": row.get("teacher_personality"),
            "focusChapters": json.loads(row.get("focus_chapters_json") or "{}"),
            "country": row.get("country") or "India",
            "state": row.get("state") or "Delhi",
            "city": row.get("city") or "New Delhi",
            "points": row.get("points") or 0,
        },
    }


@router.get("/me")
async def me(authorization: Optional[str] = Header(default=None)):
    username = _auth_username(authorization)
    update_streak(username)
    row = get_user_profile(username)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        subjects = json.loads(row.get("subjects_json") or "[]")
    except Exception:
        subjects = []

    return {
        "name": username,
        "class": row.get("class_num") or 10,
        "subjects": subjects,
        "subscriptionTier": row.get("subscription_tier") or "pro",
        "subscriptionStatus": row.get("subscription_status") or "inactive",
        "trialStart": row.get("trial_start"),
        "trialEnd": row.get("trial_end"),
        "subscriptionEnd": row.get("subscription_end"),
        "school": row.get("school"),
        "learningStyle": row.get("learning_style"),
        "goal": row.get("goal"),
        "studyHours": row.get("study_hours"),
        "focusAreas": row.get("focus_areas"),
        "examBoard": row.get("exam_board"),
        "preferredLanguage": row.get("preferred_language"),
        "preferredPace": row.get("preferred_pace"),
        "confidenceLevel": row.get("confidence_level"),
        "revisionFrequency": row.get("revision_frequency"),
        "parentEmail": row.get("parent_email"),
        "teacherPersonality": row.get("teacher_personality"),
        "focusChapters": json.loads(row.get("focus_chapters_json") or "{}"),
        "country": row.get("country") or "India",
        "state": row.get("state") or "Delhi",
        "city": row.get("city") or "New Delhi",
        "points": row.get("points") or 0,
        "streakCount": row.get("streak_count") or 0,
    }


@router.put("/me")
async def update_me(profile: AuthProfile, authorization: Optional[str] = Header(default=None)):
    username = _auth_username(authorization)
    profile_data = profile.model_dump(by_alias=False)
    parent_email = _normalize_parent_email(profile.parentEmail)
    profile_data["subscriptionTier"] = _resolve_subscription_tier(username, profile.subscriptionTier)
    profile_data["parentEmail"] = parent_email
    profile_data["class"] = profile.class_num
    profile_data["subjects_json"] = json.dumps(profile.subjects or [])
    if profile.teacherPersonality is not None:
        profile_data["teacher_personality"] = profile.teacherPersonality

    # Keep username immutable in this iteration.
    update_user_profile(username, profile_data)

    existing_parent = get_parent_account_by_student(username)
    if parent_email and (not existing_parent or str(existing_parent.get("parent_email") or "").lower() != parent_email):
        parent_password = secrets.token_urlsafe(9)
        try:
            upsert_parent_account(username, parent_email, parent_password)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        try:
            send_parent_welcome_credentials_email(username, parent_email, parent_password)
        except Exception as e:
            print(f"Swallowed parent credentials email error: {e}")

    return {"status": "ok"}


@router.get("/billing/config")
async def billing_config():
    secret_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    price_pro = os.getenv("STRIPE_PRICE_ID_PRO", "").strip()
    price_pro_max = os.getenv("STRIPE_PRICE_ID_PRO_MAX", "").strip()
    
    paypal_client_id = os.getenv("PAYPAL_CLIENT_ID", "").strip()
    paypal_plan_pro = os.getenv("PAYPAL_PLAN_ID_PRO", "").strip()
    paypal_plan_pro_max = os.getenv("PAYPAL_PLAN_ID_PRO_MAX", "").strip()
    
    base_url = os.getenv("CLARITY_APP_BASE_URL", "").strip()

    if paypal_client_id and paypal_plan_pro and paypal_plan_pro_max:
        provider = "paypal"
        enabled = bool(base_url)
    else:
        provider = "stripe"
        enabled = bool(secret_key and price_pro and price_pro_max and base_url)

    return {
        "provider": provider,
        "enabled": enabled,
        "currency": os.getenv("STRIPE_CURRENCY", "AED").strip().upper() or "AED",
        "base_url": base_url,
        "plans": _billing_public_config(),
    }


@router.post("/billing/checkout")
async def billing_checkout(request: BillingCheckoutRequest, authorization: Optional[str] = Header(default=None)):
    username = _auth_username(authorization)
    base_url = os.getenv("CLARITY_APP_BASE_URL", "").strip().rstrip("/")
    success_url = f"{base_url}/settings?checkout=success&plan={request.plan}"
    cancel_url = f"{base_url}/settings?checkout=cancelled"

    # 1. Check if PayPal is configured
    paypal_client_id = os.getenv("PAYPAL_CLIENT_ID", "").strip()
    paypal_plan_pro = os.getenv("PAYPAL_PLAN_ID_PRO", "").strip()
    paypal_plan_pro_max = os.getenv("PAYPAL_PLAN_ID_PRO_MAX", "").strip()

    if paypal_client_id and paypal_plan_pro and paypal_plan_pro_max:
        from services.paypal import create_paypal_subscription
        sub_data = await create_paypal_subscription(username, request.plan, success_url, cancel_url)
        if not sub_data or not sub_data.get("approve_url"):
            raise HTTPException(status_code=502, detail="PayPal subscription could not be created right now.")

        return {
            "checkout_url": sub_data["approve_url"],
            "session_id": sub_data["subscription_id"],
            "plan": request.plan,
            "provider": "paypal",
        }

    # 2. Fall back to Stripe
    secret_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    price_env_name = _billing_price_env_name(request.plan)
    price_id = os.getenv(price_env_name, "").strip()

    if not secret_key or not base_url or not price_id:
        raise HTTPException(
            status_code=503,
            detail="Billing is not configured yet. Add Stripe or PayPal keys to enable subscriptions.",
        )

    payload = {
        "mode": "subscription",
        "success_url": success_url,
        "cancel_url": cancel_url,
        "client_reference_id": username,
        "line_items[0][price]": price_id,
        "line_items[0][quantity]": 1,
        "metadata[username]": username,
        "metadata[plan]": request.plan,
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            "https://api.stripe.com/v1/checkout/sessions",
            data=payload,
            headers={"Authorization": f"Bearer {secret_key}"},
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Stripe checkout could not be created right now.")

    data = response.json()
    checkout_url = data.get("url")
    if not checkout_url:
        raise HTTPException(status_code=502, detail="Stripe did not return a checkout URL.")

    return {
        "checkout_url": checkout_url,
        "session_id": data.get("id"),
        "plan": request.plan,
        "provider": "stripe",
    }


@router.post("/billing/start-trial")
async def billing_start_trial(request: BillingCheckoutRequest, authorization: Optional[str] = Header(default=None)):
    username = _auth_username(authorization)
    plan = _normalize_subscription_tier(request.plan)
    if plan not in {"pro", "pro_max"}:
        raise HTTPException(status_code=400, detail="Invalid plan selected.")

    from datetime import datetime, timedelta
    now = datetime.utcnow()
    duration_days = 7 if plan == "pro" else 3
    trial_start_iso = now.isoformat()
    trial_end_iso = (now + timedelta(days=duration_days)).isoformat()

    set_user_subscription(
        username=username,
        tier=plan,
        status="trialing",
        trial_start=trial_start_iso,
        trial_end=trial_end_iso,
        subscription_end=trial_end_iso
    )

    return {
        "status": "ok",
        "message": f"Free trial of {plan} started successfully.",
        "subscriptionTier": plan,
        "subscriptionStatus": "trialing",
        "trialStart": trial_start_iso,
        "trialEnd": trial_end_iso,
        "subscriptionEnd": trial_end_iso
    }


@router.post("/billing/webhook")
async def billing_webhook(request: Request):
    secret = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail="Stripe webhook secret is not configured.")

    payload = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    if not _verify_stripe_signature(payload, signature, secret):
        raise HTTPException(status_code=400, detail="Invalid Stripe webhook signature.")

    event = json.loads(payload.decode("utf-8"))
    event_type = str(event.get("type") or "")
    data_object = event.get("data", {}).get("object", {}) or {}
    metadata = data_object.get("metadata", {}) or {}
    username = str(metadata.get("username") or data_object.get("client_reference_id") or "").strip()
    plan = _normalize_subscription_tier(metadata.get("plan"))

    if event_type in {"checkout.session.completed", "customer.subscription.updated", "invoice.paid"} and username and plan in {"pro", "pro_max"}:
        set_user_subscription_tier(username, plan)
    elif event_type in {"customer.subscription.deleted", "invoice.payment_failed"} and username:
        set_user_subscription_tier(username, "free")

    return {"received": True}


@router.post("/billing/paypal-webhook")
async def billing_paypal_webhook(request: Request):
    webhook_id = os.getenv("PAYPAL_WEBHOOK_ID", "").strip()
    if not webhook_id:
        raise HTTPException(status_code=503, detail="PayPal webhook ID is not configured.")

    payload = await request.body()
    headers = request.headers

    from services.paypal import verify_paypal_webhook_signature
    if not await verify_paypal_webhook_signature(headers, payload, webhook_id):
        raise HTTPException(status_code=400, detail="Invalid PayPal webhook signature.")

    event = json.loads(payload.decode("utf-8"))
    event_type = str(event.get("event_type") or "")
    resource = event.get("resource", {}) or {}

    username = str(resource.get("custom_id") or "").strip()

    plan_id = resource.get("plan_id")
    pro_plan_id = os.getenv("PAYPAL_PLAN_ID_PRO", "").strip()
    pro_max_plan_id = os.getenv("PAYPAL_PLAN_ID_PRO_MAX", "").strip()

    plan = "free"
    if plan_id == pro_plan_id:
        plan = "pro"
    elif plan_id == pro_max_plan_id:
        plan = "pro_max"

    if event_type in {"BILLING.SUBSCRIPTION.CREATED", "BILLING.SUBSCRIPTION.ACTIVATED", "PAYMENT.SALE.COMPLETED"} and username and plan in {"pro", "pro_max"}:
        set_user_subscription_tier(username, plan)
    elif event_type in {"BILLING.SUBSCRIPTION.CANCELLED", "BILLING.SUBSCRIPTION.EXPIRED", "BILLING.SUBSCRIPTION.SUSPENDED"} and username:
        set_user_subscription_tier(username, "free")

    return {"received": True}


@router.post("/logout")
async def logout(authorization: Optional[str] = Header(default=None)):
    token = _extract_token(authorization)
    if token:
        delete_session(token)
    return {"status": "ok"}


@router.post("/parent/login")
async def parent_login(request: ParentLoginRequest):
    email = (request.email or "").strip().lower()
    if not email or not request.password:
        raise HTTPException(status_code=422, detail="Email and password are required")

    account = get_parent_account_by_email(email)
    if not account:
        raise HTTPException(status_code=404, detail="No parent account found for this email. Use the exact email from the Clarity welcome message.")

    student_username = verify_parent_user(email, request.password)
    if not student_username:
        raise HTTPException(status_code=401, detail="Incorrect parent password for this email.")

    token = create_parent_session(email, student_username)
    
    # Query all students linked to this parent email
    from services.database import _connect
    with _connect() as conn:
        rows = conn.execute("SELECT student_username FROM parent_accounts WHERE parent_email = ?", (email,)).fetchall()
        students = [str(r["student_username"]) for r in rows]

    return {
        "token": token,
        "parent": {
            "email": email,
            "student": student_username,
            "students": students,
        },
    }


@router.post("/parent/logout")
async def parent_logout(authorization: Optional[str] = Header(default=None)):
    token = _extract_token(authorization)
    if token:
        delete_parent_session(token)
    return {"status": "ok"}


class ParentSwitchStudentRequest(BaseModel):
    student_username: str


@router.post("/parent/switch-student")
async def parent_switch_student(
    request: ParentSwitchStudentRequest,
    authorization: Optional[str] = Header(default=None)
):
    token = _extract_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Session token is missing")
        
    from services.database import get_parent_session, switch_parent_session_student
    session = get_parent_session(token)
    if not session:
        raise HTTPException(status_code=401, detail="Unauthorized parent session")
        
    parent_email = session["parent_email"]
    student_username = request.student_username.strip()
    
    # Check if this student is indeed associated with this parent email
    from services.database import _connect
    with _connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM parent_accounts WHERE parent_email = ? AND student_username = ?",
            (parent_email, student_username)
        ).fetchone()
        
    if not row:
        raise HTTPException(status_code=403, detail="Selected student is not associated with this parent account")
        
    switch_parent_session_student(token, student_username)
    return {"status": "success", "active_student": student_username}


@router.post("/parent/resend-credentials")
async def resend_parent_credentials(authorization: Optional[str] = Header(default=None)):
    username = _auth_username(authorization)
    profile = get_user_profile(username) or {}
    parent_email = str(profile.get("parent_email") or "").strip().lower()
    if not parent_email:
        raise HTTPException(status_code=422, detail="Parent email is missing in profile")

    account = get_parent_account_by_student(username)
    if not account:
        raise HTTPException(status_code=404, detail="No parent account exists yet for this student")

    new_password = secrets.token_urlsafe(9)
    reset_parent_credentials(username, new_password)
    email_status = "sent"
    try:
        send_parent_welcome_credentials_email(username, parent_email, new_password)
    except Exception as e:
        print(f"Parent credentials email sending failed: {e}")
        email_status = "failed_delivery"

    return {
        "status": email_status,
        "message": f"New parent credentials generated. Email sending status: {email_status}.",
        "parent_email": parent_email,
    }


@router.get("/curriculum")
async def get_curriculum():
    """Return NCERT curriculum catalog by class and subject.
    All users can access this without auth."""
    return {"catalog": load_curriculum_catalog()}


@router.post("/materials")
async def save_material(item: StudyMaterialRequest, authorization: Optional[str] = Header(default=None)):
    username = _auth_username(authorization)
    upsert_study_material(username, item.model_dump())
    return {"status": "ok"}


@router.get("/materials")
async def list_materials(authorization: Optional[str] = Header(default=None)):
    username = _auth_username(authorization)
    return {"materials": get_study_materials(username)}


@router.post("/snapshot")
async def sync_snapshot(request: SnapshotRequest, authorization: Optional[str] = Header(default=None)):
    username = _auth_username(authorization)
    payload_json = json.dumps(request.payload)
    save_user_snapshot(username, payload_json)
    return {"status": "ok"}


@router.get("/diagnostic/questions")
async def get_diagnostic_questions(class_num: str, subject: Optional[str] = None):
    questions, _, meta = _build_diagnostic_questions(class_num, subject)
    return {
        "diagnostic_class": meta["diagnostic_class"],
        "diagnostic_subject": meta["diagnostic_subject"],
        "questions": questions,
    }


@router.post("/diagnostic")
async def submit_diagnostic(request: DiagnosticRequest, authorization: Optional[str] = Header(default=None)):
    username = _auth_username(authorization)
    questions, answer_key, meta = _build_diagnostic_questions(request.class_num, request.subject)

    score = 0
    subject_scores: dict[str, int] = {}
    for item in request.answers:
        correct = str(answer_key.get(item.question_id, "")).strip().upper()
        selected = str(item.selected_option or "").strip().upper()
        if not correct:
            continue
        if selected == correct:
            score += 1

    total_score = int(round((score / max(1, len(answer_key))) * 100))
    subject = meta["diagnostic_subject"]
    subject_scores[subject] = total_score

    payload = request.model_dump()
    payload["diagnostic_class"] = meta["diagnostic_class"]
    payload["diagnostic_subject"] = subject
    payload["questions"] = questions

    save_diagnostic_assessment(
        username=username,
        payload_json=json.dumps(payload),
        subject_scores_json=json.dumps(subject_scores),
        total_score=total_score,
    )
    return {
        "total_score": total_score,
        "diagnostic_class": meta["diagnostic_class"],
        "diagnostic_subject": subject,
        "subject_scores": subject_scores,
        "strengths": ["Concept recall"] if total_score >= 60 else [],
        "weaknesses": ["Foundation gaps"] if total_score < 60 else [],
        "recommended_start": "practice" if total_score < 70 else "library",
    }


@router.get("/snapshot")
async def fetch_snapshot(authorization: Optional[str] = Header(default=None)):
    username = _auth_username(authorization)
    snapshot_json = get_user_snapshot(username)
    if not snapshot_json:
        return {"payload": {}}
    try:
        return {"payload": json.loads(snapshot_json)}
    except Exception:
        return {"payload": {}}
