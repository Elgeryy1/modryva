"""
Tests for the overall status decision and the liveness/replay-risk
heuristics — all plain arithmetic over already-computed signals, no
mediapipe/OpenCV/real model involved.
"""

import pytest

from app.analyzer import (
    QUALITY_FLOOR,
    compute_liveness_score,
    compute_replay_risk,
    decide_status,
    mode_face_count,
)


# --------------------------------------------------------------------------
# mode_face_count
# --------------------------------------------------------------------------


def test_mode_face_count_returns_none_for_empty_input():
    assert mode_face_count([]) is None


def test_mode_face_count_returns_most_common_value():
    assert mode_face_count([1, 1, 1, 0, 2]) == 1


def test_mode_face_count_ignores_a_single_noisy_zero_frame():
    assert mode_face_count([1, 1, 1, 1, 0]) == 1


# --------------------------------------------------------------------------
# decide_status
# --------------------------------------------------------------------------


def _all_ok_kwargs(**overrides):
    base = dict(
        face_count_mode=1,
        multiple_faces_detected=False,
        static_video_suspected=False,
        step_matched=[True, True],
        sequence_ok=True,
        quality_score=0.8,
    )
    base.update(overrides)
    return base


def test_decide_status_success_when_everything_checks_out():
    status, codes = decide_status(**_all_ok_kwargs())
    assert status == "success"
    assert codes == ["all_checks_passed"]


def test_decide_status_uncertain_when_no_face_detected():
    status, codes = decide_status(**_all_ok_kwargs(face_count_mode=0))
    assert status == "uncertain"
    assert "no_face_detected" in codes


def test_decide_status_uncertain_when_face_count_none():
    status, codes = decide_status(**_all_ok_kwargs(face_count_mode=None))
    assert status == "uncertain"
    assert "no_face_detected" in codes


def test_decide_status_uncertain_when_multiple_faces_detected():
    status, codes = decide_status(**_all_ok_kwargs(multiple_faces_detected=True))
    assert status == "uncertain"
    assert "multiple_faces_detected" in codes


def test_decide_status_uncertain_when_static_video_suspected():
    status, codes = decide_status(**_all_ok_kwargs(static_video_suspected=True))
    assert status == "uncertain"
    assert "static_video_suspected" in codes


def test_decide_status_uncertain_when_a_step_did_not_match():
    status, codes = decide_status(**_all_ok_kwargs(step_matched=[True, False]))
    assert status == "uncertain"
    assert "step_not_matched" in codes


def test_decide_status_uncertain_when_sequence_not_ok():
    status, codes = decide_status(**_all_ok_kwargs(sequence_ok=False))
    assert status == "uncertain"
    assert "step_sequence_mismatch" in codes


def test_decide_status_uncertain_when_quality_at_or_below_floor():
    status, codes = decide_status(**_all_ok_kwargs(quality_score=QUALITY_FLOOR))
    assert status == "uncertain"
    assert "quality_below_floor" in codes


def test_decide_status_never_returns_success_with_any_single_bad_signal():
    # Sweep one bad signal at a time — success must require ALL of them to
    # be good simultaneously, never just "most" of them.
    bad_variants = [
        dict(face_count_mode=2),
        dict(multiple_faces_detected=True),
        dict(static_video_suspected=True),
        dict(step_matched=[False]),
        dict(sequence_ok=False),
        dict(quality_score=0.1),
    ]
    for variant in bad_variants:
        status, _ = decide_status(**_all_ok_kwargs(**variant))
        assert status != "success"


# --------------------------------------------------------------------------
# compute_liveness_score / compute_replay_risk
# --------------------------------------------------------------------------


def test_liveness_score_is_zero_when_all_inputs_are_zero():
    assert compute_liveness_score(0.0, 0.0, 0.0) == 0.0


def test_liveness_score_increases_with_each_component():
    base = compute_liveness_score(0.0, 0.0, 0.0)
    with_motion = compute_liveness_score(0.15, 0.0, 0.0)
    with_steps = compute_liveness_score(0.0, 1.0, 0.0)
    with_quality = compute_liveness_score(0.0, 0.0, 1.0)
    assert with_motion > base
    assert with_steps > base
    assert with_quality > base


def test_liveness_score_never_leaves_0_1_range():
    assert compute_liveness_score(0.0, 0.0, 0.0) >= 0.0
    assert compute_liveness_score(10.0, 10.0, 10.0) <= 1.0


def test_liveness_score_saturates_motion_component_above_saturation_point():
    at_saturation = compute_liveness_score(0.15, 0.0, 0.0)
    above_saturation = compute_liveness_score(0.5, 0.0, 0.0)
    assert at_saturation == pytest.approx(above_saturation)


def test_replay_risk_high_when_static_video_suspected():
    risk = compute_replay_risk(motion=0.001, static_video_suspected=True)
    assert risk > 0.9


def test_replay_risk_low_constant_when_not_static():
    assert compute_replay_risk(motion=0.2, static_video_suspected=False) == 0.05


def test_replay_risk_never_leaves_0_1_range():
    assert compute_replay_risk(motion=-5.0, static_video_suspected=True) <= 1.0
    assert compute_replay_risk(motion=5.0, static_video_suspected=True) >= 0.0
