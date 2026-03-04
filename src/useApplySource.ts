import { useEffect, useMemo } from "react";
import hash from "stable-hash";
import { useInternalCameraKit } from "./CameraKitProvider";
import { OutputSize, SourceInput } from "./types";

/**
 * Declarative hook to apply a source to the current CameraKit session.
 * This is a thin wrapper around the imperative `applySource` and `removeSource` methods
 * exposed by `useCameraKit()`.
 *
 * @param source - The source input (camera, video, or image)
 * @param outputSize - Optional output size configuration
 */
export function useApplySource(source: SourceInput = { kind: "camera" }, outputSize?: OutputSize) {
  const { cameraKit, sdkStatus, currentSession, applySource, removeSource, getLogger } = useInternalCameraKit();
  const log = getLogger("useApplySource");

  // Keeps the same source instance while `sourceKey` stays equal,
  // this is needed because source can be provided as a regular inline object,
  // which is recreated on each re-render.
  const sourceKey = hash(source);
  const safeSource = useMemo(() => source, [sourceKey]);

  // Stabilize outputSize reference to avoid unnecessary re-applications
  const outputSizeKey = hash(outputSize);
  const safeOutputSize = useMemo(() => outputSize, [outputSizeKey]);

  // Synchronize the current CameraKit session with the requested source.
  // Runs when source or outputSize meaningfully change (see stable-key check).
  // Applies the source once, with an abort-guard so late resolutions don't affect unmounted components.
  useEffect(() => {
    if (sdkStatus !== "ready" || !cameraKit || !currentSession) return;

    let cancelled = false;
    const started = performance.now();

    log.info("source_apply_attempt", { kind: safeSource.kind });

    (async () => {
      try {
        await applySource(safeSource, safeOutputSize);
        if (cancelled) {
          log.info("source_remove_attempt", { kind: safeSource.kind, reason: "cancelled" });
          await removeSource();
          return;
        }
        log.info("source_apply_success", {
          kind: safeSource.kind,
          elapsedMs: Math.round(performance.now() - started),
        });
      } catch (err) {
        if (cancelled) return;
        log.error("source_apply_failure", { kind: safeSource.kind }, err);
      }
    })();

    return () => {
      cancelled = true;
      log.info("source_remove_attempt", { kind: safeSource.kind, reason: "cleanup" });
      removeSource().catch((err) => {
        log.warn("source_remove_on_unmount_failed", { kind: safeSource.kind }, err);
      });
    };
  }, [safeSource, safeOutputSize, sdkStatus, cameraKit, currentSession, applySource, removeSource, log]);
}
