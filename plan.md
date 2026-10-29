1. **Change `SimulationState.discovered` type from `string[]` to `Set<string>`.**
   - Update `src/core/types.ts` line 128 to `discovered: Set<string>;`
2. **Update initialization.**
   - In `src/core/simulation.ts` line 248, change `discovered: []` to `discovered: new Set()`
   - In `src/scene/types.ts` line 58, change `discovered: []` to `discovered: new Set()`
3. **Update `updateDiscovery` array check.**
   - In `src/core/simulation.ts` line 301, change `if (!state.discovered.includes(landmark.id)) state.discovered.push(landmark.id);` to `state.discovered.add(landmark.id);`
4. **Update Array methods over `discovered`.**
   - In `src/core/__tests__/simulation.test.ts` line 112, change `filter` to `Array.from(state.discovered).filter` or `has` or keep it checking size.
   - In `src/core/__tests__/simulation.test.ts` line 113, change `forEach` loop.
   - In `src/App.tsx` line 135 and 154, change `snapshot.discovered.length` to `snapshot.discovered.size`.
   - In `src/ui/WorldMap.tsx` line 120, change `snapshot.discovered.includes(place.id)` to `snapshot.discovered.has(place.id)`.
   - In `src/scene/WorldCanvas.tsx` line 322, change `discovered: [...simulation.discovered]` to `discovered: new Set(simulation.discovered)` or just pass set depending on how `WorldSnapshot` handles it. Wait, `WorldSnapshot.discovered` in `src/scene/types.ts` is `string[]`. It's better to keep `WorldSnapshot.discovered` as `string[]` or update it to `Set<string>` too. Let's update `WorldSnapshot.discovered` to `Set<string>` in `src/scene/types.ts` to avoid conversion overhead in React render cycle.
   - Update `WorldSnapshot` definition in `src/scene/types.ts` line 17 to `discovered: Set<string>`.
5. **Run test suite and benchmark script.**
   - Ensure tests pass with `npm run test` and check benchmark output to measure improvement.
6. **Pre-commit checks.**
   - Run `pre_commit_instructions` tool.
7. **Submit.**
   - Commit and submit PR.
