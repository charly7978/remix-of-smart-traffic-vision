import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/inteligencia")({
  head: () => ({
    meta: [
      { title: "Arquitectura de Inteligencia — Ameghino AI" },
      {
        name: "description",
        content:
          "Pila cognitiva de tres niveles —percepción reflejo, razonamiento visual local y supervisión en la nube— que permite a un semáforo comportarse como un agente de tránsito humano, con contrato de decisión seguro y validado por reglas duras.",
      },
      { property: "og:title", content: "Arquitectura de Inteligencia — Ameghino AI" },
      {
        property: "og:description",
        content:
          "Cómo YOLO, modelos de visión-lenguaje en el borde y modelos de razonamiento en la nube convierten un semáforo en un agente de tránsito contextual, con validación determinista de seguridad.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InteligenciaPage,
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
      <table className="w-full min-w-[720px] text-sm">
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

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card p-5">
      <pre className="font-mono text-[12.5px] leading-relaxed text-muted-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const INTENT_JSON = `{
  "agente": "vlm-borde-qwen2.5vl-3b-awq",
  "timestamp": "2025-06-02T04:17:33.221Z",
  "interseccion": "Ameghino y Av. San Martín",
  "observacion": "Vehiculo unico detenido en eje secundario, cruce despejado, sin peatones, horario 04:17",
  "accion_sugerida": "EXTENDER_ROJO_SECUNDARIO_Y_LIBERAR_VERDE_PRINCIPAL",
  "eje_afectado": "secundario",
  "duracion_sugerida_seg": 8,
  "motivo": "Reducir tiempo de exposicion nocturna del conductor unico ante cruce vacio; sin conflicto detectado con ejes cruzados",
  "confianza": 0.87,
  "evidencia": {
    "objetos": ["auto"],
    "conteo": 1,
    "peatones_detectados": 0,
    "clase_excepcional": null
  },
  "requiere_confirmacion_humana": false
}`;

const SYSTEM_PROMPT = `Sos el modulo de razonamiento visual de un semaforo inteligente (Ameghino AI).
Recibis un frame anotado por el detector (cajas, clases, tracks) y el estado actual del ciclo.
Tu tarea es UNICAMENTE interpretar contexto y proponer una intencion de accion, nunca ejecutarla.

Reglas de salida:
1. Respondes exclusivamente en JSON valido, sin texto adicional.
2. Los campos obligatorios son: accion_sugerida, eje_afectado, duracion_sugerida_seg,
   motivo, confianza (0 a 1), evidencia.
3. Si la confianza es menor a 0.6, la accion_sugerida debe ser "SIN_CAMBIO".
4. Nunca declares una accion que abra dos ejes en conflicto simultaneo.
5. Si detectas un vehiculo de emergencia (forma + baliza + patron de sirena en audio si esta
   disponible), la accion_sugerida debe ser "CORREDOR_EMERGENCIA" con confianza minima 0.75.
6. Si no hay evidencia suficiente o la imagen esta degradada (niebla, lente sucio, noche sin
   iluminacion), respondes accion_sugerida "SIN_CAMBIO" y motivo "percepcion_no_confiable".

Recorda: tu salida pasa siempre por un validador determinista de reglas duras antes de
convertirse en un comando real. No tenes autoridad de control directo sobre el semaforo.`;

const VLM_ROWS: string[][] = [
  [
    "Qwen2.5-VL 3B (INT4/AWQ)",
    "3.000 M",
    "Apache 2.0",
    "≈ 3–4 GB",
    "≈ 400–800 ms/consulta (est.)",
    "Razonamiento contextual general, OCR de patentes, grounding espacial",
    "Cerebro contextual recomendado",
  ],
  [
    "Qwen2.5-VL 7B (INT4/AWQ)",
    "7.000 M",
    "Apache 2.0",
    "≈ 6–8 GB",
    "≈ 1–2 s/consulta (est.)",
    "Mayor precisión de razonamiento y OCR, a costa de latencia",
    "Uso en Jetson AGX u orquestación por lotes, no por ciclo crítico",
  ],
  [
    "SmolVLM2 (256 M)",
    "256 M",
    "Apache 2.0",
    "< 1 GB",
    "≈ 80–150 ms/consulta (est.)",
    "Descripción rápida de escena y conteo grueso",
    "Fallback ultraliviano ante degradación de recursos",
  ],
  [
    "SmolVLM2 (2.2 B)",
    "2.200 M",
    "Apache 2.0",
    "≈ 2–3 GB",
    "≈ 300–500 ms/consulta (est.)",
    "Balance costo/calidad para descripciones cortas",
    "Fallback intermedio o segunda opinión",
  ],
  [
    "Moondream 2",
    "≈ 1.900 M",
    "Apache 2.0",
    "≈ 2 GB",
    "≈ 200–400 ms/consulta (est.)",
    "Consultas puntuales tipo pregunta-respuesta muy livianas",
    "Fallback ultraliviano alternativo a SmolVLM2",
  ],
  [
    "Florence-2 (base/large)",
    "230 M / 770 M",
    "MIT",
    "≈ 1–3 GB",
    "≈ 100–300 ms/consulta (est.)",
    "Grounding, detección densa y segmentación con prompts unificados",
    "Complemento de percepción para regiones de interés (cruce peatonal, senda)",
  ],
  [
    "PaliGemma 2 (3B)",
    "3.000 M",
    "Gemma (uso responsable)",
    "≈ 3–4 GB",
    "≈ 400–700 ms/consulta (est.)",
    "Grounding fino y captioning con ajuste por dominio",
    "Alternativa si se requiere fine-tuning específico de corredor",
  ],
  [
    "InternVL2.5 (2B/4B)",
    "2.000–4.000 M",
    "MIT / Apache 2.0 (según versión)",
    "≈ 2–5 GB",
    "≈ 300–700 ms/consulta (est.)",
    "Buen equilibrio general y multilingüe",
    "Candidato secundario al set Qwen2.5-VL",
  ],
  [
    "LLaVA-OneVision",
    "0.5–7 B (variantes)",
    "Apache 2.0",
    "≈ 1–8 GB según variante",
    "≈ 300 ms – 1.5 s (est.)",
    "Versatilidad en tareas de video corto y multi-imagen",
    "Evaluación para coordinación entre esquinas vecinas",
  ],
  [
    "MiniCPM-V 2.6",
    "8.000 M (activo eficiente)",
    "Apache 2.0",
    "≈ 6–8 GB (cuantizado)",
    "≈ 700 ms – 1.2 s (est.)",
    "OCR de alta calidad y comprensión de escena densa",
    "Especialista en lectura de patentes en condiciones adversas",
  ],
];

const LATENCY_ROWS: string[][] = [
  ["Captura de frame", "≈ 15–30 ms", "Sensor + ISP de la cámara IP/USB"],
  ["Inferencia del detector (YOLOv11/RT-DETR)", "≈ 10–25 ms", "En GPU embebida (Jetson Orin Nano) o acelerador NPU"],
  ["Tracking multiobjeto (ByteTrack/BoT-SORT)", "≈ 2–8 ms", "Asociación de detecciones entre frames"],
  ["Razonamiento VLM (Nivel 2, cuando se invoca)", "≈ 300–800 ms", "No corre en cada frame; se dispara por evento o cada 0,5–2 Hz"],
  ["Validación determinista de reglas duras", "≈ 1–3 ms", "Máquina de estados en CPU, sin componente probabilístico"],
  ["Comando NTCIP al controlador", "≈ 10–40 ms", "Latencia de red/serie hacia el gabinete de campo"],
  ["Total ciclo reflejo (sin VLM)", "≈ 40–70 ms", "Percepción → tracking → validación → comando"],
  ["Total con intervención contextual (Nivel 2)", "≈ 350–900 ms", "No bloquea el ciclo reflejo; ajusta la próxima ventana de decisión"],
];

function InteligenciaPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <p className="font-mono text-xs tracking-[0.3em] text-signal-green uppercase">
        Arquitectura cognitiva del sistema
      </p>
      <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
        Arquitectura de Inteligencia — Ameghino AI
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Qué modelos, en qué capa y con qué garantías de seguridad hacen que un semáforo deje de
        ser un temporizador ciego y se comporte como un agente de tránsito humano parado en la
        esquina: interpretando intención, contexto y excepciones en tiempo real.
      </p>

      <div className="mt-14 flex flex-col gap-0">
        <Section id="tesis" eyebrow="Tesis" title="Por qué un detector de objetos solo no alcanza">
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Un detector de objetos como YOLO responde con precisión a la pregunta &quot;¿qué hay
            en la escena y dónde?&quot;. Pero un agente humano parado en la esquina no solo cuenta
            vehículos: interpreta <span className="text-foreground">intención</span> (¿ese auto
            frenó porque va a doblar o porque está haciendo una entrega?),{" "}
            <span className="text-foreground">contexto</span> (¿es la hora pico, la madrugada, hay
            un evento en la plaza?) y{" "}
            <span className="text-foreground">excepciones</span> (una ambulancia, un peatón con
            movilidad reducida, una calzada anegada). Ninguna de esas tres capas de juicio surge de
            una caja delimitadora con una etiqueta de clase; requieren razonamiento sobre la
            escena completa, lenguaje y memoria de corto plazo.
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Por eso Ameghino AI no apuesta a un único modelo monolítico, sino a una{" "}
            <span className="text-foreground">pila cognitiva de tres niveles</span>, cada uno
            optimizado para una escala de tiempo distinta: reflejo (milisegundos), razonamiento
            contextual (segundos, en el borde) y supervisión estratégica (minutos a días, en la
            nube). Esta separación no es un capricho de ingeniería: es la misma que usa un cerebro
            humano al cruzar información sensorial rápida con juicio deliberativo lento, y es la
            única forma de sostener seguridad crítica sin sacrificar adaptabilidad.
          </p>
        </Section>

        <Section
          id="nivel-1"
          eyebrow="Nivel 1 — Percepción reflejo"
          title="Detección y seguimiento en el borde (10–30 FPS)"
        >
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            La capa reflejo es la que nunca puede fallar ni demorarse: es la que decide en menos
            de 40 ms si hay un objeto cruzando una senda peatonal. Para esto se usan detectores de
            una sola pasada —<span className="text-foreground">YOLOv11 / YOLOv8</span> (Ultralytics)
            o <span className="text-foreground">RT-DETR</span>— combinados con algoritmos de
            seguimiento multiobjeto como{" "}
            <span className="text-foreground">ByteTrack</span> o{" "}
            <span className="text-foreground">BoT-SORT</span>, que asocian detecciones entre
            frames para saber si un vehículo se está deteniendo, acelerando o ya cruzó.
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Estos modelos son livianos por diseño: una red YOLO en su variante nano o small
            corre por debajo de los 40 ms de inferencia en aceleradores embebidos, lo que permite
            sostener el lazo de control en tiempo real sin depender de la nube. Es viable en{" "}
            <span className="text-foreground">NVIDIA Jetson Orin Nano</span> (con su GPU CUDA
            integrada) e incluso en una{" "}
            <span className="text-foreground">Raspberry Pi 5</span> asistida por un acelerador
            externo de bajo consumo como <span className="text-foreground">Hailo-8L</span> o el{" "}
            <span className="text-foreground">Coral Edge TPU</span>, que descargan la convolución
            de la CPU y sostienen tasas de cuadro utilizables para tránsito urbano (no para
            F1, pero sí de sobra para un cruce de calles).
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Esta capa nunca razona; solo percibe y cuenta. Es el equivalente al reflejo rotuliano
            del agente humano: rápido, confiable, sin ambigüedad semántica.
          </p>
        </Section>

        <Section
          id="nivel-2"
          eyebrow="Nivel 2 — Razonamiento visual local"
          title="Modelos de visión-lenguaje en el borde (0,5–2 Hz)"
        >
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Acá aparece la diferencia central con un semáforo adaptativo tradicional. Un modelo de
            visión-lenguaje (VLM) no clasifica: describe, cuenta con contexto, lee texto en la
            escena y responde preguntas sobre lo que ve. Es la capa que le permite al sistema
            distinguir &quot;una fila de autos&quot; de &quot;un camión de reparto detenido&quot;,
            o reconocer una silla de ruedas donde el detector solo vio &quot;persona&quot;.
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            No hace falta la nube para esto: existe hoy una familia madura de VLM abiertos,
            cuantizables y ejecutables en hardware embebido. La tabla siguiente compara las
            opciones evaluadas, con cifras presentadas como{" "}
            <span className="text-foreground">estimaciones de referencia</span> (órdenes de
            magnitud a partir de arquitectura y tamaño de parámetros, no benchmarks oficiales
            certificados sobre Jetson Orin Nano):
          </p>
          <div className="mt-4">
            <DataTable
              head={[
                "Modelo",
                "Parámetros",
                "Licencia",
                "VRAM/RAM aprox.",
                "Latencia estimada (Orin Nano)",
                "Fortaleza principal",
                "Recomendación de uso",
              ]}
              rows={VLM_ROWS}
            />
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            La configuración recomendada para Ameghino AI es un esquema de dos capas dentro del
            propio Nivel 2:{" "}
            <span className="text-foreground">Qwen2.5-VL 3B cuantizado (INT4/AWQ)</span> como
            cerebro contextual principal —buen equilibrio entre capacidad de razonamiento, OCR de
            patentes y latencia sub-segundo— con{" "}
            <span className="text-foreground">SmolVLM2</span> o{" "}
            <span className="text-foreground">Moondream 2</span> como fallback ultraliviano para
            consultas simples o para sostener el servicio si el hardware está bajo estrés térmico
            o de cómputo. Ambos se sirven localmente con motores de inferencia optimizados como{" "}
            <span className="text-foreground">llama.cpp</span>,{" "}
            <span className="text-foreground">Ollama</span> o{" "}
            <span className="text-foreground">TensorRT-LLM</span> (este último cuando el objetivo
            es exprimir al máximo la GPU de la Jetson).
          </p>
        </Section>

        <Section
          id="nivel-3"
          eyebrow="Nivel 3 — Supervisión en la nube"
          title="Modelos de razonamiento grandes, fuera del lazo crítico"
        >
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            El tercer nivel opera en la escala de segundos a minutos, con acceso a conectividad y
            a modelos de frontera con visión: la familia{" "}
            <span className="text-foreground">Google Gemini</span> (Flash/Pro con visión),{" "}
            <span className="text-foreground">OpenAI GPT-5 / GPT-5 mini</span> con visión,{" "}
            <span className="text-foreground">Anthropic Claude</span> con visión, o alternativas
            autoalojadas como <span className="text-foreground">Llama 3.2 Vision 90B</span> para
            municipios que prioricen soberanía de datos.
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Su rol es de auditoría y coordinación, nunca de ejecución: revisan lotes de decisiones
            tomadas por el borde para detectar sesgos o errores sistemáticos, generan informes en
            lenguaje natural legibles por un funcionario municipal sin formación técnica, ajustan
            parámetros de política por corredor (por ejemplo, extender la ventana de onda verde en
            Av. San Martín los viernes por la tarde) y detectan patrones semanales de congestión o
            incidentes que ningún modelo de borde, por diseño de memoria acotada, puede ver.
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Es imprescindible remarcar el límite: este nivel{" "}
            <span className="text-signal-amber">jamás integra el lazo crítico de seguridad</span>.
            Su latencia (segundos, sujeta a red) y su dependencia de conectividad externa lo
            inhabilitan para decidir en tiempo real sobre luces en conflicto. Es un analista de
            gabinete, no un agente parado en la esquina.
          </p>
        </Section>

        <Section
          id="casos"
          eyebrow="Comportamiento emergente"
          title="Qué puede hacer el semáforo-agente con esta pila"
        >
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                t: "Camión de reparto vs. cola real",
                d: "El detector ve vehículos detenidos en fila; el VLM observa que el primero tiene las balizas puestas y una persona descargando cajas, y clasifica la situación como obstrucción puntual, no como demanda de verde adicional.",
              },
              {
                t: "Peatón mayor o con movilidad reducida",
                d: "El VLM identifica bastón, silla de ruedas o paso lento y extiende el verde peatonal más allá del tiempo estándar, priorizando seguridad sobre fluidez vehicular.",
              },
              {
                t: "Ambulancia o bomberos",
                d: "La combinación de forma del vehículo, balizas intermitentes y —cuando hay micrófono— patrón acústico de sirena dispara con alta confianza la apertura de un corredor de emergencia en el eje correspondiente.",
              },
              {
                t: "Moto en contramano o cruce en rojo",
                d: "El tracking detecta una trayectoria anómala respecto del flujo esperado; el VLM la describe y el sistema registra el evento con evidencia visual para labrado de infracción, sin intervenir sobre las luces.",
              },
              {
                t: "Madrugada con un único vehículo",
                d: "Ante baja densidad y ausencia de conflicto, el sistema libera el verde antes del tiempo fijo nocturno para reducir el tiempo de exposición del conductor en un cruce vacío, un factor de riesgo de seguridad personal.",
              },
              {
                t: "Calzada anegada o vehículo varado",
                d: "El VLM reconoce el patrón visual de agua estancada o un vehículo inmóvil fuera de patrón de tránsito normal y genera una alerta de mantenimiento vial, además de ajustar el ciclo para evitar acumulación.",
              },
              {
                t: "Ciclista en giro conflictivo",
                d: "El tracking identifica un ciclista aproximándose a un giro vehicular y el sistema puede introducir una breve fase protegida, algo que un temporizador fijo no contempla.",
              },
              {
                t: "Onda verde con la esquina vecina",
                d: "El Nivel 3 correla los tiempos de ciclo de intersecciones consecutivas del mismo corredor y ajusta desfasajes para sostener una onda verde, informando al Nivel 2 de cada esquina la ventana recomendada.",
              },
            ].map((c) => (
              <article key={c.t} className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-base font-semibold text-foreground">{c.t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.d}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section
          id="contrato"
          eyebrow="Seguridad"
          title="Contrato de decisión: el VLM propone, un validador determinista dispone"
        >
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Ningún modelo probabilístico comanda el semáforo de forma directa. El VLM del Nivel 2
            emite una <span className="text-foreground">intención estructurada</span> en JSON, con
            acción sugerida, eje afectado, duración propuesta, motivo en lenguaje natural y un
            grado de confianza. Esa intención pasa siempre por un{" "}
            <span className="text-foreground">validador determinista de reglas duras</span>,
            escrito como una máquina de estados clásica, que aplica sin excepción: tiempos mínimos
            peatonales, tiempo de entreverde, ámbar fijo de 3 segundos, todo-rojo de seguridad,
            prohibición absoluta de verdes en conflicto, límites T_min/T_max por fase e histéresis
            para evitar oscilaciones. El validador puede rechazar, recortar o directamente ignorar
            cualquier intención que viole una regla, sin excepción ni bypass.
          </p>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 font-mono text-[11px] font-semibold tracking-[0.25em] text-muted-foreground uppercase">
                Ejemplo de intención estructurada
              </h3>
              <CodeBlock code={INTENT_JSON} />
            </div>
            <div>
              <h3 className="mb-3 font-mono text-[11px] font-semibold tracking-[0.25em] text-muted-foreground uppercase">
                Ejemplo de prompt de sistema del agente
              </h3>
              <CodeBlock code={SYSTEM_PROMPT} />
            </div>
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            El mecanismo de <span className="text-foreground">fail-safe</span> es simple y
            deliberadamente conservador: si la percepción deja de ser confiable —cámara tapada,
            modelo caído, latencia fuera de rango, confianza sistemáticamente baja— el controlador
            abandona el modo adaptativo y retoma automáticamente un{" "}
            <span className="text-signal-amber">ciclo fijo pregrabado</span>, homologado y
            validado en banco, hasta que se restablezca la percepción confiable o intervenga
            personal de mantenimiento.
          </p>
        </Section>

        <Section id="latencia" eyebrow="Presupuesto de tiempo" title="Latencia extremo a extremo (orden de magnitud)">
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Los valores siguientes son estimaciones de referencia por etapa, no mediciones
            certificadas de un banco de pruebas específico; su función es mostrar por qué el lazo
            reflejo puede mantenerse bajo 70 ms mientras el razonamiento contextual, más lento,
            queda desacoplado del ciclo crítico.
          </p>
          <div className="mt-4">
            <DataTable head={["Etapa", "Latencia estimada", "Comentario"]} rows={LATENCY_ROWS} />
          </div>
        </Section>

        <Section
          id="casero"
          eyebrow="Camino de adopción"
          title="De la Raspberry Pi al Jetson: qué se gana y qué se pierde"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-mono text-[11px] font-semibold tracking-[0.25em] text-signal-green uppercase">
                Hoy, camino casero
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Con una Raspberry Pi 5, una cámara USB o IP económica, YOLOv8/v11 en su variante
                nano y Ollama sirviendo SmolVLM2 o Moondream 2, es posible armar un prototipo
                funcional de mesa: detecta vehículos y peatones, y responde preguntas simples
                sobre la escena a un ritmo de una consulta cada pocos segundos. Es honesto decir
                que a esa escala el razonamiento es lento, la tasa de cuadros del VLM es baja y no
                hay margen para operar como lazo de seguridad real; sirve para validar el concepto
                y demostrar la arquitectura, no para desplegar en vía pública.
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-mono text-[11px] font-semibold tracking-[0.25em] text-muted-foreground uppercase">
                Al pasar a Jetson
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                La Jetson Orin Nano aporta una GPU CUDA con soporte nativo de TensorRT, lo que
                multiplica la velocidad de inferencia tanto del detector como del VLM cuantizado,
                habilita correr Qwen2.5-VL 3B con latencia sub-segundo y sostiene el detector muy
                por debajo del umbral de 40 ms. Es el salto que permite pasar de una demostración
                de escritorio a un piloto en una intersección real, con margen térmico y de cómputo
                para correr ambos niveles de forma simultánea y estable.
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-mono text-[11px] font-semibold tracking-[0.25em] text-muted-foreground uppercase">
                Etapa institucional
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                La homologación ante autoridad de aplicación, la integración certificada con
                controladores NTCIP, la redundancia de hardware, el monitoreo centralizado y la
                capa de auditoría del Nivel 3 con modelos de nube quedan reservados a la fase de
                despliegue municipal, donde el costo y la responsabilidad legal exigen procesos de
                certificación que un prototipo casero, por definición, no puede ni debe eludir.
              </p>
            </article>
          </div>
        </Section>
      </div>
    </main>
  );
}
