/**
 * Mapeo de coordenadas y cinemática 3D para el Gemelo Digital de Caseros.
 * Proyecto Carlos Ameghino — Municipalidad de Tres de Febrero.
 *
 * Mapea el progreso del motor de simulación (p: -60..900) al espacio tridimensional (X, Y, Z)
 * en metros reales del cruce de Av. San Martín y Urquiza.
 *
 * Convención de ejes 3D:
 * - X: Eje horizontal (Oeste <-> Este)
 * - Y: Eje vertical hacia arriba (Altura sobre el asfalto)
 * - Z: Eje de profundidad (Norte <-> Sur)
 * - (0, 0, 0): Centro exacto de la intersección.
 */

import * as THREE from "three";
import { type Approach } from "@/lib/traffic/engine";

export const ROAD_METRICS = {
  laneWidth: 3.5, // Ancho de carril (metros)
  laneOffset: 1.85, // Desplazamiento desde la línea divisoria central
  curbHeight: 0.15, // Altura de vereda (metros)
  crosswalkDist: 14.0, // Distancia del centro a la senda peatonal
  stopLineDist: 16.5, // Distancia del centro a la línea de parada
  spawnDist: 55.0, // Distancia de inicio de aproximación
  despawnDist: 60.0, // Distancia de salida de pantalla
};

/**
 * Trayectorias en 3D para cada uno de los 4 accesos al cruce de Caseros:
 * - N: Viene del Noroeste (X < 0, Z < 0) hacia el Sudeste (X > 0, Z > 0) por Av. San Martín.
 * - S: Viene del Sudeste (X > 0, Z > 0) hacia el Noroeste (X < 0, Z < 0) por Av. San Martín.
 * - W: Viene del Sudoeste (X < 0, Z > 0) hacia el Noreste (X > 0, Z < 0) por Calle Urquiza.
 * - E: Viene del Noreste (X > 0, Z < 0) hacia el Sudoeste (X < 0, Z > 0) por Calle Urquiza.
 */
export interface Transform3D {
  position: THREE.Vector3;
  rotationY: number;
}

export function getVehicleTransform3D(approach: Approach, p: number): Transform3D {
  // Mapeamos p (0 a 900) al avance físico en metros (-spawnDist a +despawnDist)
  // p = 286 corresponde a la línea de detención (stopLineDist)
  // p = 400 corresponde al centro del cruce (0 metros)
  // p = 520 corresponde a la salida del cruce
  const dist = ((p - 400) / 400) * (ROAD_METRICS.spawnDist + 5);

  const off = ROAD_METRICS.laneOffset;
  const pos = new THREE.Vector3(0, 0, 0);
  let rotY = 0;

  // Ángulo de la diagonal de San Martín (~45°) y Urquiza (~ -45°)
  const diagAngle = Math.PI / 4; // 45 grados

  switch (approach) {
    case "N": {
      // Noroeste -> Sudeste (Av. San Martín)
      // Vector avance: (cos(45°), 0, sin(45°)) = (0.707, 0, 0.707)
      // Vector perpendicular hacia la derecha: (-sin(45°), 0, cos(45°)) = (-0.707, 0, 0.707)
      const u = Math.cos(diagAngle);
      const v = Math.sin(diagAngle);
      pos.x = dist * u - off * v;
      pos.z = dist * v + off * u;
      rotY = -diagAngle + Math.PI; // Orientación hacia Sudeste
      break;
    }
    case "S": {
      // Sudeste -> Noroeste (Av. San Martín)
      // Vector avance: (-cos(45°), 0, -sin(45°))
      const u = -Math.cos(diagAngle);
      const v = -Math.sin(diagAngle);
      pos.x = dist * u - off * v;
      pos.z = dist * v + off * u;
      rotY = -diagAngle; // Orientación hacia Noroeste
      break;
    }
    case "W": {
      // Sudoeste -> Noreste (Calle Urquiza)
      // Vector avance: (cos(-45°), 0, sin(-45°)) = (0.707, 0, -0.707)
      // Vector perpendicular hacia la derecha: (0.707, 0, 0.707)
      const u = Math.cos(-diagAngle);
      const v = Math.sin(-diagAngle);
      pos.x = dist * u + off * u;
      pos.z = dist * v + off * v;
      rotY = diagAngle + Math.PI; // Orientación hacia Noreste
      break;
    }
    case "E": {
      // Noreste -> Sudoeste (Calle Urquiza)
      // Vector avance: (-cos(-45°), 0, -sin(-45°)) = (-0.707, 0, 0.707)
      const u = -Math.cos(-diagAngle);
      const v = -Math.sin(-diagAngle);
      pos.x = dist * u + off * u;
      pos.z = dist * v + off * v;
      rotY = diagAngle; // Orientación hacia Sudoeste
      break;
    }
  }

  return { position: pos, rotationY: rotY };
}

/** Posición 3D de los peatones sobre las sendas peatonales */
export function getPedestrianTransform3D(
  crossAxis: "NS" | "EW",
  side: -1 | 1,
  progress: number,
): Transform3D {
  const t = Math.max(0, Math.min(1, progress));
  const span = 12.0; // Ancho de la senda a cruzar
  const walkPos = (t - 0.5) * span;

  const pos = new THREE.Vector3(0, 0, 0);
  let rotY = 0;
  const cwDist = ROAD_METRICS.crosswalkDist * side;

  if (crossAxis === "NS") {
    // Cruzando Avenida San Martín (de un lado al otro perpendicularmente)
    const normAngle = Math.PI / 4 + Math.PI / 2;
    pos.x = cwDist * Math.cos(Math.PI / 4) + walkPos * Math.cos(normAngle);
    pos.z = cwDist * Math.sin(Math.PI / 4) + walkPos * Math.sin(normAngle);
    rotY = normAngle;
  } else {
    // Cruzando Calle Urquiza
    const normAngle = -Math.PI / 4 + Math.PI / 2;
    pos.x = cwDist * Math.cos(-Math.PI / 4) + walkPos * Math.cos(normAngle);
    pos.z = cwDist * Math.sin(-Math.PI / 4) + walkPos * Math.sin(normAngle);
    rotY = normAngle;
  }

  return { position: pos, rotationY: rotY };
}

/** Coordenadas 3D de los semáforos en las esquinas de vereda */
export interface SignalPole3D {
  approach: Approach;
  position: THREE.Vector3;
  rotationY: number;
}

export const SIGNAL_POLES_3D: SignalPole3D[] = [
  // Semáforo Acceso Norte (Vereda Noroeste)
  {
    approach: "N",
    position: new THREE.Vector3(-10.5, 0, -10.5),
    rotationY: (3 * Math.PI) / 4,
  },
  // Semáforo Acceso Sur (Vereda Sudeste)
  {
    approach: "S",
    position: new THREE.Vector3(10.5, 0, 10.5),
    rotationY: -Math.PI / 4,
  },
  // Semáforo Acceso Oeste (Vereda Sudoeste)
  {
    approach: "W",
    position: new THREE.Vector3(-10.5, 0, 10.5),
    rotationY: Math.PI / 4,
  },
  // Semáforo Acceso Este (Vereda Noreste)
  {
    approach: "E",
    position: new THREE.Vector3(10.5, 0, -10.5),
    rotationY: -(3 * Math.PI) / 4,
  },
];
