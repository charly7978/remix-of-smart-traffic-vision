/**
 * Panel de Gestión Municipal — Ameghino AI
 *
 * Ruta: /gestion
 *
 * Panel completo para que el Municipio de Tres de Febrero pueda:
 *  1. Subir datos reales de tráfico (aforos CSV)
 *  2. Registrar eventos del cruce (fallas, clima, emergencias)
 *  3. Consultar la bitácora de activaciones fail-safe
 *  4. Configurar cámaras IP reales
 *  5. Exportar telemetría y logs
 *  6. Ejecutar el modo dual (IA vs. ciclo fijo)
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";

import {
  getStore,
  subscribe,
  addFlowProfile,
  removeFlowProfile,
  setActiveProfileId,
  addRealEvent,
  removeRealEvent,
  clearRealEvents,
  upsertCamera,
  removeCamera,
  addFailSafeEntry,
  resolveLastFailSafeEntry,
  clearFailSafeLog,
  parseFlowCsv,
  genId,
  CASEROS_DEFAULT_PROFILE,
  CASEROS_DEFAULT_CAMERAS,
  type FlowProfile,
  type CameraConfig,
  type MunicipalDataStore,
} from "@/lib/traffic/trafficDataStore";
import { EVENT_LABEL_ES, type EventType, type ScenarioEvent } from "@/lib/traffic/engine";
import {
  exportDecisionsCSV,
  exportDecisionsJSON,
  exportFailSafeCSV,
  exportFailSafeJSON,
} from "@/lib/traffic/telemetryExporter";
import { DualModePanel } from "@/components/simulator/DualModePanel";
import { RealCameraView } from "@/components/simulator/RealCameraView";
import { CameraConnector } from "@/lib/vision/cameraConnector";

export const Route = createFileRoute("/gestion")({
  head: () => ({
    meta: [
      { title: "Panel de Gestión Municipal — Ameghino AI" },
      {
        name: "description",
        content:
          "Panel de gestión para que el municipio de Tres de Febrero suba datos reales de tráfico, configure cámaras, exporte telemetría y compare el semáforo inteligente contra el ciclo fijo.",
      },
    ],
  }),
  component: GestionPage,
});

/* ------------------------------------------------------------------ */
/* Componentes auxiliares                                               */
/* ------------------------------------------------------------------ */

function Section({
  id,
  icon,
  title,
  subtitle,
  right,
  children,
}: {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.25em] text-muted-foreground uppercase">
            <span>{icon}</span> {title}
          </h2>
          {subtitle && (
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
        {right}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "green" | "red" | "amber" | "muted";
  children: ReactNode;
}) {
  const cls =
    tone === "green"
      ? "bg-signal-green/15 text-signal-green"
      : tone === "red"
        ? "bg-destructive/15 text-destructive"
        : tone === "amber"
          ? "bg-signal-amber/15 text-signal-amber"
          : "bg-secondary text-muted-foreground";
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold ${cls}`}
    >
      {children}
    </span>
  );
}

function Btn({
  onClick,
  tone = "default",
  disabled,
  children,
}: {
  onClick: () => void;
  tone?: "default" | "green" | "red";
  disabled?: boolean;
  children: ReactNode;
}) {
  const cls =
    tone === "green"
      ? "bg-signal-green/90 text-white hover:bg-signal-green"
      : tone === "red"
        ? "bg-destructive/80 text-white hover:bg-destructive"
        : "border border-border bg-secondary/60 text-muted-foreground hover:bg-accent hover:text-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-1.5 font-mono text-[10px] font-semibold tracking-widest uppercase transition-colors disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Hook del store                                                       */
/* ------------------------------------------------------------------ */

function useStore(): MunicipalDataStore {
  const [data, setData] = useState(getStore);
  useEffect(() => subscribe(() => setData(getStore())), []);
  return data;
}

/* ------------------------------------------------------------------ */
/* Sección 1: Carga de Aforos CSV                                       */
/* ------------------------------------------------------------------ */

function CsvUploadSection() {
  const store = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<number[] | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = reader.result as string;
        const profile = parseFlowCsv(raw);
        setPreview(profile);
        setPreviewName(file.name);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al parsear el archivo");
        setPreview(null);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const confirmUpload = () => {
    if (!preview) return;
    const profile: FlowProfile = {
      id: genId(),
      name: previewName.replace(/\.csv$/i, ""),
      profile: preview,
      uploadedAt: new Date().toISOString(),
      source: "csv",
    };
    addFlowProfile(profile);
    setPreview(null);
    setPreviewName("");
  };

  return (
    <Section
      id="csv-upload"
      icon="📊"
      title="Carga de Aforos Reales"
      subtitle="Subí un archivo CSV con el aforo vehicular por hora (24 filas: hora;veh_h). El perfil alimentará el simulador y el modo dual."
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt"
        onChange={handleFile}
        className="hidden"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Btn onClick={() => inputRef.current?.click()}>📁 Subir Archivo CSV</Btn>
        <button
          type="button"
          onClick={() => {
            const exists = store.flowProfiles.some((p) => p.name.includes("San Martín y Urquiza"));
            if (!exists) {
              addFlowProfile({ ...CASEROS_DEFAULT_PROFILE, id: genId() });
            } else {
              const p = store.flowProfiles.find((x) => x.name.includes("San Martín y Urquiza"));
              if (p) setActiveProfileId(p.id);
            }
          }}
          className="rounded-lg border border-signal-green/40 bg-signal-green/10 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-widest text-signal-green uppercase transition-colors hover:bg-signal-green hover:text-white"
        >
          🏙️ Aforo Real Caseros (24h)
        </button>
        <span className="text-xs text-muted-foreground">
          Formato:{" "}
          <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[10px]">hora;veh_h</code>{" "}
          (24 filas)
        </span>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
          <p className="font-mono text-xs text-destructive">❌ {error}</p>
        </div>
      )}

      {preview && (
        <div className="mt-4 rounded-lg border border-signal-green/30 bg-signal-green/5 p-4">
          <p className="mb-2 font-mono text-xs font-semibold text-signal-green">
            ✓ Preview: {previewName} ({preview.reduce((a, b) => a + b, 0).toLocaleString("es-AR")}{" "}
            veh/día total)
          </p>
          <div className="flex flex-wrap gap-1">
            {preview.map((v, i) => (
              <div
                key={i}
                className="flex flex-col items-center rounded bg-secondary/60 px-1.5 py-1"
              >
                <span className="font-mono text-[9px] text-muted-foreground">
                  {i.toString().padStart(2, "0")}h
                </span>
                <span className="font-mono text-xs font-semibold text-foreground">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Btn tone="green" onClick={confirmUpload}>
              ✓ Confirmar y Activar en Simulador
            </Btn>
            <Btn onClick={() => setPreview(null)}>Cancelar</Btn>
          </div>
        </div>
      )}

      {/* Perfiles guardados */}
      {store.flowProfiles.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Perfiles de Tránsito Guardados en el Municipio
          </p>
          <div className="space-y-2">
            {store.flowProfiles.map((p) => {
              const isActive = store.activeProfileId === p.id;
              const totalVeh = p.profile.reduce((a, b) => a + b, 0);
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                    isActive
                      ? "border-signal-green/50 bg-signal-green/10"
                      : "border-border bg-secondary/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`size-2.5 rounded-full ${isActive ? "bg-signal-green animate-pulse" : "bg-muted-foreground"}`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {p.name}
                        </span>
                        {isActive && (
                          <span className="rounded bg-signal-green px-1.5 py-0.5 font-mono text-[9px] font-bold text-white uppercase">
                            Activo en Simulador
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {totalVeh.toLocaleString("es-AR")} veh/día · Subido el{" "}
                        {new Date(p.uploadedAt).toLocaleDateString("es-AR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => setActiveProfileId(p.id)}
                        className="rounded border border-border bg-secondary/60 px-2.5 py-1 font-mono text-[10px] text-foreground transition-colors hover:bg-accent"
                      >
                        Activar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFlowProfile(p.id)}
                      className="text-xs text-muted-foreground transition-colors hover:text-destructive p-1"
                      title="Eliminar perfil"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Sección 2: Eventos del Cruce                                         */
/* ------------------------------------------------------------------ */

const EVENT_TYPES: EventType[] = [
  "camera_fail",
  "camera_restore",
  "weather_clear",
  "weather_rain",
  "weather_fog",
  "emergency",
];

function EventsSection() {
  const store = useStore();
  const [eventType, setEventType] = useState<EventType>("camera_fail");
  const [eventHour, setEventHour] = useState(12);

  const handleAdd = () => {
    const ev: ScenarioEvent = {
      id: genId(),
      hour: eventHour,
      type: eventType,
    };
    addRealEvent(ev);
  };

  return (
    <Section
      id="events"
      icon="📋"
      title="Eventos del Cruce"
      subtitle="Registrá eventos reales del cruce de Caseros (fallas, clima, emergencias). Se inyectan en el simulador y la bitácora."
      right={
        store.realEvents.length > 0 ? (
          <Btn tone="red" onClick={clearRealEvents}>
            Limpiar Todo
          </Btn>
        ) : undefined
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Tipo
          </label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as EventType)}
            className="rounded-lg border border-border bg-secondary/40 px-3 py-2 font-mono text-xs text-foreground"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EVENT_LABEL_ES[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Hora
          </label>
          <input
            type="number"
            min={0}
            max={23}
            step={0.25}
            value={eventHour}
            onChange={(e) => setEventHour(Number(e.target.value))}
            className="w-20 rounded-lg border border-border bg-secondary/40 px-3 py-2 font-mono text-xs text-foreground"
          />
        </div>
        <Btn tone="green" onClick={handleAdd}>
          + Agregar
        </Btn>
      </div>

      {store.realEvents.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/60">
                <th className="px-3 py-2 text-left font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                  Hora
                </th>
                <th className="px-3 py-2 text-left font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                  Tipo
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {store.realEvents.map((ev) => (
                <tr key={ev.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">
                    {Math.floor(ev.hour).toString().padStart(2, "0")}:
                    {Math.round((ev.hour % 1) * 60)
                      .toString()
                      .padStart(2, "0")}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {EVENT_LABEL_ES[ev.type]}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeRealEvent(ev.id)}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Sección 3: Bitácora Fail-Safe                                        */
/* ------------------------------------------------------------------ */

function FailSafeSection() {
  const store = useStore();
  const activeCount = store.failSafeLog.filter((e) => !e.resolved).length;

  const triggerTestFailSafe = () => {
    addFailSafeEntry({
      id: genId(),
      timestamp: new Date().toISOString(),
      hour: new Date().getHours() + new Date().getMinutes() / 60,
      reason: "Pérdida de enlace CCTV / Cámara Offline en Caseros (Prueba de Auditoría)",
      duration: null,
      resolved: false,
      source: "simulation",
    });
  };

  const handleResolve = () => {
    resolveLastFailSafeEntry("Enlace COM restablecido por operador municipal");
  };

  return (
    <Section
      id="failsafe-log"
      icon="🛡️"
      title="Bitácora de Contingencia y Fail-Safe"
      subtitle="Historial de activaciones del modo seguro: cada vez que el controlador pasa a ciclo fijo pregrabado por corte de cámara, niebla o degradación de confianza."
      right={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={triggerTestFailSafe}
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 font-mono text-[10px] font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white"
          >
            ⚠️ Simular Falla
          </button>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={handleResolve}
              className="rounded-lg border border-signal-green/40 bg-signal-green/10 px-3 py-1.5 font-mono text-[10px] font-semibold text-signal-green transition-colors hover:bg-signal-green hover:text-white"
            >
              ✓ Restablecer
            </button>
          )}
          {store.failSafeLog.length > 0 && (
            <>
              <Btn onClick={() => exportFailSafeCSV(store.failSafeLog)}>⬇ CSV</Btn>
              <Btn onClick={() => exportFailSafeJSON(store.failSafeLog)}>⬇ JSON</Btn>
              <Btn tone="red" onClick={clearFailSafeLog}>
                Limpiar
              </Btn>
            </>
          )}
        </div>
      }
    >
      {store.failSafeLog.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-secondary/10 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            No hay activaciones registradas. Las fallas de percepción se graban automáticamente
            desde el simulador o con el botón{" "}
            <strong className="text-foreground">Simular Falla</strong>.
          </p>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-secondary/60">
                <th className="px-3 py-2 text-left font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                  Hora
                </th>
                <th className="px-3 py-2 text-left font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                  Motivo / Causa
                </th>
                <th className="px-3 py-2 text-left font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                  Duración
                </th>
                <th className="px-3 py-2 text-left font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                  Estado
                </th>
                <th className="px-3 py-2 text-left font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                  Origen
                </th>
              </tr>
            </thead>
            <tbody>
              {store.failSafeLog.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-t border-border hover:bg-secondary/20 transition-colors"
                >
                  <td className="px-3 py-2 font-mono text-xs text-foreground whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleTimeString("es-AR")}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{entry.reason}</td>
                  <td className="px-3 py-2 font-mono text-xs text-foreground whitespace-nowrap">
                    {entry.duration
                      ? `${entry.duration} s`
                      : entry.resolved
                        ? "Resuelto"
                        : "En curso"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={entry.resolved ? "green" : "red"}>
                      {entry.resolved ? "Normalizado" : "Fail-Safe Activo"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone="muted">{entry.source}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Sección 4: Configuración de Cámaras                                  */
/* ------------------------------------------------------------------ */

const APPROACHES = ["N", "S", "E", "W"] as const;
const CAM_KINDS = [
  { value: "snapshot-http", label: "Snapshot HTTP" },
  { value: "webcam", label: "Webcam Local" },
  { value: "rtsp-webrtc", label: "RTSP → WebRTC (requiere gateway)" },
] as const;

function CameraSection() {
  const store = useStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<CameraConfig>>({
    kind: "snapshot-http",
    approach: "N",
    refreshMs: 2000,
    enabled: true,
  });
  const [testResult, setTestResult] = useState<{ ok: boolean; ms: number; error?: string } | null>(
    null,
  );

  const handleSave = () => {
    if (!form.label || !form.url) return;
    const cam: CameraConfig = {
      id: form.id || genId(),
      label: form.label,
      approach: form.approach as CameraConfig["approach"],
      kind: form.kind as CameraConfig["kind"],
      url: form.url,
      refreshMs: form.refreshMs || 2000,
      lastConnected: null,
      enabled: form.enabled !== false,
    };
    upsertCamera(cam);
    setForm({ kind: "snapshot-http", approach: "N", refreshMs: 2000, enabled: true });
    setEditing(false);
    setTestResult(null);
  };

  const handleTest = async () => {
    if (!form.url) return;
    setTestResult(null);
    const connector = new CameraConnector();
    const result = await connector.testConnection(form.url);
    setTestResult({ ok: result.ok, ms: result.latencyMs, error: result.error });
  };

  return (
    <Section
      id="cameras"
      icon="📹"
      title="Cámaras IP del Cruce"
      subtitle="Configurá las cámaras del cruce de Caseros (Norte: Av. San Martín / Este: Urquiza). El sistema analiza las imágenes con VisionAnalyzer para calcular densidad y clasificar vehículos en vivo."
      right={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              CASEROS_DEFAULT_CAMERAS.forEach((c) => upsertCamera(c));
            }}
            className="rounded-lg border border-signal-green/40 bg-signal-green/10 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-widest text-signal-green uppercase transition-colors hover:bg-signal-green hover:text-white"
          >
            🎥 Cargar 2 Cámaras Caseros
          </button>
          {!editing && (
            <Btn tone="green" onClick={() => setEditing(true)}>
              + Agregar Cámara
            </Btn>
          )}
        </div>
      }
    >
      {/* Formulario */}
      {editing && (
        <div className="mb-5 rounded-lg border border-signal-green/30 bg-signal-green/5 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Nombre
              </label>
              <input
                type="text"
                placeholder="Ej: Cámara Norte"
                value={form.label ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Acceso
              </label>
              <select
                value={form.approach}
                onChange={(e) => setForm((f) => ({ ...f, approach: e.target.value }))}
                className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-foreground"
              >
                {APPROACHES.map((a) => (
                  <option key={a} value={a}>
                    {a === "N" ? "Norte" : a === "S" ? "Sur" : a === "E" ? "Este" : "Oeste"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Tipo
              </label>
              <select
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
                className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-foreground"
              >
                {CAM_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Intervalo (ms)
              </label>
              <input
                type="number"
                min={500}
                max={10000}
                step={100}
                value={form.refreshMs}
                onChange={(e) => setForm((f) => ({ ...f, refreshMs: Number(e.target.value) }))}
                className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-foreground"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                URL del Endpoint
              </label>
              <input
                type="url"
                placeholder="http://192.168.1.10/Streaming/Channels/1/picture"
                value={form.url ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 font-mono text-[11px] text-foreground"
              />
            </div>
          </div>

          {testResult && (
            <div
              className={`mt-3 rounded-lg border px-3 py-2 font-mono text-xs ${
                testResult.ok
                  ? "border-signal-green/30 bg-signal-green/5 text-signal-green"
                  : "border-destructive/30 bg-destructive/5 text-destructive"
              }`}
            >
              {testResult.ok ? `✓ Conexión exitosa (${testResult.ms} ms)` : `✕ ${testResult.error}`}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <Btn tone="green" onClick={handleSave} disabled={!form.label || !form.url}>
              ✓ Guardar
            </Btn>
            <Btn onClick={handleTest} disabled={!form.url}>
              🔗 Probar Conexión
            </Btn>
            <Btn
              onClick={() => {
                setEditing(false);
                setTestResult(null);
              }}
            >
              Cancelar
            </Btn>
          </div>
        </div>
      )}

      {/* Lista de cámaras */}
      {store.cameras.length > 0 ? (
        <div className="space-y-2">
          {store.cameras.map((cam) => (
            <div
              key={cam.id}
              className="flex items-center justify-between rounded-lg border border-border bg-secondary/20 px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`size-2 rounded-full ${cam.enabled ? "bg-signal-green" : "bg-muted-foreground"}`}
                />
                <span className="font-mono text-xs font-semibold text-foreground">{cam.label}</span>
                <Badge tone="muted">{cam.approach}</Badge>
                <Badge tone="muted">{cam.kind}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setForm(cam);
                    setEditing(true);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => removeCamera(cam.id)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !editing && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No hay cámaras configuradas. Presioná{" "}
            <span className="font-semibold">+ Agregar Cámara</span> para empezar.
          </p>
        )
      )}

      {/* Vista de cámaras reales */}
      {store.cameras.length > 0 && (
        <div className="mt-5">
          <RealCameraView cameras={store.cameras} />
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Página principal                                                     */
/* ------------------------------------------------------------------ */

function GestionPage() {
  const store = useStore();

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-10">
      {/* Hero */}
      <div className="mb-8">
        <p className="font-mono text-xs tracking-[0.3em] text-signal-green uppercase">
          Panel de Gestión Municipal
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          Municipio de Tres de Febrero · Caseros
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Cargá datos reales de tráfico, configurá las cámaras del cruce, consultá la bitácora de
          fail-safe y compará el semáforo inteligente contra el ciclo fijo tradicional.
        </p>
      </div>

      {/* Resumen rápido */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Perfiles de Flujo
          </p>
          <p className="mt-1 text-2xl font-semibold text-signal-green">
            {store.flowProfiles.length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Eventos Registrados
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{store.realEvents.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Cámaras Configuradas
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{store.cameras.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Fail-Safe Events
          </p>
          <p className="mt-1 text-2xl font-semibold text-signal-amber">
            {store.failSafeLog.length}
          </p>
        </div>
      </div>

      {/* Secciones */}
      <div className="space-y-6">
        <CsvUploadSection />
        <EventsSection />
        <FailSafeSection />
        <CameraSection />

        {/* Modo Dual */}
        {(() => {
          const activeProf =
            store.flowProfiles.find((p) => p.id === store.activeProfileId) ?? store.flowProfiles[0];
          return <DualModePanel flowProfile={activeProf ? activeProf.profile : undefined} />;
        })()}
      </div>
    </main>
  );
}
