"""
Tests for frame quality/lighting scoring — mirrors the exact test cases in
apps/web/lib/guardian-vision/quality.test.ts (black/white/mid-gray/
checkerboard) so both the TS client and this Python service agree on what
"quality" means, computed via numpy on constructed arrays. No OpenCV/
mediapipe/real photograph involved.
"""

import numpy as np
import pytest

from app.analyzer import FrameQuality, estimate_frame_quality, quality_score_from


def _flat_frame(width: int, height: int, gray: int) -> np.ndarray:
    """HxWx3 RGB array of a single gray level, mirroring quality.test.ts's
    `flatBuffer` helper (minus the alpha channel, which this Python API
    doesn't take)."""
    return np.full((height, width, 3), gray, dtype=np.uint8)


def _checkerboard_frame(width: int, height: int) -> np.ndarray:
    """Mirrors quality.test.ts's `checkerboardBuffer`: alternating black/white
    columns every 4 pixels, so subsampling every 4th column lands on
    alternating values, producing high measured sharpness."""
    frame = np.zeros((height, width, 3), dtype=np.uint8)
    for x in range(width):
        gray = 0 if (x // 4) % 2 == 0 else 255
        frame[:, x, :] = gray
    return frame


def test_all_black_frame_reports_zero_brightness_and_sharpness():
    q = estimate_frame_quality(_flat_frame(16, 16, 0))
    assert q.brightness == pytest.approx(0)
    assert q.sharpness == pytest.approx(0)


def test_all_white_frame_reports_full_brightness_and_zero_sharpness():
    q = estimate_frame_quality(_flat_frame(16, 16, 255))
    assert q.brightness == pytest.approx(1)
    assert q.sharpness == pytest.approx(0)


def test_mid_gray_frame_reports_mid_brightness():
    q = estimate_frame_quality(_flat_frame(16, 16, 128))
    assert 0.45 < q.brightness < 0.55


def test_checkerboard_reports_higher_sharpness_than_flat():
    flat = estimate_frame_quality(_flat_frame(32, 32, 128))
    checker = estimate_frame_quality(_checkerboard_frame(32, 32))
    assert checker.sharpness > flat.sharpness


def test_degenerate_zero_size_frame_does_not_throw():
    q = estimate_frame_quality(np.zeros((0, 0, 3), dtype=np.uint8))
    assert q == FrameQuality(brightness=0.0, sharpness=0.0)


def test_quality_score_scores_well_lit_sharp_frame_highly():
    score = quality_score_from(FrameQuality(brightness=0.5, sharpness=1.0))
    assert score == pytest.approx(1)


def test_quality_score_penalizes_near_black_frame():
    score = quality_score_from(FrameQuality(brightness=0.02, sharpness=1.0))
    assert score < 0.7


def test_quality_score_penalizes_blurry_frame():
    sharp = quality_score_from(FrameQuality(brightness=0.5, sharpness=1.0))
    blurry = quality_score_from(FrameQuality(brightness=0.5, sharpness=0.0))
    assert blurry < sharp


def test_quality_score_never_leaves_0_1_range():
    assert quality_score_from(FrameQuality(brightness=0.0, sharpness=0.0)) >= 0.0
    assert quality_score_from(FrameQuality(brightness=1.0, sharpness=1.0)) <= 1.0
