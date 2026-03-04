import { ensureError } from "./error";

describe("ensureError", () => {
  describe("Error instances", () => {
    it("should return the same Error instance unchanged", () => {
      const error = new Error("test error");
      const result = ensureError(error);
      expect(result).toBe(error);
      expect(result.message).toBe("test error");
    });

    it("should return TypeError instances unchanged", () => {
      const error = new TypeError("type error");
      const result = ensureError(error);
      expect(result).toBe(error);
      expect(result.message).toBe("type error");
    });
  });

  describe("String values", () => {
    it("should convert string to Error", () => {
      const result = ensureError("something went wrong");
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe("something went wrong");
    });

    it("should handle empty string", () => {
      const result = ensureError("");
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe("");
    });
  });

  describe("Null and undefined values", () => {
    it("should handle null value", () => {
      const result = ensureError(null);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe("An unknown error occurred (null)");
    });

    it("should handle undefined value", () => {
      const result = ensureError(undefined);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe("An unknown error occurred (undefined)");
    });
  });

  describe("Object values", () => {
    it("should extract message from error-like object", () => {
      const errorObj = { message: "custom message" };
      const result = ensureError(errorObj);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toContain("custom message");
    });

    it("should extract error property from object", () => {
      const errorObj = { error: "error description" };
      const result = ensureError(errorObj);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toContain("error description");
    });

    it("should serialize plain object to JSON", () => {
      const errorObj = { code: 500, status: "error" };
      const result = ensureError(errorObj);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toContain("code");
      expect(result.message).toContain("500");
    });
  });

  describe("Context prefix", () => {
    it("should add context prefix to string error", () => {
      const result = ensureError("failure", "API");
      expect(result.message).toBe("[API] failure");
    });

    it("should add context prefix to null error", () => {
      const result = ensureError(null, "Network");
      expect(result.message).toBe("[Network] An unknown error occurred (null)");
    });

    it("should not add prefix when context is undefined", () => {
      const result = ensureError("failure");
      expect(result.message).toBe("failure");
    });
  });

  describe("Primitive values", () => {
    it("should handle number", () => {
      const result = ensureError(42);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toContain("42");
    });

    it("should handle boolean", () => {
      const result = ensureError(false);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toContain("false");
    });
  });

  describe("Non-serializable objects", () => {
    it("should handle circular references", () => {
      const circular: any = { name: "circular" };
      circular.self = circular;
      const result = ensureError(circular);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toContain("Serialization failed");
    });

    it("should handle objects with toJSON that throws", () => {
      const badObj = {
        toJSON() {
          throw new Error("toJSON failed");
        },
      };
      const result = ensureError(badObj);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toContain("Serialization failed");
    });
  });

  describe("Special object types", () => {
    it("should handle Symbol", () => {
      const sym = Symbol("test");
      const result = ensureError(sym);
      expect(result).toBeInstanceOf(Error);
      // Symbol is treated as a primitive, not an object, so it gets serialized
      expect(result.message).toContain("Non-Error exception");
    });

    it("should handle Function", () => {
      const fn = () => {};
      const result = ensureError(fn);
      expect(result).toBeInstanceOf(Error);
      // Function cannot be serialized, so it will fail serialization
      expect(result.message).toContain("Non-Error exception");
    });
  });
});
