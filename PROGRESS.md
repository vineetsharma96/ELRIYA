# ELYRIA progress

## 2026-10-01 — Initial analysis and foundation plan

Completed inspection of the six existing briefs. No implementation, assets, package manifest, tests or Git repository existed initially. `WORLD.md` is empty. No existing Elyria/NexusCity code was available to preserve or replace.

Created the initial gap analysis, architecture, provisional art direction, Blender pipeline, asset budgets, world plan, performance contract and milestone gates. Existing brief files remain unchanged, including the authoritative rendering requirements in `RENDERING.md`; implementation-level lighting caveats are captured in `PERFORMANCE.md`.

### Initial gates (before implementation)

| Gate | Status | Evidence/constraint |
| --- | --- | --- |
| Concept inspection | Blocked | Named reference PNG absent from repository |
| Architecture and budgets | Prepared | New living documents; budgets are targets, not results |
| Blender MCP connection | Pending check | Must confirm live tools/server response |
| M0 runtime | In progress | Implementation/validation results not yet recorded |
| M0 asset round trip | Not verified | No exported asset evidence recorded yet |
| M1 visual candidate | Planned | Small plaza only; reference sign-off pending |
| Browser/runtime tests | Not yet recorded | Do not infer from written code |
| Performance measurements | Not yet recorded | No FPS or hardware claims established |

Append concrete implementation, build, browser and profiling evidence below as work completes. Record limitations separately from passing checks. M0 cannot be fully accepted without the required asset round trip; M1 cannot be visually accepted without inspecting the missing reference.

## Implemented foundation and plaza candidate

Built the React/TypeScript/Vite application with a deterministic world, collision-aware movement and jump, follow/vista cameras, companion, citizen and shuttle loops, shared world/map data, touch controls, accessible dialogs, procedural ambient sound, dynamic day/night lighting, wind and instanced petals. Quality presets affect actual renderer settings and density. Diagnostics reports measured frame intervals and renderer counters; lighting is hemisphere ambient plus direct sun, with ray tracing unavailable.

Connected to Blender 5.2.2 through the installed standard-stdio Blender MCP server and its live add-on. Created 13 original asset sources and 18 GLB exports including five simplified LODs. Editable `.blend` libraries, deterministic builders and MCP reports are retained. GLB validation passes for all 18 exports (3.83 MiB total), including UVs, normals, mesh/scene structure and triangle guardrails. Lite/Low batches primitive colors and emissive data into shared vertex-colored Lambert meshes; paving and repeated props are instanced.

Validation: 16 simulation/quality tests pass; TypeScript and the production Vite build pass. The production Chromium browser suite passed at 11:56 UTC with zero unexpected console/page/resource errors. It verified movement, jump/landing, landmark interaction, map pausing, quality persistence, follow/vista switching, High assets/shadows, pointer-driven day/night changes, actual touch joystick movement, 390×844 layout and recoverable missing-asset errors. Current evidence and screenshots are in `artifacts/browser-check.json` and `artifacts/`. The test returns focus to the world before Space because focused UI buttons retain native keyboard activation. Screenshots were visually inspected for desktop Lite/High, night, mobile and asset failure.

M0 implementation and the real Blender asset round trip are present. M1 remains a candidate. The named reference image is absent, real-device performance is unverified, and triangle/material targets need further optimization. Do not expand to a full city or claim M1 acceptance from this preview. Skeletal animation, interiors, traffic rules, advanced GI, weather, streaming and Gemini remain later milestones.
