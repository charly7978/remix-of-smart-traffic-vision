const VISION_BASE = (import.meta as any).env?.VITE_VISION_BASE || "http://localhost:8787";

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
  decision?: DecisionPayload;
};

export async function listCameras(): Promise<CameraSource[]> {
  const res = await fetch(`${VISION_BASE}/api/cameras`);
  if (!res.ok) throw new Error("No se pudo obtener el listado de cámaras");
  return res.json();
}

export async function detectNow(cameraId: string): Promise<DetectionFrame> {
  const res = await fetch(`${VISION_BASE}/api/detect?camera_id=${encodeURIComponent(cameraId)}`);
  if (!res.ok) throw new Error("No se pudo ejecutar la detección");
  const data = await res.json();
  return {
    ...data,
    rawImage: data.image || data.raw_image || data.rawImage || null,
  };
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
      const frame: DetectionFrame = {
        ...data,
        rawImage: data.image || data.raw_image || data.rawImage || null,
      };
      onFrame(frame);
    } catch (err) {
      onError(err as Error);
    }
  };
  ws.onerror = () => onError(new Error("WebSocket error"));
  ws.onclose = () => onError(new Error("WebSocket closed"));
  return ws;
}
