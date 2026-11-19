import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { generateExperimentalTreeSkeleton } from '../core/experimentalTree'
import { generateSakuraTreeSkeleton } from '../core/sakuraTree'
import type { TreePlacement } from '../core/types'
import type { WindField } from './Assets'
import type { EnvironmentLightingSnapshot } from './lighting'
import {
  buildSculptedLeafSprigGeometry,
  createBarkTextures,
  createLeafSprigTexture,
} from './ExperimentalTree'
import {
  buildSakuraSprigGeometry,
  createCherryBarkTextures,
  createSakuraSprigTexture,
} from './SakuraTree'

const _sunDir = new THREE.Vector3()

interface GenericBranchNode {
  x: number
  y: number
  z: number
  radius: number
  t: number
}

interface GenericBranchSegment {
  order: -1 | 0 | 1 | 2 | 3
  nodes: GenericBranchNode[]
  radialSegments: number
}

interface WorldWoodEntry {
  placement: TreePlacement
  branches: GenericBranchSegment[]
}

interface WorldGreenLeaf {
  x: number
  y: number
  z: number
  dirX: number
  dirY: number
  dirZ: number
  roll: number
  scale: number
  sunExposure: number
  windWeight: number
  hueShift: number
  treeHueOffset: number
  treeLightOffset: number
}

interface WorldSakuraSprig {
  x: number
  y: number
  z: number
  dirX: number
  dirY: number
  dirZ: number
  roll: number
  scale: number
  sunExposure: number
  windWeight: number
  hueShift: number
  isLeaf: boolean
  cultivarTint: number
}

/**
 * Merges every individual tree's unique procedural branch skeleton directly in world space
 * into one single indexed BufferGeometry (1 draw call for an entire species grove).
 */
function buildWorldMergedWoodGeometry(
  entries: WorldWoodEntry[],
  fluteLobes: number
): THREE.BufferGeometry {
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

  for (const { placement, branches } of entries) {
    const tx = placement.x
    const tz = placement.z
    const sc = placement.scale
    const cosR = Math.cos(placement.rotation)
    const sinR = Math.sin(placement.rotation)

    for (const branch of branches) {
      const nodes = branch.nodes
      if (nodes.length < 2) continue
      const radSegs = branch.radialSegments
      const stride = radSegs + 1
      let arcLen = 0
      let prevWx = 0
      let prevWy = 0
      let prevWz = 0

      for (let i = 0; i < nodes.length; i++) {
        const cur = nodes[i]
        const wx = tx + (cur.x * cosR + cur.z * sinR) * sc
        const wy = cur.y * sc
        const wz = tz + (-cur.x * sinR + cur.z * cosR) * sc
        p0.set(wx, wy, wz)

        if (i > 0) {
          arcLen += Math.hypot(wx - prevWx, wy - prevWy, wz - prevWz)
        }
        prevWx = wx
        prevWy = wy
        prevWz = wz

        if (i < nodes.length - 1) {
          const nxt = nodes[i + 1]
          p1.set(
            tx + (nxt.x * cosR + nxt.z * sinR) * sc,
            nxt.y * sc,
            tz + (-nxt.x * sinR + nxt.z * cosR) * sc
          )
          tangent.subVectors(p1, p0)
        } else {
          const prv = nodes[i - 1]
          p1.set(
            tx + (prv.x * cosR + prv.z * sinR) * sc,
            prv.y * sc,
            tz + (-prv.x * sinR + prv.z * cosR) * sc
          )
          tangent.subVectors(p0, p1)
        }
        if (tangent.lengthSq() < 1e-8) tangent.set(0, 1, 0)
        else tangent.normalize()

        if (i === 0) {
          const almostUp = Math.abs(tangent.y) > 0.92
          refAxis.set(almostUp ? 1 : 0, almostUp ? 0 : 1, 0)
          normal.crossVectors(tangent, refAxis).normalize()
          binormal.crossVectors(tangent, normal).normalize()
        } else {
          rotQuat.setFromUnitVectors(prevTangent, tangent)
          normal.applyQuaternion(rotQuat).normalize()
          binormal.crossVectors(tangent, normal).normalize()
        }
        prevTangent.copy(tangent)

        const vCoord = arcLen * (branch.order <= 0 ? 0.85 : 1.35)
        const scaledBaseR = cur.radius * sc

        for (let j = 0; j <= radSegs; j++) {
          const uFrac = j / radSegs
          const theta = uFrac * Math.PI * 2
          const c = Math.cos(theta)
          const s = Math.sin(theta)

          let r = scaledBaseR
          if (branch.order === 0 && cur.t < 0.36) {
            r *= 1 + Math.cos(theta * fluteLobes) * (1 - cur.t / 0.36) * 0.11
          }

          const nx = normal.x * c + binormal.x * s
          const ny = normal.y * c + binormal.y * s
          const nz = normal.z * c + binormal.z * s

          positions.push(wx + nx * r, wy + ny * r, wz + nz * r)
          normals.push(nx, ny, nz)
          uvs.push(uFrac * Math.max(1, scaledBaseR * 5.8), vCoord)
        }
      }

      for (let i = 0; i < nodes.length - 1; i++) {
        for (let j = 0; j < radSegs; j++) {
          const a = vertexOffset + i * stride + j
          const b = vertexOffset + (i + 1) * stride + j
          const c = vertexOffset + (i + 1) * stride + (j + 1)
          const d = vertexOffset + i * stride + (j + 1)
          indices.push(a, d, b, b, d, c)
        }
      }

      vertexOffset += nodes.length * stride
    }
  }

  const geo = new THREE.BufferGeometry()
  if (positions.length > 0) {
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.setIndex(
      vertexOffset > 65535
        ? new THREE.Uint32BufferAttribute(indices, 1)
        : new THREE.Uint16BufferAttribute(indices, 1)
    )
    geo.computeVertexNormals()
    geo.computeBoundingSphere()
  }
  return geo
}

export interface CityTreeGroveProps {
  trees: TreePlacement[]
  wind: WindField
  lightingState: EnvironmentLightingSnapshot
  lowDetail: boolean
}

/**
 * Renders the entire remapped city's urban grove by replacing every old tree location with
 * either a unique procedural Japanese Sakura tree or a unique procedural Deciduous Green tree.
 *
 * Every individual tree has its own deterministic branch map (unique trunk lean, root buttresses,
 * primary boughs/limbs, secondary forks, twigs, and anchored foliage) while batching the whole
 * city into just 4 draw calls (Green Wood, Green Foliage, Sakura Wood, Sakura Canopy).
 */
export function CityTreeGrove({ trees, wind, lightingState, lowDetail }: CityTreeGroveProps) {
  const { gl } = useThree()
  const greenFoliageRef = useRef<THREE.InstancedMesh>(null!)
  const sakuraFoliageRef = useRef<THREE.InstancedMesh>(null!)

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

  const groveData = useMemo(() => {
    const mode = lowDetail ? 'city-low' : 'city'
    const greenWoodEntries: WorldWoodEntry[] = []
    const sakuraWoodEntries: WorldWoodEntry[] = []
    const greenLeaves: WorldGreenLeaf[] = []
    const sakuraSprigs: WorldSakuraSprig[] = []

    for (const tree of trees) {
      const cosR = Math.cos(tree.rotation)
      const sinR = Math.sin(tree.rotation)
      const sc = tree.scale
      // Deterministic per-tree subtle botanical color variation
      const treeHash = ((tree.seed * 2654435761) >>> 0) / 4294967296

      if (tree.species === 'green') {
        const skel = generateExperimentalTreeSkeleton(tree.seed, lowDetail, mode)
        greenWoodEntries.push({ placement: tree, branches: skel.branches })

        const treeHueOffset = (treeHash - 0.5) * 0.065
        const treeLightOffset = (((tree.seed * 1597334677) >>> 0) / 4294967296 - 0.5) * 0.07

        for (const lf of skel.leaves) {
          greenLeaves.push({
            x: tree.x + (lf.x * cosR + lf.z * sinR) * sc,
            y: lf.y * sc,
            z: tree.z + (-lf.x * sinR + lf.z * cosR) * sc,
            dirX: lf.dirX * cosR + lf.dirZ * sinR,
            dirY: lf.dirY,
            dirZ: -lf.dirX * sinR + lf.dirZ * cosR,
            roll: lf.roll,
            scale: lf.scale * sc,
            sunExposure: lf.sunExposure,
            windWeight: lf.windWeight,
            hueShift: lf.hueShift,
            treeHueOffset,
            treeLightOffset,
          })
        }
      } else {
        const skel = generateSakuraTreeSkeleton(tree.seed, lowDetail, mode)
        sakuraWoodEntries.push({ placement: tree, branches: skel.branches })

        for (const slot of skel.canopySlots) {
          sakuraSprigs.push({
            x: tree.x + (slot.x * cosR + slot.z * sinR) * sc,
            y: slot.y * sc,
            z: tree.z + (-slot.x * sinR + slot.z * cosR) * sc,
            dirX: slot.dirX * cosR + slot.dirZ * sinR,
            dirY: slot.dirY,
            dirZ: -slot.dirX * sinR + slot.dirZ * cosR,
            roll: slot.roll,
            scale: slot.maxScale * sc,
            sunExposure: slot.sunExposure,
            windWeight: slot.windWeight,
            hueShift: slot.hueShift,
            isLeaf: slot.isLeaf,
            cultivarTint: treeHash,
          })
        }
      }
    }

    return {
      greenWoodEntries,
      sakuraWoodEntries,
      greenLeaves,
      sakuraSprigs,
    }
  }, [trees, lowDetail])

  const resources = useMemo(() => {
    const maxAnisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy?.() ?? 4)

    // 1. Procedural Bark & Foliage Textures (shared per species)
    const { map: greenBarkMap, bumpMap: greenBarkBump } = createBarkTextures(maxAnisotropy)
    const greenLeafMap = createLeafSprigTexture(maxAnisotropy)
    const { map: sakuraBarkMap, bumpMap: sakuraBarkBump } = createCherryBarkTextures(maxAnisotropy)
    const sakuraSprigMap = createSakuraSprigTexture(maxAnisotropy)

    // 2. Merged World-Space Wood Geometries (every individual tree retains its own unique branch map)
    const greenWoodGeo = buildWorldMergedWoodGeometry(groveData.greenWoodEntries, 6)
    const sakuraWoodGeo = buildWorldMergedWoodGeometry(groveData.sakuraWoodEntries, 7)

    // 3. Sculpted Crossed-Card 3D Sprig Geometries (8 tris/sprig for lush volume at high FPS)
    const greenSprigGeo = buildSculptedLeafSprigGeometry(1, 2)
    const sakuraSprigGeo = buildSakuraSprigGeometry(1, 2)

    const greenCount = groveData.greenLeaves.length
    const aGreenData = new Float32Array(Math.max(1, greenCount) * 3)
    for (let i = 0; i < greenCount; i++) {
      const lf = groveData.greenLeaves[i]
      aGreenData[i * 3 + 0] = (i * 1.6180339 + lf.x * 0.37 + lf.z * 0.29) % (Math.PI * 2)
      aGreenData[i * 3 + 1] = lf.windWeight
      aGreenData[i * 3 + 2] = lf.sunExposure
    }
    greenSprigGeo.setAttribute('aLeafData', new THREE.InstancedBufferAttribute(aGreenData, 3))

    const sakuraCount = groveData.sakuraSprigs.length
    const aSakuraData = new Float32Array(Math.max(1, sakuraCount) * 3)
    for (let i = 0; i < sakuraCount; i++) {
      const s = groveData.sakuraSprigs[i]
      aSakuraData[i * 3 + 0] = (i * 1.91357 + s.x * 0.31 + s.z * 0.43) % (Math.PI * 2)
      aSakuraData[i * 3 + 1] = s.windWeight
      aSakuraData[i * 3 + 2] = s.sunExposure
    }
    sakuraSprigGeo.setAttribute('aSakuraData', new THREE.InstancedBufferAttribute(aSakuraData, 3))

    // 4. PBR Bark Materials
    const greenBarkMat = new THREE.MeshStandardMaterial({
      map: greenBarkMap,
      bumpMap: greenBarkBump,
      bumpScale: 0.04,
      color: '#d8cbbd',
      roughness: 0.90,
      metalness: 0.0,
    })

    const sakuraBarkMat = new THREE.MeshStandardMaterial({
      map: sakuraBarkMap,
      bumpMap: sakuraBarkBump,
      bumpScale: 0.035,
      color: '#d4c1c2',
      roughness: 0.84,
      metalness: 0.04,
    })

    // 5. Backlit Wind-Swaying Foliage Materials
    const greenLeafMat = new THREE.MeshStandardMaterial({
      map: greenLeafMap,
      alphaTest: 0.42,
      roughness: 0.48,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })
    greenLeafMat.customProgramCacheKey = () => 'elyria-city-green-foliage-v1'
    greenLeafMat.onBeforeCompile = shader => {
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
          float primarySway = sin(uTime * 1.55 + leafPhase) * 0.052 * windWeight * windStrength;
          float flutter = sin(uTime * 4.8 + leafPhase * 2.9 + position.x * 5.0) * 0.022 * tipFlex * windStrength;
          transformed.x += (primarySway + flutter);
          transformed.z += cos(uTime * 1.25 + leafPhase * 1.4) * 0.038 * windWeight * windStrength;
          transformed.y += sin(uTime * 3.5 + leafPhase * 2.1) * 0.014 * tipFlex * windStrength;`
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
          `vec3 leafViewDir = normalize(cameraPosition - vLeafWorldPos);
          float backLight = pow(clamp(dot(leafViewDir, -normalize(uSunDir)), 0.0, 1.0), 2.8);
          float skyLift = 0.14 + 0.34 * vSunExposure;
          vec3 sssTint = vec3(0.62, 0.82, 0.24) * uSunColor;
          outgoingLight += diffuseColor.rgb * sssTint * (backLight * 0.68 + skyLift * 0.20) * uDaylight;
          #include <opaque_fragment>`
        )
    }

    const sakuraCanopyMat = new THREE.MeshStandardMaterial({
      map: sakuraSprigMap,
      alphaTest: 0.42,
      roughness: 0.52,
      metalness: 0.01,
      side: THREE.DoubleSide,
    })
    sakuraCanopyMat.customProgramCacheKey = () => 'elyria-city-sakura-canopy-v1'
    sakuraCanopyMat.onBeforeCompile = shader => {
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
          float breeze = 0.25 + uWind * 1.2;
          transformed.x += (sin(uTime * 1.48 + sPhase) * 0.056 * sWind + sin(uTime * 4.5 + sPhase * 2.5) * 0.022 * tipFlex) * breeze;
          transformed.z += cos(uTime * 1.2 + sPhase * 1.3) * 0.044 * sWind * breeze;
          transformed.y += sin(uTime * 3.2 + sPhase * 1.9) * 0.015 * tipFlex * breeze;`
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
          vec3 petalGlow = vec3(1.06, 0.70, 0.82) * uSunColor;
          float dayRadiance = (backLight * 0.85 + (0.20 + 0.46 * vSunExposure) * 0.34) * uDaylight;
          vec3 moonShimmer = vec3(1.00, 0.72, 0.88) * (0.12 + 0.32 * vSunExposure) * (1.0 - uDaylight) * 0.38;
          outgoingLight += diffuseColor.rgb * (petalGlow * dayRadiance + moonShimmer);
          #include <opaque_fragment>`
        )
    }

    return {
      greenBarkMap,
      greenBarkBump,
      greenLeafMap,
      sakuraBarkMap,
      sakuraBarkBump,
      sakuraSprigMap,
      greenWoodGeo,
      sakuraWoodGeo,
      greenSprigGeo,
      sakuraSprigGeo,
      greenBarkMat,
      sakuraBarkMat,
      greenLeafMat,
      sakuraCanopyMat,
    }
  }, [gl, groveData, uniforms])

  // StrictMode-safe GPU resource disposal
  const activeResourcesRef = useRef<typeof resources | null>(null)
  useEffect(() => {
    activeResourcesRef.current = resources
    return () => {
      activeResourcesRef.current = null
      const toDispose = resources
      queueMicrotask(() => {
        if (activeResourcesRef.current !== toDispose) {
          toDispose.greenBarkMap.dispose()
          toDispose.greenBarkBump.dispose()
          toDispose.greenLeafMap.dispose()
          toDispose.sakuraBarkMap.dispose()
          toDispose.sakuraBarkBump.dispose()
          toDispose.sakuraSprigMap.dispose()
          toDispose.greenWoodGeo.dispose()
          toDispose.sakuraWoodGeo.dispose()
          toDispose.greenSprigGeo.dispose()
          toDispose.sakuraSprigGeo.dispose()
          toDispose.greenBarkMat.dispose()
          toDispose.sakuraBarkMat.dispose()
          toDispose.greenLeafMat.dispose()
          toDispose.sakuraCanopyMat.dispose()
        }
      })
    }
  }, [resources])

  // Populate all batched instanced foliage matrices & per-tree/per-sprig botanical tints
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    const up = new THREE.Vector3(0, 1, 0)
    const dir = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const rollQuat = new THREE.Quaternion()
    const color = new THREE.Color()

    const gMesh = greenFoliageRef.current
    if (gMesh && groveData.greenLeaves.length > 0) {
      const deepShade = new THREE.Color('#456835')
      const midEmerald = new THREE.Color('#7aa44c')
      const sunlitGold = new THREE.Color('#b6cc60')
      const springLime = new THREE.Color('#9bc266')

      groveData.greenLeaves.forEach((lf, i) => {
        dir.set(lf.dirX, lf.dirY, lf.dirZ).normalize()
        quat.setFromUnitVectors(up, dir)
        rollQuat.setFromAxisAngle(dir, lf.roll)
        quat.premultiply(rollQuat)

        dummy.position.set(lf.x, lf.y, lf.z)
        dummy.quaternion.copy(quat)
        dummy.scale.setScalar(lf.scale)
        dummy.updateMatrix()
        gMesh.setMatrixAt(i, dummy.matrix)

        if (lf.sunExposure < 0.5) {
          color.copy(deepShade).lerp(midEmerald, lf.sunExposure * 2)
        } else {
          color
            .copy(midEmerald)
            .lerp(lf.hueShift > 0.62 ? sunlitGold : springLime, (lf.sunExposure - 0.5) * 2)
        }
        color.offsetHSL(
          lf.treeHueOffset + (lf.hueShift - 0.5) * 0.035,
          (lf.hueShift - 0.5) * 0.05,
          lf.treeLightOffset + (lf.hueShift - 0.5) * 0.045
        )
        gMesh.setColorAt(i, color)
      })
      gMesh.instanceMatrix.needsUpdate = true
      if (gMesh.instanceColor) gMesh.instanceColor.needsUpdate = true
      gMesh.computeBoundingSphere()
    }

    const sMesh = sakuraFoliageRef.current
    if (sMesh && groveData.sakuraSprigs.length > 0) {
      const blossomShade = new THREE.Color('#eea4bc')
      const blossomBright = new THREE.Color('#ffe0ea')
      const blossomCream = new THREE.Color('#fff3f7')
      const kanzanRose = new THREE.Color('#f59ab6')
      const springLeafShade = new THREE.Color('#788a48')
      const springLeafSun = new THREE.Color('#a8ba60')

      groveData.sakuraSprigs.forEach((s, i) => {
        dir.set(s.dirX, s.dirY, s.dirZ).normalize()
        quat.setFromUnitVectors(up, dir)
        rollQuat.setFromAxisAngle(dir, s.roll)
        quat.premultiply(rollQuat)

        dummy.position.set(s.x, s.y, s.z)
        dummy.quaternion.copy(quat)
        dummy.scale.setScalar(s.scale)
        dummy.updateMatrix()
        sMesh.setMatrixAt(i, dummy.matrix)

        if (s.isLeaf) {
          color.copy(springLeafShade).lerp(springLeafSun, s.sunExposure * 0.75 + 0.25)
          color.offsetHSL((s.hueShift - 0.5) * 0.03, 0, (s.hueShift - 0.5) * 0.04)
        } else {
          if (s.sunExposure < 0.5) {
            color.copy(blossomShade).lerp(blossomBright, s.sunExposure * 2)
          } else {
            color.copy(blossomBright).lerp(blossomCream, (s.sunExposure - 0.5) * 2)
          }
          // Subtle cherry cultivar diversity: Yoshino snow-blush (low tint) -> classic pink -> rosy Kanzan (high tint)
          if (s.cultivarTint < 0.33) {
            color.lerp(blossomCream, 0.28)
          } else if (s.cultivarTint > 0.68) {
            color.lerp(kanzanRose, 0.24)
          }
          color.offsetHSL((s.hueShift - 0.5) * 0.02, 0, (s.hueShift - 0.5) * 0.03)
        }
        sMesh.setColorAt(i, color)
      })
      sMesh.instanceMatrix.needsUpdate = true
      if (sMesh.instanceColor) sMesh.instanceColor.needsUpdate = true
      sMesh.computeBoundingSphere()
    }
  }, [groveData])

  useFrame(() => {
    uniforms.uTime.value = wind.time
    uniforms.uWind.value = wind.value
    uniforms.uDaylight.value = lightingState.daylight
    _sunDir.copy(lightingState.keyLightPosition).normalize()
    uniforms.uSunDir.value.copy(_sunDir)
    uniforms.uSunColor.value.copy(lightingState.sunColor)
  })

  const greenCount = groveData.greenLeaves.length
  const sakuraCount = groveData.sakuraSprigs.length

  return (
    <group name="city-unique-tree-grove">
      {/* 1. All Unique Deciduous Green Tree Wood Skeletons (1 merged draw call) */}
      {groveData.greenWoodEntries.length > 0 && (
        <mesh
          geometry={resources.greenWoodGeo}
          material={resources.greenBarkMat}
          castShadow={!lowDetail}
          receiveShadow
        />
      )}

      {/* 2. All Deciduous Green Tree Backlit Leaf Sprigs (1 instanced draw call) */}
      {greenCount > 0 && (
        <instancedMesh
          key={`city-green-foliage-${greenCount}`}
          ref={greenFoliageRef}
          args={[resources.greenSprigGeo, resources.greenLeafMat, greenCount]}
          castShadow={!lowDetail}
          receiveShadow
        />
      )}

      {/* 3. All Unique Japanese Sakura Tree Wood Skeletons (1 merged draw call) */}
      {groveData.sakuraWoodEntries.length > 0 && (
        <mesh
          geometry={resources.sakuraWoodGeo}
          material={resources.sakuraBarkMat}
          castShadow={!lowDetail}
          receiveShadow
        />
      )}

      {/* 4. All Japanese Sakura Tree Backlit Blossom & Spring-Leaf Sprigs (1 instanced draw call) */}
      {sakuraCount > 0 && (
        <instancedMesh
          key={`city-sakura-foliage-${sakuraCount}`}
          ref={sakuraFoliageRef}
          args={[resources.sakuraSprigGeo, resources.sakuraCanopyMat, sakuraCount]}
          castShadow={!lowDetail}
          receiveShadow
        />
      )}
    </group>
  )
}
