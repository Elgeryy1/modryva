"""
Test suite scope, read this before adding new tests.

Everything under tests/ exercises PURE functions in app/analyzer.py: hashing,
motion score, quality/lighting scoring, head-pose decomposition/bucketing,
hand-landmark finger counting, gesture-category mapping, blink/smile
blendshape thresholds, sequence/order matching, and the overall status/
liveness/replay-risk decision math. All of it runs against hand-built numpy
arrays, dataclasses, and dicts standing in for what a real video + real
mediapipe FaceLandmarker/GestureRecognizer output would look like — NOT
against a real photograph or real trained-model inference.

Deliberately OUT OF SCOPE here: end-to-end accuracy of the real
FaceLandmarker/GestureRecognizer models against an actual human face/hand
(app/video_pipeline.py's analyze_sampled_frames, decode_video, and the
mediapipe model-loading code). Synthetic (non-photographic) test images
would not exercise the trained models meaningfully — a blank/noise/gradient
numpy array does not look like a face to a real face-detection model, so a
test built from one proves nothing about real-world detection accuracy, only
that the code doesn't crash. Validating that accuracy requires a real
fixture video (a short recording of an actual person performing the
challenge actions) and must happen separately from this pure-function
suite — consistent with how apps/web/e2e/guardian's Playwright E2E tests
document the same limitation for the browser-side MediaPipe wiring (see
apps/web/lib/guardian-vision/detector.ts's module docstring).
"""
