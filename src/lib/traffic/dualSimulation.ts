/**
 * Motor de Simulación Dual para Ameghino AI.
 *
 * Ejecuta dos instancias de TrafficEngine en paralelo con los mismos datos
 * de entrada (perfil de flujo, eventos, hora de inicio, proporción N-S),
 * pero con controladores diferentes:
 *
 *  - Motor A (adaptativo): lógica completa de IA Ameghino con decide()
 *  - Motor B (ciclo fijo): verde fijo de 22s por eje, sin inteligencia
 *
 * Ambos motores reciben los mismos spawns de vehículos (semilla determinista)
 * para garantizar una comparación justa.
 */

import {
  TrafficEngine,
  type PriorityConfig,
  type ScenarioEvent,
  type Snapshot,
  DEFAULT_PRIORITY,
  DEFAULT_FLOW,
  fixedCycleDelay,
} from "./engine";

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export interface DualHistoryPoint {
  hour: number;
  adaptiveWait: number;
  fixedWait: number;
  adaptiveQueue: number;
  fixedQueue: number;
}

export interface DualSnapshot {
  adaptive: Snapshot;
  fixed: Snapshot;
  history: DualHistoryPoint[];
  elapsedSimHours: number;
  improvement: {
    waitPct: number;
    throughputPct: number;
    co2Pct: number;
  };
}

/* ------------------------------------------------------------------ */
/* Clase DualSimulation                                                 */
/* ------------------------------------------------------------------ */

/**
 * Simulación dual que ejecuta dos motores en paralelo.
 *
 * El motor "fixed" se configura con una subclase conceptual que ignora
 * la función decide() y siempre asigna verde fijo de 22s.
 */
export class DualSimulation {
  adaptiveEngine: TrafficEngine;
  fixedEngine: FixedCycleEngine;
  history: DualHistoryPoint[] = [];
  private histTimer = 0;
  private startHour: number;

  constructor(config?: {
    flowProfile?: number[];
    events?: ScenarioEvent[];
    startHour?: number;
    nsShare?: number;
    priority?: PriorityConfig;
    minutesPerSecond?: number;
  }) {
    const flow = config?.flowProfile ?? [...DEFAULT_FLOW];
    const events = config?.events ?? [];
    const hour = config?.startHour ?? 7;
    const ns = config?.nsShare ?? 0.58;
    const mps = config?.minutesPerSecond ?? 3;
    const priority = config?.priority ?? { ...DEFAULT_PRIORITY };

    this.startHour = hour;

    /* Motor adaptativo (lógica completa Ameghino AI) */
    this.adaptiveEngine = new TrafficEngine();
    this.adaptiveEngine.setFlowProfile(flow);
    this.adaptiveEngine.setEvents(events);
    this.adaptiveEngine.setHour(hour);
    this.adaptiveEngine.setNsShare(ns);
    this.adaptiveEngine.setMinutesPerSecond(mps);
    this.adaptiveEngine.setPriority(priority);

    /* Motor de ciclo fijo (22s por eje, sin adaptación) */
    this.fixedEngine = new FixedCycleEngine();
    this.fixedEngine.setFlowProfile(flow);
    this.fixedEngine.setEvents(events);
    this.fixedEngine.setHour(hour);
    this.fixedEngine.setNsShare(ns);
    this.fixedEngine.setMinutesPerSecond(mps);
  }

  /** Actualiza ambos motores con el mismo dt */
  update(dt: number): void {
    this.adaptiveEngine.update(dt);
    this.fixedEngine.update(dt);

    this.histTimer += dt;
    if (this.histTimer > 1.2) {
      this.histTimer = 0;
      this.history.push({
        hour: this.adaptiveEngine.hour,
        adaptiveWait: this.adaptiveEngine.recentWait,
        fixedWait: this.fixedEngine.recentWait,
        adaptiveQueue: this.adaptiveEngine.queueCount("NS") + this.adaptiveEngine.queueCount("EW"),
        fixedQueue: this.fixedEngine.queueCount("NS") + this.fixedEngine.queueCount("EW"),
      });
      if (this.history.length > 300) this.history.shift();
    }
  }

  /** Obtiene snapshot comparativo */
  getSnapshot(): DualSnapshot {
    const a = this.adaptiveEngine.getSnapshot();
    const f = this.fixedEngine.getSnapshot();

    const waitPct =
      f.recentWait > 0
        ? Math.max(0, Math.min(99, ((f.recentWait - a.recentWait) / f.recentWait) * 100))
        : 0;

    const throughputPct =
      f.passed > 0 ? Math.round(((a.passed - f.passed) / Math.max(1, f.passed)) * 100) : 0;

    const co2Pct =
      f.co2SavedKg > 0 ? Math.round((a.co2SavedKg / Math.max(0.01, f.co2SavedKg)) * 100) : 0;

    return {
      adaptive: a,
      fixed: f,
      history: [...this.history],
      elapsedSimHours: Math.abs(this.adaptiveEngine.hour - this.startHour),
      improvement: {
        waitPct: Math.round(waitPct * 10) / 10,
        throughputPct,
        co2Pct,
      },
    };
  }

  setMinutesPerSecond(v: number): void {
    this.adaptiveEngine.setMinutesPerSecond(v);
    this.fixedEngine.setMinutesPerSecond(v);
  }
}

/* ------------------------------------------------------------------ */
/* Motor de Ciclo Fijo                                                  */
/* ------------------------------------------------------------------ */

/**
 * Subclase de TrafficEngine que ignora la lógica de decide()
 * y siempre asigna verde fijo de 22s.
 */
class FixedCycleEngine extends TrafficEngine {
  /**
   * Override del método privado assignGreen.
   * Como assignGreen es privado en la clase padre, usamos un enfoque
   * de configuración: forzamos los parámetros para que el resultado
   * de decide() sea siempre ~22s (ciclo fijo estándar argentino).
   */
  constructor() {
    super();
    /*
     * Truco: configuramos beta=0, tSeg=22, tMax=22 para que la fórmula
     * T_v = max(tSeg, min(tMax, 4 + beta * sigma))
     * siempre devuelva max(22, min(22, 4 + 0*sigma)) = 22.
     *
     * Esto es equivalente a un ciclo fijo de 22s, pero usando la misma
     * infraestructura de decide() para generar contratos y logs
     * comparables con el motor adaptativo.
     */
    this.setPriority({
      beta: 0,
      tSeg: 22,
      tMax: 22,
      pedWeight: 0,
      reducedCap: 22,
      emergencyMin: 22,
      weatherMargin: 0,
      visibilityFloor: 0, // nunca entra en failSafe
    });
  }
}
