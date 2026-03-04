import { CameraConstraints, CameraFacing, CameraRotation, SourceInput, SourceOutput } from "../types";
import {
  CameraKitSource,
  createImageSource,
  createMediaStreamSource,
  createVideoSource,
  Transform2D,
} from "@snap/camera-kit";
import { isMobile } from "./isMobile";

export const DEFAULT_CAMERA_DEVICE_ID = "";

type _TupleOf<T, N extends number, R extends unknown[]> = R["length"] extends N ? R : _TupleOf<T, N, [T, ...R]>;
export type TupleOf<T, N extends number> = N extends N ? (number extends N ? T[] : _TupleOf<T, N, []>) : never;

export const defaultStreamResolution = {
  width: 1280,
  height: 720,
};

export interface SourceApplication {
  cameraKitSource: CameraKitSource;
  transform: Transform2D;
  /**
   * Dimensions of the input source in pixels, as [width, height], or undefined if unavailable.
   */
  inputSize?: [number, number];
  mediaStream?: MediaStream;
  initializedSourceInput: SourceOutput;
}

export async function createCameraKitSource(source: SourceInput): Promise<SourceApplication> {
  if (source.kind === "camera") {
    return createCameraStreamSource({
      // undefined deviceId brings default camera
      deviceId: source.deviceId !== DEFAULT_CAMERA_DEVICE_ID ? source.deviceId : undefined,
      cameraFacing: source.options?.cameraFacing ?? "user",
      cameraConstraints: source.options?.cameraConstraints ?? defaultStreamResolution,
      cameraRotation: source.options?.cameraRotation ?? 0,
      fpsLimit: source.options?.fpsLimit,
    });
  } else if (source.kind === "video") {
    return createCameraKitVideoSource({
      videoUrl: source.url,
      autoplay: source.autoplay,
    });
  } else if (source.kind === "image") {
    return createCameraKitImageSource({
      imageUrl: source.url,
    });
  }
  throw new Error(`Unsupported source kind`);
}

async function createCameraStreamSource({
  deviceId,
  cameraConstraints,
  cameraFacing,
  fpsLimit,
  cameraRotation,
}: {
  deviceId: string | undefined;
  cameraConstraints: CameraConstraints;
  cameraFacing: CameraFacing;
  fpsLimit: number | undefined;
  cameraRotation: CameraRotation;
}): Promise<SourceApplication> {
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    video: {
      ...cameraConstraints,
      deviceId: isMobile() ? undefined : deviceId,
      facingMode: cameraFacing,
    },
    audio: false,
  });

  const track = mediaStream.getVideoTracks()[0];
  const { width, height, deviceId: actualDeviceId } = track?.getSettings() ?? {};

  const cameraKitSource = createMediaStreamSource(mediaStream, {
    cameraType: cameraFacing,
    fpsLimit,
  });

  // On some mobile browsers, track settings can initially report landscape
  // dimensions even when the device is held in portrait, so we normalize by
  // treating mobile capture as rotated when deriving input size.
  const rotate = isMobile() || Math.abs(cameraRotation) === 90;
  const mirror = cameraFacing === "user";
  const transform = new Transform2D(getTransform(cameraRotation, mirror));

  return {
    cameraKitSource,
    transform,
    inputSize:
      typeof width === "number" && typeof height === "number"
        ? [rotate ? height : width, rotate ? width : height]
        : undefined,
    mediaStream,
    initializedSourceInput: {
      kind: "camera",
      deviceId: actualDeviceId ?? "",
      label: track?.label ?? "",
    },
  };
}

function createCameraKitVideoSource({ videoUrl, autoplay }: { videoUrl: string; autoplay?: boolean }) {
  return new Promise<SourceApplication>((res, rej) => {
    autoplay = autoplay ?? true;
    const videoInput = document.createElement("video");
    videoInput.src = videoUrl;
    videoInput.autoplay = autoplay;
    videoInput.muted = true;
    videoInput.loop = true;
    videoInput.crossOrigin = "anonymous";
    videoInput.playsInline = true;
    videoInput.addEventListener(
      "canplay",
      async () => {
        if (autoplay) await videoInput.play();
        res({
          cameraKitSource: createVideoSource(videoInput),
          transform: Transform2D.Identity,
          inputSize: [videoInput.videoWidth, videoInput.videoHeight],
          initializedSourceInput: {
            kind: "video",
            url: videoUrl,
            videoElement: videoInput,
          },
        });
      },
      { once: true },
    );
    videoInput.addEventListener(
      "error",
      async (event) => {
        rej(
          new Error(event.message ?? "Unable to load video.", {
            cause: event.error,
          }),
        );
      },
      { once: true },
    );
  });
}

function createCameraKitImageSource({ imageUrl }: { imageUrl: string }) {
  return new Promise<SourceApplication>((res, rej) => {
    const imageInput = document.createElement("img");
    imageInput.src = imageUrl;
    imageInput.crossOrigin = "anonymous";
    imageInput.addEventListener(
      "load",
      async () => {
        res({
          cameraKitSource: createImageSource(imageInput),
          transform: Transform2D.Identity,
          inputSize: [imageInput.naturalWidth, imageInput.naturalHeight],
          initializedSourceInput: {
            kind: "image",
            url: imageUrl,
            imageElement: imageInput,
          },
        });
      },
      { once: true },
    );
    imageInput.addEventListener(
      "error",
      async (event) => {
        rej(
          new Error(event.message ?? "Unable to load image.", {
            cause: event.error,
          }),
        );
      },
      { once: true },
    );
  });
}

function getTransform(degrees: number, mirror: boolean): TupleOf<number, 9> {
  const mirrorFactor = mirror ? -1 : 1;
  const rad = (degrees * Math.PI) / 180;
  const cos = Number(Math.cos(rad).toFixed(2));
  const sin = Number(Math.sin(rad).toFixed(2));

  let normalizedDegrees = degrees % 360;
  if (normalizedDegrees < 0) normalizedDegrees += 360;

  const quadrant = Math.floor(normalizedDegrees / 90) % 4;

  let translateX = quadrant === 1 || quadrant === 2 ? 1 : 0;
  let translateY = quadrant === 2 || quadrant === 3 ? 1 : 0;

  if (mirror) {
    translateX = quadrant === 0 || quadrant === 2 ? 1 - translateX : translateX;
    translateY = quadrant === 1 || quadrant === 3 ? 1 - translateY : translateY;
  }

  return [cos * mirrorFactor, sin * mirrorFactor, 0, sin === 0 ? 0 : -sin, cos, 0, translateX, translateY, 1];
}
