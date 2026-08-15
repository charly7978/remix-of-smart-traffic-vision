import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { connectDualCameraStream, type DetectionFrame } from "@/lib/realVision/client";
import { TwinController } from "@/lib/traffic/twinController";
import { TwinViewport } from "@/components/simulator/TwinViewport";

export const Route = createFileRoute("/presentacion")({
  head: () => ({
    meta: [
      { title: "Presentación — Ameghino AI · Percepción × Control" },
      {
        name: "description",
        content:
          "Modo presentación ejecutiva del sistema Ameghino AI: dos cámaras en vivo alimentan un gemelo digital que demuestra el control adaptativo en tiempo real.",
      },
    ],
  }),
  component: PresentacionPage,
});

const SCENES = [
  {
    id: "bienvenida",
    title: "Cruce Inteligente · Av. San Martín × Av. Urquiza",
    narration:
      "Bienvenido al sistema Ameghino AI. Dos cámaras con visión artificial observan el cruce en tiempo real. A la izquierda, la percepción: detección y medición de colas. A la derecha, el gemelo digital: la inteligencia que controla los semáforos.",
    seconds: 30,
  },
  {
    id: "pico",
    title: "Hora Pico: Demanda Alta en el Eje N-S",
    narration:
      "El flujo de vehículos aumenta. La IA mide colas en cada acceso y extiende el verde proporcionalmente a la demanda real observada, sin depender de un plan fijo grabado hace años.",
    seconds: 25,
  },
  {
    id: "noche",
    title: "Seguridad Nocturna: Modo Baja Demanda",
    narration:
      "Cuando la demanda es baja y no hay peatones, el sistema acorta los tiempos de espera. Reduce la exposición innecesaria de conductores en la madrugada, mejorando la seguridad y reduciendo emisiones.",
    seconds: 25,
  },
  {
    id: "emergencia",
    title: "Corredor Verde de Emergencia",
    narration:
      "Si un vehículo de emergencia es detectado, el sistema abre un corredor verde automático. Las ambulancias o patrullas no esperan en el semáforo. Cada segundo cuenta y el sistema lo entiende.",
    seconds: 25,
  },
  {
    id: "impacto",
    title: "Auditoría y Confianza: Cada Decisión Queda Registrada",
    narration:
      "Cada decisión del agente queda registrada con su evidencia observada, el razonamiento y el contrato JSON publicado al controlador. Esto permite auditar, mejorar y certificar el sistema.",
    seconds: 30,
  },
];
function PresentacionPage() {
  const [sceneIdx, setSceneIdx] = useState(0); const [status, setStatus] = useState<"connecting"|"live"|"error">("connecting");
  const [imageA, setImageA] = useState<string|null>(null); const [imageB, setImageB] = useState<string|null>(null);
  const twinRef = useRef<TwinController|null>(null); const intervalRef = useRef<number|null>(null);
  const [sceneProgress, setSceneProgress] = useState(0); const scene = SCENES[sceneIdx]!;
  useEffect(()=>{twinRef.current=new TwinController();return()=>{twinRef.current=null;};},[]);
  useEffect(()=>{if(!twinRef.current)return;setStatus("connecting");
    const ws=connectDualCameraStream("london-a10-carterhatch-lane","london-camberwell-church-street",
      (f:DetectionFrame)=>{setStatus("live");if(f.rawImage)setImageA(f.rawImage);if(f.rawImageB)setImageB(f.rawImageB);if(f.twin&&twinRef.current)twinRef.current.ingest(f.twin,Date.now());},
      ()=>{setStatus("error");});return()=>{try{ws.close();}catch{}};},[]);
  useEffect(()=>{const total=scene.seconds;intervalRef.current=window.setInterval(()=>{
    setSceneProgress(p=>{const n=p+1;if(n>=total){setSceneIdx(i=>Math.min(i+1,SCENES.length-1));return 0;}return n;});},1000);
    return()=>{if(intervalRef.current!==null)window.clearInterval(intervalRef.current);setSceneProgress(0);};},[sceneIdx,scene.seconds]);
  const goToScene=(i:number)=>{setSceneIdx(Math.max(0,Math.min(i,SCENES.length-1)));setSceneProgress(0);};
  return(<div className="fixed inset-0 z-50 flex flex-col bg-[#0b0e14] text-white">
    <div className="flex items-center justify-between border-b border-white/10 bg-black/60 px-6 py-3">
      <div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 font-mono text-[10px] tracking-widest ${status==="live"?"bg-emerald-500/20 text-emerald-400":status==="connecting"?"bg-amber-500/20 text-amber-400":"bg-red-500/20 text-red-400"}`}>{status==="live"?"● EN VIVO":status==="connecting"?"CONECTANDO...":"ERROR"}</span><h1 className="font-mono text-sm font-bold">AMEGHINO AI · Presentación</h1></div>
      <div className="flex items-center gap-2"><span className="font-mono text-[11px] text-white/40">Escena {sceneIdx+1} de {SCENES.length}</span>{SCENES.map((_,i)=>(<button key={i} onClick={()=>goToScene(i)} className={`size-2 rounded-full transition-all ${i===sceneIdx?"bg-emerald-400 scale-125":"bg-white/20 hover:bg-white/40"}`}/>))}</div>
    </div>
    <div className="flex flex-1 gap-2 p-2 overflow-hidden">
      <div className="flex w-1/2 flex-col gap-2">
        <div className="flex-1 rounded-xl border border-white/10 bg-black/40 p-2 relative overflow-hidden"><div className="absolute top-3 left-3 z-10 rounded bg-black/70 px-2 py-1 font-mono text-[10px] text-sky-300">📡 EJE A · N-S — Percepción</div>{imageA?<img src={`data:image/jpeg;base64,${imageA}`} alt="" className="h-full w-full rounded-lg object-cover"/>:<div className="flex h-full items-center justify-center font-mono text-xs text-white/30">Esperando video...</div>}</div>
        <div className="flex-1 rounded-xl border border-white/10 bg-black/40 p-2 relative overflow-hidden"><div className="absolute top-3 left-3 z-10 rounded bg-black/70 px-2 py-1 font-mono text-[10px] text-amber-300">📡 EJE B · E-O — Percepción</div>{imageB?<img src={`data:image/jpeg;base64,${imageB}`} alt="" className="h-full w-full rounded-lg object-cover"/>:<div className="flex h-full items-center justify-center font-mono text-xs text-white/30">Esperando video...</div>}</div>
      </div>
      <div className="flex w-1/2 flex-col rounded-xl border border-emerald-500/30 bg-black/60 p-3 relative"><div className="absolute top-3 left-3 z-10 rounded bg-emerald-900/80 px-2 py-1 font-mono text-[10px] text-emerald-300">🎮 GEMELO DIGITAL — Control Adaptativo</div><div className="flex flex-1 items-center justify-center">{twinRef.current?<TwinViewport controller={twinRef.current} width={640} height={640}/>:<span className="font-mono text-xs text-white/30">Inicializando gemelo...</span>}</div></div>
    </div>
    <div className="border-t border-white/10 bg-black/80 px-6 py-4"><div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{width:`${(sceneProgress/scene.seconds)*100}%`}}/></div>
      <div className="flex items-start justify-between"><div className="max-w-3xl"><p className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">{scene.title}</p><p className="mt-1 font-mono text-sm leading-relaxed text-white/80">{scene.narration}</p></div>
        <div className="flex items-center gap-2"><button onClick={()=>goToScene(sceneIdx-1)} className="rounded border border-white/20 px-3 py-1 font-mono text-xs hover:bg-white/10">← Anterior</button><button onClick={()=>goToScene(sceneIdx+1)} className="rounded border border-white/20 px-3 py-1 font-mono text-xs hover:bg-white/10">Siguiente →</button></div>
      </div>
    </div>
  </div>);
}