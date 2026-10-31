import type {
  CitizenState,
  Collider,
  Point2,
  SimulationInput,
  SimulationState,
  VehicleKind,
  VehicleState,
  WeatherCondition,
  WeatherState,
} from './types';
import { WORLD } from './world';

export type { SimulationInput, SimulationState, WeatherCondition, WeatherState } from './types';

export const PLAYER_RADIUS = 0.42;
export const WALK_SPEED = 4.2;
export const SPRINT_SPEED = 7.2;
export const WEATHER_CYCLE_SECONDS = 96;
export const EMPTY_INPUT: SimulationInput = { moveX: 0, moveZ: 0, sprint: false, jump: false, yaw: 0 };
const GRAVITY = 18;
const JUMP_SPEED = 6.6;
const MAX_DT = 0.1;
const SUBSTEP = 1 / 120;
const TAU = Math.PI * 2;

const shuttleRoute = WORLD.shuttleRoute;
const innerLaneRoute = WORLD.innerLaneRoute;
const crossEastRoute = WORLD.crossEastRoute;
const crossWestRoute = WORLD.crossWestRoute;
const sidewalkRoutes = WORLD.sidewalkRoutes;

function smoothstep01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/**
 * Computes the periodic weather state for a given elapsed simulation time.
 * Cycles smoothly across a 96-second period:
 *   [0..28s]  Sunny -> Overcast buildup
 *   [28..52s] Overcast -> Light Rain peak
 *   [52..76s] Light Rain -> Overcast clearing
 *   [76..96s] Overcast -> Sunny clear skies
 */
export function computeScheduledWeather(elapsed: number): Omit<WeatherState, 'autoCycle'> {
  const phase = (((elapsed % WEATHER_CYCLE_SECONDS) + WEATHER_CYCLE_SECONDS) % WEATHER_CYCLE_SECONDS) / WEATHER_CYCLE_SECONDS;

  let condition: WeatherCondition = 'sunny';
  let cloudCover = 0;
  let rainIntensity = 0;

  if (phase < 0.25) {
    // Sunny plateau (0..0.16) then smooth transition to Overcast (0.16..0.25)
    const t = smoothstep01((phase - 0.16) / 0.09);
    cloudCover = t * 0.68;
    rainIntensity = 0;
    condition = cloudCover >= 0.35 ? 'overcast' : 'sunny';
  } else if (phase < 0.50) {
    // Overcast plateau (0.25..0.37) then smooth transition into Light Rain (0.37..0.50)
    const t = smoothstep01((phase - 0.37) / 0.13);
    cloudCover = 0.68 + t * 0.32;
    rainIntensity = t;
    condition = rainIntensity >= 0.35 ? 'light_rain' : 'overcast';
  } else if (phase < 0.75) {
    // Light Rain plateau (0.50..0.63) then easing back to Overcast (0.63..0.75)
    const t = smoothstep01((phase - 0.63) / 0.12);
    cloudCover = 1.0 - t * 0.32;
    rainIntensity = 1.0 - t;
    condition = rainIntensity >= 0.35 ? 'light_rain' : 'overcast';
  } else {
    // Overcast clearing back to Sunny (0.75..0.88), then Sunny (0.88..1.0)
    const t = smoothstep01((phase - 0.75) / 0.13);
    cloudCover = 0.68 * (1 - t);
    rainIntensity = 0;
    condition = cloudCover >= 0.35 ? 'overcast' : 'sunny';
  }

  return {
    condition,
    cloudCover: Number(cloudCover.toFixed(4)),
    rainIntensity: Number(rainIntensity.toFixed(4)),
  };
}

export function getWeatherTargets(condition: WeatherCondition): { cloudCover: number; rainIntensity: number } {
  if (condition === 'light_rain') return { cloudCover: 1, rainIntensity: 1 };
  if (condition === 'overcast') return { cloudCover: 0.68, rainIntensity: 0 };
  return { cloudCover: 0, rainIntensity: 0 };
}

function shortestAngleDiff(from: number, to: number): number {
  return ((to - from + Math.PI) % TAU + TAU) % TAU - Math.PI;
}

/**
 * Shared pathfinding waypoint-loop follower for vehicles and autonomous sidewalk pedestrians.
 * Supports bidirectional traversal (reversed) and optional smooth corner yaw blending.
 */
export function followLoop(
  route: Point2[],
  distance: number,
  reversed = false,
  cornerBlend = 0
): Point2 & { yaw: number } {
  const ordered = reversed ? [...route].reverse() : route;
  const n = ordered.length;
  const lengths = ordered.map((point, i) =>
    Math.hypot(ordered[(i + 1) % n].x - point.x, ordered[(i + 1) % n].z - point.z)
  );
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let remaining = ((distance % total) + total) % total;
  for (let i = 0; i < n; i++) {
    const segLen = lengths[i];
    if (remaining > segLen) {
      remaining -= segLen;
      continue;
    }
    const start = ordered[i];
    const end = ordered[(i + 1) % n];
    const fraction = segLen > 0 ? remaining / segLen : 0;
    const x = start.x + (end.x - start.x) * fraction;
    const z = start.z + (end.z - start.z) * fraction;
    let yaw = Math.atan2(end.x - start.x, end.z - start.z);

    if (cornerBlend > 0 && segLen > cornerBlend * 2) {
      const distToEnd = segLen - remaining;
      if (distToEnd < cornerBlend) {
        const nextEnd = ordered[(i + 2) % n];
        const nextYaw = Math.atan2(nextEnd.x - end.x, nextEnd.z - end.z);
        const t = 0.5 * (1 - distToEnd / cornerBlend);
        yaw += shortestAngleDiff(yaw, nextYaw) * t;
      } else if (remaining < cornerBlend) {
        const prevStart = ordered[(i - 1 + n) % n];
        const prevYaw = Math.atan2(start.x - prevStart.x, start.z - prevStart.z);
        const t = 0.5 * (1 - remaining / cornerBlend);
        yaw += shortestAngleDiff(yaw, prevYaw) * t;
      }
    }

    return { x, z, yaw };
  }
  return { ...ordered[0], yaw: 0 };
}

interface PedestrianSpec {
  id: string;
  routeId: string;
  route: Point2[];
  offset: number;
  speed: number;
  reversed: boolean;
  palette: number;
}

const PEDESTRIAN_SPECS: PedestrianSpec[] = Array.from({ length: 36 }, (_, i) => {
  // First 6 agents walk along the primary central plaza sidewalk loop; remaining 30 span all 8 city sidewalk loops
  const routeObj = i < 4 ? sidewalkRoutes[0] : sidewalkRoutes[i % sidewalkRoutes.length];
  const reversed = i >= 4 && i % 2 === 1;
  const speed = Number((0.78 + (i % 5) * 0.085).toFixed(3));
  const offset = Number((i * 11.25 + (i % 3) * 4.5).toFixed(3));
  return {
    id: `citizen-${i + 1}`,
    routeId: routeObj.id,
    route: routeObj.waypoints,
    offset,
    speed,
    reversed,
    palette: i % 5,
  };
});

function computePedestrians(elapsed: number): CitizenState[] {
  return PEDESTRIAN_SPECS.map(spec => {
    const pos = followLoop(spec.route, elapsed * spec.speed + spec.offset, spec.reversed, 1.1);
    return {
      id: spec.id,
      x: pos.x,
      z: pos.z,
      yaw: pos.yaw,
      palette: spec.palette,
      routeId: spec.routeId,
      speed: spec.speed,
    };
  });
}

interface VehicleSpec {
  id: string;
  kind: VehicleKind;
  lane: VehicleState['lane'];
  route: Point2[];
  offset: number;
  speed: number;
  colorIndex: number;
}

const VEHICLE_SPECS: VehicleSpec[] = [
  // Outer Lane (Clockwise around 2-lane Ring Boulevard) - 7 vehicles
  { id: 'veh-outer-1', kind: 'shuttle', lane: 'outer', route: shuttleRoute, offset: 10, speed: 4.4, colorIndex: 0 },
  { id: 'veh-outer-2', kind: 'sedan', lane: 'outer', route: shuttleRoute, offset: 54, speed: 4.4, colorIndex: 1 },
  { id: 'veh-outer-3', kind: 'taxi', lane: 'outer', route: shuttleRoute, offset: 98, speed: 4.4, colorIndex: 2 },
  { id: 'veh-outer-4', kind: 'coupe', lane: 'outer', route: shuttleRoute, offset: 142, speed: 4.4, colorIndex: 3 },
  { id: 'veh-outer-5', kind: 'van', lane: 'outer', route: shuttleRoute, offset: 186, speed: 4.4, colorIndex: 4 },
  { id: 'veh-outer-6', kind: 'sedan', lane: 'outer', route: shuttleRoute, offset: 230, speed: 4.4, colorIndex: 0 },
  { id: 'veh-outer-7', kind: 'coupe', lane: 'outer', route: shuttleRoute, offset: 274, speed: 4.4, colorIndex: 2 },

  // Inner Lane (Counter-Clockwise around 2-lane Ring Boulevard) - 7 vehicles
  { id: 'veh-inner-1', kind: 'shuttle', lane: 'inner', route: innerLaneRoute, offset: 22, speed: 4.8, colorIndex: 1 },
  { id: 'veh-inner-2', kind: 'coupe', lane: 'inner', route: innerLaneRoute, offset: 62, speed: 4.8, colorIndex: 4 },
  { id: 'veh-inner-3', kind: 'van', lane: 'inner', route: innerLaneRoute, offset: 102, speed: 4.8, colorIndex: 0 },
  { id: 'veh-inner-4', kind: 'taxi', lane: 'inner', route: innerLaneRoute, offset: 142, speed: 4.8, colorIndex: 2 },
  { id: 'veh-inner-5', kind: 'sedan', lane: 'inner', route: innerLaneRoute, offset: 182, speed: 4.8, colorIndex: 3 },
  { id: 'veh-inner-6', kind: 'shuttle', lane: 'inner', route: innerLaneRoute, offset: 222, speed: 4.8, colorIndex: 4 },
  { id: 'veh-inner-7', kind: 'sedan', lane: 'inner', route: innerLaneRoute, offset: 262, speed: 4.8, colorIndex: 1 },

  // Cross-Avenue Eastbound & South Loop - 3 vehicles
  { id: 'veh-cross-e1', kind: 'taxi', lane: 'cross-east', route: crossEastRoute, offset: 15, speed: 4.1, colorIndex: 2 },
  { id: 'veh-cross-e2', kind: 'coupe', lane: 'cross-east', route: crossEastRoute, offset: 72, speed: 4.1, colorIndex: 3 },
  { id: 'veh-cross-e3', kind: 'van', lane: 'cross-east', route: crossEastRoute, offset: 128, speed: 4.1, colorIndex: 0 },

  // Cross-Avenue Westbound & North Loop - 3 vehicles
  { id: 'veh-cross-w1', kind: 'sedan', lane: 'cross-west', route: crossWestRoute, offset: 35, speed: 4.6, colorIndex: 4 },
  { id: 'veh-cross-w2', kind: 'shuttle', lane: 'cross-west', route: crossWestRoute, offset: 125, speed: 4.6, colorIndex: 1 },
  { id: 'veh-cross-w3', kind: 'coupe', lane: 'cross-west', route: crossWestRoute, offset: 215, speed: 4.6, colorIndex: 3 },
];

function computeVehicles(elapsed: number): VehicleState[] {
  return VEHICLE_SPECS.map(spec => {
    const pos = followLoop(spec.route, elapsed * spec.speed + spec.offset);
    return {
      id: spec.id,
      x: pos.x,
      z: pos.z,
      yaw: pos.yaw,
      kind: spec.kind,
      lane: spec.lane,
      colorIndex: spec.colorIndex,
      speed: spec.speed,
    };
  });
}

export function createSimulation(): SimulationState {
  return {
    player: { ...WORLD.spawn, y: 0, yaw: Math.PI, speed: 0, velocityX: 0, velocityZ: 0, verticalVelocity: 0, grounded: true },
    companion: { x: WORLD.spawn.x + 1.4, z: WORLD.spawn.z + 1.4, yaw: Math.PI },
    time: 9.5, paused: false, discovered: new Set(), nearLandmark: null,
    frame: 0, elapsed: 0, jumpHeld: false,
    npcs: computePedestrians(0),
    shuttle: followLoop(shuttleRoute, 10),
    vehicles: computeVehicles(0),
    weather: { ...computeScheduledWeather(0), autoCycle: true },
  };
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const CELL_SIZE = 10;
const GRID_MIN_X = Math.floor(WORLD.bounds.minX / CELL_SIZE) - 1;
const GRID_MIN_Z = Math.floor(WORLD.bounds.minZ / CELL_SIZE) - 1;
const GRID_MAX_X = Math.ceil(WORLD.bounds.maxX / CELL_SIZE) + 1;
const GRID_MAX_Z = Math.ceil(WORLD.bounds.maxZ / CELL_SIZE) + 1;
const GRID_COLS = GRID_MAX_X - GRID_MIN_X + 1;
const GRID_ROWS = GRID_MAX_Z - GRID_MIN_Z + 1;

const COLLIDER_GRID: Collider[][] = new Array(GRID_COLS * GRID_ROWS).fill(null).map(() => []);

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
        COLLIDER_GRID[getCellIndex(cx, cz)].push(box);
      }
    }
  }
}

/** Resolve actual circle/AABB overlap, preserving tangential movement at walls. */
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
    // Recover safely if a debug teleport places the center inside a building.
    const toX = box.halfX - Math.abs(localX);
    const toZ = box.halfZ - Math.abs(localZ);
    if (toX < toZ) position.x = box.x + (localX < 0 ? -1 : 1) * (box.halfX + radius);
    else position.z = box.z + (localZ < 0 ? -1 : 1) * (box.halfZ + radius);
  }
}

function constrain(position: Point2, radius: number) {
  const cx = Math.floor(position.x / CELL_SIZE);
  const cz = Math.floor(position.z / CELL_SIZE);
  if (cx >= GRID_MIN_X && cx <= GRID_MAX_X && cz >= GRID_MIN_Z && cz <= GRID_MAX_Z) {
    const cell = COLLIDER_GRID[getCellIndex(cx, cz)];
    for (let i = 0; i < cell.length; i++) pushOut(position, radius, cell[i]);
  } else {
    for (let i = 0; i < WORLD.colliders.length; i++) pushOut(position, radius, WORLD.colliders[i]);
  }
  const b = WORLD.bounds;
  position.x = clamp(position.x, b.minX + radius, b.maxX - radius);
  position.z = clamp(position.z, b.minZ + radius, b.maxZ - radius);
}

function turnTowards(current: number, desired: number, factor: number): number {
  const difference = ((desired - current + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return current + difference * factor;
}

function updateDiscovery(state: SimulationState) {
  let nearest: string | null = null;
  let nearestDistance = Infinity;
  for (const landmark of WORLD.landmarks) {
    const distance = Math.hypot(state.player.x - landmark.x, state.player.z - landmark.z);
    if (distance <= landmark.radius) {
      state.discovered.add(landmark.id);
      if (distance < nearestDistance) { nearest = landmark.id; nearestDistance = distance; }
    }
  }
  state.nearLandmark = nearest;
}

/** Mutates in place; call from the render loop, without per-frame React state. */
export function stepSimulation(state: SimulationState, input: SimulationInput, deltaSeconds: number): void {
  if (state.paused || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
  const dt = Math.min(deltaSeconds, MAX_DT);
  const player = state.player;
  const rawX = Number.isFinite(input.moveX) ? input.moveX : 0;
  const rawZ = Number.isFinite(input.moveZ) ? input.moveZ : 0;
  const magnitude = Math.max(1, Math.hypot(rawX, rawZ));
  const moveX = rawX / magnitude;
  const moveZ = rawZ / magnitude;
  const yaw = Number.isFinite(input.yaw) ? input.yaw : 0;
  const maximumSpeed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
  const targetX = (moveX * Math.cos(yaw) - moveZ * Math.sin(yaw)) * maximumSpeed;
  const targetZ = (-moveX * Math.sin(yaw) - moveZ * Math.cos(yaw)) * maximumSpeed;

  if (input.jump && !state.jumpHeld && player.grounded) {
    player.verticalVelocity = JUMP_SPEED;
    player.grounded = false;
  }
  state.jumpHeld = input.jump;

  const count = Math.ceil(dt / SUBSTEP);
  const step = dt / count;
  for (let i = 0; i < count; i++) {
    const smoothing = 1 - Math.exp(-12 * step);
    player.velocityX += (targetX - player.velocityX) * smoothing;
    player.velocityZ += (targetZ - player.velocityZ) * smoothing;
    player.x += player.velocityX * step;
    player.z += player.velocityZ * step;
    constrain(player, PLAYER_RADIUS);
    if (!player.grounded) {
      player.verticalVelocity -= GRAVITY * step;
      player.y += player.verticalVelocity * step;
      if (player.y <= 0) { player.y = 0; player.verticalVelocity = 0; player.grounded = true; }
    }
  }
  player.speed = Math.hypot(player.velocityX, player.velocityZ);
  if (player.speed > 0.06) player.yaw = turnTowards(player.yaw, Math.atan2(player.velocityX, player.velocityZ), 1 - Math.exp(-14 * dt));

  const follower = state.companion;
  const dx = player.x - follower.x;
  const dz = player.z - follower.z;
  const distance = Math.hypot(dx, dz);
  if (distance > 1.7) {
    const travel = Math.min(distance - 1.7, (distance > 4 ? 8.5 : 5) * dt);
    const parts = Math.max(1, Math.ceil(travel / 0.08));
    for (let i = 0; i < parts; i++) {
      follower.x += dx / distance * travel / parts;
      follower.z += dz / distance * travel / parts;
      constrain(follower, 0.28);
    }
    follower.yaw = turnTowards(follower.yaw, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt));
  }

  state.elapsed += dt;
  state.time = ((state.time + dt / 60) % 24 + 24) % 24;
  state.frame++;

  if (state.weather) {
    if (state.weather.autoCycle) {
      const scheduled = computeScheduledWeather(state.elapsed);
      state.weather.condition = scheduled.condition;
      state.weather.cloudCover = scheduled.cloudCover;
      state.weather.rainIntensity = scheduled.rainIntensity;
    } else {
      const targets = getWeatherTargets(state.weather.condition);
      const blend = 1 - Math.exp(-2.8 * dt);
      state.weather.cloudCover = Number((state.weather.cloudCover + (targets.cloudCover - state.weather.cloudCover) * blend).toFixed(4));
      state.weather.rainIntensity = Number((state.weather.rainIntensity + (targets.rainIntensity - state.weather.rainIntensity) * blend).toFixed(4));
    }
  }

  for (let i = 0; i < PEDESTRIAN_SPECS.length; i++) {
    const spec = PEDESTRIAN_SPECS[i];
    const npc = state.npcs[i];
    if (npc) {
      const pos = followLoop(spec.route, state.elapsed * spec.speed + spec.offset, spec.reversed, 1.1);
      npc.x = pos.x;
      npc.z = pos.z;
      npc.yaw = pos.yaw;
    }
  }
  Object.assign(state.shuttle, followLoop(shuttleRoute, state.elapsed * 4.4 + 10));
  if (state.vehicles) {
    for (let i = 0; i < VEHICLE_SPECS.length; i++) {
      const spec = VEHICLE_SPECS[i];
      const pos = followLoop(spec.route, state.elapsed * spec.speed + spec.offset);
      if (state.vehicles[i]) {
        state.vehicles[i].x = pos.x;
        state.vehicles[i].z = pos.z;
        state.vehicles[i].yaw = pos.yaw;
      }
    }
  }
  updateDiscovery(state);
}

