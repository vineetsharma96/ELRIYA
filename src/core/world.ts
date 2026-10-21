import type {
  BlendKitAssetMeta,
  BuildingPlacement,
  Collider,
  Landmark,
  Point2,
  RoadSegment,
  SidewalkRoute,
  StreetLampPlacement,
} from './types';
import bistroContract from '../../public/assets/architecture/blossom_bistro_contract.json';

export const SEED = 240924;

/** Local deterministic PRNG: no shared mutable random sequence. */
export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

const landmarks: Landmark[] = [
  { id: 'blossom-plaza', name: 'Blossom Plaza', kind: 'plaza', x: 0, z: 0, radius: 7, description: 'A little room to breathe in the heart of Elyria.' },
  { id: 'neko-cafe', name: 'Neko Café', kind: 'cafe', x: -15, z: -10, radius: 9, description: 'Sweet aromas, soft sunlight, and a table beneath the blossoms.' },
  { id: 'aurora-residences', name: 'Aurora Residences', kind: 'home', x: 16, z: -14, radius: 8, description: 'Pastel balconies with a view of the morning canal.' },
  { id: 'cloudline-tower', name: 'Cloudline Tower', kind: 'tower', x: 25, z: 12, radius: 8, description: 'A bright little glimpse of the city still to come.' },
  { id: 'sunpetal-bridge', name: 'Sunpetal Bridge', kind: 'water', x: 0, z: -27, radius: 6, description: 'Follow the water. Stay for the sound of the breeze.' },
  { id: 'hidden-garden', name: 'Pocket Garden', kind: 'garden', x: -26, z: 14, radius: 5.5, description: 'A quiet patch of flowers, tucked just off the west promenade.' },
  { id: 'sakura-arcade', name: 'Sakura Arcade', kind: 'cafe', x: -27, z: -10, radius: 6.5, description: 'Artisan bakeries and warm timber storefronts from the BlendKit urban collection.' },
  { id: 'verdant-lofts', name: 'Verdant Lofts', kind: 'home', x: -26, z: 3, radius: 6.5, description: 'Terraced pastel residences framed by double-row cherry blossoms.' },
  { id: 'solstice-conservatory', name: 'Solstice Conservatory', kind: 'garden', x: 26, z: -2, radius: 6.5, description: 'A sunlit botanical glasshouse overflowing with rare seasonal blooms.' },
  { id: 'grand-transit-hub', name: 'South Avenue Station', kind: 'plaza', x: 0, z: 29, radius: 6.5, description: 'Busy two-lane transit boulevard connecting East and West Blossom Quarters.' },
  { id: 'northbank-promenade', name: 'Northbank Overlook', kind: 'water', x: 0, z: -36, radius: 6, description: 'Looking across the Sunpetal Canal where dual-lane bridges link the upper district.' },
  { id: 'starlight-annex', name: 'Starlight Spire', kind: 'tower', x: -16, z: -46, radius: 7, description: 'High-density eco-tower anchoring the northern canal skyline.' },
];

const bistroPosX = bistroContract.placement.position[0];
const bistroPosY = bistroContract.placement.position[1];
const bistroPosZ = bistroContract.placement.position[2];

export interface BoxCollider3D {
  id: string;
  min: [number, number, number];
  max: [number, number, number];
  cameraOnly?: boolean;
}

export const BISTRO_COLLIDERS_3D: BoxCollider3D[] = bistroContract.colliders.map(c => {
  const minX = Math.min(bistroPosX - c.min[0], bistroPosX - c.max[0]);
  const maxX = Math.max(bistroPosX - c.min[0], bistroPosX - c.max[0]);
  const minY = bistroPosY + c.min[1];
  const maxY = bistroPosY + c.max[1];
  const minZ = Math.min(bistroPosZ - c.min[2], bistroPosZ - c.max[2]);
  const maxZ = Math.max(bistroPosZ - c.min[2], bistroPosZ - c.max[2]);
  return {
    id: c.id,
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    cameraOnly: Boolean((c as { cameraOnly?: boolean }).cameraOnly),
  };
});

const bistroGroundColliders: Collider[] = BISTRO_COLLIDERS_3D
  .filter(c => !c.cameraOnly)
  .map(c => ({
    x: (c.min[0] + c.max[0]) / 2,
    z: (c.min[2] + c.max[2]) / 2,
    halfX: (c.max[0] - c.min[0]) / 2,
    halfZ: (c.max[2] - c.min[2]) / 2,
  }));

/**
 * Remapped High-Density City Buildings (24 structures across 5 urban districts)
 * Combines original GLB architectural kits and BlendKit modular free kit buildings.
 */
export const BUILDINGS: BuildingPlacement[] = [
  // Central & Inner Districts
  { id: 'neko-bistro', name: 'Blossom Bistro', kind: 'bistro', x: -15, z: -6.5, rotation: Math.PI, scale: 1, halfX: 4, halfZ: 3.5, height: 6.8, blendkitId: 'bk-bistro-01' },
  { id: 'aurora-residences', name: 'Aurora Residences', kind: 'apartment', x: 16, z: -14, rotation: 0, scale: 1, halfX: 4, halfZ: 3.5, height: 14, blendkitId: 'bk-apt-01' },
  { id: 'cloudline-tower', name: 'Cloudline Tower', kind: 'tower', x: 25, z: 12, rotation: 0, scale: 1, halfX: 3.5, halfZ: 3.5, height: 22, blendkitId: 'bk-tower-01' },

  // West Quarter
  { id: 'sakura-arcade', name: 'Sakura Arcade', kind: 'cafe', x: -27, z: -10, rotation: Math.PI / 2, scale: 0.92, halfX: 3.4, halfZ: 4.1, height: 6.5, blendkitId: 'bk-cafe-01' },
  { id: 'verdant-lofts', name: 'Verdant Lofts', kind: 'apartment', x: -26, z: 3, rotation: Math.PI / 2, scale: 0.95, halfX: 3.3, halfZ: 3.7, height: 12, blendkitId: 'bk-apt-01' },
  { id: 'west-townhouse', name: 'Cedar Row Townhouse', kind: 'blendkit-townhouse', x: -26, z: -18.5, rotation: 0, scale: 1, halfX: 3.2, halfZ: 2.3, height: 8.6, palette: 0, blendkitId: 'bk-townhouse-02' },
  { id: 'west-pavilion', name: 'Promenade Tea Kiosk', kind: 'blendkit-pavilion', x: -14, z: 4, rotation: 0, scale: 0.9, halfX: 2.4, halfZ: 2.2, height: 5.4, palette: 1, blendkitId: 'bk-pavilion-01' },

  // East Quarter
  { id: 'east-patisserie', name: 'Canalview Bakery', kind: 'cafe', x: 27, z: -14, rotation: -Math.PI / 2, scale: 0.9, halfX: 3.3, halfZ: 4.0, height: 6.4, blendkitId: 'bk-cafe-01' },
  { id: 'solstice-conservatory', name: 'Solstice Conservatory', kind: 'blendkit-conservatory', x: 26, z: -2, rotation: -Math.PI / 2, scale: 1, halfX: 3.4, halfZ: 3.8, height: 7.5, palette: 0, blendkitId: 'bk-conservatory-01' },
  { id: 'east-arcade', name: 'Sunburst Studio Lofts', kind: 'blendkit-arcade', x: 14, z: 11, rotation: Math.PI, scale: 0.95, halfX: 3.0, halfZ: 2.6, height: 8.5, palette: 2, blendkitId: 'bk-arcade-01' },

  // South Avenue Corridor (Between Cross-Avenue z=21 and South Ring Road z=36)
  { id: 'south-west-residences', name: 'Southgate Apartments', kind: 'apartment', x: -24, z: 28.5, rotation: Math.PI, scale: 0.92, halfX: 3.5, halfZ: 3.0, height: 11.5, blendkitId: 'bk-apt-01' },
  { id: 'south-west-arcade', name: 'Blossom Market Hall', kind: 'blendkit-arcade', x: -12, z: 28.5, rotation: Math.PI, scale: 1, halfX: 3.2, halfZ: 2.6, height: 8.4, palette: 0, blendkitId: 'bk-arcade-01' },
  { id: 'south-transit-pavilion', name: 'South Avenue Hub', kind: 'blendkit-pavilion', x: 0, z: 28.5, rotation: Math.PI, scale: 1.05, halfX: 3.5, halfZ: 2.2, height: 5.8, palette: 0, blendkitId: 'bk-pavilion-01' },
  { id: 'south-east-cafe', name: 'Roastery & Books', kind: 'cafe', x: 12, z: 28.5, rotation: Math.PI, scale: 0.86, halfX: 3.6, halfZ: 2.8, height: 6.0, blendkitId: 'bk-cafe-01' },
  { id: 'south-east-tower', name: 'Meridian Tower', kind: 'tower', x: 24, z: 28.5, rotation: Math.PI, scale: 0.95, halfX: 3.2, halfZ: 3.0, height: 20, blendkitId: 'bk-tower-01' },

  // North Canal Waterfront (North of North Ring Boulevard z=-36, leaving x=0 bridge axis completely clear)
  { id: 'north-west-apartments', name: 'Harborview Flats', kind: 'apartment', x: -28, z: -46, rotation: 0, scale: 0.95, halfX: 3.6, halfZ: 3.1, height: 12, blendkitId: 'bk-apt-01' },
  { id: 'starlight-annex', name: 'Starlight Spire', kind: 'tower', x: -16, z: -46, rotation: 0, scale: 1.05, halfX: 3.3, halfZ: 3.1, height: 22, blendkitId: 'bk-tower-01' },
  { id: 'north-townhouse-west', name: 'Canal Terrace West', kind: 'blendkit-townhouse', x: -7.8, z: -46, rotation: 0, scale: 0.95, halfX: 2.6, halfZ: 2.4, height: 8.6, palette: 1, blendkitId: 'bk-townhouse-02' },
  { id: 'north-conservatory-east', name: 'Waterfront Glasshouse', kind: 'blendkit-conservatory', x: 7.8, z: -46, rotation: 0, scale: 0.95, halfX: 2.6, halfZ: 2.4, height: 7.4, palette: 1, blendkitId: 'bk-conservatory-01' },
  { id: 'north-east-apartments', name: 'Willow Bank Suites', kind: 'apartment', x: 17, z: -46, rotation: 0, scale: 1.0, halfX: 3.7, halfZ: 3.2, height: 12.5, blendkitId: 'bk-apt-01' },
  { id: 'north-east-tower', name: 'Celeste Tower', kind: 'tower', x: 29, z: -46, rotation: 0, scale: 0.98, halfX: 3.3, halfZ: 3.1, height: 21, blendkitId: 'bk-tower-01' },

  // Outer Boulevard Flanks (Outside x = ±38 ring roads)
  { id: 'outer-west-tower', name: 'Westgate Spire', kind: 'tower', x: -47.5, z: -12, rotation: Math.PI / 2, scale: 1.05, halfX: 3.3, halfZ: 3.3, height: 22, blendkitId: 'bk-tower-01' },
  { id: 'outer-west-apartments', name: 'Blossom West Terrace', kind: 'apartment', x: -47.5, z: 8, rotation: Math.PI / 2, scale: 0.96, halfX: 3.2, halfZ: 3.6, height: 12, blendkitId: 'bk-apt-01' },
  { id: 'outer-east-apartments', name: 'Sunrise Residences', kind: 'apartment', x: 47.5, z: -10, rotation: -Math.PI / 2, scale: 0.96, halfX: 3.2, halfZ: 3.6, height: 12, blendkitId: 'bk-apt-01' },
  { id: 'outer-east-tower', name: 'Eastgate Tower', kind: 'tower', x: 47.5, z: 10, rotation: -Math.PI / 2, scale: 1.05, halfX: 3.3, halfZ: 3.3, height: 22, blendkitId: 'bk-tower-01' },
];

export const CAMERA_OBSTACLES_3D: BoxCollider3D[] = [
  ...BISTRO_COLLIDERS_3D,
  ...BUILDINGS.filter(b => b.kind !== 'bistro').map(b => ({
    id: b.id,
    min: [b.x - b.halfX - 0.8, 0, b.z - b.halfZ - 0.8] as [number, number, number],
    max: [b.x + b.halfX + 0.8, b.height, b.z + b.halfZ + 0.8] as [number, number, number],
  })),
];

const colliders: Collider[] = [
  ...bistroGroundColliders,
  ...BUILDINGS.filter(b => b.kind !== 'bistro').map(b => ({
    x: b.x,
    z: b.z,
    halfX: b.halfX,
    halfZ: b.halfZ,
  })),
  // Central plaza fountain
  { x: 0, z: -5, halfX: 3, halfZ: 3 },
  // Canal banks: open at central Sunpetal pedestrian bridge (x in [-4, 4])
  // and open at West/East 2-lane vehicular bridges (x in [-42.3, -33.7] and [33.7, 42.3])
  { x: -18.85, z: -27, halfX: 14.85, halfZ: 4 },
  { x: 18.85, z: -27, halfX: 14.85, halfZ: 4 },
  { x: -48.5, z: -27, halfX: 5.8, halfZ: 4 },
  { x: 48.5, z: -27, halfX: 5.8, halfZ: 4 },
];

/**
 * 2-Lane Road Network Segments (8.4m wide roadbeds = two 4.2m directional lanes)
 */
export const ROAD_SEGMENTS: RoadSegment[] = [
  { id: 'south-boulevard', x: 0, z: 36, length: 84.4, width: 8.4, orientation: 'horizontal', lanes: 2 },
  { id: 'north-boulevard', x: 0, z: -36, length: 84.4, width: 8.4, orientation: 'horizontal', lanes: 2 },
  { id: 'west-boulevard', x: -38, z: 0, length: 80.4, width: 8.4, orientation: 'vertical', lanes: 2 },
  { id: 'east-boulevard', x: 38, z: 0, length: 80.4, width: 8.4, orientation: 'vertical', lanes: 2 },
  { id: 'cross-avenue', x: 0, z: 20.5, length: 68, width: 7.6, orientation: 'horizontal', lanes: 2 },
  { id: 'west-canal-bridge', x: -38, z: -27, length: 9.2, width: 8.8, orientation: 'vertical', lanes: 2, isBridge: true },
  { id: 'east-canal-bridge', x: 38, z: -27, length: 9.2, width: 8.8, orientation: 'vertical', lanes: 2, isBridge: true },
];

/** Outer lane loop (Clockwise, center offset 1.95m outward from road centerline) */
export const OUTER_LANE_ROUTE: Point2[] = [
  { x: -39.95, z: 37.95 },
  { x: 39.95, z: 37.95 },
  { x: 39.95, z: -37.95 },
  { x: -39.95, z: -37.95 },
];

/** Inner lane loop (Counter-clockwise, center offset 1.95m inward from road centerline) */
export const INNER_LANE_ROUTE: Point2[] = [
  { x: -36.05, z: 34.05 },
  { x: -36.05, z: -34.05 },
  { x: 36.05, z: -34.05 },
  { x: 36.05, z: 34.05 },
];

/** South District 2-Lane Loop using the Cross-Avenue (z = 20.5) */
export const CROSS_EAST_ROUTE: Point2[] = [
  { x: -36.05, z: 22.15 },
  { x: 36.05, z: 22.15 },
  { x: 36.05, z: 34.05 },
  { x: -36.05, z: 34.05 },
];

/** North-Central 2-Lane Loop using the Cross-Avenue Westbound lane (z = 18.85) */
export const CROSS_WEST_ROUTE: Point2[] = [
  { x: 39.95, z: 18.85 },
  { x: -39.95, z: 18.85 },
  { x: -39.95, z: -37.95 },
  { x: 39.95, z: -37.95 },
];

export const FLOWER_BEDS: { x: number; z: number; radius: number }[] = [
  { x: -26, z: 14, radius: 4.5 },
  { x: -11, z: 9, radius: 3.6 },
  { x: 10, z: 14, radius: 3.6 },
  { x: 26, z: 4, radius: 3.6 },
  { x: -27, z: -2.5, radius: 3.5 },
  { x: -9, z: -18, radius: 3.4 },
  { x: 8, z: -18, radius: 3.4 },
  { x: 26, z: -20.5, radius: 3.2 },
  { x: -18, z: 28.5, radius: 2.8 },
  { x: -6, z: 28.5, radius: 2.8 },
  { x: 6, z: 28.5, radius: 2.8 },
  { x: 18, z: 28.5, radius: 2.8 },
  { x: -22, z: -45, radius: 3.2 },
  { x: 23, z: -45, radius: 3.2 },
  { x: -46, z: -2, radius: 3.4 },
  { x: 46, z: 0, radius: 3.4 },
];

function isClearOfRoadsAndPaths(x: number, z: number): boolean {
  // Keep 2-lane roads clear
  if (Math.abs(Math.abs(x) - 38) < 5.2 && Math.abs(z) < 42) return false;
  if (Math.abs(Math.abs(z) - 36) < 5.2 && Math.abs(x) < 42) return false;
  if (Math.abs(z - 20.5) < 4.8 && Math.abs(x) < 40) return false;
  // Keep canal water clear
  if (Math.abs(z + 27) < 4.5) return false;
  // Keep central bridge corridor & spawn plaza clear
  if (Math.abs(x) < 5.5 && z < 16 && z > -54) return false;
  // Keep bistro approach path clear
  if (x > -18 && x < 3 && z > -8 && z < 14) return false;
  // Keep building footprints clear
  for (const b of BUILDINGS) {
    if (Math.abs(x - b.x) < b.halfX + 1.8 && Math.abs(z - b.z) < b.halfZ + 1.8) return false;
  }
  return true;
}

function createPlanting() {
  const random = seededRandom(SEED);
  const trees: (Point2 & { scale: number })[] = [];

  // Boulevard avenue rows (South, North, West, East, Canal banks, and Plaza frame)
  const boulevardCandidates: Point2[] = [
    // South of South 2-lane Boulevard (z = 43.2 and z = 49.5)
    ...[-48, -42, -36, -30, -24, -18, -12, -6.5, 6.5, 12, 18, 24, 30, 36, 42, 48].map(x => ({ x, z: 43.2 })),
    ...[-46, -38, -30, -22, -14, -7, 7, 14, 22, 30, 38, 46].map(x => ({ x, z: 49.5 })),
    // Along Cross-Avenue sidewalks (z = 14.5)
    ...[-31, -21, -10, -6.5, 6.5, 10, 21, 31].map(x => ({ x, z: 14.5 })),
    // South Canal Promenade (z = -21.2)
    ...[-31, -25, -19, -12, -7, 7, 12, 19, 25, 31].map(x => ({ x, z: -21.2 })),
    // North Canal Promenade (z = -31.8 not needed if road is at -36; place at z = -42.5 and z = -51.5)
    ...[-48, -41, -34, -22, -12, -5.8, 5.8, 12, 23, 34, 41, 48].map(x => ({ x, z: -42.5 })),
    ...[-48, -40, -32, -22, -11, 11, 23, 32, 40, 48].map(x => ({ x, z: -51.5 })),
    // West Boulevard Inner & Outer tree lines (x = -32.2, x = -44.2, and x = -51.5)
    ...[-16, -6, 9, 14, 27].map(z => ({ x: -32.2, z })),
    ...[-42, -32, -20, -4, 0, 18, 28, 38, 44].map(z => ({ x: -44.2, z })),
    ...[-42, -32, -20, -14, 0, 14, 22, 32, 42].map(z => ({ x: -51.5, z })),
    // East Boulevard Inner & Outer tree lines (x = 32.2, x = 44.2, and x = 51.5)
    ...[-19, -8, 5, 14, 27].map(z => ({ x: 32.2, z })),
    ...[-42, -32, -20, -2, 2, 18, 28, 38, 44].map(z => ({ x: 44.2, z })),
    ...[-42, -32, -20, -14, 0, 14, 22, 32, 42].map(z => ({ x: 51.5, z })),
    // Central Plaza & Garden clusters
    { x: -11, z: 9 }, { x: -18, z: 9 }, { x: 9, z: 5 }, { x: 10, z: -4 },
    { x: 18, z: 2 }, { x: -21, z: -3 }, { x: -20, z: 14 }, { x: -30, z: 13 },
    { x: -24, z: 17 }, { x: 20, z: -19 }, { x: -20, z: -18 },
    { x: 31, z: 3 }, { x: -8, z: -15 }, { x: 8, z: -15 },
    { x: -8, z: -6 }, { x: 8, z: -6 }, { x: -8, z: 2 }, { x: 8, z: 2 },
  ];

  for (const pt of boulevardCandidates) {
    const jitterX = (random() - 0.5) * 0.7;
    const jitterZ = (random() - 0.5) * 0.7;
    const x = Number((pt.x + jitterX).toFixed(2));
    const z = Number((pt.z + jitterZ).toFixed(2));
    if (isClearOfRoadsAndPaths(x, z)) {
      trees.push({ x, z, scale: 0.82 + random() * 0.42 });
    }
  }

  // Dense Flower Beds (560 points across 16 beds, plus boulevard border blooms)
  const flowers: Point2[] = [];
  for (const bed of FLOWER_BEDS) {
    const count = 35;
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * (bed.radius - 0.4);
      flowers.push({
        x: Number((bed.x + Math.cos(angle) * radius).toFixed(2)),
        z: Number((bed.z + Math.sin(angle) * radius).toFixed(2)),
      });
    }
  }

  return { trees, flowers };
}

export const BLENDKIT_CATALOG: BlendKitAssetMeta[] = [
  {
    id: 'bk-bistro-01',
    name: 'Blossom Bistro & Interior Kit',
    category: 'Architecture',
    triangles: 4222,
    instances: 1,
    sourceUrl: 'https://www.blendkit.com/assets/architecture/blossom-bistro',
    license: 'CC0 / Free Commercial',
    description: 'Walkable timber-and-stucco corner café with cedar return counter and table anchors.',
  },
  {
    id: 'bk-apt-01',
    name: 'Storybook Mid-Rise Residence',
    category: 'Architecture',
    triangles: 6006,
    instances: 8,
    sourceUrl: 'https://www.blendkit.com/assets/architecture/pastel-residence',
    license: 'CC0 / Free Commercial',
    description: 'Multi-balcony pastel apartment block with rooftop shrubs and warm night windows.',
  },
  {
    id: 'bk-tower-01',
    name: 'Cloudline Eco-Spire',
    category: 'Architecture',
    triangles: 4848,
    instances: 6,
    sourceUrl: 'https://www.blendkit.com/assets/architecture/cloudline-spire',
    license: 'CC0 / Free Commercial',
    description: 'Seven-tier glass and mint architectural tower with observatory dome and sky gardens.',
  },
  {
    id: 'bk-townhouse-02',
    name: 'BlendKit Modular Gable Townhouse',
    category: 'Architecture',
    triangles: 1420,
    instances: 5,
    sourceUrl: 'https://www.blendkit.com/assets/architecture/modular-townhouse',
    license: 'CC0 / Free Commercial',
    description: 'Three-story timber-trimmed townhouse with flower boxes, dormer roof, and warm lanterns.',
  },
  {
    id: 'bk-conservatory-01',
    name: 'BlendKit Botanical Glass Conservatory',
    category: 'Architecture',
    triangles: 1680,
    instances: 3,
    sourceUrl: 'https://www.blendkit.com/assets/architecture/botanical-conservatory',
    license: 'CC0 / Free Commercial',
    description: 'Arched sage-steel and glass atrium housing indoor palms and warm uplighting.',
  },
  {
    id: 'bk-vehicles-pack',
    name: 'BlendKit Urban EV Fleet (Shuttle, Sedan, Coupe, Van, Taxi)',
    category: 'Vehicles',
    triangles: 2450,
    instances: 20,
    sourceUrl: 'https://www.blendkit.com/assets/vehicles/urban-ev-pack',
    license: 'CC0 / Free Commercial',
    description: 'Bidirectional 2-lane traffic fleet with glowing headlights, taillights, and roof beacons.',
  },
  {
    id: 'bk-sakura-tree',
    name: 'Sakura Canopy Tree & Wind Shader',
    category: 'Vegetation',
    triangles: 2796,
    instances: 112,
    sourceUrl: 'https://www.blendkit.com/assets/vegetation/sakura-canopy',
    license: 'CC0 / Free Commercial',
    description: 'GPU-instanced cherry blossom trees with multi-cluster pink crowns and vertex wind sway.',
  },
  {
    id: 'bk-flower-beds',
    name: 'Wildflower & Planter Cluster Kit',
    category: 'Vegetation',
    triangles: 1986,
    instances: 560,
    sourceUrl: 'https://www.blendkit.com/assets/vegetation/wildflower-kit',
    license: 'CC0 / Free Commercial',
    description: 'Dense multi-petal blossom clusters and terracotta street planters across 16 gardens.',
  },
];

export const SIDEWALK_ROUTES: SidewalkRoute[] = [
  {
    id: 'plaza-promenade',
    name: 'Central Plaza & Bistro Sidewalk',
    waypoints: [
      { x: -8, z: 14 },
      { x: -8, z: -19 },
      { x: 8, z: -19 },
      { x: 8, z: 14 },
    ],
  },
  {
    id: 'west-arcade-sidewalk',
    name: 'West Quarter Arcade & Lofts Sidewalk',
    waypoints: [
      { x: -20.5, z: 15.8 },
      { x: -20.5, z: -21.5 },
      { x: -32.6, z: -21.5 },
      { x: -32.6, z: 15.8 },
    ],
  },
  {
    id: 'east-conservatory-sidewalk',
    name: 'East Quarter Conservatory & Tower Sidewalk',
    waypoints: [
      { x: 20.5, z: -21.5 },
      { x: 20.5, z: 16.1 },
      { x: 32.6, z: 16.1 },
      { x: 32.6, z: -21.5 },
    ],
  },
  {
    id: 'south-avenue-sidewalk',
    name: 'South Avenue Station Sidewalk Loop',
    waypoints: [
      { x: -32.6, z: 24.8 },
      { x: 32.6, z: 24.8 },
      { x: 32.6, z: 32.1 },
      { x: -32.6, z: 32.1 },
    ],
  },
  {
    id: 'canal-bridge-connector',
    name: 'Sunpetal Canal Bridge Pedestrian Loop',
    waypoints: [
      { x: -2.2, z: 14 },
      { x: -2.2, z: -31.4 },
      { x: 2.2, z: -31.4 },
      { x: 2.2, z: 14 },
    ],
  },
  {
    id: 'northbank-waterfront-sidewalk',
    name: 'Northbank Canal & Spire Sidewalk',
    waypoints: [
      { x: -32.6, z: -31.4 },
      { x: 32.6, z: -31.4 },
      { x: 32.6, z: -41.4 },
      { x: -32.6, z: -41.4 },
    ],
  },
  {
    id: 'outer-boulevard-sidewalk',
    name: 'Outer Ring Boulevard Sidewalk',
    waypoints: [
      { x: -43.2, z: 41.2 },
      { x: 43.2, z: 41.2 },
      { x: 43.2, z: -41.4 },
      { x: -43.2, z: -41.4 },
    ],
  },
  {
    id: 'pocket-garden-stroll',
    name: 'Pocket Garden & Cross-Avenue Sidewalk',
    waypoints: [
      { x: -32.6, z: 16.1 },
      { x: 32.6, z: 16.1 },
      { x: 32.6, z: -21.5 },
      { x: -32.6, z: -21.5 },
    ],
  },
];

const RAW_STREET_LAMPS: { x: number; z: number; rotation: number }[] = [
  // South Boulevard, Cross-Avenue, South Canal Promenade, and North Boulevard sidewalks
  ...[-30, -18, -6, 6, 18, 30].flatMap(x => [
    { x, z: 31.2, rotation: -Math.PI / 2 },
    { x, z: 40.8, rotation: Math.PI / 2 },
    { x, z: 16.0, rotation: -Math.PI / 2 },
    { x, z: 25.0, rotation: Math.PI / 2 },
    { x, z: -22.2, rotation: Math.PI / 2 },
    { x, z: -31.2, rotation: -Math.PI / 2 },
  ]),
  // West & East 2-Lane Ring Boulevard sidewalks
  { x: -33.2, z: -14, rotation: Math.PI },
  { x: -33.2, z: -2, rotation: Math.PI },
  { x: -33.2, z: 10, rotation: Math.PI },
  { x: 33.2, z: -14, rotation: 0 },
  { x: 33.2, z: -2, rotation: 0 },
  { x: 33.2, z: 10, rotation: 0 },
  // Central Plaza & Sunpetal Bridge approach lanterns
  { x: -4.6, z: 6, rotation: 0 },
  { x: 4.6, z: 6, rotation: Math.PI },
  { x: -4.6, z: -14, rotation: 0 },
  { x: 4.6, z: -14, rotation: Math.PI },
];

export const STREET_LAMPS: StreetLampPlacement[] = RAW_STREET_LAMPS.map((lamp, idx) => ({
  id: `lamp-${idx + 1}`,
  x: lamp.x,
  z: lamp.z,
  rotation: lamp.rotation,
  globeX: Number((lamp.x + 0.7 * Math.cos(lamp.rotation)).toFixed(3)),
  globeY: 3.14,
  globeZ: Number((lamp.z - 0.7 * Math.sin(lamp.rotation)).toFixed(3)),
}));

export const WORLD = {
  bounds: { minX: -54, maxX: 54, minZ: -54, maxZ: 54 },
  spawn: { x: 0, z: 12 },
  landmarks,
  buildings: BUILDINGS,
  colliders,
  roadSegments: ROAD_SEGMENTS,
  streetLamps: STREET_LAMPS,
  citizenRoute: SIDEWALK_ROUTES[0].waypoints,
  sidewalkRoutes: SIDEWALK_ROUTES,
  shuttleRoute: OUTER_LANE_ROUTE,
  innerLaneRoute: INNER_LANE_ROUTE,
  crossEastRoute: CROSS_EAST_ROUTE,
  crossWestRoute: CROSS_WEST_ROUTE,
  flowerBeds: FLOWER_BEDS,
  blendkitCatalog: BLENDKIT_CATALOG,
  ...createPlanting(),
};

export function getLandmark(id: string): Landmark | undefined {
  return WORLD.landmarks.find(landmark => landmark.id === id);
}

