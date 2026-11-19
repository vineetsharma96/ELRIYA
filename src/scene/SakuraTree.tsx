import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  FallingLeafPhase,
  SAKURA_TREE_CENTER,
  SAKURA_TREE_SPECS,
  SakuraLivingCanopySimulator,
  generateSakuraTreeSkeleton,
  type SakuraBranchSegment,
} from '../core/sakuraTree'
import type { SimulationState } from '../core/types'
import type { WindField } from './Assets'
import type { EnvironmentLightingSnapshot } from './lighting'

// Pre-allocated math helpers (Zero GC in useFrame)
const _dummy = new THREE.Object3D()
const _euler = new THREE.Euler(0, 0, 0, 'YXZ')
const _color = new THREE.Color()
const _sunDir = new THREE.Vector3()

const BUD_ROSE = new THREE.Color('#d86082')
const BLOSSOM_SHADE = new THREE.Color('#f0a8be')
const BLOSSOM_BRIGHT = new THREE.Color('#ffe1eb')
const BLOSSOM_CREAM = new THREE.Color('#fff2f6')
const SPRING_LEAF_SHADE = new THREE.Color('#788a48')
const SPRING_LEAF_SUN = new THREE.Color('#a8ba60')

/**
 * Generates procedural Japanese Cherry (Prunus) satin dark mahogany-plum bark
 * with signature horizontal copper-peach lenticel stripes & subtle bump depth.
 */
export function createCherryBarkTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture
  bumpMap: THREE.CanvasTexture
} {
  const size = 512
  const cCanvas = document.createElement('canvas')
  cCanvas.width = size
  cCanvas.height = size
  const ctx = cCanvas.getContext('2d')

  const bCanvas = document.createElement('canvas')
  bCanvas.width = size
  bCanvas.height = size
  const bCtx = bCanvas.getContext('2d')

  if (ctx && bCtx) {
    // Rich dark cherry-plum satin base
    ctx.fillStyle = '#472f33'
    ctx.fillRect(0, 0, size, size)
    bCtx.fillStyle = '#7e7e7e'
    bCtx.fillRect(0, 0, size, size)

    let seed = 33917
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }

    // Subtle vertical dark grain streaks
    for (let i = 0; i < 95; i++) {
      const x = rand() * size
      const w = 2 + rand() * 7
      ctx.fillStyle = rand() > 0.45 ? 'rgba(42, 24, 28, 0.34)' : 'rgba(98, 66, 68, 0.28)'
      ctx.fillRect(x, 0, w, size)
      bCtx.fillStyle = rand() > 0.5 ? 'rgba(56, 56, 56, 0.32)' : 'rgba(162, 162, 162, 0.25)'
      bCtx.fillRect(x, 0, w, size)
    }

    // Iconic horizontal cherry-bark lenticel bands (pale copper/rose-tan strips)
    for (let i = 0; i < 480; i++) {
      const x = rand() * size
      const y = rand() * size
      const len = 10 + rand() * 44
      const h = 1.4 + rand() * 3.2
      const bright = rand() > 0.25
      ctx.fillStyle = bright
        ? `rgba(176, 134, 118, ${0.32 + rand() * 0.38})`
        : `rgba(34, 18, 22, ${0.35 + rand() * 0.3})`
      ctx.fillRect(x, y, len, h)
      bCtx.fillStyle = bright ? 'rgba(210, 210, 210, 0.55)' : 'rgba(40, 40, 40, 0.5)'
      bCtx.fillRect(x, y, len, h)
    }
  }

  const map = new THREE.CanvasTexture(cCanvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.RepeatWrapping
  map.anisotropy = maxAnisotropy

  const bumpMap = new THREE.CanvasTexture(bCanvas)
  bumpMap.wrapS = THREE.RepeatWrapping
  bumpMap.wrapT = THREE.RepeatWrapping
  bumpMap.anisotropy = maxAnisotropy

  return { map, bumpMap }
}

/**
 * Paints a 5-petaled notched Japanese Sakura flower with rose core & golden stamens.
 */
function drawSakuraFlower(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  rotOffset: number
) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rotOffset)

  for (let p = 0; p < 5; p++) {
    ctx.save()
    ctx.rotate((p / 5) * Math.PI * 2)

    const grad = ctx.createRadialGradient(0, -radius * 0.12, radius * 0.05, 0, -radius * 0.55, radius * 0.9)
    grad.addColorStop(0, '#ee8ca8')
    grad.addColorStop(0.32, '#ffd0df')
    grad.addColorStop(0.85, '#ffecf2')
    grad.addColorStop(1, '#ffffff')

    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.bezierCurveTo(-radius * 0.44, -radius * 0.22, -radius * 0.46, -radius * 0.85, -radius * 0.14, -radius * 0.98)
    // Signature sakura petal apical notch
    ctx.lineTo(0, -radius * 0.81)
    ctx.lineTo(radius * 0.14, -radius * 0.98)
    ctx.bezierCurveTo(radius * 0.46, -radius * 0.85, radius * 0.44, -radius * 0.22, 0, 0)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    ctx.strokeStyle = 'rgba(218, 128, 154, 0.32)'
    ctx.lineWidth = 1.4
    ctx.stroke()
    ctx.restore()
  }

  // Warm rose-crimson flower eye & golden pollen stamens
  ctx.beginPath()
  ctx.arc(0, 0, radius * 0.14, 0, Math.PI * 2)
  ctx.fillStyle = '#cf5c7c'
  ctx.fill()

  ctx.strokeStyle = '#f5d284'
  ctx.lineWidth = 1.5
  for (let s = 0; s < 10; s++) {
    const a = (s / 10) * Math.PI * 2
    const rLen = radius * (0.24 + (s % 2) * 0.07)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(a) * rLen, Math.sin(a) * rLen)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(Math.cos(a) * rLen, Math.sin(a) * rLen, 2.2, 0, Math.PI * 2)
    ctx.fillStyle = '#f7c95c'
    ctx.fill()
  }

  ctx.restore()
}

/**
 * Generates a high-resolution 512×512 RGBA Sakura blossom cluster & spring cherry sprig texture.
 */
export function createSakuraSprigTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  if (ctx) {
    ctx.clearRect(0, 0, size, size)

    // Delicate dark mahogany cherry twiglet & flower pedicels
    ctx.strokeStyle = '#5c3c40'
    ctx.lineWidth = 6.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(256, 488)
    ctx.quadraticCurveTo(248, 340, 260, 178)
    ctx.stroke()

    const pedicels: [number, number, number, number][] = [
      [254, 392, 166, 336],
      [256, 376, 348, 326],
      [255, 290, 158, 224],
      [258, 276, 354, 212],
      [259, 198, 256, 128],
    ]
    ctx.lineWidth = 3.6
    for (const [x0, y0, x1, y1] of pedicels) {
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
    }

    // Two tender spring cherry leaves tucked beneath the blossoms
    const drawTenderLeaf = (cx: number, cy: number, ang: number) => {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(ang)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(-34, -46, 0, -108)
      ctx.quadraticCurveTo(34, -46, 0, 0)
      ctx.closePath()
      const lg = ctx.createLinearGradient(0, 0, 0, -108)
      lg.addColorStop(0, '#728d48')
      lg.addColorStop(1, '#a9be66')
      ctx.fillStyle = lg
      ctx.fill()
      ctx.restore()
    }
    drawTenderLeaf(248, 412, -1.15)
    drawTenderLeaf(266, 404, 1.18)

    // 5 full 5-petaled notched sakura blossoms fanning across the sprig
    drawSakuraFlower(ctx, 164, 330, 86, 0.22)
    drawSakuraFlower(ctx, 350, 320, 88, -0.35)
    drawSakuraFlower(ctx, 160, 218, 92, 0.55)
    drawSakuraFlower(ctx, 354, 206, 90, -0.18)
    drawSakuraFlower(ctx, 256, 124, 98, 0.12)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = maxAnisotropy
  return tex
}

/**
 * Generates a crisp 256×256 single notched sakura petal / drifting leaf texture
 * with delicate translucency and radial veins for the aerodynamic falling leaf pool.
 */
function createSinglePetalTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, size, size)
    ctx.save()
    ctx.translate(128, 224)

    const grad = ctx.createLinearGradient(0, 0, 0, -196)
    grad.addColorStop(0, '#e896b0')
    grad.addColorStop(0.35, '#ffd8e6')
    grad.addColorStop(1, '#fff6f9')

    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.bezierCurveTo(-88, -42, -96, -158, -28, -196)
    // Crisp sakura petal notch at top tip
    ctx.lineTo(0, -162)
    ctx.lineTo(28, -196)
    ctx.bezierCurveTo(96, -158, 88, -42, 0, 0)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    // Subtle veins radiating from the heavier petiole/base (CoG end)
    ctx.strokeStyle = 'rgba(222, 134, 160, 0.36)'
    ctx.lineWidth = 2
    for (const s of [-0.45, -0.2, 0, 0.2, 0.45]) {
      ctx.beginPath()
      ctx.moveTo(0, -6)
      ctx.quadraticCurveTo(s * 54, -84, s * 94, -156)
      ctx.stroke()
    }
    ctx.restore()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = maxAnisotropy
  return tex
}

/**
 * Generates a petal-dusted mossy humus soil texture for the sakura tree planter bed.
 */
function createSakuraSoilTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#3b2e26'
    ctx.fillRect(0, 0, size, size)
    let seed = 8821
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }
    for (let i = 0; i < 1400; i++) {
      const x = rand() * size
      const y = rand() * size
      const r = 1 + rand() * 3.5
      const roll = rand()
      ctx.fillStyle =
        roll < 0.24
          ? 'rgba(84, 118, 64, 0.48)'
          : roll < 0.34
            ? 'rgba(255, 206, 222, 0.72)' // Scattered fallen sakura petals on moss
            : 'rgba(66, 52, 42, 0.52)'
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
 * Builds one merged, smoothly tapered, parallel-transported cherry wood skeleton BufferGeometry.
 */
function buildSakuraWoodGeometry(branches: SakuraBranchSegment[]): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  let offset = 0

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
    const stride = radSegs + 1
    let arcLen = 0

    for (let i = 0; i < nodes.length; i++) {
      const cur = nodes[i]
      p0.set(cur.x, cur.y, cur.z)
      if (i > 0) {
        arcLen += Math.hypot(cur.x - nodes[i - 1].x, cur.y - nodes[i - 1].y, cur.z - nodes[i - 1].z)
      }

      if (i < nodes.length - 1) {
        p1.set(nodes[i + 1].x, nodes[i + 1].y, nodes[i + 1].z)
        tangent.subVectors(p1, p0).normalize()
      } else {
        p1.set(nodes[i - 1].x, nodes[i - 1].y, nodes[i - 1].z)
        tangent.subVectors(p0, p1).normalize()
      }

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

      const vCoord = arcLen * (branch.order <= 0 ? 0.9 : 1.4)
      for (let j = 0; j <= radSegs; j++) {
        const uFrac = j / radSegs
        const theta = uFrac * Math.PI * 2
        const c = Math.cos(theta)
        const s = Math.sin(theta)

        let r = cur.radius
        if (branch.order === 0 && cur.t < 0.4) {
          r *= 1 + Math.cos(theta * 7) * (1 - cur.t / 0.4) * 0.11
        }
        const nx = normal.x * c + binormal.x * s
        const ny = normal.y * c + binormal.y * s
        const nz = normal.z * c + binormal.z * s
        positions.push(p0.x + nx * r, p0.y + ny * r, p0.z + nz * r)
        normals.push(nx, ny, nz)
        uvs.push(uFrac * Math.max(1, cur.radius * 5.5), vCoord)
      }
    }

    for (let i = 0; i < nodes.length - 1; i++) {
      for (let j = 0; j < radSegs; j++) {
        const a = offset + i * stride + j
        const b = offset + (i + 1) * stride + j
        const c = offset + (i + 1) * stride + (j + 1)
        const d = offset + i * stride + (j + 1)
        indices.push(a, d, b, b, d, c)
      }
    }
    offset += nodes.length * stride
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
 * Builds a 3D doubly-curved compound Sakura blossom sprig geometry (2 crossed arched cards).
 */
export function buildSakuraSprigGeometry(segX = 2, segY = 2): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  let offset = 0

  const cards = [
    { yaw: 0, pitch: 0.22, yShift: 0, scale: 1.0 },
    { yaw: Math.PI * 0.46, pitch: -0.18, yShift: 0.03, scale: 0.9 },
  ]
  const v = new THREE.Vector3()
  const rot = new THREE.Euler()

  for (const cfg of cards) {
    rot.set(cfg.pitch, cfg.yaw, 0)
    for (let iy = 0; iy <= segY; iy++) {
      const fy = iy / segY
      for (let ix = 0; ix <= segX; ix++) {
        const fx = ix / segX
        const x = (fx - 0.5) * 0.98 * cfg.scale
        const y = fy * 1.02 * cfg.scale + cfg.yShift
        const cup = Math.abs(fx - 0.5) * 0.14 * cfg.scale
        const droop = Math.sin(fy * Math.PI) * 0.12 * cfg.scale - fy * fy * 0.12 * cfg.scale
        v.set(x, y, cup + droop).applyEuler(rot)
        positions.push(v.x, v.y, v.z)
        normals.push(v.x * 0.3, 0.82, v.z * 0.3 + 0.35)
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
 * Builds a naturally cupped 3D single sakura petal/leaf mesh pivoted near its Center of Gravity
 * (shifted slightly toward the heavier petiole/base) lying flat in the XZ plane with +Y normal.
 */
function buildCuppedFallingLeafGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(1.0, 1.32, 2, 3)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i) // -0.66 (base/CoG) to +0.66 (notched tip)
    // Natural spoon-cup curvature across width & along blade
    const cup = (x * x) * 0.22 + Math.sin(((y + 0.66) / 1.32) * Math.PI) * 0.12
    // Shift pivot toward heavier stem base (CoG offset) and lay flat in XZ plane (+Y normal)
    pos.setXYZ(i, x, cup, y + 0.22)
  }
  geo.computeVertexNormals()
  return geo
}

function buildSakuraPlanterCurbGeometry(): THREE.LatheGeometry {
  const rOut = SAKURA_TREE_SPECS.planterOuterRadius
  const rIn = SAKURA_TREE_SPECS.planterInnerRadius
  const h = SAKURA_TREE_SPECS.planterHeight
  return new THREE.LatheGeometry(
    [
      new THREE.Vector2(rIn, 0.01),
      new THREE.Vector2(rOut + 0.04, 0.01),
      new THREE.Vector2(rOut + 0.04, 0.07),
      new THREE.Vector2(rOut, 0.11),
      new THREE.Vector2(rOut, h - 0.03),
      new THREE.Vector2(rOut - 0.03, h),
      new THREE.Vector2(rIn + 0.03, h),
      new THREE.Vector2(rIn, h - 0.03),
      new THREE.Vector2(rIn, 0.01),
    ],
    24
  )
}

export interface SakuraTreeProps {
  wind: WindField
  fallDensityRef: { value: number }
  lightingState: EnvironmentLightingSnapshot
  simulation: SimulationState
  lowDetail: boolean
}

export function SakuraTree({ wind, fallDensityRef, lightingState, simulation, lowDetail }: SakuraTreeProps) {
  const { gl } = useThree()
  const canopyRef = useRef<THREE.InstancedMesh>(null!)
  const fallingRef = useRef<THREE.InstancedMesh>(null!)

  const skeleton = useMemo(() => generateSakuraTreeSkeleton(94127, lowDetail), [lowDetail])
  const fallingPoolSize = lowDetail ? 180 : 360
  const livingSim = useMemo(
    () => new SakuraLivingCanopySimulator(skeleton.canopySlots, fallingPoolSize, 66109),
    [skeleton, fallingPoolSize]
  )

  // Precomputed base quaternions for every canopy slot so per-frame growth scale updates are ultra-fast
  const slotQuaternions = useMemo(() => {
    const qArr = new Float32Array(skeleton.canopySlots.length * 4)
    const up = new THREE.Vector3(0, 1, 0)
    const dir = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const rq = new THREE.Quaternion()
    skeleton.canopySlots.forEach((slot, i) => {
      dir.set(slot.dirX, slot.dirY, slot.dirZ).normalize()
      q.setFromUnitVectors(up, dir)
      rq.setFromAxisAngle(dir, slot.roll)
      q.premultiply(rq)
      qArr[i * 4 + 0] = q.x
      qArr[i * 4 + 1] = q.y
      qArr[i * 4 + 2] = q.z
      qArr[i * 4 + 3] = q.w
    })
    return qArr
  }, [skeleton])

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
    const { map: barkMap, bumpMap: barkBump } = createCherryBarkTextures(maxAnisotropy)
    const sprigMap = createSakuraSprigTexture(maxAnisotropy)
    const petalMap = createSinglePetalTexture(maxAnisotropy)
    const soilMap = createSakuraSoilTexture(maxAnisotropy)

    const woodGeometry = buildSakuraWoodGeometry(skeleton.branches)
    const sprigGeometry = buildSakuraSprigGeometry()
    const fallingLeafGeometry = buildCuppedFallingLeafGeometry()
    const planterGeometry = buildSakuraPlanterCurbGeometry()

    const slotCount = skeleton.canopySlots.length
    const aSakuraData = new Float32Array(slotCount * 3)
    for (let i = 0; i < slotCount; i++) {
      const s = skeleton.canopySlots[i]
      aSakuraData[i * 3 + 0] = (i * 1.91357) % (Math.PI * 2)
      aSakuraData[i * 3 + 1] = s.windWeight
      aSakuraData[i * 3 + 2] = s.sunExposure
    }
    sprigGeometry.setAttribute('aSakuraData', new THREE.InstancedBufferAttribute(aSakuraData, 3))

    const barkMaterial = new THREE.MeshStandardMaterial({
      map: barkMap,
      bumpMap: barkBump,
      bumpScale: 0.036,
      color: '#d4c1c2',
      roughness: 0.84,
      metalness: 0.04,
    })

    const planterStoneMat = new THREE.MeshStandardMaterial({
      color: '#e5dac3',
      roughness: 0.80,
      metalness: 0.02,
    })

    const soilMat = new THREE.MeshStandardMaterial({
      map: soilMap,
      roughness: 0.95,
      metalness: 0.0,
    })

    const canopyMaterial = new THREE.MeshStandardMaterial({
      map: sprigMap,
      alphaTest: 0.42,
      roughness: 0.52,
      metalness: 0.01,
      side: THREE.DoubleSide,
    })
    canopyMaterial.customProgramCacheKey = () => 'elyria-sakura-canopy-v1'
    canopyMaterial.onBeforeCompile = shader => {
      shader.uniforms.uTime = uniforms.uTime
      shader.uniforms.uWind = uniforms.uWind
      shader.uniforms.uDaylight = uniforms.uDaylight
      shader.uniforms.uSunDir = uniforms.uSunDir
      shader.uniforms.uSunColor = uniforms.uSunColor

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute vec3 aSakuraData;
          uniform float uTime;
          uniform float uWind;
          varying float vSunExposure;
          varying vec3 vSakuraWorldPos;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float sPhase = aSakuraData.x;
          float sWind = aSakuraData.y;
          vSunExposure = aSakuraData.z;
          float tipFlex = clamp(position.y, 0.0, 1.0);
          float breeze = 0.25 + uWind * 1.25;
          transformed.x += (sin(uTime * 1.55 + sPhase) * 0.062 * sWind + sin(uTime * 4.8 + sPhase * 2.7) * 0.025 * tipFlex) * breeze;
          transformed.z += cos(uTime * 1.25 + sPhase * 1.3) * 0.048 * sWind * breeze;
          transformed.y += sin(uTime * 3.4 + sPhase * 1.9) * 0.016 * tipFlex * breeze;`
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          #ifdef USE_INSTANCING
            vSakuraWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          #else
            vSakuraWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
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
          varying vec3 vSakuraWorldPos;`
        )
        .replace(
          '#include <opaque_fragment>',
          `vec3 sViewDir = normalize(cameraPosition - vSakuraWorldPos);
          float backLight = pow(clamp(dot(sViewDir, -normalize(uSunDir)), 0.0, 1.0), 2.4);
          vec3 petalGlow = vec3(1.08, 0.72, 0.84) * uSunColor;
          float dayRadiance = (backLight * 0.88 + (0.22 + 0.48 * vSunExposure) * 0.36) * uDaylight;
          vec3 moonShimmer = vec3(1.02, 0.74, 0.90) * (0.14 + 0.34 * vSunExposure) * (1.0 - uDaylight) * 0.42;
          outgoingLight += diffuseColor.rgb * (petalGlow * dayRadiance + moonShimmer);
          #include <opaque_fragment>`
        )
    }

    const fallingMaterial = new THREE.MeshStandardMaterial({
      map: petalMap,
      alphaTest: 0.36,
      roughness: 0.44,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })

    return {
      barkMap,
      barkBump,
      sprigMap,
      petalMap,
      soilMap,
      woodGeometry,
      sprigGeometry,
      fallingLeafGeometry,
      planterGeometry,
      barkMaterial,
      planterStoneMat,
      soilMat,
      canopyMaterial,
      fallingMaterial,
    }
  }, [gl, skeleton, uniforms])

  // StrictMode-safe GPU resource disposal
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
          toDispose.sprigMap.dispose()
          toDispose.petalMap.dispose()
          toDispose.soilMap.dispose()
          toDispose.woodGeometry.dispose()
          toDispose.sprigGeometry.dispose()
          toDispose.fallingLeafGeometry.dispose()
          toDispose.planterGeometry.dispose()
          toDispose.barkMaterial.dispose()
          toDispose.planterStoneMat.dispose()
          toDispose.soilMat.dispose()
          toDispose.canopyMaterial.dispose()
          toDispose.fallingMaterial.dispose()
        }
      })
    }
  }, [resources])

  // Initial population of canopy & falling colors/matrices
  useLayoutEffect(() => {
    const cMesh = canopyRef.current
    const fMesh = fallingRef.current
    if (!cMesh || !fMesh) return

    const c = livingSim.canopy
    for (let i = 0; i < c.count; i++) {
      const slot = skeleton.canopySlots[i]
      const g = c.growth[i]
      // Smooth sigmoidal biological unfurling curve for bud -> full bloom scale
      const smoothG = g * g * (3 - 2 * g)
      const s = smoothG > 0.01 ? slot.maxScale * (0.18 + 0.82 * smoothG) : 0.0001
      _dummy.position.set(slot.x, slot.y, slot.z)
      _dummy.quaternion.set(
        slotQuaternions[i * 4 + 0],
        slotQuaternions[i * 4 + 1],
        slotQuaternions[i * 4 + 2],
        slotQuaternions[i * 4 + 3]
      )
      _dummy.scale.setScalar(s)
      _dummy.updateMatrix()
      cMesh.setMatrixAt(i, _dummy.matrix)

      computeCanopyColor(slot.isLeaf, slot.sunExposure, slot.hueShift, g, _color)
      cMesh.setColorAt(i, _color)
    }
    cMesh.instanceMatrix.needsUpdate = true
    if (cMesh.instanceColor) cMesh.instanceColor.needsUpdate = true
    cMesh.computeBoundingSphere()

    // Initialize falling leaf colors
    const f = livingSim.falling
    for (let i = 0; i < f.count; i++) {
      _dummy.position.set(0, -10, 0)
      _dummy.scale.setScalar(0.0001)
      _dummy.updateMatrix()
      fMesh.setMatrixAt(i, _dummy.matrix)
      _color.set('#ffdbe7')
      fMesh.setColorAt(i, _color)
    }
    fMesh.instanceMatrix.needsUpdate = true
    if (fMesh.instanceColor) fMesh.instanceColor.needsUpdate = true
  }, [skeleton, livingSim, slotQuaternions])

  // Track last written growth value per canopy slot so we only touch matrices/colors for actively growing/shed slots!
  const lastGrowthRef = useRef<Float32Array | null>(null)
  useEffect(() => {
    lastGrowthRef.current = new Float32Array(skeleton.canopySlots.length).fill(-1)
  }, [skeleton])

  useFrame((_, rawDelta) => {
    const dt = simulation.paused ? 0 : Math.min(rawDelta, 0.05)

    uniforms.uTime.value = wind.time
    uniforms.uWind.value = wind.value
    uniforms.uDaylight.value = lightingState.daylight
    _sunDir.copy(lightingState.keyLightPosition).normalize()
    uniforms.uSunDir.value.copy(_sunDir)
    uniforms.uSunColor.value.copy(lightingState.sunColor)

    if (dt > 0) {
      livingSim.step(dt, wind.value, fallDensityRef.value)
    }

    // 1. Update growing/regrowing canopy buds & shed slots (zero GC, dirty-tracked)
    const cMesh = canopyRef.current
    const lastGrowth = lastGrowthRef.current
    if (cMesh && lastGrowth) {
      const c = livingSim.canopy
      let anyCanopyDirty = false
      for (let i = 0; i < c.count; i++) {
        const g = c.growth[i]
        if (Math.abs(g - lastGrowth[i]) > 0.008) {
          lastGrowth[i] = g
          anyCanopyDirty = true
          const slot = skeleton.canopySlots[i]
          const smoothG = g * g * (3 - 2 * g)
          const s = g > 0.01 ? slot.maxScale * (0.16 + 0.84 * smoothG) : 0.0001

          _dummy.position.set(slot.x, slot.y, slot.z)
          _dummy.quaternion.set(
            slotQuaternions[i * 4 + 0],
            slotQuaternions[i * 4 + 1],
            slotQuaternions[i * 4 + 2],
            slotQuaternions[i * 4 + 3]
          )
          _dummy.scale.setScalar(s)
          _dummy.updateMatrix()
          cMesh.setMatrixAt(i, _dummy.matrix)

          computeCanopyColor(slot.isLeaf, slot.sunExposure, slot.hueShift, g, _color)
          cMesh.setColorAt(i, _color)
        }
      }
      if (anyCanopyDirty) {
        cMesh.instanceMatrix.needsUpdate = true
        if (cMesh.instanceColor) cMesh.instanceColor.needsUpdate = true
      }
    }

    // 2. Update CoG-driven aerodynamic falling sakura petals & leaves (zero GC)
    const fMesh = fallingRef.current
    if (fMesh) {
      const f = livingSim.falling
      for (let i = 0; i < f.count; i++) {
        const ph = f.phase[i]
        if (ph === FallingLeafPhase.Inactive) {
          _dummy.position.set(0, -10, 0)
          _dummy.scale.setScalar(0.0001)
          _dummy.updateMatrix()
          fMesh.setMatrixAt(i, _dummy.matrix)
          continue
        }

        // Smooth fade-out shrink at the end of ground rest before recycling
        let scale = f.scale[i]
        if (ph === FallingLeafPhase.Grounded && f.groundAge[i] > 11.5) {
          scale *= Math.max(0.01, 1 - (f.groundAge[i] - 11.5) / 2.5)
        }

        _dummy.position.set(f.x[i], f.y[i], f.z[i])
        _euler.set(f.pitch[i], f.yaw[i], f.roll[i])
        _dummy.quaternion.setFromEuler(_euler)
        _dummy.scale.setScalar(scale)
        _dummy.updateMatrix()
        fMesh.setMatrixAt(i, _dummy.matrix)

        if (f.isLeaf[i]) {
          _color.copy(SPRING_LEAF_SHADE).lerp(SPRING_LEAF_SUN, f.hueShift[i])
        } else {
          _color.copy(BLOSSOM_SHADE).lerp(BLOSSOM_CREAM, 0.35 + f.hueShift[i] * 0.65)
        }
        fMesh.setColorAt(i, _color)
      }
      fMesh.instanceMatrix.needsUpdate = true
      if (fMesh.instanceColor) fMesh.instanceColor.needsUpdate = true
    }
  })

  return (
    <group
      position={[SAKURA_TREE_CENTER.x, SAKURA_TREE_CENTER.y, SAKURA_TREE_CENTER.z]}
      name="experimental-sakura-tree"
    >
      {/* 1. Carved Travertine Stone Planter Well Curb */}
      <mesh
        geometry={resources.planterGeometry}
        material={resources.planterStoneMat}
        castShadow
        receiveShadow
      />

      {/* 2. Petal-Dusted Mossy Earth Mound */}
      <mesh position={[0, 0.11, 0]} scale={[1, 0.18, 1]} material={resources.soilMat} receiveShadow>
        <sphereGeometry
          args={[SAKURA_TREE_SPECS.planterInnerRadius + 0.02, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]}
        />
      </mesh>

      {/* 3. Merged Spreading & Weeping Cherry Wood Skeleton (7 Roots, Twisted Trunk, Wide Limbs, Boughs, Twigs) */}
      <mesh
        geometry={resources.woodGeometry}
        material={resources.barkMaterial}
        castShadow
        receiveShadow
      />

      {/* 4. Living Regrowing Sakura Canopy (Budding -> Full Bloom -> Wind-Triggered Shedding) */}
      <instancedMesh
        key={`sakura-canopy-${skeleton.canopySlots.length}`}
        ref={canopyRef}
        args={[resources.sprigGeometry, resources.canopyMaterial, skeleton.canopySlots.length]}
        castShadow
        receiveShadow
      />

      {/* 5. CoG & Air-Resistance Simulated Slowly Falling Sakura Petals & Leaves */}
      <instancedMesh
        key={`sakura-falling-${fallingPoolSize}`}
        ref={fallingRef}
        args={[resources.fallingLeafGeometry, resources.fallingMaterial, fallingPoolSize]}
        frustumCulled={false}
      />
    </group>
  )
}

function computeCanopyColor(
  isLeaf: boolean,
  sunExposure: number,
  hueShift: number,
  growth: number,
  out: THREE.Color
): void {
  if (isLeaf) {
    // Young cherry leaves emerge warm bronze-green and brighten as they mature
    out.copy(SPRING_LEAF_SHADE).lerp(SPRING_LEAF_SUN, sunExposure * 0.7 + growth * 0.3)
    out.offsetHSL((hueShift - 0.5) * 0.03, 0, (hueShift - 0.5) * 0.04)
    return
  }

  // Blossoms start as deep rose-pink buds (growth < 0.45) and unfurl into luminous pastel sakura white-pink!
  const bloomOpen = Math.min(1, Math.max(0, (growth - 0.15) / 0.75))
  if (sunExposure < 0.5) {
    out.copy(BLOSSOM_SHADE).lerp(BLOSSOM_BRIGHT, sunExposure * 2)
  } else {
    out.copy(BLOSSOM_BRIGHT).lerp(BLOSSOM_CREAM, (sunExposure - 0.5) * 2)
  }
  out.lerp(BUD_ROSE, (1 - bloomOpen) * 0.72)
  out.offsetHSL((hueShift - 0.5) * 0.025, 0, (hueShift - 0.5) * 0.03)
}
