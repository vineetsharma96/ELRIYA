import { describe, expect, it } from 'vitest';
import { createSimulation, EMPTY_INPUT, followLoop, PLAYER_RADIUS, SPRINT_SPEED, stepSimulation, WALK_SPEED } from '../simulation';
import type { SimulationInput, SimulationState } from '../types';
import { SEED, seededRandom, WORLD } from '../world';
import { buildDetailedTreeSpec } from '../../scene/Assets';
import { generateTreeCanopySpawns } from '../../scene/Petals';

function advance(state: SimulationState, seconds: number, input: Partial<SimulationInput> = {}) {
  for (let i = 0; i < Math.round(seconds * 60); i++) stepSimulation(state, { ...EMPTY_INPUT, ...input }, 1 / 60);
}

describe('player controller', () => {
  it('moves relative to camera yaw with equal diagonal and straight speed', () => {
    const straight = createSimulation();
    const diagonal = createSimulation();
    const rotated = createSimulation();
    advance(straight, 1, { moveZ: 1 });
    advance(diagonal, 1, { moveZ: 1, moveX: 1 });
    advance(rotated, 1, { moveZ: 1, yaw: Math.PI / 2 });
    const distance = (state: SimulationState) => Math.hypot(state.player.x - WORLD.spawn.x, state.player.z - WORLD.spawn.z);
    expect(distance(straight)).toBeCloseTo(distance(diagonal), 8);
    expect(distance(straight)).toBeCloseTo(distance(rotated), 8);
    expect(straight.player.z).toBeLessThan(WORLD.spawn.z);
    expect(rotated.player.x).toBeLessThan(WORLD.spawn.x);
    expect(rotated.player.z).toBeCloseTo(WORLD.spawn.z, 8);
    expect(straight.player.speed).toBeCloseTo(WALK_SPEED, 3);
  });

  it('sprints, clamps a long frame and ignores invalid deltas', () => {
    const state = createSimulation();
    advance(state, 1, { moveX: 1, sprint: true });
    expect(state.player.speed).toBeCloseTo(SPRINT_SPEED, 3);
    const before = { ...state.player };
    stepSimulation(state, { ...EMPTY_INPUT, moveX: 1, sprint: true }, 90);
    expect(state.player.x - before.x).toBeLessThanOrEqual(SPRINT_SPEED * 0.1 + 0.0001);
    const snapshot = structuredClone(state);
    [NaN, Infinity, -1, 0].forEach(dt => stepSimulation(state, EMPTY_INPUT, dt));
    expect(state).toEqual(snapshot);
  });

  it('blocks a building while preserving movement along its wall', () => {
    const state = createSimulation();
    state.player.x = 11;
    state.player.z = -14;
    advance(state, 0.5, { moveX: 1, moveZ: 1 });
    expect(state.player.x).toBeLessThanOrEqual(12 - PLAYER_RADIUS + 0.0001);
    expect(state.player.z).toBeLessThan(-15);
  });

  it('cannot tunnel through a building wall even after repeated long frames, but permits doorway entrance', () => {
    // Wall collision at front-left wall (X = -13)
    const wallState = createSimulation();
    wallState.player.x = -13;
    wallState.player.z = 0;
    for (let i = 0; i < 100; i++) stepSimulation(wallState, { ...EMPTY_INPUT, moveZ: 1, sprint: true }, 10);
    expect(wallState.player.z).toBeCloseTo(-6.5 + PLAYER_RADIUS, 5);

    // Doorway opening at X = -15 allows walking into the interior
    const doorState = createSimulation();
    doorState.player.x = -15;
    doorState.player.z = 0;
    advance(doorState, 2, { moveZ: 1 });
    expect(doorState.player.z).toBeLessThan(-6.7);
  });

  it('permits the bridge but blocks water and world edges', () => {
    const bank = createSimulation();
    const bridge = createSimulation();
    bank.player.x = -5;
    bank.player.z = bridge.player.z = -21;
    advance(bank, 3, { moveZ: 1, sprint: true });
    advance(bridge, 3, { moveZ: 1, sprint: true });
    expect(bank.player.z).toBeCloseTo(-23 + PLAYER_RADIUS, 5);
    expect(bridge.player.z).toBeGreaterThanOrEqual(WORLD.bounds.minZ + PLAYER_RADIUS);
    expect(bridge.player.z).toBeLessThan(-33);
    advance(bridge, 3, { moveZ: 1, sprint: true });
    expect(bridge.player.z).toBeCloseTo(WORLD.bounds.minZ + PLAYER_RADIUS, 5);
  });

  it('jumps once while held and lands before another press', () => {
    const state = createSimulation();
    advance(state, 0.2, { jump: true });
    expect(state.player.y).toBeGreaterThan(0.7);
    expect(state.player.grounded).toBe(false);
    advance(state, 3, { jump: true });
    expect(state.player.y).toBe(0);
    expect(state.player.grounded).toBe(true);
    advance(state, 1 / 60);
    advance(state, 1 / 60, { jump: true });
    expect(state.player.y).toBeGreaterThan(0);
  });
});

describe('world simulation', () => {
  it('pauses every simulated system', () => {
    const state = createSimulation();
    state.paused = true;
    const snapshot = structuredClone(state);
    advance(state, 2, { moveZ: 1, jump: true });
    expect(state).toEqual(snapshot);
  });

  it('wraps the world clock and discovers real world IDs only once', () => {
    const state = createSimulation();
    state.time = 23.9999;
    state.player.x = 0;
    state.player.z = 1;
    advance(state, 1);
    expect(state.time).toBeGreaterThan(0);
    expect(state.time).toBeLessThan(1);
    expect(state.nearLandmark).toBe('blossom-plaza');
    expect(Array.from(state.discovered).filter(id => id === 'blossom-plaza')).toHaveLength(1);
    Array.from(state.discovered).forEach(id => expect(WORLD.landmarks.some(landmark => landmark.id === id)).toBe(true));
  });

  it('replays deterministically, including citizens and shuttle', () => {
    const first = createSimulation();
    const second = createSimulation();
    advance(first, 3, { moveX: -0.3, moveZ: 0.8 });
    advance(second, 3, { moveX: -0.3, moveZ: 0.8 });
    expect(first).toEqual(second);
    expect(first.npcs[0]).not.toEqual(createSimulation().npcs[0]);
    expect(first.shuttle).not.toEqual(createSimulation().shuttle);
    const a = seededRandom(SEED);
    const b = seededRandom(SEED);
    expect(Array.from({ length: 30 }, a)).toEqual(Array.from({ length: 30 }, b));
  });

  it('provides a remapped 2-lane road network and high-density trees, flowers, buildings, and cars', () => {
    const state = createSimulation();
    expect(WORLD.roadSegments.length).toBeGreaterThanOrEqual(7);
    expect(WORLD.roadSegments.every(seg => seg.lanes === 2)).toBe(true);
    expect(WORLD.buildings.length).toBeGreaterThanOrEqual(20);
    expect(WORLD.trees.length).toBeGreaterThanOrEqual(90);
    expect(WORLD.flowers.length).toBeGreaterThanOrEqual(500);
    expect(state.vehicles.length).toBeGreaterThanOrEqual(20);
    expect(WORLD.blendkitCatalog.length).toBeGreaterThanOrEqual(8);

    const initialPositions = state.vehicles.map(v => ({ x: v.x, z: v.z }));
    advance(state, 2);
    state.vehicles.forEach((v, idx) => {
      expect(Math.hypot(v.x - initialPositions[idx].x, v.z - initialPositions[idx].z)).toBeGreaterThan(1);
    });
  });

  it('walks autonomous pedestrian NPC agents along city sidewalks using followLoop pathfinding', () => {
    const state = createSimulation();
    expect(WORLD.sidewalkRoutes.length).toBeGreaterThanOrEqual(8);
    expect(state.npcs.length).toBe(36);

    const usedRoutes = new Set(state.npcs.map(npc => npc.routeId));
    expect(usedRoutes.size).toBe(WORLD.sidewalkRoutes.length);

    const initialNpcs = state.npcs.map(npc => ({ x: npc.x, z: npc.z }));
    advance(state, 3);

    state.npcs.forEach((npc, index) => {
      const moved = Math.hypot(npc.x - initialNpcs[index].x, npc.z - initialNpcs[index].z);
      expect(moved).toBeGreaterThan(1.5);
      // Verify no pedestrian walks inside a solid building footprint
      for (const building of WORLD.buildings) {
        const insideBuilding =
          Math.abs(npc.x - building.x) < building.halfX - 0.1 &&
          Math.abs(npc.z - building.z) < building.halfZ - 0.1;
        expect(insideBuilding).toBe(false);
      }
    });

    // Verify bidirectional & corner-blended followLoop pathfinding
    const route = WORLD.sidewalkRoutes[0].waypoints;
    const forward = followLoop(route, 5, false, 1.1);
    const backward = followLoop(route, 5, true, 1.1);
    expect(Math.hypot(forward.x - backward.x, forward.z - backward.z)).toBeGreaterThan(1);
  });

  it('periodically transitions weather between sunny, overcast, and light_rain conditions', () => {
    const state = createSimulation();
    expect(state.weather.condition).toBe('sunny');
    expect(state.weather.cloudCover).toBe(0);
    expect(state.weather.rainIntensity).toBe(0);

    // Advance into overcast phase (~28s)
    advance(state, 28);
    expect(state.weather.condition).toBe('overcast');
    expect(state.weather.cloudCover).toBeGreaterThan(0.5);
    expect(state.weather.rainIntensity).toBe(0);

    // Advance into light rain phase (~52s total)
    advance(state, 24);
    expect(state.weather.condition).toBe('light_rain');
    expect(state.weather.cloudCover).toBeGreaterThan(0.9);
    expect(state.weather.rainIntensity).toBeGreaterThan(0.9);

    // Advance back to overcast clearing (~72s total) and sunny (~92s total)
    advance(state, 20);
    expect(state.weather.condition).toBe('overcast');
    advance(state, 20);
    expect(state.weather.condition).toBe('sunny');
    expect(state.weather.rainIntensity).toBe(0);
  });

  it('builds multi-layered botanical tree detail and spawns falling leaves and petals from tree canopies', () => {
    const treeParts = buildDetailedTreeSpec();
    expect(treeParts.length).toBeGreaterThanOrEqual(80);
    const partKinds = new Set(treeParts.map(p => p.kind));
    expect(partKinds.has('root_buttress')).toBe(true);
    expect(partKinds.has('branch_limb')).toBe(true);
    expect(partKinds.has('blossom_puff')).toBe(true);
    expect(partKinds.has('weeping_bough')).toBe(true);
    expect(partKinds.has('leaf_sprig')).toBe(true);
    expect(partKinds.has('fallen_petal_mound')).toBe(true);

    const spawns = generateTreeCanopySpawns(600);
    expect(spawns).toHaveLength(600);
    const leafKinds = new Set(spawns.map(s => s.kind));
    expect(leafKinds.has('cherry_leaf')).toBe(true);
    expect(leafKinds.has('sakura_petal')).toBe(true);
    expect(leafKinds.has('blush_petal')).toBe(true);

    spawns.forEach(spawn => {
      const parentTree = WORLD.trees[spawn.treeIndex];
      expect(parentTree).toBeDefined();
      const radialDistance = Math.hypot(spawn.spawnX - parentTree.x, spawn.spawnZ - parentTree.z);
      expect(radialDistance).toBeLessThanOrEqual(2.35 * parentTree.scale);
      expect(spawn.spawnY).toBeGreaterThanOrEqual(2.6 * parentTree.scale);
      expect(spawn.spawnY).toBeLessThanOrEqual(5.0 * parentTree.scale);
    });
  });
});




