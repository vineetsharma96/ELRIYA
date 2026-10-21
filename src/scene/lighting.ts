import * as THREE from 'three'

export interface EnvironmentLightingSnapshot {
  visualTime: number
  daylight: number
  twilight: number
  sunIntensity: number
  hemiIntensity: number
  emissiveIntensity: number
  fogFar: number
  sunPosition: THREE.Vector3
  moonPosition: THREE.Vector3
  keyLightPosition: THREE.Vector3
  sunDiscPosition: THREE.Vector3
  moonDiscPosition: THREE.Vector3
  sunScale: number
  moonScale: number
  skyColor: THREE.Color
  sunColor: THREE.Color
  hemiSkyColor: THREE.Color
  hemiGroundColor: THREE.Color
}

// Pre-allocated palette stops (Zero GC allocations during per-frame updates)
const SKY_NIGHT = new THREE.Color('#283558')
const SKY_TWILIGHT = new THREE.Color('#d8b29c')
const SKY_DAY = new THREE.Color('#c7ded9')

const SUN_NIGHT = new THREE.Color('#9bb4dc')
const SUN_GOLDEN = new THREE.Color('#ffc48d')
const SUN_NOON = new THREE.Color('#fff2d3')

const HEMI_SKY_NIGHT = new THREE.Color('#6375a4')
const HEMI_SKY_TWILIGHT = new THREE.Color('#eccbb8')
const HEMI_SKY_DAY = new THREE.Color('#dbf1ff')

const HEMI_GROUND_NIGHT = new THREE.Color('#425449')
const HEMI_GROUND_TWILIGHT = new THREE.Color('#7f9477')
const HEMI_GROUND_DAY = new THREE.Color('#a0b995')

const _tempColor = new THREE.Color()
const _targetSunPos = new THREE.Vector3()
const _targetMoonPos = new THREE.Vector3()
const _targetKeyPos = new THREE.Vector3()
const _targetSunDisc = new THREE.Vector3()
const _targetMoonDisc = new THREE.Vector3()

/**
 * Shortest signed difference between two hours on a 24-hour clock in [-12, 12].
 */
export function shortestHourDelta(currentHours: number, targetHours: number): number {
  const c = ((currentHours % 24) + 24) % 24
  const t = ((targetHours % 24) + 24) % 24
  let diff = t - c
  if (diff > 12) diff -= 24
  if (diff < -12) diff += 24
  return diff
}

/**
 * Frame-rate independent circular damping across the 24-hour clock.
 */
export function dampTimeOfDay(currentHours: number, targetHours: number, lambda: number, dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return ((currentHours % 24) + 24) % 24
  const factor = 1 - Math.exp(-lambda * dt)
  const delta = shortestHourDelta(currentHours, targetHours)
  return (((currentHours + delta * factor) % 24) + 24) % 24
}

export class EnvironmentLightingController {
  readonly state: EnvironmentLightingSnapshot

  constructor(initialTime = 9.5) {
    this.state = {
      visualTime: initialTime,
      daylight: 1,
      twilight: 0,
      sunIntensity: 2.4,
      hemiIntensity: 1.25,
      emissiveIntensity: 0.12,
      fogFar: 205,
      sunPosition: new THREE.Vector3(35, 55, -28),
      moonPosition: new THREE.Vector3(-35, -55, -28),
      keyLightPosition: new THREE.Vector3(35, 55, -28),
      sunDiscPosition: new THREE.Vector3(80, 80, -95),
      moonDiscPosition: new THREE.Vector3(-80, -80, -95),
      sunScale: 1,
      moonScale: 0,
      skyColor: SKY_DAY.clone(),
      sunColor: SUN_NOON.clone(),
      hemiSkyColor: HEMI_SKY_DAY.clone(),
      hemiGroundColor: HEMI_GROUND_DAY.clone(),
    }
    this.update(initialTime, 1, true)
  }

  update(targetTime: number, deltaSeconds: number, immediate = false): EnvironmentLightingSnapshot {
    const dt = immediate ? 1 : Math.min(Math.max(deltaSeconds, 0.001), 0.1)
    const s = this.state

    // 1. Smoothly damp visual time toward target snapshot time (handles both continuous flow and UI slider jumps)
    s.visualTime = immediate ? ((targetTime % 24) + 24) % 24 : dampTimeOfDay(s.visualTime, targetTime, 9.5, dt)

    // 2. Compute continuous solar elevation angle (06:00 = sunrise horizon, 12:00 = zenith, 18:00 = sunset horizon, 00:00 = nadir)
    const cycle = ((s.visualTime - 6) / 24) * Math.PI * 2
    const sinElevation = Math.sin(cycle)
    const cosAzimuth = Math.cos(cycle)

    // Continuous smoothstep curves for daylight and golden-hour twilight
    const baseDaylight = THREE.MathUtils.smoothstep(sinElevation, -0.22, 0.48)
    const zenithBoost = Math.max(0, sinElevation)
    const targetDaylight = baseDaylight * 0.82 + zenithBoost * 0.18
    // Twilight peaks smoothly when the sun is near the horizon (sinElevation around 0)
    const horizonProximity = 1 - Math.min(1, Math.abs(sinElevation - 0.04) / 0.38)
    const targetTwilight = horizonProximity * horizonProximity * (3 - 2 * horizonProximity)

    const envFactor = immediate ? 1 : 1 - Math.exp(-8.5 * dt)
    s.daylight = THREE.MathUtils.lerp(s.daylight, targetDaylight, envFactor)
    s.twilight = THREE.MathUtils.lerp(s.twilight, targetTwilight, envFactor)

    // 3. Smooth orbital positions for Sun and Moon
    // Use a soft C1 smooth-max above horizon for shadow-casting stability so elevation never kinks
    const smoothPositiveSin = 0.5 * (sinElevation + Math.sqrt(sinElevation * sinElevation + 0.04))
    const smoothNegativeSin = 0.5 * (-sinElevation + Math.sqrt(sinElevation * sinElevation + 0.04))

    const sunZ = -28 - Math.sin(cycle * 0.5) * 8
    const moonZ = -28 + Math.sin(cycle * 0.5) * 8

    _targetSunPos.set(cosAzimuth * 52, 8 + smoothPositiveSin * 58, sunZ)
    _targetMoonPos.set(-cosAzimuth * 48, 10 + smoothNegativeSin * 46, moonZ)

    // Blend directional key light smoothly between sun position in daytime and moon position at night
    const moonWeight = THREE.MathUtils.smoothstep(-sinElevation, 0.05, 0.35)
    _targetKeyPos.copy(_targetSunPos).lerp(_targetMoonPos, moonWeight)

    _targetSunDisc.set(cosAzimuth * 115, sinElevation * 115, -95)
    _targetMoonDisc.set(-cosAzimuth * 115, -sinElevation * 115, -95)

    if (immediate) {
      s.sunPosition.copy(_targetSunPos)
      s.moonPosition.copy(_targetMoonPos)
      s.keyLightPosition.copy(_targetKeyPos)
      s.sunDiscPosition.copy(_targetSunDisc)
      s.moonDiscPosition.copy(_targetMoonDisc)
    } else {
      const posFactor = 1 - Math.exp(-10 * dt)
      s.sunPosition.lerp(_targetSunPos, posFactor)
      s.moonPosition.lerp(_targetMoonPos, posFactor)
      s.keyLightPosition.lerp(_targetKeyPos, posFactor)
      s.sunDiscPosition.lerp(_targetSunDisc, posFactor)
      s.moonDiscPosition.lerp(_targetMoonDisc, posFactor)
    }

    // Smooth horizon scale fade for sun and moon discs instead of abrupt visibility toggling
    const targetSunScale = THREE.MathUtils.smoothstep(sinElevation, -0.18, 0.06)
    const targetMoonScale = THREE.MathUtils.smoothstep(-sinElevation, -0.18, 0.06)
    s.sunScale = THREE.MathUtils.lerp(s.sunScale, targetSunScale, envFactor)
    s.moonScale = THREE.MathUtils.lerp(s.moonScale, targetMoonScale, envFactor)

    // 4. Smoothly interpolate intensities & fog distance
    const targetSunIntensity = 0.22 + s.daylight * 2.28
    const targetHemiIntensity = 0.42 + s.daylight * 0.85
    const targetEmissive = 0.12 + (1 - s.daylight) * 1.65
    const targetFogFar = 140 + s.daylight * 65

    s.sunIntensity = THREE.MathUtils.lerp(s.sunIntensity, targetSunIntensity, envFactor)
    s.hemiIntensity = THREE.MathUtils.lerp(s.hemiIntensity, targetHemiIntensity, envFactor)
    s.emissiveIntensity = THREE.MathUtils.lerp(s.emissiveIntensity, targetEmissive, envFactor)
    s.fogFar = THREE.MathUtils.lerp(s.fogFar, targetFogFar, envFactor)

    // 5. Multi-stop continuous color interpolation (Night -> Twilight -> Day) with zero GC
    _tempColor.copy(SKY_NIGHT).lerp(SKY_DAY, s.daylight).lerp(SKY_TWILIGHT, s.twilight * 0.55)
    s.skyColor.lerp(_tempColor, envFactor)

    const noonBlend = THREE.MathUtils.smoothstep(s.daylight, 0.25, 0.92)
    _tempColor.copy(SUN_NIGHT).lerp(SUN_GOLDEN, THREE.MathUtils.smoothstep(s.daylight, 0.02, 0.45)).lerp(SUN_NOON, noonBlend)
    s.sunColor.lerp(_tempColor, envFactor)

    _tempColor.copy(HEMI_SKY_NIGHT).lerp(HEMI_SKY_DAY, s.daylight).lerp(HEMI_SKY_TWILIGHT, s.twilight * 0.45)
    s.hemiSkyColor.lerp(_tempColor, envFactor)

    _tempColor.copy(HEMI_GROUND_NIGHT).lerp(HEMI_GROUND_DAY, s.daylight).lerp(HEMI_GROUND_TWILIGHT, s.twilight * 0.35)
    s.hemiGroundColor.lerp(_tempColor, envFactor)

    return s
  }
}
