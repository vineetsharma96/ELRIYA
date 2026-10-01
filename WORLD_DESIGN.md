# ELYRIA world design

`WORLD.md` was empty at initial inspection. This document supplies the working world plan while retaining the original brief unchanged.

## M1 footprint

Start with one roughly 70 x 70 meter pedestrian plaza in Blossom Central. Treat this as a content envelope, not a demand to fill every meter. Keep the central pedestrian loop open, with a cafe on one edge, a canal/pond and planted walk on another, and apartment/future-city silhouettes behind. Streets form visible boundaries; ambient traffic is deferred until the road graph is implemented.

Suggested spatial relationships:

- Cafe door and seating face the plaza rather than an inaccessible facade.
- Blossom trees frame the route and cast selective shadows over seating.
- Water supplies a calm focal point, with explicit walkable edges and a bridge if the geometry needs one.
- A future transit/tower landmark anchors the skyline without dominating character scale.
- Spawn on an open surface facing an obvious destination; leave room to test camera rotation and sprinting.

All exact transforms must come from scene/world data. Any future map must consume those same records. A hardcoded decorative map unrelated to the actual scene is not acceptable.

## Connectivity contracts

Use stable object and destination IDs. Walkable paths, physical bounds, door portals, road lanes and decorative geometry are separate concepts. Future interiors preserve the exterior entry location and provide explicit door/room transitions. Do not add fake enter prompts before traversal exists.

## District expansion, after plaza approval

| District | Distinguishing character |
| --- | --- |
| Blossom Central | Cafe plazas, blossoms, daily commerce and transit |
| Sunpetal Park | Green paths, bridges, gardens and waterways |
| Starlight Heights | Rounded towers and elevated transit |
| Neko Market | Dense small shops, restaurant streets and warm signs |
| Aurora Research | Welcoming labs, gardens and visible technology |
| Cloudview | Elevated homes and long views |
| Old Elyria | Historic silhouettes integrated with future infrastructure |
| Moonlight Harbor | Waterfront paths and warm nighttime reflections |

District seed and coordinate-based chunk placement should be deterministic. Plan near/mid/far/skyline representations and unloadable resources before increasing physical size. The M1 plaza itself does not need a pretend streaming system.
