import { useEffect, useMemo, useState } from "react";
import { CameraKitProvider, LensPlayer, useCameraKit } from "@snap/react-camera-kit";
import { getPlatformInfo } from "@snap/camera-kit/utils";

interface AdvancedDemoProps {
  apiToken: string;
  lensGroupId: string;
}

function StatusBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="status-row">
      <span className="status-label">{label}</span>
      <span className={`status-badge status-${value}`}>{value}</span>
    </div>
  );
}

function AdvancedDemoContent({ lensGroupId }: { lensGroupId: string }) {
  const {
    sdkStatus,
    sdkError,
    source,
    lenses,
    fetchLenses,
    lens,
    isMuted,
    toggleMuted,
    applyLens,
    removeLens,
    refreshLens,
    reinitialize,
  } = useCameraKit();
  const [actionError, setActionError] = useState<string>();
  const [isLoadingLenses, setIsLoadingLenses] = useState(false);
  const [lensesLoadError, setLensesLoadError] = useState<string>();

  const diagnostics = useMemo(() => {
    const secureContext = typeof window !== "undefined" ? window.isSecureContext : false;
    const hasMediaDevices = typeof navigator !== "undefined" && !!navigator.mediaDevices;

    return {
      secureContext,
      hasMediaDevices,
      cameraKitVersion: getPlatformInfo().sdkLongVersion,
    };
  }, []);

  const canControlLens = sdkStatus === "ready";
  const hasAppliedLens = lens.status !== "none" && !!lens.lensId;
  const canRemoveLens = canControlLens && hasAppliedLens;
  const canRefreshLens = canControlLens && hasAppliedLens;
  const canMuteUnmuteLens = canControlLens && hasAppliedLens;

  const visibleError = sdkError?.message || source.error?.message || lens.error?.message;

  useEffect(() => {
    (async function loadLensGroup() {
      if (sdkStatus !== "ready") return;

      setIsLoadingLenses(true);
      setLensesLoadError(undefined);
      try {
        await fetchLenses(lensGroupId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load lenses";
        setLensesLoadError(message);
      } finally {
        setIsLoadingLenses(false);
      }
    })();
  }, [sdkStatus, lensGroupId]);

  const orderedLenses = useMemo(() => {
    return lenses.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [lenses, lensGroupId]);

  useEffect(() => {
    if (orderedLenses.length > 0) {
      applyLens(orderedLenses[0].id, lensGroupId);
    }
  }, [orderedLenses, lensGroupId, applyLens]);

  async function runAction(action: () => Promise<unknown>) {
    setActionError(undefined);
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown action failure";
      setActionError(message);
    }
  }

  return (
    <section className="workspace">
      <aside className="panel">
        <section className="card">
          <h2>Controls</h2>
          <label className="field-label" htmlFor="lens-select">
            Lens to Apply
          </label>
          <div className="select-row">
            <select
              id="lens-select"
              value={lens.lensId ?? ""}
              disabled={isLoadingLenses || orderedLenses.length === 0}
              onChange={(event) => {
                const newLensId = event.target.value;
                if (newLensId) {
                  void runAction(() => applyLens(newLensId, lensGroupId));
                } else {
                  void runAction(removeLens);
                }
              }}
            >
              <option value="">No lens</option>
              {orderedLenses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name || item.id}
                </option>
              ))}
            </select>
          </div>

          <div className="button-grid">
            <button disabled={!canRemoveLens} onClick={() => void runAction(removeLens)}>
              Remove Lens
            </button>
            <button disabled={!canRefreshLens} onClick={() => void runAction(refreshLens)}>
              Refresh Lens
            </button>
            <button disabled={!canMuteUnmuteLens} onClick={toggleMuted}>
              {isMuted ? "Unmute" : "Mute"}
            </button>
            {sdkStatus === "error" && <button onClick={reinitialize}>Reinitialize SDK</button>}
          </div>
          {lensesLoadError && <p className="warning">{lensesLoadError}</p>}
          {actionError && <p className="warning">{actionError}</p>}
        </section>

        <section className="card">
          <h2>Status</h2>
          <StatusBadge label="SDK" value={sdkStatus} />
          <StatusBadge label="Source" value={source.status} />
          <StatusBadge label="Lens" value={lens.status} />
        </section>

        <section className="card">
          <h2>Diagnostics</h2>
          <StatusBadge label="Camera Kit Version" value={diagnostics.cameraKitVersion} />
          <StatusBadge label="Secure context" value={diagnostics.secureContext ? "yes" : "no"} />
          <StatusBadge label="mediaDevices" value={diagnostics.hasMediaDevices ? "available" : "missing"} />
          {!diagnostics.secureContext && <p className="warning">Camera APIs require HTTPS on iOS/mobile browsers.</p>}
        </section>
      </aside>

      <section className="stage" aria-label="Live preview stage">
        <LensPlayer lensId={lens.lensId} lensGroupId={lensGroupId} className="canvas" />

        {visibleError && (
          <div className="overlay overlay-error">
            <strong>Preview Error</strong>
            <p>{visibleError}</p>
          </div>
        )}
      </section>
    </section>
  );
}

export function AdvancedDemo({ apiToken, lensGroupId }: AdvancedDemoProps) {
  return (
    <CameraKitProvider apiToken={apiToken}>
      <AdvancedDemoContent lensGroupId={lensGroupId} />
    </CameraKitProvider>
  );
}
