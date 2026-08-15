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

export type SourceMode = "synthetic" | "real";
