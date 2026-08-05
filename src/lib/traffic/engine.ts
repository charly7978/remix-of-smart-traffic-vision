/**
 * Motor de simulación del Sistema Ameghino AI.
 * Modela una intersección de 4 accesos con un controlador de semáforo
 * adaptativo basado en densidad vehicular detectada por "visión artificial".
 *
 * Reglas implementadas del proyecto:
 * - T_v = max(T_seg, min(T_max, β · σ))  (tiempo de verde por densidad)
 * - Seguridad nocturna: eje sin demanda cede el verde al eje con vehículo único
 * - Corredor de emergencia: prioridad inmediata a ambulancias detectadas
 * - Fail-safe: sin cámara, el controlador vuelve a ciclos fijos pregrabados
 */

export type Axis = "NS" | "EW";
export type Approach = "N" | "S" | "E" | "W";
export type VehicleKind = "car" | "truck" | "moto" | "ambulance";
export type LightPhase = "green" | "amber" | "allred";

export const WORLD = {
  size: 800,
  center: 400,
  /** posición (px recorridos) donde el frente del vehículo se detiene */
  stop: 286,
  /** posición donde el vehículo se considera "cruzado" */
  clear: 520,
  /** inicio de la zona de detección de la cámara */
  zoneMin: 90,
  despawn: 900,
  laneOffset: 45,
} as const;

export interface Vehicle {
  id: number;
  approach: Approach;
  kind: VehicleKind;
  /** frente del vehículo, en px recorridos desde el borde del canvas */
  p: number;
  speed: number;
  maxSpeed: number;
  /** segundos acumulados detenido dentro de la zona de detección */
  wait: number;
  crossed: boolean;
  color: string;
  length: number;
  width: number;
  /** confianza asignada por la IA al detectarlo (0.9 - 0.99) */
  conf?: number;
}

export interface Detection {
  id: number;
  kind: VehicleKind;
  approach: Approach;
  confidence: number;
  t: number;
}

export interface Snapshot {
  time: number;
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
  reduction: number;
  co2SavedKg: number;
  night: boolean;
  cameraOffline: boolean;
  emergency: boolean;
  detections: Detection[];
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

/** tasa de aparición de vehículos por nivel de tráfico (0 bajo, 1 medio, 2 alto) */
const LEVEL_RATES = [0.35, 0.75, 1.25];

/** espera promedio estimada de un semáforo de ciclo fijo comparable */
const BASELINE_AVG_WAIT = 18;

const AMBER_TIME = 3;
const ALL_RED_TIME = 1.2;
const FIXED_CYCLE_GREEN = 22;
const BETA = 2.4;
const T_SEG = 8;
const T_MAX = 42;

export function axisOf(a: Approach): Axis {
  return a === "N" || a === "S" ? "NS" : "EW";
}

function opposite(ax: Axis): Axis {
  return ax === "NS" ? "EW" : "NS";
}

const APPROACHES: Approach[] = ["N", "S", "E", "W"];

export class TrafficEngine {
  vehicles: Vehicle[] = [];
  detections: Detection[] = [];
  time = 0;
  axis: Axis = "NS";
  phase: LightPhase = "green";
  phaseTimer = 14;
  phaseElapsed = 0;
  greenAssigned = 14;
  tv: Record<Axis, number> = { NS: 14, EW: 14 };
  level = 1;
  night = false;
  cameraOffline = false;
  emergencyApproach: Approach | null = null;
  passed = 0;
  totalWait = 0;
  private spawnAcc = 0;
  private feedTimer = 0;
  private detectedIds = new Set<number>();
  private nextId = 1;

  setLevel(level: number) {
    this.level = Math.min(2, Math.max(0, Math.round(level)));
  }

  setNight(value: boolean) {
    this.night = value;
  }

  setCameraOffline(value: boolean) {
    this.cameraOffline = value;
    if (value) this.detections = [];
  }

  triggerEmergency() {
    if (this.emergencyApproach) return;
    const approach = APPROACHES[Math.floor(Math.random() * APPROACHES.length)];
    this.emergencyApproach = approach;
    this.spawnVehicle(approach, "ambulance", true);
  }

  zoneCount(ax: Axis): number {
    return this.vehicles.filter(
      (v) => !v.crossed && axisOf(v.approach) === ax && v.p > WORLD.zoneMin && v.p < WORLD.stop,
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

  update(dt: number) {
    this.time += dt;
    this.spawnAcc += dt * LEVEL_RATES[this.level];
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      this.spawnVehicle(APPROACHES[Math.floor(Math.random() * APPROACHES.length)]);
    }
    this.moveVehicles(dt);
    this.updateController(dt);
    this.updateFeed(dt);
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
    }[k];
    this.vehicles.push({
      id: this.nextId++,
      approach,
      kind: k,
      p: -spec.len,
      speed: spec.max * 0.6,
      maxSpeed: spec.max,
      wait: 0,
      crossed: false,
      color:
        k === "ambulance" ? "#f4f6f8" : CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
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
    for (const arr of byApproach.values()) {
      arr.sort((a, b) => b.p - a.p);
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i];
        const ahead = i > 0 ? arr[i - 1] : null;
        let obstacle = Infinity;
        if (ahead) obstacle = ahead.p - ahead.length - 10 - v.p;
        if (this.mustStop(v)) obstacle = Math.min(obstacle, WORLD.stop - v.p);
        if (obstacle < 130) {
          v.speed = Math.min(v.speed, Math.max(0, (obstacle - 6) * 1.6));
          if (obstacle <= 8) v.speed = 0;
        } else {
          v.speed = Math.min(v.maxSpeed, v.speed + 110 * dt);
        }
        v.p += v.speed * dt;
        if (v.speed < 3 && v.p > WORLD.zoneMin && !v.crossed) v.wait += dt;
        if (!v.crossed && v.p > WORLD.clear) {
          v.crossed = true;
          this.passed += 1;
          this.totalWait += v.wait;
          if (v.kind === "ambulance" && this.emergencyApproach === v.approach) {
            this.emergencyApproach = null;
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
        // corredor de emergencia: sostener el verde hasta que cruce
        if (this.phaseTimer < 8) this.phaseTimer = 8;
        endPhase = false;
      }
      if (ambAxis && ambAxis !== this.axis && this.phaseElapsed > 3) endPhase = true;
      // seguridad nocturna: sin demanda en el eje verde, ceder al vehículo que espera
      if (this.night && !this.cameraOffline && this.phaseElapsed > 5) {
        if (this.zoneCount(this.axis) === 0 && this.zoneCount(opposite(this.axis)) > 0) {
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
    if (this.cameraOffline) {
      g = FIXED_CYCLE_GREEN;
    } else {
      const sigma = this.zoneCount(ax);
      g = Math.min(T_MAX, Math.max(T_SEG, 4 + BETA * sigma));
    }
    if (this.emergencyApproach && axisOf(this.emergencyApproach) === ax) g = Math.max(g, 14);
    this.greenAssigned = g;
    this.tv[ax] = g;
  }

  private updateFeed(dt: number) {
    this.feedTimer += dt;
    if (this.feedTimer < 0.7) return;
    this.feedTimer = 0;
    if (this.cameraOffline) return;
    for (const v of this.vehicles) {
      if (v.crossed || this.detectedIds.has(v.id)) continue;
      if (v.p > WORLD.zoneMin && v.p < WORLD.stop) {
        this.detectedIds.add(v.id);
        v.conf = Math.min(0.99, 0.9 + Math.random() * 0.09);
        this.detections.unshift({
          id: v.id,
          kind: v.kind,
          approach: v.approach,
          confidence: v.conf,
          t: this.time,
        });
        if (this.detections.length > 9) this.detections.pop();
      }
    }
  }

  getSnapshot(): Snapshot {
    const avgWait = this.passed > 0 ? this.totalWait / this.passed : 0;
    const reduction =
      this.passed > 0
        ? Math.max(0, Math.min(95, ((BASELINE_AVG_WAIT - avgWait) / BASELINE_AVG_WAIT) * 100))
        : 0;
    const co2SavedKg = Math.max(0, (BASELINE_AVG_WAIT - avgWait) * this.passed * 2.3) / 1000;
    return {
      time: this.time,
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
      reduction,
      co2SavedKg,
      night: this.night,
      cameraOffline: this.cameraOffline,
      emergency: this.emergencyApproach !== null,
      detections: [...this.detections],
    };
  }
}