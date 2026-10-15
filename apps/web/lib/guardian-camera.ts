// Camera + capture helpers for the Guardian Verification Mini App. No upload
// input is ever rendered — the ONLY source of media is the live front camera,
// matching the spec's "no gallery picker" requirement.

const PREFERRED_MIME_TYPES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
] as const;

export const supportsMediaRecorder = (): boolean =>
  typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined";

/** Best MediaRecorder mimeType this browser actually supports, or null when
 * MediaRecorder itself isn't available (caller should fall back to burst capture). */
export const pickSupportedMimeType = (): string | null => {
  if (!supportsMediaRecorder()) {
    return null;
  }
  for (const candidate of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return null;
};

export interface CameraStreamResult {
  readonly stream: MediaStream;
  readonly release: () => void;
}

/** Opens the FRONT camera only (facingMode: "user") — never the gallery, never
 * the rear camera. Throws with a recognizable name on permission denial.
 *
 * Deliberately does NOT constrain aspectRatio. A phone's front sensor is
 * natively landscape-shaped (typically 4:3), so demanding a 3:4 portrait ratio
 * made the browser crop away roughly HALF the width at the source — field of
 * view that no later step can recover. People reported the preview looking
 * heavily zoomed in and could not fit their face and hand in frame at once,
 * which is the whole task. Asking only for a resolution floor lets the device
 * hand back its natural, widest view; framing is then a purely visual concern
 * for the preview (object-fit: contain), never a silent crop. */
export const openFrontCamera = async (): Promise<CameraStreamResult> => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      // Ideals on both axes with no ratio: "as detailed as you can manage",
      // without biasing the shape either way.
      width: { min: 640, ideal: 1280 },
      height: { min: 640, ideal: 1280 },
    },
    audio: false,
  });
  return {
    stream,
    release: () => {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    },
  };
};

export interface RecordingResult {
  readonly blob: Blob;
  readonly mimeType: string;
  readonly durationMs: number;
}

/** Records `durationMs` of video from an already-open stream via MediaRecorder. */
export const recordClip = (
  stream: MediaStream,
  mimeType: string,
  durationMs: number,
): Promise<RecordingResult> =>
  new Promise((resolve, reject) => {
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    const startedAt = Date.now();

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    recorder.onerror = (event) => reject(event);
    recorder.onstop = () => {
      resolve({
        blob: new Blob(chunks, { type: mimeType }),
        mimeType,
        durationMs: Date.now() - startedAt,
      });
    };

    recorder.start();
    setTimeout(() => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    }, durationMs);
  });

export interface BurstFrame {
  readonly blob: Blob;
  readonly capturedAtMs: number;
}

/**
 * Captures JPEG frames from a live <video> element via canvas (also the
 * fallback for browsers without MediaRecorder). The server-side pipeline treats
 * the LAST frame as the primary still image; all frames are kept for future
 * frame-by-frame liveness analysis.
 *
 * Captures the FULL frame, never a center crop. The preview shows the whole
 * feed (object-fit: contain), so what the person composed on screen is exactly
 * what gets saved — and the vision model receives every pixel of context it can
 * get for finding a face and a hand gesture together. An earlier version
 * center-cropped to 3:4 to match a `cover` preview, which quietly discarded
 * whatever the person had carefully placed near the edge of the frame.
 *
 * Some phones hand back a landscape-SHAPED buffer for the front camera even
 * while held upright, but its content is already right-side-up — rotating it,
 * as a much earlier version did, turns an upright face sideways instead of
 * fixing anything.
 */
export const captureBurst = async (
  video: HTMLVideoElement,
  frameCount: number,
  intervalMs: number,
): Promise<readonly BurstFrame[]> => {
  const sourceWidth = video.videoWidth || 720;
  const sourceHeight = video.videoHeight || 1280;

  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas-context-unavailable");
  }

  const frames: BurstFrame[] = [];
  const start = Date.now();
  for (let i = 0; i < frameCount; i += 1) {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (blob) {
      frames.push({ blob, capturedAtMs: Date.now() - start });
    }
    if (i < frameCount - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  return frames;
};

/** Reads a Blob into a base64 string (no `data:...;base64,` prefix). */
export const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
