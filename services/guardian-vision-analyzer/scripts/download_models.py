#!/usr/bin/env python
"""
Manual/dev convenience CLI: downloads the two MediaPipe Tasks model files
into the configured models directory (default `./models`, override with the
GUARDIAN_VISION_MODELS_DIR env var — see app/model_files.py) ahead of time,
so `uvicorn app.main:app` starts up already warm instead of downloading on
first run.

Not used by the Docker image itself — the Dockerfile downloads the model
files directly at BUILD time via `curl` (see Dockerfile) so the built image
never needs network access. This script exists purely for running the
service locally without Docker.

Usage:
    python scripts/download_models.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import model_files  # noqa: E402


def main() -> int:
    warnings = model_files.ensure_models_present()
    if warnings:
        print("Model download finished with warnings:", file=sys.stderr)
        for warning in warnings:
            print(f"  - {warning}", file=sys.stderr)
        return 1
    print(f"Models ready in {model_files.models_dir()}:")
    print(f"  - {model_files.face_model_path()}")
    print(f"  - {model_files.gesture_model_path()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
