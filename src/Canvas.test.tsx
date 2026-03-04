import { render, waitFor } from "@testing-library/react";
import { LiveCanvas, CaptureCanvas } from "./Canvas";
import { useInternalCameraKit } from "./CameraKitProvider";

jest.mock("@snap/camera-kit", () => ({}));
jest.mock("./CameraKitProvider");

const mockUseInternalCameraKit = useInternalCameraKit as jest.MockedFunction<typeof useInternalCameraKit>;

describe("Canvas components", () => {
  let mockLiveCanvas: HTMLCanvasElement;
  let mockCaptureCanvas: HTMLCanvasElement;
  let mockSession: any;

  beforeEach(() => {
    mockLiveCanvas = document.createElement("canvas");
    mockCaptureCanvas = document.createElement("canvas");

    mockSession = {
      output: {
        live: mockLiveCanvas,
        capture: mockCaptureCanvas,
      },
      play: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn().mockResolvedValue(undefined),
    };
  });

  describe("LiveCanvas", () => {
    it("should render a container div", () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: mockSession,
      } as any);

      const { container } = render(<LiveCanvas />);
      expect(container.querySelector("div")).toBeTruthy();
    });

    it("should apply custom className", () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: mockSession,
      } as any);

      const { container } = render(<LiveCanvas className="custom-class" />);
      const div = container.querySelector("div");
      expect(div?.className).toBe("custom-class");
    });

    it("should apply custom style", () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: mockSession,
      } as any);

      const customStyle = { width: "100px", height: "200px" };
      const { container } = render(<LiveCanvas style={customStyle} />);
      const div = container.querySelector("div") as HTMLElement;
      expect(div.style.width).toBe("100px");
      expect(div.style.height).toBe("200px");
    });

    it("should attach live canvas to container when session exists", async () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: mockSession,
      } as any);

      const { container } = render(<LiveCanvas />);
      const containerDiv = container.querySelector("div");

      await waitFor(() => {
        expect(containerDiv?.contains(mockLiveCanvas)).toBe(true);
      });
    });

    it("should call play on live canvas when mounted", async () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: mockSession,
      } as any);

      render(<LiveCanvas />);

      await waitFor(() => {
        expect(mockSession.play).toHaveBeenCalledWith("live");
      });
    });

    it("should call pause and detach canvas on unmount", async () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: mockSession,
      } as any);

      const { unmount } = render(<LiveCanvas />);

      await waitFor(() => {
        expect(mockSession.play).toHaveBeenCalledWith("live");
      });

      unmount();

      await waitFor(() => {
        expect(mockSession.pause).toHaveBeenCalledWith("live");
      });
    });

    it("should not attach canvas when session is null", () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: null,
      } as any);

      const { container } = render(<LiveCanvas />);
      const containerDiv = container.querySelector("div");

      expect(containerDiv?.children.length).toBe(0);
      expect(mockSession.play).not.toHaveBeenCalled();
    });

    it("should not attach canvas when session is undefined", () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: undefined,
      } as any);

      const { container } = render(<LiveCanvas />);
      const containerDiv = container.querySelector("div");

      expect(containerDiv?.children.length).toBe(0);
      expect(mockSession.play).not.toHaveBeenCalled();
    });

    it("should handle session change", async () => {
      const { rerender } = render(<LiveCanvas />);

      // Start with no session
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: null,
      } as any);
      rerender(<LiveCanvas />);

      // Add session
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: mockSession,
      } as any);
      rerender(<LiveCanvas />);

      await waitFor(() => {
        expect(mockSession.play).toHaveBeenCalledWith("live");
      });
    });
  });

  describe("CaptureCanvas", () => {
    it("should render a container div", () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: mockSession,
      } as any);

      const { container } = render(<CaptureCanvas />);
      expect(container.querySelector("div")).toBeTruthy();
    });

    it("should apply custom className", () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: mockSession,
      } as any);

      const { container } = render(<CaptureCanvas className="capture-class" />);
      const div = container.querySelector("div");
      expect(div?.className).toBe("capture-class");
    });

    it("should apply custom style", () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: mockSession,
      } as any);

      const customStyle = { border: "1px solid red" };
      const { container } = render(<CaptureCanvas style={customStyle} />);
      const div = container.querySelector("div") as HTMLElement;
      expect(div.style.border).toBe("1px solid red");
    });

    it("should attach capture canvas to container when session exists", async () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: mockSession,
      } as any);

      const { container } = render(<CaptureCanvas />);
      const containerDiv = container.querySelector("div");

      await waitFor(() => {
        expect(containerDiv?.contains(mockCaptureCanvas)).toBe(true);
      });
    });

    it("should call play on capture canvas when mounted", async () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: mockSession,
      } as any);

      render(<CaptureCanvas />);

      await waitFor(() => {
        expect(mockSession.play).toHaveBeenCalledWith("capture");
      });
    });

    it("should call pause and detach canvas on unmount", async () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: mockSession,
      } as any);

      const { unmount } = render(<CaptureCanvas />);

      await waitFor(() => {
        expect(mockSession.play).toHaveBeenCalledWith("capture");
      });

      unmount();

      await waitFor(() => {
        expect(mockSession.pause).toHaveBeenCalledWith("capture");
      });
    });

    it("should not attach canvas when session is null", () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: null,
      } as any);

      const { container } = render(<CaptureCanvas />);
      const containerDiv = container.querySelector("div");

      expect(containerDiv?.children.length).toBe(0);
      expect(mockSession.play).not.toHaveBeenCalled();
    });

    it("should handle session change", async () => {
      const { rerender } = render(<CaptureCanvas />);

      // Start with no session
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: null,
      } as any);
      rerender(<CaptureCanvas />);

      // Add session
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: mockSession,
      } as any);
      rerender(<CaptureCanvas />);

      await waitFor(() => {
        expect(mockSession.play).toHaveBeenCalledWith("capture");
      });
    });
  });

  describe("Canvas reattachment", () => {
    it("should not duplicate canvas when re-attaching", async () => {
      mockUseInternalCameraKit.mockReturnValue({
        currentSession: mockSession,
      } as any);

      const { container, rerender } = render(<LiveCanvas />);
      const containerDiv = container.querySelector("div");

      await waitFor(() => {
        expect(containerDiv?.contains(mockLiveCanvas)).toBe(true);
      });

      // Re-render
      rerender(<LiveCanvas />);

      // Canvas should still be there only once
      const canvases = containerDiv?.querySelectorAll("canvas");
      expect(canvases?.length).toBe(1);
    });
  });
});
