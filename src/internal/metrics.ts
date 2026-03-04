import { Count, Metric, PublicContainer, ConcatInjectable, Injectable } from "@snap/camera-kit";
import * as CameraKitModule from "@snap/camera-kit";
import { Observable, Subject, Subscription } from "rxjs";
import { VERSION } from "../version";

type ExternalMetricsFactory = {
  (): Observable<Metric>[];
  token: "externalMetrics";
  dependencies: [];
};

type ExternalMetricsSubjectFactory = {
  (): Subject<Metric>;
  token: "externalMetricsSubject";
  dependencies: [];
};

/**
 * Namespace alias for runtime feature detection.
 * This allows graceful degradation across Camera Kit versions:
 *  - Newer: `externalMetricsFactory`
 *  - Older: `externalMetricsSubjectFactory`
 *  - Unknown future: neither → metrics injection is silently skipped.
 *
 * TODO: once Camera Kit peer dependency is >= 1.15.0,
 * we can remove the legacy code path and import externalMetricsFactory directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ck = CameraKitModule as Record<string, any>;

const METRICS_PREFIX = "react_camera_kit";

/** Single module-level Subject shared across all bootstrap cycles. */
const metricsSubject = new Subject<Metric>();

/**
 * Tracks the forwarding subscription used by the legacy API path.
 * Only relevant when Camera Kit does not export `externalMetricsFactory`.
 */
let forwardingSubscription: Subscription | undefined;

export type MetricsReporter = ReturnType<typeof createMetricsReporter>;

/**
 * Creates a metrics reporter that pushes Count metrics into a Subject.
 * The subject is wired into Camera Kit's DI container so metrics flow
 * through the SDK's built-in pipeline to the backend.
 */
function createMetricsReporter(subject: Subject<Metric>) {
  return {
    reportCount(name: string) {
      subject.next(
        Count.count(`${METRICS_PREFIX}_${name}`, 1, {
          rck_version: sanitizeMetricFragment(VERSION),
        }),
      );
    },
  };
}

/** Global metrics reporter — safe to call at any point; events are buffered until the DI wiring is established. */
export const metricsReporter = createMetricsReporter(metricsSubject);

/**
 * Wraps a user-supplied `extendContainer` (if any) so that our metrics Subject
 * is always provided into Camera Kit's DI container.
 *
 * Newer Camera Kit versions (with `externalMetricsFactory`)
 * use a simpler declarative approach. Older versions fall back to
 * `externalMetricsSubjectFactory` with manual subscribe-and-forward.
 *
 * On re-bootstrap the previous forwarding subscription is torn down automatically
 * (legacy path only; the new path doesn't need that).
 */
export function extendContainerWithMetrics(
  userExtendContainer?: (container: PublicContainer) => PublicContainer,
): (container: PublicContainer) => PublicContainer {
  return (container: PublicContainer) => {
    const result = userExtendContainer ? userExtendContainer(container) : container;

    // Resolve lazily — the export may or may not exist depending on the CK version.
    const metricsFactory = ck["externalMetricsFactory"] as ExternalMetricsFactory | undefined;
    const subjectFactory = ck["externalMetricsSubjectFactory"] as ExternalMetricsSubjectFactory | undefined;

    // Newer Camera Kit: externalMetricsFactory
    if (metricsFactory) {
      return result.provides(getNewInjectable(metricsFactory, metricsSubject));
    }

    // Fallback: older Camera Kit externalMetricsSubjectFactory
    if (subjectFactory) {
      return result.provides(getLegacyInjectable(subjectFactory, metricsSubject));
    }

    // Neither API surface available — skip metrics injection.
    return result;
  };
}

function getNewInjectable(factory: ExternalMetricsFactory, metricsSubject: Subject<Metric>) {
  return ConcatInjectable(factory.token, () => metricsSubject.asObservable());
}

function getLegacyInjectable(factory: ExternalMetricsSubjectFactory, metricsSubject: Subject<Metric>) {
  return Injectable(factory.token, [factory.token] as const, (existingSubject: Subject<Metric>) => {
    // Tear down previous forwarding subscription before creating a new one.
    forwardingSubscription?.unsubscribe();

    // Only forward `next` events – we must never propagate `error` or `complete`
    // to the shared Subject, as that would terminate the metrics pipeline for
    // all consumers.
    forwardingSubscription = metricsSubject.subscribe({
      next: (metric) => existingSubject.next(metric),
      error: () => {},
      complete: () => {},
    });
    return existingSubject;
  });
}

function sanitizeMetricFragment(fragment: string) {
  return fragment.toLowerCase().replaceAll(".", "_");
}
