import type { TwinPayload } from "@/lib/traffic/types";
import { TrafficEngine, type Approach } from "./engine";

/** TwinController: consume TwinPayload del backend y lo inyecta en un TrafficEngine. */
export class TwinController {
  private engine: TrafficEngine;
  private ready = false;

  constructor() {
    this.engine = new TrafficEngine();
    this.engine.setHour(new Date().getHours() + new Date().getMinutes() / 60);
    this.engine.setMinutesPerSecond(60);
  }

  getEngine(): TrafficEngine { return this.engine; }

  ingest(twin: TwinPayload, nowMs: number): void {
    if (!twin || !twin.approaches) return;
    void nowMs;
    this.ready = true;
    this.engine.setHour(twin.ts % 24);

    const flows: Partial<Record<Approach, number>> = {};
    let nsTotal = 0, ewTotal = 0;
    for (const [a, m] of Object.entries(twin.approaches)) {
      const app = a as Approach;
      if (!["N", "S", "E", "W"].includes(app)) continue;
      const flowH = Math.round(((m as { flowEst?: number }).flowEst ?? 6) * 60);
      flows[app] = flowH;
      if (app === "N" || app === "S") nsTotal += flowH; else ewTotal += flowH;
    }
    this.engine.setOverrides(flows);
    this.engine.setNsShare(nsTotal + ewTotal > 0 ? nsTotal / (nsTotal + ewTotal) : 0.5);
    if (twin.nsQueue !== undefined && twin.ewQueue !== undefined && twin.nsQueue + twin.ewQueue > 0) {
      this.engine.setNsShare(twin.nsQueue / (twin.nsQueue + twin.ewQueue));
    }
  }

  isReady(): boolean { return this.ready; }
    step(dt: number): void { this.engine.update(dt); }

  reset(): void {
    this.engine.vehicles = [];
    this.engine.pedestrians = [];
    this.engine.clearApproachOverrides();
    this.engine.setHour(new Date().getHours() + new Date().getMinutes() / 60);
    this.ready = false;
  }
}
