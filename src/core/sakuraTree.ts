import { seededRandom } from './world'

/**
 * Placement for the Experimental Sakura Tree directly beside the Experimental Botanical Tree (5.4, -3.6)
 * and framing the northeast side of the Blossom Plaza Fountain (0, -5).
 * Distance to Experimental Tree = 5.0m (2.64m clear walkway between stone planters).
 * Distance to Fountain center = 6.49m (2.16m clear walkway from fountain plinth).
 */
export const SAKURA_TREE_CENTER = { x: 5.4, y: 0, z: -8.6 } as const

export const SAKURA_TREE_SPECS = {
  planterOuterRadius: 1.18,
  planterInnerRadius: 1.02,
  planterHeight: 0.22,
  trunkBaseRadius: 0.30,
  trunkHeight: 1.98, // Lower Japanese cherry crotch for wide spreading/weeping silhouette
  gravity: -2.35, // Gentle effective downward acceleration for buoyant broad leaves
} as const

export interface SakuraVec3 {
  x: number
  y: number
  z: number
}

export interface SakuraBranchNode {
  x: number
  y: number
  z: number
  radius: number
  t: number
}

export interface SakuraBranchSegment {
  id: string
  /** -1 = surface roots, 0 = twisted trunk, 1 = wide spreading limbs, 2 = layered boughs, 3 = pendulous twigs */
  order: -1 | 0 | 1 | 2 | 3
  nodes: SakuraBranchNode[]
  radialSegments: number
}

export interface SakuraCanopySlot {
  x: number
  y: number
  z: number
  dirX: number
  dirY: number
  dirZ: number
  roll: number
  maxScale: number
  sunExposure: number
  windWeight: number
  hueShift: number
  /** 0 = soft sakura blossom cluster, 1 = tender spring cherry leaf */
  isLeaf: boolean
}

export interface SakuraTreeSkeleton {
  branches: SakuraBranchSegment[]
  canopySlots: SakuraCanopySlot[]
  stats: {
    rootCount: number
    primaryLimbCount: number
    secondaryBoughCount: number
    weepingTwigCount: number
    canopySlotCount: number
    maxHeight: number
    maxCanopyRadius: number
  }
}

function norm3(x: number, y: number, z: number): SakuraVec3 {
  const l = Math.hypot(x, y, z) || 1
  return { x: x / l, y: y / l, z: z / l }
}

function cross3(a: SakuraVec3, b: SakuraVec3): SakuraVec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function sampleNodesAt(nodes: SakuraBranchNode[], t: number): { pos: SakuraVec3; dir: SakuraVec3; radius: number } {
  const clamped = Math.max(0, Math.min(1, t))
  const scaled = clamped * (nodes.length - 1)
  const i0 = Math.min(nodes.length - 2, Math.floor(scaled))
  const i1 = i0 + 1
  const f = scaled - i0
  const a = nodes[i0]
  const b = nodes[i1]
  return {
    pos: {
      x: a.x + (b.x - a.x) * f,
      y: a.y + (b.y - a.y) * f,
      z: a.z + (b.z - a.z) * f,
    },
    dir: norm3(b.x - a.x, b.y - a.y, b.z - a.z),
    radius: a.radius + (b.radius - a.radius) * f,
  }
}

/**
 * Generates an overarching/weeping Japanese cherry branch curve with distinct horizontal flare
 * and gentle weeping gravity arch near the outer tips.
 */
function growSakuraBranch(
  origin: SakuraVec3,
  startDir: SakuraVec3,
  length: number,
  startRadius: number,
  endRadius: number,
  segments: number,
  archLift: number,
  weepingDroop: number,
  twist: number,
  rand: () => number
): SakuraBranchNode[] {
  const nodes: SakuraBranchNode[] = []
  let cx = origin.x
  let cy = origin.y
  let cz = origin.z
  let dir = norm3(startDir.x, startDir.y, startDir.z)
  const stepLen = length / segments

  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const collar = i === 0 ? 1.15 : 1.0
    const radius = (startRadius * Math.pow(1 - t, 0.78) + endRadius * Math.pow(t, 0.78)) * collar
    nodes.push({ x: cx, y: cy, z: cz, radius: Math.max(0.005, radius), t })

    if (i < segments) {
      // Early upward sweep followed by graceful weeping droop at the outer half
      const verticalCurve = archLift * (1 - t * 1.45) - weepingDroop * t * t
      const jitterX = (rand() - 0.5) * twist
      const jitterZ = (rand() - 0.5) * twist
      dir = norm3(dir.x + jitterX, dir.y + verticalCurve, dir.z + jitterZ)
      cx += dir.x * stepLen
      cy += dir.y * stepLen
      cz += dir.z * stepLen
    }
  }
  return nodes
}

export type SakuraTreeDetailMode = 'hero' | 'city' | 'city-low'

/**
 * Deterministically builds the Japanese Sakura tree branching skeleton with a completely
 * different spreading-and-weeping branch map from the upright Experimental Botanical Tree.
 *
 * - `mode = 'hero'`: flagship showcase geometry beside the fountain.
 * - `mode = 'city' | 'city-low'`: generates a genuinely unique spreading/weeping branch map
 *   per `seed` (unique bonsai trunk lean, crotch height, root count, primary limb count/angles,
 *   weeping curvature, and blossom canopy) for batched city-wide rendering.
 */
export function generateSakuraTreeSkeleton(
  seed = 94127,
  lowDetail = false,
  mode: SakuraTreeDetailMode = 'hero'
): SakuraTreeSkeleton {
  const rand = seededRandom(seed)
  const branches: SakuraBranchSegment[] = []
  const canopySlots: SakuraCanopySlot[] = []
  const GOLDEN_ANGLE = 2.399963229728653
  const isCity = mode !== 'hero'
  const isCityLow = mode === 'city-low' || (isCity && lowDetail)

  // 1. ORDER 0: Shorter, gracefully leaning sculptural cherry trunk with early fork
  const trunkNodes: SakuraBranchNode[] = []
  const trunkSteps = isCity ? (isCityLow ? 5 : 7) : 9
  const trunkHeight = isCity ? 1.55 + rand() * 0.72 : SAKURA_TREE_SPECS.trunkHeight
  const trunkBaseR = isCity ? 0.23 + rand() * 0.09 : SAKURA_TREE_SPECS.trunkBaseRadius
  const leanAz = isCity ? rand() * Math.PI * 2 : 2.52
  const leanMag = isCity ? 0.14 + rand() * 0.36 : 0.42
  const twistPhase = isCity ? rand() * Math.PI * 2 : 0
  const twistAmp = isCity ? 0.05 + rand() * 0.08 : 0.09

  for (let i = 0; i <= trunkSteps; i++) {
    const t = i / trunkSteps
    const y = (isCity ? 0.0 : 0.04) + t * trunkHeight
    let leanX: number
    let leanZ: number
    if (isCity) {
      const sweep = leanMag * Math.pow(t, 1.3)
      const curve = Math.sin(t * Math.PI * 1.45 + twistPhase) * twistAmp
      leanX = Math.cos(leanAz) * sweep - Math.sin(leanAz) * curve
      leanZ = Math.sin(leanAz) * sweep + Math.cos(leanAz) * curve
    } else {
      // Sculptural Japanese bonsai-like lean sweeping softly toward the fountain & walkway
      leanX = -0.34 * Math.pow(t, 1.35) + Math.sin(t * Math.PI * 1.4) * 0.09
      leanZ = 0.24 * Math.pow(t, 1.25) - Math.sin(t * Math.PI) * 0.07
    }
    const flare = Math.pow(Math.max(0, 1 - t * 3.2), 2.0) * (isCity ? 0.11 : 0.13)
    const radius = trunkBaseR * (1 - t * 0.34) + flare
    trunkNodes.push({ x: leanX, y, z: leanZ, radius, t })
  }
  branches.push({
    id: 'sakura-trunk',
    order: 0,
    nodes: trunkNodes,
    radialSegments: isCity ? (isCityLow ? 6 : 8) : lowDetail ? 10 : 14,
  })

  // 2. ORDER -1: Knotted Surface Root Buttresses gripping the earth
  const rootCount = isCity ? (isCityLow ? 4 : 4 + Math.floor(rand() * 4)) : 7
  const rootPhase = isCity ? rand() * Math.PI * 2 : 0
  for (let r = 0; r < rootCount; r++) {
    const angle = rootPhase + (r / rootCount) * Math.PI * 2 + (rand() - 0.5) * 0.38
    const startH = 0.38 + rand() * 0.22
    const reach = (isCity ? 0.60 : 0.72) + rand() * 0.25
    const rootNodes: SakuraBranchNode[] = []
    const steps = isCity ? 3 : 5
    for (let s = 0; s <= steps; s++) {
      const f = s / steps
      const rad = 0.14 + f * reach
      const curvedA = angle + Math.sin(f * Math.PI * 1.2) * (rand() - 0.5) * 0.24
      const y = startH * Math.pow(1 - f, 1.5) + (isCity ? 0.01 : 0.055)
      const radius = (isCity ? 0.105 : 0.125) * Math.pow(1 - f, 0.85) + 0.02
      rootNodes.push({ x: Math.cos(curvedA) * rad, y, z: Math.sin(curvedA) * rad, radius, t: f })
    }
    branches.push({
      id: `sakura-root-${r}`,
      order: -1,
      nodes: rootNodes,
      radialSegments: isCity ? 5 : lowDetail ? 6 : 8,
    })
  }

  // 3. ORDER 1: Wide-Spreading & Overarching Sakura Primary Limbs
  interface SakuraLimbSpec {
    attachT: number
    azimuth: number
    elevation: number
    length: number
    radiusScale: number
    archLift: number
    droop: number
  }

  let primaryLimbSpecs: SakuraLimbSpec[]
  if (!isCity) {
    primaryLimbSpecs = [
      // Low sweeping showcase limb extending toward the fountain & experimental tree
      { attachT: 0.72, azimuth: 2.38, elevation: 0.34, length: 3.10, radiusScale: 0.66, archLift: 0.16, droop: 0.28 },
      // North-west wide canal-facing limb
      { attachT: 0.80, azimuth: -2.32, elevation: 0.44, length: 2.85, radiusScale: 0.62, archLift: 0.20, droop: 0.24 },
      // East-southeast spreading tier limb
      { attachT: 0.86, azimuth: 0.68, elevation: 0.40, length: 2.80, radiusScale: 0.61, archLift: 0.18, droop: 0.26 },
      // North-east high sweeping limb
      { attachT: 0.92, azimuth: -0.78, elevation: 0.56, length: 2.65, radiusScale: 0.58, archLift: 0.22, droop: 0.22 },
      // Central arching upper cherry crown limb (leans gently south-west)
      { attachT: 0.99, azimuth: 3.05, elevation: 0.92, length: 2.55, radiusScale: 0.56, archLift: 0.14, droop: 0.20 },
    ]
  } else {
    // Unique sakura crown personality per tree: wide Yoshino umbrella, graceful Shidare weeping, or sculpted vase
    const limbCount = isCityLow ? 4 + Math.floor(rand() * 2) : 4 + Math.floor(rand() * 3) // 4..6 limbs
    const baseAz = rand() * Math.PI * 2
    const weepingFactor = rand() // 0 = classic layered vase, 1 = cascading weeping cherry
    const hasUpperArch = rand() > 0.32
    const spreadCount = hasUpperArch ? limbCount - 1 : limbCount

    primaryLimbSpecs = []
    for (let i = 0; i < spreadCount; i++) {
      const frac = spreadCount > 1 ? i / (spreadCount - 1) : 0.5
      const az = baseAz + i * ((Math.PI * 2) / spreadCount) + (rand() - 0.5) * 0.68
      const attachT = Math.min(0.96, 0.62 + frac * 0.32 + (rand() - 0.5) * 0.08)
      const elevation = 0.28 + frac * 0.24 + (1 - weepingFactor) * 0.12 + (rand() - 0.5) * 0.14
      const length = 2.15 + rand() * 0.95
      primaryLimbSpecs.push({
        attachT,
        azimuth: az,
        elevation: Math.max(0.24, Math.min(0.76, elevation)),
        length,
        radiusScale: 0.54 + rand() * 0.14,
        archLift: 0.12 + rand() * 0.12,
        droop: 0.18 + weepingFactor * 0.18 + rand() * 0.08,
      })
    }
    if (hasUpperArch) {
      primaryLimbSpecs.push({
        attachT: 0.98,
        azimuth: baseAz + rand() * Math.PI * 2,
        elevation: 0.74 + rand() * 0.26,
        length: 2.05 + rand() * 0.68,
        radiusScale: 0.52 + rand() * 0.1,
        archLift: 0.10 + rand() * 0.1,
        droop: 0.16 + weepingFactor * 0.14,
      })
    }
  }

  let secondaryBoughCount = 0
  let weepingTwigCount = 0
  const sprigScaleMin = isCity ? (isCityLow ? 0.78 : 0.58) : 0.36
  const sprigScaleSpan = isCity ? (isCityLow ? 0.36 : 0.34) : 0.24

  primaryLimbSpecs.forEach((spec, idx) => {
    const parent = sampleNodesAt(trunkNodes, spec.attachT)
    const dir = norm3(
      Math.cos(spec.azimuth) * Math.cos(spec.elevation),
      Math.sin(spec.elevation),
      Math.sin(spec.azimuth) * Math.cos(spec.elevation)
    )
    const startR = parent.radius * spec.radiusScale
    const endR = startR * 0.36
    const limbNodes = growSakuraBranch(
      parent.pos,
      dir,
      spec.length,
      startR,
      endR,
      isCity ? (isCityLow ? 4 : 5) : lowDetail ? 6 : 8,
      spec.archLift,
      spec.droop,
      isCity ? 0.18 + rand() * 0.12 : 0.18,
      rand
    )
    branches.push({
      id: `sakura-limb-${idx}`,
      order: 1,
      nodes: limbNodes,
      radialSegments: isCity ? (isCityLow ? 5 : 6) : lowDetail ? 7 : 10,
    })

    // 4. ORDER 2: Layered horizontal fan-like secondary boughs
    const secCount = isCity ? (isCityLow ? 2 : 2 + Math.floor(rand() * 2)) : 4
    for (let s = 0; s < secCount; s++) {
      const attachT = secCount > 1 ? 0.28 + (s / (secCount - 1)) * 0.66 : 0.60
      const origin = sampleNodesAt(limbNodes, attachT)
      const sideSign = (s + idx) % 2 === 0 ? 1 : -1
      const upRef: SakuraVec3 = { x: 0, y: 1, z: 0 }
      let side = cross3(origin.dir, upRef)
      if (Math.hypot(side.x, side.y, side.z) < 0.1) side = { x: 1, y: 0, z: 0 }
      side = norm3(side.x, side.y, side.z)

      const spread = (0.58 + rand() * 0.42) * sideSign
      const secDir = norm3(
        origin.dir.x * 0.85 + side.x * spread,
        Math.max(0.06, origin.dir.y * 0.65 + 0.16 + rand() * 0.18),
        origin.dir.z * 0.85 + side.z * spread
      )
      const secLen = (1.1 + rand() * 0.66) * (1.06 - attachT * 0.24)
      const secStartR = Math.max(0.022, origin.radius * 0.7)
      const secEndR = Math.max(0.009, secStartR * 0.35)
      const secNodes = growSakuraBranch(
        origin.pos,
        secDir,
        secLen,
        secStartR,
        secEndR,
        isCity ? 3 : lowDetail ? 4 : 5,
        0.12,
        0.26,
        0.22,
        rand
      )
      branches.push({
        id: `sakura-bough-${idx}-${s}`,
        order: 2,
        nodes: secNodes,
        radialSegments: isCity ? 4 : lowDetail ? 5 : 7,
      })
      secondaryBoughCount++

      // 5. ORDER 3: Graceful weeping/arching blossom twigs
      const twigsPerBough = isCity ? (isCityLow ? 1 : 2) : lowDetail ? 2 : 3
      for (let tw = 0; tw < twigsPerBough; tw++) {
        const twT = twigsPerBough > 1 ? 0.34 + (tw / (twigsPerBough - 1)) * 0.62 : 0.72
        const twOrigin = sampleNodesAt(secNodes, twT)
        const twAz = (idx * 7 + s * 5 + tw) * GOLDEN_ANGLE + rand() * 0.65
        const twDir = norm3(
          twOrigin.dir.x * 0.72 + Math.cos(twAz) * 0.58,
          twOrigin.dir.y * 0.45 + 0.08 + (rand() - 0.5) * 0.24,
          twOrigin.dir.z * 0.72 + Math.sin(twAz) * 0.58
        )
        const twNodes = growSakuraBranch(
          twOrigin.pos,
          twDir,
          0.54 + rand() * 0.44,
          Math.max(0.011, twOrigin.radius * 0.65),
          0.005,
          isCity ? 2 : 3,
          0.05,
          0.34, // Delicate weeping curl at twig tips
          0.24,
          rand
        )
        branches.push({
          id: `sakura-twig-${idx}-${s}-${tw}`,
          order: 3,
          nodes: twNodes,
          radialSegments: isCity ? 4 : 5,
        })
        weepingTwigCount++

        attachSakuraCanopySlots(
          twNodes,
          isCity ? (isCityLow ? 4 : 4) : lowDetail ? 8 : 13,
          0.14,
          1.0,
          0.82,
          sprigScaleMin,
          sprigScaleSpan,
          rand,
          canopySlots
        )
      }

      attachSakuraCanopySlots(
        secNodes,
        isCity ? (isCityLow ? 3 : 4) : lowDetail ? 5 : 8,
        0.44,
        1.0,
        0.55,
        sprigScaleMin,
        sprigScaleSpan,
        rand,
        canopySlots
      )
    }

    // Terminal blossom spray twigs at the sweeping end of every primary limb
    const tipOrigin = sampleNodesAt(limbNodes, 0.96)
    const tipTwigs = isCity ? (isCityLow ? 1 : 2) : lowDetail ? 2 : 3
    for (let tt = 0; tt < tipTwigs; tt++) {
      const a = (idx * 11 + tt) * GOLDEN_ANGLE + (isCity ? rand() * 0.7 : 0)
      const tDir = norm3(
        tipOrigin.dir.x + Math.cos(a) * 0.55,
        tipOrigin.dir.y * 0.5 + 0.1 + rand() * 0.18,
        tipOrigin.dir.z + Math.sin(a) * 0.55
      )
      const tNodes = growSakuraBranch(
        tipOrigin.pos,
        tDir,
        0.60 + rand() * 0.36,
        Math.max(0.014, tipOrigin.radius * 0.7),
        0.005,
        isCity ? 2 : 3,
        0.06,
        0.36,
        0.22,
        rand
      )
      branches.push({
        id: `sakura-tip-${idx}-${tt}`,
        order: 3,
        nodes: tNodes,
        radialSegments: isCity ? 4 : 5,
      })
      weepingTwigCount++
      attachSakuraCanopySlots(
        tNodes,
        isCity ? (isCityLow ? 4 : 5) : lowDetail ? 9 : 14,
        0.12,
        1.0,
        0.9,
        sprigScaleMin,
        sprigScaleSpan,
        rand,
        canopySlots
      )
    }
  })

  let maxHeight = 0
  let maxCanopyRadius = 0
  for (const b of branches) {
    for (const n of b.nodes) {
      if (n.y > maxHeight) maxHeight = n.y
      const r = Math.hypot(n.x, n.z)
      if (r > maxCanopyRadius) maxCanopyRadius = r
    }
  }
  for (const s of canopySlots) {
    if (s.y > maxHeight) maxHeight = s.y
    const r = Math.hypot(s.x, s.z)
    if (r > maxCanopyRadius) maxCanopyRadius = r
  }

  return {
    branches,
    canopySlots,
    stats: {
      rootCount,
      primaryLimbCount: primaryLimbSpecs.length,
      secondaryBoughCount,
      weepingTwigCount,
      canopySlotCount: canopySlots.length,
      maxHeight: Number(maxHeight.toFixed(2)),
      maxCanopyRadius: Number(maxCanopyRadius.toFixed(2)),
    },
  }
}

function attachSakuraCanopySlots(
  nodes: SakuraBranchNode[],
  count: number,
  minT: number,
  maxT: number,
  baseWind: number,
  scaleMin: number,
  scaleSpan: number,
  rand: () => number,
  out: SakuraCanopySlot[]
): void {
  const GOLDEN_ANGLE = 2.399963229728653
  for (let i = 0; i < count; i++) {
    const frac = count > 1 ? i / (count - 1) : 1
    const t = minT + (maxT - minT) * Math.min(1, Math.max(0, frac + (rand() - 0.5) * 0.14))
    const sample = sampleNodesAt(nodes, t)

    const az = i * GOLDEN_ANGLE + rand() * 0.5
    const radial = 0.04 + (0.14 + rand() * 0.25) * (0.55 + frac * 0.65)
    const ox = Math.cos(az) * radial
    const oz = Math.sin(az) * radial
    const oy = (rand() - 0.42) * 0.22

    const x = sample.pos.x + ox
    const y = Math.max(1.55, sample.pos.y + oy)
    const z = sample.pos.z + oz

    const outDir = norm3(x * 0.4 + ox * 1.5, 0.36 + (y - 2.1) * 0.16 + rand() * 0.35, z * 0.4 + oz * 1.5)
    const radialDist = Math.hypot(x, z)
    const sunExposure = Math.max(0, Math.min(1, ((y - 1.7) / 3.6) * 0.58 + (radialDist / 3.8) * 0.42))

    out.push({
      x,
      y,
      z,
      dirX: outDir.x,
      dirY: outDir.y,
      dirZ: outDir.z,
      roll: (rand() - 0.5) * Math.PI * 1.4,
      maxScale: scaleMin + rand() * scaleSpan,
      sunExposure,
      windWeight: Math.max(0.22, Math.min(1, baseWind * (0.65 + 0.35 * frac))),
      hueShift: rand(),
      isLeaf: rand() < 0.22, // ~78% cherry blossom clusters, ~22% tender bronze-green cherry leaves
    })
  }
}

export enum FallingLeafPhase {
  Inactive = 0,
  Falling = 1,
  Grounded = 2,
}

export interface FallingLeafPool {
  readonly count: number
  readonly phase: Uint8Array
  readonly x: Float32Array
  readonly y: Float32Array
  readonly z: Float32Array
  readonly vx: Float32Array
  readonly vy: Float32Array
  readonly vz: Float32Array
  /** Rigid-body attitude angles (radians) driven by CoG + aerodynamic torque */
  readonly pitch: Float32Array
  readonly yaw: Float32Array
  readonly roll: Float32Array
  readonly angVx: Float32Array
  readonly angVy: Float32Array
  readonly angVz: Float32Array
  /** Offset from aerodynamic center of pressure to center of gravity along stem axis */
  readonly cogOffset: Float32Array
  readonly mass: Float32Array
  readonly dragNormal: Float32Array
  readonly dragTangent: Float32Array
  readonly scale: Float32Array
  readonly age: Float32Array
  readonly groundAge: Float32Array
  readonly hueShift: Float32Array
  /** 0 = sakura blossom petal, 1 = cherry leaf */
  readonly isLeaf: Uint8Array
  /** Unique directional drift seed so leaves disperse naturally in different directions */
  readonly driftAngle: Float32Array
}

export interface CanopyLifecycleState {
  readonly count: number
  /** Current biological growth [0 = just shed, 0..0.35 = swelling pink bud, 1.0 = full bloom] */
  readonly growth: Float32Array
  /** Seconds remaining before a shed slot starts budding */
  readonly dormantTimer: Float32Array
  /** Growth speed (units per second) during regrowth */
  readonly growthRate: Float32Array
  /** Time spent mature; triggers abscission when exceeding lifespan */
  readonly matureAge: Float32Array
  readonly lifespan: Float32Array
}

/**
 * Coupled Botanical Regrowth & Rigid-Body Aerodynamic Falling-Leaf Physics Simulator.
 *
 * Physics modeled per falling leaf:
 * - Low-mass buoyancy gravity + anisotropic flat-plate air resistance (high broadside normal drag,
 *   low edge-on tangential drag -> authentic slow descent and sideways gliding arcs)
 * - Offset Center-of-Gravity (CoG) pendulum torque + aerodynamic Center-of-Pressure torque
 *   (`tau = (r_cp - r_cog) x F_aero + r_cog x F_gravity`) -> organic rocking flutter & helical spin
 * - Spatially varying 3D wind field + turbulent swirling eddies -> leaves drift in different directions
 * - Coupled canopy regrowth: whenever a twig sheds a leaf/blossom into the falling pool, that exact
 *   canopy slot drops to growth = 0, pauses as a dormant node, then slowly buds & regrows back to 1.0!
 */
export class SakuraLivingCanopySimulator {
  readonly slots: SakuraCanopySlot[]
  readonly canopy: CanopyLifecycleState
  readonly falling: FallingLeafPool
  private readonly rand: () => number
  private elapsed = 0
  private shedAccumulator = 0
  private fallingCursor = 0
  totalLeavesShed = 0
  totalLeavesRegrown = 0

  constructor(slots: SakuraCanopySlot[], fallingPoolSize = 240, seed = 66109) {
    this.slots = slots
    this.rand = seededRandom(seed)
    const n = slots.length

    this.canopy = {
      count: n,
      growth: new Float32Array(n),
      dormantTimer: new Float32Array(n),
      growthRate: new Float32Array(n),
      matureAge: new Float32Array(n),
      lifespan: new Float32Array(n),
    }

    for (let i = 0; i < n; i++) {
      // Most canopy slots start fully bloomed; ~14% start mid-regrowth so budding is visible immediately
      const startingBud = this.rand() < 0.14
      this.canopy.growth[i] = startingBud ? 0.15 + this.rand() * 0.55 : 0.92 + this.rand() * 0.08
      this.canopy.dormantTimer[i] = 0
      this.canopy.growthRate[i] = 0.075 + this.rand() * 0.065 // ~8-14s smooth organic regrowth
      this.canopy.lifespan[i] = 8 + this.rand() * 22
      this.canopy.matureAge[i] = startingBud ? 0 : this.rand() * this.canopy.lifespan[i] * 0.85
    }

    this.falling = {
      count: fallingPoolSize,
      phase: new Uint8Array(fallingPoolSize),
      x: new Float32Array(fallingPoolSize),
      y: new Float32Array(fallingPoolSize),
      z: new Float32Array(fallingPoolSize),
      vx: new Float32Array(fallingPoolSize),
      vy: new Float32Array(fallingPoolSize),
      vz: new Float32Array(fallingPoolSize),
      pitch: new Float32Array(fallingPoolSize),
      yaw: new Float32Array(fallingPoolSize),
      roll: new Float32Array(fallingPoolSize),
      angVx: new Float32Array(fallingPoolSize),
      angVy: new Float32Array(fallingPoolSize),
      angVz: new Float32Array(fallingPoolSize),
      cogOffset: new Float32Array(fallingPoolSize),
      mass: new Float32Array(fallingPoolSize),
      dragNormal: new Float32Array(fallingPoolSize),
      dragTangent: new Float32Array(fallingPoolSize),
      scale: new Float32Array(fallingPoolSize),
      age: new Float32Array(fallingPoolSize),
      groundAge: new Float32Array(fallingPoolSize),
      hueShift: new Float32Array(fallingPoolSize),
      isLeaf: new Uint8Array(fallingPoolSize),
      driftAngle: new Float32Array(fallingPoolSize),
    }

    // Pre-seed ~35 leaves already drifting lazily through mid-air on first frame
    const initialDrift = Math.min(35, Math.floor(fallingPoolSize * 0.3))
    for (let i = 0; i < initialDrift; i++) {
      const slotIndex = Math.floor(this.rand() * n)
      const spawned = this.spawnFallingFromSlot(slotIndex, false)
      if (spawned >= 0) {
        // Drop partway down so mid-air drift is immediately visible
        const dropFrac = 0.15 + this.rand() * 0.65
        const f = this.falling
        f.y[spawned] = Math.max(0.45, f.y[spawned] * (1 - dropFrac * 0.72))
        const spreadA = f.driftAngle[spawned]
        f.x[spawned] += Math.cos(spreadA) * dropFrac * 1.45
        f.z[spawned] += Math.sin(spreadA) * dropFrac * 1.45
      }
    }
  }

  /**
   * Evaluates a spatially varying 3D breeze + swirling eddy wind field so leaves fall in
   * genuinely different directions across the canopy and around the tree.
   */
  sampleLocalWind(x: number, y: number, z: number, windStrength: number, driftAngle: number): SakuraVec3 {
    const t = this.elapsed
    // Base gentle plaza breeze shifts direction slowly over time
    const breezeDir = 0.35 + Math.sin(t * 0.18) * 0.65
    const baseSpeed = 0.28 + windStrength * 0.92

    // Spatial curl-like turbulent eddies at different heights & azimuths
    const eddyX =
      Math.sin(y * 1.15 + t * 0.95 + z * 0.65) * 0.42 +
      Math.cos(driftAngle + t * 0.55) * (0.28 + windStrength * 0.24)
    const eddyZ =
      Math.cos(y * 1.05 - t * 0.85 + x * 0.65) * 0.42 +
      Math.sin(driftAngle - t * 0.48) * (0.28 + windStrength * 0.24)
    // Gentle convective thermal updraft eddies that momentarily lift and slow falling petals
    const thermalY = Math.sin(x * 0.9 + z * 0.85 + t * 1.25) * (0.14 + windStrength * 0.12)

    return {
      x: Math.cos(breezeDir) * baseSpeed + eddyX,
      y: thermalY,
      z: Math.sin(breezeDir) * baseSpeed + eddyZ,
    }
  }

  private spawnFallingFromSlot(slotIndex: number, resetCanopySlot = true): number {
    if (slotIndex < 0 || slotIndex >= this.slots.length) return -1
    const slot = this.slots[slotIndex]
    const f = this.falling

    // Find an inactive slot, or recycle the oldest grounded leaf
    let target = -1
    for (let probe = 0; probe < f.count; probe++) {
      const idx = (this.fallingCursor + probe) % f.count
      if (f.phase[idx] === FallingLeafPhase.Inactive) {
        target = idx
        break
      }
    }
    if (target < 0) {
      let oldestGround = -1
      let maxGroundAge = -1
      for (let i = 0; i < f.count; i++) {
        if (f.phase[i] === FallingLeafPhase.Grounded && f.groundAge[i] > maxGroundAge) {
          maxGroundAge = f.groundAge[i]
          oldestGround = i
        }
      }
      target = oldestGround >= 0 ? oldestGround : this.fallingCursor
    }
    this.fallingCursor = (target + 1) % f.count

    const az = this.rand() * Math.PI * 2
    const initSpeed = 0.08 + this.rand() * 0.24
    f.phase[target] = FallingLeafPhase.Falling
    f.x[target] = slot.x + (this.rand() - 0.5) * 0.14
    f.y[target] = slot.y - 0.04
    f.z[target] = slot.z + (this.rand() - 0.5) * 0.14
    f.vx[target] = Math.cos(az) * initSpeed
    f.vy[target] = -0.05 - this.rand() * 0.12
    f.vz[target] = Math.sin(az) * initSpeed

    f.pitch[target] = (this.rand() - 0.5) * 1.1
    f.yaw[target] = this.rand() * Math.PI * 2
    f.roll[target] = (this.rand() - 0.5) * 1.1
    f.angVx[target] = (this.rand() - 0.5) * 1.4
    f.angVy[target] = (this.rand() - 0.5) * 1.8
    f.angVz[target] = (this.rand() - 0.5) * 1.4

    // Physical properties: petals are lighter with stronger CoG stem-base offset than slightly heavier leaves
    const leafType = slot.isLeaf ? 1 : 0
    f.isLeaf[target] = leafType
    f.mass[target] = leafType ? 0.095 + this.rand() * 0.035 : 0.062 + this.rand() * 0.028
    // Center of gravity offset toward the heavier petiole/base (positive meters along local leaf axis)
    f.cogOffset[target] = leafType ? 0.22 + this.rand() * 0.14 : 0.16 + this.rand() * 0.12
    // Broadside air resistance vs thin edge-on air resistance
    f.dragNormal[target] = leafType ? 1.55 + this.rand() * 0.4 : 1.85 + this.rand() * 0.5
    f.dragTangent[target] = 0.18 + this.rand() * 0.09
    f.scale[target] = (leafType ? 0.14 : 0.115) * (0.8 + this.rand() * 0.45)
    f.age[target] = 0
    f.groundAge[target] = 0
    f.hueShift[target] = slot.hueShift
    f.driftAngle[target] = az

    if (resetCanopySlot) {
      this.canopy.growth[slotIndex] = 0.0
      this.canopy.dormantTimer[slotIndex] = 1.6 + this.rand() * 2.8
      this.canopy.matureAge[slotIndex] = 0
      this.canopy.lifespan[slotIndex] = 10 + this.rand() * 24
      this.totalLeavesShed++
    }

    return target
  }

  /**
   * Advances canopy regrowth, wind-triggered shedding, and 3D CoG/drag aerodynamics.
   * @param fallDensity Multiplier for falling sakura petal density/frequency in [0..3] (default 1.0).
   */
  step(delta: number, windStrength = 0.6, fallDensity = 1.0): void {
    const dt = Math.min(Math.max(delta, 0), 0.05)
    if (dt <= 0) return

    this.elapsed += dt
    const wind = Math.max(0, Math.min(2, Number.isFinite(windStrength) ? windStrength : 0.6))
    const density = Math.max(0, Math.min(3, Number.isFinite(fallDensity) ? fallDensity : 1.0))
    const c = this.canopy
    const f = this.falling

    // -------------------------------------------------------------------------
    // 1. Living Canopy Lifecycle: Dormant -> Budding -> Full Regrowth & Shedding
    // -------------------------------------------------------------------------
    // Controlled continuous shedding rate scaled by wind strength and user fallDensity slider
    let shedsBudget = 0
    if (density > 0.001) {
      const shedRate = (2.6 + wind * 4.4) * density
      this.shedAccumulator += dt * shedRate
      shedsBudget = Math.floor(this.shedAccumulator)
      this.shedAccumulator -= shedsBudget
    } else {
      this.shedAccumulator = 0
    }

    // Gently boost biological regrowth at high petal-storm density so the canopy stays lush
    const regrowthBoost = 1 + Math.max(0, density - 1) * 0.45

    for (let i = 0; i < c.count; i++) {
      const g = c.growth[i]
      if (g < 1.0) {
        if (c.dormantTimer[i] > 0) {
          c.dormantTimer[i] = Math.max(0, c.dormantTimer[i] - dt * regrowthBoost)
        } else {
          // Smooth botanical regrowth from tiny bud (0) to mature bloom (1)
          const nextG = Math.min(1.0, g + c.growthRate[i] * regrowthBoost * dt)
          c.growth[i] = nextG
          if (nextG >= 1.0 && g < 1.0) {
            this.totalLeavesRegrown++
          }
        }
      } else if (density > 0.001) {
        // Mature canopy cluster ages faster under stronger gusts and higher fall density
        const gustFactor = (1 + wind * this.slots[i].windWeight * 1.45) * (0.6 + 0.4 * density)
        c.matureAge[i] += dt * gustFactor
        if (shedsBudget > 0 && c.matureAge[i] >= c.lifespan[i]) {
          this.spawnFallingFromSlot(i, true)
          shedsBudget--
        }
      }
    }

    // If steady wind still has budget remaining, pick a random mature outer-canopy twig slot to shed
    let attempts = 0
    const maxAttempts = Math.max(18, shedsBudget * 4)
    while (shedsBudget > 0 && attempts < maxAttempts) {
      attempts++
      const candidate = Math.floor(this.rand() * c.count)
      if (c.growth[candidate] >= 0.96) {
        this.spawnFallingFromSlot(candidate, true)
        shedsBudget--
      }
    }

    // -------------------------------------------------------------------------
    // 2. Rigid-Body Center-of-Gravity & Anisotropic Air-Resistance Leaf Physics
    // -------------------------------------------------------------------------
    const gAcc = SAKURA_TREE_SPECS.gravity
    for (let i = 0; i < f.count; i++) {
      const ph = f.phase[i]
      if (ph === FallingLeafPhase.Inactive) continue

      if (ph === FallingLeafPhase.Grounded) {
        f.groundAge[i] += dt
        // Gently settle flat onto the ground plane
        f.pitch[i] *= Math.max(0, 1 - dt * 6)
        f.roll[i] *= Math.max(0, 1 - dt * 6)
        if (f.groundAge[i] > 14) {
          f.phase[i] = FallingLeafPhase.Inactive
        }
        continue
      }

      f.age[i] += dt

      // Sample spatially varying 3D wind field at this leaf's position
      const w = this.sampleLocalWind(f.x[i], f.y[i], f.z[i], wind, f.driftAngle[i])

      // Compute leaf orientation basis vectors from (pitch, yaw, roll)
      const cp = Math.cos(f.pitch[i])
      const sp = Math.sin(f.pitch[i])
      const cy = Math.cos(f.yaw[i])
      const sy = Math.sin(f.yaw[i])
      const cr = Math.cos(f.roll[i])
      const sr = Math.sin(f.roll[i])

      // Leaf broadside surface normal `n` (starts along +Y when flat)
      const nx = sy * sp * cr + cy * sr
      const ny = cp * cr
      const nz = cy * sp * cr - sy * sr

      // Leaf stem-to-tip longitudinal axis `fwd` (CoG sits shifted along -fwd toward petiole base)
      const fx = sy * cp
      const fy = -sp
      const fz = cy * cp

      // Relative airflow velocity (leaf velocity minus ambient wind)
      const rvx = f.vx[i] - w.x
      const rvy = f.vy[i] - w.y
      const rvz = f.vz[i] - w.z
      const relSpeed = Math.hypot(rvx, rvy, rvz)

      // Decompose relative airflow into normal (broadside) & tangential (edge-slicing) components
      const vn = rvx * nx + rvy * ny + rvz * nz
      const vtx = rvx - nx * vn
      const vty = rvy - ny * vn
      const vtz = rvz - nz * vn

      // Anisotropic air resistance: high broadside drag creates slow float, low tangential drag creates gliding
      const dn = f.dragNormal[i] * (0.45 + Math.abs(vn) * 1.15)
      const dtang = f.dragTangent[i] * (0.35 + relSpeed * 0.45)

      const dragFx = -(nx * vn * dn + vtx * dtang)
      const dragFy = -(ny * vn * dn + vty * dtang)
      const dragFz = -(nz * vn * dn + vtz * dtang)

      // Aerodynamic gliding lift sideways along leaf tilt (makes tilted leaves swoop in varied arcs!)
      const glideScale = Math.max(-0.8, Math.min(0.8, -vn * 0.58))
      const liftFx = fx * glideScale * 0.42
      const liftFy = Math.abs(vn) * 0.24 * Math.abs(ny)
      const liftFz = fz * glideScale * 0.42

      const invMass = 1 / Math.max(0.03, f.mass[i])
      const ax = (dragFx + liftFx) * invMass * 0.11
      const ay = gAcc + (dragFy + liftFy) * invMass * 0.14
      const az = (dragFz + liftFz) * invMass * 0.11

      // Integrate velocity with realistic terminal-speed air ceiling for slow, hypnotic sakura fall
      f.vx[i] = Math.max(-2.6, Math.min(2.6, f.vx[i] + ax * dt))
      f.vy[i] = Math.max(-1.05, Math.min(0.65, f.vy[i] + ay * dt))
      f.vz[i] = Math.max(-2.6, Math.min(2.6, f.vz[i] + az * dt))

      // Offset Center-of-Gravity (CoG) Torque:
      // 1) Gravitational pendulum restoring torque pulls heavier petiole base downward (pitch toward gravity)
      // 2) Aerodynamic pressure on the broad blade behind the CoG pitches/rolls leaf into natural flutter!
      const cog = f.cogOffset[i]
      const gravityPitchTorque = -cog * Math.sin(f.pitch[i]) * 5.2
      const gravityRollTorque = -cog * Math.sin(f.roll[i]) * 4.4
      const aeroPitchTorque = cog * vn * (2.8 + relSpeed * 1.6)
      const aeroRollTorque = cog * (vtx * czSafe(sy, cy) - vtz * szSafe(sy, cy)) * 2.2
      const swirlYawTorque = (vn * Math.sin(f.roll[i]) * 2.4 + (w.x * nz - w.z * nx) * 1.1)

      // Rotational air damping prevents chaotic spinning while allowing gentle rocking & helical glides
      const angDamp = Math.exp(-2.8 * dt)
      f.angVx[i] = (f.angVx[i] + (gravityPitchTorque + aeroPitchTorque) * dt) * angDamp
      f.angVy[i] = (f.angVy[i] + swirlYawTorque * dt) * Math.exp(-1.7 * dt)
      f.angVz[i] = (f.angVz[i] + (gravityRollTorque + aeroRollTorque) * dt) * angDamp

      f.pitch[i] += f.angVx[i] * dt
      f.yaw[i] += f.angVy[i] * dt
      f.roll[i] += f.angVz[i] * dt

      // Advance world-local position
      f.x[i] += f.vx[i] * dt
      f.y[i] += f.vy[i] * dt
      f.z[i] += f.vz[i] * dt

      // Ground collision: settle gently onto either the mossy planter mound or plaza stone paving
      const distFromTrunk = Math.hypot(f.x[i], f.z[i])
      const groundY = distFromTrunk < SAKURA_TREE_SPECS.planterOuterRadius ? 0.22 : 0.032
      if (f.y[i] <= groundY) {
        f.y[i] = groundY
        f.vx[i] = 0
        f.vy[i] = 0
        f.vz[i] = 0
        f.phase[i] = FallingLeafPhase.Grounded
        f.groundAge[i] = 0
      } else if (distFromTrunk > 14.0 || f.age[i] > 28) {
        // Recycle if blown far away
        f.phase[i] = FallingLeafPhase.Inactive
      }
    }
  }
}

function czSafe(sy: number, cy: number): number {
  return cy - sy * 0.25
}

function szSafe(sy: number, cy: number): number {
  return sy + cy * 0.25
}
