// Main components
export { CameraKitProvider, useCameraKit } from "./CameraKitProvider";
export type { MetricEventHandlerFactory } from "./CameraKitProvider";

// Logging
export type { CameraKitLogger, LogLevel } from "./internal/logging";
export { createConsoleLogger, createNoopLogger } from "./internal/logging";

export { LensPlayer } from "./LensPlayer";
export type { LensPlayerProps } from "./LensPlayer";

export { LiveCanvas, CaptureCanvas } from "./Canvas";
export type { CanvasChildProps } from "./Canvas";

// Hooks
export { useApplyLens } from "./useApplyLens";
export { useApplySource } from "./useApplySource";
export { usePlaybackOptions } from "./usePlaybackOptions";
export type { PlaybackOptions } from "./usePlaybackOptions";

// Types
export type {
  SourceStatus,
  LensStatus,
  CurrentSource,
  CurrentLens,
  CameraSourceInput,
  VideoSourceInput,
  ImageSourceInput,
  SourceInput,
  CameraSourceOutput,
  VideoSourceOutput,
  ImageSourceOutput,
  SourceOutput,
  FixedOutputSize,
  MatchInputSize,
  OutputSize,
  SourceOptions,
  CameraFacing,
  CameraConstraints,
  CameraRotation,
  CanvasType,
  CameraInfo,
} from "./types";

export { NO_CURRENT_LENS, isCameraSource, isVideoSource, isImageSource, CameraRotationOptions } from "./types";

// Source utilities
export { createCameraKitSource, DEFAULT_CAMERA_DEVICE_ID, defaultStreamResolution } from "./internal/sourceUtils";
export type { SourceApplication, TupleOf } from "./internal/sourceUtils";
