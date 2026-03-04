import { Subject } from "rxjs";
import type { Metric, PublicContainer } from "@snap/camera-kit";
import { Count, ConcatInjectable, Injectable } from "@snap/camera-kit";
import { metricsReporter, extendContainerWithMetrics } from "./metrics";

// Mock includes BOTH old and new API surfaces.
// Tests selectively delete exports to exercise different code paths.
jest.mock("@snap/camera-kit", () => ({
  Count: {
    count: jest.fn((name: string, n: number, dims: Record<string, string>) => ({ name, n, dims })),
  },
  Injectable: jest.fn((_token: unknown, _deps: unknown[], factory: unknown) => ({
    token: _token,
    deps: _deps,
    factory,
  })),
  ConcatInjectable: jest.fn((_token: unknown, factory: () => unknown) => ({
    token: _token,
    factory,
  })),
  externalMetricsSubjectFactory: { token: Symbol("externalMetricsSubjectFactory") },
  externalMetricsFactory: { token: Symbol("externalMetricsFactory") },
}));

// Mutable reference to the mock module so we can delete exports to simulate different CK versions.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const ckMock: Record<string, any> = require("@snap/camera-kit");

const mockCount = Count.count as jest.Mock;

describe("metrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("metricsReporter", () => {
    it("should report a count metric with the correct prefix and default dimensions", () => {
      metricsReporter.reportCount("bootstrap_success");

      expect(mockCount).toHaveBeenCalledWith("react_camera_kit_bootstrap_success", 1, {
        rck_version: expect.any(String),
      });
    });

    it("should forward custom value and dimensions", () => {
      metricsReporter.reportCount("bootstrap_failure");

      expect(mockCount).toHaveBeenCalledWith("react_camera_kit_bootstrap_failure", 1, {
        rck_version: expect.any(String),
      });
    });
  });

  describe("extendContainerWithMetrics (new API: ConcatInjectable)", () => {
    // Default mock has both APIs — new API takes priority.

    function createMockContainer() {
      const container = {
        provides: jest.fn().mockReturnThis(),
      } as unknown as jest.Mocked<PublicContainer>;
      return container;
    }

    it("should use ConcatInjectable with externalMetricsFactory.token", () => {
      const container = createMockContainer();
      const wrapped = extendContainerWithMetrics();
      wrapped(container);

      expect(container.provides).toHaveBeenCalled();
      expect(ConcatInjectable).toHaveBeenCalledWith(ckMock.externalMetricsFactory.token, expect.any(Function));
    });

    it("should call user extendContainer and then inject metrics", () => {
      const userExtend = jest.fn((c: PublicContainer) => c);
      const container = createMockContainer();

      const wrapped = extendContainerWithMetrics(userExtend);
      wrapped(container);

      expect(userExtend).toHaveBeenCalledWith(container);
      expect(container.provides).toHaveBeenCalled();
    });

    it("should work without user extendContainer", () => {
      const container = createMockContainer();
      const wrapped = extendContainerWithMetrics();
      wrapped(container);

      expect(container.provides).toHaveBeenCalled();
    });

    it("should provide an observable factory that can be subscribed to", () => {
      const container = createMockContainer();
      const wrapped = extendContainerWithMetrics();
      wrapped(container);

      // Extract the factory callback passed to ConcatInjectable
      const concatCall = (ConcatInjectable as jest.Mock).mock.calls.at(-1);
      const factory = concatCall![1] as () => unknown;

      // The factory should return an observable
      const observable = factory();
      expect(observable).toBeDefined();
      expect(typeof (observable as { subscribe: unknown }).subscribe).toBe("function");
    });
  });

  describe("extendContainerWithMetrics (legacy API: Injectable fallback)", () => {
    let savedExternalMetricsFactory: unknown;

    beforeEach(() => {
      // Remove externalMetricsFactory to force the legacy fallback path.
      savedExternalMetricsFactory = ckMock.externalMetricsFactory;
      delete ckMock.externalMetricsFactory;
    });

    afterEach(() => {
      // Restore externalMetricsFactory.
      ckMock.externalMetricsFactory = savedExternalMetricsFactory;
    });

    function createMockContainer() {
      const container = {
        provides: jest.fn().mockReturnThis(),
      } as unknown as jest.Mocked<PublicContainer>;
      return container;
    }

    /** Extract the DI factory callback that was passed to Injectable. */
    function extractFactory() {
      const injectable = (Injectable as jest.Mock).mock.results.at(-1)?.value;
      return injectable.factory as (existingSubject: Subject<Metric>) => Subject<Metric>;
    }

    it("should call container.provides with an Injectable targeting the metrics token", () => {
      const container = createMockContainer();
      const wrapped = extendContainerWithMetrics();
      wrapped(container);

      expect(container.provides).toHaveBeenCalled();
      expect(Injectable).toHaveBeenCalledWith(
        ckMock.externalMetricsSubjectFactory.token,
        [ckMock.externalMetricsSubjectFactory.token],
        expect.any(Function),
      );
    });

    it("should call user extendContainer and then inject metrics", () => {
      const userExtend = jest.fn((c: PublicContainer) => c);
      const container = createMockContainer();

      const wrapped = extendContainerWithMetrics(userExtend);
      wrapped(container);

      expect(userExtend).toHaveBeenCalledWith(container);
      expect(container.provides).toHaveBeenCalled();
    });

    it("should work without user extendContainer", () => {
      const container = createMockContainer();
      const wrapped = extendContainerWithMetrics();
      wrapped(container);

      expect(container.provides).toHaveBeenCalled();
    });

    describe("DI factory callback", () => {
      it("should forward metricsReporter events to the existing subject", () => {
        const container = createMockContainer();
        const wrapped = extendContainerWithMetrics();
        wrapped(container);

        const factory = extractFactory();
        const existingSubject = new Subject<Metric>();
        const received: Metric[] = [];
        existingSubject.subscribe({ next: (m) => received.push(m) });

        // Wire up forwarding
        const returned = factory(existingSubject);

        // Report a metric through the global reporter
        metricsReporter.reportCount("test_event");

        expect(received).toHaveLength(1);
        expect(returned).toBe(existingSubject);
      });

      it("should return the existing subject (not replace it)", () => {
        const container = createMockContainer();
        const wrapped = extendContainerWithMetrics();
        wrapped(container);

        const factory = extractFactory();
        const existingSubject = new Subject<Metric>();
        const returned = factory(existingSubject);

        expect(returned).toBe(existingSubject);
      });

      it("should tear down previous subscription on re-bootstrap", () => {
        const container = createMockContainer();

        // First bootstrap
        const wrapped1 = extendContainerWithMetrics();
        wrapped1(container);
        const factory1 = extractFactory();
        const subject1 = new Subject<Metric>();
        const received1: Metric[] = [];
        subject1.subscribe({ next: (m) => received1.push(m) });
        factory1(subject1);

        // Second bootstrap (simulates re-bootstrap)
        const wrapped2 = extendContainerWithMetrics();
        wrapped2(container);
        const factory2 = extractFactory();
        const subject2 = new Subject<Metric>();
        const received2: Metric[] = [];
        subject2.subscribe({ next: (m) => received2.push(m) });
        factory2(subject2);

        // Report after re-bootstrap
        metricsReporter.reportCount("after_rebootstrap");

        // Old subject should NOT receive the event (subscription torn down)
        expect(received1).toHaveLength(0);
        // New subject should receive it
        expect(received2).toHaveLength(1);
      });

      it("should not propagate error or complete to the existing subject", () => {
        const container = createMockContainer();
        const wrapped = extendContainerWithMetrics();
        wrapped(container);

        const factory = extractFactory();
        const existingSubject = new Subject<Metric>();

        let errored = false;
        let completed = false;
        existingSubject.subscribe({
          error: () => {
            errored = true;
          },
          complete: () => {
            completed = true;
          },
        });

        factory(existingSubject);

        // The existing subject should remain open regardless
        expect(errored).toBe(false);
        expect(completed).toBe(false);
      });
    });
  });

  describe("extendContainerWithMetrics (no metrics API available)", () => {
    const saved: Record<string, unknown> = {};

    beforeEach(() => {
      // Remove ALL metrics-related exports to simulate an unknown CK version.
      for (const key of ["ConcatInjectable", "externalMetricsFactory", "Injectable", "externalMetricsSubjectFactory"]) {
        saved[key] = ckMock[key];
        delete ckMock[key];
      }
    });

    afterEach(() => {
      for (const [key, val] of Object.entries(saved)) {
        ckMock[key] = val;
      }
    });

    function createMockContainer() {
      const container = {
        provides: jest.fn().mockReturnThis(),
      } as unknown as jest.Mocked<PublicContainer>;
      return container;
    }

    it("should return the container unchanged without calling provides", () => {
      const container = createMockContainer();
      const wrapped = extendContainerWithMetrics();
      const result = wrapped(container);

      expect(container.provides).not.toHaveBeenCalled();
      expect(result).toBe(container);
    });

    it("should still call user extendContainer even when metrics APIs are absent", () => {
      const userExtend = jest.fn((c: PublicContainer) => c);
      const container = createMockContainer();

      const wrapped = extendContainerWithMetrics(userExtend);
      wrapped(container);

      expect(userExtend).toHaveBeenCalledWith(container);
      expect(container.provides).not.toHaveBeenCalled();
    });
  });
});
