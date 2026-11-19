import { describe, expect, it } from 'vitest'
import { evaluateBloomProfile, isSoftwareWebGLContext } from '../bloom'

describe('HDR Post-Processing Bloom Profile & Software WebGL Guard', () => {
  it('adapts bloom strength, radius, and threshold smoothly across day, twilight, and night', () => {
    const day = evaluateBloomProfile({
      daylight: 1,
      twilight: 0,
      streetLampIntensity: 0,
      rainIntensity: 0,
      userIntensity: 1,
      qualityTier: 'HIGH',
      isSoftwareGl: false,
    })

    const twilight = evaluateBloomProfile({
      daylight: 0.35,
      twilight: 0.9,
      streetLampIntensity: 0.5,
      rainIntensity: 0,
      userIntensity: 1,
      qualityTier: 'HIGH',
      isSoftwareGl: false,
    })

    const night = evaluateBloomProfile({
      daylight: 0,
      twilight: 0,
      streetLampIntensity: 1,
      rainIntensity: 0,
      userIntensity: 1,
      qualityTier: 'HIGH',
      isSoftwareGl: false,
    })

    expect(day.enabled).toBe(true)
    expect(twilight.enabled).toBe(true)
    expect(night.enabled).toBe(true)

    // Daytime threshold stays higher so bright plaza paving never washes out
    expect(day.threshold).toBeGreaterThan(night.threshold)
    // Nighttime & twilight bloom stronger for glowing streetlamps, windows, and moonlit blossoms
    expect(night.strength).toBeGreaterThan(day.strength)
    expect(twilight.strength).toBeGreaterThan(day.strength)
    expect(night.radius).toBeGreaterThan(day.radius)
    expect(day.resolutionScale).toBe(0.75)
  })

  it('disables bloom cleanly when user sets intensity to 0, on LITE tier, or on software WebGL', () => {
    const offByUser = evaluateBloomProfile({
      daylight: 1,
      twilight: 0,
      streetLampIntensity: 0,
      rainIntensity: 0,
      userIntensity: 0,
      qualityTier: 'ULTRA',
      isSoftwareGl: false,
    })
    expect(offByUser.enabled).toBe(false)
    expect(offByUser.strength).toBe(0)

    const offByLite = evaluateBloomProfile({
      daylight: 0,
      twilight: 0,
      streetLampIntensity: 1,
      rainIntensity: 0,
      userIntensity: 1,
      qualityTier: 'LITE',
      isSoftwareGl: false,
    })
    expect(offByLite.enabled).toBe(false)

    const offBySwGl = evaluateBloomProfile({
      daylight: 0,
      twilight: 0,
      streetLampIntensity: 1,
      rainIntensity: 0,
      userIntensity: 1,
      qualityTier: 'ULTRA',
      isSoftwareGl: true,
    })
    expect(offBySwGl.enabled).toBe(false)
  })

  it('scales bloom strength linearly with userIntensity and widens halo softly in rain', () => {
    const clear = evaluateBloomProfile({
      daylight: 0.2,
      twilight: 0.2,
      streetLampIntensity: 0.8,
      rainIntensity: 0,
      userIntensity: 1,
      qualityTier: 'MEDIUM',
      isSoftwareGl: false,
    })
    const doubleGlow = evaluateBloomProfile({
      daylight: 0.2,
      twilight: 0.2,
      streetLampIntensity: 0.8,
      rainIntensity: 0,
      userIntensity: 2,
      qualityTier: 'MEDIUM',
      isSoftwareGl: false,
    })
    const rainy = evaluateBloomProfile({
      daylight: 0.2,
      twilight: 0.2,
      streetLampIntensity: 0.8,
      rainIntensity: 1,
      userIntensity: 1,
      qualityTier: 'MEDIUM',
      isSoftwareGl: false,
    })

    expect(doubleGlow.strength).toBeCloseTo(clear.strength * 2, 3)
    expect(clear.resolutionScale).toBe(0.5)
    expect(rainy.radius).toBeGreaterThan(clear.radius)
    expect(rainy.strength).toBeLessThan(clear.strength)
  })

  it('detects CPU software WebGL renderer strings accurately', () => {
    const mockSwContext = {
      RENDERER: 0x1f01,
      getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 0x9246 }),
      getParameter: () => 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))',
    } as unknown as WebGL2RenderingContext

    const mockGpuContext = {
      RENDERER: 0x1f01,
      getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 0x9246 }),
      getParameter: () => 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro)',
    } as unknown as WebGL2RenderingContext

    expect(isSoftwareWebGLContext(mockSwContext)).toBe(true)
    expect(isSoftwareWebGLContext(mockGpuContext)).toBe(false)
    expect(isSoftwareWebGLContext(null)).toBe(true)
  })
})
