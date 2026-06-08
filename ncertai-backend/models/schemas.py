from pydantic import BaseModel, Field
from typing import List, Optional, Dict

class QARequest(BaseModel):
    class_num: str
    subject: str
    chapter: str
    question: str
    conversation_history: Optional[List[Dict[str, str]]] = []
    learner_profile: Optional[Dict[str, str]] = None
    teacher_personality: Optional[str] = "Kind"

class QAResponse(BaseModel):
    answer: str
    tokens_used: int = 0

class PracticeRequest(BaseModel):
    class_num: str
    subject: str
    chapter: str
    question_type: str  # "1-mark"/"3-mark"/"5-mark"/"mixed"
    num_questions: int = 5
    teacher_personality: Optional[str] = "Kind"
    stick_to_textbook: Optional[bool] = False

class PracticeResponse(BaseModel):
    questions: List[str]

class GradeRequest(BaseModel):
    question: str
    user_answer: str
    class_num: str
    subject: str
    marks_available: int
    teacher_personality: Optional[str] = "Kind"

class GradeResponse(BaseModel):
    marks_awarded: int
    total_marks: int
    feedback: str
    model_answer: str
    micro_explanation: Optional[str] = None
    related_question: Optional[str] = None
    flashcard_due: Optional[str] = None
    weak_skill: Optional[str] = None


class ChapterReadinessResponse(BaseModel):
    chapter: str
    readiness_score: int
    accuracy: int
    recency: int
    speed: int
    confidence: int
    priority: str


class ResourceStackResponse(BaseModel):
    chapter: str
    subject: str
    textbook_section: str
    explanation: str
    worksheet: dict
    test: dict


class StudyNotificationItem(BaseModel):
    title: str
    message: str
    severity: str
    action: str


class StudyNotificationResponse(BaseModel):
    notifications: List[StudyNotificationItem]


class MockScheduleResponse(BaseModel):
    next_mock_date: str
    difficulty: str
    readiness_score: int
    weak_skills: List[str]
    recovery_plan: List[str]

class UploadResponse(BaseModel):
    analysis: str
    extracted_text: str


class SummaryRequest(BaseModel):
    class_num: str
    subject: str
    chapter: str
    detail_level: str = "standard"  # short | standard | deep
    max_points: int = 6
    learner_profile: Optional[Dict[str, str]] = None
    teacher_personality: Optional[str] = "Kind"


class SummaryResponse(BaseModel):
    summary: str


class FormulaSheetRequest(BaseModel):
    class_num: str
    subject: str
    chapter: str
    formula_count: int = 12
    include_examples: bool = True
    learner_profile: Optional[Dict[str, str]] = None
    teacher_personality: Optional[str] = "Kind"


class FormulaSheetResponse(BaseModel):
    sheet: str


class FlashcardRequest(BaseModel):
    class_num: str
    subject: str
    chapter: str
    count: int = 8


class FlashcardItem(BaseModel):
    question: str
    answer: str


class FlashcardResponse(BaseModel):
    flashcards: List[FlashcardItem]


class DailyPlanRequest(BaseModel):
    class_num: str
    subjects: List[str]
    weak_topics: List[str] = []
    exam_date: Optional[str] = None
    task_count: int = 7
    plan_depth: str = "balanced"  # lite | balanced | intensive
    learner_profile: Optional[Dict[str, str]] = None
    teacher_personality: Optional[str] = "Kind"


class DailyPlanResponse(BaseModel):
    plan: str


class DiagnosticAnswerItem(BaseModel):
    question_id: str
    selected_option: str


class DiagnosticRequest(BaseModel):
    class_num: str
    subject: Optional[str] = None
    answers: List[DiagnosticAnswerItem]


class DiagnosticResponse(BaseModel):
    total_score: int
    subject_scores: Dict[str, int]
    strengths: List[str]
    weaknesses: List[str]
    recommended_start: str


class VideoStoryboardRequest(BaseModel):
    class_num: str
    subject: str
    chapter: str
    topic: Optional[str] = None
    source_url: Optional[str] = None
    duration_seconds: int = 90
    style: str = "concept-first"
    broll_mode: str = "balanced"  # minimal | balanced | aggressive
    montage_level: str = "single"  # single | light | dynamic
    min_external_segments: int = 1


class MindmapRequest(BaseModel):
    class_num: str
    subject: str
    chapter: str
    topic: str
    depth: str = "balanced"  # lite | balanced | deep
    image_style: str = "clean educational diagram"


class VideoRenderPackageRequest(BaseModel):
    class_num: str
    subject: str
    chapter: str
    topic: Optional[str] = None
    source_url: Optional[str] = None
    duration_seconds: int = 90
    style: str = "concept-first"
    broll_mode: str = "balanced"  # minimal | balanced | aggressive
    montage_level: str = "single"  # single | light | dynamic
    min_external_segments: int = 1
