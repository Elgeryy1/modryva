# Guardian Vision Analyzer — server-side, real OpenCV+mediapipe re-derivation
# of Guardian Verification's visual liveness/challenge signals. See README.md
# for the honesty caveats on what this service does and does NOT catch.

FROM python:3.11-slim

# ffmpeg: OpenCV's VideoCapture needs it to decode webm/mp4 containers.
# libgl1 + libglib2.0-0 + libgles2 + libegl1: required at runtime by
# opencv-python-headless and mediapipe on Debian slim images (both dynamically
# link against libGL/libGLESv2/libEGL/libglib even though this service never
# opens a window) — confirmed by an actual container run: without libgles2,
# mediapipe's FaceLandmarker/GestureRecognizer fail to load with
# "libGLESv2.so.2: cannot open shared object file".
# curl: used below to fetch the two model files at BUILD time.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      curl \
      libgl1 \
      libglib2.0-0 \
      libgles2 \
      libegl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download the two public MediaPipe Tasks model files at BUILD time — the
# exact same models the browser client (apps/web/lib/guardian-vision/
# detector.ts) already loads — so the running container needs NO internet
# access at request time, only here during the image build.
RUN mkdir -p /app/models && \
    curl -fsSL -o /app/models/face_landmarker.task \
      https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task && \
    curl -fsSL -o /app/models/gesture_recognizer.task \
      https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task

ENV GUARDIAN_VISION_MODELS_DIR=/app/models

COPY app ./app

EXPOSE 8088

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import sys,urllib.request; \
    r=urllib.request.urlopen('http://127.0.0.1:8088/healthz', timeout=4); \
    sys.exit(0 if r.status == 200 else 1)" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8088"]
