import { describe, expect, it } from 'vitest';
import { createQualityState, getQualitySettings, QUALITY_PRESETS, setQualityMode, updateAdaptiveQuality } from '../quality';
import type { QualityState } from '../quality';

function sampler(state: QualityState) {
  let now = 0;
  return (frames: number, milliseconds: number) => {
    let changes = 0;
    for (let i = 0; i < frames; i++) {
      now += milliseconds;
      if (updateAdaptiveQuality(state, milliseconds, now)) changes++;
    }
    return changes;
  };
}

describe('measured quality policy', () => {
  it('requires warm-up and sustained slow windows before reducing one tier', () => {
    const state = createQualityState();
    const sample = sampler(state);
    expect(sample(180, 30)).toBe(0);
    expect(state.tier).toBe('HIGH');
    expect(sample(130, 30)).toBe(1);
    expect(state.tier).toBe('MEDIUM');
    expect(getQualitySettings(state)).toEqual(QUALITY_PRESETS.MEDIUM);
    expect(sample(120, 30)).toBe(0);
    expect(state.tier).toBe('MEDIUM');
  });

  it('recovers with stable 60Hz frame intervals, using a longer upgrade threshold', () => {
    const state = createQualityState('LOW');
    setQualityMode(state, 'AUTO');
    const sample = sampler(state);
    expect(sample(550, 16.67)).toBe(0);
    expect(state.tier).toBe('LOW');
    expect(sample(60, 16.67)).toBe(1);
    expect(state.tier).toBe('MEDIUM');
  });

  it('does not oscillate in the neutral performance range', () => {
    const state = createQualityState();
    const sample = sampler(state);
    expect(sample(2000, 20)).toBe(0);
    expect(state.tier).toBe('HIGH');
  });

  it('keeps manual selections stable regardless of measured performance', () => {
    const state = createQualityState('ULTRA');
    const sample = sampler(state);
    expect(sample(2400, 40)).toBe(0);
    expect(state.tier).toBe('ULTRA');
    expect(state.averageFrameMs).toBe(40);
  });

  it('discards hidden-tab or loading gaps and invalid samples', () => {
    const state = createQualityState();
    const sample = sampler(state);
    sample(230, 30);
    expect(state.slowWindows).toBe(1);
    expect(updateAdaptiveQuality(state, 16, 9900)).toBe(false);
    expect(state.slowWindows).toBe(0);
    expect(state.sampleCount).toBe(0);
    const snapshot = structuredClone(state);
    [NaN, -1, 0, Infinity].forEach(value => updateAdaptiveQuality(state, value, 9901));
    expect(state).toEqual(snapshot);
  });

  it('counts sustained slow visible frames instead of misclassifying them as hidden gaps', () => {
    const state = createQualityState();
    const sample = sampler(state);
    expect(sample(244, 500)).toBe(1);
    expect(state.tier).toBe('MEDIUM');
    expect(state.averageFrameMs).toBe(500);
  });

  it('clamps custom options to supported runtime budgets', () => {
    const state = createQualityState('LOW');
    setQualityMode(state, 'CUSTOM', { renderScale: 99, shadowMapSize: 600, npcCount: 200, vegetationDensity: -1, petalCount: NaN });
    expect(state.mode).toBe('CUSTOM');
    expect(getQualitySettings(state)).toMatchObject({ renderScale: 2, shadowMapSize: 512, npcCount: 16, vegetationDensity: 0.2, petalCount: 500 });
  });
});
