/**
 * Pluggable logging interface for react-camera-kit.
 * Vendor-neutral design allows integrating with any logging system.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Logger interface that matches console.log signature.
 * Can be implemented by any logging library.
 * Users only need to implement the basic log methods - child logger creation is handled internally.
 */
export interface CameraKitLogger {
  debug(message?: any, ...optionalParams: any[]): void;
  info(message?: any, ...optionalParams: any[]): void;
  warn(message?: any, ...optionalParams: any[]): void;
  error(message?: any, ...optionalParams: any[]): void;
}

/**
 * Logger interface that matches console.log signature.
 * Can be implemented by any logging library.
 * Users only need to implement the basic log methods - child logger creation is handled internally.
 */
export interface InternalLogger extends CameraKitLogger {
  logLevel: LogLevel;
}

const noop = () => {};

/**
 * Creates a child logger with a namespace prefix.
 * This is used internally to create namespaced loggers for different parts of the library.
 */
export function wrapLogger(inner: InternalLogger, namespace: string): InternalLogger {
  const levelOrder: LogLevel[] = ["debug", "info", "warn", "error"];
  const minLevelIndex = levelOrder.indexOf(inner.logLevel);

  function shouldLog(msgLevel: LogLevel): boolean {
    return levelOrder.indexOf(msgLevel) >= minLevelIndex;
  }

  // Create a wrapper that prefixes messages with namespace
  const outer: InternalLogger = {
    logLevel: inner.logLevel,
    debug: shouldLog("debug")
      ? (message, ...optionalParams) => inner.debug(`[${namespace}] ${message}`, ...optionalParams)
      : noop,
    info: shouldLog("info")
      ? (message, ...optionalParams) => inner.info(`[${namespace}] ${message}`, ...optionalParams)
      : noop,
    warn: shouldLog("warn")
      ? (message, ...optionalParams) => inner.warn(`[${namespace}] ${message}`, ...optionalParams)
      : noop,
    error: shouldLog("error")
      ? (message, ...optionalParams) => inner.error(`[${namespace}] ${message}`, ...optionalParams)
      : noop,
  };

  return outer;
}

/**
 * Console-based logger implementation with timestamps.
 * Log level can be controlled via the setLevel() method or CameraKitProvider's logLevel prop.
 */
export function createConsoleLogger(): CameraKitLogger {
  return {
    debug: (message, ...optionalParams) => console.debug(message, ...optionalParams),
    info: (message, ...optionalParams) => console.info(message, ...optionalParams),
    warn: (message, ...optionalParams) => console.warn(message, ...optionalParams),
    error: (message, ...optionalParams) => console.error(message, ...optionalParams),
  };
}

/**
 * No-op logger that discards all log messages.
 * Useful for production environments where logging is handled externally.
 */
export function createNoopLogger(): CameraKitLogger {
  return {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
  };
}
