import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { drawScene } from "@/components/simulator/draw";
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
          "Editor de escenarios y simulación en vivo del controlador Ameghino AI: perfiles horarios de demanda, lluvia y niebla, eventos programados y verificación del protocolo fail-safe.",
      },
      { property: "og:title", content: "Gemelo Digital de Intersección — Ameghino AI" },
      {
        property: "og:description",
        content:
          "Definí flujos por hora, condiciones ambientales y eventos, y observá cómo responde el control adaptativo frente al ciclo fijo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SimuladorPage,
});

const PHASE_LABEL: Record<Snapshot["phase"], string> = {
  green: "VERDE",
  amber: "AMARILLO",
  allred: "CORTE TOTAL",
};

function clock(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 ${className}`}>
      <h2 className="font-mono text-[11px] font-semibold tracking-[0.25em] text-muted-foreground uppercase">
        {title}
      </h2>
      {subtitle && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>}
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

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between font-mono text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

const WEATHERS: Weather[] = ["clear", "rain", "fog"];

function SimuladorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<TrafficEngine | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [resetKey, setResetKey] = useState(0);

  // estado del escenario (fuente de verdad de la UI)
  const [flow, setFlow] = useState<number[]>([...DEFAULT_FLOW]);
  const [events, setEvents] = useState<ScenarioEvent[]>([...DEFAULT_EVENTS]);
  const [nsShare, setNsShare] = useState(0.58);
  const [speed, setSpeed] = useState(3);
  const [running, setRunning] = useState(true);
  const [startHour, setStartHour] = useState(7);

  useEffect(() => {
    const engine = new TrafficEngine();
    engine.setFlowProfile(flow);
    engine.setEvents(events);
    engine.setNsShare(nsShare);
    engine.setMinutesPerSecond(speed);
    engine.setClockRunning(running);
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
      drawScene(ctx, engine, now);
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

  const phaseColor =
    snap?.phase === "green"
      ? "bg-signal-green"
      : snap?.phase === "amber"
        ? "bg-signal-amber"
        : "bg-signal-red";

  const greenProgress = snap
    ? Math.min(1, snap.greenRemaining / Math.max(1, snap.greenAssigned))
    : 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <p className="font-mono text-xs tracking-[0.3em] text-signal-green uppercase">
        Gemelo digital · Av. San Martín y Urquiza, Caseros
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Simulador y editor de escenarios
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Banco de pruebas del controlador Ameghino AI. Definí el perfil horario de demanda (veh/h),
        las condiciones ambientales y los eventos de la jornada; el sistema calcula la densidad
        percibida σ y asigna el verde con{" "}
        <span className="font-mono text-foreground">T_v = max(T_seg, min(T_max, β·σ))</span>,
        contrastando el resultado contra la demora teórica de un ciclo fijo equivalente.
      </p>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-border bg-card p-4">
            <canvas
              ref={canvasRef}
              className="h-auto w-full rounded-lg"
              style={{ aspectRatio: "1 / 1" }}
              aria-label="Vista cenital de la intersección controlada por inteligencia artificial"
            />
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-sm border border-signal-green" />
                objeto clasificado
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-sm border border-dashed border-signal-amber" />
                objeto no clasificado (baja visibilidad)
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-full bg-signal-green" />
                campo de visión de cámara
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-sm bg-destructive" />
                corredor de emergencia
              </span>
            </div>
          </div>

          <Panel
            title="Perfil horario de demanda"
            subtitle="Arrastrá sobre el gráfico para editar el aforo de cada hora (vehículos/hora, ambos ejes). El escenario se aplica en vivo."
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

          <Panel
            title="Eventos programados de la jornada"
            subtitle="Cargá incidencias sobre la línea de tiempo: pérdida de video, cambios de clima o pasos de emergencia. Hacé clic en un marcador para eliminarlo."
          >
            <EventTimeline
              events={events}
              currentHour={snap?.hour ?? startHour}
              onAdd={addEvent}
              onRemove={removeEvent}
            />
          </Panel>

          <Panel
            title="Desempeño acumulado: adaptativo vs. ciclo fijo"
            subtitle="La curva punteada es la demora teórica de un semáforo de ciclo fijo de 90 s con la misma demanda (modelo de Webster). La curva plena es el desempeño medido del controlador."
          >
            <WaitChart history={snap?.history ?? []} />
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Reloj y operación">
            <div className="flex items-end justify-between">
              <p className="font-mono text-4xl font-semibold text-foreground tabular-nums">
                {clock(snap?.hour ?? startHour)}
              </p>
              <span
                className={`rounded px-2 py-1 font-mono text-[10px] tracking-widest ${
                  snap?.night
                    ? "bg-chart-4/20 text-chart-4"
                    : "bg-signal-amber/15 text-signal-amber"
                }`}
              >
                {snap?.night ? "NOCHE" : "DÍA"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
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
                <span className="text-foreground">{startHour.toString().padStart(2, "0")}:00</span>
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
          </Panel>

          <Panel title="Condiciones y forzados manuales">
            <div className="grid grid-cols-3 gap-2">
              {WEATHERS.map((w) => (
                <Chip
                  key={w}
                  active={snap?.weather === w}
                  tone={w === "fog" ? "warn" : w === "rain" ? "default" : "default"}
                  onClick={() => engine()?.setWeather(w)}
                >
                  {WEATHER_LABEL_ES[w]}
                </Chip>
              ))}
            </div>
            <div className="mt-2 grid gap-2">
              <Chip tone="danger" onClick={() => engine()?.triggerEmergency()}>
                Despachar vehículo de emergencia
              </Chip>
              <Chip
                active={snap?.cameraOffline}
                tone="danger"
                onClick={() => engine()?.setCameraOffline(!snap?.cameraOffline)}
              >
                {snap?.cameraOffline ? "Restablecer enlace de video" : "Forzar falla de cámara"}
              </Chip>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>VISIBILIDAD DE LA CÁMARA</span>
                <span className="text-foreground">
                  {((snap?.visibility ?? 1) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${
                    (snap?.visibility ?? 1) > 0.7
                      ? "bg-signal-green"
                      : (snap?.visibility ?? 1) > 0.45
                        ? "bg-signal-amber"
                        : "bg-signal-red"
                  }`}
                  style={{ width: `${(snap?.visibility ?? 1) * 100}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>TASA DE CLASIFICACIÓN</span>
                <span className="text-foreground">
                  {((snap?.detectionRate ?? 1) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </Panel>

          <Panel title="Estado del controlador">
            {snap ? (
              <div className="flex flex-col gap-3">
                <Row label="EJE HABILITADO" value={snap.axis === "NS" ? "NORTE–SUR" : "ESTE–OESTE"} />
                <Row
                  label="LUZ"
                  value={
                    <span className="flex items-center gap-2">
                      <span className={`inline-block size-2.5 rounded-full ${phaseColor}`} />
                      {PHASE_LABEL[snap.phase]}
                    </span>
                  }
                />
                <Row label="T_VERDE ASIGNADO" value={`${snap.greenAssigned.toFixed(1)} s`} />
                <div>
                  <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                    <span>CUENTA REGRESIVA</span>
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
                  <span>demanda: {snap.demand} v/h</span>
                  <span>en espera: {snap.waiting}</span>
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
                {snap.failSafeReason && (
                  <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">
                    Degradación activa: {snap.failSafeReason.toLowerCase()}. El controlador retoma
                    el plan fijo pregrabado y emite alerta al centro de mantenimiento; ninguna
                    decisión de la IA puede generar verdes en conflicto.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Iniciando…</p>
            )}
          </Panel>

          <Panel title="Indicadores de gestión">
            {snap ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Vehículos procesados", value: snap.passed.toString() },
                  { label: "Demora media (adaptativo)", value: `${snap.recentWait.toFixed(1)} s` },
                  { label: "Demora media (ciclo fijo)", value: `${snap.fixedWait.toFixed(1)} s` },
                  { label: "Reducción de demora", value: `${snap.reduction.toFixed(0)}%` },
                  { label: "Combustible evitado", value: `${snap.fuelSavedL.toFixed(1)} L` },
                  { label: "CO₂ evitado", value: `${snap.co2SavedKg.toFixed(2)} kg` },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg bg-secondary/60 p-3">
                    <p className="font-mono text-lg font-semibold text-foreground">{m.value}</p>
                    <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
                      {m.label}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Iniciando…</p>
            )}
          </Panel>

          <Panel title="Bitácora del sistema">
            {snap && snap.log.length > 0 ? (
              <ul className="flex max-h-52 flex-col gap-1.5 overflow-y-auto font-mono text-[11px]">
                {snap.log.map((l) => (
                  <li key={l.id} className="flex gap-2 rounded bg-secondary/40 px-2.5 py-1.5">
                    <span className="text-muted-foreground">{clock(l.hour)}</span>
                    <span
                      className={
                        l.tone === "danger"
                          ? "text-destructive"
                          : l.tone === "warn"
                            ? "text-signal-amber"
                            : l.tone === "ok"
                              ? "text-signal-green"
                              : "text-foreground"
                      }
                    >
                      {l.text}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sin incidencias registradas en la jornada.
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
            text: "Cámara IP 4MP con WDR y visión nocturna sobre red YOLOv11: clasifica autos, camiones, motos y vehículos de emergencia. Con lluvia o niebla la confianza cae y el sistema descarta objetos por debajo del 70%.",
          },
          {
            n: "02",
            title: "Decidir",
            text: "La unidad de borde calcula σ sobre objetos válidos y fija el verde entre T_seg (mínimo peatonal) y T_max. De madrugada, un vehículo único con cruce despejado obtiene verde inmediato: menos exposición al delito.",
          },
          {
            n: "03",
            title: "Actuar y proteger",
            text: "El comando de fase viaja por NTCIP al controlador industrial homologado. Si cae el video o la clasificación baja del 55%, el equipo revierte al plan fijo y alerta a mantenimiento: fail-safe verificable.",
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
