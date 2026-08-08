import {
  KIND_LABEL_ES,
  WORLD,
  type Approach,
  type TrafficEngine,
  type Vehicle,
} from "@/lib/traffic/engine";

const C = WORLD.center;
const S = WORLD.size;

const SIGNAL_COLORS = {
  red: "#ff4b3e",
  amber: "#ffb930",
  green: "#2ee07a",
  off: "#232a36",
};

const ROAD_HALF = 92;

/* ------------------------------------------------------------------ */
/* Capas cacheadas                                                     */
/* ------------------------------------------------------------------ */

let asphaltPattern: CanvasPattern | null = null;
let staticLayer: HTMLCanvasElement | null = null;
let staticKey = "";

function makeAsphalt(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (asphaltPattern) return asphaltPattern;
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#1b2230";
  g.fillRect(0, 0, 96, 96);
  const img = g.getImageData(0, 0, 96, 96);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 16;
    img.data[i] = Math.max(0, img.data[i]! + n);
    img.data[i + 1] = Math.max(0, img.data[i + 1]! + n);
    img.data[i + 2] = Math.max(0, img.data[i + 2]! + n);
  }
  g.putImageData(img, 0, 0);
  asphaltPattern = ctx.createPattern(c, "repeat");
  return asphaltPattern;
}

/* ------------------------------------------------------------------ */
/* Geometría                                                           */
/* ------------------------------------------------------------------ */

function vehicleGeometry(v: Vehicle): { x: number; y: number; w: number; h: number } {
  const L = WORLD.laneOffset;
  switch (v.approach) {
    case "N":
      return { x: C - L, y: v.p - v.length / 2, w: v.width, h: v.length };
    case "S":
      return { x: C + L, y: S - v.p + v.length / 2, w: v.width, h: v.length };
    case "W":
      return { x: v.p - v.length / 2, y: C + L, w: v.length, h: v.width };
    case "E":
      return { x: S - v.p + v.length / 2, y: C - L, w: v.length, h: v.width };
  }
}

/** vector unitario de avance del vehículo */
function heading(a: Approach): [number, number] {
  return a === "N" ? [0, 1] : a === "S" ? [0, -1] : a === "W" ? [1, 0] : [-1, 0];
}

function roundRect(
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
/* Capa estática: veredas, manzanas, calzada, demarcación              */
/* ------------------------------------------------------------------ */

function drawBlock(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number) {
  // vereda
  g.fillStyle = "#232b38";
  g.fillRect(x, y, w, h);
  g.strokeStyle = "#2b3444";
  g.lineWidth = 1;
  for (let i = x; i < x + w; i += 26) {
    g.beginPath();
    g.moveTo(i, y);
    g.lineTo(i, y + h);
    g.stroke();
  }
  for (let j = y; j < y + h; j += 26) {
    g.beginPath();
    g.moveTo(x, j);
    g.lineTo(x + w, j);
    g.stroke();
  }

  // edificación
  const pad = 26;
  const bx = x + pad;
  const by = y + pad;
  const bw = w - pad * 2;
  const bh = h - pad * 2;
  if (bw <= 20 || bh <= 20) return;

  let rnd = seed;
  const rand = () => {
    rnd = (rnd * 1103515245 + 12345) % 2147483648;
    return rnd / 2147483648;
  };

  const cols = 2;
  const rows = 2;
  for (let cI = 0; cI < cols; cI++) {
    for (let rI = 0; rI < rows; rI++) {
      const ux = bx + (bw / cols) * cI + 4;
      const uy = by + (bh / rows) * rI + 4;
      const uw = bw / cols - 8;
      const uh = bh / rows - 8;
      const tone = 0.08 + rand() * 0.06;
      g.fillStyle = `rgba(150,175,215,${tone})`;
      g.fillRect(ux, uy, uw, uh);
      g.strokeStyle = "rgba(150,175,215,0.14)";
      g.strokeRect(ux + 0.5, uy + 0.5, uw - 1, uh - 1);
      // ventanas
      for (let wx = ux + 8; wx < ux + uw - 8; wx += 14) {
        for (let wy = uy + 8; wy < uy + uh - 8; wy += 14) {
          if (rand() > 0.55) continue;
          g.fillStyle = `rgba(200,220,255,${0.05 + rand() * 0.08})`;
          g.fillRect(wx, wy, 6, 6);
        }
      }
    }
  }
}

function buildStaticLayer(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;

  g.fillStyle = "#0d121b";
  g.fillRect(0, 0, S, S);

  // manzanas en las cuatro esquinas
  const o = C - ROAD_HALF;
  const far = C + ROAD_HALF;
  drawBlock(g, 0, 0, o, o, 7);
  drawBlock(g, far, 0, S - far, o, 31);
  drawBlock(g, 0, far, o, S - far, 53);
  drawBlock(g, far, far, S - far, S - far, 91);

  // calzada
  const pat = makeAsphalt(g);
  g.fillStyle = (pat as unknown as string) ?? "#1b2230";
  g.fillRect(C - ROAD_HALF, 0, ROAD_HALF * 2, S);
  g.fillRect(0, C - ROAD_HALF, S, ROAD_HALF * 2);

  // cordones
  g.strokeStyle = "#3a4557";
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

  // eje central doble amarillo
  g.strokeStyle = "rgba(214,178,72,0.75)";
  g.lineWidth = 2;
  for (const d of [-3, 3]) {
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

  // línea de borde de carril
  g.strokeStyle = "rgba(226,232,240,0.22)";
  g.lineWidth = 2;
  g.setLineDash([22, 20]);
  for (const d of [-ROAD_HALF / 2 - 12, ROAD_HALF / 2 + 12]) {
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

  // sendas peatonales tipo cebra
  g.fillStyle = "rgba(232,238,246,0.62)";
  for (let i = 0; i < 11; i++) {
    const a = C - 84 + i * 16;
    g.fillRect(a, C - 112, 9, 24);
    g.fillRect(a, C + 88, 9, 24);
    g.fillRect(C - 112, a, 24, 9);
    g.fillRect(C + 88, a, 24, 9);
  }

  // líneas de detención
  g.fillStyle = "rgba(240,246,252,0.9)";
  g.fillRect(C - 86, WORLD.stop - 4, 80, 6);
  g.fillRect(C + 6, S - WORLD.stop - 2, 80, 6);
  g.fillRect(WORLD.stop - 4, C + 6, 6, 80);
  g.fillRect(S - WORLD.stop - 2, C - 86, 6, 80);

  // flechas de dirección
  g.fillStyle = "rgba(226,232,240,0.5)";
  const arrow = (cx: number, cy: number, rot: number) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    g.beginPath();
    g.moveTo(0, -16);
    g.lineTo(9, -2);
    g.lineTo(3.5, -2);
    g.lineTo(3.5, 16);
    g.lineTo(-3.5, 16);
    g.lineTo(-3.5, -2);
    g.lineTo(-9, -2);
    g.closePath();
    g.fill();
    g.restore();
  };
  arrow(C - WORLD.laneOffset, WORLD.stop - 52, 0);
  arrow(C + WORLD.laneOffset, S - WORLD.stop + 52, Math.PI);
  arrow(WORLD.stop - 52, C + WORLD.laneOffset, Math.PI / 2);
  arrow(S - WORLD.stop + 52, C - WORLD.laneOffset, -Math.PI / 2);

  return c;
}

function getStaticLayer(): HTMLCanvasElement {
  const key = "v2";
  if (!staticLayer || staticKey !== key) {
    staticLayer = buildStaticLayer();
    staticKey = key;
  }
  return staticLayer;
}

/* ------------------------------------------------------------------ */
/* Cámaras y detecciones                                               */
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
    cam: [C - ROAD_HALF - 12, 262],
    base: [
      [C - 86, WORLD.zoneMin],
      [C - 4, WORLD.zoneMin],
    ],
    signal: [C - ROAD_HALF - 14, WORLD.stop - 26],
    rot: 0,
  },
  {
    approach: "S",
    cam: [C + ROAD_HALF + 12, S - 262],
    base: [
      [C + 4, S - WORLD.zoneMin],
      [C + 86, S - WORLD.zoneMin],
    ],
    signal: [C + ROAD_HALF + 14, S - WORLD.stop + 26],
    rot: Math.PI,
  },
  {
    approach: "W",
    cam: [262, C + ROAD_HALF + 12],
    base: [
      [WORLD.zoneMin, C + 4],
      [WORLD.zoneMin, C + 86],
    ],
    signal: [WORLD.stop - 26, C + ROAD_HALF + 14],
    rot: Math.PI / 2,
  },
  {
    approach: "E",
    cam: [S - 262, C - ROAD_HALF - 12],
    base: [
      [S - WORLD.zoneMin, C - 86],
      [S - WORLD.zoneMin, C - 4],
    ],
    signal: [S - WORLD.stop + 26, C - ROAD_HALF - 14],
    rot: -Math.PI / 2,
  },
];

function drawCones(ctx: CanvasRenderingContext2D, engine: TrafficEngine, nowMs: number) {
  const vis = engine.visibility;
  for (const p of POSTS) {
    if (engine.cameraOffline) {
      ctx.save();
      ctx.fillStyle = SIGNAL_COLORS.red;
      ctx.font = "600 11px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("SIN SEÑAL", p.cam[0], p.cam[1] - 14);
      ctx.strokeStyle = "rgba(255,75,62,0.5)";
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(p.cam[0], p.cam[1]);
      ctx.lineTo(p.base[0][0], p.base[0][1]);
      ctx.moveTo(p.cam[0], p.cam[1]);
      ctx.lineTo(p.base[1][0], p.base[1][1]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      continue;
    }

    const grad = ctx.createLinearGradient(p.cam[0], p.cam[1], p.base[0][0], p.base[0][1]);
    grad.addColorStop(0, `rgba(46,224,122,${0.16 * vis})`);
    grad.addColorStop(1, "rgba(46,224,122,0)");
    ctx.beginPath();
    ctx.moveTo(p.cam[0], p.cam[1]);
    ctx.lineTo(p.base[0][0], p.base[0][1]);
    ctx.lineTo(p.base[1][0], p.base[1][1]);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = `rgba(46,224,122,${0.3 * vis})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // barrido de escaneo
    const t = ((nowMs / 2200) % 1 + POSTS.indexOf(p) * 0.15) % 1;
    ctx.save();
    ctx.clip();
    const sx = p.cam[0] + (p.base[0][0] + p.base[1][0]) / 2 - p.cam[0];
    const sy = p.cam[1] + (p.base[0][1] + p.base[1][1]) / 2 - p.cam[1];
    ctx.globalAlpha = 0.35 * vis;
    ctx.strokeStyle = "#2ee07a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const px = p.cam[0] + (sx - p.cam[0]) * 0;
    void px;
    const lx = p.cam[0] + (p.base[0][0] - p.cam[0]) * t;
    const ly = p.cam[1] + (p.base[0][1] - p.cam[1]) * t;
    const rx = p.cam[0] + (p.base[1][0] - p.cam[0]) * t;
    const ry = p.cam[1] + (p.base[1][1] - p.cam[1]) * t;
    ctx.moveTo(lx, ly);
    ctx.lineTo(rx, ry);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    void sy;

    // poste + carcasa de cámara
    ctx.fillStyle = "#39445a";
    ctx.beginPath();
    ctx.arc(p.cam[0], p.cam[1], 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#151b26";
    ctx.strokeStyle = "#4d5a72";
    ctx.lineWidth = 1.5;
    roundRect(ctx, p.cam[0], p.cam[1], 14, 9, 2);
    ctx.fill();
    ctx.stroke();
    const blink = Math.floor(nowMs / 700) % 2 === 0;
    ctx.fillStyle = blink ? "#2ee07a" : "#134a2c";
    ctx.beginPath();
    ctx.arc(p.cam[0] + 4, p.cam[1] - 2, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ------------------------------------------------------------------ */
/* Semáforos                                                           */
/* ------------------------------------------------------------------ */

function drawSignals(ctx: CanvasRenderingContext2D, engine: TrafficEngine) {
  for (const p of POSTS) {
    const state = engine.signalFor(p.approach);
    const [x, y] = p.signal;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.rot);

    // brazo y columna
    ctx.strokeStyle = "#3b4658";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 22);
    ctx.lineTo(0, -6);
    ctx.stroke();

    // pantalla de contraste
    ctx.fillStyle = "#0c1017";
    ctx.strokeStyle = "#46536a";
    ctx.lineWidth = 1.5;
    roundRect(ctx, 0, -22, 24, 54, 6);
    ctx.fill();
    ctx.stroke();

    const lights: ("red" | "amber" | "green")[] = ["red", "amber", "green"];
    lights.forEach((light, i) => {
      const cy = -40 + i * 16 + 4;
      const active = state === light;
      if (active) {
        const halo = ctx.createRadialGradient(0, cy, 0, 0, cy, 20);
        halo.addColorStop(0, `${SIGNAL_COLORS[light]}66`);
        halo.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(-20, cy - 20, 40, 40);
        ctx.shadowColor = SIGNAL_COLORS[light];
        ctx.shadowBlur = 14;
      }
      ctx.fillStyle = active ? SIGNAL_COLORS[light] : SIGNAL_COLORS.off;
      ctx.beginPath();
      ctx.arc(0, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ */
/* Vehículos                                                           */
/* ------------------------------------------------------------------ */

function drawHeadlightBeam(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  strength: number,
) {
  const len = 110;
  const grad = ctx.createLinearGradient(x, y, x + dx * len, y + dy * len);
  grad.addColorStop(0, `rgba(255,240,200,${0.22 * strength})`);
  grad.addColorStop(1, "rgba(255,240,200,0)");
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(len, -34);
  ctx.lineTo(len, 34);
  ctx.lineTo(0, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawVehicles(ctx: CanvasRenderingContext2D, engine: TrafficEngine, nowMs: number) {
  const night = engine.night;
  const lowLight = night || engine.weather === "fog";

  for (const v of engine.vehicles) {
    const g = vehicleGeometry(v);
    const [hx, hy] = heading(v.approach);
    const horizontal = v.approach === "W" || v.approach === "E";

    // haz de luces
    if (lowLight) {
      drawHeadlightBeam(
        ctx,
        g.x + (hx * (horizontal ? g.w : g.h)) / 2,
        g.y + (hy * (horizontal ? g.w : g.h)) / 2,
        hx,
        hy,
        engine.weather === "fog" ? 1.3 : 1,
      );
    }

    // sombra
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRect(ctx, g.x + 2, g.y + 3, g.w, g.h, 5);
    ctx.fill();

    // carrocería con degradado
    const bodyGrad = horizontal
      ? ctx.createLinearGradient(0, g.y - g.h / 2, 0, g.y + g.h / 2)
      : ctx.createLinearGradient(g.x - g.w / 2, 0, g.x + g.w / 2, 0);
    bodyGrad.addColorStop(0, v.color);
    bodyGrad.addColorStop(0.55, v.color);
    bodyGrad.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = bodyGrad;
    roundRect(ctx, g.x, g.y, g.w, g.h, v.kind === "truck" ? 3 : 5);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // techo / cabina
    ctx.fillStyle = "rgba(8,12,18,0.45)";
    if (horizontal) ctx.fillRect(g.x - g.w / 6, g.y - g.h / 2 + 3, g.w / 2.6, g.h - 6);
    else ctx.fillRect(g.x - g.w / 2 + 3, g.y - g.h / 6, g.w - 6, g.h / 2.6);

    // parabrisas
    ctx.fillStyle = "rgba(180,215,255,0.16)";
    if (horizontal) ctx.fillRect(g.x + hx * (g.w / 2 - 7), g.y - g.h / 2 + 3, 4, g.h - 6);
    else ctx.fillRect(g.x - g.w / 2 + 3, g.y + hy * (g.h / 2 - 7), g.w - 6, 4);

    // faros delanteros
    if (lowLight) {
      ctx.fillStyle = "#fff2c8";
      const fx = g.x + (hx * (horizontal ? g.w : g.w)) / 2;
      void fx;
      if (horizontal) {
        ctx.fillRect(g.x + hx * (g.w / 2 - 2), g.y - g.h / 2 + 2, 2, 4);
        ctx.fillRect(g.x + hx * (g.w / 2 - 2), g.y + g.h / 2 - 6, 2, 4);
      } else {
        ctx.fillRect(g.x - g.w / 2 + 2, g.y + hy * (g.h / 2 - 2), 4, 2);
        ctx.fillRect(g.x + g.w / 2 - 6, g.y + hy * (g.h / 2 - 2), 4, 2);
      }
    }

    // luces de freno
    if (v.speed < 3 && !v.crossed) {
      ctx.fillStyle = "#ff5a4e";
      ctx.shadowColor = "#ff5a4e";
      ctx.shadowBlur = 8;
      if (horizontal) {
        ctx.fillRect(g.x - hx * (g.w / 2), g.y - g.h / 2 + 2, 2, 4);
        ctx.fillRect(g.x - hx * (g.w / 2), g.y + g.h / 2 - 6, 2, 4);
      } else {
        ctx.fillRect(g.x - g.w / 2 + 2, g.y - hy * (g.h / 2), 4, 2);
        ctx.fillRect(g.x + g.w / 2 - 6, g.y - hy * (g.h / 2), 4, 2);
      }
      ctx.shadowBlur = 0;
    }

    // ambulancia
    if (v.kind === "ambulance") {
      const flash = Math.floor(nowMs / 150) % 2 === 0;
      const col = flash ? "#ff3b30" : "#3b82f6";
      const halo = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, 34);
      halo.addColorStop(0, `${col}55`);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(g.x - 34, g.y - 34, 68, 68);
      ctx.fillStyle = "#e02424";
      if (horizontal) ctx.fillRect(g.x - 2, g.y - g.h / 2, 4, g.h);
      else ctx.fillRect(g.x - g.w / 2, g.y - 2, g.w, 4);
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // caja de detección de la IA
    const inZone = v.p > WORLD.zoneMin && v.p < WORLD.stop && !v.crossed;
    if (!engine.cameraOffline && inZone) {
      if (v.missed) {
        ctx.strokeStyle = "rgba(255,185,48,0.55)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.strokeRect(g.x - g.w / 2 - 7, g.y - g.h / 2 - 7, g.w + 14, g.h + 14);
        ctx.setLineDash([]);
      } else if (v.conf) {
        const bx = g.x - g.w / 2 - 7;
        const by = g.y - g.h / 2 - 7;
        const bw = g.w + 14;
        const bh = g.h + 14;
        ctx.strokeStyle = v.kind === "ambulance" ? "#ff4b3e" : "#2ee07a";
        ctx.lineWidth = 1.4;
        const k = 7;
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

        const label = `${KIND_LABEL_ES[v.kind]} ${(v.conf * 100).toFixed(0)}%`;
        ctx.font = "600 10px 'JetBrains Mono', monospace";
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(6,12,10,0.9)";
        ctx.fillRect(bx, by - 16, tw + 10, 14);
        ctx.fillStyle = v.kind === "ambulance" ? "#ff7a70" : "#2ee07a";
        ctx.fillRect(bx, by - 16, (tw + 10) * v.conf, 1.5);
        ctx.fillText(label, bx + 5, by - 5.5);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Clima, noche y HUD                                                  */
/* ------------------------------------------------------------------ */

function drawRain(ctx: CanvasRenderingContext2D, nowMs: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(170,200,240,0.28)";
  ctx.lineWidth = 1;
  const t = nowMs / 90;
  for (let i = 0; i < 220; i++) {
    const seed = i * 97.13;
    const x = (seed * 7.3 + t * 3) % S;
    const y = (seed * 13.7 + t * 22) % S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y + 13);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(20,40,70,0.16)";
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
}

function drawFog(ctx: CanvasRenderingContext2D, nowMs: number) {
  ctx.save();
  const drift = (nowMs / 60) % S;
  for (let i = 0; i < 3; i++) {
    const y = (drift + i * 280) % (S + 300) - 150;
    const grad = ctx.createLinearGradient(0, y - 120, 0, y + 120);
    grad.addColorStop(0, "rgba(190,205,225,0)");
    grad.addColorStop(0.5, "rgba(190,205,225,0.16)");
    grad.addColorStop(1, "rgba(190,205,225,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - 120, S, 240);
  }
  ctx.fillStyle = "rgba(180,196,216,0.2)";
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
}

function drawNight(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(4,8,20,0.44)";
  ctx.fillRect(0, 0, S, S);
  const corners: [number, number][] = [
    [C - 132, C - 132],
    [C + 132, C - 132],
    [C - 132, C + 132],
    [C + 132, C + 132],
  ];
  for (const [x, y] of corners) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 110);
    grad.addColorStop(0, "rgba(255,190,90,0.16)");
    grad.addColorStop(1, "rgba(255,190,90,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - 110, y - 110, 220, 220);
    ctx.fillStyle = "rgba(255,205,120,0.75)";
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHud(ctx: CanvasRenderingContext2D, engine: TrafficEngine, nowMs: number) {
  ctx.save();
  // marco técnico
  ctx.strokeStyle = "rgba(46,224,122,0.35)";
  ctx.lineWidth = 1.5;
  const m = 14;
  const k = 26;
  const corners: [number, number, number, number][] = [
    [m, m, 1, 1],
    [S - m, m, -1, 1],
    [m, S - m, 1, -1],
    [S - m, S - m, -1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x + sx * k, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + sy * k);
    ctx.stroke();
  }

  ctx.font = "600 11px 'JetBrains Mono', monospace";
  const hh = Math.floor(engine.hour).toString().padStart(2, "0");
  const mm = Math.floor((engine.hour % 1) * 60)
    .toString()
    .padStart(2, "0");
  ctx.fillStyle = "rgba(226,232,240,0.75)";
  ctx.fillText(`CAM-01 · AV. SAN MARTÍN & URQUIZA · ${hh}:${mm}`, 26, 30);

  const rec = Math.floor(nowMs / 600) % 2 === 0;
  ctx.fillStyle = rec ? "#ff4b3e" : "rgba(255,75,62,0.3)";
  ctx.beginPath();
  ctx.arc(S - 78, 26, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(226,232,240,0.75)";
  ctx.fillText("REC", S - 68, 30);

  const mode = engine.failSafe ? "FAIL-SAFE" : "ADAPTATIVO";
  ctx.fillStyle = engine.failSafe ? "#ff4b3e" : "#2ee07a";
  ctx.fillText(`MODO ${mode}`, 26, S - 24);

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(226,232,240,0.6)";
  ctx.fillText(
    `σ NS ${engine.perceivedCount("NS")} · σ EO ${engine.perceivedCount("EW")} · VIS ${(engine.visibility * 100).toFixed(0)}%`,
    S - 26,
    S - 24,
  );
  ctx.restore();
}

/* ------------------------------------------------------------------ */

export function drawScene(ctx: CanvasRenderingContext2D, engine: TrafficEngine, nowMs: number) {
  ctx.clearRect(0, 0, S, S);
  ctx.drawImage(getStaticLayer(), 0, 0);

  if (engine.weather === "rain") {
    ctx.fillStyle = "rgba(120,160,210,0.05)";
    ctx.fillRect(C - ROAD_HALF, 0, ROAD_HALF * 2, S);
    ctx.fillRect(0, C - ROAD_HALF, S, ROAD_HALF * 2);
  }

  drawCones(ctx, engine, nowMs);
  drawVehicles(ctx, engine, nowMs);
  drawSignals(ctx, engine);

  if (engine.night) drawNight(ctx);
  if (engine.weather === "rain") drawRain(ctx, nowMs);
  if (engine.weather === "fog") drawFog(ctx, nowMs);

  drawHud(ctx, engine, nowMs);
}
