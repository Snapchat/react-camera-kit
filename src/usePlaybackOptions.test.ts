// Mock @snap/camera-kit first
jest.mock("@snap/camera-kit", () => ({
  Lens: {},
  CameraKitSessionEvents: {},
}));

import { renderHook, waitFor } from "@testing-library/react";
import { usePlaybackOptions, PlaybackOptions } from "./usePlaybackOptions";
import { useInternalCameraKit } from "./CameraKitProvider";
import { CameraKitSessionEvents, Lens } from "@snap/camera-kit";

jest.mock("./CameraKitProvider");

const mockUseInternalCameraKit = useInternalCameraKit as jest.MockedFunction<typeof useInternalCameraKit>;

describe("usePlaybackOptions", () => {
  let mockSetFPSLimit: jest.Mock;
  let mockSetMuted: jest.Mock;
  let mockSetScreenRegions: jest.Mock;
  let mockGetLogger: jest.Mock;
  let mockLogger: any;
  let mockSession: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockSetFPSLimit = jest.fn().mockResolvedValue(undefined);
    mockSetMuted = jest.fn();
    mockSetScreenRegions = jest.fn().mockResolvedValue(undefined);
    mockGetLogger = jest.fn().mockReturnValue(mockLogger);

    mockSession = {
      events: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
    };

    mockUseInternalCameraKit.mockReturnValue({
      currentSession: mockSession,
      sdkStatus: "ready",
      setFPSLimit: mockSetFPSLimit,
      setMuted: mockSetMuted,
      setScreenRegions: mockSetScreenRegions,
      getLogger: mockGetLogger,
    } as any);
  });

  describe("FPS Limit", () => {
    it("should set FPS limit when provided", async () => {
      const options: PlaybackOptions = { fpsLimit: 30 };
      renderHook(() => usePlaybackOptions(options));

      await waitFor(() => {
        expect(mockSetFPSLimit).toHaveBeenCalledWith(30);
      });
    });

    it("should not set FPS limit when undefined", () => {
      const options: PlaybackOptions = {};
      renderHook(() => usePlaybackOptions(options));

      expect(mockSetFPSLimit).not.toHaveBeenCalled();
    });

    it("should update FPS limit when changed", async () => {
      const { rerender } = renderHook(({ fpsLimit }) => usePlaybackOptions({ fpsLimit }), {
        initialProps: { fpsLimit: 30 },
      });

      await waitFor(() => {
        expect(mockSetFPSLimit).toHaveBeenCalledWith(30);
      });

      mockSetFPSLimit.mockClear();

      rerender({ fpsLimit: 60 });

      await waitFor(() => {
        expect(mockSetFPSLimit).toHaveBeenCalledWith(60);
      });
    });

    it("should log error when FPS limit fails to apply", async () => {
      mockSetFPSLimit.mockRejectedValue(new Error("FPS limit failed"));

      const options: PlaybackOptions = { fpsLimit: 30 };
      renderHook(() => usePlaybackOptions(options));

      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith("fps_limit_apply_failed", { fpsLimit: 30 }, expect.any(Error));
      });
    });

    it("should not set FPS limit when SDK is not ready", () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: mockSession,
        sdkStatus: "initializing",
        setFPSLimit: mockSetFPSLimit,
        setMuted: mockSetMuted,
        setScreenRegions: mockSetScreenRegions,
        getLogger: mockGetLogger,
      } as any);

      const options: PlaybackOptions = { fpsLimit: 30 };
      renderHook(() => usePlaybackOptions(options));

      expect(mockSetFPSLimit).not.toHaveBeenCalled();
    });

    it("should not set FPS limit when session is undefined", () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: undefined,
        sdkStatus: "ready",
        setFPSLimit: mockSetFPSLimit,
        setMuted: mockSetMuted,
        setScreenRegions: mockSetScreenRegions,
        getLogger: mockGetLogger,
      } as any);

      const options: PlaybackOptions = { fpsLimit: 30 };
      renderHook(() => usePlaybackOptions(options));

      expect(mockSetFPSLimit).not.toHaveBeenCalled();
    });
  });

  describe("Muted State", () => {
    it("should set muted state when provided", () => {
      const options: PlaybackOptions = { muted: true };
      renderHook(() => usePlaybackOptions(options));

      expect(mockSetMuted).toHaveBeenCalledWith(true);
    });

    it("should not set muted state when undefined", () => {
      const options: PlaybackOptions = {};
      renderHook(() => usePlaybackOptions(options));

      expect(mockSetMuted).not.toHaveBeenCalled();
    });

    it("should update muted state when changed", () => {
      const { rerender } = renderHook(({ muted }) => usePlaybackOptions({ muted }), {
        initialProps: { muted: true },
      });

      expect(mockSetMuted).toHaveBeenCalledWith(true);

      mockSetMuted.mockClear();

      rerender({ muted: false });

      expect(mockSetMuted).toHaveBeenCalledWith(false);
    });

    it("should log error when muted state fails to apply", () => {
      mockSetMuted.mockImplementation(() => {
        throw new Error("Muted state failed");
      });

      const options: PlaybackOptions = { muted: true };
      renderHook(() => usePlaybackOptions(options));

      expect(mockLogger.error).toHaveBeenCalledWith("muted_state_apply_failed", { muted: true }, expect.any(Error));
    });

    it("should not set muted state when SDK is not ready", () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: mockSession,
        sdkStatus: "error",
        setFPSLimit: mockSetFPSLimit,
        setMuted: mockSetMuted,
        setScreenRegions: mockSetScreenRegions,
        getLogger: mockGetLogger,
      } as any);

      const options: PlaybackOptions = { muted: true };
      renderHook(() => usePlaybackOptions(options));

      expect(mockSetMuted).not.toHaveBeenCalled();
    });
  });

  describe("Screen Regions", () => {
    it("should set screen regions when provided", async () => {
      const screenRegions: any = {
        safeRenderArea: { top: 0, left: 0, bottom: 1, right: 1 },
      };
      const options: PlaybackOptions = { screenRegions };
      renderHook(() => usePlaybackOptions(options));

      await waitFor(() => {
        expect(mockSetScreenRegions).toHaveBeenCalledWith(screenRegions);
      });
    });

    it("should not set screen regions when undefined", () => {
      const options: PlaybackOptions = {};
      renderHook(() => usePlaybackOptions(options));

      expect(mockSetScreenRegions).not.toHaveBeenCalled();
    });

    it("should update screen regions when changed", async () => {
      const regions1: any = {
        safeRenderArea: { top: 0, left: 0, bottom: 1, right: 1 },
      };
      const regions2: any = {
        safeRenderArea: { top: 0.1, left: 0.1, bottom: 0.9, right: 0.9 },
      };

      const { rerender } = renderHook(({ screenRegions }) => usePlaybackOptions({ screenRegions }), {
        initialProps: { screenRegions: regions1 },
      });

      await waitFor(() => {
        expect(mockSetScreenRegions).toHaveBeenCalledWith(regions1);
      });

      mockSetScreenRegions.mockClear();

      rerender({ screenRegions: regions2 });

      await waitFor(() => {
        expect(mockSetScreenRegions).toHaveBeenCalledWith(regions2);
      });
    });

    it("should log error when screen regions fail to apply", async () => {
      mockSetScreenRegions.mockRejectedValue(new Error("Screen regions failed"));

      const screenRegions: any = {
        safeRenderArea: { top: 0, left: 0, bottom: 1, right: 1 },
      };
      const options: PlaybackOptions = { screenRegions };
      renderHook(() => usePlaybackOptions(options));

      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith(
          "screen_regions_apply_failed",
          { screenRegions },
          expect.any(Error),
        );
      });
    });

    it("should not set screen regions when SDK is not ready", () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: mockSession,
        sdkStatus: "uninitialized",
        setFPSLimit: mockSetFPSLimit,
        setMuted: mockSetMuted,
        setScreenRegions: mockSetScreenRegions,
        getLogger: mockGetLogger,
      } as any);

      const screenRegions: any = {
        safeRenderArea: { top: 0, left: 0, bottom: 1, right: 1 },
      };
      const options: PlaybackOptions = { screenRegions };
      renderHook(() => usePlaybackOptions(options));

      expect(mockSetScreenRegions).not.toHaveBeenCalled();
    });
  });

  describe("Error Handler", () => {
    it("should register error event listener when onError is provided", () => {
      const onError = jest.fn();
      const options: PlaybackOptions = { onError };
      renderHook(() => usePlaybackOptions(options));

      expect(mockSession.events.addEventListener).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("should not register error listener when onError is not provided", () => {
      const options: PlaybackOptions = {};
      renderHook(() => usePlaybackOptions(options));

      expect(mockSession.events.addEventListener).not.toHaveBeenCalled();
    });

    it("should call onError when error event is fired", () => {
      const onError = jest.fn();
      const options: PlaybackOptions = { onError };
      renderHook(() => usePlaybackOptions(options));

      // Get the registered handler
      const addEventListenerCall = mockSession.events.addEventListener.mock.calls[0];
      const handler = addEventListenerCall[1];

      // Simulate error event
      const mockError = new Error("Lens error");
      const mockLens = { id: "lens-123" } as Lens;
      const event = {
        detail: {
          error: mockError,
          lens: mockLens,
        },
      } as CameraKitSessionEvents;

      handler(event);

      expect(onError).toHaveBeenCalledWith(mockError, mockLens);
    });

    it("should remove error listener on unmount", () => {
      const onError = jest.fn();
      const options: PlaybackOptions = { onError };
      const { unmount } = renderHook(() => usePlaybackOptions(options));

      const addEventListenerCall = mockSession.events.addEventListener.mock.calls[0];
      const handler = addEventListenerCall[1];

      unmount();

      expect(mockSession.events.removeEventListener).toHaveBeenCalledWith("error", handler);
    });

    it("should not register listener when session is undefined", () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: undefined,
        sdkStatus: "ready",
        setFPSLimit: mockSetFPSLimit,
        setMuted: mockSetMuted,
        setScreenRegions: mockSetScreenRegions,
        getLogger: mockGetLogger,
      } as any);

      const onError = jest.fn();
      const options: PlaybackOptions = { onError };
      renderHook(() => usePlaybackOptions(options));

      expect(mockSession.events.addEventListener).not.toHaveBeenCalled();
    });

    it("should update error handler when onError changes", () => {
      const onError1 = jest.fn();
      const onError2 = jest.fn();

      const { rerender } = renderHook(({ onError }) => usePlaybackOptions({ onError }), {
        initialProps: { onError: onError1 },
      });

      expect(mockSession.events.addEventListener).toHaveBeenCalledTimes(1);

      const handler1 = mockSession.events.addEventListener.mock.calls[0][1];

      rerender({ onError: onError2 });

      // Should remove old listener
      expect(mockSession.events.removeEventListener).toHaveBeenCalledWith("error", handler1);

      // Should add new listener
      expect(mockSession.events.addEventListener).toHaveBeenCalledTimes(2);
    });
  });

  describe("Combined options", () => {
    it("should apply all options together", async () => {
      const onError = jest.fn();
      const screenRegions: any = {
        safeRenderArea: { top: 0, left: 0, bottom: 1, right: 1 },
      };

      const options: PlaybackOptions = {
        fpsLimit: 30,
        muted: true,
        screenRegions,
        onError,
      };

      renderHook(() => usePlaybackOptions(options));

      await waitFor(() => {
        expect(mockSetFPSLimit).toHaveBeenCalledWith(30);
        expect(mockSetMuted).toHaveBeenCalledWith(true);
        expect(mockSetScreenRegions).toHaveBeenCalledWith(screenRegions);
        expect(mockSession.events.addEventListener).toHaveBeenCalledWith("error", expect.any(Function));
      });
    });
  });

  describe("SDK state changes", () => {
    it("should apply options when SDK becomes ready", async () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: undefined,
        sdkStatus: "initializing",
        setFPSLimit: mockSetFPSLimit,
        setMuted: mockSetMuted,
        setScreenRegions: mockSetScreenRegions,
        getLogger: mockGetLogger,
      } as any);

      const { rerender } = renderHook(() => usePlaybackOptions({ fpsLimit: 30 }));

      expect(mockSetFPSLimit).not.toHaveBeenCalled();

      // SDK becomes ready
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: mockSession,
        sdkStatus: "ready",
        setFPSLimit: mockSetFPSLimit,
        setMuted: mockSetMuted,
        setScreenRegions: mockSetScreenRegions,
        getLogger: mockGetLogger,
      } as any);

      rerender();

      await waitFor(() => {
        expect(mockSetFPSLimit).toHaveBeenCalledWith(30);
      });
    });
  });
});
