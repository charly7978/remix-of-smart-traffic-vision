import io
import time
import threading
import logging
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np
import requests

logger = logging.getLogger("camera_capture")

@dataclass
class CameraSource:
    id: str
    name: str
    url: str
    kind: str
    location: Optional[str] = None
    intersection_type: str = "Cruce de Avenidas"


def resolve_stream_url(raw_url: str) -> str:
    """
    Resuelve una URL de video o directo a su stream m3u8 / rtsp / mjpeg utilizable por OpenCV.
    Soporta YouTube Live, HLS, RTSP y HTTP MJPEG/Direct streams.
    """
    if not raw_url:
        return ""
    
    # Tratar YouTube Live links
    if "youtube.com" in raw_url or "youtu.be" in raw_url:
        try:
            import streamlink
            session = streamlink.Streamlink()
            session.set_option("http-headers", {"User-Agent": "Mozilla/5.0"})
            streams = session.streams(raw_url)
            if "best" in streams:
                return streams["best"].to_url()
            if "720p" in streams:
                return streams["720p"].to_url()
            if "worst" in streams:
                return streams["worst"].to_url()
        except Exception as e:
            logger.warning(f"Streamlink fail for {raw_url}: {e}")
        
        try:
            import yt_dlp
            ydl_opts = {"format": "best[ext=mp4]/best", "quiet": True}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(raw_url, download=False)
                if info and "url" in info:
                    return info["url"]
        except Exception as e:
            logger.warning(f"yt-dlp fail for {raw_url}: {e}")

    return raw_url


class CameraCapture:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._cap = None
        self._source: Optional[CameraSource] = None
        self._last_frame = None
        self._last_error: Optional[str] = None
        self._snapshot_session = requests.Session()
        self._is_snapshot_mode = False
        self._resolved_url = ""

    def sources(self) -> list[CameraSource]:
        return [
            CameraSource(
                id="caba-9-de-julio",
                name="Buenos Aires - Av. 9 de Julio y Corrientes (Obelisco)",
                url="https://www.youtube.com/watch?v=1-iS7LArMPA",
                kind="public",
                location="CABA, Argentina",
                intersection_type="Cruce Semaforizado de Alto Tránsito",
            ),
            CameraSource(
                id="caba-corrientes-florida",
                name="Buenos Aires - Av. Corrientes y Florida",
                url="http://www.buenosaires.gob.ar/static/camaras/camara1.jpg",
                kind="public",
                location="CABA, Argentina",
                intersection_type="Cruce de Avenida Peatonal / Vehicular",
            ),
            CameraSource(
                id="caba-santa-fe-callao",
                name="Buenos Aires - Av. Santa Fe y Av. Callao",
                url="https://images.buenosaires.gob.ar/camaras/callao_santafe.jpg",
                kind="public",
                location="CABA, Argentina",
                intersection_type="Intersección Arterial N-S / E-O",
            ),
            CameraSource(
                id="caba-cabildo-juramento",
                name="Buenos Aires - Av. Cabildo y Juramento (Belgrano)",
                url="https://images.buenosaires.gob.ar/camaras/cabildo_juramento.jpg",
                kind="public",
                location="CABA, Argentina",
                intersection_type="Corredor Metrobús / Cruce Vehicular",
            ),
            CameraSource(
                id="rosario-pellegrini-orono",
                name="Rosario - Av. Pellegrini y Bv. Oroño",
                url="https://www.rosario.gob.ar/camaras/orono_pellegrini.jpg",
                kind="public",
                location="Rosario, Santa Fe, Argentina",
                intersection_type="Cruce de Bulevares Principales",
            ),
            CameraSource(
                id="cordoba-colon-general-paz",
                name="Córdoba - Av. Colón y Av. General Paz",
                url="https://transitocordoba.com/live/colon_paz.m3u8",
                kind="public",
                location="Córdoba Capital, Argentina",
                intersection_type="Cruce Céntrico Vehicular",
            ),
            CameraSource(
                id="sample-argentina-intersection",
                name="Demo Cruce de Avenidas Argentina (4K Live Feed)",
                url="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
                kind="public",
                location="Argentina",
                intersection_type="Cruce de 4 Carriles en Vivo",
            ),
            CameraSource(
                id="public-url",
                name="URL personalizada (RTSP / HLS / YouTube Live / Direct Stream)",
                url="",
                kind="public",
                location="Pegar URL personalizada",
                intersection_type="Cruce Personalizado",
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
            raw_url = self._source.url if self._source else ""
            if not raw_url:
                raise RuntimeError("La URL de la cámara está vacía")

            url = resolve_stream_url(raw_url)
            self._resolved_url = url
            self._is_snapshot_mode = url.endswith(".jpg") or url.endswith(".jpeg") or url.endswith(".png")

            if self._is_snapshot_mode:
                return

            try:
                if url.startswith("rtsp://") or url.startswith("http://") or url.startswith("https://"):
                    self._cap = cv2.VideoCapture(url)
                else:
                    self._cap = cv2.VideoCapture(int(url) if url.isdigit() else url)

                if not self._cap.isOpened():
                    self._cap = cv2.VideoCapture(raw_url)
                    if not self._cap.isOpened():
                        raise RuntimeError(f"No se pudo conectar a la cámara del cruce: {raw_url}")
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
            if self._is_snapshot_mode:
                return self.read_snapshot(self._resolved_url or (self._source.url if self._source else ""))

            if self._cap is None or not self._cap.isOpened():
                return None

            ret, frame = self._cap.read()
            if not ret:
                if self._cap is not None:
                    self._cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = self._cap.read()

                if not ret:
                    self._last_error = "read_failed"
                    return None

            self._last_frame = frame
            return frame

    def read_snapshot(self, url: str):
        if not url:
            return None
        try:
            resp = self._snapshot_session.get(url, timeout=5)
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
