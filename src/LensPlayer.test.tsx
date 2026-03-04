import { render, screen } from "@testing-library/react";
import { LensPlayer, LensPlayerProps } from "./LensPlayer";
import { useApplySource } from "./useApplySource";
import { useApplyLens } from "./useApplyLens";
import { usePlaybackOptions } from "./usePlaybackOptions";

// Mock @snap/camera-kit
jest.mock("@snap/camera-kit", () => ({
  __esModule: true,
  bootstrapCameraKit: jest.fn(),
}));

const mockRefreshLens = jest.fn();

// Mock CameraKitProvider
jest.mock("./CameraKitProvider", () => ({
  useCameraKit: jest.fn(() => ({
    cameraKitStatus: "ready" as const,
    cameraKitError: undefined,
    liveCanvas: document.createElement("canvas"),
    captureCanvas: document.createElement("canvas"),
    source: { status: "none" as const, error: undefined, input: undefined, initializedInput: undefined },
    lens: {
      status: "none" as const,
      error: undefined,
      lensId: undefined,
      lensGroupId: undefined,
      lensLaunchData: undefined,
      lensReadyGuard: undefined,
      lens: undefined,
    },
    reinitialize: jest.fn(),
    // Lens manager methods
    fetchLens: jest.fn(),
    fetchLenses: jest.fn(),
    applyLens: jest.fn(),
    loadAndApplyLens: jest.fn(),
    removeLens: jest.fn(),
    refreshLens: mockRefreshLens,
    lenses: [],
  })),
}));

// Mock all the custom hooks
jest.mock("./useApplySource");
jest.mock("./useApplyLens");
jest.mock("./usePlaybackOptions");
jest.mock("./Canvas", () => ({
  LiveCanvas: ({ className, style }: any) => <div data-testid="live-canvas" className={className} style={style} />,
  CaptureCanvas: ({ className, style }: any) => (
    <div data-testid="capture-canvas" className={className} style={style} />
  ),
}));

const mockUseApplySource = useApplySource as jest.MockedFunction<typeof useApplySource>;
const mockUseApplyLens = useApplyLens as jest.MockedFunction<typeof useApplyLens>;
const mockUsePlaybackOptions = usePlaybackOptions as jest.MockedFunction<typeof usePlaybackOptions>;

describe("LensPlayer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Hook Integration", () => {
    it("should call usePlaybackOptions with onError", () => {
      const onError = jest.fn();
      render(<LensPlayer onError={onError} />);
      expect(mockUsePlaybackOptions).toHaveBeenCalledWith({ onError });
    });

    it("should call usePlaybackOptions with undefined when no onError provided", () => {
      render(<LensPlayer />);
      expect(mockUsePlaybackOptions).toHaveBeenCalledWith({ onError: undefined });
    });

    it("should call useApplySource with source and outputSize", () => {
      const source = { kind: "camera" as const, deviceId: "device-123" };
      const outputSize = { mode: "fixed" as const, width: 1920, height: 1080 };
      render(<LensPlayer source={source} outputSize={outputSize} />);
      expect(mockUseApplySource).toHaveBeenCalledWith(source, outputSize);
    });

    it("should call useApplySource with undefined when no source provided", () => {
      render(<LensPlayer />);
      expect(mockUseApplySource).toHaveBeenCalledWith(undefined, undefined);
    });

    it("should call useApplyLens with lens parameters", () => {
      const lensId = "lens-123";
      const lensGroupId = "group-456";
      const lensLaunchData = { launchParams: { test: "value" } };
      const lensReadyGuard = jest.fn();

      render(
        <LensPlayer
          lensId={lensId}
          lensGroupId={lensGroupId}
          lensLaunchData={lensLaunchData}
          lensReadyGuard={lensReadyGuard}
        />,
      );

      expect(mockUseApplyLens).toHaveBeenCalledWith(lensId, lensGroupId, lensLaunchData, lensReadyGuard);
    });

    it("should call useApplyLens with undefined values when not provided", () => {
      render(<LensPlayer />);
      expect(mockUseApplyLens).toHaveBeenCalledWith(undefined, undefined, undefined, undefined);
    });
  });

  describe("Refresh Trigger", () => {
    it("should NOT call refreshLens on initial mount even with a defined refreshTrigger value", () => {
      render(<LensPlayer refreshTrigger={1} />);
      expect(mockRefreshLens).not.toHaveBeenCalled();
    });

    it("should NOT call refreshLens when component re-renders but refreshTrigger stays the same", () => {
      const { rerender } = render(<LensPlayer refreshTrigger={1} lensId="lens-1" />);
      expect(mockRefreshLens).not.toHaveBeenCalled();

      // Re-render with different props but same refreshTrigger
      rerender(<LensPlayer refreshTrigger={1} lensId="lens-2" />);
      expect(mockRefreshLens).not.toHaveBeenCalled();

      // Re-render again with same refreshTrigger
      rerender(<LensPlayer refreshTrigger={1} lensId="lens-3" />);
      expect(mockRefreshLens).not.toHaveBeenCalled();
    });

    it("should call refreshLens when refreshTrigger changes", () => {
      const { rerender } = render(<LensPlayer refreshTrigger={1} />);
      expect(mockRefreshLens).not.toHaveBeenCalled();

      rerender(<LensPlayer refreshTrigger={2} />);
      expect(mockRefreshLens).toHaveBeenCalledTimes(1);

      rerender(<LensPlayer refreshTrigger={3} />);
      expect(mockRefreshLens).toHaveBeenCalledTimes(2);
    });

    it("should not call refreshLens when refreshTrigger is undefined and stays undefined", () => {
      const { rerender } = render(<LensPlayer />);
      expect(mockRefreshLens).not.toHaveBeenCalled();

      rerender(<LensPlayer lensId="different" />);
      expect(mockRefreshLens).not.toHaveBeenCalled();
    });

    it("should call refreshLens when refreshTrigger changes from undefined to defined", () => {
      const { rerender } = render(<LensPlayer />);
      expect(mockRefreshLens).not.toHaveBeenCalled();

      rerender(<LensPlayer refreshTrigger={1} />);
      expect(mockRefreshLens).toHaveBeenCalledTimes(1);
    });

    it("should call refreshLens when refreshTrigger changes from defined to undefined", () => {
      const { rerender } = render(<LensPlayer refreshTrigger={1} />);
      expect(mockRefreshLens).not.toHaveBeenCalled();

      rerender(<LensPlayer refreshTrigger={undefined} />);
      expect(mockRefreshLens).toHaveBeenCalledTimes(1);
    });

    it("should handle different types of refreshTrigger values", () => {
      const { rerender } = render(<LensPlayer refreshTrigger="trigger1" />);
      expect(mockRefreshLens).not.toHaveBeenCalled();

      rerender(<LensPlayer refreshTrigger="trigger2" />);
      expect(mockRefreshLens).toHaveBeenCalledTimes(1);

      rerender(<LensPlayer refreshTrigger={{ key: "value" }} />);
      expect(mockRefreshLens).toHaveBeenCalledTimes(2);
    });
  });

  describe("Canvas Rendering", () => {
    it("should render LiveCanvas by default", () => {
      render(<LensPlayer />);
      expect(screen.getByTestId("live-canvas")).toBeInTheDocument();
      expect(screen.queryByTestId("capture-canvas")).not.toBeInTheDocument();
    });

    it('should render LiveCanvas when canvasType is "live"', () => {
      render(<LensPlayer canvasType="live" />);
      expect(screen.getByTestId("live-canvas")).toBeInTheDocument();
      expect(screen.queryByTestId("capture-canvas")).not.toBeInTheDocument();
    });

    it('should render CaptureCanvas when canvasType is "capture"', () => {
      render(<LensPlayer canvasType="capture" />);
      expect(screen.getByTestId("capture-canvas")).toBeInTheDocument();
      expect(screen.queryByTestId("live-canvas")).not.toBeInTheDocument();
    });

    it("should pass className to LiveCanvas", () => {
      render(<LensPlayer className="custom-class" />);
      const canvas = screen.getByTestId("live-canvas");
      expect(canvas).toHaveClass("custom-class");
    });

    it("should pass className to CaptureCanvas", () => {
      render(<LensPlayer canvasType="capture" className="custom-class" />);
      const canvas = screen.getByTestId("capture-canvas");
      expect(canvas).toHaveClass("custom-class");
    });

    it("should pass style to LiveCanvas", () => {
      const style = { width: "100px", height: "100px" };
      render(<LensPlayer style={style} />);
      const canvas = screen.getByTestId("live-canvas");
      expect(canvas).toHaveStyle(style);
    });

    it("should pass style to CaptureCanvas", () => {
      const style = { width: "200px", height: "200px" };
      render(<LensPlayer canvasType="capture" style={style} />);
      const canvas = screen.getByTestId("capture-canvas");
      expect(canvas).toHaveStyle(style);
    });
  });

  describe("Custom Children", () => {
    it("should render custom children when provided", () => {
      render(
        <LensPlayer>
          <div data-testid="custom-child">Custom Content</div>
        </LensPlayer>,
      );
      expect(screen.getByTestId("custom-child")).toBeInTheDocument();
      expect(screen.queryByTestId("live-canvas")).not.toBeInTheDocument();
      expect(screen.queryByTestId("capture-canvas")).not.toBeInTheDocument();
    });

    it("should wrap children in div with className", () => {
      render(
        <LensPlayer className="wrapper-class">
          <div data-testid="custom-child">Custom Content</div>
        </LensPlayer>,
      );
      const wrapper = screen.getByTestId("custom-child").parentElement;
      expect(wrapper).toHaveClass("wrapper-class");
    });

    it("should wrap children in div with style", () => {
      const style = { padding: "10px", margin: "5px" };
      render(
        <LensPlayer style={style}>
          <div data-testid="custom-child">Custom Content</div>
        </LensPlayer>,
      );
      const wrapper = screen.getByTestId("custom-child").parentElement;
      expect(wrapper).toHaveStyle(style);
    });

    it("should render multiple children", () => {
      render(
        <LensPlayer>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </LensPlayer>,
      );
      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
    });
  });

  describe("Source Types", () => {
    it("should handle camera source", () => {
      const source = { kind: "camera" as const, deviceId: "device-123" };
      render(<LensPlayer source={source} />);
      expect(mockUseApplySource).toHaveBeenCalledWith(source, undefined);
    });

    it("should handle video source", () => {
      const source = { kind: "video" as const, url: "https://example.com/video.mp4" };
      render(<LensPlayer source={source} />);
      expect(mockUseApplySource).toHaveBeenCalledWith(source, undefined);
    });

    it("should handle image source", () => {
      const source = { kind: "image" as const, url: "https://example.com/image.jpg" };
      render(<LensPlayer source={source} />);
      expect(mockUseApplySource).toHaveBeenCalledWith(source, undefined);
    });
  });

  describe("Props Changes", () => {
    it("should handle lensId changes", () => {
      const { rerender } = render(<LensPlayer lensId="lens-1" lensGroupId="group-1" />);
      expect(mockUseApplyLens).toHaveBeenCalledWith("lens-1", "group-1", undefined, undefined);

      rerender(<LensPlayer lensId="lens-2" lensGroupId="group-1" />);
      expect(mockUseApplyLens).toHaveBeenCalledWith("lens-2", "group-1", undefined, undefined);
    });

    it("should handle source changes", () => {
      const source1 = { kind: "camera" as const, deviceId: "device-1" };
      const source2 = { kind: "camera" as const, deviceId: "device-2" };

      const { rerender } = render(<LensPlayer source={source1} />);
      expect(mockUseApplySource).toHaveBeenCalledWith(source1, undefined);

      rerender(<LensPlayer source={source2} />);
      expect(mockUseApplySource).toHaveBeenCalledWith(source2, undefined);
    });

    it("should handle canvasType changes", () => {
      const { rerender } = render(<LensPlayer canvasType="live" />);
      expect(screen.getByTestId("live-canvas")).toBeInTheDocument();

      rerender(<LensPlayer canvasType="capture" />);
      expect(screen.getByTestId("capture-canvas")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string className", () => {
      render(<LensPlayer className="" />);
      const canvas = screen.getByTestId("live-canvas");
      expect(canvas.className).toBe("");
    });

    it("should handle null in children", () => {
      render(
        <LensPlayer>
          {null}
          <div data-testid="valid-child">Valid</div>
        </LensPlayer>,
      );
      expect(screen.getByTestId("valid-child")).toBeInTheDocument();
    });

    it("should handle conditional children", () => {
      const showChild = true;
      render(<LensPlayer>{showChild && <div data-testid="conditional-child">Conditional</div>}</LensPlayer>);
      expect(screen.getByTestId("conditional-child")).toBeInTheDocument();
    });

    it("should handle outputSize with partial dimensions", () => {
      const outputSize = { mode: "match-input" as const };
      render(<LensPlayer outputSize={outputSize} />);
      expect(mockUseApplySource).toHaveBeenCalledWith(undefined, outputSize);
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle all props together", () => {
      const props: LensPlayerProps = {
        source: { kind: "camera", deviceId: "device-123" },
        lensId: "lens-456",
        lensGroupId: "group-789",
        lensLaunchData: { launchParams: { test: "value" } },
        lensReadyGuard: jest.fn(),
        canvasType: "capture",
        outputSize: { mode: "fixed", width: 1920, height: 1080 },
        refreshTrigger: 1,
        className: "test-class",
        style: { padding: "10px" },
      };

      render(<LensPlayer {...props} />);

      expect(mockUseApplySource).toHaveBeenCalledWith(props.source, props.outputSize);
      expect(mockUseApplyLens).toHaveBeenCalledWith(
        props.lensId,
        props.lensGroupId,
        props.lensLaunchData,
        props.lensReadyGuard,
      );
      // refreshLens should NOT be called on initial mount
      expect(mockRefreshLens).not.toHaveBeenCalled();

      const canvas = screen.getByTestId("capture-canvas");
      expect(canvas).toHaveClass("test-class");
      expect(canvas).toHaveStyle({ padding: "10px" });
    });

    it("should prioritize children over canvas rendering", () => {
      render(
        <LensPlayer canvasType="capture">
          <div data-testid="custom-child">Override Canvas</div>
        </LensPlayer>,
      );

      expect(screen.getByTestId("custom-child")).toBeInTheDocument();
      expect(screen.queryByTestId("capture-canvas")).not.toBeInTheDocument();
      expect(screen.queryByTestId("live-canvas")).not.toBeInTheDocument();
    });

    it("should handle rapid refreshTrigger changes", () => {
      const { rerender } = render(<LensPlayer refreshTrigger={0} />);

      for (let i = 1; i <= 5; i++) {
        rerender(<LensPlayer refreshTrigger={i} />);
      }

      expect(mockRefreshLens).toHaveBeenCalledTimes(5); // Only actual changes, not initial mount
    });
  });

  describe("Cleanup", () => {
    it("should not crash on unmount", () => {
      const { unmount } = render(<LensPlayer lensId="lens-1" lensGroupId="group-1" />);
      expect(() => unmount()).not.toThrow();
    });

    it("should handle unmount with all props set", () => {
      const { unmount } = render(
        <LensPlayer
          source={{ kind: "camera" }}
          lensId="lens-1"
          lensGroupId="group-1"
          refreshTrigger={1}
          canvasType="capture"
        />,
      );
      expect(() => unmount()).not.toThrow();
    });

    it("should handle unmount with custom children", () => {
      const { unmount } = render(
        <LensPlayer>
          <div>Custom Child</div>
        </LensPlayer>,
      );
      expect(() => unmount()).not.toThrow();
    });
  });
});
