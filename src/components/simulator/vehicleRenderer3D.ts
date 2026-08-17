/**
 * Renderizador Isométrico 3D de Ultra-Alta Fidelidad para el Gemelo Digital de Caseros.
 * Proyecto Carlos Ameghino — Municipalidad de Tres de Febrero.
 *
 * Utiliza sprites fotorrealistas pre-renderizados con chroma-keying en tiempo real
 * para eliminar fondos blancos, logrando una integración perfecta con la calzada.
 */

import { KIND_LABEL_ES, type Pedestrian, type Vehicle } from "@/lib/traffic/engine";
import { getSprite, type SpriteKind } from "@/lib/photo/spriteManager";

/* ------------------------------------------------------------------ */
/* Utilidades de Sombreado y Efectos Especiales                        */
/* ------------------------------------------------------------------ */

export interface Render3DOptions {
  night: boolean;
  fog: boolean;
  rain: boolean;
  nowMs: number;
}

/* ------------------------------------------------------------------ */
/* Renderizado de Vehículos Isométricos Fotorrealistas                 */
/* ------------------------------------------------------------------ */

export function drawIsometricVehicle(
  ctx: CanvasRenderingContext2D,
  v: Vehicle,
  x: number,
  y: number,
  headingAngle: number,
  opts: Render3DOptions,
) {
  const { night, fog, rain, nowMs } = opts;
  const isLowLight = night || fog || rain;
  const isBraking = v.speed < 4 && !v.crossed;

  ctx.save();
  ctx.translate(x, y);

  // Rotar el canvas para que el sprite mire en la dirección del vehículo
  // headingAngle 0 apunta hacia el este.
  // Nuestros sprites generados apuntan hacia ARRIBA (norte) o hacia ABAJO.
  // Asumiendo que el sprite original mira hacia arriba (Norte):
  // Hay que sumar Math.PI / 2 al heading angle para alinearlo.
  ctx.rotate(headingAngle + Math.PI / 2);

  // Mapear el tipo de vehículo al SpriteKind
  let spriteKind: SpriteKind = "car";
  let L = 45; // Longitud base para escalar
  let W = 20;

  if (v.kind === "bus") {
    spriteKind = "bus";
    L = 90;
    W = 26;
  } else if (v.kind === "truck") {
    spriteKind = "bus"; // Fallback a bus por ahora
    L = 75;
    W = 24;
  } else if (v.kind === "ambulance") {
    spriteKind = "ambulance";
    L = 55;
    W = 22;
  } else if (v.kind === "moto") {
    spriteKind = "motorcycle";
    L = 25;
    W = 12;
  }

  const sprite = getSprite(spriteKind);

  if (sprite) {
    // 1. Sombra de contacto realista (duplicar sprite en negro y difuminar)
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.filter = "blur(4px)";
    // Offset de la sombra según el "sol" (asimétrico)
    ctx.drawImage(sprite, -W / 2 + 3, -L / 2 + 5, W, L);
    ctx.restore();

    // 2. Dibujar el sprite fotorrealista principal
    ctx.save();
    if (night) {
      // De noche oscurecemos ligeramente la textura del vehículo
      ctx.filter = "brightness(0.7) contrast(1.2)";
    }
    ctx.drawImage(sprite, -W / 2, -L / 2, W, L);
    ctx.restore();

    // Si es moto, ajustamos para no dibujar faros anchos
    const isMoto = v.kind === "moto";

    // 3. Faros Delanteros Volumétricos sobre el Asfalto (Sólo en baja luz)
    if (isLowLight) {
      const beamLen = isLowLight ? 140 : 80;
      const beamSpread = 35;

      const drawBeam = (offX: number) => {
        // Los faros están en el frente (y = -L/2)
        const startX = offX;
        const startY = -L / 2 + 2;
        const endX = startX;
        const endY = startY - beamLen;

        const grad = ctx.createLinearGradient(startX, startY, endX, endY);
        grad.addColorStop(0, "rgba(255, 245, 210, 0.5)");
        grad.addColorStop(0.3, "rgba(255, 245, 210, 0.15)");
        grad.addColorStop(1, "rgba(255, 245, 210, 0)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX - beamSpread, endY);
        ctx.lineTo(endX + beamSpread, endY);
        ctx.closePath();
        ctx.fill();
      };

      if (isMoto) {
        drawBeam(0);
      } else {
        drawBeam(-W * 0.35); // Faro izquierdo
        drawBeam(W * 0.35); // Faro derecho
      }
    }

    // 4. Luces de Freno Traseras (Rojo Intenso con Halo si frena)
    if (!isMoto) {
      const stopColor = isBraking ? "#ef4444" : "#991b1b";
      ctx.fillStyle = stopColor;
      if (isBraking) {
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 15;
      }
      // Trasera (y = L/2)
      ctx.fillRect(-W * 0.35 - 1.5, L / 2 - 3, 3, 2);
      ctx.fillRect(W * 0.35 - 1.5, L / 2 - 3, 3, 2);
      ctx.shadowBlur = 0;
    }

    // 5. Balizas Estroboscópicas LED (Ambulancia SAME)
    if (v.kind === "ambulance") {
      const strobePhase = Math.floor(nowMs / 100) % 2 === 0;
      const colA = strobePhase ? "#ef4444" : "#3b82f6";
      const colB = strobePhase ? "#3b82f6" : "#ef4444";

      // Balizas en el techo (aprox centro)
      const lightbarY = -L * 0.1;

      ctx.fillStyle = colA;
      ctx.shadowColor = colA;
      ctx.shadowBlur = 14;
      ctx.fillRect(-W * 0.3, lightbarY, 6, 3);

      ctx.fillStyle = colB;
      ctx.shadowColor = colB;
      ctx.fillRect(W * 0.3 - 6, lightbarY, 6, 3);

      // Halo volumétrico perimetral
      const halo = ctx.createRadialGradient(0, lightbarY, 2, 0, lightbarY, 45);
      halo.addColorStop(0, strobePhase ? "rgba(239, 68, 68, 0.6)" : "rgba(59, 130, 246, 0.6)");
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(-45, lightbarY - 45, 90, 90);
      ctx.shadowBlur = 0;
    }
  } else {
    // Fallback: Si el sprite no cargó, dibujar un rectángulo de emergencia
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(-W / 2, -L / 2, W, L);
  }

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Renderizado de Peatones Isométricos 3D                             */
/* ------------------------------------------------------------------ */

export function drawIsometricPedestrian(
  ctx: CanvasRenderingContext2D,
  p: Pedestrian,
  x: number,
  y: number,
  opts: { nowMs: number; analysis: boolean },
) {
  const { nowMs } = opts;
  const walkGait = p.waiting ? 0 : Math.sin(nowMs / 130 + p.id * 2.5);

  ctx.save();
  ctx.translate(x, y);

  // Sombra en el suelo
  ctx.fillStyle = "rgba(15, 23, 42, 0.45)";
  ctx.beginPath();
  ctx.ellipse(0, 1.5, 4.5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (p.reduced) {
    // Silla de Ruedas 3D
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(-2, -4, 4.5, 0, Math.PI * 2);
    ctx.stroke();

    // Asiento
    ctx.fillStyle = "#0284c7";
    ctx.fillRect(-3, -8, 6, 5);

    // Torso y Cabeza
    ctx.fillStyle = "#fbcfe8";
    ctx.beginPath();
    ctx.arc(0, -11, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // PEATÓN ESTÁNDAR 3D CON CICLO DE MARCHA
    const legOffset = walkGait * 2.5;

    // Piernas
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(legOffset, 0);
    ctx.moveTo(0, -5);
    ctx.lineTo(-legOffset, 0);
    ctx.stroke();

    // Torso
    const shirt = p.id % 2 === 0 ? "#dc2626" : "#2563eb";
    ctx.fillStyle = shirt;
    ctx.fillRect(-2.5, -11, 5, 6);

    // Brazos
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-2.5, -10);
    ctx.lineTo(-2.5 - legOffset * 0.8, -6);
    ctx.moveTo(2.5, -10);
    ctx.lineTo(2.5 + legOffset * 0.8, -6);
    ctx.stroke();

    // Cabeza
    ctx.fillStyle = "#fed7aa";
    ctx.beginPath();
    ctx.arc(0, -13.5, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#451a03";
    ctx.beginPath();
    ctx.arc(0, -14.2, 2.2, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Semáforo Inteligente 3D Escalado en Poste Real                      */
/* ------------------------------------------------------------------ */

export function drawIsometricTrafficSignal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  state: "red" | "amber" | "green",
  rotRad: number,
  opts: { night: boolean; fog: boolean; isFailSafe: boolean },
) {
  ctx.save();
  ctx.translate(x, y);

  const poleHeight = 36;
  const armLen = 16;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);

  // 1. Base del poste en la vereda
  ctx.fillStyle = "rgba(15, 23, 42, 0.5)";
  ctx.beginPath();
  ctx.ellipse(0, 1.5, 4, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Columna vertical de acero
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -poleHeight);
  ctx.stroke();

  // 3. Brazo pescante horizontal hacia la calzada
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -poleHeight);
  ctx.lineTo(cosR * armLen, -poleHeight + sinR * armLen * 0.5);
  ctx.stroke();

  const headX = cosR * armLen;
  const headY = -poleHeight + sinR * armLen * 0.5;

  // 4. Cabezal de Semáforo
  ctx.fillStyle = "#0f172a";
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(headX - 5, headY, 10, 22, 3);
  ctx.fill();
  ctx.stroke();

  // 5. Ópticas LED (Rojo, Amarillo, Verde)
  const lights: ("red" | "amber" | "green")[] = ["red", "amber", "green"];
  lights.forEach((light, i) => {
    const cy = headY + 4 + i * 7;
    const isActive = state === light;

    const baseColor = light === "red" ? "#ef4444" : light === "amber" ? "#f59e0b" : "#10b981";

    if (isActive) {
      const haloR = opts.fog ? 24 : opts.night ? 18 : 12;
      const halo = ctx.createRadialGradient(headX, cy, 1, headX, cy, haloR);
      halo.addColorStop(0, `${baseColor}aa`);
      halo.addColorStop(0.5, `${baseColor}33`);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(headX - haloR, cy - haloR, haloR * 2, haloR * 2);

      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(headX, cy, 2.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(headX - 0.8, cy - 0.8, 1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(headX, cy, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Gabinete de Borde Jetson Orin Nano
  ctx.fillStyle = "#0f172a";
  ctx.strokeStyle = opts.isFailSafe ? "#ef4444" : "#10b981";
  ctx.lineWidth = 1;
  ctx.fillRect(-4, -14, 8, 8);
  ctx.strokeRect(-4, -14, 8, 8);

  ctx.fillStyle = opts.isFailSafe ? "#ef4444" : "#10b981";
  ctx.beginPath();
  ctx.arc(1.5, -10, 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Capa de Analítica YOLOv11 & Telemetría Tecnológica                  */
/* ------------------------------------------------------------------ */

export function drawIsometricYoloBox(
  ctx: CanvasRenderingContext2D,
  v: Vehicle,
  x: number,
  y: number,
  speedKmH: number,
) {
  if (v.missed) return;

  const isEmergency = v.kind === "ambulance";
  const accentColor = isEmergency ? "#ef4444" : "#10b981";
  const conf = v.conf || 0.98;

  ctx.save();
  ctx.translate(x, y - 5);

  const w = v.kind === "bus" ? 44 : v.kind === "moto" ? 22 : 30;
  const h = v.kind === "bus" ? 28 : v.kind === "moto" ? 18 : 22;

  // Marco de Detección
  ctx.strokeStyle = `${accentColor}77`;
  ctx.lineWidth = 1;
  ctx.strokeRect(-w / 2, -h / 2, w, h);

  const k = 4;
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.6;

  // Esquina Sup-Izq
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2 + k);
  ctx.lineTo(-w / 2, -h / 2);
  ctx.lineTo(-w / 2 + k, -h / 2);
  ctx.stroke();

  // Esquina Sup-Der
  ctx.beginPath();
  ctx.moveTo(w / 2 - k, -h / 2);
  ctx.lineTo(w / 2, -h / 2);
  ctx.lineTo(w / 2, -h / 2 + k);
  ctx.stroke();

  // Esquina Inf-Izq
  ctx.beginPath();
  ctx.moveTo(-w / 2, h / 2 - k);
  ctx.lineTo(-w / 2, h / 2);
  ctx.lineTo(-w / 2 + k, h / 2);
  ctx.stroke();

  // Esquina Inf-Der
  ctx.beginPath();
  ctx.moveTo(w / 2 - k, h / 2);
  ctx.lineTo(w / 2, h / 2);
  ctx.lineTo(w / 2, h / 2 - k);
  ctx.stroke();

  // Etiqueta HUD YOLOv11 Flotante
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2 - 16, w + 30, 14, 2);
  ctx.fill();

  ctx.font = "bold 8px 'JetBrains Mono', monospace";
  ctx.fillStyle = accentColor;
  const kindText = KIND_LABEL_ES[v.kind].toUpperCase();
  ctx.fillText(`${kindText} ${(conf * 100).toFixed(0)}%`, -w / 2 + 3, -h / 2 - 6);

  ctx.fillStyle = "#f8fafc";
  ctx.fillText(`${speedKmH.toFixed(0)} km/h`, -w / 2 + w + 3, -h / 2 - 6);

  // Vector de velocidad predictor
  if (speedKmH > 5) {
    ctx.strokeStyle = "rgba(16, 185, 129, 0.6)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    // Asumimos que el vehículo avanza en el eje X negativo de su propio sistema local tras rotar
    // Como no tenemos el heading acá, solo mostramos una flecha direccional estética
    ctx.lineTo(0, h / 2 + speedKmH * 0.4);
    ctx.stroke();
  }

  ctx.restore();
}
