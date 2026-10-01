import * as THREE from 'three';
import type { Point2 } from '../core/types';

export interface IndoorCameraOptions {
  outdoorDistance?: number;
  indoorDistance?: number;
  transitionRadius?: number;
}

export interface BistroBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const DEFAULT_BISTRO_BOUNDS: BistroBounds = {
  minX: -19.0,
  maxX: -11.0,
  minZ: -13.5,
  maxZ: -6.5,
};

export class IndoorCameraController {
  private outdoorDistance: number;
  private indoorDistance: number;
  private currentDistance: number;
  private bounds: BistroBounds;
  private doorway: Point2;

  constructor(
    doorway: Point2 = { x: -15.0, z: -6.5 },
    bounds: BistroBounds = DEFAULT_BISTRO_BOUNDS,
    options: IndoorCameraOptions = {},
  ) {
    this.doorway = doorway;
    this.bounds = bounds;
    this.outdoorDistance = options.outdoorDistance ?? 25.0;
    this.indoorDistance = options.indoorDistance ?? 2.8;
    this.currentDistance = this.outdoorDistance;
  }

  isInside(pos: Point2): boolean {
    return (
      pos.x >= this.bounds.minX &&
      pos.x <= this.bounds.maxX &&
      pos.z >= this.bounds.minZ &&
      pos.z <= this.bounds.maxZ
    );
  }

  getDoorwayProximity(pos: Point2): number {
    const dx = pos.x - this.doorway.x;
    const dz = pos.z - this.doorway.z;
    return Math.hypot(dx, dz);
  }

  update(playerPos: Point2, deltaSeconds: number): { distance: number; indoorRatio: number } {
    const inside = this.isInside(playerPos);
    const doorDist = this.getDoorwayProximity(playerPos);

    let targetRatio = 0.0;
    if (inside) {
      targetRatio = 1.0;
    } else if (doorDist < 3.0) {
      targetRatio = 1.0 - doorDist / 3.0;
    }

    const targetDistance = THREE.MathUtils.lerp(
      this.outdoorDistance,
      this.indoorDistance,
      targetRatio,
    );

    // Smooth exponential damping
    const smoothing = Math.min(1.0, deltaSeconds * 4.0);
    this.currentDistance = THREE.MathUtils.lerp(this.currentDistance, targetDistance, smoothing);

    return {
      distance: this.currentDistance,
      indoorRatio: targetRatio,
    };
  }

  getDistance(): number {
    return this.currentDistance;
  }
}
