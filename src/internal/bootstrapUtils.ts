import {
  bootstrapCameraKit,
  CameraKit,
  CameraKitBootstrapConfiguration,
  CameraKitSession,
  CreateSessionOptions,
  PublicContainer,
} from "@snap/camera-kit";
import { CameraKitLogger } from "./logging";

export interface BootstrapResult {
  kit: CameraKit;
  session: CameraKitSession;
  destroy: () => Promise<void>;
}

/**
 * Bootstraps CameraKit and creates a session with proper cancellation support.
 * Cleans up resources if the operation is aborted via the AbortSignal.
 */
export async function bootstrapCameraKitWithSession(
  config: CameraKitBootstrapConfiguration,
  extendContainer: ((container: PublicContainer) => PublicContainer) | undefined,
  sessionOptions: CreateSessionOptions,
  signal: AbortSignal,
  log: CameraKitLogger,
): Promise<BootstrapResult> {
  // Bootstrap the CameraKit SDK
  const kit = await bootstrapCameraKit(config, extendContainer);

  function destroy() {
    return kit.destroy().catch((error) => log.error("kit_destroy_failed", error));
  }

  // Check if aborted after bootstrap
  if (signal.aborted) {
    destroy();
    signal.throwIfAborted();
  }

  // Create session
  const session = await kit.createSession(sessionOptions);

  // Check if aborted after session creation
  if (signal.aborted) {
    destroy();
    signal.throwIfAborted();
  }

  return { kit, session, destroy };
}
