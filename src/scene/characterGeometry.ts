import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export type CharacterKind = 'protagonist' | 'companion' | 'citizen'

export type CharacterMaterialKey =
  | 'wood'
  | 'lilac'
  | 'sage'
  | 'cream'
  | 'skin'
  | 'hair'
  | 'black'
  | 'white'
  | 'pink'
  | 'orange'
  | 'glow'

interface MaterialSpec {
  name: string
  /** Linear RGB values matching Blender Principled BSDF / glTF baseColorFactor */
  color: [number, number, number]
  roughness: number
  /** Linear RGB emission matching glTF emissiveFactor */
  emissive?: [number, number, number]
}

/**
 * Exact material definitions extracted from the original Blender character assets
 * (scripts/blender/build-kit.py -> glTF 2.0 baseColorFactor in linear-sRGB space).
 */
export const CHARACTER_MATERIAL_SPECS: Record<CharacterMaterialKey, MaterialSpec> = {
  wood: { name: 'ELYRIA_honeywood', color: [0.46, 0.25, 0.12], roughness: 0.75 },
  lilac: { name: 'ELYRIA_lilac', color: [0.54, 0.42, 0.67], roughness: 0.75 },
  sage: { name: 'ELYRIA_sage', color: [0.29, 0.55, 0.45], roughness: 0.75 },
  cream: { name: 'ELYRIA_porcelain', color: [0.93, 0.86, 0.69], roughness: 0.75 },
  skin: { name: 'ELYRIA_skin', color: [1.0, 0.7, 0.5], roughness: 0.75 },
  hair: { name: 'ELYRIA_auburn', color: [0.28, 0.1, 0.06], roughness: 0.75 },
  black: { name: 'ELYRIA_ink', color: [0.028, 0.045, 0.047], roughness: 0.75 },
  white: { name: 'ELYRIA_rice', color: [1.0, 0.96, 0.83], roughness: 0.75 },
  pink: { name: 'ELYRIA_petal', color: [0.95, 0.43, 0.51], roughness: 0.75 },
  orange: { name: 'ELYRIA_tangerine', color: [0.96, 0.37, 0.09], roughness: 0.75 },
  glow: {
    name: 'ELYRIA_warm_window',
    color: [1.0, 0.66, 0.28],
    roughness: 0.5,
    emissive: [0.18, 0.1188, 0.0504],
  },
}

export interface CharacterMeshPart {
  name: string
  geometry: THREE.BufferGeometry
  material: THREE.Material
  matrix: THREE.Matrix4
}

type GeometryBuckets = Map<CharacterMaterialKey, THREE.BufferGeometry[]>

const UP_AXIS = new THREE.Vector3(0, 1, 0)

function createStandardMaterial(key: CharacterMaterialKey): THREE.MeshStandardMaterial {
  const spec = CHARACTER_MATERIAL_SPECS[key]
  const mat = new THREE.MeshStandardMaterial({
    name: spec.name,
    color: new THREE.Color(spec.color[0], spec.color[1], spec.color[2]),
    roughness: spec.roughness,
    metalness: 0,
    side: THREE.DoubleSide,
  })
  if (spec.emissive) {
    mat.emissive = new THREE.Color(spec.emissive[0], spec.emissive[1], spec.emissive[2])
    mat.emissiveIntensity = 1
  }
  return mat
}

/**
 * Normalizes a geometry to non-indexed with position, normal, and uv attributes
 * so mergeGeometries produces clean, consistent vertex buffers across all primitive types.
 */
function normalizeForMerge(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const geom = source.index ? source.toNonIndexed() : source.clone()
  if (source !== geom) source.dispose()
  if (!geom.getAttribute('normal')) {
    geom.computeVertexNormals()
  }
  const posCount = geom.getAttribute('position').count
  if (!geom.getAttribute('uv')) {
    geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(posCount * 2), 2))
  }
  // Remove any extra attributes so all merged primitives share identical attribute sets
  for (const attrName of Object.keys(geom.attributes)) {
    if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
      geom.deleteAttribute(attrName)
    }
  }
  return geom
}

function pushGeometry(buckets: GeometryBuckets, matKey: CharacterMaterialKey, geom: THREE.BufferGeometry): void {
  const list = buckets.get(matKey)
  if (list) list.push(normalizeForMerge(geom))
  else buckets.set(matKey, [normalizeForMerge(geom)])
}

/**
 * Converts Blender coordinates (bx, by, bz) [+Z up, -Y forward]
 * into glTF / Three.js coordinates (x, y, z) = (bx, bz, -by) [+Y up, +Z forward].
 */
function addBeveledCube(
  buckets: GeometryBuckets,
  matKey: CharacterMaterialKey,
  bLoc: [number, number, number],
  bSize: [number, number, number],
  bevel: number,
): void {
  const width = bSize[0]
  const height = bSize[2]
  const depth = bSize[1]
  const maxBevel = Math.min(width, height, depth) * 0.49
  const radius = Math.min(bevel, maxBevel)
  const segments = bevel > 0.14 ? 3 : 2
  const geom = radius > 0.0005
    ? new RoundedBoxGeometry(width, height, depth, segments, radius)
    : new THREE.BoxGeometry(width, height, depth)
  geom.translate(bLoc[0], bLoc[2], -bLoc[1])
  pushGeometry(buckets, matKey, geom)
}

function addSphere(
  buckets: GeometryBuckets,
  matKey: CharacterMaterialKey,
  bLoc: [number, number, number],
  bScale: [number, number, number],
  segments = 16,
  rings = 8,
  bRotY = 0,
): void {
  const geom = new THREE.SphereGeometry(1, segments, rings)
  geom.scale(bScale[0], bScale[2], bScale[1])
  if (bRotY !== 0) {
    // Blender rotation_euler.y maps to Three.js rotation.z = -bRotY under (x, z, -y)
    geom.rotateZ(-bRotY)
  }
  geom.translate(bLoc[0], bLoc[2], -bLoc[1])
  pushGeometry(buckets, matKey, geom)
}

function createBeveledCylinderGeometry(radius: number, depth: number, vertices = 16): THREE.BufferGeometry {
  const halfH = depth * 0.5
  const b = Math.min(0.055, radius * 0.2, halfH * 0.45)
  const rInner = Math.max(0.001, radius - b)
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0, -halfH),
    new THREE.Vector2(rInner, -halfH),
    new THREE.Vector2(rInner + b * Math.sin(Math.PI / 4), -halfH + b * (1 - Math.cos(Math.PI / 4))),
    new THREE.Vector2(radius, -halfH + b),
    new THREE.Vector2(radius, halfH - b),
    new THREE.Vector2(rInner + b * Math.sin(Math.PI / 4), halfH - b * (1 - Math.cos(Math.PI / 4))),
    new THREE.Vector2(rInner, halfH),
    new THREE.Vector2(0, halfH),
  ]
  return new THREE.LatheGeometry(pts, vertices)
}

function addBeveledCylinder(
  buckets: GeometryBuckets,
  matKey: CharacterMaterialKey,
  bLoc: [number, number, number],
  radius: number,
  depth: number,
  vertices = 16,
): void {
  const geom = createBeveledCylinderGeometry(radius, depth, vertices)
  geom.translate(bLoc[0], bLoc[2], -bLoc[1])
  pushGeometry(buckets, matKey, geom)
}

function addRod(
  buckets: GeometryBuckets,
  matKey: CharacterMaterialKey,
  bStart: [number, number, number],
  bEnd: [number, number, number],
  radius: number,
  vertices = 10,
): void {
  const a = new THREE.Vector3(bStart[0], bStart[2], -bStart[1])
  const b = new THREE.Vector3(bEnd[0], bEnd[2], -bEnd[1])
  const delta = new THREE.Vector3().subVectors(b, a)
  const length = delta.length()
  const geom = createBeveledCylinderGeometry(radius, length, vertices)
  if (length > 1e-6) {
    const dir = delta.divideScalar(length)
    const quat = new THREE.Quaternion().setFromUnitVectors(UP_AXIS, dir)
    geom.applyQuaternion(quat)
  }
  geom.translate((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, (a.z + b.z) * 0.5)
  pushGeometry(buckets, matKey, geom)
}

function addCone(
  buckets: GeometryBuckets,
  matKey: CharacterMaterialKey,
  bLoc: [number, number, number],
  radiusBottom: number,
  radiusTop: number,
  depth: number,
  vertices = 12,
): void {
  const geom = new THREE.CylinderGeometry(radiusTop, radiusBottom, depth, vertices)
  geom.translate(bLoc[0], bLoc[2], -bLoc[1])
  pushGeometry(buckets, matKey, geom)
}

/**
 * Exact procedural Three.js recreation of ELYRIA protagonist (citizen = false)
 * and citizen (citizen = true) characters originally authored in Blender.
 */
function populateHumanoid(buckets: GeometryBuckets, citizen: boolean): void {
  const cloth: CharacterMaterialKey = citizen ? 'sage' : 'lilac'

  for (const side of [-1, 1] as const) {
    const x = side * 0.135
    addBeveledCube(buckets, 'wood', [x, -0.055, 0.095], [0.23, 0.32, 0.19], 0.065)
    addSphere(buckets, cloth, [x, 0, 0.31], [0.1, 0.1, 0.24])
  }

  addSphere(buckets, 'cream', [0, 0, 0.67], [0.31, 0.21, 0.36])
  addBeveledCube(buckets, cloth, [0, -0.202, 0.62], [0.4, 0.045, 0.25], 0.035)

  for (const side of [-1, 1] as const) {
    addSphere(buckets, cloth, [side * 0.32, 0, 0.66], [0.11, 0.12, 0.25], 16, 8, side * -0.18)
    addSphere(buckets, 'skin', [side * 0.365, -0.005, 0.47], [0.09, 0.09, 0.105])
  }

  addSphere(buckets, 'skin', [0, -0.025, 1.22], [0.385, 0.325, 0.385], 24, 12)
  addSphere(buckets, 'hair', [0, 0.045, 1.35], [0.407, 0.32, 0.29], 20, 10)

  for (const side of [-1, 1] as const) {
    addSphere(buckets, 'skin', [side * 0.365, -0.005, 1.2], [0.075, 0.06, 0.09])
    addSphere(buckets, 'hair', [side * 0.33, -0.13, 1.27], [0.09, 0.15, 0.23])
    addSphere(buckets, 'black', [side * 0.135, -0.333, 1.215], [0.037, 0.024, 0.053], 12, 8)
    addSphere(buckets, 'white', [side * 0.135 - 0.008, -0.354, 1.235], [0.011, 0.008, 0.014], 8, 6)
    addSphere(buckets, 'pink', [side * 0.232, -0.31, 1.13], [0.059, 0.014, 0.027], 12, 6)
  }

  addSphere(buckets, 'skin', [0, -0.35, 1.145], [0.026, 0.024, 0.023], 12, 6)
  addSphere(buckets, 'hair', [0, -0.33, 1.064], [0.04, 0.012, 0.017], 12, 6)

  const fringePoints: [number, number][] = [
    [-0.24, 1.45],
    [-0.1, 1.47],
    [0.05, 1.45],
    [0.2, 1.42],
  ]
  for (const [x, z] of fringePoints) {
    addSphere(buckets, 'hair', [x, -0.26, z], [0.105, 0.08, 0.16], 16, 8, -0.22)
  }

  addSphere(buckets, cloth, [0.03, 0.01, 1.61], [0.43, 0.34, 0.14], 20, 8)
  addBeveledCylinder(buckets, 'cream', [0.08, 0, 1.765], 0.042, 0.045, 12)
  addBeveledCube(buckets, cloth, [0, -0.12, 0.925], [0.37, 0.25, 0.085], 0.04)

  if (!citizen) {
    addBeveledCube(buckets, 'orange', [0, 0.26, 0.7], [0.4, 0.22, 0.4], 0.085)
    addBeveledCube(buckets, 'cream', [0, 0.384, 0.65], [0.27, 0.05, 0.16], 0.035)
    for (const side of [-1, 1] as const) {
      addRod(buckets, 'orange', [side * 0.21, -0.08, 0.85], [side * 0.2, -0.11, 0.55], 0.023, 8)
    }
  }
}

/**
 * Exact procedural Three.js recreation of ELYRIA companion cloud-fox/cat follower
 * originally authored in Blender.
 */
function populateCompanion(buckets: GeometryBuckets): void {
  addSphere(buckets, 'cream', [0, 0.1, 0.32], [0.28, 0.38, 0.26])
  addSphere(buckets, 'white', [0, -0.21, 0.55], [0.3, 0.26, 0.29], 20, 10)

  for (const side of [-1, 1] as const) {
    addCone(buckets, 'cream', [side * 0.18, -0.17, 0.83], 0.11, 0.018, 0.28, 12)
    addSphere(buckets, 'pink', [side * 0.18, -0.236, 0.82], [0.055, 0.012, 0.09], 12, 6)
    addSphere(buckets, 'black', [side * 0.105, -0.444, 0.56], [0.03, 0.02, 0.043], 12, 6)
    for (const y of [-0.1, 0.3] as const) {
      addSphere(buckets, 'lilac', [side * 0.18, y, 0.12], [0.09, 0.115, 0.1])
    }
    addSphere(buckets, 'pink', [side * 0.18, -0.418, 0.48], [0.045, 0.012, 0.024], 12, 6)
  }

  addSphere(buckets, 'pink', [0, -0.463, 0.49], [0.023, 0.016, 0.019], 12, 6)

  for (let i = 0; i < 5; i++) {
    addSphere(
      buckets,
      'lilac',
      [0.07 + i * 0.038, 0.41 + i * 0.1, 0.32 + i * 0.064],
      [0.13 - i * 0.012, 0.145 - i * 0.012, 0.13 - i * 0.008],
    )
  }

  addSphere(buckets, 'glow', [0, -0.18, 0.27], [0.045, 0.04, 0.045], 12, 6)
}

function buildBuckets(kind: CharacterKind): GeometryBuckets {
  const buckets: GeometryBuckets = new Map()
  if (kind === 'protagonist') populateHumanoid(buckets, false)
  else if (kind === 'citizen') populateHumanoid(buckets, true)
  else populateCompanion(buckets)
  return buckets
}

/**
 * Builds procedural Three.js character mesh parts:
 * - Full PBR mode (`lite = false`): one merged BufferGeometry + MeshStandardMaterial per material slot,
 *   matching the original Blender GLB primitive batching and exact linear PBR material parameters.
 * - Lite mode (`lite = true`): single vertex-colored MeshLambertMaterial batch with night-glow shader support.
 */
export function buildCharacterParts(kind: CharacterKind, lite = false): CharacterMeshPart[] {
  const buckets = buildBuckets(kind)

  if (!lite) {
    const parts: CharacterMeshPart[] = []
    for (const [matKey, geoms] of buckets.entries()) {
      const merged = mergeGeometries(geoms, false)
      geoms.forEach(g => g.dispose())
      if (!merged) throw new Error(`Failed to merge character geometry for ${kind}:${matKey}`)
      merged.computeBoundingBox()
      merged.computeBoundingSphere()
      parts.push({
        name: `${kind}_${CHARACTER_MATERIAL_SPECS[matKey].name}`,
        geometry: merged,
        material: createStandardMaterial(matKey),
        matrix: new THREE.Matrix4(),
      })
    }
    return parts
  }

  // Lite mode: merge all parts into one vertex-colored Lambert mesh with emissive channel
  const bakedGeoms: THREE.BufferGeometry[] = []
  for (const [matKey, geoms] of buckets.entries()) {
    const spec = CHARACTER_MATERIAL_SPECS[matKey]
    const emissive = spec.emissive ?? [0, 0, 0]
    for (const geom of geoms) {
      const count = geom.getAttribute('position').count
      const colors = new Float32Array(count * 3)
      const emissions = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        colors[i3] = spec.color[0]
        colors[i3 + 1] = spec.color[1]
        colors[i3 + 2] = spec.color[2]
        emissions[i3] = emissive[0]
        emissions[i3 + 1] = emissive[1]
        emissions[i3 + 2] = emissive[2]
      }
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      geom.setAttribute('emissionColor', new THREE.BufferAttribute(emissions, 3))
      bakedGeoms.push(geom)
    }
  }

  const merged = mergeGeometries(bakedGeoms, false)
  bakedGeoms.forEach(g => g.dispose())
  if (!merged) throw new Error(`Failed to build lite character batch for ${kind}`)
  merged.computeBoundingBox()
  merged.computeBoundingSphere()

  const material = new THREE.MeshLambertMaterial({
    name: `ELYRIA_${kind}_lite`,
    color: 'white',
    vertexColors: true,
    side: THREE.DoubleSide,
  })
  const night = { value: 0.12 }
  material.userData.elyriaNight = night
  material.onBeforeCompile = shader => {
    shader.uniforms.uNightGain = night
    shader.vertexShader = `attribute vec3 emissionColor; varying vec3 vEmission;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvEmission=emissionColor;',
    )
    shader.fragmentShader = `uniform float uNightGain; varying vec3 vEmission;\n${shader.fragmentShader}`.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vEmission*uNightGain;',
    )
  }
  material.customProgramCacheKey = () => 'elyria-colour-batch-v1'

  return [
    {
      name: `${kind}_lite`,
      geometry: merged,
      material,
      matrix: new THREE.Matrix4(),
    },
  ]
}

export function disposeCharacterParts(parts: readonly CharacterMeshPart[]): void {
  for (const part of parts) {
    part.geometry.dispose()
    part.material.dispose()
  }
}
