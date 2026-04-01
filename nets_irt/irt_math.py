"""
NETS Platform — Pure-math IRT core (no Django imports)
Separated so unit tests run without a database.

3-Parameter Logistic (3-PL) IRT model
======================================
P(correct | theta, a, b, c) = c + (1-c) * sigmoid(a*(theta - b))

Parameters
----------
theta : float   — latent student ability on logit scale, typically [-4, +4]
a     : float   — discrimination (0.5–3.0)
b     : float   — difficulty, the theta at which P = c + (1-c)/2
c     : float   — pseudo-guessing lower asymptote (0–0.35)
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import List, Tuple

import numpy as np

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

THETA_MIN = -4.0
THETA_MAX = +4.0
THETA_INIT = 0.0

# EAP quadrature grid
_QUAD_POINTS = np.linspace(THETA_MIN, THETA_MAX, 41)
_QUAD_WEIGHTS = np.exp(-0.5 * _QUAD_POINTS**2)  # N(0,1) prior (unnormalised)
_QUAD_WEIGHTS /= _QUAD_WEIGHTS.sum()

# PISA level boundaries on the theta (logit) scale
# Based on PISA 2022 linking: score = 500 + 100*(theta/1.7)  → inverted here
PISA_BOUNDARIES: List[Tuple[float, str]] = [
    (-3.00, "below_1b"),
    (-2.20, "1b"),
    (-1.40, "1a"),
    (-0.70, "2"),
    (0.00,  "3"),
    (0.70,  "4"),
    (1.50,  "5"),
    (math.inf, "6"),
]

# Flow-state success-rate thresholds (Csikszentmihalyi)
FLOW_LOW  = 0.60   # below → too hard → lower difficulty
FLOW_HIGH = 0.90   # above → too easy → raise difficulty
FLOW_TARGET_LOW  = 0.70
FLOW_TARGET_HIGH = 0.80


# ---------------------------------------------------------------------------
# Item dataclass
# ---------------------------------------------------------------------------

@dataclass
class IRTItemParams:
    item_id: int
    a: float = 1.0
    b: float = 0.0
    c: float = 0.25

    def p(self, theta: float) -> float:
        """P(correct | theta) using 3-PL formula."""
        z = self.a * (theta - self.b)
        # Clamp z to avoid float overflow in exp
        z = max(-35.0, min(35.0, z))
        return self.c + (1.0 - self.c) / (1.0 + math.exp(-z))

    def p_star(self, theta: float) -> float:
        """Numerator of the logistic without guessing: 1/(1+exp(-az))."""
        z = self.a * (theta - self.b)
        z = max(-35.0, min(35.0, z))
        return 1.0 / (1.0 + math.exp(-z))

    def information(self, theta: float) -> float:
        """Fisher information for this item at theta."""
        p = self.p(theta)
        q = 1.0 - p
        p_star = self.p_star(theta)
        q_star = 1.0 - p_star
        if p < 1e-10 or q < 1e-10:
            return 0.0
        return (self.a**2) * ((1.0 - self.c) ** 2) * (p_star * q_star) ** 2 / (p * q)


# ---------------------------------------------------------------------------
# Response history entry
# ---------------------------------------------------------------------------

@dataclass
class ResponseEntry:
    item: IRTItemParams
    correct: int  # 1 or 0


# ---------------------------------------------------------------------------
# MLE via Newton-Raphson
# ---------------------------------------------------------------------------

def estimate_theta_mle(
    responses: List[ResponseEntry],
    init_theta: float = THETA_INIT,
    max_iter: int = 50,
    tol: float = 1e-6,
) -> Tuple[float, float]:
    """
    Maximum Likelihood Estimation of theta using Newton-Raphson.

    Returns
    -------
    (theta_hat, standard_error)
    """
    if not responses:
        return init_theta, 1.0

    theta = init_theta

    for _ in range(max_iter):
        L1 = 0.0   # first derivative of log-likelihood
        L2 = 0.0   # second derivative (negative Fisher information)

        for r in responses:
            item = r.item
            p     = item.p(theta)
            p_star = item.p_star(theta)
            q_star = 1.0 - p_star
            p = max(p, 1e-10)
            one_minus_p = max(1.0 - p, 1e-10)

            # Numerator weight W = a*(1-c)*p_star*q_star / p
            W = item.a * (1.0 - item.c) * p_star * q_star / p

            L1 += W * (r.correct - p)
            L2 -= W * (
                item.a * (1.0 - item.c) * p_star * q_star
                + W * (r.correct - p)
            ) / p

        # Guard against zero/positive second derivative (shouldn't happen but numerical)
        if abs(L2) < 1e-12:
            break

        delta = L1 / L2
        theta = theta - delta
        theta = max(THETA_MIN, min(THETA_MAX, theta))

        if abs(delta) < tol:
            break

    # Standard error = 1 / sqrt(Fisher information)
    fisher = sum(r.item.information(theta) for r in responses)
    se = 1.0 / math.sqrt(fisher) if fisher > 1e-10 else 1.0
    se = min(se, 2.0)  # cap SE at 2 for early sessions

    return theta, se


# ---------------------------------------------------------------------------
# EAP (Expected A Posteriori) — preferred when n < 10 items
# ---------------------------------------------------------------------------

def estimate_theta_eap(
    responses: List[ResponseEntry],
) -> Tuple[float, float]:
    """
    Expected A Posteriori estimation using Gauss-Hermite quadrature.
    Prior: N(0, 1).  Much more stable than MLE for short response strings.

    Returns
    -------
    (theta_hat, posterior_sd)
    """
    if not responses:
        return THETA_INIT, 1.0

    # Compute log-likelihood at each quadrature point
    log_lik = np.zeros(len(_QUAD_POINTS))
    for r in responses:
        item = r.item
        for k, theta_k in enumerate(_QUAD_POINTS):
            p = item.p(theta_k)
            p = max(min(p, 1 - 1e-10), 1e-10)
            log_lik[k] += r.correct * math.log(p) + (1 - r.correct) * math.log(1 - p)

    # Numerically stable: subtract max before exp
    log_lik -= log_lik.max()
    lik = np.exp(log_lik)

    posterior = lik * _QUAD_WEIGHTS
    posterior_sum = posterior.sum()
    if posterior_sum < 1e-300:
        return THETA_INIT, 1.0

    theta_hat = float(np.dot(posterior, _QUAD_POINTS) / posterior_sum)
    variance   = float(np.dot(posterior, (_QUAD_POINTS - theta_hat) ** 2) / posterior_sum)
    se = math.sqrt(max(variance, 1e-6))

    theta_hat = max(THETA_MIN, min(THETA_MAX, theta_hat))
    return theta_hat, se


# ---------------------------------------------------------------------------
# Auto-selector: EAP for short sequences, MLE for long
# ---------------------------------------------------------------------------

def estimate_theta(
    responses: List[ResponseEntry],
    method: str = "auto",
) -> Tuple[float, float]:
    """
    Estimate theta from response history.
    method: 'eap' | 'mle' | 'auto' (EAP if n<=10, else MLE)
    """
    n = len(responses)
    if method == "eap" or (method == "auto" and n <= 10):
        return estimate_theta_eap(responses)
    return estimate_theta_mle(responses)


# ---------------------------------------------------------------------------
# Flow-state classifier
# ---------------------------------------------------------------------------

def classify_flow_state(
    recent_correct: int,
    recent_total: int,
    window: int = 5,
) -> str:
    """
    Returns 'too_easy' | 'flow' | 'too_hard' based on recent success rate.

    Uses Csikszentmihalyi target zone: 70-80% success.
    Thresholds:
      - > 90% over last window  → too_easy
      - < 60% over last window  → too_hard
      - 60-90%                  → flow
    """
    if recent_total < 3:
        return "flow"  # not enough data yet

    rate = recent_correct / recent_total
    if rate > FLOW_HIGH:
        return "too_easy"
    if rate < FLOW_LOW:
        return "too_hard"
    return "flow"


# ---------------------------------------------------------------------------
# Theta → PISA level
# ---------------------------------------------------------------------------

def theta_to_pisa_level(theta: float) -> str:
    """Map a theta value to its PISA proficiency level label."""
    for boundary, label in PISA_BOUNDARIES:
        if theta < boundary:
            return label
    return "6"


def pisa_level_to_b_range(pisa_level: str) -> Tuple[float, float]:
    """Return the (b_min, b_max) difficulty range for a given PISA level."""
    mapping = {
        "below_1b": (-4.0, -3.0),
        "1b":       (-3.0, -2.2),
        "1a":       (-2.2, -1.4),
        "2":        (-1.4, -0.7),
        "3":        (-0.7,  0.0),
        "4":        ( 0.0,  0.7),
        "5":        ( 0.7,  1.5),
        "6":        ( 1.5,  4.0),
    }
    return mapping.get(pisa_level, (-0.7, 0.7))


# ---------------------------------------------------------------------------
# Next-item difficulty selector
# ---------------------------------------------------------------------------

def target_difficulty_from_theta(
    theta: float,
    flow_state: str,
    se: float = 1.0,
) -> Tuple[float, float]:
    """
    Compute the ideal b-parameter range for the next item.

    Strategy:
    - In flow: target b ≈ theta - 0.5 (slightly below ability → 70-80% success)
    - Too easy: step up by 1 SE
    - Too hard: step down by 1 SE

    Returns (b_target, b_tolerance)
    """
    step = max(0.3, min(se, 1.0))

    if flow_state == "too_easy":
        b_target = theta + step
    elif flow_state == "too_hard":
        b_target = theta - step
    else:
        # Aim slightly below theta so P ≈ 0.75 (mid-flow)
        b_target = theta - 0.4

    b_target = max(THETA_MIN + 0.5, min(THETA_MAX - 0.5, b_target))
    return b_target, 0.8   # ±0.8 tolerance window
