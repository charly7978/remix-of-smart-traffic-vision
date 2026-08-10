import { useState } from "react";

import { EVENT_LABEL_ES, type EventType, type ScenarioEvent } from "@/lib/traffic/engine";

const TONE: Record<EventType, string> = {
  camera_fail: "bg-signal-red",
  camera_restore: "bg-signal-green",
  weather_clear: "bg-signal-green",
  weather_rain: "bg-chart-4",
  weather_fog: "bg-signal-amber",
  emergency: "bg-signal-red",
};

const TYPES: EventType[] = [
  "camera_fail",
  "camera_restore",
  "weather_rain",
  "weather_fog",
  "weather_clear",
  "emergency",
];

export function EventTimeline({
  events,
  currentHour,
  onAdd,
  onRemove,
}: {
  events: ScenarioEvent[];
  currentHour: number;
  onAdd: (event: ScenarioEvent) => void;
  onRemove: (id: string) => void;
}) {
  const [type, setType] = useState<EventType>("camera_fail");
  const [hour, setHour] = useState(12);

  const sorted = [...events].sort((a, b) => a.hour - b.hour);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-14 rounded-lg border border-border bg-secondary/30">
        <div className="absolute inset-x-3 top-1/2 h-px bg-border" />
        <div
          className="absolute top-1 bottom-1 w-px bg-signal-green"
          style={{ left: `calc(0.75rem + ${(currentHour / 24) * 100}% * 0.94)` }}
        />
        {sorted.map((ev) => (
          <button
            key={ev.id}
            type="button"
            onClick={() => onRemove(ev.id)}
            title={`${EVENT_LABEL_ES[ev.type]} · ${ev.hour.toString().padStart(2, "0")}:00 — clic para quitar`}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `calc(0.75rem + ${(ev.hour / 24) * 100}% * 0.94)` }}
          >
            <span
              className={`block size-3 rounded-full ring-2 ring-background transition-transform hover:scale-125 ${TONE[ev.type]}`}
            />
          </button>
        ))}
        <div className="pointer-events-none absolute inset-x-3 bottom-1 flex justify-between font-mono text-[9px] text-muted-foreground">
          {[0, 6, 12, 18, 24].map((h) => (
            <span key={h}>{h.toString().padStart(2, "0")}h</span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Evento
          </span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as EventType)}
            className="h-9 rounded-md border border-border bg-secondary/60 px-2 text-sm text-foreground"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {EVENT_LABEL_ES[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Hora
          </span>
          <input
            type="number"
            min={0}
            max={23}
            value={hour}
            onChange={(e) => setHour(Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
            className="h-9 w-20 rounded-md border border-border bg-secondary/60 px-2 font-mono text-sm text-foreground"
          />
        </label>
        <button
          type="button"
          onClick={() =>
            onAdd({ id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, hour, type })
          }
          className="h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85"
        >
          Programar
        </button>
      </div>

      {sorted.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {sorted.map((ev) => (
            <li key={ev.id}>
              <button
                type="button"
                onClick={() => onRemove(ev.id)}
                className="flex items-center gap-2 rounded-full border border-border bg-secondary/50 py-1 pr-2 pl-3 font-mono text-[11px] text-secondary-foreground transition-colors hover:border-destructive hover:text-destructive"
              >
                <span className={`size-2 rounded-full ${TONE[ev.type]}`} />
                {ev.hour.toString().padStart(2, "0")}:00 · {EVENT_LABEL_ES[ev.type]}
                <span aria-hidden className="text-muted-foreground">
                  ✕
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
