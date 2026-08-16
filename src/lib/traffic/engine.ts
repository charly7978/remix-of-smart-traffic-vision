/**
 * Motor de simulación del Sistema Ameghino AI.
 * Intersección de 4 accesos con controlador adaptativo por visión artificial.
 *
 * Reglas implementadas:
 * - T_v = max(T_seg, min(T_max, β · σ))
 * - Perfil horario de demanda (veh/h) editable por escenario
 * - Condiciones ambientales (lluvia / niebla) que degradan la percepción
 * - Eventos programados (falla de cámara, clima, emergencia) sobre la línea de tiempo
 * - Fail-safe: sin percepción confiable, el controlador vuelve a ciclo fijo pregrabado
 * - Línea base analítica (demora de Webster) para comparar contra el ciclo fijo
 */

export type Axis = "NS" | "EW";
export type Approach = "N" | "S" | "E" | "W";
export type VehicleKind = "car" | "truck" | "moto" | "ambulance" | "bus";
export type LightPhase = "green" | "amber" | "allred";
export type Weather = "clear" | "rain" | "fog";

export type EventType =
  "camera_fail" | "camera_restore" | "weather_clear" | "weather_rain" | "weather_fog" | "emergency";

export interface ScenarioEvent {
  id: string;
  /** hora del día (0-23.75) en la que se dispara */
  hour: number;
  type: EventType;
}

export const EVENT_LABEL_ES: Record<EventType, string> = {
  camera_fail: "Falla de cámara",
  camera_restore: "Cámara restablecida",
  weather_clear: "Clima despejado",
  weather_rain: "Lluvia",
  weather_fog: "Niebla",
  emergency: "Vehículo de emergencia",
};

export const WEATHER_LABEL_ES: Record<Weather, string> = {
  clear: "Despejado",
  rain: "Lluvia",
  fog: "Niebla",
};

export const WORLD = {
  size: 800,
  center: 400,
  stop: 286,
  clear: 520,
  zoneMin: 90,
  despawn: 900,
  laneOffset: 45,
} as const;

export interface Vehicle {
  id: number;
  approach: Approach;
  kind: VehicleKind;
  p: number;
  speed: number;
  maxSpeed: number;
  wait: number;
  crossed: boolean;
  color: string;
  length: number;
  width: number;
  /** confianza de la IA; undefined = todavía no detectado */
  conf?: number;
  /** true si la IA no logró clasificarlo (baja visibilidad) */
  missed?: boolean;
}

export interface Detection {
  id: number;
  kind: VehicleKind;
  approach: Approach;
  confidence: number;
  t: number;
  hour: number;
}

export interface LogEntry {
  id: number;
  hour: number;
  text: string;
  tone: "info" | "warn" | "danger" | "ok";
}

export interface HistoryPoint {
  hour: number;
  adaptive: number;
  fixed: number;
  flow: number;
  queue: number;
}

/** Decisión razonada del agente (nivel VLM + validador determinista) */
export interface AgentDecision {
  id: number;
  hour: number;
  axis: Axis;
  seconds: number;
  action: string;
  rationale: string;
  confidence: number;
  latencyMs: number;
  source: "vlm" | "detector" | "failsafe" | "emergency";
  /** evidencia exacta que disparó el razonamiento */
  evidence: Evidence;
  /** contrato JSON publicado al controlador */
  contract: DecisionContract;
}

/* ------------------------------------------------------------------ */
/* Parámetros de prioridad (auditables y contrafactuales)              */
/* ------------------------------------------------------------------ */

export interface PriorityConfig {
  /** segundos de verde por objeto válido detectado (β) */
  beta: number;
  /** verde mínimo de seguridad (T_seg) */
  tSeg: number;
  /** verde máximo por fase (T_max) */
  tMax: number;
  /** peso de la espera peatonal: acorta el verde vehicular */
  pedWeight: number;
  /** techo de verde vehicular si espera una persona con movilidad reducida */
  reducedCap: number;
  /** verde mínimo garantizado al corredor de emergencia */
  emergencyMin: number;
  /** margen de frenado agregado con calzada mojada o niebla */
  weatherMargin: number;
  /** tasa de clasificación mínima para confiar en la percepción */
  visibilityFloor: number;
}

export const DEFAULT_PRIORITY: PriorityConfig = {
  beta: 2.4,
  tSeg: 8,
  tMax: 42,
  pedWeight: 1,
  reducedCap: 16,
  emergencyMin: 14,
  weatherMargin: 2,
  visibilityFloor: 0.55,
};

export const PRIORITY_FIELDS: {
  key: keyof PriorityConfig;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}[] = [
  {
    key: "pedWeight",
    label: "Prioridad peatonal",
    hint: "Cuánto acorta el verde vehicular cada persona esperando en la senda.",
    min: 0,
    max: 3,
    step: 0.1,
    unit: "×",
  },
  {
    key: "reducedCap",
    label: "Techo con movilidad reducida",
    hint: "Verde vehicular máximo cuando espera una persona con movilidad reducida.",
    min: 8,
    max: 30,
    step: 1,
    unit: "s",
  },
  {
    key: "emergencyMin",
    label: "Corredor de emergencia",
    hint: "Verde mínimo garantizado al eje por el que circula la ambulancia.",
    min: 8,
    max: 30,
    step: 1,
    unit: "s",
  },
  {
    key: "weatherMargin",
    label: "Sensibilidad al clima",
    hint: "Segundos extra de frenado con calzada mojada o niebla.",
    min: 0,
    max: 8,
    step: 0.5,
    unit: "s",
  },
  {
    key: "visibilityFloor",
    label: "Umbral de visibilidad",
    hint: "Tasa de clasificación por debajo de la cual el sistema deja de confiar en sí mismo.",
    min: 0.3,
    max: 0.85,
    step: 0.01,
    unit: "",
  },
  {
    key: "beta",
    label: "Ganancia β",
    hint: "Segundos de verde asignados por cada objeto válido en cola.",
    min: 1,
    max: 5,
    step: 0.1,
    unit: "s/obj",
  },
];

/** Evidencia observada en el borde en el instante de decidir */
export interface Evidence {
  hour: number;
  axis: Axis;
  sigma: number;
  sigmaOther: number;
  queue: number;
  missed: number;
  pedWaiting: number;
  pedWaitingOther: number;
  reducedWaiting: boolean;
  weather: Weather;
  visibility: number;
  detectionRate: number;
  night: boolean;
  cameraOffline: boolean;
  emergencyApproach: Approach | null;
  demand: number;
}

export interface DecisionContract {
  schema: "ameghino.decision.v1";
  intersection_id: string;
  local_time: string;
  phase_request: {
    axis: Axis;
    green_s: number;
    min_green_s: number;
    amber_s: number;
    all_red_s: number;
  };
  evidence: Evidence;
  priority_profile: PriorityConfig;
  model: {
    perception: string;
    reasoner: string;
    latency_ms: number;
  };
  confidence: number;
  source: AgentDecision["source"];
  rationale: string;
  validator: {
    min_green_ok: boolean;
    max_green_ok: boolean;
    conflicting_green: boolean;
    interlock: "hardware+software";
    accepted: boolean;
  };
  human_in_the_loop: false;
}

export interface DecisionResult {
  axis: Axis;
  seconds: number;
  source: AgentDecision["source"];
  confidence: number;
  rationale: string;
  action: string;
  latencyMs: number;
  contract: DecisionContract;
}

export interface Pedestrian {
  id: number;
  /** calzada que cruza: "NS" = cruza la avenida Norte–Sur */
  crossAxis: Axis;
  /** lado del cruce (-1 / 1) para ubicar la senda */
  side: -1 | 1;
  /** progreso 0..1 sobre la senda */
  p: number;
  speed: number;
  waiting: boolean;
  wait: number;
  /** peatón con movilidad reducida: requiere verde extendido */
  reduced: boolean;
}

export interface Snapshot {
  time: number;
  hour: number;
  axis: Axis;
  phase: LightPhase;
  greenAssigned: number;
  greenRemaining: number;
  tv: Record<Axis, number>;
  nsZone: number;
  ewZone: number;
  nsQueue: number;
  ewQueue: number;
  waiting: number;
  passed: number;
  avgWait: number;
  recentWait: number;
  fixedWait: number;
  reduction: number;
  co2SavedKg: number;
  fuelSavedL: number;
  demand: number;
  night: boolean;
  weather: Weather;
  visibility: number;
  detectionRate: number;
  cameraOffline: boolean;
  failSafe: boolean;
  failSafeReason: string | null;
  emergency: boolean;
  detections: Detection[];
  log: LogEntry[];
  history: HistoryPoint[];
  decisions: AgentDecision[];
  pedWaiting: number;
  pedCrossing: number;
  config: PriorityConfig;
  evidence: Evidence;
  autonomousDecisions: number;
  humanInterventions: number;
}

const KIND_LABEL: Record<VehicleKind, string> = {
  car: "auto",
  truck: "camión",
  moto: "moto",
  ambulance: "ambulancia",
  bus: "colectivo",
};

export const KIND_LABEL_ES = KIND_LABEL;

export const APPROACH_LABEL_ES: Record<Approach, string> = {
  N: "Norte",
  S: "Sur",
  E: "Este",
  W: "Oeste",
};

const CAR_COLORS = ["#5b8def", "#94a3b8", "#e2b13c", "#7c6ff0", "#3fae8a", "#d96a5f", "#cfd8e3"];

/** Perfil horario por defecto: aforo tipo de una avenida secundaria del Conurbano (veh/h) */
export const DEFAULT_FLOW: number[] = [
  180, 120, 90, 80, 110, 240, 620, 1180, 1620, 1350, 1080, 1020, 1140, 1080, 1010, 1120, 1380, 1720,
  1880, 1520, 1080, 760, 480, 280,
];

export const DEFAULT_EVENTS: ScenarioEvent[] = [
  { id: "e1", hour: 5, type: "weather_fog" },
  { id: "e2", hour: 8, type: "weather_clear" },
  { id: "e3", hour: 13, type: "camera_fail" },
  { id: "e4", hour: 15, type: "camera_restore" },
  { id: "e5", hour: 18, type: "weather_rain" },
];

const AMBER_TIME = 3;
const ALL_RED_TIME = 1.2;
const FIXED_CYCLE_GREEN = 22;

const PERCEPTION_MODEL = "YOLOv11-s TensorRT INT8 @ Jetson Orin Nano";
const REASONER_MODEL = "Qwen2.5-VL-3B INT4 (borde) + validador determinista";

/** capacidad práctica de la intersección (veh/h, ambos ejes) */
const CAPACITY = 3200;

const WEATHER_SPEED: Record<Weather, number> = { clear: 1, rain: 0.86, fog: 0.68 };
const WEATHER_VISIBILITY: Record<Weather, number> = { clear: 1, rain: 0.82, fog: 0.46 };

export function axisOf(a: Approach): Axis {
  return a === "N" || a === "S" ? "NS" : "EW";
}

function opposite(ax: Axis): Axis {
  return ax === "NS" ? "EW" : "NS";
}

/** Demora media por vehículo de un ciclo fijo (Webster, término uniforme + sobresaturación) */
export function fixedCycleDelay(flowVehH: number): number {
  const C = 90;
  const lambda = 0.42;
  const x = Math.min(0.98, Math.max(0.02, flowVehH / CAPACITY));
  const uniform = (C * Math.pow(1 - lambda, 2)) / (2 * (1 - lambda * x));
  const overflow = 26 * Math.pow(x, 8);
  return uniform + overflow;
}

const APPROACHES: Approach[] = ["N", "S", "E", "W"];

function clockLabel(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  const s = Math.floor((((hour % 1) * 60) % 1) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const AXIS_LABEL: Record<Axis, string> = { NS: "Norte–Sur", EW: "Este–Oeste" };

/**
 * Núcleo de decisión, puro y determinista respecto de (evidencia, perfil de prioridades).
 * Se usa tanto en vivo como para las comparaciones contrafactuales de la auditoría.
 */
export function decide(ev: Evidence, cfg: PriorityConfig): DecisionResult {
  const ax = ev.axis;
  const other = ax === "NS" ? "EW" : "NS";
  const axLabel = AXIS_LABEL[ax];
  const otherLabel = AXIS_LABEL[other as Axis];
  const failSafe = ev.cameraOffline || ev.detectionRate < cfg.visibilityFloor;

  let g: number;
  let source: AgentDecision["source"] = "vlm";
  let confidence: number;
  let rationale: string;

  if (failSafe) {
    g = FIXED_CYCLE_GREEN;
    source = "failsafe";
    confidence = 1;
    rationale = ev.cameraOffline
      ? "Sin señal de video verificable. El validador bloquea toda decisión de la IA y ejecuta el plan fijo pregrabado de 22 s por eje."
      : `La tasa de clasificación (${(ev.detectionRate * 100).toFixed(0)}%) cayó por debajo del umbral configurado (${(cfg.visibilityFloor * 100).toFixed(0)}%). Se descarta la percepción y se ejecuta el plan fijo pregrabado.`;
  } else {
    g = Math.min(cfg.tMax, Math.max(cfg.tSeg, 4 + cfg.beta * ev.sigma));
    if (ev.weather !== "clear") g += cfg.weatherMargin;
    if (ev.pedWaitingOther > 0 && cfg.pedWeight > 0) {
      g = Math.max(cfg.tSeg, g - ev.pedWaitingOther * cfg.pedWeight * 2);
    }
    if (ev.reducedWaiting) g = Math.min(g, cfg.reducedCap);
    confidence = Math.min(0.98, 0.6 + ev.visibility * 0.38);

    if (ev.night && ev.sigma <= 2) {
      rationale = `Madrugada: sólo ${ev.sigma} vehículo(s) sobre ${axLabel} y cruce despejado. Se libera el verde de inmediato para no dejar al conductor detenido y expuesto.`;
    } else if (ev.reducedWaiting) {
      rationale = `Peatón con movilidad reducida esperando en la senda de ${otherLabel}. El verde de ${axLabel} se acota a ${g.toFixed(0)} s (techo configurado ${cfg.reducedCap} s) para habilitar el cruce con tiempo extendido.`;
    } else if (ev.sigma >= 10) {
      rationale = `Cola saturada en ${axLabel} (σ=${ev.sigma} objetos válidos) contra ${ev.sigmaOther} en ${otherLabel}. Se extiende el verde a ${g.toFixed(0)} s, con techo T_max de ${cfg.tMax} s.`;
    } else if (ev.pedWaitingOther > 0) {
      rationale = `${ev.pedWaitingOther} peatón(es) en espera sobre ${otherLabel}, con peso de prioridad ${cfg.pedWeight.toFixed(1)}×. Verde de ${axLabel} dimensionado en ${g.toFixed(0)} s: se atiende la cola sin castigar el cruce peatonal.`;
    } else if (ev.weather !== "clear") {
      rationale = `Calzada con ${WEATHER_LABEL_ES[ev.weather].toLowerCase()}: σ=${ev.sigma} con confianza degradada. Se agrega margen de frenado de ${cfg.weatherMargin} s y se asignan ${g.toFixed(0)} s de verde a ${axLabel}.`;
    } else {
      rationale = `Demanda equilibrada: σ=${ev.sigma} en ${axLabel} contra ${ev.sigmaOther} en ${otherLabel}. Verde proporcional de ${g.toFixed(0)} s según T_v = max(T_seg, min(T_max, β·σ)) con β=${cfg.beta.toFixed(1)}.`;
    }
  }

  if (ev.emergencyApproach && axisOf(ev.emergencyApproach) === ax) {
    g = Math.max(g, cfg.emergencyMin);
    source = "emergency";
    confidence = 0.99;
    rationale = `Vehículo de emergencia identificado en el acceso ${APPROACH_LABEL_ES[ev.emergencyApproach]} (silueta + baliza). Se abre corredor prioritario sobre ${axLabel} y se sostiene el verde ${g.toFixed(0)} s hasta liberar la intersección.`;
  }

  g = Math.round(g * 10) / 10;
  const latencyMs = Math.round(42 + (ev.weather === "clear" ? 0 : 14) + (1 - ev.visibility) * 30);

  const contract: DecisionContract = {
    schema: "ameghino.decision.v1",
    intersection_id: "AR-BA-3F-0142",
    local_time: clockLabel(ev.hour),
    phase_request: {
      axis: ax,
      green_s: g,
      min_green_s: cfg.tSeg,
      amber_s: AMBER_TIME,
      all_red_s: ALL_RED_TIME,
    },
    evidence: ev,
    priority_profile: cfg,
    model: {
      perception: PERCEPTION_MODEL,
      reasoner: source === "failsafe" ? "descartado (fail-safe)" : REASONER_MODEL,
      latency_ms: latencyMs,
    },
    confidence,
    source,
    rationale,
    validator: {
      min_green_ok: g >= cfg.tSeg,
      max_green_ok: g <= cfg.tMax + cfg.weatherMargin,
      conflicting_green: false,
      interlock: "hardware+software",
      accepted: true,
    },
    human_in_the_loop: false,
  };

  return {
    axis: ax,
    seconds: g,
    source,
    confidence,
    rationale,
    action: `VERDE ${ax === "NS" ? "N–S" : "E–O"} · ${g.toFixed(0)} s`,
    latencyMs,
    contract,
  };
}

export class TrafficEngine {
  vehicles: Vehicle[] = [];
  pedestrians: Pedestrian[] = [];
  decisions: AgentDecision[] = [];
  config: PriorityConfig = { ...DEFAULT_PRIORITY };
  /** decisiones tomadas sin intervención humana */
  autonomousDecisions = 0;
  /** intervenciones humanas sobre el plan semafórico */
  humanInterventions = 0;
  detections: Detection[] = [];
  log: LogEntry[] = [];
  history: HistoryPoint[] = [];
  time = 0;
  /** hora del día simulada (0-24) */
  hour = 7;
  /** minutos simulados por segundo real */
  minutesPerSecond = 3;
  clockRunning = true;
  flowByHour: number[] = [...DEFAULT_FLOW];
  events: ScenarioEvent[] = [...DEFAULT_EVENTS];
  /** proporción de la demanda que circula por el eje Norte–Sur */
  nsShare = 0.58;
  weather: Weather = "clear";
  axis: Axis = "NS";
  phase: LightPhase = "green";
  phaseTimer = 14;
  phaseElapsed = 0;
  greenAssigned = 14;
  tv: Record<Axis, number> = { NS: 14, EW: 14 };
  cameraOffline = false;
  emergencyApproach: Approach | null = null;
  passed = 0;
  totalWait = 0;
  recentWaits: number[] = [];
  detectedCount = 0;
  missedCount = 0;

  private spawnAcc = 0;
  private feedTimer = 0;
  private histTimer = 0;
  private detectedIds = new Set<number>();
  private firedEvents = new Set<string>();
  private nextId = 1;
  private nextLogId = 1;
  private nextPedId = 1;
  private nextDecisionId = 1;
  private pedTimer = 0;

  // ---------- configuración de escenario ----------

  setHour(h: number) {
    this.hour = Math.max(0, Math.min(23.99, h));
    this.firedEvents.clear();
  }

  setClockRunning(v: boolean) {
    this.clockRunning = v;
  }

  setMinutesPerSecond(v: number) {
    this.minutesPerSecond = Math.max(0.5, Math.min(30, v));
  }

  setFlowAt(hour: number, value: number) {
    const i = Math.max(0, Math.min(23, Math.round(hour)));
    this.flowByHour[i] = Math.max(0, Math.min(3000, Math.round(value)));
  }

  setFlowProfile(profile: number[]) {
    if (profile.length === 24) this.flowByHour = [...profile];
  }

  setNsShare(v: number) {
    this.nsShare = Math.max(0.1, Math.min(0.9, v));
  }

  setWeather(w: Weather, silent = false) {
    if (this.weather === w) return;
    this.weather = w;
    if (!silent) {
      this.pushLog(
        `Condición ambiental: ${WEATHER_LABEL_ES[w].toLowerCase()}`,
        w === "clear" ? "ok" : w === "rain" ? "warn" : "danger",
      );
    }
  }

  setEvents(events: ScenarioEvent[]) {
    this.events = [...events];
    this.firedEvents.clear();
  }

  setPriority(patch: Partial<PriorityConfig>) {
    this.config = { ...this.config, ...patch };
  }

  registerHumanIntervention() {
    this.humanInterventions += 1;
  }

  setCameraOffline(value: boolean) {
    if (this.cameraOffline === value) return;
    this.cameraOffline = value;
    if (value) {
      this.detections = [];
      this.pushLog("Pérdida de enlace con la cámara. Fail-safe: ciclo fijo pregrabado.", "danger");
    } else {
      this.pushLog("Enlace de video restablecido. Control adaptativo reactivado.", "ok");
    }
  }

  triggerEmergency() {
    if (this.emergencyApproach) return;
    const approach = APPROACHES[Math.floor(Math.random() * APPROACHES.length)]!;
    this.emergencyApproach = approach;
    this.spawnVehicle(approach, "ambulance", true);
    this.pushLog(
      `Corredor de emergencia solicitado desde el ${APPROACH_LABEL_ES[approach]}.`,
      "danger",
    );
  }

  // ---------- lecturas derivadas ----------

  get night(): boolean {
    return this.hour >= 20 || this.hour < 6;
  }

  get visibility(): number {
    const base = WEATHER_VISIBILITY[this.weather];
    return this.night ? base * 0.86 : base;
  }

  get demand(): number {
    return this.flowByHour[Math.floor(this.hour) % 24] ?? 0;
  }

  get failSafe(): boolean {
    return this.cameraOffline || this.detectionRate < this.config.visibilityFloor;
  }

  get failSafeReason(): string | null {
    if (this.cameraOffline) return "Sin señal de video";
    if (this.detectionRate < this.config.visibilityFloor) return "Percepción degradada por clima";
    return null;
  }

  get detectionRate(): number {
    const total = this.detectedCount + this.missedCount;
    if (this.cameraOffline) return 0;
    if (total < 4) return this.visibility;
    return this.detectedCount / total;
  }

  get recentWait(): number {
    if (this.recentWaits.length === 0) return 0;
    return this.recentWaits.reduce((a, b) => a + b, 0) / this.recentWaits.length;
  }

  zoneCount(ax: Axis): number {
    return this.vehicles.filter(
      (v) => !v.crossed && axisOf(v.approach) === ax && v.p > WORLD.zoneMin && v.p < WORLD.stop,
    ).length;
  }

  /** densidad percibida por la IA (excluye vehículos no clasificados) */
  perceivedCount(ax: Axis): number {
    return this.vehicles.filter(
      (v) =>
        !v.crossed &&
        !v.missed &&
        axisOf(v.approach) === ax &&
        v.p > WORLD.zoneMin &&
        v.p < WORLD.stop,
    ).length;
  }

  queueCount(ax: Axis): number {
    return this.vehicles.filter(
      (v) =>
        !v.crossed &&
        axisOf(v.approach) === ax &&
        v.p > WORLD.zoneMin &&
        v.p < WORLD.stop &&
        v.speed < 5,
    ).length;
  }

  signalFor(approach: Approach): "red" | "amber" | "green" {
    if (this.phase === "allred") return "red";
    if (axisOf(approach) === this.axis) return this.phase === "green" ? "green" : "amber";
    return "red";
  }

  // ---------- ciclo principal ----------

  update(dt: number) {
    this.time += dt;
    if (this.clockRunning) {
      const prev = this.hour;
      this.hour = (this.hour + (dt * this.minutesPerSecond) / 60) % 24;
      if (this.hour < prev) this.firedEvents.clear();
      this.runEvents(prev, this.hour);
    }

    const rate = this.demand / 3600;
    this.spawnAcc += dt * rate;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      const ns = Math.random() < this.nsShare;
      const pool: Approach[] = ns ? ["N", "S"] : ["E", "W"];
      this.spawnVehicle(pool[Math.floor(Math.random() * 2)]!);
    }

    this.moveVehicles(dt);
    this.movePedestrians(dt);
    this.updateController(dt);
    this.updateFeed(dt);
    this.updateHistory(dt);
  }

  // ---------- peatones ----------

  get pedWaiting(): number {
    return this.pedestrians.filter((p) => p.waiting).length;
  }

  get pedCrossing(): number {
    return this.pedestrians.filter((p) => !p.waiting).length;
  }

  pedWaitingOn(ax: Axis): number {
    return this.pedestrians.filter((p) => p.waiting && p.crossAxis === ax).length;
  }

  spawnPedestrian(crossAxis?: Axis) {
    const ax: Axis = crossAxis ?? (Math.random() < 0.5 ? "NS" : "EW");
    this.pedestrians.push({
      id: this.nextPedId++,
      crossAxis: ax,
      side: Math.random() < 0.5 ? -1 : 1,
      p: 0,
      speed: 0.16 + Math.random() * 0.07,
      waiting: true,
      wait: 0,
      reduced: Math.random() < 0.16,
    });
  }

  private movePedestrians(dt: number) {
    this.pedTimer += dt;
    const interval = this.night ? 9 : 3.4;
    if (this.pedTimer > interval) {
      this.pedTimer = 0;
      if (this.pedestrians.length < 10) this.spawnPedestrian();
    }
    for (const p of this.pedestrians) {
      const safe = this.phase === "green" && this.axis !== p.crossAxis;
      if (p.waiting) {
        p.wait += dt;
        if (safe) p.waiting = false;
      } else {
        p.p += (p.reduced ? p.speed * 0.62 : p.speed) * dt;
      }
    }
    this.pedestrians = this.pedestrians.filter((p) => p.p < 1.05);
  }

  private pushDecision(d: Omit<AgentDecision, "id" | "hour">) {
    this.decisions.unshift({ ...d, id: this.nextDecisionId++, hour: this.hour });
    if (this.decisions.length > 40) this.decisions.pop();
  }

  private runEvents(prevHour: number, nowHour: number) {
    for (const ev of this.events) {
      if (this.firedEvents.has(ev.id)) continue;
      const crossed = prevHour <= nowHour ? ev.hour > prevHour && ev.hour <= nowHour : false;
      if (!crossed) continue;
      this.firedEvents.add(ev.id);
      this.applyEvent(ev.type);
    }
  }

  applyEvent(type: EventType) {
    switch (type) {
      case "camera_fail":
        this.setCameraOffline(true);
        break;
      case "camera_restore":
        this.setCameraOffline(false);
        break;
      case "weather_clear":
        this.setWeather("clear");
        break;
      case "weather_rain":
        this.setWeather("rain");
        break;
      case "weather_fog":
        this.setWeather("fog");
        break;
      case "emergency":
        this.triggerEmergency();
        break;
    }
  }

  private pushLog(text: string, tone: LogEntry["tone"]) {
    this.log.unshift({ id: this.nextLogId++, hour: this.hour, text, tone });
    if (this.log.length > 40) this.log.pop();
  }

  private spawnVehicle(approach: Approach, kind?: VehicleKind, force = false) {
    if (!force && this.vehicles.some((v) => v.approach === approach && v.p < 90)) return;
    const k: VehicleKind =
      kind ??
      (() => {
        const r = Math.random();
        return r < 0.65 ? "car" : r < 0.78 ? "truck" : r < 0.9 ? "bus" : "moto";
      })();
    const spec = {
      car: { len: 30, w: 20, max: 100 },
      truck: { len: 46, w: 22, max: 78 },
      moto: { len: 18, w: 12, max: 120 },
      ambulance: { len: 36, w: 22, max: 135 },
      bus: { len: 52, w: 24, max: 70 },
    }[k]!;
    const wf = WEATHER_SPEED[this.weather];
    this.vehicles.push({
      id: this.nextId++,
      approach,
      kind: k,
      p: -spec.len,
      speed: spec.max * wf * 0.6,
      maxSpeed: spec.max * wf,
      wait: 0,
      crossed: false,
      color:
        k === "ambulance" ? "#f4f6f8" : CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]!,
      length: spec.len,
      width: spec.w,
    });
  }

  private mustStop(v: Vehicle): boolean {
    if (v.kind === "ambulance") return false;
    if (v.p > WORLD.stop) return false;
    const signal = this.signalFor(v.approach);
    if (signal === "green") return false;
    if (signal === "amber" && WORLD.stop - v.p < 50) return false;
    return true;
  }

  private moveVehicles(dt: number) {
    const byApproach = new Map<Approach, Vehicle[]>();
    for (const v of this.vehicles) {
      const arr = byApproach.get(v.approach) ?? [];
      arr.push(v);
      byApproach.set(v.approach, arr);
    }
    const grip = this.weather === "clear" ? 1 : this.weather === "rain" ? 0.82 : 0.7;
    for (const arr of byApproach.values()) {
      arr.sort((a, b) => b.p - a.p);
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i]!;
        const ahead = i > 0 ? arr[i - 1]! : null;
        let obstacle = Infinity;
        if (ahead) obstacle = ahead.p - ahead.length - 10 - v.p;
        if (this.mustStop(v)) obstacle = Math.min(obstacle, WORLD.stop - v.p);
        if (obstacle < 130) {
          v.speed = Math.min(v.speed, Math.max(0, (obstacle - 6) * 1.6));
          if (obstacle <= 8) v.speed = 0;
        } else {
          v.speed = Math.min(v.maxSpeed, v.speed + 110 * grip * dt);
        }
        v.p += v.speed * dt;
        if (v.speed < 3 && v.p > WORLD.zoneMin && !v.crossed) v.wait += dt;
        if (!v.crossed && v.p > WORLD.clear) {
          v.crossed = true;
          this.passed += 1;
          this.totalWait += v.wait;
          this.recentWaits.push(v.wait);
          if (this.recentWaits.length > 40) this.recentWaits.shift();
          if (v.kind === "ambulance" && this.emergencyApproach === v.approach) {
            this.emergencyApproach = null;
            this.pushLog("Ambulancia liberó la intersección. Ciclo normal restituido.", "ok");
          }
        }
      }
    }
    this.vehicles = this.vehicles.filter((v) => v.p < WORLD.despawn);
  }

  private updateController(dt: number) {
    this.phaseTimer -= dt;
    this.phaseElapsed += dt;
    const ambAxis = this.emergencyApproach ? axisOf(this.emergencyApproach) : null;

    if (this.phase === "green") {
      let endPhase = this.phaseTimer <= 0;
      if (ambAxis === this.axis) {
        if (this.phaseTimer < 8) this.phaseTimer = 8;
        endPhase = false;
      }
      if (ambAxis && ambAxis !== this.axis && this.phaseElapsed > 3) endPhase = true;
      if (this.night && !this.failSafe && this.phaseElapsed > 5) {
        if (this.perceivedCount(this.axis) === 0 && this.perceivedCount(opposite(this.axis)) > 0) {
          endPhase = true;
        }
      }
      if (endPhase) {
        this.phase = "amber";
        this.phaseTimer = AMBER_TIME;
        this.phaseElapsed = 0;
      }
    } else if (this.phase === "amber") {
      if (this.phaseTimer <= 0) {
        this.phase = "allred";
        this.phaseTimer = ALL_RED_TIME;
        this.phaseElapsed = 0;
      }
    } else if (this.phaseTimer <= 0) {
      this.axis = ambAxis ?? opposite(this.axis);
      this.assignGreen(this.axis);
      this.phase = "green";
      this.phaseTimer = this.greenAssigned;
      this.phaseElapsed = 0;
    }
  }

  /** T_v = max(T_seg, min(T_max, β · σ)) */
  private assignGreen(ax: Axis) {
    const evidence = this.buildEvidence(ax);
    const result = decide(evidence, this.config);
    this.greenAssigned = result.seconds;
    this.tv[ax] = result.seconds;
    this.autonomousDecisions += 1;
    this.pushDecision({
      axis: ax,
      seconds: result.seconds,
      action: result.action,
      rationale: result.rationale,
      confidence: result.confidence,
      latencyMs: result.latencyMs,
      source: result.source,
      evidence,
      contract: result.contract,
    });
  }

  /** Fotografía del estado observado por el borde en este instante */
  buildEvidence(ax: Axis = this.axis): Evidence {
    const other = opposite(ax);
    return {
      hour: this.hour,
      axis: ax,
      sigma: this.perceivedCount(ax),
      sigmaOther: this.perceivedCount(other),
      queue: this.queueCount(ax),
      missed: this.vehicles.filter((v) => v.missed && !v.crossed).length,
      pedWaiting: this.pedWaitingOn(ax),
      pedWaitingOther: this.pedWaitingOn(other),
      reducedWaiting: this.pedestrians.some((p) => p.waiting && p.reduced && p.crossAxis === other),
      weather: this.weather,
      visibility: this.visibility,
      detectionRate: this.detectionRate,
      night: this.night,
      cameraOffline: this.cameraOffline,
      emergencyApproach: this.emergencyApproach,
      demand: this.demand,
    };
  }

  private updateFeed(dt: number) {
    this.feedTimer += dt;
    if (this.feedTimer < 0.6) return;
    this.feedTimer = 0;
    if (this.cameraOffline) return;
    const vis = this.visibility;
    for (const v of this.vehicles) {
      if (v.crossed || this.detectedIds.has(v.id)) continue;
      if (v.p > WORLD.zoneMin && v.p < WORLD.stop) {
        this.detectedIds.add(v.id);
        const conf = Math.min(0.99, 0.55 + vis * (0.35 + Math.random() * 0.12));
        if (conf < 0.7) {
          v.missed = true;
          this.missedCount += 1;
          continue;
        }
        v.conf = conf;
        this.detectedCount += 1;
        this.detections.unshift({
          id: v.id,
          kind: v.kind,
          approach: v.approach,
          confidence: conf,
          t: this.time,
          hour: this.hour,
        });
        if (this.detections.length > 10) this.detections.pop();
      }
    }
  }

  private updateHistory(dt: number) {
    this.histTimer += dt;
    if (this.histTimer < 1.2) return;
    this.histTimer = 0;
    this.history.push({
      hour: this.hour,
      adaptive: this.recentWait,
      fixed: fixedCycleDelay(this.demand),
      flow: this.demand,
      queue: this.queueCount("NS") + this.queueCount("EW"),
    });
    if (this.history.length > 160) this.history.shift();
  }

  getSnapshot(): Snapshot {
    const avgWait = this.passed > 0 ? this.totalWait / this.passed : 0;
    const fixedWait = fixedCycleDelay(this.demand);
    const ref = this.recentWait > 0 ? this.recentWait : avgWait;
    const reduction =
      ref > 0 ? Math.max(0, Math.min(95, ((fixedWait - ref) / fixedWait) * 100)) : 0;
    const savedSeconds = Math.max(0, fixedWait - ref) * this.passed;
    const fuelSavedL = savedSeconds * 0.0006;
    const co2SavedKg = (savedSeconds * 2.3) / 1000;
    return {
      time: this.time,
      hour: this.hour,
      axis: this.axis,
      phase: this.phase,
      greenAssigned: this.greenAssigned,
      greenRemaining: Math.max(0, this.phaseTimer),
      tv: { ...this.tv },
      nsZone: this.zoneCount("NS"),
      ewZone: this.zoneCount("EW"),
      nsQueue: this.queueCount("NS"),
      ewQueue: this.queueCount("EW"),
      waiting: this.vehicles.filter((v) => !v.crossed && v.speed < 3 && v.p > WORLD.zoneMin).length,
      passed: this.passed,
      avgWait,
      recentWait: this.recentWait,
      fixedWait,
      reduction,
      co2SavedKg,
      fuelSavedL,
      demand: this.demand,
      night: this.night,
      weather: this.weather,
      visibility: this.visibility,
      detectionRate: this.detectionRate,
      cameraOffline: this.cameraOffline,
      failSafe: this.failSafe,
      failSafeReason: this.failSafeReason,
      emergency: this.emergencyApproach !== null,
      detections: [...this.detections],
      log: [...this.log],
      history: [...this.history],
      decisions: [...this.decisions],
      pedWaiting: this.pedWaiting,
      pedCrossing: this.pedCrossing,
      config: { ...this.config },
      evidence: this.buildEvidence(this.axis),
      autonomousDecisions: this.autonomousDecisions,
      humanInterventions: this.humanInterventions,
    };
  }
}
