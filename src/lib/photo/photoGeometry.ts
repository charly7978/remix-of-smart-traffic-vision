/**
 * Geometría y calibración fotogramétrica de alta precisión del cruce de Caseros.
 * Intersección de Av. San Martín y Urquiza (Partido de Tres de Febrero).
 *
 * Mapea el sistema de coordenadas del motor de simulación (p = 0..900) directamente
 * sobre las calzadas de asfalto, sendas peatonales y postes de vereda reales.
 */

import { type Approach } from "@/lib/traffic/engine";

export interface LaneCalibration {
  /** Puntos de control [p_motor, x_px, y_px] */
  ctrlPoints: [number, number, number][];
  /** Orientación base de avance en radianes */
  baseAngle: number;
}

/**
 * Calibración píxel a píxel sobre la imagen 1:1 de Caseros (800x800).
 * p = -60: Ingreso a la pantalla
 * p = 180: Aproximación a la esquina
 * p = 286: Línea de detención (WORLD.stop)
 * p = 400: Centro del cruce (WORLD.center)
 * p = 520: Egreso del cruce (WORLD.clear)
 * p = 900: Salida de la pantalla (WORLD.despawn)
 */
export const REAL_LANES: Record<Approach, LaneCalibration> = {
  // -------------------------------------------------------------
  // ACCESO N (Av. San Martín Noroeste -> Sudeste)
  // -------------------------------------------------------------
  N: {
    baseAngle: 0.66, // ~37.8°
    ctrlPoints: [
      [-60, 40, 220],
      [120, 160, 310],
      [286, 260, 385],
      [400, 360, 460],
      [520, 480, 550],
      [900, 770, 770],
    ],
  },
  // -------------------------------------------------------------
  // ACCESO S (Av. San Martín Sudeste -> Noroeste)
  // -------------------------------------------------------------
  S: {
    baseAngle: -2.48, // ~ -142.2°
    ctrlPoints: [
      [-60, 760, 730],
      [120, 640, 640],
      [286, 540, 565],
      [400, 440, 490],
      [520, 320, 400],
      [900, 30, 180],
    ],
  },
  // -------------------------------------------------------------
  // ACCESO W (Calle Urquiza Sudoeste -> Noreste)
  // -------------------------------------------------------------
  W: {
    baseAngle: -0.67, // ~ -38.4°
    ctrlPoints: [
      [-60, 70, 770],
      [120, 180, 680],
      [286, 290, 595],
      [400, 390, 515],
      [520, 510, 420],
      [900, 770, 210],
    ],
  },
  // -------------------------------------------------------------
  // ACCESO E (Calle Urquiza Noreste -> Sudoeste)
  // -------------------------------------------------------------
  E: {
    baseAngle: 2.47, // ~ 141.5°
    ctrlPoints: [
      [-60, 770, 250],
      [120, 660, 340],
      [286, 550, 430],
      [400, 450, 510],
      [520, 330, 605],
      [900, 40, 830],
    ],
  },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Obtiene la posición (x,y) exacta y el ángulo de rotación para un vehículo en la calzada */
export function getVehicleRealTransform(
  approach: Approach,
  p: number,
): { x: number; y: number; angle: number } {
  const lane = REAL_LANES[approach];
  const pts = lane.ctrlPoints;

  if (p <= pts[0]![0]) {
    return { x: pts[0]![1], y: pts[0]![2], angle: lane.baseAngle };
  }
  const last = pts[pts.length - 1]!;
  if (p >= last[0]) {
    return { x: last[1], y: last[2], angle: lane.baseAngle };
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (p >= a[0] && p <= b[0]) {
      const t = (p - a[0]) / (b[0] - a[0]);
      const x = lerp(a[1], b[1], t);
      const y = lerp(a[2], b[2], t);
      const dx = b[1] - a[1];
      const dy = b[2] - a[2];
      const angle = Math.atan2(dy, dx);
      return { x, y, angle };
    }
  }

  return { x: last[1], y: last[2], angle: lane.baseAngle };
}

/* ------------------------------------------------------------------ */
/* Sendas Peatonales Isométricas sobre el Cruce de Caseros             */
/* ------------------------------------------------------------------ */

export interface RealCrosswalk {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export const REAL_CROSSWALKS: Record<"NS" | "EW", [RealCrosswalk, RealCrosswalk]> = {
  // Cruces a lo largo de la Avenida San Martín
  NS: [
    { from: { x: 190, y: 320 }, to: { x: 290, y: 400 } }, // Senda Noroeste
    { from: { x: 510, y: 580 }, to: { x: 610, y: 500 } }, // Senda Sudeste
  ],
  // Cruces a lo largo de la Calle Urquiza
  EW: [
    { from: { x: 230, y: 580 }, to: { x: 330, y: 500 } }, // Senda Sudoeste
    { from: { x: 470, y: 320 }, to: { x: 570, y: 400 } }, // Senda Noreste
  ],
};

/** Calcula la posición en px de un peatón sobre su senda correspondiente */
export function getPedestrianRealPos(
  crossAxis: "NS" | "EW",
  side: -1 | 1,
  progress: number,
): { x: number; y: number } {
  const pair = REAL_CROSSWALKS[crossAxis];
  const cw = side === -1 ? pair[0]! : pair[1]!;
  const t = Math.max(0, Math.min(1, progress));
  return {
    x: lerp(cw.from.x, cw.to.x, t),
    y: lerp(cw.from.y, cw.to.y, t),
  };
}

/* ------------------------------------------------------------------ */
/* Postes de Semáforos Reales Anclados en Veredas                      */
/* ------------------------------------------------------------------ */

export interface RealSignalAnchor {
  approach: Approach;
  x: number;
  y: number;
  rot: number;
}

export const REAL_SIGNAL_ANCHORS: RealSignalAnchor[] = [
  // Semáforo Acceso Norte (Vereda Noroeste mirando a San Martín)
  { approach: "N", x: 230, y: 360, rot: 0.66 },
  // Semáforo Acceso Sur (Vereda Sudeste mirando a San Martín)
  { approach: "S", x: 570, y: 590, rot: -2.48 },
  // Semáforo Acceso Oeste (Vereda Sudoeste mirando a Urquiza)
  { approach: "W", x: 270, y: 590, rot: -0.67 },
  // Semáforo Acceso Este (Vereda Noreste mirando a Urquiza)
  { approach: "E", x: 570, y: 360, rot: 2.47 },
];
