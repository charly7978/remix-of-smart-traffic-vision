/**
 * Exportador de Telemetría para Ameghino AI.
 *
 * Genera archivos CSV y JSON descargables con datos completos de VideoTelemetry:
 * latencia de inferencia, conteos vehiculares, confianza, decisión, estado de
 * la cámara, clima, peatones y razonamiento del agente.
 *
 * Usa la API nativa Blob + URL.createObjectURL para descarga client-side
 * sin dependencias externas.
 */

import type { AgentDecision, LogEntry, Snapshot, Evidence } from "./engine";
import type { FailSafeEntry } from "./trafficDataStore";

/* ------------------------------------------------------------------ */
/* Tipos de registro exportable                                        */
/* ------------------------------------------------------------------ */

export interface TelemetryRecord {
  timestamp_iso: string;
  hour: string;
  intersection_name: string;
  latency_ms: number;
  vehicle_count_ns: number;
  vehicle_count_ew: number;
  total_vehicles: number;
  queue_ns: number;
  queue_ew: number;
  confidence: number;
  detection_rate: number;
  decision_action: string;
  decision_source: string;
  green_assigned_s: number;
  weather: string;
  camera_offline: boolean;
  ped_waiting: number;
  ped_waiting_other: number;
  reduced_mobility: boolean;
  night: boolean;
  visibility: number;
  rationale: string;
}

export interface TelemetryExport {
  schema: "ameghino.telemetry.v1";
  exported_at: string;
  intersection_id: string;
  intersection_name: string;
  total_records: number;
  records: TelemetryRecord[];
}

/* ------------------------------------------------------------------ */
/* Conversión de decisiones a registros                                */
/* ------------------------------------------------------------------ */

function clockLabel(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  const s = Math.floor((((hour % 1) * 60) % 1) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function decisionsToRecords(decisions: AgentDecision[]): TelemetryRecord[] {
  return decisions.map((d) => {
    const ev: Evidence = d.evidence;
    const vNs = ev.axis === "NS" ? ev.sigma : ev.sigmaOther;
    const vEw = ev.axis === "EW" ? ev.sigma : ev.sigmaOther;
    return {
      timestamp_iso: new Date().toISOString(),
      hour: clockLabel(d.hour),
      intersection_name: "Av. San Martín y Urquiza · Caseros (3F)",
      latency_ms: d.latencyMs,
      vehicle_count_ns: vNs,
      vehicle_count_ew: vEw,
      total_vehicles: vNs + vEw,
      queue_ns: ev.axis === "NS" ? ev.queue : 0,
      queue_ew: ev.axis === "EW" ? ev.queue : 0,
      confidence: Math.round(d.confidence * 1000) / 1000,
      detection_rate: Math.round(ev.detectionRate * 1000) / 1000,
      decision_action: d.action,
      decision_source: d.source,
      green_assigned_s: d.seconds,
      weather: ev.weather,
      camera_offline: ev.cameraOffline,
      ped_waiting: ev.pedWaiting,
      ped_waiting_other: ev.pedWaitingOther,
      reduced_mobility: ev.reducedWaiting,
      night: ev.night,
      visibility: Math.round(ev.visibility * 1000) / 1000,
      rationale: d.rationale,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Generación CSV (separador ; para Excel argentino, UTF-8 BOM)       */
/* ------------------------------------------------------------------ */

function escapeCSV(val: unknown): string {
  const str = String(val ?? "");
  if (str.includes(";") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function recordsToCSV(records: TelemetryRecord[]): string {
  if (records.length === 0) return "";

  const headers = Object.keys(records[0]!) as (keyof TelemetryRecord)[];
  const headerLine = headers.map((h) => escapeCSV(h)).join(";");

  const lines = records.map((r) => headers.map((h) => escapeCSV(r[h])).join(";"));

  /* BOM para que Excel reconozca UTF-8 */
  return "\uFEFF" + [headerLine, ...lines].join("\r\n");
}

/* ------------------------------------------------------------------ */
/* Fail-Safe log a CSV                                                 */
/* ------------------------------------------------------------------ */

export function failSafeToCSV(entries: FailSafeEntry[]): string {
  if (entries.length === 0) return "";

  const headers = ["id", "timestamp", "hour", "reason", "duration", "resolved", "source"];
  const headerLine = headers.join(";");

  const lines = entries.map((e) =>
    [
      escapeCSV(e.id),
      escapeCSV(e.timestamp),
      escapeCSV(e.hour),
      escapeCSV(e.reason),
      escapeCSV(e.duration ?? ""),
      escapeCSV(e.resolved),
      escapeCSV(e.source),
    ].join(";"),
  );

  return "\uFEFF" + [headerLine, ...lines].join("\r\n");
}

/* ------------------------------------------------------------------ */
/* Descarga de archivo via Blob API                                    */
/* ------------------------------------------------------------------ */

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* API pública de exportación                                          */
/* ------------------------------------------------------------------ */

/**
 * Exporta las decisiones del motor como CSV descargable.
 */
export function exportDecisionsCSV(decisions: AgentDecision[]): void {
  const records = decisionsToRecords(decisions);
  const csv = recordsToCSV(records);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  downloadBlob(csv, `ameghino_telemetria_${ts}.csv`, "text/csv;charset=utf-8");
}

/**
 * Exporta las decisiones del motor como JSON descargable.
 */
export function exportDecisionsJSON(decisions: AgentDecision[]): void {
  const records = decisionsToRecords(decisions);
  const payload: TelemetryExport = {
    schema: "ameghino.telemetry.v1",
    exported_at: new Date().toISOString(),
    intersection_id: "AR-BA-3F-0142",
    intersection_name: "Av. San Martín y Urquiza · Caseros (Tres de Febrero)",
    total_records: records.length,
    records,
  };
  const json = JSON.stringify(payload, null, 2);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  downloadBlob(json, `ameghino_telemetria_${ts}.json`, "application/json");
}

/**
 * Exporta la bitácora de fail-safe como CSV descargable.
 */
export function exportFailSafeCSV(entries: FailSafeEntry[]): void {
  const csv = failSafeToCSV(entries);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  downloadBlob(csv, `ameghino_failsafe_${ts}.csv`, "text/csv;charset=utf-8");
}

/**
 * Exporta la bitácora de fail-safe como JSON descargable.
 */
export function exportFailSafeJSON(entries: FailSafeEntry[]): void {
  const json = JSON.stringify(
    { schema: "ameghino.failsafe.v1", exported_at: new Date().toISOString(), entries },
    null,
    2,
  );
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  downloadBlob(json, `ameghino_failsafe_${ts}.json`, "application/json");
}

/**
 * Exporta un snapshot completo del simulador como JSON descargable.
 */
export function exportSnapshotJSON(snap: Snapshot): void {
  const json = JSON.stringify(
    {
      schema: "ameghino.snapshot.v1",
      exported_at: new Date().toISOString(),
      intersection_id: "AR-BA-3F-0142",
      snapshot: snap,
    },
    null,
    2,
  );
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  downloadBlob(json, `ameghino_snapshot_${ts}.json`, "application/json");
}

/**
 * Exporta resultados de comparación dual como CSV.
 */
export function exportDualComparisonCSV(
  history: {
    hour: number;
    adaptiveWait: number;
    fixedWait: number;
    adaptiveQueue: number;
    fixedQueue: number;
  }[],
): void {
  if (history.length === 0) return;
  const headers = [
    "hour",
    "adaptive_wait_s",
    "fixed_wait_s",
    "adaptive_queue",
    "fixed_queue",
    "improvement_pct",
  ];
  const headerLine = headers.join(";");
  const lines = history.map((h) => {
    const improv =
      h.fixedWait > 0 ? Math.round(((h.fixedWait - h.adaptiveWait) / h.fixedWait) * 100) : 0;
    return [
      escapeCSV(h.hour.toFixed(2)),
      escapeCSV(h.adaptiveWait.toFixed(2)),
      escapeCSV(h.fixedWait.toFixed(2)),
      escapeCSV(h.adaptiveQueue),
      escapeCSV(h.fixedQueue),
      escapeCSV(improv),
    ].join(";");
  });
  const csv = "\uFEFF" + [headerLine, ...lines].join("\r\n");
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  downloadBlob(csv, `ameghino_dual_${ts}.csv`, "text/csv;charset=utf-8");
}
