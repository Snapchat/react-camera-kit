import { CameraKitProvider, LensPlayer } from "@snap/react-camera-kit";

interface SimpleDemoProps {
  apiToken: string;
  lensId: string;
  lensGroupId: string;
}

export function SimpleDemo({ apiToken, lensId, lensGroupId }: SimpleDemoProps) {
  return (
    <CameraKitProvider apiToken={apiToken}>
      <section className="simple-view">
        <section className="stage" aria-label="Live preview stage">
          <LensPlayer lensId={lensId} lensGroupId={lensGroupId} className="canvas" />
        </section>
      </section>
    </CameraKitProvider>
  );
}
