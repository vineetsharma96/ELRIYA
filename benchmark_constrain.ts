import { WORLD } from './src/core/world.ts';
import { Point2, Collider } from './src/core/types.ts';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function pushOut(position: Point2, radius: number, box: Collider) {
  const localX = position.x - box.x;
  const localZ = position.z - box.z;
  const nearestX = clamp(localX, -box.halfX, box.halfX);
  const nearestZ = clamp(localZ, -box.halfZ, box.halfZ);
  const dx = localX - nearestX;
  const dz = localZ - nearestZ;
  const distanceSquared = dx * dx + dz * dz;
  if (distanceSquared >= radius * radius) return;
  if (distanceSquared > 1e-12) {
    const distance = Math.sqrt(distanceSquared);
    const correction = (radius - distance) / distance;
    position.x += dx * correction;
    position.z += dz * correction;
  } else {
    const toX = box.halfX - Math.abs(localX);
    const toZ = box.halfZ - Math.abs(localZ);
    if (toX < toZ) position.x = box.x + (localX < 0 ? -1 : 1) * (box.halfX + radius);
    else position.z = box.z + (localZ < 0 ? -1 : 1) * (box.halfZ + radius);
  }
}

function constrainOld(position: Point2, radius: number) {
  WORLD.colliders.forEach(box => pushOut(position, radius, box));
  const b = WORLD.bounds;
  position.x = clamp(position.x, b.minX + radius, b.maxX - radius);
  position.z = clamp(position.z, b.minZ + radius, b.maxZ - radius);
}

const CELL_SIZE = 10;
const GRID_MIN_X = Math.floor(-60 / CELL_SIZE);
const GRID_MIN_Z = Math.floor(-60 / CELL_SIZE);
const GRID_MAX_X = Math.ceil(60 / CELL_SIZE);
const GRID_MAX_Z = Math.ceil(60 / CELL_SIZE);
const GRID_COLS = GRID_MAX_X - GRID_MIN_X + 1;
const GRID_ROWS = GRID_MAX_Z - GRID_MIN_Z + 1;

const grid: Collider[][] = new Array(GRID_COLS * GRID_ROWS).fill(null).map(() => []);

function getCellIndex(cx: number, cz: number): number {
    return (cz - GRID_MIN_Z) * GRID_COLS + (cx - GRID_MIN_X);
}

for (const box of WORLD.colliders) {
    const minCx = Math.floor((box.x - box.halfX - 2) / CELL_SIZE);
    const maxCx = Math.floor((box.x + box.halfX + 2) / CELL_SIZE);
    const minCz = Math.floor((box.z - box.halfZ - 2) / CELL_SIZE);
    const maxCz = Math.floor((box.z + box.halfZ + 2) / CELL_SIZE);

    for (let cz = minCz; cz <= maxCz; cz++) {
        for (let cx = minCx; cx <= maxCx; cx++) {
            if (cx >= GRID_MIN_X && cx <= GRID_MAX_X && cz >= GRID_MIN_Z && cz <= GRID_MAX_Z) {
                grid[getCellIndex(cx, cz)].push(box);
            }
        }
    }
}

function constrainNew(position: Point2, radius: number) {
  const cx = Math.floor(position.x / CELL_SIZE);
  const cz = Math.floor(position.z / CELL_SIZE);

  if (cx >= GRID_MIN_X && cx <= GRID_MAX_X && cz >= GRID_MIN_Z && cz <= GRID_MAX_Z) {
      const cell = grid[getCellIndex(cx, cz)];
      for (let i = 0; i < cell.length; i++) {
          pushOut(position, radius, cell[i]);
      }
  } else {
      for (let i = 0; i < WORLD.colliders.length; i++) {
          pushOut(position, radius, WORLD.colliders[i]);
      }
  }

  const b = WORLD.bounds;
  position.x = clamp(position.x, b.minX + radius, b.maxX - radius);
  position.z = clamp(position.z, b.minZ + radius, b.maxZ - radius);
}


const numIter = 1000000;
const positionsOld: Point2[] = [];
const positionsNew: Point2[] = [];
for (let i = 0; i < numIter; i++) {
    const p = { x: (Math.random() - 0.5) * 100, z: (Math.random() - 0.5) * 100 };
    positionsOld.push({...p});
    positionsNew.push({...p});
}

const startOld = performance.now();
for (let i = 0; i < numIter; i++) {
    constrainOld(positionsOld[i], 0.42);
}
const endOld = performance.now();
console.log(`constrainOld Benchmark: ${(endOld - startOld).toFixed(2)} ms`);

const startNew = performance.now();
for (let i = 0; i < numIter; i++) {
    constrainNew(positionsNew[i], 0.42);
}
const endNew = performance.now();
console.log(`constrainNew Benchmark: ${(endNew - startNew).toFixed(2)} ms`);

// Verify results
for (let i = 0; i < numIter; i++) {
    if (Math.abs(positionsOld[i].x - positionsNew[i].x) > 1e-6 || Math.abs(positionsOld[i].z - positionsNew[i].z) > 1e-6) {
        console.error(`Mismatch at ${i}:`, positionsOld[i], positionsNew[i]);
        break;
    }
}
