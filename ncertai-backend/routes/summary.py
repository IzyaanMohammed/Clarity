from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from models.schemas import (
    SummaryRequest,
    SummaryResponse,
    FormulaSheetRequest,
    FormulaSheetResponse,
    DailyPlanRequest,
    DailyPlanResponse,
)
from services.openrouter import ask_openrouter, ask_openrouter_stream
from services.ncert_retriever import get_ncert_context
from utils.rate_limiter import check_rate_limit, increment_usage
import logging
import json

router = APIRouter()
logger = logging.getLogger(__name__)


def _require_non_empty(text: str, field_name: str):
    if not str(text or "").strip():
        raise HTTPException(status_code=422, detail=f"Please specify mandatory field: {field_name}")


def _fallback_summary(request: SummaryRequest) -> str:
    chapter = request.chapter
    subject = request.subject
    return (
        "## Core Ideas\n"
        "| Idea | Why It Matters | Memory Hook |\n"
        "|---|---|---|\n"
        f"| Main concept of {chapter} | Helps build foundation for board answers | Define -> Explain -> Apply |\n"
        f"| NCERT key terms in {subject} | Improves accuracy and examiner confidence | Use textbook wording |\n"
        f"| Typical exam pattern | Increases scoring consistency | Intro + points + conclusion |\n"
        f"| Common student confusion | Reduces avoidable mistakes | Check formula/definition before writing |\n\n"
        "## Key Terms\n"
        "| Term | Meaning | Where Used |\n"
        "|---|---|---|\n"
        f"| Core term 1 ({chapter}) | Central idea from the chapter | Long-answer and competency questions |\n"
        f"| Core term 2 ({chapter}) | Supporting concept | Short and 3-mark answers |\n"
        "| NCERT keyword | Exact textbook terminology | Definitions and board writing |\n\n"
        "## Board Focus\n"
        "| Likely Question Type | What Examiner Expects | Answer Starter |\n"
        "|---|---|---|\n"
        "| 1-mark definition | Precise textbook phrase | 'It is defined as...' |\n"
        "| 3-mark explanation | Three structured points | 'The key points are...' |\n"
        "| 5-mark long answer | Concept + logic + example | 'This can be explained as follows...' |\n\n"
        "## Quick Recall\n"
        "- [ ] I can state the main definition in one line\n"
        "- [ ] I can explain one core idea with an example\n"
        "- [ ] I can write three key points in order\n"
        "- [ ] I can avoid one common mistake\n"
        "- [ ] I can attempt one board-style question\n\n"
        "## Exam Tip\n"
        "Start answers with NCERT keywords, then add one clear example for higher marks."
    )


def _fallback_formula_sheet(request: FormulaSheetRequest) -> str:
    chapter = request.chapter
    return (
        "## Formulas\n"
        "| Formula | Meaning | Unit | Typical Question Use |\n"
        "|---|---|---|---|\n"
        f"| Key formula from {chapter} | Defines relation between core variables | As per NCERT context | Direct numerical and derivation basics |\n"
        "| Rearranged form | Useful for solving unknown terms | Same as base quantity | Multi-step board numericals |\n\n"
        "## Definitions\n"
        "| Term | Definition | Chapter Context |\n"
        "|---|---|---|\n"
        f"| Core term | Standard NCERT-aligned meaning | {chapter} |\n"
        "| Related term | Supporting concept for answers | Theory and applications |\n\n"
        "## Units\n"
        "| Quantity | SI Unit | Conversion Note |\n"
        "|---|---|---|\n"
        "| Primary quantity | Standard SI unit | Write unit with every final answer |\n"
        "| Derived quantity | Derived SI unit | Convert before substitution |\n\n"
        "## Common Mistakes\n"
        "| Mistake | Why It Happens | Fix |\n"
        "|---|---|---|\n"
        "| Wrong substitution | Missing variable mapping | Write given values first |\n"
        "| Unit mismatch | Mixed unit system | Convert to SI before solving |\n"
        "| Sign/calculation slip | Rushed arithmetic | Recheck the final line |\n\n"
        "## Exam Tip\n"
        "Underline the final formula and box the final answer with units."
    )


def _fallback_daily_plan(request: DailyPlanRequest) -> str:
    subjects = request.subjects or ["General"]
    weak_topics = request.weak_topics or ["Revision"]

    def _task_row(task: str, duration: int, outcome: str, action: str) -> str:
        return f"| {task} | {duration} | {outcome} | [ ] {action} |"

    morning_rows = [
        _task_row(f"NCERT concept revision ({subjects[0]})", 45, "Core understanding refreshed", "Revise class notes + textbook examples"),
        _task_row(f"Weak topic drill: {weak_topics[0]}", 35, "One weak area improved", "Solve 6 targeted questions"),
    ]

    afternoon_rows = [
        _task_row(f"Practice set ({subjects[min(1, len(subjects)-1)]})", 50, "Accuracy and speed improved", "Attempt one mixed set under timer"),
        _task_row("Error log correction", 30, "Mistakes converted to rules", "Write fixes for each error type"),
    ]

    evening_rows = [
        _task_row("Mini test", 40, "Exam readiness checked", "Attempt one timed board-style test"),
        _task_row("Recall and recap", 25, "Memory consolidation", "Do active recall + 5 flashcards"),
    ]

    priority_rows = [
        f"| {weak_topics[0]} | Solve 10 stepwise NCERT-style questions | Today 8:00 PM |",
        "| Time management | Use 45-10 focus blocks with a timer | Today 9:00 PM |",
    ]

    return (
        "## Morning Sprint\n"
        "| Task | Duration (min) | Outcome | Action |\n"
        "|---|---:|---|---|\n"
        + "\n".join(morning_rows)
        + "\n\n## Afternoon Deep Work\n"
        "| Task | Duration (min) | Outcome | Action |\n"
        "|---|---:|---|---|\n"
        + "\n".join(afternoon_rows)
        + "\n\n## Evening Review\n"
        "| Task | Duration (min) | Outcome | Action |\n"
        "|---|---:|---|---|\n"
        + "\n".join(evening_rows)
        + "\n\n## Priority Fixes\n"
        "| Topic | Fix Action | Deadline |\n"
        "|---|---|---|\n"
        + "\n".join(priority_rows)
        + "\n\n## Exam Tip\n"
        "Start each session by solving 1 previous-year question before opening notes."
    )


def _profile_block(profile: dict | None) -> str:
    if not profile:
        return ""

    lines = [
        f"- {k}: {v}"
        for k, v in profile.items()
        if isinstance(v, str) and v.strip()
    ]
    if not lines:
        return ""
    return "\nLearner personalization profile:\n" + "\n".join(lines)


def _summary_prompt(request: SummaryRequest) -> str:
    detail_word_limit = {
        "short": 260,
        "standard": 450,
        "deep": 700,
    }.get(request.detail_level, 450)

    return (
        f"Create a concise, exam-ready chapter summary for Class {request.class_num} {request.subject}, "
        f"chapter '{request.chapter}'.\n\n"
        "Rules:\n"
        "- Output must be valid markdown\n"
        f"- Keep total length under {detail_word_limit} words\n"
        "- Use these exact sections in order:\n"
        f"  1) ## Core Ideas (markdown table with columns: Idea | Why It Matters | Memory Hook, 4-{max(4, request.max_points)} rows)\n"
        "  2) ## Key Terms (markdown table with columns: Term | Meaning | Where Used)\n"
        "  3) ## Board Focus (markdown table with columns: Likely Question Type | What Examiner Expects | Answer Starter)\n"
        "  4) ## Quick Recall (exactly 5 checkbox bullets using '- [ ] ...')\n"
        "- Keep language simple and direct for quick revision\n"
        "- End with: ## Exam Tip followed by one practical tip"
    )


def _formula_prompt(request: FormulaSheetRequest) -> str:
    example_rule = (
        "- Add one mini worked example below important formulas\n"
        if request.include_examples
        else "- Do not include worked examples\n"
    )

    return (
        f"Generate a formula and definition reference sheet for Class {request.class_num} {request.subject}, "
        f"chapter '{request.chapter}'.\n\n"
        "Rules:\n"
        "- Output must be valid markdown\n"
        "- Split into exact sections: ## Formulas, ## Definitions, ## Units, ## Common Mistakes\n"
        f"- Include around {max(4, request.formula_count)} high-value formulas/definitions in total\n"
        "- Include only NCERT-relevant items\n"
        "- Keep it compact and exam-oriented\n"
        "- Use markdown tables in each section\n"
        "- For formulas table use columns: Formula | Meaning | Unit | Typical Question Use\n"
        "- For definitions table use columns: Term | Definition | Chapter Context\n"
        "- For units table use columns: Quantity | SI Unit | Conversion Note\n"
        "- For mistakes table use columns: Mistake | Why It Happens | Fix\n"
        f"{example_rule}"
        "- End with: ## Exam Tip followed by one practical tip"
    )


def _plan_prompt(request: DailyPlanRequest) -> str:
    depth_guideline = {
        "lite": "Use shorter blocks and lower intensity.",
        "balanced": "Balance concepts, revision, and testing.",
        "intensive": "Use high-focus blocks and tighter deadlines.",
    }.get(request.plan_depth, "Balance concepts, revision, and testing.")

    weak_topics_text = ", ".join(request.weak_topics) if request.weak_topics else "None"
    subjects_text = ", ".join(request.subjects)

    custom_tasks_instruction = ""
    if request.task_types:
        types_str = ", ".join(request.task_types)
        custom_tasks_instruction += f"- Prioritize these categories/types of tasks: {types_str}\n"
    if request.custom_tasks:
        custom_tasks_instruction += f"- Include these specific tasks: {request.custom_tasks}\n"

    return (
        f"Create a practical one-day CBSE study plan for Class {request.class_num}.\n"
        f"Subjects: {subjects_text}\n"
        f"Weak topics: {weak_topics_text}\n"
        f"Exam date: {request.exam_date or 'Not provided'}\n"
        f"Plan depth: {request.plan_depth}\n\n"
        "Rules:\n"
        "- Output must be valid markdown\n"
        "- Use these exact sections: ## Morning Sprint, ## Afternoon Deep Work, ## Evening Review\n"
        "- In each section, use a markdown table with columns: Task | Duration (min) | Outcome | Action\n"
        "- Action column must use checkbox format like [ ] Revise notes\n"
        f"- Include {max(4, request.task_count)} tasks total, each with a realistic duration in minutes\n"
        "- Include at least one revision task and one test task\n"
        f"{custom_tasks_instruction}"
        "- Add a final section ## Priority Fixes with a markdown table: Topic | Fix Action | Deadline\n"
        f"- {depth_guideline}\n"
        "- Keep language simple, concrete, and motivating\n"
        "- End with: ## Exam Tip followed by one actionable tip"
    )


@router.post("/chapter-summary", response_model=SummaryResponse)
async def chapter_summary(request: SummaryRequest, x_user_id: str = Header(None)):
    _require_non_empty(request.class_num, "class_num")
    _require_non_empty(request.subject, "subject")
    _require_non_empty(request.chapter, "chapter")
    if x_user_id and not check_rate_limit(x_user_id, "summary"):
        raise HTTPException(
            status_code=429,
            detail="Weekly summary limit reached for free tier. Upgrade to Pro for unlimited summaries.",
        )

    prompt = _summary_prompt(request)

    messages = [
        {
            "role": "system",
            "content": (
                f"You are Clarity — the official CBSE AI Tutor for Class {request.class_num} {request.subject}. "
                f"Your primary knowledge base is the official NCERT textbook for chapter '{request.chapter}'. "
                f"STRICT RULES: Use exact NCERT terminology and pedagogical logic. Align all points with CBSE board marking schemes. "
                f"{get_ncert_context(request.class_num, request.subject, request.chapter) or ''} "
                f"Ensure every 'Core Idea' and 'Key Term' matches the textbook definition exactly. "
                f"{_profile_block(request.learner_profile)}"
                + (f"\nPersonality: {request.teacher_personality}" if request.teacher_personality else "")
            ),
        },
        {"role": "user", "content": prompt},
    ]

    logger.info(
        "Summary route -> class=%s subject=%s chapter=%s",
        request.class_num,
        request.subject,
        request.chapter,
    )

    try:
        summary = await ask_openrouter(messages, task_type="smart")
    except Exception as exc:
        logger.error("Chapter summary generation failed, using fallback: %s", str(exc))
        summary = _fallback_summary(request)

    if x_user_id:
        increment_usage(x_user_id, "summary")

    return SummaryResponse(summary=summary)


@router.post("/chapter-summary-stream")
async def chapter_summary_stream(request: SummaryRequest, x_user_id: str = Header(None)):
    _require_non_empty(request.class_num, "class_num")
    _require_non_empty(request.subject, "subject")
    _require_non_empty(request.chapter, "chapter")
    if x_user_id and not check_rate_limit(x_user_id, "summary"):
        raise HTTPException(
            status_code=429,
            detail="Weekly summary limit reached for free tier. Upgrade to Pro for unlimited summaries.",
        )

    prompt = _summary_prompt(request)
    messages = [
        {
            "role": "system",
            "content": (
                f"You are Clarity — the official CBSE AI Tutor for Class {request.class_num} {request.subject}. "
                f"Your primary knowledge base is the official NCERT textbook for chapter '{request.chapter}'. "
                f"STRICT RULES: Use exact NCERT terminology and pedagogical logic. Align all points with CBSE board marking schemes. "
                f"{get_ncert_context(request.class_num, request.subject, request.chapter) or ''} "
                f"{_profile_block(request.learner_profile)}"
                + (f"\nPersonality: {request.teacher_personality}" if request.teacher_personality else "")
            ),
        },
        {"role": "user", "content": prompt},
    ]

    async def event_generator():
        try:
            async for token in ask_openrouter_stream(messages, task_type="smart"):
                yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
        except Exception as exc:
            logger.error("Chapter summary stream failed, emitting fallback: %s", str(exc))
            fallback = _fallback_summary(request)
            for chunk in [fallback[i:i+280] for i in range(0, len(fallback), 280)]:
                yield f"data: {json.dumps({'token': chunk, 'done': False})}\n\n"
        if x_user_id:
            increment_usage(x_user_id, "summary")
        yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/formula-sheet", response_model=FormulaSheetResponse)
async def formula_sheet(request: FormulaSheetRequest, x_user_id: str = Header(None)):
    _require_non_empty(request.class_num, "class_num")
    _require_non_empty(request.subject, "subject")
    _require_non_empty(request.chapter, "chapter")
    if x_user_id and not check_rate_limit(x_user_id, "summary"):
        raise HTTPException(
            status_code=429,
            detail="Weekly summary limit reached for free tier. Upgrade to Pro for unlimited sheets.",
        )

    prompt = _formula_prompt(request)

    messages = [
        {
            "role": "system",
            "content": (
                f"You are Clarity — the official CBSE AI Tutor for Class {request.class_num} {request.subject}. "
                f"Produce an exam-ready formula/definition sheet strictly using NCERT definitions and symbols. "
                f"{get_ncert_context(request.class_num, request.subject, request.chapter) or ''} "
                f"{_profile_block(request.learner_profile)}"
                + (f"\nPersonality: {request.teacher_personality}" if request.teacher_personality else "")
            ),
        },
        {"role": "user", "content": prompt},
    ]

    logger.info(
        "Formula route -> class=%s subject=%s chapter=%s",
        request.class_num,
        request.subject,
        request.chapter,
    )

    try:
        sheet = await ask_openrouter(messages, task_type="smart")
    except Exception as exc:
        logger.error("Formula sheet generation failed, using fallback: %s", str(exc))
        sheet = _fallback_formula_sheet(request)

    if x_user_id:
        increment_usage(x_user_id, "summary")

    return FormulaSheetResponse(sheet=sheet)


@router.post("/formula-sheet-stream")
async def formula_sheet_stream(request: FormulaSheetRequest, x_user_id: str = Header(None)):
    _require_non_empty(request.class_num, "class_num")
    _require_non_empty(request.subject, "subject")
    _require_non_empty(request.chapter, "chapter")
    if x_user_id and not check_rate_limit(x_user_id, "summary"):
        raise HTTPException(
            status_code=429,
            detail="Weekly summary limit reached for free tier. Upgrade to Pro for unlimited sheets.",
        )

    prompt = _formula_prompt(request)
    messages = [
        {
            "role": "system",
            "content": (
                f"You are Clarity — the official CBSE AI Tutor for Class {request.class_num} {request.subject}. "
                "Produce an exam-ready formula/definition sheet strictly using NCERT definitions and symbols. "
                f"{_profile_block(request.learner_profile)}" + (f"\nPersonality: {request.teacher_personality}" if request.teacher_personality else "")
            ),
        },
        {"role": "user", "content": prompt},
    ]

    async def event_generator():
        try:
            async for token in ask_openrouter_stream(messages, task_type="smart"):
                yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
        except Exception as exc:
            logger.error("Formula sheet stream failed, emitting fallback: %s", str(exc))
            fallback = _fallback_formula_sheet(request)
            for chunk in [fallback[i:i+280] for i in range(0, len(fallback), 280)]:
                yield f"data: {json.dumps({'token': chunk, 'done': False})}\n\n"
        if x_user_id:
            increment_usage(x_user_id, "summary")
        yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/daily-plan", response_model=DailyPlanResponse)
async def daily_plan(request: DailyPlanRequest, x_user_id: str = Header(None)):
    _require_non_empty(request.class_num, "class_num")
    if not request.subjects:
        raise HTTPException(status_code=422, detail="Please specify mandatory field: subjects")
    if x_user_id and not check_rate_limit(x_user_id, "summary"):
        raise HTTPException(
            status_code=429,
            detail="Weekly planning limit reached for free tier. Upgrade to Pro for unlimited plans.",
        )

    prompt = _plan_prompt(request)
    subjects_text = ", ".join(request.subjects)

    messages = [
        {
            "role": "system",
            "content": (
                f"You are Clarity — the official CBSE AI Tutor for Class {request.class_num}. "
                "Build actionable, NCERT-focused daily study plans that align with CBSE board patterns."
                f"{_profile_block(request.learner_profile)}" + (f"\nPersonality: {request.teacher_personality}" if request.teacher_personality else "")
            ),
        },
        {"role": "user", "content": prompt},
    ]

    logger.info("Daily plan route -> class=%s subjects=%s", request.class_num, subjects_text)
    try:
        plan = await ask_openrouter(messages, task_type="smart")
    except Exception as exc:
        logger.error("Daily plan generation failed, using fallback: %s", str(exc))
        plan = _fallback_daily_plan(request)

    if x_user_id:
        increment_usage(x_user_id, "summary")

    return DailyPlanResponse(plan=plan)


@router.post("/daily-plan-stream")
async def daily_plan_stream(request: DailyPlanRequest, x_user_id: str = Header(None)):
    _require_non_empty(request.class_num, "class_num")
    if not request.subjects:
        raise HTTPException(status_code=422, detail="Please specify mandatory field: subjects")
    if x_user_id and not check_rate_limit(x_user_id, "summary"):
        raise HTTPException(
            status_code=429,
            detail="Weekly planning limit reached for free tier. Upgrade to Pro for unlimited plans.",
        )

    prompt = _plan_prompt(request)
    messages = [
        {
            "role": "system",
            "content": (
                f"You are Clarity — the official CBSE AI Tutor for Class {request.class_num}. "
                "Build actionable, NCERT-focused daily study plans that align with CBSE board patterns."
                f"{_profile_block(request.learner_profile)}" + (f"\nPersonality: {request.teacher_personality}" if request.teacher_personality else "")
            ),
        },
        {"role": "user", "content": prompt},
    ]

    async def event_generator():
        try:
            async for token in ask_openrouter_stream(messages, task_type="smart"):
                yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
        except Exception as exc:
            logger.error("Daily plan stream failed, emitting fallback: %s", str(exc))
            fallback = _fallback_daily_plan(request)
            for chunk in [fallback[i:i+280] for i in range(0, len(fallback), 280)]:
                yield f"data: {json.dumps({'token': chunk, 'done': False})}\n\n"
        if x_user_id:
            increment_usage(x_user_id, "summary")
        yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
