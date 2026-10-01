# ELYRIA

A browser-based, pastel 3D city prototype built from the project briefs in `Prompt.md` and `ASTRA.md`.

The current scope is M0 plus the M1 Blossom Central plaza candidate. It contains original Blender assets, a controllable protagonist and companion, citizens, one ambient shuttle, water, blossoms, petals, day/night lighting, a world-derived map, touch controls, quality presets, and measured diagnostics.

## Run

Requires Node.js 22.12+ or 24 and a browser supporting WebGL 2.

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. For the production build:

```sh
npm run build
npm run preview -- --port 4173
```

The optional `?quality=LITE` URL parameter starts the inexpensive renderer directly. The normal default is AUTO, which responds to measured frame intervals. Use the pause menu to select another tier.

## Controls

| Control | Action |
| --- | --- |
| WASD / arrows | Move relative to the camera |
| Shift | Sprint |
| Space | Jump |
| Drag / wheel | Orbit camera / change distance |
| E | Read the nearby landmark description |
| C | Switch follow/vista camera |
| M | Open map and pause movement |
| Escape | Pause/resume |
| F3 | Diagnostics, time/wind controls and return to spawn |

Touch devices have a movement joystick, sprint/jump buttons, camera drag and map/menu controls. Ambient sound starts only after enabling it.

## Validate

```sh
npm test
npm run build
npm run assets:validate
```

With the app running, `npm run test:browser` checks desktop movement, jump/landing, discovery, map pausing, quality, camera, night lighting, actual touch input, layout and asset-error handling. It saves screenshots and a measured headless baseline in `artifacts/`. Install Chromium with `npx playwright install chromium` if it is absent.

To test the production server in PowerShell:

```powershell
$env:ELYRIA_URL = 'http://127.0.0.1:4173'
npm run test:browser
```

Headless software rendering and mobile emulation do not establish real desktop/mobile performance. See `PERFORMANCE.md` and the measured reports before claiming a frame-rate target.

## Blender assets

The kit was created through a real Blender MCP connection, not downloaded. Sources are in `assets/source/*.blend`, deployable exports in `public/assets/`, deterministic builders in `scripts/blender/`, and export checks in `scripts/assets/inspection.json`.

With Blender and its MCP add-on running, the CLI can use the configured MCP runner:

```sh
npm run assets:inspect
npm run assets:build
node scripts/blender/mcp-client.mjs execute scripts/blender/build-lods.py
```

The default runner is `uvx mcp-for-blender`. Set `BLENDER_MCP_COMMAND` and JSON `BLENDER_MCP_ARGS` to match another installed runner. Executing builders creates independent asset scenes, writes GLBs and saves editable source libraries. Other scenes are preserved. Never build the full city as one Blender scene.

## Milestone gates

The named reference image `a_bright_whimsical_ultra_detailed_3d_cel_shaded.png` is missing. This prevents reference comparison and M1 visual sign-off. Real-device performance and lower-tier budgets also need review before city expansion.

Characters currently use rigid preview meshes with whole-body motion. Skeletal animation/blending, enterable interiors, traffic rules, advanced GI/reflections, weather, world streaming and Gemini remain later milestones. The diagnostics identifies the implemented ambient/direct-light approximation accurately; hardware ray tracing is unavailable in this renderer.

See `PROGRESS.md`, `IMPLEMENTATION_PLAN.md`, `ARCHITECTURE.md`, and `ASSET_MANIFEST.md` for evidence and remaining work.
