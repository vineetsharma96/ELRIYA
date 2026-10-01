# ELYRIA Blender pipeline

Blender MCP is the required primary creation path for original important assets. Connection status must be established by a real tool response. Local configuration by itself is not a successful connection. The implementation/connection outcome is recorded in `PROGRESS.md`.

## Connection and first export

1. Discover callable Blender tools and inspect the active Blender scene/version.
2. Confirm workspace export access and the add-on/server connection.
3. Create an isolated asset collection and export one simple original asset.
4. Load that GLB in the browser, confirm scale/material/orientation and collect renderer counters.
5. Expand into the small M1 kit only when that round trip is proven.

If tools are unavailable, document the exact failure and required connection step. Preparing deterministic Blender Python source is useful, but is not evidence that Blender MCP ran it. A procedural runtime blockout is not a substitute for accepting the required Blender asset pipeline.

## Asset conventions

Use `assets/<category>/<asset_id>/` for source files, metadata and optional previews. Categories: `characters`, `vehicles`, `architecture`, `interiors`, `vegetation`, `street`, `props`, `landmarks`, `effects`. Optimized deployable GLBs belong under the public asset directory chosen by the app. The manifest must identify the actual paths.

Each source is a reusable asset or modular kit; never build the whole city in one Blender scene. Use meter units, apply scale, keep exterior origins at the ground anchor, and align modular snap points to a documented grid. Character roots sit at ground level between the feet. Doors pivot at hinges. Wheels pivot at axles. Export glTF's standard orientation conversion.

Naming: `<asset_id>_LOD0`, `_LOD1`, `_LOD2`; collision objects use `COL_<asset_id>`. Avoid exporting source lights, cameras, hidden construction geometry or collision meshes as decorative render meshes. Record intended collision shape separately when the runtime does not consume collision meshes.

## Per-asset gate

- Clean topology, consistent normals and no unintended intersections or isolated geometry.
- Correct units, transform, pivot and world-facing direction.
- Shared stylized PBR materials; suitable UVs for textured assets. Untextured flat-color assets still require the material contract and a documented UV decision.
- Separate simple collision proxies where needed; LODs where useful, with visible silhouette checks.
- Meet triangle, material, texture and download budgets in `ASSET_MANIFEST.md`.
- Export GLB/glTF; validate successful parsing and correct browser appearance.
- Measure draw calls, triangle cost and actual load bytes before multiplying variants.

Rigged protagonist work must name animation clips and validate skinning in runtime. Rigid chibi parts are acceptable for the early visual blockout but are not a completed skeletal protagonist.

## Compression and reuse

Share materials and texture atlases where beneficial. Establish a plain GLB loading baseline before adding meshopt/Draco or KTX2/Basis; measure both download savings and decode cost. Do not claim compression or LOD completion without exported artifacts and a working runtime path. Repeated trees, petals, flowers and street props should be instanced where their material setup permits it.

## Implemented M0/M1 path

`scripts/blender/mcp-client.mjs` performs MCP initialize, tools/list and tools/call over the installed server's stdio transport. It does not bypass the server with direct add-on socket commands. The successful server/add-on responses and per-asset reports are retained in `scripts/blender/reports/`.

`build-kit.py` creates one scene per asset, joins geometry with shared material slots, applies transforms, supplies UVs, exports only the selected active scene and writes a compressed editable Blender library to `assets/source/<name>.blend`. Runtime files are categorized under `public/assets/`. `build-lods.py` reads those original sources and derives five LOD1 exports. Original source libraries are retained.

GLTFLoader may produce multiple child meshes from a single multi-material glTF mesh. Runtime instancing must batch every child primitive. The character and vegetation renderers do this; Low/Lite additionally bake the authored material colors/emission into merged geometry with vertex colors and an inexpensive lit material. This is an optimization of Blender-authored meshes, not a replacement asset creation path.

The source kit has thirteen editable assets and eighteen GLBs including LODs. Rigged animation remains M2 work. The runtime round trip has been visually inspected; final acceptance evidence and measured limitations belong in `PROGRESS.md`.
