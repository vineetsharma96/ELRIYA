import type { Point2 } from '../core/types'
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

/**
 * Locally synthesized 3D spatial ambience & localized cherry-blossom birdsong.
 * Uses Web Audio API PannerNode (HRTF) + AudioListener without external network audio.
 */
export class Ambience {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private windFilter: BiquadFilterNode | null = null
  private nextChirpCooldown = 0.6
  private chirpIndex = 0
  private lastSpatialState: SpatialBirdState = {
    activeCluster: null,
    nearbyClusters: [],
    intensity: 0,
    nearestDistance: Infinity,
  }

  async start() {
    if (this.context) {
      await this.context.resume()
      return
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const context = new AudioCtx()
    this.context = context

    const masterGain = context.createGain()
    masterGain.gain.value = 0.1
    masterGain.connect(context.destination)
    this.masterGain = masterGain

    // Gentle filtered breeze bed
    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate)
    const data = buffer.getChannelData(0)
    let brown = 0
    for (let i = 0; i < data.length; i++) {
      brown = (brown + (Math.random() * 2 - 1) * 0.02) / 1.02
      data[i] = brown * 2.6
    }
    const noise = context.createBufferSource()
    noise.buffer = buffer
    noise.loop = true
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 680
    this.windFilter = filter
    noise.connect(filter).connect(masterGain)
    noise.start()

    await context.resume()
  }

  /**
   * Updates 3D AudioListener pose and triggers localized 3D bird chirps from nearby dense blossom tree clusters.
   */
  updateSpatial(
    listener: ListenerTransform,
    daylight: number,
    windStrength: number,
    deltaSeconds: number
  ): SpatialBirdState {
    const spatial = evaluateSpatialBirdState({ x: listener.x, z: listener.z })
    this.lastSpatialState = spatial

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

    // Modulate breeze filter subtly with wind strength
    if (this.windFilter) {
      this.windFilter.frequency.setTargetAtTime(520 + windStrength * 240, now, 0.1)
    }

    // 2. Schedule localized 3D bird chirps when near dense cherry blossom clusters
    const dayActivity = 0.25 + daylight * 0.75
    const effectiveIntensity = spatial.intensity * dayActivity

    if (effectiveIntensity > 0.04 && spatial.nearbyClusters.length > 0) {
      this.nextChirpCooldown -= deltaSeconds
      if (this.nextChirpCooldown <= 0) {
        // Pick one of the nearby dense blossom clusters, weighted toward the closest
        const chosenEntry =
          spatial.nearbyClusters[this.chirpIndex % Math.min(2, spatial.nearbyClusters.length)]
        const cluster = chosenEntry.cluster
        // Pick an individual cherry blossom tree canopy inside that cluster for pinpoint 3D localization
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

        // Denser & closer clusters chirp more frequently (every 0.65s - 2.4s)
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

  stop() {
    void this.context?.suspend()
  }

  dispose() {
    void this.context?.close()
    this.context = null
    this.masterGain = null
    this.windFilter = null
  }
}
