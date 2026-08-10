"""Verificación del backend con el venv instalado."""
import sys

import cv2
import numpy as np

print(f"Python: {sys.version.split()[0]}")
print(f"OpenCV: {cv2.__version__}")
print(f"NumPy: {np.__version__}")
print()

# Import sin ultralytics: el detector debe degradar a OpenCV DNN o "none".
from detector import ONNX_MODEL, YoloDetector  # noqa: E402

detector = YoloDetector()
print(f"Backend activo: {detector.backend()}")
print(f"Modelo ONNX presente: {ONNX_MODEL.exists()}")
print()

# Test del pipeline con un frame sintético
frame = np.full((640, 640, 3), 128, dtype=np.uint8)
print("Test detect() con frame sintético...")
result = detector.detect(frame, ts=1.0, hour=12.0)
print(f"  backend={detector.backend()}")
print(f"  vehiculos={len(result.vehicles)} peatones={len(result.pedestrians)}")
print(f"  weather={result.weather} is_night={result.is_night}")
print(f"  lane_density={result.lane_density}")
print("OK")
