/**
 * Tipos del Sistema de Visión Real para Ameghino AI.
 *
 * Proyecto Carlos Ameghino — Caseros, Tres de Febrero.
 *
 * Este módulo define el contrato de datos del pipeline de visión artificial que
 * consume fotogramas (webcam, video local, snapshot público o escena sintética)
 * y produce análisis de tráfico completo: detección, tracking, densidad por
 * acceso, cola, velocidad, peatones, vehículos de emergencia y métricas de
 * degradación de percepción (noche/visibilidad/clima).
 *
 * La filosofía es la misma que en <engine.ts>: todo lo que percibe el "borde"
 * se resume en una <VisionEvidence> que alimenta el validador determinista de
 * reglas duras (decide). Nada probabilístico comanda el semáforo directamente.
 */

/**
 * Clases de objetos reconocibles por la red/el clasificador de visión.
 * Se alinean con las clases usadas por el motor de tráfico para poder
 * mapear la evidencia real sin fricción.
 */
export type VisionClass =
  | "car"
  | "truck"
  | "bus"
  | "moto"
  | "bicycle"
  | "pedestrian"
  | "ambulance"
  | "fire" // Bomberos
  | "police" // Policía
  | "animal"
  | "unknown";

/** Orientación de un acceso respecto del cruce emulado (4 accesos: N/S/E/W). */
export type VisionApproach = "N" | "S" | "E" | "W";

/** Eje semafórico asociado a un acceso. */
export type VisionAxis = "NS" | "EW";

/** Una detección individual producida por el motor de análisis. */
export interface VisionDetection {
  id: number;
  /** Clase clasificada. */
  cls: VisionClass;
  /** Acceso (asignado por la zona de análisis en la que cayó el objeto). */
  approach: VisionApproach;
  /** Confianza de la clasificación (0..1). */
  confidence: number;
  /** Caja delimitadora en píxeles de la imagen procesada. */
  box: VisionBox;
  /** Centroide. */
  cx: number;
  cy: number;
  /** Ancho/alto. */
  w: number;
  h: number;
  /** Velocidad estimada en km/h (si el tracker la pudo calcular). */
  speedKmh: number | null;
  /** El objeto es un vehículo (para conteo vehicular). */
  isVehicle: boolean;
  /** El objeto es un peatón. */
  isPedestrian: boolean;
  /** Es vehículo de emergencia (ambulancia/bomberos/policía). */
  isEmergency: boolean;
  /** Frame en el que se detectó por primera vez. */
  firstSeen: number;
  /** Frame del último avistamiento. */
  lastSeen: number;
}

export interface VisionBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Fotografía completa del estado analizado en un instante.
 * Es la entrada para el motor de decisión (<buildEvidence>).
 */
export interface VisionEvidence {
  /** Timestamp Unix de la captura. */
  t: number;
  /** Hora del día (0-23.99) derivada de la imagen o del reloj configurado. */
  hour: number;
  /** Detecciones activas en este frame. */
  detections: VisionDetection[];
  /** Conteo por clase. */
  counts: Record<VisionClass, number>;
  /** Densidad percibida por eje (objetos en zona de análisis por eje). */
  sigmaNs: number;
  sigmaEw: number;
  /** Cola estimada por eje (objetos detenidos cerca de la línea de detención). */
  queueNs: number;
  queueEw: number;
  /** Cantidad de peatones detectados (en sendas). */
  pedestrians: number;
  /** Peatones con posible movilidad reducida (heurísticas de tamaño/pose). */
  reducedMobility: boolean;
  /** Vehículo de emergencia detectado con el acceso correspondiente. */
  emergencyApproach: VisionApproach | null;
  /** Velocidad media estimada (km/h) de los vehículos en movimiento. */
  avgSpeedKmh: number;
  /** Proporción de la imagen clasificada con confianza suficiente. */
  detectionRate: number;
  /** Luminancia media normalizada (0=negro, 1=blanco). */
  luminance: number;
  /** Es de noche (heurística de luminancia). */
  night: boolean;
  /** Nivel de niebla/contraste degradado (0=despejado, 1=degradado máximo). */
  haze: number;
  /** Clima inferido: despejado / lluvia / niebla. */
  weather: "clear" | "rain" | "fog";
  /** La cámara no entrega frames válidos (feed caído/black). */
  cameraOffline: boolean;
  /** Píxeles de fondo vs movimiento (información para debug). */
  motionRatio: number;
  /** Ancho/alto de la imagen procesada. */
  width: number;
  height: number;
}

/** Preset de fuente de cámara pública. */
export interface PublicCameraPreset {
  id: string;
  /** Nombre legible. */
  label: string;
  /** Ubicación descriptiva. */
  location: string;
  /** Tipo de fuente: snapshot de imagen o webcam. */
  kind: "snapshot" | "hls" | "webcam";
  /** URL base (para snapshot puede ser el endpoint de imagen). */
  url: string;
  /** Frecuencia sugerida de refresco en ms (para snapshot). */
  refreshMs: number;
  /** Descripción breve para el panel. */
  description: string;
}

/** Fuente activa configurable en el panel. */
export type VisionSourceKind =
  | "synthetic"
  | "webcam"
  | "video-file"
  | "snapshot-url"
  | "public-preset";

export interface VisionSourceConfig {
  kind: VisionSourceKind;
  /** URL del snapshot o del stream HLS. */
  url?: string;
  /** VideoFile: File seleccionado por el usuario. */
  file?: File;
  /** PublicPreset: id del preset elegido. */
  presetId?: string;
  /** Escala de procesamiento (reduce resolución para rendimiento). */
  processScale?: number;
}

/** Salida consolidada del pipeline que consume el componente/simulador. */
export interface RealVisionSnapshot {
  /** Último frame procesado como dataURL JPEG (para mostrar en canvas/imagen). */
  frameDataUrl: string | null;
  /** Evidencia de análisis más reciente. */
  evidence: VisionEvidence | null;
  /** Estado del pipeline. */
  status: "idle" | "starting" | "running" | "error" | "stopped";
  /** Mensaje de error (si status=error). */
  error: string | null;
  /** Latencia de análisis del último frame (ms). */
  analysisMs: number;
  /** FPS efectivo del pipeline. */
  fps: number;
  /** Fuente activa. */
  source: VisionSourceConfig | null;
}
