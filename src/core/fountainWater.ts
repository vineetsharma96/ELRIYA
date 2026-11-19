import { seededRandom } from './world'

export const FOUNTAIN_CENTER = { x: 0, y: 0, z: -5 } as const

/**
 * Shared architectural & hydraulic geometry specification for the Blossom Plaza Grand Fountain.
 * Outer plinth radius (3.15m) matches the plaza collider ({ x: 0, z: -5, halfX: 3, halfZ: 3 })
 * so the player walks right up to the carved stone step without clipping into the basin.
 */
export const FOUNTAIN_SPECS = {
  plinthOuterRadius: 3.15,
  basinOuterRadius: 2.94,
  basinInnerRadius: 2.66,
  basinFloorY: 0.14,
  lowerWaterY: 0.44,
  pedestalBaseRadius: 0.72,
  midBowlRadius: 1.46,
  midBowlRimY: 1.46,
  midWaterY: 1.41,
  midSpoutRadius: 1.44,
  midSpoutY: 1.37,
  upperBowlRadius: 0.78,
  upperBowlRimY: 2.40,
  upperWaterY: 2.35,
  upperSpoutRadius: 0.76,
  upperSpoutY: 2.31,
  finialTipY: 3.12,
  rimNozzleCount: 12,
  rimNozzleRadius: 2.50,
  rimNozzleY: 0.49,
  midSpoutCount: 12,
  upperSpoutCount: 8,
  gravity: -9.81,
} as const

export interface ParabolicStreamConfig {
  id: string
  originX: number
  originY: number
  originZ: number
  velX: number
  velY: number
  velZ: number
  flightTime: number
  landingRadius: number
  kind: 'rim_jet' | 'mid_cascade' | 'upper_spill' | 'crown_plume'
}

/**
 * Computes exact parabolic position at time t under gravity and gentle horizontal wind drift.
 */
export function sampleParabolicPoint(
  originX: number,
  originY: number,
  originZ: number,
  velX: number,
  velY: number,
  velZ: number,
  t: number,
  windX = 0,
  windZ = 0,
  gravity = FOUNTAIN_SPECS.gravity
): { x: number; y: number; z: number } {
  const halfT2 = 0.5 * t * t
  return {
    x: originX + velX * t + windX * halfT2,
    y: originY + velY * t + gravity * halfT2,
    z: originZ + velZ * t + windZ * halfT2,
  }
}

/**
 * Solves positive flight time until y(t) reaches targetY from originY with initial vy.
 */
export function solveFlightTime(
  originY: number,
  targetY: number,
  velY: number,
  gravity = FOUNTAIN_SPECS.gravity
): number {
  // 0.5 * g * t^2 + vy * t + (originY - targetY) = 0
  const a = 0.5 * gravity
  const b = velY
  const c = originY - targetY
  const disc = b * b - 4 * a * c
  if (disc <= 0) return 0.25
  const sqrtDisc = Math.sqrt(disc)
  const t1 = (-b - sqrtDisc) / (2 * a)
  const t2 = (-b + sqrtDisc) / (2 * a)
  return Math.max(0.05, t1, t2)
}

/**
 * Generates deterministic hydraulic stream definitions for all four fountain tiers.
 */
export function buildFountainStreams(): ParabolicStreamConfig[] {
  const streams: ParabolicStreamConfig[] = []

  // 1. 12 Outer Rim Arching Jets shooting inward from bronze coping nozzles
  for (let i = 0; i < FOUNTAIN_SPECS.rimNozzleCount; i++) {
    const angle = (i / FOUNTAIN_SPECS.rimNozzleCount) * Math.PI * 2 + Math.PI / 12
    const ox = Math.cos(angle) * FOUNTAIN_SPECS.rimNozzleRadius
    const oz = Math.sin(angle) * FOUNTAIN_SPECS.rimNozzleRadius
    const inwardSpeed = 1.65
    const upSpeed = 3.85
    const flightTime = solveFlightTime(FOUNTAIN_SPECS.rimNozzleY, FOUNTAIN_SPECS.lowerWaterY, upSpeed)
    const landingR = Math.max(0.95, FOUNTAIN_SPECS.rimNozzleRadius - inwardSpeed * flightTime)
    streams.push({
      id: `rim-jet-${i}`,
      originX: ox,
      originY: FOUNTAIN_SPECS.rimNozzleY,
      originZ: oz,
      velX: -Math.cos(angle) * inwardSpeed,
      velY: upSpeed,
      velZ: -Math.sin(angle) * inwardSpeed,
      flightTime,
      landingRadius: landingR,
      kind: 'rim_jet',
    })
  }

  // 2. 12 Mid-Tier Scalloped Cascade Streams spilling into the lower basin
  for (let i = 0; i < FOUNTAIN_SPECS.midSpoutCount; i++) {
    const angle = (i / FOUNTAIN_SPECS.midSpoutCount) * Math.PI * 2
    const ox = Math.cos(angle) * FOUNTAIN_SPECS.midSpoutRadius
    const oz = Math.sin(angle) * FOUNTAIN_SPECS.midSpoutRadius
    const outwardSpeed = 1.18
    const upSpeed = 0.22
    const flightTime = solveFlightTime(FOUNTAIN_SPECS.midSpoutY, FOUNTAIN_SPECS.lowerWaterY, upSpeed)
    streams.push({
      id: `mid-cascade-${i}`,
      originX: ox,
      originY: FOUNTAIN_SPECS.midSpoutY,
      originZ: oz,
      velX: Math.cos(angle) * outwardSpeed,
      velY: upSpeed,
      velZ: Math.sin(angle) * outwardSpeed,
      flightTime,
      landingRadius: FOUNTAIN_SPECS.midSpoutRadius + outwardSpeed * flightTime,
      kind: 'mid_cascade',
    })
  }

  // 3. 8 Upper-Tier Crown Overflow Spills arching into the wide middle bowl
  for (let i = 0; i < FOUNTAIN_SPECS.upperSpoutCount; i++) {
    const angle = (i / FOUNTAIN_SPECS.upperSpoutCount) * Math.PI * 2 + Math.PI / 8
    const ox = Math.cos(angle) * FOUNTAIN_SPECS.upperSpoutRadius
    const oz = Math.sin(angle) * FOUNTAIN_SPECS.upperSpoutRadius
    const outwardSpeed = 0.96
    const upSpeed = 0.16
    const flightTime = solveFlightTime(FOUNTAIN_SPECS.upperSpoutY, FOUNTAIN_SPECS.midWaterY, upSpeed)
    streams.push({
      id: `upper-spill-${i}`,
      originX: ox,
      originY: FOUNTAIN_SPECS.upperSpoutY,
      originZ: oz,
      velX: Math.cos(angle) * outwardSpeed,
      velY: upSpeed,
      velZ: Math.sin(angle) * outwardSpeed,
      flightTime,
      landingRadius: FOUNTAIN_SPECS.upperSpoutRadius + outwardSpeed * flightTime,
      kind: 'upper_spill',
    })
  }

  return streams
}

/**
 * 2D Shallow-Water Wave Equation PDE Solver for the lower fountain basin.
 * Uses pre-allocated ping-pong Float32Arrays (zero GC during animation) with
 * circular stone-wall & central-pedestal reflection masks.
 */
export class FountainWaveGrid {
  readonly size: number
  readonly radius: number
  readonly innerObstacleRadius: number
  private prev: Float32Array
  private curr: Float32Array
  private next: Float32Array
  private foam: Float32Array
  private mask: Uint8Array
  private accumulator = 0
  private readonly fixedDt = 1 / 60
  private readonly waveSpeedSq = 0.19 // Strictly satisfies CFL stability (< 0.25)
  private readonly damping = 0.966

  constructor(
    size = 48,
    radius = FOUNTAIN_SPECS.basinInnerRadius,
    innerObstacleRadius = FOUNTAIN_SPECS.pedestalBaseRadius
  ) {
    this.size = size
    this.radius = radius
    this.innerObstacleRadius = innerObstacleRadius
    const total = size * size
    this.prev = new Float32Array(total)
    this.curr = new Float32Array(total)
    this.next = new Float32Array(total)
    this.foam = new Float32Array(total)
    this.mask = new Uint8Array(total)

    const half = (size - 1) * 0.5
    for (let j = 0; j < size; j++) {
      const nz = (j - half) / half
      for (let i = 0; i < size; i++) {
        const nx = (i - half) / half
        const r = Math.hypot(nx, nz) * radius
        // Active water ring: strictly inside outer stone wall and outside central pedestal
        this.mask[j * size + i] = r < radius * 0.985 && r > innerObstacleRadius * 0.94 ? 1 : 0
      }
    }
  }

  /**
   * Injects a smooth Gaussian splash impulse and surface aeration foam at local fountain (x, z).
   */
  injectSplash(localX: number, localZ: number, strength: number, splashRadius = 0.22): void {
    const size = this.size
    const half = (size - 1) * 0.5
    const gx = (localX / this.radius) * half + half
    const gz = (localZ / this.radius) * half + half
    const cellRadius = Math.max(1, Math.ceil((splashRadius / this.radius) * half))
    const cx = Math.round(gx)
    const cz = Math.round(gz)
    const invTwoSigmaSq = 1 / Math.max(0.45, cellRadius * cellRadius * 0.55)

    const minJ = Math.max(1, cz - cellRadius)
    const maxJ = Math.min(size - 2, cz + cellRadius)
    const minI = Math.max(1, cx - cellRadius)
    const maxI = Math.min(size - 2, cx + cellRadius)

    for (let j = minJ; j <= maxJ; j++) {
      const dz = j - gz
      const row = j * size
      for (let i = minI; i <= maxI; i++) {
        const idx = row + i
        if (this.mask[idx] === 0) continue
        const dx = i - gx
        const distSq = dx * dx + dz * dz
        const weight = Math.exp(-distSq * invTwoSigmaSq)
        const updated = this.curr[idx] + strength * weight
        this.curr[idx] = Math.max(-1.0, Math.min(1.0, updated))
        const foamBoost = Math.abs(strength) * weight * 1.35
        this.foam[idx] = Math.min(1.0, this.foam[idx] + foamBoost)
      }
    }
  }

  /**
   * Steps the 2D wave PDE using a fixed substep for unconditional numerical stability.
   */
  step(delta: number): void {
    const clampedDelta = Math.min(Math.max(delta, 0), 0.08)
    this.accumulator += clampedDelta
    let substeps = 0
    while (this.accumulator >= this.fixedDt && substeps < 3) {
      this.stepOnce()
      this.accumulator -= this.fixedDt
      substeps++
    }
  }

  private stepOnce(): void {
    const size = this.size
    const curr = this.curr
    const prev = this.prev
    const next = this.next
    const foam = this.foam
    const mask = this.mask
    const c2 = this.waveSpeedSq
    const damp = this.damping

    for (let j = 1; j < size - 1; j++) {
      const row = j * size
      for (let i = 1; i < size - 1; i++) {
        const idx = row + i
        if (mask[idx] === 0) {
          next[idx] = 0
          foam[idx] *= 0.85
          continue
        }

        const center = curr[idx]
        // Reflective Neumann-like boundary against solid stone wall/pedestal
        const left = mask[idx - 1] ? curr[idx - 1] : center * 0.65
        const right = mask[idx + 1] ? curr[idx + 1] : center * 0.65
        const up = mask[idx - size] ? curr[idx - size] : center * 0.65
        const down = mask[idx + size] ? curr[idx + size] : center * 0.65

        const laplacian = left + right + up + down - 4 * center
        let h = (2 * center - prev[idx] + c2 * laplacian) * damp
        if (h > 1) h = 1
        else if (h < -1) h = -1
        next[idx] = h

        // Foam gently dissipates while crest turbulence maintains bright aerated rings
        const crestEnergy = Math.max(0, Math.abs(laplacian) * 0.35 - 0.02)
        foam[idx] = Math.min(1, foam[idx] * 0.942 + crestEnergy)
      }
    }

    // Rotate ping-pong buffers without allocating
    this.prev = curr
    this.curr = next
    this.next = prev
  }

  /**
   * Samples wave height at local fountain coordinates (x, z).
   */
  sampleHeight(localX: number, localZ: number): number {
    const half = (this.size - 1) * 0.5
    const i = Math.max(0, Math.min(this.size - 1, Math.round((localX / this.radius) * half + half)))
    const j = Math.max(0, Math.min(this.size - 1, Math.round((localZ / this.radius) * half + half)))
    return this.curr[j * this.size + i]
  }

  /**
   * Computes total RMS wave energy across active water cells (useful for diagnostics & tests).
   */
  getEnergy(): number {
    let sumSq = 0
    let active = 0
    for (let i = 0; i < this.curr.length; i++) {
      if (this.mask[i]) {
        sumSq += this.curr[i] * this.curr[i]
        active++
      }
    }
    return active > 0 ? Math.sqrt(sumSq / active) : 0
  }

  /**
   * Packs [height, gradX, gradZ, foam] into a reusable RGBA Uint8Array (size * size * 4)
   * for zero-GC upload to a THREE.DataTexture.
   */
  packToRGBA(out: Uint8Array): void {
    const size = this.size
    const curr = this.curr
    const foam = this.foam
    const mask = this.mask

    for (let j = 0; j < size; j++) {
      const row = j * size
      const jPrev = j > 0 ? j - 1 : j
      const jNext = j < size - 1 ? j + 1 : j
      for (let i = 0; i < size; i++) {
        const idx = row + i
        const outIdx = idx * 4
        if (mask[idx] === 0) {
          out[outIdx] = 128
          out[outIdx + 1] = 128
          out[outIdx + 2] = 128
          out[outIdx + 3] = 0
          continue
        }

        const iPrev = i > 0 ? i - 1 : i
        const iNext = i < size - 1 ? i + 1 : i
        const h = curr[idx]
        const gx = (curr[row + iNext] - curr[row + iPrev]) * 1.85
        const gz = (curr[jNext * size + i] - curr[jPrev * size + i]) * 1.85

        out[outIdx] = Math.max(0, Math.min(255, Math.round((h * 0.5 + 0.5) * 255)))
        out[outIdx + 1] = Math.max(0, Math.min(255, Math.round((gx * 0.5 + 0.5) * 255)))
        out[outIdx + 2] = Math.max(0, Math.min(255, Math.round((gz * 0.5 + 0.5) * 255)))
        out[outIdx + 3] = Math.max(0, Math.min(255, Math.round(foam[idx] * 255)))
      }
    }
  }
}

export enum DropletKind {
  CrownPlume = 0,
  UpperSpill = 1,
  MidCascade = 2,
  RimJet = 3,
  SplashCrown = 4,
}

export interface FountainParticleBuffers {
  readonly count: number
  readonly x: Float32Array
  readonly y: Float32Array
  readonly z: Float32Array
  readonly vx: Float32Array
  readonly vy: Float32Array
  readonly vz: Float32Array
  readonly size: Float32Array
  readonly age: Float32Array
  readonly life: Float32Array
  readonly kind: Uint8Array
}

/**
 * Combined Hydraulic Water Simulator coupling ballistic 3D droplet & splash physics
 * with the live 2D shallow-water wave equation grid.
 */
export class FountainWaterSimulator {
  readonly waveGrid: FountainWaveGrid
  readonly streams: ParabolicStreamConfig[]
  readonly particles: FountainParticleBuffers
  readonly textureData: Uint8Array
  private readonly rand: () => number
  private splashCursor = 0
  private readonly splashStartIndex: number
  private readonly splashCount: number
  private elapsed = 0
  private rainCooldown = 0
  private impactPulseTimer = 0
  totalBasinImpacts = 0

  constructor(particleCount = 360, gridSize = 48, seed = 88421) {
    this.rand = seededRandom(seed)
    this.waveGrid = new FountainWaveGrid(gridSize)
    this.streams = buildFountainStreams()
    this.textureData = new Uint8Array(gridSize * gridSize * 4)

    // Reserve ~24% of particles for reactive basin splash crowns & fine mist
    this.splashCount = Math.max(24, Math.floor(particleCount * 0.24))
    this.splashStartIndex = particleCount - this.splashCount

    this.particles = {
      count: particleCount,
      x: new Float32Array(particleCount),
      y: new Float32Array(particleCount),
      z: new Float32Array(particleCount),
      vx: new Float32Array(particleCount),
      vy: new Float32Array(particleCount),
      vz: new Float32Array(particleCount),
      size: new Float32Array(particleCount),
      age: new Float32Array(particleCount),
      life: new Float32Array(particleCount),
      kind: new Uint8Array(particleCount),
    }

    // Initialize stream droplets staggered along their trajectories for instant full flow
    for (let i = 0; i < this.splashStartIndex; i++) {
      this.respawnStreamDroplet(i, true)
    }
    for (let i = this.splashStartIndex; i < particleCount; i++) {
      this.particles.kind[i] = DropletKind.SplashCrown
      this.particles.age[i] = 1
      this.particles.life[i] = 0.35
      this.particles.y[i] = -10 // Parked below basin until triggered by an impact
      this.particles.size[i] = 0
    }

    // Pre-seed gentle standing ripples so the first frame already looks alive
    this.seedContinuousImpacts(0)
    this.waveGrid.step(1 / 30)
    this.waveGrid.packToRGBA(this.textureData)
  }

  private respawnStreamDroplet(index: number, stagger = false): void {
    const p = this.particles
    const ratio = index / Math.max(1, this.splashStartIndex)
    const pulse = 1 + Math.sin(this.elapsed * 2.1 + index * 0.37) * 0.045

    let ox = 0
    let oy: number = FOUNTAIN_SPECS.finialTipY
    let oz = 0
    let vx = 0
    let vy = 2.6
    let vz = 0
    let life = 0.72
    let size = 0.042
    let kind: DropletKind = DropletKind.CrownPlume

    if (ratio < 0.26) {
      // Central Crown Finial Geyser Plume (vertical fountain crown bursting outward)
      const angle = this.rand() * Math.PI * 2
      const spread = 0.18 + this.rand() * 0.62
      ox = Math.cos(angle) * 0.05
      oy = FOUNTAIN_SPECS.finialTipY
      oz = Math.sin(angle) * 0.05
      vx = Math.cos(angle) * spread
      vy = (2.15 + this.rand() * 0.95) * pulse
      vz = Math.sin(angle) * spread
      life = solveFlightTime(oy, FOUNTAIN_SPECS.upperWaterY, vy)
      size = 0.036 + this.rand() * 0.024
      kind = DropletKind.CrownPlume
    } else if (ratio < 0.44) {
      // Upper-to-Mid Spill Streams
      const spillIndex = Math.floor(this.rand() * FOUNTAIN_SPECS.upperSpoutCount)
      const stream = this.streams[FOUNTAIN_SPECS.rimNozzleCount + FOUNTAIN_SPECS.midSpoutCount + spillIndex]
      const jitter = (this.rand() - 0.5) * 0.16
      ox = stream.originX + (this.rand() - 0.5) * 0.04
      oy = stream.originY
      oz = stream.originZ + (this.rand() - 0.5) * 0.04
      vx = stream.velX * (0.94 + this.rand() * 0.14) + jitter
      vy = stream.velY + (this.rand() - 0.5) * 0.15
      vz = stream.velZ * (0.94 + this.rand() * 0.14) + jitter
      life = stream.flightTime * 1.05
      size = 0.038 + this.rand() * 0.020
      kind = DropletKind.UpperSpill
    } else if (ratio < 0.72) {
      // Mid-to-Lower Basin Cascade Streams
      const cascadeIndex = Math.floor(this.rand() * FOUNTAIN_SPECS.midSpoutCount)
      const stream = this.streams[FOUNTAIN_SPECS.rimNozzleCount + cascadeIndex]
      const jitter = (this.rand() - 0.5) * 0.18
      ox = stream.originX + (this.rand() - 0.5) * 0.05
      oy = stream.originY
      oz = stream.originZ + (this.rand() - 0.5) * 0.05
      vx = stream.velX * (0.92 + this.rand() * 0.18) + jitter
      vy = stream.velY + (this.rand() - 0.5) * 0.18
      vz = stream.velZ * (0.92 + this.rand() * 0.18) + jitter
      life = stream.flightTime * 1.08
      size = 0.042 + this.rand() * 0.024
      kind = DropletKind.MidCascade
    } else {
      // 12 Outer Rim Arching Jets
      const jetIndex = Math.floor(this.rand() * FOUNTAIN_SPECS.rimNozzleCount)
      const stream = this.streams[jetIndex]
      const jitter = (this.rand() - 0.5) * 0.14
      ox = stream.originX
      oy = stream.originY
      oz = stream.originZ
      vx = stream.velX * pulse + jitter
      vy = stream.velY * (0.95 + this.rand() * 0.10) * pulse
      vz = stream.velZ * pulse + jitter
      life = stream.flightTime * 1.06
      size = 0.038 + this.rand() * 0.024
      kind = DropletKind.RimJet
    }

    p.kind[index] = kind
    p.life[index] = Math.max(0.18, life)
    p.size[index] = size

    if (stagger) {
      const t = this.rand() * p.life[index]
      p.age[index] = t
      p.x[index] = ox + vx * t
      p.y[index] = oy + vy * t + 0.5 * FOUNTAIN_SPECS.gravity * t * t
      p.z[index] = oz + vz * t
      p.vx[index] = vx
      p.vy[index] = vy + FOUNTAIN_SPECS.gravity * t
      p.vz[index] = vz
    } else {
      p.age[index] = 0
      p.x[index] = ox
      p.y[index] = oy
      p.z[index] = oz
      p.vx[index] = vx
      p.vy[index] = vy
      p.vz[index] = vz
    }
  }

  private spawnSplashDroplet(x: number, z: number, energy: number): void {
    const idx = this.splashStartIndex + this.splashCursor
    this.splashCursor = (this.splashCursor + 1) % this.splashCount
    const p = this.particles
    const angle = this.rand() * Math.PI * 2
    const speed = (0.35 + this.rand() * 0.65) * energy
    p.kind[idx] = DropletKind.SplashCrown
    p.x[idx] = x + Math.cos(angle) * 0.04
    p.y[idx] = FOUNTAIN_SPECS.lowerWaterY + 0.02
    p.z[idx] = z + Math.sin(angle) * 0.04
    p.vx[idx] = Math.cos(angle) * speed
    p.vy[idx] = (0.85 + this.rand() * 0.95) * energy
    p.vz[idx] = Math.sin(angle) * speed
    p.age[idx] = 0
    p.life[idx] = 0.22 + this.rand() * 0.22
    p.size[idx] = 0.026 + this.rand() * 0.026
  }

  /**
   * Injects continuous hydraulic impact disturbances where the 24 steady water streams strike the basin.
   */
  private seedContinuousImpacts(windX: number, windZ = 0): void {
    const pulse = 0.65 + 0.35 * Math.sin(this.elapsed * 3.4)
    for (let i = 0; i < this.streams.length; i++) {
      const s = this.streams[i]
      if (s.kind !== 'rim_jet' && s.kind !== 'mid_cascade') continue
      const land = sampleParabolicPoint(
        s.originX,
        s.originY,
        s.originZ,
        s.velX,
        s.velY,
        s.velZ,
        s.flightTime,
        windX,
        windZ
      )
      const jitter = Math.sin(this.elapsed * 7.2 + i * 1.9) * 0.08
      const strength = s.kind === 'rim_jet' ? -0.14 * pulse : -0.10 * pulse
      this.waveGrid.injectSplash(land.x + jitter, land.z - jitter, strength, 0.20)
    }
  }

  /**
   * Advances both the ballistic droplet physics and 2D shallow-water wave simulation.
   */
  step(delta: number, windStrength = 0.6, rainIntensity = 0): void {
    const dt = Math.min(Math.max(delta, 0), 0.05)
    if (dt <= 0) return

    this.elapsed += dt
    const windX = windStrength * 0.52 * (0.8 + 0.2 * Math.sin(this.elapsed * 0.75))
    const windZ = windStrength * 0.22 * Math.cos(this.elapsed * 0.55)
    const g = FOUNTAIN_SPECS.gravity
    const p = this.particles

    // Periodic steady-stream hydraulic wave excitation (~24 Hz)
    this.impactPulseTimer += dt
    if (this.impactPulseTimer >= 0.042) {
      this.impactPulseTimer = 0
      this.seedContinuousImpacts(windX, windZ)
    }

    // Raindrop impacts across the basin during light_rain weather
    if (rainIntensity > 0.02) {
      this.rainCooldown -= dt
      if (this.rainCooldown <= 0) {
        const dropCount = Math.max(1, Math.round(rainIntensity * 3))
        for (let r = 0; r < dropCount; r++) {
          const angle = this.rand() * Math.PI * 2
          const dist =
            FOUNTAIN_SPECS.pedestalBaseRadius +
            0.12 +
            Math.sqrt(this.rand()) * (FOUNTAIN_SPECS.basinInnerRadius - FOUNTAIN_SPECS.pedestalBaseRadius - 0.24)
          this.waveGrid.injectSplash(Math.cos(angle) * dist, Math.sin(angle) * dist, -0.16 * rainIntensity, 0.14)
        }
        this.rainCooldown = Math.max(0.035, 0.11 - rainIntensity * 0.07)
      }
    }

    // Integrate ballistic stream droplets
    for (let i = 0; i < this.splashStartIndex; i++) {
      p.age[i] += dt
      p.vx[i] += windX * dt
      p.vy[i] += g * dt
      p.vz[i] += windZ * dt
      p.x[i] += p.vx[i] * dt
      p.y[i] += p.vy[i] * dt
      p.z[i] += p.vz[i] * dt

      const kind = p.kind[i]
      const targetY =
        kind === DropletKind.CrownPlume
          ? FOUNTAIN_SPECS.upperWaterY
          : kind === DropletKind.UpperSpill
            ? FOUNTAIN_SPECS.midWaterY
            : FOUNTAIN_SPECS.lowerWaterY

      if (p.y[i] <= targetY || p.age[i] >= p.life[i]) {
        // Trigger wave impulse + upward splash crown when striking the main lower basin
        if ((kind === DropletKind.MidCascade || kind === DropletKind.RimJet) && p.y[i] <= FOUNTAIN_SPECS.lowerWaterY + 0.08) {
          const r = Math.hypot(p.x[i], p.z[i])
          if (r > FOUNTAIN_SPECS.pedestalBaseRadius && r < FOUNTAIN_SPECS.basinInnerRadius) {
            this.waveGrid.injectSplash(p.x[i], p.z[i], -0.20, 0.18)
            this.spawnSplashDroplet(p.x[i], p.z[i], kind === DropletKind.RimJet ? 1.05 : 0.85)
            this.totalBasinImpacts++
          }
        }
        this.respawnStreamDroplet(i, false)
      }
    }

    // Integrate reactive splash crown micro-droplets
    for (let i = this.splashStartIndex; i < p.count; i++) {
      if (p.age[i] >= p.life[i]) continue
      p.age[i] += dt
      p.vx[i] += windX * 0.45 * dt
      p.vy[i] += g * 0.88 * dt
      p.vz[i] += windZ * 0.45 * dt
      p.x[i] += p.vx[i] * dt
      p.y[i] += p.vy[i] * dt
      p.z[i] += p.vz[i] * dt
      if (p.y[i] < FOUNTAIN_SPECS.lowerWaterY) {
        p.age[i] = p.life[i]
      }
    }

    // Step 2D shallow-water wave PDE and pack GPU texture buffer
    this.waveGrid.step(dt)
    this.waveGrid.packToRGBA(this.textureData)
  }
}
