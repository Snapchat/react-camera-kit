# @snap/react-camera-kit

React Camera Kit for web applications.

**[Live Demo](https://snapchat.github.io/react-camera-kit/)**

## Installation

```bash
npm install @snap/react-camera-kit @snap/camera-kit
```

## Prerequisites

Before using this package, complete Camera Kit Web setup and obtain:

- `apiToken`
- `lensId`
- `lensGroupId`
- `https://` for deployed apps (`http://localhost` should works for local dev)

Full setup guides:

- Camera Kit Web configuration: https://developers.snap.com/camera-kit/integrate-sdk/web/web-configuration
- `@snap/camera-kit` docs: https://www.npmjs.com/package/@snap/camera-kit

## Compatibility

- Requires `@snap/camera-kit` `^1.13.0`, because `1.13.0+` includes the SDK-side font bootstrap behavior needed by this package.

## Usage

This package provides a simple API for integrating Camera Kit into React applications.

The simplest use case is:

```tsx
<CameraKitProvider apiToken="YOUR_TOKEN">
  <LensPlayer lensId="YOUR_LENS_ID" lensGroupId="YOUR_GROUP_ID" />
</CameraKitProvider>
```

if you need to render specific canvas with custom layout:

```tsx
<CameraKitProvider apiToken="YOUR_TOKEN">
  <LensPlayer lensId="YOUR_LENS_ID" lensGroupId="YOUR_GROUP_ID" canvasType="both">
    <div>
      <LiveCanvas />
    </div>
    <div>
      <CaptureCanvas />
    </div>
  </LensPlayer>
</CameraKitProvider>
```

if you need to access lens status (assuming `CameraKitProvider` context):

```tsx
function Preview() {
  const { lens } = useCameraKit();
  return (
    <LensPlayer lensId="YOUR_LENS_ID" lensGroupId="YOUR_GROUP_ID">
      {lens.status !== "ready" && lens.status !== "error" && <Spinner />}
      {lens.status === "error" && <Error error={lens.error} />}
      {lens.status === "ready" && <LiveCanvas />}
    </LensPlayer>
  );
}
```

When you need full control (assuming `CameraKitProvider` context):

```tsx
function Preview() {
  const { sdkStatus, source, lens } = useCameraKit();
  useApplySource({ kind: "video", url: "/demo.mp4" }, { mode: "fixed", width: 720, height: 1280 });
  useApplyLens("123", "abc", launchData);
  usePlaybackOptions({ onError: (error) => console.error(error) });

  if (sdkStatus !== "ready" || source.status !== "ready" || lens.status !== "ready") {
    return <Spinner />;
  }
  return <CaptureCanvas className="rounded-xl" />;
}
```

## Development

```bash
# Install dependencies
npm install

# Build the package (ESM + CJS)
npm run build

# Build in watch mode (for development)
npm run watch

# Type checking
npm run typecheck

# Run tests
npm test

# Clean dist folder
npm run clean
```

## Demo App

A Vite demo app is available at `demo`.

```bash
npm run demo:install
cp demo/.env.example demo/.env
npm run demo:dev
```

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on how to get started.

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)

## License

[MIT](LICENSE.md)
