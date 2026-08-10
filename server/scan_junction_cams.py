"""Escaneo automatizado del pool TfL JamCams buscando ESQUINAS TIPO CRUZ.

Criterio objetivo (el mismo YOLOv8n del sistema): un cruce semaforizado real
tiene SEMÁFOROS visibles (clase COCO "traffic light") y VEHÍCULOS en el mismo
frame. Las cámaras que no muestran un cruce (autopista, muro, casa) no tienen
semáforos en escena.

Ranquea todo el pool, guarda snapshots de las mejores para confirmación visual
del usuario y un reporte JSON con los puntajes de cada cámara.
Uso:  python scan_junction_cams.py
"""

import json
import sys
import threading
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from detector import ONNX_MODEL  # noqa: E402

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AmeghinoAI/0.1"}

TFL_LIST_URL = "https://api.tfl.gov.uk/Place/Type/JamCam"

COCO80 = [
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck",
    "boat", "traffic light", "fire hydrant", "stop sign", "parking meter", "bench",
    "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra",
    "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
    "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove",
    "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup",
    "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
    "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
    "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
    "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
    "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier",
    "toothbrush",
]

VEHICLES = {"car", "bus", "truck", "motorcycle", "bicycle"}
TRAFFIC_LIGHT = "traffic light"


class _Net:
    def __init__(self) -> None:
        self._net = cv2.dnn.readNetFromONNX(str(ONNX_MODEL))
        self._net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
        self._net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
        self._lock = threading.Lock()

    def detect(self, frame: np.ndarray) -> list[tuple[str, float]]:
        h, w = frame.shape[:2]
        blob = cv2.dnn.blobFromImage(
            frame, 1.0 / 255.0, (640, 640), (0, 0, 0), swapRB=True, crop=False
        )
        with self._lock:
            self._net.setInput(blob)
            outputs = self._net.forward()
        preds = outputs[0].transpose((1, 0))
        sx, sy = w / 640.0, h / 640.0
        boxes: list[tuple[float, float, float, float]] = []
        scores: list[float] = []
        cids: list[int] = []
        for pred in preds:
            class_scores = pred[4:]
            cid = int(np.argmax(class_scores))
            conf = float(class_scores[cid])
            if conf < 0.3:
                continue
            cx, cy, bw, bh = map(float, pred[:4])
            boxes.append(((cx - bw / 2) * sx, (cy - bh / 2) * sy, bw * sx, bh * sy))
            scores.append(conf)
            cids.append(cid)
        if not boxes:
            return []
        idx = cv2.dnn.NMSBoxes(boxes, scores, 0.35, 0.45)
        if len(idx) == 0:
            return []
        idx = np.atleast_1d(np.asarray(idx, dtype=int))
        out: list[tuple[str, float]] = []
        for i in idx.flatten():
            out.append((COCO80[cids[i]], scores[i]))
        return out


def fetch_image(url: str) -> tuple[bytes | None, str]:
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read(), "ok"
    except Exception as exc:
        return None, f"{type(exc).__name__}: {exc}"


def main() -> None:
    out_dir = Path(__file__).resolve().parent / "viability_output"
    snap_dir = out_dir / "snapshots" / "pool"
    snap_dir.mkdir(parents=True, exist_ok=True)

    print("Descargando listado TfL JamCams...")
    req = urllib.request.Request(TFL_LIST_URL, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as resp:
        cams = json.loads(resp.read().decode("utf-8"))

    candidates = []
    for c in cams:
        name = c.get("commonName", "")
        if "/" not in name:
            continue
        img = ""
        for p in c.get("additionalProperties", []):
            if p.get("key") == "imageUrl":
                img = p.get("value", "")
        if not img:
            continue
        candidates.append({"id": c["id"].replace("JamCams_", ""), "name": name, "lat": c.get("lat"), "lon": c.get("lon"), "url": img})
    print(f"Candidatas por nombre (calle / calle): {len(candidates)}")

    net = _Net()
    results: list[dict] = []
    errors = 0

    def work(cam: dict) -> dict:
        data, detail = fetch_image(cam["url"])
        if data is None:
            return {**cam, "ok": False, "detail": detail}
        arr = np.frombuffer(data, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None:
            return {**cam, "ok": False, "detail": "decode_failed"}
        dets = net.detect(frame)
        tl = sum(1 for name, _ in dets if name == TRAFFIC_LIGHT)
        veh = sum(1 for name, _ in dets if name in VEHICLES)
        ped = sum(1 for name, _ in dets if name == "person")
        return {**cam, "ok": True, "traffic_lights": tl, "vehicles": veh, "pedestrians": ped, "detections": dets}

    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = [pool.submit(work, cam) for cam in candidates]
        done = 0
        for fut in as_completed(futures):
            done += 1
            try:
                results.append(fut.result())
            except Exception as exc:
                errors += 1
            if done % 50 == 0 or done == len(futures):
                print(f"  procesadas {done}/{len(futures)}")

    scored = [r for r in results if r.get("ok")]
    scored.sort(key=lambda r: (r.get("traffic_lights", 0), r.get("vehicles", 0)), reverse=True)

    print("\n=== TOP 30 (semáforos + vehículos en el mismo frame) ===")
    for i, r in enumerate(scored[:30], 1):
        flag = "SEMA" if r["traffic_lights"] > 0 else "    "
        print(f"{i:>2}. [{flag}] semaforos={r['traffic_lights']} vehiculos={r['vehicles']} peatones={r['pedestrians']}  {r['name']}  {r['id']}")

    for i, r in enumerate(scored[:30], 1):
        data, _ = fetch_image(r["url"])
        if data is not None:
            (snap_dir / f"{i:02d}-{r['id']}.jpg").write_bytes(data)

    report = {
        "scanned_at": datetime.now(timezone.utc).isoformat(),
        "candidates": len(candidates),
        "ok": len(scored),
        "errors": errors + (len(candidates) - len(scored) - errors),
        "results": scored,
    }
    (out_dir / "pool_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSnapshots: {snap_dir}")
    print(f"Reporte: {out_dir / 'pool_report.json'}")


if __name__ == "__main__":
    sys.exit(main())