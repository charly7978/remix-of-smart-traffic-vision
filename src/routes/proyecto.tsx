import { Link, createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const Route = createFileRoute("/proyecto")({
  head: () => ({
    meta: [
      { title: "Plan de Implementación — Ameghino AI" },
      {
        name: "description",
        content:
          "Arquitectura técnica, costos, marco legal (DNDA / INPI), estrategia institucional y hoja de ruta del Sistema Integral de Semaforización Inteligente de Carlos Ameghino.",
      },
      { property: "og:title", content: "Plan de Implementación — Ameghino AI" },
      {
        property: "og:description",
        content:
          "Hardware, algoritmos, costos por intersección, protección intelectual y hoja de ruta para la prueba piloto en Caseros.",
      },
    ],
  }),
  component: ProyectoPage,
});

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="border-t border-border py-16 first:border-t-0 first:pt-0">
      <p className="font-mono text-xs tracking-[0.3em] text-signal-green uppercase">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="bg-secondary/60">
            {head.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left font-mono text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-card">
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-4 py-3 align-top leading-relaxed ${
                    j === 0 ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PYTHON_CODE = `# Detección de objetos + control de hardware (prototipo Ameghino AI)
import cv2
from ultralytics import YOLO
import RPi.GPIO as GPIO          # Raspberry Pi
import time

# Pines GPIO para los relés del semáforo
RED_PIN, YELLOW_PIN, GREEN_PIN = 18, 23, 24

GPIO.setmode(GPIO.BCM)
for pin in (RED_PIN, YELLOW_PIN, GREEN_PIN):
    GPIO.setup(pin, GPIO.OUT)

# Modelo YOLOv11 entrenado para tránsito urbano
model = YOLO("yolo11n.pt")
CLASSES = [2, 3, 5, 7]           # auto, moto, colectivo, camión (COCO)

def gestionar_trafico(source=0):
    cap = cv2.VideoCapture(source)

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Inferencia de IA en el borde
        results = model(frame, classes=CLASSES)[0]
        vehiculos = len(results.boxes)

        # Lógica Ameghino: densidad alta -> priorizar verde
        if vehiculos > 5:
            print(f"Densidad alta: {vehiculos} vehículos. Verde.")
            GPIO.output(RED_PIN, GPIO.LOW)
            GPIO.output(GREEN_PIN, GPIO.HIGH)
        else:
            # Lógica de eficiencia / seguridad nocturna
            print("Densidad baja. Evaluando cruce despejado.")

        cv2.imshow("Ameghino AI Traffic Monitor", results.plot())
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    GPIO.cleanup()

if __name__ == "__main__":
    gestionar_trafico()`;

const ROADMAP = [
  {
    fase: "Fase 1",
    title: "Producto Mínimo Viable",
    items: [
      "Mes 1 — Ensamblaje del hardware (Jetson / Raspberry Pi + cámara IP) y pruebas de laboratorio con YOLO.",
      "Mes 2 — Simulación de interfaz con controladores industriales. Modelo a escala con LEDs para demostraciones.",
      "Mes 3 — Registro de propiedad intelectual en DNDA e INPI.",
    ],
  },
  {
    fase: "Fase 2",
    title: "Gestión y cabildeo gubernamental",
    items: [
      "Mes 4 — Oficios a la Intendencia de Tres de Febrero y al Ministerio de Transporte provincial.",
      "Mes 5 — Financiamiento y asociaciones público-privadas. Club de Emprendedores de Tres de Febrero.",
    ],
  },
  {
    fase: "Fase 3",
    title: "Prueba piloto en vía pública",
    items: [
      "Meses 6–8 — Instalación supervisada en una intersección crítica de Caseros. Ajuste del algoritmo nocturno.",
      "Mes 12 — Evaluación de resultados: siniestralidad, tiempos de espera, feedback vecinal. Plan de escalado.",
    ],
  },
];

function ProyectoPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <p className="font-mono text-xs tracking-[0.3em] text-signal-green uppercase">
        Plan Integral de Transformación Urbana y Seguridad Vial
      </p>
      <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
        Plan de implementación del Sistema Ameghino AI
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Arquitectura técnica, factibilidad económica, protección de la propiedad intelectual y
        estrategia de inserción institucional para llevar la prueba piloto a una intersección de
        Caseros.
      </p>

      <div className="mt-14 flex flex-col gap-0">
        <Section id="arquitectura" eyebrow="Arquitectura técnica" title="Hardware por intersección">
          <DataTable
            head={["Componente", "Especificación recomendada", "Función crítica"]}
            rows={[
              [
                "Procesador de IA",
                "NVIDIA Jetson Nano / Orin Nano",
                "Ejecución de modelos YOLO para detección múltiple de objetos en tiempo real.",
              ],
              [
                "Microcontrolador",
                "Raspberry Pi 4 / 5",
                "Lógica de control, telemetría y comunicación con el controlador de semáforo.",
              ],
              [
                "Cámara de visión",
                "IP 4MP con WDR y visión nocturna",
                "Captura con alta fidelidad en contraluz y oscuridad.",
              ],
              [
                "Interfaz de potencia",
                "Módulo de relés optoacoplados",
                "Accionamiento físico de las lámparas LED del semáforo.",
              ],
              [
                "Conectividad",
                "Módem industrial 4G/5G / fibra óptica",
                "Enlace con el Centro de Monitoreo y actualización remota de algoritmos.",
              ],
            ]}
          />
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            La integración con controladores Autotrol / Teknotrans se realiza vía protocolo NTCIP:
            la unidad de IA actúa como supervisor de demanda y nunca anula las protecciones de
            hardware que impiden estados de conflicto (verdes simultáneos).
          </p>
        </Section>

        <Section id="algoritmo" eyebrow="Inteligencia artificial" title="Detección y decisión">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-mono text-[11px] font-semibold tracking-[0.25em] text-muted-foreground uppercase">
                Tiempo de verde dinámico
              </h3>
              <div className="mt-4 rounded-lg bg-secondary/60 p-4 font-mono text-sm leading-loose text-foreground">
                <p>σ = Σ Vᵢ / A</p>
                <p className="text-signal-green">T_v = max(T_seg, min(T_max, β · σ))</p>
              </div>
              <ul className="mt-4 flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
                <li>
                  <span className="text-foreground">σ</span> — densidad vehicular: unidades de
                  transporte detectadas sobre el área de influencia de la cámara.
                </li>
                <li>
                  <span className="text-foreground">T_seg</span> — mínimo de seguridad peatonal.
                </li>
                <li>
                  <span className="text-foreground">β</span> — factor de ponderación según la
                  jerarquía de la calle.
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-mono text-[11px] font-semibold tracking-[0.25em] text-muted-foreground uppercase">
                Clasificación en tiempo real (YOLOv11)
              </h3>
              <ul className="mt-4 flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
                <li>
                  <span className="text-foreground">Vehículos:</span> conteo de autos, camiones y
                  motos para calcular la densidad de flujo (confianza ≥ 90%).
                </li>
                <li>
                  <span className="text-foreground">Emergencias:</span> reconocimiento de
                  ambulancias, bomberos y patrulleros para corredores automáticos.
                </li>
                <li>
                  <span className="text-foreground">Peatones:</span> detección en esquinas para
                  ajustar tiempos de cruce del eslabón más vulnerable.
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card p-5">
            <pre className="font-mono text-[12.5px] leading-relaxed text-muted-foreground">
              <code>{PYTHON_CODE}</code>
            </pre>
          </div>
        </Section>

        <Section id="costos" eyebrow="Factibilidad económica" title="Costos y referencias">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 font-mono text-[11px] font-semibold tracking-[0.25em] text-muted-foreground uppercase">
                Prueba de concepto (por intersección)
              </h3>
              <DataTable
                head={["Ítem", "Costo estimado"]}
                rows={[
                  ["Unidad de procesamiento (Edge AI)", "USD 300"],
                  ["Cámara IP 4MP", "USD 400"],
                  ["Conectividad y gabinete estanco", "USD 300"],
                  ["Ingeniería e integración", "USD 2.000"],
                  ["Total por intersección", "USD 3.000"],
                ]}
              />
            </div>
            <div>
              <h3 className="mb-3 font-mono text-[11px] font-semibold tracking-[0.25em] text-muted-foreground uppercase">
                Referencias de licitaciones (2024–2026)
              </h3>
              <DataTable
                head={["Ubicación", "Alcance", "Presupuesto"]}
                rows={[
                  [
                    "Gran Mendoza",
                    "217 intersecciones con control dinámico",
                    "$6.731 millones",
                  ],
                  ["Rosario", "Mantenimiento e inteligencia semafórica", "$45.000 millones"],
                  ["CABA", "Señalización luminosa y sistema adaptativo", "Variable (USD)"],
                ]}
              />
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            El prototipo Ameghino cuesta USD 3.000 por intersección frente a los USD 15.000–20.000
            de soluciones corporativas llave en mano, utilizando hardware comercial y algoritmos
            abiertos.
          </p>
        </Section>

        <Section id="legal" eyebrow="Marco legal" title="Protección de la propiedad intelectual">
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">DNDA — Derecho de autor</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                El software es el componente de mayor valor. El registro en la Dirección Nacional
                del Derecho de Autor protege el código fuente y la arquitectura lógica, y fija una
                fecha cierta de autoría: base para modelos de licenciamiento o SaaS municipal.
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">INPI — Patente de invención</h3>
              <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
                <li>Requisitos: novedad absoluta, actividad inventiva y aplicación industrial.</li>
                <li>
                  El trámite demora ~5 años, pero otorga prelación desde la presentación.
                </li>
                <li>Reducción arancelaria del 50% para inventores particulares y PyMEs.</li>
              </ul>
            </article>
          </div>
        </Section>

        <Section id="agenda" eyebrow="Estrategia institucional" title="Inserción en la agenda pública">
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">
                Provincia de Buenos Aires (La Plata)
              </h3>
              <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
                <li>Mesa de Entradas de la Gobernación — oficio formal, calle 54 Nº 618.</li>
                <li>Jefatura de Asesores del Gobernador — evaluación de proyectos estratégicos.</li>
                <li>
                  Ministerio de Transporte / Subsecretaría de Seguridad Vial — homologación técnica.
                </li>
              </ul>
            </article>
            <article className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">
                Municipio de Tres de Febrero
              </h3>
              <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
                <li>Intendencia — reuniones de cercanía y recorridas territoriales.</li>
                <li>Secretaría de Atención al Vecino — canal formal de propuestas.</li>
                <li>CAV Ciudad Jardín y CAV sede Caseros — recepción y derivación técnica.</li>
              </ul>
            </article>
          </div>
          <div className="mt-4 rounded-xl border border-border bg-card p-6">
            <h3 className="font-mono text-[11px] font-semibold tracking-[0.25em] text-muted-foreground uppercase">
              Estructura de la carta de presentación
            </h3>
            <ol className="mt-4 flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>Encabezado: fecha, autoridad y cargo.</li>
              <li>
                Resumen ejecutivo: &quot;Sistema Integral de Semaforización Inteligente para la
                Seguridad y Movilidad Urbana&quot;.
              </li>
              <li>Justificación: seguridad nocturna y caos de tránsito en horas pico.</li>
              <li>Propuesta técnica: IA + cámaras de monitoreo en el borde.</li>
              <li>Llamado a la acción: audiencia técnica para demostración del prototipo.</li>
            </ol>
          </div>
        </Section>

        <Section id="normativa" eyebrow="Homologación" title="Normativa de seguridad vial">
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">Ley 24.449 y señalización</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Los equipos respetan el Sistema de Señalización Vial Uniforme y deben homologarse
                ante el INTI o la autoridad provincial, operando entre -10 °C y 50 °C y ante fallas
                eléctricas. La IA supervisa la demanda; no reemplaza la lógica de seguridad.
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">Protocolo fail-safe</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Si la cámara pierde visibilidad (niebla, vandalismo) o el algoritmo se detiene, el
                controlador retoma automáticamente su ciclo fijo pregrabado o pasa a modo
                intermitente, con alerta inmediata al centro de mantenimiento.
              </p>
            </article>
          </div>
        </Section>

        <Section id="hoja-de-ruta" eyebrow="Ejecución" title="Hoja de ruta: 12 meses">
          <div className="grid gap-4 md:grid-cols-3">
            {ROADMAP.map((f) => (
              <article key={f.fase} className="rounded-xl border border-border bg-card p-6">
                <p className="font-mono text-xs text-signal-green">{f.fase}</p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">{f.title}</h3>
                <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
                  {f.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </Section>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-8 sm:p-10">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          El prototipo lógico ya está en funcionamiento
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          El simulador web reproduce la lógica del controlador Ameghino AI: densidad, tiempos
          dinámicos, seguridad nocturna y fail-safe. Ideal para demostraciones ante funcionarios.
        </p>
        <Link
          to="/simulador"
          className="mt-6 inline-block rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85"
        >
          Abrir la demostración en vivo
        </Link>
      </div>
    </main>
  );
}