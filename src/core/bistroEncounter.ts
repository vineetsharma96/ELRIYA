import type { Point2 } from './types';
import bistroContract from '../../public/assets/architecture/blossom_bistro_contract.json';

export type CupState = 'available' | 'carried' | 'returned';
export type BistroActionResult = { type: 'pickup' | 'returned' } | null;

export interface BistroAnchorConfig {
  doorway: Point2 & { width: number; height: number };
  tableA: Point2 & { height: number; radius: number };
  returnTray: Point2 & { height: number; radius: number };
}

const posX = bistroContract.placement.position[0];
const posZ = bistroContract.placement.position[2];

export const DEFAULT_BISTRO_ANCHORS: BistroAnchorConfig = {
  doorway: {
    x: posX,
    z: posZ,
    width: bistroContract.doorway.width,
    height: bistroContract.doorway.height,
  },
  tableA: {
    x: posX - bistroContract.anchors.tableA.position[0],
    z: posZ - bistroContract.anchors.tableA.position[2],
    height: bistroContract.anchors.tableA.position[1],
    radius: bistroContract.anchors.tableA.interactionRadius,
  },
  returnTray: {
    x: posX - bistroContract.anchors.returnTray.position[0],
    z: posZ - bistroContract.anchors.returnTray.position[2],
    height: bistroContract.anchors.returnTray.position[1],
    radius: bistroContract.anchors.returnTray.interactionRadius,
  },
};

const STORAGE_KEY = 'elyria_bistro_sketchbook_unlocked';

export class SafeStorage {
  private memoryStore: Map<string, string> = new Map();

  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Fallback on security / quota errors
    }
    return this.memoryStore.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Fallback on security / quota errors
    }
    this.memoryStore.set(key, value);
  }
}

export const bistroStorage = new SafeStorage();

export interface BistroEncounterState {
  cupState: CupState;
  sketchbookUnlocked: boolean;
  canPickup: boolean;
  canReturn: boolean;
  promptText: string | null;
}

export function createBistroEncounter(
  anchors: BistroAnchorConfig = DEFAULT_BISTRO_ANCHORS,
  storage: SafeStorage = bistroStorage,
) {
  let sketchbookUnlocked = false;
  try {
    sketchbookUnlocked = storage.getItem(STORAGE_KEY) === 'true';
  } catch {
    sketchbookUnlocked = false;
  }
  let cupState: CupState = sketchbookUnlocked ? 'returned' : 'available';

  function distance(p1: Point2, p2: Point2): number {
    const dx = p1.x - p2.x;
    const dz = p1.z - p2.z;
    return Math.hypot(dx, dz);
  }

  function update(playerPos: Point2): BistroEncounterState {
    const distTable = distance(playerPos, anchors.tableA);
    const distTray = distance(playerPos, anchors.returnTray);

    const canPickup = cupState === 'available' && distTable <= anchors.tableA.radius;
    const canReturn = cupState === 'carried' && distTray <= anchors.returnTray.radius;

    let promptText: string | null = null;
    if (canPickup) {
      promptText = 'Take tea cup [E]';
    } else if (cupState === 'carried') {
      if (canReturn) {
        promptText = 'Place on return tray [E]';
      } else {
        promptText = 'Carrying regular\'s cup (Press [Q] or tap Cancel to put back)';
      }
    }

    return {
      cupState,
      sketchbookUnlocked,
      canPickup,
      canReturn,
      promptText,
    };
  }

  function interact(playerPos: Point2): BistroActionResult {
    if (cupState === 'available' && distance(playerPos, anchors.tableA) <= anchors.tableA.radius) {
      cupState = 'carried';
      return { type: 'pickup' };
    }
    if (cupState === 'carried' && distance(playerPos, anchors.returnTray) <= anchors.returnTray.radius) {
      cupState = 'returned';
      sketchbookUnlocked = true;
      try {
        storage.setItem(STORAGE_KEY, 'true');
      } catch {
        // Safe fallback in memory
      }
      return { type: 'returned' };
    }
    return null;
  }

  function cancel(): boolean {
    if (cupState === 'carried') {
      cupState = 'available';
      return true;
    }
    return false;
  }

  function resetSession(): void {
    if (cupState === 'carried') {
      cupState = 'available';
    }
  }

  return {
    getState: (playerPos: Point2) => update(playerPos),
    interact,
    pickup: (playerPos: Point2) => interact(playerPos)?.type === 'pickup',
    returnCup: (playerPos: Point2) => interact(playerPos)?.type === 'returned',
    cancel,
    resetSession,
    isUnlocked: () => sketchbookUnlocked,
  };
}
