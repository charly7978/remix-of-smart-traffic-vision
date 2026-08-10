"""Consulta metadatos de frescura de las webcams candidatas (API pública de Windy)."""

import json
import sys
import urllib.request
from datetime import datetime, timezone

API = "https://node.windy.com/webcams/v1.0/list?nearby={lat},{lon}"

IDS = [
    1664693412, 1664734573, 1671043464, 1664650790, 1665026688, 1664930739,
    1664940352, 1664940551, 1664929778, 1664650968, 1691337947, 1745449788,
    1577126865, 1751040831, 1650988843, 1741309831, 1793909466, 1793905772,
    1732394190,
]

SEARCH = [
    ("Córdoba", "-31.4201,-64.1888"),
    ("Buenos Aires", "-34.6037,-58.3816"),
    ("Vicente López", "-34.5304,-58.4870"),
    ("Avellaneda", "-34.6550,-58.3521"),
    ("Mar del Plata", "-38.0055,-57.5426"),
    ("Mendoza", "-32.8895,-68.8458"),
    ("Cipolletti", "-38.9355,-68.0207"),
    ("Santiago del Estero", "-27.7834,-64.2641"),
]


def fetch(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 AmeghinoAI/0.1"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> None:
    by_id: dict[int, dict] = {}
    for city, coords in SEARCH:
        data = fetch(API.format(lat=coords.split(",")[0], lon=coords.split(",")[1]))
        for cam in data.get("cams", []):
            by_id[cam["id"]] = cam

    now = datetime.now(timezone.utc)
    print("id          lastUpdate         hace   título")
    print("-" * 100)
    for cam_id in IDS:
        cam = by_id.get(cam_id)
        if not cam:
            print(f"{cam_id}  SIN METADATOS")
            continue
        lu = cam.get("lastUpdate") or 0
        ld = cam.get("lastDaylight") or 0
        dt = datetime.fromtimestamp(lu / 1000, tz=timezone.utc)
        age = (now - dt).total_seconds() / 3600
        daylight_age = (now - datetime.fromtimestamp(ld / 1000, tz=timezone.utc)).total_seconds() / 3600 if ld else None
        extra = f" | luz: hace {daylight_age:.1f}h" if daylight_age is not None else ""
        print(f"{cam_id}  {dt.strftime('%Y-%m-%d %H:%M UTC')}  {age:6.1f}h{extra}  {cam['title']}")


if __name__ == "__main__":
    sys.exit(main())