# ELYRIA — CUTE LIVING OPEN-WORLD CITY

You are the lead engineer, technical artist, game-systems architect, Blender MCP operator, graphics programmer, and optimization engineer for **ELYRIA**.

Your job is to build ELYRIA into a polished browser-based 3D open-world exploration experience.

## VISUAL REFERENCE

A concept image named:

`a_bright_whimsical_ultra_detailed_3d_cel_shaded.png`

is provided in the project/context.

ANALYZE THIS IMAGE FIRST.

Use it as the primary visual direction for:

- world mood
- color relationships
- architectural language
- protagonist proportions
- NPC proportions
- vegetation density
- vehicle personality
- street design
- environmental storytelling
- lighting
- atmosphere
- interior coziness
- city density
- skyline composition

Do NOT attempt to recreate the image pixel-for-pixel.

Translate its visual language into a **real, explorable 3D world**.

---

# 1. CORE VISION

ELYRIA is:

> A cute, vibrant, living futuristic city where the player can freely walk, explore, meet citizens, enter buildings, ride or observe vehicles, discover districts, experience dynamic weather and watch the world change from sunrise to moonlit night.

The desired feeling is:

**cozy + cute + futuristic + alive + magical + technologically advanced**

NOT:

- dark cyberpunk
- dystopian
- horror
- realistic GTA clone
- empty tech demo
- static 3D portfolio
- generic neon city

ELYRIA should feel like a place someone would genuinely want to live in.

---

# 2. VISUAL LANGUAGE

Use a stylized high-quality 3D aesthetic inspired by the supplied concept image.

Prioritize:

- rounded geometry
- soft silhouettes
- expressive architecture
- pastel surfaces
- warm materials
- colorful accents
- slightly exaggerated proportions
- clean forms
- lush vegetation
- flowers
- waterways
- bridges
- elevated transit
- inviting storefronts
- cozy interiors
- cute signage
- soft atmospheric depth

Buildings should combine:

**storybook architecture + futuristic technology.**

Avoid making every building a glass skyscraper.

Create:

- cottages integrated into futuristic districts
- cute apartment buildings
- rounded skyscrapers
- towers
- cafes
- shops
- transit stations
- homes
- offices
- laboratories
- public buildings
- fantasy-inspired landmarks

---

# 3. BLENDER MCP — MANDATORY ASSET PIPELINE

Use the available Blender MCP server as the primary 3D asset creation system.

Before manually coding complicated geometry, determine whether Blender MCP is the appropriate tool.

Use Blender MCP to create original:

- protagonist
- NPCs
- vehicles
- buildings
- modular architecture
- trees
- vegetation
- street furniture
- bridges
- interiors
- furniture
- props
- landmarks

Do NOT download random 3D asset packs as shortcuts.

Do NOT create the entire city as one Blender scene.

Build reusable modular asset kits.

---

# 4. ASSET QUALITY PIPELINE

For every important Blender asset:

1. create clean geometry
2. maintain reasonable topology
3. create suitable UVs
4. create optimized PBR/stylized materials
5. establish correct scale
6. establish correct pivot/origin
7. create collisions separately where necessary
8. create LOD variants where useful
9. optimize texture resolution
10. export to GLB/glTF
11. test inside the actual runtime
12. verify performance before creating dozens of variants

Target asset structure:

assets/

characters/
vehicles/
architecture/
interiors/
vegetation/
street/
props/
landmarks/
effects/

---

# 5. CUTE PROTAGONIST

Create an original chibi/stylized protagonist consistent with the reference image.

Approximate visual characteristics:

- oversized head
- expressive face
- compact body
- soft proportions
- recognizable silhouette
- cute outfit
- backpack/accessories
- readable animations

Do NOT reproduce an existing copyrighted character.

The protagonist must support:

- idle
- walking
- jogging
- sprinting
- jumping
- falling
- landing
- turning
- looking around
- interacting
- sitting
- entering doors
- using elevators
- entering/exiting vehicles later

Use skeletal animation and animation blending.

Movement should feel soft and playful rather than mechanically rigid.

---

# 6. COMPANION

Add an optional cute companion inspired by the emotional role of the animal visible in the concept image.

Create an ORIGINAL companion.

Possible direction:

small fantasy cat-like creature.

It should:

- follow the player
- idle
- run
- sit
- react to NPCs
- react to leaves
- react to weather
- occasionally explore nearby objects
- return when the player gets too far away

Keep companion AI lightweight.

---

# 7. THIRD-PERSON EXPLORATION

Use a polished third-person camera.

Desktop:

WASD = move  
Mouse = camera  
Shift = sprint  
Space = jump  
E = interact  
M = map  
C = camera mode  
ESC = menu

Tablet/mobile:

- left virtual joystick
- right-side camera drag
- jump
- sprint
- interact
- map

Implement:

- camera smoothing
- camera collision
- obstruction avoidance
- adjustable distance
- cinematic vista camera

---

# 8. ELYRIA WORLD

Create a large explorable city consisting of interconnected districts.

Suggested districts:

## BLOSSOM CENTRAL

Main commercial district.

Cherry blossoms, cafes, shops, plazas and transit.

## SUNPETAL PARK

Large natural district.

Parks, waterways, flowers, bridges and walking paths.

## STARLIGHT HEIGHTS

Tall futuristic skyline with elevated transit.

## NEKO MARKET

Dense cozy shopping district with restaurants, cafes and small stores.

## AURORA RESEARCH DISTRICT

Cute futuristic laboratories and technology centers.

## CLOUDVIEW

Elevated residential district with beautiful vistas.

## OLD ELYRIA

Historic architecture blended with futuristic infrastructure.

## MOONLIGHT HARBOR

Waterfront district that becomes especially beautiful at night.

Each must have recognizable architecture, vegetation, NPC populations and ambience.

---

# 9. CITY SCALE

ELYRIA should feel enormous without rendering everything simultaneously.

Implement:

WORLD SEED
→ districts
→ chunks
→ roads
→ buildings
→ vegetation
→ NPCs
→ vehicles

Use deterministic generation/placement where practical.

Implement world streaming.

Near player:

HIGH DETAIL

Medium distance:

MEDIUM DETAIL

Far:

HLOD / LOW DETAIL

Very far:

SKYLINE REPRESENTATION

Outside range:

UNLOADED

---

# 10. BUILDINGS

Create modular Blender building kits.

Buildings must support significant variation.

Change:

- height
- width
- roof
- windows
- balconies
- facade modules
- colors
- signs
- vegetation
- entrances
- rooftop details

Favor rounded and friendly shapes.

Avoid obvious copy-paste repetition.

---

# 11. ENTERABLE BUILDINGS

Selected buildings must be physically enterable.

Examples:

- Neko Cafe
- bakery
- apartment
- home
- hotel
- shop
- office
- laboratory
- transit station
- library
- observation tower

Flow:

STREET
→ DOOR
→ INTERIOR
→ ROOMS
→ STAIRS/ELEVATOR
→ EXIT
→ SAME WORLD LOCATION

Avoid unexplained teleportation.

---

# 12. COZY INTERIORS

Match the warm interior mood visible in the reference.

Use:

- warm lighting
- wood
- soft furniture
- plants
- lamps
- books
- screens
- decorations
- windows overlooking Elyria

Create modular interior kits through Blender MCP.

Interiors should feel inhabited.

---

# 13. CUTE NPC POPULATION

Citizens should use the same stylized visual family as the protagonist.

Generate variations in:

- hairstyle
- clothing
- accessories
- height
- palette
- occupation

NPC roles:

- residents
- students
- researchers
- cafe workers
- shopkeepers
- tourists
- transit workers
- gardeners
- office workers

NPCs should have daily schedules.

Example:

HOME
→ TRANSIT
→ CAFE
→ WORK
→ PARK
→ SHOP
→ HOME

---

# 14. NPC INTERACTION

NPCs should:

- greet the player
- talk
- sit
- eat
- work
- shop
- use public spaces
- cross roads
- enter buildings
- use transit
- react to weather
- react to vehicles
- react to nearby events

Use deterministic dialogue for ordinary NPCs.

Reserve Gemini-powered conversation for selected important characters.

---

# 15. VEHICLES

Create cute futuristic vehicles using Blender MCP.

Include:

- compact cars
- taxis
- buses
- delivery vehicles
- autonomous shuttles
- service vehicles
- optional flying transit in distant/background areas

Vehicles should share Elyria's rounded friendly design language.

Traffic must use:

- lanes
- road graphs
- intersections
- traffic signals
- crossings
- stopping
- turning
- parking

Add:

- headlights
- brake lights
- indicators
- suspension approximation
- wheel animation
- spatial audio

Do not implement player driving until ambient traffic is stable.

---

# 16. WATER

Water is important to the reference aesthetic.

Create:

- canals
- ponds
- fountains
- waterways
- harbor
- waterfalls where appropriate

Water should reflect the environment according to quality level.

Add bridges and pedestrian spaces around water.

---

# 17. VEGETATION

ELYRIA should be much greener than the old futuristic city concept.

Create:

- cherry blossom trees
- broadleaf trees
- colorful fantasy trees
- shrubs
- flowers
- grass
- rooftop vegetation
- climbing plants
- planters

Use Blender assets + GPU instancing.

---

# 18. WIND

Implement a unified environmental wind field.

Wind contains:

- direction
- strength
- gusts
- turbulence
- local zones

Wind affects:

- trees
- branches
- flowers
- grass
- clothing where feasible
- particles
- leaves
- atmospheric effects

Wind should vary around buildings.

---

# 19. INTERACTIVE FALLING LEAVES

This is a signature Elyria feature.

Cherry blossom petals and leaves should continuously move through suitable areas.

They react to:

PLAYER
+
NPCs
+
COMPANION
+
VEHICLES
+
WIND
+
BUILDINGS

Example:

vehicle passes
→ local turbulence
→ leaves/petals lift
→ swirl behind vehicle
→ settle again

Player runs through pile
→ petals scatter

NPC walks through leaves
→ small displacement

Strong wind
→ leaves move across street

Do NOT implement thousands of CPU rigid bodies.

Use GPU particles/instancing plus local interaction fields.

---

# 20. WEATHER

Implement:

SUNNY
PARTLY CLOUDY
CLOUDY
LIGHT RAIN
RAIN
HEAVY RAIN
FOG
STORM

Weather affects the WORLD.

Rain:

- roads become wet
- reflections strengthen
- umbrellas appear
- NPC schedules react
- vehicle lights activate
- rain audio appears
- leaves behave differently
- puddles appear where feasible

---

# 21. SUN + MOON

Create a continuous world clock.

DAWN
→ MORNING
→ NOON
→ AFTERNOON
→ GOLDEN HOUR
→ SUNSET
→ BLUE HOUR
→ NIGHT
→ DAWN

Sun and moon must physically move through the sky.

Time influences:

- lighting
- shadows
- GI
- sky
- clouds
- NPC schedules
- traffic
- shop activity
- building lights
- streetlights
- vehicle headlights

Night should retain Elyria's cute/cozy identity.

Do NOT turn it into dark cyberpunk.

---

# 22. GLOBAL ILLUMINATION

GI is a core visual feature.

Build a scalable hybrid lighting architecture.

Use combinations of:

- direct lighting
- environment lighting
- irradiance probes
- reflection probes
- ambient occlusion
- contact shadows
- screen-space techniques
- emissive approximation
- dynamic indirect-light techniques supported by the runtime

GI must respond to the day/night cycle.

Warm interiors should visibly contribute to the nighttime atmosphere.

---

# 23. OPTIONAL HIGH-END RAY TRACING

High-end devices may enable an advanced rendering path.

Where ACTUALLY supported by the selected browser API/GPU/runtime, use ray-based techniques for selected:

- reflections
- shadows
- AO
- indirect lighting
- glass
- wet roads

IMPORTANT:

Do not assume that "WebGPU available" automatically means hardware ray tracing is exposed.

Perform real runtime capability detection.

Never fake an RT status indicator.

If true hardware/browser RT isn't available, use the best hybrid technique available.

Core Elyria must never depend on ray tracing.

---

# 24. QUALITY SYSTEM

Implement:

AUTO
ULTRA
HIGH
MEDIUM
LOW
LITE
CUSTOM

AUTO should evaluate real runtime performance.

Adjust:

- render scale
- shadow resolution
- draw distance
- LOD
- GI
- reflections
- vegetation
- leaves
- NPC density
- vehicle density
- post-processing
- water
- weather particles

Do not identify quality purely from device names.

Use actual measured performance.

---

# 25. VISUAL EFFECTS

Use restrained high-quality effects:

- bloom
- atmospheric scattering
- fog
- depth
- exposure
- soft shadows
- color grading
- wet surfaces
- subtle DOF during cinematic moments

Do NOT bury the world under excessive bloom.

Preserve the bright, clean reference aesthetic.

---

# 26. MAP

Build a stylized map matching Elyria.

Show:

- player
- districts
- roads
- water
- buildings
- landmarks
- cafes
- shops
- parks
- stations
- discovered locations

Map data must derive from the actual world.

---

# 27. NAVIGATION

Select a destination.

Example:

NEKO CAFE

Then:

DESTINATION
→ PATHFINDING
→ WALKABLE GRAPH
→ ROUTE
→ WORLD GUIDANCE

Use subtle markers and minimap routing.

---

# 28. DISCOVERY

Encourage exploration.

Discover:

- scenic viewpoints
- cafes
- hidden gardens
- rooftops
- secret alleys
- unusual shops
- NPC stories
- waterfalls
- landmarks
- hidden rooms

Keep exploration relaxing rather than mission-heavy.

---

# 29. GEMINI CITY ASSISTANT

After core gameplay is stable, add Gemini as Elyria's city intelligence.

Examples:

"Where is the nearest cafe?"

"Take me somewhere beautiful."

"Where can I watch sunset?"

"Find a quiet park."

"Who is this NPC?"

"How do I reach Moonlight Harbor?"

AI receives structured world context and produces validated structured actions.

Never execute arbitrary AI-generated code.

---

# 30. AUDIO

Build spatial ambience.

Examples:

Blossom Central:
people + cafes + transit + birds

Sunpetal Park:
water + birds + leaves + wind

Night:
crickets + distant vehicles + quiet city

Rain:
rain + water + indoor ambience

Include:

- footsteps
- vehicle sounds
- doors
- elevators
- NPC chatter
- wind
- leaves
- water

---

# 31. PHYSICS

Implement only useful physical interactions.

Prioritize:

- player collision
- stairs
- slopes
- doors
- vehicles
- interaction zones
- leaf forces
- water boundaries
- camera collision

Do not waste performance simulating invisible physics.

---

# 32. PERFORMANCE

This is NON-NEGOTIABLE.

Use:

- InstancedMesh
- batching
- LOD
- HLOD
- texture atlases where useful
- mesh compression
- texture compression
- object pooling
- chunk streaming
- frustum culling
- selective shadows
- simulation distance
- Web Workers
- adaptive resolution

Keep simulation and rendering separate.

Distant NPCs do NOT require full animation/pathfinding.

Distant vehicles do NOT require full physics.

---

# 33. DEBUG TOOLS

Create a developer panel showing:

FPS
frame time
draw calls
triangles
GPU/render backend
active chunks
NPCs
vehicles
particles
GI mode
RT mode
quality
player coordinates
district
weather
wind
time

Provide development controls for:

- time
- weather
- wind
- teleport
- quality
- NPC spawning
- vehicle spawning
- leaf density
- GI
- rendering diagnostics

---

# 34. PROJECT DOCUMENTATION

Before large-scale implementation, create/update:

`ARCHITECTURE.md`

`DESIGN.md`

`BLENDER_PIPELINE.md`

`ASSET_MANIFEST.md`

`WORLD_DESIGN.md`

`RENDERING.md`

`PERFORMANCE.md`

`IMPLEMENTATION_PLAN.md`

`PROGRESS.md`

Use them as living engineering documents.

---

# 35. DEVELOPMENT RULE

DO NOT ATTEMPT TO BUILD ALL OF ELYRIA IN ONE PASS.

Work milestone-by-milestone.

For every milestone:

ANALYZE
→ PLAN
→ IMPLEMENT
→ RUN
→ TEST
→ PROFILE
→ FIX
→ REGRESSION TEST
→ DOCUMENT
→ COMMIT

Never proceed because code merely "looks correct."

Run it.

---

# 36. MILESTONES

### M0 — Foundation

Set up architecture, renderer, R3F, input, Blender MCP pipeline and diagnostics.

### M1 — Visual Prototype

Use Blender MCP to create:

- protagonist
- companion
- NPC
- cute car
- tree
- petals
- street lamp
- cafe
- apartment
- skyscraper
- road kit

Build ONE small plaza resembling the quality and emotional direction of the concept image.

This is the visual benchmark.

DO NOT create the entire city until this benchmark looks good.

### M2 — Character

Complete protagonist animation, movement and camera.

### M3 — Living Plaza

Add NPCs, vehicles, trees, wind, petals, cafe interior and interaction.

### M4 — Lighting

Sun/moon, GI, reflections, shadows and day/night.

### M5 — Environment

Weather, wind, interactive vegetation, water and leaves.

### M6 — First District

Turn the plaza into Blossom Central.

### M7 — NPC Simulation

Schedules, dialogue and activities.

### M8 — Traffic

Complete road traffic.

### M9 — Interiors

Multiple enterable building categories.

### M10 — World Streaming

Chunk system, LOD and skyline.

### M11 — Multiple Districts

Expand Elyria.

### M12 — Map & Navigation

Complete map and pathfinding.

### M13 — High-End Rendering

Advanced GI and optional ray-based rendering.

### M14 — Gemini

City intelligence.

### M15 — Optimization

Desktop + tablet + mobile testing.

### M16 — Polish

Animation, lighting, audio, UI and environmental storytelling.

---

# 37. FIRST TASK

Before writing implementation code:

1. Inspect the complete repository.
2. Inspect the supplied concept image carefully.
3. Inspect available Blender MCP capabilities.
4. Identify reusable code from any existing Elyria/NexusCity implementation.
5. Do NOT preserve weak systems solely because they already exist.
6. Do NOT rewrite strong systems unnecessarily.
7. Produce an implementation gap analysis.
8. Produce the architecture documents.
9. Establish measurable performance budgets.
10. Establish an asset budget.
11. Establish the visual benchmark for M1.

Then implement M0.

After M0 is stable, immediately proceed to M1 unless blocked.

M1 is CRITICAL.

Before building a massive city, prove that we can create **one small area at the target quality**.

The M1 benchmark should contain:

cute protagonist
+
cute companion
+
cute NPCs
+
cute cafe
+
futuristic architecture
+
water
+
trees
+
flowers
+
falling petals
+
vehicle
+
warm sunlight
+
high-quality lighting

If this single area does not feel like the supplied concept image's world translated into real-time 3D, DO NOT scale it into a city yet.

Improve the visual benchmark first.

# BUILD ELYRIA.