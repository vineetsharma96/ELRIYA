# ELYRIA performance contract

Budgets below are engineering targets. They are not measurements or a claim of 60 FPS. Hardware/browser-specific results must be recorded with scene, viewport, quality, warm-up and sample length in `PROGRESS.md` or a dated profiling report.

## Frame budgets

| Profile | Sustained target | Total frame interval | CPU application work budget | GPU work budget |
| --- | ---: | ---: | ---: | ---: |
| Desktop High, 1920 x 1080 | 60 FPS | 16.7 ms | <= 6 ms | <= 12 ms |
| Mobile Low, actual device viewport | 30 FPS | 33.3 ms | <= 10 ms | <= 25 ms |

CPU and GPU overlap; these numbers must not be added to infer a frame rate. RAF interval includes scheduling and display effects and is not a GPU timing measurement. GPU time needs a supported timer query and a disjoint check. If unavailable, report it as unavailable.

Use p50 and p95 frame interval, long-frame count and sustained averages rather than one instant FPS sample. Exclude hidden-tab time, warm-up and loading transitions. Target p95 <= 20 ms desktop and <= 40 ms mobile after warm-up, with no repeated >100 ms interaction stalls.

## Proposed quality ceilings

| Tier | Effective DPR cap | Shadow map | Visible triangles | Draw calls | Petals | Visual citizens | Visible vehicles | Draw distance |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Ultra | 1.75 | 2048 | 650,000 | 140 | 1,500 | 16 | 6 | 200 m |
| High | 1.5 | 1024 | 400,000 | 100 | 900 | 10 | 4 | 150 m |
| Medium | 1.25 | 1024 | 250,000 | 75 | 500 | 6 | 2 | 110 m |
| Low | 1.0 | 512 or disabled | 150,000 | 50 | 250 | 4 | 1 | 80 m |
| Lite | 0.75 | disabled | 80,000 | 35 | 100 | 2 | 0 | 65 m |

These are upper design envelopes, not density guarantees. The M1 plaza should stay well below the upper tiers. Preserve a playable core as optional effects/densities shrink. An implemented preset must document its actual controls; do not suggest it changes a deferred feature.

AUTO should use actual runtime frame samples, warm up first, and apply hysteresis so it cannot oscillate between tiers. Reduce render scale before removing essential cues; consider shadow and particle cost next. An explicit user preset should remain stable. CUSTOM can be exposed only when custom settings exist.

## Lighting and effects truthfulness

M0 can use dynamic direct sun, a sky/hemisphere ambient approximation, emissive materials and optional shadows. This is an ambient approximation, not measured bounced GI. Do not label it hardware RT, probe GI or screen-space GI unless that technique actually runs.

Later High/Ultra can add local irradiance/reflection probes, contact AO and restrained bloom after profiling. Lower tiers use cheaper environment/direct lighting and simple water. Day/night must update the active lighting technique. WebGL/WebGPU support alone never enables a true hardware-ray-tracing indicator. RT is unavailable unless an actual API and effect path are proven.

## Measurement protocol

1. Build and run the production application, not only the development compiler.
2. Capture browser/backend, GPU when available, viewport/DPR, quality and active content counts.
3. Warm the plaza for 10 seconds. Sample at least 30 seconds while moving and rotating through dense views.
4. Record frame interval distribution, actual renderer draw/triangle counters and loading/build bytes. Check day/night and the highest implemented particle setting.
5. Repeat on a real mobile device before claiming mobile performance; desktop viewport emulation verifies layout/input only.
6. Inspect console errors and resource cleanup during reload or content changes. Fix expensive regressions before scaling assets.

Use instancing for repeated props/vegetation/petals, shared geometry/materials, bounded update ranges and no per-frame React churn. Renderer counters are submitted work and may include multiple passes; document sampling method. Assets and textures are budgeted in `ASSET_MANIFEST.md`.

## 2026-10-01 production baseline

`artifacts/profile-LITE.json` records a 30.40-second stationary vista sample after ten seconds of warm-up, Chromium headless, 1440×960, Lite DPR 0.75, ANGLE/Vulkan SwiftShader software renderer. It measured 68 frames, 2.24 FPS mean, 450 ms p50, 466.7 ms p95 and 67 frames over 100 ms. GPU timer data is unavailable. These are actual visible frame intervals, including slow frames; they establish a failing software-renderer baseline rather than real-hardware performance.

The vista submitted 28 draw calls and 110,533 triangles. Draw calls are below Lite's proposed 35-call ceiling, while triangles exceed its 80,000 target. Lite still renders one ambient shuttle (the target table proposes zero), so the preset has a documented budget deviation. The latest batching preserves authored geometry/colors and lowers draw overhead, but triangle cost and measured performance remain open gates. Before expansion, reduce geometry/distant content and profile movement/dense viewpoints on an actual desktop GPU and mobile device. This stationary emulated run does not satisfy that protocol.

High vista smoke testing submitted approximately 624,000 triangles and 154 draw calls, including shadows. Both exceed the proposed High ceilings (400,000 / 100). This verifies rendering and quality switching, not budget acceptance. The captured viewport used device DPR 1.0 despite the preset cap of 1.5.
