# Elyria Rendering

Elyria should look beautiful while scaling across different hardware.

## Lighting

Implement:
- Dynamic sun
- Dynamic moon
- Day/night cycle
- Global illumination
- Ambient occlusion
- Contact shadows
- Reflection system
- Emissive lighting
- Atmospheric lighting

GI must react to time and weather.

## Ray Tracing

Ray-based rendering is optional for capable high-end devices.

Never make ray tracing required.

Fallback:

Ray-based effects
→ Hybrid GI
→ Probe/Screen-space GI
→ Simplified lighting

Do not assume WebGPU automatically provides hardware ray tracing.

## Quality

AUTO
ULTRA
HIGH
MEDIUM
LOW
LITE

Dynamically control:
- Resolution
- Shadows
- GI
- Reflections
- Draw distance
- Vegetation
- NPCs
- Vehicles
- Particles

Performance is more important than unnecessary visual effects.