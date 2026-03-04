# Web Demo (Vite)

A GitHub Pages-oriented demo that includes:

- `#/` simple live preview (`CameraKitProvider` + `LensPlayer`)
- `#/advanced` status panel, controls, and diagnostics

## Run

```bash
npm run demo:install
cp demo/.env.example demo/.env
npm run demo:dev
```

## Mobile (Local Network)

```bash
npm run demo:dev
```

Then open `http://<your-computer-lan-ip>:5173` from your phone on the same Wi-Fi network.

Note: iOS/mobile camera APIs require HTTPS (`window.isSecureContext === true`).

## Environment

Set the following in `.env`:

- `VITE_CAMERA_KIT_API_TOKEN`
- `VITE_LENS_ID`
- `VITE_LENS_GROUP_ID`

## Demo Routes

- Simple page: `#/`
- Advanced page: `#/advanced`
