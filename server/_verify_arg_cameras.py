"""Verificación temporal: backend del detector + operatividad de las cámaras argentinas históricas."""
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import cv2
import numpy as np

from detector import YoloDetector

# Pool histórico verificado 2026-08-10 (Windy webcams, imagenes actualizadas ~1 min)
ARGENTINE_CAMERAS = [
    {"id": "cordoba-bv-san-juan-velez-sarsfield", "name": "Cordoba › Bv. San Juan y Av. Velez Sarsfield (Patio Olmos)", "location": "Cordoba, Cordoba", "url": "https://images-webcams.windy.com/88/1664693412/current/original/1664693412.jpg"},
    {"id": "cordoba-27-abril-velez-sarsfield", "name": "Cordoba › 27 de Abril y Av. Velez Sarsfield", "location": "Cordoba, Cordoba", "url": "https://images-webcams.windy.com/88/1664734573/current/original/1664734573.jpg"},
    {"id": "cordoba-av-colon-general-paz", "name": "Cordoba › Av. Colon y Av. General Paz", "location": "Cordoba, Cordoba", "url": "https://images-webcams.windy.com/88/1665026688/current/original/1665026688.jpg"},
    {"id": "cordoba-plaza-espana-yrigoyen", "name": "Cordoba › Plaza Espana y Av. Hipolito Yrigoyen", "location": "Cordoba, Cordoba", "url": "https://images-webcams.windy.com/88/1664930739/current/original/1664930739.jpg"},
    {"id": "cordoba-av-olmos-maipu-norte", "name": "Cordoba › Av. Emilio Olmos y Av. Maipu (N)", "location": "Cordoba, Cordoba", "url": "https://images-webcams.windy.com/88/1664940352/current/original/1664940352.jpg"},
    {"id": "cordoba-av-olmos-maipu-este", "name": "Cordoba › Av. Emilio Olmos y Av. Maipu (E)", "location": "Cordoba, Cordoba", "url": "https://images-webcams.windy.com/88/1664940551/current/original/1664940551.jpg"},
    {"id": "cordoba-humberto-primo-general-paz", "name": "Cordoba › Humberto Primo y Av. General Paz", "location": "Cordoba, Cordoba", "url": "https://images-webcams.windy.com/88/1664929778/current/original/1664929778.jpg"},
    {"id": "caba-9-julio-corrientes", "name": "Buenos Aires › Av. 9 de Julio y Av. Corrientes (Obelisco)", "location": "CABA, Plaza de la Republica", "url": "https://images-webcams.windy.com/88/1691337947/current/original/1691337947.jpg"},
    {"id": "mdp-torreon-del-monje", "name": "Mar del Plata › Torreon del Monje (Av. costanera)", "location": "Mar del Plata, Buenos Aires", "url": "https://images-webcams.windy.com/88/1650988843/current/original/1650988843.jpg"},
    {"id": "mdp-museo-mar", "name": "Mar del Plata › Museo MAR (Av. costanera)", "location": "Mar del Plata, Buenos Aires", "url": "https://images-webcams.windy.com/88/1741309831/current/original/1741309831.jpg"},
    {"id": "mendoza-tribunales", "name": "Mendoza › Tribunales (centro)", "location": "Ciudad de Mendoza", "url": "https://images-webcams.windy.com/88/1793909466/current/original/1793909466.jpg"},
    {"id": "cipolletti-centro", "name": "Cipolletti › Centro", "location": "Cipolletti, Rio Negro", "url": "https://images-webcams.windy.com/88/1793905772/current/original/1793905772.jpg"},
    {"id": "sde-plaza-libertad", "name": "Santiago del Estero › Plaza Libertad (centro)", "location": "Santiago del Estero", "url": "https://images-webcams.windy.com/88/1732394190/current/original/1732394190.jpg"},
]

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
}


def fetch(url: str, timeout: int = 15) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def main() -> None:
    print(f"Python: {sys.version.split()[0]}  |  {datetime.now(timezone.utc).isoformat()}Z")
    det = YoloDetector()
    print(f"Backend detector: {det.backend()}")

    out = Path(__file__).resolve().parent / "viability_output" / "arg_check"
    out.mkdir(parents=True, exist_ok=True)

    rows = []
    for cam in ARGENTINE_CAMERAS:
        try:
            data = fetch(cam["url"])
            arr = np.frombuffer(data, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if frame is None:
                print(f"[FAIL-decode] {cam['id']} {cam['name']}")
                rows.append({"id": cam["id"], "name": cam["name"], "ok": False, "detail": "decode_failed"})
                continue
            h, w = frame.shape[:2]
            detf = det.detect(frame, 0.0, 12.0)
            kinds: dict[str, int] = {}
            for v in detf.vehicles:
                kinds[v.kind] = kinds.get(v.kind, 0) + 1
            ok = len(data) > 3000
            print(f"[{'OK' if ok else 'LOW'}] {cam['id']} | {w}x{h} | {len(data)}B | veh={len(detf.vehicles)} {kinds} | peat={len(detf.pedestrians)} | night={detf.is_night}")
            (out / f"{cam['id']}.jpg").write_bytes(data)
            if ok:
                rows.append({
                    "id": cam["id"], "name": cam["name"], "ok": True,
                    "size": f"{w}x{h}", "bytes": len(data),
                    "vehicles": len(detf.vehicles), "kinds": kinds,
                    "pedestrians": len(detf.pedestrians), "night": detf.is_night,
                })
            else:
                rows.append({"id": cam["id"], "name": cam["name"], "ok": False, "detail": "small_payload"})
        except Exception as exc:
            print(f"[FAIL] {cam['id']} {cam['name']}: {type(exc).__name__}: {exc}")
            rows.append({"id": cam["id"], "name": cam["name"], "ok": False, "detail": f"{type(exc).__name__}: {exc}"})

    ok_n = sum(1 for r in rows if r["ok"])
    print(f"\nRESULTADO: {ok_n}/{len(rows)} operativas")
    (out / "arg_check_report.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    sys.exit(main())
