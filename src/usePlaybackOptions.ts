import { useEffect } from "react";
import { CameraKitSessionEvents, Lens, ScreenRegions } from "@snap/camera-kit";
import { useInternalCameraKit } from "./CameraKitProvider";

export interface PlaybackOptions {
  /**
   * A maximum FPS, rendering will not exceed this limit.
   *
   * This may be useful to reduce CPU/GPU resource usage by CameraKit if, for example,
   * the input media source has a low FPS – CameraKit would then not try to render more
   * frequently than the source produces new frames.
   *
   * This may also be useful to gracefully degrade performance in situations where
   * lowering FPS is preferable over alternatives.
   */
  fpsLimit?: number;

  /**
   * Whether to mute all sounds. Unmuted by default.
   */
  muted?: boolean;

  /**
   * Configuration object containing the current set of screen regions.
   *
   * Screen regions define areas of the screen that have special meaning for Lens rendering,
   * such as safe rendering areas, UI button locations, keyboard areas, etc. This allows lenses
   * to adapt their content placement based on the host application's UI layout.
   */
  screenRegions?: ScreenRegions;

  /**
   * A callback to handle Lens playback errors.
   */
  onError?: (error: CameraKitSessionEvents["detail"]["error"], lens: Lens) => void;
}

/**
 * Declarative hook to configure Lens playback options (FPS limit, muted state, screen regions).
 * This is a thin wrapper around the imperative session control methods exposed by `useCameraKit()`.
 *
 * @param options - Session control options
 */
export function usePlaybackOptions(options: PlaybackOptions) {
  const { currentSession, sdkStatus, setFPSLimit, setMuted, setScreenRegions, getLogger } = useInternalCameraKit();
  const log = getLogger("usePlaybackOptions");

  useEffect(() => {
    if (!currentSession || !options.onError) return;

    const handleError = (event: CameraKitSessionEvents) => {
      options.onError?.(event.detail.error, event.detail.lens);
    };

    currentSession.events.addEventListener("error", handleError);

    return () => {
      currentSession.events.removeEventListener("error", handleError);
    };
  }, [currentSession, options.onError]);

  useEffect(() => {
    if (sdkStatus !== "ready" || !currentSession || options.fpsLimit === undefined) return;

    setFPSLimit(options.fpsLimit).catch((error) => {
      log.error("fps_limit_apply_failed", { fpsLimit: options.fpsLimit }, error);
    });
  }, [currentSession, sdkStatus, options.fpsLimit, setFPSLimit, log]);

  useEffect(() => {
    if (sdkStatus !== "ready" || !currentSession || options.muted === undefined) return;

    try {
      setMuted(options.muted);
    } catch (error) {
      log.error("muted_state_apply_failed", { muted: options.muted }, error);
    }
  }, [currentSession, sdkStatus, options.muted, setMuted, log]);

  useEffect(() => {
    if (sdkStatus !== "ready" || !currentSession || !options.screenRegions) return;

    setScreenRegions(options.screenRegions).catch((error) => {
      log.error("screen_regions_apply_failed", { screenRegions: options.screenRegions }, error);
    });
  }, [currentSession, sdkStatus, options.screenRegions, setScreenRegions, log]);
}
