import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  EXPERIMENTAL_TREE_CENTER,
  EXPERIMENTAL_TREE_SPECS,
  generateExperimentalTreeSkeleton,
  type TreeBranchSegment,
} from '../core/experimentalTree'
import type { WindField } from './Assets'
import type { EnvironmentLightingSnapshot } from './lighting'

const _sunDir = new THREE.Vector3()

/**
 * Generates procedural furrowed deciduous bark albedo + bump CanvasTextures
 * with vertical fissures, warm umber ridges, fine lenticels, and subtle moss/lichen flecks.
 */
export function createBarkTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture
  bumpMap: THREE.CanvasTexture
} {
  const size = 512
  const colorCanvas = document.createElement('canvas')
  colorCanvas.width = size
  colorCanvas.height = size
  const ctx = colorCanvas.getContext('2d')

  const bumpCanvas = document.createElement('canvas')
  bumpCanvas.width = size
  bumpCanvas.height = size
  const bCtx = bumpCanvas.getContext('2d')

  if (ctx && bCtx) {
    ctx.fillStyle = '#4e3c30'
    ctx.fillRect(0, 0, size, size)
    bCtx.fillStyle = '#7c7c7c'
    bCtx.fillRect(0, 0, size, size)

    let seed = 91823
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }

    // Deep vertical bark furrows and irregular plate ridges
    for (let i = 0; i < 160; i++) {
      const baseX = rand() * size
      const width = 2.5 + rand() * 8.5
      const isFissure = rand() < 0.44
      ctx.strokeStyle = isFissure
        ? `rgba(34, 24, 18, ${0.42 + rand() * 0.35})`
        : `rgba(104, 83, 66, ${0.32 + rand() * 0.30})`
      ctx.lineWidth = width
      ctx.beginPath()

      bCtx.strokeStyle = isFissure
        ? `rgba(26, 26, 26, ${0.65 + rand() * 0.3})`
        : `rgba(218, 218, 218, ${0.52 + rand() * 0.32})`
      bCtx.lineWidth = width
      bCtx.beginPath()

      let x = baseX
      ctx.moveTo(x, 0)
      bCtx.moveTo(x, 0)
      for (let y = 24; y <= size; y += 24) {
        x += (rand() - 0.5) * 9
        ctx.lineTo(x, y)
        bCtx.lineTo(x, y)
      }
      ctx.stroke()
      bCtx.stroke()
    }

    // Fine horizontal bark lenticels & cross-grain roughness
    for (let i = 0; i < 420; i++) {
      const x = rand() * size
      const y = rand() * size
      const len = 4 + rand() * 16
      ctx.fillStyle = rand() > 0.5 ? 'rgba(130, 108, 86, 0.24)' : 'rgba(30, 21, 16, 0.26)'
      ctx.fillRect(x, y, len, 1.5)
      bCtx.fillStyle = 'rgba(185, 185, 185, 0.25)'
      bCtx.fillRect(x, y, len, 1.5)
    }

    // Subtle organic sage-lichen flecks tucked into bark crevices
    for (let i = 0; i < 65; i++) {
      const x = rand() * size
      const y = rand() * size
      const rx = 3 + rand() * 9
      const ry = 2 + rand() * 6
      ctx.fillStyle = `rgba(110, 128, 92, ${0.14 + rand() * 0.14})`
      ctx.beginPath()
      ctx.ellipse(x, y, rx, ry, rand() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.RepeatWrapping
  map.anisotropy = maxAnisotropy

  const bumpMap = new THREE.CanvasTexture(bumpCanvas)
  bumpMap.wrapS = THREE.RepeatWrapping
  bumpMap.wrapT = THREE.RepeatWrapping
  bumpMap.anisotropy = maxAnisotropy

  return { map, bumpMap }
}

/**
 * Draws a single realistic serrated ovate-acuminate botanical leaf with midrib & pinnate veins.
 */
function drawSerratedLeaf(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  length: number,
  maxWidth: number,
  angle: number,
  tintShift: number
) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)

  const steps = 26
  ctx.beginPath()
  ctx.moveTo(0, 0)

  // Right serrated margin (base -> acuminate tip)
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const envelope = Math.sin(Math.pow(t, 0.78) * Math.PI) * (1 - 0.16 * t)
    const serration =
      t > 0.12 && t < 0.92 ? (i % 2 === 0 ? 1.07 : 0.92) : 1.0
    const x = maxWidth * envelope * serration
    const y = -length * t
    ctx.lineTo(x, y)
  }
  // Left serrated margin (tip -> base)
  for (let i = steps - 1; i >= 0; i--) {
    const t = i / steps
    const envelope = Math.sin(Math.pow(t, 0.78) * Math.PI) * (1 - 0.16 * t)
    const serration =
      t > 0.12 && t < 0.92 ? (i % 2 === 0 ? 1.07 : 0.92) : 1.0
    const x = -maxWidth * envelope * serration
    const y = -length * t
    ctx.lineTo(x, y)
  }
  ctx.closePath()

  // Rich natural botanical blade gradient (deeper emerald base -> luminous spring leaf tip)
  const grad = ctx.createLinearGradient(0, 0, 0, -length)
  const gBase = Math.round(138 + tintShift * 18)
  const gMid = Math.round(168 + tintShift * 20)
  const gTip = Math.round(196 + tintShift * 18)
  grad.addColorStop(0, `rgb(${Math.round(78 + tintShift * 14)}, ${gBase}, ${Math.round(58 + tintShift * 10)})`)
  grad.addColorStop(0.55, `rgb(${Math.round(104 + tintShift * 18)}, ${gMid}, ${Math.round(68 + tintShift * 12)})`)
  grad.addColorStop(1, `rgb(${Math.round(142 + tintShift * 20)}, ${gTip}, ${Math.round(82 + tintShift * 12)})`)
  ctx.fillStyle = grad
  ctx.fill()

  // Subtle darker chlorophyll margin rim
  ctx.strokeStyle = 'rgba(54, 92, 44, 0.55)'
  ctx.lineWidth = 1.6
  ctx.stroke()

  // Translucent central midrib
  ctx.strokeStyle = 'rgba(205, 228, 138, 0.76)'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(0, -2)
  ctx.lineTo(0, -length * 0.92)
  ctx.stroke()

  // 7 pairs of curving pinnate lateral veins
  ctx.strokeStyle = 'rgba(196, 222, 130, 0.48)'
  ctx.lineWidth = 1.25
  for (let v = 1; v <= 7; v++) {
    const t = v * 0.115
    const y0 = -length * t
    const reach = maxWidth * Math.sin(Math.pow(t, 0.78) * Math.PI) * 0.84
    const yTip = y0 - length * 0.11
    for (const side of [-1, 1] as const) {
      ctx.beginPath()
      ctx.moveTo(0, y0)
      ctx.quadraticCurveTo(side * reach * 0.55, y0 - length * 0.035, side * reach, yTip)
      ctx.stroke()
    }
  }

  ctx.restore()
}

/**
 * Generates a high-resolution 512×512 procedural RGBA botanical 5-leaflet sprig texture
 * (woody-green central stem + 5 serrated veined leaves) for crisp alpha-tested foliage cards.
 */
export function createLeafSprigTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  if (ctx) {
    ctx.clearRect(0, 0, size, size)

    // Delicate central woody-green twig petiole stem
    ctx.strokeStyle = '#68593c'
    ctx.lineWidth = 7
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(256, 488)
    ctx.quadraticCurveTo(251, 355, 256, 200)
    ctx.stroke()

    // Short lateral petioles
    ctx.strokeStyle = '#6f6c40'
    ctx.lineWidth = 4.5
    const stems: [number, number, number, number][] = [
      [254, 410, 198, 372],
      [257, 400, 314, 364],
      [253, 305, 192, 260],
      [258, 296, 320, 252],
    ]
    for (const [x0, y0, x1, y1] of stems) {
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
    }

    // 5 serrated ovate-acuminate leaves arranged in a natural botanical sprig
    drawSerratedLeaf(ctx, 200, 376, 152, 54, -1.04, -0.3) // Lower left
    drawSerratedLeaf(ctx, 312, 368, 156, 55, 1.02, 0.1)   // Lower right
    drawSerratedLeaf(ctx, 194, 264, 174, 62, -0.78, 0.2)  // Upper left
    drawSerratedLeaf(ctx, 318, 256, 172, 60, 0.76, -0.1)  // Upper right
    drawSerratedLeaf(ctx, 256, 206, 186, 66, 0.02, 0.45)  // Terminal crown leaf
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = maxAnisotropy
  return tex
}

/**
 * Generates a rich dark humus soil & scattered moss CanvasTexture for the tree-well planter.
 */
function createSoilTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#3c3024'
    ctx.fillRect(0, 0, size, size)
    let seed = 7731
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }
    for (let i = 0; i < 1600; i++) {
      const x = rand() * size
      const y = rand() * size
      const r = 1 + rand() * 3.5
      const roll = rand()
      ctx.fillStyle =
        roll < 0.22
          ? 'rgba(84, 118, 62, 0.45)' // Soft moss patches
          : roll < 0.65
            ? 'rgba(42, 32, 24, 0.55)'
            : 'rgba(92, 74, 54, 0.45)'
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = maxAnisotropy
  return tex
}

/**
 * Builds one single merged, smoothly tapered, UV-mapped wood skeleton BufferGeometry
 * covering all root buttresses, the fluted trunk, primary boughs, secondary branches, and twigs.
 */
function buildMergedWoodGeometry(branches: TreeBranchSegment[]): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  let vertexOffset = 0

  const p0 = new THREE.Vector3()
  const p1 = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const prevTangent = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const binormal = new THREE.Vector3()
  const rotQuat = new THREE.Quaternion()
  const refAxis = new THREE.Vector3()

  for (const branch of branches) {
    const nodes = branch.nodes
    if (nodes.length < 2) continue
    const radSegs = branch.radialSegments
    const ringStride = radSegs + 1
    let arcLen = 0

    for (let i = 0; i < nodes.length; i++) {
      const cur = nodes[i]
      p0.set(cur.x, cur.y, cur.z)
      if (i > 0) {
        arcLen += Math.hypot(
          cur.x - nodes[i - 1].x,
          cur.y - nodes[i - 1].y,
          cur.z - nodes[i - 1].z
        )
      }

      if (i < nodes.length - 1) {
        p1.set(nodes[i + 1].x, nodes[i + 1].y, nodes[i + 1].z)
        tangent.subVectors(p1, p0).normalize()
      } else {
        p1.set(nodes[i - 1].x, nodes[i - 1].y, nodes[i - 1].z)
        tangent.subVectors(p0, p1).normalize()
      }

      // Parallel-transport frame prevents sudden twisting along curved organic branches
      if (i === 0) {
        refAxis.set(Math.abs(tangent.y) > 0.92 ? 1 : 0, Math.abs(tangent.y) > 0.92 ? 0 : 1, 0)
        normal.crossVectors(tangent, refAxis).normalize()
        binormal.crossVectors(tangent, normal).normalize()
      } else {
        rotQuat.setFromUnitVectors(prevTangent, tangent)
        normal.applyQuaternion(rotQuat).normalize()
        binormal.crossVectors(tangent, normal).normalize()
      }
      prevTangent.copy(tangent)

      const vCoord = arcLen * (branch.order <= 0 ? 0.85 : 1.35)

      for (let j = 0; j <= radSegs; j++) {
        const uFrac = j / radSegs
        const theta = uFrac * Math.PI * 2
        const c = Math.cos(theta)
        const s = Math.sin(theta)

        // Subtle organic 6-ridge root-collar fluting near base of main trunk
        let r = cur.radius
        if (branch.order === 0 && cur.t < 0.36) {
          const fluteStrength = (1 - cur.t / 0.36) * 0.13
          r *= 1 + Math.cos(theta * 6) * fluteStrength
        }

        const nx = normal.x * c + binormal.x * s
        const ny = normal.y * c + binormal.y * s
        const nz = normal.z * c + binormal.z * s

        positions.push(p0.x + nx * r, p0.y + ny * r, p0.z + nz * r)
        normals.push(nx, ny, nz)
        uvs.push(uFrac * Math.max(1, cur.radius * 6), vCoord)
      }
    }

    for (let i = 0; i < nodes.length - 1; i++) {
      for (let j = 0; j < radSegs; j++) {
        const a = vertexOffset + i * ringStride + j
        const b = vertexOffset + (i + 1) * ringStride + j
        const c = vertexOffset + (i + 1) * ringStride + (j + 1)
        const d = vertexOffset + i * ringStride + (j + 1)
        indices.push(a, d, b, b, d, c)
      }
    }

    vertexOffset += nodes.length * ringStride
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

/**
 * Builds a sculpted 3D compound botanical leaf sprig mesh (two angled, gently cambered &
 * drooping 3x3 curved planes pivoted at the petiole stem base) so foliage has rich volume
 * from every angle and never disappears edge-on.
 */
export function buildSculptedLeafSprigGeometry(segX = 2, segY = 3): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  let offset = 0

  const planes: { yaw: number; pitch: number; yShift: number; scale: number }[] = [
    { yaw: 0, pitch: 0.18, yShift: 0, scale: 1.0 },
    { yaw: Math.PI * 0.42, pitch: -0.14, yShift: 0.04, scale: 0.88 },
  ]

  const v = new THREE.Vector3()
  const rot = new THREE.Euler()

  for (const cfg of planes) {
    rot.set(cfg.pitch, cfg.yaw, 0)
    for (let iy = 0; iy <= segY; iy++) {
      const fy = iy / segY // 0 at stem base, 1 at crown leaf tip
      for (let ix = 0; ix <= segX; ix++) {
        const fx = ix / segX // 0..1 across width
        const xLocal = (fx - 0.5) * 0.92 * cfg.scale
        const yLocal = fy * 1.04 * cfg.scale + cfg.yShift
        // Natural V-trough cup across width + graceful arch & downward tip droop along length
        const cup = Math.abs(fx - 0.5) * 0.16 * cfg.scale
        const arch = Math.sin(fy * Math.PI) * 0.11 * cfg.scale - fy * fy * 0.14 * cfg.scale
        const zLocal = cup + arch

        v.set(xLocal, yLocal, zLocal).applyEuler(rot)
        positions.push(v.x, v.y, v.z)
        // Soft hemispherical outward normal prevents harsh dark back-faces on foliage cards
        normals.push(v.x * 0.35, 0.78, v.z * 0.35 + 0.4)
        uvs.push(fx, fy)
      }
    }

    const row = segX + 1
    for (let iy = 0; iy < segY; iy++) {
      for (let ix = 0; ix < segX; ix++) {
        const a = offset + iy * row + ix
        const b = offset + iy * row + ix + 1
        const c = offset + (iy + 1) * row + ix + 1
        const d = offset + (iy + 1) * row + ix
        indices.push(a, b, d, b, c, d)
      }
    }
    offset += (segX + 1) * (segY + 1)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeBoundingSphere()
  return geo
}

/**
 * Builds the carved stone tree-well planter curb LatheGeometry seated flush on Plaza paving.
 */
function buildPlanterCurbGeometry(): THREE.LatheGeometry {
  const rOut = EXPERIMENTAL_TREE_SPECS.planterOuterRadius
  const rIn = EXPERIMENTAL_TREE_SPECS.planterInnerRadius
  const h = EXPERIMENTAL_TREE_SPECS.planterHeight
  const pts = [
    new THREE.Vector2(rIn, 0.01),
    new THREE.Vector2(rOut + 0.04, 0.01),
    new THREE.Vector2(rOut + 0.04, 0.07),
    new THREE.Vector2(rOut, 0.11),
    new THREE.Vector2(rOut, h - 0.03),
    new THREE.Vector2(rOut - 0.03, h),
    new THREE.Vector2(rIn + 0.03, h),
    new THREE.Vector2(rIn, h - 0.03),
    new THREE.Vector2(rIn, 0.01),
  ]
  return new THREE.LatheGeometry(pts, 24)
}

export interface ExperimentalTreeProps {
  wind: WindField
  lightingState: EnvironmentLightingSnapshot
  lowDetail: boolean
}

export function ExperimentalTree({ wind, lightingState, lowDetail }: ExperimentalTreeProps) {
  const { gl } = useThree()
  const foliageRef = useRef<THREE.InstancedMesh>(null!)

  const skeleton = useMemo(() => generateExperimentalTreeSkeleton(50741, lowDetail), [lowDetail])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWind: { value: 0.6 },
      uDaylight: { value: 1 },
      uSunDir: { value: new THREE.Vector3(0.45, 0.75, -0.35).normalize() },
      uSunColor: { value: new THREE.Color('#fff2d3') },
    }),
    []
  )

  const resources = useMemo(() => {
    const maxAnisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy?.() ?? 4)
    const { map: barkMap, bumpMap: barkBump } = createBarkTextures(maxAnisotropy)
    const leafMap = createLeafSprigTexture(maxAnisotropy)
    const soilMap = createSoilTexture(maxAnisotropy)

    const woodGeometry = buildMergedWoodGeometry(skeleton.branches)
    const leafGeometry = buildSculptedLeafSprigGeometry()
    const planterCurbGeometry = buildPlanterCurbGeometry()

    // Per-instance wind & sun attributes attached directly to leafGeometry
    const leafCount = skeleton.leaves.length
    const aLeafData = new Float32Array(leafCount * 3)
    for (let i = 0; i < leafCount; i++) {
      const lf = skeleton.leaves[i]
      aLeafData[i * 3 + 0] = (i * 1.6180339) % (Math.PI * 2) // phase
      aLeafData[i * 3 + 1] = lf.windWeight
      aLeafData[i * 3 + 2] = lf.sunExposure
    }
    leafGeometry.setAttribute('aLeafData', new THREE.InstancedBufferAttribute(aLeafData, 3))

    const barkMaterial = new THREE.MeshStandardMaterial({
      map: barkMap,
      bumpMap: barkBump,
      bumpScale: 0.042,
      color: '#d8cbbd',
      roughness: 0.90,
      metalness: 0.0,
    })

    const planterStoneMat = new THREE.MeshStandardMaterial({
      color: '#e5dac3',
      roughness: 0.80,
      metalness: 0.02,
    })

    const soilMat = new THREE.MeshStandardMaterial({
      map: soilMap,
      roughness: 0.96,
      metalness: 0.0,
    })

    // PBR Foliage material extended via onBeforeCompile for realistic wind flutter & sunlit translucency
    const leafMaterial = new THREE.MeshStandardMaterial({
      map: leafMap,
      alphaTest: 0.42,
      roughness: 0.46,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })
    leafMaterial.customProgramCacheKey = () => 'elyria-experimental-foliage-v1'
    leafMaterial.onBeforeCompile = shader => {
      shader.uniforms.uTime = uniforms.uTime
      shader.uniforms.uWind = uniforms.uWind
      shader.uniforms.uDaylight = uniforms.uDaylight
      shader.uniforms.uSunDir = uniforms.uSunDir
      shader.uniforms.uSunColor = uniforms.uSunColor

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute vec3 aLeafData;
          uniform float uTime;
          uniform float uWind;
          varying float vSunExposure;
          varying vec3 vLeafWorldPos;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float leafPhase = aLeafData.x;
          float windWeight = aLeafData.y;
          vSunExposure = aLeafData.z;
          float tipFlex = clamp(position.y, 0.0, 1.0);
          float windStrength = 0.25 + uWind * 1.15;
          // Primary bough breeze sway + delicate leaf-tip flutter
          float primarySway = sin(uTime * 1.65 + leafPhase) * 0.055 * windWeight * windStrength;
          float flutter = sin(uTime * 5.2 + leafPhase * 3.1 + position.x * 6.0) * 0.026 * tipFlex * windStrength;
          transformed.x += (primarySway + flutter);
          transformed.z += cos(uTime * 1.35 + leafPhase * 1.4) * 0.042 * windWeight * windStrength;
          transformed.y += sin(uTime * 3.8 + leafPhase * 2.2) * 0.015 * tipFlex * windStrength;`
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          #ifdef USE_INSTANCING
            vLeafWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          #else
            vLeafWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          #endif`
        )

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uDaylight;
          uniform vec3 uSunDir;
          uniform vec3 uSunColor;
          varying float vSunExposure;
          varying vec3 vLeafWorldPos;`
        )
        .replace(
          '#include <opaque_fragment>',
          `// View-dependent sunlit subsurface scattering translucency through thin leaves
          vec3 leafViewDir = normalize(cameraPosition - vLeafWorldPos);
          float backLight = pow(clamp(dot(leafViewDir, -normalize(uSunDir)), 0.0, 1.0), 2.8);
          float skyLift = 0.14 + 0.34 * vSunExposure;
          vec3 sssTint = vec3(0.62, 0.82, 0.24) * uSunColor;
          outgoingLight += diffuseColor.rgb * sssTint * (backLight * 0.72 + skyLift * 0.22) * uDaylight;
          #include <opaque_fragment>`
        )
    }

    return {
      barkMap,
      barkBump,
      leafMap,
      soilMap,
      woodGeometry,
      leafGeometry,
      planterCurbGeometry,
      barkMaterial,
      planterStoneMat,
      soilMat,
      leafMaterial,
    }
  }, [gl, skeleton, uniforms])

  // Dispose GPU resources safely without breaking under React 19 StrictMode double-mount
  const activeResourcesRef = useRef<typeof resources | null>(null)
  useEffect(() => {
    activeResourcesRef.current = resources
    return () => {
      activeResourcesRef.current = null
      const toDispose = resources
      queueMicrotask(() => {
        if (activeResourcesRef.current !== toDispose) {
          toDispose.barkMap.dispose()
          toDispose.barkBump.dispose()
          toDispose.leafMap.dispose()
          toDispose.soilMap.dispose()
          toDispose.woodGeometry.dispose()
          toDispose.leafGeometry.dispose()
          toDispose.planterCurbGeometry.dispose()
          toDispose.barkMaterial.dispose()
          toDispose.planterStoneMat.dispose()
          toDispose.soilMat.dispose()
          toDispose.leafMaterial.dispose()
        }
      })
    }
  }, [resources])

  // Populate all instanced botanical leaf sprigs with natural crown orientation & depth shading
  useLayoutEffect(() => {
    const mesh = foliageRef.current
    if (!mesh) return

    const dummy = new THREE.Object3D()
    const up = new THREE.Vector3(0, 1, 0)
    const dir = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const rollQuat = new THREE.Quaternion()
    const color = new THREE.Color()

    const deepShadeCol = new THREE.Color('#476b37')
    const midEmeraldCol = new THREE.Color('#7ca64e')
    const sunlitGoldCol = new THREE.Color('#b6cc62')
    const springBlushCol = new THREE.Color('#9ec46a')

    skeleton.leaves.forEach((lf, i) => {
      dir.set(lf.dirX, lf.dirY, lf.dirZ).normalize()
      quat.setFromUnitVectors(up, dir)
      rollQuat.setFromAxisAngle(dir, lf.roll)
      quat.premultiply(rollQuat)

      dummy.position.set(lf.x, lf.y, lf.z)
      dummy.quaternion.copy(quat)
      dummy.scale.setScalar(lf.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      // Natural botanical color stratification: deeper shade inside crown, golden-green tips outside
      if (lf.sunExposure < 0.5) {
        color.copy(deepShadeCol).lerp(midEmeraldCol, lf.sunExposure * 2)
      } else {
        color.copy(midEmeraldCol).lerp(lf.hueShift > 0.65 ? sunlitGoldCol : springBlushCol, (lf.sunExposure - 0.5) * 2)
      }
      color.offsetHSL((lf.hueShift - 0.5) * 0.04, (lf.hueShift - 0.5) * 0.06, (lf.hueShift - 0.5) * 0.05)
      mesh.setColorAt(i, color)
    })

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [skeleton])

  useFrame(() => {
    uniforms.uTime.value = wind.time
    uniforms.uWind.value = wind.value
    uniforms.uDaylight.value = lightingState.daylight
    _sunDir.copy(lightingState.keyLightPosition).normalize()
    uniforms.uSunDir.value.copy(_sunDir)
    uniforms.uSunColor.value.copy(lightingState.sunColor)
  })

  return (
    <group
      position={[EXPERIMENTAL_TREE_CENTER.x, EXPERIMENTAL_TREE_CENTER.y, EXPERIMENTAL_TREE_CENTER.z]}
      name="experimental-hero-tree"
    >
      {/* 1. Carved Travertine Stone Tree-Well Planter Curb */}
      <mesh
        geometry={resources.planterCurbGeometry}
        material={resources.planterStoneMat}
        castShadow
        receiveShadow
      />

      {/* 2. Sculpted Mossy Humus Soil Mound anchoring the exposed surface roots */}
      <mesh position={[0, 0.11, 0]} scale={[1, 0.18, 1]} material={resources.soilMat} receiveShadow>
        <sphereGeometry args={[EXPERIMENTAL_TREE_SPECS.planterInnerRadius + 0.02, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
      </mesh>

      {/* 3. Merged Multi-Order Wood Skeleton (6 Root Buttresses, Fluted Trunk, Primary Boughs, Secondary Limbs, Twigs) */}
      <mesh
        geometry={resources.woodGeometry}
        material={resources.barkMaterial}
        castShadow
        receiveShadow
      />

      {/* 4. Instanced 3D Curved Botanical Leaf Sprigs (5 serrated veined leaves per sprig, backlit SSS & live wind) */}
      <instancedMesh
        key={`foliage-${skeleton.leaves.length}`}
        ref={foliageRef}
        args={[resources.leafGeometry, resources.leafMaterial, skeleton.leaves.length]}
        castShadow
        receiveShadow
      />
    </group>
  )
}
