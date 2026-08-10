import {
  KIND_LABEL_ES,
  WORLD,
  type Approach,
  type Pedestrian,
  type TrafficEngine,
  type Vehicle,
} from "@/lib/traffic/engine";

const C = WORLD.center;
const S = WORLD.size;
const ROAD_HALF = 92;
const LANE = WORLD.laneOffset;

export interface DrawOptions {
  /** capa de analítica: cajas de detección, etiquetas y zonas */
  analysis: boolean;
  /** cámaras, campos de visión y postes */
  cameras: boolean;
  /** marco técnico y telemetría sobre el video */
  hud: boolean;
  /** etiquetas de orientación (N/S/E/O) y nombres de calle */
  labels: boolean;
}

export const DEFAULT_DRAW_OPTIONS: DrawOptions = {
  analysis: true,
  cameras: true,
  hud: true,
  labels: true,
};

/* Paleta sobria, sin neones: gris urbano real + acentos mínimos */
const PALETTE = {
  ground: "#0f1216",
  sidewalk: "#2a2e35",
  sidewalkEdge: "#3a4049",
  curb: "#454b55",
  asphalt: "#212429",
  asphaltLight: "#272b31",
  paint: "rgba(226,229,234,0.66)",
  paintDim: "rgba(226,229,234,0.34)",
  center: "rgba(216,182,96,0.55)",
  building: "#333944",
  buildingTop: "#3c4350",
  roof: "#2b313b",
  green: "#2f4a37",
  tree: "#3c5c42",
  signalRed: "#e0483c",
  signalAmber: "#e9a92c",
  signalGreen: "#3fbf74",
  detect: "rgba(226,232,240,0.85)",
  detectAcc: "#63d19a",
};

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, r);
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function heading(a: Approach): [number, number] {
  return a === "N" ? [0, 1] : a === "S" ? [0, -1] : a === "W" ? [1, 0] : [-1, 0];
}

function vehicleGeometry(v: Vehicle): { x: number; y: number; w: number; h: number } {
  switch (v.approach) {
    case "N":
      return { x: C - LANE, y: v.p - v.length / 2, w: v.width, h: v.length };
    case "S":
      return { x: C + LANE, y: S - v.p + v.length / 2, w: v.width, h: v.length };
    case "W":
      return { x: v.p - v.length / 2, y: C + LANE, w: v.length, h: v.width };
    case "E":
      return { x: S - v.p + v.length / 2, y: C - LANE, w: v.length, h: v.width };
  }
}

function pedPoint(p: Pedestrian): [number, number] {
  const a = -ROAD_HALF - 14;
  const b = ROAD_HALF + 14;
  const t = a + (b - a) * Math.min(1, p.p);
  if (p.crossAxis === "NS") return [C + t, C + p.side * 104];
  return [C + p.side * 104, C + t];
}

/* ------------------------------------------------------------------ */
/* Capa estática                                                       */
/* ------------------------------------------------------------------ */

let staticLayer: HTMLCanvasElement | null = null;
let asphaltTile: HTMLCanvasElement | null = null;

function getAsphaltTile(): HTMLCanvasElement {
  if (asphaltTile) return asphaltTile;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = PALETTE.asphalt;
  g.fillRect(0, 0, 128, 128);
  const img = g.getImageData(0, 0, 128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 9;
    img.data[i] = Math.max(0, Math.min(255, img.data[i]! + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1]! + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2]! + n));
  }
  g.putImageData(img, 0, 0);
  // manchas de desgaste suaves
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const r = 6 + Math.random() * 16;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,0.020)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  asphaltTile = c;
  return c;
}

function drawBuildingBlock(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  towardX: number,
  towardY: number,
) {
  // vereda
  g.fillStyle = PALETTE.sidewalk;
  g.fillRect(x, y, w, h);
  g.strokeStyle = "rgba(255,255,255,0.028)";
  g.lineWidth = 1;
  for (let i = x + 30; i < x + w; i += 30) {
    g.beginPath();
    g.moveTo(i, y);
    g.lineTo(i, y + h);
    g.stroke();
  }
  for (let j = y + 30; j < y + h; j += 30) {
    g.beginPath();
    g.moveTo(x, j);
    g.lineTo(x + w, j);
    g.stroke();
  }

  const pad = 34;
  const bx = x + pad;
  const by = y + pad;
  const bw = w - pad * 2;
  const bh = h - pad * 2;
  if (bw < 40 || bh < 40) return;

  const rand = seeded(seed);

  // patio / cantero
  g.fillStyle = PALETTE.green;
  g.globalAlpha = 0.5;
  g.fillRect(bx, by, bw, bh);
  g.globalAlpha = 1;

  const cols = 2;
  const rows = 2;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (rand() < 0.12) continue;
      const gap = 10;
      const uw = bw / cols - gap;
      const uh = bh / rows - gap;
      const ux = bx + (bw / cols) * i + gap / 2;
      const uy = by + (bh / rows) * j + gap / 2;
      const elev = 3 + rand() * 4;

      // sombra proyectada hacia la intersección
      g.fillStyle = "rgba(0,0,0,0.38)";
      g.beginPath();
      g.roundRect(ux + towardX * elev, uy + towardY * elev, uw, uh, 3);
      g.fill();

      const grad = g.createLinearGradient(ux, uy, ux + uw, uy + uh);
      grad.addColorStop(0, PALETTE.buildingTop);
      grad.addColorStop(1, PALETTE.building);
      g.fillStyle = grad;
      g.beginPath();
      g.roundRect(ux, uy, uw, uh, 3);
      g.fill();

      // azotea: parapeto y equipos
      g.strokeStyle = "rgba(255,255,255,0.07)";
      g.lineWidth = 1.5;
      g.strokeRect(ux + 4.5, uy + 4.5, uw - 9, uh - 9);
      g.fillStyle = PALETTE.roof;
      for (let k = 0; k < 3; k++) {
        if (rand() < 0.4) continue;
        const ew = 8 + rand() * 12;
        const eh = 8 + rand() * 10;
        g.fillRect(ux + 10 + rand() * (uw - 30), uy + 10 + rand() * (uh - 28), ew, eh);
      }
      // caja de escalera
      g.fillStyle = "rgba(255,255,255,0.05)";
      g.fillRect(ux + uw * 0.55, uy + uh * 0.2, uw * 0.22, uh * 0.22);
    }
  }

  // arbolado sobre la vereda
  for (let i = 0; i < 6; i++) {
    const tx = x + 14 + rand() * (w - 28);
    const ty = y + 14 + rand() * (h - 28);
    const insideBlock = tx > bx && tx < bx + bw && ty > by && ty < by + bh;
    if (insideBlock) continue;
    const r = 7 + rand() * 4;
    g.fillStyle = "rgba(0,0,0,0.34)";
    g.beginPath();
    g.arc(tx + towardX * 3, ty + towardY * 3, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = PALETTE.tree;
    g.beginPath();
    g.arc(tx, ty, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.05)";
    g.beginPath();
    g.arc(tx - r * 0.3, ty - r * 0.3, r * 0.5, 0, Math.PI * 2);
    g.fill();
  }
}

function buildStaticLayer(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;

  g.fillStyle = PALETTE.ground;
  g.fillRect(0, 0, S, S);

  const o = C - ROAD_HALF;
  const far = C + ROAD_HALF;
  drawBuildingBlock(g, 0, 0, o, o, 17, 1, 1);
  drawBuildingBlock(g, far, 0, S - far, o, 41, -1, 1);
  drawBuildingBlock(g, 0, far, o, S - far, 73, 1, -1);
  drawBuildingBlock(g, far, far, S - far, S - far, 109, -1, -1);

  // calzada
  const pat = g.createPattern(getAsphaltTile(), "repeat")!;
  g.fillStyle = pat;
  g.fillRect(C - ROAD_HALF, 0, ROAD_HALF * 2, S);
  g.fillRect(0, C - ROAD_HALF, S, ROAD_HALF * 2);

  // sombra de cordón sobre la calzada (profundidad)
  const shade = 14;
  for (const off of [-ROAD_HALF, ROAD_HALF]) {
    const dir = off < 0 ? 1 : -1;
    const gx = g.createLinearGradient(C + off, 0, C + off + dir * shade, 0);
    gx.addColorStop(0, "rgba(0,0,0,0.42)");
    gx.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gx;
    g.fillRect(Math.min(C + off, C + off + dir * shade), 0, shade, S);
    const gy = g.createLinearGradient(0, C + off, 0, C + off + dir * shade);
    gy.addColorStop(0, "rgba(0,0,0,0.42)");
    gy.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gy;
    g.fillRect(0, Math.min(C + off, C + off + dir * shade), S, shade);
  }

  // cordones
  g.strokeStyle = PALETTE.curb;
  g.lineWidth = 3;
  g.beginPath();
  for (const off of [-ROAD_HALF, ROAD_HALF]) {
    g.moveTo(C + off, 0);
    g.lineTo(C + off, C - ROAD_HALF);
    g.moveTo(C + off, C + ROAD_HALF);
    g.lineTo(C + off, S);
    g.moveTo(0, C + off);
    g.lineTo(C - ROAD_HALF, C + off);
    g.moveTo(C + ROAD_HALF, C + off);
    g.lineTo(S, C + off);
  }
  g.stroke();

  // eje central doble
  g.strokeStyle = PALETTE.center;
  g.lineWidth = 2;
  for (const d of [-3.5, 3.5]) {
    g.beginPath();
    g.moveTo(C + d, 0);
    g.lineTo(C + d, C - ROAD_HALF);
    g.moveTo(C + d, C + ROAD_HALF);
    g.lineTo(C + d, S);
    g.moveTo(0, C + d);
    g.lineTo(C - ROAD_HALF, C + d);
    g.moveTo(C + ROAD_HALF, C + d);
    g.lineTo(S, C + d);
    g.stroke();
  }

  // separación de carriles
  g.strokeStyle = PALETTE.paintDim;
  g.lineWidth = 2;
  g.setLineDash([24, 22]);
  for (const d of [-ROAD_HALF / 2 - 14, ROAD_HALF / 2 + 14]) {
    g.beginPath();
    g.moveTo(C + d, 0);
    g.lineTo(C + d, C - ROAD_HALF);
    g.moveTo(C + d, C + ROAD_HALF);
    g.lineTo(C + d, S);
    g.moveTo(0, C + d);
    g.lineTo(C - ROAD_HALF, C + d);
    g.moveTo(C + ROAD_HALF, C + d);
    g.lineTo(S, C + d);
    g.stroke();
  }
  g.setLineDash([]);

  // sendas peatonales
  g.fillStyle = PALETTE.paint;
  for (let i = 0; i < 11; i++) {
    const a = C - 84 + i * 16;
    g.fillRect(a, C - 116, 9, 26);
    g.fillRect(a, C + 90, 9, 26);
    g.fillRect(C - 116, a, 26, 9);
    g.fillRect(C + 90, a, 26, 9);
  }

  // líneas de detención
  g.fillStyle = "rgba(236,240,245,0.85)";
  g.fillRect(C - 86, WORLD.stop - 4, 80, 6);
  g.fillRect(C + 6, S - WORLD.stop - 2, 80, 6);
  g.fillRect(WORLD.stop - 4, C + 6, 6, 80);
  g.fillRect(S - WORLD.stop - 2, C - 86, 6, 80);

  // flechas
  g.fillStyle = PALETTE.paintDim;
  const arrow = (cx: number, cy: number, rot: number) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    g.beginPath();
    g.moveTo(0, -18);
    g.lineTo(10, -3);
    g.lineTo(4, -3);
    g.lineTo(4, 18);
    g.lineTo(-4, 18);
    g.lineTo(-4, -3);
    g.lineTo(-10, -3);
    g.closePath();
    g.fill();
    g.restore();
  };
  arrow(C - LANE, WORLD.stop - 56, 0);
  arrow(C + LANE, S - WORLD.stop + 56, Math.PI);
  arrow(WORLD.stop - 56, C + LANE, Math.PI / 2);
  arrow(S - WORLD.stop + 56, C - LANE, -Math.PI / 2);

  // viñeta suave
  const vg = g.createRadialGradient(C, C, S * 0.32, C, C, S * 0.78);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.45)");
  g.fillStyle = vg;
  g.fillRect(0, 0, S, S);

  return c;
}

function getStaticLayer(): HTMLCanvasElement {
  if (!staticLayer) staticLayer = buildStaticLayer();
  return staticLayer;
}

/* ------------------------------------------------------------------ */
/* Postes, cámaras y semáforos                                          */
/* ------------------------------------------------------------------ */

interface Post {
  approach: Approach;
  cam: [number, number];
  base: [[number, number], [number, number]];
  signal: [number, number];
  rot: number;
}

const POSTS: Post[] = [
  {
    approach: "N",
    cam: [C - ROAD_HALF - 16, 250],
    base: [
      [C - 88, WORLD.zoneMin],
      [C - 2, WORLD.zoneMin],
    ],
    signal: [C - ROAD_HALF - 18, WORLD.stop - 30],
    rot: 0,
  },
  {
    approach: "S",
    cam: [C + ROAD_HALF + 16, S - 250],
    base: [
      [C + 2, S - WORLD.zoneMin],
      [C + 88, S - WORLD.zoneMin],
    ],
    signal: [C + ROAD_HALF + 18, S - WORLD.stop + 30],
    rot: Math.PI,
  },
  {
    approach: "W",
    cam: [250, C + ROAD_HALF + 16],
    base: [
      [WORLD.zoneMin, C + 2],
      [WORLD.zoneMin, C + 88],
    ],
    signal: [WORLD.stop - 30, C + ROAD_HALF + 18],
    rot: Math.PI / 2,
  },
  {
    approach: "E",
    cam: [S - 250, C - ROAD_HALF - 16],
    base: [
      [S - WORLD.zoneMin, C - 88],
      [S - WORLD.zoneMin, C - 2],
    ],
    signal: [S - WORLD.stop + 30, C - ROAD_HALF - 18],
    rot: -Math.PI / 2,
  },
];

function drawCameras(ctx: CanvasRenderingContext2D, engine: TrafficEngine, nowMs: number) {
  for (const p of POSTS) {
    if (!engine.cameraOffline) {
      const vis = engine.visibility;
      const grad = ctx.createLinearGradient(p.cam[0], p.cam[1], p.base[0][0], p.base[0][1]);
      grad.addColorStop(0, `rgba(226,232,240,${0.07 * vis})`);
      grad.addColorStop(1, "rgba(226,232,240,0)");
      ctx.beginPath();
      ctx.moveTo(p.cam[0], p.cam[1]);
      ctx.lineTo(p.base[0][0], p.base[0][1]);
      ctx.lineTo(p.base[1][0], p.base[1][1]);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = `rgba(226,232,240,${0.14 * vis})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 7]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // poste y carcasa
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.arc(p.cam[0] + 2, p.cam[1] + 3, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3d434c";
    ctx.beginPath();
    ctx.arc(p.cam[0], p.cam[1], 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#171b21";
    ctx.strokeStyle = "#535b67";
    ctx.lineWidth = 1.2;
    rr(ctx, p.cam[0], p.cam[1], 15, 10, 2.5);
    ctx.fill();
    ctx.stroke();
    const on = !engine.cameraOffline && Math.floor(nowMs / 900) % 2 === 0;
    ctx.fillStyle = engine.cameraOffline
      ? PALETTE.signalRed
      : on
        ? PALETTE.signalGreen
        : "rgba(63,191,116,0.25)";
    ctx.beginPath();
    ctx.arc(p.cam[0] + 4.5, p.cam[1] - 2.5, 1.6, 0, Math.PI * 2);
    ctx.fill();

    if (engine.cameraOffline) {
      ctx.save();
      ctx.font = "600 10px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(224,72,60,0.9)";
      ctx.fillText("SIN SEÑAL", p.cam[0], p.cam[1] - 13);
      ctx.restore();
    }
  }
}

function drawSignals(ctx: CanvasRenderingContext2D, engine: TrafficEngine) {
  for (const p of POSTS) {
    const state = engine.signalFor(p.approach);
    const [x, y] = p.signal;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.rot);

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.roundRect(-11, -48, 26, 60, 6);
    ctx.fill();

    ctx.strokeStyle = "#414853";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 24);
    ctx.lineTo(0, -8);
    ctx.stroke();

    const bodyGrad = ctx.createLinearGradient(-12, 0, 12, 0);
    bodyGrad.addColorStop(0, "#191d24");
    bodyGrad.addColorStop(1, "#0d1116");
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = "#4b535f";
    ctx.lineWidth = 1.4;
    rr(ctx, 0, -22, 24, 56, 6);
    ctx.fill();
    ctx.stroke();

    const lights: ("red" | "amber" | "green")[] = ["red", "amber", "green"];
    lights.forEach((light, i) => {
      const cy = -42 + i * 17 + 5;
      const active = state === light;
      const color =
        light === "red"
          ? PALETTE.signalRed
          : light === "amber"
            ? PALETTE.signalAmber
            : PALETTE.signalGreen;
      if (active) {
        const halo = ctx.createRadialGradient(0, cy, 0, 0, cy, 22);
        halo.addColorStop(0, `${color}55`);
        halo.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(-22, cy - 22, 44, 44);
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
      }
      ctx.fillStyle = active ? color : "#20242b";
      ctx.beginPath();
      ctx.arc(0, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (active) {
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath();
        ctx.arc(-1.8, cy - 1.8, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ */
/* Vehículos                                                            */
/* ------------------------------------------------------------------ */

function drawBeam(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  strength: number,
) {
  const len = 120;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(dy, dx));
  const grad = ctx.createLinearGradient(0, 0, len, 0);
  grad.addColorStop(0, `rgba(255,244,214,${0.18 * strength})`);
  grad.addColorStop(1, "rgba(255,244,214,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(len, -30);
  ctx.lineTo(len, 30);
  ctx.lineTo(0, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawVehicle(
  ctx: CanvasRenderingContext2D,
  v: Vehicle,
  engine: TrafficEngine,
  nowMs: number,
) {
  const g = vehicleGeometry(v);
  const [hx, hy] = heading(v.approach);
  const horizontal = v.approach === "W" || v.approach === "E";
  const lowLight = engine.night || engine.weather === "fog";
  const len = horizontal ? g.w : g.h;
  const wid = horizontal ? g.h : g.w;

  if (lowLight) {
    drawBeam(ctx, g.x + (hx * len) / 2, g.y + (hy * len) / 2, hx, hy, engine.weather === "fog" ? 1.35 : 1);
  }

  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(horizontal ? (v.approach === "W" ? 0 : Math.PI) : v.approach === "N" ? Math.PI / 2 : -Math.PI / 2);
  // sistema local: +X = avance, longitud = len, ancho = wid

  // sombra difusa
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 9;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  rr(ctx, 0, 0, len, wid, v.kind === "truck" ? 3 : 6);
  ctx.fill();
  ctx.restore();

  // carrocería
  const body = ctx.createLinearGradient(0, -wid / 2, 0, wid / 2);
  body.addColorStop(0, "rgba(255,255,255,0.22)");
  body.addColorStop(0.18, v.color);
  body.addColorStop(0.82, v.color);
  body.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = body;
  rr(ctx, 0, 0, len, wid, v.kind === "truck" ? 3 : 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1;
  ctx.stroke();

  if (v.kind === "moto") {
    ctx.fillStyle = "rgba(12,14,18,0.85)";
    rr(ctx, 0, 0, len * 0.5, wid * 0.55, 2);
    ctx.fill();
  } else if (v.kind === "truck") {
    // cabina + caja
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(-len / 2 + 3, -wid / 2 + 2, len * 0.62, wid - 4);
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-len / 2 + 3 + (len * 0.62 * i) / 4, -wid / 2 + 2);
      ctx.lineTo(-len / 2 + 3 + (len * 0.62 * i) / 4, wid / 2 - 2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(150,200,255,0.2)";
    ctx.fillRect(len / 2 - 9, -wid / 2 + 3, 5, wid - 6);
  } else {
    // techo
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    rr(ctx, -len * 0.04, 0, len * 0.44, wid - 5, 3);
    ctx.fill();
    // parabrisas y luneta
    ctx.fillStyle = "rgba(168,206,255,0.22)";
    ctx.beginPath();
    ctx.moveTo(len * 0.2, -wid / 2 + 3);
    ctx.lineTo(len * 0.36, -wid / 2 + 5.5);
    ctx.lineTo(len * 0.36, wid / 2 - 5.5);
    ctx.lineTo(len * 0.2, wid / 2 - 3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-len * 0.28, -wid / 2 + 3);
    ctx.lineTo(-len * 0.4, -wid / 2 + 5.5);
    ctx.lineTo(-len * 0.4, wid / 2 - 5.5);
    ctx.lineTo(-len * 0.28, wid / 2 - 3);
    ctx.closePath();
    ctx.fill();
    // espejos
    ctx.fillStyle = "rgba(20,24,30,0.9)";
    ctx.fillRect(len * 0.16, -wid / 2 - 2, 4, 2);
    ctx.fillRect(len * 0.16, wid / 2, 4, 2);
  }

  // faros
  if (lowLight) {
    ctx.fillStyle = "#fff4d2";
    ctx.fillRect(len / 2 - 3, -wid / 2 + 2.5, 2.5, 4);
    ctx.fillRect(len / 2 - 3, wid / 2 - 6.5, 2.5, 4);
  }
  // luces de freno
  if (v.speed < 3 && !v.crossed) {
    ctx.fillStyle = "#ff5b4d";
    ctx.shadowColor = "#ff5b4d";
    ctx.shadowBlur = 7;
    ctx.fillRect(-len / 2 + 1, -wid / 2 + 2.5, 2.5, 4);
    ctx.fillRect(-len / 2 + 1, wid / 2 - 6.5, 2.5, 4);
    ctx.shadowBlur = 0;
  }

  if (v.kind === "ambulance") {
    const flash = Math.floor(nowMs / 160) % 2 === 0;
    const col = flash ? "#e0483c" : "#4a86e8";
    ctx.fillStyle = "#d63a30";
    ctx.fillRect(-2, -wid / 2, 4, wid);
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 36);
    halo.addColorStop(0, `${col}4d`);
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(-36, -36, 72, 72);
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

function drawDetectionBox(ctx: CanvasRenderingContext2D, v: Vehicle, engine: TrafficEngine) {
  const inZone = v.p > WORLD.zoneMin && v.p < WORLD.stop && !v.crossed;
  if (engine.cameraOffline || !inZone) return;
  const g = vehicleGeometry(v);
  const pad = 7;
  const bx = g.x - g.w / 2 - pad;
  const by = g.y - g.h / 2 - pad;
  const bw = g.w + pad * 2;
  const bh = g.h + pad * 2;

  if (v.missed) {
    ctx.strokeStyle = "rgba(233,169,44,0.6)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.strokeRect(bx, by, bw, bh);
    ctx.setLineDash([]);
    return;
  }
  if (!v.conf) return;

  const accent = v.kind === "ambulance" ? PALETTE.signalRed : PALETTE.detectAcc;
  ctx.strokeStyle = "rgba(226,232,240,0.42)";
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, by + 0.5, bw, bh);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.4;
  const k = 6;
  ctx.beginPath();
  ctx.moveTo(bx, by + k);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx + k, by);
  ctx.moveTo(bx + bw - k, by);
  ctx.lineTo(bx + bw, by);
  ctx.lineTo(bx + bw, by + k);
  ctx.moveTo(bx + bw, by + bh - k);
  ctx.lineTo(bx + bw, by + bh);
  ctx.lineTo(bx + bw - k, by + bh);
  ctx.moveTo(bx + k, by + bh);
  ctx.lineTo(bx, by + bh);
  ctx.lineTo(bx, by + bh - k);
  ctx.stroke();

  const label = `${KIND_LABEL_ES[v.kind]} · ${(v.conf * 100).toFixed(0)}%`;
  ctx.font = "500 9.5px 'JetBrains Mono', monospace";
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = "rgba(10,13,17,0.82)";
  ctx.fillRect(bx, by - 15, tw + 10, 13);
  ctx.fillStyle = "rgba(226,232,240,0.92)";
  ctx.fillText(label, bx + 5, by - 5);
  ctx.fillStyle = accent;
  ctx.fillRect(bx, by - 15, (tw + 10) * v.conf, 1.5);
}

/* ------------------------------------------------------------------ */
/* Peatones                                                             */
/* ------------------------------------------------------------------ */

function drawPedestrians(
  ctx: CanvasRenderingContext2D,
  engine: TrafficEngine,
  analysis: boolean,
  nowMs: number,
) {
  for (const p of engine.pedestrians) {
    const [x, y] = pedPoint(p);
    const bob = p.waiting ? 0 : Math.sin(nowMs / 160 + p.id) * 0.7;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(x + 1.5, y + 2.5, 4.2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.reduced ? "#7fb2f0" : "#dfe4ea";
    ctx.beginPath();
    ctx.arc(x, y + bob, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.arc(x, y + bob, 1.5, 0, Math.PI * 2);
    ctx.fill();
    if (analysis && !engine.cameraOffline) {
      ctx.strokeStyle = p.reduced ? "rgba(127,178,240,0.85)" : "rgba(226,232,240,0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 7, y - 7, 14, 14);
      if (p.reduced) {
        ctx.font = "500 8px 'JetBrains Mono', monospace";
        ctx.fillStyle = "rgba(127,178,240,0.95)";
        ctx.fillText("mov. reducida", x + 9, y - 2);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Ambiente                                                             */
/* ------------------------------------------------------------------ */

function drawWetRoad(ctx: CanvasRenderingContext2D, nowMs: number) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 10; i++) {
    const t = (nowMs / 3000 + i * 0.1) % 1;
    ctx.fillStyle = "rgba(140,180,230,0.6)";
    ctx.fillRect(C - ROAD_HALF, t * S, ROAD_HALF * 2, 2);
  }
  ctx.restore();
}

function drawRain(ctx: CanvasRenderingContext2D, nowMs: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(178,201,232,0.2)";
  ctx.lineWidth = 1;
  const t = nowMs / 90;
  for (let i = 0; i < 260; i++) {
    const seed = i * 97.13;
    const x = (seed * 7.3 + t * 3) % S;
    const y = (seed * 13.7 + t * 24) % S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y + 14);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(24,42,68,0.14)";
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
}

function drawFog(ctx: CanvasRenderingContext2D, nowMs: number) {
  ctx.save();
  const drift = (nowMs / 70) % S;
  for (let i = 0; i < 3; i++) {
    const y = ((drift + i * 280) % (S + 300)) - 150;
    const grad = ctx.createLinearGradient(0, y - 130, 0, y + 130);
    grad.addColorStop(0, "rgba(196,206,220,0)");
    grad.addColorStop(0.5, "rgba(196,206,220,0.15)");
    grad.addColorStop(1, "rgba(196,206,220,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - 130, S, 260);
  }
  ctx.fillStyle = "rgba(186,198,214,0.19)";
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
}

function drawNight(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(6,10,22,0.5)";
  ctx.fillRect(0, 0, S, S);
  const lamps: [number, number][] = [
    [C - 128, C - 128],
    [C + 128, C - 128],
    [C - 128, C + 128],
    [C + 128, C + 128],
  ];
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [x, y] of lamps) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 120);
    grad.addColorStop(0, "rgba(255,196,110,0.16)");
    grad.addColorStop(1, "rgba(255,196,110,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - 120, y - 120, 240, 240);
  }
  ctx.restore();
  for (const [x, y] of lamps) {
    ctx.fillStyle = "rgba(255,214,140,0.85)";
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ------------------------------------------------------------------ */
/* Rótulos y HUD                                                        */
/* ------------------------------------------------------------------ */

function drawLabels(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.font = "500 10px 'JetBrains Mono', monospace";
  ctx.fillStyle = "rgba(226,232,240,0.45)";
  ctx.textAlign = "center";
  ctx.fillText("AV. SAN MARTÍN  ↓ N–S", C, 60);
  ctx.fillText("AV. SAN MARTÍN  ↑ N–S", C, S - 52);
  ctx.save();
  ctx.translate(58, C);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("URQUIZA  E–O →", 0, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(S - 50, C);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("← URQUIZA  E–O", 0, 0);
  ctx.restore();
  ctx.restore();
}

function drawHud(ctx: CanvasRenderingContext2D, engine: TrafficEngine, nowMs: number) {
  ctx.save();
  const pad = 18;
  ctx.fillStyle = "rgba(9,12,16,0.62)";
  ctx.fillRect(pad, pad, 320, 30);
  ctx.strokeStyle = "rgba(226,232,240,0.14)";
  ctx.lineWidth = 1;
  ctx.strokeRect(pad + 0.5, pad + 0.5, 320, 30);

  const hh = Math.floor(engine.hour).toString().padStart(2, "0");
  const mm = Math.floor((engine.hour % 1) * 60)
    .toString()
    .padStart(2, "0");
  ctx.font = "500 11px 'JetBrains Mono', monospace";
  ctx.fillStyle = "rgba(226,232,240,0.82)";
  ctx.fillText(`CAM-01  AV. SAN MARTÍN & URQUIZA  ${hh}:${mm}`, pad + 12, pad + 19);

  const rec = Math.floor(nowMs / 800) % 2 === 0;
  ctx.fillStyle = rec ? "#e0483c" : "rgba(224,72,60,0.28)";
  ctx.beginPath();
  ctx.arc(S - pad - 52, pad + 15, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(226,232,240,0.65)";
  ctx.fillText("REC", S - pad - 42, pad + 19);

  const mode = engine.failSafe ? "FAIL-SAFE · CICLO FIJO" : "AGENTE IA · ADAPTATIVO";
  ctx.fillStyle = "rgba(9,12,16,0.62)";
  ctx.fillRect(pad, S - pad - 30, 250, 30);
  ctx.strokeStyle = "rgba(226,232,240,0.14)";
  ctx.strokeRect(pad + 0.5, S - pad - 29.5, 250, 30);
  ctx.fillStyle = engine.failSafe ? "#e0483c" : PALETTE.signalGreen;
  ctx.fillText(mode, pad + 12, S - pad - 11);

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(226,232,240,0.55)";
  ctx.fillText(
    `σ N–S ${engine.perceivedCount("NS")}   σ E–O ${engine.perceivedCount("EW")}   VIS ${(engine.visibility * 100).toFixed(0)}%`,
    S - pad - 8,
    S - pad - 11,
  );
  ctx.restore();
}

/* ------------------------------------------------------------------ */

export function drawScene(
  ctx: CanvasRenderingContext2D,
  engine: TrafficEngine,
  nowMs: number,
  opts: DrawOptions = DEFAULT_DRAW_OPTIONS,
) {
  ctx.clearRect(0, 0, S, S);
  ctx.drawImage(getStaticLayer(), 0, 0);

  if (engine.weather === "rain") drawWetRoad(ctx, nowMs);
  if (opts.cameras) drawCameras(ctx, engine, nowMs);

  for (const v of engine.vehicles) drawVehicle(ctx, v, engine, nowMs);
  drawPedestrians(ctx, engine, opts.analysis, nowMs);
  drawSignals(ctx, engine);

  if (engine.night) drawNight(ctx);
  if (engine.weather === "rain") drawRain(ctx, nowMs);
  if (engine.weather === "fog") drawFog(ctx, nowMs);

  if (opts.analysis) {
    for (const v of engine.vehicles) drawDetectionBox(ctx, v, engine);
  }
  if (opts.labels) drawLabels(ctx);
  if (opts.hud) drawHud(ctx, engine, nowMs);
}
