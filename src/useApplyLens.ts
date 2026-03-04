import { useEffect, useMemo, useRef } from "react";
import { LensLaunchData } from "@snap/camera-kit";
import hash from "stable-hash";
import { useInternalCameraKit } from "./CameraKitProvider";

/**
 * Declaratively applies a Lens to the current CameraKit session.
 *
 * This hook synchronizes the active lens with the provided parameters. When the lens ID,
 * group ID, or launch data changes, the hook automatically applies the new lens or removes
 * the current lens if parameters are cleared.
 *
 * @param lensId - The unique identifier of the lens to apply. If undefined, removes the current lens.
 * @param lensGroupId - The group ID containing the lens. Required when lensId is provided.
 * @param lensLaunchData - Optional launch parameters to pass to the lens.
 * @param lensReadyGuard - Optional async guard that must resolve before the lens is considered ready.
 *                         Useful for coordinating lens application with animations or other async operations.
 *
 * @example
 * ```tsx
 * // Simple lens application
 * useApplyLens("lens-id-123", "my-group");
 *
 * // With launch data
 * useApplyLens("lens-id-123", "my-group", { launchParams: { hint: "face" } });
 * ```
 */
export function useApplyLens(
  lensId?: string,
  lensGroupId?: string,
  lensLaunchData?: LensLaunchData,
  lensReadyGuard?: () => Promise<void>,
) {
  const { cameraKit, sdkStatus, currentSession, applyLens, removeLens, getLogger } = useInternalCameraKit();
  const log = getLogger("useApplyLens");

  const launchKey = hash(lensLaunchData);
  const safeLaunchData = useMemo(() => lensLaunchData, [launchKey]);

  // Don’t put lensReadyGuard in the dependency array of the “apply-lens” effect:
  // the caller often passes it as an inline function, so its identity
  // changes on every render. Re-running the whole lens-apply sequence just
  // because the guard’s reference changed doesn't make any sense.
  // It does make sense ony next time lens is applied.
  // Instead, we store the latest guard in a ref that we update after each re-render.
  const guardRef = useRef(lensReadyGuard);
  useEffect(() => {
    guardRef.current = lensReadyGuard;
  });

  //  Synchronize the current CameraKit session with the requested Lens.
  //   * Runs when lensId, lensGroupId, or lensLaunchData meaningfully change (see stable-key check).
  //   * Applies the Lens once, with an abort-guard so late resolutions don’t touch an unmounted component.
  useEffect(() => {
    if (sdkStatus !== "ready" || !cameraKit || !currentSession) return;

    if (!lensId || !lensGroupId) {
      removeLens();
      return;
    }

    let cancelled = false;
    const started = performance.now();

    log.info("apply_attempt", { lensId, groupId: lensGroupId });

    (async () => {
      try {
        await applyLens(lensId, lensGroupId, safeLaunchData, guardRef.current);
        if (cancelled) {
          await removeLens();
          return;
        }
        log.info("apply_success", {
          lensId,
          groupId: lensGroupId,
          elapsedMs: Math.round(performance.now() - started),
        });
      } catch (err) {
        if (cancelled) return;
        log.error("apply_failure", { lensId, groupId: lensGroupId }, err);
      }
    })();

    return () => {
      cancelled = true;
      removeLens().catch((err) => {
        log.warn("remove_on_unmount_failed", { lensId, groupId: lensGroupId }, err);
      });
    };
  }, [lensId, lensGroupId, launchKey, sdkStatus, cameraKit, currentSession, applyLens, removeLens, log]);
}
