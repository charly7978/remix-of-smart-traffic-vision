import { Link, createFileRoute } from "@tanstack/react-router";

import heroImg from "@/assets/hero-interseccion.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ameghino AI — Semaforización Inteligente para Buenos Aires" },
      {
        name: "description",
        content:
          "Proyecto Carlos Ameghino: semáforos inteligentes con visión artificial para el Conurbano Bonaerense. Menos esperas, más seguridad nocturna y menos emisiones.",
      },
      { property: "og:title", content: "Ameghino AI — Semaforización Inteligente para Buenos Aires" },
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
  { value: "-21%", label: "tiempos de espera estimados con sistemas dinámicos" },
  { value: "63%", label: "de los homicidios ocurren en la vía pública" },
  { value: "200 t", label: "de CO₂ evitadas por año por corredor optimizado" },
  { value: "USD 3.000", label: "por intersección, frente a USD 15–20 mil corporativos" },
];

const PROBLEMS = [
  {
    n: "01",
    title: "Esperas fantasma",
    text: "El ciclo fijo no distingue una avenida colapsada a las 8 AM de una calle desierta a las 3 AM. Conductores detenidos en rojo sin tráfico cruzado queman combustible y tiempo.",
  },
  {
    n: "02",
    title: "Zona de exposición",
    text: "De noche, el semáforo en rojo convierte al conductor en un objetivo estático y vulnerable. La IA detecta el vehículo único y, si el cruce está libre, habilita el verde de inmediato.",
  },
  {
    n: "03",
    title: "Emisiones y ralentí",
    text: "Cada parada innecesaria suma partículas contaminantes, ruido y desgaste mecánico. Optimizar corredores es de las medidas más costo-efectivas contra la huella de carbono urbana.",
  },
];

const SOLUTION = [
  {
    n: "01",
    title: "Percibir",
    text: "Cámaras IP 4MP con WDR y visión nocturna alimentan redes neuronales YOLO entrenadas para el entorno urbano bonaerense: autos, camiones, motos, peatones y vehículos de emergencia.",
  },
  {
    n: "02",
    title: "Decidir",
    text: "El procesamiento en el borde (Jetson / Raspberry Pi) calcula la densidad vehicular σ en tiempo real y ajusta el verde dinámicamente: T_v = max(T_seg, min(T_max, β·σ)).",
  },
  {
    n: "03",
    title: "Actuar",
    text: "Comandos de fase vía protocolo NTCIP hacia los controladores industriales existentes (Autotrol / Teknotrans), con modo fail-safe que restaura el ciclo fijo ante cualquier falla.",
  },
];

const HARDWARE = [
  "NVIDIA Jetson Orin Nano",
  "Raspberry Pi 5",
  "Cámara IP 4MP WDR",
  "YOLOv11",
  "NTCIP / RS-485",
  "4G/5G industrial",
];

function Index() {
  return (
    <main>
      <section className="relative overflow-hidden">
        <img
          src={heroImg}
          alt="Intersección nocturna de Caseros con detección vehicular por inteligencia artificial"
          width={1600}
          height={912}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/60 to-background" />
        <div className="relative mx-auto flex max-w-6xl flex-col justify-end px-4 pt-40 pb-20 sm:pt-56">
          <p className="font-mono text-xs tracking-[0.3em] text-signal-green uppercase">
            Caseros · Tres de Febrero · Provincia de Buenos Aires
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
            Semáforos que piensan. <span className="text-signal-green">Calles que cuidan.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            El Proyecto Carlos Ameghino convierte cada intersección en un agente inteligente que
            percibe, analiza y decide en tiempo real: fluidez en hora pico, protección del
            conductor de madrugada y corredores automáticos para emergencias.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/simulador"
              className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85"
            >
              Ver simulación en vivo
            </Link>
            <Link
              to="/proyecto"
              className="rounded-md border border-border bg-card/60 px-5 py-3 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-accent"
            >
              Plan de implementación
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="px-4 py-8">
              <p className="font-mono text-2xl font-semibold text-signal-green sm:text-3xl">
                {s.value}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <p className="font-mono text-xs tracking-[0.3em] text-signal-green uppercase">
          Diagnóstico
        </p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          El modelo estático de tránsito está en crisis
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PROBLEMS.map((p) => (
            <article key={p.n} className="rounded-xl border border-border bg-card p-6">
              <p className="font-mono text-xs text-signal-red">{p.n}</p>
              <h3 className="mt-2 text-lg font-semibold text-foreground">{p.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <p className="font-mono text-xs tracking-[0.3em] text-signal-green uppercase">
            La propuesta
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            De ciudad reactiva a ciudad proactiva
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {SOLUTION.map((s) => (
              <article key={s.n} className="rounded-xl border border-border bg-card p-6">
                <p className="font-mono text-xs text-signal-green">{s.n}</p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {HARDWARE.map((h) => (
              <span
                key={h}
                className="rounded-full border border-border bg-secondary/60 px-3.5 py-1.5 font-mono text-[11px] tracking-wide text-secondary-foreground"
              >
                {h}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="rounded-2xl border border-border bg-card p-8 sm:p-12">
          <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            La prueba de concepto ya corre en el navegador
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Explorá el simulador interactivo del controlador: tráfico adaptativo, modo seguridad
            nocturna, corredor de emergencias y comportamiento fail-safe ante falla de cámara.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/simulador"
              className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85"
            >
              Abrir el simulador
            </Link>
            <Link
              to="/proyecto"
              className="rounded-md border border-border bg-secondary/60 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              Ver costos y hoja de ruta
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}