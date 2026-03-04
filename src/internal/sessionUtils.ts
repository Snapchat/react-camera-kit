import { CameraKitSession } from "@snap/camera-kit";

export async function withSessionPaused<T>(session: CameraKitSession, cb: () => Promise<T>) {
  const { capture, live } = session.playing;

  // Pause everything in parallel
  await Promise.all([capture && session.pause("capture"), live && session.pause("live")]);

  try {
    // Run the user callback while paused
    return await cb();
  } finally {
    // Always resume, even if cb() throws
    await Promise.all([capture && session.play("capture"), live && session.play("live")]);
  }
}
