import { useEffect, useState, useRef } from "react";
import { type Approach } from "@/lib/traffic/engine";
import {
  REAL_LANES,
  REAL_CROSSWALKS,
  REAL_SIGNAL_ANCHORS,
  type LaneCalibration,
  type RealCrosswalk,
  type RealSignalAnchor,
} from "@/lib/photo/photoGeometry";

interface DragState {
  type: "lane" | "crosswalk" | "signal";
  id: string; // "N", "S", "EW-0-from", etc.
  index?: number;
}

export function GeometryEditor({ onClose }: { onClose: () => void }) {
  const [lanes, setLanes] = useState<Record<Approach, LaneCalibration>>(() =>
    JSON.parse(JSON.stringify(REAL_LANES)),
  );
  const [crosswalks, setCrosswalks] = useState<Record<"NS" | "EW", [RealCrosswalk, RealCrosswalk]>>(
    () => JSON.parse(JSON.stringify(REAL_CROSSWALKS)),
  );
  const [signals, setSignals] = useState<RealSignalAnchor[]>(() =>
    JSON.parse(JSON.stringify(REAL_SIGNAL_ANCHORS)),
  );

  const [drag, setDrag] = useState<DragState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Sincronizar en tiempo real mutando los objetos originales para que el motor
  // renderice la nueva geometría inmediatamente.
  useEffect(() => {
    Object.assign(REAL_LANES, lanes);
    Object.assign(REAL_CROSSWALKS, crosswalks);
    // Para arrays reasignamos los elementos
    signals.forEach((s, i) => {
      REAL_SIGNAL_ANCHORS[i] = s;
    });
  }, [lanes, crosswalks, signals]);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (800 / rect.width);
    const y = (e.clientY - rect.top) * (800 / rect.height);

    if (drag.type === "lane") {
      setLanes((prev) => {
        const next = { ...prev };
        const app = drag.id as Approach;
        next[app].ctrlPoints[drag.index!] = [next[app].ctrlPoints[drag.index!]![0]!, x, y];
        return next;
      });
    } else if (drag.type === "crosswalk") {
      setCrosswalks((prev) => {
        const next = { ...prev };
        const [axis, idxStr, part] = drag.id.split("-");
        const a = axis as "NS" | "EW";
        const idx = parseInt(idxStr!);
        const p = part as "from" | "to";
        next[a][idx]![p] = { x, y };
        return next;
      });
    } else if (drag.type === "signal") {
      setSignals((prev) => {
        const next = [...prev];
        next[drag.index!] = { ...next[drag.index!]!, x, y };
        return next;
      });
    }
  };

  const handlePointerUp = () => {
    setDrag(null);
  };

  const copyToClipboard = () => {
    const json = JSON.stringify({ lanes, crosswalks, signals }, null, 2);
    navigator.clipboard.writeText(json).catch((e) => console.error(e));
    console.log("=== NUEVA GEOMETRIA ===");
    console.log(json);
    alert("Geometría copiada al portapapeles y mostrada en consola. ¡Pásasela al asistente!");
  };

  return (
    <div className="absolute inset-0 z-50 overflow-hidden pointer-events-auto bg-black/30">
      <div className="absolute top-4 left-4 bg-slate-900/90 text-white p-4 rounded-lg border border-slate-700 shadow-2xl backdrop-blur-md max-w-sm">
        <h2 className="text-lg font-bold text-emerald-400 mb-2 font-mono">
          Modo Calibración Visual
        </h2>
        <p className="text-xs text-slate-300 mb-4">
          Arrastra los puntos amarillos (carriles), verdes (sendas) y rojos (semáforos) para
          alinearlos perfectamente con la foto.
        </p>
        <div className="flex gap-2">
          <button
            onClick={copyToClipboard}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-3 rounded shadow"
          >
            Copiar Geometría
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-2 px-3 rounded shadow"
          >
            Cerrar (C)
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 800 800"
        className="w-full h-full cursor-crosshair"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* CARRILES */}
        {Object.entries(lanes).map(([app, lane]) => {
          return (
            <g key={`lane-${app}`}>
              <polyline
                points={lane.ctrlPoints.map((p) => `${p[1]},${p[2]}`).join(" ")}
                fill="none"
                stroke="rgba(250, 204, 21, 0.4)"
                strokeWidth="4"
                strokeDasharray="8 8"
              />
              {lane.ctrlPoints.map((p, i) => (
                <circle
                  key={`lane-${app}-${i}`}
                  cx={p[1]}
                  cy={p[2]}
                  r="8"
                  fill="#facc15"
                  stroke="#854d0e"
                  strokeWidth="2"
                  className="cursor-grab active:cursor-grabbing hover:r-12 transition-all"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setDrag({ type: "lane", id: app, index: i });
                  }}
                />
              ))}
            </g>
          );
        })}

        {/* SENDAS PEATONALES */}
        {Object.entries(crosswalks).map(([axis, pairs]) => {
          return pairs.map((pair, idx) => (
            <g key={`cw-${axis}-${idx}`}>
              <line
                x1={pair.from.x}
                y1={pair.from.y}
                x2={pair.to.x}
                y2={pair.to.y}
                stroke="rgba(74, 222, 128, 0.5)"
                strokeWidth="20"
              />
              {["from", "to"].map((part) => {
                const pt = pair[part as "from" | "to"];
                return (
                  <circle
                    key={`cw-${axis}-${idx}-${part}`}
                    cx={pt.x}
                    cy={pt.y}
                    r="8"
                    fill="#4ade80"
                    stroke="#166534"
                    strokeWidth="2"
                    className="cursor-grab active:cursor-grabbing hover:r-12 transition-all"
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setDrag({ type: "crosswalk", id: `${axis}-${idx}-${part}` });
                    }}
                  />
                );
              })}
            </g>
          ));
        })}

        {/* SEMÁFOROS */}
        {signals.map((sig, i) => (
          <g key={`sig-${i}`}>
            <circle
              cx={sig.x}
              cy={sig.y}
              r="8"
              fill="#ef4444"
              stroke="#7f1d1d"
              strokeWidth="2"
              className="cursor-grab active:cursor-grabbing hover:r-12 transition-all"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setDrag({ type: "signal", id: "signal", index: i });
              }}
            />
            <text x={sig.x + 12} y={sig.y + 4} fill="#fca5a5" fontSize="12" fontWeight="bold">
              Poste {sig.approach}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
