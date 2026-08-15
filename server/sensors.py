"""Motor de medición por acceso para el cruce con dos cámaras.

Convierte las detecciones de cada cámara (detector.py) en medidas de
tránsito por acceso (N/S/E/O): cola detenida, densidad, flujo estimado y
velocidad media. Estas medidas alimentan el Gemelo Digital (frontend) para
que el control simulado reproduzca la demanda real observada.

La calibración es por cámara, con polígonos normalizados (0..1). Sin
calibración configurada se usan defaults que cubren la franja central de la
imagen.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import cv2
import numpy as np

from detector import DetectionFrame, Vehicle

CALIBRATIONS_FILE = Path(__file__).resolve().parent / "calibrations.json"

# Un vehículo se considera "en cola" por debajo de esta velocidad estimada (km/h)
QUEUE_SPEED_THRESHOLD_KPH = 10.0
# Largo promedio de vehículo + separación entre ejes (metros) → longitud de cola
QUEUE_SPACING_METERS = 6.5
# Capacidad nominal de una zona de densidad (autos) para normalizar 0..1
ZONE_CAPACITY = 14
# Distancia (normalizada) para considerar un centroide como "el mismo vehículo"
FLOW_MATCH_DIST = 0.10
# Límite superior de flujo estimado (veh/min) para evitar picos de demanda falsa
FLOW_MAX_VEH_PER_MIN = 120.0
# Ventana de observación (seg) para acumular llegadas y derivar veh/min
FLOW_WINDOW_SEC = 15.0
# Suavizado exponencial del flujo estimado (0..1)
FLOW_SMOOTH = 0.55
PRIMARY_AXES = {"NS": ("N", "S"), "EW": ("E", "W")}


@dataclass
class CalibrationPoint:
    x: float  # normalizado 0..1
    y: float  # normalizado 0..1


@dataclass
class CameraCalibration:
    camera_id: str
    primary_axis: str  # "NS" | "EW" — eje principal que la cámara vigila
    approach_side: float = 0.5  # x normalizado que divide el sentido de cada carril
    stop_zone: list[CalibrationPoint] = field(default_factory=list)
    density_zone: list[CalibrationPoint] = field(default_factory=list)
    signal_position: Optional[CalibrationPoint] = None

    @staticmethod
    def default(camera_id: str, primary_axis: str) -> "CameraCalibration":
        """Calibración por defecto: franja central de la imagen."""
        if primary_axis == "EW":
            stop_zone = [CalibrationPoint(0.42, 0.12), CalibrationPoint(0.58, 0.12), CalibrationPoint(0.58, 0.88), CalibrationPoint(0.42, 0.88)]
            density_zone = [CalibrationPoint(0.30, 0.08), CalibrationPoint(0.70, 0.08), CalibrationPoint(0.70, 0.92), CalibrationPoint(0.30, 0.92)]
            signal_position = CalibrationPoint(0.12, 0.12)
        else:  # NS
            stop_zone = [CalibrationPoint(0.10, 0.50), CalibrationPoint(0.90, 0.50), CalibrationPoint(0.90, 0.92), CalibrationPoint(0.10, 0.92)]
            density_zone = [CalibrationPoint(0.10, 0.28), CalibrationPoint(0.90, 0.28), CalibrationPoint(0.90, 0.92), CalibrationPoint(0.10, 0.92)]
            signal_position = CalibrationPoint(0.84, 0.10)
        return CameraCalibration(
            camera_id=camera_id,
            primary_axis=primary_axis,
            approach_side=0.5,
            stop_zone=stop_zone,
            density_zone=density_zone,
            signal_position=signal_position,
        )
@dataclass
class ApproachMeasure:
    approach: str  # "N" | "S" | "E" | "W"
    count: int = 0
    queue: int = 0
    queue_meters: float = 0.0
    density: float = 0.0
    flow_est: float = 0.0  # veh/min
    speed_avg: float = 0.0  # km/h
    stopped_ratio: float = 0.0
    ped_waiting: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "approach": self.approach,
            "count": self.count,
            "queue": self.queue,
            "queueMeters": round(self.queue_meters, 1),
            "density": round(self.density, 2),
            "flowEst": round(self.flow_est, 1),
            "speedAvg": round(self.speed_avg, 1),
            "stoppedRatio": round(self.stopped_ratio, 2),
            "pedWaiting": self.ped_waiting,
        }


@dataclass
class TwinPayload:
    ts: float
    approaches: dict[str, ApproachMeasure]
    ns_flow: float
    ew_flow: float
    ns_queue: int
    ew_queue: int
    signal: dict[str, Any]
    decision: dict[str, Any]
    calibration_ok: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "ts": self.ts,
            "approaches": {k: v.to_dict() for k, v in self.approaches.items()},
            "nsFlow": round(self.ns_flow, 1),
            "ewFlow": round(self.ew_flow, 1),
            "nsQueue": self.ns_queue,
            "ewQueue": self.ew_queue,
            "signal": self.signal,
            "decision": self.decision,
            "calibrationOk": self.calibration_ok,
        }


# ---------------------------------------------------------------------------
# Carga de calibraciones
# ---------------------------------------------------------------------------

def load_calibrations() -> dict[str, CameraCalibration]:
    if not CALIBRATIONS_FILE.exists():
        return {}
    try:
        raw = json.loads(CALIBRATIONS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}
    result: dict[str, CameraCalibration] = {}
    for item in raw:
        try:
            result[item["camera_id"]] = CameraCalibration(
                camera_id=item["camera_id"],
                primary_axis=item.get("primary_axis", "NS"),
                approach_side=float(item.get("approach_side", 0.5)),
                stop_zone=[CalibrationPoint(float(p["x"]), float(p["y"])) for p in item.get("stop_zone", [])],
                density_zone=[CalibrationPoint(float(p["x"]), float(p["y"])) for p in item.get("density_zone", [])],
                signal_position=(
                    CalibrationPoint(float(item["signal_position"]["x"]), float(item["signal_position"]["y"]))
                    if item.get("signal_position") else None
                ),
            )
        except Exception:
            continue
    return result
# ---------------------------------------------------------------------------
# Geometría auxiliar (coordenadas normalizadas 0..1)
# ---------------------------------------------------------------------------

def _in_polygon(poly: list[CalibrationPoint] | None, x: float, y: float) -> bool:
    if not poly:
        return False
    pts = np.array([[p.x, p.y] for p in poly], dtype=np.float32)
    return cv2.pointPolygonTest(pts, (float(x), float(y)), False) >= 0


def _approach_of(v: Vehicle, cal: CameraCalibration) -> str:
    """Asigna el acceso (N/S/E/O) de un vehículo según la calibración."""
    primaries = PRIMARY_AXES[cal.primary_axis]
    if cal.primary_axis == "NS":
        return primaries[0] if v.y < cal.approach_side + 0.3 else primaries[1]
    return primaries[0] if v.x > cal.approach_side else primaries[1]


# ---------------------------------------------------------------------------
# Motor de medición
# ---------------------------------------------------------------------------

class MeasurementEngine:
    """Mide tránsito por acceso a partir de detecciones de cada cámara."""

    def __init__(self, calibrations: Optional[dict[str, CameraCalibration]] = None) -> None:
        self._calibrations: dict[str, CameraCalibration] = dict(calibrations or {})
        self._prev_cents: dict[str, list[tuple[float, float, float]]] = {}  # camera_id -> [(x, y, ts)]
        self._arrival_ts: dict[str, list[float]] = {}  # camera_id -> timestamps de llegadas
        self._smooth_flow: dict[str, float] = {}

    def set_calibration(self, camera_id: str, calibration: CameraCalibration) -> None:
        self._calibrations[camera_id] = calibration

    def remove_calibration(self, camera_id: str) -> None:
        self._calibrations.pop(camera_id, None)

    def get(self, camera_id: str) -> CameraCalibration:
        return self._calibrations.get(camera_id, CameraCalibration.default(camera_id, "NS"))

    def calibration_ids(self) -> list[str]:
        return sorted(self._calibrations.keys())

    def is_calibrated(self, camera_id: str) -> bool:
        """True solo si la cámara tiene una calibración EXPLÍCITA configurada
        (no la calibración default por ejes). La bandera del gemelo usa esta
        semántica: 'calibrado' == hay polígonos medidos, no solo ejes."""
        return camera_id in self._calibrations

    def measure(self, camera_id: str, detection: DetectionFrame, ts: float) -> tuple[dict[str, ApproachMeasure], CameraCalibration]:
        """Analiza un DetectionFrame y produce ApproachMeasures por acceso.

        El flujo estimado (veh/min) sale de la tasa de VEHÍCULOS NUEVOS observados
        en la zona de densidad respecto del fotograma anterior (emparejamiento por
        centrodide más cercano por cámara), ajustada a veh/min.
        """
        cal = self.get(camera_id)
        measures: dict[str, ApproachMeasure] = {}
        for approach in PRIMARY_AXES[cal.primary_axis]:
            m = ApproachMeasure(approach=approach)
            # Vehículos en zona de densidad, mapeados al acceso correcto
            in_density = [v for v in detection.vehicles
                          if _in_polygon(cal.density_zone, v.x, v.y)
                          and _approach_of(v, cal) == approach]
            in_stop = [v for v in in_density
                       if _in_polygon(cal.stop_zone, v.x, v.y)]
            stopped = [v for v in in_stop
                       if v.speed_est < QUEUE_SPEED_THRESHOLD_KPH]

            m.count = len(in_density)
            m.queue = len(stopped)
            m.queue_meters = m.queue * QUEUE_SPACING_METERS
            m.density = min(1.0, m.count / ZONE_CAPACITY)
            speeds = [v.speed_est for v in in_density if v.speed_est > 0]
            m.speed_avg = float(np.mean(speeds)) if speeds else 0.0
            m.stopped_ratio = round(m.queue / max(1, m.count), 2)
            m.ped_waiting = sum(1 for p in detection.pedestrians
                                if _in_polygon(cal.stop_zone, p.x, p.y))
            measures[approach] = m

        # Flujo (veh/min) por llegadas: centroides nuevos sin emparejar en la cámara,
        # acumulados en una ventana de observación (vehículos entrando a la vista).
        prev = self._prev_cents.get(camera_id, [])
        now: list[tuple[float, float, float]] = [
            (float(v.x), float(v.y), v.speed_est) for v in detection.vehicles
        ]
        arrivals = 0
        for x, y, _sp in now:
            nearest = None
            best_dist = float("inf")
            for px, py, _pts in prev:
                d = math.hypot(x - px, y - py)
                if d < best_dist:
                    best_dist = d
                    nearest = (px, py)
            if nearest is None or best_dist > FLOW_MATCH_DIST:
                arrivals += 1
        self._prev_cents[camera_id] = now

        history = self._arrival_ts.setdefault(camera_id, [])
        if arrivals:
            history.append(ts)
        # Conservar solo la ventana de observación
        cutoff = ts - FLOW_WINDOW_SEC
        history = [t for t in history if t >= cutoff]
        self._arrival_ts[camera_id] = history

        window_hits = len(history)
        raw_flow = window_hits / FLOW_WINDOW_SEC * 60.0
        raw_flow = max(0.0, min(FLOW_MAX_VEH_PER_MIN, raw_flow))
        prev_smooth = self._smooth_flow.get(camera_id, raw_flow)
        smoothed = FLOW_SMOOTH * raw_flow + (1.0 - FLOW_SMOOTH) * prev_smooth
        self._smooth_flow[camera_id] = smoothed

        for approach in PRIMARY_AXES[cal.primary_axis]:
            measures[approach].flow_est = smoothed / 2.0

        return measures, cal
# ---------------------------------------------------------------------------
# Fusión de las dos cámaras → estado del gemelo
# ---------------------------------------------------------------------------

def _decision_payload(decision: Any) -> dict[str, Any]:
    if decision is None:
        return {"action": "MANTENER_CICLO", "seconds": 20.0, "axis": "NS", "confidence": 0.85, "rationale": "Análisis en tiempo real", "contract": {}}
    return {
        "action": decision.action,
        "seconds": round(decision.seconds, 1),
        "axis": decision.axis,
        "confidence": round(decision.confidence, 2),
        "rationale": decision.rationale,
        "contract": getattr(decision, "contract", {}) or {},
    }


def compute_twin(
    measures_a: dict[str, ApproachMeasure],
    measures_b: dict[str, ApproachMeasure],
    decision: Any,
    ts: float,
    calibration_ok: bool = True,
) -> TwinPayload:
    """Fusiona medidas de cámara A (NS) y cámara B (EW) en un TwinPayload."""
    approaches: dict[str, ApproachMeasure] = {}
    for k, v in measures_a.items():
        if k in ("N", "S"):
            approaches[k] = v
    for k, v in measures_b.items():
        if k in ("E", "W"):
            approaches[k] = v

    def _get(app: str) -> ApproachMeasure:
        return approaches.get(app, ApproachMeasure(approach=app))

    n, s, e, w = _get("N"), _get("S"), _get("E"), _get("W")

    return TwinPayload(
        ts=ts,
        approaches=approaches,
        ns_flow=n.flow_est + s.flow_est,
        ew_flow=e.flow_est + w.flow_est,
        ns_queue=n.queue + s.queue,
        ew_queue=e.queue + w.queue,
        signal={"axis": decision.axis if decision else "NS", "phase": "green", "countdown": round(decision.seconds if decision else 20.0, 1)},
        decision=_decision_payload(decision),
        calibration_ok=calibration_ok,
    )