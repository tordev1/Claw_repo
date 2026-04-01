"""
NETS Platform — Production AI Prompt Templates
===============================================
All 9 agent functions across 3 tiers.

Each prompt is a dataclass with:
  - system_prompt  : str
  - user_template  : str  (use .format(**kwargs) or .format_map())
  - output_schema  : dict (JSON Schema for the expected response)
  - tier / model   : metadata

Usage
-----
from nets_ai.prompts import FLASHCARD_PROMPT

system  = FLASHCARD_PROMPT.system_prompt
user    = FLASHCARD_PROMPT.render(topic="Photosynthesis", text="...")
schema  = FLASHCARD_PROMPT.output_schema
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict


@dataclass
class PromptTemplate:
    name: str
    tier: int
    model: str
    system_prompt: str
    user_template: str
    output_schema: Dict[str, Any]

    def render(self, **kwargs) -> str:
        return self.user_template.format(**kwargs)


# ===========================================================================
# TIER 1 — Mistral / Llama (local, fast, low-cost)
# ===========================================================================

# ---------------------------------------------------------------------------
# 1. FLASHCARD GENERATION
# ---------------------------------------------------------------------------

FLASHCARD_PROMPT = PromptTemplate(
    name="flashcard_generation",
    tier=1,
    model="mistral-7b-instruct",
    system_prompt="""\
You are an expert curriculum designer for K-11 students in Uzbekistan.
Your task is to generate high-quality flashcards from educational content.

RULES:
- Output ONLY valid JSON — no markdown, no commentary, no code fences.
- Generate exactly 10 flashcard objects.
- Questions must test genuine comprehension, not trivial recall.
- Answers must be concise (1–2 sentences max).
- Match language to input: Uzbek text → Uzbek cards, Russian text → Russian cards.
- Adjust complexity to the stated grade level.
- Never invent facts not present in the source text.\
""",
    user_template="""\
TOPIC: {topic}
GRADE LEVEL: {grade_level}
SUBJECT: {subject}

SOURCE TEXT:
\"\"\"
{text}
\"\"\"

Generate 10 flashcards from the source text above.
Return ONLY this JSON structure — nothing else:

{{
  "topic": "{topic}",
  "grade_level": {grade_level},
  "cards": [
    {{
      "id": 1,
      "question": "...",
      "answer": "...",
      "difficulty": "easy|medium|hard",
      "bloom_level": "remember|understand|apply|analyze|evaluate|create"
    }}
  ]
}}\
""",
    output_schema={
        "type": "object",
        "required": ["topic", "grade_level", "cards"],
        "properties": {
            "topic": {"type": "string"},
            "grade_level": {"type": "integer"},
            "cards": {
                "type": "array",
                "minItems": 10,
                "maxItems": 10,
                "items": {
                    "type": "object",
                    "required": ["id", "question", "answer", "difficulty", "bloom_level"],
                    "properties": {
                        "id": {"type": "integer"},
                        "question": {"type": "string"},
                        "answer": {"type": "string"},
                        "difficulty": {"enum": ["easy", "medium", "hard"]},
                        "bloom_level": {
                            "enum": ["remember", "understand", "apply",
                                     "analyze", "evaluate", "create"]
                        },
                    },
                },
            },
        },
    },
)

"""
EXAMPLE INPUT (flashcard):
  topic="Fotosintez", grade_level=7, subject="Biologiya",
  text="Fotosintez — yashil o'simliklarda xlorofill yordamida quyosh energiyasi
        CO2 va suvni glyukoza va kislorodga aylantiradigan jarayon..."

EXAMPLE OUTPUT (truncated):
{
  "topic": "Fotosintez",
  "grade_level": 7,
  "cards": [
    {
      "id": 1,
      "question": "Fotosintezning asosiy mahsulotlari nima?",
      "answer": "Glyukoza (qand) va kislorod.",
      "difficulty": "easy",
      "bloom_level": "remember"
    },
    {
      "id": 2,
      "question": "Xlorofill fotosintezda qanday rol o'ynaydi?",
      "answer": "Xlorofill quyosh nurini yutib, uni kimyoviy energiyaga aylantiradi.",
      "difficulty": "medium",
      "bloom_level": "understand"
    }
    // ... 8 more cards
  ]
}
"""


# ---------------------------------------------------------------------------
# 2. QUIZ QUESTION GENERATION (MCQ)
# ---------------------------------------------------------------------------

QUIZ_GENERATION_PROMPT = PromptTemplate(
    name="quiz_question_generation",
    tier=1,
    model="mistral-7b-instruct",
    system_prompt="""\
You are an expert assessment writer for the NETS education platform in Uzbekistan.
Generate multiple-choice questions (MCQ) aligned with PISA literacy standards.

RULES:
- Output ONLY valid JSON — no markdown, no extra text.
- Generate exactly 5 MCQ questions.
- Each question must have exactly 4 options (A, B, C, D).
- Distractors must be plausible (not obviously wrong).
- Include a one-sentence explanation for the correct answer.
- Tag each question with its Bloom's taxonomy level.
- Difficulty must vary: at least 1 easy, 2 medium, 1 hard, 1 very_hard.\
""",
    user_template="""\
TOPIC: {topic}
GRADE LEVEL: {grade_level}
SUBJECT: {subject}
TARGET PISA LEVEL: {pisa_level}

SOURCE TEXT:
\"\"\"
{text}
\"\"\"

Generate 5 MCQ questions. Return ONLY this JSON:

{{
  "topic": "{topic}",
  "questions": [
    {{
      "id": 1,
      "question": "...",
      "options": {{
        "A": "...",
        "B": "...",
        "C": "...",
        "D": "..."
      }},
      "correct_option": "A",
      "explanation": "...",
      "difficulty": "easy|medium|hard|very_hard",
      "bloom_level": "remember|understand|apply|analyze|evaluate|create",
      "pisa_level": "1a|2|3|4|5|6"
    }}
  ]
}}\
""",
    output_schema={
        "type": "object",
        "required": ["topic", "questions"],
        "properties": {
            "topic": {"type": "string"},
            "questions": {
                "type": "array",
                "minItems": 5,
                "maxItems": 5,
                "items": {
                    "type": "object",
                    "required": ["id", "question", "options", "correct_option",
                                 "explanation", "difficulty", "bloom_level"],
                    "properties": {
                        "id": {"type": "integer"},
                        "question": {"type": "string"},
                        "options": {
                            "type": "object",
                            "required": ["A", "B", "C", "D"],
                            "properties": {
                                "A": {"type": "string"},
                                "B": {"type": "string"},
                                "C": {"type": "string"},
                                "D": {"type": "string"},
                            },
                        },
                        "correct_option": {"enum": ["A", "B", "C", "D"]},
                        "explanation": {"type": "string"},
                        "difficulty": {"enum": ["easy", "medium", "hard", "very_hard"]},
                        "bloom_level": {"type": "string"},
                        "pisa_level": {"type": "string"},
                    },
                },
            },
        },
    },
)

"""
EXAMPLE INPUT (quiz):
  topic="Ikkinchi Jahon urushi", grade_level=10, subject="Tarix",
  pisa_level="3",
  text="1939-1945 yillarda bo'lib o'tgan Ikkinchi Jahon urushi 70 million
        kishining hayotiga zomin bo'ldi..."

EXAMPLE OUTPUT (1 question shown):
{
  "topic": "Ikkinchi Jahon urushi",
  "questions": [
    {
      "id": 1,
      "question": "Ikkinchi Jahon urushi qachon boshlangan?",
      "options": {
        "A": "1939 yil 1 sentabr",
        "B": "1941 yil 22 iyun",
        "C": "1937 yil 7 iyul",
        "D": "1945 yil 2 sentabr"
      },
      "correct_option": "A",
      "explanation": "Germaniya 1939 yil 1 sentabrda Polshaga bostirib kirishi bilan urush boshlandi.",
      "difficulty": "easy",
      "bloom_level": "remember",
      "pisa_level": "2"
    }
  ]
}
"""


# ---------------------------------------------------------------------------
# 3. SENTENCE FILL / CLOZE GENERATION
# ---------------------------------------------------------------------------

CLOZE_GENERATION_PROMPT = PromptTemplate(
    name="cloze_sentence_fill",
    tier=1,
    model="llama-3-8b-instruct",
    system_prompt="""\
You are a language and comprehension exercise designer for K-11 students in Uzbekistan.
Your task is to create cloze (fill-in-the-blank) exercises from educational text.

RULES:
- Output ONLY valid JSON.
- Generate exactly 5 cloze sentences.
- Remove only KEY CONCEPT words (nouns, verbs, technical terms) — not articles or prepositions.
- Each blank must be represented by exactly "___" (three underscores).
- The removed word must be clearly inferable from context.
- Provide the correct answer and 3 distractor options for each blank.
- Sentences must be taken verbatim from the source (do not paraphrase).\
""",
    user_template="""\
TOPIC: {topic}
GRADE LEVEL: {grade_level}
SUBJECT: {subject}

SOURCE PARAGRAPH:
\"\"\"
{paragraph}
\"\"\"

Create 5 cloze exercises. Return ONLY this JSON:

{{
  "topic": "{topic}",
  "exercises": [
    {{
      "id": 1,
      "sentence_with_blank": "...___ ...",
      "correct_answer": "...",
      "distractors": ["...", "...", "..."],
      "hint": "one-word grammatical or semantic hint",
      "difficulty": "easy|medium|hard"
    }}
  ]
}}\
""",
    output_schema={
        "type": "object",
        "required": ["topic", "exercises"],
        "properties": {
            "topic": {"type": "string"},
            "exercises": {
                "type": "array",
                "minItems": 5,
                "maxItems": 5,
                "items": {
                    "type": "object",
                    "required": ["id", "sentence_with_blank", "correct_answer",
                                 "distractors", "difficulty"],
                    "properties": {
                        "id": {"type": "integer"},
                        "sentence_with_blank": {"type": "string"},
                        "correct_answer": {"type": "string"},
                        "distractors": {"type": "array", "minItems": 3, "maxItems": 3},
                        "hint": {"type": "string"},
                        "difficulty": {"enum": ["easy", "medium", "hard"]},
                    },
                },
            },
        },
    },
)


# ===========================================================================
# TIER 2 — Claude Haiku (fast, capable reasoning)
# ===========================================================================

# ---------------------------------------------------------------------------
# 4. WHY CHAIN GENERATOR (Socratic question chain)
# ---------------------------------------------------------------------------

WHY_CHAIN_PROMPT = PromptTemplate(
    name="why_chain_generator",
    tier=2,
    model="claude-haiku-3-5",
    system_prompt="""\
You are a master Socratic teacher helping K-11 students in Uzbekistan build deep conceptual understanding.

Your role is to generate a "Why Chain" — a sequence of 5 probing questions that lead a student
from surface recall to deep understanding of a concept.

PEDAGOGICAL RULES:
- Question 1: Surface-level recall (what is it?)
- Question 2: Mechanism or process (how does it work?)
- Question 3: Causation (why does this happen?)
- Question 4: Implication or consequence (what happens if...?)
- Question 5: Transfer or synthesis (how does this connect to...?)
- Each question must build naturally on the previous.
- Questions must be answerable from the curriculum — never require outside knowledge.
- Use age-appropriate language for the stated grade level.
- Output ONLY valid JSON.\
""",
    user_template="""\
CONCEPT: {concept}
SUBJECT: {subject}
GRADE LEVEL: {grade_level}
CHAPTER CONTEXT: {chapter_context}

Generate a 5-step Socratic Why Chain. Return ONLY this JSON:

{{
  "concept": "{concept}",
  "chain": [
    {{
      "step": 1,
      "question": "...",
      "cognitive_level": "recall|comprehension|application|analysis|synthesis",
      "expected_answer_hint": "brief note on what a correct answer covers",
      "follow_up_if_stuck": "simpler re-phrasing or scaffold question"
    }}
  ]
}}\
""",
    output_schema={
        "type": "object",
        "required": ["concept", "chain"],
        "properties": {
            "concept": {"type": "string"},
            "chain": {
                "type": "array",
                "minItems": 5,
                "maxItems": 5,
                "items": {
                    "type": "object",
                    "required": ["step", "question", "cognitive_level",
                                 "expected_answer_hint"],
                    "properties": {
                        "step": {"type": "integer"},
                        "question": {"type": "string"},
                        "cognitive_level": {
                            "enum": ["recall", "comprehension", "application",
                                     "analysis", "synthesis"]
                        },
                        "expected_answer_hint": {"type": "string"},
                        "follow_up_if_stuck": {"type": "string"},
                    },
                },
            },
        },
    },
)

"""
EXAMPLE INPUT (why chain):
  concept="Gravitatsiya", subject="Fizika", grade_level=9,
  chapter_context="Nyutonning tortishish qonuni, massa, masofa, tortishish kuchi"

EXAMPLE OUTPUT (2 of 5 steps shown):
{
  "concept": "Gravitatsiya",
  "chain": [
    {
      "step": 1,
      "question": "Gravitatsiya degan nima va u qanday kuchni ifodalaydi?",
      "cognitive_level": "recall",
      "expected_answer_hint": "Har qanday massali jismlar o'rtasidagi tortishish kuchi",
      "follow_up_if_stuck": "Yer shari olmani nima uchun tortadi deb o'ylaysiz?"
    },
    {
      "step": 2,
      "question": "Gravitatsiya kuchi massa va masofaga qanday bog'liq?",
      "cognitive_level": "comprehension",
      "expected_answer_hint": "Massa oshsa kuch oshadi; masofa oshsa kuch kamayadi (kvadrat qonun)",
      "follow_up_if_stuck": "Agar ikkita jism bir-biridan uzoqlashsa, ular orasidagi tortishish kuchiga nima bo'ladi?"
    }
  ]
}
"""


# ---------------------------------------------------------------------------
# 5. REAL-LIFE CHALLENGE (scenario problem with Uzbek cultural context)
# ---------------------------------------------------------------------------

REAL_LIFE_CHALLENGE_PROMPT = PromptTemplate(
    name="real_life_challenge",
    tier=2,
    model="claude-haiku-3-5",
    system_prompt="""\
You are a curriculum designer specializing in contextual, project-based learning for Uzbekistan.

Your task is to create a "Real-Life Challenge" — an authentic scenario problem that embeds
the chapter's key learning objectives inside a culturally relevant Uzbek context.

DESIGN PRINCIPLES:
- The scenario must feel immediately relevant to a student's lived experience in Uzbekistan.
- Embed the curriculum concept naturally — it should not feel like a "word problem wrapper".
- Include real places, names, occupations, foods, or cultural practices where natural.
- The challenge must require applying (not just recalling) the concept.
- Include a clear deliverable: what the student must produce/decide/calculate.
- Avoid stereotypes; represent diverse regions (Tashkent, Samarkand, Fergana, Karakalpakstan).
- Output ONLY valid JSON.\
""",
    user_template="""\
SUBJECT: {subject}
GRADE LEVEL: {grade_level}
CHAPTER TITLE: {chapter_title}
KEY LEARNING OBJECTIVES:
{learning_objectives}

CHAPTER CONTENT SUMMARY:
\"\"\"
{chapter_content}
\"\"\"

CULTURAL CONTEXT HINT: {cultural_context_hint}

Design one Real-Life Challenge. Return ONLY this JSON:

{{
  "title": "short scenario title",
  "cultural_setting": "brief description of the Uzbek context used",
  "scenario": "2-3 paragraph narrative setup of the situation",
  "challenge_question": "the specific question or task the student must solve",
  "concepts_applied": ["concept_1", "concept_2"],
  "expected_output": "what a complete response looks like",
  "scaffolding_hints": [
    "hint 1 for struggling students",
    "hint 2",
    "hint 3"
  ],
  "extension_task": "harder follow-up for advanced students",
  "bloom_level": "apply|analyze|evaluate|create"
}}\
""",
    output_schema={
        "type": "object",
        "required": ["title", "scenario", "challenge_question",
                     "concepts_applied", "bloom_level"],
        "properties": {
            "title": {"type": "string"},
            "cultural_setting": {"type": "string"},
            "scenario": {"type": "string"},
            "challenge_question": {"type": "string"},
            "concepts_applied": {"type": "array", "items": {"type": "string"}},
            "expected_output": {"type": "string"},
            "scaffolding_hints": {"type": "array", "items": {"type": "string"}},
            "extension_task": {"type": "string"},
            "bloom_level": {"enum": ["apply", "analyze", "evaluate", "create"]},
        },
    },
)

"""
EXAMPLE INPUT (real-life challenge):
  subject="Matematika", grade_level=8,
  chapter_title="Foizlar va nisbatlar",
  learning_objectives="Foizni hisoblash, chegirma va soliqni tushunish",
  chapter_content="Foiz — bu sonning yuzdan bir qismi...",
  cultural_context_hint="Samarqand bozorida savdo-sotiq"

EXAMPLE OUTPUT:
{
  "title": "Registon Bazori: Chegirma Hisoblash",
  "cultural_setting": "Samarqandning Registon bozori, qo'lda to'qilgan gilamlar do'koni",
  "scenario": "Aziz bobosi Samarqand bozorida gilamlar sotadi. Ramazon oidasida u barcha
    narxlarni 15% ga kamaytirdi. Aziz bobosiga qo'l kelmoqchi — u 480,000 so'm turuvchi
    gilam uchun yangi narxni hisoblashi kerak. Lekin do'konga 8% QQS (soliq) ham qo'shiladi.",
  "challenge_question": "Chegirmadan keyin, soliq qo'shilganda, gilam uchun yakuniy narx qancha bo'ladi?",
  "concepts_applied": ["foiz hisoblash", "ketma-ket foizlar", "soliq"],
  "expected_output": "Chegirmali narx: 408,000 so'm; soliq bilan: 440,640 so'm",
  "scaffolding_hints": [
    "Avval chegirmani hisoblang: 480,000 × 0.15 = ?",
    "Chegirmani asl narxdan ayiring",
    "Keyin 8% soliqni chegirmali narxga qo'shing"
  ],
  "extension_task": "Agar bob 3 ta gilam sotsa va har biri turli chegirmada bo'lsa, umumiy foyda qancha?",
  "bloom_level": "apply"
}
"""


# ---------------------------------------------------------------------------
# 6. CONTENT REFINEMENT (Bloom's-tagged learning script)
# ---------------------------------------------------------------------------

CONTENT_REFINEMENT_PROMPT = PromptTemplate(
    name="content_refinement",
    tier=2,
    model="claude-haiku-3-5",
    system_prompt="""\
You are an expert instructional designer specializing in transforming raw textbook content
into structured, pedagogically sound learning scripts for Uzbek K-11 classrooms.

YOUR TASK:
Transform raw textbook text into a structured learning script where each chunk of content
is tagged with Bloom's taxonomy level and learning purpose.

TRANSFORMATION RULES:
- Break content into logical learning chunks (2-4 sentences each).
- Each chunk gets a Bloom's level tag, a learning objective, and a type label.
- Content types: definition | explanation | example | application | analogy | visual_cue
- Simplify unnecessarily complex sentences without losing technical precision.
- Add ONE concrete analogy per major concept if not present in original text.
- Flag any gaps or ambiguities in the source text as "teacher_note".
- Preserve all technical terms but add brief inline glosses for difficult ones.
- Output ONLY valid JSON.\
""",
    user_template="""\
SUBJECT: {subject}
GRADE LEVEL: {grade_level}
CHAPTER: {chapter_title}
LEARNING GOALS: {learning_goals}

RAW TEXTBOOK TEXT:
\"\"\"
{raw_text}
\"\"\"

Transform this content into a structured learning script. Return ONLY this JSON:

{{
  "chapter": "{chapter_title}",
  "grade_level": {grade_level},
  "estimated_reading_minutes": 0,
  "learning_chunks": [
    {{
      "chunk_id": 1,
      "content": "refined text of this chunk",
      "content_type": "definition|explanation|example|application|analogy|visual_cue",
      "bloom_level": "remember|understand|apply|analyze|evaluate|create",
      "learning_objective": "After this chunk, students will be able to...",
      "key_terms": ["term1", "term2"],
      "teacher_note": "optional flag for gaps/ambiguities (null if none)"
    }}
  ],
  "summary_sentence": "one sentence summarizing the whole passage",
  "prerequisite_concepts": ["concept students should already know"]
}}\
""",
    output_schema={
        "type": "object",
        "required": ["chapter", "learning_chunks", "summary_sentence"],
        "properties": {
            "chapter": {"type": "string"},
            "grade_level": {"type": "integer"},
            "estimated_reading_minutes": {"type": "number"},
            "learning_chunks": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["chunk_id", "content", "content_type",
                                 "bloom_level", "learning_objective"],
                    "properties": {
                        "chunk_id": {"type": "integer"},
                        "content": {"type": "string"},
                        "content_type": {
                            "enum": ["definition", "explanation", "example",
                                     "application", "analogy", "visual_cue"]
                        },
                        "bloom_level": {"type": "string"},
                        "learning_objective": {"type": "string"},
                        "key_terms": {"type": "array"},
                        "teacher_note": {"type": ["string", "null"]},
                    },
                },
            },
            "summary_sentence": {"type": "string"},
            "prerequisite_concepts": {"type": "array"},
        },
    },
)


# ===========================================================================
# TIER 3 — Claude Opus (deep reasoning, highest quality)
# ===========================================================================

# ---------------------------------------------------------------------------
# 7. FINAL BOSS QUESTION
# ---------------------------------------------------------------------------

FINAL_BOSS_PROMPT = PromptTemplate(
    name="final_boss_question",
    tier=3,
    model="claude-opus-4-5",
    system_prompt="""\
You are a senior assessment architect and cognitive scientist designing capstone questions
for Uzbekistan's national K-11 education platform (NETS).

Your task is to write the "Final Boss" question for a chapter — a single high-synthesis
question that requires integrating ALL major concepts from the chapter.

DESIGN REQUIREMENTS:
1. The question must target Bloom's Level 5 (Evaluate) or Level 6 (Create).
2. It must be impossible to answer correctly by rote recall alone.
3. The question should have a clear real-world stakes context.
4. A complete answer requires demonstrating understanding of at least 3 distinct concepts.
5. The rubric must be specific, not generic — tied to THIS question's content.
6. Include exactly 4 rubric dimensions with 0/1/2/3 point scales.
7. A "perfect answer" example must demonstrate master-level reasoning.
8. Calibrate question difficulty to the student's stated ability level.
9. Output ONLY valid JSON.\
""",
    user_template="""\
SUBJECT: {subject}
GRADE LEVEL: {grade_level}
CHAPTER TITLE: {chapter_title}
STUDENT ABILITY LEVEL: {ability_level}  (pisa_level: {pisa_level}, theta: {theta:.2f})

CHAPTER SUMMARY:
\"\"\"
{chapter_summary}
\"\"\"

KEY CONCEPTS COVERED:
{key_concepts}

PREREQUISITE KNOWLEDGE:
{prerequisites}

Design the Final Boss question. Return ONLY this JSON:

{{
  "question_id": "fb_{subject_code}_{grade_level}_{chapter_code}",
  "question": "the full question text",
  "context_scenario": "the real-world framing/scenario for the question",
  "what_is_being_tested": "explanation of the cognitive demand",
  "concepts_integrated": ["concept_1", "concept_2", "concept_3"],
  "bloom_level": "evaluate|create",
  "estimated_minutes": 0,
  "rubric": {{
    "total_points": 12,
    "dimensions": [
      {{
        "name": "dimension name",
        "description": "what this dimension measures",
        "scores": {{
          "0": "no evidence of...",
          "1": "partial evidence of...",
          "2": "clear evidence of...",
          "3": "exemplary evidence of..."
        }}
      }}
    ]
  }},
  "perfect_answer_example": "what a 12/12 answer demonstrates",
  "common_misconceptions": ["misconception to watch for"],
  "teacher_guidance": "how to discuss this question in class"
}}\
""",
    output_schema={
        "type": "object",
        "required": ["question", "rubric", "concepts_integrated", "bloom_level"],
        "properties": {
            "question_id": {"type": "string"},
            "question": {"type": "string"},
            "context_scenario": {"type": "string"},
            "what_is_being_tested": {"type": "string"},
            "concepts_integrated": {"type": "array", "minItems": 3},
            "bloom_level": {"enum": ["evaluate", "create"]},
            "estimated_minutes": {"type": "integer"},
            "rubric": {
                "type": "object",
                "required": ["total_points", "dimensions"],
                "properties": {
                    "total_points": {"type": "integer"},
                    "dimensions": {
                        "type": "array",
                        "minItems": 4,
                        "maxItems": 4,
                        "items": {
                            "type": "object",
                            "required": ["name", "description", "scores"],
                        },
                    },
                },
            },
            "perfect_answer_example": {"type": "string"},
            "common_misconceptions": {"type": "array"},
            "teacher_guidance": {"type": "string"},
        },
    },
)

"""
EXAMPLE INPUT (final boss):
  subject="Kimyo", grade_level=11, chapter_title="Elektrokimyo",
  ability_level="advanced", pisa_level="5", theta=1.2,
  chapter_summary="Galvanik elementlar, elektroliz, Faradey qonunlari, korroziya...",
  key_concepts=["oksidlanish-qaytarilish", "elektrod potentsiali", "Faradey qonuni", "korroziya"],
  prerequisites=["ionlar", "redoks reaksiyalar", "elektr zanjiri"]

EXAMPLE OUTPUT (partial):
{
  "question_id": "fb_KIM_11_elektrokimyo",
  "question": "O'zbekistondagi Navoiy shahri yaqinidagi mis rudasi konida yer usti quvurlarida
    korroziya muammosi kuzatilmoqda. Muhandis sifatida: (a) quvurlarga ta'sir qiluvchi
    elektrokimyoviy jarayonni izohlang; (b) katod himoyasi tizimini loyihalang;
    (c) Faradey qonunlaridan foydalanib, 30 kunlik himoya uchun zarur tok kuchini hisoblang.",
  "bloom_level": "create",
  "concepts_integrated": ["korroziya mexanizmi", "katod himoyasi", "Faradey qonuni"],
  "rubric": {
    "total_points": 12,
    "dimensions": [
      {
        "name": "Elektrokimyoviy tushuntirish",
        "description": "Korroziyani anod/katod reaksiyalar orqali tushuntirish",
        "scores": {
          "0": "Elektrokimyoviy tushuntirish yo'q",
          "1": "Faqat korroziya natijasi aytilgan, mexanizm yo'q",
          "2": "Anod yoki katod reaksiya to'g'ri, lekin to'liq emas",
          "3": "Har ikkala yarim-reaksiya, elektron uzatish va EMK to'g'ri"
        }
      }
    ]
  }
}
"""


# ---------------------------------------------------------------------------
# 8. SOCRATIC TUTOR
# ---------------------------------------------------------------------------

SOCRATIC_TUTOR_PROMPT = PromptTemplate(
    name="socratic_tutor",
    tier=3,
    model="claude-opus-4-5",
    system_prompt="""\
You are a patient, brilliant Socratic tutor for K-11 students in Uzbekistan.

A student has just answered a question INCORRECTLY. Your mission is to guide them
to the correct understanding through questions ONLY — never by giving the answer directly.

STRICT RULES:
1. NEVER state the correct answer, even implicitly.
2. NEVER say "that's wrong" or anything discouraging.
3. Start from what the student GOT RIGHT in their answer (always find something).
4. Ask questions that expose the specific flaw in their reasoning.
5. Use analogies from everyday Uzbek life when helpful.
6. Sequence your questions from easier to harder (scaffolding).
7. The final question in your sequence should lead the student to self-correct.
8. Limit yourself to 4 guiding questions maximum.
9. Tone: warm, curious, encouraging — like a wise older sibling.
10. Output ONLY valid JSON.\
""",
    user_template="""\
SUBJECT: {subject}
GRADE LEVEL: {grade_level}
CHAPTER: {chapter_title}

ORIGINAL QUESTION:
\"{question}\"

STUDENT'S WRONG ANSWER:
\"{student_answer}\"

CORRECT ANSWER (for your reference only — DO NOT reveal):
\"{correct_answer}\"

MISCONCEPTION CATEGORY: {misconception_type}

RELEVANT CHAPTER CONTENT:
\"\"\"
{chapter_content}
\"\"\"

Generate Socratic guiding questions. Return ONLY this JSON:

{{
  "acknowledgment": "1-2 sentences recognizing what the student got right",
  "diagnosed_misconception": "your internal diagnosis of the error (not shown to student)",
  "guiding_questions": [
    {{
      "step": 1,
      "question": "your question to the student",
      "purpose": "what this question is designed to surface",
      "if_student_still_stuck": "a more concrete scaffold version of this question"
    }}
  ],
  "recovery_path": "brief description of the conceptual journey you're guiding them through",
  "positive_closing": "encouraging message when student reaches correct understanding"
}}\
""",
    output_schema={
        "type": "object",
        "required": ["acknowledgment", "guiding_questions", "recovery_path"],
        "properties": {
            "acknowledgment": {"type": "string"},
            "diagnosed_misconception": {"type": "string"},
            "guiding_questions": {
                "type": "array",
                "minItems": 2,
                "maxItems": 4,
                "items": {
                    "type": "object",
                    "required": ["step", "question", "purpose"],
                    "properties": {
                        "step": {"type": "integer"},
                        "question": {"type": "string"},
                        "purpose": {"type": "string"},
                        "if_student_still_stuck": {"type": "string"},
                    },
                },
            },
            "recovery_path": {"type": "string"},
            "positive_closing": {"type": "string"},
        },
    },
)

"""
EXAMPLE INPUT (Socratic tutor):
  subject="Fizika", grade_level=9, chapter_title="Nyuton qonunlari",
  question="50 N kuch bilan itarilgan 10 kg massali aravachaning tezlanishi qancha?",
  student_answer="5 m/s",  # confused acceleration with velocity
  correct_answer="5 m/s²",
  misconception_type="units_confusion",
  chapter_content="F = ma, birlik: N = kg·m/s²..."

EXAMPLE OUTPUT:
{
  "acknowledgment": "Juda yaxshi — siz F = ma formulasidan to'g'ri foydalandingiz va hisob ham to'g'ri! 50 ÷ 10 = 5.",
  "diagnosed_misconception": "Student calculated the correct magnitude (5) but used velocity units (m/s) instead of acceleration units (m/s²) — classic units confusion.",
  "guiding_questions": [
    {
      "step": 1,
      "question": "Tezlanish va tezlik — bular bir xil narsamikaz? Ikkalasining birligi nimadan farq qiladi?",
      "purpose": "Distinguish between velocity (m/s) and acceleration (m/s²)",
      "if_student_still_stuck": "Agar mashina tezligi 60 km/soat bo'lsa, bu uning qanchalik tez harakatlanishini bildiradi. Tezlanish esa..."
    },
    {
      "step": 2,
      "question": "F = ma formulasida har bir harf qanday birlikda o'lchanadi? F — N, m — kg... a nima?",
      "purpose": "Derive acceleration units from Newton's second law",
      "if_student_still_stuck": "N = kg × a, demak a = N/kg = kg·m/s² / kg = ?"
    }
  ],
  "recovery_path": "Lead student to see that acceleration = change in velocity per second, so units must be m/s per second = m/s²",
  "positive_closing": "Aynan to'g'ri! Formulangiz va hisobingiz to'g'ri edi — faqat birlikni aniqlashtirdingiz. Bu fizikada juda muhim ko'nikma!"
}
"""


# ---------------------------------------------------------------------------
# 9. MONTHLY DIAGNOSTIC & IMPROVEMENT PLAN
# ---------------------------------------------------------------------------

MONTHLY_DIAGNOSTIC_PROMPT = PromptTemplate(
    name="monthly_diagnostic",
    tier=3,
    model="claude-opus-4-5",
    system_prompt="""\
You are a data-driven learning coach and educational psychologist working with the NETS
platform in Uzbekistan. You have access to a student's complete 30-day learning data.

Your task is to produce a deeply personalized, actionable monthly improvement plan.

ANALYSIS FRAMEWORK:
1. Identify the student's strongest and weakest concept clusters.
2. Look for learning patterns: time-of-day performance, session length vs. retention,
   streak patterns, response-time trends.
3. Classify the student's learning style from behavioral data.
4. Set specific, measurable 30-day goals (SMART format).
5. Design an adaptive weekly study schedule.
6. Flag any concerning patterns (burnout risk, disengagement, anxiety signals).
7. Identify 1-2 "breakthrough concepts" — mastering these would unlock rapid progress.

TONE:
- Write as if speaking directly to the student (second person "you").
- Warm, honest, specific — never generic.
- Celebrate genuine wins; be honest about gaps without being discouraging.
- Output ONLY valid JSON.\
""",
    user_template="""\
STUDENT PROFILE:
- Name: {student_name}
- Grade: {grade_level}
- Age: {age}
- Primary subjects: {subjects}

30-DAY SESSION DATA (JSON):
{session_data_json}

DATA SCHEMA REFERENCE:
session_data_json contains:
  - sessions[]: {{date, subject, duration_minutes, questions_attempted,
                  correct, theta_start, theta_end, topics_covered[]}}
  - streaks: {{current, longest, breaks[]}}
  - time_distribution: {{by_hour: {{}}, by_day_of_week: {{}}}}
  - concept_performance: {{concept_name: {{attempts, correct_rate, avg_response_time_ms}}}}
  - flow_state_history: [{{date, state, subject}}]

Generate the monthly report. Return ONLY this JSON:

{{
  "report_period": "{{start_date}} to {{end_date}}",
  "student_name": "{student_name}",
  "executive_summary": "3-4 sentence personalized overview",

  "performance_highlights": {{
    "theta_change": {{"start": 0.0, "end": 0.0, "interpretation": "..."}},
    "strongest_subjects": [{{"subject": "...", "reason": "..."}}],
    "weakest_subjects": [{{"subject": "...", "reason": "..."}}],
    "best_performing_concepts": ["..."],
    "concepts_needing_work": ["..."]
  }},

  "learning_patterns": {{
    "peak_performance_time": "e.g., 'weekday mornings 9-11am'",
    "optimal_session_length_minutes": 0,
    "learning_style_inference": "visual|auditory|reading|kinesthetic|mixed",
    "engagement_trend": "improving|stable|declining",
    "burnout_risk": "low|medium|high",
    "burnout_signals": ["..."]
  }},

  "breakthrough_concepts": [
    {{
      "concept": "...",
      "why_it_unlocks_progress": "...",
      "current_mastery_pct": 0,
      "target_mastery_pct": 0
    }}
  ],

  "smart_goals": [
    {{
      "goal": "specific goal statement",
      "metric": "how progress will be measured",
      "deadline_days": 30,
      "weekly_milestones": ["week 1: ...", "week 2: ...", "week 3: ...", "week 4: ..."]
    }}
  ],

  "weekly_study_schedule": {{
    "Monday":    [{{"time": "HH:MM", "subject": "...", "activity": "...", "duration_min": 0}}],
    "Tuesday":   [],
    "Wednesday": [],
    "Thursday":  [],
    "Friday":    [],
    "Saturday":  [],
    "Sunday":    []
  }},

  "specific_recommendations": [
    {{
      "priority": 1,
      "action": "specific action to take",
      "rationale": "why this addresses the data pattern",
      "resource": "optional: specific exercise, chapter, or activity"
    }}
  ],

  "encouragement_message": "personal closing message to the student"
}}\
""",
    output_schema={
        "type": "object",
        "required": ["executive_summary", "performance_highlights",
                     "smart_goals", "specific_recommendations"],
        "properties": {
            "report_period": {"type": "string"},
            "student_name": {"type": "string"},
            "executive_summary": {"type": "string"},
            "performance_highlights": {"type": "object"},
            "learning_patterns": {"type": "object"},
            "breakthrough_concepts": {"type": "array"},
            "smart_goals": {"type": "array"},
            "weekly_study_schedule": {"type": "object"},
            "specific_recommendations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["priority", "action", "rationale"],
                },
            },
            "encouragement_message": {"type": "string"},
        },
    },
)


# ===========================================================================
# Registry — easy lookup by name
# ===========================================================================

PROMPT_REGISTRY: Dict[str, PromptTemplate] = {
    pt.name: pt
    for pt in [
        FLASHCARD_PROMPT,
        QUIZ_GENERATION_PROMPT,
        CLOZE_GENERATION_PROMPT,
        WHY_CHAIN_PROMPT,
        REAL_LIFE_CHALLENGE_PROMPT,
        CONTENT_REFINEMENT_PROMPT,
        FINAL_BOSS_PROMPT,
        SOCRATIC_TUTOR_PROMPT,
        MONTHLY_DIAGNOSTIC_PROMPT,
    ]
}


def get_prompt(name: str) -> PromptTemplate:
    """Retrieve a prompt template by name. Raises KeyError if not found."""
    if name not in PROMPT_REGISTRY:
        available = ", ".join(PROMPT_REGISTRY.keys())
        raise KeyError(f"Prompt '{name}' not found. Available: {available}")
    return PROMPT_REGISTRY[name]


def list_prompts_by_tier() -> Dict[int, List[str]]:
    """Return {tier_number: [prompt_names]} mapping."""
    result: Dict[int, List[str]] = {1: [], 2: [], 3: []}
    for pt in PROMPT_REGISTRY.values():
        result[pt.tier].append(pt.name)
    return result
