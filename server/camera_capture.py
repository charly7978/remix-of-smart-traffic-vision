import io
import time
import threading
import logging
from dataclasses import dataclass
from pathlib import Path
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


LOCAL_VIDEO_PATH = Path(__file__).resolve().parent / "assets" / "demo-interseccion.mp4"
SNAPSHOT_RATE_SECONDS = 2.0
_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")


def generate_fallback_frame(width: int = 800, height: int = 600) -> np.ndarray:
    """Genera un fotograma sintético elegante de cruce vial si falla la captura remota."""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:] = (30, 35, 42) # fondo asfalto
    # Calles
    cv2.rectangle(img, (width // 2 - 80, 0), (width // 2 + 80, height), (50, 55, 65), -1)
    cv2.rectangle(img, (0, height // 2 - 80), (width, height // 2 + 80), (50, 55, 65), -1)
    # Centro intersección
    cv2.circle(img, (width // 2, height // 2), 12, (0, 230, 118), -1)
    # Texto
    cv2.putText(
        img,
        "AMEGHINO AI - CRUCE VEHICULAR AR (MODO FALLBACK)",
        (30, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (240, 245, 250),
        2,
    )
    return img


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
        self._last_snapshot_ts = 0.0
        self._using_local_fallback = False

    def sources(self) -> list[CameraSource]:
        return [
            CameraSource(
                id="sample-argentina-intersection",
                name="Demo Cruce de Avenidas Argentina (Local 4K Feed)",
                url=str(LOCAL_VIDEO_PATH),
                kind="public",
                location="Buenos Aires, Argentina",
                intersection_type="Cruce de 4 Carriles en Vivo",
            ),
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
                id="local-webcam",
                name="Cámara local (webcam)",
                url="0",
                kind="local",
                location="Dispositivo del equipo",
                intersection_type="Prueba de Cámara Directa",
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
            if self._cap is not None or self._is_snapshot_mode:
                return
            raw_url = self._source.url if self._source else ""
            if not raw_url:
                raw_url = str(LOCAL_VIDEO_PATH)

            url = resolve_stream_url(raw_url)
            self._resolved_url = url
            self._is_snapshot_mode = self._is_image_url(url)

            if self._is_snapshot_mode:
                snap = self.read_snapshot(url)
                if snap is None:
                    # Fallback si falla la imagen remota
                    self._using_local_fallback = True
                    self._is_snapshot_mode = False
                    url = str(LOCAL_VIDEO_PATH)
                else:
                    return

            try:
                if url.startswith("rtsp://") or url.startswith("http://") or url.startswith("https://"):
                    self._cap = cv2.VideoCapture(url)
                else:
                    self._cap = cv2.VideoCapture(int(url) if url.isdigit() else url)

                if not self._cap.isOpened():
                    # Fallback al archivo de video local si la URL remota no abre
                    self._using_local_fallback = True
                    self._cap = cv2.VideoCapture(str(LOCAL_VIDEO_PATH))
            except Exception as e:
                logger.warning(f"Error al abrir cámara {raw_url}, usando fallback local: {e}")
                self._using_local_fallback = True
                self._cap = cv2.VideoCapture(str(LOCAL_VIDEO_PATH))

    def stop(self) -> None:
        with self._lock:
            if self._cap is not None:
                try:
                    self._cap.release()
                except Exception:
                    pass
                self._cap = None
            self._is_snapshot_mode = False
            self._last_snapshot_ts = 0.0
            self._using_local_fallback = False

    def read_frame(self) -> np.ndarray:
        with self._lock:
            if self._is_snapshot_mode:
                now = time.time()
                if now - self._last_snapshot_ts < SNAPSHOT_RATE_SECONDS and self._last_frame is not None:
                    return self._last_frame
                self._last_snapshot_ts = now
                frame = self.read_snapshot(self._resolved_url or (self._source.url if self._source else ""))
                if frame is not None:
                    return frame

            if self._cap is not None and self._cap.isOpened():
                ret, frame = self._cap.read()
                if not ret:
                    # Rebobinar video si llegó al final
                    self._cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = self._cap.read()

                if ret and frame is not None:
                    self._last_frame = frame
                    return frame

            # Si falla el VideoCapture, intentar fallback local
            if not self._using_local_fallback:
                self._using_local_fallback = True
                self._cap = cv2.VideoCapture(str(LOCAL_VIDEO_PATH))
                if self._cap.isOpened():
                    ret, frame = self._cap.read()
                    if ret and frame is not None:
                        self._last_frame = frame
                        return frame

            # Si todo falla, devolver fotograma sintético
            fallback = generate_fallback_frame()
            self._last_frame = fallback
            return fallback

    def read_snapshot(self, url: str) -> Optional[np.ndarray]:
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

    @staticmethod
    def _is_image_url(url: str) -> bool:
        path = url.split("?")[0].lower()
        return path.endswith(_IMAGE_EXTENSIONS)
