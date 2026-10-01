# ELYRIA asset manifest and budgets

The initial planned inventory below retains the provisional targets for comparison. Verified exports and known deviations are recorded later in this document. All content is original; no random asset packs are used.

| Asset ID | Category | M1 use | LOD0 triangle ceiling | LOD1 target | Material slots | Texture ceiling |
| --- | --- | --- | ---: | ---: | ---: | --- |
| `hero_01` | characters | One chibi protagonist | 12,000 | 5,000 | 4 | 1 x 1024 atlas |
| `companion_01` | characters | One original creature | 5,000 | 2,000 | 3 | 1 x 512 atlas |
| `citizen_01` | characters | 2–6 visual citizens | 8,000 | 3,000 | 4 | Shared 1024 atlas |
| `car_01` | vehicles | One rounded vehicle | 8,000 | 3,000 | 4 | 1 x 1024 atlas |
| `cafe_kit_01` | architecture | Cafe shell/sign/awning | 14,000 | 5,000 | 5 | Shared 1024 atlas |
| `apartment_kit_01` | architecture | Modular facade/roof | 12,000 | 4,000 | 4 | Shared 1024 atlas |
| `tower_01` | architecture | Futuristic skyline accent | 8,000 | 2,000 | 3 | Shared 1024 atlas |
| `blossom_tree_01` | vegetation | 4–10 instanced trees | 4,000 | 1,200 | 3 | 1 x 512 atlas |
| `flower_patch_01` | vegetation | Instanced planted beds | 600 | 150 | 2 | Shared 512 atlas |
| `petal_01` | effects | Instanced/particle petals | 8 | 2 | 1 | None or shared 256 |
| `lamp_01` | street | Pedestrian lamps | 1,200 | 400 | 3 | Shared 512 atlas |
| `road_kit_01` | street | Paths/curbs/crossing | 2,000 per module | 500 | 3 | Shared 1024 atlas |
| `bridge_01` | street | Waterside connectivity | 4,000 | 1,500 | 3 | Shared 1024 atlas |
| `bench_01` | props | Cafe/public seating | 1,500 | 500 | 2 | Shared 512 atlas |

These are ceilings, not targets to fill. Primitive material-only assets may require no textures. Budget counts reflect rendered triangles, including duplicated instances; instancing saves draw calls, not triangle processing.

## Aggregate M1 targets

- Initial transferred app + essential scene asset bytes: at most 8 MB compressed. Lazy-load optional content.
- Essential optimized GLB kit: target at most 4 MB total; any individual asset over 1 MB needs review.
- Loaded textures: target at most 64 MiB estimated GPU storage at High, 32 MiB at Low. Texture estimates are not exact GPU memory measurements.
- Shared materials: target at most 24 visible unique material programs/setups in the plaza. Shadows and multi-material meshes can increase actual draw calls.
- Source/detail meshes must not ship accidentally. Verify payload sizes from actual build/export files.

The final visible-scene and frame-time budgets are in `PERFORMANCE.md`. Budget compliance does not prove visual acceptance; reference comparison remains required.

## Verified export inventory — 2026-10-01T11:34:34.334Z

18 original exports, 3.83 MiB combined. Container, triangle primitive, normal, UV, single-scene/mesh, texture URI and export guardrail checks: PASS. See [machine-readable inspection](scripts/assets/inspection.json).

| Export | KiB | Triangles | Material primitives | Files |
| --- | ---: | ---: | ---: | --- |
| apartment-lod1 | 485.2 | 6,006 | 6 | [GLB](public/assets/architecture/apartment-lod1.glb) · [source](assets/source/apartment.blend) |
| apartment | 843.7 | 17,164 | 6 | [GLB](public/assets/architecture/apartment.glb) · [source](assets/source/apartment.blend) |
| cafe-lod1 | 290.5 | 4,439 | 10 | [GLB](public/assets/architecture/cafe-lod1.glb) · [source](assets/source/cafe.blend) |
| cafe | 561.9 | 12,688 | 10 | [GLB](public/assets/architecture/cafe.glb) · [source](assets/source/cafe.blend) |
| tower-lod1 | 124.1 | 1,696 | 5 | [GLB](public/assets/architecture/tower-lod1.glb) · [source](assets/source/tower.blend) |
| tower | 281.2 | 4,848 | 5 | [GLB](public/assets/architecture/tower.glb) · [source](assets/source/tower.blend) |
| citizen | 189.8 | 6,076 | 8 | [GLB](public/assets/characters/citizen.glb) · [source](assets/source/citizen.blend) |
| companion | 108.4 | 3,648 | 6 | [GLB](public/assets/characters/companion.glb) · [source](assets/source/companion.blend) |
| protagonist | 218.7 | 6,732 | 9 | [GLB](public/assets/characters/protagonist.glb) · [source](assets/source/protagonist.blend) |
| bench | 110.5 | 2,184 | 2 | [GLB](public/assets/street/bench.glb) · [source](assets/source/bench.blend) |
| road-tile | 25.1 | 336 | 2 | [GLB](public/assets/street/road-tile.glb) · [source](assets/source/road-tile.blend) |
| street-lamp | 50.3 | 1,372 | 4 | [GLB](public/assets/street/street-lamp.glb) · [source](assets/source/street-lamp.blend) |
| blossom-tree-lod1 | 37.6 | 978 | 4 | [GLB](public/assets/vegetation/blossom-tree-lod1.glb) · [source](assets/source/blossom-tree.blend) |
| blossom-tree | 90.7 | 2,796 | 4 | [GLB](public/assets/vegetation/blossom-tree.glb) · [source](assets/source/blossom-tree.blend) |
| flower-patch-lod1 | 75.4 | 1,986 | 4 | [GLB](public/assets/vegetation/flower-patch-lod1.glb) · [source](assets/source/flower-patch.blend) |
| flower-patch | 190.7 | 5,676 | 4 | [GLB](public/assets/vegetation/flower-patch.glb) · [source](assets/source/flower-patch.blend) |
| petal | 3.3 | 60 | 1 | [GLB](public/assets/vegetation/petal.glb) · [source](assets/source/petal.blend) |
| shuttle | 235.9 | 5,604 | 6 | [GLB](public/assets/vehicles/shuttle.glb) · [source](assets/source/shuttle.blend) |

The material primitive column describes exported geometry, not final scene draw calls. Low/Lite combine flat-color material parts into shared vertex-colored Lambert batches. High/Ultra retain the near assets' authored PBR materials. Distant skyline assets use LOD1 and color batching. Actual submitted work is reported by the renderer, including shadow passes.

Sources are independent Blender libraries in assets/source; GLBs use categorized public/assets folders. No texture atlas, Draco/meshopt compression, completed skeleton or animation clips are claimed. The rendered falling petals use two-triangle GPU-instanced quads; the separate petal GLB is a source/reference asset.

The original table above retains provisional targets. Several original material-slot and per-asset geometry targets are exceeded, notably the flower patch and apartment. Passing export guardrails does not sign off those targets or real-device frame performance. Density limits, LODs and batching reduce the scene's cost; lower-tier acceptance remains a profiling gate.


<!-- BISTRO_VERIFIED_BEGIN -->
## Blossom Bistro candidate — verified 2026-10-01T13:07:26.018Z

Original Blender MCP geometry, one atlas material per export, saved editable sources and three deliberately modeled exterior LODs. These are candidate assets; integrated scene budgets and art acceptance remain separate gates.

| Export | Actual GLB triangles / ceiling | KiB | Materials | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| blossom_bistro_exterior_lod0.glb | 2162 / 8000 | 200.7 | 1 | `75e3acf6c377fd9833579d39dcd1431597625c097329e25d5dff63174d5de351` |
| blossom_bistro_exterior_lod1.glb | 638 / 3500 | 125.2 | 1 | `d73cecdee28181e75143aa263269eaee2a1af8f76cc085a094b8e52ae18a1a08` |
| blossom_bistro_exterior_lod2.glb | 230 / 1200 | 101.4 | 1 | `c6364104e522ae2125ea8ddcadf86b967506d41d73852d29a29528f7a925ff29` |
| blossom_bistro_interior.glb | 2060 / 10000 | 210.8 | 1 | `f788c7231affbbc9fd98cb5032bb80699b2a1ff6f2f7bcdee7889ba0c0cc59fe` |
| blossom_tea_cup.glb | 456 / 800 | 110.7 | 1 | `24b2b6e48123c854f1c1fbc0907e56d3186739d0bdcd94901b7edae0868ea240` |

Five exports total 748.8 KiB. All exterior LODs pass actual mesh-ray doorway traversal samples at avatar heights. Validation also checks transformed bounds, embedded atlas textures, finite normals, UV ranges, cup base origin and collision opening. Run `node scripts/assets/inspect-bistro.mjs`; evidence: `artifacts/bistro/export-check.json`. General kit validation now checks 23 GLBs.

Contract: `public/assets/architecture/blossom_bistro_contract.json`. Builder: `scripts/blender/build_blossom_bistro.py`. Sources: `assets/source/blossom_bistro_exterior_lod{0,1,2}.blend`, `blossom_bistro_interior.blend`, `blossom_tea_cup.blend`. Review images are source renders in `artifacts/bistro/`, not proof of browser rendering or gameplay.

The shared 1024 color/roughness/emissive atlas has no normal map. Each GLB embeds its textures for independent loading. Embedded copies do not automatically share GPU textures across GLTFLoader calls; approximately 16 MiB including RGBA8 mipmaps per three-texture asset is a planning estimate, not measured memory. Avoid eagerly loading all LODs. Lite color batching must preserve or sample texture maps rather than bake only material.color.

The primary roof ridge is 6.8m; the decorative cat reaches about 7.09m. Floors/porch remain flush at runtime Y=0. No cloth simulation, skeletal carry clip, advanced GI or integrated performance acceptance is claimed. Cup counts use actual exported triangles, which can differ from Blender's source tessellation after exporter cleanup.
<!-- BISTRO_VERIFIED_END -->
