import { useState } from "react";

import type { AgentDecision } from "@/lib/traffic/engine";

export interface AuditFrame {
  i: number;
  hour: number;
  thumb: string;
  phase: string;
  axis: string;
  green: number;
  sigmaNs: number;
  sigmaEw: number;
  decision: AgentDecision | null;
}

function clock(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  const s = Math.floor((((hour % 1) * 60) % 1) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function AuditPanel({
  frames,
  paused,
  onTogglePause,
}: {
  frames: AuditFrame[];
  paused: boolean;
  onTogglePause: () => void;
}) {
  const [idx, setIdx] = useState<number | null>(null);
  const [showJson, setShowJson] = useState(true);

  const pos = idx === null ? frames.length - 1 : Math.min(idx, frames.length - 1);
  const frame = frames[pos];

  if (!frame) {
    return (
      <p className="text-sm text-muted-foreground">
        Grabando fotogramas de auditoría… en unos segundos podrá recorrer la evidencia visual
        cuadro por cuadro.
      </p>
    );
  }

  const step = (d: number) => setIdx(Math.max(0, Math.min(frames.length - 1, pos + d)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onTogglePause}
          className={`rounded-md px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase ${
            paused ? "bg-signal-amber text-primary-foreground" : "bg-secondary text-muted-foreground"
          }`}
        >
          {paused ? "Simulación congelada" : "Congelar simulación"}
        </button>
        <button
          type="button"
          onClick={() => step(-1)}
          className="rounded-md bg-secondary px-3 py-1.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase hover:text-foreground"
        >
          ◀ Cuadro
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          className="rounded-md bg-secondary px-3 py-1.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase hover:text-foreground"
        >
          Cuadro ▶
        </button>
        <button
          type="button"
          onClick={() => setIdx(null)}
          className="rounded-md bg-secondary px-3 py-1.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase hover:text-foreground"
        >
          Ir al vivo
        </button>
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          cuadro {pos + 1}/{frames.length} · {clock(frame.hour)}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(0, frames.length - 1)}
        value={pos}
        onChange={(e) => setIdx(Number(e.target.value))}
        className="w-full accent-primary"
        aria-label="Recorrer los fotogramas auditados"
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <figure className="overflow-hidden rounded-lg border border-border bg-secondary/40">
          <img
            src={frame.thumb}
            alt={`Evidencia visual del cuadro ${pos + 1} a las ${clock(frame.hour)}`}
            className="block w-full"
          />
          <figcaption className="border-t border-border px-3 py-2 font-mono text-[10px] text-muted-foreground">
            CAM-01 · {clock(frame.hour)} · {frame.phase} {frame.axis} · σ N–S {frame.sigmaNs} / E–O{" "}
            {frame.sigmaEw}
          </figcaption>
        </figure>

        <div className="flex min-w-0 flex-col gap-3">
          {frame.decision ? (
            <>
              <div className="rounded-lg border border-border bg-secondary/35 p-3">
                <p className="font-mono text-[10px] tracking-widest text-signal-green uppercase">
                  {frame.decision.action} · {clock(frame.decision.hour)}
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-foreground">
                  {frame.decision.rationale}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
                  <span>conf. {(frame.decision.confidence * 100).toFixed(0)}%</span>
                  <span>latencia {frame.decision.latencyMs} ms</span>
                  <span>origen {frame.decision.source}</span>
                  <span>intervención humana: no</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowJson((v) => !v)}
                className="self-start rounded-md bg-secondary px-3 py-1.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase hover:text-foreground"
              >
                {showJson ? "Ocultar contrato JSON" : "Ver contrato JSON"}
              </button>
              {showJson && (
                <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {JSON.stringify(frame.decision.contract, null, 2)}
                </pre>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Este cuadro transcurre dentro de una fase ya asignada: no hubo un nuevo contrato de
              decisión.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
