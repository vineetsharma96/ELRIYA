import { describe, it, expect, beforeEach } from 'vitest';
import { IndoorCameraController, DEFAULT_BISTRO_BOUNDS } from '../indoorCamera';

describe('IndoorCameraController', () => {
  let controller: IndoorCameraController;

  beforeEach(() => {
    controller = new IndoorCameraController();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(controller.getDistance()).toBe(25.0); // Default outdoorDistance
    });

    it('should initialize with custom values', () => {
      const customController = new IndoorCameraController(
        { x: 0, z: 0 },
        { minX: -1, maxX: 1, minZ: -1, maxZ: 1 },
        { outdoorDistance: 30.0, indoorDistance: 5.0 }
      );
      expect(customController.getDistance()).toBe(30.0);
    });
  });

  describe('isInside', () => {
    it('should return true for points inside the bounds', () => {
      // Center of DEFAULT_BISTRO_BOUNDS
      // minX: -19.0, maxX: -11.0, minZ: -13.5, maxZ: -6.5
      expect(controller.isInside({ x: -15, z: -10 })).toBe(true);
    });

    it('should return true for points on the boundaries', () => {
      expect(controller.isInside({ x: -19.0, z: -10 })).toBe(true); // Left edge
      expect(controller.isInside({ x: -11.0, z: -10 })).toBe(true); // Right edge
      expect(controller.isInside({ x: -15.0, z: -13.5 })).toBe(true); // Top edge
      expect(controller.isInside({ x: -15.0, z: -6.5 })).toBe(true); // Bottom edge
    });

    it('should return false for points outside the bounds', () => {
      expect(controller.isInside({ x: -20.0, z: -10 })).toBe(false); // Outside left
      expect(controller.isInside({ x: -10.0, z: -10 })).toBe(false); // Outside right
      expect(controller.isInside({ x: -15.0, z: -15.0 })).toBe(false); // Outside top
      expect(controller.isInside({ x: -15.0, z: -5.0 })).toBe(false); // Outside bottom
    });
  });

  describe('getDoorwayProximity', () => {
    it('should calculate distance correctly', () => {
      // Default doorway is { x: -15.0, z: -6.5 }
      expect(controller.getDoorwayProximity({ x: -15.0, z: -6.5 })).toBe(0);
      expect(controller.getDoorwayProximity({ x: -12.0, z: -2.5 })).toBe(5); // 3-4-5 triangle
    });
  });

  describe('update', () => {
    it('should return indoor distance when inside the bounds', () => {
      // Delta time doesn't matter much if we're deeply inside because it'll eventually reach indoorDistance
      // But we will test with a deltaSeconds = 1 to see its lerp effect.
      // With smoothing = Math.min(1.0, 1.0 * 4.0) = 1.0, the lerp is instant

      const { distance, indoorRatio } = controller.update({ x: -15, z: -10 }, 1.0);
      expect(indoorRatio).toBe(1.0);
      expect(distance).toBe(2.8); // indoorDistance
    });

    it('should return outdoor distance when far away', () => {
      // Outside and far from doorway ({ x: -15.0, z: -6.5 })
      const { distance, indoorRatio } = controller.update({ x: 0, z: 0 }, 1.0);
      expect(indoorRatio).toBe(0.0);
      expect(distance).toBe(25.0); // outdoorDistance
    });

    it('should return a mixed ratio near doorway', () => {
      // Near doorway, e.g., 1.5 units away from doorway ({ x: -15.0, z: -6.5 })
      // doorway x=-15.0, z=-6.5
      // 1.5 units away: x=-15.0, z=-5.0 (outside bounds)
      const { distance, indoorRatio } = controller.update({ x: -15.0, z: -5.0 }, 1.0);

      // Proximity = 1.5
      // targetRatio = 1.0 - (1.5 / 3.0) = 0.5
      // targetDistance = lerp(25.0, 2.8, 0.5) = 13.9
      expect(indoorRatio).toBe(0.5);
      expect(distance).toBeCloseTo(13.9, 1);
    });

    it('should smoothly interpolate distance over multiple frames', () => {
      // Start outside, current = 25.0
      expect(controller.getDistance()).toBe(25.0);

      // Instant transition inside, target = 2.8
      // Frame 1: delta = 0.1
      // smoothing = min(1.0, 0.1 * 4) = 0.4
      // newDistance = lerp(25.0, 2.8, 0.4) = 25.0 + 0.4 * (2.8 - 25.0) = 25.0 + 0.4 * (-22.2) = 25.0 - 8.88 = 16.12
      const result1 = controller.update({ x: -15, z: -10 }, 0.1);
      expect(result1.indoorRatio).toBe(1.0);
      expect(result1.distance).toBeCloseTo(16.12, 2);

      // Frame 2: delta = 0.1
      // smoothing = 0.4
      // newDistance = lerp(16.12, 2.8, 0.4) = 16.12 + 0.4 * (-13.32) = 16.12 - 5.328 = 10.792
      const result2 = controller.update({ x: -15, z: -10 }, 0.1);
      expect(result2.indoorRatio).toBe(1.0);
      expect(result2.distance).toBeCloseTo(10.792, 2);
    });
  });
});
