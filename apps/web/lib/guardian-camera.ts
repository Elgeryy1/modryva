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
 * The requested aspectRatio (3/4) MUST match .guardian-camera-preview's CSS
 * aspect-ratio: without it, a camera whose native stream is much taller
 * (e.g. 9:16) gets cropped hard by object-fit:cover to fit the wider 3:4 box
 * — cropping most of the vertical field of view and forcing the person to
 * hold the phone far away just to fit their face + hand in what's left. */
export const openFrontCamera = async (): Promise<CameraStreamResult> => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 960 },
      height: { ideal: 1280 },
      aspectRatio: { ideal: 3 / 4 },
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
 * Fallback for browsers without MediaRecorder: captures a burst of JPEG
 * frames from a live <video> element via canvas. The server-side pipeline
 * treats the LAST frame as the primary still image; all frames are kept for
 * future frame-by-frame liveness analysis.
 */
export const captureBurst = async (
  video: HTMLVideoElement,
  frameCount: number,
  intervalMs: number,
): Promise<readonly BurstFrame[]> => {
  const sourceWidth = video.videoWidth || 720;
  const sourceHeight = video.videoHeight || 1280;
  // Some phones hand back a landscape-SHAPED buffer for the front camera even
  // while held upright — but its content is already right-side-up (rotating
  // it, as an earlier version of this function did, turns an upright face
  // sideways instead of fixing anything). The live preview already shows a
  // portrait crop via .guardian-camera-preview's 3/4 aspect-ratio +
  // object-fit:cover; replicate that exact center-crop here — never a
  // rotation — so the saved photo matches what the person composed on screen.
  const TARGET_ASPECT = 3 / 4; // width / height, matches .guardian-camera-preview
  const sourceAspect = sourceWidth / sourceHeight;
  const cropWidth =
    sourceAspect > TARGET_ASPECT ? sourceHeight * TARGET_ASPECT : sourceWidth;
  const cropHeight =
    sourceAspect > TARGET_ASPECT ? sourceHeight : sourceWidth / TARGET_ASPECT;
  const cropX = (sourceWidth - cropWidth) / 2;
  const cropY = (sourceHeight - cropHeight) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas-context-unavailable");
  }

  const frames: BurstFrame[] = [];
  const start = Date.now();
  for (let i = 0; i < frameCount; i += 1) {
    ctx.drawImage(
      video,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
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
