import { useEffect, useMemo, useState } from "react";

import type { CameraSource, DetectionFrame } from "@/lib/realVision/client";
import { listCameras, detectNow, setCameraUrl } from "@/lib/realVision/client";

export function RealCameraPanel({
  onFrame,
  onSelectCamera,
}: {
  onFrame: (frame: DetectionFrame) => void;
  onSelectCamera?: (cameraId: string) => void;
}) {
  const [cameras, setCameras] = useState<CameraSource[]>([]);
  const [cameraId, setCameraId] = useState<string>("caba-9-de-julio");
  const [customUrl, setCustomUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastFrame, setLastFrame] = useState<DetectionFrame | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  useEffect(() => {
    listCameras()
      .then((cams) => {
        setCameras(cams);
        if (cams.length > 0) {
          const first = cams[0]!.id;
          setCameraId(first);
          onSelectCamera?.(first);
        }
      })
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
      decision: lastFrame.decision,
    };
  }, [lastFrame]);

  const handleCameraChange = (newId: string) => {
    setCameraId(newId);
    setError(null);
    onSelectCamera?.(newId);
  };

  const handleApplyCustomUrl = async () => {
    if (!customUrl.trim()) return;
    setSnapshotLoading(true);
    setError(null);
    try {
      await setCameraUrl(customUrl.trim());
      onSelectCamera?.("public-url");
      setStatus("connecting");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al conectar URL personalizada");
      setStatus("error");
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleFrame = (frame: DetectionFrame) => {
    setStatus("live");
    setError(null);
    setLastFrame(frame);
    onFrame(frame);
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

  const currentCam = cameras.find((c) => c.id === cameraId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 min-w-[320px]">
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Cámaras de Cruces de Argentina (En Vivo)
          </span>
          <select
            value={cameraId}
            onChange={(e) => handleCameraChange(e.target.value)}
            className="h-9 rounded-md border border-border bg-secondary/60 px-2 text-sm text-foreground focus:ring-1 focus:ring-primary"
          >
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                🇦🇷 {c.name} {c.location ? `— ${c.location}` : ""}
              </option>
            ))}
          </select>
        </label>

        {cameraId === "public-url" && (
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                URL RTSP / HLS / YouTube Live / Stream Directo
              </span>
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... o rtsp://... o .m3u8"
                className="h-9 w-80 rounded-md border border-border bg-secondary/60 px-2 text-sm text-foreground"
              />
            </label>
            <button
              type="button"
              onClick={handleApplyCustomUrl}
              disabled={snapshotLoading || !customUrl.trim()}
              className="h-9 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              Conectar URL
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={handleSnapshot}
          disabled={snapshotLoading}
          className="h-9 rounded-md bg-secondary border border-border px-3 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-accent disabled:opacity-60"
        >
          {snapshotLoading ? "Procesando..." : "Snapshot Rápido"}
        </button>
      </div>

      {currentCam && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <span className="text-emerald-400 font-semibold">Ubicación:</span> {currentCam.location || "Argentina"}
          <span className="mx-1">•</span>
          <span className="text-primary font-semibold">Tipo:</span> {currentCam.intersection_type || "Cruce Vehicular"}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={status} />
        {error && <span className="font-mono text-[11px] text-destructive">{error}</span>}
      </div>

      {metrics && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Metric label="Vehículos (YOLO)" value={`${metrics.vehicles}`} />
          <Metric label="Peatones" value={`${metrics.pedestrians}`} />
          <Metric label="Emergencia" value={metrics.emergency ? "SÍ (Siren/Ambulance)" : "No"} tone={metrics.emergency ? "text-destructive" : ""} />
          <Metric label="Flujo N-S" value={`${(metrics.laneDensity['NS'] || 0).toFixed(0)} veh`} />
          <Metric label="Flujo E-O" value={`${(metrics.laneDensity['EW'] || 0).toFixed(0)} veh`} />
          <Metric label="Confianza IA" value={`${(metrics.confidence * 100).toFixed(0)}%`} />
        </div>
      )}

      {metrics?.decision && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-widest text-emerald-400 uppercase font-semibold">
              Decisión del Semáforo en Tiempo Real (Ameghino AI)
            </span>
            <span className="font-mono text-xs text-emerald-300 font-bold">
              {metrics.decision.action === "EXTEND" ? "EXTENDER VERDE" : "CAMBIAR DE EJE"} ({metrics.decision.seconds}s)
            </span>
          </div>
          <p className="text-xs text-foreground font-mono">{metrics.decision.rationale}</p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map = {
    idle: "bg-secondary text-muted-foreground",
    connecting: "bg-amber-500 text-black",
    live: "bg-emerald-500 text-black font-bold animate-pulse",
    error: "bg-destructive text-destructive-foreground",
  } as const;
  const label = {
    idle: "Inactivo",
    connecting: "Conectando Cámara...",
    live: "● STREAM EN VIVO",
    error: "Error de Conexión",
  } as const;
  return (
    <span className={`rounded-full px-3 py-1 font-mono text-[10px] tracking-widest uppercase ${map[status as keyof typeof map]}`}>
      {label[status as keyof typeof label]}
    </span>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-2.5">
      <p className="font-mono text-[9px] tracking-[0.15em] text-muted-foreground uppercase">{label}</p>
      <p className={`mt-1 font-mono text-sm font-semibold ${tone || "text-foreground"}`}>{value}</p>
    </div>
  );
}
