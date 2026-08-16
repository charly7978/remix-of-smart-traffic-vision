/**
 * Renderizador Isométrico 3D de Ultra-Alta Fidelidad para el Gemelo Digital de Caseros.
 * Proyecto Carlos Ameghino — Municipalidad de Tres de Febrero.
 *
 * Construye vehículos tridimensionales en proyección isométrica (chasis volumétrico,
 * cabinas inclinadas con reflejos de cielo, livreas oficiales de Colectivos 343/181,
 * balizas SAME 3F con destellos dinámicos, peatones 3D y semáforos LED fotorrealistas).
 */

import { KIND_LABEL_ES, type Pedestrian, type Vehicle } from "@/lib/traffic/engine";

/* ------------------------------------------------------------------ */
/* Utilidades de Sombreado de Color y Geometría 3D                     */
/* ------------------------------------------------------------------ */

function shadeColor(hex: string, factor: number): string {
  // Manejo seguro de colores hex
  let c = hex.startsWith("#") ? hex.slice(1) : hex;
  if (c.length === 3) {
    c = c[0]! + c[0]! + c[1]! + c[1]! + c[2]! + c[2]!;
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return hex;

  const r = Math.min(255, Math.max(0, Math.round(((num >> 16) & 255) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((num >> 8) & 255) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((num & 255) * factor)));
  return `rgb(${r},${g},${b})`;
}

export interface Render3DOptions {
  night: boolean;
  fog: boolean;
  rain: boolean;
  nowMs: number;
}

/* ------------------------------------------------------------------ */
/* Renderizado de Vehículos Isométricos 3D                             */
/* ------------------------------------------------------------------ */

/**
 * Dibuja un vehículo tridimensional con volumen isométrico real,
 * respetando el ángulo de la avenida y el punto de vista aéreo de Caseros.
 */
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

  // Dimensiones del vehículo (Largo, Ancho, Alto de Chasis, Alto de Cabina)
  let L = 38;
  let W = 18;
  let H_body = 8;
  let H_cabin = 7;

  if (v.kind === "bus") {
    L = 68;
    W = 22;
    H_body = 12;
    H_cabin = 10;
  } else if (v.kind === "truck") {
    L = 58;
    W = 20;
    H_body = 10;
    H_cabin = 12;
  } else if (v.kind === "ambulance") {
    L = 46;
    W = 20;
    H_body = 10;
    H_cabin = 9;
  } else if (v.kind === "moto") {
    L = 22;
    W = 10;
    H_body = 6;
    H_cabin = 6;
  }

  // Vectores directores en el plano del asfalto
  const cosH = Math.cos(headingAngle);
  const sinH = Math.sin(headingAngle);
  // Vector normal hacia la derecha del vehículo
  const normX = -sinH;
  const normY = cosH;

  // 1. Sombra de Contacto Proyectada en el Asfalto (Skew hacia abajo-derecha por el sol)
  ctx.save();
  ctx.fillStyle = "rgba(10, 15, 22, 0.65)";
  ctx.beginPath();
  const shadowOffX = 5;
  const shadowOffY = 8;
  const sP1 = {
    x: (cosH * L) / 2 - (normX * W) / 2 + shadowOffX,
    y: (sinH * L) / 2 - (normY * W) / 2 + shadowOffY,
  };
  const sP2 = {
    x: (cosH * L) / 2 + (normX * W) / 2 + shadowOffX,
    y: (sinH * L) / 2 + (normY * W) / 2 + shadowOffY,
  };
  const sP3 = {
    x: (-cosH * L) / 2 + (normX * W) / 2 + shadowOffX,
    y: (-sinH * L) / 2 + (normY * W) / 2 + shadowOffY,
  };
  const sP4 = {
    x: (-cosH * L) / 2 - (normX * W) / 2 + shadowOffX,
    y: (-sinH * L) / 2 - (normY * W) / 2 + shadowOffY,
  };

  ctx.moveTo(sP1.x, sP1.y);
  ctx.lineTo(sP2.x, sP2.y);
  ctx.lineTo(sP3.x, sP3.y);
  ctx.lineTo(sP4.x, sP4.y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 2. Faros Delanteros Volumétricos sobre el Asfalto
  if (isLowLight) {
    const beamLen = isLowLight ? 130 : 70;
    const beamSpread = 32;
    const frontCenterX = (cosH * L) / 2;
    const frontCenterY = (sinH * L) / 2;

    const drawBeam = (offMult: number) => {
      const startX = frontCenterX + normX * (W * 0.32 * offMult);
      const startY = frontCenterY + normY * (W * 0.32 * offMult);
      const endX = startX + cosH * beamLen;
      const endY = startY + sinH * beamLen;

      const grad = ctx.createRadialGradient(startX, startY, 4, endX, endY, beamSpread);
      grad.addColorStop(0, "rgba(255, 245, 210, 0.42)");
      grad.addColorStop(0.4, "rgba(255, 245, 210, 0.15)");
      grad.addColorStop(1, "rgba(255, 245, 210, 0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX - normX * beamSpread, endY - normY * beamSpread);
      ctx.lineTo(endX + normX * beamSpread, endY + normY * beamSpread);
      ctx.closePath();
      ctx.fill();
    };

    if (v.kind === "moto") {
      drawBeam(0);
    } else {
      drawBeam(-1);
      drawBeam(1);
    }
  }

  // 3. Renderizado del Cuerpo 3D según Tipo
  const baseColor = v.color || "#2563eb";

  if (v.kind === "bus") {
    // -------------------------------------------------------------
    // COLECTIVO 3D BONAERENSE (Línea 343 Caseros / Línea 181)
    // -------------------------------------------------------------
    const isLine343 = v.id % 2 === 0;
    const busColor = isLine343 ? "#0f3460" : "#991b1b"; // Azul oscuro 343 o Rojo 181
    const stripeColor = isLine343 ? "#e11d48" : "#f8fafc";
    const totalH = H_body + H_cabin;

    // Vértices de la base del chasis (Z = 0)
    const b1 = { x: (cosH * L) / 2 - (normX * W) / 2, y: (sinH * L) / 2 - (normY * W) / 2 };
    const b2 = { x: (cosH * L) / 2 + (normX * W) / 2, y: (sinH * L) / 2 + (normY * W) / 2 };
    const b3 = { x: (-cosH * L) / 2 + (normX * W) / 2, y: (-sinH * L) / 2 + (normY * W) / 2 };
    const b4 = { x: (-cosH * L) / 2 - (normX * W) / 2, y: (-sinH * L) / 2 - (normY * W) / 2 };

    // Vértices del techo del colectivo (Z = totalH)
    const t1 = { x: b1.x, y: b1.y - totalH };
    const t2 = { x: b2.x, y: b2.y - totalH };
    const t3 = { x: b3.x, y: b3.y - totalH };
    const t4 = { x: b4.x, y: b4.y - totalH };

    // Cara lateral visible
    ctx.fillStyle = shadeColor(busColor, 0.78);
    ctx.beginPath();
    ctx.moveTo(b2.x, b2.y);
    ctx.lineTo(b3.x, b3.y);
    ctx.lineTo(t3.x, t3.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.closePath();
    ctx.fill();

    // Franja lateral distintiva en la cara lateral
    ctx.fillStyle = stripeColor;
    ctx.beginPath();
    ctx.moveTo(b2.x, b2.y - totalH * 0.4);
    ctx.lineTo(b3.x, b3.y - totalH * 0.4);
    ctx.lineTo(b3.x, b3.y - totalH * 0.55);
    ctx.lineTo(b2.x, b2.y - totalH * 0.55);
    ctx.closePath();
    ctx.fill();

    // Ventanillas iluminadas en la cara lateral
    const numWins = 5;
    for (let i = 0; i < numWins; i++) {
      const fracA = 0.15 + (i * 0.7) / numWins;
      const fracB = fracA + 0.1;
      const wA_b = {
        x: b2.x + (b3.x - b2.x) * fracA,
        y: b2.y + (b3.y - b2.y) * fracA - totalH * 0.6,
      };
      const wB_b = {
        x: b2.x + (b3.x - b2.x) * fracB,
        y: b2.y + (b3.y - b2.y) * fracB - totalH * 0.6,
      };
      const wB_t = { x: wB_b.x, y: wB_b.y - totalH * 0.28 };
      const wA_t = { x: wA_b.x, y: wA_b.y - totalH * 0.28 };

      ctx.fillStyle = isLowLight ? "rgba(254, 240, 138, 0.75)" : "rgba(186, 230, 253, 0.65)";
      ctx.beginPath();
      ctx.moveTo(wA_b.x, wA_b.y);
      ctx.lineTo(wB_b.x, wB_b.y);
      ctx.lineTo(wB_t.x, wB_t.y);
      ctx.lineTo(wA_t.x, wA_t.y);
      ctx.closePath();
      ctx.fill();
    }

    // Cara frontal del colectivo
    ctx.fillStyle = shadeColor(busColor, 0.95);
    ctx.beginPath();
    ctx.moveTo(b1.x, b1.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.lineTo(t1.x, t1.y);
    ctx.closePath();
    ctx.fill();

    // Parabrisas frontal panorámico
    ctx.fillStyle = "rgba(147, 197, 253, 0.85)";
    ctx.beginPath();
    ctx.moveTo(b1.x + (b2.x - b1.x) * 0.1, b1.y + (b2.y - b1.y) * 0.1 - totalH * 0.45);
    ctx.lineTo(b1.x + (b2.x - b1.x) * 0.9, b1.y + (b2.y - b1.y) * 0.9 - totalH * 0.45);
    ctx.lineTo(b1.x + (b2.x - b1.x) * 0.9, b1.y + (b2.y - b1.y) * 0.9 - totalH * 0.85);
    ctx.lineTo(b1.x + (b2.x - b1.x) * 0.1, b1.y + (b2.y - b1.y) * 0.1 - totalH * 0.85);
    ctx.closePath();
    ctx.fill();

    // Cartelera LED de Línea (Frontal Superior)
    ctx.fillStyle = "#020617";
    ctx.fillRect(t1.x + (t2.x - t1.x) * 0.15, t1.y + (t2.y - t1.y) * 0.15 + 1.5, W * 0.7, 4.5);
    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 5px 'JetBrains Mono', monospace";
    ctx.fillText(isLine343 ? "343 CASEROS" : "181 R.MEJIA", t1.x + 2, t1.y + 5);

    // Techo del colectivo (Cara Superior)
    ctx.fillStyle = shadeColor(busColor, 1.15);
    ctx.beginPath();
    ctx.moveTo(t1.x, t1.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.lineTo(t3.x, t3.y);
    ctx.lineTo(t4.x, t4.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Unidad de Aire Acondicionado en el techo
    ctx.fillStyle = "#e2e8f0";
    const ac1 = { x: t1.x + (t3.x - t1.x) * 0.35, y: t1.y + (t3.y - t1.y) * 0.35 - 3 };
    const ac2 = { x: t1.x + (t3.x - t1.x) * 0.65, y: t1.y + (t3.y - t1.y) * 0.65 - 3 };
    ctx.fillRect(ac1.x, ac1.y, 14, 5);
  } else if (v.kind === "ambulance") {
    // -------------------------------------------------------------
    // AMBULANCIA SAME 3F (Mercedes Sprinter / Renault Master 3D)
    // -------------------------------------------------------------
    const ambColor = "#f8fafc";
    const totalH = H_body + H_cabin;

    const b1 = { x: (cosH * L) / 2 - (normX * W) / 2, y: (sinH * L) / 2 - (normY * W) / 2 };
    const b2 = { x: (cosH * L) / 2 + (normX * W) / 2, y: (sinH * L) / 2 + (normY * W) / 2 };
    const b3 = { x: (-cosH * L) / 2 + (normX * W) / 2, y: (-sinH * L) / 2 + (normY * W) / 2 };
    const b4 = { x: (-cosH * L) / 2 - (normX * W) / 2, y: (-sinH * L) / 2 - (normY * W) / 2 };

    const t1 = { x: b1.x, y: b1.y - totalH };
    const t2 = { x: b2.x, y: b2.y - totalH };
    const t3 = { x: b3.x, y: b3.y - totalH };
    const t4 = { x: b4.x, y: b4.y - totalH };

    // Cara lateral
    ctx.fillStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.moveTo(b2.x, b2.y);
    ctx.lineTo(b3.x, b3.y);
    ctx.lineTo(t3.x, t3.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.closePath();
    ctx.fill();

    // Franja reflectiva verde SAME en el lateral
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.moveTo(b2.x, b2.y - totalH * 0.35);
    ctx.lineTo(b3.x, b3.y - totalH * 0.35);
    ctx.lineTo(b3.x, b3.y - totalH * 0.55);
    ctx.lineTo(b2.x, b2.y - totalH * 0.55);
    ctx.closePath();
    ctx.fill();

    // Cara frontal
    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(b1.x, b1.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.lineTo(t1.x, t1.y);
    ctx.closePath();
    ctx.fill();

    // Parabrisas
    ctx.fillStyle = "rgba(125, 211, 252, 0.85)";
    ctx.beginPath();
    ctx.moveTo(b1.x + (b2.x - b1.x) * 0.1, b1.y + (b2.y - b1.y) * 0.1 - totalH * 0.45);
    ctx.lineTo(b1.x + (b2.x - b1.x) * 0.9, b1.y + (b2.y - b1.y) * 0.9 - totalH * 0.45);
    ctx.lineTo(b1.x + (b2.x - b1.x) * 0.85, b1.y + (b2.y - b1.y) * 0.85 - totalH * 0.82);
    ctx.lineTo(b1.x + (b2.x - b1.x) * 0.15, b1.y + (b2.y - b1.y) * 0.15 - totalH * 0.82);
    ctx.closePath();
    ctx.fill();

    // Techo
    ctx.fillStyle = ambColor;
    ctx.beginPath();
    ctx.moveTo(t1.x, t1.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.lineTo(t3.x, t3.y);
    ctx.lineTo(t4.x, t4.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#94a3b8";
    ctx.stroke();

    // Cruz roja y texto SAME en techo
    ctx.fillStyle = "#ef4444";
    const roofMidX = (t1.x + t3.x) / 2;
    const roofMidY = (t1.y + t3.y) / 2;
    ctx.fillRect(roofMidX - 2, roofMidY - 5, 4, 10);
    ctx.fillRect(roofMidX - 5, roofMidY - 2, 10, 4);

    // Balizas Estroboscópicas LED 3D en el techo
    const strobePhase = Math.floor(nowMs / 100) % 2 === 0;
    const colA = strobePhase ? "#ef4444" : "#3b82f6";
    const colB = strobePhase ? "#3b82f6" : "#ef4444";

    const lightbarX = (t1.x + t2.x) / 2;
    const lightbarY = (t1.y + t2.y) / 2 - 2;

    ctx.fillStyle = colA;
    ctx.shadowColor = colA;
    ctx.shadowBlur = 14;
    ctx.fillRect(lightbarX - 6, lightbarY, 5, 3.5);

    ctx.fillStyle = colB;
    ctx.shadowColor = colB;
    ctx.fillRect(lightbarX + 1, lightbarY, 5, 3.5);

    // Halo volumétrico de la baliza sobre el techo
    const halo = ctx.createRadialGradient(lightbarX, lightbarY, 2, lightbarX, lightbarY, 40);
    halo.addColorStop(0, strobePhase ? "rgba(239, 68, 68, 0.55)" : "rgba(59, 130, 246, 0.55)");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(lightbarX - 40, lightbarY - 40, 80, 80);
    ctx.shadowBlur = 0;
  } else if (v.kind === "moto") {
    // -------------------------------------------------------------
    // MOTO 3D + CONDUCTOR DELIVERY
    // -------------------------------------------------------------
    // Rueda trasera y delantera en 3D
    ctx.fillStyle = "#0f172a";
    const frontWheel = { x: cosH * L * 0.35, y: sinH * L * 0.35 };
    const rearWheel = { x: -cosH * L * 0.35, y: -sinH * L * 0.35 };
    ctx.fillRect(frontWheel.x - 2, frontWheel.y - 4, 4, 5);
    ctx.fillRect(rearWheel.x - 2, rearWheel.y - 4, 4, 5);

    // Chasis de la moto
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.moveTo(rearWheel.x, rearWheel.y - 3);
    ctx.lineTo(frontWheel.x, frontWheel.y - 5);
    ctx.lineTo(frontWheel.x, frontWheel.y - 8);
    ctx.lineTo(rearWheel.x, rearWheel.y - 7);
    ctx.closePath();
    ctx.fill();

    // Conductor (Chaqueta y Casco en 3D)
    ctx.fillStyle = "#334155";
    ctx.fillRect(-3, -12, 6, 7);

    // Casco
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(0, -15, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Visor oscuro
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(cosH * 2, -16 + sinH * 1, 2.5, 2.5);

    // Mochila térmica de delivery
    ctx.fillStyle = v.id % 2 === 0 ? "#dc2626" : "#ea580c";
    ctx.fillRect(rearWheel.x - 3, rearWheel.y - 14, 7, 7);
  } else {
    // -------------------------------------------------------------
    // SEDÁN / SUV FAMILIAR 3D
    // -------------------------------------------------------------
    const b1 = { x: (cosH * L) / 2 - (normX * W) / 2, y: (sinH * L) / 2 - (normY * W) / 2 };
    const b2 = { x: (cosH * L) / 2 + (normX * W) / 2, y: (sinH * L) / 2 + (normY * W) / 2 };
    const b3 = { x: (-cosH * L) / 2 + (normX * W) / 2, y: (-sinH * L) / 2 + (normY * W) / 2 };
    const b4 = { x: (-cosH * L) / 2 - (normX * W) / 2, y: (-sinH * L) / 2 - (normY * W) / 2 };

    // Capó / Chasis (Z = H_body)
    const h1 = { x: b1.x, y: b1.y - H_body };
    const h2 = { x: b2.x, y: b2.y - H_body };
    const h3 = { x: b3.x, y: b3.y - H_body };
    const h4 = { x: b4.x, y: b4.y - H_body };

    // Cara lateral inferior
    ctx.fillStyle = shadeColor(baseColor, 0.75);
    ctx.beginPath();
    ctx.moveTo(b2.x, b2.y);
    ctx.lineTo(b3.x, b3.y);
    ctx.lineTo(h3.x, h3.y);
    ctx.lineTo(h2.x, h2.y);
    ctx.closePath();
    ctx.fill();

    // Cara frontal inferior (Paragolpes y Parrilla)
    ctx.fillStyle = shadeColor(baseColor, 0.95);
    ctx.beginPath();
    ctx.moveTo(b1.x, b1.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.lineTo(h2.x, h2.y);
    ctx.lineTo(h1.x, h1.y);
    ctx.closePath();
    ctx.fill();

    // Capó y Techo (Plano Superior Z = H_body)
    ctx.fillStyle = shadeColor(baseColor, 1.15);
    ctx.beginPath();
    ctx.moveTo(h1.x, h1.y);
    ctx.lineTo(h2.x, h2.y);
    ctx.lineTo(h3.x, h3.y);
    ctx.lineTo(h4.x, h4.y);
    ctx.closePath();
    ctx.fill();

    // Cabina Inclinada con Vidrios Reflejantes (Z = H_body + H_cabin)
    const cabW = W * 0.76;
    const cabL = L * 0.52;
    const totalH = H_body + H_cabin;

    const cRoof1 = {
      x: (cosH * cabL) / 2 - (normX * cabW) / 2,
      y: (sinH * cabL) / 2 - (normY * cabW) / 2 - totalH,
    };
    const cRoof2 = {
      x: (cosH * cabL) / 2 + (normX * cabW) / 2,
      y: (sinH * cabL) / 2 + (normY * cabW) / 2 - totalH,
    };
    const cRoof3 = {
      x: (-cosH * cabL) / 2 + (normX * cabW) / 2,
      y: (-sinH * cabL) / 2 + (normY * cabW) / 2 - totalH,
    };
    const cRoof4 = {
      x: (-cosH * cabL) / 2 - (normX * cabW) / 2,
      y: (-sinH * cabL) / 2 - (normY * cabW) / 2 - totalH,
    };

    // Parabrisas delantero inclinado
    const frontWindshield = ctx.createLinearGradient(h1.x, h1.y, cRoof1.x, cRoof1.y);
    frontWindshield.addColorStop(0, "rgba(147, 197, 253, 0.75)");
    frontWindshield.addColorStop(1, "rgba(224, 242, 254, 0.95)");
    ctx.fillStyle = frontWindshield;
    ctx.beginPath();
    ctx.moveTo(h1.x + (h2.x - h1.x) * 0.12, h1.y + (h2.y - h1.y) * 0.12);
    ctx.lineTo(h1.x + (h2.x - h1.x) * 0.88, h1.y + (h2.y - h1.y) * 0.88);
    ctx.lineTo(cRoof2.x, cRoof2.y);
    ctx.lineTo(cRoof1.x, cRoof1.y);
    ctx.closePath();
    ctx.fill();

    // Ventanilla lateral de la cabina
    ctx.fillStyle = "rgba(125, 211, 252, 0.65)";
    ctx.beginPath();
    ctx.moveTo(h2.x, h2.y);
    ctx.lineTo(h3.x, h3.y);
    ctx.lineTo(cRoof3.x, cRoof3.y);
    ctx.lineTo(cRoof2.x, cRoof2.y);
    ctx.closePath();
    ctx.fill();

    // Techo del habitáculo
    ctx.fillStyle = shadeColor(baseColor, 1.25);
    ctx.beginPath();
    ctx.moveTo(cRoof1.x, cRoof1.y);
    ctx.lineTo(cRoof2.x, cRoof2.y);
    ctx.lineTo(cRoof3.x, cRoof3.y);
    ctx.lineTo(cRoof4.x, cRoof4.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // 4. Faros Delanteros y Luces Traseras de Frenado
  if (isLowLight && v.kind !== "moto") {
    ctx.fillStyle = "#fffbeb";
    ctx.shadowColor = "#fef08a";
    ctx.shadowBlur = 10;
    const frontL = {
      x: (cosH * L) / 2 - normX * W * 0.35,
      y: (sinH * L) / 2 - normY * W * 0.35 - H_body * 0.5,
    };
    const frontR = {
      x: (cosH * L) / 2 + normX * W * 0.35,
      y: (sinH * L) / 2 + normY * W * 0.35 - H_body * 0.5,
    };
    ctx.fillRect(frontL.x - 1.5, frontL.y - 1.5, 3, 3);
    ctx.fillRect(frontR.x - 1.5, frontR.y - 1.5, 3, 3);
    ctx.shadowBlur = 0;
  }

  // Luces de Freno Traseras (Rojo Intenso con Halo si frena)
  if (v.kind !== "moto") {
    const rearL = {
      x: (-cosH * L) / 2 - normX * W * 0.35,
      y: (-sinH * L) / 2 - normY * W * 0.35 - H_body * 0.5,
    };
    const rearR = {
      x: (-cosH * L) / 2 + normX * W * 0.35,
      y: (-sinH * L) / 2 + normY * W * 0.35 - H_body * 0.5,
    };

    const stopColor = isBraking ? "#ef4444" : "#991b1b";
    ctx.fillStyle = stopColor;
    if (isBraking) {
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 12;
    }
    ctx.fillRect(rearL.x - 1.5, rearL.y - 1.5, 3, 3);
    ctx.fillRect(rearR.x - 1.5, rearR.y - 1.5, 3, 3);
    ctx.shadowBlur = 0;
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
    // -------------------------------------------------------------
    // PEATÓN CON MOVILIDAD REDUCIDA (Silla de Ruedas 3D)
    // -------------------------------------------------------------
    // Rueda izquierda y derecha de la silla
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
    // -------------------------------------------------------------
    // PEATÓN ESTÁNDAR 3D CON CICLO DE MARCHA
    // -------------------------------------------------------------
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

    // Torso (Ropa de color)
    const shirt = p.id % 2 === 0 ? "#dc2626" : "#2563eb";
    ctx.fillStyle = shirt;
    ctx.fillRect(-2.5, -11, 5, 6);

    // Brazos en balanceo
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-2.5, -10);
    ctx.lineTo(-2.5 - legOffset * 0.8, -6);
    ctx.moveTo(2.5, -10);
    ctx.lineTo(2.5 + legOffset * 0.8, -6);
    ctx.stroke();

    // Cabeza y Cabello
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

  // 4. Cabezal de Semáforo Compacto (Alto 22px, Ancho 10px)
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
      // Halo / Bloom LED volumétrico
      const haloR = opts.fog ? 24 : opts.night ? 18 : 12;
      const halo = ctx.createRadialGradient(headX, cy, 1, headX, cy, haloR);
      halo.addColorStop(0, `${baseColor}aa`);
      halo.addColorStop(0.5, `${baseColor}33`);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(headX - haloR, cy - haloR, haloR * 2, haloR * 2);

      // Lente Encendida con Núcleo Brillante
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(headX, cy, 2.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(headX - 0.8, cy - 0.8, 1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Lente Apagada
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(headX, cy, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Gabinete de Borde Jetson Orin Nano montado en el poste
  ctx.fillStyle = "#0f172a";
  ctx.strokeStyle = opts.isFailSafe ? "#ef4444" : "#10b981";
  ctx.lineWidth = 1;
  ctx.fillRect(-4, -14, 8, 8);
  ctx.strokeRect(-4, -14, 8, 8);

  // LED de estado del procesador
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
  ctx.translate(x, y - 10); // Centrado en la cabina del vehículo

  const w = v.kind === "bus" ? 44 : v.kind === "moto" ? 22 : 30;
  const h = v.kind === "bus" ? 28 : v.kind === "moto" ? 18 : 22;

  // Marco de Detección con Retículas en Esquinas
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

  // Etiqueta de Telemetría YOLO
  let className = KIND_LABEL_ES[v.kind] || v.kind;
  if (v.kind === "bus") className = "Línea 343";
  else if (v.kind === "ambulance") className = "SAME 3F";

  const tagText = `${className} · ${(conf * 100).toFixed(0)}% · ${Math.round(speedKmH)} km/h`;
  ctx.font = "bold 8.5px 'JetBrains Mono', monospace";
  const textW = ctx.measureText(tagText).width;

  ctx.fillStyle = isEmergency ? "rgba(239, 68, 68, 0.95)" : "rgba(15, 23, 42, 0.88)";
  ctx.fillRect(-w / 2, -h / 2 - 12, textW + 6, 11);

  ctx.fillStyle = accentColor;
  ctx.fillRect(-w / 2, -h / 2 - 12, (textW + 6) * conf, 1.5);

  ctx.fillStyle = "#ffffff";
  ctx.fillText(tagText, -w / 2 + 3, -h / 2 - 3.5);

  ctx.restore();
}
