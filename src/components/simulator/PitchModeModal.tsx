import { useState, useEffect } from "react";
import { 
  Play, 
  Pause, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Sparkles, 
  Radio, 
  CheckCircle2
} from "lucide-react";

interface PitchSlide {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  narrative: string;
  highlightMetric: { value: string; label: string };
  bullets: string[];
  actionLabel?: string;
  sceneTriggerId: string;
}

const PITCH_SLIDES: PitchSlide[] = [
  {
    id: "intro",
    badge: "3F MOVILIDAD INTELIGENTE",
    title: "Proyecto Carlos Ameghino — Caseros",
    subtitle: "Transformación Digital de la Red Semafórica de Tres de Febrero",
    narrative: "Un sistema de visión artificial que convierte la red estática de semáforos en agentes inteligentes en el borde. Diseñado específicamente para responder a los desafíos de seguridad y congestión del Conurbano Bonaerense.",
    highlightMetric: { value: "120", label: "Intersecciones objetivo en Tres de Febrero" },
    bullets: [
      "Visión artificial en el borde con placas industriales de bajo consumo",
      "Prioridad cero espera para conductores de madrugada (Seguridad Nocturna)",
      "Corredor dinámico de emergencia para ambulancias del SAME",
      "Reducción del 85% en costos comparado con multinacionales corporativas"
    ],
    actionLabel: "Iniciar Presentación de 4 Minutos",
    sceneTriggerId: "pico"
  },
  {
    id: "problema",
    badge: "DIAGNOSTICO ZONAL",
    title: "El Desafío de los Semáforos Fijos en Caseros",
    subtitle: "Pérdida de Tiempo, Emisiones y Exposición en la Vía Pública",
    narrative: "Las esquinas clave como Av. San Martín y Av. Urquiza operan con temporizadores rígidos fijados hace años. Esto genera embotellamientos innecesarios a las 8 AM y detenciones peligrosas a las 3 AM.",
    highlightMetric: { value: "48 min", label: "Perdidos por día por vecino en semáforos en rojo vacíos" },
    bullets: [
      "Esperas fantasma: semáforo en rojo sin tránsito en la otra arteria",
      "Vulnerabilidad nocturna: detenerse a la madrugada aumenta el riesgo de delito",
      "Toneladas de CO₂ generadas por autos acelerando desde ralentí en rojo",
      "Sistemas tradicionales importados cuestan hasta USD 20.000 por esquina"
    ],
    actionLabel: "Ver Solución Adaptativa 3D",
    sceneTriggerId: "pico"
  },
  {
    id: "solucion_3d",
    badge: "TECNOLOGIA EDGE IA",
    title: "Gemelo Digital & Redes Neuronales YOLOv11",
    subtitle: "Percibir, Analizar y Decidir en <200ms en el Gabinete de Esquina",
    narrative: "Cada semáforo cuenta con una cámara WDR de 4MP y procesador Jetson Orin Nano. La IA detecta autos, colectivos (líneas 343, 181), motos y peatones, calculando el flujo real y otorgando el verde según la demanda.",
    highlightMetric: { value: "-21%", label: "Reducción directa de demoras en hora pico" },
    bullets: [
      "Modelo YOLOv11 optimizado para el parque automotor argentino",
      "Sin dependencia de internet: procesa 100% en el gabinete local",
      "Ajuste de tiempos de entreverde según normativas de seguridad vial",
      "Seguimiento multiobjeto con matrices de densidad vehicular"
    ],
    actionLabel: "Probar Protocolo Nocturno",
    sceneTriggerId: "noche"
  },
  {
    id: "seguridad_nocturna",
    badge: "IMPACTO HUMANO & SEGURIDAD",
    title: "Protocolo Nocturno de Verde Bajo Demanda",
    subtitle: "El Semáforo Inteligente como Escudo de Seguridad Urbana",
    narrative: "Entre las 22:00 y las 06:00 hs, la IA detecta la aproximación de un vehículo único hacia el cruce desierto y habilita el verde de inmediato, eliminando la detención estática del conductor en la oscuridad.",
    highlightMetric: { value: "0,8s", label: "Tiempo de reacción para dar verde si el cruce está despejado" },
    bullets: [
      "Elimina la espera en rojo cuando no hay tránsito cruzado",
      "Protege al vecino de sufrir abordajes o encerronas nocturnas",
      "Mantiene strictly las fases de seguridad y amarillos",
      "Reconocimiento automático de velocidad y distancia de frenado"
    ],
    actionLabel: "Ver Prioridad Peatonal y SAME",
    sceneTriggerId: "peaton"
  },
  {
    id: "emergencia_peaton",
    badge: "VIDAS Y SALUD",
    title: "Prioridad Peatonal & Corredor de Emergencia SAME",
    subtitle: "Protección Integral de la Comunidad en la Vía Pública",
    narrative: "El sistema extiende automáticamente el cruce para peatones con movilidad reducida o adultos mayores, y abre la 'ola verde' para ambulancias del SAME y vehículos de bomberos que se dirigen al hospital.",
    highlightMetric: { value: "3,5 min", label: "Ahorrados en traslados de emergencia crítica" },
    bullets: [
      "Detección de personas en senda peatonal con temporizador extendido adaptativo",
      "Reconocimiento óptico y V2I de balizas de ambulancia SAME y Policía",
      "Transición fluida a ciclo habitual sin provocar sobresaltos en el tráfico",
      "Fail-safe determinista: ante falla de hardware revierte al plan fijo en <1s"
    ],
    actionLabel: "Ver Plan de Inversión y ROI",
    sceneTriggerId: "failsafe"
  },
  {
    id: "roi_municipal",
    badge: "MODELO ECONOMICO 3F",
    title: "Propuesta Financiera y Escalabilidad Municipal",
    subtitle: "Máxima Tecnología al Menor Costo del Mercado",
    narrative: "Un plan progresivo diseñado para la realidad presupuestaria municipal. Comenzando con un piloto de costo cero para el Municipio en 1 intersección crítica de Caseros antes de expandir al corredor principal.",
    highlightMetric: { value: "USD 2,04M", label: "Ahorro total estimado para 3F en 5 años de operación" },
    bullets: [
      "Costo por esquina: USD 3.000 (frente a USD 18.000–25.000 de competidores internacionales)",
      "Aprovecha el 100% de la infraestructura semafórica y gabinetes existentes",
      "Auditoría abierta y datos soberanos pertenecientes al Municipio de Tres de Febrero",
      "Piloto propuesto: Av. San Martín y Av. Urquiza (Caseros)"
    ],
    actionLabel: "Finalizar Presentación",
    sceneTriggerId: "pico"
  }
];

export function PitchModeModal({
  isOpen,
  onClose,
  onSelectScene,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectScene?: (sceneId: string) => void;
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const slide = PITCH_SLIDES[currentSlide]!;

  useEffect(() => {
    if (onSelectScene && slide.sceneTriggerId) {
      onSelectScene(slide.sceneTriggerId);
    }
  }, [currentSlide, onSelectScene, slide.sceneTriggerId]);

  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentSlide((prev) => {
          if (prev >= PITCH_SLIDES.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 12000);
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-green opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-signal-green" />
            </span>
            <div>
              <span className="font-mono text-xs font-bold tracking-widest text-signal-green uppercase">
                {slide.badge}
              </span>
              <p className="text-xs text-muted-foreground">Presentación Ejecutiva para Autoridades de Tres de Febrero</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition-colors ${
                isPlaying ? "bg-signal-amber/20 text-signal-amber border border-signal-amber/30" : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isPlaying ? "Pausar Modo Auto" : "Reproducir Presentación"}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Slide Content Body */}
        <div className="p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-12">
            {/* Left Column: Narrative & Metrics */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {slide.title}
                </h2>
                <h3 className="mt-1 text-sm font-medium text-signal-green">
                  {slide.subtitle}
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {slide.narrative}
                </p>

                <div className="mt-6 space-y-2.5">
                  {slide.bullets.map((b, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-signal-green mt-0.5" />
                      <span className="text-xs text-foreground/90 leading-normal">{b}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action button inside slide */}
              <div className="mt-8 flex items-center gap-4">
                <button
                  onClick={() => {
                    if (currentSlide < PITCH_SLIDES.length - 1) {
                      setCurrentSlide(currentSlide + 1);
                    } else {
                      onClose();
                    }
                  }}
                  className="flex items-center gap-2 rounded-xl bg-signal-green px-5 py-3 text-xs font-bold text-background transition-all hover:bg-signal-green/90 shadow-lg shadow-signal-green/20 cursor-pointer"
                >
                  <span>{slide.actionLabel || "Siguiente Diapositiva"}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>

                <span className="font-mono text-xs text-muted-foreground">
                  Paso {currentSlide + 1} de {PITCH_SLIDES.length}
                </span>
              </div>
            </div>

            {/* Right Column: Key Metric Highlight Card */}
            <div className="lg:col-span-5 flex flex-col justify-center">
              <div className="relative overflow-hidden rounded-2xl border border-signal-green/30 bg-gradient-to-br from-secondary/80 via-card to-background p-6 shadow-xl">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Sparkles className="h-32 w-32 text-signal-green" />
                </div>
                <p className="font-mono text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  Métrica Clave de Impacto
                </p>
                <p className="mt-3 font-mono text-4xl sm:text-5xl font-black text-signal-green tracking-tight">
                  {slide.highlightMetric.value}
                </p>
                <p className="mt-2 text-xs font-medium leading-relaxed text-foreground/90">
                  {slide.highlightMetric.label}
                </p>

                <div className="mt-6 pt-4 border-t border-border/60">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Radio className="h-3.5 w-3.5 text-signal-green animate-pulse" />
                    <span>Ubicación objetivo: Caseros, Tres de Febrero</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Slide Selector Footer */}
        <div className="flex items-center justify-between border-t border-border bg-secondary/30 px-6 py-3">
          <button
            disabled={currentSlide === 0}
            onClick={() => setCurrentSlide(currentSlide - 1)}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 font-mono text-xs disabled:opacity-30 hover:bg-secondary text-foreground cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>

          <div className="flex gap-1.5">
            {PITCH_SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentSlide ? "w-6 bg-signal-green" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                }`}
                title={`Ver diapositiva ${idx + 1}`}
              />
            ))}
          </div>

          <button
            disabled={currentSlide === PITCH_SLIDES.length - 1}
            onClick={() => setCurrentSlide(currentSlide + 1)}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 font-mono text-xs disabled:opacity-30 hover:bg-secondary text-foreground cursor-pointer"
          >
            Siguiente <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
