/**
 * Conector de cámaras IP reales para Ameghino AI.
 *
 * Conecta cámaras IP (Hikvision, Dahua, genéricas) al pipeline de
 * VisionAnalyzer mediante dos modos:
 *
 *  1. Snapshot HTTP: fetch periódico al endpoint JPEG de la cámara.
 *     Funciona 100% client-side sin servidor intermediario.
 *     Endpoint típico Hikvision: /Streaming/Channels/1/picture
 *     Endpoint típico Dahua: /cgi-bin/snapshot.cgi
 *
 *  2. WebRTC (preparado): interfaz lista para recibir un MediaStream
 *     de un gateway RTSP→WebRTC (MediaMTX, OvenMediaEngine).
 *
 * La salida es un ImageData listo para VisionAnalyzer.analyze().
 */

import type { CameraConfig } from "../traffic/trafficDataStore";

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export interface CameraFrame {
  imageData: ImageData;
  width: number;
  height: number;
  capturedAt: number;
  cameraId: string;
  approach: "N" | "S" | "E" | "W";
}

export type CameraStatus = "idle" | "connecting" | "connected" | "error" | "offline";

export interface CameraState {
  id: string;
  status: CameraStatus;
  lastFrame: CameraFrame | null;
  lastError: string | null;
  fps: number;
  latencyMs: number;
}

type FrameCallback = (frame: CameraFrame) => void;

/* ------------------------------------------------------------------ */
/* Clase CameraConnector                                                */
/* ------------------------------------------------------------------ */

export class CameraConnector {
  private configs: CameraConfig[] = [];
  private intervals = new Map<string, ReturnType<typeof setInterval>>();
  private states = new Map<string, CameraState>();
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onFrame: FrameCallback | null = null;
  private onStatusChange: ((states: Map<string, CameraState>) => void) | null = null;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 640;
    this.canvas.height = 480;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;
  }

  /** Registra callback para cada frame capturado */
  setOnFrame(cb: FrameCallback): void {
    this.onFrame = cb;
  }

  /** Registra callback para cambios de estado */
  setOnStatusChange(cb: (states: Map<string, CameraState>) => void): void {
    this.onStatusChange = cb;
  }

  /** Obtiene el estado actual de una cámara */
  getState(id: string): CameraState | null {
    return this.states.get(id) ?? null;
  }

  /** Obtiene todos los estados */
  getAllStates(): Map<string, CameraState> {
    return new Map(this.states);
  }

  /** Configura y arranca las cámaras */
  start(cameras: CameraConfig[]): void {
    this.stopAll();
    this.configs = cameras.filter((c) => c.enabled);

    for (const cam of this.configs) {
      this.states.set(cam.id, {
        id: cam.id,
        status: "connecting",
        lastFrame: null,
        lastError: null,
        fps: 0,
        latencyMs: 0,
      });

      if (cam.kind === "snapshot-http") {
        this.startSnapshotPolling(cam);
      } else if (cam.kind === "webcam") {
        this.startWebcam(cam);
      }
      /* rtsp-webrtc: requiere media server externo, preparado para futuro */
    }

    this.notifyStatus();
  }

  /** Detiene todas las cámaras */
  stopAll(): void {
    for (const [, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
    this.states.clear();
    this.notifyStatus();
  }

  /** Detiene una cámara específica */
  stop(id: string): void {
    const interval = this.intervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(id);
    }
    this.states.delete(id);
    this.notifyStatus();
  }

  /** Test de conexión a una URL de snapshot */
  async testConnection(url: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = performance.now();
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";

      const loaded = await new Promise<boolean>((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url + (url.includes("?") ? "&" : "?") + `_t=${Date.now()}`;

        setTimeout(() => resolve(false), 8000);
      });

      const latencyMs = Math.round(performance.now() - start);

      if (!loaded) {
        return { ok: false, latencyMs, error: "No se pudo cargar la imagen. Verifique URL y CORS." };
      }

      return { ok: true, latencyMs };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : "Error de red desconocido",
      };
    }
  }

  /* ---------------------------------------------------------------- */
  /* Modo Snapshot HTTP                                                 */
  /* ---------------------------------------------------------------- */

  private startSnapshotPolling(cam: CameraConfig): void {
    let frameCount = 0;
    let fpsTimer = performance.now();

    const poll = async () => {
      const start = performance.now();
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";

        const loaded = await new Promise<HTMLImageElement | null>((resolve) => {
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = cam.url + (cam.url.includes("?") ? "&" : "?") + `_t=${Date.now()}`;

          setTimeout(() => resolve(null), cam.refreshMs * 2);
        });

        if (!loaded) {
          this.updateState(cam.id, {
            status: "error",
            lastError: "Timeout al cargar snapshot",
          });
          return;
        }

        /* Dibujar la imagen en el canvas oculto para extraer ImageData */
        const w = loaded.naturalWidth || 640;
        const h = loaded.naturalHeight || 480;
        this.canvas.width = w;
        this.canvas.height = h;
        this.ctx.drawImage(loaded, 0, 0, w, h);

        const imageData = this.ctx.getImageData(0, 0, w, h);
        const latencyMs = Math.round(performance.now() - start);

        const frame: CameraFrame = {
          imageData,
          width: w,
          height: h,
          capturedAt: Date.now(),
          cameraId: cam.id,
          approach: cam.approach,
        };

        frameCount++;
        const elapsed = (performance.now() - fpsTimer) / 1000;
        const fps = elapsed > 0 ? Math.round((frameCount / elapsed) * 10) / 10 : 0;
        if (elapsed > 5) {
          frameCount = 0;
          fpsTimer = performance.now();
        }

        this.updateState(cam.id, {
          status: "connected",
          lastFrame: frame,
          lastError: null,
          fps,
          latencyMs,
        });

        this.onFrame?.(frame);
      } catch (err) {
        this.updateState(cam.id, {
          status: "error",
          lastError: err instanceof Error ? err.message : "Error desconocido",
        });
      }
    };

    /* Primer poll inmediato */
    poll();

    /* Polling periódico */
    const interval = setInterval(poll, cam.refreshMs);
    this.intervals.set(cam.id, interval);
  }

  /* ---------------------------------------------------------------- */
  /* Modo Webcam (getUserMedia)                                        */
  /* ---------------------------------------------------------------- */

  private async startWebcam(cam: CameraConfig): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
      });

      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      await video.play();

      let frameCount = 0;
      let fpsTimer = performance.now();

      const capture = () => {
        if (video.readyState < 2) return;

        const w = video.videoWidth || 640;
        const h = video.videoHeight || 480;
        this.canvas.width = w;
        this.canvas.height = h;

        const start = performance.now();
        this.ctx.drawImage(video, 0, 0, w, h);
        const imageData = this.ctx.getImageData(0, 0, w, h);
        const latencyMs = Math.round(performance.now() - start);

        const frame: CameraFrame = {
          imageData,
          width: w,
          height: h,
          capturedAt: Date.now(),
          cameraId: cam.id,
          approach: cam.approach,
        };

        frameCount++;
        const elapsed = (performance.now() - fpsTimer) / 1000;
        const fps = elapsed > 0 ? Math.round((frameCount / elapsed) * 10) / 10 : 0;
        if (elapsed > 5) {
          frameCount = 0;
          fpsTimer = performance.now();
        }

        this.updateState(cam.id, {
          status: "connected",
          lastFrame: frame,
          lastError: null,
          fps,
          latencyMs,
        });

        this.onFrame?.(frame);
      };

      const interval = setInterval(capture, cam.refreshMs || 100);
      this.intervals.set(cam.id, interval);
    } catch (err) {
      this.updateState(cam.id, {
        status: "error",
        lastError: err instanceof Error ? err.message : "No se pudo acceder a la cámara",
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Helpers internos                                                   */
  /* ---------------------------------------------------------------- */

  private updateState(id: string, patch: Partial<CameraState>): void {
    const current = this.states.get(id);
    if (current) {
      this.states.set(id, { ...current, ...patch });
    }
    this.notifyStatus();
  }

  private notifyStatus(): void {
    this.onStatusChange?.(new Map(this.states));
  }
}
