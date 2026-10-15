"""
OpenCV + mediapipe orchestration: decodes the uploaded video, runs the real
FaceLandmarker/GestureRecognizer models per sampled frame, and calls into the
pure functions in `analyzer.py` to turn raw model output into the HTTP
response contract. This is the ONLY module in this service that imports cv2
or mediapipe — kept isolated so `analyzer.py`'s pure functions stay testable
without either heavy dependency installed (see analyzer.py's module
docstring for why that separation matters).
"""

from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass
from typing import Optional

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import vision as mp_vision
from mediapipe.tasks.python.core.base_options import BaseOptions

from . import analyzer, model_files
from .models import AnalyzeResponse, ChallengeIn, DeclaredStepResultIn, PerStepResultOut

MAX_SAMPLED_FRAMES = 30
SAMPLE_EVERY_N_FRAMES = 3
# Hard cap on frames actually decoded from the container, independent of how
# many end up sampled — bounds memory/CPU even for a much longer clip than
# Guardian's challenges should ever produce.
HARD_DECODE_FRAME_CAP = 900
DEFAULT_FPS_FALLBACK = 25.0


# --------------------------------------------------------------------------
# Model loading (mediapipe VIDEO-mode task objects)
# --------------------------------------------------------------------------

# A FaceLandmarker/GestureRecognizer created in VIDEO running mode is
# STATEFUL and requires strictly monotonically increasing timestamps per
# instance — it is not safe to share one instance across concurrent
# requests (two videos would interleave timestamps). A fresh instance is
# therefore created per request (see `run_analysis`) and closed afterwards;
# this function is only used to build one, and is also called once at
# startup purely to verify the model files actually load (see main.py's
# lifespan handler and `verify_models_loadable` below).


def create_face_landmarker() -> mp_vision.FaceLandmarker:
    options = mp_vision.FaceLandmarkerOptions(
        base_options=BaseOptions(
            model_asset_path=str(model_files.face_model_path())
        ),
        running_mode=mp_vision.RunningMode.VIDEO,
        num_faces=2,
        output_face_blendshapes=True,
        output_facial_transformation_matrixes=True,
    )
    return mp_vision.FaceLandmarker.create_from_options(options)


def create_gesture_recognizer() -> mp_vision.GestureRecognizer:
    options = mp_vision.GestureRecognizerOptions(
        base_options=BaseOptions(
            model_asset_path=str(model_files.gesture_model_path())
        ),
        running_mode=mp_vision.RunningMode.VIDEO,
        num_hands=2,
    )
    return mp_vision.GestureRecognizer.create_from_options(options)


def verify_models_loadable() -> list[str]:
    """Attempts to construct both task objects once and immediately closes
    them. Used only at startup to populate /healthz honestly — never at
    request time. Returns a list of warnings (empty means both loaded ok)."""
    warnings: list[str] = []
    if not model_files.models_present():
        return ["model_files_missing_on_disk"]
    try:
        fl = create_face_landmarker()
        fl.close()
    except Exception as exc:  # noqa: BLE001
        warnings.append(f"face_landmarker_load_failed:{exc}")
    try:
        gr = create_gesture_recognizer()
        gr.close()
    except Exception as exc:  # noqa: BLE001
        warnings.append(f"gesture_recognizer_load_failed:{exc}")
    return warnings


# --------------------------------------------------------------------------
# Video decode
# --------------------------------------------------------------------------


@dataclass
class DecodedVideo:
    ok: bool
    sampled_frames_bgr: list[tuple[int, np.ndarray]]
    fps: float
    duration_ms: int
    warnings: list[str]


def decode_video(video_bytes: bytes) -> DecodedVideo:
    """Writes the uploaded bytes to a temp file (cv2.VideoCapture needs a
    real path/fd, not raw bytes) and decodes frames with OpenCV, which in
    turn needs ffmpeg available on the system (see Dockerfile) to handle
    webm/mp4 containers. Samples up to MAX_SAMPLED_FRAMES frames, evenly
    spread across the decoded clip, never guessing when decode fails."""
    suffix = ".mp4"
    tmp_path: Optional[str] = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(video_bytes)
            tmp_path = tmp.name

        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            cap.release()
            return DecodedVideo(
                ok=False,
                sampled_frames_bgr=[],
                fps=0.0,
                duration_ms=0,
                warnings=["opencv_failed_to_open_video"],
            )

        fps = cap.get(cv2.CAP_PROP_FPS) or 0.0

        all_frames: list[np.ndarray] = []
        while len(all_frames) < HARD_DECODE_FRAME_CAP:
            ok, frame = cap.read()
            if not ok:
                break
            all_frames.append(frame)
        cap.release()

        if not all_frames:
            return DecodedVideo(
                ok=False,
                sampled_frames_bgr=[],
                fps=fps,
                duration_ms=0,
                warnings=["zero_frames_decoded"],
            )

        effective_fps = fps if fps > 1e-3 else DEFAULT_FPS_FALLBACK
        duration_ms = int(len(all_frames) / effective_fps * 1000)

        total = len(all_frames)
        if total <= MAX_SAMPLED_FRAMES:
            indices = list(range(total))
        else:
            indices = sorted(
                {int(round(i)) for i in np.linspace(0, total - 1, MAX_SAMPLED_FRAMES)}
            )

        warnings: list[str] = []
        if fps <= 1e-3:
            warnings.append("fps_unavailable_used_fallback_25fps")

        sampled = [(idx, all_frames[idx]) for idx in indices]
        return DecodedVideo(
            ok=True,
            sampled_frames_bgr=sampled,
            fps=effective_fps,
            duration_ms=duration_ms,
            warnings=warnings,
        )
    finally:
        if tmp_path is not None:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


# --------------------------------------------------------------------------
# Per-frame inference
# --------------------------------------------------------------------------


def _blendshapes_to_dict(categories) -> dict[str, float]:
    return {c.category_name: c.score for c in categories}


def analyze_sampled_frames(
    sampled_frames_bgr: list[tuple[int, np.ndarray]],
    fps: float,
    face_landmarker: mp_vision.FaceLandmarker,
    gesture_recognizer: mp_vision.GestureRecognizer,
) -> list[analyzer.FrameSignal]:
    """Runs both real models on each sampled frame (VIDEO mode, so
    timestamps must be monotonically increasing — the frame's original
    position in the decoded clip converted to ms is used, which is
    monotonic by construction since sampled_frames_bgr is built in
    increasing frame-index order) and reduces the raw output to the small
    FrameSignal shape analyzer.match_challenge_steps consumes. Mirrors
    analyzeFrame in apps/web/lib/guardian-vision/detector.ts."""
    signals: list[analyzer.FrameSignal] = []
    last_timestamp_ms = -1
    for frame_index, frame_bgr in sampled_frames_bgr:
        timestamp_ms = int(frame_index / fps * 1000)
        if timestamp_ms <= last_timestamp_ms:
            # VIDEO mode requires strictly increasing timestamps; guard
            # against duplicate-rounding edge cases rather than crash.
            timestamp_ms = last_timestamp_ms + 1
        last_timestamp_ms = timestamp_ms

        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)

        face_result = face_landmarker.detect_for_video(mp_image, timestamp_ms)
        gesture_result = gesture_recognizer.recognize_for_video(mp_image, timestamp_ms)

        face_count = len(face_result.face_landmarks)
        orientation = None
        eyes_closed = None
        smiling = None
        if face_count == 1:
            if face_result.facial_transformation_matrixes:
                matrix = face_result.facial_transformation_matrixes[0]
                flat = analyzer.flatten_column_major(matrix)
                pose = analyzer.decompose_rotation_matrix(flat)
                orientation = analyzer.classify_orientation(pose)
            if face_result.face_blendshapes:
                blendshapes = _blendshapes_to_dict(face_result.face_blendshapes[0])
                eyes_closed = analyzer.eyes_closed_from_blendshapes(blendshapes)
                smiling = analyzer.smiling_from_blendshapes(blendshapes)

        hand_count = len(gesture_result.hand_landmarks)
        gesture = None
        if hand_count >= 1:
            top_gestures = gesture_result.gestures[0] if gesture_result.gestures else []
            if top_gestures:
                gesture = analyzer.map_gesture_category(top_gestures[0].category_name)
            if gesture is None and gesture_result.hand_landmarks:
                landmarks = [
                    analyzer.HandLandmarkPoint(x=lm.x, y=lm.y, z=lm.z)
                    for lm in gesture_result.hand_landmarks[0]
                ]
                gesture = analyzer.classify_finger_count_gesture(landmarks)

        signals.append(
            analyzer.FrameSignal(
                frame_index=frame_index,
                timestamp_ms=float(timestamp_ms),
                face_count=face_count,
                orientation=orientation,
                eyes_closed=eyes_closed,
                smiling=smiling,
                hand_count=hand_count,
                gesture=gesture,
            )
        )
    return signals


# --------------------------------------------------------------------------
# Response builders for the "never fabricate success" short-circuit paths
# --------------------------------------------------------------------------


def _base_response(
    status,
    sha256_hex: str,
    warnings: list[str],
    duration_ms: int = 0,
    model_version: str = "0",
) -> AnalyzeResponse:
    return AnalyzeResponse(
        status=status,
        modelName="mediapipe-python",
        modelVersion=model_version,
        warnings=warnings,
        faceCount=None,
        multipleFacesDetected=False,
        motionScore=0.0,
        staticVideoSuspected=False,
        qualityScore=0.0,
        lightingScore=0.0,
        durationMs=duration_ms,
        sha256=sha256_hex,
        perStep=[],
        sequenceOk=False,
        livenessScore=0.0,
        replayRisk=0.0,
        reasonCodes=[warnings[0]] if warnings else ["no_signal"],
    )


def build_failed_response(video_bytes: bytes, warnings: list[str]) -> AnalyzeResponse:
    """Public helper for main.py's catch-all exception handler: still
    computes a real sha256 (cheap, never fails) even when everything else
    blew up, so the caller can at least cross-check what bytes were
    received."""
    try:
        sha256_hex = analyzer.compute_sha256(video_bytes)
    except Exception:  # noqa: BLE001
        sha256_hex = ""
    mediapipe_version = getattr(mp, "__version__", "unknown")
    return _base_response("failed", sha256_hex, warnings, model_version=mediapipe_version)


# --------------------------------------------------------------------------
# Top-level orchestration
# --------------------------------------------------------------------------


def run_analysis(
    video_bytes: bytes,
    challenge: ChallengeIn,
    declared_results: list[DeclaredStepResultIn],
    models_loaded: bool,
    model_load_warnings: list[str],
) -> AnalyzeResponse:
    sha256_hex = analyzer.compute_sha256(video_bytes)
    mediapipe_version = getattr(mp, "__version__", "unknown")

    decoded = decode_video(video_bytes)
    if not decoded.ok:
        return _base_response(
            "failed", sha256_hex, decoded.warnings, model_version=mediapipe_version
        )

    if not models_loaded:
        return _base_response(
            "unavailable",
            sha256_hex,
            ["models_not_loaded", *model_load_warnings],
            duration_ms=decoded.duration_ms,
            model_version=mediapipe_version,
        )

    face_landmarker = create_face_landmarker()
    gesture_recognizer = create_gesture_recognizer()
    try:
        frame_signals = analyze_sampled_frames(
            decoded.sampled_frames_bgr, decoded.fps, face_landmarker, gesture_recognizer
        )
    finally:
        face_landmarker.close()
        gesture_recognizer.close()

    gray_frames = [
        cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) for _, frame in decoded.sampled_frames_bgr
    ]
    motion = analyzer.motion_score(gray_frames)
    static_suspected = analyzer.is_static_video_suspected(motion)

    face_counts = [s.face_count for s in frame_signals]
    face_count_mode = analyzer.mode_face_count(face_counts)
    multiple_faces = any(c > 1 for c in face_counts)

    frame_qualities = [
        analyzer.estimate_frame_quality(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        for _, frame in decoded.sampled_frames_bgr
    ]
    quality_scores = [analyzer.quality_score_from(q) for q in frame_qualities]
    quality_score = float(np.mean(quality_scores)) if quality_scores else 0.0
    lighting_score = (
        float(np.mean([q.brightness for q in frame_qualities])) if frame_qualities else 0.0
    )

    step_specs = [analyzer.StepSpec(kind=s.kind, action=s.action) for s in challenge.steps]
    outcomes, sequence_ok = analyzer.match_challenge_steps(step_specs, frame_signals)

    matched_fraction = (
        sum(1 for o in outcomes if o.matched) / len(outcomes) if outcomes else 0.0
    )
    liveness_score = analyzer.compute_liveness_score(motion, matched_fraction, quality_score)
    replay_risk = analyzer.compute_replay_risk(motion, static_suspected)

    status, reason_codes = analyzer.decide_status(
        face_count_mode=face_count_mode,
        multiple_faces_detected=multiple_faces,
        static_video_suspected=static_suspected,
        step_matched=[o.matched for o in outcomes],
        sequence_ok=sequence_ok,
        quality_score=quality_score,
    )

    declared_by_position = {i: d for i, d in enumerate(declared_results)}
    per_step = [
        PerStepResultOut(
            action=outcome.action,
            kind=outcome.kind,
            declaredDetectedAtMs=(
                declared_by_position[i].detected_at
                if i in declared_by_position
                else None
            ),
            serverDetectedAtMs=None,
            matched=outcome.matched,
            timingDiscrepancyMs=None,
        )
        for i, outcome in enumerate(outcomes)
    ]

    warnings = list(decoded.warnings)
    if len(declared_results) != len(challenge.steps):
        warnings.append("declared_step_count_mismatch")

    return AnalyzeResponse(
        status=status,
        modelName="mediapipe-python",
        modelVersion=mediapipe_version,
        warnings=warnings,
        faceCount=face_count_mode,
        multipleFacesDetected=multiple_faces,
        motionScore=motion,
        staticVideoSuspected=static_suspected,
        qualityScore=quality_score,
        lightingScore=lighting_score,
        durationMs=decoded.duration_ms,
        sha256=sha256_hex,
        perStep=per_step,
        sequenceOk=sequence_ok,
        livenessScore=liveness_score,
        replayRisk=replay_risk,
        reasonCodes=reason_codes,
    )
