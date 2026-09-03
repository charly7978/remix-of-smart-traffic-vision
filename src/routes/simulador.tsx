import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { DEFAULT_DRAW_OPTIONS, drawScene, type DrawOptions } from "@/components/simulator/draw";
import { drawScene3D } from "@/components/simulator/render3d";
import { loadSprites } from "@/lib/photo/spriteManager";
import { AuditPanel, type AuditFrame } from "@/components/simulator/AuditPanel";
import { CounterfactualPanel } from "@/components/simulator/CounterfactualPanel";
import { EventTimeline } from "@/components/simulator/EventTimeline";
import { FLOW_PRESETS, FlowProfileEditor } from "@/components/simulator/FlowProfileEditor";
import { WaitChart } from "@/components/simulator/WaitChart";
import { GeometryEditor } from "@/components/simulator/GeometryEditor";
import { PitchModeModal } from "@/components/simulator/PitchModeModal";
import {
  APPROACH_LABEL_ES,
  DEFAULT_PRIORITY,
  DEFAULT_EVENTS,
  DEFAULT_FLOW,
  KIND_LABEL_ES,
  TrafficEngine,
  WEATHER_LABEL_ES,
  type PriorityConfig,
  type ScenarioEvent,
  type Snapshot,
  type Weather,
} from "@/lib/traffic/engine";

export const Route = createFileRoute("/simulador")({
  head: () => ({
    meta: [
      { title: "Gemelo Digital 3D de Intersección — Ameghino AI" },
      {
        name: "description",
        content:
          "Gemelo digital ultra-sofisticado de la intersección de Caseros (Tres de Febrero). Controlador adaptativo Ameghino AI con visión artificial YOLOv11, protocolo nocturno de seguridad, prioridad peatonal y corredor de emergencia SAME 3F.",
      },
      { property: "og:title", content: "Gemelo Digital 3D de Intersección — Ameghino AI" },
      {
        property: "og:description",
        content:
          "Simulador fotorrealista 3D de la esquina de Av. San Martín y Urquiza con el 100% de la lógica de Inteligencia Artificial en el borde.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SimuladorPage,
});

/* ------------------------------------------------------------------ */
/* Guion institucional para Caseros (Tres de Febrero)                  */
/* ------------------------------------------------------------------ */

interface Scene {
  id: string;
  kicker: string;
  title: string;
  narration: string;
  takeaway: string;
  seconds: number;
  apply: (e: TrafficEngine) => void;
}

const SCENES: Scene[] = [
  {
    id: "pico",
    kicker: "Escena 1 de 5",
    title: "Hora pico en Av. San Martín y Urquiza",
    narration:
      "A las 08:00 la avenida San Martín concentra el flujo de colectivos (Línea 343 y 181) y vehículos particulares de Caseros. El procesador Jetson Orin Nano cuenta objetos en tiempo real y asigna el verde en función exacta de la cola observada, reduciendo la espera innecesaria.",
    takeaway:
      "El verde deja de ser una constante rígida y pasa a ser una función directa de la demanda real observada por IA.",
    seconds: 26,
    apply: (e) => {
      e.setWeather("clear", true);
      e.setCameraOffline(false);
      e.setHour(7.9);
      e.setNsShare(0.65);
      e.setFlowProfile(FLOW_PRESETS[0]!.profile);
      e.setMinutesPerSecond(2);
    },
  },
  {
    id: "noche",
    kicker: "Escena 2 de 5",
    title: "Madrugada 03:00 AM: Protocolo Nocturno de Seguridad",
    narration:
      "Durante la noche, detenerse en rojo frente a una calle desierta es un riesgo crítico de seguridad en el Conurbano. Al detectar un vehículo aproximándose sin tránsito transversal en Urquiza, la IA libera el verde de inmediato (0s de espera), protegiendo al vecino sin omitir los tiempos de seguridad.",
    takeaway:
      "Cero esperas innecesarias en horarios de riesgo delictivo, manteniendo siempre el entreverde de seguridad vial.",
    seconds: 22,
    apply: (e) => {
      e.setWeather("clear", true);
      e.setCameraOffline(false);
      e.setHour(2.9);
      e.setNsShare(0.5);
      e.setMinutesPerSecond(2);
    },
  },
  {
    id: "peaton",
    kicker: "Escena 3 de 5",
    title: "Prioridad Peatonal y Movilidad Reducida",
    narration:
      "El sistema detecta personas esperando en las sendas peatonales de Caseros y distingue a vecinos mayores o con movilidad reducida (sillas de ruedas o bastones). En ese instante acota el verde vehicular y otorga una extensión automática del tiempo de cruce seguro.",
    takeaway:
      "Inclusión y seguridad vial garantizada para el usuario más vulnerable de la vía pública.",
    seconds: 24,
    apply: (e) => {
      e.setWeather("clear", true);
      e.setCameraOffline(false);
      e.setHour(11.4);
      e.setNsShare(0.55);
      e.setMinutesPerSecond(1.5);
      for (let i = 0; i < 4; i++) e.spawnPedestrian(i % 2 === 0 ? "NS" : "EW");
    },
  },
  {
    id: "clima",
    kicker: "Escena 4 de 5",
    title: "Lluvia y Niebla: Percepción Degradada y Tolerancia",
    narration:
      "Bajo condiciones de lluvia o niebla densa sobre Caseros, la confianza del detector YOLOv11 disminuye. El controlador compensa agregando margen de frenado adicional y monitorea la tasa de clasificación para asegurar decisiones confiables.",
    takeaway:
      "El sistema autoevalúa continuamente su nivel de confianza y declara sus límites de operación.",
    seconds: 24,
    apply: (e) => {
      e.setCameraOffline(false);
      e.setHour(18.2);
      e.setWeather("rain");
      e.setNsShare(0.58);
      e.setMinutesPerSecond(2);
    },
  },
  {
    id: "failsafe",
    kicker: "Escena 5 de 5",
    title: "Fail-Safe por Falla de Sensor y Corredor SAME 3F",
    narration:
      "Si se interrumpe el sensor o el enlace de video, el hardware de borde pasa instantáneamente al ciclo fijo pregrabado seguro (22 s por eje) y notifica al Centro de Monitoreo (COM). Cuando arriba una ambulancia del SAME 3F, el corredor de emergencia garantiza verde continuo con enclavamiento físico anti-colisión.",
    takeaway:
      "Arquitectura determinista que garantiza cero posibilidad de luces verdes en conflicto.",
    seconds: 26,
    apply: (e) => {
      e.setHour(21.2);
      e.setWeather("fog");
      e.setCameraOffline(true);
      e.setMinutesPerSecond(2);
      window.setTimeout(() => e.triggerEmergency(), 5000);
    },
  },
];

/* ------------------------------------------------------------------ */
/* Primitivas de UI                                                     */
/* ------------------------------------------------------------------ */

const PHASE_LABEL: Record<Snapshot["phase"], string> = {
  green: "VERDE",
  amber: "AMARILLO",
  allred: "TODO ROJO",
};

function clock(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function Panel({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-mono text-[11px] font-semibold tracking-[0.25em] text-muted-foreground uppercase">
          {title}
        </h2>
        {right}
      </div>
      {subtitle && (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Chip({
  active,
  tone = "default",
  onClick,
  children,
}: {
  active?: boolean;
  tone?: "default" | "danger" | "warn";
  onClick: () => void;
  children: ReactNode;
}) {
  const activeClass =
    tone === "danger"
      ? "bg-destructive text-destructive-foreground"
      : tone === "warn"
        ? "bg-signal-amber text-primary-foreground"
        : "bg-primary text-primary-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active ? activeClass : "bg-secondary text-secondary-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase transition-colors ${
        on
          ? "border-primary/50 bg-primary/10 text-signal-green"
          : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className={`size-1.5 rounded-full ${on ? "bg-signal-green" : "bg-muted-foreground"}`} />
      {children}
    </button>
  );
}

function Metric({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 px-3 py-3">
      <p className={`font-mono text-xl leading-none font-semibold ${tone ?? "text-foreground"}`}>
        {value}
      </p>
      <p className="mt-2 text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

const WEATHERS: Weather[] = ["clear", "rain", "fog"];

/* ------------------------------------------------------------------ */
/* Componente Principal: Simulador Ameghino AI                         */
/* ------------------------------------------------------------------ */

function SimuladorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<TrafficEngine | null>(null);
  const optsRef = useRef<DrawOptions>({ ...DEFAULT_DRAW_OPTIONS });
  const viewRef = useRef<"3d" | "cenital">("3d");
  const pausedRef = useRef(false);
  const framesRef = useRef<AuditFrame[]>([]);
  const thumbRef = useRef<HTMLCanvasElement | null>(null);

  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [mode, setMode] = useState<"guiado" | "libre">("guiado");
  const [layers, setLayers] = useState<DrawOptions>({ ...DEFAULT_DRAW_OPTIONS });
  const [view, setView] = useState<"3d" | "cenital">("3d");
  const [paused, setPaused] = useState(false);
  const [frames, setFrames] = useState<AuditFrame[]>([]);
  const [priority, setPriority] = useState<PriorityConfig>({ ...DEFAULT_PRIORITY });
  const [isPitchOpen, setIsPitchOpen] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);

  // Guion guiado
  const [sceneIndex, setSceneIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [sceneProgress, setSceneProgress] = useState(0);

  // Escenario libre
  const [flow, setFlow] = useState<number[]>([...DEFAULT_FLOW]);
  const [events, setEvents] = useState<ScenarioEvent[]>([...DEFAULT_EVENTS]);
  const [nsShare, setNsShare] = useState(0.58);
  const [speed, setSpeed] = useState(3);
  const [running, setRunning] = useState(true);
  const [startHour, setStartHour] = useState(8);

  optsRef.current = layers;
  viewRef.current = view;
  pausedRef.current = paused || isCalibrating; // Pausa forzada durante calibración

  useEffect(() => {
    loadSprites();
    const engine = new TrafficEngine();
    engine.setFlowProfile(flow);
    engine.setEvents(mode === "guiado" ? [] : events);
    engine.setNsShare(nsShare);
    engine.setMinutesPerSecond(speed);
    engine.setClockRunning(true);
    engine.setHour(startHour);
    engineRef.current = engine;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = 800 * dpr;
    canvas.height = 800 * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let capAcc = 0;
    let lastDecisionId = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!pausedRef.current) engine.update(dt);

      if (viewRef.current === "3d") {
        drawScene3D(ctx, engine, now, optsRef.current);
      } else {
        drawScene(ctx, engine, now, optsRef.current);
      }

      acc += dt;
      if (acc > 0.2) {
        acc = 0;
        setSnap(engine.getSnapshot());
      }

      capAcc += dt;
      if (!pausedRef.current && capAcc > 0.4) {
        capAcc = 0;
        let thumb = thumbRef.current;
        if (!thumb) {
          thumb = document.createElement("canvas");
          thumb.width = 300;
          thumb.height = 300;
          thumbRef.current = thumb;
        }
        const tctx = thumb.getContext("2d");
        const top = engine.decisions[0] ?? null;
        if (tctx) {
          tctx.drawImage(canvas, 0, 0, 300, 300);
          const next: AuditFrame = {
            i: framesRef.current.length,
            hour: engine.hour,
            thumb: thumb.toDataURL("image/jpeg", 0.55),
            phase:
              engine.phase === "green"
                ? "VERDE"
                : engine.phase === "amber"
                  ? "AMARILLO"
                  : "TODO ROJO",
            axis: engine.axis === "NS" ? "N–S" : "E–O",
            green: engine.greenAssigned,
            sigmaNs: engine.zoneCount("NS"),
            sigmaEw: engine.zoneCount("EW"),
            decision: top,
          };
          if (top && top.id !== lastDecisionId) lastDecisionId = top.id;
          const buf = [...framesRef.current, next].slice(-90);
          framesRef.current = buf;
          setFrames(buf);
        }
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Aplicar escena del guion
  const applyScene = useCallback((i: number) => {
    const s = SCENES[i];
    const e = engineRef.current;
    if (!s || !e) return;
    e.setEvents([]);
    e.setClockRunning(true);
    s.apply(e);
    setSceneProgress(0);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "c" && !e.ctrlKey && !e.metaKey && e.target === document.body) {
        setIsCalibrating((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (mode !== "guiado") return;
    applyScene(sceneIndex);
  }, [mode, sceneIndex, applyScene, resetKey]);

  useEffect(() => {
    if (mode !== "guiado" || !autoplay) return;
    const s = SCENES[sceneIndex]!;
    const started = performance.now();
    const id = window.setInterval(() => {
      const p = (performance.now() - started) / (s.seconds * 1000);
      if (p >= 1) {
        setSceneIndex((k) => (k + 1) % SCENES.length);
      } else {
        setSceneProgress(p);
      }
    }, 120);
    return () => window.clearInterval(id);
  }, [mode, autoplay, sceneIndex]);

  const engine = () => engineRef.current;

  const updateFlow = useCallback((hour: number, value: number) => {
    setFlow((prev) => {
      const next = [...prev];
      next[hour] = value;
      return next;
    });
    engineRef.current?.setFlowAt(hour, value);
  }, []);

  const applyPreset = (profile: number[]) => {
    setFlow([...profile]);
    engineRef.current?.setFlowProfile(profile);
  };

  const addEvent = (ev: ScenarioEvent) => {
    setEvents((prev) => {
      const next = [...prev, ev];
      engineRef.current?.setEvents(next);
      return next;
    });
  };

  const removeEvent = (id: string) => {
    setEvents((prev) => {
      const next = prev.filter((e) => e.id !== id);
      engineRef.current?.setEvents(next);
      return next;
    });
  };

  const scene = SCENES[sceneIndex]!;
  const phaseColor =
    snap?.phase === "green"
      ? "bg-signal-green"
      : snap?.phase === "amber"
        ? "bg-signal-amber"
        : "bg-signal-red";

  const greenProgress = snap
    ? Math.min(1, snap.greenRemaining / Math.max(1, snap.greenAssigned))
    : 0;

  const failSafeEvents = useMemo(
    () => (snap?.log ?? []).filter((l) => l.tone === "danger" || l.tone === "ok").slice(0, 8),
    [snap],
  );

  const toggleLayer = (k: keyof DrawOptions) => setLayers((p) => ({ ...p, [k]: !p[k] }));

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-10">
      {/* Modal Presentación Ejecutiva */}
      <PitchModeModal
        isOpen={isPitchOpen}
        onClose={() => setIsPitchOpen(false)}
        onSelectScene={(sceneId) => {
          const idx = SCENES.findIndex((s) => s.id === sceneId);
          if (idx !== -1) {
            setMode("guiado");
            setSceneIndex(idx);
          }
        }}
      />

      {/* Banner Superior Modo Presentación Ejecutiva */}
      <div className="mb-6 rounded-2xl border border-signal-green/40 bg-gradient-to-r from-signal-green/15 via-card to-background p-4 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-green opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-signal-green" />
          </span>
          <div>
            <span className="font-mono text-xs font-bold text-signal-green uppercase tracking-wider">
              PROYECTO CARLOS AMEGHINO · MUNICIPALIDAD DE TRES DE FEBRERO
            </span>
            <p className="text-xs text-muted-foreground">
              Gemelo digital 3D fotorrealista de la esquina de Av. San Martín y Urquiza (Caseros).
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsPitchOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-signal-green px-5 py-2.5 font-mono text-xs font-bold text-background transition-all hover:bg-signal-green/90 shadow-md cursor-pointer"
        >
          <span>PROYECTAR PITCH EJECUTIVO 4 MIN</span>
        </button>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-signal-green uppercase">
            Gemelo Digital 3D Fotorrealista · Av. San Martín y Urquiza · Caseros
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Semaforización Inteligente con IA en el Borde
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Réplica matemática y visual fotorrealista de la esquina. La IA (NVIDIA Jetson Orin Nano
            + YOLOv11) percibe el flujo real de autos, colectivos (Línea 343 y 181), motos y
            peatones, decidiendo en tiempo real con protocolo de seguridad nocturna, prioridad
            peatonal y corredor de emergencia SAME 3F.
          </p>
        </div>
        <div className="flex shrink-0 gap-2 rounded-lg border border-border bg-card p-1.5">
          {(["guiado", "libre"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "guiado" ? "Recorrido guiado" : "Control manual libre"}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------ Selector de Escenas Guiadas ------------------------------ */}
      {mode === "guiado" && (
        <div className="mt-6 flex flex-wrap gap-2">
          {SCENES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSceneIndex(i);
                setSceneProgress(0);
              }}
              className={`relative overflow-hidden rounded-lg border px-4 py-2.5 text-left transition-colors ${
                i === sceneIndex
                  ? "border-primary/60 bg-primary/10"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <span className="block font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={`block text-sm font-medium ${i === sceneIndex ? "text-signal-green" : "text-foreground"}`}
              >
                {s.title.split(":")[0]}
              </span>
              {i === sceneIndex && (
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-signal-green transition-[width] duration-150"
                  style={{ width: `${sceneProgress * 100}%` }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-6">
          {/* -------------------------- Visor Canvas 3D Fotorrealista -------------------------- */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal-green opacity-70" />
                  <span className="relative inline-flex size-2 rounded-full bg-signal-green" />
                </span>
                <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
                  SIMULADOR 3D EN TIEMPO REAL · {clock(snap?.hour ?? startHour)} ·{" "}
                  {snap?.night ? "NOCTURNO" : "DIURNO"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Toggle on={layers.analysis} onClick={() => toggleLayer("analysis")}>
                  YOLOv11 Bounding Boxes
                </Toggle>
                <Toggle on={layers.cameras} onClick={() => toggleLayer("cameras")}>
                  Conos de Visión
                </Toggle>
                <Toggle on={layers.hud} onClick={() => toggleLayer("hud")}>
                  Telemetría HUD
                </Toggle>
                <Toggle on={layers.labels} onClick={() => toggleLayer("labels")}>
                  Rótulos de Calles
                </Toggle>
              </div>
            </div>
            <div className="relative">
              {isCalibrating && <GeometryEditor onClose={() => setIsCalibrating(false)} />}
              <canvas
                ref={canvasRef}
                className="block h-auto w-full cursor-crosshair"
                style={{ aspectRatio: "1 / 1" }}
                aria-label="Simulador 3D fotorrealista de la intersección de Caseros controlada por IA"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = (e.clientX - rect.left) * (800 / rect.width);
                  const y = (e.clientY - rect.top) * (800 / rect.height);
                  console.log(`[CALIBRATION] Clicked at: x=${x.toFixed(1)}, y=${y.toFixed(1)}`);
                }}
              />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border px-4 py-3 font-mono text-[10px] text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-[2px] border border-signal-green" />
                YOLOv11 Clasificación Inteligente
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-[2px] bg-blue-600" />
                Colectivo Línea 343 / 181
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-[2px] bg-destructive animate-pulse" />
                Ambulancia SAME 3F (Corredor Verde)
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-full bg-chart-4" />
                Peatón con Movilidad Reducida
              </span>
            </div>
          </div>

          {/* ------------------------ Narración / Perfil ------------------------ */}
          {mode === "guiado" ? (
            <section className="rounded-xl border border-primary/30 bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-[10px] tracking-[0.3em] text-signal-green uppercase">
                  {scene.kicker}
                </p>
                <div className="flex gap-2">
                  <Chip
                    onClick={() => setSceneIndex((k) => (k - 1 + SCENES.length) % SCENES.length)}
                  >
                    Anterior
                  </Chip>
                  <Chip active={autoplay} onClick={() => setAutoplay(!autoplay)}>
                    {autoplay ? "Pausar recorrido" : "Reanudar recorrido"}
                  </Chip>
                  <Chip onClick={() => setSceneIndex((k) => (k + 1) % SCENES.length)}>
                    Siguiente
                  </Chip>
                </div>
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                {scene.title}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {scene.narration}
              </p>
              <p className="mt-4 border-l-2 border-signal-green pl-4 text-sm leading-relaxed text-foreground">
                {scene.takeaway}
              </p>
            </section>
          ) : (
            <Panel
              title="Perfil horario de demanda (Aforo de Caseros)"
              subtitle="Edite el volumen de tránsito por hora (vehículos/hora). El motor calcula inmediatamente el retardo Webster vs el tiempo ahorrado por la IA."
            >
              <div className="mb-4 flex flex-wrap gap-2">
                {FLOW_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.profile)}
                    className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-left transition-colors hover:border-primary/60 hover:bg-accent"
                  >
                    <span className="block text-sm font-medium text-foreground">{p.label}</span>
                    <span className="block font-mono text-[10px] text-muted-foreground">
                      {p.hint}
                    </span>
                  </button>
                ))}
              </div>
              <FlowProfileEditor
                flow={flow}
                currentHour={snap?.hour ?? startHour}
                onChange={updateFlow}
              />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                    Reparto direccional
                    <span className="text-foreground">
                      San Martín {Math.round(nsShare * 100)}% / Urquiza{" "}
                      {Math.round((1 - nsShare) * 100)}%
                    </span>
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={90}
                    value={Math.round(nsShare * 100)}
                    onChange={(e) => {
                      const v = Number(e.target.value) / 100;
                      setNsShare(v);
                      engine()?.setNsShare(v);
                    }}
                    className="accent-primary"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                    Velocidad de simulación
                    <span className="text-foreground">{speed} min / s</span>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={speed}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setSpeed(v);
                      engine()?.setMinutesPerSecond(v);
                    }}
                    className="accent-primary"
                  />
                </label>
              </div>
            </Panel>
          )}

          {/* --------------------- Panel de Evidencias Institucionales --------------------- */}
          <Panel
            title="Panel de Evidencias y Auditoría"
            subtitle="Registro auditable de decisiones, eventos climáticos y contingencias. Cada acción queda sellada con hora, evidencia y motivo exacto."
            right={
              <span
                className={`rounded px-2 py-1 font-mono text-[10px] tracking-widest ${
                  snap?.failSafe
                    ? "bg-destructive/15 text-destructive"
                    : "bg-signal-green/15 text-signal-green"
                }`}
              >
                {snap?.failSafe ? "FAIL-SAFE ACTIVO" : "EDGE AI ACTIVA"}
              </span>
            }
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  Bitácora de Eventos
                </p>
                <ul className="mt-3 flex max-h-56 flex-col gap-1.5 overflow-y-auto font-mono text-[11px]">
                  {failSafeEvents.length > 0 ? (
                    failSafeEvents.map((l) => (
                      <li
                        key={l.id}
                        className="flex gap-2 rounded border border-border bg-secondary/40 px-2.5 py-1.5"
                      >
                        <span className="shrink-0 text-muted-foreground">{clock(l.hour)}</span>
                        <span
                          className={l.tone === "danger" ? "text-destructive" : "text-signal-green"}
                        >
                          {l.text}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="text-muted-foreground">
                      Operando en régimen nominal autónomo sin contingencias.
                    </li>
                  )}
                </ul>
              </div>
              <div>
                <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  Contraste con el Modelo de Webster (Ciclo Fijo 90s)
                </p>
                <table className="mt-3 w-full font-mono text-[11px]">
                  <tbody className="[&_td]:border-b [&_td]:border-border [&_td]:py-2">
                    <tr>
                      <td className="text-muted-foreground">Demanda actual observada</td>
                      <td className="text-right text-foreground">{snap?.demand ?? 0} veh/h</td>
                    </tr>
                    <tr>
                      <td className="text-muted-foreground">Demora teórica ciclo fijo 90s</td>
                      <td className="text-right text-foreground">
                        {(snap?.fixedWait ?? 0).toFixed(1)} s/veh
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted-foreground">Demora medida Ameghino AI</td>
                      <td className="text-right text-signal-green font-bold">
                        {(snap?.recentWait ?? 0).toFixed(1)} s/veh
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted-foreground">Reducción de demora</td>
                      <td className="text-right text-signal-green font-bold">
                        -{(snap?.reduction ?? 0).toFixed(0)} %
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted-foreground">Vehículos procesados</td>
                      <td className="text-right text-foreground">{snap?.passed ?? 0}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>

          <Panel
            title="Desempeño Acumulado: Adaptativo vs. Ciclo Fijo"
            subtitle="Curva punteada: demora teórica fija (Webster 90s). Curva verde: demora optimizada en tiempo real por Ameghino AI."
          >
            <WaitChart history={snap?.history ?? []} />
          </Panel>

          <Panel
            title="Ajuste Contrafáctico de Parámetros de IA"
            subtitle="Modifique en vivo los pesos de prioridad peatonal, umbrales de visibilidad y sensibilidad climática para auditar cómo reacciona el algoritmo."
          >
            <CounterfactualPanel
              evidence={snap?.evidence ?? null}
              baseConfig={priority}
              onApply={(cfg) => {
                setPriority(cfg);
                engine()?.setPriority(cfg);
                engine()?.registerHumanIntervention();
              }}
            />
          </Panel>

          <Panel
            title="Auditoría Fotograma a Fotograma"
            subtitle="Capturas instantáneas con la evidencia visual, conteo de objetos y contrato JSON NTCIP publicado por el agente de borde."
          >
            <AuditPanel
              frames={frames}
              paused={paused}
              onTogglePause={() => setPaused((p) => !p)}
            />
          </Panel>

          {mode === "libre" && (
            <Panel
              title="Línea de Tiempo de Eventos de la Jornada"
              subtitle="Cargue eventos programados: niebla matinal, hora pico, corte de sensor o emergencias del SAME 3F."
            >
              <EventTimeline
                events={events}
                currentHour={snap?.hour ?? startHour}
                onAdd={addEvent}
                onRemove={removeEvent}
              />
            </Panel>
          )}
        </div>

        {/* ----------------------- Columna Derecha de Métricas y Control ----------------------- */}
        <div className="flex flex-col gap-4">
          <Panel title="Impacto en Tres de Febrero">
            <div className="grid grid-cols-2 gap-2.5">
              <Metric
                value={`${(snap?.reduction ?? 0).toFixed(0)}%`}
                label="Reducción de demora"
                tone="text-signal-green"
              />
              <Metric
                value={`${(snap?.recentWait ?? 0).toFixed(1)} s`}
                label="Espera media actual"
              />
              <Metric
                value={`${(snap?.fuelSavedL ?? 0).toFixed(1)} L`}
                label="Combustible ahorrado"
              />
              <Metric value={`${(snap?.co2SavedKg ?? 0).toFixed(2)} kg`} label="CO₂ evitado" />
            </div>
          </Panel>

          <Panel
            title="Razonador de Borde (NVIDIA Jetson)"
            subtitle="Decisiones estructuradas con motivo, confianza y verificación determinista."
            right={
              <span className="rounded bg-secondary px-2 py-1 font-mono text-[10px] tracking-widest text-muted-foreground">
                YOLOv11 + VLM
              </span>
            }
          >
            {snap && snap.decisions.length > 0 ? (
              <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                {snap.decisions.map((d) => (
                  <li
                    key={d.id}
                    className={`rounded-lg border p-3 ${
                      d.source === "failsafe"
                        ? "border-destructive/40 bg-destructive/5"
                        : d.source === "emergency"
                          ? "border-signal-amber/40 bg-signal-amber/5"
                          : "border-border bg-secondary/35"
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-[10px] tracking-widest">
                      <span className="text-muted-foreground">{clock(d.hour)}</span>
                      <span
                        className={
                          d.source === "failsafe"
                            ? "text-destructive"
                            : d.source === "emergency"
                              ? "text-signal-amber font-bold"
                              : "text-signal-green font-bold"
                        }
                      >
                        {d.action}
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-foreground">
                      {d.rationale}
                    </p>
                    <div className="mt-2 flex gap-3 font-mono text-[10px] text-muted-foreground">
                      <span>conf. {(d.confidence * 100).toFixed(0)}%</span>
                      <span>latencia {d.latencyMs} ms</span>
                      <span>origen {d.source.toUpperCase()}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Inicializando motor de inferencia…</p>
            )}
          </Panel>

          <Panel title="Estado del Controlador NTCIP">
            {snap ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between font-mono text-sm">
                  <span className="text-muted-foreground">EJE CON VERDE</span>
                  <span className="text-foreground font-bold">
                    {snap.axis === "NS" ? "AV. SAN MARTÍN (N-S)" : "CALLE URQUIZA (E-O)"}
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono text-sm">
                  <span className="text-muted-foreground">FASE LUMINOSA</span>
                  <span className="flex items-center gap-2 text-foreground font-bold">
                    <span className={`inline-block size-2.5 rounded-full ${phaseColor}`} />
                    {PHASE_LABEL[snap.phase]}
                  </span>
                </div>
                <div>
                  <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                    <span>VERDE {snap.greenAssigned.toFixed(0)} s · RESTANTE</span>
                    <span className="font-bold text-foreground">
                      {snap.greenRemaining.toFixed(1)} s
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-signal-green transition-[width] duration-300"
                      style={{ width: `${greenProgress * 100}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 font-mono text-[12px] text-muted-foreground">
                  <span>σ San Martín: {snap.nsZone}</span>
                  <span>σ Urquiza: {snap.ewZone}</span>
                  <span>Cola San Martín: {snap.nsQueue}</span>
                  <span>Cola Urquiza: {snap.ewQueue}</span>
                  <span>Peatones: {snap.pedWaiting + snap.pedCrossing}</span>
                  <span>Demanda: {snap.demand} v/h</span>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-border pt-3 font-mono text-[10px] tracking-widest">
                  {snap.failSafe ? (
                    <span className="rounded bg-destructive/15 px-2 py-1 text-destructive font-bold">
                      FAIL-SAFE · CICLO FIJO 22 s
                    </span>
                  ) : (
                    <span className="rounded bg-signal-green/15 px-2 py-1 text-signal-green font-bold">
                      ADAPTATIVO · IA ACTIVA
                    </span>
                  )}
                  {snap.night && (
                    <span className="rounded bg-chart-4/15 px-2 py-1 text-chart-4 font-bold">
                      PROTOCOLO NOCTURNO (3 AM)
                    </span>
                  )}
                  {snap.emergency && (
                    <span className="animate-pulse rounded bg-destructive/15 px-2 py-1 text-destructive font-bold">
                      CORREDOR SAME 3F ACTIVO
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Iniciando…</p>
            )}
          </Panel>

          <Panel
            title="Panel de Acciones Rápidas"
            subtitle="Dispare eventos interactivos para auditar en vivo la respuesta del sistema."
          >
            <div className="grid grid-cols-3 gap-2">
              {WEATHERS.map((w) => (
                <Chip
                  key={w}
                  active={snap?.weather === w}
                  tone={w === "fog" ? "warn" : "default"}
                  onClick={() => engine()?.setWeather(w)}
                >
                  {WEATHER_LABEL_ES[w]}
                </Chip>
              ))}
            </div>
            <div className="mt-3 grid gap-2">
              <Chip tone="danger" onClick={() => engine()?.triggerEmergency()}>
                🚨 Despachar Ambulancia SAME 3F
              </Chip>
              <Chip
                active={snap?.cameraOffline ?? false}
                tone="danger"
                onClick={() => engine()?.setCameraOffline(!snap?.cameraOffline)}
              >
                {snap?.cameraOffline
                  ? "Restablecer Enlace de Video"
                  : "⚠️ Simular Corte de Cámara (Fail-Safe)"}
              </Chip>
              <div className="grid grid-cols-2 gap-2">
                <Chip onClick={() => engine()?.spawnPedestrian("NS")}>🚶 Peatón Senda</Chip>
                <Chip
                  onClick={() => {
                    const e = engine();
                    if (e) {
                      e.spawnPedestrian("NS");
                      // Marcar como movilidad reducida
                      if (e.pedestrians.length > 0) {
                        e.pedestrians[e.pedestrians.length - 1]!.reduced = true;
                      }
                    }
                  }}
                >
                  ♿ Movilidad Reducida
                </Chip>
              </div>
            </div>
            {mode === "libre" && (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Chip
                    active={running}
                    onClick={() => {
                      setRunning(!running);
                      engine()?.setClockRunning(!running);
                    }}
                  >
                    {running ? "Reloj Activo" : "Reloj Pausado"}
                  </Chip>
                  <Chip onClick={() => setResetKey((k) => k + 1)}>Reiniciar</Chip>
                </div>
                <label className="mt-4 flex flex-col gap-2">
                  <span className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                    Hora del Día (Día / Noche)
                    <span className="text-foreground font-bold">
                      {startHour.toString().padStart(2, "0")}:00
                    </span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={23}
                    value={startHour}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setStartHour(v);
                      engine()?.setHour(v);
                    }}
                    className="accent-primary"
                  />
                </label>
              </>
            )}
          </Panel>
        </div>
      </div>
    </main>
  );
}
