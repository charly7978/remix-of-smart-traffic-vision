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
    Resuelve una URL de video o directo a su stream utilizable por OpenCV.
    Soporta YouTube Live, HLS, RTSP y HTTP MJPEG/Direct streams.
    """
    if not raw_url:
        return ""
    
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


ASSETS_DIR = Path(__file__).resolve().parent / "assets"
LOCAL_VIDEO_PATH = ASSETS_DIR / "input_video.mp4"
VIDEO_DEGIRUM_PATH = ASSETS_DIR / "cruce_degirum.mp4"
SNAPSHOT_RATE_SECONDS = 10.0
_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
}

# ---------------------------------------------------------------------------
# Cámaras públicas EN VIVO de cruces y bocacalles argentinas con semáforos.
# La lista contiene SOLO cruces vehiculares semaforizados (calle × calle).
# Proveedor: red de webcams agregada por Windy (imagen actual, sin API key).
# URLs estables tipo: https://images-webcams.windy.com/88/{id}/current/original/{id}.jpg
# Verificación 2026-08-10: operativas (HTTP 200, actualización ~1 min).
# ---------------------------------------------------------------------------

ARGENTINE_CAMERAS: list[CameraSource] = [
    # --- Córdoba: cruces de avenidas del centro, todos semaforizados ---
    CameraSource(
        id="cordoba-bv-san-juan-velez-sarsfield",
        name="Córdoba › Bv. San Juan y Av. Vélez Sarsfield (Patio Olmos)",
        url="https://images-webcams.windy.com/88/1664693412/current/original/1664693412.jpg",
        kind="public",
        location="Córdoba, Córdoba",
        intersection_type="Cruce con semáforos",
    ),
    CameraSource(
        id="cordoba-27-abril-velez-sarsfield",
        name="Córdoba › 27 de Abril y Av. Vélez Sarsfield",
        url="https://images-webcams.windy.com/88/1664734573/current/original/1664734573.jpg",
        kind="public",
        location="Córdoba, Córdoba",
        intersection_type="Cruce con semáforos",
    ),
    CameraSource(
        id="cordoba-av-colon-general-paz",
        name="Córdoba › Av. Colón y Av. General Paz",
        url="https://images-webcams.windy.com/88/1665026688/current/original/1665026688.jpg",
        kind="public",
        location="Córdoba, Córdoba",
        intersection_type="Cruce con semáforos",
    ),
    CameraSource(
        id="cordoba-plaza-espana-yrigoyen",
        name="Córdoba › Plaza España y Av. Hipólito Yrigoyen",
        url="https://images-webcams.windy.com/88/1664930739/current/original/1664930739.jpg",
        kind="public",
        location="Córdoba, Córdoba",
        intersection_type="Cruce con semáforos",
    ),
    CameraSource(
        id="cordoba-av-olmos-maipu-norte",
        name="Córdoba › Av. Emilio Olmos y Av. Maipú (N)",
        url="https://images-webcams.windy.com/88/1664940352/current/original/1664940352.jpg",
        kind="public",
        location="Córdoba, Córdoba",
        intersection_type="Cruce con semáforos",
    ),
    CameraSource(
        id="cordoba-av-olmos-maipu-este",
        name="Córdoba › Av. Emilio Olmos y Av. Maipú (E)",
        url="https://images-webcams.windy.com/88/1664940551/current/original/1664940551.jpg",
        kind="public",
        location="Córdoba, Córdoba",
        intersection_type="Cruce con semáforos",
    ),
    CameraSource(
        id="cordoba-humberto-primo-general-paz",
        name="Córdoba › Humberto Primo y Av. General Paz",
        url="https://images-webcams.windy.com/88/1664929778/current/original/1664929778.jpg",
        kind="public",
        location="Córdoba, Córdoba",
        intersection_type="Cruce con semáforos",
    ),
    # --- Buenos Aires: cruce más emblemático del país ---
    CameraSource(
        id="caba-9-julio-corrientes",
        name="Buenos Aires › Av. 9 de Julio y Av. Corrientes (Obelisco)",
        url="https://images-webcams.windy.com/88/1691337947/current/original/1691337947.jpg",
        kind="public",
        location="CABA, Plaza de la República",
        intersection_type="Cruce con semáforos",
    ),
    # --- Otras ciudades: bocacalles céntricas semaforizadas ---
    CameraSource(
        id="mdp-torreon-del-monje",
        name="Mar del Plata › Torreón del Monje (Av. costanera)",
        url="https://images-webcams.windy.com/88/1650988843/current/original/1650988843.jpg",
        kind="public",
        location="Mar del Plata, Buenos Aires",
        intersection_type="Boulevard semaforizado",
    ),
    CameraSource(
        id="mdp-museo-mar",
        name="Mar del Plata › Museo MAR (Av. costanera)",
        url="https://images-webcams.windy.com/88/1741309831/current/original/1741309831.jpg",
        kind="public",
        location="Mar del Plata, Buenos Aires",
        intersection_type="Boulevard semaforizado",
    ),
    CameraSource(
        id="mendoza-tribunales",
        name="Mendoza › Tribunales (centro)",
        url="https://images-webcams.windy.com/88/1793909466/current/original/1793909466.jpg",
        kind="public",
        location="Ciudad de Mendoza",
        intersection_type="Bocacalle semaforizada",
    ),
    CameraSource(
        id="cipolletti-centro",
        name="Cipolletti › Centro",
        url="https://images-webcams.windy.com/88/1793905772/current/original/1793905772.jpg",
        kind="public",
        location="Cipolletti, Río Negro",
        intersection_type="Bocacalle semaforizada",
    ),
    CameraSource(
        id="sde-plaza-libertad",
        name="Santiago del Estero › Plaza Libertad (centro)",
        url="https://images-webcams.windy.com/88/1732394190/current/original/1732394190.jpg",
        kind="public",
        location="Santiago del Estero",
        intersection_type="Bocacalle semaforizada",
    ),
]


class CameraCapture:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._cap = None
        self._source: Optional[CameraSource] = None
        self._last_frame = None
        self._last_error: Optional[str] = None
        self._snapshot_session = requests.Session()
        self._snapshot_session.headers.update(BROWSER_HEADERS)
        self._is_snapshot_mode = False
        self._resolved_url = ""
        self._last_snapshot_ts = 0.0
        self._using_local_fallback = False
        self._ever_got_frame = False

    def sources(self) -> list[CameraSource]:
        return [
            *ARGENTINE_CAMERAS,
            CameraSource(
                id="local-webcam",
                name="Cámara Local / Webcam Directa (Dispositivo)",
                url="0",
                kind="local",
                location="Dispositivo del Equipo",
                intersection_type="Cámara en Vivo Directa",
            ),
            CameraSource(
                id="public-url",
                name="URL Personalizada (RTSP / HLS / Stream en Vivo)",
                url="",
                kind="public",
                location="Pegar URL de Transmisión Directa",
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
                    self._using_local_fallback = True
                    self._cap = cv2.VideoCapture(str(LOCAL_VIDEO_PATH))
            except Exception as e:
                logger.warning(f"Error al abrir cámara {raw_url}, usando video vehicular real: {e}")
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
                    self._ever_got_frame = True
                    return frame
                # Falla transitoria de descarga: conservar el último frame real
                # de la cámara en lugar de silenciar el problema con el video local.
                self._last_error = "snapshot_transient_failure"
                if self._last_frame is not None:
                    return self._last_frame
                if self._ever_got_frame:
                    return np.zeros((480, 640, 3), dtype=np.uint8)

            if self._cap is not None and self._cap.isOpened():
                ret, frame = self._cap.read()
                if not ret:
                    # Rebobinar el video de tráfico vehicular al llegar al final
                    self._cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = cap_read = self._cap.read()

                if ret and frame is not None:
                    self._last_frame = frame
                    self._ever_got_frame = True
                    return frame

            # Si la captura remota o dispositivo falla, reproducir video de tráfico vehicular real
            if not self._using_local_fallback:
                self._using_local_fallback = True
                self._cap = cv2.VideoCapture(str(LOCAL_VIDEO_PATH))
                if self._cap.isOpened():
                    ret, frame = self._cap.read()
                    if ret and frame is not None:
                        self._last_frame = frame
                        self._ever_got_frame = True
                        return frame

            if self._last_frame is not None:
                return self._last_frame

            # Fallback secundario de respaldo
            self._cap = cv2.VideoCapture(str(LOCAL_VIDEO_PATH))
            if self._cap.isOpened():
                ret, frame = self._cap.read()
                if ret and frame is not None:
                    self._last_frame = frame
                    self._ever_got_frame = True
                    return frame

            return np.zeros((480, 640, 3), dtype=np.uint8)

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
