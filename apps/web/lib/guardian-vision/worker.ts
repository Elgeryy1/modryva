/// <reference lib="webworker" />
import {
  analyzeFrame,
  createDetectors,
  type DetectorHandles,
  releaseDetectors,
} from "./detector";

/**
 * Guardian Verification's detection Web Worker: keeps the (CPU-heavy)
 * MediaPipe inference off the main thread so the challenge UI (video
 * preview, progress indicators) never janks while a frame is analyzed. Runs
 * frame-rate-limited by construction — the main thread (session-controller.ts)
 * only posts one frame at a time and waits for a "signals" reply before
 * capturing the next, rather than flooding the worker's queue.
 */

let handles: DetectorHandles | null = null;
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

type InboundMessage =
  | { readonly type: "init" }
  | {
      readonly type: "frame";
      readonly bitmap: ImageBitmap;
      readonly timestampMs: number;
    }
  | { readonly type: "release" };

self.onmessage = async (event: MessageEvent<InboundMessage>) => {
  const msg = event.data;

  if (msg.type === "init") {
    try {
      handles = await createDetectors();
      self.postMessage({ type: "ready" });
    } catch (error) {
      self.postMessage({ type: "error", error: String(error) });
    }
    return;
  }

  if (msg.type === "frame") {
    if (!handles) {
      msg.bitmap.close();
      return;
    }
    try {
      if (
        !canvas ||
        canvas.width !== msg.bitmap.width ||
        canvas.height !== msg.bitmap.height
      ) {
        canvas = new OffscreenCanvas(msg.bitmap.width, msg.bitmap.height);
        ctx = canvas.getContext("2d");
      }
      let frameData: {
        data: Uint8ClampedArray;
        width: number;
        height: number;
      } | null = null;
      if (ctx) {
        ctx.drawImage(msg.bitmap, 0, 0);
        const imageData = ctx.getImageData(
          0,
          0,
          msg.bitmap.width,
          msg.bitmap.height,
        );
        frameData = {
          data: imageData.data,
          width: msg.bitmap.width,
          height: msg.bitmap.height,
        };
      }
      const signals = analyzeFrame(
        handles,
        msg.bitmap,
        msg.timestampMs,
        frameData,
      );
      self.postMessage({ type: "signals", signals });
    } catch (error) {
      self.postMessage({ type: "error", error: String(error) });
    } finally {
      msg.bitmap.close();
    }
    return;
  }

  if (msg.type === "release") {
    if (handles) {
      releaseDetectors(handles);
      handles = null;
    }
    self.close();
  }
};
