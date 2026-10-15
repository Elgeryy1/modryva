"""
Tests for hand-landmark finger-count classification and gesture-category
mapping — mirrors apps/web/lib/guardian-vision/hand-gesture.test.ts's exact
fixtures (a 21-point landmark set with wrist at the origin and each finger's
tip/pip explicitly placed near or far from the wrist). Pure math, no
mediapipe/OpenCV/real hand involved.
"""

from typing import Optional

from app.analyzer import (
    ExtendedFingers,
    HandLandmarkPoint,
    classify_finger_count_gesture,
    detect_extended_fingers,
    map_gesture_category,
)


def _p(x: float, y: float, z: float = 0.0) -> HandLandmarkPoint:
    return HandLandmarkPoint(x=x, y=y, z=z)


def _build_hand(
    thumb: bool = False,
    index: bool = False,
    middle: bool = False,
    ring: bool = False,
    pinky: bool = False,
) -> list[HandLandmarkPoint]:
    """Builds a 21-point landmark set with the wrist at the origin and each
    finger's tip/pip explicitly placed — near (folded) or far (extended)
    from the wrist — so every other landmark is irrelevant filler at a fixed
    "resting" distance, matching hand-gesture.test.ts's `buildHand` helper
    exactly."""
    points: list[HandLandmarkPoint] = [_p(0.05, 0.05) for _ in range(21)]
    points[0] = _p(0, 0)  # wrist

    def set_finger(tip: int, pip: int, is_extended: bool) -> None:
        points[pip] = _p(0.05, 0.05)
        points[tip] = _p(1, 1) if is_extended else _p(0.03, 0.03)

    set_finger(4, 2, thumb)
    set_finger(8, 6, index)
    set_finger(12, 10, middle)
    set_finger(16, 14, ring)
    set_finger(20, 18, pinky)
    return points


def test_detect_extended_fingers_returns_none_for_too_few_landmarks():
    assert detect_extended_fingers([_p(0, 0)]) is None


def test_detect_extended_fingers_detects_all_folded_fist():
    fingers = detect_extended_fingers(_build_hand())
    assert fingers == ExtendedFingers(
        thumb=False, index=False, middle=False, ring=False, pinky=False
    )


def test_detect_extended_fingers_detects_single_extended_index():
    fingers = detect_extended_fingers(_build_hand(index=True))
    assert fingers is not None
    assert fingers.index is True
    assert fingers.middle is False


def test_detect_extended_fingers_detects_all_extended_open_palm():
    fingers = detect_extended_fingers(
        _build_hand(thumb=True, index=True, middle=True, ring=True, pinky=True)
    )
    assert fingers == ExtendedFingers(
        thumb=True, index=True, middle=True, ring=True, pinky=True
    )


def test_classify_exactly_index_as_show_one_finger():
    assert (
        classify_finger_count_gesture(_build_hand(index=True)) == "show_one_finger"
    )


def test_classify_index_and_middle_as_show_two_fingers():
    assert (
        classify_finger_count_gesture(_build_hand(index=True, middle=True))
        == "show_two_fingers"
    )


def test_classify_index_middle_ring_as_show_three_fingers():
    assert (
        classify_finger_count_gesture(
            _build_hand(index=True, middle=True, ring=True)
        )
        == "show_three_fingers"
    )


def test_classify_returns_none_for_closed_fist():
    assert classify_finger_count_gesture(_build_hand()) is None


def test_classify_returns_none_for_open_palm_not_a_counting_gesture():
    result: Optional[str] = classify_finger_count_gesture(
        _build_hand(thumb=True, index=True, middle=True, ring=True, pinky=True)
    )
    assert result is None


def test_classify_returns_none_when_pinky_also_extended_alongside_three():
    result = classify_finger_count_gesture(
        _build_hand(index=True, middle=True, ring=True, pinky=True)
    )
    assert result is None


def test_map_gesture_category_maps_the_four_builtin_categories():
    assert map_gesture_category("Thumb_Up") == "thumbs_up"
    assert map_gesture_category("Victory") == "victory"
    assert map_gesture_category("Open_Palm") == "open_palm"
    assert map_gesture_category("Closed_Fist") == "closed_fist"


def test_map_gesture_category_returns_none_for_unused_categories():
    assert map_gesture_category("Pointing_Up") is None
    assert map_gesture_category("Thumb_Down") is None
    assert map_gesture_category("ILoveYou") is None
    assert map_gesture_category("None") is None
