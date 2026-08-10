"""Verificación de viabilidad de cámaras públicas de cruces urbanos con semáforos.

Fase 1 (investigación): para cada cámara de INTERSECTION_CAMERAS (fuente única de
verdad en camera_capture.py) descarga su imagen actual, valida el formato
(JPEG/PNG), reporta tamaño, firma y frescura (Last-Modified).
Uso:  python verify_cameras.py
"""

import base64
import io
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    from PIL import Image
    HAS_PIL = True
except Exception:
    HAS_PIL = False

from camera_capture import INTERSECTION_CAMERAS


def fetch(url: str, timeout: int = 20) -> tuple[bytes | None, str, str]:
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AmeghinoAI/0.1",
                "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            last_modified = resp.headers.get("Last-Modified", "")
            return resp.read(), f"HTTP {resp.status}", last_modified
    except Exception as exc:
        return None, f"{type(exc).__name__}: {exc}", ""


def sniff(data: bytes) -> str:
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"GIF8":
        return "gif"
    return "unknown"


_DETECTOR = None


def detect_time(img: bytes) -> str:
    """Usa el detector real del sistema (YoloDetector) si está disponible."""
    global _DETECTOR
    try:
        import cv2
        import numpy as np

        from detector import YoloDetector

        if _DETECTOR is None:
            _DETECTOR = YoloDetector()
        arr = np.frombuffer(img, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None:
            return "no_decode"
        det = _DETECTOR.detect(frame, 0.0, 12.0)
        return f"{len(det.vehicles)} vehic / {len(det.pedestrians)} peat / conf {', '.join(f'{v.kind}:{v.confidence:.2f}' for v in det.vehicles[:3])}"
    except Exception as exc:
        return f"detector_error:{type(exc).__name__}"


def freshness(last_modified: str, now: datetime) -> str:
    """Interpreta el header Last-Modified de la imagen como indicador de viveza."""
    if not last_modified:
        return "unknown"
    try:
        lm = datetime.strptime(last_modified, "%a, %d %b %Y %H:%M:%S GMT")
        lm = lm.replace(tzinfo=timezone.utc)
        age_h = (now - lm).total_seconds() / 3600.0
        if age_h < 1.5:
            return f"viva (última actualización hace {age_h:.2f} h)"
        return f"antigua (hace {age_h:.1f} h)"
    except Exception:
        return "no_parseable"


def main() -> None:
    out_dir = Path(__file__).resolve().parent / "viability_output"
    out_dir.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    report: list[dict] = []
    print("=== VERIFICACIÓN DE CÁMARAS PÚBLICAS (CRUCES CON SEMÁFOROS EN VIVO) ===")
    print(f"Fecha: {now.isoformat()}\n")

    for cam in INTERSECTION_CAMERAS:
        data, detail, last_modified = fetch(cam.url)
        if data is None:
            print(f"  [{cam.id}] {cam.name}\n    [FAIL] {detail}")
            report.append({"id": cam.id, "name": cam.name, "ok": False, "detail": detail})
            print()
            continue

        fmt = sniff(data)
        ok = fmt in ("jpeg", "png") and len(data) > 4000
        dims = ""
        if ok and HAS_PIL:
            try:
                img = Image.open(io.BytesIO(data))
                dims = f"{img.width}x{img.height}"
            except Exception:
                pass
        yolo = detect_time(data) if ok else "-"
        fres = freshness(last_modified, now) if ok else "-"
        print(f"  [{cam.id}] {cam.name}")
        print(f"    [{'OK' if ok else 'FAIL'}] {detail} · {len(data)} bytes · {fmt} {dims} · {fres}")
        print(f"    YOLO -> {yolo}")

        if ok:
            name = f"{cam.id}.{fmt}"
            (out_dir / "snapshots" / name).parent.mkdir(parents=True, exist_ok=True)
            (out_dir / "snapshots" / name).write_bytes(data)
            report.append(
                {
                    "id": cam.id,
                    "name": cam.name,
                    "location": cam.location,
                    "ok": True,
                    "detail": detail,
                    "bytes": len(data),
                    "format": fmt,
                    "dimensions": dims,
                    "freshness": fres,
                    "last_modified": last_modified,
                    "yolo": yolo,
                    "image_b64": base64.b64encode(data).decode("ascii")[:200],
                }
            )
        else:
            report.append({"id": cam.id, "name": cam.name, "ok": False, "detail": detail})
        print()

    ok_count = sum(1 for r in report if r["ok"])
    print(f"RESULTADO: {ok_count}/{len(report)} cámaras operativas")
    (out_dir / "camera_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Reporte guardado en {out_dir / 'camera_report.json'}")
    print(f"Snapshots visibles en {out_dir / 'snapshots'}")


if __name__ == "__main__":
    sys.exit(main())