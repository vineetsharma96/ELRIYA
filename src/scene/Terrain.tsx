import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Asset, DetailedTreeCanopy, InstancedAsset, type WindField } from './Assets'
import { BlendKitBuilding } from './BlendKitAssets'
import { WORLD } from '../core/world'

type BoxPlacement = { position: [number, number, number]; size: [number, number, number]; color: string }

function BoxBatch({ placements }: { placements: BoxPlacement[] }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    placements.forEach((p, i) => {
      dummy.position.fromArray(p.position)
      dummy.scale.fromArray(p.size)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
      ref.current.setColorAt(i, new THREE.Color(p.color))
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [placements])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, placements.length]} receiveShadow>
      <boxGeometry />
      <meshLambertMaterial color="white" />
    </instancedMesh>
  )
}

function StaticPaving() {
  const batches = useMemo(() => {
    const groups: BoxPlacement[] = []
    const box = (position: BoxPlacement['position'], size: BoxPlacement['size'], color: string) => {
      groups.push({ position, size, color })
    }

    // Outer grass meadow & expanded city stone base
    box([0, -0.52, 0], [320, 0.8, 320], '#a9c6ad')
    box([0, -0.13, 0], [114, 0.25, 114], '#e5dfcf')

    // Central plaza & North/South promenade stone paving
    box([0, 0.013, -2], [64, 0.035, 84], '#f0e9d9')
    for (const x of [-24, -12, 0, 12, 24]) box([x, 0.035, -2], [0.05, 0.015, 82], '#c9c8b5')
    for (const z of [-44, -16, -4, 8, 28]) box([0, 0.035, z], [62, 0.015, 0.05], '#c9c8b5')

    // =========================================================================
    // 2-LANE BIDIRECTIONAL ROAD NETWORK (8.4m wide = two 4.2m lanes + curbs)
    // =========================================================================
    const roadColor = '#7d8d86'
    const curbColor = '#e9e4d0'
    const centerLineColor = '#f2c97d'
    const laneDashColor = '#f7f4e6'

    // 1. South 2-Lane Boulevard (z = 36, x from -42.2 to 42.2)
    box([0, 0.025, 36], [84.4, 0.045, 8.4], roadColor)
    box([0, 0.06, 31.65], [84.8, 0.09, 0.35], curbColor)
    box([0, 0.06, 40.35], [84.8, 0.09, 0.35], curbColor)
    // Double center yellow divider line
    box([0, 0.052, 35.86], [74, 0.016, 0.09], centerLineColor)
    box([0, 0.052, 36.14], [74, 0.016, 0.09], centerLineColor)

    // 2. North 2-Lane Boulevard (z = -36, x from -42.2 to 42.2)
    box([0, 0.025, -36], [84.4, 0.045, 8.4], roadColor)
    box([0, 0.06, -40.35], [84.8, 0.09, 0.35], curbColor)
    box([0, 0.06, -31.65], [84.8, 0.09, 0.35], curbColor)
    box([0, 0.052, -36.14], [74, 0.016, 0.09], centerLineColor)
    box([0, 0.052, -35.86], [74, 0.016, 0.09], centerLineColor)

    // 3. West 2-Lane Boulevard (x = -38, z from -40.2 to 40.2)
    box([-38, 0.026, 0], [8.4, 0.046, 80.4], roadColor)
    box([-42.35, 0.06, 0], [0.35, 0.09, 80.8], curbColor)
    box([-33.65, 0.06, 0], [0.35, 0.09, 68], curbColor)
    box([-38.14, 0.053, 0], [0.09, 0.016, 70], centerLineColor)
    box([-37.86, 0.053, 0], [0.09, 0.016, 70], centerLineColor)

    // 4. East 2-Lane Boulevard (x = 38, z from -40.2 to 40.2)
    box([38, 0.026, 0], [8.4, 0.046, 80.4], roadColor)
    box([42.35, 0.06, 0], [0.35, 0.09, 80.8], curbColor)
    box([33.65, 0.06, 0], [0.35, 0.09, 68], curbColor)
    box([37.86, 0.053, 0], [0.09, 0.016, 70], centerLineColor)
    box([38.14, 0.053, 0], [0.09, 0.016, 70], centerLineColor)

    // 5. Central Cross-Avenue (2-Lane East-West road at z = 20.5, x from -34 to 34)
    box([0, 0.025, 20.5], [68, 0.045, 7.6], roadColor)
    box([0, 0.06, 16.55], [67.2, 0.085, 0.32], curbColor)
    box([0, 0.06, 24.45], [67.2, 0.085, 0.32], curbColor)
    box([0, 0.052, 20.37], [65, 0.016, 0.08], centerLineColor)
    box([0, 0.052, 20.63], [65, 0.016, 0.08], centerLineColor)

    // Dashed lane center markers for each of the 2 lanes (Outer & Inner lane guidance)
    for (let i = -32; i <= 32; i += 4.5) {
      for (const z of [34.05, 37.95, -34.05, -37.95, 18.85, 22.15]) {
        box([i, 0.053, z], [1.6, 0.016, 0.09], laneDashColor)
      }
      for (const x of [-39.95, -36.05, 36.05, 39.95]) {
        box([x, 0.054, i], [0.09, 0.016, 1.6], laneDashColor)
      }
    }

    // Pedestrian Zebra Crosswalks across the 2-lane roads
    for (const zCross of [20.5, 36, -36]) {
      for (const xCenter of [-15, 0, 15]) {
        for (let s = -3; s <= 3; s++) {
          box([xCenter, 0.058, zCross + s * 0.95], [3.6, 0.018, 0.45], '#f9f3e1')
        }
      }
    }

    // =========================================================================
    // SUNPETAL CANAL & THREE BRIDGES (1 Central Pedestrian + 2 2-Lane Vehicular)
    // =========================================================================
    box([0, -0.04, -27], [112, 0.07, 8], '#70bcb5')
    for (const z of [-31.1, -22.9]) box([0, 0.06, z], [112, 0.12, 0.35], '#d7d4be')

    // Central Sunpetal Pedestrian Bridge (x = 0, z = -27)
    box([0, 0.06, -27], [8, 0.12, 8.5], '#e7c8a4')
    for (const x of [-3.8, 3.8]) {
      box([x, 0.9, -27], [0.12, 0.12, 8.2], '#f6eed7')
      for (const z of [-30.5, -28.2, -25.8, -23.5]) box([x, 0.5, z], [0.12, 1, 0.12], '#f6eed7')
    }

    // West & East 2-Lane Vehicular Canal Bridges (x = -38 and x = 38, z = -27)
    for (const bx of [-38, 38]) {
      box([bx, 0.05, -27], [9.2, 0.12, 8.8], '#c9c4b0')
      box([bx, 0.09, -27], [8.4, 0.06, 8.8], roadColor)
      box([bx - 0.14, 0.125, -27], [0.09, 0.016, 8.6], centerLineColor)
      box([bx + 0.14, 0.125, -27], [0.09, 0.016, 8.6], centerLineColor)
      for (const railSide of [-4.4, 4.4]) {
        box([bx + railSide, 0.85, -27], [0.18, 0.16, 8.6], '#f3ebd4')
        for (const rz of [-30.6, -27, -23.4]) {
          box([bx + railSide, 0.45, rz], [0.22, 0.85, 0.22], '#d9d1ba')
        }
      }
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
  // High-density trees (up to 112 trees sorted by proximity to spawn)
  const trees = useMemo(
    () =>
      [...WORLD.trees]
        .sort((a, b) => Math.hypot(a.x - WORLD.spawn.x, a.z - WORLD.spawn.z) - Math.hypot(b.x - WORLD.spawn.x, b.z - WORLD.spawn.z))
        .slice(0, Math.ceil(WORLD.trees.length * vegetationDensity)),
    [vegetationDensity]
  )

  // High-density 3D flower patches (up to 160 instanced flower clusters across all 16 beds, 10x previous count)
  const flowers = useMemo(
    () =>
      WORLD.flowers
        .filter((_, i) => i % 3 === 0)
        .slice(0, Math.ceil(165 * vegetationDensity))
        .map((p, idx) => ({ ...p, scale: 0.68 + (idx % 4) * 0.09, rotation: (idx * 1.3) % (Math.PI * 2) })),
    [vegetationDensity]
  )

  // 46 Street Lamps along the 2-lane boulevards, cross-avenue, central plaza, and canal promenades
  const lamps = WORLD.streetLamps

  // 16 Benches across the plazas, gardens, and canal banks
  const benches = useMemo(
    () => [
      { x: -10, z: 14, rotation: Math.PI / 2 },
      { x: 9, z: 14, rotation: -Math.PI / 2 },
      { x: -22, z: 3, rotation: Math.PI / 2 },
      { x: 12, z: -4, rotation: 0 },
      { x: -10, z: -21.8, rotation: Math.PI },
      { x: 10, z: -21.8, rotation: Math.PI },
      { x: -22, z: -21.8, rotation: Math.PI },
      { x: 22, z: -21.8, rotation: Math.PI },
      { x: -10, z: -31.8, rotation: 0 },
      { x: 10, z: -31.8, rotation: 0 },
      { x: -18, z: 25.2, rotation: 0 },
      { x: 18, z: 25.2, rotation: 0 },
      { x: -29, z: 14, rotation: Math.PI / 2 },
      { x: 29, z: 4, rotation: -Math.PI / 2 },
    ],
    []
  )

  // Instanced road tiles along both lanes of the South Boulevard
  const roadTiles = useMemo(
    () => [
      { x: -28, z: 34.05, rotation: 0, scale: 1 },
      { x: -28, z: 37.95, rotation: 0, scale: 1 },
      { x: 28, z: 34.05, rotation: 0, scale: 1 },
      { x: 28, z: 37.95, rotation: 0, scale: 1 },
    ],
    []
  )

  // Group non-bistro GLB buildings for instanced or direct placement
  const glbBuildings = useMemo(
    () => WORLD.buildings.filter(b => b.kind === 'cafe' || b.kind === 'apartment' || b.kind === 'tower'),
    []
  )
  const blendKitBuildings = useMemo(
    () =>
      WORLD.buildings.filter(
        b =>
          b.kind === 'blendkit-townhouse' ||
          b.kind === 'blendkit-arcade' ||
          b.kind === 'blendkit-conservatory' ||
          b.kind === 'blendkit-pavilion'
      ),
    []
  )

  return (
    <group>
      <StaticPaving />

      {/* 16 Lush Circular Planting Beds */}
      {WORLD.flowerBeds.map((bed, idx) => (
        <mesh key={`bed-${idx}`} position={[bed.x, 0.055, bed.z]} rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[bed.radius, 36]} />
          <meshStandardMaterial color={idx % 2 === 0 ? '#9eba8b' : '#94b384'} />
        </mesh>
      ))}

      {/* Central Blossom Plaza Fountain */}
      <group position={[0, 0, -5]}>
        <mesh position-y={0.18} receiveShadow castShadow>
          <cylinderGeometry args={[3, 3.15, 0.36, 48]} />
          <meshStandardMaterial color="#dacfb9" />
        </mesh>
        <mesh position-y={0.4} rotation-x={Math.PI / 2} castShadow>
          <torusGeometry args={[2.72, 0.24, 8, 48]} />
          <meshStandardMaterial color="#f8edd9" />
        </mesh>
        <mesh position-y={0.39} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[2.6, 48]} />
          <meshStandardMaterial color="#8bd4c8" roughness={0.21} metalness={0.15} />
        </mesh>
        <mesh position-y={0.8} castShadow>
          <cylinderGeometry args={[0.35, 0.7, 1.2, 16]} />
          <meshStandardMaterial color="#ecdebe" />
        </mesh>
        <mesh position-y={1.5} castShadow>
          <sphereGeometry args={[0.58, 20, 12]} />
          <meshStandardMaterial color="#9fc9a5" roughness={0.3} />
        </mesh>
      </group>

      {/* Primary Walkable Blossom Bistro (with interior & tea cup quest) */}
      <group position={[-15, 0, -6.5]} rotation-y={Math.PI}>
        <Asset name={lowDetail ? 'bistroExteriorLod1' : 'bistroExteriorLod0'} lite={lowDetail} />
        <group ref={bistroInteriorRef}>
          <Asset name="bistroInterior" lite={lowDetail} />
        </group>
      </group>

      {/* High-Density GLB City Buildings (Cafes, Apartments, Towers across all 5 districts) */}
      {glbBuildings.map(b => {
        const assetName =
          b.kind === 'cafe'
            ? lowDetail
              ? 'cafeLow'
              : 'cafe'
            : b.kind === 'apartment'
              ? lowDetail
                ? 'apartmentLow'
                : 'apartment'
              : lowDetail
                ? 'towerLow'
                : 'tower'
        return (
          <Asset
            key={b.id}
            name={assetName}
            position={[b.x, 0, b.z]}
            rotation={b.rotation}
            scale={b.scale}
            lite={lowDetail}
          />
        )
      })}

      {/* High-Density BlendKit Modular Buildings (Townhouses, Arcades, Conservatories, Pavilions) */}
      {blendKitBuildings.map(b => (
        <BlendKitBuilding key={b.id} building={b} lite={lowDetail} />
      ))}

      {/* Instanced Vegetation & Street Furniture */}
      <InstancedAsset name={lowDetail ? 'treeLow' : 'tree'} placements={trees} wind={wind} lite={lowDetail} />
      <DetailedTreeCanopy placements={trees} wind={wind} lite={lowDetail} />
      <InstancedAsset name={lowDetail ? 'flowersLow' : 'flowers'} placements={flowers} lite={lowDetail} />
      <InstancedAsset name="lamp" placements={lamps} lite={lowDetail} />
      <InstancedAsset name="bench" placements={benches} lite={lowDetail} />
      <InstancedAsset name="road" placements={roadTiles} lite={lowDetail} />
      <Skyline />
    </group>
  )
}

function Skyline() {
  // Dense perimeter skyline ring surrounding the expanded city
  return (
    <group>
      <InstancedAsset
        name="towerLow"
        lite
        placements={[
          { x: -58, z: -59, scale: 1.65 },
          { x: -24, z: -64, scale: 1.35 },
          { x: 10, z: -63, scale: 1.85 },
          { x: 46, z: -62, scale: 1.45 },
          { x: -64, z: -22, scale: 1.5 },
          { x: 64, z: -22, scale: 1.55 },
          { x: -64, z: 24, scale: 1.4 },
          { x: 64, z: 26, scale: 1.6 },
        ]}
      />
      <InstancedAsset
        name="apartmentLow"
        lite
        placements={[
          { x: -42, z: -58, scale: 1.25 },
          { x: -8, z: -60, scale: 1.3 },
          { x: 28, z: -59, scale: 1.3 },
          { x: -62, z: 0, scale: 1.2 },
          { x: 62, z: 2, scale: 1.25 },
          { x: -38, z: 58, scale: 1.25 },
          { x: 0, z: 60, scale: 1.3 },
          { x: 38, z: 58, scale: 1.25 },
        ]}
      />
      <mesh position={[-96, -11, -95]} scale={[78, 36, 52]}>
        <sphereGeometry args={[1, 24, 12]} />
        <meshStandardMaterial color="#a2bcac" />
      </mesh>
      <mesh position={[84, -9, -108]} scale={[68, 36, 48]}>
        <sphereGeometry args={[1, 24, 12]} />
        <meshStandardMaterial color="#aac7b7" />
      </mesh>
    </group>
  )
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
