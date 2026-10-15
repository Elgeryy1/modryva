import {
  analyzeFrame,
  createDetectors,
  type DetectorHandles,
  releaseDetectors,
} from "./detector";
import type { FrameSignals } from "./types";

/**
 * Main-thread controller: captures frames from the live <video> element and
 * feeds them to real MediaPipe inference, either in a Web Worker (preferred
 * — keeps the UI thread free) or, when Worker/OffscreenCanvas aren't
 * available, directly on the main thread at a reduced rate. Either way the
 * caller only ever sees real, already-classified `FrameSignals` — there is
 * no code path that fabricates a signal.
 *
 * Self-throttling: the next frame is only captured after the previous one's
 * analysis finishes (or errors), so a slow device naturally runs at a lower
 * effective frame rate instead of queuing up backlogged frames.
 */

const MIN_INTERVAL_MS = 120; // ~8fps ceiling — plenty for hold/blink timing.
const MAIN_THREAD_MIN_INTERVAL_MS = 250; // lower ceiling when running unthreaded.

export interface VisionSessionOptions {
  readonly video: HTMLVideoElement;
  readonly onSignals: (signals: FrameSignals) => void;
  readonly onError: (error: unknown) => void;
}

export type VisionBackend = "worker" | "main-thread";

export class VisionSession {
  private worker: Worker | null = null;
  private mainThreadHandles: DetectorHandles | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private stopped = false;
  private pending = false;
  private backendValue: VisionBackend = "main-thread";

  constructor(private readonly options: VisionSessionOptions) {}

  backend(): VisionBackend {
    return this.backendValue;
  }

  async start(): Promise<void> {
    const canUseWorker =
      typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined";
    if (canUseWorker) {
      try {
        await this.startWorker();
        this.backendValue = "worker";
        return;
      } catch (error) {
        this.options.onError(error);
        this.teardownWorker();
      }
    }
    await this.startMainThread();
    this.backendValue = "main-thread";
  }

  private async startWorker(): Promise<void> {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker = worker;

    await new Promise<void>((resolve, reject) => {
      const onReady = (event: MessageEvent) => {
        if (event.data?.type === "ready") {
          worker.removeEventListener("message", onReady);
          resolve();
        } else if (event.data?.type === "error") {
          worker.removeEventListener("message", onReady);
          reject(new Error(String(event.data.error)));
        }
      };
      worker.addEventListener("message", onReady);
      worker.onerror = (event) => reject(event.error ?? event);
      worker.postMessage({ type: "init" });
    });

    worker.onmessage = (event) => {
      this.pending = false;
      if (this.stopped) return;
      if (event.data?.type === "signals") {
        this.options.onSignals(event.data.signals as FrameSignals);
      } else if (event.data?.type === "error") {
        this.options.onError(new Error(String(event.data.error)));
      }
      this.scheduleNextWorkerFrame();
    };
    this.scheduleNextWorkerFrame();
  }

  private scheduleNextWorkerFrame(): void {
    if (this.stopped || this.pending) return;
    setTimeout(() => void this.captureFrameToWorker(), MIN_INTERVAL_MS);
  }

  private async captureFrameToWorker(): Promise<void> {
    if (this.stopped || !this.worker || this.pending) return;
    const video = this.options.video;
    if (video.readyState < 2 || video.videoWidth === 0) {
      this.scheduleNextWorkerFrame();
      return;
    }
    try {
      this.pending = true;
      const bitmap = await createImageBitmap(video);
      this.worker.postMessage(
        { type: "frame", bitmap, timestampMs: Date.now() },
        [bitmap],
      );
    } catch (error) {
      this.pending = false;
      this.options.onError(error);
      this.scheduleNextWorkerFrame();
    }
  }

  private async startMainThread(): Promise<void> {
    this.mainThreadHandles = await createDetectors();
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.scheduleNextMainThreadFrame();
  }

  private scheduleNextMainThreadFrame(): void {
    if (this.stopped) return;
    setTimeout(
      () => this.captureFrameMainThread(),
      MAIN_THREAD_MIN_INTERVAL_MS,
    );
  }

  private captureFrameMainThread(): void {
    if (this.stopped || !this.mainThreadHandles || !this.canvas || !this.ctx)
      return;
    const video = this.options.video;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (video.readyState < 2 || !w || !h) {
      this.scheduleNextMainThreadFrame();
      return;
    }
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    try {
      this.ctx.drawImage(video, 0, 0, w, h);
      const imageData = this.ctx.getImageData(0, 0, w, h);
      const signals = analyzeFrame(this.mainThreadHandles, video, Date.now(), {
        data: imageData.data,
        width: w,
        height: h,
      });
      this.options.onSignals(signals);
    } catch (error) {
      this.options.onError(error);
    } finally {
      this.scheduleNextMainThreadFrame();
    }
  }

  private teardownWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  /** Releases the camera-adjacent resources this session owns (worker,
   * models, canvases) — does NOT stop the camera stream itself, which the
   * caller owns (see guardian-camera.ts's `CameraStreamResult.release`). */
  release(): void {
    this.stopped = true;
    if (this.worker) {
      this.worker.postMessage({ type: "release" });
      this.worker.terminate();
      this.worker = null;
    }
    if (this.mainThreadHandles) {
      releaseDetectors(this.mainThreadHandles);
      this.mainThreadHandles = null;
    }
    this.canvas = null;
    this.ctx = null;
  }
}
