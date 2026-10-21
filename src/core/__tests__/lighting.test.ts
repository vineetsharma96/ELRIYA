import { describe, expect, it } from 'vitest'
import { computeStreetLampSchedule, dampTimeOfDay, EnvironmentLightingController, shortestHourDelta } from '../../scene/lighting'
import { selectNearestStreetLamps } from '../../scene/StreetLights'
import { WORLD } from '../world'

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

  it('dynamically updates global environment lighting across sunny, overcast, and light_rain weather conditions', () => {
    const controller = new EnvironmentLightingController(12)
    const sunnyState = controller.update(12, 1, true, { condition: 'sunny', cloudCover: 0, rainIntensity: 0 })
    const sunnySunIntensity = sunnyState.sunIntensity
    const sunnyFogFar = sunnyState.fogFar
    const sunnyEmissive = sunnyState.emissiveIntensity
    const sunnySkyB = sunnyState.skyColor.b

    // Transition to overcast
    const overcastState = controller.update(12, 1, true, { condition: 'overcast', cloudCover: 0.68, rainIntensity: 0 })
    const overcastSunIntensity = overcastState.sunIntensity
    const overcastFogFar = overcastState.fogFar
    const overcastEmissive = overcastState.emissiveIntensity
    expect(overcastState.weatherCondition).toBe('overcast')
    expect(overcastSunIntensity).toBeLessThan(sunnySunIntensity * 0.72)
    expect(overcastFogFar).toBeLessThan(sunnyFogFar)
    expect(overcastEmissive).toBeGreaterThan(sunnyEmissive)

    // Transition to light rain
    const rainState = controller.update(12, 1, true, { condition: 'light_rain', cloudCover: 1, rainIntensity: 1 })
    expect(rainState.weatherCondition).toBe('light_rain')
    expect(rainState.sunIntensity).toBeLessThan(overcastSunIntensity)
    expect(rainState.fogFar).toBeLessThan(overcastFogFar)
    expect(rainState.fogNear).toBeLessThan(65)
    expect(rainState.emissiveIntensity).toBeGreaterThan(overcastEmissive)
    expect(rainState.sunScale).toBeLessThan(0.4)
    expect(rainState.skyColor.b).not.toBeCloseTo(sunnySkyB, 2)
  })

  it('automatically activates street lights at night and turns them off at sunrise', () => {
    // Daytime (10:00) -> completely off
    expect(computeStreetLampSchedule(10).active).toBe(false)
    expect(computeStreetLampSchedule(10).intensity).toBe(0)

    // Dusk ramp (18:00) -> partially active
    const dusk = computeStreetLampSchedule(18)
    expect(dusk.active).toBe(true)
    expect(dusk.intensity).toBeCloseTo(0.5, 2)

    // Night (22:30 and 02:00) -> full warm glow
    expect(computeStreetLampSchedule(22.5).active).toBe(true)
    expect(computeStreetLampSchedule(22.5).intensity).toBe(1)
    expect(computeStreetLampSchedule(2).intensity).toBe(1)

    // Sunrise cutoff (06:00 ramping down -> 06:35 off)
    expect(computeStreetLampSchedule(6.0).intensity).toBeCloseTo(0.5, 2)
    expect(computeStreetLampSchedule(6.6).active).toBe(false)
    expect(computeStreetLampSchedule(6.6).intensity).toBe(0)

    // Verify controller state integration and nearest street lamp selection
    const controller = new EnvironmentLightingController(21.5)
    expect(controller.state.streetLampActive).toBe(true)
    expect(controller.state.streetLampIntensity).toBe(1)

    controller.update(7.5, 1, true)
    expect(controller.state.streetLampActive).toBe(false)
    expect(controller.state.streetLampIntensity).toBe(0)

    expect(WORLD.streetLamps.length).toBeGreaterThanOrEqual(40)
    const nearest = selectNearestStreetLamps(WORLD.streetLamps, { x: 0, z: 12 }, 8)
    expect(nearest).toHaveLength(8)
    expect(Math.hypot(nearest[0].globeX - 0, nearest[0].globeZ - 12)).toBeLessThanOrEqual(
      Math.hypot(nearest[7].globeX - 0, nearest[7].globeZ - 12)
    )
  })
})



