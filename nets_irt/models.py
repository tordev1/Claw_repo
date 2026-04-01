"""
NETS Platform — IRT Data Models
Django ORM models for adaptive assessment engine
"""
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class IRTItem(models.Model):
    """
    A calibrated IRT item (question) with 3-PL parameters.
    Parameters are estimated offline via R/mirt or Python/py2irt
    and imported into this table.
    """
    question = models.OneToOneField(
        "questions.Question",   # your existing question model
        on_delete=models.CASCADE,
        related_name="irt_item",
    )
    subject = models.ForeignKey(
        "subjects.Subject",
        on_delete=models.CASCADE,
        related_name="irt_items",
    )

    # 3-PL parameters
    a = models.FloatField(
        default=1.0,
        help_text="Discrimination parameter (0.5–3.0). Higher = more discriminating.",
    )
    b = models.FloatField(
        default=0.0,
        help_text="Difficulty parameter (-3 to +3). 0 = average difficulty.",
    )
    c = models.FloatField(
        default=0.25,
        help_text="Guessing/pseudo-chance parameter (0–0.35).",
    )

    # PISA level tag (1a..6 as integer codes 1–8)
    pisa_level = models.PositiveSmallIntegerField(
        default=3,
        help_text="PISA proficiency level: 1=1b, 2=1a, 3=2, 4=3, 5=4, 6=5, 7=6",
    )

    # Calibration metadata
    calibrated_at = models.DateTimeField(null=True, blank=True)
    sample_size = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "nets_irt_item"
        indexes = [
            models.Index(fields=["subject", "b"]),
            models.Index(fields=["subject", "pisa_level"]),
        ]

    def __str__(self):
        return f"Item(q={self.question_id}, a={self.a:.2f}, b={self.b:.2f}, c={self.c:.2f})"


class StudentAbility(models.Model):
    """
    Persistent theta (ability) estimate per student per subject.
    Updated after every adaptive session.
    """
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="abilities")
    subject = models.ForeignKey(
        "subjects.Subject", on_delete=models.CASCADE, related_name="student_abilities"
    )

    theta = models.FloatField(
        default=0.0,
        help_text="Current MLE/EAP ability estimate on the logit scale.",
    )
    theta_se = models.FloatField(
        default=1.0,
        help_text="Standard error of theta estimate.",
    )

    # PISA level derived from theta
    pisa_level = models.PositiveSmallIntegerField(default=3)

    # Rolling window used for flow-state heuristic
    recent_correct = models.PositiveSmallIntegerField(default=0)
    recent_total = models.PositiveSmallIntegerField(default=0)

    # Timestamps
    updated_at = models.DateTimeField(auto_now=True)
    session_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "nets_student_ability"
        unique_together = [("student", "subject")]

    def success_rate(self) -> float:
        if self.recent_total == 0:
            return 0.75  # assume flow by default
        return self.recent_correct / self.recent_total


class IRTResponse(models.Model):
    """
    Raw response log — never mutated, append-only.
    Used for theta re-estimation and audit.
    """
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="irt_responses")
    item = models.ForeignKey(IRTItem, on_delete=models.CASCADE, related_name="responses")
    session_id = models.UUIDField(db_index=True)

    correct = models.BooleanField()
    response_time_ms = models.PositiveIntegerField(default=0)
    theta_before = models.FloatField()
    theta_after = models.FloatField()

    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "nets_irt_response"
        indexes = [
            models.Index(fields=["student", "item__subject", "answered_at"]),
        ]
