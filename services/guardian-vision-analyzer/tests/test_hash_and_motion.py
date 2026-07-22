"""
Tests for hashing and motion-score/static-video detection — all pure numpy,
no OpenCV/mediapipe required, no real trained model involved.
"""

import hashlib

import numpy as np

from app.analyzer import (
    STATIC_VIDEO_MOTION_THRESHOLD,
    compute_sha256,
    is_static_video_suspected,
    motion_score,
)


def test_compute_sha256_matches_hashlib_directly():
    data = b"some raw video bytes, not actually a video"
    assert compute_sha256(data) == hashlib.sha256(data).hexdigest()


def test_compute_sha256_differs_for_different_bytes():
    assert compute_sha256(b"a") != compute_sha256(b"b")


def test_motion_score_zero_for_identical_frames():
    frame = np.full((10, 10, 3), 128, dtype=np.uint8)
    frames = [frame.copy() for _ in range(5)]
    assert motion_score(frames) == 0.0


def test_motion_score_zero_for_fewer_than_two_frames():
    frame = np.full((10, 10, 3), 128, dtype=np.uint8)
    assert motion_score([]) == 0.0
    assert motion_score([frame]) == 0.0


def test_motion_score_positive_for_injected_diffs():
    base = np.full((10, 10, 3), 100, dtype=np.uint8)
    shifted = np.full((10, 10, 3), 150, dtype=np.uint8)
    frames = [base, shifted, base, shifted]
    score = motion_score(frames)
    assert score > 0.0
    # Mean abs diff of 50 across all channels / 255 (luma weights sum to 1,
    # applied uniformly across equal R=G=B channels, so the luma diff is
    # also exactly 50).
    assert abs(score - (50.0 / 255.0)) < 1e-6


def test_motion_score_higher_for_larger_diffs():
    base = np.full((10, 10, 3), 100, dtype=np.uint8)
    small_shift = np.full((10, 10, 3), 110, dtype=np.uint8)
    large_shift = np.full((10, 10, 3), 200, dtype=np.uint8)
    small_score = motion_score([base, small_shift, base, small_shift])
    large_score = motion_score([base, large_shift, base, large_shift])
    assert large_score > small_score


def test_motion_score_handles_grayscale_2d_frames():
    frame_a = np.full((8, 8), 50, dtype=np.uint8)
    frame_b = np.full((8, 8), 80, dtype=np.uint8)
    score = motion_score([frame_a, frame_b])
    assert score > 0.0


def test_static_video_suspected_true_below_threshold():
    assert is_static_video_suspected(0.0) is True
    assert is_static_video_suspected(STATIC_VIDEO_MOTION_THRESHOLD - 0.001) is True


def test_static_video_suspected_false_at_or_above_threshold():
    assert is_static_video_suspected(STATIC_VIDEO_MOTION_THRESHOLD) is False
    assert is_static_video_suspected(0.5) is False


def test_static_video_suspected_end_to_end_with_frozen_frame_sequence():
    frozen_frame = np.full((16, 16, 3), 90, dtype=np.uint8)
    frames = [frozen_frame.copy() for _ in range(10)]
    score = motion_score(frames)
    assert is_static_video_suspected(score) is True


def test_static_video_suspected_end_to_end_with_moving_frame_sequence():
    rng = np.random.default_rng(seed=42)
    frames = [
        rng.integers(0, 256, size=(16, 16, 3), dtype=np.uint8) for _ in range(10)
    ]
    score = motion_score(frames)
    assert is_static_video_suspected(score) is False
