"""Prueba de viabilidad: cámaras públicas de Buenos Aires (sin dependencias).

Descarga cada URL candidata, valida que sea JPEG y la guarda en disco
para inspección visual. Reporta bytes y firma.
"""

import sys
import urllib.request
from pathlib import Path

CANDIDATAS = [
    {
        "id": "martinez-nw",
        "name": "Martinez › North-west (tráfico, conurbano norte)",
        "url": "https://images-webcams.windy.com/88/1745449788/current/preview/1745449788.jpg",
    },
    {
        "id": "olivos",
        "name": "Olivos / Vicente López (tráfico, conurbano norte)",
        "url": "https://images-webcams.windy.com/88/1577126865/current/preview/1577126865.jpg",
    },
    {
        "id": "rio-martinez",
        "name": "Río de la Plata, Martínez (vialidad)",
        "url": "https://images-webcams.windy.com/88/1601563134/current/preview/1601563134.jpg",
    },
]

OUT_DIR = Path(__file__).resolve().parent / "viability_output"


def fetch_bytes(url: str, timeout: int = 15) -> tuple[bytes | None, str]:
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AmeghinoAI/0.1"
            },
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read(), f"HTTP {resp.status}"
    except Exception as exc:
        return None, f"{type(exc).__name__}: {exc}"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("=== VIABILIDAD: CÁMARAS PÚBLICAS BUENOS AIRES ===\n")
    ok = 0
    for cam in CANDIDATAS:
        print(f"  {cam['name']}")
        print(f"    URL: {cam['url']}")
        data, detail = fetch_bytes(cam["url"])
        if data is None:
            print(f"    [FAIL] Sin respuesta: {detail}")
            print()
            continue
        print(f"    [OK] {detail} - {len(data)} bytes")
        if not data.startswith(b"\xff\xd8\xff"):
            print("    [FAIL] No es JPEG")
            print()
            continue
        out_path = OUT_DIR / f"{cam['id']}.jpg"
        out_path.write_bytes(data)
        print(f"    [OK] Guardada en {out_path.relative_to(Path.cwd())}")
        ok += 1
        print()
    print(f"RESULTADO: {ok}/{len(CANDIDATAS)} archivos guardados")


if __name__ == "__main__":
    main()
