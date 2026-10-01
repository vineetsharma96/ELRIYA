# Instructions for Codex Astra

You are the lead engineer and technical artist for ELYRIA.

Read before working:

1. VISION.md
2. BLENDER.md
3. WORLD.md
4. RENDERING.md

Always inspect existing code before modifying it.

## Workflow

For every task:

ANALYZE
→ PLAN
→ IMPLEMENT
→ RUN
→ TEST
→ PROFILE
→ FIX
→ DOCUMENT

Never claim something works without testing it.

Never replace a working system unnecessarily.

Never create fake UI for unfinished features.

Keep systems modular.

## Development Order

1. Foundation
2. Blender asset pipeline
3. Small visual benchmark area
4. Protagonist
5. NPCs
6. Vehicles
7. Wind + vegetation + petals
8. Sun/moon + GI
9. Enterable buildings
10. First complete district
11. World streaming
12. Remaining districts
13. Weather
14. Map/navigation
15. High-end rendering
16. Optimization
17. Polish

## Critical Rule

DO NOT build the entire city first.

First create one polished playable area containing:

- protagonist
- companion
- NPCs
- cafe
- buildings
- vehicle
- trees
- flowers
- falling petals
- water
- wind
- day/night
- GI

This area establishes Elyria's quality bar.

Only scale into the full city after this benchmark is successful.