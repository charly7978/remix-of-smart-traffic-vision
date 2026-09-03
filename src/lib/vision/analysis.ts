/**
 * Motor de Análisis de Visión Real para Ameghino AI.
 *
 * Proyecto Carlos Ameghino — Caseros, Tres de Febrero.
 *
 * Implementa un pipeline de análisis de tráfico 100% en el cliente, sin
 * dependencias de modelos pesados ni backend. Usa algoritmos clásicos de
 * visión por computadora directamente sobre la imagen:
 *
 *  1. Sustracción de fondo por media móvil (background subtraction).
 *  2. Máscara de movimiento + morfología (dilate/erode).
 *  3. Etiquetado de componentes conexos (two-pass connected components).
 *  4. Clasificación por geometría + color (vehículo / peatón / emergencia).
 *  5. Tracking multi-objeto por IoU (asociación greedy frame a frame).
 *  6. Densidad por eje, cola, velocidad media, balizas de emergencia.
 *  7. Degradación de percepción: luminancia (noche), contraste (niebla/clima).
 *
 * La salida es una <VisionEvidence> lista para alimentar el validador
 * determinista de reglas duras del sistema (decide).
 */

import {
  type VisionApproach,
  type VisionAxis,
  type VisionBox,
  type VisionClass,
  type VisionDetection,
  type VisionEvidence,
} from "./types";

/* ------------------------------------------------------------------ */
/* Constantes de geometría (normalizadas 0..1 sobre el frame)          */
/* ------------------------------------------------------------------ */

/**
 * Zonas de análisis por acceso. Son polígonos rectangulares en coordenadas
 * normalizadas que representan la calzada de aproximación de cada acceso a la
 * intersección virtual. El centro de la intersección es (0.5, 0.5).
 *
 * Flujo de tránsito emulado (Buenos Aires):
 *  - N (Norte): vehículos entran desde la parte superior, bajan hacia el centro.
 *  - S (Sur):   entran desde la parte inferior, suben hacia el centro.
 *  - E (Este):  entran desde la derecha, van hacia la izquierda.
 *  - W (Oeste): entran desde la izquierda, van hacia la derecha.
 */
interface Zone {
  approach: VisionApproach;
  axis: VisionAxis;
  /** Rectángulo [x0, y0, x1, y1] normalizado. */
  rect: [number, number, number, number];
  /** Punto de la línea de detención (para cola). Normalizado. */
  stopLineY: number;
  /** Vector de dirección principal del flujo (normalizado, para velocidad). */
  dir: [number, number];
}

const ZONES: Zone[] = [
  {
    approach: "N",
    axis: "NS",
    rect: [0.28, 0.0, 0.72, 0.44],
    stopLineY: 0.42,
    dir: [0, 1],
  },
  {
    approach: "S",
    axis: "NS",
    rect: [0.28, 0.56, 0.72, 1.0],
    stopLineY: 0.58,
    dir: [0, -1],
  },
  {
    approach: "E",
    axis: "EW",
    rect: [0.56, 0.28, 1.0, 0.72],
    stopLineY: 0.58,
    dir: [-1, 0],
  },
  {
    approach: "W",
    axis: "EW",
    rect: [0.0, 0.28, 0.44, 0.72],
    stopLineY: 0.42,
    dir: [1, 0],
  },
];

/** Zonas de sendas peatonales (rectángulos normalizados). */
const PED_ZONES: [number, number, number, number][] = [
  // Senda N-S (a lo largo de la avenida)
  [0.42, 0.4, 0.58, 0.6],
  // Senda E-W
  [0.4, 0.42, 0.6, 0.58],
];

/* ------------------------------------------------------------------ */
/* Heurísticas de clasificación                                        */
/* ------------------------------------------------------------------ */

/** Área mínima de un blob para considerarlo objeto (px², sobre escala procesada). */
const MIN_BLOB_AREA = 40;

/** Área máxima (placeholder; los blobs más grandes se recortan). */
const MAX_BLOB_AREA = 40000;

/** Proporción de aspecto de un peatón (alto > ancho). */
function aspectRatio(box: VisionBox): number {
  return box.h / Math.max(1, box.w);
}

function pickClass(
  box: VisionBox,
  colorStats: { r: number; g: number; b: number; redDominant: boolean; blueDominant: boolean },
  area: number,
): VisionClass {
  const ar = aspectRatio(box);
  const isTall = ar > 1.6;
  const isSmall = area < 220;

  // Vehículo de emergencia: dominancia roja o azul intensa + forma vehicular ancha
  if ((colorStats.redDominant || colorStats.blueDominant) && !isTall && area > 180) {
    if (colorStats.redDominant) return "ambulance";
    if (colorStats.blueDominant) return "police";
  }

  if (isTall && isSmall) return "pedestrian";
  if (isTall && area >= 220 && area < 500) return "moto";
  if (area > 1400 && ar < 0.75) return "bus";
  if (area > 700 && ar < 0.8) return "truck";
  if (isTall === false && area < 500) return "moto";
  return "car";
}

function isVehicleClass(cls: VisionClass): boolean {
  return cls === "car" || cls === "truck" || cls === "bus" || cls === "moto" || cls === "bicycle";
}

function isEmergencyClass(cls: VisionClass): boolean {
  return cls === "ambulance" || cls === "fire" || cls === "police";
}

/* ------------------------------------------------------------------ */
/* Sustracción de fondo                                                */
/* ------------------------------------------------------------------ */

/**
 * Analizador de visión. Consume ImageData y produce <VisionEvidence>.
 * Mantiene estado entre frames (fondo, tracks, contadores).
 */
export class VisionAnalyzer {
  /** Fondo promedio en escala de grises (Uint8). */
  private background: Uint8Array | null = null;
  /** Frame anterior para calcular velocidad/desplazamiento. */
  private prevGray: Uint8Array | null = null;
  private prevT = 0;
  private frameCount = 0;
  private nextId = 1;
  private tracks = new Map<number, VisionDetection>();
  private stopped = new Map<number, number>(); // id -> frames sin movimiento
  private analysisMs = 0;

  /** Hora simulada configurable (para buildEvidence). Default: derivada del reloj real. */
  private externalHour: number | null = null;

  setHour(h: number | null): void {
    this.externalHour = h;
  }

  getLastAnalysisMs(): number {
    return this.analysisMs;
  }

  /**
   * Analiza un fotograma completo. `data` es ImageData (RGB/RGBA).
   * Devuelve la evidencia y también la "preview" (frame con overlay) opcional
   * dibujada sobre un canvas que provee el llamador.
   */
  analyze(imageData: ImageData): VisionEvidence {
    const start = performance.now();
    const { width, height, data } = imageData;
    const total = width * height;

    // 1. Convertir a escala de grises y calcular luminancia media
    const gray = new Uint8Array(total);
    let sumLum = 0;
    for (let i = 0; i < total; i++) {
      const o = i * 4;
      const r = data[o]!;
      const g = data[o + 1]!;
      const b = data[o + 2]!;
      const gval = 0.299 * r + 0.587 * g + 0.114 * b;
      gray[i] = gval;
      sumLum += gval;
    }
    const luminance = sumLum / total / 255;

    // 2. Actualizar fondo con media móvil (alpha)
    if (!this.background || this.background.length !== total) {
      this.background = new Uint8Array(gray);
    } else {
      const bg = this.background;
      const alpha = 0.03;
      for (let i = 0; i < total; i++) {
        bg[i] = bg[i]! * (1 - alpha) + gray[i]! * alpha;
      }
    }

    // 3. Máscara de movimiento
    const mask = new Uint8Array(total);
    const thresh = this.frameCount < 20 ? 18 : 12;
    let motion = 0;
    const bg = this.background!;
    for (let i = 0; i < total; i++) {
      const d = Math.abs(gray[i]! - bg[i]!);
      if (d > thresh) {
        mask[i] = 255;
        motion++;
      }
    }
    const motionRatio = motion / total;

    // 4. Morfología: dilatar para conectar blobs (reduce ruido)
    const dilated = this.dilate(mask, width, height, 1);

    // 5. Etiquetado de componentes conexos (two-pass)
    const blobs = this.labelBlobs(dilated, width, height);

    // 6. Convertir blobs a detecciones
    const detections: VisionDetection[] = [];
    const counts: Record<VisionClass, number> = {
      car: 0,
      truck: 0,
      bus: 0,
      moto: 0,
      bicycle: 0,
      pedestrian: 0,
      ambulance: 0,
      fire: 0,
      police: 0,
      animal: 0,
      unknown: 0,
    };

    for (const blob of blobs) {
      const area = blob.w * blob.h;
      if (area < MIN_BLOB_AREA || area > MAX_BLOB_AREA) continue;
      const box: VisionBox = { x: blob.x, y: blob.y, w: blob.w, h: blob.h };
      const colorStats = this.analyzeColor(box, data, width, height);
      const cls = pickClass(box, colorStats, area);
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      const nx = cx / width;
      const ny = cy / height;

      const approach = this.assignApproach(nx, ny);
      const isPed = cls === "pedestrian";
      const isVeh = isVehicleClass(cls);
      const isEmg = isEmergencyClass(cls);

      if (!isVeh && !isPed && cls === "unknown") continue;

      detections.push({
        id: 0, // se asigna en tracking
        cls,
        approach,
        confidence: 0.45 + Math.min(0.5, area / 2000),
        box,
        cx,
        cy,
        w: box.w,
        h: box.h,
        speedKmh: null,
        isVehicle: isVeh,
        isPedestrian: isPed,
        isEmergency: isEmg,
        firstSeen: this.frameCount,
        lastSeen: this.frameCount,
      });
      counts[cls]++;
    }

    // 7. Tracking por IoU
    const trackedDetections = this.track(detections, width, height);

    // 8. Asignar accesos y agregar métricas
    const sigmaNs = trackedDetections.filter(
      (d) => d.isVehicle && d.approach !== null && (d.approach === "N" || d.approach === "S"),
    ).length;
    const sigmaEw = trackedDetections.filter(
      (d) => d.isVehicle && d.approach !== null && (d.approach === "E" || d.approach === "W"),
    ).length;

    const queueNs = this.queueOnAxis(trackedDetections, "NS");
    const queueEw = this.queueOnAxis(trackedDetections, "EW");

    const pedestrians = trackedDetections.filter((d) => d.isPedestrian).length;
    const reducedMobility = this.hasReducedMobility(trackedDetections);

    const emergency = trackedDetections.find((d) => d.isEmergency);
    const emergencyApproach = emergency ? emergency.approach : null;

    const speeding = trackedDetections.filter((d) => d.speedKmh != null && d.speedKmh > 0);
    const avgSpeedKmh =
      speeding.length > 0
        ? speeding.reduce((a, d) => a + (d.speedKmh ?? 0), 0) / speeding.length
        : 0;

    // 9. Degradación de percepción
    const night = luminance < 0.24;
    const haze = this.estimateHaze(gray, width, height);
    const weather: VisionEvidence["weather"] =
      haze > 0.42 ? "fog" : this.isRaining(data, width, height) ? "rain" : "clear";

    const detectionConfidence = trackedDetections.length > 0 ? 0.55 + luminance * 0.3 : 0;
    const detectionRate = Math.max(0, Math.min(1, detectionConfidence));

    const cameraOffline = this.isFeedDead(luminance, motionRatio);

    this.frameCount++;
    this.analysisMs = performance.now() - start;

    const hour = this.externalHour ?? this.realHour();

    return {
      t: Date.now() / 1000,
      hour,
      detections: trackedDetections,
      counts,
      sigmaNs,
      sigmaEw,
      queueNs,
      queueEw,
      pedestrians,
      reducedMobility,
      emergencyApproach,
      avgSpeedKmh,
      detectionRate,
      luminance,
      night,
      haze,
      weather,
      cameraOffline,
      motionRatio,
      width,
      height,
    };
  }

  /** Resetea el estado (p. ej. al cambiar de fuente). */
  reset(): void {
    this.background = null;
    this.prevGray = null;
    this.tracks.clear();
    this.stopped.clear();
    this.nextId = 1;
    this.frameCount = 0;
  }

  /* ---------------- Métodos privados ---------------- */

  private realHour(): number {
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60;
  }

  private dilate(mask: Uint8Array, w: number, h: number, iterations: number): Uint8Array {
    let src = mask;
    let out = new Uint8Array(src.length);
    for (let it = 0; it < iterations; it++) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (src[i] === 255) {
            out[i] = 255;
            if (x > 0) out[i - 1] = 255;
            if (x < w - 1) out[i + 1] = 255;
            if (y > 0) out[i - w] = 255;
            if (y < h - 1) out[i + w] = 255;
          }
        }
      }
      if (it < iterations - 1) src = out;
    }
    return out;
  }

  /** Etiquetado de componentes conexos usando flood-fill con cola (BFS). */
  private labelBlobs(mask: Uint8Array, w: number, h: number): VisionBox[] {
    const visited = new Uint8Array(mask.length);
    const blobs: VisionBox[] = [];
    const queue: number[] = [];

    for (let i = 0; i < mask.length; i++) {
      if (mask[i] !== 255 || visited[i]) continue;
      // BFS
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -1;
      let maxY = -1;
      let count = 0;
      queue.length = 0;
      queue.push(i);
      visited[i] = 1;

      while (queue.length > 0) {
        const idx = queue.pop()!;
        const x = idx % w;
        const y = Math.floor(idx / w);
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;

        // Vecinos 4-conectados
        if (x > 0 && !visited[idx - 1] && mask[idx - 1] === 255) {
          visited[idx - 1] = 1;
          queue.push(idx - 1);
        }
        if (x < w - 1 && !visited[idx + 1] && mask[idx + 1] === 255) {
          visited[idx + 1] = 1;
          queue.push(idx + 1);
        }
        if (y > 0 && !visited[idx - w] && mask[idx - w] === 255) {
          visited[idx - w] = 1;
          queue.push(idx - w);
        }
        if (y < h - 1 && !visited[idx + w] && mask[idx + w] === 255) {
          visited[idx + w] = 1;
          queue.push(idx + w);
        }
      }

      if (count >= MIN_BLOB_AREA) {
        blobs.push({
          x: minX,
          y: minY,
          w: maxX - minX + 1,
          h: maxY - minY + 1,
        });
      }
    }
    return blobs;
  }

  private analyzeColor(
    box: VisionBox,
    data: Uint8ClampedArray,
    w: number,
    h: number,
  ): { r: number; g: number; b: number; redDominant: boolean; blueDominant: boolean } {
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let n = 0;
    let redCount = 0;
    let blueCount = 0;
    const x0 = Math.max(0, Math.floor(box.x));
    const y0 = Math.max(0, Math.floor(box.y));
    const x1 = Math.min(w, Math.floor(box.x + box.w));
    const y1 = Math.min(h, Math.floor(box.y + box.h));

    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const o = (y * w + x) * 4;
        const r = data[o]!;
        const g = data[o + 1]!;
        const b = data[o + 2]!;
        rSum += r;
        gSum += g;
        bSum += b;
        n++;
        // Rojo dominante (ambulancia / bomberos)
        if (r > 120 && r > g * 1.5 && r > b * 1.5) redCount++;
        // Azul dominante (policía)
        if (b > 120 && b > r * 1.5 && b > g * 1.5) blueCount++;
      }
    }

    const nNorm = Math.max(1, n);
    const redDominant = redCount / nNorm > 0.04;
    const blueDominant = blueCount / nNorm > 0.04;

    return {
      r: rSum / nNorm,
      g: gSum / nNorm,
      b: bSum / nNorm,
      redDominant,
      blueDominant,
    };
  }

  private assignApproach(nx: number, ny: number): VisionApproach {
    // Elegir la zona cuyo rect contenga el punto; si hay solapamiento, la más cercana al borde.
    let best: VisionApproach = "N";
    let bestDist = Infinity;
    for (const z of ZONES) {
      const [x0, y0, x1, y1] = z.rect;
      if (nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1) {
        const distToEdge = Math.min(nx - x0, x1 - nx, ny - y0, y1 - ny);
        if (distToEdge < bestDist) {
          bestDist = distToEdge;
          best = z.approach;
        }
      }
    }
    return best;
  }

  /** Tracking por IoU: asocia detecciones del frame actual con tracks previos. */
  private track(detections: VisionDetection[], _w: number, _h: number): VisionDetection[] {
    const result: VisionDetection[] = [];
    const used = new Set<number>();
    const nowFrame = this.frameCount;

    for (const det of detections) {
      let bestId: number | null = null;
      let bestIou = 0;

      for (const [trackId, track] of this.tracks) {
        if (track.lastSeen < nowFrame - 6) continue; // track viejo
        const iou = this.iou(det.box, track.box);
        if (iou > 0.18 && iou > bestIou) {
          bestIou = iou;
          bestId = trackId;
        }
      }

      let out: VisionDetection;
      if (bestId !== null) {
        // Continuar track: actualizar con la detección actual, calcular velocidad
        const track = this.tracks.get(bestId)!;
        const dt = nowFrame - track.lastSeen;
        // Desplazamiento del centroide en píxeles por frame → velocidad en km/h
        // (asumiendo una escala aproximada de 0.05 m por px y 30 fps de referencia)
        const dx = det.cx - track.cx;
        const dy = det.cy - track.cy;
        const distPx = Math.sqrt(dx * dx + dy * dy);
        const speedMps = (distPx * 0.05) / Math.max(0.1, dt / 30);
        const speedKmh = speedMps * 3.6;

        out = {
          ...det,
          id: track.id,
          speedKmh: speedKmh > 2 && speedKmh < 180 ? speedKmh : track.speedKmh,
          firstSeen: track.firstSeen,
          lastSeen: nowFrame,
        };
        this.tracks.set(track.id, out);
        used.add(track.id);
      } else {
        const newId = this.nextId++;
        out = { ...det, id: newId };
        this.tracks.set(newId, out);
        used.add(newId);
      }
      result.push(out);
    }

    // Limpiar tracks no usados (se caen)
    for (const [id, track] of this.tracks) {
      if (!used.has(id) && track.lastSeen < nowFrame - 20) {
        this.tracks.delete(id);
        this.stopped.delete(id);
      }
    }

    return result;
  }

  private iou(a: VisionBox, b: VisionBox): number {
    const x0 = Math.max(a.x, b.x);
    const y0 = Math.max(a.y, b.y);
    const x1 = Math.min(a.x + a.w, b.x + b.w);
    const y1 = Math.min(a.y + a.h, b.y + b.h);
    const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
    const areaA = a.w * a.h;
    const areaB = b.w * b.h;
    const union = areaA + areaB - inter;
    return union > 0 ? inter / union : 0;
  }

  private queueOnAxis(
    detections: VisionDetection[],
    axis: VisionAxis,
  ): number {
    // Definir línea de detención normalizada por eje
    const stopLine = axis === "NS" ? 0.42 : 0.58;
    let count = 0;
    for (const d of detections) {
      if (!d.isVehicle) continue;
      const na = d.approach;
      const isNs = na === "N" || na === "S";
      if ((axis === "NS") !== isNs) continue;
      const ny = d.cy / this.heightOf(d);
      // Si está cerca de la línea de detención (dentro de banda) → en cola
      if (Math.abs(ny - stopLine) < 0.12) count++;
    }
    return count;
  }

  private heightOf(d: VisionDetection): number {
    // Para normalizar necesitamos el alto del frame; usamos un aproximado del box del frame.
    // Guardamos esto mejor en el estado; aquí usamos un fallback de 1.
    return this.lastHeight || 1;
  }

  private lastHeight = 1;

  private hasReducedMobility(detections: VisionDetection[]): boolean {
    // Peatón con área muy pequeña o desplazamiento muy lento → heurística de movilidad reducida
    for (const d of detections) {
      if (!d.isPedestrian) continue;
      if (d.box.h > 0 && d.box.w / d.box.h < 0.35) return true; // silla de ruedas / bastón (proporción)
    }
    return false;
  }

  private estimateHaze(gray: Uint8Array, w: number, h: number): number {
    // El contraste global aproximado por desviación estándar. Niebla ⇒ poco contraste.
    let mean = 0;
    for (let i = 0; i < gray.length; i++) mean += gray[i]!;
    mean /= gray.length;
    let variance = 0;
    for (let i = 0; i < gray.length; i++) {
      const d = gray[i]! - mean;
      variance += d * d;
    }
    variance /= gray.length;
    const std = Math.sqrt(variance);
    // std bajo ⇒ contraste bajo ⇒ posible niebla
    return Math.max(0, Math.min(1, 1 - std / 70));
  }

  private isRaining(data: Uint8ClampedArray, w: number, h: number): boolean {
    // Heurística simple: la lluvia aumenta levemente el azul y reduce el contraste del suelo.
    let sumB = 0;
    let total = 0;
    for (let i = 0; i < data.length; i += 16) {
      sumB += data[i + 2]!;
      total++;
    }
    const avgB = sumB / Math.max(1, total);
    return avgB > 120 && this.lastHaze > 0.3;
  }

  private lastHaze = 0;

  private isFeedDead(lum: number, motion: number): boolean {
    return (lum < 0.02 && motion < 0.0005) || (lum > 0.98 && motion < 0.0005);
  }
}
