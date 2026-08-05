import {
  KIND_LABEL_ES,
  WORLD,
  type TrafficEngine,
  type Vehicle,
} from "@/lib/traffic/engine";

const C = WORLD.center;
const S = WORLD.size;

interface SignalHead {
  approach: "N" | "S" | "E" | "W";
  x: number;
  y: number;
}

const SIGNAL_HEADS: SignalHead[] = [
  { approach: "N", x: C - 104, y: 236 },
  { approach: "S", x: C + 88, y: 524 },
  { approach: "W", x: 236, y: C + 88 },
  { approach: "E", x: 524, y: C - 104 },
];

const SIGNAL_COLORS = {
  red: "#ff4b3e",
  amber: "#ffb930",
  green: "#2ee07a",
  off: "#2a3140",
};

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

function drawRoads(ctx: CanvasRenderingContext2D, night: boolean) {
  ctx.fillStyle = night ? "#060a11" : "#0b1018";
  ctx.fillRect(0, 0, S, S);

  ctx.fillStyle = night ? "#131a25" : "#1a2230";
  ctx.fillRect(C - 90, 0, 180, S);
  ctx.fillRect(0, C - 90, S, 180);
  ctx.fillStyle = night ? "#161e2a" : "#1f2836";
  ctx.fillRect(C - 90, C - 90, 180, 180);

  // bordes de calzada
  ctx.strokeStyle = "#2c3646";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const off of [-90, 90]) {
    ctx.moveTo(C + off, 0);
    ctx.lineTo(C + off, C - 90);
    ctx.moveTo(C + off, C + 90);
    ctx.lineTo(C + off, S);
    ctx.moveTo(0, C + off);
    ctx.lineTo(C - 90, C + off);
    ctx.moveTo(C + 90, C + off);
    ctx.lineTo(S, C + off);
  }
  ctx.stroke();

  // línea central amarilla discontinua
  ctx.strokeStyle = "#8f7a35";
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 14]);
  ctx.beginPath();
  ctx.moveTo(C, 0);
  ctx.lineTo(C, C - 90);
  ctx.moveTo(C, C + 90);
  ctx.lineTo(C, S);
  ctx.moveTo(0, C);
  ctx.lineTo(C - 90, C);
  ctx.moveTo(C + 90, C);
  ctx.lineTo(S, C);
  ctx.stroke();
  ctx.setLineDash([]);

  // sendas peatonales
  ctx.fillStyle = "rgba(226,232,240,0.45)";
  for (let i = 0; i < 10; i++) {
    const a = C - 80 + i * 16;
    ctx.fillRect(a, C - 108, 8, 22); // norte
    ctx.fillRect(a, C + 86, 8, 22); // sur
    ctx.fillRect(C - 108, a, 22, 8); // oeste
    ctx.fillRect(C + 86, a, 22, 8); // este
  }

  // líneas de detención
  ctx.fillStyle = "rgba(226,232,240,0.8)";
  ctx.fillRect(C - 82, WORLD.stop - 3, 74, 5); // N
  ctx.fillRect(C + 8, S - WORLD.stop - 2, 74, 5); // S
  ctx.fillRect(WORLD.stop - 3, C + 8, 5, 74); // W
  ctx.fillRect(S - WORLD.stop - 2, C - 82, 5, 74); // E
}

function drawCameraCones(ctx: CanvasRenderingContext2D, engine: TrafficEngine) {
  const cones: { apex: [number, number]; base: [number, number][] }[] = [
    { apex: [C - 96, 246], base: [[C - 84, WORLD.zoneMin], [C - 6, WORLD.zoneMin]] },
    { apex: [C + 96, S - 246], base: [[C + 6, S - WORLD.zoneMin], [C + 84, S - WORLD.zoneMin]] },
    { apex: [246, C + 96], base: [[WORLD.zoneMin, C + 6], [WORLD.zoneMin, C + 84]] },
    { apex: [S - 246, C - 96], base: [[S - WORLD.zoneMin, C - 84], [S - WORLD.zoneMin, C - 6]] },
  ];
  for (const cone of cones) {
    if (engine.cameraOffline) {
      ctx.fillStyle = SIGNAL_COLORS.red;
      ctx.font = "600 10px 'JetBrains Mono', monospace";
      ctx.fillText("CAM OFFLINE", cone.apex[0] - 30, cone.apex[1] - 10);
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(cone.apex[0], cone.apex[1]);
    ctx.lineTo(cone.base[0][0], cone.base[0][1]);
    ctx.lineTo(cone.base[1][0], cone.base[1][1]);
    ctx.closePath();
    ctx.fillStyle = "rgba(46,224,122,0.06)";
    ctx.fill();
    ctx.strokeStyle = "rgba(46,224,122,0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#2ee07a";
    ctx.beginPath();
    ctx.arc(cone.apex[0], cone.apex[1], 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSignals(ctx: CanvasRenderingContext2D, engine: TrafficEngine) {
  for (const head of SIGNAL_HEADS) {
    const state = engine.signalFor(head.approach);
    ctx.fillStyle = "#10151d";
    ctx.strokeStyle = "#323c4c";
    ctx.lineWidth = 1.5;
    roundRect(ctx, head.x + 8, head.y + 21, 16, 42, 4);
    ctx.fill();
    ctx.stroke();
    const lights: ("red" | "amber" | "green")[] = ["red", "amber", "green"];
    lights.forEach((light, i) => {
      const cy = head.y + 8 + i * 13;
      const active = state === light;
      if (active) {
        ctx.shadowColor = SIGNAL_COLORS[light];
        ctx.shadowBlur = 12;
      }
      ctx.fillStyle = active ? SIGNAL_COLORS[light] : SIGNAL_COLORS.off;
      ctx.beginPath();
      ctx.arc(head.x + 8, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }
}

function drawVehicles(ctx: CanvasRenderingContext2D, engine: TrafficEngine, nowMs: number) {
  for (const v of engine.vehicles) {
    const g = vehicleGeometry(v);
    ctx.fillStyle = v.color;
    roundRect(ctx, g.x, g.y, g.w, g.h, 4);
    ctx.fill();

    // parabrisas
    ctx.fillStyle = "rgba(10,14,20,0.55)";
    const horizontal = v.approach === "W" || v.approach === "E";
    if (horizontal) {
      ctx.fillRect(g.x - g.w / 6 - 3, g.y - g.h / 2 + 2, 6, g.h - 4);
    } else {
      ctx.fillRect(g.x - g.w / 2 + 2, g.y - g.h / 6 - 3, g.w - 4, 6);
    }

    // luces de freno
    if (v.speed < 3 && !v.crossed) {
      ctx.fillStyle = "#ff5a4e";
      ctx.shadowColor = "#ff5a4e";
      ctx.shadowBlur = 6;
      if (horizontal) {
        ctx.fillRect(g.x - g.w / 2 - 1, g.y - g.h / 2, 2, 4);
        ctx.fillRect(g.x - g.w / 2 - 1, g.y + g.h / 2 - 4, 2, 4);
      } else {
        ctx.fillRect(g.x - g.w / 2, g.y - g.h / 2 - 1, 4, 2);
        ctx.fillRect(g.x + g.w / 2 - 4, g.y - g.h / 2 - 1, 4, 2);
      }
      ctx.shadowBlur = 0;
    }

    // baliza de emergencia
    if (v.kind === "ambulance") {
      const flash = Math.floor(nowMs / 180) % 2 === 0;
      ctx.fillStyle = flash ? "#ff3b30" : "#3b82f6";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // franja roja
      ctx.fillStyle = "#e02424";
      if (horizontal) ctx.fillRect(g.x - 2, g.y - g.h / 2, 4, g.h);
      else ctx.fillRect(g.x - g.w / 2, g.y - 2, g.w, 4);
    }

    // bounding box de la IA
    const inZone = v.p > WORLD.zoneMin && v.p < WORLD.stop && !v.crossed;
    if (!engine.cameraOffline && inZone && v.conf) {
      ctx.strokeStyle = "#2ee07a";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(g.x - g.w / 2 - 6, g.y - g.h / 2 - 6, g.w + 12, g.h + 12);
      ctx.setLineDash([]);
      const label = `${KIND_LABEL_ES[v.kind]} ${(v.conf * 100).toFixed(0)}%`;
      ctx.font = "600 10px 'JetBrains Mono', monospace";
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(6,12,10,0.85)";
      ctx.fillRect(g.x - g.w / 2 - 6, g.y - g.h / 2 - 22, tw + 8, 14);
      ctx.fillStyle = "#2ee07a";
      ctx.fillText(label, g.x - g.w / 2 - 2, g.y - g.h / 2 - 11);
    }
  }
}

function drawNightOverlay(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(2,6,16,0.32)";
  ctx.fillRect(0, 0, S, S);
  // halos de luminarias en las esquinas
  const corners: [number, number][] = [
    [C - 130, C - 130],
    [C + 130, C - 130],
    [C - 130, C + 130],
    [C + 130, C + 130],
  ];
  for (const [x, y] of corners) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 90);
    grad.addColorStop(0, "rgba(255,185,48,0.14)");
    grad.addColorStop(1, "rgba(255,185,48,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - 90, y - 90, 180, 180);
  }
}

export function drawScene(ctx: CanvasRenderingContext2D, engine: TrafficEngine, nowMs: number) {
  ctx.clearRect(0, 0, S, S);
  drawRoads(ctx, engine.night);
  drawCameraCones(ctx, engine);
  drawVehicles(ctx, engine, nowMs);
  drawSignals(ctx, engine);
  if (engine.night) drawNightOverlay(ctx);
}