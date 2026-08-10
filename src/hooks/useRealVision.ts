import { useEffect, useRef, useCallback } from "react";
import type { DetectionFrame } from "@/lib/traffic/types";
import { connectCameraStream, type CameraSource } from "@/lib/realVision/client";

export function useRealVision(opts: {
  cameraId: string | null;
  enabled: boolean;
  onFrame: (frame: DetectionFrame) => void;
  onError: (error: Error) => void;
}) {
  const wsRef = useRef<ReturnType<typeof connectCameraStream> | null>(null);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!opts.enabled || !opts.cameraId) {
      cleanup();
      return;
    }

    cleanup();
    wsRef.current = connectCameraStream(opts.cameraId, opts.onFrame, opts.onError);

    return cleanup;
  }, [opts.enabled, opts.cameraId, opts.onFrame, opts.onError, cleanup]);

  return { cleanup };
}
