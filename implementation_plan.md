## Dependencies

Backend (`server/requirements.txt`):

```
fastapi==0.111.0
uvicorn[standard]==0.30.0
opencv-python-headless==0.30.0
ultralytics==8.2.0
numpy==1.26.4
pillow==10.3.0
python-multipart==0.0.9
websockets==12.0
```

Frontend:

- No se agregan dependencias nuevas. Se usa `WebSocket` nativo y el canvas 2D existente.

Configuración:

- `vite.config.ts` no requiere cambios, ya soporta proxy por dev server si queremos evitar CORS en desarrollo.
- Agregar script `"dev:vision": "cd server && uvicorn main:app --reload --port 8787"` en `package.json`.

## Testing

- Verificar compilación de `engine.ts` y `simulador.tsx` con `npm run build`.
- Correr `server/main.py` y abrir `/simulador` con `source=real`.
- Validar:
  1. Cámara local (webcam) muestra video en el canvas.
  2. Detección YOLO muestra cajas y etiquetas.
  3. Conteo por carril y densidad actualizan el motor.
  4. Semáforo cambia automáticamente según la demanda real.
  5. Métricas y panel de auditoría registran decisiones.
  6. Si se corta la cámara, el sistema entra en `failSafe`.
- Incluir al menos 2 cámaras públicas de Buenos Aires como preset para probar sin configuración.
- Guardar evidencias en `server/evidence_logs/` para mostrar a autoridades.

## Implementation Order

1. **Backend base** (`server/main.py`, `server/camera_capture.py`) — captura RTSP/HTTP/Webcam.
2. **Detección YOLO** (`server/detector.py`) — inferencia y post-procesamiento de clases.
3. **Motor de decisión real** (`server/decision.py`) — mapeo a `Evidence` y reglas automáticas.
4. **API/WebSocket** (`server/main.py`) — exponer detecciones al frontend.
5. **Cliente frontend** (`src/lib/realVision/client.ts`, `src/hooks/useRealVision.ts`) — conexión y consumo.
6. **Integración en simulador** (`src/routes/simulador.tsx`, `draw.ts`, `render3d.ts`) — mostrar video real + overlay.
7. **Panel de cámara real** (`RealCameraPanel.tsx`) — selector de fuente y métricas.
8. **Tipos y ajustes** (`src/lib/traffic/types.ts`, `engine.ts`) — ingesta de frames reales.
9. **Pruebas end-to-end** — cámara local, luego públicas, medición de latencia y precisión.
10. **Empaquetado** — Dockerfile, README de ejecución y deploy.
