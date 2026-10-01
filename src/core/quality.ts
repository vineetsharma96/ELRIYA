export const QUALITY_TIERS = ['LITE', 'LOW', 'MEDIUM', 'HIGH', 'ULTRA'] as const;
export type QualityTier = typeof QUALITY_TIERS[number];
export type QualityMode = QualityTier | 'AUTO' | 'CUSTOM';

export interface QualitySettings {
  /** Effective DPR cap, including the device's native DPR. */
  renderScale: number;
  shadowMapSize: number;
  shadows: boolean;
  drawDistance: number;
  vegetationDensity: number;
  npcCount: number;
  petalCount: number;
}

export const QUALITY_PRESETS: Record<QualityTier, QualitySettings> = {
  LITE: { renderScale: 0.75, shadowMapSize: 0, shadows: false, drawDistance: 65, vegetationDensity: 0.35, npcCount: 2, petalCount: 100 },
  LOW: { renderScale: 1, shadowMapSize: 512, shadows: true, drawDistance: 80, vegetationDensity: 0.5, npcCount: 4, petalCount: 250 },
  MEDIUM: { renderScale: 1.25, shadowMapSize: 1024, shadows: true, drawDistance: 110, vegetationDensity: 0.7, npcCount: 6, petalCount: 500 },
  HIGH: { renderScale: 1.5, shadowMapSize: 1024, shadows: true, drawDistance: 150, vegetationDensity: 0.9, npcCount: 10, petalCount: 900 },
  ULTRA: { renderScale: 1.75, shadowMapSize: 2048, shadows: true, drawDistance: 200, vegetationDensity: 1, npcCount: 16, petalCount: 1500 },
};

export interface QualityState {
  mode: QualityMode;
  tier: QualityTier;
  custom: QualitySettings;
  averageFrameMs: number;
  sampleCount: number;
  sampleTotal: number;
  slowWindows: number;
  fastWindows: number;
  startedAt: number | null;
  lastSampleAt: number | null;
  lastChangeAt: number;
}

export function createQualityState(mode: QualityMode = 'AUTO'): QualityState {
  return {
    mode, tier: mode === 'AUTO' || mode === 'CUSTOM' ? 'HIGH' : mode,
    custom: { ...QUALITY_PRESETS.HIGH }, averageFrameMs: 0,
    sampleCount: 0, sampleTotal: 0, slowWindows: 0, fastWindows: 0,
    startedAt: null, lastSampleAt: null, lastChangeAt: -Infinity,
  };
}

export function getQualitySettings(state: QualityState): QualitySettings {
  return state.mode === 'CUSTOM' ? state.custom : QUALITY_PRESETS[state.tier];
}

function resetSamples(state: QualityState) {
  state.sampleCount = 0;
  state.sampleTotal = 0;
  state.slowWindows = 0;
  state.fastWindows = 0;
}

/** Restart measurement after visibility changes, without overriding user quality. */
export function resetQualitySampling(state: QualityState): void {
  state.startedAt = null;
  state.lastSampleAt = null;
  resetSamples(state);
}

export function setQualityMode(state: QualityState, mode: QualityMode, custom?: Partial<QualitySettings>): void {
  const previous = getQualitySettings(state);
  if (mode === 'CUSTOM') {
    const options = { ...previous, ...custom };
    const finiteClamp = (value: number, min: number, max: number, fallback: number) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
    const map = finiteClamp(options.shadowMapSize, 256, 2048, 1024);
    state.custom = {
      renderScale: finiteClamp(options.renderScale, 0.5, 2, 1),
      shadows: Boolean(options.shadows),
      shadowMapSize: options.shadows ? 2 ** Math.round(Math.log2(map)) : 0,
      drawDistance: finiteClamp(options.drawDistance, 50, 250, 110),
      vegetationDensity: finiteClamp(options.vegetationDensity, 0.2, 1, 0.7),
      npcCount: Math.round(finiteClamp(options.npcCount, 0, 16, 6)),
      petalCount: Math.round(finiteClamp(options.petalCount, 0, 2000, 500)),
    };
  }
  state.mode = mode;
  if (mode !== 'AUTO' && mode !== 'CUSTOM') state.tier = mode;
  state.startedAt = null;
  state.lastSampleAt = null;
  state.lastChangeAt = -Infinity;
  resetSamples(state);
}

/**
 * Frame interval is a scheduling measurement, not GPU timing.
 * Pass performance.now() and call only while the page is visible.
 * Warm up two seconds; two slow or four fast 120-frame windows change one tier.
 */
export function updateAdaptiveQuality(state: QualityState, frameMs: number, nowMs: number): boolean {
  if (!Number.isFinite(frameMs) || frameMs <= 0 || !Number.isFinite(nowMs)) return false;
  // A slow visible frame is real workload. A timestamp gap inconsistent with its
  // measured interval indicates a skipped/hidden period and restarts warm-up.
  const discontinuity = state.lastSampleAt !== null && (Math.abs(nowMs - state.lastSampleAt - frameMs) > 500 || nowMs < state.lastSampleAt);
  state.lastSampleAt = nowMs;
  if (discontinuity) {
    state.startedAt = nowMs;
    resetSamples(state);
    return false;
  }
  if (state.startedAt === null) state.startedAt = nowMs;
  if (nowMs - state.startedAt < 2000) return false;
  state.sampleCount++;
  state.sampleTotal += frameMs;
  if (state.sampleCount < 120) return false;
  state.averageFrameMs = state.sampleTotal / state.sampleCount;
  state.sampleCount = 0;
  state.sampleTotal = 0;
  if (state.mode !== 'AUTO') return false;
  if (state.averageFrameMs > 22) {
    state.slowWindows++;
    state.fastWindows = 0;
  } else if (state.averageFrameMs < 17.5) {
    state.fastWindows++;
    state.slowWindows = 0;
  } else {
    state.slowWindows = 0;
    state.fastWindows = 0;
  }
  if (nowMs - state.lastChangeAt < 8000) return false;
  const tierIndex = QUALITY_TIERS.indexOf(state.tier);
  let next = tierIndex;
  if (state.slowWindows >= 2) next = Math.max(0, tierIndex - 1);
  else if (state.fastWindows >= 4) next = Math.min(QUALITY_TIERS.length - 1, tierIndex + 1);
  if (next === tierIndex) return false;
  state.tier = QUALITY_TIERS[next];
  state.lastChangeAt = nowMs;
  resetSamples(state);
  return true;
}
