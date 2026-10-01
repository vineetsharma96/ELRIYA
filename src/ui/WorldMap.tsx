import { WORLD } from '../core/world'
import type { WorldSnapshot } from '../scene/types'

export default function WorldMap({ snapshot, expanded = false }: { snapshot: WorldSnapshot; expanded?: boolean }) {
  const { bounds, landmarks, colliders, trees, flowers } = WORLD
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxZ - bounds.minZ
  return <svg className="world-map" viewBox={`${bounds.minX - 3} ${bounds.minZ - 3} ${width + 6} ${height + 6}`} role="img" aria-label="Map showing your position, buildings, water, trees, and places in Blossom Central">
    <rect x={bounds.minX - 3} y={bounds.minZ - 3} width={width + 6} height={height + 6} fill="#edf0d8" />
    <rect x={bounds.minX} y={bounds.minZ} width={width} height={height} rx="5" fill="#e4e9ce" stroke="#d3dcc2" strokeWidth="0.5" />
    {WORLD.shuttleRoute.map((start, i) => {
      const end = WORLD.shuttleRoute[(i + 1) % WORLD.shuttleRoute.length]
      return <line key={i} x1={start.x} y1={start.z} x2={end.x} y2={end.z} stroke="#c3cfbd" strokeWidth="5" strokeLinecap="square" />
    })}
    {colliders.map((collider, index) => <rect key={index} x={collider.x - collider.halfX} y={collider.z - collider.halfZ} width={collider.halfX * 2} height={collider.halfZ * 2} rx={collider.halfX > 10 ? 0 : 1.5} fill={collider.halfX > 10 ? '#9dcfc8' : index === 0 ? '#dfbcb0' : index === 1 ? '#d6c8bb' : '#b5cfcb'} stroke={collider.halfX > 10 ? 'none' : '#f9f5e8'} strokeWidth="1" />)}
    {flowers.map((flower, index) => <circle key={index} cx={flower.x} cy={flower.z} r="0.35" fill={index % 3 === 0 ? '#d998a1' : '#d7c79c'} opacity="0.6" />)}
    {trees.map((tree, index) => <circle key={index} cx={tree.x} cy={tree.z} r={1.9 * tree.scale} fill={index % 3 === 0 ? '#c8d7b4' : '#e6c8ce'} stroke="#faf4e8" strokeWidth="0.45" />)}
    {landmarks.map(place => {
      const found = snapshot.discovered.includes(place.id)
      const textY = place.kind === 'water' || place.kind === 'home' ? place.z - 6 : place.z + 6
      return <g key={place.id}><circle cx={place.x} cy={place.z} r={expanded ? 1.7 : 1.5} fill={found ? '#b88672' : '#fcf9ed'} stroke={found ? '#fff9ea' : '#93a28c'} strokeWidth="0.55"><title>{place.name}{found ? ' · discovered' : ''}</title></circle>{expanded && <text x={place.x} y={textY} textAnchor="middle" fill="#586b5a" fontSize="2.55" fontFamily="Arial, sans-serif" paintOrder="stroke" stroke="#edf0d8" strokeWidth="0.9" strokeLinejoin="round">{place.name}</text>}</g>
    })}
    <circle cx={snapshot.player.x} cy={snapshot.player.z} r={expanded ? 3 : 3.5} fill="#627f73" opacity="0.18" />
    <circle cx={snapshot.player.x} cy={snapshot.player.z} r={expanded ? 1.65 : 2.05} fill="#536d63" stroke="#fffdf4" strokeWidth="0.8"><title>Your position</title></circle>
  </svg>
}
