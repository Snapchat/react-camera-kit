import { renderHook, waitFor } from "@testing-library/react";
import hash from "stable-hash";
import { useApplyLens } from "./useApplyLens";
import { useInternalCameraKit } from "./CameraKitProvider";

jest.mock("stable-hash");
jest.mock("@snap/camera-kit", () => ({}));
jest.mock("./CameraKitProvider");

const mockUseInternalCameraKit = useInternalCameraKit as jest.MockedFunction<typeof useInternalCameraKit>;
const mockHash = hash as jest.MockedFunction<typeof hash>;

describe("useApplyLens", () => {
  let mockApplyLens: jest.Mock;
  let mockRemoveLens: jest.Mock;
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

    mockApplyLens = jest.fn().mockResolvedValue(true);
    mockRemoveLens = jest.fn().mockResolvedValue(true);
    mockGetLogger = jest.fn().mockReturnValue(mockLogger);

    mockCameraKit = { id: "mock-kit" };
    mockSession = { id: "mock-session" };

    mockUseInternalCameraKit.mockReturnValue({
      cameraKit: mockCameraKit,
      sdkStatus: "ready",
      currentSession: mockSession,
      applyLens: mockApplyLens,
      removeLens: mockRemoveLens,
      getLogger: mockGetLogger,
    } as any);

    // Default stable key behavior
    mockHash.mockImplementation((obj) => JSON.stringify(obj));
  });

  describe("Basic functionality", () => {
    it("should apply lens when lensId and groupId are provided", async () => {
      renderHook(() => useApplyLens("lens-123", "group-456"));

      await waitFor(() => {
        expect(mockApplyLens).toHaveBeenCalledWith("lens-123", "group-456", undefined, undefined);
      });
    });

    it("should apply lens with launch data", async () => {
      const launchData = { launchParams: { hint: "face" } };
      renderHook(() => useApplyLens("lens-123", "group-456", launchData));

      await waitFor(() => {
        expect(mockApplyLens).toHaveBeenCalledWith("lens-123", "group-456", launchData, undefined);
      });
    });

    it("should apply lens with ready guard", async () => {
      const readyGuard = jest.fn().mockResolvedValue(undefined);
      renderHook(() => useApplyLens("lens-123", "group-456", undefined, readyGuard));

      await waitFor(() => {
        expect(mockApplyLens).toHaveBeenCalledWith("lens-123", "group-456", undefined, readyGuard);
      });
    });

    it("should remove lens when lensId is undefined", async () => {
      renderHook(() => useApplyLens(undefined, "group-456"));

      await waitFor(() => {
        expect(mockRemoveLens).toHaveBeenCalled();
        expect(mockApplyLens).not.toHaveBeenCalled();
      });
    });

    it("should remove lens when groupId is undefined", async () => {
      renderHook(() => useApplyLens("lens-123", undefined));

      await waitFor(() => {
        expect(mockRemoveLens).toHaveBeenCalled();
        expect(mockApplyLens).not.toHaveBeenCalled();
      });
    });
  });

  describe("SDK status checks", () => {
    it("should not apply lens when SDK is initializing", () => {
      mockUseInternalCameraKit.mockReturnValue({
        cameraKit: mockCameraKit,
        sdkStatus: "initializing",
        currentSession: mockSession,
        applyLens: mockApplyLens,
        removeLens: mockRemoveLens,
        getLogger: mockGetLogger,
      } as any);

      renderHook(() => useApplyLens("lens-123", "group-456"));

      expect(mockApplyLens).not.toHaveBeenCalled();
    });

    it("should not apply lens when SDK is uninitialized", () => {
      mockUseInternalCameraKit.mockReturnValue({
        cameraKit: null,
        sdkStatus: "uninitialized",
        currentSession: null,
        applyLens: mockApplyLens,
        removeLens: mockRemoveLens,
        getLogger: mockGetLogger,
      } as any);

      renderHook(() => useApplyLens("lens-123", "group-456"));

      expect(mockApplyLens).not.toHaveBeenCalled();
    });

    it("should not apply lens when SDK has error", () => {
      mockUseInternalCameraKit.mockReturnValue({
        cameraKit: null,
        sdkStatus: "error",
        currentSession: null,
        applyLens: mockApplyLens,
        removeLens: mockRemoveLens,
        getLogger: mockGetLogger,
      } as any);

      renderHook(() => useApplyLens("lens-123", "group-456"));

      expect(mockApplyLens).not.toHaveBeenCalled();
    });

    it("should not apply lens when cameraKit is null", () => {
      mockUseInternalCameraKit.mockReturnValue({
        cameraKit: null,
        sdkStatus: "ready",
        currentSession: mockSession,
        applyLens: mockApplyLens,
        removeLens: mockRemoveLens,
        getLogger: mockGetLogger,
      } as any);

      renderHook(() => useApplyLens("lens-123", "group-456"));

      expect(mockApplyLens).not.toHaveBeenCalled();
    });

    it("should not apply lens when session is null", () => {
      mockUseInternalCameraKit.mockReturnValue({
        cameraKit: mockCameraKit,
        sdkStatus: "ready",
        currentSession: null,
        applyLens: mockApplyLens,
        removeLens: mockRemoveLens,
        getLogger: mockGetLogger,
      } as any);

      renderHook(() => useApplyLens("lens-123", "group-456"));

      expect(mockApplyLens).not.toHaveBeenCalled();
    });
  });

  describe("Lens change handling", () => {
    it("should reapply lens when lensId changes", async () => {
      const { rerender } = renderHook(({ lensId, groupId }) => useApplyLens(lensId, groupId), {
        initialProps: { lensId: "lens-1", groupId: "group-1" },
      });

      await waitFor(() => {
        expect(mockApplyLens).toHaveBeenCalledWith("lens-1", "group-1", undefined, undefined);
      });

      mockApplyLens.mockClear();

      rerender({ lensId: "lens-2", groupId: "group-1" });

      await waitFor(() => {
        expect(mockApplyLens).toHaveBeenCalledWith("lens-2", "group-1", undefined, undefined);
      });
    });

    it("should reapply lens when groupId changes", async () => {
      const { rerender } = renderHook(({ lensId, groupId }) => useApplyLens(lensId, groupId), {
        initialProps: { lensId: "lens-1", groupId: "group-1" },
      });

      await waitFor(() => {
        expect(mockApplyLens).toHaveBeenCalledTimes(1);
      });

      mockApplyLens.mockClear();

      rerender({ lensId: "lens-1", groupId: "group-2" });

      await waitFor(() => {
        expect(mockApplyLens).toHaveBeenCalledWith("lens-1", "group-2", undefined, undefined);
      });
    });

    it("should reapply lens when launch data changes", async () => {
      mockHash.mockImplementation((obj) => JSON.stringify(obj));

      const { rerender } = renderHook(({ launchData }) => useApplyLens("lens-1", "group-1", launchData), {
        initialProps: { launchData: { launchParams: { hint: "face" } } },
      });

      await waitFor(() => {
        expect(mockApplyLens).toHaveBeenCalledTimes(1);
      });

      mockApplyLens.mockClear();

      rerender({ launchData: { launchParams: { hint: "hand" } } });

      await waitFor(() => {
        expect(mockApplyLens).toHaveBeenCalledTimes(1);
      });
    });

    it("should not reapply lens when launch data reference changes but content is same", async () => {
      const launchData = { launchParams: { hint: "face" } };
      mockHash.mockReturnValue("stable-key");

      const { rerender } = renderHook(({ launchData }) => useApplyLens("lens-1", "group-1", launchData), {
        initialProps: { launchData },
      });

      await waitFor(() => {
        expect(mockApplyLens).toHaveBeenCalledTimes(1);
      });

      mockApplyLens.mockClear();

      // Same content, different reference
      rerender({ launchData: { launchParams: { hint: "face" } } });

      // Should not reapply since stable key is the same
      expect(mockApplyLens).not.toHaveBeenCalled();
    });
  });

  describe("Cleanup on unmount", () => {
    it("should remove lens on unmount", async () => {
      const { unmount } = renderHook(() => useApplyLens("lens-123", "group-456"));

      await waitFor(() => {
        expect(mockApplyLens).toHaveBeenCalled();
      });

      mockRemoveLens.mockClear();
      unmount();

      await waitFor(() => {
        expect(mockRemoveLens).toHaveBeenCalled();
      });
    });

    it("should handle remove lens failure on unmount", async () => {
      mockRemoveLens.mockRejectedValue(new Error("Remove failed"));

      const { unmount } = renderHook(() => useApplyLens("lens-123", "group-456"));

      await waitFor(() => {
        expect(mockApplyLens).toHaveBeenCalled();
      });

      unmount();

      await waitFor(() => {
        expect(mockLogger.warn).toHaveBeenCalledWith(
          "remove_on_unmount_failed",
          { lensId: "lens-123", groupId: "group-456" },
          expect.any(Error),
        );
      });
    });
  });

  describe("Error handling", () => {
    it("should log error when lens application fails", async () => {
      mockApplyLens.mockRejectedValue(new Error("Apply failed"));

      renderHook(() => useApplyLens("lens-123", "group-456"));

      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith(
          "apply_failure",
          { lensId: "lens-123", groupId: "group-456" },
          expect.any(Error),
        );
      });
    });

    it("should not log error if component unmounted before error", async () => {
      let resolveApply: any;
      mockApplyLens.mockImplementation(
        () =>
          new Promise((_resolve, reject) => {
            resolveApply = reject;
          }),
      );

      const { unmount } = renderHook(() => useApplyLens("lens-123", "group-456"));

      unmount();

      resolveApply(new Error("Apply failed"));

      await waitFor(() => {
        expect(mockRemoveLens).toHaveBeenCalled();
      });

      // Error should not be logged after unmount
      expect(mockLogger.error).not.toHaveBeenCalledWith("apply_failure", expect.any(Object), expect.any(Error));
    });
  });

  describe("Logging", () => {
    it("should log apply attempt", async () => {
      renderHook(() => useApplyLens("lens-123", "group-456"));

      await waitFor(() => {
        expect(mockLogger.info).toHaveBeenCalledWith("apply_attempt", {
          lensId: "lens-123",
          groupId: "group-456",
        });
      });
    });

    it("should log apply success with elapsed time", async () => {
      renderHook(() => useApplyLens("lens-123", "group-456"));

      await waitFor(() => {
        expect(mockLogger.info).toHaveBeenCalledWith(
          "apply_success",
          expect.objectContaining({
            lensId: "lens-123",
            groupId: "group-456",
            elapsedMs: expect.any(Number),
          }),
        );
      });
    });
  });

  describe("Ready guard behavior", () => {
    it("should use latest ready guard even if reference changes", async () => {
      const guard1 = jest.fn().mockResolvedValue(undefined);
      const guard2 = jest.fn().mockResolvedValue(undefined);

      const { rerender } = renderHook(({ guard }) => useApplyLens("lens-123", "group-456", undefined, guard), {
        initialProps: { guard: guard1 },
      });

      await waitFor(() => {
        expect(mockApplyLens).toHaveBeenCalledWith("lens-123", "group-456", undefined, guard1);
      });

      mockApplyLens.mockClear();

      // Change guard reference but not lens
      rerender({ guard: guard2 });

      // Should not trigger reapply just because guard changed
      expect(mockApplyLens).not.toHaveBeenCalled();
    });
  });

  describe("Cancellation handling", () => {
    it("should remove lens if component unmounts during application", async () => {
      let resolveApply: any;
      mockApplyLens.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveApply = resolve;
          }),
      );

      const { unmount } = renderHook(() => useApplyLens("lens-123", "group-456"));

      await waitFor(() => {
        expect(mockApplyLens).toHaveBeenCalled();
      });

      unmount();
      resolveApply(true);

      await waitFor(() => {
        expect(mockRemoveLens).toHaveBeenCalledTimes(2); // Once after apply, once on unmount
      });
    });
  });
});
