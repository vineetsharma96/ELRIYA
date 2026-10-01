import type { Collider, Landmark, Point2 } from './types';
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
  { id: 'hidden-garden', name: 'Pocket Garden', kind: 'garden', x: -26, z: 19, radius: 6, description: 'A quiet patch of flowers, tucked just off the promenade.' },
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

// Coordinate transform for rotationY = Math.PI, translation = [bistroPosX, bistroPosY, bistroPosZ]
// x_w = bistroPosX - x_l
// y_w = bistroPosY + y_l
// z_w = bistroPosZ - z_l
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

export const CAMERA_OBSTACLES_3D: BoxCollider3D[] = [
  ...BISTRO_COLLIDERS_3D,
  { id: 'aurora-residences', min: [16 - 4 - 0.8, 0, -14 - 3.5 - 0.8], max: [16 + 4 + 0.8, 14, -14 + 3.5 + 0.8] },
  { id: 'cloudline-tower', min: [25 - 3.5 - 0.8, 0, 12 - 3.5 - 0.8], max: [25 + 3.5 + 0.8, 22, 12 + 3.5 + 0.8] },
];

const colliders: Collider[] = [
  ...bistroGroundColliders,
  { x: 16, z: -14, halfX: 4, halfZ: 3.5 },
  { x: 25, z: 12, halfX: 3.5, halfZ: 3.5 },
  { x: 0, z: -5, halfX: 3, halfZ: 3 },
  // Canal banks are impassable except for the eight-meter central bridge.
  { x: -23, z: -27, halfX: 19, halfZ: 4 },
  { x: 23, z: -27, halfX: 19, halfZ: 4 },
];

function createPlanting() {
  const random = seededRandom(SEED);
  const trees: (Point2 & { scale: number })[] = [];
  const rows = [-34, -22, -10, 10, 22, 34];
  for (const z of [-35, 29]) {
    for (const x of rows) trees.push({ x, z: z + random() * 2, scale: 0.8 + random() * 0.4 });
  }
  const fixedTrees: Point2[] = [
    { x: -24, z: -17 }, { x: -24, z: -6 }, { x: -26, z: 8 },
    { x: -31, z: 17 }, { x: -21, z: 23 }, { x: -12, z: 13 },
    { x: -9, z: 23 }, { x: 11, z: 8 }, { x: 11, z: 21 },
    { x: 34, z: -17 }, { x: 31, z: -6 }, { x: 35, z: 17 },
    { x: -9, z: -19 }, { x: 7, z: -20 },
  ];
  fixedTrees.forEach(point => trees.push({ ...point, scale: 0.85 + random() * 0.3 }));
  const flowers: Point2[] = [];
  const beds = [{ x: -26, z: 19 }, { x: -11, z: 9 }, { x: 10, z: 21 }, { x: 29, z: -5 }, { x: -27, z: -17 }];
  for (const bed of beds) {
    for (let i = 0; i < 30; i++) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * 3.4;
      flowers.push({ x: bed.x + Math.cos(angle) * radius, z: bed.z + Math.sin(angle) * radius });
    }
  }
  return { trees, flowers };
}

export const WORLD = {
  bounds: { minX: -42, maxX: 42, minZ: -42, maxZ: 42 },
  spawn: { x: 0, z: 12 },
  landmarks,
  colliders,
  citizenRoute: [{ x: -7, z: 16 }, { x: -7, z: -19 }, { x: 7, z: -19 }, { x: 7, z: 16 }] as Point2[],
  shuttleRoute: [{ x: -35, z: 35 }, { x: 35, z: 35 }, { x: 35, z: -20 }, { x: -35, z: -20 }] as Point2[],
  ...createPlanting(),
};

export function getLandmark(id: string): Landmark | undefined {
  return WORLD.landmarks.find(landmark => landmark.id === id);
}
