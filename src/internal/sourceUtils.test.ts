import { createCameraKitSource, DEFAULT_CAMERA_DEVICE_ID, defaultStreamResolution } from "./sourceUtils";
import { createImageSource, createMediaStreamSource, createVideoSource } from "@snap/camera-kit";
import { isMobile } from "./isMobile";

jest.mock("@snap/camera-kit", () => ({
  createImageSource: jest.fn(),
  createMediaStreamSource: jest.fn(),
  createVideoSource: jest.fn(),
  Transform2D: jest.fn().mockImplementation((matrix: any) => ({
    matrix,
  })),
}));

jest.mock("./isMobile");

const mockIsMobile = isMobile as jest.MockedFunction<typeof isMobile>;
const mockCreateImageSource = createImageSource as jest.MockedFunction<typeof createImageSource>;
const mockCreateMediaStreamSource = createMediaStreamSource as jest.MockedFunction<typeof createMediaStreamSource>;
const mockCreateVideoSource = createVideoSource as jest.MockedFunction<typeof createVideoSource>;

describe("sourceUtils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsMobile.mockReturnValue(false);
  });

  describe("DEFAULT_CAMERA_DEVICE_ID", () => {
    it("should be an empty string", () => {
      expect(DEFAULT_CAMERA_DEVICE_ID).toBe("");
    });
  });

  describe("defaultStreamResolution", () => {
    it("should have width of 1280 and height of 720", () => {
      expect(defaultStreamResolution).toEqual({
        width: 1280,
        height: 720,
      });
    });
  });

  describe("createCameraKitSource - Camera", () => {
    let mockGetUserMedia: jest.Mock;
    let mockMediaStream: MediaStream;
    let mockTrack: MediaStreamTrack;

    beforeEach(() => {
      mockTrack = {
        getSettings: jest.fn().mockReturnValue({
          width: 1920,
          height: 1080,
          deviceId: "device-123",
        }),
        label: "Front Camera",
      } as any;

      mockMediaStream = {
        getVideoTracks: jest.fn().mockReturnValue([mockTrack]),
      } as any;

      mockGetUserMedia = jest.fn().mockResolvedValue(mockMediaStream);
      Object.defineProperty(global.navigator, "mediaDevices", {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
        configurable: true,
      });

      mockCreateMediaStreamSource.mockReturnValue("mockCameraKitSource" as any);
    });

    it("should create a camera stream source with default options", async () => {
      const source = { kind: "camera" as const };
      const result = await createCameraKitSource(source);

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          ...defaultStreamResolution,
          deviceId: undefined,
          facingMode: "user",
        },
        audio: false,
      });
      expect(result.cameraKitSource).toBe("mockCameraKitSource");
      expect(result.inputSize).toEqual([1920, 1080]);
      expect(result.mediaStream).toBe(mockMediaStream);
    });

    it("should use specified device ID on desktop", async () => {
      mockIsMobile.mockReturnValue(false);
      const source = {
        kind: "camera" as const,
        deviceId: "custom-device-id",
      };

      await createCameraKitSource(source);

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          ...defaultStreamResolution,
          deviceId: "custom-device-id",
          facingMode: "user",
        },
        audio: false,
      });
    });

    it("should ignore device ID on mobile", async () => {
      mockIsMobile.mockReturnValue(true);
      const source = {
        kind: "camera" as const,
        deviceId: "custom-device-id",
      };

      await createCameraKitSource(source);

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          ...defaultStreamResolution,
          deviceId: undefined,
          facingMode: "user",
        },
        audio: false,
      });
    });

    it("should use DEFAULT_CAMERA_DEVICE_ID as undefined", async () => {
      const source = {
        kind: "camera" as const,
        deviceId: DEFAULT_CAMERA_DEVICE_ID,
      };

      await createCameraKitSource(source);

      expect(mockGetUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({
            deviceId: undefined,
          }),
        }),
      );
    });

    it("should use custom camera constraints", async () => {
      const source = {
        kind: "camera" as const,
        options: {
          cameraConstraints: { width: 640, height: 480 },
        },
      };

      await createCameraKitSource(source);

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          width: 640,
          height: 480,
          deviceId: undefined,
          facingMode: "user",
        },
        audio: false,
      });
    });

    it("should use custom camera facing", async () => {
      const source = {
        kind: "camera" as const,
        options: {
          cameraFacing: "environment" as const,
        },
      };

      await createCameraKitSource(source);

      expect(mockGetUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({
            facingMode: "environment",
          }),
        }),
      );
    });

    it("should pass fpsLimit to createMediaStreamSource", async () => {
      const source = {
        kind: "camera" as const,
        options: {
          fpsLimit: 30,
        },
      };

      await createCameraKitSource(source);

      expect(mockCreateMediaStreamSource).toHaveBeenCalledWith(mockMediaStream, {
        cameraType: "user",
        fpsLimit: 30,
      });
    });

    it("should return initialized source input with device info", async () => {
      const source = { kind: "camera" as const };
      const result = await createCameraKitSource(source);

      expect(result.initializedSourceInput).toEqual({
        kind: "camera",
        deviceId: "device-123",
        label: "Front Camera",
      });
    });

    it("should handle missing track settings", async () => {
      mockTrack.getSettings = jest.fn().mockReturnValue({});

      const source = { kind: "camera" as const };
      const result = await createCameraKitSource(source);

      expect(result.inputSize).toBeUndefined();
      expect(result.initializedSourceInput).toEqual({
        kind: "camera",
        deviceId: "",
        label: "Front Camera",
      });
    });
  });

  describe("createCameraKitSource - Video", () => {
    let videoElement: HTMLVideoElement;

    beforeEach(() => {
      videoElement = document.createElement("video");
      Object.defineProperty(videoElement, "videoWidth", { value: 1280, writable: true });
      Object.defineProperty(videoElement, "videoHeight", { value: 720, writable: true });

      // Mock play method to avoid jsdom error
      videoElement.play = jest.fn().mockResolvedValue(undefined);

      jest.spyOn(document, "createElement").mockReturnValue(videoElement);
      mockCreateVideoSource.mockReturnValue("mockVideoSource" as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should create a video source with autoplay", async () => {
      const source = {
        kind: "video" as const,
        url: "https://example.com/video.mp4",
        autoplay: true,
      };

      const promise = createCameraKitSource(source);

      // Simulate video ready
      videoElement.dispatchEvent(new Event("canplay"));

      const result = await promise;

      expect(videoElement.src).toBe("https://example.com/video.mp4");
      expect(videoElement.autoplay).toBe(true);
      expect(videoElement.muted).toBe(true);
      expect(videoElement.loop).toBe(true);
      expect(result.cameraKitSource).toBe("mockVideoSource");
      expect(result.inputSize).toEqual([1280, 720]);
    });

    it("should default autoplay to true", async () => {
      const source = {
        kind: "video" as const,
        url: "https://example.com/video.mp4",
      };

      const promise = createCameraKitSource(source);
      videoElement.dispatchEvent(new Event("canplay"));
      await promise;

      expect(videoElement.autoplay).toBe(true);
    });

    it("should handle video load errors", async () => {
      const source = {
        kind: "video" as const,
        url: "https://example.com/invalid.mp4",
      };

      const promise = createCameraKitSource(source);

      const errorEvent = new Event("error") as any;
      errorEvent.message = "Failed to load";
      errorEvent.error = new Error("Network error");
      videoElement.dispatchEvent(errorEvent);

      await expect(promise).rejects.toThrow("Failed to load");
    });

    it("should handle video errors with default message", async () => {
      const source = {
        kind: "video" as const,
        url: "https://example.com/invalid.mp4",
      };

      const promise = createCameraKitSource(source);
      videoElement.dispatchEvent(new Event("error"));

      await expect(promise).rejects.toThrow("Unable to load video.");
    });

    it("should return initialized source with video element", async () => {
      const source = {
        kind: "video" as const,
        url: "https://example.com/video.mp4",
      };

      const promise = createCameraKitSource(source);
      videoElement.dispatchEvent(new Event("canplay"));
      const result = await promise;

      expect(result.initializedSourceInput).toEqual({
        kind: "video",
        url: "https://example.com/video.mp4",
        videoElement: videoElement,
      });
    });
  });

  describe("createCameraKitSource - Image", () => {
    let imageElement: HTMLImageElement;

    beforeEach(() => {
      imageElement = document.createElement("img");
      Object.defineProperty(imageElement, "naturalWidth", { value: 800, writable: true });
      Object.defineProperty(imageElement, "naturalHeight", { value: 600, writable: true });

      const originalCreateElement = document.createElement.bind(document);
      jest.spyOn(document, "createElement").mockImplementation((tag: string) => {
        if (tag === "img") return imageElement;
        return originalCreateElement(tag);
      });
      mockCreateImageSource.mockReturnValue("mockImageSource" as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should create an image source", async () => {
      const source = {
        kind: "image" as const,
        url: "https://example.com/image.jpg",
      };

      const promise = createCameraKitSource(source);
      imageElement.dispatchEvent(new Event("load"));
      const result = await promise;

      expect(imageElement.src).toBe("https://example.com/image.jpg");
      expect(imageElement.crossOrigin).toBe("anonymous");
      expect(result.cameraKitSource).toBe("mockImageSource");
      expect(result.inputSize).toEqual([800, 600]);
    });

    it("should handle image load errors", async () => {
      const source = {
        kind: "image" as const,
        url: "https://example.com/invalid.jpg",
      };

      const promise = createCameraKitSource(source);

      const errorEvent = new Event("error") as any;
      errorEvent.message = "Image not found";
      imageElement.dispatchEvent(errorEvent);

      await expect(promise).rejects.toThrow("Image not found");
    });

    it("should handle image errors with default message", async () => {
      const source = {
        kind: "image" as const,
        url: "https://example.com/invalid.jpg",
      };

      const promise = createCameraKitSource(source);
      imageElement.dispatchEvent(new Event("error"));

      await expect(promise).rejects.toThrow("Unable to load image.");
    });

    it("should return initialized source with image element", async () => {
      const source = {
        kind: "image" as const,
        url: "https://example.com/image.jpg",
      };

      const promise = createCameraKitSource(source);
      imageElement.dispatchEvent(new Event("load"));
      const result = await promise;

      expect(result.initializedSourceInput).toEqual({
        kind: "image",
        url: "https://example.com/image.jpg",
        imageElement: imageElement,
      });
    });
  });

  describe("createCameraKitSource - Unsupported", () => {
    it("should throw error for unsupported source kind", async () => {
      const source = { kind: "unsupported" } as any;

      await expect(createCameraKitSource(source)).rejects.toThrow("Unsupported source kind");
    });
  });
});
