import { describe, expect, it } from 'vitest'
import { dampTimeOfDay, EnvironmentLightingController, shortestHourDelta } from '../../scene/lighting'

describe('smooth environment lighting and celestial transitions', () => {
  it('computes shortest circular hour delta across midnight wrap-around', () => {
    expect(shortestHourDelta(23, 1)).toBeCloseTo(2, 5)
    expect(shortestHourDelta(1, 23)).toBeCloseTo(-2, 5)
    expect(shortestHourDelta(9, 15)).toBeCloseTo(6, 5)
    const damped = dampTimeOfDay(23.5, 0.5, 10, 0.05)
    expect(damped > 23.5 || damped < 0.5).toBe(true)
  })

  it('smoothly interpolates sun/moon positions and lighting when time snapshot jumps', () => {
    const controller = new EnvironmentLightingController(12)
    const initialSunY = controller.state.sunDiscPosition.y
    const initialIntensity = controller.state.sunIntensity
    expect(initialSunY).toBeGreaterThan(100)
    expect(controller.state.sunScale).toBeCloseTo(1, 2)
    expect(controller.state.moonScale).toBeCloseTo(0, 2)

    // Jump time snapshot to midnight (00:00)
    const afterOneFrame = controller.update(0, 1 / 60)
    // Must not snap immediately on a single frame
    expect(afterOneFrame.sunIntensity).toBeLessThan(initialIntensity)
    expect(afterOneFrame.sunIntensity).toBeGreaterThan(1.5)
    expect(afterOneFrame.sunDiscPosition.y).toBeLessThan(initialSunY)
    expect(afterOneFrame.sunDiscPosition.y).toBeGreaterThan(50)

    // Advance 2 seconds to converge smoothly to midnight state
    for (let i = 0; i < 120; i++) {
      controller.update(0, 1 / 60)
    }
    expect(controller.state.daylight).toBeLessThan(0.05)
    expect(controller.state.sunScale).toBeLessThan(0.05)
    expect(controller.state.moonScale).toBeGreaterThan(0.95)
    expect(controller.state.moonDiscPosition.y).toBeGreaterThan(100)
    expect(controller.state.emissiveIntensity).toBeGreaterThan(1.6)
  })

  it('produces continuous golden-hour twilight warmth at sunrise and sunset without hard color snaps', () => {
    const controller = new EnvironmentLightingController(6.1)
    expect(controller.state.twilight).toBeGreaterThan(0.75)

    // Small step around daylight=0.7 and daylight=0.3 should produce tiny continuous color deltas
    controller.update(7.2, 1, true)
    const r1 = controller.state.sunColor.r
    const g1 = controller.state.sunColor.g
    const b1 = controller.state.sunColor.b

    controller.update(7.35, 1, true)
    const colorStep = Math.hypot(
      controller.state.sunColor.r - r1,
      controller.state.sunColor.g - g1,
      controller.state.sunColor.b - b1
    )
    expect(colorStep).toBeLessThan(0.05)
  })
})
