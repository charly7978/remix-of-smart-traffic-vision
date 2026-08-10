"""Genera un video sintético de una intersección con semáforos y autos.

Sirve como fuente de fallback para la demo cuando no hay cámaras públicas
disponibles. Produce server/assets/demo-interseccion.mp4 (640x640, ~20s).
"""

from pathlib import Path

import cv2
import numpy as np

OUT = Path(__file__).resolve().parent / "assets" / "demo-interseccion.mp4"
OUT.parent.mkdir(parents=True, exist_ok=True)

W, H = 640, 640
FPS = 20
SECONDS = 20
FRAMES = FPS * SECONDS
FOURCC = cv2.VideoWriter_fourcc(*"mp4v")
writer = cv2.VideoWriter(str(OUT), FOURCC, FPS, (W, H))


def draw_scene(t: float) -> np.ndarray:
    """Pinta la intersección con autos circulando en ambos ejes."""
    frame = np.full((H, W, 3), 40, dtype=np.uint8)  # asfalto oscuro

    # Calzada
    cv2.rectangle(frame, (0, H // 2 - 40), (W, H // 2 + 40), (70, 70, 70), -1)  # horizontal
    cv2.rectangle(frame, (W // 2 - 40, 0), (W // 2 + 40, H), (70, 70, 70), -1)   # vertical
    # Líneas de borde
    cv2.line(frame, (0, 200), (W, 200), (120, 120, 120), 2)
    cv2.line(frame, (0, 440), (W, 440), (120, 120, 120), 2)
    cv2.line(frame, (200, 0), (200, H), (120, 120, 120), 2)
    cv2.line(frame, (440, 0), (440, H), (120, 120, 120), 2)

    # Semáforo NS (verde) y EW (rojo), con ciclo simple
    phase = (t // 5) % 2  # alterna cada 5 s
    ns_green = phase == 0
    _draw_traffic_light(frame, (W // 2 - 90, H // 2 + 70), green=ns_green)
    _draw_traffic_light(frame, (W // 2 + 30, H // 2 - 130), green=not ns_green)

    # Autos en NS (vertical) cuando tienen verde
    if ns_green:
        for i, y in enumerate(np.arange(0, 220, 80)):
            _car(frame, int(300 + (t * 120) % 140), int(y + ((t * 40) % 220)), (220, 60, 60))
        for i, y in enumerate(np.arange(420, 640, 80)):
            _car(frame, int(260 + (t * 120) % 140), int(y - ((t * 40) % 220)), (220, 60, 60))
    else:
        for i, x in enumerate(np.arange(0, 220, 80)):
            _car(frame, int(x + ((t * 40) % 220)), int(240 + (t * 120) % 140), (60, 120, 220))
        for i, x in enumerate(np.arange(420, 640, 80)):
            _car(frame, int(x - ((t * 40) % 220)), int(300 + (t * 120) % 140), (60, 120, 220))

    return frame


def _draw_traffic_light(frame: np.ndarray, origin: tuple[int, int], green: bool) -> None:
    x, y = origin
    cv2.rectangle(frame, (x, y), (x + 26, y + 70), (20, 20, 20), -1)
    cv2.circle(frame, (x + 13, y + 12), 8, (0, 0, 200) if not green else (60, 60, 60), -1)
    cv2.circle(frame, (x + 13, y + 35), 8, (0, 0, 0), -1)
    cv2.circle(frame, (x + 13, y + 58), 8, (0, 200, 0) if green else (60, 60, 60), -1)


def _car(frame: np.ndarray, x: int, y: int, color: tuple[int, int, int]) -> None:
    cv2.rectangle(frame, (x, y), (x + 26, y + 48), color, -1)
    cv2.rectangle(frame, (x + 4, y + 10), (x + 22, y + 24), (160, 200, 220), -1)


for n in range(FRAMES):
    t = n / FPS
    writer.write(draw_scene(t))

writer.release()
print(f"Video generado: {OUT} ({OUT.stat().st_size} bytes)")
