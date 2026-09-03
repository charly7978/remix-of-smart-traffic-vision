/**
 * Store centralizado de datos municipales para el Sistema Ameghino AI.
 *
 * Persiste en localStorage los perfiles de flujo vehicular subidos por el
 * municipio, los eventos registrados manualmente, la configuración de cámaras
 * IP y el historial de activaciones fail-safe.
 *
 * Patrón: Módulo singleton con suscripciones reactivas (observer) para que
 * los componentes React se actualicen al cambiar el store.
 */

import type { ScenarioEvent, EventType } from "./engine";

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export interface FlowProfile {
  id: string;
  name: string;
  /** 24 valores: veh/h para cada hora del día (00-23) */
  profile: number[];
  uploadedAt: string;
  source: "csv" | "manual";
}

export interface CameraConfig {
  id: string;
  label: string;
  /** Acceso asignado: N / S / E / W */
  approach: "N" | "S" | "E" | "W";
  /** Tipo de fuente */
  kind: "snapshot-http" | "rtsp-webrtc" | "webcam";
  /** URL del endpoint (snapshot o RTSP) */
  url: string;
  /** Intervalo de captura en ms (solo snapshot) */
  refreshMs: number;
  /** Última conexión exitosa (ISO string) */
  lastConnected: string | null;
  /** Activa / inactiva */
  enabled: boolean;
}

export interface FailSafeEntry {
  id: string;
  timestamp: string;
  hour: number;
  reason: string;
  duration: number | null;
  resolved: boolean;
  source: "simulation" | "real";
}

export interface MunicipalDataStore {
  flowProfiles: FlowProfile[];
  realEvents: ScenarioEvent[];
  cameras: CameraConfig[];
  failSafeLog: FailSafeEntry[];
}

/* ------------------------------------------------------------------ */
/* Constantes                                                          */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "ameghino_municipal_data";

const EMPTY_STORE: MunicipalDataStore = {
  flowProfiles: [],
  realEvents: [],
  cameras: [],
  failSafeLog: [],
};

/* ------------------------------------------------------------------ */
/* Store singleton                                                     */
/* ------------------------------------------------------------------ */

type Listener = () => void;

let store: MunicipalDataStore = loadFromStorage();
const listeners = new Set<Listener>();

function loadFromStorage(): MunicipalDataStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_STORE };
    const parsed = JSON.parse(raw) as MunicipalDataStore;
    return {
      flowProfiles: Array.isArray(parsed.flowProfiles) ? parsed.flowProfiles : [],
      realEvents: Array.isArray(parsed.realEvents) ? parsed.realEvents : [],
      cameras: Array.isArray(parsed.cameras) ? parsed.cameras : [],
      failSafeLog: Array.isArray(parsed.failSafeLog) ? parsed.failSafeLog : [],
    };
  } catch {
    return { ...EMPTY_STORE };
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota exceeded — ignora silenciosamente */
  }
}

function notify(): void {
  for (const fn of listeners) fn();
}

/* ------------------------------------------------------------------ */
/* API pública                                                         */
/* ------------------------------------------------------------------ */

export function getStore(): MunicipalDataStore {
  return store;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ---------- Flow Profiles ---------- */

export function addFlowProfile(profile: FlowProfile): void {
  store = { ...store, flowProfiles: [profile, ...store.flowProfiles].slice(0, 20) };
  persist();
  notify();
}

export function removeFlowProfile(id: string): void {
  store = { ...store, flowProfiles: store.flowProfiles.filter((p) => p.id !== id) };
  persist();
  notify();
}

/* ---------- Real Events ---------- */

export function addRealEvent(ev: ScenarioEvent): void {
  store = { ...store, realEvents: [...store.realEvents, ev] };
  persist();
  notify();
}

export function removeRealEvent(id: string): void {
  store = { ...store, realEvents: store.realEvents.filter((e) => e.id !== id) };
  persist();
  notify();
}

export function clearRealEvents(): void {
  store = { ...store, realEvents: [] };
  persist();
  notify();
}

/* ---------- Cameras ---------- */

export function upsertCamera(cam: CameraConfig): void {
  const idx = store.cameras.findIndex((c) => c.id === cam.id);
  const cameras = [...store.cameras];
  if (idx >= 0) {
    cameras[idx] = cam;
  } else {
    cameras.push(cam);
  }
  store = { ...store, cameras };
  persist();
  notify();
}

export function removeCamera(id: string): void {
  store = { ...store, cameras: store.cameras.filter((c) => c.id !== id) };
  persist();
  notify();
}

export function updateCameraLastConnected(id: string): void {
  const cameras = store.cameras.map((c) =>
    c.id === id ? { ...c, lastConnected: new Date().toISOString() } : c,
  );
  store = { ...store, cameras };
  persist();
  notify();
}

/* ---------- Fail-Safe Log ---------- */

export function addFailSafeEntry(entry: FailSafeEntry): void {
  store = { ...store, failSafeLog: [entry, ...store.failSafeLog].slice(0, 500) };
  persist();
  notify();
}

export function clearFailSafeLog(): void {
  store = { ...store, failSafeLog: [] };
  persist();
  notify();
}

/* ---------- CSV Parser ---------- */

/**
 * Parsea un CSV de aforo vehicular. Formato esperado:
 *   hora;veh_h   o   hora,veh_h
 *
 * Retorna un array de 24 valores (veh/h por hora 0-23).
 * Lanza error descriptivo si el formato es inválido.
 */
export function parseFlowCsv(raw: string): number[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error("El archivo debe tener al menos 2 líneas (encabezado + datos).");
  }

  /* Detectar separador */
  const sep = lines[0]!.includes(";") ? ";" : ",";

  /* Saltar encabezado si parece texto */
  const startIdx = /^[a-zA-Z]/.test(lines[0]!.split(sep)[0]!.trim()) ? 1 : 0;

  const profile: number[] = new Array(24).fill(0);
  let parsed = 0;

  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i]!.split(sep).map((s) => s.trim());
    if (parts.length < 2) continue;

    const hour = parseInt(parts[0]!, 10);
    const value = parseFloat(parts[1]!.replace(",", "."));

    if (isNaN(hour) || hour < 0 || hour > 23) {
      throw new Error(`Línea ${i + 1}: hora inválida "${parts[0]}". Debe ser 0-23.`);
    }
    if (isNaN(value) || value < 0 || value > 5000) {
      throw new Error(
        `Línea ${i + 1}: valor de flujo inválido "${parts[1]}". Debe ser 0-5000 veh/h.`,
      );
    }

    profile[hour] = Math.round(value);
    parsed++;
  }

  if (parsed < 12) {
    throw new Error(
      `Solo se encontraron ${parsed} horas válidas. Se requieren al menos 12 de 24 para un perfil útil.`,
    );
  }

  return profile;
}

/**
 * Genera un ID único corto para entidades del store.
 */
export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
