import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  FOUNTAIN_CENTER,
  FOUNTAIN_SPECS,
  FountainWaterSimulator,
  sampleParabolicPoint,
  type ParabolicStreamConfig,
} from '../core/fountainWater'
import type { SimulationState } from '../core/types'
import type { WindField } from './Assets'
import type { EnvironmentLightingSnapshot } from './lighting'

// Pre-allocated math helpers (Zero GC inside useFrame)
const _dummy = new THREE.Object3D()
const _up = new THREE.Vector3(0, 1, 0)
const _dir = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _sunDir = new THREE.Vector3()
const _skyCol = new THREE.Color()
const _sunCol = new THREE.Color()

/**
 * Generates a procedural travertine limestone albedo & bump texture pair
 * with subtle warm mineral veining and carved stone grain.
 */
function createTravertineTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture
  bumpMap: THREE.CanvasTexture
} {
  const size = 256
  const colorCanvas = document.createElement('canvas')
  colorCanvas.width = size
  colorCanvas.height = size
  const ctx = colorCanvas.getContext('2d')

  const bumpCanvas = document.createElement('canvas')
  bumpCanvas.width = size
  bumpCanvas.height = size
  const bCtx = bumpCanvas.getContext('2d')

  if (ctx && bCtx) {
    // Base warm Elyria cream travertine
    ctx.fillStyle = '#e7ddc7'
    ctx.fillRect(0, 0, size, size)
    bCtx.fillStyle = '#808080'
    bCtx.fillRect(0, 0, size, size)

    // Subtle sedimentary bands
    for (let y = 0; y < size; y += 3) {
      const band = Math.sin(y * 0.08) * 0.5 + Math.sin(y * 0.23) * 0.3
      const shade = Math.round(224 + band * 12)
      ctx.fillStyle = `rgba(${shade}, ${shade - 10}, ${shade - 26}, 0.28)`
      ctx.fillRect(0, y, size, 3)

      const bVal = Math.round(128 + band * 24)
      bCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`
      bCtx.fillRect(0, y, size, 3)
    }

    // Fine stone pores & warm limestone mineral speckles
    let seed = 4129
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }

    for (let i = 0; i < 1400; i++) {
      const x = nextRand() * size
      const y = nextRand() * size
      const w = 1 + nextRand() * 6
      const h = 1 + nextRand() * 2
      const dark = nextRand() > 0.45
      ctx.fillStyle = dark ? 'rgba(176, 162, 138, 0.22)' : 'rgba(250, 245, 232, 0.26)'
      ctx.fillRect(x, y, w, h)
      bCtx.fillStyle = dark ? 'rgba(84, 84, 84, 0.35)' : 'rgba(168, 168, 168, 0.25)'
      bCtx.fillRect(x, y, w, h)
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.RepeatWrapping
  map.repeat.set(3, 2)
  map.anisotropy = maxAnisotropy

  const bumpMap = new THREE.CanvasTexture(bumpCanvas)
  bumpMap.wrapS = THREE.RepeatWrapping
  bumpMap.wrapT = THREE.RepeatWrapping
  bumpMap.repeat.set(3, 2)
  bumpMap.anisotropy = maxAnisotropy

  return { map, bumpMap }
}

/**
 * Generates a concentric mosaic tile texture for the submerged basin floor
 * so light refracting through the water reveals intricate underwater craftsmanship.
 */
function createMosaicFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const cx = size * 0.5
    const cy = size * 0.5
    ctx.fillStyle = '#4e7b7d'
    ctx.fillRect(0, 0, size, size)

    // Concentric mosaic bands (deep teal-turquoise & warm limestone inlays)
    const rings = [
      { r: 126, color: '#5b8a8b' },
      { r: 112, color: '#7fa49d' },
      { r: 102, color: '#4c797c' },
      { r: 84, color: '#699794' },
      { r: 66, color: '#8ab1a4' },
      { r: 54, color: '#4a7579' },
      { r: 36, color: '#6b948f' },
    ]
    for (const ring of rings) {
      ctx.beginPath()
      ctx.arc(cx, cy, ring.r, 0, Math.PI * 2)
      ctx.fillStyle = ring.color
      ctx.fill()
    }

    // Subtle radial mosaic grout lines
    ctx.strokeStyle = 'rgba(218, 224, 212, 0.28)'
    ctx.lineWidth = 1.4
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * 32, cy + Math.sin(a) * 32)
      ctx.lineTo(cx + Math.cos(a) * 126, cy + Math.sin(a) * 126)
      ctx.stroke()
    }

    for (const r of [42, 58, 76, 94, 110, 122]) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = maxAnisotropy
  return tex
}

/**
 * Builds sculpted LatheGeometry silhouettes for the classical multi-tier fountain architecture.
 */
function buildFountainGeometries(radialSegments: number) {
  // 1. Carved Basin Rim Wall & Bullnose Moulded Coping
  const basinWallPts = [
    new THREE.Vector2(2.65, 0.14),
    new THREE.Vector2(2.96, 0.14),
    new THREE.Vector2(2.94, 0.20),
    new THREE.Vector2(2.86, 0.28),
    new THREE.Vector2(2.84, 0.38),
    new THREE.Vector2(2.91, 0.45),
    new THREE.Vector2(2.98, 0.49),
    new THREE.Vector2(2.99, 0.535),
    new THREE.Vector2(2.93, 0.565),
    new THREE.Vector2(2.74, 0.565),
    new THREE.Vector2(2.67, 0.535),
    new THREE.Vector2(2.66, 0.47),
    new THREE.Vector2(2.65, 0.14),
  ]
  const basinWall = new THREE.LatheGeometry(basinWallPts, radialSegments)

  // 2. Central Fluted Pedestal Column (rises from submerged octagonal base to middle bowl)
  const pedestalPts = [
    new THREE.Vector2(0.01, 0.14),
    new THREE.Vector2(0.72, 0.14),
    new THREE.Vector2(0.72, 0.30),
    new THREE.Vector2(0.66, 0.36),
    new THREE.Vector2(0.62, 0.46),
    new THREE.Vector2(0.54, 0.52),
    new THREE.Vector2(0.45, 0.62),
    new THREE.Vector2(0.40, 0.86),
    new THREE.Vector2(0.44, 1.02),
    new THREE.Vector2(0.55, 1.12),
    new THREE.Vector2(0.60, 1.18),
    new THREE.Vector2(0.01, 1.18),
  ]
  const pedestal = new THREE.LatheGeometry(pedestalPts, radialSegments)

  // 3. Wide Scalloped Middle Basin Bowl
  const midBowlPts = [
    new THREE.Vector2(0.01, 1.14),
    new THREE.Vector2(0.58, 1.14),
    new THREE.Vector2(0.84, 1.19),
    new THREE.Vector2(1.16, 1.27),
    new THREE.Vector2(1.38, 1.36),
    new THREE.Vector2(1.48, 1.43),
    new THREE.Vector2(1.49, 1.465),
    new THREE.Vector2(1.44, 1.485),
    new THREE.Vector2(1.38, 1.465),
    new THREE.Vector2(1.33, 1.39),
    new THREE.Vector2(0.95, 1.33),
    new THREE.Vector2(0.40, 1.32),
    new THREE.Vector2(0.01, 1.32),
  ]
  const midBowl = new THREE.LatheGeometry(midBowlPts, radialSegments)

  // 4. Upper Baluster Stem supporting the Crown Bowl
  const upperStemPts = [
    new THREE.Vector2(0.01, 1.32),
    new THREE.Vector2(0.42, 1.32),
    new THREE.Vector2(0.39, 1.44),
    new THREE.Vector2(0.32, 1.54),
    new THREE.Vector2(0.24, 1.72),
    new THREE.Vector2(0.28, 1.88),
    new THREE.Vector2(0.24, 2.02),
    new THREE.Vector2(0.35, 2.14),
    new THREE.Vector2(0.40, 2.18),
    new THREE.Vector2(0.01, 2.18),
  ]
  const upperStem = new THREE.LatheGeometry(upperStemPts, radialSegments)

  // 5. Upper Crown Lotus Bowl
  const upperBowlPts = [
    new THREE.Vector2(0.01, 2.16),
    new THREE.Vector2(0.38, 2.16),
    new THREE.Vector2(0.56, 2.21),
    new THREE.Vector2(0.72, 2.29),
    new THREE.Vector2(0.80, 2.37),
    new THREE.Vector2(0.805, 2.405),
    new THREE.Vector2(0.76, 2.42),
    new THREE.Vector2(0.72, 2.395),
    new THREE.Vector2(0.67, 2.33),
    new THREE.Vector2(0.42, 2.29),
    new THREE.Vector2(0.01, 2.29),
  ]
  const upperBowl = new THREE.LatheGeometry(upperBowlPts, radialSegments)

  // 6. Sculpted Blossom-Bud Finial Spire
  const finialPts = [
    new THREE.Vector2(0.01, 2.29),
    new THREE.Vector2(0.26, 2.29),
    new THREE.Vector2(0.24, 2.42),
    new THREE.Vector2(0.18, 2.52),
    new THREE.Vector2(0.25, 2.66),
    new THREE.Vector2(0.21, 2.82),
    new THREE.Vector2(0.12, 2.96),
    new THREE.Vector2(0.08, 3.04),
    new THREE.Vector2(0.01, 3.05),
  ]
  const finial = new THREE.LatheGeometry(finialPts, Math.max(20, Math.floor(radialSegments * 0.65)))

  // 7. Burnished Bronze Crown Nozzle Cap
  const crownNozzlePts = [
    new THREE.Vector2(0.01, 3.02),
    new THREE.Vector2(0.095, 3.02),
    new THREE.Vector2(0.11, 3.06),
    new THREE.Vector2(0.075, 3.10),
    new THREE.Vector2(0.055, 3.15),
    new THREE.Vector2(0.025, 3.16),
    new THREE.Vector2(0.01, 3.16),
  ]
  const crownNozzle = new THREE.LatheGeometry(crownNozzlePts, 20)

  // 8. Submerged High-Resolution Water Surface Disk (48 radial rings for real vertex ripples)
  const mainWaterDisk = new THREE.RingGeometry(
    FOUNTAIN_SPECS.pedestalBaseRadius * 0.86,
    FOUNTAIN_SPECS.basinInnerRadius + 0.01,
    radialSegments,
    18
  )
  mainWaterDisk.rotateX(-Math.PI / 2)

  return {
    basinWall,
    pedestal,
    midBowl,
    upperStem,
    upperBowl,
    finial,
    crownNozzle,
    mainWaterDisk,
  }
}

/**
 * Builds a single merged BufferGeometry for all continuous parabolic water stream tubes
 * so all 32 arching streams draw in 1 single draw call with custom flowing shader UVs.
 */
function buildParabolicStreamsGeometry(streams: ParabolicStreamConfig[], radialSegments: number): THREE.BufferGeometry {
  const tubularSegments = 18
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  let vertexOffset = 0

  const p0 = new THREE.Vector3()
  const p1 = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const side = new THREE.Vector3()
  const binormal = new THREE.Vector3()
  const worldUp = new THREE.Vector3(0, 1, 0)

  for (const stream of streams) {
    const baseRadius =
      stream.kind === 'rim_jet' ? 0.024 : stream.kind === 'mid_cascade' ? 0.026 : 0.021

    for (let i = 0; i <= tubularSegments; i++) {
      const frac = i / tubularSegments
      const t = frac * stream.flightTime
      const cur = sampleParabolicPoint(
        stream.originX,
        stream.originY,
        stream.originZ,
        stream.velX,
        stream.velY,
        stream.velZ,
        t
      )
      const nextT = Math.min(stream.flightTime, (i + 0.5) / tubularSegments * stream.flightTime)
      const nxt = sampleParabolicPoint(
        stream.originX,
        stream.originY,
        stream.originZ,
        stream.velX,
        stream.velY,
        stream.velZ,
        nextT === t ? t + 0.01 : nextT
      )

      p0.set(cur.x, cur.y, cur.z)
      p1.set(nxt.x, nxt.y, nxt.z)
      tangent.subVectors(p1, p0).normalize()
      if (Math.abs(tangent.dot(worldUp)) > 0.96) {
        side.set(1, 0, 0).cross(tangent).normalize()
      } else {
        side.crossVectors(tangent, worldUp).normalize()
      }
      binormal.crossVectors(side, tangent).normalize()

      // Stream slightly expands as it aerates along its flight arc
      const r = baseRadius * (0.78 + frac * 0.65)
      for (let j = 0; j <= radialSegments; j++) {
        const theta = (j / radialSegments) * Math.PI * 2
        const c = Math.cos(theta)
        const s = Math.sin(theta)
        const nx = side.x * c + binormal.x * s
        const ny = side.y * c + binormal.y * s
        const nz = side.z * c + binormal.z * s

        positions.push(p0.x + nx * r, p0.y + ny * r, p0.z + nz * r)
        normals.push(nx, ny, nz)
        uvs.push(j / radialSegments, frac)
      }
    }

    const ringStride = radialSegments + 1
    for (let i = 0; i < tubularSegments; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const a = vertexOffset + i * ringStride + j
        const b = vertexOffset + (i + 1) * ringStride + j
        const c = vertexOffset + (i + 1) * ringStride + (j + 1)
        const d = vertexOffset + i * ringStride + (j + 1)
        indices.push(a, b, d, b, c, d)
      }
    }
    vertexOffset += (tubularSegments + 1) * ringStride
  }

  // Add central crown aerated geyser plume column (rising & flaring cleanly above finial tip)
  const plumeSegs = 12
  const plumeRadial = radialSegments
  const plumeStride = plumeRadial + 1
  for (let i = 0; i <= plumeSegs; i++) {
    const frac = i / plumeSegs
    const y = FOUNTAIN_SPECS.finialTipY + frac * 0.72
    // Narrow neck at nozzle, flaring softly into frothy plume crown
    const r = 0.032 + Math.pow(frac, 1.35) * 0.145
    for (let j = 0; j <= plumeRadial; j++) {
      const theta = (j / plumeRadial) * Math.PI * 2
      const nx = Math.cos(theta)
      const nz = Math.sin(theta)
      positions.push(nx * r, y, nz * r)
      normals.push(nx, 0.25, nz)
      uvs.push(j / plumeRadial, frac)
    }
  }
  for (let i = 0; i < plumeSegs; i++) {
    for (let j = 0; j < plumeRadial; j++) {
      const a = vertexOffset + i * plumeStride + j
      const b = vertexOffset + (i + 1) * plumeStride + j
      const c = vertexOffset + (i + 1) * plumeStride + (j + 1)
      const d = vertexOffset + i * plumeStride + (j + 1)
      indices.push(a, b, d, b, c, d)
    }
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
 * Custom GLSL shader for the main basin water surface, sampling the live 2D shallow-water
 * wave PDE DataTexture for dynamic ripples, refracted caustics, Fresnel reflections, and foam.
 */
function createMainBasinWaterMaterial(waveTexture: THREE.DataTexture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uWaveTex: { value: waveTexture },
      uTime: { value: 0 },
      uDaylight: { value: 1 },
      uNightGlow: { value: 0 },
      uCloudCover: { value: 0 },
      uBasinRadius: { value: FOUNTAIN_SPECS.basinInnerRadius },
      uSunDir: { value: new THREE.Vector3(0.45, 0.75, -0.35).normalize() },
      uSkyColor: { value: new THREE.Color('#c7ded9') },
      uSunColor: { value: new THREE.Color('#fff2d3') },
    },
    vertexShader: `
      uniform sampler2D uWaveTex;
      uniform float uBasinRadius;
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      varying vec2 vWaveUv;

      void main() {
        vec3 pos = position;
        vec2 waveUv = pos.xz / (uBasinRadius * 2.0) + 0.5;
        vec4 waveSample = texture2D(uWaveTex, clamp(waveUv, 0.01, 0.99));
        float h = (waveSample.r - 0.5) * 2.0;
        pos.y += h * 0.042;

        vLocalPos = pos;
        vWaveUv = waveUv;
        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D uWaveTex;
      uniform float uTime;
      uniform float uDaylight;
      uniform float uNightGlow;
      uniform float uCloudCover;
      uniform float uBasinRadius;
      uniform vec3 uSunDir;
      uniform vec3 uSkyColor;
      uniform vec3 uSunColor;

      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      varying vec2 vWaveUv;

      float causticPattern(vec2 p, float t) {
        vec2 p1 = p * 3.8 + vec2(t * 0.55, -t * 0.42);
        vec2 p2 = p * 5.2 + vec2(-t * 0.48, t * 0.61);
        float c1 = sin(p1.x + sin(p1.y + t * 0.7)) * cos(p1.y + cos(p1.x - t * 0.6));
        float c2 = sin(p2.x - cos(p2.y - t * 0.5)) * cos(p2.y + sin(p2.x + t * 0.8));
        return smoothstep(0.32, 0.96, abs(c1 + c2) * 0.55);
      }

      void main() {
        vec4 waveSample = texture2D(uWaveTex, clamp(vWaveUv, 0.01, 0.99));
        float height = (waveSample.r - 0.5) * 2.0;
        float gx = (waveSample.g - 0.5) * 2.0;
        float gz = (waveSample.b - 0.5) * 2.0;
        float foamField = waveSample.a;

        // Layer micro-capillary ripples on top of live 2D shallow-water PDE gradients
        float r = length(vLocalPos.xz);
        float microX = cos(vLocalPos.x * 13.0 + uTime * 3.1) * sin(vLocalPos.z * 11.0 - uTime * 2.4) * 0.055;
        float microZ = sin(vLocalPos.x * 11.5 - uTime * 2.7) * cos(vLocalPos.z * 13.5 + uTime * 2.9) * 0.055;
        vec3 normal = normalize(vec3(-(gx * 0.95 + microX), 1.0, -(gz * 0.95 + microZ)));

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 sunDir = normalize(uSunDir);

        // Schlick Fresnel reflection
        float ndotv = clamp(dot(normal, viewDir), 0.0, 1.0);
        float fresnel = 0.04 + 0.96 * pow(1.0 - ndotv, 4.2);

        // Depth-tinted aqua water body (shallower & brighter near rim & pedestal)
        float edgeShallow = smoothstep(uBasinRadius - 0.55, uBasinRadius, r) + (1.0 - smoothstep(0.68, 1.05, r));
        vec3 deepDay = vec3(0.16, 0.52, 0.55);
        vec3 shallowDay = vec3(0.45, 0.78, 0.76);
        vec3 deepNight = vec3(0.06, 0.19, 0.25);
        vec3 shallowNight = vec3(0.14, 0.34, 0.38);

        vec3 bodyDay = mix(deepDay, shallowDay, clamp(edgeShallow * 0.72, 0.0, 1.0));
        vec3 bodyNight = mix(deepNight, shallowNight, clamp(edgeShallow * 0.65, 0.0, 1.0));
        vec3 waterBody = mix(bodyNight, bodyDay, uDaylight);

        // Animated underwater caustics refracted by wave gradients
        vec2 refractedXZ = vLocalPos.xz + vec2(gx, gz) * 0.16;
        float caustics = causticPattern(refractedXZ, uTime) * (0.28 + 0.72 * uDaylight) * (1.0 - uCloudCover * 0.45);
        waterBody += vec3(0.32, 0.46, 0.44) * caustics * 0.42;

        // Warm submerged uplight glow around the central pedestal at twilight/night
        float lampGlow = (1.0 - smoothstep(0.75, 2.15, r)) * uNightGlow;
        waterBody += vec3(0.32, 0.72, 0.64) * lampGlow * 0.65 + vec3(0.55, 0.42, 0.22) * lampGlow * 0.35;

        // Sky & sun specular reflections
        vec3 reflectCol = mix(uSkyColor * 0.85, vec3(0.92, 0.97, 1.0), 0.22 * uDaylight);
        vec3 halfVec = normalize(sunDir + viewDir);
        float specSharp = pow(max(dot(normal, halfVec), 0.0), 140.0) * (0.45 + 0.95 * uDaylight) * (1.0 - uCloudCover * 0.55);
        float specSoft = pow(max(dot(normal, halfVec), 0.0), 24.0) * 0.22 * uDaylight;

        vec3 color = mix(waterBody, reflectCol, clamp(fresnel * 0.78, 0.0, 0.85));
        color += uSunColor * (specSharp * 1.15 + specSoft);

        // Aerated white splash foam rings driven directly by the live wave simulator
        float edgeMeniscus = smoothstep(uBasinRadius - 0.11, uBasinRadius, r) * 0.28;
        float pedestalMeniscus = (1.0 - smoothstep(0.68, 0.80, r)) * 0.34;
        float crestFoam = smoothstep(0.18, 0.68, foamField + abs(height) * 0.32);
        float totalFoam = clamp(crestFoam * 0.88 + edgeMeniscus + pedestalMeniscus, 0.0, 0.95);
        vec3 foamColor = mix(vec3(0.62, 0.78, 0.84), vec3(0.96, 0.99, 1.0), uDaylight);
        color = mix(color, foamColor, totalFoam);

        // Translucent alpha lets the submerged mosaic floor peek through calm zones while foam stays opaque
        float alpha = clamp(0.74 + fresnel * 0.20 + totalFoam * 0.24, 0.72, 0.97);
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
  })
}

/**
 * Custom GLSL shader for the elevated middle & upper bowl water pools with concentric ripples.
 */
function createTierPoolWaterMaterial(poolRadius: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDaylight: { value: 1 },
      uNightGlow: { value: 0 },
      uPoolRadius: { value: poolRadius },
      uSkyColor: { value: new THREE.Color('#c7ded9') },
      uSunColor: { value: new THREE.Color('#fff2d3') },
    },
    vertexShader: `
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      void main() {
        vLocalPos = position;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDaylight;
      uniform float uNightGlow;
      uniform float uPoolRadius;
      uniform vec3 uSkyColor;
      uniform vec3 uSunColor;
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;

      void main() {
        float r = length(vLocalPos.xz);
        float wave = sin(r * 24.0 - uTime * 6.4) * 0.5 + sin(r * 38.0 - uTime * 9.2 + atan(vLocalPos.z, vLocalPos.x) * 4.0) * 0.25;
        vec3 normal = normalize(vec3(vLocalPos.x * wave * 0.16, 1.0, vLocalPos.z * wave * 0.16));
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = 0.08 + 0.92 * pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 3.6);

        vec3 baseCol = mix(vec3(0.14, 0.36, 0.42), vec3(0.42, 0.78, 0.78), uDaylight);
        baseCol += vec3(0.28, 0.62, 0.58) * uNightGlow * 0.45;
        vec3 color = mix(baseCol, uSkyColor * 0.92, fresnel * 0.62);

        float rimFoam = smoothstep(uPoolRadius - 0.16, uPoolRadius, r) * 0.52;
        float rippleFoam = smoothstep(0.45, 0.85, wave) * 0.34;
        float foam = clamp(rimFoam + rippleFoam, 0.0, 0.86);
        vec3 foamCol = mix(vec3(0.70, 0.85, 0.90), vec3(0.97, 0.99, 1.0), uDaylight);
        color = mix(color, foamCol, foam) + uSunColor * smoothstep(0.65, 0.95, wave) * 0.14 * uDaylight;

        gl_FragColor = vec4(color, clamp(0.80 + foam * 0.18, 0.78, 0.96));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
  })
}

/**
 * Custom GLSL shader for continuous arching parabolic water streams & central geyser plume.
 */
function createWaterStreamMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWind: { value: 0.6 },
      uDaylight: { value: 1 },
      uNightGlow: { value: 0 },
      uSunColor: { value: new THREE.Color('#fff2d3') },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uWind;
      varying vec2 vUv;
      varying vec3 vNormalWorld;
      varying vec3 vWorldPos;

      void main() {
        vUv = uv;
        vec3 pos = position;
        // Aerodynamic wind deflection grows quadratically along flight arc (uv.y)
        float sway = uv.y * uv.y;
        float gust = 0.8 + 0.2 * sin(uTime * 2.1 + pos.x * 1.4);
        pos.x += uWind * 0.14 * sway * gust;
        pos.z += uWind * 0.05 * sway * cos(uTime * 1.7 + pos.z);
        // Subtle live hydraulic flutter
        float flutter = sin(uv.y * 16.0 - uTime * 14.0 + pos.x * 3.0) * 0.006 * uv.y;
        pos += normal * flutter;

        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPos.xyz;
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDaylight;
      uniform float uNightGlow;
      uniform vec3 uSunColor;
      varying vec2 vUv;
      varying vec3 vNormalWorld;
      varying vec3 vWorldPos;

      void main() {
        vec3 normal = normalize(vNormalWorld);
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - clamp(abs(dot(normal, viewDir)), 0.0, 1.0), 2.1);

        // High-speed flowing aerated streaks along the water stream
        float flowA = sin(vUv.y * 22.0 - uTime * 19.0 + vUv.x * 6.2831);
        float flowB = cos(vUv.y * 37.0 - uTime * 27.0 - vUv.x * 12.566);
        float streak = smoothstep(-0.2, 0.95, flowA * 0.6 + flowB * 0.4);

        vec3 coreWater = mix(vec3(0.36, 0.64, 0.72), vec3(0.74, 0.93, 0.96), uDaylight);
        vec3 foamWhite = mix(vec3(0.76, 0.90, 0.95), vec3(0.99, 1.0, 1.0), uDaylight);
        vec3 color = mix(coreWater, foamWhite, clamp(streak * 0.65 + fresnel * 0.55 + vUv.y * 0.25, 0.0, 1.0));
        color += uSunColor * fresnel * 0.35 * uDaylight;
        color += vec3(0.35, 0.76, 0.72) * uNightGlow * (0.45 - vUv.y * 0.2);

        // Soft fade-in at nozzle and airy breakup toward landing splash
        float ends = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.86, 1.0, vUv.y));
        float alpha = clamp((0.36 + streak * 0.32 + fresnel * 0.26) * ends, 0.0, 0.88);
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

export interface PlazaFountainProps {
  wind: WindField
  lightingState: EnvironmentLightingSnapshot
  simulation: SimulationState
  lowDetail: boolean
}

export function PlazaFountain({ wind, lightingState, simulation, lowDetail }: PlazaFountainProps) {
  const { gl } = useThree()
  const dropletMeshRef = useRef<THREE.InstancedMesh>(null!)
  const pilasterRef = useRef<THREE.InstancedMesh>(null!)
  const pilasterCapRef = useRef<THREE.InstancedMesh>(null!)
  const fluteRef = useRef<THREE.InstancedMesh>(null!)
  const petalBracketRef = useRef<THREE.InstancedMesh>(null!)
  const rimNozzleRef = useRef<THREE.InstancedMesh>(null!)
  const midSpoutRef = useRef<THREE.InstancedMesh>(null!)
  const upperSpoutRef = useRef<THREE.InstancedMesh>(null!)

  const particleCount = lowDetail ? 200 : 380
  const gridSize = lowDetail ? 36 : 48
  const radialSegments = lowDetail ? 32 : 56

  const simulator = useMemo(() => new FountainWaterSimulator(particleCount, gridSize, 88421), [particleCount, gridSize])

  const resources = useMemo(() => {
    const maxAnisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy?.() ?? 4)
    const { map: stoneMap, bumpMap: stoneBump } = createTravertineTextures(maxAnisotropy)
    const mosaicMap = createMosaicFloorTexture(maxAnisotropy)

    const waveTexture = new THREE.DataTexture(
      simulator.textureData,
      gridSize,
      gridSize,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    )
    waveTexture.magFilter = THREE.LinearFilter
    waveTexture.minFilter = THREE.LinearFilter
    waveTexture.wrapS = THREE.ClampToEdgeWrapping
    waveTexture.wrapT = THREE.ClampToEdgeWrapping
    waveTexture.needsUpdate = true

    const geometries = buildFountainGeometries(radialSegments)
    const streamGeometry = buildParabolicStreamsGeometry(simulator.streams, lowDetail ? 5 : 7)

    // Varied roughness/metalness PBR architectural materials
    const carvedStoneMat = new THREE.MeshStandardMaterial({
      map: stoneMap,
      bumpMap: stoneBump,
      bumpScale: 0.018,
      color: '#f2e8d4',
      roughness: 0.76,
      metalness: 0.02,
    })

    const wetStoneMat = new THREE.MeshStandardMaterial({
      map: stoneMap,
      bumpMap: stoneBump,
      bumpScale: 0.012,
      color: '#d4cab4',
      roughness: 0.34,
      metalness: 0.06,
    })

    const plinthStoneMat = new THREE.MeshStandardMaterial({
      map: stoneMap,
      bumpMap: stoneBump,
      bumpScale: 0.022,
      color: '#ded4be',
      roughness: 0.84,
      metalness: 0.02,
    })

    const bronzeMat = new THREE.MeshStandardMaterial({
      color: '#8f7d58',
      roughness: 0.30,
      metalness: 0.84,
    })

    const mosaicMat = new THREE.MeshStandardMaterial({
      map: mosaicMap,
      roughness: 0.42,
      metalness: 0.08,
    })

    const dropletGeo = new THREE.IcosahedronGeometry(1, 0)
    const dropletMat = new THREE.MeshStandardMaterial({
      color: '#eaf8fb',
      roughness: 0.14,
      metalness: 0.05,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    })

    const uplightLensMat = new THREE.MeshStandardMaterial({
      color: '#b8f2ea',
      emissive: '#72e8d4',
      emissiveIntensity: 0.2,
      roughness: 0.18,
    })

    const mainWaterMat = createMainBasinWaterMaterial(waveTexture)
    const midWaterMat = createTierPoolWaterMaterial(FOUNTAIN_SPECS.midBowlRadius - 0.08)
    const upperWaterMat = createTierPoolWaterMaterial(FOUNTAIN_SPECS.upperBowlRadius - 0.06)
    const streamMat = createWaterStreamMaterial()

    return {
      stoneMap,
      stoneBump,
      mosaicMap,
      waveTexture,
      geometries,
      streamGeometry,
      carvedStoneMat,
      wetStoneMat,
      plinthStoneMat,
      bronzeMat,
      mosaicMat,
      dropletGeo,
      dropletMat,
      uplightLensMat,
      mainWaterMat,
      midWaterMat,
      upperWaterMat,
      streamMat,
    }
  }, [gl, simulator, gridSize, radialSegments, lowDetail])

  // Dispose all procedurally allocated GPU resources on unmount or quality rebuild
  useEffect(() => {
    return () => {
      resources.stoneMap.dispose()
      resources.stoneBump.dispose()
      resources.mosaicMap.dispose()
      resources.waveTexture.dispose()
      Object.values(resources.geometries).forEach(g => g.dispose())
      resources.streamGeometry.dispose()
      resources.carvedStoneMat.dispose()
      resources.wetStoneMat.dispose()
      resources.plinthStoneMat.dispose()
      resources.bronzeMat.dispose()
      resources.mosaicMat.dispose()
      resources.dropletGeo.dispose()
      resources.dropletMat.dispose()
      resources.uplightLensMat.dispose()
      resources.mainWaterMat.dispose()
      resources.midWaterMat.dispose()
      resources.upperWaterMat.dispose()
      resources.streamMat.dispose()
    }
  }, [resources])

  // Populate static architectural detail InstancedMeshes once
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()

    // 8 Carved Perimeter Stone Pilasters & Caps at octagonal vertices
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8
      dummy.position.set(Math.cos(a) * 2.91, 0.36, Math.sin(a) * 2.91)
      dummy.rotation.set(0, -a, 0)
      dummy.scale.set(0.32, 0.44, 0.34)
      dummy.updateMatrix()
      pilasterRef.current.setMatrixAt(i, dummy.matrix)

      dummy.position.set(Math.cos(a) * 2.91, 0.60, Math.sin(a) * 2.91)
      dummy.scale.set(0.38, 0.07, 0.40)
      dummy.updateMatrix()
      pilasterCapRef.current.setMatrixAt(i, dummy.matrix)
    }
    pilasterRef.current.instanceMatrix.needsUpdate = true
    pilasterRef.current.computeBoundingSphere()
    pilasterCapRef.current.instanceMatrix.needsUpdate = true
    pilasterCapRef.current.computeBoundingSphere()

    // 8 Vertical Carved Pedestal Scroll Ribs
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      dummy.position.set(Math.cos(a) * 0.46, 0.84, Math.sin(a) * 0.46)
      dummy.rotation.set(0, -a, 0)
      dummy.scale.set(0.11, 0.60, 0.08)
      dummy.updateMatrix()
      fluteRef.current.setMatrixAt(i, dummy.matrix)
    }
    fluteRef.current.instanceMatrix.needsUpdate = true
    fluteRef.current.computeBoundingSphere()

    // 8 Sculpted Lotus Petal Support Brackets under Upper Bowl
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8
      dummy.position.set(Math.cos(a) * 0.34, 2.06, Math.sin(a) * 0.34)
      dummy.rotation.set(0, -a, -0.35)
      dummy.scale.set(0.14, 0.24, 0.08)
      dummy.updateMatrix()
      petalBracketRef.current.setMatrixAt(i, dummy.matrix)
    }
    petalBracketRef.current.instanceMatrix.needsUpdate = true
    petalBracketRef.current.computeBoundingSphere()

    // 12 Burnished Bronze Outer Rim Jet Nozzles aimed inward along exact parabolic angle
    for (let i = 0; i < FOUNTAIN_SPECS.rimNozzleCount; i++) {
      const a = (i / FOUNTAIN_SPECS.rimNozzleCount) * Math.PI * 2 + Math.PI / 12
      dummy.position.set(
        Math.cos(a) * FOUNTAIN_SPECS.rimNozzleRadius,
        FOUNTAIN_SPECS.rimNozzleY - 0.03,
        Math.sin(a) * FOUNTAIN_SPECS.rimNozzleRadius
      )
      // Aim barrel inward and upward (~66 degrees elevation)
      dummy.rotation.set(0, -a, 0.42)
      dummy.scale.set(0.045, 0.14, 0.045)
      dummy.updateMatrix()
      rimNozzleRef.current.setMatrixAt(i, dummy.matrix)
    }
    rimNozzleRef.current.instanceMatrix.needsUpdate = true
    rimNozzleRef.current.computeBoundingSphere()

    // 12 Mid-Tier Bronze Overflow Weep Spouts
    for (let i = 0; i < FOUNTAIN_SPECS.midSpoutCount; i++) {
      const a = (i / FOUNTAIN_SPECS.midSpoutCount) * Math.PI * 2
      dummy.position.set(
        Math.cos(a) * FOUNTAIN_SPECS.midSpoutRadius,
        FOUNTAIN_SPECS.midSpoutY,
        Math.sin(a) * FOUNTAIN_SPECS.midSpoutRadius
      )
      dummy.rotation.set(0, -a, Math.PI * 0.48)
      dummy.scale.set(0.04, 0.12, 0.06)
      dummy.updateMatrix()
      midSpoutRef.current.setMatrixAt(i, dummy.matrix)
    }
    midSpoutRef.current.instanceMatrix.needsUpdate = true
    midSpoutRef.current.computeBoundingSphere()

    // 8 Upper-Tier Bronze Spill Lips
    for (let i = 0; i < FOUNTAIN_SPECS.upperSpoutCount; i++) {
      const a = (i / FOUNTAIN_SPECS.upperSpoutCount) * Math.PI * 2 + Math.PI / 8
      dummy.position.set(
        Math.cos(a) * FOUNTAIN_SPECS.upperSpoutRadius,
        FOUNTAIN_SPECS.upperSpoutY,
        Math.sin(a) * FOUNTAIN_SPECS.upperSpoutRadius
      )
      dummy.rotation.set(0, -a, Math.PI * 0.47)
      dummy.scale.set(0.032, 0.095, 0.048)
      dummy.updateMatrix()
      upperSpoutRef.current.setMatrixAt(i, dummy.matrix)
    }
    upperSpoutRef.current.instanceMatrix.needsUpdate = true
    upperSpoutRef.current.computeBoundingSphere()
  }, [])

  // Step the hydraulic simulator & push live wave texture + droplet transforms each frame
  useFrame((_, rawDelta) => {
    const dt = simulation.paused ? 0 : Math.min(rawDelta, 0.05)
    if (dt > 0) {
      simulator.step(dt, wind.value, lightingState.rainIntensity)
      resources.waveTexture.needsUpdate = true
    }

    const elapsed = simulation.elapsed
    const daylight = lightingState.daylight
    const nightGlow = lightingState.streetLampIntensity
    _sunDir.copy(lightingState.keyLightPosition).normalize()
    _skyCol.copy(lightingState.skyColor)
    _sunCol.copy(lightingState.sunColor)

    // Update Main Basin Water Shader uniforms
    const mainU = resources.mainWaterMat.uniforms
    mainU.uTime.value = elapsed
    mainU.uDaylight.value = daylight
    mainU.uNightGlow.value = nightGlow
    mainU.uCloudCover.value = lightingState.cloudCover
    mainU.uSunDir.value.copy(_sunDir)
    mainU.uSkyColor.value.copy(_skyCol)
    mainU.uSunColor.value.copy(_sunCol)

    // Update Mid & Upper Bowl Water Shader uniforms
    for (const mat of [resources.midWaterMat, resources.upperWaterMat]) {
      mat.uniforms.uTime.value = elapsed
      mat.uniforms.uDaylight.value = daylight
      mat.uniforms.uNightGlow.value = nightGlow
      mat.uniforms.uSkyColor.value.copy(_skyCol)
      mat.uniforms.uSunColor.value.copy(_sunCol)
    }

    // Update Continuous Parabolic Stream Shader uniforms
    const streamU = resources.streamMat.uniforms
    streamU.uTime.value = elapsed
    streamU.uWind.value = wind.value
    streamU.uDaylight.value = daylight
    streamU.uNightGlow.value = nightGlow
    streamU.uSunColor.value.copy(_sunCol)

    // Update submerged lantern emissive intensity at dusk/night
    resources.uplightLensMat.emissiveIntensity = 0.15 + nightGlow * 2.1

    // Update velocity-stretched InstancedMesh droplets (Zero GC)
    const mesh = dropletMeshRef.current
    if (mesh) {
      const p = simulator.particles
      for (let i = 0; i < p.count; i++) {
        const life = p.life[i]
        const age = p.age[i]
        if (age >= life || p.size[i] <= 0) {
          _dummy.position.set(0, -5, 0)
          _dummy.scale.setScalar(0.0001)
          _dummy.updateMatrix()
          mesh.setMatrixAt(i, _dummy.matrix)
          continue
        }

        const vx = p.vx[i]
        const vy = p.vy[i]
        const vz = p.vz[i]
        const speed = Math.hypot(vx, vy, vz)
        const baseSize = p.size[i]
        const lifeFade = Math.sin(Math.min(1, age / life) * Math.PI)
        const radius = Math.max(0.004, baseSize * (0.55 + 0.55 * lifeFade))
        const stretch = Math.min(3.8, 1.0 + speed * 0.42)

        _dummy.position.set(p.x[i], p.y[i], p.z[i])
        if (speed > 0.05) {
          _dir.set(vx / speed, vy / speed, vz / speed)
          _quat.setFromUnitVectors(_up, _dir)
          _dummy.quaternion.copy(_quat)
        } else {
          _dummy.quaternion.identity()
        }
        _dummy.scale.set(radius, radius * stretch, radius)
        _dummy.updateMatrix()
        mesh.setMatrixAt(i, _dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group position={[FOUNTAIN_CENTER.x, FOUNTAIN_CENTER.y, FOUNTAIN_CENTER.z]} name="blossom-plaza-fountain">
      {/* 1. Stepped Octagonal Carved Stone Plinth (grounded cleanly on Plaza paving) */}
      <mesh position={[0, 0.06, 0]} rotation-y={Math.PI / 8} material={resources.plinthStoneMat} receiveShadow castShadow>
        <cylinderGeometry args={[FOUNTAIN_SPECS.plinthOuterRadius - 0.04, FOUNTAIN_SPECS.plinthOuterRadius, 0.12, 8]} />
      </mesh>
      <mesh position={[0, 0.14, 0]} rotation-y={Math.PI / 8} material={resources.carvedStoneMat} receiveShadow castShadow>
        <cylinderGeometry args={[2.99, 3.04, 0.08, 8]} />
      </mesh>

      {/* 2. Carved Basin Rim Wall & Bullnose Coping */}
      <mesh geometry={resources.geometries.basinWall} material={resources.carvedStoneMat} receiveShadow castShadow />

      {/* 3. Submerged Mosaic Basin Floor (visible through translucent animated water) */}
      <mesh position={[0, FOUNTAIN_SPECS.basinFloorY + 0.008, 0]} rotation-x={-Math.PI / 2} material={resources.mosaicMat} receiveShadow>
        <circleGeometry args={[FOUNTAIN_SPECS.basinInnerRadius + 0.02, radialSegments]} />
      </mesh>

      {/* 4. 8 Perimeter Carved Stone Pilasters & Coping Caps */}
      <instancedMesh ref={pilasterRef} args={[undefined, undefined, 8]} material={resources.carvedStoneMat} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={pilasterCapRef} args={[undefined, undefined, 8]} material={resources.plinthStoneMat} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>

      {/* 5. Central Fluted Pedestal Column & Scroll Ribs */}
      <mesh geometry={resources.geometries.pedestal} material={resources.wetStoneMat} castShadow receiveShadow />
      <instancedMesh ref={fluteRef} args={[undefined, undefined, 8]} material={resources.carvedStoneMat} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>

      {/* 6. Wide Scalloped Middle Basin Bowl & Upper Turned Baluster Stem */}
      <mesh geometry={resources.geometries.midBowl} material={resources.carvedStoneMat} castShadow receiveShadow />
      <mesh geometry={resources.geometries.upperStem} material={resources.wetStoneMat} castShadow receiveShadow />
      <instancedMesh ref={petalBracketRef} args={[undefined, undefined, 8]} material={resources.carvedStoneMat} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>

      {/* 7. Upper Crown Lotus Bowl & Sculpted Blossom Finial Spire */}
      <mesh geometry={resources.geometries.upperBowl} material={resources.carvedStoneMat} castShadow receiveShadow />
      <mesh geometry={resources.geometries.finial} material={resources.wetStoneMat} castShadow receiveShadow />
      <mesh geometry={resources.geometries.crownNozzle} material={resources.bronzeMat} castShadow />

      {/* 8. Burnished Bronze Hydraulic Hardware (12 Rim Jet Nozzles, 12 Mid Spouts, 8 Upper Spill Lips) */}
      <instancedMesh ref={rimNozzleRef} args={[undefined, undefined, FOUNTAIN_SPECS.rimNozzleCount]} material={resources.bronzeMat} castShadow>
        <cylinderGeometry args={[0.62, 1.0, 1, 10]} />
      </instancedMesh>
      <instancedMesh ref={midSpoutRef} args={[undefined, undefined, FOUNTAIN_SPECS.midSpoutCount]} material={resources.bronzeMat} castShadow>
        <cylinderGeometry args={[0.55, 0.9, 1, 8]} />
      </instancedMesh>
      <instancedMesh ref={upperSpoutRef} args={[undefined, undefined, FOUNTAIN_SPECS.upperSpoutCount]} material={resources.bronzeMat} castShadow>
        <cylinderGeometry args={[0.5, 0.85, 1, 8]} />
      </instancedMesh>

      {/* 9. 4 Submerged Brass Underwater Uplights (glow softly at twilight & night) */}
      {[0, 1, 2, 3].map(idx => {
        const a = (idx / 4) * Math.PI * 2 + Math.PI / 4
        return (
          <group key={`uplight-${idx}`} position={[Math.cos(a) * 1.18, FOUNTAIN_SPECS.basinFloorY + 0.04, Math.sin(a) * 1.18]}>
            <mesh material={resources.bronzeMat}>
              <cylinderGeometry args={[0.09, 0.11, 0.07, 12]} />
            </mesh>
            <mesh position={[0, 0.04, 0]} material={resources.uplightLensMat}>
              <cylinderGeometry args={[0.07, 0.07, 0.015, 12]} />
            </mesh>
          </group>
        )
      })}

      {/* 10. Live 2D Wave-Equation Simulated Main Basin Water Surface */}
      <mesh
        position={[0, FOUNTAIN_SPECS.lowerWaterY, 0]}
        geometry={resources.geometries.mainWaterDisk}
        material={resources.mainWaterMat}
        renderOrder={2}
      />

      {/* 11. Animated Middle & Upper Tier Water Pools */}
      <mesh position={[0, FOUNTAIN_SPECS.midWaterY, 0]} rotation-x={-Math.PI / 2} material={resources.midWaterMat} renderOrder={2}>
        <circleGeometry args={[FOUNTAIN_SPECS.midBowlRadius - 0.07, radialSegments]} />
      </mesh>
      <mesh position={[0, FOUNTAIN_SPECS.upperWaterY, 0]} rotation-x={-Math.PI / 2} material={resources.upperWaterMat} renderOrder={2}>
        <circleGeometry args={[FOUNTAIN_SPECS.upperBowlRadius - 0.06, Math.max(24, Math.floor(radialSegments * 0.6))]} />
      </mesh>

      {/* 12. Continuous Flowing Parabolic Water Streams & Crown Geyser Plume */}
      <mesh geometry={resources.streamGeometry} material={resources.streamMat} renderOrder={3} />

      {/* 13. Physics-Simulated Ballistic Water Droplets & Reactive Splash Crowns */}
      <instancedMesh
        ref={dropletMeshRef}
        args={[resources.dropletGeo, resources.dropletMat, particleCount]}
        frustumCulled={false}
        renderOrder={4}
      />
    </group>
  )
}
