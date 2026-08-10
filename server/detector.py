import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import cv2
import numpy as np

MODEL_DIR = Path(__file__).resolve().parent / "models"
ONNX_MODEL = MODEL_DIR / "yolov8n.onnx"

CLASS_MAP = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
    8: "ambulance",
}

# Clases aceptadas como vehículo en el conteo de densidad.
_VEHICLE_NAMES = {"car", "motorcycle", "bus", "truck", "ambulance", "bicycle"}


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


class YoloDetector:
    """Detector YOLO con doble backend.

    - Si `ultralytics` está instalado, se usa directamente.
    - Si no, se usa OpenCV DNN con un modelo YOLOv8n en formato ONNX
      (sin torch, sin dependencias pesadas), almacenado en server/models/.
    """

    def __init__(self, model_name: str = "yolov8n.pt") -> None:
        self._backend: str
        self._ultralytics_model: Any | None = None
        self._net: cv2.dnn.Net | None = None
        self._input_size = 640

        try:
            from ultralytics import YOLO

            self._ultralytics_model = YOLO(model_name)
            self._backend = "ultralytics"
        except Exception:
            self._net = self._load_onnx()
            self._backend = "opencv" if self._net is not None else "none"

    # ------------------------------------------------------------------
    # Backends
    # ------------------------------------------------------------------

    def _load_onnx(self) -> cv2.dnn.Net | None:
        if not ONNX_MODEL.exists():
            return None
        try:
            net = cv2.dnn.readNetFromONNX(str(ONNX_MODEL))
            net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
            net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
            return net
        except Exception:
            return None

    def detect(self, frame: np.ndarray, ts: float, hour: float) -> DetectionFrame:
        if self._backend == "ultralytics" and self._ultralytics_model is not None:
            result = self._detect_ultralytics(frame)
        elif self._backend == "opencv" and self._net is not None:
            result = self._detect_opencv(frame)
        else:
            result = self._empty_result()

        h, w = frame.shape[:2]
        vehicles: list[Vehicle] = []
        pedestrians: list[Pedestrian] = []
        emergency_detected = False

        for item in result:
            name, conf, x1, y1, x2, y2 = item
            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2
            bw = x2 - x1
            bh = y2 - y1
            lane = "NS" if cx < w * 0.5 else "EW"
            size_class = "large" if max(bw, bh) > 120 else "medium" if max(bw, bh) > 60 else "small"

            if name == "person":
                pedestrians.append(Pedestrian(cx / w, cy / h, conf))
                continue

            if name not in _VEHICLE_NAMES:
                continue

            if name == "ambulance":
                emergency_detected = True

            kind = "moto" if name == "motorcycle" else name
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

    def _detect_ultralytics(self, frame: np.ndarray) -> list[tuple[str, float, float, float, float, float]]:
        results = self._ultralytics_model(frame, verbose=False, conf=0.35)
        detections: list[tuple[str, float, float, float, float, float]] = []
        for r in results:
            if r.boxes is None:
                continue
            for box in r.boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                x1, y1, x2, y2 = map(float, box.xyxy[0])
                detections.append((CLASS_MAP.get(cls, "car"), conf, x1, y1, x2, y2))
        return detections

    def _detect_opencv(self, frame: np.ndarray) -> list[tuple[str, float, float, float, float, float]]:
        h, w = frame.shape[:2]
        blob = cv2.dnn.blobFromImage(
            frame,
            scalefactor=1.0 / 255.0,
            size=(self._input_size, self._input_size),
            mean=(0, 0, 0),
            swapRB=True,
            crop=False,
        )
        self._net.setInput(blob)
        outputs = self._net.forward()
        # YOLOv8n ONNX: shape (1, 84, 8400) -> (4 box + 80 class, anchors)
        preds = outputs[0].transpose((1, 0))  # (8400, 84)
        scale_x = w / self._input_size
        scale_y = h / self._input_size

        boxes: list[tuple[float, float, float, float]] = []
        scores: list[float] = []
        class_ids: list[int] = []

        for pred in preds:
            class_scores = pred[4:]
            class_id = int(np.argmax(class_scores))
            conf = float(class_scores[class_id])
            if conf < 0.35:
                continue
            # Convertir a float nativo de Python: los valores del tensor ONNX son np.float32
            # y romperían la serialización JSON si se propagan tal cual.
            cx = float(pred[0])
            cy = float(pred[1])
            bw = float(pred[2])
            bh = float(pred[3])
            x1 = (cx - bw / 2) * scale_x
            y1 = (cy - bh / 2) * scale_y
            x2 = (cx + bw / 2) * scale_x
            y2 = (cy + bh / 2) * scale_y
            boxes.append((x1, y1, x2 - x1, y2 - y1))
            scores.append(conf)
            class_ids.append(class_id)

        if not boxes:
            return []

        indices = cv2.dnn.NMSBoxes(boxes, scores, 0.35, 0.45)
        detections: list[tuple[str, float, float, float, float, float]] = []
        for i in indices.flatten():
            x1, y1, bw, bh = boxes[i]
            detections.append(
                (CLASS_MAP.get(class_ids[i], "car"), scores[i], x1, y1, x1 + bw, y1 + bh)
            )
        return detections

    def _empty_result(self) -> list[tuple[str, float, float, float, float, float]]:
        return []

    def backend(self) -> str:
        return self._backend

    # ------------------------------------------------------------------
    # Heurísticas de escena
    # ------------------------------------------------------------------

    def _estimate_weather(self, frame: np.ndarray) -> str:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur = cv2.Laplacian(gray, cv2.CV_64F).var()
        if blur < 35:
            return "fog"
        return "clear"

    def _estimate_day_night(self, frame: np.ndarray) -> bool:
        brightness = float(np.mean(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)))
        return brightness < 70
