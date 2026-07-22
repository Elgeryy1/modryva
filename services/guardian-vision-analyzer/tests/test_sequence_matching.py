"""
Tests for the sequence/order-matching logic given canned per-frame detection
sequences — no real model, no mediapipe/OpenCV, just hand-built FrameSignal
fixtures standing in for what video_pipeline.analyze_sampled_frames would
have produced from a real video.
"""

from app.analyzer import FrameSignal, StepSpec, match_challenge_steps


def _frame(
    index: int,
    ts: float,
    *,
    face_count: int = 1,
    orientation=None,
    eyes_closed=None,
    smiling=None,
    hand_count: int = 0,
    gesture=None,
) -> FrameSignal:
    return FrameSignal(
        frame_index=index,
        timestamp_ms=ts,
        face_count=face_count,
        orientation=orientation,
        eyes_closed=eyes_closed,
        smiling=smiling,
        hand_count=hand_count,
        gesture=gesture,
    )


def test_matches_two_face_steps_in_correct_order():
    steps = [StepSpec(kind="face", action="look_center"), StepSpec(kind="face", action="turn_right")]
    frames = [
        _frame(0, 0, orientation="center"),
        _frame(1, 100, orientation="center"),
        _frame(2, 200, orientation="right"),
    ]
    outcomes, sequence_ok = match_challenge_steps(steps, frames)
    assert [o.matched for o in outcomes] == [True, True]
    assert sequence_ok is True


def test_step_never_appearing_after_cursor_is_not_matched():
    # Requested order is look_center then turn_right, but the video only
    # ever shows "right" BEFORE the frame that satisfies look_center, and
    # never shows "right" again afterward — turn_right must not match.
    steps = [StepSpec(kind="face", action="look_center"), StepSpec(kind="face", action="turn_right")]
    frames = [
        _frame(0, 0, orientation="right"),
        _frame(1, 100, orientation="center"),
    ]
    outcomes, sequence_ok = match_challenge_steps(steps, frames)
    assert outcomes[0].matched is True  # look_center found at frame 1
    assert outcomes[1].matched is False  # turn_right never found at/after frame 1
    assert sequence_ok is False


def test_hand_gesture_step_matches_via_gesture_field():
    steps = [StepSpec(kind="hand", action="thumbs_up")]
    frames = [
        _frame(0, 0, face_count=0, hand_count=1, gesture=None),
        _frame(1, 100, face_count=0, hand_count=1, gesture="thumbs_up"),
    ]
    outcomes, sequence_ok = match_challenge_steps(steps, frames)
    assert outcomes[0].matched is True
    assert sequence_ok is True


def test_smile_step_requires_single_face_and_smiling_true():
    steps = [StepSpec(kind="face", action="smile")]
    frames = [
        _frame(0, 0, face_count=2, smiling=True),  # two faces: doesn't count
        _frame(1, 100, face_count=1, smiling=False),
        _frame(2, 200, face_count=1, smiling=True),
    ]
    outcomes, _ = match_challenge_steps(steps, frames)
    assert outcomes[0].matched is True


def test_no_frames_means_nothing_matches():
    steps = [StepSpec(kind="face", action="look_center")]
    outcomes, sequence_ok = match_challenge_steps(steps, [])
    assert outcomes[0].matched is False
    assert sequence_ok is False


def test_empty_step_list_reports_sequence_not_ok_by_convention():
    # No steps requested is a degenerate/unexpected input for a real
    # Guardian challenge (always has >=1 step) — document the current
    # behavior explicitly rather than leaving it unspecified.
    outcomes, sequence_ok = match_challenge_steps([], [_frame(0, 0)])
    assert outcomes == []
    assert sequence_ok is False


def test_blink_once_matches_on_closed_to_open_transition():
    steps = [StepSpec(kind="face", action="blink_once")]
    frames = [
        _frame(0, 0, eyes_closed=False),
        _frame(1, 100, eyes_closed=True),
        _frame(2, 200, eyes_closed=False),  # transition completes here
    ]
    outcomes, sequence_ok = match_challenge_steps(steps, frames)
    assert outcomes[0].matched is True
    assert sequence_ok is True


def test_blink_once_not_matched_without_a_transition():
    steps = [StepSpec(kind="face", action="blink_once")]
    frames = [
        _frame(0, 0, eyes_closed=False),
        _frame(1, 100, eyes_closed=True),
        _frame(2, 200, eyes_closed=True),  # stays closed, no transition back open
    ]
    outcomes, _ = match_challenge_steps(steps, frames)
    assert outcomes[0].matched is False


def test_blink_twice_matches_when_both_transitions_within_window():
    steps = [StepSpec(kind="face", action="blink_twice")]
    frames = [
        _frame(0, 0, eyes_closed=False),
        _frame(1, 100, eyes_closed=True),
        _frame(2, 200, eyes_closed=False),  # blink #1 completes at t=200
        _frame(3, 300, eyes_closed=True),
        _frame(4, 400, eyes_closed=False),  # blink #2 completes at t=400 (200ms gap)
    ]
    outcomes, sequence_ok = match_challenge_steps(steps, frames)
    assert outcomes[0].matched is True
    assert sequence_ok is True


def test_blink_twice_not_matched_when_transitions_too_far_apart():
    steps = [StepSpec(kind="face", action="blink_twice")]
    frames = [
        _frame(0, 0, eyes_closed=False),
        _frame(1, 100, eyes_closed=True),
        _frame(2, 200, eyes_closed=False),  # blink #1 at t=200
        _frame(3, 3000, eyes_closed=True),
        _frame(4, 3100, eyes_closed=False),  # blink #2 at t=3100 -> 2900ms gap, > 1800ms window
    ]
    outcomes, _ = match_challenge_steps(steps, frames)
    assert outcomes[0].matched is False


def test_multi_step_sequence_with_mixed_face_and_hand_steps():
    steps = [
        StepSpec(kind="face", action="look_center"),
        StepSpec(kind="hand", action="victory"),
        StepSpec(kind="face", action="turn_left"),
    ]
    frames = [
        _frame(0, 0, orientation="center"),
        _frame(1, 100, hand_count=1, gesture="victory", face_count=0),
        _frame(2, 200, orientation="left"),
    ]
    outcomes, sequence_ok = match_challenge_steps(steps, frames)
    assert [o.matched for o in outcomes] == [True, True, True]
    assert sequence_ok is True
