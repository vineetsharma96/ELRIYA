import type { Point2 } from '../core/types';

export interface VisibilityOptions {
  cullDistance?: number;
  doorwayPos?: Point2;
}

export class BistroVisibilityManager {
  private cullDistance: number;
  private doorwayPos: Point2;

  constructor(options: VisibilityOptions = {}) {
    this.cullDistance = options.cullDistance ?? 22.0;
    this.doorwayPos = options.doorwayPos ?? { x: -15.0, z: -6.5 };
  }

  shouldRenderInterior(cameraPos: Point2): boolean {
    const dx = cameraPos.x - this.doorwayPos.x;
    const dz = cameraPos.z - this.doorwayPos.z;
    const distSq = dx * dx + dz * dz;
    return distSq <= this.cullDistance * this.cullDistance;
  }
}
