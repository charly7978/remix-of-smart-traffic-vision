/**
 * Panel de Modo Dual — Ameghino AI vs. Ciclo Fijo.
 *
 * Muestra KPIs comparativos en tiempo real y un gráfico de evolución temporal
 * de espera media entre el controlador adaptativo y el semáforo convencional.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { DualSimulation, type DualSnapshot, type DualHistoryPoint } from "@/lib/traffic/dualSimulation";
import { DEFAULT_FLOW, type PriorityConfig, DEFAULT_PRIORITY } from "@/lib/traffic/engine";
import { exportDualComparisonCSV } from "@/lib/traffic/telemetryExporter";

/* ------------------------------------------------------------------ */
/* Componentes auxiliares                                               */
/* ------------------------------------------------------------------ */

function DualMetric({
  label,
  adaptiveValue,
  fixedValue,
  unit,
  higherIsBetter = false,
}: {
  label: string;
  adaptiveValue: string;
  fixedValue: string;
  unit: string;
  higherIsBetter?: boolean;
}) {
  const aNum = parseFloat(adaptiveValue) || 0;
  const fNum = parseFloat(fixedValue) || 0;
  const better = higherIsBetter ? aNum > fNum : aNum < fNum;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="font-mono text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
            IA Adaptativa
          </p>
          <p className={`mt-1 font-mono text-lg font-semibold ${better ? "text-signal-green" : "text-signal-amber"}`}>
            {adaptiveValue}
            <span className="ml-1 text-xs text-muted-foreground">{unit}</span>
          </p>
        </div>
        <div>
          <p className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
            Ciclo Fijo
          </p>
          <p className={`mt-1 font-mono text-lg font-semibold ${!better ? "text-signal-green" : "text-signal-red"}`}>
            {fixedValue}
            <span className="ml-1 text-xs text-muted-foreground">{unit}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function ImprovementBadge({ value, label }: { value: number; label: string }) {
  const positive = value > 0;
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-card p-4">
      <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">{label}</p>
      <p
        className={`mt-2 font-mono text-2xl font-bold ${
          positive ? "text-signal-green" : value < 0 ? "text-signal-red" : "text-muted-foreground"
        }`}
      >
        {positive ? "+" : ""}
        {value.toFixed(1)}%
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {positive ? "mejor con IA" : value < 0 ? "peor con IA" : "sin diferencia"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Componente principal                                                */
/* ------------------------------------------------------------------ */

interface DualModePanelProps {
  flowProfile?: number[];
  priority?: PriorityConfig;
  startHour?: number;
  nsShare?: number;
}

export function DualModePanel({
  flowProfile,
  priority,
  startHour = 7,
  nsShare = 0.58,
}: DualModePanelProps) {
  const dualRef = useRef<DualSimulation | null>(null);
  const [snap, setSnap] = useState<DualSnapshot | null>(null);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(5);

  const start = useCallback(() => {
    const sim = new DualSimulation({
      flowProfile: flowProfile ?? [...DEFAULT_FLOW],
      startHour,
      nsShare,
      priority: priority ?? { ...DEFAULT_PRIORITY },
      minutesPerSecond: speed,
    });
    dualRef.current = sim;
    setRunning(true);
  }, [flowProfile, priority, startHour, nsShare, speed]);

  const stop = useCallback(() => {
    setRunning(false);
  }, []);

  useEffect(() => {
    if (!running || !dualRef.current) return;

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      dualRef.current!.update(dt);

      acc += dt;
      if (acc > 0.3) {
        acc = 0;
        setSnap(dualRef.current!.getSnapshot());
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  useEffect(() => {
    dualRef.current?.setMinutesPerSecond(speed);
  }, [speed]);

  const chartData = (snap?.history ?? []).map((h) => ({
    hora: h.hour.toFixed(1),
    "IA Adaptativa": Math.round(h.adaptiveWait * 10) / 10,
    "Ciclo Fijo": Math.round(h.fixedWait * 10) / 10,
  }));

  const clockLabel = (hour: number): string => {
    const h = Math.floor(hour) % 24;
    const m = Math.floor((hour % 1) * 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-mono text-[11px] font-semibold tracking-[0.25em] text-muted-foreground uppercase">
            Modo Dual — IA Adaptativa vs. Ciclo Fijo
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Dos motores en paralelo con idéntico flujo vehicular. Compara reducción de esperas, throughput y emisiones.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!running ? (
            <button
              type="button"
              onClick={start}
              className="rounded-lg bg-signal-green/90 px-4 py-2 font-mono text-xs font-semibold text-white transition-colors hover:bg-signal-green"
            >
              ▶ Iniciar Comparación
            </button>
          ) : (
            <button
              type="button"
              onClick={stop}
              className="rounded-lg bg-signal-red/80 px-4 py-2 font-mono text-xs font-semibold text-white transition-colors hover:bg-signal-red"
            >
              ■ Detener
            </button>
          )}
        </div>
      </div>

      {/* Velocidad */}
      <div className="mt-4 flex items-center gap-3">
        <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          Velocidad:
        </label>
        <input
          type="range"
          min={1}
          max={15}
          step={1}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="h-1.5 w-32 cursor-pointer accent-signal-green"
        />
        <span className="font-mono text-xs text-signal-green">{speed} min/s</span>
      </div>

      {snap && (
        <>
          {/* Hora simulada */}
          <div className="mt-4 flex items-center gap-4">
            <p className="font-mono text-sm text-foreground">
              🕐 {clockLabel(snap.adaptive.hour)}
            </p>
            <p className="text-xs text-muted-foreground">
              Demanda: {snap.adaptive.demand} veh/h · {snap.adaptive.night ? "🌙 Noche" : "☀️ Día"}
            </p>
          </div>

          {/* KPIs de mejora */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <ImprovementBadge value={snap.improvement.waitPct} label="Reducción de Espera" />
            <ImprovementBadge value={snap.improvement.throughputPct} label="Más Throughput" />
            <ImprovementBadge value={snap.improvement.co2Pct} label="CO₂ Ahorrado" />
          </div>

          {/* KPIs comparativos */}
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <DualMetric
              label="Espera Media"
              adaptiveValue={snap.adaptive.recentWait.toFixed(1)}
              fixedValue={snap.fixed.recentWait.toFixed(1)}
              unit="s"
            />
            <DualMetric
              label="Vehículos Pasados"
              adaptiveValue={snap.adaptive.passed.toString()}
              fixedValue={snap.fixed.passed.toString()}
              unit=""
              higherIsBetter
            />
            <DualMetric
              label="Cola Total"
              adaptiveValue={(snap.adaptive.nsQueue + snap.adaptive.ewQueue).toString()}
              fixedValue={(snap.fixed.nsQueue + snap.fixed.ewQueue).toString()}
              unit=""
            />
            <DualMetric
              label="CO₂ Ahorrado"
              adaptiveValue={snap.adaptive.co2SavedKg.toFixed(1)}
              fixedValue={snap.fixed.co2SavedKg.toFixed(1)}
              unit="kg"
              higherIsBetter
            />
          </div>

          {/* Gráfico comparativo */}
          {chartData.length > 5 && (
            <div className="mt-6">
              <p className="mb-2 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Evolución Temporal de Espera Media (s)
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData.slice(-80)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hora" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="IA Adaptativa"
                    stroke="hsl(var(--signal-green))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Ciclo Fijo"
                    stroke="hsl(var(--signal-red))"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="5 3"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Exportar */}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => exportDualComparisonCSV(snap.history)}
              className="rounded-lg border border-border bg-secondary/60 px-4 py-2 font-mono text-[10px] tracking-widest text-muted-foreground uppercase transition-colors hover:bg-accent hover:text-foreground"
            >
              ⬇ Exportar Comparación CSV
            </button>
          </div>
        </>
      )}

      {!snap && !running && (
        <div className="mt-8 flex flex-col items-center py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Presioná <span className="font-semibold text-foreground">Iniciar Comparación</span> para ejecutar
            ambos motores en paralelo con el mismo flujo vehicular.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            El motor adaptativo (Ameghino AI) usa la fórmula T_v = max(T_seg, min(T_max, β·σ)).
            <br />
            El motor de referencia usa ciclo fijo estándar de 22s por eje.
          </p>
        </div>
      )}
    </section>
  );
}
