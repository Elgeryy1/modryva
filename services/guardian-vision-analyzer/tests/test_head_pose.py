"""
Tests for rotation-matrix decomposition and orientation bucketing — mirrors
apps/web/lib/guardian-vision/head-pose.test.ts's EXACT hand-built rotation
matrices and expected angles, so both implementations are verifiably
consistent with each other. Pure math, no mediapipe/OpenCV/real face
involved.
"""

import math

import pytest

from app.analyzer import (
    HeadPoseDeg,
    classify_orientation,
    decompose_rotation_matrix,
    flatten_column_major,
)


def _to_rad(deg: float) -> float:
    return deg * math.pi / 180.0


def _yaw_matrix(deg: float) -> list[float]:
    t = _to_rad(deg)
    c, s = math.cos(t), math.sin(t)
    # Ry: col0=[c,0,-s] col1=[0,1,0] col2=[s,0,c] — identical to
    # head-pose.test.ts's yawMatrix.
    return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]


def _pitch_matrix(deg: float) -> list[float]:
    t = _to_rad(deg)
    c, s = math.cos(t), math.sin(t)
    # Rx: col0=[1,0,0] col1=[0,c,s] col2=[0,-s,c]
    return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]


def _roll_matrix(deg: float) -> list[float]:
    t = _to_rad(deg)
    c, s = math.cos(t), math.sin(t)
    # Rz: col0=[c,s,0] col1=[-s,c,0] col2=[0,0,1]
    return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]


def test_recovers_pure_yaw_rotation_exactly():
    pose = decompose_rotation_matrix(_yaw_matrix(25))
    assert pose.yaw_deg == pytest.approx(25, abs=1e-4)
    assert pose.pitch_deg == pytest.approx(0, abs=1e-4)
    assert pose.roll_deg == pytest.approx(0, abs=1e-4)


def test_recovers_pure_negative_yaw_rotation_exactly():
    pose = decompose_rotation_matrix(_yaw_matrix(-30))
    assert pose.yaw_deg == pytest.approx(-30, abs=1e-4)


def test_recovers_pure_pitch_rotation_exactly():
    pose = decompose_rotation_matrix(_pitch_matrix(18))
    assert pose.pitch_deg == pytest.approx(18, abs=1e-4)
    assert pose.yaw_deg == pytest.approx(0, abs=1e-4)
    assert pose.roll_deg == pytest.approx(0, abs=1e-4)


def test_recovers_pure_roll_rotation_exactly():
    pose = decompose_rotation_matrix(_roll_matrix(10))
    assert pose.roll_deg == pytest.approx(10, abs=1e-4)
    assert pose.yaw_deg == pytest.approx(0, abs=1e-4)
    assert pose.pitch_deg == pytest.approx(0, abs=1e-4)


def test_identity_matrix_is_dead_center():
    identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    pose = decompose_rotation_matrix(identity)
    assert pose.yaw_deg == pytest.approx(0, abs=1e-4)
    assert pose.pitch_deg == pytest.approx(0, abs=1e-4)
    assert pose.roll_deg == pytest.approx(0, abs=1e-4)


def test_gimbal_lock_near_90_deg_pitch_does_not_throw():
    pose = decompose_rotation_matrix(_pitch_matrix(89.9999999))
    assert math.isfinite(pose.yaw_deg)
    assert math.isfinite(pose.pitch_deg)
    assert math.isfinite(pose.roll_deg)


def test_classifies_near_zero_pose_as_center():
    assert classify_orientation(HeadPoseDeg(0, 0, 0)) == "center"


def test_classifies_small_yaw_within_tolerance_as_center():
    assert classify_orientation(HeadPoseDeg(8, 0, 0)) == "center"


def test_classifies_large_positive_yaw_as_right():
    assert classify_orientation(HeadPoseDeg(25, 0, 0)) == "right"


def test_classifies_large_negative_yaw_as_left():
    assert classify_orientation(HeadPoseDeg(-25, 0, 0)) == "left"


def test_classifies_strongly_negative_pitch_as_up_regardless_of_yaw():
    assert classify_orientation(HeadPoseDeg(20, -20, 0)) == "up"


def test_flatten_column_major_converts_row_major_matrix_correctly():
    # A row-major 4x4 (rows[row][col]) where each element encodes its own
    # (row, col) as row*10+col, so the expected flat column-major output is
    # easy to hand-verify: flat[col*4+row] should equal row*10+col.
    rows = [[r * 10 + c for c in range(4)] for r in range(4)]
    flat = flatten_column_major(rows)
    for row in range(4):
        for col in range(4):
            assert flat[col * 4 + row] == row * 10 + col


def test_flatten_column_major_then_decompose_matches_direct_yaw_matrix():
    # Sanity check that flatten_column_major's convention is the exact
    # inverse of how the hand-built matrices above are already flattened:
    # building the yaw matrix as nested rows and flattening it must produce
    # the same flat array as _yaw_matrix's direct construction.
    deg = 22.0
    flat_direct = _yaw_matrix(deg)
    # Reconstruct the equivalent row-major nested form from the same
    # trig values used in _yaw_matrix, then flatten and compare.
    t = _to_rad(deg)
    c, s = math.cos(t), math.sin(t)
    rows = [
        [c, 0, s, 0],
        [0, 1, 0, 0],
        [-s, 0, c, 0],
        [0, 0, 0, 1],
    ]
    flat_via_helper = flatten_column_major(rows)
    for a, b in zip(flat_direct, flat_via_helper):
        assert a == pytest.approx(b, abs=1e-9)
