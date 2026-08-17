/**
 * Componente React del Gemelo Digital 3D de Intersección Three.js.
 * Proyecto Carlos Ameghino — Municipalidad de Tres de Febrero.
 *
 * Proporciona un visor WebGL 3D interactivo con sombras dinámicas, control orbital,
 * cámaras conmutables (Isométrica, CCTV COM, Drone Cenital, Street Level) y selector
 * de modo de percepción (Fotorrealista Digital Twin vs. Modo LiDAR / Red Neuronal).
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { type TrafficEngine, type Vehicle } from "@/lib/traffic/engine";
import { TrafficScene3D, type ViewMode } from "./TrafficScene3D";
import {
  Camera,
  Layers,
  Scan,
  Video,
  Eye,
  Sliders,
  ShieldAlert,
  Sparkles,
  Info,
  Maximize2,
} from "lucide-react";

export type CameraPreset = "isometric" | "cctv" | "drone" | "street";

interface ThreeCanvasSimulatorProps {
  engine: TrafficEngine;
  onSelectVehicle?: (v: Vehicle | null) => void;
  selectedVehicle?: Vehicle | null;
}

export function ThreeCanvasSimulator({
  engine,
  onSelectVehicle,
  selectedVehicle,
}: ThreeCanvasSimulatorProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("digital_twin");
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("isometric");
  const [fps, setFps] = useState(60);

  // Referencias a objetos Three.js
  const sceneRef = useRef<TrafficScene3D | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const reqAnimRef = useRef<number | null>(null);

  // Estado de órbita del mouse
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const sphericalRef = useRef(new THREE.Spherical(75, Math.PI / 3.2, Math.PI / 4));
  const targetRef = useRef(new THREE.Vector3(0, 0, 0));

  // Aplicar posición de cámara según el preset
  const applyCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
    if (!cameraRef.current) return;

    switch (preset) {
      case "isometric":
        sphericalRef.current.set(78, Math.PI / 3.4, Math.PI / 4);
        targetRef.current.set(0, 0, 0);
        break;
      case "cctv":
        sphericalRef.current.set(42, Math.PI / 2.6, (3 * Math.PI) / 4);
        targetRef.current.set(0, 1.5, 0);
        break;
      case "drone":
        sphericalRef.current.set(82, 0.05, 0);
        targetRef.current.set(0, 0, 0);
        break;
      case "street":
        sphericalRef.current.set(36, Math.PI / 2.15, (3 * Math.PI) / 4);
        targetRef.current.set(0, 2, 0);
        break;
    }
  }, []);

  // Inicialización de Three.js
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 800;

    // 1. Escena
    const trafficScene = new TrafficScene3D();
    sceneRef.current = trafficScene;

    // 2. Cámara
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 300);
    cameraRef.current = camera;
    applyCameraPreset("isometric");

    // 3. Renderer WebGL
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    rendererRef.current = renderer;
    container.replaceChildren(renderer.domElement);

    // 4. Raycaster para selección de vehículos con clic
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(trafficScene.vehiclesGroup.children, true);

      if (intersects.length > 0 && onSelectVehicle) {
        let topMesh: THREE.Object3D | null = intersects[0]!.object;
        while (
          topMesh &&
          !topMesh.name.startsWith("vehicle-") &&
          !topMesh.name.startsWith("bus-") &&
          !topMesh.name.startsWith("ambulance-") &&
          !topMesh.name.startsWith("moto-")
        ) {
          topMesh = topMesh.parent;
        }
        if (topMesh) {
          const vIdStr = topMesh.name.split("-")[1];
          const vId = Number(vIdStr);
          const found = engine.vehicles.find((v) => v.id === vId) || null;
          onSelectVehicle(found);
        }
      }
    };

    renderer.domElement.addEventListener("click", handleClick);

    // 5. Controles de Mouse Orbit & Zoom
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        isDraggingRef.current = true;
        previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      if (e.buttons === 1) {
        // Rotación orbital
        sphericalRef.current.theta -= deltaX * 0.006;
        sphericalRef.current.phi = Math.max(
          0.1,
          Math.min(Math.PI / 2 - 0.05, sphericalRef.current.phi - deltaY * 0.006),
        );
      } else if (e.buttons === 2) {
        // Pan
        targetRef.current.x -= deltaX * 0.05;
        targetRef.current.z -= deltaY * 0.05;
      }

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      sphericalRef.current.radius = Math.max(
        15,
        Math.min(130, sphericalRef.current.radius + e.deltaY * 0.05),
      );
    };

    const dom = renderer.domElement;
    dom.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    dom.addEventListener("wheel", handleWheel, { passive: false });
    dom.addEventListener("contextmenu", (e) => e.preventDefault());

    // 6. Redimensionamiento
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 7. Bucle Principal de Renderizado
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsTimer = performance.now();

    const animate = (time: number) => {
      reqAnimRef.current = requestAnimationFrame(animate);

      const deltaSec = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;

      // Calcular FPS
      frameCount++;
      if (time - fpsTimer >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        fpsTimer = time;
      }

      // Actualizar posición de la cámara desde coordenadas esféricas
      camera.position.setFromSpherical(sphericalRef.current).add(targetRef.current);
      camera.lookAt(targetRef.current);

      // Actualizar escena Three.js
      trafficScene.update(engine, deltaSec, viewMode);

      // Renderizar
      renderer.render(trafficScene.scene, camera);
    };

    reqAnimRef.current = requestAnimationFrame(animate);

    return () => {
      if (reqAnimRef.current) cancelAnimationFrame(reqAnimRef.current);
      dom.removeEventListener("click", handleClick);
      dom.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      dom.removeEventListener("wheel", handleWheel);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, [applyCameraPreset, engine, onSelectVehicle, viewMode]);

  return (
    <div className="relative w-full h-[640px] lg:h-[720px] rounded-2xl overflow-hidden border border-border/80 bg-slate-950 shadow-2xl">
      {/* Contenedor WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* ------------------------------------------------------------- */}
      {/* Barra de Control Flotante Superior: Modos y Cámaras           */}
      {/* ------------------------------------------------------------- */}
      <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Selector de Modo de Percepción */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/60 shadow-lg pointer-events-auto">
          <button
            onClick={() => setViewMode("digital_twin")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              viewMode === "digital_twin"
                ? "bg-emerald-500 text-slate-950 shadow-md font-semibold"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Gemelo Digital 3D
          </button>

          <button
            onClick={() => setViewMode("lidar")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              viewMode === "lidar"
                ? "bg-cyan-500 text-slate-950 shadow-md font-semibold"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Scan className="w-3.5 h-3.5" />
            LiDAR / Neural AI
          </button>

          <button
            onClick={() => {
              setViewMode("cctv");
              applyCameraPreset("cctv");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              viewMode === "cctv"
                ? "bg-rose-500 text-white shadow-md font-semibold"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            CCTV COM Caseros
          </button>
        </div>

        {/* Selector de Presets de Cámara */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/60 shadow-lg pointer-events-auto">
          <button
            onClick={() => applyCameraPreset("isometric")}
            title="Vista Isométrica 3D"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
              cameraPreset === "isometric"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            📐 Isométrica
          </button>
          <button
            onClick={() => applyCameraPreset("cctv")}
            title="Cámara de Poste de Seguridad COM"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
              cameraPreset === "cctv"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            📹 Poste COM
          </button>
          <button
            onClick={() => applyCameraPreset("drone")}
            title="Vista Cenital Drone 2D/3D"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
              cameraPreset === "drone"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            🛸 Drone Cenital
          </button>
          <button
            onClick={() => applyCameraPreset("street")}
            title="Nivel de Calle / Conductor"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
              cameraPreset === "street"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            🏎️ Conductor
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* HUD de Telemetría Inferior: Estado del Borde & Decisión IA    */}
      {/* ------------------------------------------------------------- */}
      <div className="absolute bottom-4 left-4 right-4 pointer-events-none flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Banner de Decisión del Agente */}
        <div className="flex-1 p-3 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800/80 shadow-2xl pointer-events-auto">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                engine.failSafe
                  ? "bg-rose-500"
                  : engine.emergency
                    ? "bg-amber-400"
                    : "bg-emerald-400"
              }`}
            />
            <span className="font-mono text-xs font-bold text-slate-200">
              {engine.failSafe
                ? "FAIL-SAFE DE BORDE ACTIVO (CICLO FIJO 22s)"
                : engine.emergency
                  ? "🚨 PRIORIDAD DE EMERGENCIA SAME 3F"
                  : `CONTROLADOR AMEGHINO AI · VERDE: ${
                      engine.axis === "NS" ? "AV. SAN MARTÍN" : "CALLE URQUIZA"
                    }`}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400 line-clamp-1 font-mono">
            {engine.decisions[0]?.rationale ||
              "Calculando matriz de densidades y colas con YOLOv11 en NVIDIA Jetson..."}
          </p>
        </div>

        {/* Badges Técnicos: FPS, Latencia y Clima */}
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800/80 shadow-2xl pointer-events-auto text-[11px] font-mono text-slate-300">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
            <span className="text-emerald-400 font-bold">{fps}</span>
            <span className="text-slate-500">FPS</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
            <span className="text-cyan-400 font-bold">42ms</span>
            <span className="text-slate-500">LAT</span>
          </div>
          <div className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300 capitalize">
            {engine.weather}
          </div>
        </div>
      </div>

      {/* Overlay de Filtro CCTV si está en modo CCTV */}
      {viewMode === "cctv" && (
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-emerald-950/15 via-transparent to-emerald-950/25 border-4 border-emerald-950/30">
          <div className="absolute top-16 left-6 font-mono text-xs text-emerald-400/90 font-bold flex flex-col gap-1">
            <div>REC ● COM-3F // CAM-04: SAN MARTIN Y URQUIZA</div>
            <div className="text-[10px] text-emerald-500/70">
              BITRATE: 8192 kbps · CODEC: H.265 HW · EDGE AI ACTIVE
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
