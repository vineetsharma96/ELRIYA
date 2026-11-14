/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createInput } from '../input';
import type { InputController } from '../input';

describe('input controller', () => {
  let input: InputController;

  beforeEach(() => {
    input = createInput(window);
  });

  afterEach(() => {
    input.dispose();
  });

  const pressKey = (code: string) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
  };

  const releaseKey = (code: string) => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  };

  it('maps WASD keys to movement correctly', () => {
    pressKey('KeyW');
    expect(input.sample(0).moveZ).toBe(1);
    pressKey('KeyA');
    expect(input.sample(0).moveX).toBe(-1 / Math.SQRT2);
    expect(input.sample(0).moveZ).toBe(1 / Math.SQRT2);

    releaseKey('KeyW');
    releaseKey('KeyA');
    expect(input.sample(0).moveX).toBe(0);
    expect(input.sample(0).moveZ).toBe(0);

    pressKey('KeyS');
    expect(input.sample(0).moveZ).toBe(-1);
    pressKey('KeyD');
    expect(input.sample(0).moveX).toBe(1 / Math.SQRT2);
    expect(input.sample(0).moveZ).toBe(-1 / Math.SQRT2);
  });

  it('maps Arrow keys to movement correctly', () => {
    pressKey('ArrowUp');
    expect(input.sample(0).moveZ).toBe(1);
    pressKey('ArrowLeft');
    expect(input.sample(0).moveX).toBe(-1 / Math.SQRT2);
    expect(input.sample(0).moveZ).toBe(1 / Math.SQRT2);

    releaseKey('ArrowUp');
    releaseKey('ArrowLeft');
    expect(input.sample(0).moveX).toBe(0);
    expect(input.sample(0).moveZ).toBe(0);

    pressKey('ArrowDown');
    expect(input.sample(0).moveZ).toBe(-1);
    pressKey('ArrowRight');
    expect(input.sample(0).moveX).toBe(1 / Math.SQRT2);
    expect(input.sample(0).moveZ).toBe(-1 / Math.SQRT2);
  });

  it('handles sprint and jump modifiers', () => {
    expect(input.sample(0).sprint).toBe(false);
    expect(input.sample(0).jump).toBe(false);

    pressKey('ShiftLeft');
    expect(input.sample(0).sprint).toBe(true);
    releaseKey('ShiftLeft');

    pressKey('ShiftRight');
    expect(input.sample(0).sprint).toBe(true);
    releaseKey('ShiftRight');

    pressKey('Space');
    expect(input.sample(0).jump).toBe(true);
    releaseKey('Space');
  });

  it('correctly tracks and consumes actions', () => {
    expect(input.consumeAction('interact')).toBe(false);

    pressKey('KeyE');
    expect(input.consumeAction('interact')).toBe(true);
    expect(input.consumeAction('interact')).toBe(false); // already consumed

    pressKey('KeyM');
    expect(input.consumeAction('map')).toBe(true);

    pressKey('KeyC');
    expect(input.consumeAction('camera')).toBe(true);

    pressKey('Escape');
    expect(input.consumeAction('menu')).toBe(true);

    pressKey('F3');
    expect(input.consumeAction('debug')).toBe(true);
  });

  it('ignores input when target is an editable element', () => {
    const inputElement = document.createElement('input');
    document.body.appendChild(inputElement);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); // Default target is window
    expect(input.sample(0).moveZ).toBe(1);
    releaseKey('KeyW');

    inputElement.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
    expect(input.sample(0).moveZ).toBe(0); // Input element should absorb it

    document.body.removeChild(inputElement);
  });

  it('ignores input when modifier keys are active', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', ctrlKey: true }));
    expect(input.sample(0).moveZ).toBe(0);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', metaKey: true }));
    expect(input.sample(0).moveZ).toBe(0);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', altKey: true }));
    expect(input.sample(0).moveZ).toBe(0);
  });

  it('ignores Spacebar when focused on a button or link', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);

    button.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    expect(input.sample(0).jump).toBe(false);

    document.body.removeChild(button);

    const link = document.createElement('a');
    document.body.appendChild(link);

    link.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    expect(input.sample(0).jump).toBe(false);

    document.body.removeChild(link);
  });

  it('clears state on window blur', () => {
    pressKey('KeyW');
    pressKey('KeyE');
    expect(input.sample(0).moveZ).toBe(1);

    window.dispatchEvent(new Event('blur'));

    expect(input.sample(0).moveZ).toBe(0);
    expect(input.consumeAction('interact')).toBe(false);
  });

  it('clears state on visibilitychange to hidden', () => {
    pressKey('KeyW');
    pressKey('KeyE');
    expect(input.sample(0).moveZ).toBe(1);

    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(input.sample(0).moveZ).toBe(0);
    expect(input.consumeAction('interact')).toBe(false);

    // reset mock
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });

  it('supports virtual input', () => {
    input.setVirtual({ moveX: 1, moveZ: -1, sprint: true, jump: true });

    const sample = input.sample(0);
    expect(sample.moveX).toBe(1 / Math.SQRT2);
    expect(sample.moveZ).toBe(-1 / Math.SQRT2);
    expect(sample.sprint).toBe(true);
    expect(sample.jump).toBe(true);
  });

  it('handles setEnabled', () => {
    pressKey('KeyW');
    expect(input.sample(0).moveZ).toBe(1);

    input.setEnabled(false);
    expect(input.sample(0).moveZ).toBe(0);

    pressKey('KeyS');
    expect(input.sample(0).moveZ).toBe(0); // input is disabled

    input.setEnabled(true);
    pressKey('KeyD');
    expect(input.sample(0).moveX).toBe(1); // input re-enabled
  });

  it('clears event listeners on dispose', () => {
    input.dispose();
    pressKey('KeyW');
    expect(input.sample(0).moveZ).toBe(0); // Listener removed, doesn't pick up key
  });
});
