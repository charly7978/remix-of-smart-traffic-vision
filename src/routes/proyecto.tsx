import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const Route = createFileRoute("/proyecto")({
  head: () => ({
    meta: [
      {
        title: "Proyecto Carlos Ameghino — Semaforización Inteligente | Documento de Presentación",
      },
      {
        name: "description",
        content:
          "Documento técnico-institucional del Proyecto Carlos Ameghino: semaforización inteligente con inteligencia artificial para Caseros, Municipio de Tres de Febrero. Costos, hoja de ruta, marco legal, riesgos y gobernanza para su evaluación por autoridades de la Provincia de Buenos Aires.",
      },
      {
        property: "og:title",
        content: "Proyecto Carlos Ameghino — Semaforización Inteligente",
      },
      {
        property: "og:description",
        content:
          "Plan de implementación presentado a autoridades provinciales y municipales: arquitectura, costos por intersección, escalamiento, marco legal y gobernanza.",
      },
    ],
  }),
  component: ProyectoPage,
});

/* ------------------------------------------------------------------ */
/*  Componentes auxiliares                                             */
/* ------------------------------------------------------------------ */

function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="border-t border-border py-16 first:border-t-0 first:pt-0">
      <p className="font-mono text-xs tracking-[0.3em] text-signal-green uppercase">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      {lead && (
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">{lead}</p>
      )}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 font-mono text-[11px] font-semibold tracking-[0.25em] text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

function DataTable({
  head,
  rows,
  footRow,
}: {
  head: string[];
  rows: (string | ReactNode)[][];
  footRow?: (string | ReactNode)[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] text-sm">
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
        {footRow && (
          <tfoot>
            <tr className="border-t border-border bg-secondary/40">
              {footRow.map((cell, j) => (
                <td
                  key={j}
                  className={`px-4 py-3 align-top font-mono text-sm font-semibold ${
                    j === 0 ? "text-foreground" : "text-signal-green"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="font-mono text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-signal-green">{value}</p>
      {hint && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 max-w-3xl rounded-lg border border-border bg-secondary/40 px-4 py-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

function CalculadoraRoi3F() {
  const [intersecciones, setIntersecciones] = useState(120);

  const costoFull = 3000;
  const costoCorporativo = 20000;

  const inversion3F = intersecciones * costoFull;
  const inversionCorporativa = intersecciones * costoCorporativo;
  const ahorroDirecto = inversionCorporativa - inversion3F;
  const co2EvitadoAnno = Math.round(intersecciones * 1.67);
  const combustibleAhorrado = Math.round(intersecciones * 12500);

  return (
    <div className="my-8 rounded-2xl border border-signal-green/40 bg-card p-6 sm:p-8 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <span className="rounded-full border border-signal-green/30 bg-signal-green/10 px-3 py-1 font-mono text-xs font-bold text-signal-green">
            SIMULADOR FINANCIERO MUNICIPAL 3F
          </span>
          <h3 className="mt-3 text-2xl font-bold text-foreground">
            Calculadora de Retorno e Inversión para Tres de Febrero
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Ajuste el número de semáforos para proyectar la inversión requerida vs soluciones
            corporativas tradicionales.
          </p>
        </div>

        <div className="text-right">
          <p className="font-mono text-xs text-muted-foreground uppercase">
            Intersecciones Seleccionadas
          </p>
          <p className="font-mono text-4xl font-black text-signal-green">{intersecciones}</p>
        </div>
      </div>

      {/* Slider Control */}
      <div className="mt-6">
        <div className="flex justify-between font-mono text-xs text-muted-foreground mb-2">
          <span>10 Semáforos (Piloto Corredor)</span>
          <span>60 Semáforos (Av. Principales)</span>
          <span>150 Semáforos (Red Total 3F)</span>
        </div>
        <input
          type="range"
          min={10}
          max={150}
          step={5}
          value={intersecciones}
          onChange={(e) => setIntersecciones(Number(e.target.value))}
          className="w-full h-3 bg-secondary rounded-lg appearance-none cursor-pointer accent-signal-green"
        />
      </div>

      {/* Metrics Results Grid */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-secondary/30 p-4">
          <p className="font-mono text-[10px] text-muted-foreground uppercase">
            Presupuesto Proyecto Ameghino
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-signal-green">
            USD {inversion3F.toLocaleString("es-AR")}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            USD {costoFull}/esquina hardware full
          </p>
        </div>

        <div className="rounded-xl border border-border bg-secondary/30 p-4">
          <p className="font-mono text-[10px] text-muted-foreground uppercase">
            Contrato Corporativo Llave en Mano
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-signal-red">
            USD {inversionCorporativa.toLocaleString("es-AR")}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            USD 20.000/esquina promedio mercado
          </p>
        </div>

        <div className="rounded-xl border border-signal-green/40 bg-signal-green/10 p-4">
          <p className="font-mono text-[10px] text-signal-green uppercase font-bold">
            Ahorro Neto Municipal Directo
          </p>
          <p className="mt-2 font-mono text-2xl font-black text-signal-green">
            USD {ahorroDirecto.toLocaleString("es-AR")}
          </p>
          <p className="mt-1 text-[11px] text-foreground/80 font-medium">
            Capacidad de ahorro de un 85%
          </p>
        </div>

        <div className="rounded-xl border border-border bg-secondary/30 p-4">
          <p className="font-mono text-[10px] text-muted-foreground uppercase">
            Impacto Ambiental Anual
          </p>
          <p className="mt-2 font-mono text-xl font-bold text-foreground">
            {co2EvitadoAnno} ton CO₂
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {combustibleAhorrado.toLocaleString("es-AR")} litros de nafta/año
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Datos                                                               */
/* ------------------------------------------------------------------ */

const COSTOS_MINIMA = [
  ["Unidad de cómputo de borde", "Raspberry Pi 5, 8 GB RAM", "1", "USD 95", "USD 95"],
  ["Cámara de visión", "IP 4MP con WDR y visión nocturna IR", "1", "USD 120", "USD 120"],
  ["Gabinete de intemperie", "Policarbonato IP66 con ventilación pasiva", "1", "USD 90", "USD 90"],
  [
    "Protección eléctrica / UPS",
    "Fuente regulada + batería de respaldo 12V 7Ah",
    "1",
    "USD 110",
    "USD 110",
  ],
  ["Conectividad", "Módem 4G industrial con SIM de datos M2M", "1", "USD 140", "USD 140"],
  [
    "Interfaz de relés / NTCIP",
    "Módulo de relés optoacoplados de 4 canales",
    "1",
    "USD 60",
    "USD 60",
  ],
  [
    "Cableado, montaje y accesorios",
    "Prensacables, soportes, protecciones",
    "1",
    "USD 85",
    "USD 85",
  ],
  [
    "Instalación y mano de obra",
    "Técnico electricista + asistencia (jornada)",
    "1",
    "USD 250",
    "USD 250",
  ],
];

const COSTOS_FULL = [
  ["Unidad de cómputo de borde", "NVIDIA Jetson Orin Nano Super (8 GB)", "1", "USD 249", "USD 249"],
  ["Cámara de visión", "IP 4MP con WDR y visión nocturna IR", "1", "USD 180", "USD 180"],
  [
    "Gabinete de intemperie",
    "Metálico IP66 con disipación térmica activa",
    "1",
    "USD 220",
    "USD 220",
  ],
  [
    "Protección eléctrica / UPS",
    "Fuente redundante + banco de baterías 12V 18Ah",
    "1",
    "USD 260",
    "USD 260",
  ],
  ["Conectividad", "Módem 4G/5G industrial dual-SIM", "1", "USD 320", "USD 320"],
  [
    "Interfaz de relés / NTCIP",
    "Controlador de interfaz certificado NTCIP",
    "1",
    "USD 420",
    "USD 420",
  ],
  [
    "Cableado, montaje y accesorios",
    "Kit completo con protección antivandálica",
    "1",
    "USD 250",
    "USD 250",
  ],
  [
    "Instalación y mano de obra",
    "Cuadrilla especializada + puesta en marcha y calibración",
    "1",
    "USD 900",
    "USD 900",
  ],
  [
    "Ingeniería de integración y pruebas",
    "Ajuste del modelo, homologación funcional",
    "1",
    "USD 240",
    "USD 240",
  ],
];

const ESCALAMIENTO = [
  [
    "Piloto",
    "3 intersecciones",
    "USD 3.600 – 9.000",
    "USD 1.200 – 2.400",
    "Línea de base de datos; validación operativa",
  ],
  [
    "Corredor",
    "12 intersecciones",
    "USD 14.400 – 36.000",
    "USD 4.800 – 9.600",
    "Reducción estimada de demoras en el corredor; primeros indicadores de siniestralidad",
  ],
  [
    "Municipio",
    "120 intersecciones",
    "USD 144.000 – 360.000",
    "USD 48.000 – 96.000",
    "Impacto agregado en tiempos de viaje, combustible y emisiones a escala municipal",
  ],
];

const ROADMAP = [
  {
    fase: "Fase 0",
    title: "Laboratorio y validación",
    plazo: "Meses 1–2",
    entregables: [
      "Banco de pruebas con Raspberry Pi / Jetson y modelo YOLO entrenado en tránsito local.",
      "Maqueta a escala con semáforo LED para demostraciones institucionales.",
      "Protocolo de pruebas y matriz de casos de falla (fail-safe).",
    ],
    aceptacion: [
      "≥ 90% de precisión en detección de vehículos en condiciones diurnas y nocturnas.",
      "Tiempo de inferencia por cuadro < 100 ms en el hardware objetivo.",
    ],
  },
  {
    fase: "Fase 1",
    title: "Piloto en una esquina",
    plazo: "Meses 3–5",
    entregables: [
      "Instalación supervisada en una intersección crítica de Caseros, con convenio municipal.",
      "Modo de supervisión pasiva (solo medición) antes de habilitar el control activo del ciclo.",
      "Panel de monitoreo con métricas de densidad, tiempos de espera y eventos fail-safe.",
    ],
    aceptacion: [
      "0 incidentes de seguridad atribuibles al sistema durante 60 días de operación.",
      "Reducción verificable ≥ 10% en el tiempo de espera promedio en horas pico.",
      "Disponibilidad del sistema ≥ 98% (uptime mensual).",
    ],
  },
  {
    fase: "Fase 2",
    title: "Corredor",
    plazo: "Meses 6–10",
    entregables: [
      "Extensión a 12 intersecciones de un corredor vial de Tres de Febrero.",
      "Coordinación de onda verde y priorización de vehículos de emergencia.",
      "Centro de monitoreo unificado y protocolo de mantenimiento preventivo.",
    ],
    aceptacion: [
      "Reducción ≥ 15% en tiempo de viaje promedio del corredor respecto de la línea de base.",
      "Registro auditable de cada decisión de control (trazabilidad completa).",
    ],
  },
  {
    fase: "Fase 3",
    title: "Municipal",
    plazo: "Meses 11–20",
    entregables: [
      "Cobertura de hasta 120 intersecciones priorizadas por siniestralidad y flujo.",
      "Convenio marco con el Municipio de Tres de Febrero y esquema de financiamiento plurianual.",
      "Programa de mantenimiento con proveedores locales capacitados.",
    ],
    aceptacion: [
      "Reducción sostenida de siniestros viales en los cruces intervenidos (indicador anual).",
      "Costo de operación por intersección dentro del presupuesto aprobado.",
    ],
  },
  {
    fase: "Fase 4",
    title: "Provincial",
    plazo: "A partir del mes 21",
    entregables: [
      "Presentación de resultados auditados ante el Ministerio de Transporte de la Provincia.",
      "Marco de homologación provincial y catálogo de proveedores habilitados.",
      "Réplica en municipios del conurbano con características de tránsito comparables.",
    ],
    aceptacion: [
      "Homologación técnica formal del sistema por la autoridad provincial competente.",
      "Modelo de costos validado por al menos dos ciclos presupuestarios municipales.",
    ],
  },
];

const RIESGOS = [
  [
    "Falla de energía eléctrica",
    "Corte de suministro en la vía pública",
    "UPS local con autonomía ≥ 4 h; el controlador retorna a ciclo fijo pregrabado ante falla total.",
  ],
  [
    "Vandalismo o robo de equipo",
    "Daño o sustracción del gabinete o la cámara",
    "Gabinete IP66 antivandálico, fijación con tornillería de seguridad, seguro contra daños y reposición rápida.",
  ],
  [
    "Pérdida de enlace de datos",
    "Caída de la conectividad 4G o del proveedor",
    "Operación autónoma en el borde sin dependencia de la nube; reintento automático y alerta al centro de mantenimiento.",
  ],
  [
    "Falsos positivos o negativos del modelo",
    "Detección incorrecta de vehículos o peatones",
    "Umbrales de confianza conservadores, supervisión humana en fase piloto y reentrenamiento periódico con datos locales.",
  ],
  [
    "Resistencia institucional o vecinal",
    "Desconfianza ante un cambio en la gestión del semáforo",
    "Fase de supervisión pasiva previa, comunicación pública transparente y mesas de trabajo con la comunidad.",
  ],
  [
    "Ciberseguridad",
    "Acceso no autorizado al sistema o manipulación remota",
    "Procesamiento en el borde sin exposición de video crudo, cifrado de telemetría, actualización firmada y auditoría de accesos.",
  ],
];

const EQUIPO = [
  [
    "Dirección técnica",
    "Responsable del diseño del sistema, la arquitectura de IA y la relación con el fabricante de controladores.",
  ],
  [
    "Ingeniería de tránsito",
    "Validación de tiempos de ciclo, seguridad peatonal y cumplimiento de la Ley 24.449.",
  ],
  [
    "Mantenimiento de campo",
    "Instalación, calibración y sostenimiento de los equipos en la vía pública.",
  ],
  [
    "Enlace institucional",
    "Coordinación con el Municipio de Tres de Febrero y la Provincia de Buenos Aires.",
  ],
  [
    "Auditoría y datos",
    "Revisión periódica de las decisiones del sistema y cumplimiento de la Ley 25.326.",
  ],
];

/* ------------------------------------------------------------------ */
/*  Página                                                              */
/* ------------------------------------------------------------------ */

function ProyectoPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <p className="font-mono text-xs tracking-[0.3em] text-signal-green uppercase">
        Documento de presentación institucional
      </p>
      <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
        Proyecto Carlos Ameghino
      </h1>
      <p className="mt-2 max-w-3xl text-lg font-medium text-foreground">
        Semaforización inteligente con inteligencia artificial para Caseros, Municipio de Tres de
        Febrero
      </p>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Documento técnico-económico elaborado para su evaluación por autoridades del Municipio de
        Tres de Febrero y de la Provincia de Buenos Aires. Reúne el diagnóstico del problema, la
        arquitectura de la solución, los costos de referencia, la hoja de ruta de implementación, el
        marco legal aplicable y el pedido concreto de autorización de una prueba piloto.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <KpiCard label="Costo por intersección (mínima viable)" value="USD 900–1.200" />
        <KpiCard label="Costo por intersección (variante full)" value="~USD 3.000" />
        <KpiCard
          label="Referencia corporativa llave en mano"
          value="USD 15.000–20.000"
          hint="Solución equivalente en el mercado internacional"
        />
      </div>

      <div className="mt-14 flex flex-col gap-0">
        {/* 1. Narrativa institucional */}
        <Section
          id="contexto"
          eyebrow="Diagnóstico y oportunidad"
          title="Un problema público concreto, una ventana de oportunidad"
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <article className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-base font-semibold text-foreground">El problema</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Caseros y el resto del partido de Tres de Febrero conviven a diario con demoras de
                tránsito en horas pico, semáforos con tiempos fijos que no responden a la demanda
                real y esquinas con visibilidad reducida por la noche. Estas condiciones inciden
                directamente sobre la siniestralidad vial, el consumo de combustible y la calidad de
                vida de los vecinos, en un partido densamente poblado del conurbano bonaerense.
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-base font-semibold text-foreground">La oportunidad</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                El abaratamiento de las plataformas de cómputo en el borde (Raspberry Pi, NVIDIA
                Jetson) y la madurez de los modelos de visión por computadora de código abierto
                permiten construir un sistema de semaforización adaptativa a una fracción del costo
                de las soluciones corporativas, sin resignar los estándares de seguridad exigidos
                por la normativa vigente.
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-base font-semibold text-foreground">Por qué ahora</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Existe alineación directa con los objetivos de seguridad vial impulsados a nivel
                nacional y provincial y con la agenda ambiental de reducción de emisiones en zonas
                urbanas densas. Un piloto de bajo costo y bajo riesgo permite al Municipio y a la
                Provincia evaluar resultados concretos antes de comprometer presupuestos de mayor
                escala.
              </p>
            </article>
          </div>
          <Note>
            Los montos, plazos y referencias técnicas de este documento son estimaciones de
            referencia elaboradas por el equipo del Proyecto Carlos Ameghino a los fines de esta
            presentación. Están sujetas a cotización formal, relevamiento en terreno y ajuste por
            parte de proveedores homologados antes de cualquier ejecución.
          </Note>
        </Section>

        {/* 2. Costos por intersección */}
        <Section
          id="costos-interseccion"
          eyebrow="Factibilidad económica"
          title="Costos por intersección y Calculadora ROI Municipal"
          lead="Se presentan dos variantes de referencia: una configuración mínima viable orientada a
          validar la lógica del sistema, y una configuración full con hardware de mayor capacidad
          de cómputo, pensada para operación sostenida en la vía pública."
        >
          <CalculadoraRoi3F />

          <SubHeading>Variante mínima viable (Raspberry Pi)</SubHeading>
          <DataTable
            head={[
              "Componente",
              "Especificación",
              "Unidad",
              "Costo unitario (USD)",
              "Subtotal (USD)",
            ]}
            rows={COSTOS_MINIMA}
            footRow={["Total variante mínima viable", "", "", "", "USD 950"]}
          />

          <div className="h-8" />

          <SubHeading>Variante full (NVIDIA Jetson Orin Nano Super)</SubHeading>
          <DataTable
            head={[
              "Componente",
              "Especificación",
              "Unidad",
              "Costo unitario (USD)",
              "Subtotal (USD)",
            ]}
            rows={COSTOS_FULL}
            footRow={["Total variante full", "", "", "", "USD 3.039"]}
          />

          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Ambas variantes se ubican muy por debajo del costo de referencia de soluciones
            corporativas llave en mano, estimado entre{" "}
            <span className="text-foreground">USD 15.000 y USD 20.000 por intersección</span>, que
            incluyen controladores propietarios, licenciamiento de software cerrado y contratos de
            mantenimiento de largo plazo.
          </p>
          <Note>
            Los precios de componentes corresponden a valores de lista publicados por fabricantes y
            distribuidores al momento de redacción de este documento; no incluyen impuestos de
            importación, flete ni variaciones cambiarias, y deben confirmarse mediante cotización
            formal previa a la compra.
          </Note>
        </Section>

        {/* 3. Escalamiento */}
        <Section
          id="escalamiento"
          eyebrow="Proyección financiera"
          title="Costos de escalamiento: piloto, corredor y municipio"
          lead="La inversión crece de forma lineal con la cantidad de intersecciones, mientras que el
          retorno esperado —en horas-hombre recuperadas, combustible y emisiones evitadas— crece
          de forma más que proporcional al coordinarse corredores completos."
        >
          <DataTable
            head={["Etapa", "Alcance", "CAPEX estimado", "OPEX anual estimado", "Retorno esperado"]}
            rows={ESCALAMIENTO}
          />
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                OPEX — componentes
              </p>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm leading-relaxed text-muted-foreground">
                <li>Conectividad de datos por intersección.</li>
                <li>Mantenimiento preventivo y correctivo de campo.</li>
                <li>Consumo eléctrico del equipo de borde.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                Retorno — horas-hombre
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Reducción de demoras en los desplazamientos de vecinos, transporte de carga y
                servicios de emergencia, estimable en horas-persona recuperadas por año una vez
                consolidada la línea de base de tránsito.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                Retorno — combustible y CO₂
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Menor tiempo de motor encendido en espera y menor cantidad de frenadas y arranques
                se traduce en ahorro de combustible y en una reducción de emisiones de CO₂ por
                corredor, a cuantificar durante la fase de corredor con mediciones en terreno.
              </p>
            </div>
          </div>
          <Note>
            Las cifras de CAPEX y OPEX de esta tabla son proyecciones lineales de referencia a
            partir de los costos por intersección de la sección anterior; no constituyen un
            presupuesto ejecutivo y deben validarse con estudios de tránsito y cotizaciones
            específicas para cada etapa.
          </Note>
        </Section>

        {/* 4. Hoja de ruta */}
        <Section
          id="hoja-de-ruta"
          eyebrow="Ejecución"
          title="Hoja de ruta por fases"
          lead="Cada fase habilita la siguiente únicamente si se cumplen los criterios de aceptación
          definidos, minimizando el riesgo institucional y presupuestario."
        >
          <div className="flex flex-col gap-4">
            {ROADMAP.map((f) => (
              <article
                key={f.fase}
                className="rounded-xl border border-border bg-card p-6 md:grid md:grid-cols-[140px_1fr_1fr] md:gap-6"
              >
                <div>
                  <p className="font-mono text-xs text-signal-green">{f.fase}</p>
                  <h3 className="mt-1 text-lg font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{f.plazo}</p>
                </div>
                <div className="mt-4 md:mt-0">
                  <p className="font-mono text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                    Entregables
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5 text-sm leading-relaxed text-muted-foreground">
                    {f.entregables.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="mt-4 md:mt-0">
                  <p className="font-mono text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                    Criterios de aceptación (KPI)
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5 text-sm leading-relaxed text-muted-foreground">
                    {f.aceptacion.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </Section>

        {/* 5. Marco legal */}
        <Section
          id="marco-legal"
          eyebrow="Marco legal y propiedad intelectual"
          title="Cumplimiento normativo y protección del desarrollo"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">DNDA — Ley 11.723</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Registro del código fuente y de la documentación técnica ante la Dirección Nacional
                del Derecho de Autor, que fija fecha cierta de autoría sobre el software y la
                arquitectura lógica del sistema.
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">
                INPI — marca y modelo de utilidad
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Registro de la marca &quot;Ameghino AI&quot; ante el Instituto Nacional de la
                Propiedad Industrial, y evaluación de un modelo de utilidad sobre la integración
                física de hardware para su eventual protección.
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">
                Ley 24.449 y decreto reglamentario
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                El sistema respeta el Sistema de Señalización Vial Uniforme establecido por la Ley
                Nacional de Tránsito y su decreto reglamentario. La unidad de IA actúa como
                supervisor de demanda; el controlador conserva siempre las protecciones de hardware
                que impiden estados de conflicto entre fases.
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">
                Normativa municipal y homologación
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                La instalación en la vía pública requiere autorización expresa del Municipio de Tres
                de Febrero y homologación técnica de los controladores ante la autoridad provincial
                competente, conforme a los procedimientos vigentes.
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card p-6 md:col-span-2">
              <h3 className="text-lg font-semibold text-foreground">
                Ley 25.326 — Protección de datos personales
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                El sistema procesa la imagen exclusivamente en el borde (edge computing): no se
                almacenan rostros ni patentes, ni se transmite video hacia servidores centrales.
                Únicamente se conservan y transmiten metadatos agregados y anonimizados —conteo de
                vehículos, densidad y tiempos de ciclo—, en línea con los principios de minimización
                de datos y finalidad establecidos por la Ley 25.326.
              </p>
            </article>
          </div>
        </Section>

        {/* 6. Riesgos */}
        <Section
          id="riesgos"
          eyebrow="Gestión de riesgos"
          title="Riesgos identificados y mitigaciones"
        >
          <DataTable head={["Riesgo", "Descripción", "Mitigación"]} rows={RIESGOS} />
        </Section>

        {/* 7. Gobernanza */}
        <Section
          id="gobernanza"
          eyebrow="Gobernanza institucional"
          title="Equipo, convenios y auditoría"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <SubHeading>Roles del equipo de proyecto</SubHeading>
              <DataTable head={["Rol", "Responsabilidad"]} rows={EQUIPO} />
            </div>
            <div className="flex flex-col gap-4">
              <article className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold text-foreground">
                  Convenio universidad–municipio
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Se propone un convenio marco entre el Municipio de Tres de Febrero, una
                  universidad con sede en el partido y el equipo del Proyecto Carlos Ameghino, que
                  formalice el acceso a la vía pública, la provisión de datos anonimizados para
                  investigación y la transferencia de conocimiento técnico local.
                </p>
              </article>
              <article className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold text-foreground">
                  Auditoría de decisiones del sistema
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Cada cambio de fase del semáforo motivado por el algoritmo queda registrado con
                  marca temporal, densidad detectada y estado del controlador, disponible para
                  auditoría por parte del Municipio y de la Provincia. La supervisión humana
                  permanece activa durante toda la fase piloto.
                </p>
              </article>
            </div>
          </div>
        </Section>
      </div>

      {/* 8. Cierre / CTA */}
      <div className="mt-8 rounded-2xl border border-border bg-card p-8 sm:p-10">
        <p className="font-mono text-xs tracking-[0.3em] text-signal-green uppercase">
          Solicitud concreta
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
          Lo que se solicita al funcionario
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          El Proyecto Carlos Ameghino cuenta con un prototipo lógico en funcionamiento y una hoja de
          ruta técnica y financiera detallada. Para avanzar a la Fase 1 se solicita concretamente:
        </p>
        <ul className="mt-4 flex max-w-2xl flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
          <li>
            <span className="text-foreground">1.</span> Autorización formal para instalar un piloto
            de supervisión en una intersección de Caseros, previamente acordada con el Municipio.
          </li>
          <li>
            <span className="text-foreground">2.</span> Un punto de energía eléctrica en dicha
            esquina para alimentar el equipo de borde y su respaldo.
          </li>
          <li>
            <span className="text-foreground">3.</span> Acceso técnico al cruce y al gabinete del
            controlador existente para la instalación de la interfaz de relés, bajo supervisión del
            área municipal competente.
          </li>
        </ul>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          El simulador web adjunto reproduce la lógica del controlador Ameghino AI —densidad,
          tiempos dinámicos, seguridad nocturna y protocolo fail-safe— y está disponible como
          material de demostración durante la reunión.
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
