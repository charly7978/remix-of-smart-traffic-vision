import asyncio
import base64
import json
import time
from pathlib import Path
from typing import Any, Optional

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse

from camera_capture import CameraCapture, CameraSource, get_capture
from detector import YoloDetector, DetectionFrame
from decision import detections_to_evidence, auto_decide

app = FastAPI(title="Ameghino AI Vision")


def _json_safe(value: Any) -> Any:
    """Normaliza tipos numpy (float32, int64, ndarray) a tipos JSON nativos."""
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    return value


def _vehicle_to_dict(v) -> dict:
    """Convierte Vehicle dataclass a dict con claves camelCase."""
    return {
        "kind": v.kind,
        "approach": v.approach,
        "x": _json_safe(v.x),
        "y": _json_safe(v.y),
        "w": _json_safe(v.w),
        "h": _json_safe(v.h),
        "confidence": _json_safe(v.confidence),
        "lane": v.lane,
        "sizeClass": v.size_class,
        "speedEst": _json_safe(getattr(v, "speed_est", 25.0)),
    }


def build_frame_payload(detection: DetectionFrame, decision, jpg_b64: str) -> dict:
    """Construye el payload JSON con claves camelCase para el frontend."""
    return _json_safe({
        "ts": detection.ts,
        "hour": detection.hour,
        "vehicles": [_vehicle_to_dict(v) for v in detection.vehicles],
        "pedestrians": [{"x": p.x, "y": p.y, "confidence": p.confidence} for p in detection.pedestrians],
        "weather": detection.weather,
        "isNight": detection.is_night,
        "laneDensity": detection.lane_density or {"NS": 0, "EW": 0},
        "emergencyDetected": detection.emergency_detected,
        "image": jpg_b64,
        "decision": {
            "action": decision.action if decision else "MANTENER_CICLO",
            "seconds": round(decision.seconds, 1) if decision else 20.0,
            "axis": decision.axis if decision else "NS",
            "confidence": round(decision.confidence, 2) if decision else 0.85,
            "rationale": decision.rationale if decision else "Análisis en tiempo real",
            "contract": decision.contract if decision else {},
        },
    })

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

capture = CameraCapture()
detector = YoloDetector("yolov8n.pt")
current_axis = "NS"
config = {
    "beta": 3.2,
    "t_min": 10.0,
    "t_max": 70.0,
    "ped_boost": 12.0,
    "emergency_boost": 24.0,
}


@app.get("/api/cameras")
def list_cameras() -> JSONResponse:
    return JSONResponse([s.__dict__ for s in capture.sources()])


@app.post("/api/camera-url")
def set_camera_url(payload: dict) -> JSONResponse:
    url = str(payload.get("url", "")).strip()
    if not url:
        return JSONResponse({"error": "url_required"}, status_code=400)
    source = CameraSource(id="public-url", name="URL pública personalizada", url=url, kind="public", location="Personalizada")
    try:
        capture.set_source(source)
        capture.start()
        frame = capture.read_frame()
        if frame is None:
            return JSONResponse({"error": "no_frame"}, status_code=500)
        return JSONResponse({"ok": True, "url": url})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/detect")
def detect_now(camera_id: str = "london-purley-way-croydon-road") -> JSONResponse:
    source = next((s for s in capture.sources() if s.id == camera_id), None)
    if source is None:
        return JSONResponse({"error": "camera_not_found"}, status_code=404)

    cap = get_capture(camera_id)
    cap.set_source(source)
    try:
        cap.start()
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

    frame = cap.read_frame()
    if frame is None:
        return JSONResponse({"error": "no_frame"}, status_code=500)

    ts = time.time()
    hour = (time.localtime().tm_hour + time.localtime().tm_min / 60) % 24
    detection = detector.detect(frame, ts, hour)
    evidence = detections_to_evidence(detection, current_axis)
    decision = auto_decide(evidence, config)

    annotated = detector.annotate_frame(frame, detection)
    _, buffer = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    jpg = base64.b64encode(buffer).decode("utf-8")

    return JSONResponse(build_frame_payload(detection, decision, jpg))


def _read_source_frame(camera_id: str, source: CameraSource) -> tuple[Optional[np.ndarray], Optional[JSONResponse]]:
    cap = get_capture(camera_id)
    cap.set_source(source)
    try:
        cap.start()
    except Exception as e:
        return None, JSONResponse({"error": str(e)}, status_code=500)
    frame = cap.read_frame()
    if frame is None:
        return None, JSONResponse({"error": "no_frame"}, status_code=500)
    return frame, None


def _fusion(a: DetectionFrame, b: DetectionFrame) -> DetectionFrame:
    """Fusiona las dos cámaras del cruce simulado: cada cámara aporta su eje.

    Cámara A = eje N-S (Av. San Martín / aproximación N-S),
    Cámara B = eje E-O (Av. Urquiza / aproximación E-O).
    """
    return DetectionFrame(
        ts=(a.ts + b.ts) / 2.0,
        hour=a.hour,
        vehicles=a.vehicles + b.vehicles,
        pedestrians=a.pedestrians + b.pedestrians,
        weather=a.weather if a.weather == b.weather else ("clear" if a.weather == "clear" else b.weather),
        is_night=a.is_night or b.is_night,
        lane_density={"NS": float(len(a.vehicles)), "EW": float(len(b.vehicles))},
        emergency_detected=a.emergency_detected or b.emergency_detected,
        raw_image=None,
    )


@app.get("/api/detect_dual")
def detect_dual(
    axis_a_camera_id: str = "london-purley-way-croydon-road",
    axis_b_camera_id: str = "london-lewisham-way-parkfield",
) -> JSONResponse:
    """Ejecuta detección simultánea sobre las dos cámaras del cruce simulado."""
    sources = {s.id: s for s in capture.sources()}
    if axis_a_camera_id not in sources or axis_b_camera_id not in sources:
        return JSONResponse({"error": "camera_not_found"}, status_code=404)

    frame_a, err_a = _read_source_frame(axis_a_camera_id, sources[axis_a_camera_id])
    if err_a is not None:
        return err_a
    frame_b, err_b = _read_source_frame(axis_b_camera_id, sources[axis_b_camera_id])
    if err_b is not None:
        return err_b

    ts = time.time()
    hour = (time.localtime().tm_hour + time.localtime().tm_min / 60) % 24
    det_a = detector.detect(frame_a, ts, hour)
    det_b = detector.detect(frame_b, ts, hour)
    fused = _fusion(det_a, det_b)

    evidence = detections_to_evidence(fused, current_axis)
    decision = auto_decide(evidence, config)

    ann_a = detector.annotate_frame(frame_a, det_a)
    ann_b = detector.annotate_frame(frame_b, det_b)

    _, buf_a = cv2.imencode(".jpg", ann_a, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    _, buf_b = cv2.imencode(".jpg", ann_b, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    jpg_a = base64.b64encode(buf_a).decode("utf-8")
    jpg_b = base64.b64encode(buf_b).decode("utf-8")

    payload = build_frame_payload(fused, decision, jpg_a)
    payload["image_b"] = jpg_b
    payload["camera_ids"] = {"axis_a": axis_a_camera_id, "axis_b": axis_b_camera_id}
    return JSONResponse(payload)


@app.websocket("/ws/camera/{camera_id}")
async def ws_camera(websocket: WebSocket, camera_id: str) -> None:
    await websocket.accept()
    source = next((s for s in capture.sources() if s.id == camera_id), None)
    if source is None:
        await websocket.send_json({"error": "camera_not_found"})
        await websocket.close()
        return

    cap = get_capture(camera_id)
    try:
        cap.set_source(source)
        cap.start()
    except Exception as e:
        await websocket.send_json({"error": str(e)})
        await websocket.close()
        return

    last_decision = None
    last_decision_ts = 0.0
    try:
        while True:
            frame = cap.read_frame()
            if frame is None:
                await websocket.send_json({"error": "no_frame"})
                await asyncio.sleep(0.5)
                continue

            ts = time.time()
            hour = ((time.localtime().tm_hour + time.localtime().tm_min / 60) % 24)
            detection = detector.detect(frame, ts, hour)

            if last_decision is None or ts - last_decision_ts >= 3.0:
                evidence = detections_to_evidence(detection, current_axis)
                last_decision = auto_decide(evidence, config)
                last_decision_ts = ts

            annotated = detector.annotate_frame(frame, detection)
            _, buffer = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
            jpg = base64.b64encode(buffer).decode("utf-8")

            await websocket.send_json(build_frame_payload(detection, last_decision, jpg))
            await asyncio.sleep(0.06)
    except WebSocketDisconnect:
        pass
    finally:
        cap.stop()


@app.websocket("/ws/camera_dual")
async def ws_camera_dual(
    websocket: WebSocket,
    axis_a_camera_id: str = "london-purley-way-croydon-road",
    axis_b_camera_id: str = "london-lewisham-way-parkfield",
) -> None:
    """Stream continuo del cruce simulado: las DOS cámaras en vivo a la vez con IA anotada."""
    await websocket.accept()
    sources = {s.id: s for s in capture.sources()}
    if axis_a_camera_id not in sources or axis_b_camera_id not in sources:
        await websocket.send_json({"error": "camera_not_found"})
        await websocket.close()
        return

    cap_a = get_capture(axis_a_camera_id)
    cap_b = get_capture(axis_b_camera_id)
    try:
        cap_a.set_source(sources[axis_a_camera_id])
        cap_a.start()
        cap_b.set_source(sources[axis_b_camera_id])
        cap_b.start()
    except Exception as e:
        await websocket.send_json({"error": str(e)})
        await websocket.close()
        return

    last_decision = None
    last_decision_ts = 0.0
    try:
        while True:
            frame_a = cap_a.read_frame()
            frame_b = cap_b.read_frame()
            if frame_a is None or frame_b is None:
                await websocket.send_json({"error": "no_frame"})
                await asyncio.sleep(0.5)
                continue

            ts = time.time()
            hour = ((time.localtime().tm_hour + time.localtime().tm_min / 60) % 24)
            det_a = detector.detect(frame_a, ts, hour)
            det_b = detector.detect(frame_b, ts, hour)
            fused = _fusion(det_a, det_b)

            if last_decision is None or ts - last_decision_ts >= 3.0:
                evidence = detections_to_evidence(fused, current_axis)
                last_decision = auto_decide(evidence, config)
                last_decision_ts = ts

            ann_a = detector.annotate_frame(frame_a, det_a)
            ann_b = detector.annotate_frame(frame_b, det_b)

            _, buf_a = cv2.imencode(".jpg", ann_a, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
            _, buf_b = cv2.imencode(".jpg", ann_b, [int(cv2.IMWRITE_JPEG_QUALITY), 75])

            payload = build_frame_payload(fused, last_decision, base64.b64encode(buf_a).decode("utf-8"))
            payload["image_b"] = base64.b64encode(buf_b).decode("utf-8")
            payload["camera_ids"] = {"axis_a": axis_a_camera_id, "axis_b": axis_b_camera_id}
            await websocket.send_json(payload)
            await asyncio.sleep(0.06)
    except WebSocketDisconnect:
        pass
    finally:
        cap_a.stop()
        cap_b.stop()


@app.get("/")
async def index() -> HTMLResponse:
    return HTMLResponse("<h1>Ameghino AI Vision OK</h1>")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8787, reload=True)

