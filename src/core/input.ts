import type { SimulationInput } from './types';

export type InputAction = 'interact' | 'map' | 'camera' | 'menu' | 'debug';
export interface VirtualInput { moveX: number; moveZ: number; sprint: boolean; jump: boolean }

const actions: Record<string, InputAction> = { KeyE: 'interact', KeyM: 'map', KeyC: 'camera', Escape: 'menu', F3: 'debug' };
const movementCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space']);

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
}

/** Keyboard and touch input are sampled by RAF. No global singleton or React state. */
export function createInput(target: Window = window) {
  const keys = new Set<string>();
  const pending = new Set<InputAction>();
  let enabled = true;
  let virtual: VirtualInput = { moveX: 0, moveZ: 0, sprint: false, jump: false };
  const clear = () => {
    keys.clear();
    pending.clear();
    virtual = { moveX: 0, moveZ: 0, sprint: false, jump: false };
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (isEditable(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    // Native UI activation remains accessible while buttons/links have focus.
    if (event.code === 'Space' && event.target instanceof Element && event.target.closest('button, a, [role="button"]')) return;
    const action = actions[event.code];
    if (action) {
      if (!event.repeat) pending.add(action);
      event.preventDefault();
    }
    if (enabled && movementCodes.has(event.code)) {
      keys.add(event.code);
      event.preventDefault();
    }
  };
  const onKeyUp = (event: KeyboardEvent) => { keys.delete(event.code); };
  const onVisibility = () => { if (target.document.hidden) clear(); };
  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', clear);
  target.document.addEventListener('visibilitychange', onVisibility);

  return {
    sample(yaw: number): SimulationInput {
      if (!enabled) return { moveX: 0, moveZ: 0, sprint: false, jump: false, yaw };
      const moveX = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + virtual.moveX;
      const moveZ = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) + virtual.moveZ;
      const length = Math.max(1, Math.hypot(moveX, moveZ));
      return { moveX: moveX / length, moveZ: moveZ / length, sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') || virtual.sprint, jump: keys.has('Space') || virtual.jump, yaw };
    },
    setEnabled(value: boolean) { enabled = value; if (!value) clear(); },
    setVirtual(value: Partial<VirtualInput>) { virtual = { ...virtual, ...value }; },
    consumeAction(action: InputAction): boolean { const value = pending.has(action); pending.delete(action); return value; },
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', clear);
      target.document.removeEventListener('visibilitychange', onVisibility);
      clear();
    },
  };
}

export type InputController = ReturnType<typeof createInput>;
