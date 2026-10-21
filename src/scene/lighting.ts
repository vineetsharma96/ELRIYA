import * as THREE from 'three'
import type { WeatherCondition } from '../core/types'

export interface WeatherLightingInput {
  condition?: WeatherCondition
  cloudCover: number
  rainIntensity: number
}

export interface EnvironmentLightingSnapshot {
  visualTime: number
  daylight: number
  twilight: number
  weatherCondition: WeatherCondition
  cloudCover: number
  rainIntensity: number
  streetLampIntensity: number
  streetLampActive: boolean
  sunIntensity: number
  hemiIntensity: number
  emissiveIntensity: number
  fogNear: number
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

/**
 * Computes the automatic dusk-to-sunrise street lamp activation schedule.
 * Street lamps activate automatically as night falls (17:30 -> 18:30), remain at full
 * warm output all night (18:30 -> 05:30), and turn off at sunrise (05:30 -> 06:30).
 */
export function computeStreetLampSchedule(hours: number): { active: boolean; intensity: number } {
  const h = ((hours % 24) + 24) % 24
  let intensity = 0
  if (h >= 18.5 || h <= 5.5) {
    intensity = 1
  } else if (h > 17.5 && h < 18.5) {
    intensity = THREE.MathUtils.smoothstep(h, 17.5, 18.5)
  } else if (h > 5.5 && h < 6.5) {
    intensity = 1 - THREE.MathUtils.smoothstep(h, 5.5, 6.5)
  } else {
    intensity = 0
  }
  return {
    active: intensity > 0.01,
    intensity: Number(intensity.toFixed(4)),
  }
}

// Pre-allocated clear-sky palette stops (Zero GC allocations during per-frame updates)
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

// Pre-allocated overcast & light-rain atmospheric palette stops
const SKY_OVERCAST_DAY = new THREE.Color('#a8babf')
const SKY_RAIN_DAY = new THREE.Color('#8a9eab')
const SKY_OVERCAST_NIGHT = new THREE.Color('#1f2942')

const SUN_OVERCAST_DAY = new THREE.Color('#dce5eb')
const HEMI_SKY_OVERCAST_DAY = new THREE.Color('#b6c7cf')
const HEMI_SKY_RAIN_DAY = new THREE.Color('#95aab8')
const HEMI_GROUND_WET_DAY = new THREE.Color('#748779')
const HEMI_GROUND_WET_NIGHT = new THREE.Color('#313f39')

const _tempColor = new THREE.Color()
const _weatherColor = new THREE.Color()
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
      weatherCondition: 'sunny',
      cloudCover: 0,
      rainIntensity: 0,
      streetLampIntensity: 0,
      streetLampActive: false,
      sunIntensity: 2.4,
      hemiIntensity: 1.25,
      emissiveIntensity: 0.12,
      fogNear: 65,
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

  update(
    targetTime: number,
    deltaSeconds: number,
    immediate = false,
    weather?: WeatherLightingInput
  ): EnvironmentLightingSnapshot {
    const dt = immediate ? 1 : Math.min(Math.max(deltaSeconds, 0.001), 0.1)
    const s = this.state

    // 1. Smoothly damp visual time toward target snapshot time (handles both continuous flow and UI slider jumps)
    s.visualTime = immediate ? ((targetTime % 24) + 24) % 24 : dampTimeOfDay(s.visualTime, targetTime, 9.5, dt)

    // 2. Smoothly damp weather cloudCover & rainIntensity
    const targetCloud = weather ? THREE.MathUtils.clamp(weather.cloudCover, 0, 1) : 0
    const targetRain = weather ? THREE.MathUtils.clamp(weather.rainIntensity, 0, 1) : 0
    const weatherFactor = immediate ? 1 : 1 - Math.exp(-4.5 * dt)
    s.cloudCover = THREE.MathUtils.lerp(s.cloudCover, targetCloud, weatherFactor)
    s.rainIntensity = THREE.MathUtils.lerp(s.rainIntensity, targetRain, weatherFactor)
    if (weather?.condition) {
      s.weatherCondition = weather.condition
    } else if (s.rainIntensity >= 0.35) {
      s.weatherCondition = 'light_rain'
    } else if (s.cloudCover >= 0.35) {
      s.weatherCondition = 'overcast'
    } else {
      s.weatherCondition = 'sunny'
    }

    // 3. Compute continuous solar elevation angle (06:00 = sunrise horizon, 12:00 = zenith, 18:00 = sunset horizon, 00:00 = nadir)
    const cycle = ((s.visualTime - 6) / 24) * Math.PI * 2
    const sinElevation = Math.sin(cycle)
    const cosAzimuth = Math.cos(cycle)

    // Continuous smoothstep curves for daylight and golden-hour twilight
    const baseDaylight = THREE.MathUtils.smoothstep(sinElevation, -0.22, 0.48)
    const zenithBoost = Math.max(0, sinElevation)
    const targetDaylight = baseDaylight * 0.82 + zenithBoost * 0.18
    // Twilight peaks smoothly when the sun is near the horizon, muted under heavy overcast/rain
    const horizonProximity = 1 - Math.min(1, Math.abs(sinElevation - 0.04) / 0.38)
    const rawTwilight = horizonProximity * horizonProximity * (3 - 2 * horizonProximity)
    const targetTwilight = rawTwilight * (1 - s.cloudCover * 0.55 - s.rainIntensity * 0.25)

    const envFactor = immediate ? 1 : 1 - Math.exp(-8.5 * dt)
    s.daylight = THREE.MathUtils.lerp(s.daylight, targetDaylight, envFactor)
    s.twilight = THREE.MathUtils.lerp(s.twilight, targetTwilight, envFactor)

    // 4. Smooth orbital positions for Sun and Moon
    const smoothPositiveSin = 0.5 * (sinElevation + Math.sqrt(sinElevation * sinElevation + 0.04))
    const smoothNegativeSin = 0.5 * (-sinElevation + Math.sqrt(sinElevation * sinElevation + 0.04))

    const sunZ = -28 - Math.sin(cycle * 0.5) * 8
    const moonZ = -28 + Math.sin(cycle * 0.5) * 8

    _targetSunPos.set(cosAzimuth * 52, 8 + smoothPositiveSin * 58, sunZ)
    _targetMoonPos.set(-cosAzimuth * 48, 10 + smoothNegativeSin * 46, moonZ)

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

    // Cloud deck veils the celestial discs smoothly during overcast and light rain
    const discVeil = Math.max(0.08, 1 - s.cloudCover * 0.65 - s.rainIntensity * 0.25)
    const targetSunScale = THREE.MathUtils.smoothstep(sinElevation, -0.18, 0.06) * discVeil
    const targetMoonScale = THREE.MathUtils.smoothstep(-sinElevation, -0.18, 0.06) * discVeil
    s.sunScale = THREE.MathUtils.lerp(s.sunScale, targetSunScale, envFactor)
    s.moonScale = THREE.MathUtils.lerp(s.moonScale, targetMoonScale, envFactor)

    // 5. Smoothly interpolate intensities & fog distance with weather modulation
    const clearSunIntensity = 0.22 + s.daylight * 2.28
    const weatherSunAttenuation = Math.max(0.28, 1 - s.cloudCover * 0.48 - s.rainIntensity * 0.22)
    const targetSunIntensity = clearSunIntensity * weatherSunAttenuation

    const clearHemiIntensity = 0.42 + s.daylight * 0.85
    const weatherHemiAttenuation = 1 - s.cloudCover * 0.12 - s.rainIntensity * 0.14
    const targetHemiIntensity = clearHemiIntensity * weatherHemiAttenuation

    // Cozy interior windows and streetlamps glow warmly during overcast & rainy daytime
    const clearEmissive = 0.12 + (1 - s.daylight) * 1.65
    const rainyDayGlow = s.daylight * (s.cloudCover * 0.38 + s.rainIntensity * 0.48)
    const targetEmissive = Math.min(1.85, clearEmissive + rainyDayGlow)

    const lampSchedule = computeStreetLampSchedule(s.visualTime)
    s.streetLampIntensity = immediate
      ? lampSchedule.intensity
      : THREE.MathUtils.lerp(s.streetLampIntensity, lampSchedule.intensity, envFactor)
    if (s.streetLampIntensity < 0.005 && lampSchedule.intensity === 0) {
      s.streetLampIntensity = 0
    }
    s.streetLampActive = s.streetLampIntensity > 0.01

    const targetFogNear = 65 - s.cloudCover * 16 - s.rainIntensity * 12
    const clearFogFar = 140 + s.daylight * 65
    const targetFogFar = clearFogFar * (1 - s.cloudCover * 0.22 - s.rainIntensity * 0.16)

    s.sunIntensity = THREE.MathUtils.lerp(s.sunIntensity, targetSunIntensity, envFactor)
    s.hemiIntensity = THREE.MathUtils.lerp(s.hemiIntensity, targetHemiIntensity, envFactor)
    s.emissiveIntensity = THREE.MathUtils.lerp(s.emissiveIntensity, targetEmissive, envFactor)
    s.fogNear = THREE.MathUtils.lerp(s.fogNear, targetFogNear, envFactor)
    s.fogFar = THREE.MathUtils.lerp(s.fogFar, targetFogFar, envFactor)

    // 6. Multi-stop continuous color interpolation (Night -> Twilight -> Day -> Overcast/Rain) with zero GC
    _tempColor.copy(SKY_NIGHT).lerp(SKY_DAY, s.daylight).lerp(SKY_TWILIGHT, s.twilight * 0.55)
    if (s.cloudCover > 0.001 || s.rainIntensity > 0.001) {
      _weatherColor.copy(SKY_OVERCAST_NIGHT).lerp(SKY_OVERCAST_DAY, s.daylight).lerp(SKY_RAIN_DAY, s.rainIntensity * s.daylight)
      _tempColor.lerp(_weatherColor, Math.min(1, s.cloudCover * 0.75 + s.rainIntensity * 0.25))
    }
    s.skyColor.lerp(_tempColor, envFactor)

    const noonBlend = THREE.MathUtils.smoothstep(s.daylight, 0.25, 0.92)
    _tempColor.copy(SUN_NIGHT).lerp(SUN_GOLDEN, THREE.MathUtils.smoothstep(s.daylight, 0.02, 0.45)).lerp(SUN_NOON, noonBlend)
    if (s.cloudCover > 0.001) {
      _tempColor.lerp(SUN_OVERCAST_DAY, s.cloudCover * 0.6 * s.daylight)
    }
    s.sunColor.lerp(_tempColor, envFactor)

    _tempColor.copy(HEMI_SKY_NIGHT).lerp(HEMI_SKY_DAY, s.daylight).lerp(HEMI_SKY_TWILIGHT, s.twilight * 0.45)
    if (s.cloudCover > 0.001 || s.rainIntensity > 0.001) {
      _weatherColor.copy(HEMI_SKY_NIGHT).lerp(HEMI_SKY_OVERCAST_DAY, s.daylight).lerp(HEMI_SKY_RAIN_DAY, s.rainIntensity * s.daylight)
      _tempColor.lerp(_weatherColor, Math.min(1, s.cloudCover * 0.72 + s.rainIntensity * 0.28))
    }
    s.hemiSkyColor.lerp(_tempColor, envFactor)

    _tempColor.copy(HEMI_GROUND_NIGHT).lerp(HEMI_GROUND_DAY, s.daylight).lerp(HEMI_GROUND_TWILIGHT, s.twilight * 0.35)
    if (s.cloudCover > 0.001 || s.rainIntensity > 0.001) {
      _weatherColor.copy(HEMI_GROUND_WET_NIGHT).lerp(HEMI_GROUND_WET_DAY, s.daylight)
      _tempColor.lerp(_weatherColor, Math.min(1, s.cloudCover * 0.65 + s.rainIntensity * 0.35))
    }
    s.hemiGroundColor.lerp(_tempColor, envFactor)

    return s
  }
}
