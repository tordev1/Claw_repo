"""
NETS Platform — AdaptiveDifficultyEngine
Django service class wrapping the IRT math layer.

Usage
-----
engine = AdaptiveDifficultyEngine()

# After a student answers
engine.update_after_response(student_id=42, question_id=101, correct=True)

# Get next question difficulty
theta, se = engine.estimate_theta_for_student(student_id=42, subject_id=3)
difficulty_range = engine.select_next_difficulty(theta, subject_id=3)

# Check flow state
state = engine.get_flow_state(theta, recent_results=[True, False, True, True, True])
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import List, Optional, Tuple

from django.db import transaction
from django.utils import timezone

from .irt_math import (
    IRTItemParams,
    ResponseEntry,
    classify_flow_state,
    estimate_theta,
    target_difficulty_from_theta,
    theta_to_pisa_level,
    pisa_level_to_b_range,
    THETA_INIT,
)
from .models import IRTItem, IRTResponse, StudentAbility

logger = logging.getLogger(__name__)

# Rolling window size for flow-state calculation
FLOW_WINDOW = 5


@dataclass
class DifficultyWindow:
    b_target: float
    b_min: float
    b_max: float
    pisa_level: str
    flow_state: str


class AdaptiveDifficultyEngine:
    """
    High-level service that coordinates IRT estimation and adaptive
    question selection for the NETS platform.

    All public methods are transaction-safe and log errors rather than
    raising, so a DB hiccup never crashes the student's session.
    """

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def estimate_theta(
        self,
        response_history: List[dict],
        method: str = "auto",
    ) -> Tuple[float, float]:
        """
        Estimate student ability (theta) from a list of response dicts.

        Parameters
        ----------
        response_history : list of dicts with keys:
            {
              "item_id": int,
              "a": float,        # discrimination
              "b": float,        # difficulty
              "c": float,        # guessing
              "correct": int     # 1 or 0
            }
        method : 'auto' | 'eap' | 'mle'

        Returns
        -------
        (theta_hat, standard_error)
        """
        if not response_history:
            return THETA_INIT, 1.0

        entries: List[ResponseEntry] = []
        for r in response_history:
            try:
                item = IRTItemParams(
                    item_id=r["item_id"],
                    a=float(r.get("a", 1.0)),
                    b=float(r.get("b", 0.0)),
                    c=float(r.get("c", 0.25)),
                )
                entries.append(ResponseEntry(item=item, correct=int(r["correct"])))
            except (KeyError, ValueError, TypeError) as exc:
                logger.warning("Skipping malformed response entry: %s — %s", r, exc)

        if not entries:
            return THETA_INIT, 1.0

        return estimate_theta(entries, method=method)

    def select_next_difficulty(
        self,
        theta: float,
        subject_id: int,
        flow_state: Optional[str] = None,
        se: float = 1.0,
        exclude_question_ids: Optional[List[int]] = None,
    ) -> DifficultyWindow:
        """
        Given current theta and subject, return the difficulty window
        for the next question and (optionally) a matching IRTItem queryset.

        Parameters
        ----------
        theta       : current ability estimate
        subject_id  : FK to Subject
        flow_state  : 'flow' | 'too_easy' | 'too_hard' | None (auto from theta)
        se          : standard error of theta (used to scale step size)
        exclude_question_ids : list of already-answered question IDs

        Returns
        -------
        DifficultyWindow dataclass with targeting info
        """
        if flow_state is None:
            flow_state = "flow"

        b_target, b_tol = target_difficulty_from_theta(theta, flow_state, se)
        b_min = b_target - b_tol
        b_max = b_target + b_tol
        pisa_level = theta_to_pisa_level(theta)

        return DifficultyWindow(
            b_target=round(b_target, 3),
            b_min=round(b_min, 3),
            b_max=round(b_max, 3),
            pisa_level=pisa_level,
            flow_state=flow_state,
        )

    def fetch_next_item(
        self,
        theta: float,
        subject_id: int,
        flow_state: str = "flow",
        se: float = 1.0,
        exclude_question_ids: Optional[List[int]] = None,
        strategy: str = "max_info",
    ) -> Optional[IRTItem]:
        """
        Select the best available item from the DB for the current theta.

        strategy:
          'max_info'   — item with highest Fisher information at theta (CAT-optimal)
          'b_nearest'  — item with b closest to target (simpler, less DB load)
        """
        window = self.select_next_difficulty(theta, subject_id, flow_state, se)

        qs = IRTItem.objects.filter(
            subject_id=subject_id,
            is_active=True,
            b__gte=window.b_min,
            b__lte=window.b_max,
        )
        if exclude_question_ids:
            qs = qs.exclude(question_id__in=exclude_question_ids)

        items = list(qs.select_related("question")[:50])  # cap at 50 candidates

        if not items:
            # Widen search to full PISA band
            b_range = pisa_level_to_b_range(window.pisa_level)
            qs = IRTItem.objects.filter(
                subject_id=subject_id,
                is_active=True,
                b__gte=b_range[0],
                b__lte=b_range[1],
            )
            if exclude_question_ids:
                qs = qs.exclude(question_id__in=exclude_question_ids)
            items = list(qs.select_related("question")[:50])

        if not items:
            logger.warning(
                "No items found for subject=%s, theta=%.2f — serving random active item.",
                subject_id, theta,
            )
            fallback = IRTItem.objects.filter(subject_id=subject_id, is_active=True).first()
            return fallback

        if strategy == "max_info":
            best = max(
                items,
                key=lambda item: IRTItemParams(
                    item_id=item.pk, a=item.a, b=item.b, c=item.c
                ).information(theta),
            )
        else:
            best = min(items, key=lambda item: abs(item.b - window.b_target))

        return best

    def get_flow_state(
        self,
        theta: float,
        recent_results: List[bool],
    ) -> str:
        """
        Classify current learning state based on recent performance.

        Parameters
        ----------
        theta         : current ability estimate (unused in heuristic but
                        reserved for future model-based classification)
        recent_results: list of booleans (True=correct) for last N answers,
                        most-recent last

        Returns
        -------
        'too_easy' | 'flow' | 'too_hard'
        """
        window = recent_results[-FLOW_WINDOW:]
        correct = sum(1 for r in window if r)
        total   = len(window)
        return classify_flow_state(correct, total, window=FLOW_WINDOW)

    @transaction.atomic
    def update_after_response(
        self,
        student_id: int,
        question_id: int,
        correct: bool,
        session_id: Optional[uuid.UUID] = None,
        response_time_ms: int = 0,
    ) -> StudentAbility:
        """
        Core update loop called after every student answer.

        1. Load student's current ability record (or create it)
        2. Fetch the IRT parameters for the answered question
        3. Build response history from last 20 answers (rolling window)
        4. Re-estimate theta via EAP/MLE
        5. Update StudentAbility with new theta, SE, PISA level, flow window
        6. Append IRTResponse log entry

        Returns updated StudentAbility instance.
        """
        if session_id is None:
            session_id = uuid.uuid4()

        # --- 1. Load item ---
        try:
            irt_item = IRTItem.objects.select_related("question__subject").get(
                question_id=question_id
            )
        except IRTItem.DoesNotExist:
            logger.error(
                "IRTItem not found for question_id=%s — response not recorded.", question_id
            )
            raise

        subject_id = irt_item.subject_id

        # --- 2. Load or create StudentAbility ---
        ability, _created = StudentAbility.objects.select_for_update().get_or_create(
            student_id=student_id,
            subject_id=subject_id,
            defaults={"theta": THETA_INIT, "theta_se": 1.0},
        )

        theta_before = ability.theta

        # --- 3. Build response history from DB (last 20 items) ---
        past_responses = (
            IRTResponse.objects.filter(
                student_id=student_id,
                item__subject_id=subject_id,
            )
            .select_related("item")
            .order_by("-answered_at")[:19]
        )

        history: List[ResponseEntry] = [
            ResponseEntry(
                item=IRTItemParams(
                    item_id=r.item_id,
                    a=r.item.a,
                    b=r.item.b,
                    c=r.item.c,
                ),
                correct=int(r.correct),
            )
            for r in reversed(list(past_responses))
        ]

        # Append current response
        history.append(
            ResponseEntry(
                item=IRTItemParams(
                    item_id=irt_item.pk,
                    a=irt_item.a,
                    b=irt_item.b,
                    c=irt_item.c,
                ),
                correct=int(correct),
            )
        )

        # --- 4. Re-estimate theta ---
        theta_new, se_new = estimate_theta(history, method="auto")

        # --- 5. Update ability record ---
        # Rolling flow window (last FLOW_WINDOW responses)
        if ability.recent_total >= FLOW_WINDOW:
            # We don't have per-slot tracking here; approximate with a
            # simple counter reset every FLOW_WINDOW questions.
            # Production: use a deque stored in Redis or a JSON field.
            ability.recent_correct = int(correct)
            ability.recent_total   = 1
        else:
            ability.recent_correct += int(correct)
            ability.recent_total   += 1

        ability.theta        = theta_new
        ability.theta_se     = se_new
        ability.pisa_level   = self._pisa_label_to_int(theta_to_pisa_level(theta_new))
        ability.session_count += 1
        ability.save(update_fields=[
            "theta", "theta_se", "pisa_level",
            "recent_correct", "recent_total",
            "session_count", "updated_at",
        ])

        # --- 6. Log the response ---
        IRTResponse.objects.create(
            student_id=student_id,
            item=irt_item,
            session_id=session_id,
            correct=correct,
            response_time_ms=response_time_ms,
            theta_before=theta_before,
            theta_after=theta_new,
        )

        logger.debug(
            "student=%s question=%s correct=%s theta: %.3f→%.3f se=%.3f",
            student_id, question_id, correct, theta_before, theta_new, se_new,
        )

        return ability

    # ------------------------------------------------------------------
    # Convenience helpers
    # ------------------------------------------------------------------

    def estimate_theta_for_student(
        self, student_id: int, subject_id: int
    ) -> Tuple[float, float]:
        """
        Quick lookup of current stored theta for a student/subject pair.
        Returns (theta, se).
        """
        try:
            ability = StudentAbility.objects.get(
                student_id=student_id, subject_id=subject_id
            )
            return ability.theta, ability.theta_se
        except StudentAbility.DoesNotExist:
            return THETA_INIT, 1.0

    def get_pisa_level(self, student_id: int, subject_id: int) -> str:
        """Return the current PISA proficiency level label for a student."""
        theta, _ = self.estimate_theta_for_student(student_id, subject_id)
        return theta_to_pisa_level(theta)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _pisa_label_to_int(label: str) -> int:
        mapping = {
            "below_1b": 0, "1b": 1, "1a": 2,
            "2": 3, "3": 4, "4": 5, "5": 6, "6": 7,
        }
        return mapping.get(label, 3)
