import { useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { drawScene } from "@/components/simulator/draw";
import {
  APPROACH_LABEL_ES,
  KIND_LABEL_ES,
  TrafficEngine,
  type Snapshot,
} from "@/lib/traffic/engine";

export const Route = createFileRoute("/simulador")({
  head: () => ({
    meta: [
      { title: "Simulador en Vivo — Ameghino AI" },
      {
        name: "description",
        content:
          "Simulación interactiva del sistema Ameghino AI: detección vehicular por IA, tiempos de verde adaptativos, seguridad nocturna, corredor de emergencias y modo fail-safe.",
      },
      { property: "og:title", content: "Simulador en Vivo — Ameghino AI" },
      {
        property: "og:description",
        content:
          "Probá en tiempo real cómo la IA gestiona una intersección: densidad vehicular, emergencias y seguridad nocturna.",
      },
    ],
  }),
  component: SimuladorPage,
});

const PHASE_LABEL: Record<Snapshot["phase"], string> = {
  green: "VERDE",
  amber: "AMARILLO",
  allred: "CORTE TOTAL",
};

function formatClock(t: number): string {
  const m = Math.floor(t / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(t % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-mono text-[11px] font-semibold tracking-[0.25em] text-muted-foreground uppercase">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ControlButton({
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

function SimuladorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<TrafficEngine | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [level, setLevel] = useState(1);
  const [night, setNight] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const engine = new TrafficEngine();
    engineRef.current = engine;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      engine.update(dt);
      drawScene(ctx, engine, now);
      acc += dt;
      if (acc > 0.25) {
        acc = 0;
        setSnap(engine.getSnapshot());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [resetKey]);

  const engine = () => engineRef.current;

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
    <main className="mx-auto max-w-6xl px-4 py-10">
      <p className="font-mono text-xs tracking-[0.3em] text-signal-green uppercase">
        Prueba de concepto · Intersección Av. San Martín y Urquiza, Caseros
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Simulador del controlador Ameghino AI
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Cada vehículo que entra en el cono verde es detectado por la red neuronal (confianza ≥
        90%). El controlador calcula la densidad σ y asigna el tiempo de verde con{" "}
        <span className="font-mono text-foreground">T_v = max(T_seg, min(T_max, β·σ))</span>.
        Activá los escenarios para ver cómo responde el sistema.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl border border-border bg-card p-4">
          <canvas
            ref={canvasRef}
            width={800}
            height={800}
            className="h-auto w-full rounded-lg"
            aria-label="Simulación aérea de una intersección controlada por IA"
          />
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="inline-block size-2.5 rounded-sm border border-dashed border-signal-green" />
              detección IA
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block size-2.5 rounded-full bg-signal-green" />
              zona de cámara
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block size-2.5 rounded-sm bg-destructive" />
              emergencia
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block size-2.5 rounded-sm bg-muted-foreground" />
              tránsito general
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Card title="Escenario">
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <ControlButton
                  active={!night}
                  onClick={() => {
                    setNight(false);
                    engine()?.setNight(false);
                  }}
                >
                  Día
                </ControlButton>
                <ControlButton
                  active={night}
                  tone="warn"
                  onClick={() => {
                    setNight(true);
                    engine()?.setNight(true);
                  }}
                >
                  Noche (seguridad)
                </ControlButton>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["Bajo", "Medio", "Alto"] as const).map((label, i) => (
                  <ControlButton
                    key={label}
                    active={level === i}
                    onClick={() => {
                      setLevel(i);
                      engine()?.setLevel(i);
                    }}
                  >
                    {label}
                  </ControlButton>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-2">
                <ControlButton tone="danger" onClick={() => engine()?.triggerEmergency()}>
                  Activar corredor de emergencia
                </ControlButton>
                <ControlButton
                  active={offline}
                  tone="danger"
                  onClick={() => {
                    const next = !offline;
                    setOffline(next);
                    engine()?.setCameraOffline(next);
                  }}
                >
                  {offline ? "Cámara fuera de servicio (fail-safe)" : "Simular falla de cámara"}
                </ControlButton>
                <ControlButton onClick={() => setResetKey((k) => k + 1)}>
                  Reiniciar simulación
                </ControlButton>
              </div>
            </div>
          </Card>

          <Card title="Controlador IA">
            {snap ? (
              <div className="flex flex-col gap-3 font-mono text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">FASE</span>
                  <span className="text-foreground">
                    {snap.axis === "NS" ? "NORTE–SUR" : "ESTE–OESTE"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">LUZ</span>
                  <span className="flex items-center gap-2 text-foreground">
                    <span className={`inline-block size-2.5 rounded-full ${phaseColor}`} />
                    {PHASE_LABEL[snap.phase]}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">T_VERDE</span>
                  <span className="text-foreground">{snap.greenAssigned.toFixed(1)} s</span>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>CUENTA REGRESIVA</span>
                    <span>{snap.greenRemaining.toFixed(1)} s</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-signal-green transition-[width] duration-300"
                      style={{ width: `${greenProgress * 100}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-[12px]">
                  <span className="text-muted-foreground">σ N–S: {snap.nsZone}</span>
                  <span className="text-muted-foreground">σ E–O: {snap.ewZone}</span>
                  <span className="text-muted-foreground">cola N–S: {snap.nsQueue}</span>
                  <span className="text-muted-foreground">cola E–O: {snap.ewQueue}</span>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-border pt-3 text-[10px] tracking-widest">
                  {snap.night && (
                    <span className="rounded bg-signal-amber/15 px-2 py-1 text-signal-amber">
                      MODO NOCTURNO
                    </span>
                  )}
                  {snap.emergency && (
                    <span className="animate-pulse rounded bg-destructive/15 px-2 py-1 text-destructive">
                      CORREDOR DE EMERGENCIA
                    </span>
                  )}
                  {snap.cameraOffline && (
                    <span className="rounded bg-destructive/15 px-2 py-1 text-destructive">
                      FAIL-SAFE · CICLO FIJO
                    </span>
                  )}
                  {!snap.night && !snap.emergency && !snap.cameraOffline && (
                    <span className="rounded bg-signal-green/15 px-2 py-1 text-signal-green">
                      ADAPTATIVO · IA ACTIVA
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Iniciando…</p>
            )}
          </Card>

          <Card title="Métricas en vivo">
            {snap ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Vehículos procesados", value: snap.passed.toString() },
                  { label: "Espera promedio", value: `${snap.avgWait.toFixed(1)} s` },
                  { label: "Reducción vs. estático", value: `${snap.reduction.toFixed(0)}%` },
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
          </Card>

          <Card title="Detecciones de la red neuronal">
            {snap && snap.detections.length > 0 ? (
              <ul className="flex max-h-44 flex-col gap-1.5 overflow-y-auto font-mono text-[12px]">
                {snap.detections.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between rounded bg-secondary/50 px-2.5 py-1.5"
                  >
                    <span className="text-muted-foreground">{formatClock(d.t)}</span>
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
                  ? "Sin señal de cámara. El controlador opera en ciclo fijo."
                  : "Esperando vehículos en zona de detección…"}
              </p>
            )}
          </Card>
        </div>
      </div>

      <section className="mt-12 grid gap-4 md:grid-cols-3">
        {[
          {
            n: "01",
            title: "Percibir",
            text: "La cámara IP 4MP con WDR y visión nocturna alimenta a la red YOLO, que clasifica autos, camiones, motos y ambulancias con confianza superior al 90%.",
          },
          {
            n: "02",
            title: "Decidir",
            text: "La unidad de borde (Jetson / Raspberry Pi) calcula la densidad σ y fija el verde entre T_seg (seguridad peatonal) y T_max. De noche, un vehículo único con cruce despejado obtiene verde inmediato.",
          },
          {
            n: "03",
            title: "Actuar",
            text: "El comando de fase llega al controlador industrial (Autotrol / Teknotrans) vía protocolo NTCIP, sin violar las protecciones de hardware. Ante falla de cámara, vuelve al ciclo fijo: fail-safe.",
          },
        ].map((s) => (
          <article key={s.n} className="rounded-xl border border-border bg-card p-5">
            <p className="font-mono text-xs text-signal-green">{s.n}</p>
            <h3 className="mt-2 text-lg font-semibold text-foreground">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}