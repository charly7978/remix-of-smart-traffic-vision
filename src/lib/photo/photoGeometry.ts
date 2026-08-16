/**
 * Geometría y calibración fotogramétrica del cruce inteligente Ameghino.
 * Intersección de Av. San Martín y Urquiza (Caseros, Partido de Tres de Febrero).
 *
 * Mapea el sistema de coordenadas del TrafficEngine (p = 0..900) directamente
 * a las calzadas reales de la imagen 4K diurna/nocturna del distrito.
 */

import { type Approach } from "@/lib/traffic/engine";

export type ImgPoint = { u: number; v: number };

export const PHOTO_CONFIG = {
  canvasW: 800,
  canvasH: 800,
  bandTop: 0,
  naturalW: 1024,
  naturalH: 1024,
  center: { x: 400, y: 400 },
} as const;

/** Convierte coordenadas normalizadas (0..1) a píxeles del canvas */
export function imgPoint(u: number, v: number): { x: number; y: number } {
  return { x: u * PHOTO_CONFIG.canvasW, y: v * PHOTO_CONFIG.canvasH };
}

/* ------------------------------------------------------------------ */
/* Calibración de Carriles por Acceso (Trayectorias Diagonales Reales) */
/* ------------------------------------------------------------------ */

export interface LaneCalibration {
  /** Puntos clave [p_motor, x_px, y_px] */
  ctrlPoints: [number, number, number][];
  /** Orientación base en radianes */
  baseAngle: number;
}

/**
 * Trayectorias calibradas sobre la imagen isométrica 1:1 de Caseros.
 * p = 0: Ingreso a la pantalla
 * p = 286: Línea de detención (WORLD.stop)
 * p = 400: Centro de la intersección (WORLD.center)
 * p = 520: Egreso del cruce (WORLD.clear)
 * p = 900: Salida de la pantalla (WORLD.despawn)
 */
export const REAL_LANES: Record<Approach, LaneCalibration> = {
  // Acceso N: Viene del Noroeste (arriba-izquierda) hacia el Sudeste
  N: {
    baseAngle: Math.PI / 4, // 45°
    ctrlPoints: [
      [-60, 48, 48],
      [90, 160, 160],
      [286, 276, 276],
      [400, 368, 368],
      [520, 460, 460],
      [900, 740, 740],
    ],
  },
  // Acceso S: Viene del Sudeste (abajo-derecha) hacia el Noroeste
  S: {
    baseAngle: (-3 * Math.PI) / 4, // -135°
    ctrlPoints: [
      [-60, 752, 752],
      [90, 640, 640],
      [286, 524, 524],
      [400, 432, 432],
      [520, 340, 340],
      [900, 60, 60],
    ],
  },
  // Acceso W: Viene del Sudoeste (abajo-izquierda) hacia el Noreste
  W: {
    baseAngle: -Math.PI / 4, // -45°
    ctrlPoints: [
      [-60, 48, 752],
      [90, 160, 640],
      [286, 276, 524],
      [400, 368, 432],
      [520, 460, 340],
      [900, 740, 60],
    ],
  },
  // Acceso E: Viene del Noreste (arriba-derecha) hacia el Sudoeste
  E: {
    baseAngle: (3 * Math.PI) / 4, // 135°
    ctrlPoints: [
      [-60, 752, 48],
      [90, 640, 160],
      [286, 524, 276],
      [400, 432, 368],
      [520, 340, 460],
      [900, 60, 740],
    ],
  },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Obtiene la posición (x,y) exacta en píxeles y el ángulo de rotación para un vehículo */
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
/* Sendas Peatonales Isométricas sobre la Fotografía Real              */
/* ------------------------------------------------------------------ */

export interface RealCrosswalk {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export const REAL_CROSSWALKS: Record<"NS" | "EW", [RealCrosswalk, RealCrosswalk]> = {
  // Cruces a lo largo de la Avenida San Martín
  NS: [
    { from: { x: 230, y: 280 }, to: { x: 330, y: 180 } }, // Senda Noroeste
    { from: { x: 470, y: 620 }, to: { x: 570, y: 520 } }, // Senda Sudeste
  ],
  // Cruces a lo largo de la Calle Urquiza
  EW: [
    { from: { x: 230, y: 520 }, to: { x: 330, y: 620 } }, // Senda Sudoeste
    { from: { x: 470, y: 180 }, to: { x: 570, y: 280 } }, // Senda Noreste
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
  poleType: "overhead" | "pedestal";
}

export const REAL_SIGNAL_ANCHORS: RealSignalAnchor[] = [
  // Semáforo Acceso Norte (Vereda Oeste mirando a San Martín)
  { approach: "N", x: 245, y: 310, rot: Math.PI / 4, poleType: "overhead" },
  // Semáforo Acceso Sur (Vereda Este mirando a San Martín)
  { approach: "S", x: 555, y: 490, rot: (-3 * Math.PI) / 4, poleType: "overhead" },
  // Semáforo Acceso Oeste (Vereda Sur mirando a Urquiza)
  { approach: "W", x: 310, y: 555, rot: -Math.PI / 4, poleType: "overhead" },
  // Semáforo Acceso Este (Vereda Norte mirando a Urquiza)
  { approach: "E", x: 490, y: 245, rot: (3 * Math.PI) / 4, poleType: "overhead" },
];
