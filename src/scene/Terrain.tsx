import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Asset, InstancedAsset, type WindField } from './Assets'
import { BlendKitBuilding } from './BlendKitAssets'
import { CityTreeGrove } from './CityTreeGrove'
import type { EnvironmentLightingSnapshot } from './lighting'
import { WORLD } from '../core/world'

type BoxPlacement = { position: [number, number, number]; size: [number, number, number]; color: string }

function BoxBatch({ placements }: { placements: BoxPlacement[] }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    placements.forEach((p, i) => {
      dummy.position.fromArray(p.position)
      dummy.scale.fromArray(p.size)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
      color.set(p.color)
      ref.current.setColorAt(i, color)
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

    // Outer grass meadow below canal bed elevation (top at y = -0.40)
    box([0, -0.60, 0], [320, 0.40, 320], '#a9c6ad')

    // City stone base split cleanly around the Sunpetal Canal trench (z in [-31.0, -23.0])
    // South Bank: z from -23.0 to +57.0 (top at y = 0.00)
    box([0, -0.20, 17], [114, 0.40, 80], '#e5dfcf')
    // North Bank: z from -57.0 to -31.0 (top at y = 0.00)
    box([0, -0.20, -44], [114, 0.40, 26], '#e5dfcf')

    // Central Plaza & North Terrace stone paving — strictly outside the canal (top at y = 0.020)
    // South Central Plaza: z from -22.6 to +16.4 (stops cleanly before Cross-Avenue curb)
    box([0, 0.005, -3.1], [64, 0.030, 39.0], '#f0e9d9')
    // South Avenue Corridor Plaza: z from +24.6 to +31.5 (between Cross-Avenue and South Boulevard)
    box([0, 0.005, 28.05], [64, 0.030, 6.9], '#f0e9d9')
    // North Waterfront Terrace: z from -52.0 to -40.5 (north of North Boulevard)
    box([0, 0.005, -46.25], [64, 0.030, 11.5], '#f0e9d9')

    // Plaza architectural stone inlay lines (strictly on South Central Plaza, never crossing canal or roads)
    for (const x of [-24, -12, 0, 12, 24]) box([x, 0.024, -3.1], [0.05, 0.008, 38.4], '#c9c8b5')
    for (const z of [-16, -4, 8]) box([0, 0.024, z], [62, 0.008, 0.05], '#c9c8b5')
    box([0, 0.024, 28.05], [62, 0.008, 0.05], '#c9c8b5')
    box([0, 0.024, -46.25], [62, 0.008, 0.05], '#c9c8b5')

    // =========================================================================
    // 2-LANE BIDIRECTIONAL ROAD NETWORK (top flush at y = 0.036, zero overlap with canal)
    // =========================================================================
    const roadColor = '#7d8d86'
    const curbColor = '#e9e4d0'
    const centerLineColor = '#f2c97d'
    const laneDashColor = '#f7f4e6'

    // 1. South 2-Lane Boulevard (z = 36, x from -42.2 to 42.2)
    box([0, 0.018, 36], [84.4, 0.036, 8.4], roadColor)
    box([0, 0.055, 31.65], [67.2, 0.08, 0.35], curbColor)
    box([0, 0.055, 40.35], [84.8, 0.08, 0.35], curbColor)
    box([0, 0.044, 35.86], [67, 0.008, 0.09], centerLineColor)
    box([0, 0.044, 36.14], [67, 0.008, 0.09], centerLineColor)

    // 2. North 2-Lane Boulevard (z = -36, x from -42.2 to 42.2)
    box([0, 0.018, -36], [84.4, 0.036, 8.4], roadColor)
    box([0, 0.055, -40.35], [84.8, 0.08, 0.35], curbColor)
    box([0, 0.055, -31.65], [67.2, 0.08, 0.35], curbColor)
    box([0, 0.044, -36.14], [67, 0.008, 0.09], centerLineColor)
    box([0, 0.044, -35.86], [67, 0.008, 0.09], centerLineColor)

    // 3 & 4. West & East 2-Lane Boulevards — split around the canal (z in [-31.6, -22.4])
    // South span: z from -22.4 to +31.8 (meets South Boulevard at z=31.8 and canal bridge at z=-22.4)
    // Outer curbs run cleanly on both sides of the canal; inner curbs break for Cross-Avenue (z in [16.5, 24.5])
    for (const side of [-1, 1] as const) {
      const bx = side * 38
      const outerCurbX = side * 42.35
      const innerCurbX = side * 33.65

      // South asphalt span (z from -22.4 to +31.8 -> center 4.7, length 54.2)
      box([bx, 0.018, 4.7], [8.4, 0.036, 54.2], roadColor)
      // Outer curb south of canal (z from -22.4 to +40.5 -> center 9.05, length 62.9)
      box([outerCurbX, 0.055, 9.05], [0.35, 0.08, 62.9], curbColor)
      // Outer curb north of canal (z from -40.5 to -31.6 -> center -36.05, length 8.9)
      box([outerCurbX, 0.055, -36.05], [0.35, 0.08, 8.9], curbColor)

      // Inner curbs broken cleanly at Cross-Avenue (z in [16.55, 24.45]) and South Boulevard (z >= 31.65)
      // Segment A: z from -22.4 to +16.55 -> center -2.925, length 38.95
      box([innerCurbX, 0.055, -2.925], [0.35, 0.08, 38.95], curbColor)
      // Segment B: z from +24.45 to +31.65 -> center 28.05, length 7.2
      box([innerCurbX, 0.055, 28.05], [0.35, 0.08, 7.2], curbColor)

      // Center double-yellow divider (broken at Cross-Avenue intersection z in [16.5, 24.5])
      // North of Cross-Avenue: z from -22.2 to +16.4 -> center -2.9, length 38.6
      box([bx - 0.14, 0.044, -2.9], [0.09, 0.008, 38.6], centerLineColor)
      box([bx + 0.14, 0.044, -2.9], [0.09, 0.008, 38.6], centerLineColor)
      // South of Cross-Avenue: z from +24.6 to +31.6 -> center 28.1, length 7.0
      box([bx - 0.14, 0.044, 28.1], [0.09, 0.008, 7.0], centerLineColor)
      box([bx + 0.14, 0.044, 28.1], [0.09, 0.008, 7.0], centerLineColor)
    }

    // 5. Central Cross-Avenue (2-Lane East-West road at z = 20.5, x from -33.8 to +33.8)
    box([0, 0.018, 20.5], [67.6, 0.036, 7.6], roadColor)
    box([0, 0.055, 16.55], [67.2, 0.08, 0.32], curbColor)
    box([0, 0.055, 24.45], [67.2, 0.08, 0.32], curbColor)
    box([0, 0.044, 20.37], [65, 0.008, 0.08], centerLineColor)
    box([0, 0.044, 20.63], [65, 0.008, 0.08], centerLineColor)

    // Dashed lane center markers — skipping intersections and canal bridges
    for (let i = -30; i <= 30; i += 4.5) {
      for (const z of [34.05, 37.95, -34.05, -37.95, 18.85, 22.15]) {
        box([i, 0.044, z], [1.6, 0.008, 0.09], laneDashColor)
      }
    }
    for (let z = -20; z <= 30; z += 4.5) {
      // Skip Cross-Avenue intersection zone
      if (z > 15.5 && z < 25.5) continue
      for (const x of [-39.95, -36.05, 36.05, 39.95]) {
        box([x, 0.044, z], [0.09, 0.008, 1.6], laneDashColor)
      }
    }

    // Pedestrian Zebra Crosswalks across the 2-lane roads
    for (const zCross of [20.5, 36, -36]) {
      for (const xCenter of [-15, 0, 15]) {
        for (let s = -3; s <= 3; s++) {
          box([xCenter, 0.046, zCross + s * 0.95], [3.6, 0.008, 0.45], '#f9f3e1')
        }
      }
    }

    // =========================================================================
    // RECESSED SUNPETAL CANAL & THREE BRIDGES (Zero overlap with water or roads)
    // Canal trench: z in [-31.0, -23.0], bed top y = -0.32, water y = -0.14
    // =========================================================================
    // Canal bed floor (deep below water surface at y = -0.14)
    box([0, -0.36, -27], [114, 0.08, 8.2], '#4b8f8c')

    // Continuous recessed stone quay retaining walls below deck level (y from -0.32 to 0.00)
    for (const z of [-31.18, -22.82]) {
      box([0, -0.16, z], [114, 0.32, 0.36], '#c6c2ae')
    }

    // Raised stone embankment coping curbs (y from 0.00 to 0.12) — broken cleanly at all 3 bridges!
    for (const span of WORLD.canalWaterSegments) {
      for (const z of [-31.18, -22.82]) {
        box([span.x, 0.06, z], [span.width, 0.12, 0.38], '#d7d4be')
      }
    }

    // Central Sunpetal Pedestrian Bridge (x = 0, z = -27, deck flush at y_top = 0.036)
    box([0, -0.012, -27], [8.0, 0.096, 8.6], '#e7c8a4')
    // Bridge side masonry arches / abutment skirts down into the canal bed
    for (const ax of [-3.9, 3.9]) {
      box([ax, -0.19, -30.8], [0.45, 0.30, 0.65], '#c9c2ad')
      box([ax, -0.19, -23.2], [0.45, 0.30, 0.65], '#c9c2ad')
    }
    for (const x of [-3.8, 3.8]) {
      box([x, 0.9, -27], [0.12, 0.12, 8.2], '#f6eed7')
      for (const z of [-30.5, -28.2, -25.8, -23.5]) box([x, 0.5, z], [0.12, 1, 0.12], '#f6eed7')
    }

    // West & East 2-Lane Vehicular Canal Bridges (x = ±38, z = -27, roadbed flush at y_top = 0.036)
    for (const bx of [-38, 38]) {
      // Structural bridge stone deck slab beneath the asphalt (y from -0.08 to 0.00)
      box([bx, -0.04, -27], [9.2, 0.08, 9.2], '#c9c4b0')
      // Bridge piers reaching down to the canal bed
      for (const px of [-4.1, 0, 4.1]) {
        for (const pz of [-30.7, -23.3]) {
          box([bx + px, -0.20, pz], [0.55, 0.28, 0.65], '#b9b49f')
        }
      }
      // Asphalt roadbed flush with boulevard road surface (y_top = 0.036, spans z = -31.8 to -22.4)
      box([bx, 0.018, -27.1], [8.4, 0.036, 9.4], roadColor)
      // Bridge curbs & double yellow centerlines flush with boulevard markings
      box([bx - 0.14, 0.044, -27.1], [0.09, 0.008, 9.2], centerLineColor)
      box([bx + 0.14, 0.044, -27.1], [0.09, 0.008, 9.2], centerLineColor)
      for (const railSide of [-4.4, 4.4]) {
        box([bx + railSide, 0.055, -27], [0.36, 0.08, 9.2], curbColor)
        box([bx + railSide, 0.85, -27], [0.18, 0.16, 8.8], '#f3ebd4')
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
  lightingState,
  bistroInteriorRef,
}: {
  vegetationDensity: number;
  lowDetail: boolean;
  wind: WindField;
  lightingState: EnvironmentLightingSnapshot;
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

      {/* Central Blossom Plaza Fountain is rendered by the dedicated simulated PlazaFountain component */}

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

      {/* Unique Procedural Sakura & Botanical Green Trees replacing all old city trees */}
      <CityTreeGrove trees={trees} wind={wind} lightingState={lightingState} lowDetail={lowDetail} />
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
