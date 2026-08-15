import { useEffect, useMemo, useRef, useState } from "react";

import type { CameraSource, DetectionFrame } from "@/lib/realVision/client";
import {
  DEFAULT_CAMERAS,
  listCameras,
  detectNow,
  detectDual,
  setCameraUrl,
  connectCameraStream,
  connectDualCameraStream,
  getCameraSnapshotUrl,
  checkVisionBackendHealth,
} from "@/lib/realVision/client";

export function RealCameraPanel({
  onFrame,
  onSelectCamera,
}: {
  onFrame: (frame: DetectionFrame) => void;
  onSelectCamera?: (cameraId: string) => void;
}) {
  const [cameras, setCameras] = useState<CameraSource[]>(DEFAULT_CAMERAS);
  const [cameraId, setCameraId] = useState<string>("london-purley-way-croydon-road");
  const [dualAxisA, setDualAxisA] = useState<string>("london-purley-way-croydon-road");
  const [dualAxisB, setDualAxisB] = useState<string>("london-lewisham-way-parkfield");
  const [customUrl, setCustomUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "preview" | "error">("idle");
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFrame, setLastFrame] = useState<DetectionFrame | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [dualLoading, setDualLoading] = useState(false);
  const [snapshotTimestamp, setSnapshotTimestamp] = useState<number>(Date.now());

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
        // cerrar forzadamente
      }
      wsRef.current = null;
    }
  };

  const startStream = (mode: "single" | "dual", axisAId: string, axisBId?: string) => {
    stopStream();
    pollMode.current = mode;
    setStatus("connecting");
    const onError = (err: Error) => {
      // Si el WebSocket falla, caemos en modo vista previa sin romper la UI
      setStatus("preview");
      setError(null);
      // Reintento pausado cada 8 s para verificar si el backend de visión arrancó
      if (!wsRef.current) {
        pollTimer.current = window.setInterval(() => {
          checkVisionBackendHealth().then((h) => {
            if (h.online) {
              setBackendOnline(true);
              startStream(mode, axisAId, axisBId);
            }
          });
        }, 8000);
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
    setBackendOnline(true);
    setError(null);
    setLastFrame(frame);
    try {
      onFrame(frame);
    } catch (err) {
      console.error("Error in onFrame callback:", err);
    }
  };

  const fetchCameras = async () => {
    setStatus("connecting");
    setError(null);
    const health = await checkVisionBackendHealth();
    setBackendOnline(health.online);

    try {
      const cams = await listCameras();
      if (cams && cams.length > 0) {
        setCameras(cams);
      } else {
        setCameras(DEFAULT_CAMERAS);
      }

      if (health.online) {
        detectNow(cameraId)
          .then(handleFrame)
          .catch(() => {
            setStatus("preview");
          });
        startStream("single", cameraId);
      } else {
        setStatus("preview");
      }
    } catch (err) {
      setCameras(DEFAULT_CAMERAS);
      setStatus("preview");
    }
  };

  useEffect(() => {
    fetchCameras();
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
    setSnapshotTimestamp(Date.now());
    onSelectCamera?.(newId);

    if (backendOnline) {
      setSnapshotLoading(true);
      detectNow(newId)
        .then((frame) => {
          handleFrame(frame);
          startStream("single", newId);
        })
        .catch(() => {
          setStatus("preview");
        })
        .finally(() => {
          setSnapshotLoading(false);
        });
    } else {
      setStatus("preview");
    }
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
    setSnapshotTimestamp(Date.now());
    try {
      const id = cameraId === "public-url" ? "public-url" : cameraId;
      const frame = await detectNow(id);
      handleFrame(frame);
      setStatus("live");
    } catch (err) {
      setStatus("preview");
      setError("Servidor de visión local en puerto 8787 no activo. Mostrando fotograma directo de la cámara.");
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleDualSnapshot = async () => {
    setDualLoading(true);
    setError(null);
    setSnapshotTimestamp(Date.now());
    try {
      const frame = await detectDual(dualAxisA, dualAxisB);
      handleFrame(frame);
      setStatus("live");
      startStream("dual", dualAxisA, dualAxisB);
    } catch (err) {
      setStatus("preview");
      setError("Detección dual requiere el servidor de visión (`npm run dev:vision`). Mostrando ambas cámaras en vivo.");
    } finally {
      setDualLoading(false);
    }
  };

  const currentCam = cameras.find((c) => c.id === cameraId) || cameras[0];
  const previewUrlA = currentCam ? getCameraSnapshotUrl(currentCam) : null;
  const camA = cameras.find((c) => c.id === dualAxisA);
  const camB = cameras.find((c) => c.id === dualAxisB);
  const previewDualA = camA ? getCameraSnapshotUrl(camA) : null;
  const previewDualB = camB ? getCameraSnapshotUrl(camB) : null;

  const argCameras = cameras.filter((c) => c.location?.includes("CABA") || c.location?.includes("Córdoba") || c.name.includes("Buenos Aires") || c.name.includes("Córdoba"));
  const intlCameras = cameras.filter((c) => c.id.startsWith("london-"));
  const otherCameras = cameras.filter((c) => !argCameras.includes(c) && !intlCameras.includes(c));

  return (
    <div className="flex flex-col gap-4">
      {/* Selector Principal de Cámaras */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 min-w-[340px] flex-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Cámaras de Cruces con Semáforos (En Vivo)
            </span>
            <span className="font-mono text-[10px] text-emerald-400 font-semibold">
              {cameras.length} Fuentes Disponibles
            </span>
          </div>
          <select
            value={cameraId}
            onChange={(e) => handleCameraChange(e.target.value)}
            className="h-10 rounded-lg border border-border bg-secondary/80 px-3 text-sm text-foreground focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-colors"
          >
            {intlCameras.length > 0 && (
              <optgroup label="🇬🇧 Cruces con Semáforos e Inferencia YOLO">
                {intlCameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.location ? `— ${c.location}` : ""}
                  </option>
                ))}
              </optgroup>
            )}
            {argCameras.length > 0 && (
              <optgroup label="🇦🇷 Cámaras de Avenidas en Argentina">
                {argCameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.location ? `— ${c.location}` : ""}
                  </option>
                ))}
              </optgroup>
            )}
            {otherCameras.length > 0 && (
              <optgroup label="⚙️ Fuentes Locales / Personalizadas">
                {otherCameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
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
                className="h-10 w-80 rounded-lg border border-border bg-secondary/80 px-3 text-sm text-foreground"
              />
            </label>
            <button
              type="button"
              onClick={handleApplyCustomUrl}
              disabled={snapshotLoading || !customUrl.trim()}
              className="h-10 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
            >
              Conectar URL
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={handleSnapshot}
          disabled={snapshotLoading}
          className="h-10 rounded-lg bg-emerald-600 border border-emerald-500/50 px-5 text-xs font-bold text-white transition-all hover:bg-emerald-500 shadow-md shadow-emerald-950/50 disabled:opacity-60 cursor-pointer"
        >
          {snapshotLoading ? "Analizando Cámara..." : "Probar Detección En Vivo"}
        </button>
      </div>

      {/* Simulación de Cruce Real con 2 Cámaras */}
      <div className="rounded-xl border border-sky-500/30 bg-sky-950/15 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-sky-500" />
            </span>
            <span className="font-mono text-[11px] tracking-widest text-sky-400 uppercase font-bold">
              Simulación de Cruce Real: 2 Cámaras (una por eje, de frente al tráfico)
            </span>
          </div>
          <span className="font-mono text-[10px] text-sky-300/80">
            Fusión Multieje en Tiempo Real
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 min-w-[280px] flex-1">
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Cámara 1 — Eje N-S (Semáforo Lado A)
            </span>
            <select
              value={dualAxisA}
              onChange={(e) => {
                setDualAxisA(e.target.value);
                if (backendOnline) startStream("dual", e.target.value, dualAxisB);
              }}
              className="h-9 rounded-md border border-border bg-secondary/80 px-2 text-sm text-foreground focus:ring-1 focus:ring-sky-500"
            >
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.location ? `— ${c.location}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 min-w-[280px] flex-1">
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Cámara 2 — Eje E-O (Semáforo Lado B)
            </span>
            <select
              value={dualAxisB}
              onChange={(e) => {
                setDualAxisB(e.target.value);
                if (backendOnline) startStream("dual", dualAxisA, e.target.value);
              }}
              className="h-9 rounded-md border border-border bg-secondary/80 px-2 text-sm text-foreground focus:ring-1 focus:ring-sky-500"
            >
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.location ? `— ${c.location}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleDualSnapshot}
            disabled={dualLoading || dualAxisA === dualAxisB}
            className="h-9 rounded-md bg-sky-600 border border-sky-500/50 px-4 text-xs font-bold text-white transition-colors hover:bg-sky-500 shadow-md shadow-sky-950/50 disabled:opacity-60 cursor-pointer"
          >
            {dualLoading ? "Analizando Ambas Cámaras..." : "Probar Cruce Simulado (2 Cámaras)"}
          </button>
        </div>
      </div>

      {currentCam && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground font-mono bg-secondary/20 p-2.5 rounded-lg border border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-semibold">Ubicación:</span> {currentCam.location || "Argentina"}
            <span className="mx-1 text-border">•</span>
            <span className="text-primary font-semibold">Tipo:</span> {currentCam.intersection_type || "Cruce Vehicular"}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={status} backendOnline={backendOnline} />
            <button
              type="button"
              onClick={fetchCameras}
              className="rounded bg-secondary/80 hover:bg-secondary border border-border px-2.5 py-1 text-[10px] font-semibold text-foreground transition-colors cursor-pointer"
            >
              🔄 Actualizar / Comprobar Backend (8787)
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2">
          <span className="font-mono text-xs text-destructive">{error}</span>
        </div>
      )}

      {/* Visor de Video de la Cámara en Vivo / Fotograma Directo */}
      {lastFrame?.rawImage ? (
        <div className="relative overflow-hidden rounded-xl border border-emerald-500/40 bg-black/90 shadow-2xl">
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
      ) : previewUrlA ? (
        <div className="relative overflow-hidden rounded-xl border border-border/80 bg-black/90 shadow-xl">
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-md bg-black/80 px-3 py-1.5 backdrop-blur-md border border-border">
            <span className="inline-block size-2 rounded-full bg-amber-400" />
            <span className="font-mono text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              FOTOGRAMA EN VIVO DE CÁMARA REAL (VISTA DIRECTA)
            </span>
          </div>
          <img
            src={`${previewUrlA}?_t=${snapshotTimestamp}`}
            alt={currentCam?.name || "Cámara de cruce"}
            className="w-full max-h-[480px] object-contain bg-slate-950"
            onError={(e) => {
              // Si falla la carga de imagen, ocultar silenciosamente
              (e.target as HTMLElement).style.display = "none";
            }}
          />
        </div>
      ) : null}

      {/* Visor Dual (2 Cámaras) */}
      {lastFrame?.dual && lastFrame.rawImageB ? (
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
      ) : previewDualA && previewDualB && dualAxisA !== dualAxisB ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="relative overflow-hidden rounded-xl border border-sky-500/30 bg-black/80 shadow-xl">
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-md bg-black/80 px-3 py-1.5 backdrop-blur-md border border-sky-500/20">
              <span className="inline-block size-2 rounded-full bg-sky-400" />
              <span className="font-mono text-[10px] font-bold tracking-wider text-sky-400 uppercase">
                CÁMARA 1 (N-S): {camA?.name}
              </span>
            </div>
            <img
              src={`${previewDualA}?_t=${snapshotTimestamp}`}
              alt={camA?.name || "Cámara 1"}
              className="w-full h-64 object-cover bg-slate-950"
            />
          </div>
          <div className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-black/80 shadow-xl">
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-md bg-black/80 px-3 py-1.5 backdrop-blur-md border border-emerald-500/20">
              <span className="inline-block size-2 rounded-full bg-emerald-400" />
              <span className="font-mono text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                CÁMARA 2 (E-O): {camB?.name}
              </span>
            </div>
            <img
              src={`${previewDualB}?_t=${snapshotTimestamp}`}
              alt={camB?.name || "Cámara 2"}
              className="w-full h-64 object-cover bg-slate-950"
            />
          </div>
        </div>
      ) : null}

      {/* Métricas y Telemetría */}
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

function StatusBadge({ status, backendOnline }: { status: string; backendOnline?: boolean | null }) {
  if (status === "live") {
    return (
      <span className="rounded-full bg-emerald-500 text-black px-3 py-1 font-mono text-[10px] font-bold tracking-widest uppercase animate-pulse">
        ● STREAM YOLO EN VIVO
      </span>
    );
  }
  if (status === "connecting") {
    return (
      <span className="rounded-full bg-amber-500 text-black px-3 py-1 font-mono text-[10px] font-bold tracking-widest uppercase">
        CONECTANDO CÁMARA...
      </span>
    );
  }
  if (backendOnline === false || status === "preview") {
    return (
      <span className="rounded-full bg-secondary border border-border text-muted-foreground px-3 py-1 font-mono text-[10px] tracking-widest uppercase">
        CATÁLOGO ACTIVO (CÁMARAS REALES)
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="rounded-full bg-destructive text-destructive-foreground px-3 py-1 font-mono text-[10px] tracking-widest uppercase">
        ERROR DE CONEXIÓN
      </span>
    );
  }
  return (
    <span className="rounded-full bg-secondary text-muted-foreground px-3 py-1 font-mono text-[10px] tracking-widest uppercase">
      LISTO
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

