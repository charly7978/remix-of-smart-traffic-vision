import { useMemo, useState } from "react";

import {
  DEFAULT_PRIORITY,
  PRIORITY_FIELDS,
  decide,
  type Evidence,
  type PriorityConfig,
} from "@/lib/traffic/engine";

function fmt(v: number, unit: string) {
  const n = Number.isInteger(v) ? v.toString() : v.toFixed(unit === "" ? 2 : 1);
  return unit ? `${n} ${unit}` : n;
}

export function CounterfactualPanel({
  evidence,
  baseConfig,
  onApply,
}: {
  evidence: Evidence | null;
  baseConfig: PriorityConfig;
  onApply: (cfg: PriorityConfig) => void;
}) {
  const [alt, setAlt] = useState<PriorityConfig>({ ...DEFAULT_PRIORITY });
  const [frozen, setFrozen] = useState<Evidence | null>(null);

  const ev = frozen ?? evidence;

  const base = useMemo(() => (ev ? decide(ev, baseConfig) : null), [ev, baseConfig]);
  const cf = useMemo(() => (ev ? decide(ev, alt) : null), [ev, alt]);

  if (!ev || !base || !cf) {
    return <p className="text-sm text-muted-foreground">Esperando la primera evidencia…</p>;
  }

  const delta = cf.seconds - base.seconds;
  const changed = Math.abs(delta) > 0.05 || cf.source !== base.source;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFrozen(frozen ? null : evidence)}
          className={`rounded-md px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase transition-colors ${
            frozen
              ? "bg-signal-amber/20 text-signal-amber"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          {frozen ? "Evidencia congelada" : "Congelar evidencia actual"}
        </button>
        <button
          type="button"
          onClick={() => setAlt({ ...DEFAULT_PRIORITY })}
          className="rounded-md bg-secondary px-3 py-1.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase hover:text-foreground"
        >
          Restablecer parámetros
        </button>
        <button
          type="button"
          onClick={() => onApply(alt)}
          className="rounded-md bg-primary px-3 py-1.5 font-mono text-[10px] tracking-widest text-primary-foreground uppercase"
        >
          Aplicar al controlador
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          {PRIORITY_FIELDS.map((f) => {
            const v = alt[f.key];
            const bv = baseConfig[f.key];
            return (
              <label key={f.key} className="flex flex-col gap-1.5">
                <span className="flex items-baseline justify-between gap-2 font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                  {f.label}
                  <span className={v === bv ? "text-foreground" : "text-signal-amber"}>
                    {fmt(v, f.unit)}
                  </span>
                </span>
                <input
                  type="range"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={v}
                  onChange={(e) => setAlt((p) => ({ ...p, [f.key]: Number(e.target.value) }))}
                  className="accent-primary"
                  aria-label={f.label}
                />
                <span className="text-[11px] leading-snug text-muted-foreground">{f.hint}</span>
              </label>
            );
          })}
        </div>

        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div className="col-span-2 rounded-lg border border-border bg-secondary/40 p-3">
              <dt className="text-muted-foreground">Evidencia evaluada</dt>
              <dd className="mt-2 grid grid-cols-2 gap-y-1 text-foreground">
                <span>σ eje: {ev.sigma}</span>
                <span>σ opuesto: {ev.sigmaOther}</span>
                <span>peatones: {ev.pedWaitingOther}</span>
                <span>mov. reducida: {ev.reducedWaiting ? "sí" : "no"}</span>
                <span>visibilidad: {(ev.visibility * 100).toFixed(0)}%</span>
                <span>clasificación: {(ev.detectionRate * 100).toFixed(0)}%</span>
                <span>clima: {ev.weather}</span>
                <span>emergencia: {ev.emergencyApproach ?? "no"}</span>
              </dd>
            </div>
          </dl>

          <div className="grid gap-2 sm:grid-cols-2">
            <article className="rounded-lg border border-border bg-secondary/35 p-3">
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Perfil vigente
              </p>
              <p className="mt-2 font-mono text-2xl text-foreground">
                {base.seconds.toFixed(1)} s
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                {base.rationale}
              </p>
            </article>
            <article
              className={`rounded-lg border p-3 ${
                changed ? "border-signal-amber/50 bg-signal-amber/5" : "border-border bg-secondary/35"
              }`}
            >
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Contrafáctico
              </p>
              <p className="mt-2 flex items-baseline gap-2 font-mono text-2xl text-foreground">
                {cf.seconds.toFixed(1)} s
                <span
                  className={`text-sm ${delta > 0 ? "text-signal-amber" : delta < 0 ? "text-signal-green" : "text-muted-foreground"}`}
                >
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(1)}
                </span>
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                {cf.rationale}
              </p>
            </article>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {changed
              ? "El cambio de parámetros modifica la decisión sobre la misma evidencia: así se documenta, ante un organismo de control, el efecto exacto de cada política de prioridad."
              : "Con esta evidencia, el cambio de parámetros no altera la decisión. La política es estable en este punto de operación."}
          </p>
        </div>
      </div>
    </div>
  );
}
