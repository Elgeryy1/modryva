"""
Tests for blink/smile classification from face blendshapes — mirrors the
threshold logic in apps/web/lib/guardian-vision/blink-smile.ts (both eyes
must cross 0.5 together for a blink; both mouth-smile blendshapes must cross
0.4 for a smile). Pure dict lookups, no mediapipe/OpenCV/real face involved.
"""

from app.analyzer import eyes_closed_from_blendshapes, smiling_from_blendshapes


def test_eyes_closed_true_when_both_eyes_above_threshold():
    assert eyes_closed_from_blendshapes(
        {"eyeBlinkLeft": 0.9, "eyeBlinkRight": 0.8}
    ) is True


def test_eyes_closed_false_when_only_one_eye_above_threshold_a_wink():
    assert (
        eyes_closed_from_blendshapes({"eyeBlinkLeft": 0.9, "eyeBlinkRight": 0.1})
        is False
    )


def test_eyes_closed_false_when_missing_entirely():
    assert eyes_closed_from_blendshapes({}) is False


def test_eyes_closed_false_at_exactly_the_threshold():
    assert (
        eyes_closed_from_blendshapes({"eyeBlinkLeft": 0.5, "eyeBlinkRight": 0.5})
        is False
    )


def test_smiling_true_when_both_sides_above_threshold():
    assert smiling_from_blendshapes(
        {"mouthSmileLeft": 0.6, "mouthSmileRight": 0.7}
    ) is True


def test_smiling_false_when_only_one_side_above_threshold():
    assert (
        smiling_from_blendshapes({"mouthSmileLeft": 0.6, "mouthSmileRight": 0.1})
        is False
    )


def test_smiling_false_when_missing_entirely():
    assert smiling_from_blendshapes({}) is False
