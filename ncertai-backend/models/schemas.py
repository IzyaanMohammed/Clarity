from pydantic import BaseModel, Field
from typing import List, Optional, Dict

class QARequest(BaseModel):
    class_num: str
    subject: str
    chapter: str
    question: str
    conversation_history: Optional[List[Dict[str, str]]] = []

class QAResponse(BaseModel):
    answer: str
    tokens_used: int = 0

class PracticeRequest(BaseModel):
    class_num: str
    subject: str
    chapter: str
    question_type: str  # "1-mark"/"3-mark"/"5-mark"/"mixed"
    num_questions: int = 5

class PracticeResponse(BaseModel):
    questions: List[str]

class GradeRequest(BaseModel):
    question: str
    user_answer: str
    class_num: str
    subject: str
    marks_available: int

class GradeResponse(BaseModel):
    marks_awarded: int
    total_marks: int
    feedback: str
    model_answer: str

class UploadResponse(BaseModel):
    analysis: str
    extracted_text: str
