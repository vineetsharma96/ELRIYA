# ELYRIA architecture

## Scope and baseline

M0 establishes a browser application and truthful diagnostics. M1 assembles one compact Blossom Central plaza. Large districts and world streaming start only after that scene passes visual and performance review. There was no reusable application at initial inspection.

Use React + TypeScript + Vite for the application and React Three Fiber + Three.js for the scene. WebGL2 is the initial backend. Select this conservative path to validate the asset and gameplay loop before optional renderer research. Capability reporting must reflect the actual renderer; WebGPU availability does not establish ray tracing support.

## Boundaries

- **Application shell:** loading/error states, interaction prompts, settings and accessible input instructions. Only expose controls for implemented behavior.
- **World data:** stable IDs, seed, transforms, district bounds and placement records. Map, navigation and streaming will share these records rather than infer positions from scene meshes.
- **Simulation:** movement, interaction and environmental state update independently of React rendering. Clamp long frame deltas; later physics should use a bounded fixed-step accumulator.
- **Scene:** asset loading, instances, cameras, lights, sky, water, petals and material state consume simulation values. Avoid React state updates on every animation frame.
- **Asset pipeline:** Blender source to optimized modular GLB to runtime loader. Source and export identities, units, pivots and budgets live in the manifest.
- **Quality/diagnostics:** explicit presets plus measured AUTO adaptation. Frame time and renderer counters come from the running scene, with unsupported or unmeasured values marked accordingly.

World units are meters. Runtime uses Y up; Blender sources use Z up and glTF conversion at export. Building footprints, interaction volumes and collision geometry are distinct from decorative meshes. Shared assets load once and use instances when materials and transforms allow.

## Foundation data flow

Input -> player/camera state -> world simulation -> rendered scene.

World clock -> sun/moon state -> sky, direct light, ambient approximation and emissive response.

Measured frame samples -> quality policy -> render scale, shadow and density budgets. Diagnostics observes the same runtime state; it does not maintain invented counts.

## Growth contracts

Chunk identity will be `(seed, districtId, x, z)`. Use deterministic placement independent of visit order. Keep collision, simulation and visual distance thresholds separate. Later near agents receive full updates; far agents use aggregate schedule state. On unload, release references and dispose unshared GPU resources while preserving persistent world state.

AI integration is deferred until navigation and interactions are stable. It may select validated world IDs/actions through a constrained schema; it must never execute arbitrary model output. No client API secrets belong in the browser bundle.

## Failure behavior

Give asset or renderer failures a visible useful message. A placeholder is allowed for development but must be labeled in documentation. Quality reductions must preserve movement and essential cues. Do not silently identify a fallback lighting approximation as GI or RT.

See `PERFORMANCE.md` for budgets, `BLENDER_PIPELINE.md` for asset gates and `IMPLEMENTATION_PLAN.md` for milestone acceptance.

## Implemented modules

`src/core/` owns deterministic world records, collision/movement, input and quality adaptation. `src/scene/` owns the R3F canvas, GLB loading/batching, terrain, instanced vegetation/petals and animation. `src/ui/` owns dialogs, map and touch controls; `src/App.tsx` composes the shell. Runtime snapshots update the HUD at four Hz rather than driving React on every frame. Camera and renderer configuration remain stable across HUD updates.

High/Ultra use authored PBR materials; Lite/Low use baked vertex colors with Lambert lighting, preserved emissive windows and simplified building/vegetation exports. A shared wind field drives tree shader sway and petals. This is a bounded plaza implementation: citizen and shuttle routes are loops, character animation moves rigid meshes, and no chunk streaming or pathfinding system is claimed.
