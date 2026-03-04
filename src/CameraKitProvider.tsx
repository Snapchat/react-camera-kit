import React, { createContext, useContext, useEffect, useState, ReactNode, useRef, useMemo, useCallback } from "react";
import {
  CameraKit,
  CameraKitBootstrapConfiguration,
  CameraKitSession,
  PublicContainer,
  Lens,
  LensLaunchData,
  CameraKitSource,
  CameraKitSessionEvents,
  ScreenRegions,
  Keyboard,
} from "@snap/camera-kit";
import hash from "stable-hash";
import { CurrentLens, CurrentSource, NO_CURRENT_LENS, SourceInput, OutputSize } from "./types";
import { CameraKitLogger, InternalLogger, LogLevel, createNoopLogger, wrapLogger } from "./internal/logging";
import { ensureError } from "./internal/error";
import { createCameraKitSource } from "./internal/sourceUtils";
import { withSessionPaused } from "./internal/sessionUtils";
import { bootstrapCameraKitWithSession } from "./internal/bootstrapUtils";
import { metricsReporter, extendContainerWithMetrics } from "./internal/metrics";

// How long to wait for a Lens "ready" event.
const readyTimeoutMs = 2000;

export type MetricEventHandlerFactory = () => (
  event:
    | { kind: "bootstrap-attempt" | "bootstrap-success" }
    | { kind: "bootstrap-failure" | "lens-failure"; error: Error },
) => void;

/**
 * Public context interface exposed to consumers via useCameraKit hook.
 * Provides access to Camera Kit SDK state, Lens management, source control, and playback options.
 */
interface CameraKitContextValue {
  /** Current SDK initialization status. */
  sdkStatus: "uninitialized" | "initializing" | "ready" | "error";

  /** Error that occurred during SDK initialization, if any. */
  sdkError: Error | undefined;

  /** Live canvas element for real-time preview rendering. */
  liveCanvas: HTMLCanvasElement | undefined;

  /** Capture canvas element for snapshot rendering. */
  captureCanvas: HTMLCanvasElement | undefined;

  /** Source state including status, input parameters, and any errors. */
  source: CurrentSource;

  /** Lens state including status, Lens object, and any errors. */
  lens: CurrentLens;

  /**
   * The {@link Keyboard} API enables applications to handle keyboard input requests from lenses.
   * When a lens requests a keyboard, the app displays it in its preferred UI. As users type,
   * the app sends the text back to the lens for display. The lens can also request keyboard dismissal,
   * prompting the app to remove the displayed keyboard.
   */
  keyboard: Keyboard | undefined;

  /** Attempts to re-initialize the SDK after an error. Only available when SDK is in error state. */
  reinitialize: () => void;

  /** Applies a media source (camera, video, or image) to the session. */
  applySource: (input: SourceInput, size?: OutputSize) => Promise<void>;

  /** Removes the current source from the session. */
  removeSource: () => Promise<void>;

  /** Array of lenses that have been loaded via fetchLens or fetchLenses. */
  lenses: Lens[];

  /** Loads a single Lens by ID and group ID. Returns cached Lens if already loaded. */
  fetchLens: (lensId: string, groupId: string) => Promise<Lens>;

  /** Loads all lenses from one or more Lens groups. */
  fetchLenses: (groupId: string | string[]) => Promise<Lens[]>;

  /**
   * Applies a Lens to the current session.
   * @param lensId - The Lens identifier
   * @param groupId - The Lens group identifier
   * @param launchData - Optional launch parameters for the Lens
   * @param lensReadyGuard - Optional async guard for coordinating Lens application
   * @returns Promise that resolves to true if Lens was applied successfully
   */
  applyLens: (
    lensId: string,
    groupId: string,
    launchData?: LensLaunchData,
    lensReadyGuard?: () => Promise<void>,
  ) => Promise<boolean>;

  /** Removes the currently applied Lens from the session. */
  removeLens: () => Promise<boolean>;

  /** Refreshes the current Lens by removing and reapplying it. */
  refreshLens: () => Promise<void>;

  /** Sets the muted state for audio playback. */
  setMuted: (muted: boolean) => void;

  /** Toggles the current muted state. */
  toggleMuted: () => void;

  /** Whether audio is currently muted. */
  isMuted: boolean;

  /** Current FPS limit, if set. */
  fpsLimit: number | undefined;

  /** Sets the maximum FPS for rendering. Useful for reducing resource usage. */
  setFPSLimit: (fpsLimit: number) => Promise<void>;

  /** Current screen regions configuration, if set. */
  screenRegions: ScreenRegions | undefined;

  /** Sets screen regions for Lens-aware UI layout. */
  setScreenRegions: (screenRegions: ScreenRegions) => Promise<void>;
}

// Internal context interface (includes dangerous APIs for internal use only)
interface InternalCameraKitContextValue extends CameraKitContextValue {
  cameraKit: CameraKit | undefined;
  currentSession: CameraKitSession | undefined;
  getLogger: (ns: string) => CameraKitLogger;
}

const throwNoContext = () => {
  throw new Error("useCameraKit must be used within a CameraKitProvider");
};

const defaultCameraKitContextValue: CameraKitContextValue = {
  sdkStatus: "uninitialized",
  sdkError: undefined,
  liveCanvas: undefined,
  captureCanvas: undefined,
  source: {
    status: "none",
    error: undefined,
    input: undefined,
    initializedInput: undefined,
  },
  lens: NO_CURRENT_LENS,
  keyboard: undefined,
  lenses: [],
  isMuted: false,
  fpsLimit: undefined,
  screenRegions: undefined,
  reinitialize: throwNoContext,
  applySource: throwNoContext,
  removeSource: throwNoContext,
  fetchLens: throwNoContext,
  fetchLenses: throwNoContext,
  applyLens: throwNoContext,
  removeLens: throwNoContext,
  refreshLens: throwNoContext,
  setFPSLimit: throwNoContext,
  setMuted: throwNoContext,
  toggleMuted: throwNoContext,
  setScreenRegions: throwNoContext,
};

// Single context that includes everything (setters are internal)
const CameraKitContext = createContext<InternalCameraKitContextValue | undefined>(undefined);

/**
 * Props for the CameraKitProvider component.
 * Extends Camera Kit bootstrap configuration with React-specific options.
 */
interface CameraKitProviderProps extends Omit<CameraKitBootstrapConfiguration, "logger"> {
  /**
   * Optional function to extend the Camera Kit dependency injection container.
   * This is the second parameter to bootstrapCameraKit and allows customization
   * of the SDK's internal dependencies.
   */
  extendContainer?: (container: PublicContainer) => PublicContainer;

  /**
   * Optional factory for creating bootstrap event handlers for metrics/analytics.
   * Useful for tracking SDK initialization success/failure in your analytics system.
   */
  createBootstrapEventHandler?: MetricEventHandlerFactory;

  /**
   * Optional custom logger implementation. If not provided, a no-op logger is used by default.
   * Pass createConsoleLogger() from './logging' for console-based logging in development.
   *
   * @example
   * ```tsx
   * import { createConsoleLogger } from '@snap/react-camera-kit';
   *
   * <CameraKitProvider logger={createConsoleLogger()} logLevel="debug">
   *   {children}
   * </CameraKitProvider>
   * ```
   */
  logger?: CameraKitLogger;

  /**
   * Optional log level to control logger verbosity. Defaults to "info" if not specified.
   * Supported levels: "debug", "info", "warn", "error".
   */
  logLevel?: LogLevel;

  /**
   * Browsers optimize tabs when they are hidden - for example, by pausing the execution of requestAnimationFrame
   * callbacks.
   *
   * If you need the CameraKitSession to continue rendering even when the tab is in the background, set this to true.
   * There is a small performance penalty, and it's a good practice to only render in the background if absolutely
   * necessary.
   */
  renderWhileTabHidden?: boolean;

  /**
   * Optional manual override for bootstrap stability. If provided, the provider will re-bootstrap
   * whenever this value changes, regardless of other config details.
   *
   * Useful when you want explicit control over when the SDK reinitializes.
   */
  stabilityKey?: string | number;

  /**
   * React children to render within the provider.
   */
  children: ReactNode;
}

/* ------------------------------ provider -------------------------------- */

/**
 * Provider component that initializes and manages the Camera Kit SDK.
 *
 * This component handles SDK bootstrapping, session creation, and provides access to
 * Camera Kit functionality through React context. All Camera Kit hooks and components
 * must be used within this provider.
 *
 * The provider automatically manages SDK lifecycle, including initialization, cleanup,
 * and re-initialization when configuration changes.
 *
 * @example
 * ```tsx
 * import { CameraKitProvider, createConsoleLogger } from '@snap/react-camera-kit';
 *
 * function App() {
 *   return (
 *     <CameraKitProvider
 *       apiToken="your-api-token"
 *       logger={createConsoleLogger()}
 *       logLevel="debug"
 *     >
 *       <YourCameraKitComponents />
 *     </CameraKitProvider>
 *   );
 * }
 * ```
 */
export const CameraKitProvider: React.FC<CameraKitProviderProps> = ({
  extendContainer,
  stabilityKey,
  children,
  createBootstrapEventHandler,
  logger: providedLogger,
  logLevel = "info",
  renderWhileTabHidden,
  ...bootstrapConfig
}) => {
  // Prevent nesting CameraKitProvider within another CameraKitProvider
  const existingContext = useContext(CameraKitContext);
  if (existingContext) {
    throw new Error("CameraKitProvider cannot be nested within another CameraKitProvider.");
  }

  const { rootLogger, log } = useMemo(() => {
    const rootLogger = wrapLogger({ ...(providedLogger ?? createNoopLogger()), logLevel }, "react-camera-kit");
    const currentLogger = wrapLogger(rootLogger, "CameraKitProvider");
    return { rootLogger, log: currentLogger };
  }, [providedLogger, logLevel]);

  // Cache for child loggers to ensure same namespace returns same instance
  const loggerCacheRef = useRef<Map<string, InternalLogger>>(new Map());

  // Clear cache when log changes to ensure child loggers get new parent
  useEffect(() => {
    loggerCacheRef.current.clear();
  }, [rootLogger]);

  // Helper to create child loggers for internal hooks
  const getLogger = useCallback(
    (ns: string) => {
      // Check cache first
      if (loggerCacheRef.current.has(ns)) {
        return loggerCacheRef.current.get(ns)!;
      }

      // Create and cache new child logger
      const childLogger = wrapLogger(rootLogger, ns);
      loggerCacheRef.current.set(ns, childLogger);
      return childLogger;
    },
    [rootLogger],
  );

  /** engine bootstrap + global state */
  const [cameraKitState, setCameraKitState] = useState<{
    kit?: CameraKit;
    session?: CameraKitSession;
    status: CameraKitContextValue["sdkStatus"];
    error?: CameraKitContextValue["sdkError"];
  }>({ status: "uninitialized" });

  /** per-provider session + ui states (single session for now) */
  const [source, setSource] = useState<CurrentSource>(defaultCameraKitContextValue.source);
  const [lens, setLens] = useState<CurrentLens>(defaultCameraKitContextValue.lens);
  const [bootstrapCounter, setBootstrapCounter] = useState(0);

  /** playback state */
  const [isMuted, setIsMuted] = useState(false);
  const [fpsLimit, setFpsLimitState] = useState<number | undefined>(undefined);
  const [screenRegions, setScreenRegionsState] = useState<ScreenRegions | undefined>(undefined);

  /** Lens manager state */
  const [lenses, setLenses] = useState<Lens[]>([]);
  const lensCache = useRef<Map<string, Lens>>(new Map());

  /** keep latest cameraKit in a ref for cleanup */
  const kitRef = useRef<{ kit: CameraKit; destroy: () => Promise<void> }>();

  /** keep metrics factory in a ref so swapping it doesn’t re-bootstrap */
  const eventFactoryRef = useRef<MetricEventHandlerFactory | undefined>(createBootstrapEventHandler);
  useEffect(() => {
    eventFactoryRef.current = createBootstrapEventHandler;
  }, [createBootstrapEventHandler]);

  /**
   * Semantic key:
   * - If stabilityKey is provided - use it as the sole trigger.
   * - Else hash a generic projection of { config, extendContainer } so ANY field change
   *   in CameraKitBootstrapConfiguration (or extendContainer) reboots the SDK.
   */
  const bootstrapKey = useMemo(() => {
    if (stabilityKey != null) return String(stabilityKey);

    return hash({ config: bootstrapConfig, extendContainer, renderWhileTabHidden });
  }, [bootstrapConfig, extendContainer, renderWhileTabHidden, stabilityKey]);

  /* ---------------------------- bootstrap engine ------------------------- */
  useEffect(() => {
    const abortController = new AbortController();
    const emit = eventFactoryRef.current?.();

    setCameraKitState({ status: "initializing" });
    emit?.({ kind: "bootstrap-attempt" });
    log.info("bootstrap_attempt");

    bootstrapCameraKitWithSession(
      bootstrapConfig,
      extendContainerWithMetrics(extendContainer),
      { renderWhileTabHidden },
      abortController.signal,
      log,
    )
      .then(({ kit, session, destroy }) => {
        // Store kit reference for cleanup
        kitRef.current = { kit, destroy };
        setCameraKitState({ kit, session, status: "ready" });
        log.info("bootstrap_success");
        emit?.({ kind: "bootstrap-success" });
        metricsReporter.reportCount("bootstrap_success");
      })
      .catch((error) => {
        // Ignore errors from aborted operations
        if (error.name === "AbortError") return;

        log.error("bootstrap_failure", error);
        setCameraKitState({ kit: undefined, session: undefined, status: "error", error });
        emit?.({ kind: "bootstrap-failure", error });
        metricsReporter.reportCount("bootstrap_failure");
      });

    return () => {
      abortController.abort();
      kitRef.current?.destroy();
      kitRef.current = undefined;
    };
    // Re-bootstrap when key changes or when manual counter bumps on reinit
  }, [bootstrapKey, bootstrapCounter]);

  /* --------------------------- Lens cache cleanup ------------------------ */
  // When Camera Kit errors, remove all Lenses from the local cache.
  // Otherwise, if any component tries to apply a Lens that broke Camera Kit before,
  // Lens manager will fail with cannot find Lens error.
  useEffect(() => {
    if (cameraKitState.session) {
      cameraKitState.session.events.addEventListener("error", (event) => {
        if (event.detail.error.name === "LensExecutionError") {
          lensCache.current.clear();
          setLenses([]);
        }
      });
    }
  }, [cameraKitState.session]);

  /* ---------------------------- Lens manager methods --------------------- */
  const fetchLens = useCallback(
    async (lensId: string, groupId: string) => {
      try {
        if (!cameraKitState.kit) throw new Error("CameraKit not initialized.");
        const key = `${groupId}:${lensId}`;
        if (lensCache.current.has(key)) return lensCache.current.get(key)!;
        const lens = await cameraKitState.kit.lensRepository.loadLens(lensId, groupId);
        lensCache.current.set(key, lens);
        setLenses((prev) => [...prev, lens]);
        return lens;
      } catch (error) {
        log.error("lens_load_failed", { lensId, groupId }, error);
        throw error;
      }
    },
    [cameraKitState.kit, log],
  );

  const fetchLenses = useCallback(
    async (groupId: string | string[]) => {
      try {
        if (!cameraKitState.kit) throw new Error("CameraKit not initialized.");

        const { lenses: loaded } = await cameraKitState.kit.lensRepository.loadLensGroups([groupId].flat());
        loaded.forEach((l) => {
          const key = `${l.groupId}:${l.id}`;
          if (!lensCache.current.has(key)) lensCache.current.set(key, l);
        });
        setLenses(Array.from(lensCache.current.values()));
        return loaded;
      } catch (error) {
        log.error("lens_group_load_failed", { groupId }, error);
        throw error;
      }
    },
    [cameraKitState.kit, log],
  );

  const applyLens = useCallback(
    async (lensId: string, lensGroupId: string, launchData?: LensLaunchData, lensReadyGuard?: () => Promise<void>) => {
      const commonFields = {
        lensId,
        lensGroupId,
        lensLaunchData: launchData,
        lensReadyGuard,
      };
      let lens: Lens | undefined;

      try {
        if (!cameraKitState.session) throw new Error("No active session.");

        setLens({
          ...commonFields,
          status: "loading",
          error: undefined,
          lens: undefined,
        });
        lens = await fetchLens(lensId, lensGroupId);

        // Caller might do an animation and wait for some rendering event.
        // If they return a Promise, we await it.
        const readyPromise = lensReadyGuard?.() ?? Promise.resolve();
        const applyPromise = cameraKitState.session.applyLens(lens, launchData);
        await Promise.race([
          Promise.all([applyPromise, readyPromise]),
          new Promise<void>((resolve) => setTimeout(resolve, readyTimeoutMs)),
        ]);
        setLens({
          ...commonFields,
          status: "ready",
          error: undefined,
          lens,
        });
        metricsReporter.reportCount("lens_apply_success");
        return await applyPromise;
      } catch (cause) {
        const error = ensureError(cause);
        log.error("lens_apply_failed", { lensId, lensGroupId }, error);
        setLens({ ...commonFields, status: "error", error, lens });
        metricsReporter.reportCount("lens_apply_failure");
        throw error;
      }
    },
    [fetchLens, cameraKitState.session, log],
  );

  const removeLens = useCallback(async () => {
    try {
      if (!cameraKitState.session) throw new Error("No active session.");

      const removed = await cameraKitState.session.removeLens();
      if (removed) setLens(NO_CURRENT_LENS);
      return removed;
    } catch (error) {
      log.error("lens_remove_failed", error);
      throw error;
    }
  }, [cameraKitState.session, log]);

  const refreshLens = useCallback(async () => {
    const { lensId, lensGroupId, lensLaunchData, lensReadyGuard } = lens;

    if (!lensId || !lensGroupId) return;

    await removeLens();
    await applyLens(lensId, lensGroupId, lensLaunchData, lensReadyGuard);
  }, [lens, removeLens, applyLens]);

  /* ---------------------------- source manager methods ------------------- */
  const sourceCleanupRef = useRef<{
    mediaStream?: MediaStream;
    cameraKitSource?: CameraKitSource;
  }>({});

  const applySource = useCallback(
    async (input: SourceInput, size?: OutputSize) => {
      try {
        if (!cameraKitState.session) throw new Error("No active session.");

        // Clean up previous source
        sourceCleanupRef.current.mediaStream?.getTracks().forEach((track) => track.stop());
        await sourceCleanupRef.current.cameraKitSource?.detach(() => {});
        sourceCleanupRef.current = {};

        setSource({
          input,
          status: "loading",
          error: undefined,
          initializedInput: undefined,
        });

        const { cameraKitSource, transform, inputSize, mediaStream, initializedSourceInput } =
          await createCameraKitSource(input);

        // Store refs for cleanup
        sourceCleanupRef.current = { cameraKitSource, mediaStream };

        // Pause session, set source, apply transforms and render size, then resume
        await withSessionPaused(cameraKitState.session, async () => {
          await cameraKitState.session!.setSource(cameraKitSource);
          await cameraKitSource.setTransform(transform);
          if (size?.mode === "fixed") {
            await cameraKitSource.setRenderSize(size.width, size.height);
          } else if (size?.mode === "match-input" && inputSize) {
            await cameraKitSource.setRenderSize(inputSize[0], inputSize[1]);
          }
        });

        setSource({
          input,
          initializedInput: initializedSourceInput,
          status: "ready",
          error: undefined,
        });
      } catch (cause) {
        const error = ensureError(cause);
        log.error("source_apply_failed", { kind: input.kind }, error);
        setSource({
          input,
          status: "error",
          error,
          initializedInput: undefined,
        });
        throw error;
      }
    },
    [cameraKitState.session, log],
  );

  const removeSource = useCallback(async () => {
    try {
      // Clean up media stream and detach source
      sourceCleanupRef.current.mediaStream?.getTracks().forEach((track) => track.stop());
      await sourceCleanupRef.current.cameraKitSource?.detach(() => {});
      sourceCleanupRef.current = {};

      setSource({
        status: "none",
        error: undefined,
        input: undefined,
        initializedInput: undefined,
      });
    } catch (error) {
      log.error("source_remove_failed", error);
      throw error;
    }
  }, [log]);

  /* ---------------------------- playback control methods ----------------- */
  const setFPSLimit = useCallback(
    async (fps: number) => {
      try {
        if (!cameraKitState.session) throw new Error("No active session.");
        await cameraKitState.session.setFPSLimit(fps);
        setFpsLimitState(fps);
      } catch (error) {
        log.error("fps_limit_set_failed", { fps }, error);
        throw error;
      }
    },
    [cameraKitState.session, log],
  );

  const setMuted = useCallback(
    (muted: boolean) => {
      if (!cameraKitState.session) throw new Error("No active session.");
      if (muted) {
        cameraKitState.session.mute();
      } else {
        cameraKitState.session.unmute();
      }
      setIsMuted(muted);
    },
    [cameraKitState.session],
  );

  const toggleMuted = useCallback(() => {
    setMuted(!isMuted);
  }, [isMuted, setMuted]);

  const setScreenRegions = useCallback(
    async (regions: ScreenRegions) => {
      try {
        if (!cameraKitState.session) throw new Error("No active session.");
        await cameraKitState.session.setScreenRegions(regions);
        setScreenRegionsState(regions);
      } catch (error) {
        log.error("screen_regions_set_failed", error);
        throw error;
      }
    },
    [cameraKitState.session, log],
  );

  const abortCameraKit = useCallback(
    (error: unknown) => {
      cameraKitState.kit?.destroy().catch((cause) => {
        log.error("kit_destroy_failed", cause);
      });
      setCameraKitState({ kit: undefined, status: "error", error: ensureError(error) });
    },
    [cameraKitState.kit, log],
  );

  useEffect(() => {
    if (!cameraKitState.session) return;

    function handleSessionError(event: CameraKitSessionEvents) {
      if (event.detail.error.name === "LensExecutionError") {
        // Update lens state to error, but don't abort the entire SDK.
        // This allows the user to apply a new lens and recover from the error.
        setLens((currentLens) => ({
          ...currentLens,
          status: "error",
          error: event.detail.error,
        }));
      } else if (event.detail.error.name === "LensAbortError") {
        // LensAbortError is a critical error that requires SDK re-initialization.
        // Abort the SDK so the user must call reinitialize() to recover.
        metricsReporter.reportCount("session_lens_abort_error");
        abortCameraKit(event.detail.error);
      }
    }

    cameraKitState.session.events.addEventListener("error", handleSessionError);

    return () => cameraKitState.session!.events.removeEventListener("error", handleSessionError);
  }, [cameraKitState.session, abortCameraKit]);

  /* ---------------------------- memoised context ------------------------- */
  const ctxValue: InternalCameraKitContextValue = useMemo(
    () => ({
      cameraKit: cameraKitState.kit,
      currentSession: cameraKitState.session,
      sdkStatus: cameraKitState.status,
      sdkError: cameraKitState.error,

      // Canvas elements
      liveCanvas: cameraKitState.session?.output.live,
      captureCanvas: cameraKitState.session?.output.capture,

      source,
      lens,

      // Playback state
      isMuted,
      fpsLimit,
      screenRegions,

      keyboard: cameraKitState.session?.keyboard,

      getLogger,

      abortCameraKit,

      reinitialize: () => {
        if (cameraKitState.status === "error" && !cameraKitState.kit) {
          setBootstrapCounter((prev) => prev + 1);
        } else {
          throw new Error("Cannot re-initialize CameraKit when it is not in an aborted state.");
        }
      },

      // Lens manager methods
      fetchLens,
      fetchLenses,
      applyLens,
      removeLens,
      refreshLens,
      lenses,

      // Source manager methods
      applySource,
      removeSource,

      // Playback control methods
      setFPSLimit,
      setMuted,
      toggleMuted,
      setScreenRegions,
    }),
    [
      cameraKitState,
      source,
      lens,
      isMuted,
      fpsLimit,
      screenRegions,
      getLogger,
      fetchLens,
      fetchLenses,
      applyLens,
      removeLens,
      refreshLens,
      lenses,
      applySource,
      removeSource,
      setFPSLimit,
      setMuted,
      toggleMuted,
      setScreenRegions,
      abortCameraKit,
    ],
  );

  return <CameraKitContext.Provider value={ctxValue}>{children}</CameraKitContext.Provider>;
};

/**
 * Internal hook with access to Camera Kit internals.
 * Only for use within react-camera-kit library components and hooks.
 *
 * @internal
 */
export const useInternalCameraKit = (): InternalCameraKitContextValue => {
  const context = useContext(CameraKitContext);
  if (!context) {
    throw new Error("useInternalCameraKit must be used within a CameraKitProvider");
  }
  return context;
};

/**
 * Hook to access Camera Kit context and methods.
 *
 * Provides access to SDK state, Lens management, source control, and playback options.
 * Must be used within a CameraKitProvider.
 *
 * @returns Camera Kit context value with state and methods
 * @throws Error if used outside of CameraKitProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     sdkStatus,
 *     lens,
 *     applyLens,
 *     removeLens,
 *     liveCanvas
 *   } = useCameraKit();
 *
 *   useEffect(() => {
 *     if (sdkStatus === 'ready') {
 *       applyLens('lens-id', 'group-id');
 *     }
 *   }, [sdkStatus, applyLens]);
 *
 *   return <div>{lens.status}</div>;
 * }
 * ```
 */
export const useCameraKit = (): CameraKitContextValue => {
  const context = useContext(CameraKitContext);
  if (!context) {
    throw new Error("useCameraKit must be used within a CameraKitProvider");
  }
  // Return only the public API (exclude internal fields)
  const { cameraKit: _cameraKit, currentSession: _currentSession, getLogger: _getLogger, ...publicContext } = context;
  return publicContext;
};
