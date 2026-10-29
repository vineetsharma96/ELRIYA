import { createSimulation, stepSimulation, EMPTY_INPUT } from './src/core/simulation.ts';
import { WORLD } from './src/core/world.ts';

const state = createSimulation();
state.player.x = 0;
state.player.z = 0;
// Move near landmarks to trigger discovery
const numFrames = 10000;

console.time("updateDiscovery Benchmark");
for (let i = 0; i < numFrames; i++) {
    // Modify player position slightly to simulate movement
    state.player.x += 0.01;
    state.player.z += 0.01;
    stepSimulation(state, { ...EMPTY_INPUT, moveX: 1, moveZ: 1 }, 1 / 60);
}
console.timeEnd("updateDiscovery Benchmark");
