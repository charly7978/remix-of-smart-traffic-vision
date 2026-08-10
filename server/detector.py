import time
from dataclasses import dataclass
from typing import Any, Optional

import cv2
import numpy as np
from ultralytics import YOLO


@dataclass
class Vehicle:
    kind: str
    approach: str
    x: float
    y: float
    w: float
    h: float
    confidence: float
    lane: str
    size_class: str


@dataclass
class Pedestrian:
    x: float
    y: float
    confidence: float


@dataclass
class DetectionFrame:
    ts: float
    hour: float
    vehicles: list[Vehicle]
    pedestrians: list[Pedestrian]
    weather: str
    is_night: bool
    lane_density: dict[str, float]
    emergency_detected: bool
    raw_image: Optional[str] = None


CLASS_MAP = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
    8: "ambulance",
}


class YoloDetector:
    def __init__(self, model_name: str = "yolov8n.pt") -> None:
        self.model = YOLO(model_name)

    def detect(self, frame: np.ndarray, ts: float, hour: float) -> DetectionFrame:
        results = self.model(frame, verbose=False, conf=0.35)[0]
        h, w = frame.shape[:2]
        vehicles: list[Vehicle] = []
        pedestrians: list[Pedestrian] = []
        emergency_detected = False

        for box in results.boxes:
            cls = int(box.cls[0])
            name = CLASS_MAP.get(cls, "car")
            conf = float(box.conf[0])
            x1, y1, x2, y2 = map(float, box.xyxy[0])
            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2
            bw = x2 - x1
            bh = y2 - y1
            lane = "NS" if cx < w * 0.5 else "EW"
            size_class = "large" if max(bw, bh) > 120 else "medium" if max(bw, bh) > 60 else "small"

            if name == "person":
                pedestrians.append(Pedestrian(cx / w, cy / h, conf))
                continue

            if name == "ambulance":
                emergency_detected = True

            kind = name
            if name == "bus":
                kind = "bus"
            elif name == "truck":
                kind = "truck"
            elif name == "car":
                kind = "car"
            elif name == "motorcycle":
                kind = "moto"
            else:
                kind = "car"

            vehicles.append(
                Vehicle(
                    kind=kind,
                    approach="N" if lane == "NS" and cy < h * 0.5 else "S" if lane == "NS" else "E" if cy > h * 0.5 else "W",
                    x=cx / w,
                    y=cy / h,
                    w=bw / w,
                    h=bh / h,
                    confidence=conf,
                    lane=lane,
                    size_class=size_class,
                )
            )

        lane_density = {"NS": 0.0, "EW": 0.0}
        for v in vehicles:
            lane_density[v.lane] = lane_density.get(v.lane, 0.0) + 1.0

        weather = self._estimate_weather(frame)
        is_night = self._estimate_day_night(frame)

        return DetectionFrame(
            ts=ts,
            hour=hour,
            vehicles=vehicles,
            pedestrians=pedestrians,
            weather=weather,
            is_night=is_night,
            lane_density=lane_density,
            emergency_detected=emergency_detected,
            raw_image=None,
        )

    def _estimate_weather(self, frame: np.ndarray) -> str:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur = cv2.Laplacian(gray, cv2.CV_64F).var()
        if blur < 35:
            return "fog"
        return "clear"

    def _estimate_day_night(self, frame: np.ndarray) -> bool:
        brightness = float(np.mean(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)))
        return brightness < 70
