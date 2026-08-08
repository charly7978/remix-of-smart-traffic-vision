import { useRef } from "react";

const MAX_FLOW = 2400;

export interface FlowPreset {
  id: string;
  label: string;
  hint: string;
  profile: number[];
}

export const FLOW_PRESETS: FlowPreset[] = [
  {
    id: "habil",
    label: "Día hábil",
    hint: "Doble pico 8 h / 18 h",
    profile: [
      180, 120, 90, 80, 110, 240, 620, 1180, 1620, 1350, 1080, 1020, 1140, 1080, 1010, 1120, 1380,
      1720, 1880, 1520, 1080, 760, 480, 280,
    ],
  },
  {
    id: "finde",
    label: "Fin de semana",
    hint: "Pico tardío y nocturno",
    profile: [
      420, 340, 260, 180, 130, 120, 180, 280, 420, 620, 820, 980, 1100, 1160, 1140, 1180, 1240,
      1320, 1400, 1360, 1200, 980, 760, 560,
    ],
  },
  {
    id: "evento",
    label: "Evento / corte",
    hint: "Desvío masivo 19–22 h",
    profile: [
      160, 110, 90, 80, 100, 220, 560, 1040, 1420, 1180, 980, 940, 1020, 980, 940, 1020, 1180,
      1480, 2100, 2300, 2180, 1600, 900, 420,
    ],
  },
  {
    id: "madrugada",
    label: "Guardia nocturna",
    hint: "Demanda baja permanente",
    profile: [
      140, 110, 90, 70, 80, 130, 260, 420, 520, 480, 440, 430, 470, 450, 430, 460, 520, 600, 640,
      560, 460, 360, 260, 180,
    ],
  },
];

export function FlowProfileEditor({
  flow,
  currentHour,
  onChange,
}: {
  flow: number[];
  currentHour: number;
  onChange: (hour: number, value: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const applyFromEvent = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const h = Math.floor(((clientX - rect.left) / rect.width) * 24);
    if (h < 0 || h > 23) return;
    const ratio = 1 - (clientY - rect.top) / rect.height;
    onChange(h, Math.round(Math.max(0, Math.min(1, ratio)) * MAX_FLOW));
  };

  const active = Math.floor(currentHour) % 24;

  return (
    <div>
      <div
        ref={ref}
        role="application"
        aria-label="Editor del perfil horario de demanda"
        className="relative flex h-40 cursor-crosshair touch-none items-end gap-[3px] rounded-lg border border-border bg-secondary/30 p-2"
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          applyFromEvent(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (dragging.current) applyFromEvent(e.clientX, e.clientY);
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => (dragging.current = false)}
      >
        {[0.25, 0.5, 0.75].map((g) => (
          <div
            key={g}
            className="pointer-events-none absolute right-2 left-2 border-t border-dashed border-border/60"
            style={{ bottom: `${g * 100}%` }}
          />
        ))}
        {flow.map((value, h) => {
          const pct = Math.max(2, (value / MAX_FLOW) * 100);
          const isActive = h === active;
          return (
            <div key={h} className="group relative flex h-full flex-1 items-end">
              <div
                className={`w-full rounded-t-[3px] transition-[height,background-color] duration-150 ${
                  isActive ? "bg-signal-green" : "bg-primary/35 group-hover:bg-primary/60"
                }`}
                style={{ height: `${pct}%` }}
              />
              {isActive && (
                <span className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 font-mono text-[9px] text-signal-green">
                  {value}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[9px] text-muted-foreground">
        {[0, 3, 6, 9, 12, 15, 18, 21, 23].map((h) => (
          <span key={h}>{h.toString().padStart(2, "0")}</span>
        ))}
      </div>
    </div>
  );
}
