"""
Pydantic request/response schemas for the Guardian Vision Analyzer HTTP
contract. Field names on the wire are camelCase (matching the Node/TS side's
conventions); Python code elsewhere in this service uses snake_case and
relies on the alias generator below to translate at the boundary.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

StatusValue = Literal["success", "uncertain", "unavailable", "failed", "not_evaluated"]
StepKind = Literal["face", "hand"]


def _to_camel(field_name: str) -> str:
    first, *rest = field_name.split("_")
    return first + "".join(word.title() for word in rest)


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
    )


# --------------------------------------------------------------------------
# Request payloads
# --------------------------------------------------------------------------


class ChallengeStepIn(CamelModel):
    kind: StepKind
    action: str
    time_limit_ms: int


class ChallengeIn(CamelModel):
    steps: list[ChallengeStepIn] = Field(default_factory=list)
    session_started_at_ms: int


class DeclaredStepResultIn(CamelModel):
    """One entry of the client's claimed `stepResults` (see
    apps/web/lib/guardian-vision/challenge-gate.ts's `StepResult`). Kept
    verbatim as `detected_at` (not `detected_at_ms`) to match the field name
    the client actually sends."""

    action: str
    detected_at: int


# --------------------------------------------------------------------------
# Response payload
# --------------------------------------------------------------------------


class PerStepResultOut(CamelModel):
    action: str
    kind: StepKind
    declared_detected_at_ms: Optional[int] = None
    # Deliberately always None: see analyzer.match_challenge_steps' and
    # video_pipeline.run_analysis's docstrings for why an absolute
    # server-side timestamp cannot be honestly derived from sparse sampled
    # frames alone. `matched` (independently confirmed anywhere in the
    # correct relative order) is the real, honest signal instead.
    server_detected_at_ms: Optional[int] = None
    matched: bool
    timing_discrepancy_ms: Optional[int] = None


class AnalyzeResponse(CamelModel):
    status: StatusValue
    model_name: str
    model_version: str
    warnings: list[str] = Field(default_factory=list)
    face_count: Optional[int] = None
    multiple_faces_detected: bool = False
    motion_score: float = 0.0
    static_video_suspected: bool = False
    quality_score: float = 0.0
    lighting_score: float = 0.0
    duration_ms: int = 0
    sha256: str
    per_step: list[PerStepResultOut] = Field(default_factory=list)
    sequence_ok: bool = False
    liveness_score: float = 0.0
    replay_risk: float = 0.0
    reason_codes: list[str] = Field(default_factory=list)


class HealthzResponse(CamelModel):
    status: Literal["ok", "degraded"]
    models_loaded: bool
    mediapipe_version: Optional[str] = None
    face_model_path: Optional[str] = None
    gesture_model_path: Optional[str] = None
    warnings: list[str] = Field(default_factory=list)
