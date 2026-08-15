import { useEffect, useMemo, useRef, useState } from "react";

import type { CameraSource, DetectionFrame } from "@/lib/realVision/client";
import { listCameras, detectNow, detectDual, setCameraUrl, connectCameraStream, connectDualCameraStream } from "@/lib/realVision/client";

export function RealCameraPanel({
  onFrame,
  onSelectCamera,
}: {
  onFrame: (frame: DetectionFrame) => void;
  onSelectCamera?: (cameraId: string) => void;
}) {
  const [cameras, setCameras] = useState<CameraSource[]>([]);
  const [cameraId, setCameraId] = useState<string>("london-purley-way-croydon-road");
  const [dualAxisA, setDualAxisA] = useState<string>("london-purley-way-croydon-road");
  const [dualAxisB, setDualAxisB] = useState<string>("london-lewisham-way-parkfield");
  const [customUrl, setCustomUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastFrame, setLastFrame] = useState<DetectionFrame | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [dualLoading, setDualLoading] = useState(false);

  const pollTimer = useRef<number | null>(null);
  const pollMode = useRef<"single" | "dual">("single");
  const wsRef = useRef<WebSocket | null>(null);

  const stopStream = () => {
    if (pollTimer.current !== null) {
      window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // cerrar a la fuerza
      }
      wsRef.current = null;
    }
  };

  const startStream = (mode: "single" | "dual", axisAId: string, axisBId?: string) => {
    stopStream();
    pollMode.current = mode;
    setStatus("connecting");
    const onError = (err: Error) => {
      setStatus("error");
      setError(`Stream interrumpido: ${err.message}`);
      // Reintento automático cada 3 s mientras la página esté abierta.
      if (!wsRef.current) {
        pollTimer.current = window.setInterval(() => {
          startStream(mode, axisAId, axisBId);
        }, 3000);
      }
    };
    if (mode === "dual" && axisBId) {
      wsRef.current = connectDualCameraStream(axisAId, axisBId, handleFrame, onError);
    } else {
      wsRef.current = connectCameraStream(axisAId, handleFrame, onError);
    }
  };

  useEffect(() => {
    return () => stopStream();
  }, []);

  const handleFrame = (frame: DetectionFrame) => {
    setStatus("live");
    setError(null);
    setLastFrame(frame);
    try {
      onFrame(frame);
    } catch (err) {
      console.error("Error in onFrame callback:", err);
    }
  };

  const fetchCameras = () => {
    setStatus("connecting");
    setError(null);
    listCameras()
      .then((cams) => {
        setCameras(cams);
        if (cams.length > 0) {
          const first = cams[0]!.id;
          setCameraId(first);
          onSelectCamera?.(first);
          // Cargar automáticamente el primer fotograma en vivo
          detectNow(first).then(handleFrame).catch(() => {});
        }
        setStatus("idle");
      })
      .catch((err) => {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Error de conexión con el backend de visión (Puerto 8787)");
      });
  };

  useEffect(() => {
    fetchCameras();
    startStream("single", "london-purley-way-croydon-road");
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setSnapshotLoading(true);
    detectNow(newId)
      .then((frame) => {
        handleFrame(frame);
        startStream("single", newId);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error al cargar la cámara");
      })
      .finally(() => {
        setSnapshotLoading(false);
      });
  };

  const handleApplyCustomUrl = async () => {
    if (!customUrl.trim()) return;
    setSnapshotLoading(true);
    setError(null);
    try {
      await setCameraUrl(customUrl.trim());
      onSelectCamera?.("public-url");
      setCameraId("public-url");
      setStatus("connecting");
      const frame = await detectNow("public-url");
      handleFrame(frame);
      startStream("single", "public-url");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al conectar URL personalizada");
      setStatus("error");
    } finally {
      setSnapshotLoading(false);
    }
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

  const handleDualSnapshot = async () => {
    setDualLoading(true);
    setError(null);
    try {
      const frame = await detectDual(dualAxisA, dualAxisB);
      handleFrame(frame);
      setStatus("live");
      startStream("dual", dualAxisA, dualAxisB);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Error en la detección dual");
    } finally {
      setDualLoading(false);
    }
  };

  const currentCam = cameras.find((c) => c.id === cameraId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 min-w-[320px]">
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Cámaras de Cruces con Semáforos (En Vivo)
          </span>
          <select
            value={cameraId}
            onChange={(e) => handleCameraChange(e.target.value)}
            className="h-9 rounded-md border border-border bg-secondary/60 px-2 text-sm text-foreground focus:ring-1 focus:ring-primary"
          >
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                🌍 {c.name} {c.location ? `— ${c.location}` : ""}
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
          className="h-9 rounded-md bg-emerald-600 border border-emerald-500/50 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-500 shadow-md shadow-emerald-950/50 disabled:opacity-60"
        >
          {snapshotLoading ? "Analizando Cámara..." : "Probar Detección En Vivo"}
        </button>
      </div>

      <div className="rounded-xl border border-sky-500/30 bg-sky-950/10 p-3 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-sky-500" />
          </span>
          <span className="font-mono text-[10px] tracking-widest text-sky-400 uppercase font-bold">
            Simulación de Cruce Real: 2 Cámaras (una por eje, de frente al tráfico)
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 min-w-[300px]">
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Cámara 1 — Eje N-S (semáforo lado A)
            </span>
            <select
              value={dualAxisA}
              onChange={(e) => {
                setDualAxisA(e.target.value);
                startStream("dual", e.target.value, dualAxisB);
              }}
              className="h-9 rounded-md border border-border bg-secondary/60 px-2 text-sm text-foreground focus:ring-1 focus:ring-sky-500"
            >
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  🌍 {c.name} {c.location ? `— ${c.location}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 min-w-[300px]">
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Cámara 2 — Eje E-O (semáforo lado B)
            </span>
            <select
              value={dualAxisB}
              onChange={(e) => {
                setDualAxisB(e.target.value);
                startStream("dual", dualAxisA, e.target.value);
              }}
              className="h-9 rounded-md border border-border bg-secondary/60 px-2 text-sm text-foreground focus:ring-1 focus:ring-sky-500"
            >
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  🌍 {c.name} {c.location ? `— ${c.location}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleDualSnapshot}
            disabled={dualLoading || dualAxisA === dualAxisB}
            className="h-9 rounded-md bg-sky-600 border border-sky-500/50 px-4 text-xs font-bold text-white transition-colors hover:bg-sky-500 shadow-md shadow-sky-950/50 disabled:opacity-60"
          >
            {dualLoading ? "Analizando Ambas Cámaras..." : "Probar Cruce Simulado (2 Cámaras)"}
          </button>
        </div>
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
        {error && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-destructive">{error}</span>
            <button
              type="button"
              onClick={fetchCameras}
              className="rounded bg-destructive/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-destructive hover:bg-destructive/30"
            >
              Reintentar Conexión (Port 8787)
            </button>
          </div>
        )}
      </div>

      {/* Visor de Video de la Cámara en Vivo directamente en el Panel */}
      {lastFrame?.rawImage && (
        <div className="relative overflow-hidden rounded-xl border border-emerald-500/40 bg-black/80 shadow-2xl">
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-md bg-black/80 px-3 py-1.5 backdrop-blur-md border border-emerald-500/30">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[11px] font-bold tracking-wider text-emerald-400 uppercase">
              FEED EN VIVO DE CÁMARA (PROCESADO POR AMEGHINO AI & YOLO)
            </span>
          </div>
          <img
            src={`data:image/jpeg;base64,${lastFrame.rawImage}`}
            alt="Feed en vivo de la cámara de la intersección"
            className="w-full max-h-[480px] object-contain bg-slate-950"
          />
        </div>
      )}

      {lastFrame?.dual && lastFrame.rawImageB && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="relative overflow-hidden rounded-xl border border-sky-500/40 bg-black/80 shadow-2xl">
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-md bg-black/80 px-3 py-1.5 backdrop-blur-md border border-sky-500/30">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-sky-500" />
              </span>
              <span className="font-mono text-[11px] font-bold tracking-wider text-sky-400 uppercase">
                CÁMARA 1 · EJE N-S
              </span>
            </div>
            <img
              src={`data:image/jpeg;base64,${lastFrame.rawImage}`}
              alt="Cámara 1 del cruce simulado (eje N-S)"
              className="w-full object-contain bg-slate-950"
            />
          </div>
          <div className="relative overflow-hidden rounded-xl border border-emerald-500/40 bg-black/80 shadow-2xl">
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-md bg-black/80 px-3 py-1.5 backdrop-blur-md border border-emerald-500/30">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-mono text-[11px] font-bold tracking-wider text-emerald-400 uppercase">
                CÁMARA 2 · EJE E-O
              </span>
            </div>
            <img
              src={`data:image/jpeg;base64,${lastFrame.rawImageB}`}
              alt="Cámara 2 del cruce simulado (eje E-O)"
              className="w-full object-contain bg-slate-950"
            />
          </div>
        </div>
      )}

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
