import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { DEFAULT_DRAW_OPTIONS, drawScene, type DrawOptions } from "@/components/simulator/draw";
import { EventTimeline } from "@/components/simulator/EventTimeline";
import { FLOW_PRESETS, FlowProfileEditor } from "@/components/simulator/FlowProfileEditor";
import { WaitChart } from "@/components/simulator/WaitChart";
import {
  APPROACH_LABEL_ES,
  DEFAULT_EVENTS,
  DEFAULT_FLOW,
  KIND_LABEL_ES,
  TrafficEngine,
  WEATHER_LABEL_ES,
  type ScenarioEvent,
  type Snapshot,
  type Weather,
} from "@/lib/traffic/engine";

export const Route = createFileRoute("/simulador")({
  head: () => ({
    meta: [
      { title: "Gemelo Digital de Intersección — Ameghino AI" },
      {
        name: "description",
        content:
          "Recorrido guiado y banco de pruebas del controlador Ameghino AI: agente de tránsito con visión artificial, protocolo nocturno, prioridad peatonal, corredor de emergencia y fail-safe verificable.",
      },
      { property: "og:title", content: "Gemelo Digital de Intersección — Ameghino AI" },
      {
        property: "og:description",
        content:
          "Cinco escenarios clave narrados para audiencias de gobierno, con evidencia auditable y comparación contra el modelo de Webster.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SimuladorPage,
});

/* ------------------------------------------------------------------ */
/* Guion institucional                                                  */
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
    title: "Hora pico de un día hábil",
    narration:
      "A las 08:00 la avenida concentra el flujo del corredor. El agente cuenta objetos válidos sobre cada eje y asigna el verde en proporción a la cola real, en vez de repetir un plan grabado hace años. Cada decisión queda registrada con su motivo.",
    takeaway: "El verde deja de ser una constante y pasa a ser una función de la demanda observada.",
    seconds: 26,
    apply: (e) => {
      e.setWeather("clear", true);
      e.setCameraOffline(false);
      e.setHour(7.9);
      e.setNsShare(0.62);
      e.setFlowProfile(FLOW_PRESETS[0]!.profile);
      e.setMinutesPerSecond(2);
    },
  },
  {
    id: "noche",
    kicker: "Escena 2 de 5",
    title: "Madrugada: el semáforo como medida de seguridad",
    narration:
      "A las 03:00 no hay tránsito cruzado. Un conductor detenido en rojo frente a una calle vacía es un blanco estático. El agente verifica que el cruce esté libre y libera el verde de inmediato, manteniendo siempre el ámbar y el todo-rojo de seguridad.",
    takeaway: "Menos exposición del conductor sin resignar ni un segundo de entreverde.",
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
    title: "Prioridad peatonal y accesibilidad",
    narration:
      "El sistema no sólo ve autos. Detecta personas esperando en la senda y distingue a quien se desplaza con movilidad reducida: en ese caso acorta el verde vehicular y extiende el tiempo de cruce. Es la tarea que hoy hace, con criterio, un agente de tránsito parado en la esquina.",
    takeaway: "La intersección incorpora al peatón como usuario prioritario, no como interferencia.",
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
    title: "Lluvia y niebla: percepción degradada",
    narration:
      "Con lluvia y niebla la confianza del modelo cae y aparecen objetos no clasificados. El controlador agrega margen de frenado, sostiene la decisión con los objetos válidos y monitorea la tasa de clasificación: si baja del 55%, deja de confiar en sí mismo.",
    takeaway: "El sistema conoce sus límites y los declara antes de fallar.",
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
    title: "Falla de cámara y corredor de emergencia",
    narration:
      "Se corta el enlace de video. En menos de un ciclo el equipo revierte al plan fijo pregrabado de 22 segundos, emite alerta a mantenimiento y bloquea toda decisión de la IA. Acto seguido llega una ambulancia: aun degradado, el sistema garantiza que nunca existan verdes en conflicto.",
    takeaway: "Ninguna falla de software puede producir una maniobra insegura. Eso es auditable.",
    seconds: 26,
    apply: (e) => {
      e.setHour(21.2);
      e.setWeather("fog");
      e.setCameraOffline(true);
      e.setMinutesPerSecond(2);
      window.setTimeout(() => e.triggerEmergency(), 6000);
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

function SimuladorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<TrafficEngine | null>(null);
  const optsRef = useRef<DrawOptions>({ ...DEFAULT_DRAW_OPTIONS });

  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [mode, setMode] = useState<"guiado" | "libre">("guiado");
  const [layers, setLayers] = useState<DrawOptions>({ ...DEFAULT_DRAW_OPTIONS });

  // guion
  const [sceneIndex, setSceneIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [sceneProgress, setSceneProgress] = useState(0);

  // escenario libre
  const [flow, setFlow] = useState<number[]>([...DEFAULT_FLOW]);
  const [events, setEvents] = useState<ScenarioEvent[]>([...DEFAULT_EVENTS]);
  const [nsShare, setNsShare] = useState(0.58);
  const [speed, setSpeed] = useState(3);
  const [running, setRunning] = useState(true);
  const [startHour, setStartHour] = useState(7);

  optsRef.current = layers;

  useEffect(() => {
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
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      engine.update(dt);
      drawScene(ctx, engine, now, optsRef.current);
      acc += dt;
      if (acc > 0.2) {
        acc = 0;
        setSnap(engine.getSnapshot());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // aplicar escena del guion
  const applyScene = useCallback((i: number) => {
    const scene = SCENES[i];
    const e = engineRef.current;
    if (!scene || !e) return;
    e.setEvents([]);
    e.setClockRunning(true);
    scene.apply(e);
    setSceneProgress(0);
  }, []);

  useEffect(() => {
    if (mode !== "guiado") return;
    applyScene(sceneIndex);
  }, [mode, sceneIndex, applyScene, resetKey]);

  useEffect(() => {
    if (mode !== "guiado" || !autoplay) return;
    const scene = SCENES[sceneIndex]!;
    const started = performance.now();
    const id = window.setInterval(() => {
      const p = (performance.now() - started) / (scene.seconds * 1000);
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
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-signal-green uppercase">
            Gemelo digital · Av. San Martín y Urquiza · Caseros
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            El semáforo como agente de tránsito
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Una réplica ejecutable de la intersección. Cada verde que ve en pantalla fue decidido en
            el momento a partir de lo que las cámaras observan, y viene acompañado del motivo de esa
            decisión. Recorra el guion institucional o tome el control y ponga a prueba el sistema.
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
              {m === "guiado" ? "Recorrido guiado" : "Control manual"}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------ guion ------------------------------ */}
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
          {/* -------------------------- visor -------------------------- */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal-green opacity-70" />
                  <span className="relative inline-flex size-2 rounded-full bg-signal-green" />
                </span>
                <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
                  Video analítico en vivo · {clock(snap?.hour ?? startHour)}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Toggle on={layers.analysis} onClick={() => toggleLayer("analysis")}>
                  Detecciones
                </Toggle>
                <Toggle on={layers.cameras} onClick={() => toggleLayer("cameras")}>
                  Cámaras
                </Toggle>
                <Toggle on={layers.hud} onClick={() => toggleLayer("hud")}>
                  Telemetría
                </Toggle>
                <Toggle on={layers.labels} onClick={() => toggleLayer("labels")}>
                  Rótulos
                </Toggle>
              </div>
            </div>
            <canvas
              ref={canvasRef}
              className="block h-auto w-full"
              style={{ aspectRatio: "1 / 1" }}
              aria-label="Vista cenital de la intersección controlada por inteligencia artificial"
            />
            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border px-4 py-3 font-mono text-[10px] text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-[2px] border border-signal-green" />
                objeto clasificado
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-[2px] border border-dashed border-signal-amber" />
                no clasificado (baja visibilidad)
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-full bg-chart-4" />
                peatón con movilidad reducida
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-[2px] bg-destructive" />
                corredor de emergencia
              </span>
            </div>
          </div>

          {/* ------------------------ narración ------------------------ */}
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
              title="Perfil horario de demanda"
              subtitle="Arrastre sobre el gráfico para editar el aforo de cada hora (vehículos/hora, ambos ejes). El escenario se aplica en vivo."
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
                      N–S {Math.round(nsShare * 100)}% / E–O {Math.round((1 - nsShare) * 100)}%
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
                    Velocidad del reloj
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

          {/* --------------------- panel de evidencias --------------------- */}
          <Panel
            title="Panel institucional de evidencias"
            subtitle="Registro auditable de las degradaciones del servicio y su tratamiento. Cada activación del fail-safe queda sellada con hora simulada y motivo."
            right={
              <span
                className={`rounded px-2 py-1 font-mono text-[10px] tracking-widest ${
                  snap?.failSafe
                    ? "bg-destructive/15 text-destructive"
                    : "bg-signal-green/15 text-signal-green"
                }`}
              >
                {snap?.failSafe ? "FAIL-SAFE ACTIVO" : "SERVICIO NOMINAL"}
              </span>
            }
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  Bitácora de degradaciones
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
                          className={
                            l.tone === "danger" ? "text-destructive" : "text-signal-green"
                          }
                        >
                          {l.text}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="text-muted-foreground">
                      Sin degradaciones registradas en la jornada simulada.
                    </li>
                  )}
                </ul>
              </div>
              <div>
                <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  Contraste con el modelo de Webster
                </p>
                <table className="mt-3 w-full font-mono text-[11px]">
                  <tbody className="[&_td]:border-b [&_td]:border-border [&_td]:py-2">
                    <tr>
                      <td className="text-muted-foreground">Demanda instantánea</td>
                      <td className="text-right text-foreground">{snap?.demand ?? 0} veh/h</td>
                    </tr>
                    <tr>
                      <td className="text-muted-foreground">Demora teórica ciclo fijo 90 s</td>
                      <td className="text-right text-foreground">
                        {(snap?.fixedWait ?? 0).toFixed(1)} s/veh
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted-foreground">Demora medida Ameghino AI</td>
                      <td className="text-right text-signal-green">
                        {(snap?.recentWait ?? 0).toFixed(1)} s/veh
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted-foreground">Diferencial</td>
                      <td className="text-right text-foreground">
                        {(snap?.reduction ?? 0).toFixed(0)} %
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted-foreground">Vehículos procesados</td>
                      <td className="text-right text-foreground">{snap?.passed ?? 0}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  La línea base surge del término uniforme de Webster más sobresaturación, con la
                  misma demanda que recibe el controlador adaptativo. No se comparan escenarios
                  distintos.
                </p>
              </div>
            </div>
          </Panel>

          <Panel
            title="Desempeño acumulado: adaptativo vs. ciclo fijo"
            subtitle="Curva punteada: demora teórica de un semáforo de ciclo fijo de 90 s con la misma demanda. Curva plena: desempeño medido del controlador."
          >
            <WaitChart history={snap?.history ?? []} />
          </Panel>

          {mode === "libre" && (
            <Panel
              title="Eventos programados de la jornada"
              subtitle="Cargue incidencias sobre la línea de tiempo: pérdida de video, cambios de clima o pasos de emergencia. Haga clic en un marcador para eliminarlo."
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

        {/* ----------------------- columna derecha ----------------------- */}
        <div className="flex flex-col gap-4">
          <Panel title="Indicadores de gestión">
            <div className="grid grid-cols-2 gap-2.5">
              <Metric
                value={`${(snap?.reduction ?? 0).toFixed(0)}%`}
                label="Reducción de demora vs. ciclo fijo"
                tone="text-signal-green"
              />
              <Metric
                value={`${(snap?.recentWait ?? 0).toFixed(1)} s`}
                label="Espera media por vehículo"
              />
              <Metric value={`${(snap?.fuelSavedL ?? 0).toFixed(1)} L`} label="Combustible evitado" />
              <Metric value={`${(snap?.co2SavedKg ?? 0).toFixed(2)} kg`} label="CO₂ evitado" />
            </div>
          </Panel>

          <Panel
            title="Razonamiento del agente"
            subtitle="Cada cambio de fase publica una intención estructurada con su motivo, confianza y latencia. El validador determinista la acepta o la rechaza."
            right={
              <span className="rounded bg-secondary px-2 py-1 font-mono text-[10px] tracking-widest text-muted-foreground">
                VLM + REGLAS
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
                              ? "text-signal-amber"
                              : "text-signal-green"
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
                      <span>
                        origen{" "}
                        {d.source === "failsafe"
                          ? "validador"
                          : d.source === "emergency"
                            ? "prioridad"
                            : "razonador"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Esperando el primer ciclo…</p>
            )}
          </Panel>

          <Panel title="Estado del controlador">
            {snap ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between font-mono text-sm">
                  <span className="text-muted-foreground">EJE HABILITADO</span>
                  <span className="text-foreground">
                    {snap.axis === "NS" ? "NORTE–SUR" : "ESTE–OESTE"}
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono text-sm">
                  <span className="text-muted-foreground">LUZ</span>
                  <span className="flex items-center gap-2 text-foreground">
                    <span className={`inline-block size-2.5 rounded-full ${phaseColor}`} />
                    {PHASE_LABEL[snap.phase]}
                  </span>
                </div>
                <div>
                  <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                    <span>VERDE {snap.greenAssigned.toFixed(0)} s · RESTA</span>
                    <span>{snap.greenRemaining.toFixed(1)} s</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-signal-green transition-[width] duration-300"
                      style={{ width: `${greenProgress * 100}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 font-mono text-[12px] text-muted-foreground">
                  <span>σ N–S: {snap.nsZone}</span>
                  <span>σ E–O: {snap.ewZone}</span>
                  <span>cola N–S: {snap.nsQueue}</span>
                  <span>cola E–O: {snap.ewQueue}</span>
                  <span>peatones: {snap.pedWaiting + snap.pedCrossing}</span>
                  <span>demanda: {snap.demand} v/h</span>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-border pt-3 font-mono text-[10px] tracking-widest">
                  {snap.failSafe ? (
                    <span className="rounded bg-destructive/15 px-2 py-1 text-destructive">
                      FAIL-SAFE · CICLO FIJO 22 s
                    </span>
                  ) : (
                    <span className="rounded bg-signal-green/15 px-2 py-1 text-signal-green">
                      ADAPTATIVO · IA ACTIVA
                    </span>
                  )}
                  {snap.night && (
                    <span className="rounded bg-chart-4/15 px-2 py-1 text-chart-4">
                      PROTOCOLO NOCTURNO
                    </span>
                  )}
                  {snap.emergency && (
                    <span className="animate-pulse rounded bg-destructive/15 px-2 py-1 text-destructive">
                      CORREDOR DE EMERGENCIA
                    </span>
                  )}
                  {snap.weather !== "clear" && (
                    <span className="rounded bg-signal-amber/15 px-2 py-1 text-signal-amber">
                      {WEATHER_LABEL_ES[snap.weather].toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                    <span>VISIBILIDAD</span>
                    <span className="text-foreground">
                      {((snap.visibility ?? 1) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ${
                        snap.visibility > 0.7
                          ? "bg-signal-green"
                          : snap.visibility > 0.45
                            ? "bg-signal-amber"
                            : "bg-signal-red"
                      }`}
                      style={{ width: `${snap.visibility * 100}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                    <span>TASA DE CLASIFICACIÓN</span>
                    <span className="text-foreground">
                      {(snap.detectionRate * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Iniciando…</p>
            )}
          </Panel>

          <Panel
            title="Intervención del operador"
            subtitle="Provoque la condición que quiera auditar. El sistema debe responder igual delante suyo que en la calle."
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
            <div className="mt-2 grid gap-2">
              <Chip tone="danger" onClick={() => engine()?.triggerEmergency()}>
                Despachar ambulancia
              </Chip>
              <Chip
                active={snap?.cameraOffline ?? false}
                tone="danger"
                onClick={() => engine()?.setCameraOffline(!snap?.cameraOffline)}
              >
                {snap?.cameraOffline ? "Restablecer enlace de video" : "Cortar enlace de video"}
              </Chip>
              <Chip onClick={() => engine()?.spawnPedestrian()}>Agregar peatón en la senda</Chip>
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
                    {running ? "Reloj activo" : "Reloj pausado"}
                  </Chip>
                  <Chip onClick={() => setResetKey((k) => k + 1)}>Reiniciar</Chip>
                </div>
                <label className="mt-4 flex flex-col gap-2">
                  <span className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                    Saltar a la hora
                    <span className="text-foreground">
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
            {snap?.failSafeReason && (
              <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">
                Degradación activa: {snap.failSafeReason.toLowerCase()}. El controlador retoma el
                plan fijo pregrabado y alerta a mantenimiento; ninguna decisión de la IA puede
                generar verdes en conflicto.
              </p>
            )}
          </Panel>

          <Panel title="Detecciones de la red neuronal">
            {snap && snap.detections.length > 0 ? (
              <ul className="flex max-h-44 flex-col gap-1.5 overflow-y-auto font-mono text-[11px]">
                {snap.detections.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between rounded bg-secondary/50 px-2.5 py-1.5"
                  >
                    <span className="text-muted-foreground">{clock(d.hour)}</span>
                    <span className="text-foreground">
                      {KIND_LABEL_ES[d.kind]} · {APPROACH_LABEL_ES[d.approach]}
                    </span>
                    <span className="text-signal-green">{(d.confidence * 100).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {snap?.cameraOffline
                  ? "Sin señal de cámara. El controlador opera en ciclo fijo pregrabado."
                  : "Esperando vehículos en la zona de detección…"}
              </p>
            )}
          </Panel>
        </div>
      </div>

      <section className="mt-12 grid gap-4 md:grid-cols-3">
        {[
          {
            n: "01",
            title: "Percibir",
            text: "Cámara IP 4MP con WDR y visión nocturna sobre un detector en tiempo real: autos, camiones, motos, peatones y vehículos de emergencia. Con lluvia o niebla la confianza cae y el sistema descarta objetos por debajo del 70%.",
          },
          {
            n: "02",
            title: "Razonar",
            text: "Un modelo de visión-lenguaje en el borde interpreta la escena y emite una intención con su motivo: extender, acortar, adelantar fase o proteger un cruce peatonal. No comanda: propone, y queda registrado.",
          },
          {
            n: "03",
            title: "Actuar y proteger",
            text: "Un validador determinista verifica tiempos mínimos, entreverde y ausencia de conflictos antes de enviar la fase por NTCIP. Si cae el video o la clasificación baja del 55%, se revierte al plan fijo y se alerta a mantenimiento.",
          },
        ].map((s) => (
          <article key={s.n} className="rounded-xl border border-border bg-card p-6">
            <p className="font-mono text-xs text-signal-green">{s.n}</p>
            <h3 className="mt-2 text-lg font-semibold text-foreground">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
