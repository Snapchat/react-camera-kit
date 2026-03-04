import { wrapLogger, createConsoleLogger, createNoopLogger, InternalLogger } from "./logging";

describe("wrapLogger", () => {
  let mockLogger: InternalLogger;
  let debugSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    debugSpy = jest.fn();
    infoSpy = jest.fn();
    warnSpy = jest.fn();
    errorSpy = jest.fn();

    mockLogger = {
      logLevel: "debug",
      debug: debugSpy as any,
      info: infoSpy as any,
      warn: warnSpy as any,
      error: errorSpy as any,
    };
  });

  describe("Namespace prefixing", () => {
    it("should prefix debug messages with namespace", () => {
      const wrapped = wrapLogger(mockLogger, "TestNamespace");
      wrapped.debug("test message", "extra param");
      expect(debugSpy).toHaveBeenCalledWith("[TestNamespace] test message", "extra param");
    });

    it("should prefix info messages with namespace", () => {
      const wrapped = wrapLogger(mockLogger, "TestNamespace");
      wrapped.info("info message");
      expect(infoSpy).toHaveBeenCalledWith("[TestNamespace] info message");
    });

    it("should prefix warn messages with namespace", () => {
      const wrapped = wrapLogger(mockLogger, "TestNamespace");
      wrapped.warn("warning message");
      expect(warnSpy).toHaveBeenCalledWith("[TestNamespace] warning message");
    });

    it("should prefix error messages with namespace", () => {
      const wrapped = wrapLogger(mockLogger, "TestNamespace");
      wrapped.error("error message");
      expect(errorSpy).toHaveBeenCalledWith("[TestNamespace] error message");
    });
  });

  describe("Log level filtering - debug", () => {
    beforeEach(() => {
      mockLogger.logLevel = "debug";
    });

    it("should allow all log levels when logLevel is debug", () => {
      const wrapped = wrapLogger(mockLogger, "Test");
      wrapped.debug("msg");
      wrapped.info("msg");
      wrapped.warn("msg");
      wrapped.error("msg");

      expect(debugSpy).toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe("Log level filtering - info", () => {
    beforeEach(() => {
      mockLogger.logLevel = "info";
    });

    it("should not call debug when logLevel is info", () => {
      const wrapped = wrapLogger(mockLogger, "Test");
      wrapped.debug("msg");
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it("should allow info, warn, error when logLevel is info", () => {
      const wrapped = wrapLogger(mockLogger, "Test");
      wrapped.info("msg");
      wrapped.warn("msg");
      wrapped.error("msg");

      expect(infoSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe("Log level filtering - warn", () => {
    beforeEach(() => {
      mockLogger.logLevel = "warn";
    });

    it("should not call debug or info when logLevel is warn", () => {
      const wrapped = wrapLogger(mockLogger, "Test");
      wrapped.debug("msg");
      wrapped.info("msg");

      expect(debugSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
    });

    it("should allow warn and error when logLevel is warn", () => {
      const wrapped = wrapLogger(mockLogger, "Test");
      wrapped.warn("msg");
      wrapped.error("msg");

      expect(warnSpy).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe("Log level filtering - error", () => {
    beforeEach(() => {
      mockLogger.logLevel = "error";
    });

    it("should only allow error when logLevel is error", () => {
      const wrapped = wrapLogger(mockLogger, "Test");
      wrapped.debug("msg");
      wrapped.info("msg");
      wrapped.warn("msg");
      wrapped.error("msg");

      expect(debugSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe("Multiple parameters", () => {
    it("should forward all parameters to inner logger", () => {
      const wrapped = wrapLogger(mockLogger, "NS");
      const obj = { key: "value" };
      const arr = [1, 2, 3];
      wrapped.info("message", obj, arr);

      expect(infoSpy).toHaveBeenCalledWith("[NS] message", obj, arr);
    });
  });

  describe("LogLevel property", () => {
    it("should preserve the logLevel from inner logger", () => {
      mockLogger.logLevel = "warn";
      const wrapped = wrapLogger(mockLogger, "Test");
      expect(wrapped.logLevel).toBe("warn");
    });
  });
});

describe("createConsoleLogger", () => {
  let debugSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    debugSpy = jest.spyOn(console, "debug").mockImplementation();
    infoSpy = jest.spyOn(console, "info").mockImplementation();
    warnSpy = jest.spyOn(console, "warn").mockImplementation();
    errorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("should call console.debug", () => {
    const logger = createConsoleLogger();
    logger.debug("debug message", "param");
    expect(debugSpy).toHaveBeenCalledWith("debug message", "param");
  });

  it("should call console.info", () => {
    const logger = createConsoleLogger();
    logger.info("info message", "param");
    expect(infoSpy).toHaveBeenCalledWith("info message", "param");
  });

  it("should call console.warn", () => {
    const logger = createConsoleLogger();
    logger.warn("warn message", "param");
    expect(warnSpy).toHaveBeenCalledWith("warn message", "param");
  });

  it("should call console.error", () => {
    const logger = createConsoleLogger();
    logger.error("error message", "param");
    expect(errorSpy).toHaveBeenCalledWith("error message", "param");
  });

  it("should forward multiple parameters", () => {
    const logger = createConsoleLogger();
    const obj = { key: "value" };
    logger.info("message", obj, 42, true);
    expect(infoSpy).toHaveBeenCalledWith("message", obj, 42, true);
  });
});

describe("createNoopLogger", () => {
  it("should not throw when calling debug", () => {
    const logger = createNoopLogger();
    expect(() => logger.debug("message")).not.toThrow();
  });

  it("should not throw when calling info", () => {
    const logger = createNoopLogger();
    expect(() => logger.info("message")).not.toThrow();
  });

  it("should not throw when calling warn", () => {
    const logger = createNoopLogger();
    expect(() => logger.warn("message")).not.toThrow();
  });

  it("should not throw when calling error", () => {
    const logger = createNoopLogger();
    expect(() => logger.error("message")).not.toThrow();
  });

  it("should handle multiple parameters without errors", () => {
    const logger = createNoopLogger();
    expect(() => logger.info("message", { key: "value" }, [1, 2, 3])).not.toThrow();
  });
});
