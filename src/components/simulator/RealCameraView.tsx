/**
 * Vista de Cámaras Reales para Ameghino AI.
 *
 * Grid 2×2 que muestra los feeds de hasta 4 cámaras IP con:
 * - Último frame capturado
 * - Indicador de estado (conectada / error / offline)
 * - Latencia y FPS
 * - Switch para activar/desactivar como fuente del simulador
 */

import { useEffect, useRef, useState } from "react";
import { CameraConnector, type CameraState } from "@/lib/vision/cameraConnector";
import type { CameraConfig } from "@/lib/traffic/trafficDataStore";

/* ------------------------------------------------------------------ */
/* Indicador de estado                                                  */
/* ------------------------------------------------------------------ */

function StatusDot({ status }: { status: CameraState["status"] }) {
  const color =
    status === "connected"
      ? "bg-signal-green"
      : status === "error"
        ? "bg-signal-red"
        : status === "connecting"
          ? "bg-signal-amber animate-pulse"
          : "bg-muted-foreground";

  const label =
    status === "connected"
      ? "Conectada"
      : status === "error"
        ? "Error"
        : status === "connecting"
          ? "Conectando..."
          : "Inactiva";

  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block size-2 rounded-full ${color}`} />
      <span className="font-mono text-[10px] tracking-widest uppercase">{label}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Tarjeta de cámara individual                                         */
/* ------------------------------------------------------------------ */

function CameraCard({ state, config }: { state: CameraState | null; config: CameraConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!state?.lastFrame || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const { imageData, width, height } = state.lastFrame;
    canvasRef.current.width = width;
    canvasRef.current.height = height;
    ctx.putImageData(imageData, 0, 0);
  }, [state?.lastFrame]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-foreground">{config.label}</span>
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-signal-green">
            {config.approach}
          </span>
        </div>
        {state && <StatusDot status={state.status} />}
      </div>

      {/* Canvas / Placeholder */}
      <div className="relative aspect-video bg-black/90">
        {state?.lastFrame ? (
          <canvas
            ref={canvasRef}
            className="size-full object-contain"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <p className="font-mono text-xs text-muted-foreground">
              {state?.status === "error"
                ? state.lastError ?? "Error de conexión"
                : state?.status === "connecting"
                  ? "Conectando con la cámara..."
                  : "Sin señal de video"}
            </p>
          </div>
        )}

        {/* Overlay de métricas */}
        {state?.status === "connected" && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-black/60 px-2 py-1">
            <span className="font-mono text-[10px] text-signal-green">
              {state.fps.toFixed(1)} FPS
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {state.latencyMs} ms
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-3 py-2">
        <p className="truncate font-mono text-[10px] text-muted-foreground">
          {config.url || "URL no configurada"}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Componente principal                                                */
/* ------------------------------------------------------------------ */

interface RealCameraViewProps {
  cameras: CameraConfig[];
  onFrameAnalyzed?: (cameraId: string, approach: string) => void;
}

export function RealCameraView({ cameras, onFrameAnalyzed }: RealCameraViewProps) {
  const connectorRef = useRef<CameraConnector | null>(null);
  const [states, setStates] = useState<Map<string, CameraState>>(new Map());
  const [active, setActive] = useState(false);

  useEffect(() => {
    const connector = new CameraConnector();
    connectorRef.current = connector;

    connector.setOnStatusChange((newStates) => {
      setStates(new Map(newStates));
    });

    connector.setOnFrame((frame) => {
      onFrameAnalyzed?.(frame.cameraId, frame.approach);
    });

    return () => {
      connector.stopAll();
    };
  }, [onFrameAnalyzed]);

  const toggle = () => {
    if (!connectorRef.current) return;
    if (active) {
      connectorRef.current.stopAll();
      setActive(false);
    } else {
      const enabled = cameras.filter((c) => c.enabled && c.url);
      if (enabled.length === 0) return;
      connectorRef.current.start(enabled);
      setActive(true);
    }
  };

  const enabledCameras = cameras.filter((c) => c.enabled && c.url);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-mono text-[11px] font-semibold tracking-[0.25em] text-muted-foreground uppercase">
            Cámaras Reales — Cruce de Caseros
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {enabledCameras.length} cámara(s) configurada(s) ·{" "}
            {active ? "Captura activa" : "Inactivas"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={enabledCameras.length === 0}
          className={`rounded-lg px-4 py-2 font-mono text-xs font-semibold transition-colors ${
            active
              ? "bg-signal-red/80 text-white hover:bg-signal-red"
              : "bg-signal-green/90 text-white hover:bg-signal-green disabled:opacity-40"
          }`}
        >
          {active ? "■ Detener" : "▶ Conectar"}
        </button>
      </div>

      {enabledCameras.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-secondary/20 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No hay cámaras configuradas. Agregá cámaras desde el{" "}
            <span className="font-semibold text-foreground">Panel de Gestión</span>.
          </p>
        </div>
      )}

      {enabledCameras.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {enabledCameras.map((cam) => (
            <CameraCard key={cam.id} config={cam} state={states.get(cam.id) ?? null} />
          ))}
        </div>
      )}
    </section>
  );
}
