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
  const object = useMemo(() => {
    if (lite) return null
    const copy = clone(gltf.scene)
    copy.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return copy
  }, [gltf, lite])
  if (lite) {
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

function CitizenPart({ geometry, material, matrix, simulation, count }: {
  geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; matrix: THREE.Matrix4; simulation: SimulationState; count: number
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const instance = useMemo(() => new THREE.Matrix4(), [])
  useFrame(() => {
    for (let i = 0; i < count; i++) {
      const npc = simulation.npcs[i]
      dummy.position.set(npc.x, Math.sin(simulation.elapsed * 5 + i) * 0.02, npc.z)
      dummy.rotation.y = npc.yaw
      dummy.scale.setScalar(0.88 + (i % 3) * 0.06)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, instance.copy(dummy.matrix).multiply(matrix))
    }
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  })
  return <instancedMesh key={count} ref={ref} args={[geometry, material, count]} castShadow receiveShadow />
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
