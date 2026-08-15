const VISION_BASE = (import.meta as any).env?.VITE_VISION_BASE || "http://localhost:8787";

import type { TwinPayload } from "@/lib/traffic/types";

export type CameraSource = {
  id: string;
  name: string;
  url: string;
  kind: "public" | "local" | "upload";
  location?: string;
  intersection_type?: string;
};

export type DecisionPayload = {
  action: string;
  seconds: number;
  axis: string;
  confidence: number;
  rationale: string;
  contract: string;
};

export type DetectionFrame = {
  ts: number;
  hour: number;
  vehicles: Array<{
    kind: string;
    approach: string;
    x: number;
    y: number;
    w: number;
    h: number;
    confidence: number;
    lane: string;
    sizeClass: string;
  }>;
  pedestrians: Array<{ x: number; y: number; confidence: number }>;
  weather: string;
  isNight: boolean;
  laneDensity: Record<string, number>;
  emergencyDetected: boolean;
  rawImage: string | null;
  rawImageB?: string | null;
  cameraIds?: { axisA: string; axisB: string };
  dual?: boolean;
  decision?: DecisionPayload;
  analyticsA?: Record<string, Record<string, unknown>>;
  analyticsB?: Record<string, Record<string, unknown>>;
  twin?: TwinPayload;
};

function normalizeFrame(data: any): DetectionFrame {
  const cameraIds = data.camera_ids
    ? { axisA: data.camera_ids.axis_a, axisB: data.camera_ids.axis_b }
    : undefined;
  const frame: DetectionFrame = {
    ts: data.ts || Date.now() / 1000,
    hour: data.hour ?? 12,
    vehicles: data.vehicles || [],
    pedestrians: data.pedestrians || [],
    weather: data.weather || "clear",
    isNight: data.isNight ?? data.is_night ?? false,
    laneDensity: data.laneDensity || data.lane_density || { NS: 0, EW: 0 },
    emergencyDetected: data.emergencyDetected ?? data.emergency_detected ?? false,
    rawImage: data.image || data.raw_image || data.rawImage || null,
    decision: data.decision,
  };
  if (cameraIds) {
    frame.cameraIds = cameraIds;
    frame.dual = true;
  }
  if (data.image_b || data.rawImageB) {
    frame.rawImageB = data.image_b || data.rawImageB || null;
  }
  if (data.analyticsA) {
    frame.analyticsA = data.analyticsA;
  }
  if (data.analyticsB) {
    frame.analyticsB = data.analyticsB;
  }
  if (data.twin) {
    frame.twin = data.twin as TwinPayload;
  }
  return frame;
}

export async function listCameras(): Promise<CameraSource[]> {
  const res = await fetch(`${VISION_BASE}/api/cameras`);
  if (!res.ok) throw new Error("No se pudo obtener el listado de cámaras");
  return res.json();
}

export async function detectNow(cameraId: string): Promise<DetectionFrame> {
  const res = await fetch(`${VISION_BASE}/api/detect?camera_id=${encodeURIComponent(cameraId)}`);
  if (!res.ok) throw new Error("No se pudo ejecutar la detección");
  const data = await res.json();
  return normalizeFrame(data);
}

export async function detectDual(axisAId: string, axisBId: string): Promise<DetectionFrame> {
  const res = await fetch(
    `${VISION_BASE}/api/detect_dual?axis_a_camera_id=${encodeURIComponent(axisAId)}&axis_b_camera_id=${encodeURIComponent(axisBId)}`,
  );
  if (!res.ok) throw new Error("No se pudo ejecutar la detección dual");
  const data = await res.json();
  return normalizeFrame(data);
}

export async function setCameraUrl(url: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${VISION_BASE}/api/camera-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error("No se pudo configurar la URL");
  return res.json();
}

export function connectCameraStream(
  cameraId: string,
  onFrame: (frame: DetectionFrame) => void,
  onError: (error: Error) => void,
) {
  const ws = new WebSocket(`${VISION_BASE.replace("http", "ws")}/ws/camera/${encodeURIComponent(cameraId)}`);
  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (data.error) {
        onError(new Error(data.error));
        return;
      }
      onFrame(normalizeFrame(data));
    } catch (err) {
      onError(err as Error);
    }
  };
  ws.onerror = () => onError(new Error("WebSocket error"));
  ws.onclose = () => onError(new Error("WebSocket closed"));
  return ws;
}

export function connectDualCameraStream(
  axisAId: string,
  axisBId: string,
  onFrame: (frame: DetectionFrame) => void,
  onError: (error: Error) => void,
) {
  const url = `${VISION_BASE.replace("http", "ws")}/ws/camera_dual?axis_a_camera_id=${encodeURIComponent(axisAId)}&axis_b_camera_id=${encodeURIComponent(axisBId)}`;
  const ws = new WebSocket(url);
  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (data.error) {
        onError(new Error(data.error));
        return;
      }
      onFrame(normalizeFrame(data));
    } catch (err) {
      onError(err as Error);
    }
  };
  ws.onerror = () => onError(new Error("WebSocket error"));
  ws.onclose = () => onError(new Error("WebSocket closed"));
  return ws;
}
