from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from detector import DetectionFrame, Vehicle


@dataclass
class Evidence:
    axis: str
    sigma: float
    sigma_other: float
    ped_waiting_other: int
    reduced_waiting: bool
    visibility: float
    detection_rate: float
    weather: str
    emergency_approach: bool | None


@dataclass
class AgentDecision:
    hour: float
    axis: str
    seconds: float
    action: str
    rationale: str
    confidence: float
    latency_ms: float
    source: str
    evidence: Evidence
    contract: dict[str, Any]


EVIDENCE_LOG = Path(__file__).resolve().parent / "evidence_logs" / "evidence.jsonl"
EVIDENCE_LOG.parent.mkdir(parents=True, exist_ok=True)


def _snap(values: list[float], value: float, step: float) -> float:
    return min(values, key=lambda x: abs(x - value))


def detections_to_evidence(detections: DetectionFrame, current_axis: str) -> Evidence:
    other = "EW" if current_axis == "NS" else "NS"
    sigma = max(1.0, detections.lane_density.get(current_axis, 0.0))
    sigma_other = max(0.0, detections.lane_density.get(other, 0.0))
    ped_waiting = len(detections.pedestrians)
    return Evidence(
        axis=current_axis,
        sigma=sigma,
        sigma_other=sigma_other,
        ped_waiting_other=ped_waiting if other != current_axis else 0,
        reduced_waiting=False,
        visibility=0.85 if not detections.is_night else 0.55,
        detection_rate=0.9 if detections.vehicles else 0.0,
        weather=detections.weather,
        emergency_approach=detections.emergency_detected or None,
    )


def auto_decide(evidence: Evidence, config: dict[str, Any] | None = None) -> AgentDecision:
    config = config or {}
    beta = float(config.get("beta", 3.0))
    t_min = float(config.get("t_min", 10.0))
    t_max = float(config.get("t_max", 70.0))
    ped_boost = float(config.get("ped_boost", 12.0))
    emergency_boost = float(config.get("emergency_boost", 20.0))

    seconds = max(t_min, min(t_max, beta * evidence.sigma))
    if evidence.emergency_approach:
        seconds = max(seconds, t_min + emergency_boost)
    if evidence.ped_waiting_other > 0:
        seconds += ped_boost

    if evidence.emergency_approach:
        action = "EXTENDER_VERDE_POR_EMERGENCIA"
        rationale = "Vehículo de emergencia detectado: priorizar eje sin demorar abordaje."
    elif evidence.sigma_other > evidence.sigma and evidence.ped_waiting_other == 0:
        action = "EXTENDER_VERDE_EJE_CON_DEMANDA"
        rationale = "El eje secundario muestra mayor demanda y el cruce está libre."
    elif evidence.sigma < 3 and evidence.ped_waiting_other == 0:
        action = "VERDE_INMEDIATO_SIN_CONFLICTO"
        rationale = "Demanda baja y sin conflicto: liberar verde para reducir exposición."
    else:
        action = "MANTENER_CICLO_ADAPTATIVO"
        rationale = "Mantener fase actual con ajuste por densidad y condiciones."

    confidence = max(0.0, min(1.0, 0.65 + evidence.detection_rate * 0.35))
    contract = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "action": action,
        "seconds": round(seconds, 1),
        "axis": evidence.axis,
        "confidence": round(confidence, 2),
        "evidence": {
            "sigma": round(evidence.sigma, 2),
            "sigma_other": round(evidence.sigma_other, 2),
            "pedestrians": evidence.ped_waiting_other,
            "weather": evidence.weather,
            "emergency": bool(evidence.emergency_approach),
        },
    }

    decision = AgentDecision(
        hour=0.0,
        axis=evidence.axis,
        seconds=seconds,
        action=action,
        rationale=rationale,
        confidence=confidence,
        latency_ms=42.0,
        source="detector",
        evidence=evidence,
        contract=contract,
    )

    _log(decision)
    return decision


def _log(decision: AgentDecision) -> None:
    try:
        with EVIDENCE_LOG.open("a", encoding="utf-8") as f:
            row = {
                "ts": datetime.utcnow().isoformat() + "Z",
                "action": decision.action,
                "seconds": round(decision.seconds, 1),
                "axis": decision.axis,
                "confidence": round(decision.confidence, 2),
                "rationale": decision.rationale,
            }
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    except Exception:
        pass
