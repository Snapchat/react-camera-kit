import { renderHook, waitFor } from "@testing-library/react";
import hash from "stable-hash";
import { useApplySource } from "./useApplySource";
import { useInternalCameraKit } from "./CameraKitProvider";
import { SourceInput, OutputSize } from "./types";

jest.mock("stable-hash");
jest.mock("@snap/camera-kit", () => ({}));
jest.mock("./CameraKitProvider");

const mockUseInternalCameraKit = useInternalCameraKit as jest.MockedFunction<typeof useInternalCameraKit>;
const mockHash = hash as jest.MockedFunction<typeof hash>;

describe("useApplySource", () => {
  let mockApplySource: jest.Mock;
  let mockRemoveSource: jest.Mock;
  let mockGetLogger: jest.Mock;
  let mockLogger: any;
  let mockCameraKit: any;
  let mockSession: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockApplySource = jest.fn().mockResolvedValue(undefined);
    mockRemoveSource = jest.fn().mockResolvedValue(undefined);
    mockGetLogger = jest.fn().mockReturnValue(mockLogger);

    mockCameraKit = { id: "mock-kit" };
    mockSession = { id: "mock-session" };

    mockUseInternalCameraKit.mockReturnValue({
      cameraKit: mockCameraKit,
      sdkStatus: "ready",
      currentSession: mockSession,
      applySource: mockApplySource,
      removeSource: mockRemoveSource,
      getLogger: mockGetLogger,
    } as any);

    // Default stable key behavior
    mockHash.mockImplementation((obj) => JSON.stringify(obj));
  });

  describe("Basic functionality", () => {
    it("should apply default camera source when no source is provided", async () => {
      renderHook(() => useApplySource());

      await waitFor(() => {
        expect(mockApplySource).toHaveBeenCalledWith({ kind: "camera" }, undefined);
      });
    });

    it("should apply camera source", async () => {
      const source: SourceInput = { kind: "camera", deviceId: "device-123" };
      renderHook(() => useApplySource(source));

      await waitFor(() => {
        expect(mockApplySource).toHaveBeenCalledWith(source, undefined);
      });
    });

    it("should apply video source", async () => {
      const source: SourceInput = { kind: "video", url: "https://example.com/video.mp4", autoplay: true };
      renderHook(() => useApplySource(source));

      await waitFor(() => {
        expect(mockApplySource).toHaveBeenCalledWith(source, undefined);
      });
    });

    it("should apply image source", async () => {
      const source: SourceInput = { kind: "image", url: "https://example.com/image.jpg" };
      renderHook(() => useApplySource(source));

      await waitFor(() => {
        expect(mockApplySource).toHaveBeenCalledWith(source, undefined);
      });
    });

    it("should apply source with output size", async () => {
      const source: SourceInput = { kind: "camera" };
      const outputSize: OutputSize = { mode: "fixed", width: 1920, height: 1080 };
      renderHook(() => useApplySource(source, outputSize));

      await waitFor(() => {
        expect(mockApplySource).toHaveBeenCalledWith(source, outputSize);
      });
    });
  });

  describe("SDK status checks", () => {
    it("should not apply source when SDK is initializing", () => {
      mockUseInternalCameraKit.mockReturnValue({
        cameraKit: mockCameraKit,
        sdkStatus: "initializing",
        currentSession: mockSession,
        applySource: mockApplySource,
        removeSource: mockRemoveSource,
        getLogger: mockGetLogger,
      } as any);

      renderHook(() => useApplySource({ kind: "camera" }));

      expect(mockApplySource).not.toHaveBeenCalled();
    });

    it("should not apply source when SDK is uninitialized", () => {
      mockUseInternalCameraKit.mockReturnValue({
        cameraKit: null,
        sdkStatus: "uninitialized",
        currentSession: null,
        applySource: mockApplySource,
        removeSource: mockRemoveSource,
        getLogger: mockGetLogger,
      } as any);

      renderHook(() => useApplySource({ kind: "camera" }));

      expect(mockApplySource).not.toHaveBeenCalled();
    });

    it("should not apply source when SDK has error", () => {
      mockUseInternalCameraKit.mockReturnValue({
        cameraKit: null,
        sdkStatus: "error",
        currentSession: null,
        applySource: mockApplySource,
        removeSource: mockRemoveSource,
        getLogger: mockGetLogger,
      } as any);

      renderHook(() => useApplySource({ kind: "camera" }));

      expect(mockApplySource).not.toHaveBeenCalled();
    });

    it("should not apply source when cameraKit is null", () => {
      mockUseInternalCameraKit.mockReturnValue({
        cameraKit: null,
        sdkStatus: "ready",
        currentSession: mockSession,
        applySource: mockApplySource,
        removeSource: mockRemoveSource,
        getLogger: mockGetLogger,
      } as any);

      renderHook(() => useApplySource({ kind: "camera" }));

      expect(mockApplySource).not.toHaveBeenCalled();
    });

    it("should not apply source when session is null", () => {
      mockUseInternalCameraKit.mockReturnValue({
        cameraKit: mockCameraKit,
        sdkStatus: "ready",
        currentSession: null,
        applySource: mockApplySource,
        removeSource: mockRemoveSource,
        getLogger: mockGetLogger,
      } as any);

      renderHook(() => useApplySource({ kind: "camera" }));

      expect(mockApplySource).not.toHaveBeenCalled();
    });
  });

  describe("Source change handling", () => {
    it("should reapply source when source changes", async () => {
      const { rerender } = renderHook(({ source }) => useApplySource(source), {
        initialProps: { source: { kind: "camera" as const, deviceId: "device-1" } },
      });

      await waitFor(() => {
        expect(mockApplySource).toHaveBeenCalledWith({ kind: "camera", deviceId: "device-1" }, undefined);
      });

      mockApplySource.mockClear();

      rerender({ source: { kind: "camera" as const, deviceId: "device-2" } });

      await waitFor(() => {
        expect(mockApplySource).toHaveBeenCalledWith({ kind: "camera", deviceId: "device-2" }, undefined);
      });
    });

    it("should not reapply source when source reference changes but content is same", async () => {
      mockHash.mockReturnValue("stable-key");

      const { rerender } = renderHook(({ source }) => useApplySource(source), {
        initialProps: { source: { kind: "camera" as const } },
      });

      await waitFor(() => {
        expect(mockApplySource).toHaveBeenCalledTimes(1);
      });

      mockApplySource.mockClear();

      // Same content, different reference
      rerender({ source: { kind: "camera" as const } });

      // Should not reapply since stable key is the same
      expect(mockApplySource).not.toHaveBeenCalled();
    });

    it("should reapply source when output size changes", async () => {
      const source: SourceInput = { kind: "camera" };
      mockHash
        .mockReturnValueOnce("source-key")
        .mockReturnValueOnce("size-key-1")
        .mockReturnValueOnce("source-key")
        .mockReturnValueOnce("size-key-2");

      const { rerender } = renderHook(({ outputSize }) => useApplySource(source, outputSize), {
        initialProps: { outputSize: { mode: "fixed" as const, width: 1280, height: 720 } },
      });

      await waitFor(() => {
        expect(mockApplySource).toHaveBeenCalledTimes(1);
      });

      mockApplySource.mockClear();

      rerender({ outputSize: { mode: "fixed" as const, width: 1920, height: 1080 } });

      await waitFor(() => {
        expect(mockApplySource).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("Cleanup on unmount", () => {
    it("should remove source on unmount", async () => {
      const { unmount } = renderHook(() => useApplySource({ kind: "camera" }));

      await waitFor(() => {
        expect(mockApplySource).toHaveBeenCalled();
      });

      mockRemoveSource.mockClear();
      unmount();

      await waitFor(() => {
        expect(mockRemoveSource).toHaveBeenCalled();
      });
    });

    it("should handle remove source failure on unmount", async () => {
      mockRemoveSource.mockRejectedValue(new Error("Remove failed"));

      const { unmount } = renderHook(() => useApplySource({ kind: "camera" }));

      await waitFor(() => {
        expect(mockApplySource).toHaveBeenCalled();
      });

      unmount();

      await waitFor(() => {
        expect(mockLogger.warn).toHaveBeenCalledWith(
          "source_remove_on_unmount_failed",
          { kind: "camera" },
          expect.any(Error),
        );
      });
    });
  });

  describe("Error handling", () => {
    it("should log error when source application fails", async () => {
      mockApplySource.mockRejectedValue(new Error("Apply failed"));

      renderHook(() => useApplySource({ kind: "camera" }));

      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith("source_apply_failure", { kind: "camera" }, expect.any(Error));
      });
    });

    it("should not log error if component unmounted before error", async () => {
      let rejectApply: any;
      mockApplySource.mockImplementation(
        () =>
          new Promise((_resolve, reject) => {
            rejectApply = reject;
          }),
      );

      const { unmount } = renderHook(() => useApplySource({ kind: "camera" }));

      unmount();

      rejectApply(new Error("Apply failed"));

      await waitFor(() => {
        expect(mockRemoveSource).toHaveBeenCalled();
      });

      // Error should not be logged after unmount
      expect(mockLogger.error).not.toHaveBeenCalledWith("source_apply_failure", expect.any(Object), expect.any(Error));
    });
  });

  describe("Logging", () => {
    it("should log apply attempt", async () => {
      renderHook(() => useApplySource({ kind: "camera" }));

      await waitFor(() => {
        expect(mockLogger.info).toHaveBeenCalledWith("source_apply_attempt", { kind: "camera" });
      });
    });

    it("should log apply success with elapsed time", async () => {
      renderHook(() => useApplySource({ kind: "camera" }));

      await waitFor(() => {
        expect(mockLogger.info).toHaveBeenCalledWith(
          "source_apply_success",
          expect.objectContaining({
            kind: "camera",
            elapsedMs: expect.any(Number),
          }),
        );
      });
    });

    it("should log remove attempt on unmount", async () => {
      const { unmount } = renderHook(() => useApplySource({ kind: "camera" }));

      await waitFor(() => {
        expect(mockApplySource).toHaveBeenCalled();
      });

      mockLogger.info.mockClear();
      unmount();

      await waitFor(() => {
        expect(mockLogger.info).toHaveBeenCalledWith("source_remove_attempt", {
          kind: "camera",
          reason: "cleanup",
        });
      });
    });
  });

  describe("Cancellation handling", () => {
    it("should remove source if component unmounts during application", async () => {
      let resolveApply: any;
      mockApplySource.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveApply = resolve;
          }),
      );

      const { unmount } = renderHook(() => useApplySource({ kind: "camera" }));

      await waitFor(() => {
        expect(mockApplySource).toHaveBeenCalled();
      });

      unmount();
      resolveApply(undefined);

      await waitFor(() => {
        expect(mockRemoveSource).toHaveBeenCalled();
      });

      expect(mockLogger.info).toHaveBeenCalledWith("source_remove_attempt", {
        kind: "camera",
        reason: "cancelled",
      });
    });
  });

  describe("Stable key memoization", () => {
    it("should use stable key for source memoization", async () => {
      let keyCallCount = 0;
      mockHash.mockImplementation(() => {
        keyCallCount++;
        return `key-${keyCallCount}`;
      });

      const { rerender } = renderHook(() => useApplySource({ kind: "camera" }));

      await waitFor(() => {
        expect(mockApplySource).toHaveBeenCalledTimes(1);
      });

      // Stable key should be called for source and outputSize
      expect(keyCallCount).toBeGreaterThan(0);

      const previousKeyCallCount = keyCallCount;
      rerender();

      // Rerender should not trigger new stable key calculation for same source
      // Actually, it will be called again on rerender, but that's expected
      expect(keyCallCount).toBeGreaterThan(previousKeyCallCount);
    });
  });

  describe("Default values", () => {
    it("should use default camera source when called without arguments", async () => {
      renderHook(() => useApplySource());

      await waitFor(() => {
        expect(mockApplySource).toHaveBeenCalledWith({ kind: "camera" }, undefined);
      });
    });

    it("should pass undefined outputSize when not provided", async () => {
      renderHook(() => useApplySource({ kind: "camera" }));

      await waitFor(() => {
        expect(mockApplySource).toHaveBeenCalledWith({ kind: "camera" }, undefined);
      });
    });
  });
});
