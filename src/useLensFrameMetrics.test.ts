jest.mock("@snap/camera-kit", () => ({}));

import { renderHook, act } from "@testing-library/react";
import { useLensFrameMetrics } from "./useLensFrameMetrics";
import { useInternalCameraKit } from "./CameraKitProvider";
import { ComputedFrameMetrics } from "@snap/camera-kit";

jest.mock("./CameraKitProvider");

const mockUseInternalCameraKit = useInternalCameraKit as jest.MockedFunction<typeof useInternalCameraKit>;

function createMockMetrics(overrides: Partial<ComputedFrameMetrics> = {}): ComputedFrameMetrics {
  return {
    avgFps: 30,
    lensFrameProcessingTimeMsAvg: 16.5,
    lensFrameProcessingTimeMsStd: 2.1,
    lensFrameProcessingTimeMsMedian: 16.0,
    lensFrameProcessingN: 100,
    ...overrides,
  };
}

function createMockMeasurement() {
  return {
    measure: jest.fn().mockReturnValue(createMockMetrics()),
    reset: jest.fn(),
    end: jest.fn(),
  };
}

function createMockSession(measurement: ReturnType<typeof createMockMeasurement>) {
  return {
    metrics: {
      beginMeasurement: jest.fn().mockReturnValue(measurement),
    },
  };
}

function setupContext(overrides: Partial<ReturnType<typeof useInternalCameraKit>> = {}) {
  const measurement = createMockMeasurement();
  const session = createMockSession(measurement);
  const mockGetLogger = jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  });

  mockUseInternalCameraKit.mockReturnValue({
    currentSession: session as any,
    sdkStatus: "ready",
    lens: {
      lensId: "lens-1",
      lensGroupId: "group-1",
      status: "ready",
      error: undefined,
      lens: undefined,
      lensLaunchData: undefined,
      lensReadyGuard: undefined,
    },
    getLogger: mockGetLogger,
    ...overrides,
  } as any);

  return { measurement, session, mockGetLogger };
}

describe("useLensFrameMetrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns undefined when no session is available", () => {
    setupContext({ currentSession: undefined, sdkStatus: "initializing" });

    const { result } = renderHook(() => useLensFrameMetrics({ interval: 500 }));

    expect(result.current).toBeUndefined();
  });

  it("calls beginMeasurement when session becomes available", () => {
    const { session } = setupContext();

    renderHook(() => useLensFrameMetrics({ interval: 500 }));

    expect(session.metrics.beginMeasurement).toHaveBeenCalledTimes(1);
  });

  it("polls measure() at the specified interval and returns metrics", () => {
    const { measurement } = setupContext();
    const metrics = createMockMetrics({ avgFps: 60 });
    measurement.measure.mockReturnValue(metrics);

    const { result } = renderHook(() => useLensFrameMetrics({ interval: 500 }));

    // No metrics yet before first interval tick
    expect(result.current).toBeUndefined();

    // Advance past first interval
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(measurement.measure).toHaveBeenCalled();
    expect(result.current).toEqual(metrics);
  });

  it("polls repeatedly at the interval", () => {
    const { measurement } = setupContext();

    renderHook(() => useLensFrameMetrics({ interval: 200 }));

    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(measurement.measure).toHaveBeenCalledTimes(3);
  });

  it("calls reset() when lens changes", () => {
    const { measurement } = setupContext();

    const { rerender } = renderHook(() => useLensFrameMetrics({ interval: 500 }));

    // Change the lens
    mockUseInternalCameraKit.mockReturnValue({
      ...mockUseInternalCameraKit.mock.results[0]!.value,
      lens: {
        lensId: "lens-2",
        lensGroupId: "group-1",
        status: "ready",
        error: undefined,
        lens: undefined,
        lensLaunchData: undefined,
        lensReadyGuard: undefined,
      },
    } as any);

    rerender();

    expect(measurement.reset).toHaveBeenCalledTimes(1);
  });

  it("calls end() on unmount", () => {
    const { measurement } = setupContext();

    const { unmount } = renderHook(() => useLensFrameMetrics({ interval: 500 }));

    unmount();

    expect(measurement.end).toHaveBeenCalledTimes(1);
  });

  it("calls end() then beginMeasurement() when session changes", () => {
    const { measurement: measurement1 } = setupContext();

    const { rerender } = renderHook(() => useLensFrameMetrics({ interval: 500 }));

    expect(measurement1.end).not.toHaveBeenCalled();

    // New session (re-bootstrap)
    const measurement2 = createMockMeasurement();
    const session2 = createMockSession(measurement2);

    mockUseInternalCameraKit.mockReturnValue({
      ...mockUseInternalCameraKit.mock.results[0]!.value,
      currentSession: session2 as any,
    } as any);

    rerender();

    expect(measurement1.end).toHaveBeenCalledTimes(1);
    expect(session2.metrics.beginMeasurement).toHaveBeenCalledTimes(1);
  });

  it("does not start measurement when enabled is false", () => {
    const { session } = setupContext();

    const { result } = renderHook(() => useLensFrameMetrics({ interval: 500, enabled: false }));

    expect(session.metrics.beginMeasurement).not.toHaveBeenCalled();
    expect(result.current).toBeUndefined();
  });

  it("stops measurement when enabled changes to false", () => {
    const { measurement } = setupContext();
    measurement.measure.mockReturnValue(createMockMetrics({ avgFps: 60 }));

    const { result, rerender } = renderHook(({ enabled }) => useLensFrameMetrics({ interval: 500, enabled }), {
      initialProps: { enabled: true },
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current).toBeDefined();

    rerender({ enabled: false });

    expect(measurement.end).toHaveBeenCalledTimes(1);
    expect(result.current).toBeUndefined();
  });

  it("starts measurement when enabled changes to true", () => {
    const { session } = setupContext();

    const { rerender } = renderHook(({ enabled }) => useLensFrameMetrics({ interval: 500, enabled }), {
      initialProps: { enabled: false },
    });

    expect(session.metrics.beginMeasurement).not.toHaveBeenCalled();

    rerender({ enabled: true });

    expect(session.metrics.beginMeasurement).toHaveBeenCalledTimes(1);
  });

  it("clears metrics state when session is lost", () => {
    const { measurement } = setupContext();
    measurement.measure.mockReturnValue(createMockMetrics({ avgFps: 60 }));

    const { result, rerender } = renderHook(() => useLensFrameMetrics({ interval: 500 }));

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current).toBeDefined();

    // Session goes away (e.g. error state)
    mockUseInternalCameraKit.mockReturnValue({
      ...mockUseInternalCameraKit.mock.results[0]!.value,
      currentSession: undefined,
      sdkStatus: "error",
    } as any);

    rerender();

    expect(result.current).toBeUndefined();
  });
});
