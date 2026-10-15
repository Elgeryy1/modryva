"""
Pure, dependency-light analysis logic for Guardian Vision Analyzer.

Everything in this module depends on nothing but the Python standard library
and numpy — no OpenCV, no mediapipe, no filesystem, no network. That is a
deliberate design choice, not an accident: it means every function here is
unit-testable in isolation, with hand-built fixtures, in a plain Python
environment that may not even have OpenCV/mediapipe installed (both are
heavy, platform-specific, and slow to install). The actual video decoding and
model inference (which DO need OpenCV + mediapipe) live in
`video_pipeline.py`, which imports this module and calls into it.

Several functions here are DELIBERATE PORTS of the reference TypeScript
implementation the browser client already uses (apps/web/lib/guardian-vision/
{head-pose,hand-gesture,quality}.ts), so the server's independent re-derivation
of a signal uses the exact same definitions/thresholds as the client. Where a
function mirrors a specific TS file, the docstring says so explicitly.

Nothing in this module fabricates a signal it cannot actually compute: any
function that cannot produce a meaningful answer from its input returns
`None` (or an honest low-confidence value), never a made-up number. Score
formulas that are heuristics (not calibrated ML confidences) say so plainly
in their docstrings, per this project's "never fabricate AI confidence
scores" rule.
"""

from __future__ import annotations

import hashlib
import math
from collections import Counter
from dataclasses import dataclass
from typing import Literal, Optional, Sequence

import numpy as np

# --------------------------------------------------------------------------
# 1. Hashing
# --------------------------------------------------------------------------


def compute_sha256(data: bytes) -> str:
    """Real SHA-256 of the raw uploaded bytes, for the Node side to
    cross-check against whatever it separately hashed and stored. No
    normalization/re-encoding happens before hashing — this must be the exact
    bytes that were uploaded."""
    return hashlib.sha256(data).hexdigest()


# --------------------------------------------------------------------------
# 2. Motion score / static-video (anti-replay-of-a-frozen-frame) detection
# --------------------------------------------------------------------------


def _to_grayscale(frame: np.ndarray) -> np.ndarray:
    """Converts an HxW (already grayscale) or HxWx3 array to grayscale using
    the same luma weights as the quality module (0.299R+0.587G+0.114B),
    assuming channel order [R, G, B] when a 3rd dimension is present. Callers
    passing OpenCV's native BGR frames must convert to RGB first (see
    video_pipeline.py) — kept here channel-order-agnostic on purpose so this
    function has no OpenCV dependency."""
    if frame.ndim == 2:
        return frame.astype(np.float64)
    if frame.ndim == 3 and frame.shape[2] >= 3:
        r = frame[:, :, 0].astype(np.float64)
        g = frame[:, :, 1].astype(np.float64)
        b = frame[:, :, 2].astype(np.float64)
        return 0.299 * r + 0.587 * g + 0.114 * b
    raise ValueError(f"unsupported frame shape: {frame.shape}")


def motion_score(frames: Sequence[np.ndarray]) -> float:
    """Mean frame-to-frame pixel difference, normalized to 0..1: for each
    consecutive pair of sampled frames, take the mean absolute grayscale
    difference (0..255) and divide by 255, then average across all pairs.

    This is a REAL signal computed from real pixels — not a placeholder — but
    it is a basic heuristic: it tells you "how much did the picture change
    frame to frame", which is a reasonable proxy for "is this a live feed"
    but is NOT a liveness/deepfake classifier. A sophisticated attacker
    replaying a *moving* pre-recorded video of a different session would
    still show normal motion and would NOT be caught by this check alone —
    see `is_static_video_suspected`'s docstring for the same caveat.

    Returns 0.0 (not None) when fewer than 2 frames are available — there is
    no frame-to-frame difference to measure, and 0.0 is the honest answer for
    "no motion could be observed", which correctly feeds into
    staticVideoSuspected.
    """
    if len(frames) < 2:
        return 0.0
    diffs: list[float] = []
    prev = _to_grayscale(frames[0])
    for frame in frames[1:]:
        current = _to_grayscale(frame)
        if current.shape != prev.shape:
            # Defensive: a decode glitch producing a differently-sized frame
            # shouldn't crash analysis; skip this pair rather than guess.
            prev = current
            continue
        diffs.append(float(np.mean(np.abs(current - prev))) / 255.0)
        prev = current
    if not diffs:
        return 0.0
    return float(np.mean(diffs))


STATIC_VIDEO_MOTION_THRESHOLD = 0.02


def is_static_video_suspected(
    motion: float, threshold: float = STATIC_VIDEO_MOTION_THRESHOLD
) -> bool:
    """True when `motion_score` is near zero across the whole clip despite
    multiple frames having been sampled — the basic anti-replay/anti-static-
    image check: a frozen or near-frozen frame (e.g. a printed photo held up
    to the camera, or a single still image looped) produces almost no
    frame-to-frame difference.

    HONESTY CAVEAT: this does NOT catch a sophisticated screen replay of an
    actual moving video (e.g. playing a previously-recorded real session on a
    second device pointed at the camera) — that has completely normal motion
    and will NOT be flagged here. This only catches the crude "static image"
    case.
    """
    return motion < threshold


# --------------------------------------------------------------------------
# 3. Frame quality / lighting — mirrors apps/web/lib/guardian-vision/quality.ts
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class FrameQuality:
    brightness: float
    sharpness: float


_SAMPLE_STEP = 4


def estimate_frame_quality(frame_rgb: np.ndarray) -> FrameQuality:
    """Port of `estimateFrameQuality` in quality.ts: subsamples every 4th
    pixel in both axes, computes mean luminance (0..1) as brightness, and a
    Laplacian-like sharpness proxy (mean absolute difference between
    horizontally-adjacent luma samples in the subsampled grid, normalized),
    row boundaries excluded so a difference is never taken across a
    wrap-around row edge — same algorithm, same thresholds, same intent as
    the TS version, so both sides agree on what "quality" means. Not a
    publication-grade metric; just enough to reject "too dark"/"too blurry"
    captures without a second ML model.

    `frame_rgb` must be an HxWx3 array in RGB channel order (uint8 or
    equivalent), matching the TS version's R,G,B channel reads.
    """
    if frame_rgb.ndim != 3 or frame_rgb.shape[0] <= 0 or frame_rgb.shape[1] <= 0:
        return FrameQuality(brightness=0.0, sharpness=0.0)

    height, width = frame_rgb.shape[0], frame_rgb.shape[1]
    sampled = frame_rgb[0:height:_SAMPLE_STEP, 0:width:_SAMPLE_STEP, :3].astype(
        np.float64
    )
    row_width = sampled.shape[1]
    if row_width == 0 or sampled.shape[0] == 0:
        return FrameQuality(brightness=0.0, sharpness=0.0)

    luma = (
        0.299 * sampled[:, :, 0] + 0.587 * sampled[:, :, 1] + 0.114 * sampled[:, :, 2]
    )
    brightness = float(np.mean(luma)) / 255.0

    if row_width < 2:
        sharpness = 0.0
    else:
        # Horizontally-adjacent diffs within each subsampled row — mirrors
        # the TS loop's "skip row boundaries" behavior by only ever diffing
        # columns [0..row_width-2] against [1..row_width-1] (never across
        # rows), matching the flattened-list skip-logic in quality.ts.
        diffs = np.abs(luma[:, :-1] - luma[:, 1:])
        sharpness = min(1.0, float(np.mean(diffs)) / 40.0)

    return FrameQuality(brightness=brightness, sharpness=float(sharpness))


def quality_score_from(quality: FrameQuality) -> float:
    """Port of `qualityScoreFrom` in quality.ts: combines brightness +
    sharpness into a single 0..1 score, penalizing both under/over-exposure
    and low sharpness (blur/motion/out of focus). Same formula as the TS
    side so both sides use the same metric definition."""
    if quality.brightness < 0.15 or quality.brightness > 0.95:
        brightness_score = 0.2
    else:
        brightness_score = 1 - abs(quality.brightness - 0.5) * 0.6
    return min(1.0, max(0.0, brightness_score * 0.5 + quality.sharpness * 0.5))


# --------------------------------------------------------------------------
# 4. Head-pose decomposition + orientation bucketing — mirrors
#    apps/web/lib/guardian-vision/head-pose.ts EXACTLY (same convention, same
#    thresholds), so both implementations are verifiably consistent.
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class HeadPoseDeg:
    yaw_deg: float
    pitch_deg: float
    roll_deg: float


FaceOrientation = Literal["center", "left", "right", "up"]

# Sign convention caveat carried over verbatim from head-pose.ts: the MATH
# here is verified (round-trips pure X/Y/Z rotations back to the exact input
# angle — see tests/test_head_pose.py), but which physical head movement
# (turning toward the phone's left vs right) produces a positive vs negative
# yaw has NOT been empirically confirmed against a live camera. Keep this in
# sync with FACE_YAW_SIGN in head-pose.ts if that ever flips.
_FACE_YAW_SIGN = 1


def decompose_rotation_matrix(m: Sequence[float]) -> HeadPoseDeg:
    """Decomposes a facial transformation matrix (a 16-element COLUMN-MAJOR
    4x4, model-space -> camera-space, i.e. `m[col*4 + row]`) into yaw/pitch/
    roll degrees using the standard XYZ Euler extraction — byte-for-byte the
    same convention and formulas as `decomposeRotationMatrix` in
    head-pose.ts. `m` must already be in this flat column-major layout; see
    `flatten_column_major` for converting a mediapipe 4x4 row-major numpy
    matrix into it.
    """
    m11 = m[0] if len(m) > 0 else 0.0
    m12 = m[4] if len(m) > 4 else 0.0
    m13 = m[8] if len(m) > 8 else 0.0
    m22 = m[5] if len(m) > 5 else 0.0
    m23 = m[9] if len(m) > 9 else 0.0
    m32 = m[6] if len(m) > 6 else 0.0
    m33 = m[10] if len(m) > 10 else 0.0

    clamped = min(1.0, max(-1.0, m13))
    yaw = math.asin(clamped)
    if abs(m13) < 0.9999999:
        pitch = math.atan2(-m23, m33)
        roll = math.atan2(-m12, m11)
    else:
        # Gimbal lock (looking almost straight up/down): roll and yaw become
        # coupled, so roll is conventionally pinned to 0 — same as head-pose.ts.
        pitch = math.atan2(m32, m22)
        roll = 0.0

    to_deg = lambda rad: (rad * 180.0) / math.pi  # noqa: E731
    return HeadPoseDeg(
        yaw_deg=to_deg(yaw) * _FACE_YAW_SIGN,
        pitch_deg=to_deg(pitch),
        roll_deg=to_deg(roll),
    )


def flatten_column_major(matrix_rows: Sequence[Sequence[float]]) -> list[float]:
    """Converts a 4x4 matrix given as a row-major sequence of rows (e.g. a
    mediapipe/numpy `m[row][col]`-indexed 4x4 array) into the flat
    column-major layout `decompose_rotation_matrix` expects
    (`flat[col*4+row] = matrix_rows[row][col]`)."""
    flat = [0.0] * 16
    for row in range(4):
        for col in range(4):
            flat[col * 4 + row] = float(matrix_rows[row][col])
    return flat


_YAW_THRESHOLD_DEG = 15.0
_PITCH_UP_THRESHOLD_DEG = -12.0


def classify_orientation(pose: HeadPoseDeg) -> FaceOrientation:
    """Buckets a decomposed head pose into the coarse orientations Guardian's
    challenge steps ask for — identical thresholds/priority order to
    `classifyOrientation` in head-pose.ts ("up" takes priority over
    left/right so a step asking to look up isn't accidentally satisfied by a
    diagonal turn)."""
    if pose.pitch_deg < _PITCH_UP_THRESHOLD_DEG:
        return "up"
    if pose.yaw_deg > _YAW_THRESHOLD_DEG:
        return "right"
    if pose.yaw_deg < -_YAW_THRESHOLD_DEG:
        return "left"
    return "center"


# --------------------------------------------------------------------------
# 5. Blink / smile from face blendshapes — mirrors
#    apps/web/lib/guardian-vision/blink-smile.ts
# --------------------------------------------------------------------------

_BLINK_THRESHOLD = 0.5
_SMILE_THRESHOLD = 0.4


def _score_for(blendshapes: dict[str, float], name: str) -> float:
    return blendshapes.get(name, 0.0)


def eyes_closed_from_blendshapes(blendshapes: dict[str, float]) -> bool:
    """Both eyes must cross the threshold together — a wink alone doesn't
    count, same rule as blink-smile.ts. `blendshapes` maps a category name
    (e.g. "eyeBlinkLeft") to its 0..1 score, as produced by mediapipe's
    FaceLandmarker blendshape output."""
    return (
        _score_for(blendshapes, "eyeBlinkLeft") > _BLINK_THRESHOLD
        and _score_for(blendshapes, "eyeBlinkRight") > _BLINK_THRESHOLD
    )


def smiling_from_blendshapes(blendshapes: dict[str, float]) -> bool:
    return (
        _score_for(blendshapes, "mouthSmileLeft") > _SMILE_THRESHOLD
        and _score_for(blendshapes, "mouthSmileRight") > _SMILE_THRESHOLD
    )


# --------------------------------------------------------------------------
# 6. Hand gesture / finger counting — mirrors
#    apps/web/lib/guardian-vision/hand-gesture.ts
# --------------------------------------------------------------------------

HandGesture = Literal[
    "thumbs_up",
    "victory",
    "open_palm",
    "closed_fist",
    "show_one_finger",
    "show_two_fingers",
    "show_three_fingers",
]

_GESTURE_CATEGORY_TO_ACTION: dict[str, HandGesture] = {
    "Thumb_Up": "thumbs_up",
    "Victory": "victory",
    "Open_Palm": "open_palm",
    "Closed_Fist": "closed_fist",
}


def map_gesture_category(category_name: str) -> Optional[HandGesture]:
    """Maps GestureRecognizer's built-in trained categories to Guardian's
    action names — a real trained-model classification, not a heuristic,
    same mapping as hand-gesture.ts."""
    return _GESTURE_CATEGORY_TO_ACTION.get(category_name)


@dataclass(frozen=True)
class HandLandmarkPoint:
    x: float
    y: float
    z: float


@dataclass(frozen=True)
class ExtendedFingers:
    thumb: bool
    index: bool
    middle: bool
    ring: bool
    pinky: bool


_WRIST = 0
# [tipIndex, pipIndex] per finger, MediaPipe's 21-point hand landmark
# numbering (0=wrist, thumb=1-4, index=5-8, middle=9-12, ring=13-16,
# pinky=17-20) — identical to FINGER_JOINTS in hand-gesture.ts.
_FINGER_JOINTS: dict[str, tuple[int, int]] = {
    "thumb": (4, 2),
    "index": (8, 6),
    "middle": (12, 10),
    "ring": (16, 14),
    "pinky": (20, 18),
}

_EXTENSION_MARGIN = 1.1


def _distance(a: HandLandmarkPoint, b: HandLandmarkPoint) -> float:
    return math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)


def detect_extended_fingers(
    landmarks: Sequence[HandLandmarkPoint],
) -> Optional[ExtendedFingers]:
    """A finger is "extended" when its tip sits further from the wrist than
    its pip/ip joint by a margin — robust to hand rotation/orientation,
    identical heuristic (and margin) to `detectExtendedFingers` in
    hand-gesture.ts. Requires at least 21 landmarks (MediaPipe's full hand
    landmark set); returns None otherwise rather than guessing."""
    if len(landmarks) < 21:
        return None
    wrist = landmarks[_WRIST]

    def is_extended(tip_index: int, pip_index: int) -> bool:
        tip = landmarks[tip_index]
        pip = landmarks[pip_index]
        return _distance(tip, wrist) > _distance(pip, wrist) * _EXTENSION_MARGIN

    return ExtendedFingers(
        thumb=is_extended(*_FINGER_JOINTS["thumb"]),
        index=is_extended(*_FINGER_JOINTS["index"]),
        middle=is_extended(*_FINGER_JOINTS["middle"]),
        ring=is_extended(*_FINGER_JOINTS["ring"]),
        pinky=is_extended(*_FINGER_JOINTS["pinky"]),
    )


def classify_finger_count_gesture(
    landmarks: Sequence[HandLandmarkPoint],
) -> Optional[HandGesture]:
    """Classifies show_one/two/three_finger from extended-finger geometry.
    Deliberately strict (exact finger combination, ring/pinky must be down
    for the respective counts) so an open palm or a fist mid-transition never
    gets misread as a count — identical rule set to
    `classifyFingerCountGesture` in hand-gesture.ts."""
    fingers = detect_extended_fingers(landmarks)
    if fingers is None:
        return None
    if fingers.index and not fingers.middle and not fingers.ring and not fingers.pinky:
        return "show_one_finger"
    if fingers.index and fingers.middle and not fingers.ring and not fingers.pinky:
        return "show_two_fingers"
    if fingers.index and fingers.middle and fingers.ring and not fingers.pinky:
        return "show_three_fingers"
    return None


# --------------------------------------------------------------------------
# 7. Per-frame signal + sequence/order matching against requested steps
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class FrameSignal:
    """One sampled frame's already-classified visual signals — analogous to
    FrameSignals in apps/web/lib/guardian-vision/types.ts. `None` fields mean
    "not evaluable this frame" (no face, no hand), never a fabricated guess.
    `timestamp_ms` is the frame's position within the CLIP (frame_index / fps
    * 1000) — a real, internally-consistent relative timestamp used only for
    in-clip ordering/windowing (e.g. the blink_twice window check below), NOT
    a claim about absolute wall-clock time (see match_challenge_steps'
    docstring for why we never expose an absolute serverDetectedAtMs)."""

    frame_index: int
    timestamp_ms: float
    face_count: int
    orientation: Optional[FaceOrientation]
    eyes_closed: Optional[bool]
    smiling: Optional[bool]
    hand_count: int
    gesture: Optional[HandGesture]


@dataclass(frozen=True)
class StepSpec:
    kind: Literal["face", "hand"]
    action: str


@dataclass(frozen=True)
class StepMatchOutcome:
    kind: Literal["face", "hand"]
    action: str
    matched: bool


_ORIENTATION_ACTIONS: dict[str, FaceOrientation] = {
    "look_center": "center",
    "turn_left": "left",
    "turn_right": "right",
    "look_up": "up",
}

_HAND_GESTURE_ACTIONS = {
    "thumbs_up",
    "victory",
    "open_palm",
    "closed_fist",
    "show_one_finger",
    "show_two_fingers",
    "show_three_fingers",
}

_BLINK_ACTIONS = {"blink_once", "blink_twice"}

# Mirrors DEFAULT_BLINK_WINDOW_MS in challenge-gate.ts: the max gap allowed
# between the two blinks of blink_twice. This is compared against
# FrameSignal.timestamp_ms deltas, which are relative in-clip milliseconds
# (see FrameSignal's docstring) — a legitimate use of relative timing even
# though we don't have (and never claim) an absolute wall-clock anchor.
_BLINK_WINDOW_MS = 1800.0


def _matches_instant(action: str, signal: FrameSignal) -> bool:
    """Whether a single frame's signals satisfy a non-blink action right
    now — same rule set as `matchesInstant` in challenge-gate.ts."""
    orientation = _ORIENTATION_ACTIONS.get(action)
    if orientation is not None:
        return signal.face_count == 1 and signal.orientation == orientation
    if action == "smile":
        return signal.face_count == 1 and signal.smiling is True
    if action in _HAND_GESTURE_ACTIONS:
        return signal.gesture == action
    return False


def _find_instant_match(
    action: str, frames: Sequence[FrameSignal], cursor: int
) -> Optional[int]:
    for pos in range(cursor, len(frames)):
        if _matches_instant(action, frames[pos]):
            return pos
    return None


def _find_blink_match(
    action: str, frames: Sequence[FrameSignal], cursor: int
) -> Optional[int]:
    """Edge-based matching for blink_once/blink_twice: counts closed->open
    transitions ("a blink") from `cursor` onward, mirroring `trackBlink` in
    challenge-gate.ts, adapted to sparse (non-continuous) sampled frames.

    HONESTY CAVEAT: with sparse sampling (as few as ~1 frame/second across
    the whole clip — see video_pipeline.py's sampling cap) it is entirely
    possible for a real, fast blink to fall between two sampled frames and
    never register as a transition here. This is a known, inherent
    limitation of frame subsampling, not a claim of frame-perfect blink
    detection — a missed blink_once/blink_twice step should be treated by the
    caller as "uncertain", never as proof the user didn't actually blink.
    """
    required = 1 if action == "blink_once" else 2
    prev_closed = False
    transitions: list[int] = []
    for pos in range(cursor, len(frames)):
        closed_now = frames[pos].eyes_closed is True
        if prev_closed and not closed_now:
            transitions.append(pos)
        prev_closed = closed_now

        if len(transitions) >= required:
            if required == 1:
                return transitions[-1]
            first_pos, last_pos = transitions[-2], transitions[-1]
            if (
                frames[last_pos].timestamp_ms - frames[first_pos].timestamp_ms
                <= _BLINK_WINDOW_MS
            ):
                return last_pos
            # Too far apart — drop the stale one and keep looking, same
            # sliding-window behavior as trackBlink in challenge-gate.ts.
            transitions = transitions[-1:]
    return None


def match_challenge_steps(
    steps: Sequence[StepSpec], frames: Sequence[FrameSignal]
) -> tuple[list[StepMatchOutcome], bool]:
    """For each requested step, scans the sampled frames — starting no
    earlier than where the PREVIOUS step was confirmed — for a frame where
    that step's action genuinely holds. Because each search starts at the
    previous step's confirmed position and only scans forward, any match
    found is *by construction* not earlier than the previous step's match:
    this is what makes `sequence_ok` (returned as the second tuple element)
    a real order guarantee, not a fabricated one, even though we do not (and
    cannot, from sparse sampling alone) claim precise absolute timestamps
    for each step — see FrameSignal's and analyze()'s docstrings.

    `sequence_ok` is True only when every step matched (each one found at or
    after the previous confirmed position); a step that never matches makes
    both that step's `matched` False and the overall `sequence_ok` False.
    """
    outcomes: list[StepMatchOutcome] = []
    cursor = 0
    for step in steps:
        if step.action in _BLINK_ACTIONS:
            match_pos = _find_blink_match(step.action, frames, cursor)
        else:
            match_pos = _find_instant_match(step.action, frames, cursor)
        matched = match_pos is not None
        outcomes.append(
            StepMatchOutcome(kind=step.kind, action=step.action, matched=matched)
        )
        if matched:
            cursor = match_pos  # type: ignore[assignment]

    sequence_ok = all(o.matched for o in outcomes) if outcomes else False
    return outcomes, sequence_ok


# --------------------------------------------------------------------------
# 8. Aggregate stats across sampled frames
# --------------------------------------------------------------------------


def mode_face_count(face_counts: Sequence[int]) -> Optional[int]:
    """Most common face count across sampled frames — a single noisy frame
    (e.g. a hand briefly occluding the face, registering as 0) shouldn't flip
    the overall faceCount signal. Returns None for an empty input (nothing to
    aggregate), never a fabricated 0 or 1."""
    if not face_counts:
        return None
    return Counter(face_counts).most_common(1)[0][0]


# --------------------------------------------------------------------------
# 9. Overall status decision + liveness/replay heuristics
# --------------------------------------------------------------------------

StatusValue = Literal["success", "uncertain", "unavailable", "failed", "not_evaluated"]

QUALITY_FLOOR = 0.3


def decide_status(
    *,
    face_count_mode: Optional[int],
    multiple_faces_detected: bool,
    static_video_suspected: bool,
    step_matched: Sequence[bool],
    sequence_ok: bool,
    quality_score: float,
) -> tuple[StatusValue, list[str]]:
    """Decides the overall status from already-computed signals. Assumes the
    caller has already ruled out decode failure and "models didn't load" —
    those map to "failed"/"unavailable" before this function is ever called
    (see video_pipeline.run_analysis), so this function only ever chooses
    between "success" and "uncertain".

    "success" requires ALL of: exactly one face across sampled frames, not
    staticVideoSuspected, every requested step matched, sequenceOk, and
    quality above a sane floor. Anything short of that is "uncertain" —
    never silently upgraded to success. This is intentionally conservative:
    when in doubt, report uncertain and let the Node-side decision engine
    route to manual review (see decision-engine.ts's docstring on the same
    "never fabricate success" principle).
    """
    reason_codes: list[str] = []
    ok = True

    if face_count_mode is None or face_count_mode == 0:
        reason_codes.append("no_face_detected")
        ok = False
    elif face_count_mode != 1:
        reason_codes.append("unexpected_face_count")
        ok = False

    if multiple_faces_detected:
        reason_codes.append("multiple_faces_detected")
        ok = False

    if static_video_suspected:
        reason_codes.append("static_video_suspected")
        ok = False

    if step_matched and not all(step_matched):
        reason_codes.append("step_not_matched")
        ok = False

    if not sequence_ok:
        reason_codes.append("step_sequence_mismatch")
        ok = False

    if quality_score <= QUALITY_FLOOR:
        reason_codes.append("quality_below_floor")
        ok = False

    if ok:
        return "success", ["all_checks_passed"]
    return "uncertain", reason_codes


def clamp01(value: float) -> float:
    return min(1.0, max(0.0, value))


# HEURISTIC WEIGHTS — plain arithmetic, not a trained/calibrated model. See
# module-level docstring and this project's rule against fabricating AI
# confidence scores: these numbers are a documented, inspectable formula, not
# an invented probability.
_LIVENESS_MOTION_WEIGHT = 0.40
_LIVENESS_STEP_WEIGHT = 0.35
_LIVENESS_QUALITY_WEIGHT = 0.25
# Raw motion_score values for a normal talking-head clip are typically small
# (well under 0.15) even when clearly alive; this saturation constant maps
# "0.15 normalized mean pixel diff" to "fully live" for the motion component
# of the blend, so ordinary live motion isn't perpetually scored near zero.
_LIVENESS_MOTION_SATURATION = 0.15


def compute_liveness_score(
    motion: float, matched_step_fraction: float, quality_score: float
) -> float:
    """HEURISTIC liveness score (0..1) — a plain weighted sum of three real,
    independently-computed signals (motion, fraction of requested steps that
    matched, capture quality). This is NOT a calibrated probability and NOT
    the output of a trained liveness-detection model; it exists only to give
    the Node-side decision engine a single number that moves in the right
    direction, in the same spirit as (but independent from) the `livenessScore`
    signal in decision-engine.ts. Formula:

        liveness_score = clamp01(
            0.40 * clamp01(motion / 0.15) +
            0.35 * matched_step_fraction +
            0.25 * quality_score
        )
    """
    motion_component = clamp01(motion / _LIVENESS_MOTION_SATURATION)
    return clamp01(
        _LIVENESS_MOTION_WEIGHT * motion_component
        + _LIVENESS_STEP_WEIGHT * clamp01(matched_step_fraction)
        + _LIVENESS_QUALITY_WEIGHT * clamp01(quality_score)
    )


_REPLAY_RISK_LOW_CONSTANT = 0.05


def compute_replay_risk(motion: float, static_video_suspected: bool) -> float:
    """HEURISTIC replay-risk score (0..1) — NOT a trained model output.
    When a static/frozen frame is suspected, risk is set to `1 - motion`
    (motion will already be near-zero in that case, so this is close to 1).
    Otherwise a low constant baseline is reported — deliberately never 0.0,
    since the absence of the crude static-image signal is not proof of
    absence of a more sophisticated replay attack (see
    `is_static_video_suspected`'s docstring)."""
    if static_video_suspected:
        return clamp01(1.0 - motion)
    return _REPLAY_RISK_LOW_CONSTANT
