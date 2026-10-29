import { WORLD } from '../core/world'
import type { WorldSnapshot } from '../scene/types'

export default function WorldMap({ snapshot, expanded = false }: { snapshot: WorldSnapshot; expanded?: boolean }) {
  const { bounds, landmarks, buildings, roadSegments, trees, flowers, flowerBeds } = WORLD
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxZ - bounds.minZ
  return (
    <svg
      className="world-map"
      viewBox={`${bounds.minX - 4} ${bounds.minZ - 4} ${width + 8} ${height + 8}`}
      role="img"
      aria-label="Map showing your position, 2-lane roads, buildings, water, trees, and places in Blossom Central"
    >
      <rect x={bounds.minX - 4} y={bounds.minZ - 4} width={width + 8} height={height + 8} fill="#edf0d8" />
      <rect x={bounds.minX} y={bounds.minZ} width={width} height={height} rx="5" fill="#e4e9ce" stroke="#d3dcc2" strokeWidth="0.5" />

      {/* Sunpetal Canal water */}
      <rect x={bounds.minX} y={-31} width={width} height={8} fill="#9dcfc8" />

      {/* 2-Lane Bidirectional Road Network + Dual Lane Center Dividers */}
      {roadSegments.map(seg => {
        const w = seg.orientation === 'horizontal' ? seg.length : seg.width
        const h = seg.orientation === 'horizontal' ? seg.width : seg.length
        return (
          <g key={seg.id}>
            <rect
              x={seg.x - w / 2}
              y={seg.z - h / 2}
              width={w}
              height={h}
              rx="1.2"
              fill="#b8c4bc"
              stroke="#d9dec8"
              strokeWidth="0.45"
            />
            {seg.orientation === 'horizontal' ? (
              <line
                x1={seg.x - w / 2 + 2}
                y1={seg.z}
                x2={seg.x + w / 2 - 2}
                y2={seg.z}
                stroke="#f4df9d"
                strokeWidth="0.55"
                strokeDasharray="2.2 1.6"
              />
            ) : (
              <line
                x1={seg.x}
                y1={seg.z - h / 2 + 2}
                x2={seg.x}
                y2={seg.z + h / 2 - 2}
                stroke="#f4df9d"
                strokeWidth="0.55"
                strokeDasharray="2.2 1.6"
              />
            )}
          </g>
        )
      })}

      {/* Central Sunpetal Pedestrian Bridge */}
      <rect x={-4} y={-31.2} width={8} height={8.4} rx="0.8" fill="#e7c8a4" stroke="#faf4e8" strokeWidth="0.45" />

      {/* 16 Circular Planting Beds */}
      {flowerBeds.map((bed, idx) => (
        <circle key={`bed-${idx}`} cx={bed.x} cy={bed.z} r={bed.radius} fill="#c4d6b0" opacity="0.65" />
      ))}

      {/* 24 City Buildings */}
      {buildings.map(b => {
        const fill =
          b.kind === 'bistro' || b.kind === 'cafe'
            ? '#dfbcb0'
            : b.kind === 'apartment' || b.kind === 'blendkit-townhouse'
              ? '#d6c8bb'
              : b.kind === 'tower'
                ? '#b5cfcb'
                : '#c7d4bc'
        return (
          <rect
            key={b.id}
            x={b.x - b.halfX}
            y={b.z - b.halfZ}
            width={b.halfX * 2}
            height={b.halfZ * 2}
            rx="1.4"
            fill={fill}
            stroke="#f9f5e8"
            strokeWidth="0.7"
          />
        )
      })}

      {/* Dense Flowers & Blossom Trees */}
      {flowers.map((flower, index) => (
        <circle
          key={index}
          cx={flower.x}
          cy={flower.z}
          r="0.38"
          fill={index % 3 === 0 ? '#d998a1' : '#d7c79c'}
          opacity="0.65"
        />
      ))}
      {trees.map((tree, index) => (
        <circle
          key={index}
          cx={tree.x}
          cy={tree.z}
          r={1.75 * tree.scale}
          fill={index % 3 === 0 ? '#c8d7b4' : '#e6c8ce'}
          stroke="#faf4e8"
          strokeWidth="0.4"
        />
      ))}

      {/* Landmarks */}
      {landmarks.map(place => {
        const found = snapshot.discovered.has(place.id)
        const textY = place.kind === 'water' || place.kind === 'home' ? place.z - 5.2 : place.z + 5.6
        return (
          <g key={place.id}>
            <circle
              cx={place.x}
              cy={place.z}
              r={expanded ? 1.65 : 1.45}
              fill={found ? '#b88672' : '#fcf9ed'}
              stroke={found ? '#fff9ea' : '#93a28c'}
              strokeWidth="0.55"
            >
              <title>
                {place.name}
                {found ? ' · discovered' : ''}
              </title>
            </circle>
            {expanded && (
              <text
                x={place.x}
                y={textY}
                textAnchor="middle"
                fill="#586b5a"
                fontSize="2.35"
                fontFamily="Arial, sans-serif"
                paintOrder="stroke"
                stroke="#edf0d8"
                strokeWidth="0.85"
                strokeLinejoin="round"
              >
                {place.name}
              </text>
            )}
          </g>
        )
      })}

      {/* Player Position (Last circles in .world-map for Playwright selector compatibility) */}
      <circle cx={snapshot.player.x} cy={snapshot.player.z} r={expanded ? 3 : 3.5} fill="#627f73" opacity="0.18" />
      <circle cx={snapshot.player.x} cy={snapshot.player.z} r={expanded ? 1.65 : 2.05} fill="#536d63" stroke="#fffdf4" strokeWidth="0.8">
        <title>Your position</title>
      </circle>
    </svg>
  )
}
