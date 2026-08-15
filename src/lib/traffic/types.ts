export type CameraSource = {
  id: string;
  name: string;
  url: string;
  kind: "public" | "local" | "upload";
  location?: string;
};

export type DetectionVehicle = {
  kind: string;
  approach: string;
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
  lane: string;
  sizeClass: string;
};

export type DetectionPedestrian = {
  x: number;
  y: number;
  confidence: number;
};

export type DetectionFrame = {
  ts: number;
  hour: number;
  vehicles: DetectionVehicle[];
  pedestrians: DetectionPedestrian[];
  weather: string;
  isNight: boolean;
  laneDensity: Record<string, number>;
  emergencyDetected: boolean;
  rawImage: string | null;
};

export type RealEngineConfig = {
  camera: CameraSource;
  model: "yolov8n" | "yolov11n" | "yolov8s";
  decisionMode: "auto" | "assisted";
};

export type SourceMode = "synthetic" | "real" | "twin";

export type ApproachMeasurePayload = {
  approach: string;
  count: number;
  queue: number;
  queueMeters: number;
  density: number;
  flowEst: number;
  speedAvg: number;
  stoppedRatio: number;
  pedWaiting: number;
};

export type TwinPayload = {
  ts: number;
  approaches: Record<string, {
    approach: string;
    count: number;
    queue: number;
    queueMeters: number;
    flowEst: number;
    speedAvg: number;
  }>;
  nsFlow: number;
  ewFlow: number;
  nsQueue: number;
  ewQueue: number;
  signal: { axis: string; phase: string; countdown: number };
  decision: {
    action: string;
    seconds: number;
    axis: string;
    confidence: number;
    rationale: string;
  };
  calibrationOk: boolean;
};
