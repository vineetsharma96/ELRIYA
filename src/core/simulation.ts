import type { Collider, Point2, SimulationInput, SimulationState } from './types';
import { WORLD } from './world';

export type { SimulationInput, SimulationState } from './types';

export const PLAYER_RADIUS = 0.42;
export const WALK_SPEED = 4.2;
export const SPRINT_SPEED = 7.2;
export const EMPTY_INPUT: SimulationInput = { moveX: 0, moveZ: 0, sprint: false, jump: false, yaw: 0 };
const GRAVITY = 18;
const JUMP_SPEED = 6.6;
const MAX_DT = 0.1;
const SUBSTEP = 1 / 120;
const TAU = Math.PI * 2;

const citizenRoute = WORLD.citizenRoute;
const shuttleRoute = WORLD.shuttleRoute;

function followLoop(route: Point2[], distance: number): Point2 & { yaw: number } {
  const lengths = route.map((point, i) => Math.hypot(route[(i + 1) % route.length].x - point.x, route[(i + 1) % route.length].z - point.z));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let remaining = ((distance % total) + total) % total;
  for (let i = 0; i < route.length; i++) {
    if (remaining > lengths[i]) { remaining -= lengths[i]; continue; }
    const start = route[i];
    const end = route[(i + 1) % route.length];
    const fraction = remaining / lengths[i];
    return { x: start.x + (end.x - start.x) * fraction, z: start.z + (end.z - start.z) * fraction, yaw: Math.atan2(end.x - start.x, end.z - start.z) };
  }
  return { ...route[0], yaw: 0 };
}

export function createSimulation(): SimulationState {
  return {
    player: { ...WORLD.spawn, y: 0, yaw: Math.PI, speed: 0, velocityX: 0, velocityZ: 0, verticalVelocity: 0, grounded: true },
    companion: { x: WORLD.spawn.x + 1.4, z: WORLD.spawn.z + 1.4, yaw: Math.PI },
    time: 9.5, paused: false, discovered: [], nearLandmark: null,
    frame: 0, elapsed: 0, jumpHeld: false,
    npcs: Array.from({ length: 16 }, (_, i) => ({ id: `citizen-${i + 1}`, ...followLoop(citizenRoute, i * 6.125), palette: i % 5 })),
    shuttle: followLoop(shuttleRoute, 10),
  };
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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
  WORLD.colliders.forEach(box => pushOut(position, radius, box));
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
      if (!state.discovered.includes(landmark.id)) state.discovered.push(landmark.id);
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
    // Follow using the same boundaries, including the canal.
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
  state.npcs.forEach((npc, i) => Object.assign(npc, followLoop(citizenRoute, state.elapsed * (0.75 + (i % 3) * 0.08) + i * 6.125)));
  Object.assign(state.shuttle, followLoop(shuttleRoute, state.elapsed * 3.8 + 10));
  updateDiscovery(state);
}
