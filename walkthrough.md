# Walkthrough: Motor WebGL 3D de Vanguardia (Three.js GPU) — Gemelo Digital de Caseros

Siguiendo el protocolo estricto `/strict-coding-rules`, se ha dado un salto cualitativo definitivo reemplazando el dibujo plano 2D por un **Motor WebGL 3D Nativo (Three.js GPU)** con sombras dinámicas PBR, cámaras orbitales e interactivas, modo de percepción LiDAR/Red Neuronal y modelos 3D procedurales de alta fidelidad.

---

## 1. Arquitectura del Motor WebGL 3D

### A. Renderizado WebGL con Sombras PBR y Shaders

En [`src/components/simulator/three/TrafficScene3D.ts`](<file:///c:/Users/carlo.ROLITO/.antigravity-ide/Nueva%20carpeta%20(5)/remix-of-smart-traffic-vision/src/components/simulator/three/TrafficScene3D.ts>):

- **Iluminación Solar y Ciclo Horario:** `DirectionalLight` con mapa de sombras `PCFSoftShadowMap` de $2048 \times 2048$ y `HemisphereLight` para rebote lumínico natural. La posición solar y el tono del cielo cambian en tiempo real según la hora del día (Amanecer, Mediodía, Tarde y Noche 03:00 AM con farolas de alumbrado público).
- **Calzada PBR y Demarcaciones:** Asfalto rugoso con doble línea amarilla central, líneas de carril discontinuas, líneas de detención a $16.5\text{ m}$ y 4 sendas peatonales (cebras) elevadas.
- **Entorno Urbano de Caseros:** Veredas elevadas de $15\text{ cm}$, edificios esquineros con texturas de ladrillo y cemento, ventanas iluminadas y luminarias urbanas.
- **Semáforos Inteligentes 3D:** Columnas de acero con brazo pescante horizontal, cabezales con ópticas LED (Rojo, Amarillo, Verde) con materiales emisivos y luces puntuales dinámicas.
- **Efectos Climáticos:** Sistema de 2.500 partículas de lluvia 3D y niebla volumétrica con dispersión de luz (`THREE.FogExp2`).

### B. Mallas Vehiculares 3D Procedurales

En [`src/components/simulator/three/VehicleMeshFactory.ts`](<file:///c:/Users/carlo.ROLITO/.antigravity-ide/Nueva%20carpeta%20(5)/remix-of-smart-traffic-vision/src/components/simulator/three/VehicleMeshFactory.ts>):

- **Colectivos Bonaerenses (Línea 343 y 181):** Carrocería de $10.5\text{ m}$ de longitud, 6 ruedas de servicio pesado, ventanillas iluminadas, equipos de aire acondicionado en el techo y cartelera LED frontal iluminada (`343 CASEROS` / `181 R.MEJIA`).
- **Ambulancias SAME 3F:** Furgón de techo alto con librea reglamentaria de Tres de Febrero, chevrons verde flúor y **balizas estroboscópicas LED rojas y azules intermitentes** con luz puntual pulsante sobre el entorno.
- **Sedanes y SUVs:** Carrocerías aerodinámicas con pintura metalizada, cristales tintados, 4 ruedas con llantas de aleación, faros LED delanteros y luces traseras de freno dinámicas.
- **Motos & Delivery:** Cuadro 3D, ruedas con radios, conductor con casco y mochila térmica reflectiva.
- **Peatones 3D:** Figuras articuladas con piernas animadas y modelos de silla de ruedas con ruedas cromadas para movilidad reducida.

### C. Modos de Percepción y Cámaras Interactivas

En [`src/components/simulator/three/ThreeCanvasSimulator.tsx`](<file:///c:/Users/carlo.ROLITO/.antigravity-ide/Nueva%20carpeta%20(5)/remix-of-smart-traffic-vision/src/components/simulator/three/ThreeCanvasSimulator.tsx>):

- **Cámaras Conmutables:**
  - 📐 **Isométrica 3D:** Vista aérea del gemelo digital.
  - 📹 **Poste CCTV COM Caseros:** Perspectiva de cámara de seguridad urbana en altura con HUD y código de tiempo.
  - 🛸 **Drone Cenital 2D/3D:** Vista ortogonal de ingeniería de tránsito.
  - 🏎️ **Conductor / Street Level:** Nivel de calle a bordo de los vehículos.
  - **Control Orbital Libre:** Arrastre con el mouse para rotar $360^\circ$, clic derecho para desplazar (pan) y rueda del mouse para hacer zoom.
- **Modos de Percepción:**
  - **Gemelo Digital 3D:** Texturas PBR, reflejos y sombras fotorrealistas.
  - **LiDAR / Red Neuronal YOLOv11:** Escaneo de 35.000 puntos láser verde/cian con cajas delimitadoras 3D holográficas (estilo NVIDIA DRIVE / Tesla FSD).
  - **CCTV COM Caseros:** Filtro de video vigilancia con telemetría de transmisión.
- **Inspección de Telemetría al Clic:** Al hacer clic sobre cualquier vehículo 3D, se despliega una ficha con su velocidad instantánea en km/h, estado de semáforo, acceso, tipología y nivel de confianza YOLOv11.

---

## 2. Validación de Compilación y Calidad

- **`npm run format`**: Formateo con Prettier completado.
- **`npm run lint`**: 0 errores de ESLint.
- **`npm run build`**: Compilación exitosa en 1.08s (SSR y Client).
- **Git Push**: Commit `7c204a3` enviado exitosamente a `main`.
