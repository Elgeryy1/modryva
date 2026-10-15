# Guardian Vision Analyzer

Server-side, independent re-derivation of Guardian Verification's visual
liveness/challenge signals — a Python FastAPI microservice using OpenCV +
the `mediapipe` **Python** package (not the JS/WASM one the browser client
uses — a separate, mature, pip-installable library with its own
FaceLandmarker/HandLandmarker/GestureRecognizer solutions, built on the same
underlying models as the web client).

This exists because the browser client
(`apps/web/lib/guardian-vision/`) runs MediaPipe Tasks Vision in-browser and
reports which challenge actions it saw and when — but that report is
CLIENT-supplied. This service decodes the raw uploaded video bytes and
independently re-runs detection server-side, so a compromised/scripted
client cannot simply claim success without the visual evidence to back it
up.

## Honesty caveats — read before wiring this into any auto-approval path

- This catches **obvious static-image replay** (a frozen/near-frozen video —
  see `staticVideoSuspected`) and **mismatched/out-of-order/missing
  challenge actions** (see `perStep[].matched` and `sequenceOk`). Those are
  real, independently-computed signals from real pixels and real model
  output.
- This is **NOT a deepfake detector**. It has no synthetic-media/GAN/
  diffusion-artifact detection of any kind.
- This is **NOT liveness-certified** against a sophisticated screen/video
  replay attack — playing a previously-recorded real session of an actual
  moving human on a second screen pointed at the camera will show completely
  normal motion and will pass the static-video check. Only a crude frozen-
  frame replay is caught.
- `livenessScore` and `replayRisk` are **plain documented heuristic
  formulas** (see `app/analyzer.py`'s `compute_liveness_score` and
  `compute_replay_risk`), not the output of a trained/calibrated liveness
  model. They are weighted combinations of real signals (motion, matched-step
  fraction, quality) — never a fabricated confidence number.
- `serverDetectedAtMs` and `timingDiscrepancyMs` in `perStep` are always
  `null`. Sampling ~30 frames spread across a clip gives no reliable way to
  map a sampled frame back to an absolute wall-clock timestamp comparable to
  the client's `detectedAt` (epoch ms) — reporting a fabricated precise
  number would be worse than reporting nothing. Instead, `matched` (a
  boolean: was this action independently confirmed anywhere in the video, in
  the correct relative order versus the previous step) is the real signal,
  and `sequenceOk` gives a genuine order guarantee even without perfect
  timestamps (see `app/analyzer.py::match_challenge_steps`'s docstring for
  exactly why that guarantee is real).
- Blink detection (`blink_once`/`blink_twice`) is fundamentally limited by
  frame sampling: with as few as ~1 sampled frame per second across the whole
  clip, a real fast blink can fall between two samples and simply not
  register. A missed blink step should be treated as "uncertain", never as
  proof the user didn't actually blink.
- The overall `status` is **never fabricated to `"success"`**: it is
  `"success"` only when every check (single face, not static, every step
  matched, in-order, quality above a floor) passes simultaneously; anything
  short of that is `"uncertain"`, never silently upgraded. `"failed"` is
  reserved for decode failure or zero usable frames. `"unavailable"` means
  the mediapipe models themselves didn't load (see `/healthz`).

## HTTP contract

### `POST /v1/analyze`

Accepts **either** `multipart/form-data` **or** `application/json`
(detected from the `Content-Type` header):

- `video` — the raw video bytes (webm/mp4, decoded via OpenCV's
  `VideoCapture`, which needs ffmpeg — see `Dockerfile`). As a multipart file
  field, or as a base64 string under a JSON `"video"` key.
- `challenge` — JSON (as a string form field, or a nested JSON object/array
  in the JSON body):
  ```json
  {
    "steps": [{ "kind": "face", "action": "look_center", "timeLimitMs": 6000 }],
    "sessionStartedAtMs": 1234567890
  }
  ```
- `declaredStepResults` — JSON (same dual encoding): the client's claimed
  timestamps —
  ```json
  [{ "action": "look_center", "detectedAt": 1234567900 }]
  ```

Response — **always** this shape, never a fabricated success:

```json
{
  "status": "success",
  "modelName": "mediapipe-python",
  "modelVersion": "0.10.14",
  "warnings": [],
  "faceCount": 1,
  "multipleFacesDetected": false,
  "motionScore": 0.031,
  "staticVideoSuspected": false,
  "qualityScore": 0.71,
  "lightingScore": 0.62,
  "durationMs": 5820,
  "sha256": "…",
  "perStep": [
    {
      "action": "look_center",
      "kind": "face",
      "declaredDetectedAtMs": 1234,
      "serverDetectedAtMs": null,
      "matched": true,
      "timingDiscrepancyMs": null
    }
  ],
  "sequenceOk": true,
  "livenessScore": 0.68,
  "replayRisk": 0.05,
  "reasonCodes": ["all_checks_passed"]
}
```

`status` is one of `success | uncertain | unavailable | failed |
not_evaluated` (matches `GuardianProviderStatusValue` on the Node side).

#### curl example

```bash
curl -X POST http://localhost:8088/v1/analyze \
  -F "video=@sample-challenge.webm;type=video/webm" \
  -F 'challenge={"steps":[{"kind":"face","action":"look_center","timeLimitMs":6000}],"sessionStartedAtMs":1731000000000}' \
  -F 'declaredStepResults=[{"action":"look_center","detectedAt":1731000000500}]'
```

### `GET /healthz`

Plain liveness/readiness probe — reports whether the mediapipe models
**actually loaded**, not just that the process is up. Returns HTTP 200 when
loaded, HTTP 503 (with the same JSON body) when degraded:

```json
{
  "status": "ok",
  "modelsLoaded": true,
  "mediapipeVersion": "0.10.14",
  "faceModelPath": "/app/models/face_landmarker.task",
  "gestureModelPath": "/app/models/gesture_recognizer.task",
  "warnings": []
}
```

## Running locally

### Docker (recommended — matches production)

```bash
docker build -t guardian-vision-analyzer .
docker run --rm -p 8088:8088 guardian-vision-analyzer
```

The Dockerfile downloads both MediaPipe `.task` model files at **build**
time (see the `curl` steps in `Dockerfile`) into `/app/models`, so the
running container needs no internet access at request time — only during
the image build.

### Without Docker (dev)

```bash
python -m venv .venv
. .venv/Scripts/activate   # Windows; use `. .venv/bin/activate` on Linux/macOS
pip install -r requirements.txt
python scripts/download_models.py   # one-time model download into ./models
uvicorn app.main:app --host 0.0.0.0 --port 8088
```

(If you skip `scripts/download_models.py`, the app's startup `lifespan`
handler will attempt the same download automatically on first run — still
only at startup, never per-request — and `/healthz` will report
`modelsLoaded: false` if that fails, e.g. no network access.)

## Running tests

```bash
pip install -r requirements.txt -r requirements-dev.txt
pytest
```

Every test in `tests/` exercises the **pure** functions in `app/analyzer.py`
(hashing, motion score, quality/lighting, head-pose decomposition/bucketing,
finger-count classification, gesture-category mapping, blink/smile
thresholds, sequence/order matching, and the status/liveness/replay-risk
decision math) against hand-built numpy arrays, dataclasses, and canned
per-frame detections — see `tests/conftest.py`'s module docstring for
exactly what is and isn't covered. **None of these tests require OpenCV or
mediapipe to be installed** — `app/analyzer.py` deliberately has zero
dependencies beyond numpy and the standard library, precisely so this suite
can run in a minimal environment.

Real end-to-end face/gesture detection accuracy against an actual human
(`app/video_pipeline.py`'s OpenCV decode + mediapipe model inference) is
**not** covered by this suite — a synthetic/non-photographic test image
doesn't exercise a trained face-detection model meaningfully. Validating
that requires a real fixture video and must happen separately, consistent
with how this project's browser-side Playwright E2E tests document the same
limitation for the client's MediaPipe wiring.

## Project layout

```
app/
  main.py            FastAPI app: POST /v1/analyze, GET /healthz
  video_pipeline.py   OpenCV decode + mediapipe model inference (the ONLY
                      module here that imports cv2/mediapipe)
  analyzer.py         Pure analysis logic — hashing, motion score, quality,
                      head-pose, hand-gesture, sequence matching, decision
  model_files.py      Locates/downloads the two .task model files
  models.py           Pydantic request/response schemas
scripts/
  download_models.py  Manual/dev model download CLI (not used by Docker)
tests/                pytest suite for app/analyzer.py's pure functions
Dockerfile
requirements.txt
requirements-dev.txt
```
