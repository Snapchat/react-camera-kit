import { Lens, LensLaunchData } from "@snap/camera-kit";

export type SourceStatus =
  | { state: "none" }
  | { state: "loading" }
  | { state: "ready" }
  | { state: "error"; error: Error };

export type LensStatus =
  | { state: "none" }
  | { state: "loading" }
  | { state: "ready" }
  | { state: "error"; error: Error };

export interface CurrentSource {
  status: "none" | "loading" | "ready" | "error";
  error: Error | undefined;
  input: SourceInput | undefined;
  initializedInput: SourceOutput | undefined;
}

export interface CurrentLens {
  status: "none" | "loading" | "ready" | "error";
  error: Error | undefined;
  lensId: string | undefined;
  lensGroupId: string | undefined;
  lensLaunchData: LensLaunchData | undefined;
  lensReadyGuard: (() => Promise<void>) | undefined;
  lens: Lens | undefined;
}

export const NO_CURRENT_LENS: CurrentLens = {
  status: "none",
  error: undefined,
  lensId: undefined,
  lensGroupId: undefined,
  lensLaunchData: undefined,
  lensReadyGuard: undefined,
  lens: undefined,
};

export type CameraSourceInput = {
  kind: "camera";
  deviceId?: string;
  options?: SourceOptions;
};
export type VideoSourceInput = {
  kind: "video";
  url: string;
  autoplay?: boolean;
};
export type ImageSourceInput = { kind: "image"; url: string };

export type SourceInput = CameraSourceInput | VideoSourceInput | ImageSourceInput;

export function isCameraSource(source: SourceInput | undefined): source is CameraSourceInput {
  return source?.kind === "camera";
}

export function isVideoSource(source: SourceInput | undefined): source is VideoSourceInput {
  return source?.kind === "video";
}

export function isImageSource(source: SourceInput | undefined): source is ImageSourceInput {
  return source?.kind === "image";
}

export interface CameraInfo {
  kind: "camera";
  deviceId: string;
  label: string;
}

export type CameraSourceOutput = CameraInfo;
export type VideoSourceOutput = {
  kind: "video";
  url: string;
  videoElement: HTMLVideoElement;
};
export type ImageSourceOutput = {
  kind: "image";
  url: string;
  imageElement: HTMLImageElement;
};

export type SourceOutput = CameraSourceOutput | VideoSourceOutput | ImageSourceOutput;

/** Explicit, fixed‐pixel dimensions */
export interface FixedOutputSize {
  mode: "fixed";
  width: number;
  height: number;
}

/** Exactly match whatever the camera/input delivers */
export interface MatchInputSize {
  mode: "match-input";
}

export const CameraRotationOptions = [0, -90, 90, 180] as const;

export type OutputSize = MatchInputSize | FixedOutputSize;

export interface SourceOptions {
  cameraFacing?: CameraFacing;
  cameraConstraints?: CameraConstraints;
  cameraRotation?: CameraRotation;
  fpsLimit?: number;
  outputSize?: OutputSize;
}

export type CameraFacing = "user" | "environment";
export type CameraConstraints = MediaTrackConstraints;
export type CameraRotation = (typeof CameraRotationOptions)[number];

export type CanvasType = "live" | "capture";
