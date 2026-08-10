import type { HistoryPoint } from "@/lib/traffic/engine";

const W = 600;
const H = 160;

function path(points: HistoryPoint[], pick: (p: HistoryPoint) => number, max: number): string {
  if (points.length < 2) return "";
  return points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = H - (Math.min(max, pick(p)) / max) * H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function WaitChart({ history }: { history: HistoryPoint[] }) {
  const data = history.slice(-120);
  const max = Math.max(20, ...data.map((p) => Math.max(p.adaptive, p.fixed))) * 1.15;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-40 w-full"
        role="img"
        aria-label="Demora media por vehículo: control adaptativo frente a ciclo fijo"
      >
        <defs>
          <linearGradient id="adaptiveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--signal-green)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--signal-green)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line
            key={g}
            x1={0}
            x2={W}
            y1={H * g}
            y2={H * g}
            stroke="var(--border)"
            strokeDasharray="4 6"
          />
        ))}
        {data.length > 1 && (
          <>
            <path
              d={`${path(data, (p) => p.adaptive, max)} L${W},${H} L0,${H} Z`}
              fill="url(#adaptiveFill)"
            />
            <path
              d={path(data, (p) => p.fixed, max)}
              fill="none"
              stroke="var(--signal-red)"
              strokeWidth={2}
              strokeDasharray="6 5"
            />
            <path
              d={path(data, (p) => p.adaptive, max)}
              fill="none"
              stroke="var(--signal-green)"
              strokeWidth={2.4}
            />
          </>
        )}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 font-mono text-[11px] text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-5 bg-signal-green" /> Ameghino AI (adaptativo)
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-signal-red" />
          Ciclo fijo (Webster)
        </span>
        <span>Eje Y: demora media por vehículo (s)</span>
      </div>
    </div>
  );
}
