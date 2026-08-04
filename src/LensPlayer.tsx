import { ReactNode } from "react";
import { CameraKitSessionEvents, Lens, LensLaunchData, ScreenRegions } from "@snap/camera-kit";
import { CanvasType, OutputSize, SourceInput } from "./types";
import { useApplySource } from "./useApplySource";
import { useApplyLens } from "./useApplyLens";
import { usePlaybackOptions } from "./usePlaybackOptions";
import { CaptureCanvas, LiveCanvas } from "./Canvas";

/**
 * Props for the LensPlayer component.
 */
export interface LensPlayerProps {
  /** The media source to apply (camera, video, or image). Defaults to camera if not specified. */
  source?: SourceInput;

  /** Optional output size configuration for the rendering canvas. */
  outputSize?: OutputSize;

  /** The unique identifier of the Lens to apply. */
  lensId?: string;

  /** The group ID containing the Lens. Required when lensId is provided. */
  lensGroupId?: string;

  /** Optional launch parameters to pass to the Lens.. */
  lensLaunchData?: LensLaunchData;

  /** Optional async guard that must resolve before the Lens is considered ready.
   * The guard is called when the lens is in loading state,
   * and when the promise returned by the function resolves, it will transition to the ready state.
   * If the promise doesn't resolve within 2 seconds, the ready state is forced. */
  lensReadyGuard?: () => Promise<void>;

  /**
   * Trigger to refresh the current Lens. When this value changes,
   * the Lens will be removed and reapplied with the current Lens props.
   * Useful for restarting the Lens experience without moving LensPlayer
   * to another component.
   */
  refreshTrigger?: unknown;

  /** Which canvas to render: "live" for real-time preview or "capture" for snapshot. Defaults to "live". */
  canvasType?: CanvasType;

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
   * Configuration object containing the complete set of active screen regions.
   *
   * Screen regions define areas of the screen that have special meaning for Lens rendering,
   * such as safe rendering areas, UI button locations, keyboard areas, etc. This allows lenses
   * to adapt their content placement based on the host application's UI layout.
   *
   * This value is applied as a full replacement set: regions not included in the object are
   * removed. Pass `undefined` or omit this option to clear all screen regions.
   */
  screenRegions?: ScreenRegions;

  /**
   * A callback to handle Lens playback errors.
   */
  onError?: (error: CameraKitSessionEvents["detail"]["error"], lens: Lens) => void;

  /** CSS class name to apply to the wrapper or canvas element. */
  className?: string;

  /** Inline styles to apply to the wrapper or canvas element. */
  style?: React.CSSProperties;

  /** Custom children to render instead of the default canvas. When provided, children are wrapped in a styled div. */
  children?: ReactNode;
}

/**
 * A declarative, all-in-one component for rendering Camera Kit Lenses.
 *
 * LensPlayer combines source management, lens application, and playback controls into a single
 * component. It handles the complexity of coordinating multiple hooks and provides a simple
 * prop-based API for common use cases.
 *
 * @example
 * ```tsx
 * // Basic lens player with camera source
 * <LensPlayer lensId="lens-123" lensGroupId="my-group" />
 *
 * // With custom source and output size
 * <LensPlayer
 *   source={{ kind: "video", element: videoElement }}
 *   outputSize={{ mode: "fixed", width: 1280, height: 720 }}
 *   lensId="lens-123"
 *   lensGroupId="my-group"
 * />
 *
 * // With playback controls and error handling
 * <LensPlayer
 *   lensId="lens-123"
 *   lensGroupId="my-group"
 *   fpsLimit={30}
 *   muted={true}
 *   onError={(error) => console.error("Playback error:", error)}
 * />
 *
 * // With custom children instead of default canvas
 * <LensPlayer lensId="lens-123" lensGroupId="my-group">
 *   <div>Custom UI overlaying the Lens <LiveCanvas /></div>
 * </LensPlayer>
 * ```
 */
export const LensPlayer: React.FC<LensPlayerProps> = ({
  source,
  outputSize,
  lensId,
  lensGroupId,
  lensLaunchData,
  lensReadyGuard,
  refreshTrigger,
  canvasType,
  fpsLimit,
  muted,
  screenRegions,
  onError,
  className,
  style,
  children,
}) => {
  usePlaybackOptions({ fpsLimit, muted, screenRegions, onError });
  useApplySource(source, outputSize);
  useApplyLens(lensId, lensGroupId, lensLaunchData, lensReadyGuard, refreshTrigger);

  if (children) {
    // If custom children were provided, we wrap them to allow styling at the outer div.
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  // Otherwise, we render the asked (or by default live) canvas.
  return canvasType === "capture" ? (
    <CaptureCanvas className={className} style={style} />
  ) : (
    <LiveCanvas className={className} style={style} />
  );
};
