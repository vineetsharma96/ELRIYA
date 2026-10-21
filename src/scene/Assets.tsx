import { useFrame, useLoader } from '@react-three/fiber'
import { useEffect, useMemo, useLayoutEffect, useRef } from 'react'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import * as THREE from 'three'
import type { SimulationState } from '../core/types'

export const ASSETS = {
  protagonist: '/assets/characters/protagonist.glb',
  companion: '/assets/characters/companion.glb',
  citizen: '/assets/characters/citizen.glb',
  cafe: '/assets/architecture/cafe.glb',
  apartment: '/assets/architecture/apartment.glb',
  tower: '/assets/architecture/tower.glb',
  tree: '/assets/vegetation/blossom-tree.glb',
  flowers: '/assets/vegetation/flower-patch.glb',
  shuttle: '/assets/vehicles/shuttle.glb',
  lamp: '/assets/street/street-lamp.glb',
  bench: '/assets/street/bench.glb',
  road: '/assets/street/road-tile.glb',
  cafeLow: '/assets/architecture/cafe-lod1.glb',
  apartmentLow: '/assets/architecture/apartment-lod1.glb',
  towerLow: '/assets/architecture/tower-lod1.glb',
  treeLow: '/assets/vegetation/blossom-tree-lod1.glb',
  flowersLow: '/assets/vegetation/flower-patch-lod1.glb',
  bistroExteriorLod0: '/assets/architecture/blossom_bistro_exterior_lod0.glb',
  bistroExteriorLod1: '/assets/architecture/blossom_bistro_exterior_lod1.glb',
  bistroExteriorLod2: '/assets/architecture/blossom_bistro_exterior_lod2.glb',
  bistroInterior: '/assets/interiors/blossom_bistro_interior.glb',
  bistroCup: '/assets/props/blossom_tea_cup.glb',
}

interface AssetPart { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; matrix: THREE.Matrix4 }
const colourBatches = new WeakMap<THREE.Object3D, AssetPart>()
function assetParts(scene: THREE.Object3D): AssetPart[] {
  scene.updateMatrixWorld(true)
  const parts: AssetPart[] = []
  scene.traverse(child => {
    if (child instanceof THREE.Mesh) parts.push({ geometry: child.geometry, material: child.material, matrix: child.matrixWorld.clone() })
  })
  if (!parts.length) throw new Error('Asset contains no mesh')
  return parts
}

/** Batch authored flat-color Blender materials for the inexpensive renderer. */
function colourBatch(scene: THREE.Object3D): AssetPart {
  const cached = colourBatches.get(scene)
  if (cached) return cached
  const geometries = assetParts(scene).map(part => {
    const geometry = (part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone()).applyMatrix4(part.matrix)
    const source = (Array.isArray(part.material) ? part.material[0] : part.material) as THREE.MeshStandardMaterial
    const colour = source.color ?? new THREE.Color('white')
    const emission = source.emissive ?? new THREE.Color('black')
    const count = geometry.getAttribute('position').count
    const colours = new Float32Array(count * 3)
    const emissions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      colour.toArray(colours, i * 3); emission.toArray(emissions, i * 3)
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3))
    geometry.setAttribute('emissionColor', new THREE.BufferAttribute(emissions, 3))
    return geometry
  })
  const geometry = mergeGeometries(geometries, false)
  geometries.forEach(item => item.dispose())
  if (!geometry) throw new Error('Asset material batching failed')
  const material = new THREE.MeshLambertMaterial({ color: 'white', vertexColors: true })
  const night = { value: 0.12 }
  material.userData.elyriaNight = night
  material.onBeforeCompile = shader => {
    shader.uniforms.uNightGain = night
    shader.vertexShader = `attribute vec3 emissionColor; varying vec3 vEmission;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmission=emissionColor;')
    shader.fragmentShader = `uniform float uNightGain; varying vec3 vEmission;\n${shader.fragmentShader}`.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vEmission*uNightGain;')
  }
  material.customProgramCacheKey = () => 'elyria-colour-batch-v1'
  const result = { geometry, material, matrix: new THREE.Matrix4() }
  colourBatches.set(scene, result)
  return result
}

export function Asset({ name, position = [0, 0, 0], rotation = 0, scale = 1, lite = false }: {
  name: keyof typeof ASSETS; position?: [number, number, number]; rotation?: number; scale?: number; lite?: boolean
}) {
  const gltf = useLoader(GLTFLoader, ASSETS[name])
  const isTextured = useMemo(() => {
    let textured = false
    gltf.scene.traverse(child => {
      if (child instanceof THREE.Mesh) {
        const mat = Array.isArray(child.material) ? child.material[0] : child.material
        if (mat && 'map' in mat && mat.map) textured = true
      }
    })
    return textured
  }, [gltf])

  const object = useMemo(() => {
    if (lite && !isTextured) return null
    const copy = clone(gltf.scene)
    copy.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = !lite
        child.receiveShadow = !lite
      }
    })
    return copy
  }, [gltf, lite, isTextured])

  if (lite && !isTextured) {
    const part = colourBatch(gltf.scene)
    return <mesh geometry={part.geometry} material={part.material} position={position} rotation-y={rotation} scale={scale} castShadow receiveShadow dispose={null} />
  }
  return <primitive object={object!} position={position} rotation-y={rotation} scale={scale} />
}

export interface Placement { x: number; z: number; y?: number; scale?: number; rotation?: number }

/** One batch per material, instead of one character draw stack per citizen. */
export function Citizens({ simulation, count, lite = false }: { simulation: SimulationState; count: number; lite?: boolean }) {
  const gltf = useLoader(GLTFLoader, ASSETS.citizen)
  const parts = useMemo(() => {
    return lite ? [colourBatch(gltf.scene)] : assetParts(gltf.scene)
  }, [gltf, lite])
  return <group>{parts.map((part, i) => <CitizenPart key={i} {...part} simulation={simulation} count={count} />)}</group>
}

const CITIZEN_TINTS = [
  new THREE.Color('#ffffff'),
  new THREE.Color('#fce6e8'),
  new THREE.Color('#e6f5ee'),
  new THREE.Color('#fef3dc'),
  new THREE.Color('#eee6fa'),
]

function CitizenPart({ geometry, material, matrix, simulation, count }: {
  geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; matrix: THREE.Matrix4; simulation: SimulationState; count: number
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const instance = useMemo(() => new THREE.Matrix4(), [])
  const safeCount = Math.min(count, simulation.npcs.length)
  useLayoutEffect(() => {
    for (let i = 0; i < safeCount; i++) {
      const npc = simulation.npcs[i]
      ref.current.setColorAt(i, CITIZEN_TINTS[(npc?.palette ?? i) % CITIZEN_TINTS.length])
    }
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [safeCount, simulation])
  useFrame(() => {
    for (let i = 0; i < safeCount; i++) {
      const npc = simulation.npcs[i]
      const walkSpeed = npc.speed ?? 0.9
      const stridePhase = simulation.elapsed * walkSpeed * 6.5 + i * 1.37
      const strideBob = Math.abs(Math.sin(stridePhase)) * 0.036
      dummy.position.set(npc.x, strideBob, npc.z)
      dummy.rotation.set(0, npc.yaw, Math.sin(stridePhase) * 0.025)
      dummy.scale.setScalar(0.86 + (i % 4) * 0.045)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, instance.copy(dummy.matrix).multiply(matrix))
    }
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  })
  return <instancedMesh key={safeCount} ref={ref} args={[geometry, material, safeCount]} castShadow receiveShadow />
}

export interface WindField { value: number; time: number }

export function InstancedAsset({ name, placements, wind, lite = false }: { name: keyof typeof ASSETS; placements: Placement[]; wind?: WindField; lite?: boolean }) {
  const gltf = useLoader(GLTFLoader, ASSETS[name])
  const parts = useMemo(() => {
    return lite ? [colourBatch(gltf.scene)] : assetParts(gltf.scene)
  }, [gltf, lite])
  return <group>{parts.map((part, i) => <InstancedPart key={i} {...part} placements={placements} wind={wind} />)}</group>
}

function InstancedPart({ geometry, material, matrix, placements, wind }: {
  geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; matrix: THREE.Matrix4; placements: Placement[]; wind?: WindField
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const sway = useMemo(() => {
    if (!wind) return null
    const baked = geometry.clone().applyMatrix4(matrix)
    const uniforms = { uWindTime: { value: 0 }, uWindStrength: { value: wind.value } }
    const originals = Array.isArray(material) ? material : [material]
    const materials = originals.map(original => {
      const copy = original.clone()
      copy.userData.elyriaNight = original.userData.elyriaNight
      copy.onBeforeCompile = (shader, renderer) => {
        original.onBeforeCompile(shader, renderer)
        Object.assign(shader.uniforms, uniforms)
        shader.vertexShader = `uniform float uWindTime; uniform float uWindStrength;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
          float bend=pow(clamp(transformed.y/5.,0.,1.),2.);
          transformed.x+=sin(uWindTime*1.1+transformed.y)*bend*uWindStrength*.16;
          transformed.z+=cos(uWindTime*.7+transformed.y*.6)*bend*uWindStrength*.08;`)
      }
      copy.customProgramCacheKey = () => `${original.customProgramCacheKey()}-elyria-tree-wind-v1`
      return copy
    })
    return { geometry: baked, material: Array.isArray(material) ? materials : materials[0], materials, uniforms }
  }, [geometry, material, matrix, wind])
  useEffect(() => () => { sway?.geometry.dispose(); sway?.materials.forEach(item => item.dispose()) }, [sway])
  useFrame(() => {
    if (sway && wind) {
      sway.uniforms.uWindTime.value = wind.time
      sway.uniforms.uWindStrength.value = wind.value * (0.75 + Math.sin(wind.time * 0.3) * 0.25)
    }
  })
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    placements.forEach((p, i) => {
      dummy.position.set(p.x, p.y ?? 0, p.z)
      dummy.rotation.y = p.rotation ?? 0
      dummy.scale.setScalar(p.scale ?? 1)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, sway ? dummy.matrix : dummy.matrix.clone().multiply(matrix))
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [placements, matrix, sway])
  return <instancedMesh ref={ref} args={[sway?.geometry ?? geometry, sway?.material ?? material, placements.length]} castShadow receiveShadow />
}

export interface DetailedTreePartSpec {
  kind: 'root_buttress' | 'branch_limb' | 'blossom_puff' | 'weeping_bough' | 'leaf_sprig' | 'fallen_petal_mound'
  color: string
  position: [number, number, number]
  scale: [number, number, number]
  rotation?: [number, number, number]
}

/**
 * Generates a cute, plush, storybook-style sakura tree (Ghibli / Animal Crossing aesthetic):
 * - Rounded warm honey-caramel root paws & cozy tucked boughs (no spiky twigs)
 * - Scalloped, chubby, marshmallow-soft sakura cloud puffs in warm pastel pinks & cream
 * - Adorable 5-petal surface flowers with buttercup-yellow centers dotting the canopy
 * - Chubby pastel matcha-mint leaf buds & a ring of fallen petals and daisies at the base
 */
export function buildDetailedTreeSpec(): DetailedTreePartSpec[] {
  const parts: DetailedTreePartSpec[] = []

  // 1. Cozy, plump rounded root paws at the base of the warm honeywood trunk
  for (let i = 0; i < 5; i++) {
    const angle = (i * Math.PI * 2) / 5 + 0.3
    const r = 0.24
    parts.push({
      kind: 'root_buttress',
      color: '#b87b52',
      position: [Math.cos(angle) * r, 0.14, Math.sin(angle) * r],
      scale: [0.22, 0.16, 0.28],
      rotation: [0, -angle, 0],
    })
  }

  // 2. Cute ring of fallen pastel sakura petals, tiny cream daisies, and soft clover around the base
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI * 2) / 12 + (i % 2) * 0.15
    const r = 0.48 + (i % 3) * 0.24
    parts.push({
      kind: 'fallen_petal_mound',
      color: i % 4 === 0 ? '#fff3b0' : i % 3 === 0 ? '#9fe088' : i % 2 === 0 ? '#ffd4e2' : '#ffbfd3',
      position: [Math.cos(angle) * r, 0.04, Math.sin(angle) * r],
      scale: [0.19 + (i % 3) * 0.04, 0.06, 0.19 + (i % 2) * 0.04],
      rotation: [0, angle, 0],
    })
  }

  // 3. Cozy, smooth honey-cinnamon trunk collar & tucked-in support boughs (never poking outside the clouds)
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6 + 0.5
    const r = 0.42
    parts.push({
      kind: 'branch_limb',
      color: '#b5784f',
      position: [Math.cos(angle) * r, 2.35 + (i % 2) * 0.15, Math.sin(angle) * r],
      scale: [0.14, 0.55, 0.14],
      rotation: [Math.sin(angle) * 0.42, 0, -Math.cos(angle) * 0.42],
    })
  }

  // 4. Plump, pillowy cotton-candy sakura cloud puffs arranged in a cute scalloped 3-tier dome
  // Bottom chubby scalloped ring (10 big round puffs)
  const bottomColors = ['#ffbed3', '#ffc8da', '#ffb5cc', '#ffcde0']
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI * 2) / 10
    const radius = 1.38 + (i % 2) * 0.12
    const y = 3.05 + (i % 2) * 0.14
    parts.push({
      kind: 'blossom_puff',
      color: bottomColors[i % bottomColors.length],
      position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
      scale: [0.92, 0.82, 0.92],
    })
  }

  // Middle marshmallow cloud ring (10 plump overlapping puffs)
  const midColors = ['#ffd0e0', '#ffdbe7', '#ffc6d9', '#ffe3ed']
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI * 2) / 10 + Math.PI / 10
    const radius = 1.08 + (i % 2) * 0.1
    const y = 3.78 + (i % 2) * 0.12
    parts.push({
      kind: 'blossom_puff',
      color: midColors[i % midColors.length],
      position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
      scale: [0.96, 0.86, 0.96],
    })
  }

  // Upper sunny strawberry-milk crown puffs (7 round top puffs + 1 big central crown puff)
  const topColors = ['#ffe4ee', '#fff0f5', '#ffd9e6']
  for (let i = 0; i < 7; i++) {
    const angle = (i * Math.PI * 2) / 7 + 0.2
    const radius = 0.62
    const y = 4.38 + (i % 2) * 0.08
    parts.push({
      kind: 'blossom_puff',
      color: topColors[i % topColors.length],
      position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
      scale: [0.88, 0.8, 0.88],
    })
  }
  parts.push({
    kind: 'blossom_puff',
    color: '#fff2f7',
    position: [0, 4.72, 0],
    scale: [1.08, 0.92, 1.08],
  })

  // 5. Cute chubby lower cloud-droplets (soft rounded puffs hugging the underside of the crown)
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI * 2) / 10 + 0.31
    const radius = 1.62 + (i % 2) * 0.08
    const y = 2.76 + (i % 2) * 0.12
    parts.push({
      kind: 'weeping_bough',
      color: i % 2 === 0 ? '#ffd8e6' : '#ffc4d7',
      position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
      scale: [0.46, 0.42, 0.46],
    })
  }

  // 6. Adorable decorative surface blossoms (sunny buttercup centers + white/pink petal puffs) & chubby mint leaf buds
  for (let i = 0; i < 14; i++) {
    const angle = i * 2.39996 + 0.4
    const tier = (i % 3) / 3
    const radius = 1.55 - tier * 0.38
    const y = 3.18 + tier * 1.15
    const cx = Math.cos(angle) * radius
    const cz = Math.sin(angle) * radius

    // Cute round buttercup flower center or pastel mint leaf bud
    parts.push({
      kind: 'leaf_sprig',
      color: i % 3 === 0 ? '#ffe47a' : i % 2 === 0 ? '#9be386' : '#b4ef9e',
      position: [cx, y, cz],
      scale: i % 3 === 0 ? [0.16, 0.14, 0.16] : [0.26, 0.19, 0.24],
      rotation: [0, angle, 0],
    })
  }

  // 7. Extra fluffy white-blush mini-clouds on the sunny outer canopy
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8 + 0.39
    const radius = 1.28 + (i % 2) * 0.18
    const y = 3.55 + (i % 3) * 0.32
    parts.push({
      kind: 'blossom_puff',
      color: i % 2 === 0 ? '#fff5f8' : '#ffe8f0',
      position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
      scale: [0.52, 0.46, 0.52],
    })
  }

  return parts
}

function buildDetailedTreeGeometry(lowDetail: boolean): THREE.BufferGeometry {
  const specs = buildDetailedTreeSpec()
  const activeSpecs = lowDetail ? specs.filter((_, idx) => idx % 2 === 0) : specs
  // Use smooth UV spheres so every cloud puff has velvety, pillow-soft radial vertex normals (no flat facets!)
  const unitSphere = new THREE.SphereGeometry(1, lowDetail ? 10 : 16, lowDetail ? 8 : 12)
  const unitCyl = new THREE.CylinderGeometry(0.75, 1.0, 1, 10, 1)
  const dummy = new THREE.Object3D()
  const colour = new THREE.Color()
  const geometries: THREE.BufferGeometry[] = []

  for (const part of activeSpecs) {
    const base = part.kind === 'branch_limb' ? unitCyl : unitSphere
    const geom = base.index ? base.toNonIndexed() : base.clone()
    dummy.position.set(part.position[0], part.position[1], part.position[2])
    dummy.rotation.set(
      part.rotation?.[0] ?? 0,
      part.rotation?.[1] ?? 0,
      part.rotation?.[2] ?? 0
    )
    dummy.scale.set(part.scale[0], part.scale[1], part.scale[2])
    dummy.updateMatrix()
    // applyMatrix4 transforms both positions and smooth normals accurately without flattening faces
    geom.applyMatrix4(dummy.matrix)

    colour.set(part.color)
    const count = geom.getAttribute('position').count
    const colours = new Float32Array(count * 3)
    const emissions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      colour.toArray(colours, i * 3)
      emissions[i * 3] = 0
      emissions[i * 3 + 1] = 0
      emissions[i * 3 + 2] = 0
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colours, 3))
    geom.setAttribute('emissionColor', new THREE.BufferAttribute(emissions, 3))
    geometries.push(geom)
  }

  unitSphere.dispose()
  unitCyl.dispose()
  const merged = mergeGeometries(geometries, false)
  geometries.forEach(g => g.dispose())
  if (!merged) throw new Error('Failed to merge detailed tree geometry')
  return merged
}

export function DetailedTreeCanopy({ placements, wind, lite = false }: {
  placements: Placement[]
  wind: WindField
  lite?: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const { geometry, material, uniforms } = useMemo(() => {
    const geometry = buildDetailedTreeGeometry(lite)
    const uniforms = {
      uWindTime: { value: 0 },
      uWindStrength: { value: wind.value },
    }
    const material = new THREE.MeshLambertMaterial({
      color: 'white',
      vertexColors: true,
    })
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = `uniform float uWindTime; uniform float uWindStrength;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float bend = pow(clamp(transformed.y / 5.0, 0.0, 1.0), 2.0);
        transformed.x += sin(uWindTime * 1.1 + transformed.y) * bend * uWindStrength * 0.16;
        transformed.z += cos(uWindTime * 0.7 + transformed.y * 0.6) * bend * uWindStrength * 0.08;`
      )
    }
    material.customProgramCacheKey = () => `elyria-cute-tree-canopy-${lite ? 'lite' : 'full'}`
    return { geometry, material, uniforms }
  }, [lite, wind.value])

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  useFrame(() => {
    uniforms.uWindTime.value = wind.time
    uniforms.uWindStrength.value = wind.value * (0.75 + Math.sin(wind.time * 0.3) * 0.25)
  })

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    placements.forEach((p, i) => {
      dummy.position.set(p.x, p.y ?? 0, p.z)
      dummy.rotation.y = p.rotation ?? ((i * 1.618) % (Math.PI * 2))
      dummy.scale.setScalar(p.scale ?? 1)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [placements])

  return <instancedMesh ref={ref} args={[geometry, material, placements.length]} castShadow={!lite} receiveShadow={!lite} />
}


