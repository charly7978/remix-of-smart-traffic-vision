import json
import sys
import urllib.request


def get(u):
    with urllib.request.urlopen(u, timeout=90) as r:
        return json.loads(r.read().decode("utf-8"))


def main():
    cams = get("http://127.0.0.1:8787/api/cameras")
    print("UTF-8 title:", cams[0]["name"])
    print("count:", len(cams))
    for cid in ["london-a10-carterhatch-lane", "caba-9-julio-corrientes"]:
        d = get(f"http://127.0.0.1:8787/api/detect?camera_id={cid}")
        print(f"--- {cid} ---")
        print("  vehicles:", len(d["vehicles"]), "pedestrians:", len(d["pedestrians"]))
        print("  laneDensity:", d["laneDensity"], "| weather:", d["weather"], "| isNight:", d["isNight"])
        print("  decision:", d["decision"]["action"], "|", d["decision"]["seconds"], "s")
        print("  rationale:", d["decision"]["rationale"][:90])
        print("  image_b64_len:", len(d["image"]))

    import urllib.error

    try:
        get("http://127.0.0.1:8787/api/detect?camera_id=camara-inexistente")
        print("FAIL: camera 404 not raised")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print("404 error path OK:", e.code, body)

    try:
        get("http://127.0.0.1:8787/api/detect?camera_id=local-webcam")
        print("local-webcam OK (frame obtenido)")
    except Exception as e:
        print("local-webcam:", type(e).__name__, e)


if __name__ == "__main__":
    sys.exit(main())