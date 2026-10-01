import * as THREE from 'three';
import type { Point2 } from '../core/types';

export interface WakeSource {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  strength: number;
}

export class PetalWakeManager {
  private sources: Map<string, WakeSource> = new Map();
  private prevPositions: Map<string, { x: number; z: number }> = new Map();

  updateSource(id: string, currentPos: Point2, deltaSeconds: number, radius = 2.5, strength = 1.0): void {
    const prev = this.prevPositions.get(id);
    const dt = Math.max(0.001, deltaSeconds);

    let vx = 0;
    let vz = 0;
    if (prev) {
      vx = (currentPos.x - prev.x) / dt;
      vz = (currentPos.z - prev.z) / dt;
    }
    this.prevPositions.set(id, { x: currentPos.x, z: currentPos.z });

    this.sources.set(id, {
      id,
      position: new THREE.Vector3(currentPos.x, 0, currentPos.z),
      velocity: new THREE.Vector3(vx, 0, vz),
      radius,
      strength,
    });
  }

  getSource(id: string): WakeSource | undefined {
    return this.sources.get(id);
  }

  getAllSources(): WakeSource[] {
    return Array.from(this.sources.values());
  }
}
