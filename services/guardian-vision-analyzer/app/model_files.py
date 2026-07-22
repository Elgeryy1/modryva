"""
Locates (and, only as a local-dev convenience, downloads) the two public
MediaPipe Tasks model files this service needs. These are the SAME model
files the browser client already loads (see
apps/web/lib/guardian-vision/detector.ts's FACE_MODEL_URL/GESTURE_MODEL_URL)
so both sides run the same underlying models.

In the Docker image, the Dockerfile downloads both files at BUILD time into
/app/models — no network access is needed at request time, ever. This module
only reaches the network itself when running OUTSIDE Docker (e.g. local dev
via `uvicorn app.main:app`) and the files are not already present on disk —
that still only happens once, at process startup, never per-request.
"""

from __future__ import annotations

import os
import urllib.request
from pathlib import Path

FACE_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
    "face_landmarker/float16/1/face_landmarker.task"
)
GESTURE_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/"
    "gesture_recognizer/float16/1/gesture_recognizer.task"
)

FACE_MODEL_FILENAME = "face_landmarker.task"
GESTURE_MODEL_FILENAME = "gesture_recognizer.task"


def models_dir() -> Path:
    return Path(os.environ.get("GUARDIAN_VISION_MODELS_DIR", "models"))


def face_model_path() -> Path:
    return models_dir() / FACE_MODEL_FILENAME


def gesture_model_path() -> Path:
    return models_dir() / GESTURE_MODEL_FILENAME


def ensure_models_present(timeout_s: float = 60.0) -> list[str]:
    """Ensures both model files exist on disk, downloading whichever is
    missing. Returns a list of warning strings (empty if everything is fine
    or was already present) — never raises for a network failure, so a
    misconfigured/offline deployment degrades to healthz reporting
    `modelsLoaded: false` instead of crashing the process."""
    warnings: list[str] = []
    target_dir = models_dir()
    try:
        target_dir.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        return [f"cannot_create_models_dir:{exc}"]

    for url, path in (
        (FACE_MODEL_URL, face_model_path()),
        (GESTURE_MODEL_URL, gesture_model_path()),
    ):
        if path.exists() and path.stat().st_size > 0:
            continue
        try:
            with urllib.request.urlopen(url, timeout=timeout_s) as response:
                data = response.read()
            tmp_path = path.with_suffix(path.suffix + ".part")
            tmp_path.write_bytes(data)
            tmp_path.replace(path)
        except Exception as exc:  # noqa: BLE001 - genuinely any failure here is non-fatal
            warnings.append(f"model_download_failed:{path.name}:{exc}")
    return warnings


def models_present() -> bool:
    return face_model_path().exists() and gesture_model_path().exists()
