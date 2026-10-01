import { describe, expect, it } from 'vitest';
import { createSimulation, EMPTY_INPUT, PLAYER_RADIUS, SPRINT_SPEED, stepSimulation, WALK_SPEED } from '../simulation';
import type { SimulationInput, SimulationState } from '../types';
import { SEED, seededRandom, WORLD } from '../world';

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
    state.player.x = -10;
    state.player.z = -10;
    advance(state, 0.5, { moveX: -1, moveZ: 1 });
    expect(state.player.x).toBeGreaterThanOrEqual(-10.5 + PLAYER_RADIUS - 0.0001);
    expect(state.player.z).toBeLessThan(-11);
  });

  it('cannot tunnel through a building even after repeated long frames', () => {
    const state = createSimulation();
    state.player.x = -15;
    state.player.z = 0;
    for (let i = 0; i < 100; i++) stepSimulation(state, { ...EMPTY_INPUT, moveZ: 1, sprint: true }, 10);
    expect(state.player.z).toBeCloseTo(-6.5 + PLAYER_RADIUS, 5);
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
    expect(state.discovered.filter(id => id === 'blossom-plaza')).toHaveLength(1);
    state.discovered.forEach(id => expect(WORLD.landmarks.some(landmark => landmark.id === id)).toBe(true));
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
});
