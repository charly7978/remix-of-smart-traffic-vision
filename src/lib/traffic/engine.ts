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
export type VehicleKind = "car" | "truck" | "moto" | "ambulance";
export type LightPhase = "green" | "amber" | "allred";
export type Weather = "clear" | "rain" | "fog";

export type EventType =
  | "camera_fail"
  | "camera_restore"
  | "weather_clear"
  | "weather_rain"
  | "weather_fog"
  | "emergency";

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
}

const KIND_LABEL: Record<VehicleKind, string> = {
  car: "auto",
  truck: "camión",
  moto: "moto",
  ambulance: "ambulancia",
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
  180, 120, 90, 80, 110, 240, 620, 1180, 1620, 1350, 1080, 1020, 1140, 1080, 1010, 1120, 1380,
  1720, 1880, 1520, 1080, 760, 480, 280,
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
const BETA = 2.4;
const T_SEG = 8;
const T_MAX = 42;

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

export class TrafficEngine {
  vehicles: Vehicle[] = [];
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
    this.pushLog(`Corredor de emergencia solicitado desde el ${APPROACH_LABEL_ES[approach]}.`, "danger");
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
    return this.cameraOffline || this.detectionRate < 0.55;
  }

  get failSafeReason(): string | null {
    if (this.cameraOffline) return "Sin señal de video";
    if (this.detectionRate < 0.55) return "Percepción degradada por clima";
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
    this.updateController(dt);
    this.updateFeed(dt);
    this.updateHistory(dt);
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
        return r < 0.72 ? "car" : r < 0.86 ? "truck" : "moto";
      })();
    const spec = {
      car: { len: 30, w: 20, max: 100 },
      truck: { len: 46, w: 22, max: 78 },
      moto: { len: 18, w: 12, max: 120 },
      ambulance: { len: 36, w: 22, max: 135 },
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
    let g: number;
    if (this.failSafe) {
      g = FIXED_CYCLE_GREEN;
    } else {
      const sigma = this.perceivedCount(ax);
      g = Math.min(T_MAX, Math.max(T_SEG, 4 + BETA * sigma));
      if (this.weather !== "clear") g += 2; // margen por frenado en calzada húmeda
    }
    if (this.emergencyApproach && axisOf(this.emergencyApproach) === ax) g = Math.max(g, 14);
    this.greenAssigned = g;
    this.tv[ax] = g;
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
    const reduction = ref > 0 ? Math.max(0, Math.min(95, ((fixedWait - ref) / fixedWait) * 100)) : 0;
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
    };
  }
}
