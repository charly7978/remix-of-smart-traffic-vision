/**
 * Entorno 3D Fotorrealista de la Intersección de Caseros (Tres de Febrero).
 * Proyecto Carlos Ameghino — Municipalidad de Tres de Febrero.
 *
 * Construye la escena WebGL completa: calzadas de asfalto con demarcaciones viales,
 * veredas elevadas, edificios esquineros bonaerenses, postes de semáforos con ópticas LED activas,
 * iluminación solar dinámica, sistema de lluvia en partículas y modo LiDAR/Red Neuronal.
 */

import * as THREE from "three";
import { type Approach, type TrafficEngine } from "@/lib/traffic/engine";
import { SIGNAL_POLES_3D } from "./trafficCoordinates";
import { Vehicle3DFactory } from "./VehicleMeshFactory";
import { getPedestrianTransform3D, getVehicleTransform3D } from "./trafficCoordinates";

export type ViewMode = "digital_twin" | "lidar" | "cctv";

export class TrafficScene3D {
  scene: THREE.Scene;
  sunLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  streetLights: THREE.PointLight[] = [];
  signalLights: Map<
    Approach,
    { red: THREE.Mesh; amber: THREE.Mesh; green: THREE.Mesh; pointLight: THREE.PointLight }
  > = new Map();

  // Grupos dinámicos
  vehiclesGroup: THREE.Group;
  pedestriansGroup: THREE.Group;
  yoloBoxesGroup: THREE.Group;
  rainParticles: THREE.Points | null = null;
  lidarPoints: THREE.Points | null = null;
  worldMeshGroup: THREE.Group;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);

    // 1. Iluminación Ambiental y Solar
    this.hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 1.2);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffedd5, 2.2);
    this.sunLight.position.set(40, 65, 40);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 160;
    this.sunLight.shadow.camera.left = -50;
    this.sunLight.shadow.camera.right = 50;
    this.sunLight.shadow.camera.top = 50;
    this.sunLight.shadow.camera.bottom = -50;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    this.worldMeshGroup = new THREE.Group();
    this.scene.add(this.worldMeshGroup);

    this.vehiclesGroup = new THREE.Group();
    this.scene.add(this.vehiclesGroup);

    this.pedestriansGroup = new THREE.Group();
    this.scene.add(this.pedestriansGroup);

    this.yoloBoxesGroup = new THREE.Group();
    this.scene.add(this.yoloBoxesGroup);

    // 2. Construir Geometría Estática del Cruce de Caseros
    this.buildRoadsAndMarkings();
    this.buildSidewalksAndBuildings();
    this.buildTrafficSignals();
    this.buildRainSystem();
    this.buildLidarPointCloud();
  }

  /* ------------------------------------------------------------------ */
  /* Calzadas y Señalización Vial Horizontal                            */
  /* ------------------------------------------------------------------ */

  private buildRoadsAndMarkings() {
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: 0x22262c,
      roughness: 0.88,
      metalness: 0.08,
    });

    // Plano general de asfalto
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), asphaltMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.worldMeshGroup.add(ground);

    const lineYellowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const lineWhiteMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });

    // Av. San Martín (NW - SE): Doble línea amarilla
    const smCenter = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 120), lineYellowMat);
    smCenter.rotation.x = -Math.PI / 2;
    smCenter.rotation.z = Math.PI / 4;
    smCenter.position.y = 0.02;
    this.worldMeshGroup.add(smCenter);

    // Calle Urquiza (SW - NE): Doble línea amarilla
    const uqCenter = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 120), lineYellowMat);
    uqCenter.rotation.x = -Math.PI / 2;
    uqCenter.rotation.z = -Math.PI / 4;
    uqCenter.position.y = 0.02;
    this.worldMeshGroup.add(uqCenter);

    // Sendas Peatonales (Cebras Blancas) en las 4 aproximaciones
    const zebraMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9 });
    const createZebraCrossing = (dist: number, angleRad: number) => {
      const g = new THREE.Group();
      const numStripes = 8;
      for (let i = 0; i < numStripes; i++) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 3.8), zebraMat);
        stripe.position.set((i - (numStripes - 1) / 2) * 1.1, 0, 0);
        g.add(stripe);
      }
      g.rotation.x = -Math.PI / 2;
      g.rotation.z = angleRad;
      g.position.set(dist * Math.cos(angleRad), 0.03, dist * Math.sin(angleRad));
      this.worldMeshGroup.add(g);
    };

    createZebraCrossing(14.0, Math.PI / 4); // Senda San Martín SE
    createZebraCrossing(-14.0, Math.PI / 4); // Senda San Martín NW
    createZebraCrossing(14.0, -Math.PI / 4); // Senda Urquiza NE
    createZebraCrossing(-14.0, -Math.PI / 4); // Senda Urquiza SW
  }

  /* ------------------------------------------------------------------ */
  /* Veredas Elevadas, Edificios de Caseros y Alumbrado Público         */
  /* ------------------------------------------------------------------ */

  private buildSidewalksAndBuildings() {
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.7,
    });

    const buildingMat1 = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.8 }); // Ladrillo visto
    const buildingMat2 = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 }); // Cemento moderno
    const windowMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.65,
    });

    // 4 Esquinas Urbanas
    const corners = [
      { x: -28, z: -28, rot: 0, mat: buildingMat1, h: 14 },
      { x: 28, z: 28, rot: Math.PI, mat: buildingMat2, h: 18 },
      { x: -28, z: 28, rot: -Math.PI / 2, mat: buildingMat2, h: 12 },
      { x: 28, z: -28, rot: Math.PI / 2, mat: buildingMat1, h: 16 },
    ];

    corners.forEach((c) => {
      // Vereda de la esquina
      const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(26, 0.25, 26), sidewalkMat);
      sidewalk.position.set(c.x, 0.125, c.z);
      sidewalk.receiveShadow = true;
      this.worldMeshGroup.add(sidewalk);

      // Edificio
      const bldg = new THREE.Mesh(new THREE.BoxGeometry(22, c.h, 22), c.mat);
      bldg.position.set(c.x, c.h / 2 + 0.25, c.z);
      bldg.castShadow = true;
      bldg.receiveShadow = true;
      this.worldMeshGroup.add(bldg);

      // Ventanas iluminadas en el edificio
      for (let floor = 1; floor < c.h / 3; floor++) {
        for (let w = -2; w <= 2; w++) {
          const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), windowMat);
          win.position.set(c.x + w * 3.5, floor * 3.2, c.z + (c.z > 0 ? -11.05 : 11.05));
          if (c.z > 0) win.rotation.y = Math.PI;
          this.worldMeshGroup.add(win);
        }
      }

      // Farola de Alumbrado Público en la vereda
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 6.5, 8), MAT_SL_POLE);
      pole.position.set(c.x * 0.45, 3.25, c.z * 0.45);
      pole.castShadow = true;
      this.worldMeshGroup.add(pole);

      const lampLight = new THREE.PointLight(0xfef08a, 1.8, 28, 1.4);
      lampLight.position.set(c.x * 0.45, 6.6, c.z * 0.45);
      this.streetLights.push(lampLight);
      this.worldMeshGroup.add(lampLight);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Semáforos Inteligentes 3D con Ópticas LED Reales                   */
  /* ------------------------------------------------------------------ */

  private buildTrafficSignals() {
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.7,
      roughness: 0.3,
    });

    SIGNAL_POLES_3D.forEach((sp) => {
      const g = new THREE.Group();
      g.position.copy(sp.position);
      g.rotation.y = sp.rotationY;

      // Columna vertical
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 7.2, 12), poleMat);
      col.position.y = 3.6;
      col.castShadow = true;
      g.add(col);

      // Brazo horizontal hacia la calzada
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 4.8, 8), poleMat);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(2.4, 6.8, 0);
      g.add(arm);

      // Cabezal del semáforo
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.8, 0.5), poleMat);
      head.position.set(4.5, 6.2, 0);
      head.castShadow = true;
      g.add(head);

      // Ópticas LED (Rojo, Amarillo, Verde)
      const redMat = new THREE.MeshBasicMaterial({ color: 0x450a0a });
      const amberMat = new THREE.MeshBasicMaterial({ color: 0x451a03 });
      const greenMat = new THREE.MeshBasicMaterial({ color: 0x022c22 });

      const lensGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16);
      lensGeom.rotateX(Math.PI / 2);

      const redLens = new THREE.Mesh(lensGeom, redMat);
      redLens.position.set(4.5, 6.7, 0.26);
      g.add(redLens);

      const amberLens = new THREE.Mesh(lensGeom, amberMat);
      amberLens.position.set(4.5, 6.2, 0.26);
      g.add(amberLens);

      const greenLens = new THREE.Mesh(lensGeom, greenMat);
      greenLens.position.set(4.5, 5.7, 0.26);
      g.add(greenLens);

      // Luz de Punto de Semáforo
      const pointLight = new THREE.PointLight(0xef4444, 2.5, 12);
      pointLight.position.set(4.5, 6.2, 0.8);
      g.add(pointLight);

      this.worldMeshGroup.add(g);

      this.signalLights.set(sp.approach, {
        red: redLens,
        amber: amberLens,
        green: greenLens,
        pointLight,
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Sistema de Lluvia en Partículas 3D                                 */
  /* ------------------------------------------------------------------ */

  private buildRainSystem() {
    const rainCount = 2500;
    const rainGeom = new THREE.BufferGeometry();
    const positions = new Float32Array(rainCount * 3);

    for (let i = 0; i < rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = Math.random() * 45;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }

    rainGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.25,
      transparent: true,
      opacity: 0.6,
    });

    this.rainParticles = new THREE.Points(rainGeom, rainMat);
    this.rainParticles.visible = false;
    this.scene.add(this.rainParticles);
  }

  /* ------------------------------------------------------------------ */
  /* Modo LiDAR Point Cloud / Red Neuronal YOLOv11                      */
  /* ------------------------------------------------------------------ */

  private buildLidarPointCloud() {
    const pointCount = 35000;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(pointCount * 3);
    const colors = new Float32Array(pointCount * 3);

    const cRoad = new THREE.Color(0x10b981); // Verde neón
    const cBldg = new THREE.Color(0x0284c7); // Azul cian
    const cEdge = new THREE.Color(0xec4899); // Magenta

    for (let i = 0; i < pointCount; i++) {
      const x = (Math.random() - 0.5) * 90;
      const z = (Math.random() - 0.5) * 90;
      let y = 0.05 + Math.random() * 0.2;
      let c = cRoad;

      // Si está en el área de edificios
      if (Math.abs(x) > 14 && Math.abs(z) > 14) {
        y = Math.random() * 16;
        c = Math.random() > 0.8 ? cEdge : cBldg;
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });

    this.lidarPoints = new THREE.Points(geom, mat);
    this.lidarPoints.visible = false;
    this.scene.add(this.lidarPoints);
  }

  /* ------------------------------------------------------------------ */
  /* Actualización en Cada Fotograma (Update Loop)                      */
  /* ------------------------------------------------------------------ */

  update(engine: TrafficEngine, deltaSec: number, viewMode: ViewMode) {
    const nowMs = performance.now();

    // 1. Alternar Modo de Visualización (Digital Twin vs. LiDAR)
    const isLidar = viewMode === "lidar";
    if (this.lidarPoints) this.lidarPoints.visible = isLidar;
    this.worldMeshGroup.visible = !isLidar;

    // 2. Ciclo Solar y Horario (Día / Tarde / Noche)
    const hour = engine.hour;
    const isNight = engine.night || hour < 6.5 || hour > 19.5;

    if (isNight) {
      this.scene.background = new THREE.Color(0x030712);
      this.hemiLight.intensity = 0.25;
      this.sunLight.intensity = 0.1;
      this.streetLights.forEach((l) => (l.intensity = 2.4));
    } else {
      this.scene.background = new THREE.Color(0x0f172a);
      this.hemiLight.intensity = 1.2;
      this.sunLight.intensity = 2.2;
      this.streetLights.forEach((l) => (l.intensity = 0));
    }

    // 3. Clima y Niebla
    if (engine.weather === "fog") {
      this.scene.fog = new THREE.FogExp2(0x94a3b8, 0.028);
    } else if (engine.weather === "rain") {
      this.scene.fog = new THREE.FogExp2(0x475569, 0.015);
    } else {
      this.scene.fog = null;
    }

    // 4. Lluvia de Partículas
    if (this.rainParticles) {
      this.rainParticles.visible = engine.weather === "rain" && !isLidar;
      if (this.rainParticles.visible) {
        const positions = this.rainParticles.geometry.attributes.position.array as Float32Array;
        for (let i = 1; i < positions.length; i += 3) {
          positions[i] -= 48 * deltaSec;
          if (positions[i] < 0) positions[i] = 45;
        }
        this.rainParticles.geometry.attributes.position.needsUpdate = true;
      }
    }

    // 5. Semáforos Inteligentes
    SIGNAL_POLES_3D.forEach((sp) => {
      const lights = this.signalLights.get(sp.approach);
      if (!lights) return;

      const state = engine.signalFor(sp.approach);
      const isRed = state === "red";
      const isAmber = state === "amber";
      const isGreen = state === "green";

      (lights.red.material as THREE.MeshBasicMaterial).color.setHex(isRed ? 0xef4444 : 0x350808);
      (lights.amber.material as THREE.MeshBasicMaterial).color.setHex(
        isAmber ? 0xf59e0b : 0x381702,
      );
      (lights.green.material as THREE.MeshBasicMaterial).color.setHex(
        isGreen ? 0x10b981 : 0x012015,
      );

      if (isRed) {
        lights.pointLight.color.setHex(0xef4444);
        lights.pointLight.intensity = 2.5;
      } else if (isAmber) {
        lights.pointLight.color.setHex(0xf59e0b);
        lights.pointLight.intensity = 2.0;
      } else {
        lights.pointLight.color.setHex(0x10b981);
        lights.pointLight.intensity = 2.8;
      }
    });

    // 6. Sincronización de Vehículos 3D
    // Limpiar grupo de vehículos
    while (this.vehiclesGroup.children.length > 0) {
      this.vehiclesGroup.remove(this.vehiclesGroup.children[0]!);
    }

    engine.vehicles.forEach((v) => {
      let vMesh: THREE.Group;
      if (v.kind === "bus") vMesh = Vehicle3DFactory.createBus(v);
      else if (v.kind === "ambulance") vMesh = Vehicle3DFactory.createAmbulance(v);
      else if (v.kind === "moto") vMesh = Vehicle3DFactory.createMoto(v);
      else vMesh = Vehicle3DFactory.createSedan(v);

      const t = getVehicleTransform3D(v.approach, v.p);
      vMesh.position.copy(t.position);
      vMesh.rotation.y = t.rotationY;

      // Luces de freno si el vehículo está detenido o frenando
      const isBraking = v.speed < 2 && !v.crossed;
      const tlL = vMesh.getObjectByName("taillight-left") as THREE.Mesh | undefined;
      const tlR = vMesh.getObjectByName("taillight-right") as THREE.Mesh | undefined;
      if (tlL && tlR) {
        (tlL.material as THREE.MeshBasicMaterial).color.setHex(isBraking ? 0xef4444 : 0x7f1d1d);
        (tlR.material as THREE.MeshBasicMaterial).color.setHex(isBraking ? 0xef4444 : 0x7f1d1d);
      }

      // Balizas SAME 3F destellantes
      if (v.kind === "ambulance") {
        const strobeLight = vMesh.getObjectByName("strobe-light") as THREE.PointLight | undefined;
        const phase = Math.floor(nowMs / 120) % 2 === 0;
        if (strobeLight) {
          strobeLight.color.setHex(phase ? 0xef4444 : 0x3b82f6);
          strobeLight.intensity = 6.0;
        }
      }

      this.vehiclesGroup.add(vMesh);
    });

    // 7. Sincronización de Peatones 3D
    while (this.pedestriansGroup.children.length > 0) {
      this.pedestriansGroup.remove(this.pedestriansGroup.children[0]!);
    }

    engine.pedestrians.forEach((p) => {
      const pMesh = Vehicle3DFactory.createPedestrian(p);
      const t = getPedestrianTransform3D(p.crossAxis, p.side, p.p);
      pMesh.position.copy(t.position);
      pMesh.rotation.y = t.rotationY;

      // Animación de piernas
      if (!p.waiting && !p.reduced) {
        const gait = Math.sin(nowMs / 120 + p.id * 3) * 0.4;
        const legL = pMesh.getObjectByName("leg-left");
        const legR = pMesh.getObjectByName("leg-right");
        if (legL && legR) {
          legL.rotation.x = gait;
          legR.rotation.x = -gait;
        }
      }

      this.pedestriansGroup.add(pMesh);
    });
  }
}

const MAT_SL_POLE = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 });
