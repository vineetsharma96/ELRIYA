import { describe, expect, it } from 'vitest';
import { createBistroEncounter, DEFAULT_BISTRO_ANCHORS, SafeStorage } from '../bistroEncounter';

describe('bistroEncounter state machine', () => {
  it('initializes with cup available and correct initial prompts', () => {
    const memory = new SafeStorage();
    const encounter = createBistroEncounter(DEFAULT_BISTRO_ANCHORS, memory);

    // Far from table
    const farState = encounter.getState({ x: 0, z: 0 });
    expect(farState.cupState).toBe('available');
    expect(farState.canPickup).toBe(false);
    expect(farState.promptText).toBeNull();

    // Near table A
    const nearState = encounter.getState(DEFAULT_BISTRO_ANCHORS.tableA);
    expect(nearState.canPickup).toBe(true);
    expect(nearState.promptText).toContain('Take tea cup');
  });

  it('handles pickup, carrying prompts, and manual cancel with Q', () => {
    const memory = new SafeStorage();
    const encounter = createBistroEncounter(DEFAULT_BISTRO_ANCHORS, memory);

    // Cannot pickup from far away
    expect(encounter.pickup({ x: 0, z: 0 })).toBe(false);

    // Pickup near table A
    expect(encounter.pickup(DEFAULT_BISTRO_ANCHORS.tableA)).toBe(true);
    let state = encounter.getState({ x: 0, z: 0 });
    expect(state.cupState).toBe('carried');
    expect(state.promptText).toContain('[Q] or tap Cancel to put back');

    // Cancel restores available state
    expect(encounter.cancel()).toBe(true);
    state = encounter.getState({ x: 0, z: 0 });
    expect(state.cupState).toBe('available');
  });

  it('completes the return cycle and persists the sketchbook unlock', () => {
    const memory = new SafeStorage();
    const encounter = createBistroEncounter(DEFAULT_BISTRO_ANCHORS, memory);

    encounter.pickup(DEFAULT_BISTRO_ANCHORS.tableA);

    // Near return tray
    const stateAtTray = encounter.getState(DEFAULT_BISTRO_ANCHORS.returnTray);
    expect(stateAtTray.canReturn).toBe(true);
    expect(stateAtTray.promptText).toContain('Place on return tray');

    // Return cup
    expect(encounter.returnCup(DEFAULT_BISTRO_ANCHORS.returnTray)).toBe(true);
    const finalState = encounter.getState(DEFAULT_BISTRO_ANCHORS.returnTray);
    expect(finalState.cupState).toBe('returned');
    expect(finalState.sketchbookUnlocked).toBe(true);

    // Check persistence across new encounter instance (reload regression check)
    const reloaded = createBistroEncounter(DEFAULT_BISTRO_ANCHORS, memory);
    expect(reloaded.isUnlocked()).toBe(true);
    const reloadedTable = reloaded.getState(DEFAULT_BISTRO_ANCHORS.tableA);
    expect(reloadedTable.cupState).toBe('returned');
    expect(reloadedTable.canPickup).toBe(false);
    expect(reloadedTable.promptText).toBeNull();
    const reloadedTray = reloaded.getState(DEFAULT_BISTRO_ANCHORS.returnTray);
    expect(reloadedTray.canReturn).toBe(false);
    expect(reloadedTray.promptText).toBeNull();

    // Verify reloaded encounter rejects fresh pickup/return cycles
    expect(reloaded.pickup(DEFAULT_BISTRO_ANCHORS.tableA)).toBe(false);
    expect(reloaded.returnCup(DEFAULT_BISTRO_ANCHORS.returnTray)).toBe(false);
    expect(reloaded.interact(DEFAULT_BISTRO_ANCHORS.tableA)).toBeNull();
  });

  it('gracefully handles memory fallback when storage throws', () => {
    const faultyStorage = new SafeStorage();
    // Simulate faulty local storage
    faultyStorage.getItem = () => { throw new Error('Blocked access'); };
    faultyStorage.setItem = () => { throw new Error('Quota exceeded'); };

    // Should not throw
    expect(() => {
      const encounter = createBistroEncounter(DEFAULT_BISTRO_ANCHORS, faultyStorage);
      encounter.pickup(DEFAULT_BISTRO_ANCHORS.tableA);
      encounter.returnCup(DEFAULT_BISTRO_ANCHORS.returnTray);
    }).not.toThrow();
  });
});
