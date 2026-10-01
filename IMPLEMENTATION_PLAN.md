# ELYRIA implementation plan

Follow ANALYZE -> PLAN -> IMPLEMENT -> RUN -> TEST -> PROFILE -> FIX -> REGRESSION CHECK -> DOCUMENT. Commit when a repository exists and changes have been verified; do not invent commit history.

## M0 — Foundation

1. Inspect the complete repository, reference and available Blender MCP tools. Record gaps.
2. Establish architecture, visual criteria, asset budget and measured-performance policy.
3. Set up React/TypeScript/Vite and R3F/Three with modular scene, input and application shell.
4. Add actual loading/error behavior, camera/player input scaffold and render diagnostics.
5. Prove Blender MCP -> original modular asset -> GLB -> actual browser render.
6. Run a production build and browser smoke test, inspect errors and record an initial frame sample.

Exit gate: runtime works with real diagnostics and an asset round trip is verified. If Blender cannot connect, distinguish runnable application foundation from blocked pipeline acceptance. Do not call all of M0 complete while that required gate is missing.

## M1 — One visual benchmark

Create the original budgeted asset kit and compose the small plaza described in `DESIGN.md` and `WORLD_DESIGN.md`. Include a chibi protagonist, original companion, citizens, cafe, apartment, future-city accent, vehicle, trees, flowers, petals and water. Establish warm daytime lighting and an honest nighttime preview where implemented.

Verify assets in the runtime, collect daylight/night screenshots and profile dense viewpoints. Improve scale, composition, material consistency and readability before adding scope.

Exit gate: asset provenance and runtime validation are recorded; the actual supplied concept has been inspected; the plaza is visually accepted; a desktop baseline meets the measured budget or deviations are explicitly resolved. Mobile claims require a real mobile run. A blockout is an intermediate candidate, not a completed M1.

## Subsequent gates

Current implementation: the M0 runtime, original Blender round trip, production build and 16 core tests are in place. M1 plaza assets and daytime/nighttime preview exist; browser regression evidence is recorded in `artifacts/`. M1 acceptance remains pending the missing concept image, visual review and measured real-device performance. Later milestones have not been accepted.

| Milestone | Required result |
| --- | --- |
| M2 Character | Rig, animation blending, polished movement, slopes/stairs and camera collision |
| M3 Living plaza | Nearby NPC/companion behavior, stable ambient vehicle route, interactions and cafe interior |
| M4 Lighting | Continuous sun/moon, tested indirect-light strategy, reflections and night atmosphere |
| M5 Environment | Unified wind, interactive petals, weather and water response |
| M6 First district | Expand accepted kit into coherent Blossom Central |
| M7 NPC simulation | Schedules, activities, deterministic conversation and distant simulation |
| M8 Traffic | Lane graph, intersections, crossings, stopping and stable ambient traffic |
| M9 Interiors | Multiple physically coherent enterable building categories |
| M10 Streaming | Deterministic chunks, LOD/HLOD, skyline and resource lifecycle |
| M11 Districts | Distinct connected districts using the proven systems |
| M12 Navigation | Actual-world map, destination IDs and walkable routing |
| M13 Rendering | Profiled advanced GI and optional proven ray-based techniques |
| M14 Gemini | Validated structured actions over stable world data |
| M15 Optimization | Desktop, tablet and real mobile regression/profile passes |
| M16 Polish | Audio, animation, accessibility, lighting and environmental storytelling |

Do not promote planned features into interface controls or progress claims before implementation and testing.
