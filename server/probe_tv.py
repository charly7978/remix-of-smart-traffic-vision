import json
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}

urls = [
    "https://trafficvision.live/argentina",
    "https://trafficvision.live/",
    "https://trafficvision.live/cameras",
    "https://trafficvision.live/api/cams",
    "https://trafficvision.live/api/data.json",
]


def get(url, timeout=30):
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.geturl(), r.read().decode("utf-8", "replace")
    except Exception as e:
        return None, f"ERR {type(e).__name__}: {e}"


for u in urls:
    final, body = get(u)
    print("=" * 70)
    print("URL", u, "->", (final or "")[:90], "len", len(body))
    if body.startswith("ERR"):
        print(body[:200])
        continue
    if "<html" in body[:2000].lower():
        hrefs = sorted(set(re.findall(r'href="(/[^"]+)"', body)))
        print("HREFS (sample):")
        for h in hrefs[:40]:
            print("  ", h)
        # find embedded JSON-ish url patterns
        cams = re.findall(r'https?://[^"\s]+\.(?:jpg|png|m3u8|mp4)[^"\s]*', body)
        print("MEDIA URLS (sample):")
        for c in cams[:40]:
            print("  ", c)
    else:
        print(body[:1500])