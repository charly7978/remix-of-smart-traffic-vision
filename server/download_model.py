"""Descarga yolov8n.onnx (detección de objetos por OpenCV DNN, sin torch)."""
from pathlib import Path

import requests

MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
DEST = MODEL_DIR / "yolov8n.onnx"
URL = "https://github.com/ultralytics/assets/releases/download/v8.4.0/yolov8n.onnx"

if DEST.exists() and DEST.stat().st_size > 1_000_000:
    print(f"Modelo ya existe: {DEST} ({DEST.stat().st_size} bytes)")
    raise SystemExit(0)

print(f"Descargando {URL} ...")
resp = requests.get(URL, timeout=180)
resp.raise_for_status()
DEST.write_bytes(resp.content)
print(f"Modelo guardado: {DEST} ({len(resp.content)} bytes)")
