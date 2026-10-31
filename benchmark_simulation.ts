import { createSimulation, stepSimulation, EMPTY_INPUT } from './src/core/simulation.ts';

const state = createSimulation();
state.player.x = 0;
state.player.z = 0;
const numFrames = 100000;

const start = performance.now();
for (let i = 0; i < numFrames; i++) {
    state.player.x += 0.01;
    state.player.z += 0.01;
    stepSimulation(state, { ...EMPTY_INPUT, moveX: 1, moveZ: 1 }, 1 / 60);
}
const end = performance.now();
console.log(`constrain/stepSimulation Benchmark: ${(end - start).toFixed(2)} ms`);
