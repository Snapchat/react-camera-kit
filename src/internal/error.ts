export function ensureError(error: unknown, context?: string): Error {
  if (error instanceof Error) return error;

  const contextPrefix = context ? `[${context}] ` : "";

  try {
    // Handle primitive types more explicitly
    if (typeof error === "string") {
      return new Error(`${contextPrefix}${error}`);
    }

    if (error === null || error === undefined) {
      return new Error(`${contextPrefix}An unknown error occurred (${error})`);
    }

    // Try to extract useful info from error-like objects
    const errorObj = error as Record<string, unknown>;
    const message = errorObj.message || errorObj.error || "Unknown error";
    const details = JSON.stringify(error, null, 2);

    return new Error(`${contextPrefix}Non-Error exception: ${message}\nDetails: ${details}`);
  } catch (serializationError) {
    // Provide more info about what failed
    return new Error(
      `${contextPrefix}Non-Error exception thrown. ` +
        `Type: ${typeof error}, ` +
        `Constructor: ${error?.constructor?.name ?? "unknown"}, ` +
        `Serialization failed: ${serializationError instanceof Error ? serializationError.message : "unknown reason"}`,
    );
  }
}
