/**
 * Renderizador tridimensional de la intersección (proyección en perspectiva,
 * algoritmo del pintor y sombreado por cara).
 *
 * Sin dependencias externas: canvas 2D puro, para que corra en el hardware de
 * cualquier oficina pública y en el navegador de una notebook institucional.
 */

import {
  KIND_LABEL_ES,
  WORLD,
  axisOf,
  type Approach,
  type Pedestrian,
  type TrafficEngine,
  type Vehicle,
} from "@/lib/traffic/engine";

import type { DrawOptions } from "./draw";

const VIEW = 800; // lado del canvas en px CSS
const ROAD_HALF = 92;
const LANE = WORLD.laneOffset;
const HALF = WORLD.size / 2;

/* ---------------------------- cámara ---------------------------- */

const CAM = { dist: 900, height: 640, fov: 1010 };
const PITCH = Math.atan2(CAM.height, CAM.dist);
const SIN_P = Math.sin(PITCH);
const COS_P = Math.cos(PITCH);

interface P2 {
  x: number;
  y: number;
  d: number;
}

function project(x: number, y: number, z: number): P2 {
  const dy = y - CAM.dist;
  const dz = z - CAM.height;
  const depth = Math.max(60, -COS_P * dy - SIN_P * dz);
  const sx = x;
  const sy = -SIN_P * dy + COS_P * dz;
  return { x: VIEW / 2 + (CAM.fov * sx) / depth, y: VIEW / 2 - (CAM.fov * sy) / depth, d: depth };
}

function depthOf(x: number, y: number, z = 0): number {
  return -COS_P * (y - CAM.dist) - SIN_P * (z - CAM.height);
}

/* ---------------------------- paleta ---------------------------- */

const PAL = {
  skyTop: "#0a0d13",
  skyBottom: "#1b2230",
  ground: "#171a20",
  asphalt: "#23262c",
  asphaltDark: "#1d2025",
  paint: "rgba(232,236,242,0.72)",
  paintDim: "rgba(232,236,242,0.34)",
  center: "rgba(224,190,104,0.6)",
  sidewalk: "#33383f",
  sidewalkSide: "#22262b",
  curb: "#454b53",
  crosswalk: "rgba(238,241,246,0.78)",
  buildingSide: "#2a2f38",
  buildingSide2: "#232831",
  buildingTop: "#39404b",
  window: "rgba(150,200,255,0.10)",
  windowLit: "rgba(255,214,140,0.55)",
  treeTrunk: "#3a3128",
  treeLeaf: "#33513c",
  red: "#e2483a",
  amber: "#eaa92b",
  green: "#3fc47b",
  detect: "rgba(226,232,240,0.9)",
  detectAcc: "#5fd6a0",
};

/* ------------------------ primitivas 3D ------------------------- */

function quad(
  ctx: CanvasRenderingContext2D,
  pts: [number, number, number][],
  fill: string,
  stroke?: string,
) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const q = project(p[0], p[1], p[2]);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function planeRect(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  z: number,
  fill: string,
) {
  quad(
    ctx,
    [
      [cx - w / 2, cy - h / 2, z],
      [cx + w / 2, cy - h / 2, z],
      [cx + w / 2, cy + h / 2, z],
      [cx - w / 2, cy + h / 2, z],
    ],
    fill,
  );
}

interface BoxStyle {
  top: string;
  front: string;
  side: string;
  stroke?: string;
}

/** Caja alineada a los ejes, con caras sombreadas y sombra proyectada */
function box(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  z0: number,
  z1: number,
  st: BoxStyle,
) {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;

  // cara norte (lejana) sólo si la caja está detrás del centro visual
  if (y1 < CAM.dist) {
    quad(
      ctx,
      [
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      st.front,
      st.stroke,
    );
  }
  // cara lateral visible
  const sx = cx > 0 ? x0 : x1;
  quad(
    ctx,
    [
      [sx, y0, z0],
      [sx, y1, z0],
      [sx, y1, z1],
      [sx, y0, z1],
    ],
    st.side,
    st.stroke,
  );
  // techo
  quad(
    ctx,
    [
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ],
    st.top,
    st.stroke,
  );
}

function shadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  planeRect(ctx, cx + 6, cy + 8, w * 1.06, h * 1.06, 0.6, "#05070a");
  ctx.restore();
}

/* ------------------------ geometría base ------------------------ */

function vehicleWorld(v: Vehicle): { x: number; y: number; len: number; wid: number; ax: "x" | "y" } {
  const p = v.p - HALF;
  switch (v.approach) {
    case "N":
      return { x: -LANE, y: p, len: v.length, wid: v.width, ax: "y" };
    case "S":
      return { x: LANE, y: -p, len: v.length, wid: v.width, ax: "y" };
    case "W":
      return { x: p, y: LANE, len: v.length, wid: v.width, ax: "x" };
    default:
      return { x: -p, y: -LANE, len: v.length, wid: v.width, ax: "x" };
  }
}

function pedWorld(p: Pedestrian): { x: number; y: number } {
  const span = ROAD_HALF + 26;
  const t = -span + p.p * span * 2;
  const lane = p.side * (ROAD_HALF + 20);
  return p.crossAxis === "NS" ? { x: t, y: lane } : { x: lane, y: t };
}

/* --------------------------- escenario -------------------------- */

const BUILDINGS: {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  cols: number;
  rows: number;
}[] = [];
{
  const rnd = (() => {
    let s = 20240701;
    return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  })();
  const quads: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  for (const [sx, sy] of quads) {
    for (let i = 0; i < 4; i++) {
      const w = 90 + rnd() * 90;
      const h = 90 + rnd() * 90;
      const x = sx * (ROAD_HALF + 60 + rnd() * 210);
      const y = sy * (ROAD_HALF + 60 + rnd() * 210);
      if (Math.abs(x) - w / 2 < ROAD_HALF + 30 || Math.abs(y) - h / 2 < ROAD_HALF + 30) continue;
      BUILDINGS.push({
        x,
        y,
        w,
        h,
        z: 70 + rnd() * 190,
        cols: 3 + Math.floor(rnd() * 3),
        rows: 3 + Math.floor(rnd() * 5),
      });
    }
  }
  BUILDINGS.sort((a, b) => depthOf(b.x, b.y) - depthOf(a.x, a.y));
}

const TREES: [number, number][] = [];
for (const s of [-1, 1]) {
  for (let i = 0; i < 4; i++) {
    TREES.push([s * (ROAD_HALF + 30), (ROAD_HALF + 70) * (i % 2 === 0 ? 1 : -1) + i * 46 * s]);
    TREES.push([(ROAD_HALF + 70) * (i % 2 === 0 ? -1 : 1) + i * 46 * s, s * (ROAD_HALF + 30)]);
  }
}

function drawGround(ctx: CanvasRenderingContext2D, night: boolean) {
  // cielo
  const g = ctx.createLinearGradient(0, 0, 0, VIEW * 0.55);
  g.addColorStop(0, PAL.skyTop);
  g.addColorStop(1, night ? "#141a26" : PAL.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW, VIEW);

  // suelo general
  planeRect(ctx, 0, 0, 2600, 2600, 0, PAL.ground);

  // veredas (bloques con cordón)
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const cx = sx * (ROAD_HALF + 165);
      const cy = sy * (ROAD_HALF + 165);
      box(ctx, cx, cy, 330, 330, 0, 7, {
        top: PAL.sidewalk,
        front: PAL.sidewalkSide,
        side: PAL.sidewalkSide,
        stroke: "rgba(0,0,0,0.25)",
      });
    }
  }

  // calzadas
  planeRect(ctx, 0, 0, ROAD_HALF * 2, 1300, 0.4, PAL.asphalt);
  planeRect(ctx, 0, 0, 1300, ROAD_HALF * 2, 0.5, PAL.asphalt);
  planeRect(ctx, 0, 0, ROAD_HALF * 2, ROAD_HALF * 2, 0.6, PAL.asphaltDark);

  // eje central amarillo
  for (let i = -620; i < 620; i += 46) {
    if (Math.abs(i) < ROAD_HALF + 12) continue;
    planeRect(ctx, 0, i + 12, 3.2, 24, 0.8, PAL.center);
    planeRect(ctx, i + 12, 0, 24, 3.2, 0.8, PAL.center);
  }
  // carriles punteados
  for (let i = -620; i < 620; i += 40) {
    if (Math.abs(i) < ROAD_HALF + 14) continue;
    for (const s of [-1, 1]) {
      planeRect(ctx, s * (LANE + 22), i + 10, 2.4, 18, 0.8, PAL.paintDim);
      planeRect(ctx, i + 10, s * (LANE + 22), 18, 2.4, 0.8, PAL.paintDim);
    }
  }
  // líneas de detención
  for (const s of [-1, 1]) {
    planeRect(ctx, s * (LANE + 4), s * -(ROAD_HALF + 4), LANE * 1.9, 4.5, 0.9, PAL.paint);
    planeRect(ctx, s * -(ROAD_HALF + 4), s * (LANE + 4), 4.5, LANE * 1.9, 0.9, PAL.paint);
  }
  // sendas peatonales
  for (const s of [-1, 1]) {
    for (let i = -ROAD_HALF + 8; i < ROAD_HALF - 4; i += 16) {
      planeRect(ctx, i + 5, s * (ROAD_HALF + 16), 9, 26, 0.95, PAL.crosswalk);
      planeRect(ctx, s * (ROAD_HALF + 16), i + 5, 26, 9, 0.95, PAL.crosswalk);
    }
  }
}

function drawBuildings(ctx: CanvasRenderingContext2D, night: boolean) {
  for (const b of BUILDINGS) {
    shadow(ctx, b.x, b.y, b.w, b.h, 0.35);
    box(ctx, b.x, b.y, b.w, b.h, 6, b.z, {
      top: PAL.buildingTop,
      front: PAL.buildingSide,
      side: PAL.buildingSide2,
      stroke: "rgba(0,0,0,0.35)",
    });
    // ventanas sobre la cara norte
    const x0 = b.x - b.w / 2;
    const stepX = b.w / (b.cols + 1);
    const stepZ = (b.z - 14) / (b.rows + 1);
    for (let c = 1; c <= b.cols; c++) {
      for (let r = 1; r <= b.rows; r++) {
        const lit = night ? ((c * 7 + r * 13 + Math.round(b.x)) % 5 < 3) : false;
        quad(
          ctx,
          [
            [x0 + stepX * c - 7, b.y + b.h / 2, 10 + stepZ * r - 8],
            [x0 + stepX * c + 7, b.y + b.h / 2, 10 + stepZ * r - 8],
            [x0 + stepX * c + 7, b.y + b.h / 2, 10 + stepZ * r + 8],
            [x0 + stepX * c - 7, b.y + b.h / 2, 10 + stepZ * r + 8],
          ],
          lit ? PAL.windowLit : PAL.window,
        );
      }
    }
  }
}

function drawTrees(ctx: CanvasRenderingContext2D) {
  const list = [...TREES].sort((a, b) => depthOf(b[0], b[1]) - depthOf(a[0], a[1]));
  for (const [x, y] of list) {
    if (Math.abs(x) < ROAD_HALF + 12 && Math.abs(y) < ROAD_HALF + 12) continue;
    shadow(ctx, x, y, 22, 22, 0.3);
    box(ctx, x, y, 7, 7, 7, 34, {
      top: PAL.treeTrunk,
      front: PAL.treeTrunk,
      side: "#2e281f",
    });
    box(ctx, x, y, 30, 30, 34, 62, {
      top: "#3f6349",
      front: PAL.treeLeaf,
      side: "#2b4433",
    });
  }
}

/* --------------------------- semáforos -------------------------- */

const SIGNAL_POSTS: { x: number; y: number; approach: Approach }[] = [
  { x: -(ROAD_HALF + 22), y: ROAD_HALF + 22, approach: "N" },
  { x: ROAD_HALF + 22, y: -(ROAD_HALF + 22), approach: "S" },
  { x: ROAD_HALF + 22, y: ROAD_HALF + 22, approach: "W" },
  { x: -(ROAD_HALF + 22), y: -(ROAD_HALF + 22), approach: "E" },
];

function drawSignals(ctx: CanvasRenderingContext2D, engine: TrafficEngine, t: number) {
  const posts = [...SIGNAL_POSTS].sort((a, b) => depthOf(b.x, b.y) - depthOf(a.x, a.y));
  for (const p of posts) {
    const state = engine.signalFor(p.approach);
    shadow(ctx, p.x, p.y, 16, 16, 0.35);
    box(ctx, p.x, p.y, 8, 8, 7, 118, { top: "#4a515b", front: "#3b4149", side: "#2f343b" });
    // cabezal
    box(ctx, p.x, p.y, 20, 16, 78, 126, {
      top: "#2b3037",
      front: "#22262c",
      side: "#191d22",
      stroke: "rgba(0,0,0,0.4)",
    });
    const lights: [string, number][] = [
      [PAL.red, 118],
      [PAL.amber, 104],
      [PAL.green, 90],
    ];
    const activeIdx = state === "red" ? 0 : state === "amber" ? 1 : 2;
    lights.forEach(([color, z], i) => {
      const c = project(p.x, p.y - 8.5, z);
      const on = i === activeIdx;
      const r = Math.max(2.6, (CAM.fov / c.d) * 5.4);
      if (on) {
        const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r * 4.2);
        glow.addColorStop(0, color);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = 0.32 + 0.08 * Math.sin(t / 320);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(c.x, c.y, r * 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fillStyle = on ? color : "rgba(255,255,255,0.07)";
      ctx.fill();
    });
  }
}

function drawCameras(ctx: CanvasRenderingContext2D, engine: TrafficEngine, t: number) {
  const offline = engine.cameraOffline;
  for (const p of SIGNAL_POSTS) {
    const base = project(p.x, p.y, 132);
    // brazo + carcasa
    box(ctx, p.x * 0.86, p.y * 0.86, 14, 14, 128, 138, {
      top: "#454c56",
      front: "#343a42",
      side: "#282d34",
    });
    // cono de visión proyectado al piso
    const dirX = -Math.sign(p.x);
    const dirY = -Math.sign(p.y);
    const tip1 = project(p.x + dirX * 250 - 90, p.y + dirY * 250, 0);
    const tip2 = project(p.x + dirX * 250 + 90, p.y + dirY * 250, 0);
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(tip1.x, tip1.y);
    ctx.lineTo(tip2.x, tip2.y);
    ctx.closePath();
    const grad = ctx.createLinearGradient(base.x, base.y, tip1.x, tip1.y);
    const tint = offline ? "226,72,58" : "95,214,160";
    grad.addColorStop(0, `rgba(${tint},${offline ? 0.14 : 0.13})`);
    grad.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = grad;
    ctx.fill();
    if (!offline) {
      const scan = (Math.sin(t / 900 + p.x) + 1) / 2;
      ctx.strokeStyle = "rgba(95,214,160,0.24)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(tip1.x + (tip2.x - tip1.x) * scan, tip1.y + (tip2.y - tip1.y) * scan);
      ctx.stroke();
    }
  }
}

/* ---------------------------- vehículos -------------------------- */

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

function drawVehicle(
  ctx: CanvasRenderingContext2D,
  v: Vehicle,
  night: boolean,
  fog: boolean,
  t: number,
) {
  const g = vehicleWorld(v);
  const w = g.ax === "y" ? g.wid : g.len;
  const h = g.ax === "y" ? g.len : g.wid;
  const bodyH = v.kind === "truck" ? 34 : v.kind === "moto" ? 14 : 22;

  shadow(ctx, g.x, g.y, w, h, 0.45);

  // chasis
  box(ctx, g.x, g.y, w, h, 1.5, bodyH, {
    top: shade(v.color, 1.06),
    front: shade(v.color, 0.72),
    side: shade(v.color, 0.58),
    stroke: "rgba(0,0,0,0.35)",
  });

  // cabina / techo vidriado
  if (v.kind !== "moto") {
    const cw = w * 0.78;
    const ch = h * (v.kind === "truck" ? 0.34 : 0.52);
    const off = v.kind === "truck" ? (g.ax === "y" ? h * 0.28 : 0) : 0;
    box(
      ctx,
      g.x + (g.ax === "x" ? off : 0),
      g.y + (g.ax === "y" ? off : 0),
      g.ax === "y" ? cw : ch,
      g.ax === "y" ? ch : cw,
      bodyH,
      bodyH + (v.kind === "truck" ? 14 : 12),
      {
        top: shade(v.color, 0.9),
        front: "rgba(150,190,225,0.42)",
        side: "rgba(120,160,200,0.3)",
      },
    );
  }

  // luces
  const front = g.ax === "y" ? { x: g.x, y: g.y + (v.approach === "N" ? h / 2 : -h / 2) } : { x: g.x + (v.approach === "W" ? w / 2 : -w / 2), y: g.y };
  if (night || fog) {
    const c = project(front.x, front.y, bodyH * 0.5);
    const rad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 46);
    rad.addColorStop(0, "rgba(255,240,205,0.5)");
    rad.addColorStop(1, "rgba(255,240,205,0)");
    ctx.fillStyle = rad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 46, 0, Math.PI * 2);
    ctx.fill();
  }
  if (v.speed < 4) {
    const back = g.ax === "y" ? { x: g.x, y: g.y - (v.approach === "N" ? h / 2 : -h / 2) } : { x: g.x - (v.approach === "W" ? w / 2 : -w / 2), y: g.y };
    const c = project(back.x, back.y, bodyH * 0.6);
    ctx.fillStyle = "rgba(226,72,58,0.85)";
    ctx.beginPath();
    ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (v.kind === "ambulance") {
    const c = project(g.x, g.y, bodyH + 18);
    const on = Math.sin(t / 90) > 0;
    ctx.fillStyle = on ? "rgba(226,72,58,0.95)" : "rgba(90,150,240,0.95)";
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4.4, 0, Math.PI * 2);
    ctx.fill();
    const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 34);
    glow.addColorStop(0, on ? "rgba(226,72,58,0.5)" : "rgba(90,150,240,0.5)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 34, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPedestrian(ctx: CanvasRenderingContext2D, p: Pedestrian) {
  const w = pedWorld(p);
  shadow(ctx, w.x, w.y, 12, 12, 0.4);
  const color = p.reduced ? "#7fb8ff" : "#dbe3ee";
  box(ctx, w.x, w.y, 9, 9, 7, 30, {
    top: shade("#8a93a3", 1),
    front: color,
    side: shade("#98a2b3", 0.7),
  });
  box(ctx, w.x, w.y, 7, 7, 30, 38, {
    top: "#c9b79c",
    front: "#b9a68b",
    side: "#a3907a",
  });
}

/* ---------------------- capa de analítica ------------------------ */

function vehicleBBox(v: Vehicle): { x: number; y: number; w: number; h: number } {
  const g = vehicleWorld(v);
  const w = g.ax === "y" ? g.wid : g.len;
  const h = g.ax === "y" ? g.len : g.wid;
  const bodyH = v.kind === "truck" ? 48 : v.kind === "moto" ? 26 : 34;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const dx of [-w / 2, w / 2]) {
    for (const dy of [-h / 2, h / 2]) {
      for (const dz of [0, bodyH]) {
        const q = project(g.x + dx, g.y + dy, dz);
        minX = Math.min(minX, q.x);
        maxX = Math.max(maxX, q.x);
        minY = Math.min(minY, q.y);
        maxY = Math.max(maxY, q.y);
      }
    }
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function drawAnalysis(ctx: CanvasRenderingContext2D, engine: TrafficEngine) {
  if (engine.cameraOffline) return;
  ctx.save();
  ctx.font = "600 10px 'JetBrains Mono', monospace";
  for (const v of engine.vehicles) {
    if (v.crossed || v.p < WORLD.zoneMin || v.p > WORLD.clear) continue;
    const b = vehicleBBox(v);
    const ok = !v.missed && v.conf !== undefined;
    ctx.strokeStyle = ok ? PAL.detectAcc : "rgba(234,169,43,0.75)";
    ctx.setLineDash(ok ? [] : [4, 3]);
    ctx.lineWidth = 1.3;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.setLineDash([]);
    // esquinas
    if (ok) {
      const s = Math.min(8, b.w / 3);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + s);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x + s, b.y);
      ctx.moveTo(b.x + b.w - s, b.y + b.h);
      ctx.lineTo(b.x + b.w, b.y + b.h);
      ctx.lineTo(b.x + b.w, b.y + b.h - s);
      ctx.stroke();
    }

    let kindText = KIND_LABEL_ES[v.kind] || v.kind;
    if (v.kind === "bus") kindText = "Colectivo L343";
    else if (v.kind === "truck") kindText = "Camión L-181";
    else if (v.kind === "ambulance") kindText = "SAME 3F (EMERGENCIA)";

    const label = ok
      ? `${kindText} ${(v.conf! * 100).toFixed(0)}%`
      : "sin clasificar";
    const tw = ctx.measureText(label).width + 8;
    ctx.fillStyle = v.kind === "ambulance" ? "rgba(226,72,58,0.92)" : ok ? "rgba(12,18,16,0.85)" : "rgba(30,22,6,0.85)";
    ctx.fillRect(b.x, b.y - 14, tw, 13);
    ctx.fillStyle = v.kind === "ambulance" ? "#ffffff" : ok ? PAL.detectAcc : "#eaa92b";
    ctx.fillText(label, b.x + 4, b.y - 4);
  }
  for (const p of engine.pedestrians) {
    const w = pedWorld(p);
    const a = project(w.x - 8, w.y - 8, 0);
    const b = project(w.x + 8, w.y + 8, 42);
    ctx.strokeStyle = p.reduced ? "rgba(127,184,255,0.9)" : "rgba(226,232,240,0.6)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    if (p.reduced) {
      ctx.fillStyle = "rgba(10,16,24,0.85)";
      ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y) - 13, 110, 12);
      ctx.fillStyle = "#7fb8ff";
      ctx.fillText("Peatón Reducido 3F", Math.min(a.x, b.x) + 4, Math.min(a.y, b.y) - 4);
    }
  }
  ctx.restore();
}

/* ------------------------- clima y noche ------------------------- */

function drawWeather(ctx: CanvasRenderingContext2D, engine: TrafficEngine, t: number) {
  if (engine.night) {
    const v = ctx.createRadialGradient(VIEW / 2, VIEW * 0.62, 120, VIEW / 2, VIEW * 0.62, VIEW * 0.8);
    v.addColorStop(0, "rgba(8,11,18,0)");
    v.addColorStop(1, "rgba(4,6,11,0.72)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, VIEW, VIEW);
  }
  if (engine.weather === "rain") {
    ctx.strokeStyle = "rgba(178,200,228,0.24)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 170; i++) {
      const x = (i * 137 + t * 0.5) % VIEW;
      const y = (i * 271 + t * 1.5) % VIEW;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + 13);
      ctx.stroke();
    }
  }
  if (engine.weather === "fog") {
    const f = ctx.createLinearGradient(0, VIEW * 0.2, 0, VIEW);
    f.addColorStop(0, "rgba(178,190,205,0.30)");
    f.addColorStop(1, "rgba(178,190,205,0.10)");
    ctx.fillStyle = f;
    ctx.fillRect(0, 0, VIEW, VIEW);
    for (let i = 0; i < 5; i++) {
      const y = VIEW * 0.3 + i * 90 + Math.sin(t / 2600 + i) * 22;
      const band = ctx.createLinearGradient(0, y - 40, 0, y + 40);
      band.addColorStop(0, "rgba(200,210,225,0)");
      band.addColorStop(0.5, "rgba(200,210,225,0.14)");
      band.addColorStop(1, "rgba(200,210,225,0)");
      ctx.fillStyle = band;
      ctx.fillRect(0, y - 40, VIEW, 80);
    }
  }
}

/* ------------------------------ HUD ------------------------------ */

function drawHud(ctx: CanvasRenderingContext2D, engine: TrafficEngine) {
  ctx.save();
  ctx.font = "600 11px 'JetBrains Mono', monospace";
  const failsafe = engine.failSafe;
  ctx.strokeStyle = failsafe ? "rgba(226,72,58,0.45)" : "rgba(95,214,160,0.30)";
  ctx.lineWidth = 1;
  ctx.strokeRect(14.5, 14.5, VIEW - 29, VIEW - 29);
  ctx.fillStyle = "rgba(8,11,16,0.72)";
  ctx.fillRect(14, 14, 320, 26);
  ctx.fillStyle = failsafe ? "#e2483a" : "#5fd6a0";
  const h = Math.floor(engine.hour) % 24;
  const m = Math.floor((engine.hour % 1) * 60);
  ctx.fillText(
    `CAM-01 · AR-BA-3F-0142 · ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} · ${failsafe ? "FAIL-SAFE" : "IA AUTÓNOMA"}`,
    22,
    31,
  );
  const rate = `clasificación ${(engine.detectionRate * 100).toFixed(0)}% · visibilidad ${(engine.visibility * 100).toFixed(0)}%`;
  const w = ctx.measureText(rate).width + 16;
  ctx.fillStyle = "rgba(8,11,16,0.72)";
  ctx.fillRect(VIEW - 14 - w, 14, w, 26);
  ctx.fillStyle = "rgba(226,232,240,0.8)";
  ctx.fillText(rate, VIEW - 14 - w + 8, 31);
  ctx.restore();
}

/* --------------------------- entrada ----------------------------- */

export function drawScene3D(
  ctx: CanvasRenderingContext2D,
  engine: TrafficEngine,
  now: number,
  opts: DrawOptions,
) {
  ctx.clearRect(0, 0, VIEW, VIEW);
  drawGround(ctx, engine.night);
  // corredor habilitado: sutil, bajo los objetos
  {
    const ax = engine.axis;
    ctx.save();
    ctx.globalAlpha = engine.phase === "green" ? 0.1 : 0.04;
    planeRect(
      ctx,
      0,
      0,
      ax === "NS" ? ROAD_HALF * 2 : 440,
      ax === "NS" ? 440 : ROAD_HALF * 2,
      1.1,
      engine.phase === "green" ? PAL.green : PAL.amber,
    );
    ctx.restore();
  }
  drawBuildings(ctx, engine.night);
  drawTrees(ctx);
  if (opts.cameras) drawCameras(ctx, engine, now);

  // objetos dinámicos ordenados de lejos a cerca
  type Item = { d: number; draw: () => void };
  const items: Item[] = [];
  for (const v of engine.vehicles) {
    if (v.p < -60 || v.p > WORLD.despawn) continue;
    const g = vehicleWorld(v);
    items.push({
      d: depthOf(g.x, g.y),
      draw: () => drawVehicle(ctx, v, engine.night, engine.weather === "fog", now),
    });
  }
  for (const p of engine.pedestrians) {
    const w = pedWorld(p);
    items.push({ d: depthOf(w.x, w.y), draw: () => drawPedestrian(ctx, p) });
  }
  items.sort((a, b) => b.d - a.d);
  for (const it of items) it.draw();

  drawSignals(ctx, engine, now);
  drawWeather(ctx, engine, now);
  if (opts.analysis) drawAnalysis(ctx, engine);
  if (opts.labels) {
    ctx.save();
    ctx.font = "600 11px 'JetBrains Mono', monospace";
    ctx.fillStyle = "rgba(226,232,240,0.55)";
    ctx.fillText("AV. SAN MARTÍN →", VIEW / 2 + 120, VIEW - 120);
    ctx.fillText("↑ URQUIZA", 84, VIEW / 2 + 40);
    ctx.restore();
  }
  if (opts.hud) drawHud(ctx, engine);
}

export { axisOf };
