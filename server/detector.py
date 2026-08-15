import math
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

# Colores BGR para visualización analítica en vivo
CLASS_COLORS = {
    "car": (80, 200, 100),       # Verde Esmeralda
    "bus": (20, 160, 245),       # Ámbar Transporte
    "truck": (240, 140, 60),     # Azul/Índigo Carga
    "moto": (220, 180, 20),      # Cyan Dos Ruedas
    "bicycle": (200, 200, 30),   # Cyan Claro
    "ambulance": (50, 50, 240),  # Rojo Emergencia
    "person": (240, 90, 180),    # Magenta Peatón
}

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
    speed_est: float = 0.0


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
    measures: Optional[dict] = None  # dict[str, ApproachMeasure] llenado por sensors.py
    calibration_ok: bool = False


class YoloDetector:
    """Detector YOLOv8 con soporte para inferencia en CPU/GPU mediante OpenCV DNN ONNX o Ultralytics."""

    def __init__(self, model_name: str = "yolov8n.pt") -> None:
        self._backend: str
        self._ultralytics_model: Any | None = None
        self._net: cv2.dnn.Net | None = None
        self._input_size = 640
        self._prev_centroids: dict[str, list[tuple[float, float, float]]] = {}  # tracker_key -> [(cx, cy, ts)]

        try:
            # ultralytics es OPCIONAL: si no está instalado, el detector cae
            # automáticamente al backend OpenCV DNN + modelo ONNX.
            # Ver server/requirements-ml.txt.
            from ultralytics import YOLO  # type: ignore[import-not-found]

            self._ultralytics_model = YOLO(model_name)
            self._backend = "ultralytics"
        except Exception:
            self._net = self._load_onnx()
            self._backend = "opencv" if self._net is not None else "none"

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

    def detect(self, frame: np.ndarray, ts: float, hour: float, tracker_key: str = "default") -> DetectionFrame:
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

        current_centroids: list[tuple[float, float, float]] = []
        prev_centroids = self._prev_centroids.get(tracker_key, [])

        for item in result:
            name, conf, x1, y1, x2, y2 = item
            cx = (x1 + x2) / 2.0
            cy = (y1 + y2) / 2.0
            bw = x2 - x1
            bh = y2 - y1
            lane = "NS" if cx < w * 0.5 else "EW"
            size_class = "large" if max(bw, bh) > 120 else "medium" if max(bw, bh) > 60 else "small"

            if name == "person":
                pedestrians.append(Pedestrian(float(cx / w), float(cy / h), float(conf)))
                continue

            if name not in _VEHICLE_NAMES:
                continue

            if name == "ambulance":
                emergency_detected = True

            # Estimación de velocidad básica por desplazamiento de centroides más cercanos
            # (el tracker es por cámara: cada flujo mantiene su propio historial de centroides)
            speed_est = 25.0
            if prev_centroids:
                min_dist = float("inf")
                for pcx, pcy, pts in prev_centroids:
                    dt = max(0.01, ts - pts)
                    dist = math.hypot(cx - pcx, cy - pcy)
                    if dist < min_dist:
                        min_dist = dist
                        speed_est = float(min(80.0, max(5.0, (dist / dt) * 0.15)))

            current_centroids.append((cx, cy, ts))

            kind = "moto" if name == "motorcycle" else name
            approach = "N" if lane == "NS" and cy < h * 0.5 else "S" if lane == "NS" else "E" if cy > h * 0.5 else "W"

            vehicles.append(
                Vehicle(
                    kind=kind,
                    approach=approach,
                    x=float(cx / w),
                    y=float(cy / h),
                    w=float(bw / w),
                    h=float(bh / h),
                    confidence=float(conf),
                    lane=lane,
                    size_class=size_class,
                    speed_est=speed_est,
                )
            )

        self._prev_centroids[tracker_key] = current_centroids[:20]

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

    def annotate_frame(
        self,
        frame: np.ndarray,
        detection: DetectionFrame,
        signal_state: str = "GREEN",
        signal_seconds: float = 18.0,
        axis_name: str = "EJE A (N-S)",
    ) -> np.ndarray:
        """Dibuja un Head-Up Display (HUD) de visión artificial con semáforo virtual, zonas virtuales y vectores."""
        annotated = frame.copy()
        h, w = annotated.shape[:2]

        # 1. Zona Virtual de Detección en la Calzada (Virtual Induction Loop)
        loop_y1 = int(h * 0.45)
        loop_y2 = int(h * 0.85)
        loop_x1 = int(w * 0.15)
        loop_x2 = int(w * 0.85)
        
        loop_overlay = annotated.copy()
        cv2.rectangle(loop_overlay, (loop_x1, loop_y1), (loop_x2, loop_y2), (255, 180, 50), 1)
        # Línea de detención virtual (Stop Line)
        cv2.line(loop_overlay, (loop_x1, loop_y2), (loop_x2, loop_y2), (0, 240, 255), 2)
        cv2.putText(
            loop_overlay,
            "ZONA DE SENSOR VIRTUAL (STOP-BAR)",
            (loop_x1 + 6, loop_y2 - 6),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.35,
            (0, 240, 255),
            1,
            cv2.LINE_AA,
        )
        cv2.addWeighted(loop_overlay, 0.4, annotated, 0.6, 0, annotated)

        # 2. Header superior translúcido con Telemetría
        header_h = 38
        top_overlay = annotated.copy()
        cv2.rectangle(top_overlay, (0, 0), (w, header_h), (12, 16, 22), -1)
        cv2.addWeighted(top_overlay, 0.85, annotated, 0.15, 0, annotated)

        header_text = f"AMEGHINO AI · {axis_name} | DEMANDA: {len(detection.vehicles)} VEH | PEAT: {len(detection.pedestrians)}"
        cv2.putText(annotated, header_text, (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (240, 245, 250), 1, cv2.LINE_AA)

        # 3. Semáforo Virtual Overlay HUD en la esquina superior derecha
        box_w, box_h = 130, 75
        box_x1 = w - box_w - 10
        box_y1 = 8
        box_x2 = w - 10
        box_y2 = box_y1 + box_h

        sem_overlay = annotated.copy()
        cv2.rectangle(sem_overlay, (box_x1, box_y1), (box_x2, box_y2), (10, 14, 18), -1)
        cv2.rectangle(sem_overlay, (box_x1, box_y1), (box_x2, box_y2), (60, 80, 100), 1)
        cv2.addWeighted(sem_overlay, 0.85, annotated, 0.15, 0, annotated)

        # Luces del semáforo: Roja, Amarilla, Verde
        is_green = signal_state.upper().startswith("G") or signal_state.upper().startswith("V")
        is_amber = signal_state.upper().startswith("A") or signal_state.upper().startswith("Y")
        is_red = not is_green and not is_amber

        r_col = (40, 40, 245) if is_red else (30, 30, 70)
        a_col = (20, 200, 245) if is_amber else (20, 70, 70)
        g_col = (50, 240, 100) if is_green else (20, 70, 30)

        sem_cx = box_x1 + 22
        cv2.circle(annotated, (sem_cx, box_y1 + 18), 7, r_col, -1)
        cv2.circle(annotated, (sem_cx, box_y1 + 38), 7, a_col, -1)
        cv2.circle(annotated, (sem_cx, box_y1 + 58), 7, g_col, -1)

        # Halo brillante en la luz activa
        if is_green:
            cv2.circle(annotated, (sem_cx, box_y1 + 58), 11, (50, 240, 100), 1)
        elif is_red:
            cv2.circle(annotated, (sem_cx, box_y1 + 18), 11, (40, 40, 245), 1)

        status_str = "VERDE" if is_green else ("AMARILLO" if is_amber else "ROJO")
        cv2.putText(
            annotated,
            status_str,
            (box_x1 + 40, box_y1 + 32),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )
        cv2.putText(
            annotated,
            f"{int(signal_seconds):02d}s",
            (box_x1 + 40, box_y1 + 58),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (50, 240, 100) if is_green else (100, 150, 255),
            2,
            cv2.LINE_AA,
        )

        # 4. Cajas delimitadoras y vectores sobre vehículos
        for v in detection.vehicles:
            cx = int(v.x * w)
            cy = int(v.y * h)
            bw = int(v.w * w)
            bh = int(v.h * h)
            x1 = max(0, int(cx - bw / 2))
            y1 = max(0, int(cy - bh / 2))
            x2 = min(w - 1, int(cx + bw / 2))
            y2 = min(h - 1, int(cy + bh / 2))

            color = CLASS_COLORS.get(v.kind, (80, 200, 100))
            if v.kind == "ambulance" or detection.emergency_detected:
                color = (40, 40, 250)

            # Caja con esquinas destacadas
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            corner_len = min(12, int(min(bw, bh) * 0.3))
            cv2.line(annotated, (x1, y1), (x1 + corner_len, y1), (255, 255, 255), 2)
            cv2.line(annotated, (x1, y1), (x1, y1 + corner_len), (255, 255, 255), 2)
            cv2.line(annotated, (x2, y2), (x2 - corner_len, y2), (255, 255, 255), 2)
            cv2.line(annotated, (x2, y2), (x2, y2 - corner_len), (255, 255, 255), 2)

            # Vector de velocidad
            speed_val = v.speed_est if v.speed_est > 0 else 32.0
            vector_len = int(min(30, speed_val * 0.7))
            cv2.arrowedLine(annotated, (cx, y2), (cx, min(h - 2, y2 + vector_len)), color, 2, tipLength=0.3)

            # Etiqueta de clase y velocidad
            kind_label = "SAME AMBULANCIA" if v.kind == "ambulance" else v.kind.upper()
            label = f"{kind_label} {int(v.confidence * 100)}% | {int(speed_val)} km/h"
            t_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.35, 1)[0]
            label_y = max(y1, t_size[1] + 6)
            cv2.rectangle(annotated, (x1, label_y - t_size[1] - 4), (x1 + t_size[0] + 6, label_y + 2), color, -1)
            cv2.putText(annotated, label, (x1 + 3, label_y - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (10, 15, 20), 1, cv2.LINE_AA)

        # 5. Peatones
        for p in detection.pedestrians:
            px = int(p.x * w)
            py = int(p.y * h)
            color = CLASS_COLORS["person"]
            cv2.circle(annotated, (px, py), 6, color, -1)
            cv2.circle(annotated, (px, py), 12, color, 1)
            cv2.putText(annotated, "PEATON", (px - 16, py - 14), cv2.FONT_HERSHEY_SIMPLEX, 0.3, color, 1, cv2.LINE_AA)

        # 6. Alerta de Emergencia Activa (si aplica)
        if detection.emergency_detected:
            em_overlay = annotated.copy()
            cv2.rectangle(em_overlay, (0, h - 34), (w, h), (20, 20, 220), -1)
            cv2.addWeighted(em_overlay, 0.85, annotated, 0.15, 0, annotated)
            cv2.putText(
                annotated,
                "[!] PRIORIDAD DE EMERGENCIA ACTIVA: ABRIENDO CORREDOR VERDE",
                (w // 2 - 210, h - 12),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (255, 255, 255),
                1,
                cv2.LINE_AA,
            )

        return annotated

    def _detect_ultralytics(self, frame: np.ndarray) -> list[tuple[str, float, float, float, float, float]]:
        results = self._ultralytics_model(frame, verbose=False, conf=0.32)
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
            if conf < 0.32:
                continue
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

        indices = cv2.dnn.NMSBoxes(boxes, scores, 0.32, 0.45)
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

    def _estimate_weather(self, frame: np.ndarray) -> str:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur = cv2.Laplacian(gray, cv2.CV_64F).var()
        if blur < 35:
            return "fog"
        return "clear"

    def _estimate_day_night(self, frame: np.ndarray) -> bool:
        brightness = float(np.mean(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)))
        return brightness < 70

