# @snap/react-camera-kit

The official React wrapper for the [Camera Kit Web SDK](https://developers.snap.com/camera-kit/integrate-sdk/web/web-configuration). It provides declarative components and hooks that handle SDK bootstrapping, session lifecycle, media sources, and Lens management — so you can integrate Snap AR into React apps with minimal boilerplate.

**[Live Demo](https://snapchat.github.io/react-camera-kit/)** · **[Camera Kit Docs](https://developers.snap.com/camera-kit/integrate-sdk/web/guides/react-camera-kit)**

## Installation

```bash
npm install @snap/react-camera-kit @snap/camera-kit
```

### Requirements

- `@snap/camera-kit` `^1.13.0` (peer dependency)
- `react` `>=16.8.0` and `react-dom` `>=16.8.0`
- `rxjs` `>=7`
- `https://` for deployed apps (`http://localhost` works for local development)

You'll need a Camera Kit API token, Lens ID, and Lens Group ID from the [Snap Developer Portal](https://kit.snapchat.com/manage). See [Setting Up Accounts](https://developers.snap.com/camera-kit/getting-started/setting-up-accounts) if you're new to Camera Kit.

## Quick start

```tsx
import { CameraKitProvider, LensPlayer } from "@snap/react-camera-kit";

function App() {
  return (
    <CameraKitProvider apiToken="YOUR_API_TOKEN">
      <LensPlayer lensId="YOUR_LENS_ID" lensGroupId="YOUR_LENS_GROUP_ID" />
    </CameraKitProvider>
  );
}
```

That's it — `CameraKitProvider` initializes the SDK, and `LensPlayer` sets up the camera, applies the Lens, and renders the output canvas.

## Components

### CameraKitProvider

The root provider that initializes the Camera Kit SDK. All other components and hooks must be descendants of this provider.

```tsx
import { CameraKitProvider, createConsoleLogger } from "@snap/react-camera-kit";

<CameraKitProvider apiToken="YOUR_API_TOKEN" logger={createConsoleLogger()} logLevel="info">
  {children}
</CameraKitProvider>;
```

| Prop                          | Type                                     | Default      | Description                                                   |
| ----------------------------- | ---------------------------------------- | ------------ | ------------------------------------------------------------- |
| `apiToken`                    | `string`                                 | **required** | Camera Kit API token                                          |
| `logger`                      | `CameraKitLogger`                        | `noopLogger` | Logger instance — use `createConsoleLogger()` for development |
| `logLevel`                    | `"debug" \| "info" \| "warn" \| "error"` | `"info"`     | Log verbosity                                                 |
| `renderWhileTabHidden`        | `boolean`                                | `false`      | Continue rendering when the browser tab is hidden             |
| `stabilityKey`                | `string \| number`                       | auto         | Manual control over when the SDK re-initializes               |
| `extendContainer`             | `(container) => container`               | —            | Customize the SDK's DI container                              |
| `createBootstrapEventHandler` | `MetricEventHandlerFactory`              | —            | Factory for tracking bootstrap success/failure                |

### LensPlayer

All-in-one component that handles source setup, Lens application, and playback. Defaults to the user's camera if no `source` is provided.

```tsx
<LensPlayer lensId="YOUR_LENS_ID" lensGroupId="YOUR_LENS_GROUP_ID" className="camera-canvas" />
```

| Prop             | Type                    | Default              | Description                                                                                      |
| ---------------- | ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| `lensId`         | `string`                | —                    | Lens to apply                                                                                    |
| `lensGroupId`    | `string`                | —                    | Lens Group containing the Lens                                                                   |
| `source`         | `SourceInput`           | `{ kind: "camera" }` | Media source (camera, video, or image)                                                           |
| `outputSize`     | `OutputSize`            | —                    | Rendering canvas size                                                                            |
| `lensLaunchData` | `LensLaunchData`        | —                    | Launch parameters passed to the Lens                                                             |
| `lensReadyGuard` | `() => Promise<void>`   | —                    | Async guard called while Lens is loading (2s timeout)                                            |
| `refreshTrigger` | `unknown`               | —                    | When this value changes, the Lens is removed and reapplied                                       |
| `canvasType`     | `"live" \| "capture"`   | `"live"`             | Which canvas to render. For custom layouts, use `LiveCanvas`/`CaptureCanvas` as children instead |
| `fpsLimit`       | `number`                | —                    | Maximum rendering framerate                                                                      |
| `muted`          | `boolean`               | `false`              | Mute audio output                                                                                |
| `screenRegions`  | `ScreenRegions`         | —                    | Screen regions for Lens-aware UI layout                                                          |
| `onError`        | `(error, lens) => void` | —                    | Callback for playback errors                                                                     |
| `className`      | `string`                | —                    | CSS class name                                                                                   |
| `style`          | `CSSProperties`         | —                    | Inline styles                                                                                    |
| `children`       | `ReactNode`             | —                    | Custom children (use with `LiveCanvas`/`CaptureCanvas`)                                          |

### LiveCanvas / CaptureCanvas

Render the live preview or capture canvas as children of `LensPlayer`:

```tsx
<LensPlayer lensId="YOUR_LENS_ID" lensGroupId="YOUR_LENS_GROUP_ID">
  <div>
    <LiveCanvas style={{ width: "100%" }} />
  </div>
  <div>
    <CaptureCanvas style={{ width: "100%" }} />
  </div>
</LensPlayer>
```

Both accept `className` and `style` props.

## Hooks

### useCameraKit

Access the full Camera Kit context — SDK status, source/Lens state, and imperative methods. Must be called within a `CameraKitProvider`.

```tsx
import { useCameraKit } from "@snap/react-camera-kit";

function Controls() {
  const { sdkStatus, lens, lenses, isMuted, toggleMuted, applyLens, removeLens, fetchLenses } = useCameraKit();

  if (sdkStatus !== "ready") return <p>Loading SDK...</p>;

  return (
    <div>
      <p>Lens: {lens.lensId ?? "None"}</p>
      <button onClick={toggleMuted}>{isMuted ? "Unmute" : "Mute"}</button>
      <button onClick={removeLens}>Remove Lens</button>
    </div>
  );
}
```

**State properties:**

| Property        | Type                                                      | Description                             |
| --------------- | --------------------------------------------------------- | --------------------------------------- |
| `sdkStatus`     | `"uninitialized" \| "initializing" \| "ready" \| "error"` | SDK initialization status               |
| `sdkError`      | `Error \| undefined`                                      | Error from SDK initialization           |
| `source`        | `CurrentSource`                                           | Current source status, input, and error |
| `lens`          | `CurrentLens`                                             | Current Lens status, IDs, and error     |
| `lenses`        | `Lens[]`                                                  | Array of loaded Lens objects            |
| `liveCanvas`    | `HTMLCanvasElement \| undefined`                          | Live preview canvas element             |
| `captureCanvas` | `HTMLCanvasElement \| undefined`                          | Capture canvas element                  |
| `keyboard`      | `Keyboard \| undefined`                                   | Keyboard API for Lens keyboard requests |
| `isMuted`       | `boolean`                                                 | Whether audio is muted                  |
| `fpsLimit`      | `number \| undefined`                                     | Current FPS limit                       |
| `screenRegions` | `ScreenRegions \| undefined`                              | Current screen regions                  |

**Methods:**

| Method                                                 | Description                                             |
| ------------------------------------------------------ | ------------------------------------------------------- |
| `applySource(input, size?)`                            | Apply a media source (camera, video, or image)          |
| `removeSource()`                                       | Remove the current source                               |
| `fetchLens(lensId, groupId)`                           | Load a single Lens (returns cached if already loaded)   |
| `fetchLenses(groupId)`                                 | Load all Lenses in a group (accepts string or string[]) |
| `applyLens(lensId, groupId, launchData?, readyGuard?)` | Apply a Lens by ID                                      |
| `removeLens()`                                         | Remove the current Lens                                 |
| `refreshLens()`                                        | Remove and reapply the current Lens                     |
| `reinitialize()`                                       | Re-bootstrap the SDK (useful after errors)              |
| `setMuted(muted)`                                      | Set the muted state                                     |
| `toggleMuted()`                                        | Toggle audio mute                                       |
| `setFPSLimit(fps)`                                     | Set maximum rendering FPS                               |
| `setScreenRegions(regions)`                            | Set screen regions for Lens-aware layout                |

### useApplyLens

Declaratively apply a Lens — it updates automatically when parameters change.

```tsx
import { useApplyLens } from "@snap/react-camera-kit";

useApplyLens("YOUR_LENS_ID", "YOUR_LENS_GROUP_ID");
```

| Parameter        | Type                  | Description                          |
| ---------------- | --------------------- | ------------------------------------ |
| `lensId`         | `string \| undefined` | Lens ID — pass `undefined` to remove |
| `lensGroupId`    | `string \| undefined` | Lens Group ID                        |
| `lensLaunchData` | `LensLaunchData`      | Optional launch parameters           |
| `lensReadyGuard` | `() => Promise<void>` | Optional async ready guard           |

### useApplySource

Declaratively apply a media source. Defaults to camera if no source is provided.

```tsx
import { useApplySource } from "@snap/react-camera-kit";

// Video source with fixed output size
useApplySource({ kind: "video", url: "/demo.mp4", autoplay: true }, { mode: "fixed", width: 720, height: 1280 });
```

| Parameter    | Type          | Default              | Description    |
| ------------ | ------------- | -------------------- | -------------- |
| `source`     | `SourceInput` | `{ kind: "camera" }` | Media source   |
| `outputSize` | `OutputSize`  | —                    | Rendering size |

### usePlaybackOptions

Declaratively set playback options.

```tsx
import { usePlaybackOptions } from "@snap/react-camera-kit";

usePlaybackOptions({
  fpsLimit: 30,
  muted: false,
  onError: (error) => console.error("Playback error:", error),
});
```

| Option          | Type                    | Description                    |
| --------------- | ----------------------- | ------------------------------ |
| `fpsLimit`      | `number`                | Maximum rendering FPS          |
| `muted`         | `boolean`               | Mute audio                     |
| `screenRegions` | `ScreenRegions`         | Screen regions for Lens layout |
| `onError`       | `(error, lens) => void` | Playback error callback        |

## Media sources

Pass a `SourceInput` to `LensPlayer`'s `source` prop or to `useApplySource`:

```tsx
// Camera (default)
{ kind: "camera" }
{ kind: "camera", deviceId: "abc123", options: { cameraFacing: "environment" } }

// Video
{ kind: "video", url: "/demo.mp4", autoplay: true }

// Image
{ kind: "image", url: "/photo.jpg" }
```

### Camera source options

| Option              | Type                      | Default                        | Description                   |
| ------------------- | ------------------------- | ------------------------------ | ----------------------------- |
| `cameraFacing`      | `"user" \| "environment"` | `"user"`                       | Front or back camera          |
| `cameraConstraints` | `MediaTrackConstraints`   | `{ width: 1280, height: 720 }` | Camera resolution constraints |
| `cameraRotation`    | `0 \| -90 \| 90 \| 180`   | `0`                            | Camera rotation               |
| `fpsLimit`          | `number`                  | —                              | Max FPS for the source        |
| `outputSize`        | `OutputSize`              | —                              | Rendering canvas size         |

### Output size

```tsx
// Fixed resolution
{ mode: "fixed", width: 720, height: 1280 }

// Match input source resolution
{ mode: "match-input" }
```

## Handling loading and error states

Use `useCameraKit()` to track the status of the SDK, source, and Lens. Each progresses through `"none" → "loading" → "ready"` (or `"error"`):

```tsx
function Preview() {
  const { sdkStatus, sdkError, source, lens } = useCameraKit();

  if (sdkStatus === "error") return <p>SDK failed: {sdkError?.message}</p>;
  if (sdkStatus !== "ready") return <p>Initializing...</p>;
  if (source.status === "loading") return <p>Setting up camera...</p>;
  if (lens.status === "error") return <p>Lens error: {lens.error?.message}</p>;

  return (
    <LensPlayer lensId="YOUR_LENS_ID" lensGroupId="YOUR_LENS_GROUP_ID">
      {lens.status !== "ready" && <div className="spinner" />}
      <LiveCanvas />
    </LensPlayer>
  );
}
```

## Full example: Lens switcher

```tsx
import { CameraKitProvider, LensPlayer, LiveCanvas, useCameraKit } from "@snap/react-camera-kit";
import { useEffect } from "react";

const LENS_GROUP_ID = "YOUR_LENS_GROUP_ID";

function LensSwitcher() {
  const { sdkStatus, lenses, lens, fetchLenses, applyLens, isMuted, toggleMuted, reinitialize, sdkError } =
    useCameraKit();

  useEffect(() => {
    if (sdkStatus === "ready") fetchLenses(LENS_GROUP_ID);
  }, [sdkStatus]);

  if (sdkStatus === "error") {
    return (
      <div>
        <p>SDK error: {sdkError?.message}</p>
        <button onClick={reinitialize}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <select value={lens.lensId ?? ""} onChange={(e) => applyLens(e.target.value, LENS_GROUP_ID)}>
        <option value="" disabled>
          Select a Lens
        </option>
        {lenses.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <button onClick={toggleMuted}>{isMuted ? "Unmute" : "Mute"}</button>

      <LensPlayer lensId={lens.lensId} lensGroupId={LENS_GROUP_ID}>
        <LiveCanvas style={{ width: "100%", maxWidth: 640 }} />
      </LensPlayer>
    </div>
  );
}

export default function App() {
  return (
    <CameraKitProvider apiToken="YOUR_API_TOKEN">
      <LensSwitcher />
    </CameraKitProvider>
  );
}
```

## Utilities

| Export                   | Description                                         |
| ------------------------ | --------------------------------------------------- |
| `createConsoleLogger()`  | Returns a logger that prints to the browser console |
| `createNoopLogger()`     | Returns a silent logger (default)                   |
| `isCameraSource(source)` | Type guard for `CameraSourceInput`                  |
| `isVideoSource(source)`  | Type guard for `VideoSourceInput`                   |
| `isImageSource(source)`  | Type guard for `ImageSourceInput`                   |
| `CameraRotationOptions`  | Valid rotation values: `[0, -90, 90, 180]`          |

## Development

```bash
npm install           # Install dependencies
npm run build         # Build ESM + CJS
npm run watch         # Build in watch mode
npm run typecheck     # Type checking
npm test              # Run tests
npm run clean         # Clean dist folder
```

### Demo app

A Vite demo app is available in `demo/`:

```bash
npm run demo:install
cp demo/.env.example demo/.env
npm run demo:dev
```

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)

## License

[MIT](LICENSE.md)
