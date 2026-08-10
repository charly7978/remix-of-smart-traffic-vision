import { useEffect, useMemo, useState } from "react";

import type { CameraSource, DetectionFrame } from "@/lib/traffic/types";
import { listCameras, detectNow } from "@/lib/realVision/client";

export function RealCameraPanel({
  onFrame,
}: {
  onFrame: (frame: DetectionFrame) => void;
}) {
  const [cameras, setCameras] = useState<CameraSource[]>([]);
  const [cameraId, setCameraId] = useState<string>("local-webcam");
  const [customUrl, setCustomUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastFrame, setLastFrame] = useState<DetectionFrame | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  useEffect(() => {
    listCameras()
      .then(setCameras)
      .catch(() => setStatus("error"));
  }, []);

  const metrics = useMemo(() => {
    if (!lastFrame) return null;
    const laneDensity = lastFrame.laneDensity || {};
    return {
      vehicles: lastFrame.vehicles.length,
      pedestrians: lastFrame.pedestrians.length,
      emergency: lastFrame.emergencyDetected,
      weather: lastFrame.weather,
      night: lastFrame.isNight,
      laneDensity,
      confidence: lastFrame.vehicles.length
        ? lastFrame.vehicles.reduce((a, b) => a + b.confidence, 0) / lastFrame.vehicles.length
        : 0,
    };
  }, [lastFrame]);

  const handleFrame = (frame: DetectionFrame) => {
    setStatus("live");
    setError(null);
    setLastFrame(frame);
    onFrame(frame);
  };

  const handleError = (err: Error) => {
    setStatus("error");
    setError(err.message);
  };

  const handleSnapshot = async () => {
    setSnapshotLoading(true);
    setError(null);
    try {
      const id = cameraId === "public-url" ? "public-url" : cameraId;
      const frame = await detectNow(id);
      handleFrame(frame);
      setStatus("live");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Error en la detección");
    } finally {
      setSnapshotLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Cámara
          </span>
          <select
            value={cameraId}
            onChange={(e) => setCameraId(e.target.value)}
            className="h-9 rounded-md border border-border bg-secondary/60 px-2 text-sm text-foreground"
          >
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.location ? `(${c.location})` : ""}
              </option>
            ))}
          </select>
        </label>

        {cameraId === "public-url" && (
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              URL RTSP/MJPEG/HTTP
            </span>
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="rtsp://...  o  http://.../stream.mjpg  o  http://.../foto.jpg"
              className="h-9 w-80 rounded-md border border-border bg-secondary/60 px-2 text-sm text-foreground"
            />
          </label>
        )}

        <button
          type="button"
          onClick={handleSnapshot}
          disabled={snapshotLoading || (cameraId === "public-url" && !customUrl.trim())}
          className="h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-60"
        >
          {snapshotLoading ? "Detectando..." : "Probar detección"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusBadge status={status} />
        {error && <span className="font-mono text-[11px] text-destructive">{error}</span>}
      </div>

      {metrics && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Vehículos" value={`${metrics.vehicles}`} />
          <Metric label="Peatones" value={`${metrics.pedestrians}`} />
          <Metric label="Emergencia" value={metrics.emergency ? "Sí" : "No"} tone={metrics.emergency ? "text-destructive" : ""} />
          <Metric label="Clima" value={metrics.weather} />
          <Metric label="Noche" value={metrics.night ? "Sí" : "No"} />
          <Metric label="Confianza" value={`${(metrics.confidence * 100).toFixed(0)}%`} />
          <Metric label="NS" value={`${(laneDensity['NS'] || 0).toFixed(1)}`} />
          <Metric label="EW" value={`${(laneDensity['EW'] || 0).toFixed(1)}`} />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map = {
    idle: "bg-secondary text-muted-foreground",
    connecting: "bg-signal-amber text-primary-foreground",
    live: "bg-signal-green text-primary-foreground",
    error: "bg-destructive text-primary-foreground",
  } as const;
  const label = {
    idle: "Inactivo",
    connecting: "Conectando",
    live: "En vivo",
    error: "Error",
  } as const;
  return (
    <span className={`rounded-full px-3 py-1 font-mono text-[10px] tracking-widest uppercase ${map[status as keyof typeof map]}`}>
      {label[status as keyof typeof label]}
    </span>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <p className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">{label}</p>
      <p className={`mt-1 font-mono text-sm font-semibold ${tone || "text-foreground"}`}>{value}</p>
    </div>
  );
}
