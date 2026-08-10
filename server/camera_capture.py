import io
import time
import threading
from dataclasses import dataclass
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


class CameraCapture:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._cap = None
        self._source: Optional[CameraSource] = None
        self._last_frame = None
        self._last_error: Optional[str] = None
        self._snapshot_session = requests.Session()

    def sources(self) -> list[CameraSource]:
        return [
            CameraSource(
                id="public-url",
                name="URL pública personalizada",
                url="",
                kind="public",
                location="Pegar URL abajo",
            ),
            CameraSource(
                id="ba-camara-1",
                name="Buenos Aires - Corrientes y Florida (CABA)",
                url="http://www.buenosaires.gob.ar/static/camaras/camara1.jpg",
                kind="public",
                location="Buenos Aires, Argentina",
            ),
            CameraSource(
                id="ba-camara-2",
                name="Buenos Aires - Av. 9 de Julio",
                url="http://www.buenosaires.gob.ar/static/camaras/camara2.jpg",
                kind="public",
                location="Buenos Aires, Argentina",
            ),
            CameraSource(
                id="bsas-mjpeg-1",
                name="Buenos Aires - MJPEG stream",
                url="http://www.buenosaires.gob.ar/static/camaras/camara1.mjpg",
                kind="public",
                location="Buenos Aires, Argentina",
            ),
            CameraSource(
                id="world-tokyo",
                name="Tokio - Shibuya Crossing (world cam)",
                url="http://www.shibuya-camera.jp/live.mjpg",
                kind="public",
                location="Tokio, Japón",
            ),
            CameraSource(
                id="world-nyc-times",
                name="Nueva York - Times Square (earthcam)",
                url="https://videos-earthcam.akamaized.net/...",
                kind="public",
                location="Nueva York, EE.UU.",
            ),
            CameraSource(
                id="world-london",
                name="Londres - Trafalgar Square (traffic cam)",
                url="http://www.tflcameras.com/camera001.mjpg",
                kind="public",
                location="Londres, Reino Unido",
            ),
        ]

    def set_source(self, source: CameraSource) -> None:
        self.stop()
        self._source = source
        self._last_error = None

    def start(self) -> None:
        with self._lock:
            if self._cap is not None:
                return
            url = self._source.url if self._source else ""
            if not url:
                raise RuntimeError("La URL de la cámara está vacía")

            try:
                if url.startswith("rtsp://") or url.startswith("http://") or url.startswith("https://"):
                    self._cap = cv2.VideoCapture(url)
                else:
                    self._cap = cv2.VideoCapture(int(url) if url.isdigit() else url)

                if not self._cap.isOpened():
                    raise RuntimeError(f"No se pudo abrir la cámara: {url}")
            except Exception as e:
                self._cap = None
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

    def read_frame(self):
        with self._lock:
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
