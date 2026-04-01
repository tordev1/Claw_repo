# NETS Platform Design Reference
## IRT Adaptive Engine + AI Prompt Templates

---

# PART 1: IRT Adaptive Difficulty Engine

---

## 1.1 Mathematical Foundation: 3-Parameter Logistic (3-PL) IRT

### Core Formula

```
P(correct | θ, a, b, c) = c + (1−c) × 1 / (1 + e^(−a(θ−b)))
```

| Symbol | Name | Range | Role |
|--------|------|-------|------|
| θ (theta) | Student ability | [−4, +4] | Latent trait; 0 = national average |
| a | Discrimination | [0.5, 3.0] | Steepness of ICC curve; higher = more informative |
| b | Difficulty | [−3, +3] | θ value where P = c + (1−c)/2 |
| c | Guessing | [0, 0.35] | Lower asymptote (random-choice floor) |

### Why 3-PL Over 1-PL (Rasch)?

- **1-PL (Rasch):** Assumes all items discriminate equally. Elegant but
  oversimplified for K-11 curriculum items.
- **2-PL:** Adds discrimination but ignores guessing — problematic for MCQ.
- **3-PL:** Full model. The c-parameter is critical for NETS because all
  Level 1-3 items are MCQ with 4 options (c ≈ 0.25 floor).

### Fisher Information Function

```
I(θ) = a² × (1−c)² × [P*(θ) × Q*(θ)]² / [P(θ) × Q(θ)]
```

Maximum information occurs near θ = b. This is the basis for Maximum
Information item selection (CAT strategy).

### PISA Proficiency Level Map

| PISA Level | θ Range | PISA Score | Descriptor |
|------------|---------|------------|------------|
| Below 1b | < −3.0 | < 262 | Cannot locate basic information |
| 1b | [−3.0, −2.2] | 262–334 | Locate single explicit piece of info |
| 1a | [−2.2, −1.4] | 334–407 | Identify main topic |
| 2 | [−1.4, −0.7] | 407–480 | Locate multiple pieces, basic inferences |
| 3 | [−0.7, 0.0] | 480–553 | Integrate information across texts |
| 4 | [0.0, 0.7] | 553–626 | Evaluate quality, credibility |
| 5 | [0.7, 1.5] | 626–698 | Hypothesise, critically evaluate |
| 6 | > 1.5 | > 698 | Fine-grained inference, synthesis |

---

## 1.2 Theta Estimation: EAP vs MLE

### EAP (Expected A Posteriori) — Default for Short Sessions

```python
θ_EAP = Σ [θ_k × L(θ_k) × π(θ_k)] / Σ [L(θ_k) × π(θ_k)]
```

- Prior π(θ) ~ N(0, 1) (national ability distribution)
- Quadrature grid: 41 points from −4 to +4
- **Use when:** n ≤ 10 responses (beginning of session)
- **Advantage:** Never diverges; pulls extreme estimates toward prior

### MLE via Newton-Raphson — Default for Long Sessions

```
θ^(t+1) = θ^(t) − ℓ'(θ) / ℓ''(θ)
```

Where:
```
ℓ'(θ) = Σ a_j × W_j × (x_j − P_j)
ℓ''(θ) = −Σ a_j² × (1−c_j)² × P*Q* / P²
```

- **Use when:** n > 10 responses
- **Advantage:** Asymptotically unbiased; faster convergence

### Auto-Switch Logic

```python
def estimate_theta(responses, method="auto"):
    if method == "auto":
        return estimate_theta_eap(responses) if len(responses) <= 10
               else estimate_theta_mle(responses)
```

---

## 1.3 Flow State & Difficulty Adjustment

### Csikszentmihalyi Flow Zone

```
Success rate < 60%  → "too_hard"   → decrease difficulty
Success rate 60-90% → "flow"       → maintain (target 70-80%)
Success rate > 90%  → "too_easy"   → increase difficulty
```

### Next-Item Targeting

```
Flow state:  b_target = θ − 0.4   (P ≈ 0.73 — middle of flow zone)
Too easy:    b_target = θ + SE     (step up by one standard error)
Too hard:    b_target = θ − SE     (step down by one standard error)
Tolerance:   b_min = b_target − 0.8,  b_max = b_target + 0.8
```

### Adjustment Trigger

- Check flow state every **3–5 questions** (configurable)
- Minimum 3 questions before first adjustment (insufficient data earlier)
- Maximum step size capped at 1 logit per adjustment (prevents thrashing)

---

## 1.4 AdaptiveDifficultyEngine API Reference

**File:** `nets_irt/engine.py`

```python
engine = AdaptiveDifficultyEngine()
```

### `estimate_theta(response_history, method="auto")`

```python
# Input
response_history = [
    {"item_id": 101, "a": 1.2, "b": 0.3, "c": 0.25, "correct": 1},
    {"item_id": 102, "a": 0.8, "b": −0.5, "c": 0.20, "correct": 0},
    ...
]

# Output
theta, se = engine.estimate_theta(response_history)
# theta: float in [−4, +4]
# se: standard error (lower = more confident)
```

### `select_next_difficulty(theta, subject_id)`

```python
window = engine.select_next_difficulty(
    theta=0.5,
    subject_id=3,
    flow_state="flow",
    se=0.7
)
# Returns DifficultyWindow(b_target=0.1, b_min=−0.7, b_max=0.9,
#                          pisa_level="4", flow_state="flow")
```

### `get_flow_state(theta, recent_results)`

```python
state = engine.get_flow_state(
    theta=0.5,
    recent_results=[True, True, False, True, True]  # last 5 answers
)
# Returns: "too_easy" | "flow" | "too_hard"
# [True, True, False, True, True] = 80% → "flow"
```

### `update_after_response(student_id, question_id, correct)`

```python
ability = engine.update_after_response(
    student_id=42,
    question_id=101,
    correct=True,
    response_time_ms=8500
)
# Returns: updated StudentAbility instance
# Side effects:
#   - Re-estimates theta from last 20 responses
#   - Updates StudentAbility.theta, theta_se, pisa_level
#   - Writes IRTResponse log entry
#   - All inside @transaction.atomic
```

---

## 1.5 Database Schema Summary

```
IRTItem
  ├── question (FK → Question)
  ├── subject (FK → Subject)
  ├── a, b, c (Float — 3-PL parameters)
  ├── pisa_level (SmallInt 0–7)
  └── is_active (Bool)

StudentAbility
  ├── student (FK → User)
  ├── subject (FK → Subject)
  ├── theta (Float)
  ├── theta_se (Float)
  ├── pisa_level (SmallInt)
  ├── recent_correct / recent_total (rolling window)
  └── updated_at (auto)

IRTResponse  [append-only audit log]
  ├── student, item, session_id
  ├── correct, response_time_ms
  ├── theta_before, theta_after
  └── answered_at
```

---

## 1.6 CAT Session Flow (Sequence Diagram)

```
Student starts session
        │
        ▼
Load StudentAbility (θ, SE, flow_state)
        │
        ▼
select_next_difficulty(θ, subject_id, flow_state)
        │ → DifficultyWindow(b_target, b_min, b_max)
        ▼
fetch_next_item(θ, subject_id, strategy="max_info")
        │ → IRTItem with highest Fisher information in window
        ▼
Present question to student
        │
        ▼
Student answers
        │
        ▼
update_after_response(student_id, question_id, correct)
        │ → Re-estimate θ (EAP/MLE)
        │ → Update StudentAbility
        │ → Log IRTResponse
        ▼
Every 3-5 questions:
  get_flow_state(θ, recent_results[-5:])
        │ → "flow" | "too_easy" | "too_hard"
        ▼
Back to: select_next_difficulty (loop)
```

---
---

# PART 2: AI Prompt Templates

---

## Overview

| # | Function | Tier | Model | Trigger |
|---|----------|------|-------|---------|
| 1 | Flashcard Generation | 1 | Mistral-7B | Content page opened |
| 2 | Quiz MCQ Generation | 1 | Mistral-7B | Practice mode |
| 3 | Cloze (Sentence Fill) | 1 | Llama-3-8B | Reading exercise |
| 4 | Why Chain (Socratic) | 2 | Claude Haiku | Concept detail view |
| 5 | Real-Life Challenge | 2 | Claude Haiku | End of chapter |
| 6 | Content Refinement | 2 | Claude Haiku | Teacher content pipeline |
| 7 | Final Boss Question | 3 | Claude Opus | Chapter mastery gate |
| 8 | Socratic Tutor | 3 | Claude Opus | Wrong answer event |
| 9 | Monthly Diagnostic | 3 | Claude Opus | Monthly cron job |

All prompts are implemented as `PromptTemplate` dataclasses in:
**`nets_ai/prompts.py`**

---

## TIER 1 PROMPTS (Mistral/Llama)

---

### Prompt 1: Flashcard Generation

**File constant:** `FLASHCARD_PROMPT`
**Model:** `mistral-7b-instruct`
**Latency target:** < 3s for 10 cards

**System Prompt (key constraints):**
- Output ONLY valid JSON (no markdown wrappers)
- Exactly 10 cards
- Questions test comprehension, not trivial recall
- Language matches input (Uzbek/Russian/English)
- Bloom's level tagged on every card

**User Template Variables:**
```
{topic}        — chapter or concept name
{grade_level}  — integer 1–11
{subject}      — subject name
{text}         — source paragraph(s), max ~1500 tokens
```

**Output Schema (condensed):**
```json
{
  "topic": "string",
  "grade_level": 7,
  "cards": [
    {
      "id": 1,
      "question": "string",
      "answer": "string",
      "difficulty": "easy|medium|hard",
      "bloom_level": "remember|understand|apply|analyze|evaluate|create"
    }
  ]
}
```

**Example:**
```
Input:  topic="Fotosintez", grade_level=7, subject="Biologiya"
        text="Fotosintez — yashil o'simliklarda xlorofill yordamida..."

Output card example:
  question: "Fotosintezning asosiy mahsulotlari nima?"
  answer:   "Glyukoza (qand) va kislorod."
  difficulty: "easy"
  bloom_level: "remember"
```

**Prompt engineering notes:**
- The explicit "Output ONLY valid JSON" at the start of system prompt
  prevents Mistral from wrapping output in markdown code fences.
- Stating "10 flashcards" in both system and user prompt prevents
  7 or 12-card outputs from smaller models.

---

### Prompt 2: Quiz MCQ Generation

**File constant:** `QUIZ_GENERATION_PROMPT`
**Model:** `mistral-7b-instruct`
**Latency target:** < 5s for 5 questions

**System Prompt key constraints:**
- Exactly 5 MCQ with exactly 4 options each
- Distractors must be plausible (not obviously wrong)
- Difficulty distribution enforced: ≥1 easy, 2 medium, 1 hard, 1 very_hard
- One-sentence explanation per correct answer

**User Template Variables:**
```
{topic}, {grade_level}, {subject}
{pisa_level}   — target PISA band e.g. "3"
{text}         — source content
```

**Output Schema (key fields):**
```json
{
  "questions": [{
    "id": 1,
    "question": "string",
    "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
    "correct_option": "A",
    "explanation": "string",
    "difficulty": "easy|medium|hard|very_hard",
    "bloom_level": "string",
    "pisa_level": "string"
  }]
}
```

**Distractor design principle (embedded in system prompt):**
Distractors must be wrong answers that reflect REAL student misconceptions,
not random plausible facts. This is enforced by the phrase
"Distractors must be plausible (not obviously wrong)."

---

### Prompt 3: Cloze (Sentence Fill) Generation

**File constant:** `CLOZE_GENERATION_PROMPT`
**Model:** `llama-3-8b-instruct`
**Latency target:** < 3s for 5 exercises

**Key design decisions:**
- Blanked word represented as exactly `___` (three underscores) — parseable
- Only KEY CONCEPT words are blanked, never function words
- 3 distractors provided per blank (making it a 4-option exercise)
- Sentences taken verbatim — no paraphrase (preserves source fidelity)

**User Template Variables:**
```
{topic}, {grade_level}, {subject}
{paragraph}    — source paragraph to extract sentences from
```

**Output Schema:**
```json
{
  "exercises": [{
    "id": 1,
    "sentence_with_blank": "O'simliklar ___ yordamida quyosh nurini yutadi.",
    "correct_answer": "xlorofill",
    "distractors": ["mitoxondriya", "vakuol", "ribosoma"],
    "hint": "pigment",
    "difficulty": "medium"
  }]
}
```

---

## TIER 2 PROMPTS (Claude Haiku)

---

### Prompt 4: Why Chain Generator

**File constant:** `WHY_CHAIN_PROMPT`
**Model:** `claude-haiku-3-5`
**Latency target:** < 4s for 5-step chain

**Pedagogical design (Socratic ladder):**
```
Step 1: What is it?          → recall
Step 2: How does it work?    → comprehension
Step 3: Why does it happen?  → causation
Step 4: What if...?          → implication
Step 5: How does this connect to...?  → transfer/synthesis
```

**User Template Variables:**
```
{concept}          — specific concept e.g. "Gravitatsiya"
{subject}          — subject name
{grade_level}      — integer
{chapter_context}  — brief list of related concepts in the chapter
```

**Output Schema:**
```json
{
  "concept": "string",
  "chain": [{
    "step": 1,
    "question": "string",
    "cognitive_level": "recall|comprehension|application|analysis|synthesis",
    "expected_answer_hint": "string",
    "follow_up_if_stuck": "string"
  }]
}
```

**Critical prompt engineering note:**
`follow_up_if_stuck` scaffolds are included in the output schema so the
frontend can conditionally show them after a 10-second pause — no second
API call needed.

---

### Prompt 5: Real-Life Challenge

**File constant:** `REAL_LIFE_CHALLENGE_PROMPT`
**Model:** `claude-haiku-3-5`
**Latency target:** < 6s

**Cultural grounding strategy:**
The `{cultural_context_hint}` variable is the key differentiator. It anchors
the AI to a specific Uzbek context rather than generating generic global
scenarios. Examples:
- "Samarqand bozorida savdo-sotiq" (Samarkand bazaar trading)
- "Farg'ona vodiysi paxta dalalari" (Fergana Valley cotton fields)
- "Toshkent metro qurilishi" (Tashkent metro construction)
- "Qoraqalpog'iston baliqchilik" (Karakalpakstan fishing)

**Output Schema (key fields):**
```json
{
  "title": "string",
  "cultural_setting": "string",
  "scenario": "2-3 paragraph narrative",
  "challenge_question": "the specific task",
  "concepts_applied": ["concept_1", "concept_2"],
  "scaffolding_hints": ["hint1", "hint2", "hint3"],
  "extension_task": "harder follow-up",
  "bloom_level": "apply|analyze|evaluate|create"
}
```

**Example cultural integration:**
```
Subject: Math (Percentages), Grade: 8
cultural_context_hint: "Samarqand bozorida savdo-sotiq"

→ Scenario: Aziz's grandfather sells handwoven carpets at Registon bazaar.
  During Ramadan, he discounts all prices 15%. A carpet costs 480,000 soum.
  With 8% VAT added after discount, what is the final price?
```

---

### Prompt 6: Content Refinement

**File constant:** `CONTENT_REFINEMENT_PROMPT`
**Model:** `claude-haiku-3-5`
**Latency target:** < 8s (longer input)

**Transformation pipeline:**
```
Raw textbook text
       ↓
Chunk into logical units (2-4 sentences)
       ↓
Tag each chunk: content_type + bloom_level + learning_objective
       ↓
Simplify complex sentences (preserve technical terms)
       ↓
Add analogies for abstract concepts
       ↓
Flag gaps/ambiguities as teacher_notes
       ↓
Structured learning script (JSON)
```

**Content types:**
- `definition` — introduces a new term
- `explanation` — elaborates mechanism
- `example` — concrete instance
- `application` — real-world use
- `analogy` — comparison to familiar concept
- `visual_cue` — describes a diagram/chart

**Output enables:**
- Frontend to render content in Bloom's-ordered sequence
- Teacher dashboard to see concept coverage gaps
- IRT engine to tag questions with same chunk IDs

---

## TIER 3 PROMPTS (Claude Opus)

---

### Prompt 7: Final Boss Question

**File constant:** `FINAL_BOSS_PROMPT`
**Model:** `claude-opus-4-5`
**Latency target:** < 15s (complex generation)
**Trigger:** Student attempts chapter mastery gate (≥ 80% on standard quiz)

**Design requirements enforced in system prompt:**
1. Bloom's Level 5 (Evaluate) or 6 (Create) — NEVER lower
2. Impossible to answer by rote recall
3. Integrates ≥ 3 distinct concepts from the chapter
4. Calibrated to student's theta/PISA level
5. Exactly 4 rubric dimensions, 0-3 scale (12 points total)

**The theta calibration variable:**
```python
# The prompt receives theta to modulate complexity
# theta=-1.0 → simpler synthesis, concrete scenario
# theta=+2.0 → abstract multi-step reasoning, novel contexts
```

**Rubric dimension structure:**
```json
{
  "name": "dimension name",
  "description": "what this measures",
  "scores": {
    "0": "no evidence of...",
    "1": "partial evidence...",
    "2": "clear evidence...",
    "3": "exemplary evidence..."
  }
}
```

**Example (Chemistry, Grade 11, Electrochemistry):**
```
Question: "O'zbekistondagi Navoiy shahri yaqinidagi mis rudasi konida
yer usti quvurlarida korroziya muammosi kuzatilmoqda. Muhandis sifatida:
(a) elektrokimyoviy jarayonni izohlang; (b) katod himoyasi tizimini
loyihalang; (c) Faradey qonunidan foydalanib 30 kunlik tok kuchini hisoblang."

Concepts: korroziya mexanizmi + katod himoyasi + Faradey qonuni
```

---

### Prompt 8: Socratic Tutor

**File constant:** `SOCRATIC_TUTOR_PROMPT`
**Model:** `claude-opus-4-5`
**Latency target:** < 10s
**Trigger:** Student submits a wrong answer

**The 10 Rules (core of system prompt):**
1. NEVER state the correct answer, even implicitly
2. NEVER say "that's wrong"
3. Always find something right in the student's answer first
4. Questions must expose the specific flaw, not generic confusion
5. Use analogies from Uzbek everyday life
6. Scaffold: easier → harder
7. Final question leads student to self-correct
8. Maximum 4 guiding questions
9. Warm, curious tone like a wise older sibling
10. Output ONLY valid JSON

**The `diagnosed_misconception` field is internal only** — the frontend
should never display it to the student. It helps teachers review
AI reasoning.

**Misconception types (feed from IRT wrong-answer analysis):**
```
"units_confusion"       — e.g., m/s vs m/s²
"sign_error"            — forgot negatives
"formula_misapplication"— right formula, wrong variables
"concept_conflation"    — mixing two related concepts
"calculation_error"     — right method, arithmetic mistake
"incomplete_reasoning"  — partially correct
```

**Example (Physics, acceleration units):**
```
Wrong answer: "5 m/s"   (should be "5 m/s²")
misconception_type: "units_confusion"

Output:
  acknowledgment: "Juda yaxshi — F=ma formulasini to'g'ri ishlatdingiz va
                   50÷10=5 hisobi ham to'g'ri!"

  guiding_questions[0]:
    question: "Tezlanish va tezlik — bular bir xil narsamikaz?
               Ikkalasining birligi nimadan farq qiladi?"
    purpose: "Distinguish velocity (m/s) from acceleration (m/s²)"
```

---

### Prompt 9: Monthly Diagnostic

**File constant:** `MONTHLY_DIAGNOSTIC_PROMPT`
**Model:** `claude-opus-4-5`
**Latency target:** < 30s (large input, complex analysis)
**Trigger:** Monthly cron job (1st of each month, per student)

**Input data structure (session_data_json):**
```json
{
  "sessions": [{
    "date": "2026-03-01",
    "subject": "Matematika",
    "duration_minutes": 25,
    "questions_attempted": 18,
    "correct": 14,
    "theta_start": 0.3,
    "theta_end": 0.5,
    "topics_covered": ["kvadrat tenglamalar"]
  }],
  "streaks": {"current": 7, "longest": 12, "breaks": ["2026-03-14"]},
  "time_distribution": {"by_hour": {"09": 12, "20": 8}, "by_day_of_week": {"Mon": 9}},
  "concept_performance": {
    "kvadrat tenglamalar": {"attempts": 45, "correct_rate": 0.78, "avg_response_time_ms": 12000}
  },
  "flow_state_history": [{"date": "2026-03-01", "state": "flow", "subject": "Matematika"}]
}
```

**Analysis dimensions:**
- Theta trajectory (learning velocity)
- Peak performance time identification
- Optimal session length (correlation with retention)
- Burnout risk signals (session drop-off, declining correct rates, shortened sessions)
- Breakthrough concept identification (high-leverage gaps)

**SMART goal format:**
```json
{
  "goal": "Kvadrat tenglamalar masalalarida 85% ko'rsatkichga erishish",
  "metric": "IRT tizimidagi 'kvadrat tenglamalar' tushunchasida to'g'ri javoblar ulushi",
  "deadline_days": 30,
  "weekly_milestones": [
    "1-hafta: Diskriminant formulasini mukammal o'zlashtirish",
    "2-hafta: So'z masalalarida qo'llash",
    "3-hafta: Aralash masalalar (≥80% ko'rsatkich)",
    "4-hafta: Final Boss savoli"
  ]
}
```

---

## Prompt Engineering Patterns Used Across All 9 Prompts

### 1. JSON-Only Output Enforcement
Every system prompt begins with a variant of:
`"Output ONLY valid JSON — no markdown, no commentary, no code fences."`

This prevents the most common failure mode of smaller models (Mistral/Llama)
wrapping JSON in markdown code fences, which breaks `json.loads()`.

### 2. Count Enforcement
For fixed-count outputs (10 cards, 5 questions), the count appears in BOTH
the system prompt AND the user template. Single-location enforcement causes
off-by-one errors in ~15% of generations.

### 3. Variables in Both System and User
Tier-2/3 prompts repeat critical variables (grade_level, subject) in both
the system and user sections. This helps Claude Haiku/Opus maintain context
for long user templates.

### 4. Internal Fields Not Shown to Students
Fields like `diagnosed_misconception` (Prompt 8) and `expected_answer_hint`
(Prompt 4) are included in the output schema for backend/teacher use but
must be filtered before sending data to the student-facing frontend.

### 5. Cultural Specificity via Hint Variable
The `{cultural_context_hint}` pattern (Prompts 5, 9) allows content managers
to dial in regional specificity without re-engineering the prompt. This is
preferable to hardcoding Uzbek references in the system prompt, which
can feel forced.

### 6. Tier Escalation Logic
```
Wrong answer → Socratic Tutor (Opus) only if:
  - The wrong answer has a diagnosable misconception type
  - Student has answered ≥ 3 questions in this session
  - Not triggered on first attempt (prevent frustration)

Otherwise → simpler hint text generated by Haiku
```

---

## File Structure

```
nets_irt/
  ├── models.py          — IRTItem, StudentAbility, IRTResponse
  ├── irt_math.py        — Pure math: IRTItemParams, EAP, MLE, flow state
  ├── engine.py          — AdaptiveDifficultyEngine service class
  └── tests/
      └── test_irt_math.py  — 20 unit tests (no DB required)

nets_ai/
  └── prompts.py         — All 9 PromptTemplate dataclasses + registry
```
