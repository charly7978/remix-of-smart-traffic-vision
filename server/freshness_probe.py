"""Consulta la frescura de las cámaras de cruces semaforizados (TfL JamCams).

Estrategia sin API key: cada imagen vive en S3 (s3-eu-west-1.amazonaws.com) y
TfL la reemplaza cada pocos segundos; el header Last-Modified del objeto refleja
la última actualización. Además, para las primeras cámaras se descarga dos veces
con intervalo y se compara el contenido: si cambió, la cámara está realmente viva.
Uso:  python freshness_probe.py
"""

import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from camera_capture import INTERSECTION_CAMERAS  # noqa: E402

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AmeghinoAI/0.1"}


def fetch(url: str, timeout: int = 20) -> tuple[bytes, str] | tuple[None, str]:
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read(), resp.headers.get("Last-Modified", "")
    except Exception as exc:
        return None, f"{type(exc).__name__}: {exc}"


def main() -> None:
    now = datetime.now(timezone.utc)
    print("cámara                           Last-Modified (UTC)      viveza")
    print("-" * 90)
    live = 0
    for idx, cam in enumerate(INTERSECTION_CAMERAS):
        data1, lm = fetch(cam.url)
        if data1 is None:
            print(f"  ERROR {cam.id}: {lm}")
            continue
        changed = "?"
        if idx < 4:  # chequeo de viveza por diferencia de contenido en un subconjunto
            import time

            time.sleep(6)
            data2, _ = fetch(cam.url)
            changed = "SI" if (data2 is not None and data2 != data1) else "NO"
        fresh = "SIN CABECERA"
        if lm and not lm.startswith(("HTTP", "Timeout", "URLError")):
            try:
                lm_dt = datetime.strptime(lm, "%a, %d %b %Y %H:%M:%S GMT").replace(tzinfo=timezone.utc)
                age_h = (now - lm_dt).total_seconds() / 3600.0
                fresh = f"hace {age_h:.2f} h"
            except Exception:
                pass
        if fresh in ("SIN CABECERA",) or (isinstance(fresh, str) and fresh.startswith("hace") and float(fresh.split()[1]) < 1.5):
            live += 1 if fresh != "SIN CABECERA" else 0
        print(f"  {cam.id:<34} {lm or '-':<24} {fresh} | contenido cambió: {changed}")
    print(f"\nRESULTADO: {live}/{len(INTERSECTION_CAMERAS)} con Last-Modified fresco (<1.5 h)")


if __name__ == "__main__":
    sys.exit(main())