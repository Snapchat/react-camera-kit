import { useEffect, useRef, useState } from "react";
import { ComputedFrameMetrics, LensPerformanceMeasurement } from "@snap/camera-kit";
import { useInternalCameraKit } from "./CameraKitProvider";

interface UseLensFrameMetricsOptions {
  /** Polling interval in milliseconds. How often measurement.measure() is called to update state. */
  interval: number;
  /** Whether measurement is active. Defaults to true. When false, no measurement is started and the hook returns undefined. */
  enabled?: boolean;
}

/**
 * Declaratively measures lens rendering performance.
 *
 * This hook manages the lifecycle of a {@link LensPerformanceMeasurement} from the CameraKit SDK.
 * It begins measurement when a session is available, polls at the specified interval,
 * resets when the active lens changes, and cleans up on unmount.
 *
 * @param options - Configuration options
 * @returns The latest computed frame metrics, or undefined if no session is available.
 *
 * @example
 * ```tsx
 * function PerformanceOverlay() {
 *   const metrics = useLensFrameMetrics({ interval: 500 });
 *
 *   if (!metrics) return null;
 *
 *   return <div>FPS: {metrics.avgFps.toFixed(1)}</div>;
 * }
 * ```
 */
export function useLensFrameMetrics(options: UseLensFrameMetricsOptions): ComputedFrameMetrics | undefined {
  const { enabled = true } = options;
  const { currentSession, lens } = useInternalCameraKit();
  const [metrics, setMetrics] = useState<ComputedFrameMetrics | undefined>(undefined);
  const measurementRef = useRef<LensPerformanceMeasurement | null>(null);
  const isFirstLensRender = useRef(true);

  // Begin/end measurement and set up polling interval
  useEffect(() => {
    if (!currentSession || !enabled) {
      setMetrics(undefined);
      return;
    }

    const measurement = currentSession.metrics.beginMeasurement();
    measurementRef.current = measurement;

    const intervalId = setInterval(() => {
      setMetrics(measurement.measure());
    }, options.interval);

    return () => {
      clearInterval(intervalId);
      measurement.end();
      measurementRef.current = null;
      isFirstLensRender.current = true;
    };
  }, [currentSession, options.interval, enabled]);

  // Reset measurement when lens changes (skip on initial mount)
  useEffect(() => {
    if (isFirstLensRender.current) {
      isFirstLensRender.current = false;
      return;
    }
    measurementRef.current?.reset();
  }, [lens.lensId]);

  return metrics;
}
