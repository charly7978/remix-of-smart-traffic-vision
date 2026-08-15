import { useEffect, useRef } from "react";
import { drawScene, type DrawOptions, DEFAULT_DRAW_OPTIONS } from "@/components/simulator/draw";
import type { TwinController } from "@/lib/traffic/twinController";

export function TwinViewport({
  controller,
  drawOptions = DEFAULT_DRAW_OPTIONS,
  width = 512,
  height = 512,
}: {
  controller: TwinController;
  drawOptions?: DrawOptions;
  width?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;
    const loop = (nowMs: number) => {
      if (!running) return;
      const engine = controller.getEngine();
      engine.update(0.016);
      drawScene(ctx, engine, nowMs, drawOptions);
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(frameRef.current);
    };
  }, [controller, drawOptions]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded-lg border border-border shadow-inner w-full"
      style={{ aspectRatio: `${width}/${height}` }}
    />
  );
}