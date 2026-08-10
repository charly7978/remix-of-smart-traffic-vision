import asyncio
import base64
import json
import time
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse

from camera_capture import CameraCapture, CameraSource
from detector import YoloDetector, DetectionFrame
from decision import detections_to_evidence, auto_decide

app = FastAPI(title="Ameghino AI Vision")

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
    source = CameraSource(id="public-url", name="URL pública personalizada", url=url, kind="public", location="Custom")
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
def detect_now(camera_id: str = "local-webcam") -> JSONResponse:
    source = next((s for s in capture.sources() if s.id == camera_id), None)
    if source is None:
        return JSONResponse({"error": "camera_not_found"}, status_code=404)

    capture.set_source(source)
    try:
        capture.start()
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

    frame = capture.read_frame()
    if frame is None:
        return JSONResponse({"error": "no_frame"}, status_code=500)

    ts = time.time()
    hour = (time.localtime().tm_hour + time.localtime().tm_min / 60) % 24
    detection = detector.detect(frame, ts, hour)
    evidence = detections_to_evidence(detection, current_axis)
    decision = auto_decide(evidence, config)

    _, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    jpg = base64.b64encode(buffer).decode("utf-8")

    return JSONResponse(
        {
            "ts": detection.ts,
            "hour": detection.hour,
            "vehicles": [v.__dict__ for v in detection.vehicles],
            "pedestrians": [p.__dict__ for p in detection.pedestrians],
            "weather": detection.weather,
            "is_night": detection.is_night,
            "lane_density": detection.lane_density,
            "emergency_detected": detection.emergency_detected,
            "image": jpg,
            "decision": {
                "action": decision.action,
                "seconds": round(decision.seconds, 1),
                "axis": decision.axis,
                "confidence": round(decision.confidence, 2),
                "rationale": decision.rationale,
                "contract": decision.contract,
            },
        }
    )


@app.websocket("/ws/camera/{camera_id}")
async def ws_camera(websocket: WebSocket, camera_id: str) -> None:
    await websocket.accept()
    source = next((s for s in capture.sources() if s.id == camera_id), None)
    if source is None:
        await websocket.send_json({"error": "camera_not_found"})
        await websocket.close()
        return

    try:
        capture.set_source(source)
        capture.start()
    except Exception as e:
        await websocket.send_json({"error": str(e)})
        await websocket.close()
        return

    try:
        while True:
            frame = capture.read_frame()
            if frame is None:
                await websocket.send_json({"error": "no_frame"})
                await asyncio.sleep(0.5)
                continue

            ts = time.time()
            hour = ((time.localtime().tm_hour + time.localtime().tm_min / 60) % 24)
            detection = detector.detect(frame, ts, hour)
            evidence = detections_to_evidence(detection, current_axis)
            decision = auto_decide(evidence, config)

            _, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
            jpg = base64.b64encode(buffer).decode("utf-8")

            await websocket.send_json(
                {
                    "ts": detection.ts,
                    "hour": detection.hour,
                    "vehicles": [v.__dict__ for v in detection.vehicles],
                    "pedestrians": [p.__dict__ for p in detection.pedestrians],
                    "weather": detection.weather,
                    "is_night": detection.is_night,
                    "lane_density": detection.lane_density,
                    "emergency_detected": detection.emergency_detected,
                    "image": jpg,
                    "decision": {
                        "action": decision.action,
                        "seconds": round(decision.seconds, 1),
                        "axis": decision.axis,
                        "confidence": round(decision.confidence, 2),
                        "rationale": decision.rationale,
                        "contract": decision.contract,
                    },
                }
            )
            await asyncio.sleep(0.05)
    except WebSocketDisconnect:
        pass
    finally:
        capture.stop()


@app.get("/")
async def index() -> HTMLResponse:
    return HTMLResponse("<h1>Ameghino AI Vision OK</h1>")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8787, reload=True)
