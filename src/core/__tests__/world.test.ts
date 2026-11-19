import { describe, expect, it } from 'vitest';
import { CANAL_WATER_SEGMENTS, ROAD_SEGMENTS, WORLD, getLandmark } from '../world';

describe('getLandmark', () => {
  it('returns the landmark when given a known valid ID', () => {
    const id = 'blossom-plaza';
    const landmark = getLandmark(id);
    expect(landmark).toBeDefined();
    expect(landmark?.id).toBe(id);
    expect(landmark?.name).toBe('Blossom Plaza');
  });

  it('returns undefined when given an unknown ID', () => {
    const id = 'non-existent-landmark-12345';
    const landmark = getLandmark(id);
    expect(landmark).toBeUndefined();
  });
});

describe('world road and canal water geometry invariants', () => {
  const CANAL_MIN_Z = -31.0;
  const CANAL_MAX_Z = -23.0;

  it('keeps non-bridge road segments strictly disjoint from the Sunpetal Canal water channel', () => {
    const nonBridgeRoads = ROAD_SEGMENTS.filter(seg => !seg.isBridge);
    expect(nonBridgeRoads.length).toBeGreaterThanOrEqual(5);

    for (const seg of nonBridgeRoads) {
      const halfZ = seg.orientation === 'horizontal' ? seg.width / 2 : seg.length / 2;
      const minZ = seg.z - halfZ;
      const maxZ = seg.z + halfZ;
      const overlapsCanalZ = maxZ > CANAL_MIN_Z && minZ < CANAL_MAX_Z;
      expect(overlapsCanalZ, `Non-bridge road "${seg.id}" overlaps canal Z [${CANAL_MIN_Z}, ${CANAL_MAX_Z}]`).toBe(false);
    }
  });

  it('keeps open canal water segments strictly disjoint from all bridge footprints', () => {
    expect(CANAL_WATER_SEGMENTS).toHaveLength(4);
    expect(WORLD.canalWaterSegments).toBe(CANAL_WATER_SEGMENTS);

    const bridgeXSpans = [
      { id: 'central-pedestrian-bridge', minX: -4.0, maxX: 4.0 },
      ...ROAD_SEGMENTS.filter(seg => seg.isBridge).map(seg => ({
        id: seg.id,
        minX: seg.x - seg.width / 2,
        maxX: seg.x + seg.width / 2,
      })),
    ];

    for (const water of CANAL_WATER_SEGMENTS) {
      const waterMinX = water.x - water.width / 2;
      const waterMaxX = water.x + water.width / 2;
      for (const bridge of bridgeXSpans) {
        const overlapsBridgeX = waterMaxX > bridge.minX + 0.01 && waterMinX < bridge.maxX - 0.01;
        expect(
          overlapsBridgeX,
          `Water segment "${water.id}" overlaps bridge "${bridge.id}"`
        ).toBe(false);
      }
    }
  });
});
