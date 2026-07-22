"""
FastAPI app for Guardian Vision Analyzer.

Two endpoints:
  - POST /v1/analyze  — the real analysis (see video_pipeline.run_analysis)
  - GET  /healthz     — liveness/readiness probe that reports whether the
                         mediapipe models actually loaded, not just that the
                         process is up (used by a doctor script and the
                         Docker HEALTHCHECK).

Model loading happens once at startup (see `lifespan` below): a FaceLandmarker
+ GestureRecognizer pair is constructed just to confirm the model files load,
then closed immediately. Every actual /v1/analyze request builds its OWN
fresh FaceLandmarker/GestureRecognizer instances (see
video_pipeline.run_analysis) because MediaPipe's VIDEO running mode is
stateful and timestamp-order-sensitive per instance — sharing one instance
across concurrent requests would interleave timestamps from different
videos and corrupt results.
"""

from __future__ import annotations

import base64
import json
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import TypeAdapter, ValidationError

from . import model_files, video_pipeline
from .models import AnalyzeResponse, ChallengeIn, DeclaredStepResultIn, HealthzResponse

logger = logging.getLogger("guardian_vision_analyzer")

_state: dict[str, Any] = {"models_loaded": False, "warnings": []}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # First-run convenience only: if the model files aren't already on disk
    # (e.g. running outside the Docker image, where they're downloaded at
    # BUILD time — see Dockerfile), fetch them now, once, at startup. Never
    # attempted at request time.
    download_warnings = model_files.ensure_models_present()
    load_warnings = video_pipeline.verify_models_loadable()
    all_warnings = [*download_warnings, *load_warnings]
    _state["models_loaded"] = not all_warnings
    _state["warnings"] = all_warnings
    if all_warnings:
        logger.warning("guardian-vision-analyzer starting DEGRADED: %s", all_warnings)
    else:
        logger.info("guardian-vision-analyzer models loaded ok")
    yield


app = FastAPI(title="Guardian Vision Analyzer", lifespan=lifespan)


@app.get("/healthz")
async def healthz() -> JSONResponse:
    models_loaded = bool(_state["models_loaded"])
    body = HealthzResponse(
        status="ok" if models_loaded else "degraded",
        modelsLoaded=models_loaded,
        mediapipeVersion=_mediapipe_version(),
        faceModelPath=str(model_files.face_model_path()),
        gestureModelPath=str(model_files.gesture_model_path()),
        warnings=list(_state["warnings"]),
    )
    return JSONResponse(
        status_code=200 if models_loaded else 503,
        content=body.model_dump(by_alias=True),
    )


def _mediapipe_version() -> str | None:
    try:
        import mediapipe as mp

        return getattr(mp, "__version__", None)
    except Exception:  # noqa: BLE001
        return None


@app.post("/v1/analyze", response_model=AnalyzeResponse)
async def analyze(request: Request) -> AnalyzeResponse:
    content_type = request.headers.get("content-type", "")

    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        video_field = form.get("video")
        if video_field is None or not hasattr(video_field, "read"):
            raise HTTPException(400, "missing required multipart field 'video'")
        video_bytes = await video_field.read()
        challenge_raw = form.get("challenge")
        declared_raw = form.get("declaredStepResults")
    elif content_type.startswith("application/json"):
        try:
            body = await request.json()
        except json.JSONDecodeError as exc:
            raise HTTPException(400, f"invalid JSON body: {exc}") from exc
        video_b64 = body.get("video")
        if not video_b64 or not isinstance(video_b64, str):
            raise HTTPException(400, "missing required JSON field 'video' (base64 string)")
        try:
            video_bytes = base64.b64decode(video_b64, validate=True)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(400, f"'video' is not valid base64: {exc}") from exc
        challenge_raw = body.get("challenge")
        declared_raw = body.get("declaredStepResults")
    else:
        raise HTTPException(
            415,
            f"unsupported content-type '{content_type}': "
            "use multipart/form-data or application/json",
        )

    if not video_bytes:
        raise HTTPException(400, "'video' payload was empty")

    challenge = _parse_challenge(challenge_raw)
    declared_results = _parse_declared_results(declared_raw)

    try:
        return video_pipeline.run_analysis(
            video_bytes=video_bytes,
            challenge=challenge,
            declared_results=declared_results,
            models_loaded=bool(_state["models_loaded"]),
            model_load_warnings=list(_state["warnings"]),
        )
    except Exception as exc:  # noqa: BLE001
        # A bug or unexpected decode/model crash must still honor the
        # contract's promise: ALWAYS this response shape, NEVER a fabricated
        # success — never let an unhandled exception surface as an opaque
        # 500 with no analysis result the Node side can reason about.
        logger.exception("unexpected failure during /v1/analyze")
        return video_pipeline.build_failed_response(
            video_bytes, [f"internal_error:{exc.__class__.__name__}"]
        )


def _parse_challenge(raw: Any) -> ChallengeIn:
    if raw is None:
        raise HTTPException(400, "missing required field 'challenge'")
    try:
        if isinstance(raw, (str, bytes)):
            return ChallengeIn.model_validate_json(raw)
        return ChallengeIn.model_validate(raw)
    except ValidationError as exc:
        raise HTTPException(400, f"invalid 'challenge' payload: {exc}") from exc


_declared_results_adapter = TypeAdapter(list[DeclaredStepResultIn])


def _parse_declared_results(raw: Any) -> list[DeclaredStepResultIn]:
    if raw is None:
        return []
    try:
        if isinstance(raw, (str, bytes)):
            return _declared_results_adapter.validate_json(raw)
        return _declared_results_adapter.validate_python(raw)
    except ValidationError as exc:
        raise HTTPException(
            400, f"invalid 'declaredStepResults' payload: {exc}"
        ) from exc
