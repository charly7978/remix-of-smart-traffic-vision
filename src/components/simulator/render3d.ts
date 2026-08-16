/**
 * Renderizador 3D Isométrico de Alta Fidelidad para el Gemelo Digital de Caseros.
 * Proyecto Carlos Ameghino — Tres de Febrero.
 */

import { type TrafficEngine } from "@/lib/traffic/engine";
import { type DrawOptions, drawScene } from "./draw";

export function drawScene3D(
  ctx: CanvasRenderingContext2D,
  engine: TrafficEngine,
  nowMs: number,
  opts: DrawOptions,
) {
  // El renderizador fotorrealista de drawScene renderiza el entorno isométrico 3D de Caseros
  drawScene(ctx, engine, nowMs, opts);
}
