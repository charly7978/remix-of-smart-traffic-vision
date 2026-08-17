/**
 * Fábrica de Modelos 3D Procedurales de Alta Fidelidad para el Gemelo Digital de Caseros.
 * Proyecto Carlos Ameghino — Municipalidad de Tres de Febrero.
 *
 * Genera mallas 3D completas con materiales PBR estándar, sombras dinámicas,
 * faros LED interactivos, libreas bonaerenses oficiales (Línea 343 y 181),
 * balizas SAME 3F con destellos volumétricos y peatones 3D articulados.
 */

import * as THREE from "three";
import { type Vehicle, type Pedestrian } from "@/lib/traffic/engine";

/* ------------------------------------------------------------------ */
/* Paleta de Materiales PBR Reutilizables                              */
/* ------------------------------------------------------------------ */

const MAT = {
  rubber: new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.9,
    metalness: 0.1,
  }),
  rim: new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.3,
    metalness: 0.8,
  }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.1,
    metalness: 0.9,
    transparent: true,
    opacity: 0.75,
  }),
  headlightOn: new THREE.MeshBasicMaterial({ color: 0xfffbeb }),
  headlightOff: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.2 }),
  taillightNormal: new THREE.MeshBasicMaterial({ color: 0x991b1b }),
  taillightBraking: new THREE.MeshBasicMaterial({ color: 0xef4444 }),
  amberLed: new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.1, metalness: 0.95 }),
  darkPlastic: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 }),
};

/* ------------------------------------------------------------------ */
/* Fábrica de Vehículos 3D                                             */
/* ------------------------------------------------------------------ */

export class Vehicle3DFactory {
  /** Crea un Sedán / SUV 3D detallado */
  static createSedan(v: Vehicle): THREE.Group {
    const group = new THREE.Group();
    group.name = `vehicle-${v.id}`;

    const carColor = v.color ? new THREE.Color(v.color) : new THREE.Color(0x2563eb);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: carColor,
      roughness: 0.25,
      metalness: 0.65,
    });

    // 1. Chasis Inferior (Largo: 4.4m, Ancho: 1.85m, Alto: 0.65m)
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.65, 4.4), bodyMat);
    lowerBody.position.y = 0.55;
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    group.add(lowerBody);

    // 2. Cabina Superior Inclinada (Largo: 2.3m, Ancho: 1.55m, Alto: 0.65m)
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.65, 2.3), bodyMat);
    cabin.position.set(0, 1.15, -0.2);
    cabin.castShadow = true;
    cabin.receiveShadow = true;
    group.add(cabin);

    // 3. Parabrisas Delantero y Trasero (Vidrio)
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.55, 0.8), MAT.glass);
    windshield.position.set(0, 1.15, 0.85);
    windshield.rotation.x = -Math.PI / 6;
    group.add(windshield);

    const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.55, 0.8), MAT.glass);
    rearWindow.position.set(0, 1.15, -1.2);
    rearWindow.rotation.x = Math.PI / 6;
    group.add(rearWindow);

    // 4. Parrilla Delantera y Paragolpes
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.1), MAT.darkPlastic);
    grille.position.set(0, 0.5, 2.21);
    group.add(grille);

    // 5. Faros Delanteros LED
    const hlGeom = new THREE.BoxGeometry(0.35, 0.18, 0.08);
    const hlLeft = new THREE.Mesh(hlGeom, MAT.headlightOn);
    hlLeft.position.set(-0.65, 0.6, 2.21);
    group.add(hlLeft);

    const hlRight = new THREE.Mesh(hlGeom, MAT.headlightOn);
    hlRight.position.set(0.65, 0.6, 2.21);
    group.add(hlRight);

    // 6. Luces Traseras de Frenado
    const tlLeft = new THREE.Mesh(hlGeom, MAT.taillightNormal);
    tlLeft.name = "taillight-left";
    tlLeft.position.set(-0.65, 0.6, -2.21);
    group.add(tlLeft);

    const tlRight = new THREE.Mesh(hlGeom, MAT.taillightNormal);
    tlRight.name = "taillight-right";
    tlRight.position.set(0.65, 0.6, -2.21);
    group.add(tlRight);

    // 7. Ruedas 3D con Llantas de Aleación
    const wheelPositions = [
      [-0.95, 0.35, 1.3],
      [0.95, 0.35, 1.3],
      [-0.95, 0.35, -1.3],
      [0.95, 0.35, -1.3],
    ];

    const wheelGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16);
    wheelGeom.rotateZ(Math.PI / 2);

    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeom, MAT.rubber);
      wheel.position.set(wx, wy, wz);
      wheel.castShadow = true;
      group.add(wheel);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.26, 8), MAT.rim);
      rim.rotateZ(Math.PI / 2);
      rim.position.set(wx, wy, wz);
      group.add(rim);
    });

    return group;
  }

  /** Crea un Colectivo Bonaerense 3D (Línea 343 Caseros / Línea 181) */
  static createBus(v: Vehicle): THREE.Group {
    const group = new THREE.Group();
    group.name = `bus-${v.id}`;

    const isLine343 = v.id % 2 === 0;
    // Línea 343: Azul marino profundo + franjas rojas. Línea 181: Rojo + blanco
    const primaryColor = isLine343 ? 0x0f2b5c : 0xb91c1c;
    const stripeColor = isLine343 ? 0xe11d48 : 0xf8fafc;

    const busBodyMat = new THREE.MeshStandardMaterial({
      color: primaryColor,
      roughness: 0.3,
      metalness: 0.5,
    });

    const stripeMat = new THREE.MeshStandardMaterial({
      color: stripeColor,
      roughness: 0.4,
      metalness: 0.3,
    });

    // 1. Carrocería Principal del Colectivo (Largo: 10.5m, Ancho: 2.5m, Alto: 2.9m)
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.9, 10.5), busBodyMat);
    body.position.y = 1.75;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 2. Franja Lateral Distintiva
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.45, 10.52), stripeMat);
    stripe.position.y = 1.45;
    group.add(stripe);

    // 3. Ventanillas Laterales Iluminadas (6 por lateral)
    const winMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.85,
    });
    for (let i = 0; i < 5; i++) {
      const zPos = -3.2 + i * 1.6;
      // Ventanilla izquierda
      const wL = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.85), winMat);
      wL.position.set(-1.26, 2.1, zPos);
      wL.rotation.y = -Math.PI / 2;
      group.add(wL);

      // Ventanilla derecha
      const wR = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.85), winMat);
      wR.position.set(1.26, 2.1, zPos);
      wR.rotation.y = Math.PI / 2;
      group.add(wR);
    }

    // 4. Parabrisas Frontal Panorámico
    const frontWindshield = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.2), MAT.glass);
    frontWindshield.position.set(0, 2.1, 5.26);
    group.add(frontWindshield);

    // 5. Cartelera LED Frontal Luminosa (343 CASEROS / 181 R.MEJIA)
    const marqueeGeom = new THREE.BoxGeometry(1.8, 0.35, 0.1);
    const marquee = new THREE.Mesh(marqueeGeom, MAT.amberLed);
    marquee.position.set(0, 2.95, 5.26);
    group.add(marquee);

    // 6. Equipos de Aire Acondicionado en el Techo
    const acUnit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 2.2), MAT.chrome);
    acUnit.position.set(0, 3.35, 0.5);
    acUnit.castShadow = true;
    group.add(acUnit);

    // 7. Ruedas de Colectivo (6 ruedas de servicio pesado)
    const busWheelGeom = new THREE.CylinderGeometry(0.48, 0.48, 0.32, 18);
    busWheelGeom.rotateZ(Math.PI / 2);

    const busWheelPositions = [
      [-1.28, 0.48, 3.6],
      [1.28, 0.48, 3.6],
      [-1.28, 0.48, -2.8],
      [1.28, 0.48, -2.8],
      [-1.28, 0.48, -3.9],
      [1.28, 0.48, -3.9],
    ];

    busWheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(busWheelGeom, MAT.rubber);
      wheel.position.set(wx, wy, wz);
      wheel.castShadow = true;
      group.add(wheel);
    });

    // 8. Faros Delanteros y Traseros
    const hlGeom = new THREE.BoxGeometry(0.4, 0.25, 0.1);
    const hlL = new THREE.Mesh(hlGeom, MAT.headlightOn);
    hlL.position.set(-0.9, 0.85, 5.26);
    group.add(hlL);

    const hlR = new THREE.Mesh(hlGeom, MAT.headlightOn);
    hlR.position.set(0.9, 0.85, 5.26);
    group.add(hlR);

    return group;
  }

  /** Crea una Ambulancia SAME 3F (Mercedes Sprinter / Renault Master 3D) */
  static createAmbulance(v: Vehicle): THREE.Group {
    const group = new THREE.Group();
    group.name = `ambulance-${v.id}`;

    const ambBodyMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.2,
      metalness: 0.4,
    });

    const chevronMat = new THREE.MeshStandardMaterial({
      color: 0x10b981, // Verde SAME Tres de Febrero
      roughness: 0.3,
    });

    // 1. Carrocería Furgón Techo Alto (Largo: 5.9m, Ancho: 2.1m, Alto: 2.6m)
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.2, 5.9), ambBodyMat);
    body.position.y = 1.4;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 2. Gráfica Chevron Verde Flúor en los Laterales
    const chevron = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.45, 5.92), chevronMat);
    chevron.position.y = 1.3;
    group.add(chevron);

    // 3. Parabrisas y Cabina Delantera
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), MAT.glass);
    windshield.position.set(0, 1.8, 2.96);
    group.add(windshield);

    // 4. Baliza Estroboscópica LED en el Techo (Doble Domo Rojo y Azul)
    const lightbarBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 0.4), MAT.darkPlastic);
    lightbarBase.position.set(0, 2.58, 1.8);
    group.add(lightbarBase);

    const strobeRed = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.2, 0.35),
      new THREE.MeshBasicMaterial({ color: 0xef4444 }),
    );
    strobeRed.name = "strobe-red";
    strobeRed.position.set(-0.35, 2.7, 1.8);
    group.add(strobeRed);

    const strobeBlue = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.2, 0.35),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6 }),
    );
    strobeBlue.name = "strobe-blue";
    strobeBlue.position.set(0.35, 2.7, 1.8);
    group.add(strobeBlue);

    // Luz de Punto Estroboscópica Dinámica
    const strobeLight = new THREE.PointLight(0xef4444, 4.0, 25);
    strobeLight.name = "strobe-light";
    strobeLight.position.set(0, 3.2, 1.8);
    group.add(strobeLight);

    // 5. Ruedas
    const wheelGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.28, 16);
    wheelGeom.rotateZ(Math.PI / 2);
    [
      [-1.08, 0.4, 1.8],
      [1.08, 0.4, 1.8],
      [-1.08, 0.4, -1.8],
      [1.08, 0.4, -1.8],
    ].forEach(([wx, wy, wz]) => {
      const w = new THREE.Mesh(wheelGeom, MAT.rubber);
      w.position.set(wx, wy, wz);
      w.castShadow = true;
      group.add(w);
    });

    return group;
  }

  /** Crea una Moto con Repartidor 3D */
  static createMoto(v: Vehicle): THREE.Group {
    const group = new THREE.Group();
    group.name = `moto-${v.id}`;

    // Chasis de la moto
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 2.2), MAT.darkPlastic);
    frame.position.y = 0.5;
    frame.castShadow = true;
    group.add(frame);

    // Ruedas delantera y trasera
    const wheelGeom = new THREE.CylinderGeometry(0.32, 0.32, 0.12, 16);
    wheelGeom.rotateZ(Math.PI / 2);
    const fw = new THREE.Mesh(wheelGeom, MAT.rubber);
    fw.position.set(0, 0.32, 0.85);
    group.add(fw);

    const rw = new THREE.Mesh(wheelGeom, MAT.rubber);
    rw.position.set(0, 0.32, -0.85);
    group.add(rw);

    // Conductor (Cuerpo y Casco)
    const riderBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.7, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x334155 }),
    );
    riderBody.position.set(0, 1.1, -0.1);
    group.add(riderBody);

    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc }),
    );
    helmet.position.set(0, 1.6, -0.1);
    group.add(helmet);

    // Mochila térmica de delivery (Rappi / PedidosYa)
    const bagMat = new THREE.MeshStandardMaterial({ color: v.id % 2 === 0 ? 0xdc2626 : 0xea580c });
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.45), bagMat);
    bag.position.set(0, 1.1, -0.55);
    group.add(bag);

    // Faro delantero
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.1), MAT.headlightOn);
    hl.position.set(0, 0.75, 1.1);
    group.add(hl);

    return group;
  }

  /** Crea un Peatón 3D o Persona en Silla de Ruedas */
  static createPedestrian(p: Pedestrian): THREE.Group {
    const group = new THREE.Group();
    group.name = `pedestrian-${p.id}`;

    if (p.reduced) {
      // Silla de Ruedas 3D
      const chairFrame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.8), MAT.chrome);
      chairFrame.position.y = 0.5;
      group.add(chairFrame);

      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.1, 0.7),
        new THREE.MeshStandardMaterial({ color: 0x0284c7 }),
      );
      seat.position.set(0, 0.55, 0);
      group.add(seat);

      // Ruedas grandes de la silla
      const wGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 16);
      wGeom.rotateZ(Math.PI / 2);
      const wL = new THREE.Mesh(wGeom, MAT.rubber);
      wL.position.set(-0.45, 0.35, 0);
      group.add(wL);

      const wR = new THREE.Mesh(wGeom, MAT.rubber);
      wR.position.set(0.45, 0.35, 0);
      group.add(wR);

      // Ciudadano sentado
      const torso = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.55, 0.35),
        new THREE.MeshStandardMaterial({ color: 0x64748b }),
      );
      torso.position.set(0, 0.95, -0.1);
      group.add(torso);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xfbcfe8 }),
      );
      head.position.set(0, 1.35, -0.1);
      group.add(head);
    } else {
      // Peatón Estándar con Ropa y Animación de Marcha
      const shirtColor = p.id % 2 === 0 ? 0xdc2626 : 0x2563eb;
      const torso = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.65, 0.3),
        new THREE.MeshStandardMaterial({ color: shirtColor }),
      );
      torso.position.y = 1.05;
      torso.castShadow = true;
      group.add(torso);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xfed7aa }),
      );
      head.position.y = 1.55;
      group.add(head);

      // Piernas
      const legGeom = new THREE.BoxGeometry(0.16, 0.7, 0.18);
      const legL = new THREE.Mesh(legGeom, new THREE.MeshStandardMaterial({ color: 0x1e293b }));
      legL.name = "leg-left";
      legL.position.set(-0.14, 0.35, 0);
      group.add(legL);

      const legR = new THREE.Mesh(legGeom, new THREE.MeshStandardMaterial({ color: 0x1e293b }));
      legR.name = "leg-right";
      legR.position.set(0.14, 0.35, 0);
      group.add(legR);
    }

    return group;
  }
}
