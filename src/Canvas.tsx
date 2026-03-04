import { useEffect, useRef } from "react";
import { useInternalCameraKit } from "./CameraKitProvider";

export interface CanvasChildProps {
  className?: string;
  style?: React.CSSProperties;
}

// --- Internal helper hookup -------------------------------------------------
function attachCanvas(container: HTMLElement, canvas: HTMLCanvasElement) {
  if (!container.contains(canvas)) container.appendChild(canvas);
}

function detachCanvas(container: HTMLElement | null, canvas: HTMLCanvasElement) {
  if (container?.contains(canvas)) container.removeChild(canvas);
}

// --- Live child -------------------------------------------------------------
export const LiveCanvas: React.FC<CanvasChildProps> = ({ className, style }) => {
  const { currentSession } = useInternalCameraKit();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentSession || !containerRef.current) return;

    attachCanvas(containerRef.current, currentSession.output.live);
    currentSession.play("live");

    return () => {
      detachCanvas(containerRef.current, currentSession.output.live);
      currentSession.pause("live");
    };
  }, [currentSession]);

  return <div ref={containerRef} className={className} style={style} />;
};

// --- Capture child ----------------------------------------------------------
export const CaptureCanvas: React.FC<CanvasChildProps> = ({ className, style }) => {
  const { currentSession } = useInternalCameraKit();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentSession || !containerRef.current) return;

    attachCanvas(containerRef.current, currentSession.output.capture);
    currentSession.play("capture");

    return () => {
      detachCanvas(containerRef.current!, currentSession.output.capture);
      currentSession.pause("capture");
    };
  }, [currentSession]);

  return <div ref={containerRef} className={className} style={style} />;
};
