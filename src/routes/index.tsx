import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Play, Sparkles, Shield, Eye, Cpu, Landmark, ChevronRight } from "lucide-react";

import heroImg from "@/assets/hero-interseccion.jpg";
import { PitchModeModal } from "@/components/simulator/PitchModeModal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ameghino AI — Semaforización Inteligente en Caseros, Tres de Febrero" },
      {
        name: "description",
        content:
          "Proyecto Carlos Ameghino: semáforos inteligentes con visión artificial para Caseros, Tres de Febrero. Menos esperas, protección nocturna cero demora y corredores de emergencia.",
      },
      { property: "og:title", content: "Ameghino AI — Semaforización Inteligente Tres de Febrero" },
      {
        property: "og:description",
        content:
          "Semáforos que perciben, analizan y deciden en tiempo real. Del caos vehicular a la ciudad proactiva.",
      },
    ],
  }),
  component: Index,
});

const STATS = [
  { value: "-21%", label: "reconciliación directa de tiempos de espera en hora pico" },
  { value: "0,8s", label: "tiempo de respuesta para verde nocturno a demanda" },
  { value: "200 t", label: "de CO₂ evitadas por año por corredor semaforizado" },
  { value: "USD 3.000", label: "por intersección, frente a USD 18.000–25.000 corporativos" },
];

const REAL_IMAGES = [
  {
    src: "/images/caseros-3d-render.png",
    title: "Gemelo Digital 3D — Av. San Martín",
    subtitle: "Detección multiobjeto YOLOv11 en el entorno urbano de Caseros",
    tag: "RENDERIZADO 3D REALISTA",
  },
  {
    src: "/images/caseros-monitoreo.png",
    title: "Centro de Operaciones Municipal (COM 3F)",
    subtitle: "Telemetría en tiempo real de la red semafórica de Tres de Febrero",
    tag: "CONTROL MUNICIPAL",
  },
  {
    src: "/images/caseros-nocturno.png",
    title: "Protocolo Nocturno de Verde Inmediato",
    subtitle: "Cero espera para el conductor a la madrugada en Av. Alvear",
    tag: "SEGURIDAD DE MADRUGADA",
  },
  {
    src: "/images/caseros-peaton.png",
    title: "Prioridad Peatonal Adaptativa",
    subtitle: "Extensión dinámica para adultos mayores y personas con movilidad reducida",
    tag: "INCLUSIÓN Y ACCESIBILIDAD",
  },
];

const PROBLEMS = [
  {
    n: "01",
    title: "Esperas fantasma en Caseros",
    text: "El ciclo fijo no distingue la intensidad de Av. San Martín a las 8 AM de una calle desierta a las 3 AM. Conductores detenidos en rojo sin tránsito cruzado queman combustible y tiempo.",
  },
  {
    n: "02",
    title: "Zona de exposición nocturna",
    text: "De noche, el semáforo en rojo convierte al vecino en un objetivo estático vulnerable al delito. La IA detecta la aproximación vehicular y libera el verde de inmediato si el cruce está libre.",
  },
  {
    n: "03",
    title: "Emisiones y desgaste mecánico",
    text: "Cada parada innecesaria suma partículas contaminantes y ruido en zonas residenciales. Optimizar corredores es la medida más costo-efectiva para la sustentabilidad urbana.",
  },
];

const SOLUTION = [
  {
    n: "01",
    title: "Percibir",
    text: "Cámaras IP 4MP con WDR y visión nocturna alimentan redes neuronales YOLOv11 entrenadas para el entorno bonaerense: colectivos Línea 343/181, autos, motos y ambulancias del SAME.",
  },
  {
    n: "02",
    title: "Decidir",
    text: "El procesamiento en el borde (NVIDIA Orin Nano / Raspberry Pi 5) calcula la densidad vehicular en tiempo real y ajusta el verde dinámicamente: T_v = max(T_seg, min(T_max, β·σ)).",
  },
  {
    n: "03",
    title: "Actuar",
    text: "Comandos de fase vía protocolo NTCIP hacia los controladores industriales existentes, con modo fail-safe que restaura el ciclo fijo pregrabado ante cualquier eventualidad.",
  },
];

const HARDWARE = [
  "NVIDIA Jetson Orin Nano",
  "Raspberry Pi 5",
  "Cámara IP 4MP WDR",
  "YOLOv11 Edge",
  "NTCIP / RS-485",
  "4G/5G Industrial",
  "Fail-Safe Relay",
];

function Index() {
  const [isPitchOpen, setIsPitchOpen] = useState(false);
  const [selectedImg, setSelectedImg] = useState<string | null>(null);

  return (
    <main className="bg-background text-foreground">
      {/* Modal Presentación Ejecutiva */}
      <PitchModeModal
        isOpen={isPitchOpen}
        onClose={() => setIsPitchOpen(false)}
        onSelectScene={() => {}}
      />

      {/* Modal Lightbox para Imágenes */}
      {selectedImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
          onClick={() => setSelectedImg(null)}
        >
          <div className="relative max-w-5xl overflow-hidden rounded-2xl border border-border bg-card">
            <img
              src={selectedImg}
              alt="Ampliación"
              className="h-auto max-h-[85vh] w-full object-contain"
            />
            <button
              onClick={() => setSelectedImg(null)}
              className="absolute top-4 right-4 rounded-full bg-background/80 px-3 py-1 text-xs font-mono font-bold text-foreground"
            >
              CERRAR ✕
            </button>
          </div>
        </div>
      )}

      {/* Pitch Executive Top Banner */}
      <div className="bg-gradient-to-r from-signal-green/20 via-primary/20 to-signal-green/20 border-b border-signal-green/30 py-3 px-4 text-center">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-mono">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-green opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-signal-green" />
            </span>
            <span className="font-semibold text-signal-green">PRESENTACIÓN MUNICIPAL 3F:</span>
            <span className="text-muted-foreground hidden sm:inline">
              Exposición ejecutiva de 4 minutos preparada para autoridades de Tres de Febrero.
            </span>
          </div>
          <button
            onClick={() => setIsPitchOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-signal-green px-4 py-1.5 font-mono text-xs font-bold text-background transition-all hover:bg-signal-green/90 shadow-md cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>ABRIR PITCH DE PRESENTACIÓN</span>
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        <img
          src={heroImg}
          alt="Intersección nocturna de Caseros con detección vehicular por inteligencia artificial"
          width={1600}
          height={912}
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/80 to-background" />

        <div className="relative mx-auto flex max-w-6xl flex-col justify-end px-4 pt-24 pb-20 sm:pt-36">
          <div className="inline-flex items-center gap-2 rounded-full border border-signal-green/30 bg-signal-green/10 px-3.5 py-1 text-xs font-mono font-medium text-signal-green">
            <Landmark className="h-3.5 w-3.5" />
            <span>Caseros · Partido de Tres de Febrero · Buenos Aires</span>
          </div>

          <h1 className="mt-5 max-w-4xl text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Semáforos que piensan. <br />
            <span className="bg-gradient-to-r from-signal-green via-emerald-400 to-teal-300 bg-clip-text text-transparent">
              Calles que cuidan.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            El <strong>Proyecto Carlos Ameghino</strong> convierte cada esquina de Caseros en un
            agente inteligente: fluidez en hora pico sobre Av. San Martín, protección cero espera
            para el vecino de madrugada y corredor de emergencia prioritario para el SAME.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <button
              onClick={() => setIsPitchOpen(true)}
              className="flex items-center gap-2.5 rounded-xl bg-signal-green px-6 py-4 text-sm font-bold text-background transition-all hover:bg-signal-green/90 shadow-xl shadow-signal-green/20 cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Proyectar Presentación Ejecutiva</span>
            </button>

            <Link
              to="/simulador"
              className="flex items-center gap-2 rounded-xl bg-primary px-6 py-4 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 shadow-lg"
            >
              <span>Simulador 3D en Vivo</span>
              <ChevronRight className="h-4 w-4" />
            </Link>

            <Link
              to="/proyecto"
              className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-6 py-4 text-sm font-semibold text-foreground backdrop-blur transition-all hover:bg-accent"
            >
              <span>Calculadora ROI Municipal</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Metrics Bar */}
      <section className="border-b border-border bg-card/50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="p-6 sm:p-8">
              <p className="font-mono text-3xl font-extrabold text-signal-green sm:text-4xl">
                {s.value}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Visual Photorealistic Gallery */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] text-signal-green uppercase">
              Fotorrealismo & Entorno Real
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Visualización de Alto Impacto en Caseros
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Simulación de hiperrealismo del entorno urbano de Tres de Febrero, centros de
              monitoreo e interacción de inteligencia artificial.
            </p>
          </div>
          <button
            onClick={() => setIsPitchOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-signal-green/40 bg-signal-green/10 px-4 py-2 text-xs font-mono font-bold text-signal-green hover:bg-signal-green/20 transition-all cursor-pointer"
          >
            <Sparkles className="h-4 w-4" /> VER EN MODO PRESENTACIÓN
          </button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {REAL_IMAGES.map((img, i) => (
            <div
              key={i}
              onClick={() => setSelectedImg(img.src)}
              className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-signal-green/50 hover:shadow-xl"
            >
              <div className="aspect-video w-full overflow-hidden bg-muted">
                <img
                  src={img.src}
                  alt={img.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-4">
                <span className="rounded-md border border-signal-green/30 bg-signal-green/10 px-2 py-0.5 font-mono text-[10px] font-bold text-signal-green">
                  {img.tag}
                </span>
                <h3 className="mt-2.5 text-sm font-bold text-foreground group-hover:text-signal-green transition-colors">
                  {img.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{img.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Resumen Ejecutivo */}
      <section className="border-t border-border bg-card/20 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="font-mono text-xs tracking-[0.3em] text-signal-green uppercase">
            Resumen Ejecutivo Institucional
          </p>
          <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Fundamentos para las Autoridades del Municipio de Tres de Febrero
          </h2>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <article className="rounded-2xl border border-border bg-card p-7 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-signal-red/10 text-signal-red mb-4">
                <Shield className="h-5 w-5" />
              </div>
              <p className="font-mono text-xs tracking-widest text-signal-red uppercase font-semibold">
                1. El Diagnóstico
              </p>
              <h3 className="mt-2 text-lg font-bold text-foreground">Ineficiencia Estática</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                La semaforización tradicional del Conurbano opera con esquemas fijos. Esto provoca
                congestión evitable en horas pico y esperas peligrosas de madrugada que exponen a
                los vecinos de Caseros a robos o abordajes.
              </p>
            </article>

            <article className="rounded-2xl border border-border bg-card p-7 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-signal-amber/10 text-signal-amber mb-4">
                <Cpu className="h-5 w-5" />
              </div>
              <p className="font-mono text-xs tracking-widest text-signal-amber uppercase font-semibold">
                2. La Propuesta IA
              </p>
              <h3 className="mt-2 text-lg font-bold text-foreground">
                Percibir · Decidir · Actuar
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Cada esquina incorpora una unidad procesadora de borde (Jetson Orin Nano) que
                analiza la escena con cámaras WDR y actúa sobre el controlador NTCIP existente con
                validación determinista y tolerancia a fallas.
              </p>
            </article>

            <article className="rounded-2xl border border-border bg-card p-7 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-signal-green/10 text-signal-green mb-4">
                <Eye className="h-5 w-5" />
              </div>
              <p className="font-mono text-xs tracking-widest text-signal-green uppercase font-semibold">
                3. Beneficios Directos
              </p>
              <h3 className="mt-2 text-lg font-bold text-foreground">
                Retorno Social y Financiero
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>• Verde nocturno inmediato en 0,8s sin tránsito cruzado.</li>
                <li>• Prioridad de ola verde para ambulancias del SAME 3F.</li>
                <li>• Reducción de emisiones de CO₂ por ralentí.</li>
                <li>• Inversión de USD 3.000/esquina (85% más económico que multinacionales).</li>
              </ul>
            </article>
          </div>

          <div className="mt-8 rounded-2xl border border-signal-green/40 bg-gradient-to-r from-signal-green/10 via-card to-background p-6">
            <p className="font-mono text-xs text-signal-green font-bold uppercase tracking-widest">
              Requerimiento de Prueba de Concepto (Costo Cero para el Municipio)
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              Lo que se solicita formalmente es la autorización para un piloto en{" "}
              <strong>1 intersección estratégica de Caseros</strong> (ej. Av. San Martín y Av.
              Urquiza), acceso a alimentación eléctrica y punto en gabinete existente. Toda decisión
              del sistema queda auditada y registrada criptográficamente.
            </p>
          </div>
        </div>
      </section>

      {/* Diagnostic Details */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <p className="font-mono text-xs tracking-[0.3em] text-signal-green uppercase">
          Detalle Operativo
        </p>
        <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Tres Modos Clave para la Comunidad
        </h2>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PROBLEMS.map((p) => (
            <article key={p.n} className="rounded-2xl border border-border bg-card p-6">
              <p className="font-mono text-xs font-bold text-signal-red">{p.n}</p>
              <h3 className="mt-2 text-lg font-bold text-foreground">{p.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Tech Stack Banner */}
      <section className="border-t border-border bg-card/40 py-16">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <p className="font-mono text-xs tracking-[0.3em] text-signal-green uppercase">
            Hardware Abierto & Estándares Industriales
          </p>
          <h2 className="mt-2 text-2xl font-bold text-foreground">
            Soberanía Tecnológica sin Ataduras a Licencias Propietarias
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {HARDWARE.map((h) => (
              <span
                key={h}
                className="rounded-full border border-border bg-secondary/80 px-4 py-2 font-mono text-xs tracking-wide text-foreground shadow-sm"
              >
                {h}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="relative overflow-hidden rounded-3xl border border-signal-green/40 bg-gradient-to-br from-card via-background to-secondary/60 p-8 sm:p-14 shadow-2xl">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Prueba de Concepto y Gemelo Digital interactivo
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Consulte la simulación en tiempo real del agente inteligente, explore el comportamiento
            en caso de falla de cámara y calcule el retorno financiero para Tres de Febrero.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <button
              onClick={() => setIsPitchOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-signal-green px-6 py-3.5 text-sm font-bold text-background transition-all hover:bg-signal-green/90 shadow-lg cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Abrir Modo Pitch Ejecutivo</span>
            </button>
            <Link
              to="/simulador"
              className="rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 shadow-md"
            >
              Abrir Simulador 3D
            </Link>
            <Link
              to="/proyecto"
              className="rounded-xl border border-border bg-card px-6 py-3.5 text-sm font-semibold text-foreground transition-all hover:bg-accent"
            >
              Ver Calculadora ROI 3F
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
