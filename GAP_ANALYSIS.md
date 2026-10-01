# ELYRIA implementation gap analysis

Initial inspection: 2026-10-01. Source requirements: `Prompt.md`, `ASTRA.md`, `VISION.md`, `BLENDER.md`, `WORLD.md`, `RENDERING.md`.

The repository initially contains only these six briefs. `WORLD.md` is empty. There is no app, package manifest, test suite, existing Elyria/NexusCity system, asset library, or Git repository to reuse. No working system needs replacement.

| Requirement | Initial evidence | Next action |
| --- | --- | --- |
| Concept image | `a_bright_whimsical_ultra_detailed_3d_cel_shaded.png` is absent from the inspected repository | Keep art direction provisional; inspect the actual reference before visual sign-off |
| Browser runtime | No implementation | M0: React + TypeScript + Vite + R3F/Three foundation |
| Blender MCP | Connection and capabilities require a live check | Establish original modular asset creation/export pipeline; retain evidence |
| M1 assets | No source Blender files or GLBs | Create a compact, budgeted plaza kit through Blender MCP |
| Movement/camera | No implementation | Prove responsive input, camera and basic bounds in a small area; full character behavior is M2 |
| Lighting | Written requirements only | Start with honest direct + environment approximation; stage probe and screen-space work separately |
| Performance | No measurements | Add diagnostics before content growth; measure actual browser frame time and render counters |

## After implementation

The browser runtime, original Blender asset pipeline, compact plaza, input/camera, dynamic direct/ambient lighting and actual diagnostics now exist. Build, core tests and 18 export checks pass. The missing concept reference and real-device performance remain acceptance gaps. The plaza includes only preview character motion and deterministic ambient route loops; the broader character, interior, traffic, lighting, streaming and AI requirements remain staged in `IMPLEMENTATION_PLAN.md`.
| City systems | No simulation, roads, interiors, chunks or map | Keep out of foundation scope; use later milestone gates |

## First delivery boundary

Build M0 and a single M1 plaza candidate. Do not imply that the full city, final animated protagonist, traffic, interior traversal, advanced GI, or hardware ray tracing exists. A missing reference blocks visual acceptance, not architecture or reversible foundation work. Blender availability can block the required asset creation path; temporary geometry must be explicitly identified as a blockout.

The current implementation and validation record belongs in `PROGRESS.md`. This file preserves the initial gap assessment.
