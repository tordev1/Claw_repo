"""
Unit tests for the IRT math layer.
Run with:  python -m pytest nets_irt/tests/test_irt_math.py -v
No Django DB required.
"""
import math
import pytest

from nets_irt.irt_math import (
    IRTItemParams,
    ResponseEntry,
    classify_flow_state,
    estimate_theta_eap,
    estimate_theta_mle,
    target_difficulty_from_theta,
    theta_to_pisa_level,
)


# ------------------------------------------------------------------
# IRTItemParams.p()
# ------------------------------------------------------------------

class TestIRTItemP:
    def test_p_at_b_equals_c_plus_half(self):
        """At theta=b, P should equal c + (1-c)*0.5."""
        item = IRTItemParams(item_id=1, a=1.0, b=0.5, c=0.2)
        expected = 0.2 + 0.8 * 0.5
        assert abs(item.p(0.5) - expected) < 1e-6

    def test_p_increases_with_theta(self):
        item = IRTItemParams(item_id=2, a=1.5, b=0.0, c=0.25)
        p_low  = item.p(-2.0)
        p_mid  = item.p(0.0)
        p_high = item.p(2.0)
        assert p_low < p_mid < p_high

    def test_p_lower_bound_is_c(self):
        item = IRTItemParams(item_id=3, a=2.0, b=0.0, c=0.30)
        assert item.p(-10.0) >= item.c - 1e-6

    def test_p_upper_bound_is_one(self):
        item = IRTItemParams(item_id=4, a=2.0, b=0.0, c=0.0)
        assert item.p(10.0) <= 1.0 + 1e-9

    def test_information_positive(self):
        item = IRTItemParams(item_id=5, a=1.0, b=0.0, c=0.25)
        assert item.information(0.0) > 0


# ------------------------------------------------------------------
# EAP estimation
# ------------------------------------------------------------------

class TestEAP:
    def _make_responses(self, thetas_bs, corrects):
        return [
            ResponseEntry(
                item=IRTItemParams(item_id=i, a=1.0, b=b, c=0.25),
                correct=c,
            )
            for i, ((_, b), c) in enumerate(zip(thetas_bs, corrects))
        ]

    def test_all_correct_raises_theta(self):
        responses = [
            ResponseEntry(IRTItemParams(item_id=i, a=1.0, b=0.0, c=0.25), correct=1)
            for i in range(5)
        ]
        theta, se = estimate_theta_eap(responses)
        assert theta > 0.0, "All correct should yield theta > 0"

    def test_all_wrong_lowers_theta(self):
        responses = [
            ResponseEntry(IRTItemParams(item_id=i, a=1.0, b=0.0, c=0.0), correct=0)
            for i in range(5)
        ]
        theta, se = estimate_theta_eap(responses)
        assert theta < 0.0, "All wrong should yield theta < 0"

    def test_empty_returns_prior_mean(self):
        theta, se = estimate_theta_eap([])
        assert theta == 0.0
        assert se == 1.0

    def test_se_decreases_with_more_items(self):
        base_responses = [
            ResponseEntry(IRTItemParams(item_id=i, a=1.0, b=float(i % 3 - 1), c=0.25), correct=i % 2)
            for i in range(5)
        ]
        _, se5  = estimate_theta_eap(base_responses)
        _, se15 = estimate_theta_eap(base_responses * 3)
        assert se15 < se5


# ------------------------------------------------------------------
# MLE estimation
# ------------------------------------------------------------------

class TestMLE:
    def test_mle_consistent_with_eap_for_long_sequence(self):
        """For 20+ items, MLE and EAP should agree within 0.5 logits."""
        responses = [
            ResponseEntry(
                IRTItemParams(item_id=i, a=1.0, b=float(i % 5 - 2) * 0.4, c=0.2),
                correct=1 if i % 3 != 0 else 0,
            )
            for i in range(20)
        ]
        theta_eap, _ = estimate_theta_eap(responses)
        theta_mle, _ = estimate_theta_mle(responses)
        assert abs(theta_eap - theta_mle) < 0.5


# ------------------------------------------------------------------
# Flow state
# ------------------------------------------------------------------

class TestFlowState:
    def test_flow_zone(self):
        assert classify_flow_state(4, 5) == "flow"   # 80%

    def test_too_easy(self):
        assert classify_flow_state(5, 5) == "too_easy"  # 100%

    def test_too_hard(self):
        assert classify_flow_state(1, 5) == "too_hard"  # 20%

    def test_insufficient_data(self):
        assert classify_flow_state(0, 2) == "flow"  # < 3 items


# ------------------------------------------------------------------
# PISA level mapping
# ------------------------------------------------------------------

class TestPISALevel:
    def test_below_average(self):
        assert theta_to_pisa_level(-1.0) == "2"

    def test_average(self):
        assert theta_to_pisa_level(0.3) == "4"

    def test_high(self):
        assert theta_to_pisa_level(2.0) == "6"

    def test_very_low(self):
        assert theta_to_pisa_level(-3.5) == "below_1b"


# ------------------------------------------------------------------
# Target difficulty selector
# ------------------------------------------------------------------

class TestTargetDifficulty:
    def test_too_easy_increases_difficulty(self):
        b_target, _ = target_difficulty_from_theta(0.0, "too_easy", se=1.0)
        assert b_target > 0.0

    def test_too_hard_decreases_difficulty(self):
        b_target, _ = target_difficulty_from_theta(0.0, "too_hard", se=1.0)
        assert b_target < 0.0

    def test_flow_targets_slightly_below_theta(self):
        b_target, _ = target_difficulty_from_theta(1.0, "flow")
        assert b_target < 1.0

    def test_bounds_respected(self):
        b_target, _ = target_difficulty_from_theta(4.0, "too_easy")
        assert b_target <= 3.5
