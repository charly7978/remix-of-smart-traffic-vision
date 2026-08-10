"""Prueba de viabilidad de las cámaras públicas argentinas configuradas.

Fuente única de verdad: ARGENTINE_CAMERAS (server/camera_capture.py).
Descarga cada imagen candidata, valida que sea JPEG/PNG y la guarda en
viability_output/snapshots/ para inspección visual, con reporte JSON.

Uso:  python viability_test.py
"""

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

from camera_capture import ARGENTINE_CAMERAS

OUT_DIR = Path(__file__).resolve().parent / "viability_output"


def fetch_bytes(url: str, timeout: int = 20) -> tuple[bytes | None, str]:
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AmeghinoAI/0.1",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read(), f"HTTP {resp.status}"
    except Exception as exc:
        return None, f"{type(exc).__name__}: {exc}"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    snap_dir = OUT_DIR / "snapshots"
    snap_dir.mkdir(exist_ok=True)
    print("=== VIABILIDAD: CÁMARAS PÚBLICAS ARGENTINAS (CRUCES CON SEMÁFOROS) ===")
    print(f"Fecha: {datetime.now(timezone.utc).isoformat()}\n")
    report: list[dict] = []
    ok = 0
    for cam in ARGENTINE_CAMERAS:
        print(f"  {cam.name}")
        print(f"    URL: {cam.url}")
        data, detail = fetch_bytes(cam.url)
        if data is None:
            print(f"    [FAIL] Sin respuesta: {detail}")
            report.append({"id": cam.id, "ok": False, "detail": detail})
            print()
            continue
        print(f"    [OK] {detail} - {len(data)} bytes")
        magic = data[:2]
        fmt = "jpg" if magic == b"\xff\xd8" else "png" if data[:4] == b"\x89PNG" else "?"
        if fmt == "?":
            print("    [FAIL] No es JPEG ni PNG")
            report.append({"id": cam.id, "ok": False, "detail": "formato desconocido"})
            print()
            continue
        dims = ""
        if HAS_PIL:
            try:
                img = Image.open(io.BytesIO(data))
                dims = f" {img.width}x{img.height}"
            except Exception:
                pass
        out_path = snap_dir / f"{cam.id}.{fmt}"
        out_path.write_bytes(data)
        print(f"    [OK] Guardada en {out_path.relative_to(Path.cwd())}{dims}")
        report.append(
            {
                "id": cam.id,
                "name": cam.name,
                "location": cam.location,
                "url": cam.url,
                "ok": True,
                "detail": detail,
                "bytes": len(data),
                "format": fmt,
                "dimensions": dims.strip(),
                "checked_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        ok += 1
        print()
    (OUT_DIR / "camera_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"RESULTADO: {ok}/{len(ARGENTINE_CAMERAS)} archivos guardados")
    print(f"Reporte: {OUT_DIR / 'camera_report.json'}")


if __name__ == "__main__":
    sys.exit(main())