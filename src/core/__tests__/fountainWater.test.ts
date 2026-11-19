import { describe, expect, it } from 'vitest'
import {
  FOUNTAIN_CENTER,
  FOUNTAIN_SPECS,
  FountainWaterSimulator,
  FountainWaveGrid,
  buildFountainStreams,
  sampleParabolicPoint,
} from '../fountainWater'
import { WORLD } from '../world'

describe('FountainWaterSimulator & 2D Shallow-Water Wave PDE', () => {
  it('propagates waves outward from a splash while remaining bounded and stable', () => {
    const grid = new FountainWaveGrid(40)
    expect(grid.getEnergy()).toBe(0)

    // Inject splash inside the active water ring (r = 1.65m)
    grid.injectSplash(1.65, 0, -0.6, 0.25)
    expect(grid.sampleHeight(1.65, 0)).toBeLessThan(-0.1)

    // Step simulation and verify ripple reaches neighboring water cell
    for (let step = 0; step < 18; step++) {
      grid.step(1 / 60)
    }
    const neighborHeight = Math.abs(grid.sampleHeight(1.15, 0))
    expect(neighborHeight).toBeGreaterThan(0.002)

    // Pedestal center and exterior dry stone remain strictly zeroed
    expect(grid.sampleHeight(0, 0)).toBe(0)
    expect(grid.sampleHeight(2.9, 0)).toBe(0)

    // Long-horizon damping stability (no blowup or NaN)
    const energyAfterSplash = grid.getEnergy()
    for (let step = 0; step < 300; step++) {
      grid.step(1 / 60)
    }
    const energyAfterDecay = grid.getEnergy()
    expect(Number.isFinite(energyAfterDecay)).toBe(true)
    expect(energyAfterDecay).toBeLessThan(energyAfterSplash)
  })

  it('generates parabolic streams that land cleanly inside their target basins', () => {
    const streams = buildFountainStreams()
    expect(streams.length).toBe(
      FOUNTAIN_SPECS.rimNozzleCount + FOUNTAIN_SPECS.midSpoutCount + FOUNTAIN_SPECS.upperSpoutCount
    )

    for (const s of streams) {
      const targetY = s.kind === 'upper_spill' ? FOUNTAIN_SPECS.midWaterY : FOUNTAIN_SPECS.lowerWaterY
      const landing = sampleParabolicPoint(
        s.originX,
        s.originY,
        s.originZ,
        s.velX,
        s.velY,
        s.velZ,
        s.flightTime
      )
      expect(landing.y).toBeCloseTo(targetY, 2)
      const r = Math.hypot(landing.x, landing.z)
      if (s.kind === 'upper_spill') {
        expect(r).toBeGreaterThan(0.4)
        expect(r).toBeLessThan(FOUNTAIN_SPECS.midBowlRadius)
      } else {
        expect(r).toBeGreaterThan(FOUNTAIN_SPECS.pedestalBaseRadius)
        expect(r).toBeLessThan(FOUNTAIN_SPECS.basinInnerRadius)
      }
    }
  })

  it('couples ballistic droplets with wave impulses and packs valid RGBA texture data', () => {
    const sim = new FountainWaterSimulator(240, 36, 42)
    for (let i = 0; i < 90; i++) {
      sim.step(1 / 60, 0.8, 0.4)
    }

    expect(sim.totalBasinImpacts).toBeGreaterThan(10)
    expect(sim.waveGrid.getEnergy()).toBeGreaterThan(0.005)

    // Verify packed RGBA buffer contains non-neutral wave gradients and foam alpha
    let hasGradientVariation = false
    let hasFoam = false
    for (let i = 0; i < sim.textureData.length; i += 4) {
      if (Math.abs(sim.textureData[i + 1] - 128) > 3 || Math.abs(sim.textureData[i + 2] - 128) > 3) {
        hasGradientVariation = true
      }
      if (sim.textureData[i + 3] > 20) {
        hasFoam = true
      }
    }
    expect(hasGradientVariation).toBe(true)
    expect(hasFoam).toBe(true)
  })

  it('aligns fountain structural footprint with the Blossom Plaza collider', () => {
    const fountainCollider = WORLD.colliders.find(
      c => c.x === FOUNTAIN_CENTER.x && c.z === FOUNTAIN_CENTER.z
    )
    expect(fountainCollider).toBeDefined()
    expect(FOUNTAIN_SPECS.basinOuterRadius).toBeLessThanOrEqual(fountainCollider!.halfX)
    expect(FOUNTAIN_SPECS.plinthOuterRadius).toBeLessThanOrEqual(fountainCollider!.halfX + 0.2)
  })
})
