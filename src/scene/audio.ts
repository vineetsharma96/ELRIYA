import type { Point2, WeatherCondition } from '../core/types'
import { WORLD } from '../core/world'

export interface BlossomTreeCluster {
  id: string
  x: number
  y: number
  z: number
  radius: number
  treeCount: number
  trees: (Point2 & { scale: number })[]
}

export interface SpatialBirdState {
  activeCluster: BlossomTreeCluster | null
  nearbyClusters: { cluster: BlossomTreeCluster; distance: number; weight: number }[]
  intensity: number
  nearestDistance: number
}

export interface WeatherAudioMix {
  condition: WeatherCondition
  label: string
  breezeGain: number
  breezeFrequency: number
  chimeActivity: number
  chimeIntervalMin: number
  chimeIntervalMax: number
  rainBedGain: number
  rainPatterRate: number
  birdActivityScale: number
}

/**
 * Computes the reactive audio mix parameters for the current weather condition,
 * cloud cover, rain intensity, and wind strength.
 */
export function evaluateWeatherAudioMix(
  weather: WeatherCondition = 'sunny',
  cloudCover = 0,
  rainIntensity = 0,
  windStrength = 0.6
): WeatherAudioMix {
  const clampedWind = Math.max(0, Math.min(2, Number.isFinite(windStrength) ? windStrength : 0.6))
  const clampedCloud = Math.max(0, Math.min(1, Number.isFinite(cloudCover) ? cloudCover : 0))
  const clampedRain = Math.max(0, Math.min(1, Number.isFinite(rainIntensity) ? rainIntensity : 0))

  // Smooth transition weights based on discrete condition & continuous interpolation values
  const effectiveRain = weather === 'light_rain' ? Math.max(0.35, clampedRain) : clampedRain
  const effectiveCloud =
    weather === 'overcast'
      ? Math.max(0.55, clampedCloud)
      : weather === 'light_rain'
        ? Math.max(0.85, clampedCloud)
        : clampedCloud

  // Wind chimes are brightest when clear/sunny, softer when overcast, and muted in rain
  const clearFactor = Math.max(0, 1 - effectiveRain * 1.15 - effectiveCloud * 0.45)
  const chimeActivity = Number(
    Math.min(1, clearFactor * (0.45 + clampedWind * 0.35)).toFixed(3)
  )

  // Gentle breeze bed deepens under overcast skies and swells with wind
  const breezeGain = Number(
    (0.08 + clampedWind * 0.035 + effectiveCloud * 0.03 - effectiveRain * 0.02).toFixed(3)
  )
  const breezeFrequency = Math.round(
    480 + clampedWind * 240 + effectiveCloud * 90 - effectiveRain * 110
  )

  // Rain shower bed & individual raindrop patters scale with rainIntensity
  const rainBedGain = Number((effectiveRain * 0.14).toFixed(3))
  const rainPatterRate = Number((effectiveRain * (7 + clampedWind * 3)).toFixed(2))

  // Birds sing actively in clear weather, moderately in overcast, and shelter during rain
  const birdActivityScale = Number(
    Math.max(0.08, 1 - effectiveRain * 0.78 - effectiveCloud * 0.2).toFixed(3)
  )

  const chimeIntervalMin = 1.4
  const chimeIntervalMax = 5.2

  const label =
    weather === 'light_rain' || effectiveRain > 0.35
      ? 'Gentle rainfall & raindrops'
      : weather === 'overcast' || effectiveCloud > 0.5
        ? 'Soft overcast breeze & distant chimes'
        : 'Clear sky wind chimes & birdsong'

  return {
    condition: weather,
    label,
    breezeGain,
    breezeFrequency,
    chimeActivity,
    chimeIntervalMin,
    chimeIntervalMax,
    rainBedGain,
    rainPatterRate,
    birdActivityScale,
  }
}

/**
 * Deterministic spatial clustering of cherry blossom trees to identify dense canopy groves.
 */
export function computeBlossomClusters(
  trees: (Point2 & { scale: number })[] = WORLD.trees,
  neighborhoodRadius = 9.5,
  minTrees = 3
): BlossomTreeCluster[] {
  const assigned = new Uint8Array(trees.length)
  const clusters: BlossomTreeCluster[] = []

  const cellSize = neighborhoodRadius
  const grid = new Map<string, number[]>()

  const getCellKey = (x: number, z: number) => {
    return `${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`
  }

  for (let i = 0; i < trees.length; i++) {
    const key = getCellKey(trees[i].x, trees[i].z)
    if (!grid.has(key)) {
      grid.set(key, [])
    }
    grid.get(key)!.push(i)
  }

  const counts = new Uint16Array(trees.length)
  for (let i = 0; i < trees.length; i++) {
    const ti = trees[i]
    counts[i]++ // self

    const cx = Math.floor(ti.x / cellSize)
    const cz = Math.floor(ti.z / cellSize)

    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        const key = `${cx + ox},${cz + oz}`
        const cell = grid.get(key)
        if (cell) {
          for (let k = 0; k < cell.length; k++) {
            const j = cell[k]
            if (j > i) {
              const tj = trees[j]
              const dx = ti.x - tj.x
              if (Math.abs(dx) > neighborhoodRadius) continue
              const dz = ti.z - tj.z
              if (Math.abs(dz) > neighborhoodRadius) continue

              if (Math.hypot(dx, dz) <= neighborhoodRadius) {
                counts[i]++
                counts[j]++
              }
            }
          }
        }
      }
    }
  }

  // Sort candidate seeds by local neighbor count (densest groves first)
  const neighborCounts = Array.from(counts, (count, idx) => ({ idx, count }))
  neighborCounts.sort((a, b) => b.count - a.count)

  for (const { idx } of neighborCounts) {
    if (assigned[idx]) continue
    const seed = trees[idx]

    const cx = Math.floor(seed.x / cellSize)
    const cz = Math.floor(seed.z / cellSize)

    const candidateIndices: number[] = []
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        const key = `${cx + ox},${cz + oz}`
        const cell = grid.get(key)
        if (cell) {
          for (let k = 0; k < cell.length; k++) {
            candidateIndices.push(cell[k])
          }
        }
      }
    }
    // Sorting maintains the original array processing order for exact reproducibility
    candidateIndices.sort((a, b) => a - b)

    const members: (Point2 & { scale: number })[] = []
    for (let k = 0; k < candidateIndices.length; k++) {
      const j = candidateIndices[k]
      if (assigned[j]) continue
      const tj = trees[j]
      const dx = seed.x - tj.x
      if (Math.abs(dx) > neighborhoodRadius) continue
      const dz = seed.z - tj.z
      if (Math.abs(dz) > neighborhoodRadius) continue

      if (Math.hypot(dx, dz) <= neighborhoodRadius) {
        members.push(tj)
      }
    }

    if (members.length < minTrees) continue

    for (let k = 0; k < candidateIndices.length; k++) {
      const j = candidateIndices[k]
      const tj = trees[j]
      const dx = seed.x - tj.x
      if (Math.abs(dx) > neighborhoodRadius) continue
      const dz = seed.z - tj.z
      if (Math.abs(dz) > neighborhoodRadius) continue
      if (Math.hypot(dx, dz) <= neighborhoodRadius) {
        assigned[j] = 1
      }
    }

    const cxMean = members.reduce((sum, m) => sum + m.x, 0) / members.length
    const czMean = members.reduce((sum, m) => sum + m.z, 0) / members.length
    const maxSpread = members.reduce((max, m) => Math.max(max, Math.hypot(m.x - cxMean, m.z - czMean)), 4)

    clusters.push({
      id: `blossom-grove-${clusters.length + 1}`,
      x: Number(cxMean.toFixed(2)),
      y: 3.6,
      z: Number(czMean.toFixed(2)),
      radius: Number(Math.max(12, maxSpread + 8).toFixed(2)),
      treeCount: members.length,
      trees: members,
    })
  }

  return clusters
}

export const BLOSSOM_CLUSTERS: BlossomTreeCluster[] = computeBlossomClusters()

/**
 * Evaluates listener proximity to dense cherry blossom tree clusters.
 */
export function evaluateSpatialBirdState(
  listenerPos: Point2,
  clusters: BlossomTreeCluster[] = BLOSSOM_CLUSTERS
): SpatialBirdState {
  const nearby: { cluster: BlossomTreeCluster; distance: number; weight: number }[] = []
  let nearestDistance = Infinity
  let activeCluster: BlossomTreeCluster | null = null
  let bestWeight = 0

  for (const cluster of clusters) {
    const distance = Math.hypot(listenerPos.x - cluster.x, listenerPos.z - cluster.z)
    if (distance < nearestDistance) {
      nearestDistance = distance
    }
    if (distance <= cluster.radius) {
      const normalizedDist = 1 - distance / cluster.radius
      // Smooth falloff weighted by cluster tree density
      const smoothFalloff = normalizedDist * normalizedDist * (3 - 2 * normalizedDist)
      const densityBoost = Math.min(1.35, 0.75 + cluster.treeCount * 0.08)
      const weight = Math.min(1, smoothFalloff * densityBoost)
      nearby.push({ cluster, distance, weight })
      if (weight > bestWeight) {
        bestWeight = weight
        activeCluster = cluster
      }
    }
  }

  nearby.sort((a, b) => b.weight - a.weight)
  const combinedIntensity = Math.min(
    1,
    bestWeight + nearby.slice(1).reduce((sum, item) => sum + item.weight * 0.35, 0)
  )

  return {
    activeCluster,
    nearbyClusters: nearby,
    intensity: combinedIntensity,
    nearestDistance,
  }
}

export interface ListenerTransform {
  x: number
  y: number
  z: number
  forwardX: number
  forwardY: number
  forwardZ: number
}

export interface WeatherAudioInput {
  condition: WeatherCondition
  cloudCover: number
  rainIntensity: number
}

// Pentatonic wind chime scale (Furin-inspired crystalline frequencies in Hz)
const CHIME_SCALE_HZ = [1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0, 2349.32, 2637.02]

/**
 * Locally synthesized 3D spatial ambience, dynamic weather soundscape (rain shower,
 * droplets, clear-sky wind chimes, overcast breeze), & localized cherry-blossom birdsong.
 * Uses Web Audio API PannerNode (HRTF) + AudioListener without external network audio.
 */
export class Ambience {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private windFilter: BiquadFilterNode | null = null
  private windGain: GainNode | null = null
  private rainFilter: BiquadFilterNode | null = null
  private rainGain: GainNode | null = null
  private nextChirpCooldown = 0.6
  private chirpIndex = 0
  private nextChimeCooldown = 1.1
  private chimeIndex = 0
  private nextDropCooldown = 0.12
  private dropIndex = 0
  private lastSpatialState: SpatialBirdState = {
    activeCluster: null,
    nearbyClusters: [],
    intensity: 0,
    nearestDistance: Infinity,
  }
  private lastWeatherMix: WeatherAudioMix = evaluateWeatherAudioMix('sunny', 0, 0, 0.6)

  async start() {
    if (this.context) {
      await this.context.resume()
      return
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const context = new AudioCtx()
    this.context = context

    const masterGain = context.createGain()
    masterGain.gain.value = 0.12
    masterGain.connect(context.destination)
    this.masterGain = masterGain

    // 1. Gentle filtered breeze bed (brown noise)
    const windBuffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate)
    const windData = windBuffer.getChannelData(0)
    let brown = 0
    for (let i = 0; i < windData.length; i++) {
      brown = (brown + (Math.random() * 2 - 1) * 0.02) / 1.02
      windData[i] = brown * 2.6
    }
    const windNoise = context.createBufferSource()
    windNoise.buffer = windBuffer
    windNoise.loop = true
    const windFilter = context.createBiquadFilter()
    windFilter.type = 'lowpass'
    windFilter.frequency.value = 680
    this.windFilter = windFilter

    const windGain = context.createGain()
    windGain.gain.value = 0.1
    this.windGain = windGain

    windNoise.connect(windFilter).connect(windGain).connect(masterGain)
    windNoise.start()

    // 2. Continuous rain shower bed (pink/whiteband filtered noise)
    const rainBuffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate)
    const rainData = rainBuffer.getChannelData(0)
    let b0 = 0
    let b1 = 0
    let b2 = 0
    for (let i = 0; i < rainData.length; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99765 * b0 + white * 0.099046
      b1 = 0.963 * b1 + white * 0.2965164
      b2 = 0.57 * b2 + white * 1.0526913
      rainData[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12
    }
    const rainNoise = context.createBufferSource()
    rainNoise.buffer = rainBuffer
    rainNoise.loop = true

    const rainBandpass = context.createBiquadFilter()
    rainBandpass.type = 'bandpass'
    rainBandpass.frequency.value = 1350
    rainBandpass.Q.value = 0.7
    this.rainFilter = rainBandpass

    const rainGain = context.createGain()
    rainGain.gain.value = 0.0001
    this.rainGain = rainGain

    rainNoise.connect(rainBandpass).connect(rainGain).connect(masterGain)
    rainNoise.start()

    await context.resume()
  }

  /**
   * Updates 3D AudioListener pose, reactive weather audio layers (rain shower, droplets,
   * wind chimes, overcast breeze), and localized 3D bird chirps from nearby blossom groves.
   */
  updateSpatial(
    listener: ListenerTransform,
    daylight: number,
    windStrength: number,
    deltaSeconds: number,
    weatherInput?: WeatherAudioInput
  ): SpatialBirdState {
    const spatial = evaluateSpatialBirdState({ x: listener.x, z: listener.z })
    this.lastSpatialState = spatial

    const weatherMix = evaluateWeatherAudioMix(
      weatherInput?.condition ?? 'sunny',
      weatherInput?.cloudCover ?? 0,
      weatherInput?.rainIntensity ?? 0,
      windStrength
    )
    this.lastWeatherMix = weatherMix

    const context = this.context
    if (!context || context.state !== 'running' || !this.masterGain) {
      return spatial
    }

    const now = context.currentTime

    // 1. Update Web Audio 3D Listener position and orientation
    const audioListener = context.listener
    if (audioListener.positionX) {
      audioListener.positionX.setTargetAtTime(listener.x, now, 0.03)
      audioListener.positionY.setTargetAtTime(listener.y, now, 0.03)
      audioListener.positionZ.setTargetAtTime(listener.z, now, 0.03)
      audioListener.forwardX.setTargetAtTime(listener.forwardX, now, 0.03)
      audioListener.forwardY.setTargetAtTime(listener.forwardY, now, 0.03)
      audioListener.forwardZ.setTargetAtTime(listener.forwardZ, now, 0.03)
      audioListener.upX.setTargetAtTime(0, now, 0.03)
      audioListener.upY.setTargetAtTime(1, now, 0.03)
      audioListener.upZ.setTargetAtTime(0, now, 0.03)
    } else {
      audioListener.setPosition(listener.x, listener.y, listener.z)
      audioListener.setOrientation(listener.forwardX, listener.forwardY, listener.forwardZ, 0, 1, 0)
    }

    // 2. Modulate breeze and rain beds according to current weather mix
    if (this.windFilter) {
      this.windFilter.frequency.setTargetAtTime(weatherMix.breezeFrequency, now, 0.12)
    }
    if (this.windGain) {
      this.windGain.gain.setTargetAtTime(weatherMix.breezeGain, now, 0.18)
    }
    if (this.rainGain) {
      this.rainGain.gain.setTargetAtTime(weatherMix.rainBedGain, now, 0.2)
    }
    if (this.rainFilter) {
      this.rainFilter.frequency.setTargetAtTime(1150 + windStrength * 260, now, 0.2)
    }

    // 3. Schedule gentle raindrop patters during light_rain
    if (weatherMix.rainPatterRate > 0.4) {
      this.nextDropCooldown -= deltaSeconds
      if (this.nextDropCooldown <= 0) {
        const angle = (this.dropIndex * 2.39996) % (Math.PI * 2)
        const dist = 1.5 + ((this.dropIndex * 1.7) % 6.5)
        const dropX = listener.x + Math.cos(angle) * dist
        const dropY = 0.2 + ((this.dropIndex * 0.43) % 1.8)
        const dropZ = listener.z + Math.sin(angle) * dist
        this.triggerLocalizedRaindrop(dropX, dropY, dropZ, weatherMix.rainBedGain * 4.5, this.dropIndex)
        this.dropIndex++
        const baseInterval = 1 / Math.max(1, weatherMix.rainPatterRate)
        this.nextDropCooldown = baseInterval * (0.55 + Math.random() * 0.9)
      }
    } else {
      this.nextDropCooldown = Math.min(this.nextDropCooldown, 0.15)
    }

    // 4. Schedule delicate wind chimes when clear / sunny (and occasionally in light overcast breeze)
    if (weatherMix.chimeActivity > 0.06) {
      this.nextChimeCooldown -= deltaSeconds
      if (this.nextChimeCooldown <= 0) {
        // Anchor wind chime near the closest blossom grove or plaza pergola
        const anchor = spatial.activeCluster ?? BLOSSOM_CLUSTERS[this.chimeIndex % Math.max(1, BLOSSOM_CLUSTERS.length)]
        const chimeX = anchor ? anchor.x : listener.x + Math.sin(this.chimeIndex * 1.9) * 6
        const chimeY = 2.9
        const chimeZ = anchor ? anchor.z : listener.z + Math.cos(this.chimeIndex * 1.9) * 6
        this.triggerWindChime(chimeX, chimeY, chimeZ, weatherMix.chimeActivity, this.chimeIndex)
        this.chimeIndex++

        const span = weatherMix.chimeIntervalMax - weatherMix.chimeIntervalMin
        const interval = weatherMix.chimeIntervalMax - span * Math.min(1, weatherMix.chimeActivity)
        this.nextChimeCooldown = interval * (0.75 + Math.random() * 0.55)
      }
    } else {
      this.nextChimeCooldown = Math.min(this.nextChimeCooldown, 0.5)
    }

    // 5. Schedule localized 3D bird chirps when near dense cherry blossom clusters
    const dayActivity = (0.25 + daylight * 0.75) * weatherMix.birdActivityScale
    const effectiveIntensity = spatial.intensity * dayActivity

    if (effectiveIntensity > 0.04 && spatial.nearbyClusters.length > 0) {
      this.nextChirpCooldown -= deltaSeconds
      if (this.nextChirpCooldown <= 0) {
        const chosenEntry =
          spatial.nearbyClusters[this.chirpIndex % Math.min(2, spatial.nearbyClusters.length)]
        const cluster = chosenEntry.cluster
        const tree = cluster.trees[this.chirpIndex % cluster.trees.length]
        const canopyX = tree.x + Math.sin(this.chirpIndex * 1.7) * 0.6
        const canopyY = 3.2 + (tree.scale ?? 1) * 0.8
        const canopyZ = tree.z + Math.cos(this.chirpIndex * 2.3) * 0.6

        this.triggerLocalizedChirp(
          canopyX,
          canopyY,
          canopyZ,
          chosenEntry.weight * dayActivity,
          this.chirpIndex
        )
        this.chirpIndex++

        const minInterval = 0.65
        const maxInterval = 2.6
        const interval =
          maxInterval - (maxInterval - minInterval) * Math.min(1, effectiveIntensity)
        this.nextChirpCooldown = interval * (0.75 + Math.random() * 0.5)
      }
    } else {
      this.nextChirpCooldown = Math.min(this.nextChirpCooldown, 0.35)
    }

    return spatial
  }

  /**
   * Synthesizes a crystalline Japanese Furin wind chime phrase at 3D coordinates (x, y, z).
   */
  private triggerWindChime(
    x: number,
    y: number,
    z: number,
    activity: number,
    seed: number
  ) {
    const context = this.context
    const masterGain = this.masterGain
    if (!context || !masterGain) return

    const panner = context.createPanner()
    try {
      panner.panningModel = 'HRTF'
    } catch {
      panner.panningModel = 'equalpower'
    }
    panner.distanceModel = 'inverse'
    panner.refDistance = 4.5
    panner.maxDistance = 36
    panner.rolloffFactor = 1.1

    const now = context.currentTime
    if (panner.positionX) {
      panner.positionX.setValueAtTime(x, now)
      panner.positionY.setValueAtTime(y, now)
      panner.positionZ.setValueAtTime(z, now)
    } else {
      panner.setPosition(x, y, z)
    }
    panner.connect(masterGain)

    // 1 to 3 delicate pentatonic bell strikes per breeze gust
    const strikeCount = 1 + (seed % 3)
    const peakGain = Math.min(0.42, Math.max(0.1, activity * 0.38))

    for (let i = 0; i < strikeCount; i++) {
      const strikeStart = now + i * (0.18 + ((seed + i) % 3) * 0.07)
      const strikeDur = 1.25 + (i % 2) * 0.35
      const fundamental = CHIME_SCALE_HZ[(seed * 3 + i * 2) % CHIME_SCALE_HZ.length]

      const primary = context.createOscillator()
      const overtone = context.createOscillator()
      const overtoneGain = context.createGain()
      const envelope = context.createGain()

      primary.type = 'sine'
      overtone.type = 'sine'

      // Metallic glass bell partial ratio (~2.756x fundamental)
      primary.frequency.setValueAtTime(fundamental, strikeStart)
      overtone.frequency.setValueAtTime(fundamental * 2.756, strikeStart)

      overtoneGain.gain.setValueAtTime(0.22, strikeStart)
      overtoneGain.gain.exponentialRampToValueAtTime(0.001, strikeStart + strikeDur * 0.45)

      envelope.gain.setValueAtTime(0.0001, strikeStart)
      envelope.gain.linearRampToValueAtTime(peakGain * (1 - i * 0.18), strikeStart + 0.012)
      envelope.gain.exponentialRampToValueAtTime(0.0001, strikeStart + strikeDur)

      primary.connect(envelope)
      overtone.connect(overtoneGain)
      overtoneGain.connect(envelope)
      envelope.connect(panner)

      primary.start(strikeStart)
      overtone.start(strikeStart)
      primary.stop(strikeStart + strikeDur + 0.02)
      overtone.stop(strikeStart + strikeDur + 0.02)

      primary.onended = () => {
        primary.disconnect()
        overtone.disconnect()
        overtoneGain.disconnect()
        envelope.disconnect()
        if (i === strikeCount - 1) {
          panner.disconnect()
        }
      }
    }
  }

  /**
   * Synthesizes a soft spatial raindrop plink on leaves/paving around the listener.
   */
  private triggerLocalizedRaindrop(
    x: number,
    y: number,
    z: number,
    gainScale: number,
    seed: number
  ) {
    const context = this.context
    const masterGain = this.masterGain
    if (!context || !masterGain) return

    const panner = context.createPanner()
    panner.panningModel = 'equalpower'
    panner.distanceModel = 'inverse'
    panner.refDistance = 2
    panner.maxDistance = 14
    panner.rolloffFactor = 1.6

    const now = context.currentTime
    if (panner.positionX) {
      panner.positionX.setValueAtTime(x, now)
      panner.positionY.setValueAtTime(y, now)
      panner.positionZ.setValueAtTime(z, now)
    } else {
      panner.setPosition(x, y, z)
    }
    panner.connect(masterGain)

    const dropOsc = context.createOscillator()
    const envelope = context.createGain()
    const startFreq = 750 + ((seed * 197) % 680)
    const endFreq = startFreq * 1.45
    const dur = 0.042

    dropOsc.type = 'sine'
    dropOsc.frequency.setValueAtTime(startFreq, now)
    dropOsc.frequency.exponentialRampToValueAtTime(endFreq, now + dur)

    const peak = Math.min(0.28, Math.max(0.04, gainScale * 0.25))
    envelope.gain.setValueAtTime(0.0001, now)
    envelope.gain.linearRampToValueAtTime(peak, now + 0.005)
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + dur)

    dropOsc.connect(envelope)
    envelope.connect(panner)

    dropOsc.start(now)
    dropOsc.stop(now + dur + 0.005)
    dropOsc.onended = () => {
      dropOsc.disconnect()
      envelope.disconnect()
      panner.disconnect()
    }
  }

  /**
   * Synthesizes a multi-note spatialized bird song at 3D world coordinates (x, y, z).
   */
  private triggerLocalizedChirp(
    x: number,
    y: number,
    z: number,
    proximityWeight: number,
    patternSeed: number
  ) {
    const context = this.context
    const masterGain = this.masterGain
    if (!context || !masterGain) return

    const panner = context.createPanner()
    try {
      panner.panningModel = 'HRTF'
    } catch {
      panner.panningModel = 'equalpower'
    }
    panner.distanceModel = 'inverse'
    panner.refDistance = 3.5
    panner.maxDistance = 24
    panner.rolloffFactor = 1.45

    const now = context.currentTime
    if (panner.positionX) {
      panner.positionX.setValueAtTime(x, now)
      panner.positionY.setValueAtTime(y, now)
      panner.positionZ.setValueAtTime(z, now)
    } else {
      panner.setPosition(x, y, z)
    }

    panner.connect(masterGain)

    // Choose between 3 natural songbird phrase patterns (double-note trill, rising warble, three-note sakura finch)
    const pattern = patternSeed % 3
    const notes = pattern === 0 ? 2 : pattern === 1 ? 3 : 2
    const baseFreq = 1950 + ((patternSeed * 173) % 550)
    const peakGain = Math.min(0.95, Math.max(0.18, proximityWeight * 0.85))

    let totalDuration = 0
    for (let n = 0; n < notes; n++) {
      const noteStart = now + n * 0.14
      const noteDur = pattern === 1 && n === 2 ? 0.2 : 0.11
      totalDuration = Math.max(totalDuration, n * 0.14 + noteDur + 0.05)

      const carrier = context.createOscillator()
      const modulator = context.createOscillator()
      const modGain = context.createGain()
      const envelope = context.createGain()

      carrier.type = 'sine'
      modulator.type = 'sine'

      const fStart = baseFreq + n * 240
      const fPeak = fStart * (pattern === 0 ? 1.42 : 1.32)
      const fEnd = fStart * (n === notes - 1 ? 0.92 : 1.12)

      carrier.frequency.setValueAtTime(fStart, noteStart)
      carrier.frequency.exponentialRampToValueAtTime(fPeak, noteStart + noteDur * 0.45)
      carrier.frequency.exponentialRampToValueAtTime(fEnd, noteStart + noteDur)

      // Subtle vibrato / syrinx modulation
      modulator.frequency.setValueAtTime(28 + (n % 2) * 12, noteStart)
      modGain.gain.setValueAtTime(fStart * 0.035, noteStart)

      envelope.gain.setValueAtTime(0.0001, noteStart)
      envelope.gain.linearRampToValueAtTime(peakGain, noteStart + 0.024)
      envelope.gain.exponentialRampToValueAtTime(0.0001, noteStart + noteDur)

      modulator.connect(modGain)
      modGain.connect(carrier.frequency)
      carrier.connect(envelope)
      envelope.connect(panner)

      carrier.start(noteStart)
      modulator.start(noteStart)
      carrier.stop(noteStart + noteDur + 0.01)
      modulator.stop(noteStart + noteDur + 0.01)

      carrier.onended = () => {
        carrier.disconnect()
        modulator.disconnect()
        modGain.disconnect()
        envelope.disconnect()
        if (n === notes - 1) {
          panner.disconnect()
        }
      }
    }
  }

  getSpatialState(): SpatialBirdState {
    return this.lastSpatialState
  }

  getWeatherMix(): WeatherAudioMix {
    return this.lastWeatherMix
  }

  stop() {
    void this.context?.suspend()
  }

  dispose() {
    void this.context?.close()
    this.context = null
    this.masterGain = null
    this.windFilter = null
    this.windGain = null
    this.rainFilter = null
    this.rainGain = null
  }
}
