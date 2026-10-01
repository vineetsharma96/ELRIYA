import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Asset, InstancedAsset, type WindField } from './Assets'
import { WORLD } from '../core/world'

type BoxPlacement = { position: [number, number, number]; size: [number, number, number]; color: string }

function BoxBatch({ placements }: { placements: BoxPlacement[] }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    placements.forEach((p, i) => {
      dummy.position.fromArray(p.position); dummy.scale.fromArray(p.size); dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
      ref.current.setColorAt(i, new THREE.Color(p.color))
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [placements])
  return <instancedMesh ref={ref} args={[undefined, undefined, placements.length]} receiveShadow><boxGeometry /><meshLambertMaterial color="white" /></instancedMesh>
}

function StaticPaving() {
  const batches = useMemo(() => {
    const groups: BoxPlacement[] = []
    const box = (position: BoxPlacement['position'], size: BoxPlacement['size'], color: string) => { groups.push({ position, size, color }) }
    box([0, -0.52, 0], [280, 0.8, 280], '#a9c6ad')
    box([0, -0.13, 0], [86, 0.25, 86], '#e5dfcf')
    box([0, 0.013, 4], [53, 0.035, 48], '#f0e9d9')
    for (const x of [-18, -6, 6, 18]) box([x, 0.037, 5], [0.045, 0.015, 46], '#c9c8b5')
    for (const z of [-16, -4, 8, 20]) box([0, 0.037, z], [52, 0.015, 0.045], '#c9c8b5')
    WORLD.shuttleRoute.forEach((start, i) => {
      const end = WORLD.shuttleRoute[(i + 1) % WORLD.shuttleRoute.length]
      box([(start.x + end.x) / 2, 0.022, (start.z + end.z) / 2], [Math.abs(end.x - start.x) + 5, 0.04, Math.abs(end.z - start.z) + 5], '#a7b5ae')
    })
    for (let i = 0; i < 15; i++) box([-32 + i * 4.5, 0.052, 35], [1.5, 0.015, 0.1], '#ecebcf')
    for (const z of [-20, 35]) for (let i = 0; i < 6; i++) box([0, 0.07, z - 2 + i * 0.75], [5.5, 0.02, 0.4], '#f7f0dd')
    box([0, -0.04, -27], [84, 0.07, 8], '#70bcb5')
    for (const z of [-31.1, -22.9]) box([0, 0.06, z], [84, 0.12, 0.35], '#d7d4be')
    box([0, 0.06, -27], [8, 0.12, 8.5], '#e7c8a4')
    for (const x of [-3.8, 3.8]) {
      box([x, 0.9, -27], [0.12, 0.12, 8.2], '#f6eed7')
      for (const z of [-30.5, -28.2, -25.8, -23.5]) box([x, 0.5, z], [0.12, 1, 0.12], '#f6eed7')
    }
    return groups
  }, [])
  return <BoxBatch placements={batches} />
}

export function Terrain({
  vegetationDensity,
  lowDetail,
  wind,
  bistroInteriorRef,
}: {
  vegetationDensity: number;
  lowDetail: boolean;
  wind: WindField;
  bistroInteriorRef?: React.Ref<THREE.Group>;
}) {
  const trees = useMemo(() => [...WORLD.trees].sort((a, b) => Math.hypot(a.x - WORLD.spawn.x, a.z - WORLD.spawn.z) - Math.hypot(b.x - WORLD.spawn.x, b.z - WORLD.spawn.z)).slice(0, Math.ceil(WORLD.trees.length * vegetationDensity)), [vegetationDensity])
  const flowers = useMemo(() => WORLD.flowers.filter((_, i) => i % 10 === 0).slice(0, Math.ceil(15 * vegetationDensity)).map(p => ({ ...p, scale: 0.7 })), [vegetationDensity])
  const lamps = useMemo(() => [-23, -10, 10, 23].flatMap(x => [{ x, z: 25 }, { x, z: -22, rotation: Math.PI }]), [])
  const benches = useMemo(() => [{ x: -10, z: 18, rotation: Math.PI / 2 }, { x: 9, z: 18, rotation: -Math.PI / 2 }, { x: -22, z: 3, rotation: Math.PI / 2 }, { x: 12, z: -4 }], [])
  return <group>
    <StaticPaving />
    {/* Planting beds and a round plaza fountain use low cost primitive surfaces. */}
    {[[-26, 19, 5], [-11, 9, 3.6], [10, 21, 3.8], [29, -5, 4], [-27, -17, 4]].map(([x, z, r]) => <mesh key={`${x}`} position={[x, 0.06, z]} rotation-x={-Math.PI / 2} receiveShadow><circleGeometry args={[r, 40]} /><meshStandardMaterial color="#9eba8b" /></mesh>)}
    <group position={[0, 0, -5]}>
      <mesh position-y={0.18} receiveShadow castShadow><cylinderGeometry args={[3, 3.15, 0.36, 48]} /><meshStandardMaterial color="#dacfb9" /></mesh>
      <mesh position-y={0.4} rotation-x={Math.PI / 2} castShadow><torusGeometry args={[2.72, 0.24, 8, 48]} /><meshStandardMaterial color="#f8edd9" /></mesh>
      <mesh position-y={0.39} rotation-x={-Math.PI / 2}><circleGeometry args={[2.6, 48]} /><meshStandardMaterial color="#8bd4c8" roughness={0.21} metalness={0.15} /></mesh>
      <mesh position-y={0.8} castShadow><cylinderGeometry args={[0.35, 0.7, 1.2, 16]} /><meshStandardMaterial color="#ecdebe" /></mesh>
      <mesh position-y={1.5} castShadow><sphereGeometry args={[0.58, 20, 12]} /><meshStandardMaterial color="#9fc9a5" roughness={0.3} /></mesh>
    </group>
    {WORLD.landmarks.filter(place => ['cafe', 'home', 'tower'].includes(place.kind)).map(place => {
      if (place.kind === 'cafe') {
        return (
          <group key={place.id} position={[-15, 0, -6.5]} rotation-y={Math.PI}>
            <Asset name={lowDetail ? 'bistroExteriorLod1' : 'bistroExteriorLod0'} lite={lowDetail} />
            <group ref={bistroInteriorRef}>
              <Asset name="bistroInterior" lite={lowDetail} />
            </group>
          </group>
        )
      }
      return <Asset key={place.id}
        name={place.kind === 'home' ? lowDetail ? 'apartmentLow' : 'apartment' : lowDetail ? 'towerLow' : 'tower'}
        position={[place.x, 0, place.z]} lite={lowDetail} />
    })}
    <InstancedAsset name={lowDetail ? 'treeLow' : 'tree'} placements={trees} wind={wind} lite={lowDetail} />
    <InstancedAsset name={lowDetail ? 'flowersLow' : 'flowers'} placements={flowers} lite={lowDetail} />
    <InstancedAsset name="lamp" placements={lamps} lite={lowDetail} />
    <InstancedAsset name="bench" placements={benches} lite={lowDetail} />
    <Asset name="road" position={[-29, 0.045, 35]} lite={lowDetail} />
    <Skyline />
  </group>
}

function Skyline() {
  // Reuse the modular tower/apartment kit, without simulating inaccessible scenery.
  return <group>
    <InstancedAsset name="towerLow" lite placements={[{ x: -48, z: -49, scale: 1.6 }, { x: 8, z: -57, scale: 1.85 }, { x: 40, z: -58, scale: 1.4 }, { x: -23, z: -62, scale: 1.2 }]} />
    <InstancedAsset name="apartmentLow" lite placements={[{ x: -33, z: -43, scale: 1.2 }, { x: -8, z: -42, scale: 1.3 }, { x: 25, z: -43, scale: 1.3 }, { x: -49, z: 0, scale: 1.1 }]} />
    <mesh position={[-92, -11, -90]} scale={[75, 35, 50]}><sphereGeometry args={[1, 24, 12]} /><meshStandardMaterial color="#a2bcac" /></mesh>
    <mesh position={[78, -9, -105]} scale={[65, 35, 45]}><sphereGeometry args={[1, 24, 12]} /><meshStandardMaterial color="#aac7b7" /></mesh>
  </group>
}

export function createCanalMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uDay: { value: 1 } },
    vertexShader: `varying vec3 vWorld; void main(){ vec4 world = modelMatrix * vec4(position,1.); vWorld=world.xyz; gl_Position=projectionMatrix*viewMatrix*world; }`,
    fragmentShader: `varying vec3 vWorld; uniform float uTime; uniform float uDay;
      void main(){ float wave=sin(vWorld.x*2.+vWorld.z*5.+uTime*1.4)*sin(vWorld.x*.7-vWorld.z*3.+uTime*.8);
      float glint=smoothstep(.78,.99,wave); vec3 base=mix(vec3(.12,.35,.39),vec3(.39,.73,.70),uDay);
      gl_FragColor=vec4(base+glint*.13,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment> }`,
    side: THREE.DoubleSide,
  })
}
