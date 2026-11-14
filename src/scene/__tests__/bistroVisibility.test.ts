import { describe, expect, it } from 'vitest';
import { BistroVisibilityManager } from '../bistroVisibility';

describe('BistroVisibilityManager', () => {
  describe('default configuration', () => {
    // Default cullDistance is 22.0
    // Default doorwayPos is { x: -15.0, z: -6.5 }

    it('returns true when exactly at the doorway', () => {
      const manager = new BistroVisibilityManager();
      expect(manager.shouldRenderInterior({ x: -15.0, z: -6.5 })).toBe(true);
    });

    it('returns true when well within the cull distance', () => {
      const manager = new BistroVisibilityManager();
      // Distance is 10 units
      expect(manager.shouldRenderInterior({ x: -5.0, z: -6.5 })).toBe(true);
    });

    it('returns true when on the boundary of cull distance', () => {
      const manager = new BistroVisibilityManager();
      // Distance is exactly 22.0
      expect(manager.shouldRenderInterior({ x: 7.0, z: -6.5 })).toBe(true);
    });

    it('returns false when just outside the cull distance', () => {
      const manager = new BistroVisibilityManager();
      // Distance is 22.1
      expect(manager.shouldRenderInterior({ x: 7.1, z: -6.5 })).toBe(false);
    });

    it('returns false when far outside the cull distance', () => {
      const manager = new BistroVisibilityManager();
      expect(manager.shouldRenderInterior({ x: 50.0, z: 50.0 })).toBe(false);
    });
  });

  describe('custom configuration', () => {
    it('uses custom doorway position and cull distance', () => {
      const manager = new BistroVisibilityManager({
        doorwayPos: { x: 0, z: 0 },
        cullDistance: 10.0
      });

      // Exactly at the doorway
      expect(manager.shouldRenderInterior({ x: 0, z: 0 })).toBe(true);

      // On boundary (distance = 10)
      expect(manager.shouldRenderInterior({ x: 10, z: 0 })).toBe(true);
      expect(manager.shouldRenderInterior({ x: 0, z: 10 })).toBe(true);
      expect(manager.shouldRenderInterior({ x: 6, z: 8 })).toBe(true); // 3-4-5 right triangle scaled by 2 (6^2 + 8^2 = 100)

      // Outside boundary
      expect(manager.shouldRenderInterior({ x: 10.1, z: 0 })).toBe(false);
      expect(manager.shouldRenderInterior({ x: 10, z: 10 })).toBe(false); // Distance is sqrt(200) > 10
    });
  });
});
