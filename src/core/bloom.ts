import type { QualityTier } from './quality'

export interface BloomMoodInput {
  /** Normalized daylight [0 = night .. 1 = bright noon] */
  daylight: number
  /** Golden-hour / twilight peak [0..1] */
  twilight: number
  /** Active street lamp glow [0..1] */
  streetLampIntensity: number
  /** Rain intensity [0..1] for soft misty lantern halation */
  rainIntensity: number
  /** User bloom intensity multiplier [0..2], default 1.0 */
  userIntensity: number
  /** Current adaptive quality tier */
  qualityTier: QualityTier
  /** True when running on CPU software WebGL (SwiftShader / llvmpipe / etc.) */
  isSoftwareGl: boolean
}

export interface BloomProfile {
  enabled: boolean
  strength: number
  radius: number
  threshold: number
  /** Downscale factor for the UnrealBloomPass mip pyramid (1 = full res, 0.5 = half res) */
  resolutionScale: number
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min
  return Math.min(max, Math.max(min, v))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Evaluates physically calibrated HDR UnrealBloom parameters so blossom canopies,
 * celestial discs, street lamps, and café windows share a dreamy, ethereal glow
 * without washing out the daylight stone plaza.
 */
export function evaluateBloomProfile(input: BloomMoodInput): BloomProfile {
  const userIntensity = clamp(input.userIntensity, 0, 2)
  const enabled =
    !input.isSoftwareGl &&
    input.qualityTier !== 'LITE' &&
    userIntensity > 0.01

  const daylight = clamp(input.daylight, 0, 1)
  const twilight = clamp(input.twilight, 0, 1)
  const lamps = clamp(input.streetLampIntensity, 0, 1)
  const rain = clamp(input.rainIntensity, 0, 1)

  // Base curve: luminous golden-lantern night -> dreamy pastel-pink daylight haze
  const nightStrength = 0.58 + lamps * 0.08
  const dayStrength = 0.34
  let baseStrength = lerp(nightStrength, dayStrength, daylight)
  // Extra warm poetic bloom boost during sunrise/sunset golden hour
  baseStrength += twilight * 0.14
  // Soften slightly during heavy rain so overcast sky never clips
  baseStrength *= 1 - rain * 0.12

  // Threshold stays high enough in daylight so stone paving stays crisp while sunlit
  // sakura crowns, sun disc, and emissive lanterns bloom softly
  let threshold = lerp(0.70, 0.84, daylight) - twilight * 0.04
  threshold = clamp(threshold, 0.58, 0.92)

  // Wide silky radius for a painterly atmospheric halo, slightly broader in misty rain
  let radius = lerp(0.76, 0.62, daylight) + twilight * 0.08 + rain * 0.06
  radius = clamp(radius, 0.35, 0.95)

  const strength = enabled ? Number((baseStrength * userIntensity).toFixed(4)) : 0
  const resolutionScale =
    input.qualityTier === 'HIGH' || input.qualityTier === 'ULTRA' ? 0.75 : 0.5

  return {
    enabled,
    strength,
    radius: Number(radius.toFixed(4)),
    threshold: Number(threshold.toFixed(4)),
    resolutionScale,
  }
}

/**
 * Detects CPU software WebGL renderers (SwiftShader, llvmpipe, WARP) from the active
 * WebGL context so multi-pass post-processing never stalls GPU-less environments.
 */
export function isSoftwareWebGLContext(glContext: WebGLRenderingContext | WebGL2RenderingContext | null): boolean {
  if (!glContext) return true
  try {
    const debugInfo = glContext.getExtension('WEBGL_debug_renderer_info')
    const param = debugInfo ? debugInfo.UNMASKED_RENDERER_WEBGL : glContext.RENDERER
    const rendererStr = String(glContext.getParameter(param) ?? '')
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr)
  } catch {
    return false
  }
}
