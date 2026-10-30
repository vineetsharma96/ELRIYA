import { describe, it, expect, beforeEach } from 'vitest';
import { PetalWakeManager } from '../petalWakes';
import * as THREE from 'three';

describe('PetalWakeManager', () => {
  let manager: PetalWakeManager;

  beforeEach(() => {
    manager = new PetalWakeManager();
  });

  describe('updateSource', () => {
    it('creates and registers a new wake source with 0 initial velocity', () => {
      manager.updateSource('player1', { x: 10, z: 20 }, 0.016);

      const source = manager.getSource('player1');
      expect(source).toBeDefined();
      expect(source?.id).toBe('player1');
      expect(source?.position.equals(new THREE.Vector3(10, 0, 20))).toBe(true);
      expect(source?.velocity.equals(new THREE.Vector3(0, 0, 0))).toBe(true);
      expect(source?.radius).toBe(2.5); // default
      expect(source?.strength).toBe(1.0); // default
    });

    it('calculates velocity correctly based on position delta and deltaSeconds', () => {
      manager.updateSource('player1', { x: 10, z: 20 }, 0.016); // Initial

      // Update position by (5, 10) over 0.5 seconds
      manager.updateSource('player1', { x: 15, z: 30 }, 0.5);

      const source = manager.getSource('player1');
      // Velocity = deltaPos / deltaSeconds = (5/0.5, 10/0.5) = (10, 20)
      expect(source?.velocity.x).toBeCloseTo(10);
      expect(source?.velocity.z).toBeCloseTo(20);
      expect(source?.velocity.y).toBe(0);
      expect(source?.position.equals(new THREE.Vector3(15, 0, 30))).toBe(true);
    });

    it('handles very small deltaSeconds by capping at 0.001', () => {
      manager.updateSource('player1', { x: 10, z: 20 }, 0.016); // Initial

      // Try to pass a deltaSeconds smaller than 0.001 (e.g. 0)
      manager.updateSource('player1', { x: 15, z: 30 }, 0);

      const source = manager.getSource('player1');
      // Max dt is 0.001, so velocity should be (5/0.001, 10/0.001) = (5000, 10000)
      expect(source?.velocity.x).toBeCloseTo(5000);
      expect(source?.velocity.z).toBeCloseTo(10000);
    });

    it('handles optional parameters (radius and strength)', () => {
      manager.updateSource('player1', { x: 10, z: 20 }, 0.016, 5.0, 2.5);

      const source = manager.getSource('player1');
      expect(source?.radius).toBe(5.0);
      expect(source?.strength).toBe(2.5);
    });
  });

  describe('getSource', () => {
    it('returns undefined for an unknown ID', () => {
      const source = manager.getSource('unknown');
      expect(source).toBeUndefined();
    });

    it('returns the correct source for a known ID', () => {
      manager.updateSource('player1', { x: 10, z: 20 }, 0.016);
      manager.updateSource('player2', { x: 30, z: 40 }, 0.016);

      const source = manager.getSource('player2');
      expect(source?.id).toBe('player2');
    });
  });

  describe('getAllSources', () => {
    it('returns an empty array initially', () => {
      const sources = manager.getAllSources();
      expect(sources).toEqual([]);
    });

    it('returns an array of all registered sources', () => {
      manager.updateSource('player1', { x: 10, z: 20 }, 0.016);
      manager.updateSource('player2', { x: 30, z: 40 }, 0.016);
      manager.updateSource('player3', { x: 50, z: 60 }, 0.016);

      const sources = manager.getAllSources();
      expect(sources.length).toBe(3);
      expect(sources.find(s => s.id === 'player1')).toBeDefined();
      expect(sources.find(s => s.id === 'player2')).toBeDefined();
      expect(sources.find(s => s.id === 'player3')).toBeDefined();
    });
  });
});
