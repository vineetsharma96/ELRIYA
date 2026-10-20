import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { BuildingPlacement, SimulationState, VehicleState } from '../core/types'
import { Asset } from './Assets'

const VEHICLE_PALETTES = [
  { body: '#89c4b8', cabin: '#fcf7e6', accent: '#3d6b66' }, // Mint EV
  { body: '#e5a198', cabin: '#fffdf5', accent: '#7c4b47' }, // Blossom Rose Coupe
  { body: '#f0c97d', cabin: '#fffcf0', accent: '#5a6e58' }, // Sunpetal Taxi
  { body: '#b3a3cb', cabin: '#faf7ff', accent: '#584c6e' }, // Lilac City Sedan
  { body: '#98b892', cabin: '#fcf9ec', accent: '#486044' }, // Sage Delivery Van
]

const BUILDING_PALETTES = [
  { wall: '#f8eed6', trim: '#6d8a74', roof: '#c87365', awning: '#e28f97' },
  { wall: '#f2e4d8', trim: '#53736a', roof: '#6f9486', awning: '#dfab78' },
  { wall: '#e8efe2', trim: '#786782', roof: '#b56e78', awning: '#87b8a8' },
]

/**
 * Multi-part BlendKit Car Mesh (8–12 distinct silhouette parts:
 * lower hull, upper cabin, front/rear glass, 4 wheels + hubs, headlights, taillights, roof detail)
 */
function BlendKitVehicleModel({
  kind,
  colorIndex,
  lite,
}: {
  kind: VehicleState['kind'];
  colorIndex: number;
  lite?: boolean;
}) {
  const palette = VEHICLE_PALETTES[colorIndex % VEHICLE_PALETTES.length]
  const isVan = kind === 'van'
  const isCoupe = kind === 'coupe'
  const isTaxi = kind === 'taxi'

  const length = isVan ? 3.5 : isCoupe ? 2.85 : 3.15
  const cabinLength = isVan ? 2.55 : isCoupe ? 1.55 : 1.85
  const cabinHeight = isVan ? 0.92 : isCoupe ? 0.62 : 0.72
  const cabinZOffset = isVan ? 0.15 : isCoupe ? -0.1 : -0.05

  return (
    <group>
      {/* 1. Primary chassis hull */}
      <mesh position={[0, 0.46, 0]} castShadow={!lite} receiveShadow={!lite}>
        <boxGeometry args={[1.68, 0.52, length]} />
        <meshStandardMaterial color={palette.body} roughness={0.45} metalness={0.12} />
      </mesh>
      {/* 2. Bumpers / lower trim */}
      <mesh position={[0, 0.24, 0]} castShadow={!lite}>
        <boxGeometry args={[1.74, 0.16, length + 0.12]} />
        <meshStandardMaterial color={palette.accent} roughness={0.68} />
      </mesh>
      {/* 3. Upper passenger cabin */}
      <mesh position={[0, 0.72 + cabinHeight * 0.45, cabinZOffset]} castShadow={!lite} receiveShadow={!lite}>
        <boxGeometry args={[1.48, cabinHeight, cabinLength]} />
        <meshStandardMaterial color={palette.cabin} roughness={0.35} />
      </mesh>
      {/* 4. Windshield & rear glass band */}
      <mesh position={[0, 0.72 + cabinHeight * 0.44, cabinZOffset]}>
        <boxGeometry args={[1.51, cabinHeight * 0.64, cabinLength * 0.88]} />
        <meshStandardMaterial color="#4d7c82" roughness={0.2} metalness={0.25} />
      </mesh>
      {/* 5. Four wheels with cream hubcaps */}
      {([-0.82, 0.82] as const).map(wx =>
        ([-length * 0.31, length * 0.31] as const).map((wz, idx) => (
          <group key={`${wx}-${idx}`} position={[wx, 0.28, wz]}>
            <mesh rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.28, 0.28, 0.2, 14]} />
              <meshStandardMaterial color="#203233" roughness={0.8} />
            </mesh>
            <mesh position={[wx > 0 ? 0.11 : -0.11, 0, 0]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.15, 0.15, 0.04, 10]} />
              <meshStandardMaterial color="#f7f0dc" roughness={0.4} />
            </mesh>
          </group>
        ))
      )}
      {/* 6. Warm glowing headlights (+Z is forward for followLoop yaw=Math.atan2(dx, dz)) */}
      {([-0.54, 0.54] as const).map(hx => (
        <mesh key={`hl-${hx}`} position={[hx, 0.5, length / 2 + 0.02]}>
          <sphereGeometry args={[0.12, 10, 8]} />
          <meshStandardMaterial color="#ffe599" emissive="#ffbe55" emissiveIntensity={0.9} roughness={0.3} />
        </mesh>
      ))}
      {/* 7. Glowing taillights (-Z is rear) */}
      {([-0.56, 0.56] as const).map(tx => (
        <mesh key={`tl-${tx}`} position={[tx, 0.5, -length / 2 - 0.02]}>
          <boxGeometry args={[0.24, 0.11, 0.05]} />
          <meshStandardMaterial color="#f26b7a" emissive="#e84a5f" emissiveIntensity={0.65} roughness={0.4} />
        </mesh>
      ))}
      {/* 8. Roof feature (Taxi lantern or Van solar cargo rack) */}
      {isTaxi && (
        <mesh position={[0, 0.75 + cabinHeight, cabinZOffset]}>
          <boxGeometry args={[0.52, 0.18, 0.24]} />
          <meshStandardMaterial color="#ffe28a" emissive="#ffb838" emissiveIntensity={0.85} />
        </mesh>
      )}
      {isVan && (
        <mesh position={[0, 0.76 + cabinHeight, 0.1]}>
          <boxGeometry args={[1.22, 0.08, 1.8]} />
          <meshStandardMaterial color={palette.accent} roughness={0.5} />
        </mesh>
      )}
    </group>
  )
}

/**
 * Renders the 20 moving vehicles across the 2-lane bidirectional road network
 * plus roadside parked vehicles.
 */
export function TrafficFleet({ simulation, lite = false }: { simulation: SimulationState; lite?: boolean }) {
  const groupRefs = useRef<(THREE.Group | null)[]>([])

  // Parked vehicles in dedicated bays along the boulevards
  const parkedSpecs = useMemo(
    () => [
      { id: 'parked-1', x: -20, z: 16.2, yaw: Math.PI / 2, kind: 'coupe' as const, colorIndex: 1 },
      { id: 'parked-2', x: 20, z: 16.2, yaw: -Math.PI / 2, kind: 'sedan' as const, colorIndex: 3 },
      { id: 'parked-3', x: -32.8, z: -12, yaw: 0, kind: 'van' as const, colorIndex: 4 },
      { id: 'parked-4', x: 32.8, z: -8, yaw: Math.PI, kind: 'taxi' as const, colorIndex: 2 },
    ],
    []
  )

  useFrame(() => {
    const vehicles = simulation.vehicles
    if (!vehicles) return
    for (let i = 0; i < vehicles.length; i++) {
      const node = groupRefs.current[i]
      const v = vehicles[i]
      if (node && v) {
        node.position.set(v.x, 0, v.z)
        // Asset 'shuttle' faces -Z in its GLB local coordinates, while procedural cars face +Z
        node.rotation.y = v.kind === 'shuttle' ? v.yaw + Math.PI : v.yaw
      }
    }
  })

  return (
    <group>
      {simulation.vehicles.map((v, i) => (
        <group
          key={v.id}
          ref={el => {
            groupRefs.current[i] = el
          }}
          position={[v.x, 0, v.z]}
          rotation-y={v.kind === 'shuttle' ? v.yaw + Math.PI : v.yaw}
        >
          {v.kind === 'shuttle' ? (
            <Asset name="shuttle" lite={lite} />
          ) : (
            <BlendKitVehicleModel kind={v.kind} colorIndex={v.colorIndex} lite={lite} />
          )}
        </group>
      ))}
      {parkedSpecs.map(p => (
        <group key={p.id} position={[p.x, 0, p.z]} rotation-y={p.yaw}>
          <BlendKitVehicleModel kind={p.kind} colorIndex={p.colorIndex} lite={lite} />
        </group>
      ))}
    </group>
  )
}

/**
 * BlendKit Modular Architectural Kit Buildings
 */
export function BlendKitBuilding({
  building,
  lite = false,
}: {
  building: BuildingPlacement;
  lite?: boolean;
}) {
  const pal = BUILDING_PALETTES[(building.palette ?? 0) % BUILDING_PALETTES.length]
  const w = building.halfX * 2
  const d = building.halfZ * 2
  const h = building.height

  if (building.kind === 'blendkit-conservatory') {
    return (
      <group position={[building.x, 0, building.z]} rotation-y={building.rotation} scale={building.scale}>
        {/* Stone plinth */}
        <mesh position={[0, 0.22, 0]} castShadow={!lite} receiveShadow={!lite}>
          <boxGeometry args={[w + 0.4, 0.44, d + 0.4]} />
          <meshStandardMaterial color="#e8dec6" roughness={0.75} />
        </mesh>
        {/* Lower sage conservatory wall */}
        <mesh position={[0, 1.1, 0]} castShadow={!lite} receiveShadow={!lite}>
          <boxGeometry args={[w, 1.4, d]} />
          <meshStandardMaterial color="#678977" roughness={0.55} />
        </mesh>
        {/* Glasshouse main volume */}
        <mesh position={[0, 3.2, 0]} castShadow={!lite}>
          <boxGeometry args={[w - 0.25, 3.2, d - 0.25]} />
          <meshStandardMaterial color="#8cc7c2" roughness={0.18} metalness={0.25} transparent opacity={0.82} />
        </mesh>
        {/* Vaulted glass roof */}
        <mesh position={[0, 5.1, 0]} rotation-x={Math.PI / 2} castShadow={!lite}>
          <cylinderGeometry args={[w * 0.44, w * 0.44, d - 0.3, 16, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color="#a6dcd6" roughness={0.2} metalness={0.2} />
        </mesh>
        {/* Architectural steel ribs */}
        {[-0.36, -0.12, 0.12, 0.36].map((frac, idx) => (
          <mesh key={idx} position={[0, 2.8, d * frac]} castShadow={!lite}>
            <boxGeometry args={[w + 0.08, 4.6, 0.18]} />
            <meshStandardMaterial color="#49695c" roughness={0.5} />
          </mesh>
        ))}
        {/* Interior botanical glow & lush tree crowns */}
        {[-0.25, 0, 0.25].map((frac, idx) => (
          <mesh key={`plant-${idx}`} position={[0, 2.4, d * frac]}>
            <sphereGeometry args={[1.15, 12, 10]} />
            <meshStandardMaterial color={idx === 1 ? '#e898a2' : '#73a96c'} roughness={0.65} />
          </mesh>
        ))}
        <mesh position={[0, 4.2, 0]}>
          <sphereGeometry args={[0.35, 10, 8]} />
          <meshStandardMaterial color="#ffcf7c" emissive="#ffaa3b" emissiveIntensity={0.85} />
        </mesh>
      </group>
    )
  }

  if (building.kind === 'blendkit-pavilion') {
    return (
      <group position={[building.x, 0, building.z]} rotation-y={building.rotation} scale={building.scale}>
        {/* Stepped plaza deck */}
        <mesh position={[0, 0.18, 0]} receiveShadow={!lite}>
          <boxGeometry args={[w + 0.5, 0.36, d + 0.5]} />
          <meshStandardMaterial color="#ede3cc" roughness={0.75} />
        </mesh>
        {/* Central kiosk counter */}
        <mesh position={[0, 1.4, 0.2]} castShadow={!lite} receiveShadow={!lite}>
          <boxGeometry args={[w * 0.58, 2.2, d * 0.52]} />
          <meshStandardMaterial color={pal.wall} roughness={0.65} />
        </mesh>
        {/* Glowing kiosk window */}
        <mesh position={[0, 1.65, -d * 0.08]}>
          <boxGeometry args={[w * 0.44, 1.15, 0.12]} />
          <meshStandardMaterial color="#ffd584" emissive="#ffa73b" emissiveIntensity={0.45} roughness={0.3} />
        </mesh>
        {/* 4 Timber Columns */}
        {([-w * 0.42, w * 0.42] as const).map(cx =>
          ([-d * 0.38, d * 0.38] as const).map((cz, i) => (
            <mesh key={`${cx}-${i}`} position={[cx, 2.1, cz]} castShadow={!lite}>
              <cylinderGeometry args={[0.16, 0.19, 3.8, 12]} />
              <meshStandardMaterial color="#87583a" roughness={0.7} />
            </mesh>
          ))
        )}
        {/* Cantilevered double tier roof */}
        <mesh position={[0, 4.1, 0]} castShadow={!lite} receiveShadow={!lite}>
          <boxGeometry args={[w + 0.9, 0.34, d + 0.9]} />
          <meshStandardMaterial color={pal.trim} roughness={0.55} />
        </mesh>
        <mesh position={[0, 4.55, 0]} castShadow={!lite}>
          <boxGeometry args={[w * 0.72, 0.55, d * 0.72]} />
          <meshStandardMaterial color={pal.roof} roughness={0.6} />
        </mesh>
      </group>
    )
  }

  // Default: 'blendkit-townhouse' and 'blendkit-arcade'
  const floors = building.kind === 'blendkit-townhouse' ? 3 : 2
  const bodyH = h - 1.6
  return (
    <group position={[building.x, 0, building.z]} rotation-y={building.rotation} scale={building.scale}>
      {/* Foundation plinth */}
      <mesh position={[0, 0.2, 0]} castShadow={!lite} receiveShadow={!lite}>
        <boxGeometry args={[w + 0.3, 0.4, d + 0.3]} />
        <meshStandardMaterial color="#e6dcc5" roughness={0.8} />
      </mesh>
      {/* Main building volume */}
      <mesh position={[0, 0.4 + bodyH / 2, 0]} castShadow={!lite} receiveShadow={!lite}>
        <boxGeometry args={[w, bodyH, d]} />
        <meshStandardMaterial color={pal.wall} roughness={0.7} />
      </mesh>
      {/* Horizontal cornice bands */}
      {Array.from({ length: floors }, (_, f) => {
        const y = 0.4 + ((f + 1) * bodyH) / floors
        return (
          <mesh key={`band-${f}`} position={[0, y, 0]} castShadow={!lite}>
            <boxGeometry args={[w + 0.24, 0.24, d + 0.24]} />
            <meshStandardMaterial color={pal.trim} roughness={0.6} />
          </mesh>
        )
      })}
      {/* Pitched roof cap */}
      <mesh position={[0, 0.4 + bodyH + 0.75, 0]} castShadow={!lite}>
        <boxGeometry args={[w + 0.45, 1.3, d + 0.45]} />
        <meshStandardMaterial color={pal.roof} roughness={0.65} />
      </mesh>
      {/* Front & Back illuminated windows + flower boxes */}
      {([-1, 1] as const).map(side =>
        ([-w * 0.28, 0, w * 0.28] as const).map((wx, wi) =>
          Array.from({ length: floors }, (_, f) => {
            const wy = 1.45 + f * (bodyH / floors)
            const warm = (wi + f) % 2 === 0
            return (
              <group key={`win-${side}-${wi}-${f}`} position={[wx, wy, side * (d / 2 + 0.04)]}>
                <mesh>
                  <boxGeometry args={[1.05, 1.35, 0.08]} />
                  <meshStandardMaterial
                    color={warm ? '#ffd385' : '#58898e'}
                    emissive={warm ? '#ff9d3b' : '#000000'}
                    emissiveIntensity={warm ? 0.35 : 0}
                    roughness={0.28}
                  />
                </mesh>
                {/* Window flower planter */}
                <mesh position={[0, -0.72, side * 0.14]}>
                  <boxGeometry args={[1.18, 0.22, 0.28]} />
                  <meshStandardMaterial color="#b96554" roughness={0.75} />
                </mesh>
              </group>
            )
          })
        )
      )}
      {/* Storefront awning on ground level */}
      <mesh position={[0, 2.35, -(d / 2 + 0.45)]} rotation-x={0.22} castShadow={!lite}>
        <boxGeometry args={[w * 0.86, 0.18, 0.95]} />
        <meshStandardMaterial color={pal.awning} roughness={0.6} />
      </mesh>
    </group>
  )
}
