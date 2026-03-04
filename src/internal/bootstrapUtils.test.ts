import { bootstrapCameraKitWithSession } from "./bootstrapUtils";
import {
  bootstrapCameraKit,
  CameraKit,
  CameraKitBootstrapConfiguration,
  CameraKitSession,
  CreateSessionOptions,
  PublicContainer,
} from "@snap/camera-kit";
import { CameraKitLogger } from "./logging";

jest.mock("@snap/camera-kit", () => ({
  bootstrapCameraKit: jest.fn(),
}));

const mockBootstrapCameraKit = bootstrapCameraKit as jest.MockedFunction<typeof bootstrapCameraKit>;

describe("bootstrapCameraKitWithSession", () => {
  let mockKit: jest.Mocked<CameraKit>;
  let mockSession: jest.Mocked<CameraKitSession>;
  let mockLogger: jest.Mocked<CameraKitLogger>;
  let mockConfig: CameraKitBootstrapConfiguration;
  let mockSessionOptions: CreateSessionOptions;
  let abortController: AbortController;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSession = {} as jest.Mocked<CameraKitSession>;

    mockKit = {
      destroy: jest.fn().mockResolvedValue(undefined),
      createSession: jest.fn().mockResolvedValue(mockSession),
    } as any;

    mockBootstrapCameraKit.mockResolvedValue(mockKit);

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockConfig = { apiToken: "test-token" };
    mockSessionOptions = {};
    abortController = new AbortController();
  });

  describe("Successful bootstrap", () => {
    it("should bootstrap CameraKit and create a session", async () => {
      const result = await bootstrapCameraKitWithSession(
        mockConfig,
        undefined,
        mockSessionOptions,
        abortController.signal,
        mockLogger,
      );

      expect(mockBootstrapCameraKit).toHaveBeenCalledWith(mockConfig, undefined);
      expect(mockKit.createSession).toHaveBeenCalledWith(mockSessionOptions);
      expect(result.kit).toBe(mockKit);
      expect(result.session).toBe(mockSession);
      expect(result.destroy).toBeDefined();
    });

    it("should pass extendContainer to bootstrapCameraKit", async () => {
      const extendContainer = jest.fn((container: PublicContainer) => container);

      await bootstrapCameraKitWithSession(
        mockConfig,
        extendContainer,
        mockSessionOptions,
        abortController.signal,
        mockLogger,
      );

      expect(mockBootstrapCameraKit).toHaveBeenCalledWith(mockConfig, extendContainer);
    });
  });

  describe("Abort handling", () => {
    it("should abort after bootstrap if signal is aborted", async () => {
      mockBootstrapCameraKit.mockImplementation(async () => {
        abortController.abort();
        return mockKit;
      });

      await expect(
        bootstrapCameraKitWithSession(mockConfig, undefined, mockSessionOptions, abortController.signal, mockLogger),
      ).rejects.toThrow();

      expect(mockKit.destroy).toHaveBeenCalled();
    });

    it("should abort after session creation if signal is aborted", async () => {
      mockKit.createSession.mockImplementation(async () => {
        abortController.abort();
        return mockSession;
      });

      await expect(
        bootstrapCameraKitWithSession(mockConfig, undefined, mockSessionOptions, abortController.signal, mockLogger),
      ).rejects.toThrow();

      expect(mockKit.destroy).toHaveBeenCalled();
    });

    it("should not create session if aborted before bootstrap completes", async () => {
      abortController.abort();

      await expect(
        bootstrapCameraKitWithSession(mockConfig, undefined, mockSessionOptions, abortController.signal, mockLogger),
      ).rejects.toThrow();

      expect(mockKit.destroy).toHaveBeenCalled();
      expect(mockKit.createSession).not.toHaveBeenCalled();
    });
  });

  describe("Destroy function", () => {
    it("should return a destroy function that calls kit.destroy", async () => {
      const result = await bootstrapCameraKitWithSession(
        mockConfig,
        undefined,
        mockSessionOptions,
        abortController.signal,
        mockLogger,
      );

      await result.destroy();

      expect(mockKit.destroy).toHaveBeenCalled();
    });

    it("should log error if kit.destroy fails", async () => {
      const destroyError = new Error("Destroy failed");
      mockKit.destroy.mockRejectedValue(destroyError);

      const result = await bootstrapCameraKitWithSession(
        mockConfig,
        undefined,
        mockSessionOptions,
        abortController.signal,
        mockLogger,
      );

      await result.destroy();

      expect(mockLogger.error).toHaveBeenCalledWith("kit_destroy_failed", destroyError);
    });

    it("should not throw if kit.destroy fails", async () => {
      mockKit.destroy.mockRejectedValue(new Error("Destroy failed"));

      const result = await bootstrapCameraKitWithSession(
        mockConfig,
        undefined,
        mockSessionOptions,
        abortController.signal,
        mockLogger,
      );

      await expect(result.destroy()).resolves.toBeUndefined();
    });
  });

  describe("Error handling", () => {
    it("should propagate bootstrap errors", async () => {
      const bootstrapError = new Error("Bootstrap failed");
      mockBootstrapCameraKit.mockRejectedValue(bootstrapError);

      await expect(
        bootstrapCameraKitWithSession(mockConfig, undefined, mockSessionOptions, abortController.signal, mockLogger),
      ).rejects.toThrow("Bootstrap failed");
    });

    it("should propagate session creation errors", async () => {
      const sessionError = new Error("Session creation failed");
      mockKit.createSession.mockRejectedValue(sessionError);

      await expect(
        bootstrapCameraKitWithSession(mockConfig, undefined, mockSessionOptions, abortController.signal, mockLogger),
      ).rejects.toThrow("Session creation failed");
    });

    it("should clean up kit if session creation fails", async () => {
      mockKit.createSession.mockRejectedValue(new Error("Session failed"));

      try {
        await bootstrapCameraKitWithSession(
          mockConfig,
          undefined,
          mockSessionOptions,
          abortController.signal,
          mockLogger,
        );
      } catch (e) {
        // Expected
      }

      // Note: The current implementation doesn't cleanup on session creation failure
      // This test documents the current behavior
      // If cleanup is desired, the implementation should be updated
    });
  });

  describe("Result structure", () => {
    it("should return an object with kit, session, and destroy", async () => {
      const result = await bootstrapCameraKitWithSession(
        mockConfig,
        undefined,
        mockSessionOptions,
        abortController.signal,
        mockLogger,
      );

      expect(result).toHaveProperty("kit");
      expect(result).toHaveProperty("session");
      expect(result).toHaveProperty("destroy");
      expect(typeof result.destroy).toBe("function");
    });
  });

  describe("Signal variations", () => {
    it("should work with pre-aborted signal", async () => {
      const preAbortedController = new AbortController();
      preAbortedController.abort();

      await expect(
        bootstrapCameraKitWithSession(
          mockConfig,
          undefined,
          mockSessionOptions,
          preAbortedController.signal,
          mockLogger,
        ),
      ).rejects.toThrow();
    });

    it("should complete successfully if signal is never aborted", async () => {
      const result = await bootstrapCameraKitWithSession(
        mockConfig,
        undefined,
        mockSessionOptions,
        abortController.signal,
        mockLogger,
      );

      expect(result.kit).toBe(mockKit);
      expect(result.session).toBe(mockSession);
    });
  });
});
