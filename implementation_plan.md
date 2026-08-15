# Implementation Plan

## Overview

Transformar la demo de 2 cámaras en vivo en un **Híbrido "Percepción × Control"** para la presentación al Gobernador de Buenos Aires. El video real pasa a ser el **sensor de percepción** (cajas de detección, medición de colas, indicadores de vía) y el **Gemelo Digital** (render cenital 2D en canvas) es el **demostrador de control** donde los semáforos virtuales SÍ gobiernan el tránsito y los autos simulados obedecen — todo alimentado en tiempo real por los datos medidos de las dos cámaras.

**Contexto:** El proyecto ya tiene backend de detección dual, frontend de simulación sintética y un panel de cámara real. El defecto fatal actual es que dibujar semáforos virtuales sobre el video real que los autos no obedecen destruye la credibilidad de la demo. La solución de "Gemelo Digital" es honesta, vanguardista y exactamente lo que las ciudades inteligentes globales están presentando.

**Alcance:** Backend (medición por acceso, calibración por cámara, enriquecimiento del payload WS). Frontend (controlador del gemelo, vista dividida "Percepción × Control"). Presentación (pantalla del modo pitch rediseñada con narración automática para el gobernador).
---

## Types

### Backend — `server/sensors.py`

```python
@dataclass
class CalibrationPoint:
    x: float    # normalized 0..1
    y: float

@dataclass
class CameraCalibration:
    camera_id: str
    primary_axis: str               # "NS" | "EW" — eje principal que esta cámara vigila
    stop_line_y: float              # normalized 0..1 — línea de detención en la calzada
    approach_side_ns: float         # normalized 0..1 — x que divide enfoque N vs S (o E vs W)
    stop_zone: list[CalibrationPoint]      # polígono de medición de cola detenida
    density_zone: list[CalibrationPoint]   # polígono de medición de densidad
    signal_position: CalibrationPoint      # dónde dibujar el semáforo virtual en el video

@dataclass
class ApproachMeasure:
    approach: str          # "N" | "S" | "E" | "W"
    count: int             # vehículos detectados en zona
    queue: int             # vehículos detenidos (< 3 km/h estimado)
    queue_meters: float    # longitud estimada de cola
    density: float         # ocupación relativa de la zona de densidad
    flow_est: float        # veh/minuto estimado (llegadas)
    speed_avg: float       # velocidad media (km/h)
    stopped_ratio: float   # proporción detenidos / total
    ped_waiting: int       # peatones detectados en la zona del cruce
```

Ampliar `DetectionFrame` en `server/detector.py`:

```python
@dataclass
class DetectionFrame:
    # ... campos existentes ...
    measures: dict[str, ApproachMeasure] | None = None   # key = "N","S","E","W"
    calibration_ok: bool = False
```

Twin payload en `server/sensors.py`:

```python
@dataclass
class TwinPayload:
    ts: float
    approaches: dict[str, ApproachMeasure]  # N,S,E,W
    ns_flow: float       # suma flow_est N+S (veh/min)
    ew_flow: float
    ns_queue: int        # cola total N+S
    ew_queue: int
    signal: dict         # { axis, phase, countdown }
    decision: dict       # payload de decisión (compatible con AgentDecision)
    calibration_ok: bool
```
### Frontend — `src/lib/realVision/client.ts` y `src/lib/traffic/types.ts`

```typescript
// Extender DetectionFrame (existe en types.ts y client.ts)
export interface DetectionFrame {
  // ... campos existentes ...
  analyticsA?: ApproachMeasurePayload;   // medidas de la cámara A
  analyticsB?: ApproachMeasurePayload;   // medidas de la cámara B
  twin?: TwinPayload;                    // estado del gemelo
}

export type ApproachMeasurePayload = {
  primaryAxis: "NS" | "EW";
  approaches: Record<string, {    // key "N","S","E","W"
    count: number; queue: number; queueMeters: number;
    density: number; flowEst: number; speedAvg: number;
    stoppedRatio: number; pedWaiting: number;
  }>;
  calibrationOk: boolean;
};

export type TwinPayload = {
  ts: number;
  approaches: Record<string, { queue: number; flowEst: number }>;
  nsFlow: number; ewFlow: number;
  nsQueue: number; ewQueue: number;
  signal: { axis: "NS" | "EW"; phase: string; countdown: number };
  decision: DecisionPayload;
};
```

---

## Files

### Archivos nuevos

| Archivo | Propósito |
|---|---|
| `server/sensors.py` | Calibraciones, medición por acceso (`ApproachMeasure`), computación de `TwinPayload` |
| `server/calibrations.json` | Calibraciones preset para las 2 cámaras TfL Londres (y futuras de BA) |
| `server/e2e_dual_twin_test.py` | Test end-to-end: 2 cámaras (locales), calibración, medición, twin, decisión |
| `src/lib/traffic/twinController.ts` | `TwinController`: consume `TwinPayload` e inyecta flujos en `TrafficEngine` |
| `src/components/simulator/TwinViewport.tsx` | Canvas del gemelo digital (envuelve `drawScene` con `TwinController`) |
| `src/components/simulator/AnalyticsStrip.tsx` | Barra de telemetría por acceso (colas N/S/E/O, velocidad, flujo) |
| `src/routes/presentacion.tsx` | **Nueva ruta** — Modo Presentación Gobernador (pantalla completa, guion automático, sin distracciones) |
| `docs/PRESENTACION_GOBERNADOR.md` | Documentación de la demo: narrativa, controles, escenas |
### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `server/main.py` | Refactor `/ws/camera_dual`: agregar `ApproachMeasure` por cámara, computar `TwinPayload`, enviar en payload WS |
| `server/detector.py` | Extender `DetectionFrame.measures`; agregar lógica de "detenido" para counting de cola |
| `server/decision.py` | `auto_decide` puede recibir medidas por acceso extra; compatibilidad hacia atrás |
| `src/lib/realVision/client.ts` | Extender `DetectionFrame` con `analyticsA/B` y `twin`; actualizar `normalizeFrame` |
| `src/lib/traffic/types.ts` | Agregar tipos `ApproachMeasurePayload`, `TwinPayload` |
| `src/lib/traffic/engine.ts` | Agregar `setApproachFlow(approach, vehPerHour)` para inyección desde TwinController |
| `src/components/simulator/RealCameraPanel.tsx` | Nuevo layout dividido "Percepción × Control"; agrupar feeds A+B en panel izquierdo |
| `src/routes/simulador.tsx` | Nuevo modo `"twin"` que activa el layout híbrido; integrar `RealCameraPanel` rediseñado |

- `server/camera_capture.py`: agregar helper `calibration_id(source) -> str` (mapea CameraSource.id → calibración).
- `src/components/simulator/draw.ts`: exponer `drawAugmentedRealSignals` para que el modo "percepción" la use con datos reales de medición (dibuja semáforo virtual + stop bar anclado al asfalto).

---

## Functions
### Backend — `server/sensors.py` (nuevo)

| Función | Firma | Propósito |
|---|---|---|
| `load_calibrations()` | `() -> dict[str, CameraCalibration]` | Carga `calibrations.json`; retorna dict key=camera_id |
| `get_calibration(camera_id, calibrations) -> CameraCalibration` | Busca calibración; retorna default si no existe |
| `measure_approach(detection, calibration, frame_shape) -> dict[str, ApproachMeasure]` | Dado DetectionFrame + calibración, computa medidas por acceso (N/S/E/W) |
| `compute_twin(measures_a, measures_b, decision, signal_state) -> TwinPayload` | Fusiona medidas de ambas cámaras en estado unificado para el gemelo |
| `_queue_count(vehicles, stop_zone) -> int` | Cuenta vehículos con velocidad < umbral dentro del polígono de cola |
| `_flow_estimate(vehicles, frame_ts, prev_ts) -> float` | Estima flujo veh/min basado en timestamps de entrada a la zona de densidad |

### Backend — `server/main.py` (modificar)

| Función | Cambio |
|---|---|
| `ws_camera_dual` | Agregar medición por acceso tras `det_a` y `det_b`; computar `TwinPayload`; incluir en payload WS bajo `analyticsA`, `analyticsB`, `twin` |
| `_fusion` | Mantener (fusión para decisión), el gemelo usa medidas sin fusionar (datos por cámara) |
| `GET /api/calibrations` (nuevo) | Endpoint para que el frontend obtenga las calibraciones disponibles |
| `POST /api/calibrate/preview` (nuevo) | Recibe imagen + parámetros de calibración; retorna la imagen con overlay para validación visual |

### Frontend

| Archivo | Nombre | Propósito |
|---|---|---|
| `twinController.ts` (nuevo) | `TwinController.ingest(twin, nowMs)` | Procesa TwinPayload; actualiza engine.setHour y setApproachFlow |
| `twinController.ts` (nuevo) | `TwinController.setApproachFlow(approach, vehPerHour)` | Ajusta la tasa de spawn en engine |
| `twinController.ts` (nuevo) | `TwinController.getEngine()` | Retorna TrafficEngine interno |
| `engine.ts` (modificar) | `setApproachFlow(approach, vehPerHour)` | Método público que sobreescribe la tasa de spawn de un acceso |
| `engine.ts` (modificar) | `setOverrides(overrides)` | Setea los 4 accesos de una vez desde el twin |
| `AnalyticsStrip.tsx` (nuevo) | `AnalyticsStrip` | Barra de telemetría por acceso |
| `TwinViewport.tsx` (nuevo) | `TwinViewport` | Canvas que renderiza gemelo con drawScene |
| `presentacion.tsx` (nuevo) | `PresentacionPage` / `SceneManager` | Ruta completa de presentación guionada |
---

## Classes

### Backend — `server/sensors.py` — `MeasurementEngine`

```python
class MeasurementEngine:
    """Motor de medición: calibra, filtra y produce ApproachMeasures desde DetectionFrame."""

    def __init__(self, calibrations: dict[str, CameraCalibration] | None = None):
        self._calibrations = calibrations or {}
        self._prev_ts: dict[str, float] = {}

    def set_calibration(self, camera_id: str, calibration: CameraCalibration) -> None: ...
    def remove_calibration(self, camera_id: str) -> None: ...
    def measure(self, camera_id: str, frame: DetectionFrame, ts: float, frame_shape: tuple) -> tuple[dict[str, ApproachMeasure], CameraCalibration]: ...
```

### Frontend — `src/lib/traffic/twinController.ts` — `TwinController`

```typescript
export class TwinController {
  private engine: TrafficEngine;
  private approachFlows: Record<Approach, number> = { N: 300, S: 300, E: 200, W: 200 };

  constructor(engine: TrafficEngine);
  getEngine(): TrafficEngine;
  ingest(twin: TwinPayload, nowMs: number): void;
  reset(): void;
---

## Testing

### Backend

1. **Unitario** (`test_measure_approach`): DetectionFrame sintético + calibración mock → total de vehículos correcto, cola solo cuenta los detenidos, density y flow dentro de rango esperado.
2. **Unitario** (`test_compute_twin`): 2 sets de medidas → TwinPayload espejado correctamente (nsFlow, ewFlow, nsQueue, ewQueue) y no pierde datos.
3. **Integración** (`server/e2e_dual_twin_test.py`): usa 2 videos locales, corre detección en cada uno, mide, computa twin, corre `auto_decide`, imprime JSON de decisión + medidas.
4. **Regresión**: `server/e2e_detect_test.py` debe seguir pasando (solo se agrega campos opcionales).

### Frontend

1. `cd server` + `pip install -r requirements.txt`; `npm run build` pasa sin errores TS.
2. Manual en `/simulador` modo `real`/`twin`: verificar layout dividido, streams A+B visibles, gemelo renderizando vehículos que frenan ante verde/rojo.
3. Manual `/presentacion`: 5 escenas automáticas con narración finctan sin interacción, cambian de fuente por escena.
4. Verificación de coherencia visual: si el video A muestra ~3 autos detenidos en cola, el gemelo debe mostrar ~3 autos en ese approach (margen ±2 por latencia de procesamiento).

---

## Implementation Order

1. **Backend — `server/sensors.py`** — creación de dataclasses, carga de calibraciones, motor de medición.
2. **Backend — `server/calibrations.json`** — presets para las 2 cámaras TfL utilizadas por defecto.
3. **Backend — `server/detector.py`** — extender `DetectionFrame` con `measures`/`calibration_ok`.
4. **Backend — `server/main.py`** — integrar medición en `ws_camera_dual`, endpoints `/api/calibrations` y `/api/calibrate/preview`.
5. **Backend — tests unitarios + e2e dual/twin.**
6. **Frontend — tipos** (`types.ts` y `client.ts`) + `normalizeFrame`.
7. **Frontend — `engine.ts`** — `setApproachFlow` + `setOverrides`.
8. **Frontend — `twinController.ts`** — clase TwinController con ingest/reset.
9. **Frontend — `TwinViewport.tsx`** y **`AnalyticsStrip.tsx`**.
10. **Frontend — `RealCameraPanel.tsx`** — layout dividido "Percepción × Control".
11. **Frontend — `simulador.tsx`** — modo `twin` integrado.
12. **Frontend — `presentacion.tsx`** — modo presentación gobernador con 5 escenas automáticas.
13. **Docs — `docs/PRESENTACION_GOBERNADOR.md`** — narrativa y controles.
14. **Validación final** — build TS + e2e backend + checklist de presentación.
  setApproachFlow(approach: Approach, vehPerHour: number): void;
}
```

### Frontend — `src/components/simulator/TwinViewport.tsx`

Componente React que envuelve un `<canvas>` y en cada animation frame llama a
`drawScene(ctx, controller.getEngine(), nowMs, drawOptions, null)` (modo sintético).

---

## Dependencies

No se requieren nuevas dependencias externas. Se usa `numpy` (ya presente) en el
backend y canvas 2D + React (ya presentes) en el frontend.