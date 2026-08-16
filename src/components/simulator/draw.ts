/**
 * Renderizador visual de vanguardia para el simulador de tránsito inteligente Ameghino AI.
 * Ambientado en la intersección de Av. San Martín y Urquiza (Caseros, Tres de Febrero).
 *
 * Utiliza imágenes fotorrealistas de ultra-alta definición de Caseros (Día y Noche),
 * renderizado vehicular multicapa con llantas giratorias, faros volumétricos,
 * balizas estroboscópicas SAME 3F, colectivos Línea 343/181 y capas YOLOv11 en vivo.
 */

import { type Approach, type TrafficEngine, type Vehicle } from "@/lib/traffic/engine";

import {
  getPedestrianRealPos,
  getVehicleRealTransform,
  REAL_SIGNAL_ANCHORS,
} from "@/lib/photo/photoGeometry";

import {
  drawDetailedPedestrian,
  drawDetailedTrafficSignal,
  drawDetailedVehicle,
  drawDetailedYoloBox,
} from "./vehicleRenderer";

export interface DrawOptions {
  /** Capa de analítica YOLOv11: cajas de detección y confianza */
  analysis: boolean;
  /** Conos de visión y cámaras de borde Jetson */
  cameras: boolean;
  /** Telemetría HUD y marco técnico de control */
  hud: boolean;
  /** Rótulos de calles y orientación geográfica */
  labels: boolean;
}

export const DEFAULT_DRAW_OPTIONS: DrawOptions = {
  analysis: true,
  cameras: true,
  hud: true,
  labels: true,
};

const S = 800; // Lado del canvas cuadrado

/* ------------------------------------------------------------------ */
/* Caché de Imágenes Fotorrealistas de Caseros                         */
/* ------------------------------------------------------------------ */

let imgDia: HTMLImageElement | null = null;
let imgNoche: HTMLImageElement | null = null;

function getRealBgImage(night: boolean): HTMLImageElement | null {
  if (typeof window === "undefined") return null;

  if (!imgDia) {
    imgDia = new Image();
    imgDia.src = "/images/cruce-tres-de-febrero-dia.jpg";
  }
  if (!imgNoche) {
    imgNoche = new Image();
    imgNoche.src = "/images/cruce-tres-de-febrero-noche.jpg";
  }

  const target = night ? imgNoche : imgDia;
  return target.complete && target.naturalWidth > 0 ? target : null;
}

/* ------------------------------------------------------------------ */
/* Efectos Climáticos y de Iluminación Ambiental                       */
/* ------------------------------------------------------------------ */

function drawRainEffect(ctx: CanvasRenderingContext2D, nowMs: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(200, 225, 255, 0.35)";
  ctx.lineWidth = 1.2;

  const drops = 120;
  for (let i = 0; i < drops; i++) {
    const x = (i * 137 + nowMs * 0.7) % S;
    const y = (i * 251 + nowMs * 1.6) % S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 5, y + 16);
    ctx.stroke();
  }

  // Reflejos en el asfalto mojado
  ctx.fillStyle = "rgba(180, 210, 255, 0.08)";
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
}

function drawFogEffect(ctx: CanvasRenderingContext2D, nowMs: number) {
  ctx.save();
  const grad = ctx.createRadialGradient(S / 2, S / 2, 80, S / 2, S / 2, S * 0.7);
  grad.addColorStop(0, "rgba(210, 225, 240, 0.22)");
  grad.addColorStop(0.7, "rgba(190, 210, 230, 0.45)");
  grad.addColorStop(1, "rgba(170, 190, 215, 0.65)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  // Bandas de niebla flotante
  for (let i = 0; i < 4; i++) {
    const y = 140 + i * 160 + Math.sin(nowMs / 2000 + i) * 30;
    const bGrad = ctx.createLinearGradient(0, y - 40, 0, y + 40);
    bGrad.addColorStop(0, "rgba(220, 235, 250, 0)");
    bGrad.addColorStop(0.5, "rgba(220, 235, 250, 0.18)");
    bGrad.addColorStop(1, "rgba(220, 235, 250, 0)");
    ctx.fillStyle = bGrad;
    ctx.fillRect(0, y - 40, S, 80);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Capa de Información y Rótulos de Calle                              */
/* ------------------------------------------------------------------ */

function drawStreetLabels(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.font = "bold 10px 'JetBrains Mono', monospace";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
  ctx.shadowBlur = 4;

  // Cartel Av. San Martín (Eje Noroeste-Sudeste)
  ctx.save();
  ctx.translate(140, 100);
  ctx.rotate(Math.PI / 4);
  ctx.fillText("AV. SAN MARTÍN ➔", 0, 0);
  ctx.restore();

  ctx.save();
  ctx.translate(660, 620);
  ctx.rotate(Math.PI / 4);
  ctx.fillText("➔ AV. SAN MARTÍN", 0, 0);
  ctx.restore();

  // Cartel Calle Urquiza (Eje Sudoeste-Noreste)
  ctx.save();
  ctx.translate(120, 680);
  ctx.rotate(-Math.PI / 4);
  ctx.fillText("CALLE URQUIZA ➔", 0, 0);
  ctx.restore();

  ctx.save();
  ctx.translate(640, 160);
  ctx.rotate(-Math.PI / 4);
  ctx.fillText("➔ CALLE URQUIZA", 0, 0);
  ctx.restore();

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Capa de Conos de Visión de Cámaras Edge                            */
/* ------------------------------------------------------------------ */

function drawCameraCones(ctx: CanvasRenderingContext2D, engine: TrafficEngine, nowMs: number) {
  if (engine.cameraOffline) return;

  const vis = engine.visibility || 1;
  const pulse = 0.08 + Math.sin(nowMs / 800) * 0.03;

  ctx.save();
  for (const anchor of REAL_SIGNAL_ANCHORS) {
    const grad = ctx.createRadialGradient(anchor.x, anchor.y, 10, anchor.x, anchor.y, 180);
    grad.addColorStop(0, `rgba(16, 185, 129, ${pulse * vis * 1.5})`);
    grad.addColorStop(1, "rgba(16, 185, 129, 0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.arc(anchor.x, anchor.y, 180, anchor.rot - 0.45, anchor.rot + 0.45);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgba(16, 185, 129, ${0.25 * vis})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Banner de Decisión en Vivo de la IA                                 */
/* ------------------------------------------------------------------ */

function drawDecisionBanner(ctx: CanvasRenderingContext2D, engine: TrafficEngine) {
  const topDecision = engine.decisions[0];
  const isFailSafe = engine.failSafe;
  const isEmergency = engine.emergency;

  ctx.save();
  const bannerY = S - 72;
  const bannerH = 54;

  // Fondo del banner translúcido con borde tecnológico
  ctx.fillStyle = isFailSafe
    ? "rgba(153, 27, 27, 0.88)"
    : isEmergency
      ? "rgba(185, 28, 28, 0.90)"
      : "rgba(15, 23, 42, 0.85)";
  ctx.strokeStyle = isFailSafe ? "#ef4444" : isEmergency ? "#f87171" : "rgba(16, 185, 129, 0.6)";
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.roundRect(20, bannerY, S - 40, bannerH, 8);
  ctx.fill();
  ctx.stroke();

  // Icono de estado
  const iconColor = isFailSafe ? "#ef4444" : isEmergency ? "#ffffff" : "#10b981";
  ctx.fillStyle = iconColor;
  ctx.beginPath();
  ctx.arc(36, bannerY + 18, 5, 0, Math.PI * 2);
  ctx.fill();

  // Título de la decisión
  ctx.font = "bold 11px 'JetBrains Mono', monospace";
  ctx.fillStyle = isFailSafe ? "#fca5a5" : "#10b981";
  const axisText = engine.axis === "NS" ? "AV. SAN MARTÍN (N-S)" : "CALLE URQUIZA (E-O)";
  const modeText = isFailSafe
    ? "FAIL-SAFE ACTIVO (CICLO FIJO PREGRABADO 22s)"
    : isEmergency
      ? "CORREDOR DE EMERGENCIA SAME 3F HABILITADO"
      : `CONTROLADOR ADAPTATIVO AMEGHINO · VERDE: ${axisText}`;

  ctx.fillText(modeText, 48, bannerY + 22);

  // Razón de la decisión
  const rationale = topDecision?.rationale || "Evaluando densidad de flujo en tiempo real...";
  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.fillStyle = "rgba(241, 245, 249, 0.95)";
  const truncated = rationale.length > 95 ? `${rationale.substring(0, 95)}...` : rationale;
  ctx.fillText(truncated, 36, bannerY + 42);

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Telemetría HUD Superior                                            */
/* ------------------------------------------------------------------ */

function drawHudTelemetry(ctx: CanvasRenderingContext2D, engine: TrafficEngine, nowMs: number) {
  ctx.save();
  ctx.font = "bold 10.5px 'JetBrains Mono', monospace";

  const isFailSafe = engine.failSafe;
  const h = Math.floor(engine.hour) % 24;
  const m = Math.floor((engine.hour % 1) * 60);
  const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  // Badge Superior Izquierdo: Estado del Sistema
  const leftW = 280;
  ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
  ctx.strokeStyle = isFailSafe ? "#ef4444" : "rgba(16, 185, 129, 0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(18, 18, leftW, 30, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isFailSafe ? "#ef4444" : "#10b981";
  ctx.fillText(
    `● CASEROS 3F · ${timeStr} · ${isFailSafe ? "FAIL-SAFE" : "EDGE AI JETSON"}`,
    28,
    37,
  );

  // Badge Superior Derecho: Métricas de Percepción
  const detRate = `${(engine.detectionRate * 100).toFixed(0)}%`;
  const rightText = `YOLOv11: ${detRate} Conf · Clima: ${engine.weather.toUpperCase()}`;
  const textW = ctx.measureText(rightText).width;
  const rightW = textW + 24;

  ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
  ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
  ctx.beginPath();
  ctx.roundRect(S - 18 - rightW, 18, rightW, 30, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(rightText, S - 18 - rightW + 12, 37);

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Función Principal de Renderizado del Escenario                     */
/* ------------------------------------------------------------------ */

export function drawScene(
  ctx: CanvasRenderingContext2D,
  engine: TrafficEngine,
  nowMs: number,
  opts: DrawOptions = DEFAULT_DRAW_OPTIONS,
) {
  ctx.clearRect(0, 0, S, S);

  // 1. Dibujar Imagen Real de Caseros de Fondo (Día o Noche)
  const bgImg = getRealBgImage(engine.night);
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, S, S);
  } else {
    // Fondo de contingencia si la imagen aún carga
    ctx.fillStyle = engine.night ? "#0a0d14" : "#1e2430";
    ctx.fillRect(0, 0, S, S);
  }

  // 2. Efectos Climáticos sobre el Entorno Real
  if (engine.weather === "rain") drawRainEffect(ctx, nowMs);
  if (engine.weather === "fog") drawFogEffect(ctx, nowMs);

  // 3. Conos de Visión de las Cámaras Jetson Orin Nano
  if (opts.cameras) {
    drawCameraCones(ctx, engine, nowMs);
  }

  // 4. Rótulos de Calles
  if (opts.labels) {
    drawStreetLabels(ctx);
  }

  // 5. Dibujar Vehículos Fotorrealistas con Física y Trayectoria Real
  const renderOpts = {
    night: engine.night,
    fog: engine.weather === "fog",
    rain: engine.weather === "rain",
    nowMs,
  };

  for (const v of engine.vehicles) {
    const transform = getVehicleRealTransform(v.approach, v.p);
    drawDetailedVehicle(ctx, v, transform.x, transform.y, transform.angle, renderOpts);

    // Capa de Detección YOLOv11 en Tiempo Real
    if (opts.analysis && !engine.cameraOffline && v.p > 80 && v.p < 540) {
      const speedKmH = v.speed * 4.2;
      const boxW = v.kind === "bus" ? 48 : v.kind === "moto" ? 22 : 32;
      const boxH = v.kind === "bus" ? 36 : v.kind === "moto" ? 20 : 26;
      drawDetailedYoloBox(ctx, v, transform.x, transform.y, boxW, boxH, speedKmH);
    }
  }

  // 6. Dibujar Peatones Animados sobre las Sendas
  for (const p of engine.pedestrians) {
    const pos = getPedestrianRealPos(p.crossAxis, p.side, p.p);
    drawDetailedPedestrian(ctx, p, pos.x, pos.y, { nowMs, analysis: opts.analysis });
  }

  // 7. Dibujar Semáforos Inteligentes Fotorrealistas con Óptica LED y Bloom
  for (const anchor of REAL_SIGNAL_ANCHORS) {
    const signalState = engine.signalFor(anchor.approach);
    drawDetailedTrafficSignal(ctx, anchor.x, anchor.y, signalState, anchor.rot, {
      night: engine.night,
      fog: engine.weather === "fog",
      isFailSafe: engine.failSafe,
    });
  }

  // 8. Capa de Telemetría HUD y Banner de Decisión de IA
  if (opts.hud) {
    drawDecisionBanner(ctx, engine);
    drawHudTelemetry(ctx, engine, nowMs);
  }
}
