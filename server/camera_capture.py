import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
import requests


@dataclass
class CameraSource:
    id: str
    name: str
    url: str
    kind: str
    location: Optional[str] = None


LOCAL_VIDEO_PATH = Path(__file__).resolve().parent / "assets" / "demo-interseccion.mp4"

# Intervalo mínimo entre descargas de fotogramas para cámaras de tipo imagen (JPG).
SNAPSHOT_RATE_SECONDS = 3.0

_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")


class CameraCapture:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._cap = None
        self._source: Optional[CameraSource] = None
        self._last_frame = None
        self._last_error: Optional[str] = None
        self._snapshot_session = requests.Session()
        self._last_snapshot_ts = 0.0
        self._image_mode = False

    def sources(self) -> list[CameraSource]:
        return [
            CameraSource(
                id="local-webcam",
                name="Cámara local (webcam)",
                url="0",
                kind="local",
                location="Dispositivo del equipo",
            ),
            CameraSource(
                id="public-url",
                name="URL pública personalizada",
                url="",
                kind="public",
                location="Pegar URL debajo",
            ),
            CameraSource(
                id="video-local",
                name="Video local: esquina con semáforos (fallback demo)",
                url=str(LOCAL_VIDEO_PATH),
                kind="upload",
                location="server/assets/demo-interseccion.mp4",
            ),
            CameraSource(
                id="martinez-nw",
                name="Martinez › North-west (tráfico, conurbano norte)",
                url="https://images-webcams.windy.com/88/1745449788/current/preview/1745449788.jpg",
                kind="public",
                location="Martinez, Buenos Aires",
            ),
            CameraSource(
                id="olivos",
                name="Olivos / Vicente López (tráfico, conurbano norte)",
                url="https://images-webcams.windy.com/88/1577126865/current/preview/1577126865.jpg",
                kind="public",
                location="Vicente López, Buenos Aires",
            ),
            CameraSource(
                id="rio-martinez",
                name="Río de la Plata, Martínez (vialidad)",
                url="https://images-webcams.windy.com/88/1601563134/current/preview/1601563134.jpg",
                kind="public",
                location="Martinez, Buenos Aires",
            ),
        ]

    def set_source(self, source: CameraSource) -> None:
        self.stop()
        self._source = source
        self._last_error = None

    def start(self) -> None:
        with self._lock:
            if self._cap is not None or self._image_mode:
                return
            url = self._source.url if self._source else ""
            if not url:
                raise RuntimeError("La URL de la cámara está vacía")

            self._image_mode = self._is_image_url(url)

            try:
                if self._image_mode:
                    # Cámara de fotogramas (JPG/PNG/WebP): se valida descargando el primer snapshot.
                    if self.read_snapshot(url) is None:
                        raise RuntimeError(f"No se pudo leer la imagen: {url}")
                    return

                if url.startswith("rtsp://") or url.startswith("http://") or url.startswith("https://"):
                    self._cap = cv2.VideoCapture(url)
                else:
                    self._cap = cv2.VideoCapture(int(url) if url.isdigit() else url)

                if not self._cap.isOpened():
                    raise RuntimeError(f"No se pudo abrir la cámara: {url}")
            except Exception as e:
                self._cap = None
                self._image_mode = False
                self._last_error = str(e)
                raise

    def stop(self) -> None:
        with self._lock:
            if self._cap is not None:
                try:
                    self._cap.release()
                except Exception:
                    pass
                self._cap = None
            self._image_mode = False
            self._last_snapshot_ts = 0.0

    def read_frame(self):
        """Devuelve el siguiente fotograma.

        En modo imagen (JPG) refresca la captura como máximo cada
        SNAPSHOT_RATE_SECONDS, reutilizando el último fotograma en el medio.
        En modo stream (RTSP/MJPEG/mp4) lee del VideoCapture.
        """
        with self._lock:
            if self._image_mode:
                now = time.time()
                if now - self._last_snapshot_ts < SNAPSHOT_RATE_SECONDS:
                    return self._last_frame
                self._last_snapshot_ts = now
                if self._source is None:
                    return None
                return self.read_snapshot(self._source.url)

            if self._cap is None or not self._cap.isOpened():
                return None
            ret, frame = self._cap.read()
            if not ret:
                self._last_error = "read_failed"
                return None
            self._last_frame = frame
            return frame

    def read_snapshot(self, url: str):
        try:
            resp = self._snapshot_session.get(url, timeout=6)
            resp.raise_for_status()
            img_array = np.frombuffer(resp.content, dtype=np.uint8)
            frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            if frame is None:
                self._last_error = "decode_failed"
                return None
            self._last_frame = frame
            return frame
        except Exception as e:
            self._last_error = str(e)
            return None

    def last_error(self) -> Optional[str]:
        return self._last_error

    @staticmethod
    def _is_image_url(url: str) -> bool:
        path = url.split("?")[0].lower()
        return path.endswith(_IMAGE_EXTENSIONS)
