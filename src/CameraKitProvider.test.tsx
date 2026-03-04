import React from "react";
import { render, renderHook, waitFor, act } from "@testing-library/react";
import { CameraKitProvider, useCameraKit, useInternalCameraKit } from "./CameraKitProvider";
import { bootstrapCameraKit, CameraKit, CameraKitSession, Lens, createMediaStreamSource } from "@snap/camera-kit";
import { createConsoleLogger } from "./internal/logging";

jest.mock("@snap/camera-kit", () => ({
  bootstrapCameraKit: jest.fn(),
  createMediaStreamSource: jest.fn(),
  Transform2D: jest.fn(),
  Count: { count: jest.fn((name: string, n: number, dims: Record<string, string>) => ({ name, n, dims })) },
  // Legacy API
  Injectable: jest.fn((_token: unknown, _deps: unknown[], factory: unknown) => ({ token: _token, factory })),
  externalMetricsSubjectFactory: { token: Symbol("externalMetricsSubjectFactory") },
  // Newer API
  ConcatInjectable: jest.fn((_token: unknown, factory: () => unknown) => ({ token: _token, factory })),
  externalMetricsFactory: { token: Symbol("externalMetricsFactory") },
}));

const mockBootstrapCameraKit = bootstrapCameraKit as jest.MockedFunction<typeof bootstrapCameraKit>;
const mockCreateMediaStreamSource = createMediaStreamSource as jest.MockedFunction<typeof createMediaStreamSource>;

describe("CameraKitProvider", () => {
  let mockKit: jest.Mocked<CameraKit>;
  let mockSession: jest.Mocked<CameraKitSession>;
  let mockLiveCanvas: HTMLCanvasElement;
  let mockCaptureCanvas: HTMLCanvasElement;

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress React act warnings from async bootstrap
    jest.spyOn(console, "error").mockImplementation(() => {});

    mockLiveCanvas = document.createElement("canvas");
    mockCaptureCanvas = document.createElement("canvas");

    mockSession = {
      output: {
        live: mockLiveCanvas,
        capture: mockCaptureCanvas,
      },
      events: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
      playing: { live: false, capture: false },
      play: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn().mockResolvedValue(undefined),
      applyLens: jest.fn().mockResolvedValue(true),
      removeLens: jest.fn().mockResolvedValue(true),
      setSource: jest.fn().mockResolvedValue(undefined),
      setRenderSize: jest.fn().mockResolvedValue(undefined),
      setVolume: jest.fn().mockResolvedValue(undefined),
      setFPSLimit: jest.fn().mockResolvedValue(undefined),
      mute: jest.fn(),
      unmute: jest.fn(),
      keyboard: undefined,
    } as any;

    mockKit = {
      destroy: jest.fn().mockResolvedValue(undefined),
      createSession: jest.fn().mockResolvedValue(mockSession),
      lensRepository: {
        loadLens: jest.fn(),
        loadLensGroups: jest.fn(),
      },
    } as any;

    // Mock createMediaStreamSource to return a source with required methods
    mockCreateMediaStreamSource.mockReturnValue({
      setTransform: jest.fn().mockResolvedValue(undefined),
      setRenderSize: jest.fn().mockResolvedValue(undefined),
    } as any);

    // Use flush promises to ensure state updates happen in act()
    mockBootstrapCameraKit.mockImplementation(() => Promise.resolve(mockKit));
  });

  describe("Provider initialization", () => {
    it("should render children when provided", async () => {
      const { getByText } = render(
        <CameraKitProvider apiToken="test-token">
          <div>Test Child</div>
        </CameraKitProvider>,
      );

      expect(getByText("Test Child")).toBeTruthy();
    });

    it("should bootstrap CameraKit with apiToken", async () => {
      render(
        <CameraKitProvider apiToken="test-token">
          <div>Test</div>
        </CameraKitProvider>,
      );

      await waitFor(() => {
        expect(mockBootstrapCameraKit).toHaveBeenCalledWith(
          expect.objectContaining({ apiToken: "test-token" }),
          expect.any(Function),
        );
      });
    });

    it("should create a session after bootstrapping", async () => {
      render(
        <CameraKitProvider apiToken="test-token">
          <div>Test</div>
        </CameraKitProvider>,
      );

      await waitFor(() => {
        expect(mockKit.createSession).toHaveBeenCalled();
      });
    });

    it("should throw error when nested within another provider", () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation();

      expect(() =>
        render(
          <CameraKitProvider apiToken="test-token">
            <CameraKitProvider apiToken="test-token-2">
              <div>Nested</div>
            </CameraKitProvider>
          </CameraKitProvider>,
        ),
      ).toThrow("CameraKitProvider cannot be nested within another CameraKitProvider.");

      consoleError.mockRestore();
    });
  });

  describe("useCameraKit hook", () => {
    it("should throw error when used outside provider", () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation();

      expect(() => {
        renderHook(() => useCameraKit());
      }).toThrow("useCameraKit must be used within a CameraKitProvider");

      consoleError.mockRestore();
    });

    it("should provide context when used inside provider", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });
    });

    it("should expose liveCanvas when session is ready", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.liveCanvas).toBe(mockLiveCanvas);
      });
    });

    it("should expose captureCanvas when session is ready", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.captureCanvas).toBe(mockCaptureCanvas);
      });
    });

    it("should not expose internal fields", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });

      expect((result.current as any).cameraKit).toBeUndefined();
      expect((result.current as any).currentSession).toBeUndefined();
      expect((result.current as any).getLogger).toBeUndefined();
    });
  });

  describe("useInternalCameraKit hook", () => {
    it("should throw error when used outside provider", () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation();

      expect(() => {
        renderHook(() => useInternalCameraKit());
      }).toThrow("useInternalCameraKit must be used within a CameraKitProvider");

      consoleError.mockRestore();
    });

    it("should expose internal fields", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useInternalCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.cameraKit).toBe(mockKit);
        expect(result.current.currentSession).toBe(mockSession);
        expect(typeof result.current.getLogger).toBe("function");
      });
    });
  });

  describe("SDK status", () => {
    it("should start with initializing status", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      expect(result.current.sdkStatus).toBe("initializing");
    });

    it("should transition to ready when bootstrap succeeds", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });
    });

    it("should transition to error when bootstrap fails", async () => {
      mockBootstrapCameraKit.mockRejectedValue(new Error("Bootstrap failed"));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("error");
        expect(result.current.sdkError?.message).toBe("Bootstrap failed");
      });
    });
  });

  describe("Logger configuration", () => {
    it("should use noop logger by default", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(mockBootstrapCameraKit).toHaveBeenCalled();
      });
    });

    it("should accept custom logger", async () => {
      // Suppress console output since we're using console logger
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const consoleInfoSpy = jest.spyOn(console, "info").mockImplementation(() => {});

      const customLogger = createConsoleLogger();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token" logger={customLogger}>
          {children}
        </CameraKitProvider>
      );

      renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(mockBootstrapCameraKit).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
      consoleInfoSpy.mockRestore();
    });

    it("should use specified log level", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token" logLevel="debug">
          {children}
        </CameraKitProvider>
      );

      renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(mockBootstrapCameraKit).toHaveBeenCalled();
      });
    });
  });

  describe("Lens management", () => {
    it("should fetch lens by id and group", async () => {
      const mockLens = { id: "lens-1", groupId: "group-1" } as Lens;
      (mockKit.lensRepository.loadLens as any).mockResolvedValue(mockLens);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });

      let fetchedLens: Lens | undefined;
      await act(async () => {
        fetchedLens = await result.current.fetchLens("lens-1", "group-1");
      });

      expect(fetchedLens).toBe(mockLens);
      expect(mockKit.lensRepository.loadLens).toHaveBeenCalledWith("lens-1", "group-1");
    });

    it("should cache fetched lenses", async () => {
      const mockLens = { id: "lens-1", groupId: "group-1" } as Lens;
      (mockKit.lensRepository.loadLens as any).mockResolvedValue(mockLens);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });

      await act(async () => {
        await result.current.fetchLens("lens-1", "group-1");
        await result.current.fetchLens("lens-1", "group-1");
      });

      expect(mockKit.lensRepository.loadLens).toHaveBeenCalledTimes(1);
    });

    it("should fetch lens groups", async () => {
      const mockLenses = [
        { id: "lens-1", groupId: "group-1" },
        { id: "lens-2", groupId: "group-1" },
      ] as Lens[];
      (mockKit.lensRepository.loadLensGroups as any).mockResolvedValue({ lenses: mockLenses });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });

      await act(async () => {
        await result.current.fetchLenses("group-1");
      });

      expect(mockKit.lensRepository.loadLensGroups).toHaveBeenCalledWith(["group-1"]);
      expect(result.current.lenses).toHaveLength(2);
    });

    it("should apply lens", async () => {
      const mockLens = { id: "lens-1", groupId: "group-1" } as Lens;
      (mockKit.lensRepository.loadLens as any).mockResolvedValue(mockLens);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });

      await act(async () => {
        await result.current.applyLens("lens-1", "group-1");
      });

      expect(mockSession.applyLens).toHaveBeenCalledWith(mockLens, undefined);
      expect(result.current.lens.status).toBe("ready");
      expect(result.current.lens.lensId).toBe("lens-1");
    });

    it("should remove lens", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });

      await act(async () => {
        await result.current.removeLens();
      });

      expect(mockSession.removeLens).toHaveBeenCalled();
      expect(result.current.lens.status).toBe("none");
    });
  });

  describe("Source management", () => {
    const mockMediaStream = {
      getVideoTracks: jest.fn().mockReturnValue([
        {
          getSettings: jest.fn().mockReturnValue({ width: 1280, height: 720, deviceId: "device-1" }),
          label: "Camera",
        },
      ]),
      getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }]),
    } as any;

    beforeEach(() => {
      Object.defineProperty(global.navigator, "mediaDevices", {
        value: {
          getUserMedia: jest.fn().mockResolvedValue(mockMediaStream),
        },
        writable: true,
        configurable: true,
      });
    });

    it("should apply camera source", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });

      await act(async () => {
        await result.current.applySource({ kind: "camera" });
      });

      expect(result.current.source.status).toBe("ready");
      expect(result.current.source.input?.kind).toBe("camera");
    });

    it("should remove source", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });

      await act(async () => {
        await result.current.removeSource();
      });

      expect(result.current.source.status).toBe("none");
    });
  });

  describe("Playback options", () => {
    it("should set FPS limit", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });

      await act(async () => {
        await result.current.setFPSLimit(30);
      });

      expect(result.current.fpsLimit).toBe(30);
    });

    it("should set muted state", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });

      act(() => {
        result.current.setMuted(true);
      });

      expect(result.current.isMuted).toBe(true);
    });

    it("should toggle muted state", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });

      const initialMuted = result.current.isMuted;

      act(() => {
        result.current.toggleMuted();
      });

      expect(result.current.isMuted).toBe(!initialMuted);
    });
  });

  describe("Reinitialize", () => {
    it("should reinitialize when in error state", async () => {
      mockBootstrapCameraKit.mockRejectedValueOnce(new Error("First error")).mockResolvedValue(mockKit);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("error");
      });

      await act(async () => {
        result.current.reinitialize();
      });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });
    });

    it("should throw error when not in error state", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });

      expect(() => {
        result.current.reinitialize();
      }).toThrow("Cannot re-initialize CameraKit when it is not in an aborted state.");
    });
  });

  describe("Configuration updates", () => {
    it("should re-bootstrap when apiToken changes", async () => {
      const { rerender } = render(
        <CameraKitProvider apiToken="token-1">
          <div>Test</div>
        </CameraKitProvider>,
      );

      await waitFor(() => {
        expect(mockBootstrapCameraKit).toHaveBeenCalledWith(
          expect.objectContaining({ apiToken: "token-1" }),
          expect.any(Function),
        );
      });

      mockBootstrapCameraKit.mockClear();

      rerender(
        <CameraKitProvider apiToken="token-2">
          <div>Test</div>
        </CameraKitProvider>,
      );

      await waitFor(() => {
        expect(mockBootstrapCameraKit).toHaveBeenCalledWith(
          expect.objectContaining({ apiToken: "token-2" }),
          expect.any(Function),
        );
      });
    });

    it("should re-bootstrap when stabilityKey changes", async () => {
      const { rerender } = render(
        <CameraKitProvider apiToken="token-1" stabilityKey="key-1">
          <div>Test</div>
        </CameraKitProvider>,
      );

      await waitFor(() => {
        expect(mockBootstrapCameraKit).toHaveBeenCalledTimes(1);
      });

      mockBootstrapCameraKit.mockClear();

      rerender(
        <CameraKitProvider apiToken="token-1" stabilityKey="key-2">
          <div>Test</div>
        </CameraKitProvider>,
      );

      await waitFor(() => {
        expect(mockBootstrapCameraKit).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("Cleanup", () => {
    it("should cleanup on unmount", async () => {
      const { unmount } = render(
        <CameraKitProvider apiToken="test-token">
          <div>Test</div>
        </CameraKitProvider>,
      );

      await waitFor(() => {
        expect(mockBootstrapCameraKit).toHaveBeenCalled();
      });

      unmount();

      await waitFor(() => {
        expect(mockKit.destroy).toHaveBeenCalled();
      });
    });
  });

  describe("Extended container", () => {
    it("should pass extendContainer to bootstrapCameraKit", async () => {
      const extendContainer = jest.fn((container) => container);

      render(
        <CameraKitProvider apiToken="test-token" extendContainer={extendContainer}>
          <div>Test</div>
        </CameraKitProvider>,
      );

      await waitFor(() => {
        expect(mockBootstrapCameraKit).toHaveBeenCalledWith(expect.any(Object), expect.any(Function));
      });

      // The composed function should call both the user's extendContainer and inject metrics.
      const composedFn = mockBootstrapCameraKit.mock.calls[0]![1] as (container: any) => any;
      const mockContainer = { provides: jest.fn() };
      composedFn(mockContainer);

      // Metrics injection should call container.provides
      expect(mockContainer.provides).toHaveBeenCalled();
      // User's extendContainer should also be called
      expect(extendContainer).toHaveBeenCalledWith(mockContainer);
    });
  });

  describe("Lens error recovery", () => {
    it("should recover from LensExecutionError when a new lens is applied", async () => {
      // Track event handlers registered on the session
      let errorHandler: ((event: any) => void) | undefined;
      mockSession.events.addEventListener = jest.fn().mockImplementation((eventName, handler) => {
        if (eventName === "error") {
          errorHandler = handler;
        }
      });

      const mockLens1: Lens = { id: "lens-1", groupId: "group-1", name: "Lens 1" } as any;
      const mockLens2: Lens = { id: "lens-2", groupId: "group-1", name: "Lens 2" } as any;

      mockKit.lensRepository.loadLens = jest.fn().mockImplementation((lensId) => {
        if (lensId === "lens-1") return Promise.resolve(mockLens1);
        if (lensId === "lens-2") return Promise.resolve(mockLens2);
        return Promise.reject(new Error("Lens not found"));
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      // Wait for SDK to be ready
      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });

      // Apply lens-1
      await act(async () => {
        await result.current.applyLens("lens-1", "group-1");
      });

      expect(result.current.lens.status).toBe("ready");
      expect(result.current.lens.lensId).toBe("lens-1");

      // Simulate a LensExecutionError during rendering
      await act(async () => {
        const lensExecutionError = new Error("Lens rendering failed");
        lensExecutionError.name = "LensExecutionError";
        errorHandler?.({ detail: { error: lensExecutionError } });
      });

      // Lens should be in error state, but SDK should still be ready
      expect(result.current.lens.status).toBe("error");
      expect(result.current.lens.error?.name).toBe("LensExecutionError");
      expect(result.current.sdkStatus).toBe("ready"); // SDK should NOT be in error state

      // Apply a new lens - it should work and recover from the error
      await act(async () => {
        await result.current.applyLens("lens-2", "group-1");
      });

      // New lens should be applied successfully
      expect(result.current.lens.status).toBe("ready");
      expect(result.current.lens.lensId).toBe("lens-2");
      expect(result.current.lens.error).toBeUndefined();
      expect(result.current.sdkStatus).toBe("ready");
    });

    it("should clear lens error state when applying a new lens after LensExecutionError", async () => {
      let errorHandler: ((event: any) => void) | undefined;
      mockSession.events.addEventListener = jest.fn().mockImplementation((eventName, handler) => {
        if (eventName === "error") {
          errorHandler = handler;
        }
      });

      const mockLens1: Lens = { id: "lens-1", groupId: "group-1", name: "Lens 1" } as any;
      const mockLens2: Lens = { id: "lens-2", groupId: "group-1", name: "Lens 2" } as any;

      mockKit.lensRepository.loadLens = jest.fn().mockImplementation((lensId) => {
        if (lensId === "lens-1") return Promise.resolve(mockLens1);
        if (lensId === "lens-2") return Promise.resolve(mockLens2);
        return Promise.reject(new Error("Lens not found"));
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });

      // Apply first lens
      await act(async () => {
        await result.current.applyLens("lens-1", "group-1");
      });

      // Trigger LensExecutionError
      await act(async () => {
        const lensExecutionError = new Error("Lens crashed");
        lensExecutionError.name = "LensExecutionError";
        errorHandler?.({ detail: { error: lensExecutionError } });
      });

      // Verify lens is in error state
      expect(result.current.lens.status).toBe("error");

      // Apply a new lens
      await act(async () => {
        await result.current.applyLens("lens-2", "group-1");
      });

      // Verify the error is cleared and new lens is applied
      expect(result.current.lens.status).toBe("ready");
      expect(result.current.lens.error).toBeUndefined();
      expect(result.current.lens.lensId).toBe("lens-2");
    });

    it("should abort SDK when LensAbortError occurs", async () => {
      let errorHandler: ((event: any) => void) | undefined;
      mockSession.events.addEventListener = jest.fn().mockImplementation((eventName, handler) => {
        if (eventName === "error") {
          errorHandler = handler;
        }
      });

      const mockLens1: Lens = { id: "lens-1", groupId: "group-1", name: "Lens 1" } as any;

      mockKit.lensRepository.loadLens = jest.fn().mockResolvedValue(mockLens1);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });

      // Apply a lens
      await act(async () => {
        await result.current.applyLens("lens-1", "group-1");
      });

      expect(result.current.lens.status).toBe("ready");

      // Simulate a LensAbortError - this is a critical error
      await act(async () => {
        const lensAbortError = new Error("Lens aborted");
        lensAbortError.name = "LensAbortError";
        errorHandler?.({ detail: { error: lensAbortError } });
      });

      // SDK should be in error state (aborted)
      expect(result.current.sdkStatus).toBe("error");
      expect(result.current.sdkError?.name).toBe("LensAbortError");
      expect(mockKit.destroy).toHaveBeenCalled();
    });

    it("should require reinitialize after LensAbortError", async () => {
      let errorHandler: ((event: any) => void) | undefined;
      mockSession.events.addEventListener = jest.fn().mockImplementation((eventName, handler) => {
        if (eventName === "error") {
          errorHandler = handler;
        }
      });

      const mockLens1: Lens = { id: "lens-1", groupId: "group-1", name: "Lens 1" } as any;

      mockKit.lensRepository.loadLens = jest.fn().mockResolvedValue(mockLens1);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });

      // Apply a lens
      await act(async () => {
        await result.current.applyLens("lens-1", "group-1");
      });

      // Simulate a LensAbortError
      await act(async () => {
        const lensAbortError = new Error("Lens aborted");
        lensAbortError.name = "LensAbortError";
        errorHandler?.({ detail: { error: lensAbortError } });
      });

      // SDK should be in error state
      expect(result.current.sdkStatus).toBe("error");

      // Reset mocks for reinitialize
      mockKit.destroy.mockClear();
      mockBootstrapCameraKit.mockResolvedValue(mockKit);

      // Reinitialize should work
      await act(async () => {
        result.current.reinitialize();
      });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });
    });

    it("should not affect SDK or lens state for other errors like LensImagePickerError", async () => {
      let errorHandler: ((event: any) => void) | undefined;
      mockSession.events.addEventListener = jest.fn().mockImplementation((eventName, handler) => {
        if (eventName === "error") {
          errorHandler = handler;
        }
      });

      const mockLens1: Lens = { id: "lens-1", groupId: "group-1", name: "Lens 1" } as any;

      mockKit.lensRepository.loadLens = jest.fn().mockResolvedValue(mockLens1);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });

      // Apply a lens
      await act(async () => {
        await result.current.applyLens("lens-1", "group-1");
      });

      expect(result.current.lens.status).toBe("ready");
      expect(result.current.lens.lensId).toBe("lens-1");

      // Simulate a LensImagePickerError - this is a non-critical user interaction error
      await act(async () => {
        const imagePickerError = new Error("Image picker failed");
        imagePickerError.name = "LensImagePickerError";
        errorHandler?.({ detail: { error: imagePickerError } });
      });

      // SDK should remain ready (not aborted)
      expect(result.current.sdkStatus).toBe("ready");
      expect(result.current.sdkError).toBeUndefined();

      // Lens should remain in ready state (not affected)
      expect(result.current.lens.status).toBe("ready");
      expect(result.current.lens.lensId).toBe("lens-1");
      expect(result.current.lens.error).toBeUndefined();

      // SDK should not be destroyed
      expect(mockKit.destroy).not.toHaveBeenCalled();
    });

    it("should not affect SDK or lens state for unknown error types", async () => {
      let errorHandler: ((event: any) => void) | undefined;
      mockSession.events.addEventListener = jest.fn().mockImplementation((eventName, handler) => {
        if (eventName === "error") {
          errorHandler = handler;
        }
      });

      const mockLens1: Lens = { id: "lens-1", groupId: "group-1", name: "Lens 1" } as any;

      mockKit.lensRepository.loadLens = jest.fn().mockResolvedValue(mockLens1);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CameraKitProvider apiToken="test-token">{children}</CameraKitProvider>
      );

      const { result } = renderHook(() => useCameraKit(), { wrapper });

      await waitFor(() => {
        expect(result.current.sdkStatus).toBe("ready");
      });

      // Apply a lens
      await act(async () => {
        await result.current.applyLens("lens-1", "group-1");
      });

      // Simulate some unknown error type
      await act(async () => {
        const unknownError = new Error("Some unknown error");
        unknownError.name = "SomeUnknownError";
        errorHandler?.({ detail: { error: unknownError } });
      });

      // SDK should remain ready
      expect(result.current.sdkStatus).toBe("ready");

      // Lens should remain in ready state
      expect(result.current.lens.status).toBe("ready");

      // SDK should not be destroyed
      expect(mockKit.destroy).not.toHaveBeenCalled();
    });
  });
});
