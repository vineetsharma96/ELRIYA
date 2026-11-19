import { seededRandom } from './world'

/**
 * Placement for the Experimental Hero Botanical Tree next to the Blossom Plaza Fountain.
 * Positioned at (5.4, 0, -3.6): 5.58m from fountain center (0, -5), giving 1.25m clear walkway
 * between the fountain's stepped plinth (3.15m) and the tree's stone planter curb (1.18m).
 */
export const EXPERIMENTAL_TREE_CENTER = { x: 5.4, y: 0, z: -3.6 } as const

export const EXPERIMENTAL_TREE_SPECS = {
  planterOuterRadius: 1.18,
  planterInnerRadius: 1.02,
  planterHeight: 0.22,
  soilTopY: 0.16,
  trunkBaseRadius: 0.34,
  trunkHeight: 2.65,
  targetCrownHeight: 6.4,
  targetCrownRadius: 3.35,
} as const

export interface Vec3Tuple {
  x: number
  y: number
  z: number
}

export interface BranchNode {
  x: number
  y: number
  z: number
  radius: number
  /** Normalized progress along this branch [0..1] */
  t: number
}

export interface TreeBranchSegment {
  id: string
  /** -1 = surface root buttress, 0 = main trunk, 1 = primary bough, 2 = secondary branch, 3 = fine twig */
  order: -1 | 0 | 1 | 2 | 3
  nodes: BranchNode[]
  radialSegments: number
}

export interface TreeLeafPlacement {
  x: number
  y: number
  z: number
  /** Outward growth direction (unit vector) */
  dirX: number
  dirY: number
  dirZ: number
  roll: number
  scale: number
  /** 0 = deep shaded interior, 1 = bright sunlit outer crown tip */
  sunExposure: number
  /** 0 = rigid near trunk, 1 = flexible outer twig tip */
  windWeight: number
  /** Color tint index / organic hue shift [0..1] */
  hueShift: number
}

export interface ExperimentalTreeSkeleton {
  branches: TreeBranchSegment[]
  leaves: TreeLeafPlacement[]
  stats: {
    rootCount: number
    primaryBoughCount: number
    secondaryBranchCount: number
    twigCount: number
    leafSprigCount: number
    maxHeight: number
    maxCanopyRadius: number
  }
}

function normalize3(x: number, y: number, z: number): Vec3Tuple {
  const len = Math.hypot(x, y, z) || 1
  return { x: x / len, y: y / len, z: z / len }
}

function cross3(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function sampleBranchAt(nodes: BranchNode[], t: number): { pos: Vec3Tuple; dir: Vec3Tuple; radius: number } {
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
    dir: normalize3(b.x - a.x, b.y - a.y, b.z - a.z),
    radius: a.radius + (b.radius - a.radius) * f,
  }
}

/**
 * Generates an organic multi-segment curved branch path starting from `origin` along `startDir`,
 * applying phototropism (gentle upward lift), natural gnarl meander, and smooth exponential taper.
 */
function growCurvedBranch(
  origin: Vec3Tuple,
  startDir: Vec3Tuple,
  length: number,
  startRadius: number,
  endRadius: number,
  segments: number,
  phototropism: number,
  gnarl: number,
  droop: number,
  rand: () => number
): BranchNode[] {
  const nodes: BranchNode[] = []
  let cx = origin.x
  let cy = origin.y
  let cz = origin.z
  let dir = normalize3(startDir.x, startDir.y, startDir.z)
  const stepLen = length / segments

  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    // Smooth botanical taper with subtle flare at base collar
    const baseCollar = i === 0 ? 1.12 : 1.0
    const radius = (startRadius * Math.pow(1 - t, 0.82) + endRadius * Math.pow(t, 0.82)) * baseCollar
    nodes.push({ x: cx, y: cy, z: cz, radius: Math.max(0.005, radius), t })

    if (i < segments) {
      // Blend gentle upward phototropism, subtle tip droop, and organic gnarl
      const gx = (rand() - 0.5) * gnarl
      const gy = (rand() - 0.5) * gnarl * 0.65 + phototropism * (1 - t * 0.45) - droop * t * t
      const gz = (rand() - 0.5) * gnarl
      dir = normalize3(dir.x + gx, dir.y + gy, dir.z + gz)
      cx += dir.x * stepLen
      cy += dir.y * stepLen
      cz += dir.z * stepLen
    }
  }
  return nodes
}

export type BotanicalTreeDetailMode = 'hero' | 'city' | 'city-low'

/**
 * Deterministically generates a full multi-order botanical skeleton (surface roots, gnarled trunk,
 * primary boughs, secondary limbs, fine twigs, and attached foliage sprig placements).
 *
 * - `mode = 'hero'`: flagship showcase geometry for the plaza fountain tree.
 * - `mode = 'city' | 'city-low'`: generates a genuinely unique branch map per `seed` (unique trunk
 *   lean, height, root count, primary bough count/azimuths/elevations/lengths, forks, and crown silhouette)
 *   tuned for high-FPS city-wide batch rendering.
 */
export function generateExperimentalTreeSkeleton(
  seed = 50741,
  lowDetail = false,
  mode: BotanicalTreeDetailMode = 'hero'
): ExperimentalTreeSkeleton {
  const rand = seededRandom(seed)
  const branches: TreeBranchSegment[] = []
  const leaves: TreeLeafPlacement[] = []

  const GOLDEN_ANGLE = 2.399963229728653 // ~137.508 degrees (botanical phyllotaxis)
  const isCity = mode !== 'hero'
  const isCityLow = mode === 'city-low' || (isCity && lowDetail)

  // ---------------------------------------------------------------------------
  // 1. ORDER 0: Tapered, organically curved main stem / trunk
  // ---------------------------------------------------------------------------
  const trunkNodes: BranchNode[] = []
  const trunkSteps = isCity ? (isCityLow ? 5 : 7) : 10
  const trunkHeight = isCity ? 2.15 + rand() * 0.85 : EXPERIMENTAL_TREE_SPECS.trunkHeight
  const trunkBaseR = isCity ? 0.25 + rand() * 0.10 : EXPERIMENTAL_TREE_SPECS.trunkBaseRadius
  const leanAz = isCity ? rand() * Math.PI * 2 : Math.PI * 1.15
  const leanAmp = isCity ? 0.08 + rand() * 0.34 : 0.28
  const sCurvePhase = isCity ? rand() * Math.PI * 2 : 0
  const sCurveAmp = isCity ? 0.04 + rand() * 0.08 : 0.06

  for (let i = 0; i <= trunkSteps; i++) {
    const t = i / trunkSteps
    const y = (isCity ? 0.0 : 0.04) + t * trunkHeight
    let leanX: number
    let leanZ: number
    if (isCity) {
      const sweep = leanAmp * Math.sin(t * Math.PI * 0.82)
      const wiggle = Math.sin(t * Math.PI * 1.85 + sCurvePhase) * sCurveAmp
      leanX = Math.cos(leanAz) * sweep - Math.sin(leanAz) * wiggle
      leanZ = Math.sin(leanAz) * sweep + Math.cos(leanAz) * wiggle
    } else {
      // Graceful subtle S-curve leaning slightly west-northwest toward the sunlit fountain
      leanX = -0.26 * Math.sin(t * Math.PI * 0.85) + Math.sin(t * Math.PI * 1.9) * 0.06
      leanZ = -0.14 * Math.sin(t * Math.PI * 0.78) + Math.cos(t * Math.PI * 1.6) * 0.04 - 0.04
    }
    // Root flare swell near bottom (t < 0.25) transitioning into clean stem taper
    const rootFlare = Math.pow(Math.max(0, 1 - t * 3.6), 2.1) * (isCity ? 0.11 : 0.14)
    const stemTaper = trunkBaseR * (1 - t * 0.44)
    trunkNodes.push({
      x: leanX,
      y,
      z: leanZ,
      radius: stemTaper + rootFlare,
      t,
    })
  }
  branches.push({
    id: 'trunk-main',
    order: 0,
    nodes: trunkNodes,
    radialSegments: isCity ? (isCityLow ? 6 : 8) : lowDetail ? 10 : 14,
  })

  // ---------------------------------------------------------------------------
  // 2. ORDER -1: Exposed Gnarled Surface Root Buttresses anchoring into soil
  // ---------------------------------------------------------------------------
  const rootCount = isCity ? (isCityLow ? 4 : 4 + Math.floor(rand() * 3)) : 6
  const rootBasePhase = isCity ? rand() * Math.PI * 2 : 0
  for (let r = 0; r < rootCount; r++) {
    const angle = rootBasePhase + (r / rootCount) * Math.PI * 2 + (rand() - 0.5) * 0.42
    const startH = 0.44 + rand() * 0.24
    const reach = (isCity ? 0.62 : 0.74) + rand() * 0.26
    const rootNodes: BranchNode[] = []
    const steps = isCity ? 3 : 5
    for (let s = 0; s <= steps; s++) {
      const f = s / steps
      const radDist = 0.14 + f * reach
      const curveAngle = angle + Math.sin(f * Math.PI) * (rand() - 0.5) * 0.22
      const y = startH * Math.pow(1 - f, 1.55) + (isCity ? 0.01 : 0.06)
      const radius = (isCity ? 0.12 : 0.145) * Math.pow(1 - f, 0.85) + 0.022
      rootNodes.push({
        x: Math.cos(curveAngle) * radDist,
        y,
        z: Math.sin(curveAngle) * radDist,
        radius,
        t: f,
      })
    }
    branches.push({
      id: `root-${r}`,
      order: -1,
      nodes: rootNodes,
      radialSegments: isCity ? 5 : lowDetail ? 6 : 8,
    })
  }

  // ---------------------------------------------------------------------------
  // 3. ORDER 1: Primary Structural Boughs (hero fixed vs unique per-seed city map)
  // ---------------------------------------------------------------------------
  interface PrimarySpec {
    attachT: number
    azimuth: number
    elevation: number
    length: number
    radiusScale: number
    phototropism: number
    droop: number
  }

  let primarySpecs: PrimarySpec[]
  if (!isCity) {
    primarySpecs = [
      // Sweeping scenic lower limb arching gracefully toward the fountain (west-southwest)
      { attachT: 0.66, azimuth: Math.PI * 1.12, elevation: 0.42, length: 2.75, radiusScale: 0.68, phototropism: 0.18, droop: 0.16 },
      // East-southeast balancing bough
      { attachT: 0.74, azimuth: 0.38, elevation: 0.52, length: 2.55, radiusScale: 0.65, phototropism: 0.20, droop: 0.12 },
      // North-northeast crown bough
      { attachT: 0.81, azimuth: -1.18, elevation: 0.58, length: 2.50, radiusScale: 0.64, phototropism: 0.22, droop: 0.10 },
      // South-southwest sunlit bough framing plaza approach
      { attachT: 0.87, azimuth: 1.92, elevation: 0.56, length: 2.40, radiusScale: 0.60, phototropism: 0.22, droop: 0.12 },
      // Northwest upper-mid bough
      { attachT: 0.93, azimuth: -2.42, elevation: 0.68, length: 2.25, radiusScale: 0.58, phototropism: 0.24, droop: 0.08 },
      // Central ascending crown leader creating full rounded dome height
      { attachT: 0.99, azimuth: -0.25, elevation: 1.12, length: 2.35, radiusScale: 0.62, phototropism: 0.16, droop: 0.04 },
    ]
  } else {
    // Unique procedural architecture style per tree: spreading oak, stately tall dome, or sculpted twin-crown
    const boughCount = isCityLow ? 4 + Math.floor(rand() * 2) : 4 + Math.floor(rand() * 3) // 4..6 unique boughs
    const baseAz = rand() * Math.PI * 2
    const spreadStyle = rand() // 0 = tall upright, 1 = broad spreading
    const hasCentralLeader = rand() > 0.28
    const radialCount = hasCentralLeader ? boughCount - 1 : boughCount

    primarySpecs = []
    for (let i = 0; i < radialCount; i++) {
      const frac = radialCount > 1 ? i / (radialCount - 1) : 0.5
      const az = baseAz + i * ((Math.PI * 2) / radialCount) + (rand() - 0.5) * 0.62
      const attachT = Math.min(0.97, 0.56 + frac * 0.36 + (rand() - 0.5) * 0.08)
      const elevation = 0.36 + (1 - spreadStyle) * 0.28 + frac * 0.16 + (rand() - 0.5) * 0.18
      const length = (1.95 + rand() * 0.88) * (0.94 + spreadStyle * 0.16)
      primarySpecs.push({
        attachT,
        azimuth: az,
        elevation: Math.max(0.28, Math.min(1.02, elevation)),
        length,
        radiusScale: 0.56 + rand() * 0.16,
        phototropism: 0.12 + rand() * 0.16,
        droop: 0.07 + spreadStyle * 0.12 + rand() * 0.08,
      })
    }
    if (hasCentralLeader) {
      primarySpecs.push({
        attachT: 0.98,
        azimuth: baseAz + rand() * Math.PI * 2,
        elevation: 0.94 + rand() * 0.28,
        length: 1.85 + rand() * 0.72,
        radiusScale: 0.58 + rand() * 0.12,
        phototropism: 0.14 + rand() * 0.1,
        droop: 0.04 + rand() * 0.06,
      })
    }
  }

  let secondaryBranchCount = 0
  let twigCount = 0
  const leafScaleMin = isCity ? (isCityLow ? 0.78 : 0.60) : 0.36
  const leafScaleSpan = isCity ? (isCityLow ? 0.36 : 0.34) : 0.26

  primarySpecs.forEach((spec, bIdx) => {
    const parent = sampleBranchAt(trunkNodes, spec.attachT)
    const dir = normalize3(
      Math.cos(spec.azimuth) * Math.cos(spec.elevation),
      Math.sin(spec.elevation),
      Math.sin(spec.azimuth) * Math.cos(spec.elevation)
    )
    const startRadius = parent.radius * spec.radiusScale
    const endRadius = startRadius * 0.42
    const boughNodes = growCurvedBranch(
      parent.pos,
      dir,
      spec.length,
      startRadius,
      endRadius,
      isCity ? (isCityLow ? 4 : 5) : lowDetail ? 6 : 8,
      spec.phototropism,
      isCity ? 0.18 + rand() * 0.10 : 0.16,
      spec.droop,
      rand
    )
    branches.push({
      id: `bough-${bIdx}`,
      order: 1,
      nodes: boughNodes,
      radialSegments: isCity ? (isCityLow ? 5 : 6) : lowDetail ? 7 : 10,
    })

    // -------------------------------------------------------------------------
    // 4. ORDER 2: Secondary Limbs forking along each primary bough
    // -------------------------------------------------------------------------
    const secCount = isCity
      ? isCityLow
        ? 2
        : 2 + Math.floor(rand() * 2) // 2..3 uniquely per bough
      : bIdx === 5
        ? 4
        : 3 + (bIdx % 2)
    for (let s = 0; s < secCount; s++) {
      const attachT = secCount > 1 ? 0.34 + (s / (secCount - 1)) * 0.60 : 0.62
      const secOrigin = sampleBranchAt(boughNodes, attachT)
      const sideSign = (s + bIdx) % 2 === 0 ? 1 : -1
      const upRef: Vec3Tuple = { x: 0, y: 1, z: 0 }
      let lateral = cross3(secOrigin.dir, upRef)
      if (Math.hypot(lateral.x, lateral.y, lateral.z) < 0.1) {
        lateral = { x: 1, y: 0, z: 0 }
      }
      lateral = normalize3(lateral.x, lateral.y, lateral.z)

      const spreadAngle = (0.48 + rand() * 0.42) * sideSign
      const lift = 0.20 + rand() * 0.36
      const secDir = normalize3(
        secOrigin.dir.x + lateral.x * spreadAngle + (rand() - 0.5) * 0.28,
        secOrigin.dir.y + lift,
        secOrigin.dir.z + lateral.z * spreadAngle + (rand() - 0.5) * 0.28
      )
      const secLen = (1.05 + rand() * 0.72) * (1.08 - attachT * 0.25)
      const secStartR = Math.max(0.024, secOrigin.radius * 0.72)
      const secEndR = Math.max(0.011, secStartR * 0.38)
      const secNodes = growCurvedBranch(
        secOrigin.pos,
        secDir,
        secLen,
        secStartR,
        secEndR,
        isCity ? 3 : lowDetail ? 4 : 5,
        0.14,
        0.24,
        0.14,
        rand
      )
      branches.push({
        id: `sec-${bIdx}-${s}`,
        order: 2,
        nodes: secNodes,
        radialSegments: isCity ? 4 : lowDetail ? 5 : 7,
      })
      secondaryBranchCount++

      // -----------------------------------------------------------------------
      // 5. ORDER 3: Fine Twigs & Terminal Shoots branching off secondary limbs
      // -----------------------------------------------------------------------
      const localTwigs = isCity ? (isCityLow ? 1 : 2) : lowDetail ? 2 : 3
      for (let tw = 0; tw < localTwigs; tw++) {
        const twAttachT = localTwigs > 1 ? 0.36 + (tw / (localTwigs - 1)) * 0.60 : 0.72
        const twOrigin = sampleBranchAt(secNodes, twAttachT)
        const twAz = (bIdx * 5 + s * 3 + tw) * GOLDEN_ANGLE + rand() * 0.65
        const twDir = normalize3(
          twOrigin.dir.x * 0.75 + Math.cos(twAz) * 0.62,
          twOrigin.dir.y * 0.65 + 0.22 + (rand() - 0.35) * 0.35,
          twOrigin.dir.z * 0.75 + Math.sin(twAz) * 0.62
        )
        const twLen = 0.52 + rand() * 0.44
        const twStartR = Math.max(0.012, twOrigin.radius * 0.68)
        const twEndR = 0.006
        const twNodes = growCurvedBranch(
          twOrigin.pos,
          twDir,
          twLen,
          twStartR,
          twEndR,
          isCity ? 2 : 3,
          0.08,
          0.26,
          0.16,
          rand
        )
        branches.push({
          id: `twig-${bIdx}-${s}-${tw}`,
          order: 3,
          nodes: twNodes,
          radialSegments: isCity ? 4 : 5,
        })
        twigCount++

        const sprigsPerTwig = isCity ? (isCityLow ? 4 : 4) : lowDetail ? 13 : 20
        attachLeafSprigsToBranch(twNodes, sprigsPerTwig, 0.18, 1.0, 0.75, leafScaleMin, leafScaleSpan, rand, leaves)
      }

      const sprigsPerSec = isCity ? (isCityLow ? 3 : 4) : lowDetail ? 8 : 12
      attachLeafSprigsToBranch(secNodes, sprigsPerSec, 0.44, 1.0, 0.52, leafScaleMin, leafScaleSpan, rand, leaves)
    }

    // Add terminal twig bouquet right at the tip of every primary bough
    const tipOrigin = sampleBranchAt(boughNodes, 0.96)
    const tipTwigs = isCity ? (isCityLow ? 1 : 2) : lowDetail ? 2 : 3
    for (let tt = 0; tt < tipTwigs; tt++) {
      const a = (bIdx * 7 + tt) * GOLDEN_ANGLE + (isCity ? rand() * 0.7 : 0)
      const tDir = normalize3(
        tipOrigin.dir.x + Math.cos(a) * 0.55,
        tipOrigin.dir.y + 0.25 + rand() * 0.25,
        tipOrigin.dir.z + Math.sin(a) * 0.55
      )
      const tNodes = growCurvedBranch(
        tipOrigin.pos,
        tDir,
        0.58 + rand() * 0.36,
        Math.max(0.015, tipOrigin.radius * 0.72),
        0.006,
        isCity ? 2 : 3,
        0.10,
        0.24,
        0.14,
        rand
      )
      branches.push({
        id: `tip-twig-${bIdx}-${tt}`,
        order: 3,
        nodes: tNodes,
        radialSegments: isCity ? 4 : 5,
      })
      twigCount++
      attachLeafSprigsToBranch(
        tNodes,
        isCity ? (isCityLow ? 4 : 5) : lowDetail ? 14 : 22,
        0.15,
        1.0,
        0.88,
        leafScaleMin,
        leafScaleSpan,
        rand,
        leaves
      )
    }
  })

  // Compute structural bounding metrics for diagnostics & tests
  let maxHeight = 0
  let maxCanopyRadius = 0
  for (const b of branches) {
    for (const n of b.nodes) {
      if (n.y > maxHeight) maxHeight = n.y
      const r = Math.hypot(n.x, n.z)
      if (r > maxCanopyRadius) maxCanopyRadius = r
    }
  }
  for (const lf of leaves) {
    if (lf.y > maxHeight) maxHeight = lf.y
    const r = Math.hypot(lf.x, lf.z)
    if (r > maxCanopyRadius) maxCanopyRadius = r
  }

  return {
    branches,
    leaves,
    stats: {
      rootCount,
      primaryBoughCount: primarySpecs.length,
      secondaryBranchCount,
      twigCount,
      leafSprigCount: leaves.length,
      maxHeight: Number(maxHeight.toFixed(2)),
      maxCanopyRadius: Number(maxCanopyRadius.toFixed(2)),
    },
  }
}

function attachLeafSprigsToBranch(
  nodes: BranchNode[],
  count: number,
  minT: number,
  maxT: number,
  baseWindWeight: number,
  scaleMin: number,
  scaleSpan: number,
  rand: () => number,
  out: TreeLeafPlacement[]
): void {
  const GOLDEN_ANGLE = 2.399963229728653
  for (let i = 0; i < count; i++) {
    const frac = count > 1 ? i / (count - 1) : 1
    const t = minT + (maxT - minT) * Math.min(1, Math.max(0, frac + (rand() - 0.5) * 0.12))
    const sample = sampleBranchAt(nodes, t)

    // Phyllotactic radial offset so leaves fan organically around the twig without overlapping flatly
    const spiralAngle = i * GOLDEN_ANGLE + rand() * 0.55
    const radialOffset = 0.04 + (0.14 + rand() * 0.24) * (0.55 + frac * 0.65)
    const ox = Math.cos(spiralAngle) * radialOffset
    const oz = Math.sin(spiralAngle) * radialOffset
    const oy = (rand() - 0.35) * 0.22

    const x = sample.pos.x + ox
    const y = Math.max(1.85, sample.pos.y + oy)
    const z = sample.pos.z + oz

    // Outward hemispherical crown orientation so leaves face sunlight naturally
    const crownOut = normalize3(x * 0.45 + ox * 1.4, 0.42 + (y - 2.6) * 0.18 + rand() * 0.35, z * 0.45 + oz * 1.4)
    const radialDist = Math.hypot(x, z)
    const sunExposure = Math.max(0, Math.min(1, (y - 2.2) / 3.8 * 0.62 + (radialDist / 3.4) * 0.38))
    const windWeight = Math.max(0.2, Math.min(1, baseWindWeight * (0.65 + 0.35 * frac)))

    out.push({
      x,
      y,
      z,
      dirX: crownOut.x,
      dirY: crownOut.y,
      dirZ: crownOut.z,
      roll: (rand() - 0.5) * Math.PI * 1.25,
      scale: scaleMin + rand() * scaleSpan,
      sunExposure,
      windWeight,
      hueShift: rand(),
    })
  }
}
