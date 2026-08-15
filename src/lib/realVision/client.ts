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
  rawImageB?: string | null;
  cameraIds?: { axisA: string; axisB: string };
  dual?: boolean;
  decision?: DecisionPayload;
};

export const DEFAULT_CAMERAS: CameraSource[] = [
  {
    id: "london-purley-way-croydon-road",
    name: "Eje A (N-S) · Av. San Martín [Cruce Simulado] / Purley Way",
    url: "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.04564.mp4",
    kind: "public",
    location: "Cruce Principal (Eje Norte–Sur)",
    intersection_type: "Cruce de Avenida con Semáforos",
  },
  {
    id: "london-lewisham-way-parkfield",
    name: "Eje B (E-O) · Av. Urquiza [Cruce Simulado] / Lewisham Way",
    url: "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.03700.mp4",
    kind: "public",
    location: "Cruce Transversal (Eje Este–Oeste)",
    intersection_type: "Cruce Transversal con Semáforos",
  },
  {
    id: "london-central-way-drury-way",
    name: "Intersección Drury Way & Central Way (Flujo Pesado)",
    url: "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.08005.mp4",
    kind: "public",
    location: "Corredor Comercial",
    intersection_type: "Cruce con Semáforos Multicarril",
  },
  {
    id: "london-talgarth-gliddon",
    name: "Intersección Talgarth Road & Gliddon Road",
    url: "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.06614.mp4",
    kind: "public",
    location: "Avenida Rápida Urbana",
    intersection_type: "Cruce Semaforizado",
  },
  {
    id: "london-watford-way-broadway",
    name: "Intersección Watford Way & The Broadway",
    url: "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.09744.mp4",
    kind: "public",
    location: "Acceso Urbano",
    intersection_type: "Cruce con Semáforos",
  },
  {
    id: "london-harleyford-ken-pk",
    name: "Intersección Harleyford St & Ken Pk Rd",
    url: "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.04332.mp4",
    kind: "public",
    location: "Centro Urbano",
    intersection_type: "Cruce con Semáforos",
  },
  {
    id: "london-clapham-common-southside",
    name: "Intersección Clapham Common Southside & Long Rd",
    url: "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.04650.mp4",
    kind: "public",
    location: "Avenida Sur",
    intersection_type: "Cruce con Semáforos",
  },
  {
    id: "london-new-cross-st-james",
    name: "Intersección New Cross Rd & St James",
    url: "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.03663.mp4",
    kind: "public",
    location: "Corredor de Tránsito",
    intersection_type: "Cruce con Colectivos y Autos",
  },
  {
    id: "caba-9-julio-corrientes",
    name: "Buenos Aires · Av. 9 de Julio y Corrientes (Obelisco)",
    url: "https://images-webcams.windy.com/88/1691337947/current/original/1691337947.jpg",
    kind: "public",
    location: "CABA, Plaza de la República",
    intersection_type: "Gran Avenida Urbana",
  },
  {
    id: "cordoba-bv-san-juan-velez-sarsfield",
    name: "Córdoba · Bv. San Juan y Av. Vélez Sarsfield",
    url: "https://images-webcams.windy.com/88/1664693412/current/original/1664693412.jpg",
    kind: "public",
    location: "Córdoba Capital (Patio Olmos)",
    intersection_type: "Cruce Céntrico con Semáforos",
  },
  {
    id: "local-webcam",
    name: "Cámara Local / Webcam Directa (Dispositivo)",
    url: "0",
    kind: "local",
    location: "Dispositivo del Equipo",
    intersection_type: "Cámara en Vivo Directa",
  },
  {
    id: "public-url",
    name: "URL Personalizada (RTSP / HLS / YouTube Live)",
    url: "",
    kind: "public",
    location: "Pegar URL de Transmisión Directa",
    intersection_type: "Cruce Personalizado",
  },
];

export function getCameraSnapshotUrl(source?: CameraSource | null): string | null {
  if (!source || !source.url) return null;
  if (source.kind === "local") return null;
  if (source.url.includes("jamcams.tfl.gov.uk") && source.url.endsWith(".mp4")) {
    return source.url.replace(".mp4", ".jpg");
  }
  if (
    source.url.endsWith(".jpg") ||
    source.url.endsWith(".jpeg") ||
    source.url.endsWith(".png") ||
    source.url.endsWith(".webp")
  ) {
    return source.url;
  }
  return null;
}

export async function checkVisionBackendHealth(): Promise<{ online: boolean; latencyMs?: number; error?: string }> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${VISION_BASE}/api/cameras`, { signal: controller.signal });
    window.clearTimeout(timeoutId);
    if (res.ok) {
      return { online: true, latencyMs: Math.round(performance.now() - start) };
    }
    return { online: false, error: `HTTP ${res.status}` };
  } catch (err: any) {
    return { online: false, error: err?.message || "Sin conexión" };
  }
}

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
  return frame;
}

export async function listCameras(): Promise<CameraSource[]> {
  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${VISION_BASE}/api/cameras`, { signal: controller.signal });
    window.clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
    return DEFAULT_CAMERAS;
  } catch (err) {
    console.warn("Servidor de visión local offline o no alcanzable en", VISION_BASE, "- usando catálogo predeterminado de cámaras:", err);
    return DEFAULT_CAMERAS;
  }
}

export async function detectNow(cameraId: string): Promise<DetectionFrame> {
  const res = await fetch(`${VISION_BASE}/api/detect?camera_id=${encodeURIComponent(cameraId)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}: No se pudo ejecutar la detección`);
  }
  const data = await res.json();
  return normalizeFrame(data);
}

export async function detectDual(axisAId: string, axisBId: string): Promise<DetectionFrame> {
  const res = await fetch(
    `${VISION_BASE}/api/detect_dual?axis_a_camera_id=${encodeURIComponent(axisAId)}&axis_b_camera_id=${encodeURIComponent(axisBId)}`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}: No se pudo ejecutar la detección dual`);
  }
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
