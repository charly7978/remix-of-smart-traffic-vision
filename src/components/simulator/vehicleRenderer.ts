/**
 * Renderizador de alta fidelidad para vehículos, peatones, semáforos y telemetría de IA.
 * Proyecto Carlos Ameghino — Municipalidad de Tres de Febrero.
 *
 * Elimina completamente formas genéricas o cuadradas, implementando geometría
 * vehicular multicapa, llantas orientadas, reflejos de parabrisas, haces de luz
 * volumétricos, balizas estroboscópicas SAME 3F y livreas de colectivos locales.
 */

import { KIND_LABEL_ES, type Pedestrian, type Vehicle } from "@/lib/traffic/engine";

/* ------------------------------------------------------------------ */
/* Utilidades geométricas de dibujo                                    */
/* ------------------------------------------------------------------ */

function drawRoundedPolygon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, r);
}

/* ------------------------------------------------------------------ */
/* Renderizado de Vehículos Detallados                                */
/* ------------------------------------------------------------------ */

export interface RenderVehicleOptions {
  night: boolean;
  fog: boolean;
  rain: boolean;
  nowMs: number;
}

/**
 * Dibuja un vehículo con acabado automotriz de alta resolución.
 * El origen (0,0) local está en el centro del vehículo, con el eje +X apuntando
 * hacia el frente del vehículo (sentido de avance).
 */
export function drawDetailedVehicle(
  ctx: CanvasRenderingContext2D,
  v: Vehicle,
  x: number,
  y: number,
  angleRad: number,
  opts: RenderVehicleOptions,
) {
  const { night, fog, rain, nowMs } = opts;
  const isLowLight = night || fog || rain;
  const isBraking = v.speed < 4 && !v.crossed;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);

  // Longitud y ancho normalizados según el tipo
  let length = v.length || 38;
  let width = v.width || 18;

  if (v.kind === "bus") {
    length = 62;
    width = 22;
  } else if (v.kind === "truck") {
    length = 56;
    width = 21;
  } else if (v.kind === "ambulance") {
    length = 44;
    width = 20;
  } else if (v.kind === "moto") {
    length = 22;
    width = 10;
  }

  // 1. Sombra de contacto suave
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "rgba(10, 12, 16, 0.75)";
  drawRoundedPolygon(ctx, 0, 0, length * 1.04, width * 1.04, v.kind === "moto" ? 3 : 6);
  ctx.fill();
  ctx.restore();

  // 2. Ruedas con llantas y neumáticos de goma
  if (v.kind !== "moto") {
    const wheelL = Math.max(6, length * 0.16);
    const wheelW = Math.max(2.8, width * 0.14);
    const frontX = length * 0.28;
    const rearX = -length * 0.28;
    const wheelY = width * 0.48;

    const wheels = [
      { x: frontX, y: -wheelY },
      { x: frontX, y: wheelY },
      { x: rearX, y: -wheelY },
      { x: rearX, y: wheelY },
    ];

    wheels.forEach((w) => {
      // Neumático
      ctx.fillStyle = "#15181c";
      drawRoundedPolygon(ctx, w.x, w.y, wheelL, wheelW, 1.5);
      ctx.fill();
      // Llanta de aleación
      ctx.fillStyle = "#8a93a0";
      ctx.fillRect(w.x - wheelL * 0.3, w.y - wheelW * 0.25, wheelL * 0.6, wheelW * 0.5);
    });
  }

  // 3. Proyección de Faros Delanteros sobre el Asfalto (Volumétricos)
  if (isLowLight) {
    const beamLen = isLowLight ? 140 : 80;
    const beamSpread = isLowLight ? 42 : 28;
    const headlightY = width * 0.32;

    const drawCone = (offsetY: number) => {
      const grad = ctx.createLinearGradient(length / 2, offsetY, length / 2 + beamLen, offsetY);
      grad.addColorStop(0, "rgba(255, 248, 220, 0.45)");
      grad.addColorStop(0.3, "rgba(255, 248, 220, 0.20)");
      grad.addColorStop(1, "rgba(255, 248, 220, 0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(length / 2, offsetY - 2);
      ctx.lineTo(length / 2 + beamLen, offsetY - beamSpread);
      ctx.lineTo(length / 2 + beamLen, offsetY + beamSpread);
      ctx.lineTo(length / 2, offsetY + 2);
      ctx.closePath();
      ctx.fill();
    };

    if (v.kind === "moto") {
      drawCone(0);
    } else {
      drawCone(-headlightY);
      drawCone(headlightY);
    }
  }

  // 4. Carrocería según el Tipo de Vehículo
  if (v.kind === "bus") {
    // -------------------------------------------------------------
    // COLECTIVO BONAERENSE (Línea 343 / Línea 181 de Caseros)
    // -------------------------------------------------------------
    const isLine343 = v.id % 2 === 0;
    const mainColor = isLine343 ? "#0f3460" : "#a82020"; // Azul 343 o Rojo 181
    const stripeColor = isLine343 ? "#e94560" : "#ffffff";

    // Carrocería principal con gradiente metálico
    const busGrad = ctx.createLinearGradient(0, -width / 2, 0, width / 2);
    busGrad.addColorStop(0, "rgba(255,255,255,0.25)");
    busGrad.addColorStop(0.2, mainColor);
    busGrad.addColorStop(0.8, mainColor);
    busGrad.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = busGrad;
    drawRoundedPolygon(ctx, 0, 0, length, width, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Franja lateral distintiva
    ctx.fillStyle = stripeColor;
    ctx.fillRect(-length / 2 + 4, -width / 2 + 2, length - 8, 2.5);
    ctx.fillRect(-length / 2 + 4, width / 2 - 4.5, length - 8, 2.5);

    // Techo y ventilaciones
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    drawRoundedPolygon(ctx, -2, 0, length * 0.72, width * 0.65, 3);
    ctx.fill();

    // Cartelera LED de Línea (Frontal superior)
    ctx.fillStyle = "#05070a";
    ctx.fillRect(length * 0.32, -width * 0.36, 6, width * 0.72);
    ctx.fillStyle = "#ffaa00";
    ctx.font = "bold 5px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.save();
    ctx.translate(length * 0.36, 0);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(isLine343 ? "343 CASEROS" : "181 R.MEJIA", 0, 1.5);
    ctx.restore();

    // Parabrisas panorámico delantero
    const glassGrad = ctx.createLinearGradient(length * 0.28, 0, length * 0.44, 0);
    glassGrad.addColorStop(0, "rgba(120, 180, 240, 0.5)");
    glassGrad.addColorStop(1, "rgba(220, 240, 255, 0.75)");
    ctx.fillStyle = glassGrad;
    drawRoundedPolygon(ctx, length * 0.38, 0, length * 0.14, width * 0.8, 2);
    ctx.fill();

    // Ventanillas laterales de pasajeros
    const windowCount = 5;
    const winW = 5.5;
    const winH = 2.2;
    for (let i = 0; i < windowCount; i++) {
      const winX = -length * 0.34 + i * (winW + 2.5);
      ctx.fillStyle = "rgba(140, 200, 255, 0.45)";
      ctx.fillRect(winX, -width / 2 + 1.2, winW, winH);
      ctx.fillRect(winX, width / 2 - 3.4, winW, winH);
    }
  } else if (v.kind === "ambulance") {
    // -------------------------------------------------------------
    // AMBULANCIA SAME 3F (Mercedes Sprinter / Renault Master)
    // -------------------------------------------------------------
    // Carrocería blanca con brillo
    const ambGrad = ctx.createLinearGradient(0, -width / 2, 0, width / 2);
    ambGrad.addColorStop(0, "#ffffff");
    ambGrad.addColorStop(0.5, "#eceff4");
    ambGrad.addColorStop(1, "#cfd8dc");
    ctx.fillStyle = ambGrad;
    drawRoundedPolygon(ctx, 0, 0, length, width, 5);
    ctx.fill();
    ctx.strokeStyle = "#90a4ae";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Franjas reflectivas verde manzana / naranja flúo (SAME)
    ctx.fillStyle = "#2ecc71"; // Verde flúo SAME
    ctx.fillRect(-length / 2 + 3, -width / 2 + 1.5, length - 6, 2.5);
    ctx.fillRect(-length / 2 + 3, width / 2 - 4, length - 6, 2.5);

    ctx.fillStyle = "#e67e22"; // Naranja SAME
    ctx.fillRect(-length / 2 + 4, -width / 2 + 4, length - 8, 1.2);
    ctx.fillRect(-length / 2 + 4, width / 2 - 5.2, length - 8, 1.2);

    // Cruz de la vida / texto SAME en el techo
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(-2, -4, 4, 8);
    ctx.fillRect(-5, -1.5, 10, 3);

    ctx.font = "bold 4.5px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#2c3e50";
    ctx.textAlign = "center";
    ctx.fillText("SAME 3F", -length * 0.22, 1.5);

    // Parabrisas
    ctx.fillStyle = "rgba(100, 160, 220, 0.65)";
    drawRoundedPolygon(ctx, length * 0.28, 0, length * 0.18, width * 0.78, 2);
    ctx.fill();

    // Balizas Estroboscópicas LED (Rojo y Azul alternantes de alta frecuencia)
    const strobePhase = Math.floor(nowMs / 110) % 2 === 0;
    const colorA = strobePhase ? "#e74c3c" : "#2980b9";
    const colorB = strobePhase ? "#2980b9" : "#e74c3c";

    // Barra de luces delantera
    ctx.fillStyle = colorA;
    ctx.shadowColor = colorA;
    ctx.shadowBlur = 14;
    ctx.fillRect(length * 0.12, -width * 0.4, 4, width * 0.38);
    ctx.fillStyle = colorB;
    ctx.shadowColor = colorB;
    ctx.fillRect(length * 0.12, 0.5, 4, width * 0.38);

    // Halo estroboscópico que ilumina el entorno
    const strobeHalo = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
    strobeHalo.addColorStop(
      0,
      strobePhase ? "rgba(231, 76, 60, 0.45)" : "rgba(41, 128, 185, 0.45)",
    );
    strobeHalo.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = strobeHalo;
    ctx.fillRect(-60, -60, 120, 120);
    ctx.shadowBlur = 0;
  } else if (v.kind === "moto") {
    // -------------------------------------------------------------
    // MOTO / REPARTIDOR DE DELIVERY
    // -------------------------------------------------------------
    // Chasis de la moto
    ctx.fillStyle = "#1e293b";
    drawRoundedPolygon(ctx, 0, 0, length, width * 0.5, 2);
    ctx.fill();

    // Rueda delantera y trasera
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(length * 0.35, -1.5, 4, 3);
    ctx.fillRect(-length * 0.45, -1.5, 4, 3);

    // Conductor (Casco y Hombros)
    ctx.fillStyle = "#334155"; // Chaqueta
    drawRoundedPolygon(ctx, 0, 0, 8, width * 0.85, 3);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0"; // Casco
    ctx.beginPath();
    ctx.arc(length * 0.05, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Visor del casco
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(length * 0.12, -2, 1.8, 4);

    // Mochila térmica de delivery en la parte trasera
    const backpackColor = v.id % 2 === 0 ? "#e11d48" : "#f97316"; // Rojo o Naranja
    ctx.fillStyle = backpackColor;
    drawRoundedPolygon(ctx, -length * 0.28, 0, 6, 7, 1.5);
    ctx.fill();
  } else if (v.kind === "truck") {
    // -------------------------------------------------------------
    // CAMIÓN DE CARGA / DISTRIBUCIÓN
    // -------------------------------------------------------------
    // Cabina delantera
    const cabGrad = ctx.createLinearGradient(0, -width / 2, 0, width / 2);
    cabGrad.addColorStop(0, "#475569");
    cabGrad.addColorStop(0.5, "#334155");
    cabGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = cabGrad;
    drawRoundedPolygon(ctx, length * 0.32, 0, length * 0.28, width, 3);
    ctx.fill();

    // Parabrisas de cabina
    ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
    ctx.fillRect(length * 0.36, -width * 0.42, 4, width * 0.84);

    // Caja de carga / Furgón térmico
    const boxGrad = ctx.createLinearGradient(0, -width / 2, 0, width / 2);
    boxGrad.addColorStop(0, "#f1f5f9");
    boxGrad.addColorStop(0.5, "#e2e8f0");
    boxGrad.addColorStop(1, "#cbd5e1");
    ctx.fillStyle = boxGrad;
    drawRoundedPolygon(ctx, -length * 0.14, 0, length * 0.64, width * 0.96, 2);
    ctx.fill();
    ctx.strokeStyle = "#94a3b8";
    ctx.stroke();

    // Bandas reflectivas traseras reglamentarias
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(-length * 0.46, -width * 0.44, 2, width * 0.88);
  } else {
    // -------------------------------------------------------------
    // SEDÁN / SUV FAMILIAR (Vehículo particular)
    // -------------------------------------------------------------
    const carColor = v.color || "#3b82f6";

    // Carrocería con sombreado de reflejos automotrices
    const bodyGrad = ctx.createLinearGradient(0, -width / 2, 0, width / 2);
    bodyGrad.addColorStop(0, "rgba(255,255,255,0.45)");
    bodyGrad.addColorStop(0.2, carColor);
    bodyGrad.addColorStop(0.8, carColor);
    bodyGrad.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = bodyGrad;
    drawRoundedPolygon(ctx, 0, 0, length, width, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Techo y habitáculo
    ctx.fillStyle = "rgba(15, 23, 42, 0.55)";
    drawRoundedPolygon(ctx, -length * 0.04, 0, length * 0.52, width * 0.82, 4);
    ctx.fill();

    // Parabrisas delantero (curvado y con reflejo especular)
    const frontGlass = ctx.createLinearGradient(length * 0.08, 0, length * 0.24, 0);
    frontGlass.addColorStop(0, "rgba(186, 230, 253, 0.45)");
    frontGlass.addColorStop(1, "rgba(240, 249, 255, 0.85)");
    ctx.fillStyle = frontGlass;
    ctx.beginPath();
    ctx.moveTo(length * 0.1, -width * 0.36);
    ctx.lineTo(length * 0.22, -width * 0.32);
    ctx.lineTo(length * 0.22, width * 0.32);
    ctx.lineTo(length * 0.1, width * 0.36);
    ctx.closePath();
    ctx.fill();

    // Luneta trasera
    ctx.fillStyle = "rgba(186, 230, 253, 0.5)";
    ctx.beginPath();
    ctx.moveTo(-length * 0.16, -width * 0.34);
    ctx.lineTo(-length * 0.26, -width * 0.3);
    ctx.lineTo(-length * 0.26, width * 0.3);
    ctx.lineTo(-length * 0.16, width * 0.34);
    ctx.closePath();
    ctx.fill();

    // Espejos retrovisores laterales
    ctx.fillStyle = carColor;
    ctx.fillRect(length * 0.14, -width / 2 - 2.5, 3.5, 2.5);
    ctx.fillRect(length * 0.14, width / 2, 3.5, 2.5);
  }

  // 5. Faros Delanteros de Alta Intensidad
  if (isLowLight) {
    const headlightY = width * 0.34;
    ctx.fillStyle = "#fffbeb";
    ctx.shadowColor = "#fef08a";
    ctx.shadowBlur = 8;
    ctx.fillRect(length / 2 - 2, -headlightY - 1.5, 2.5, 3.5);
    ctx.fillRect(length / 2 - 2, headlightY - 2, 2.5, 3.5);
    ctx.shadowBlur = 0;
  }

  // 6. Luces Traseras y de Frenado (Dinámicas)
  const taillightY = width * 0.34;
  const isStopActive = isBraking || isLowLight;
  const tailColor = isBraking ? "#ef4444" : "#b91c1c";

  ctx.fillStyle = tailColor;
  if (isBraking) {
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = 12;
  }
  ctx.fillRect(-length / 2 - 0.5, -taillightY - 1.5, 2.2, 3.5);
  ctx.fillRect(-length / 2 - 0.5, taillightY - 2, 2.2, 3.5);
  ctx.shadowBlur = 0;

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Renderizado de Peatones Realistas                                   */
/* ------------------------------------------------------------------ */

export function drawDetailedPedestrian(
  ctx: CanvasRenderingContext2D,
  p: Pedestrian,
  x: number,
  y: number,
  opts: { nowMs: number; analysis: boolean },
) {
  const { nowMs } = opts;
  const walkPhase = p.waiting ? 0 : Math.sin(nowMs / 140 + p.id * 3);

  ctx.save();
  ctx.translate(x, y);

  // Sombra suave de contacto
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.beginPath();
  ctx.ellipse(1, 2, 5, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  if (p.reduced) {
    // -------------------------------------------------------------
    // PEATÓN CON MOVILIDAD REDUCIDA (Silla de Ruedas / Bastón)
    // -------------------------------------------------------------
    // Rueda de la silla de ruedas
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(-2, 0, 4.5, 0, Math.PI * 2);
    ctx.stroke();

    // Cuerpo sentado
    ctx.fillStyle = "#0284c7"; // Ropa azul cielo
    ctx.fillRect(-3, -3, 6, 6);

    // Cabeza
    ctx.fillStyle = "#fbcfe8";
    ctx.beginPath();
    ctx.arc(0, -5, 2.8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // -------------------------------------------------------------
    // PEATÓN ESTÁNDAR (Animado con ciclo de marcha)
    // -------------------------------------------------------------
    const armSwing = walkPhase * 2.5;
    const legSwing = walkPhase * 2.8;

    // Piernas (en movimiento si camina)
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(legSwing, 4);
    ctx.moveTo(0, 0);
    ctx.lineTo(-legSwing, 4);
    ctx.stroke();

    // Torso / Ropa
    const shirtColor = p.id % 2 === 0 ? "#dc2626" : "#2563eb";
    ctx.fillStyle = shirtColor;
    drawRoundedPolygon(ctx, 0, -1, 4.5, 5.5, 1.5);
    ctx.fill();

    // Brazos
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-2, -3);
    ctx.lineTo(-2 - armSwing, 0);
    ctx.moveTo(2, -3);
    ctx.lineTo(2 + armSwing, 0);
    ctx.stroke();

    // Cabeza
    ctx.fillStyle = "#fed7aa";
    ctx.beginPath();
    ctx.arc(0, -6, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Pelo
    ctx.fillStyle = "#451a03";
    ctx.beginPath();
    ctx.arc(0, -6.8, 2.2, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Semáforo Inteligente Fotorrealista con Óptica LED & Bloom          */
/* ------------------------------------------------------------------ */

export function drawDetailedTrafficSignal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  state: "red" | "amber" | "green",
  rotRad: number,
  opts: { night: boolean; fog: boolean; isFailSafe: boolean },
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotRad);

  // Sombra del poste
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.roundRect(-12, -45, 24, 55, 6);
  ctx.fill();

  // Brazo metálico soporte
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.lineTo(0, -6);
  ctx.stroke();

  // Caja del semáforo con acabado negro mate y visera
  const headGrad = ctx.createLinearGradient(-10, 0, 10, 0);
  headGrad.addColorStop(0, "#1e293b");
  headGrad.addColorStop(0.5, "#0f172a");
  headGrad.addColorStop(1, "#020617");
  ctx.fillStyle = headGrad;
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 1.2;
  drawRoundedPolygon(ctx, 0, -20, 20, 48, 5);
  ctx.fill();
  ctx.stroke();

  // Ópticas LED (Rojo, Amarillo, Verde)
  const lights: ("red" | "amber" | "green")[] = ["red", "amber", "green"];
  lights.forEach((light, i) => {
    const cy = -36 + i * 15;
    const isActive = state === light;

    const baseColor = light === "red" ? "#ef4444" : light === "amber" ? "#f59e0b" : "#10b981";

    if (isActive) {
      // Efecto Bloom / Halo volumétrico atmosférico
      const haloRadius = opts.fog ? 36 : opts.night ? 28 : 18;
      const halo = ctx.createRadialGradient(0, cy, 0, 0, cy, haloRadius);
      halo.addColorStop(0, `${baseColor}99`);
      halo.addColorStop(0.4, `${baseColor}44`);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(-haloRadius, cy - haloRadius, haloRadius * 2, haloRadius * 2);

      // Lente LED brillante
      ctx.shadowColor = baseColor;
      ctx.shadowBlur = 14;
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(0, cy, 4.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Núcleo central blanco reflectante
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(-1.2, cy - 1.2, 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Lente apagada
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(0, cy, 4.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Visera protectora de lente
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, cy, 5.8, Math.PI * 0.9, Math.PI * 2.1);
    ctx.stroke();
  });

  // Gabinete de Borde Jetson Nano integrado en el poste
  ctx.fillStyle = "#0f172a";
  ctx.strokeStyle = opts.isFailSafe ? "#ef4444" : "#10b981";
  ctx.lineWidth = 1;
  drawRoundedPolygon(ctx, 0, 16, 12, 10, 2);
  ctx.fill();
  ctx.stroke();

  // LED de estado del gabinete
  ctx.fillStyle = opts.isFailSafe ? "#ef4444" : "#10b981";
  ctx.beginPath();
  ctx.arc(3, 14, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Capa de Analítica YOLOv11 & Telemetría de IA en Tiempo Real         */
/* ------------------------------------------------------------------ */

export function drawDetailedYoloBox(
  ctx: CanvasRenderingContext2D,
  v: Vehicle,
  x: number,
  y: number,
  w: number,
  h: number,
  speedKmH: number,
) {
  if (v.missed) {
    ctx.strokeStyle = "rgba(245, 158, 11, 0.7)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);
    ctx.setLineDash([]);
    return;
  }

  const isEmergency = v.kind === "ambulance";
  const accentColor = isEmergency ? "#ef4444" : "#10b981";
  const conf = v.conf || 0.96;

  ctx.save();

  // 1. Marco delimitador con transparencia sutil
  ctx.strokeStyle = `${accentColor}55`;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - w / 2, y - h / 2, w, h);

  // 2. Retículas de alta precisión en las 4 esquinas
  const k = Math.min(6, w * 0.25);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.8;

  // Esquina Sup-Izq
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h / 2 + k);
  ctx.lineTo(x - w / 2, y - h / 2);
  ctx.lineTo(x - w / 2 + k, y - h / 2);
  ctx.stroke();

  // Esquina Sup-Der
  ctx.beginPath();
  ctx.moveTo(x + w / 2 - k, y - h / 2);
  ctx.lineTo(x + w / 2, y - h / 2);
  ctx.lineTo(x + w / 2, y - h / 2 + k);
  ctx.stroke();

  // Esquina Inf-Izq
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y + h / 2 - k);
  ctx.lineTo(x - w / 2, y + h / 2);
  ctx.lineTo(x - w / 2 + k, y + h / 2);
  ctx.stroke();

  // Esquina Inf-Der
  ctx.beginPath();
  ctx.moveTo(x + w / 2 - k, y + h / 2);
  ctx.lineTo(x + w / 2, y + h / 2);
  ctx.lineTo(x + w / 2, y + h / 2 - k);
  ctx.stroke();

  // 3. Etiqueta de Telemetría YOLOv11 en vivo
  let className = KIND_LABEL_ES[v.kind] || v.kind;
  if (v.kind === "bus") className = "Línea 343";
  else if (v.kind === "ambulance") className = "SAME 107 (EMERGENCIA)";

  const tagText = `${className} · ${(conf * 100).toFixed(0)}% · ${speedKmH.toFixed(0)} km/h`;
  ctx.font = "bold 9px 'JetBrains Mono', monospace";
  const textW = ctx.measureText(tagText).width;

  // Fondo de la etiqueta
  ctx.fillStyle = isEmergency ? "rgba(239, 68, 68, 0.95)" : "rgba(15, 23, 42, 0.92)";
  ctx.fillRect(x - w / 2, y - h / 2 - 14, textW + 8, 13);

  // Barra de confianza en el borde superior
  ctx.fillStyle = accentColor;
  ctx.fillRect(x - w / 2, y - h / 2 - 14, (textW + 8) * conf, 2);

  // Texto
  ctx.fillStyle = "#ffffff";
  ctx.fillText(tagText, x - w / 2 + 4, y - h / 2 - 4);

  ctx.restore();
}
