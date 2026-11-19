import { describe, expect, it } from 'vitest'
import {
  EXPERIMENTAL_TREE_CENTER,
  EXPERIMENTAL_TREE_SPECS,
  generateExperimentalTreeSkeleton,
} from '../experimentalTree'
import { FOUNTAIN_CENTER, FOUNTAIN_SPECS } from '../fountainWater'
import { WORLD } from '../world'

describe('Experimental Botanical Tree Skeleton & Placement', () => {
  it('generates all five hierarchical botanical orders with tapered finite geometry', () => {
    const skeleton = generateExperimentalTreeSkeleton(50741, false)
    expect(skeleton.stats.rootCount).toBe(6)
    expect(skeleton.stats.primaryBoughCount).toBe(6)
    expect(skeleton.stats.secondaryBranchCount).toBeGreaterThanOrEqual(18)
    expect(skeleton.stats.twigCount).toBeGreaterThanOrEqual(60)
    expect(skeleton.stats.leafSprigCount).toBeGreaterThanOrEqual(1400)

    const ordersPresent = new Set(skeleton.branches.map(b => b.order))
    expect(ordersPresent.has(-1)).toBe(true) // roots
    expect(ordersPresent.has(0)).toBe(true)  // trunk
    expect(ordersPresent.has(1)).toBe(true)  // primary boughs
    expect(ordersPresent.has(2)).toBe(true)  // secondary limbs
    expect(ordersPresent.has(3)).toBe(true)  // fine twigs

    for (const branch of skeleton.branches) {
      expect(branch.nodes.length).toBeGreaterThanOrEqual(3)
      // Every branch tapers from base to tip
      expect(branch.nodes[0].radius).toBeGreaterThan(branch.nodes[branch.nodes.length - 1].radius)
      for (const n of branch.nodes) {
        expect(Number.isFinite(n.x)).toBe(true)
        expect(Number.isFinite(n.y)).toBe(true)
        expect(Number.isFinite(n.z)).toBe(true)
        expect(n.radius).toBeGreaterThan(0)
      }
    }

    for (const leaf of skeleton.leaves) {
      expect(Number.isFinite(leaf.x)).toBe(true)
      expect(Number.isFinite(leaf.y)).toBe(true)
      expect(Number.isFinite(leaf.z)).toBe(true)
      expect(leaf.y).toBeGreaterThanOrEqual(1.8)
      expect(leaf.scale).toBeGreaterThan(0.2)
    }
  })

  it('scales cleanly in lowDetail mode while preserving structure', () => {
    const high = generateExperimentalTreeSkeleton(50741, false)
    const low = generateExperimentalTreeSkeleton(50741, true)
    expect(low.stats.leafSprigCount).toBeLessThan(high.stats.leafSprigCount)
    expect(low.stats.leafSprigCount).toBeGreaterThan(500)
    expect(low.stats.primaryBoughCount).toBe(high.stats.primaryBoughCount)
  })

  it('is positioned right next to the fountain with clear walkway clearance and a registered collider', () => {
    const distToFountain = Math.hypot(
      EXPERIMENTAL_TREE_CENTER.x - FOUNTAIN_CENTER.x,
      EXPERIMENTAL_TREE_CENTER.z - FOUNTAIN_CENTER.z
    )
    const combinedRadii = FOUNTAIN_SPECS.plinthOuterRadius + EXPERIMENTAL_TREE_SPECS.planterOuterRadius
    // Close showcase proximity (< 6.5m) while leaving > 1.0m clear stone walkway
    expect(distToFountain).toBeLessThan(6.5)
    expect(distToFountain).toBeGreaterThan(combinedRadii + 1.0)

    const collider = WORLD.colliders.find(
      c => c.x === EXPERIMENTAL_TREE_CENTER.x && c.z === EXPERIMENTAL_TREE_CENTER.z
    )
    expect(collider).toBeDefined()
    expect(collider!.halfX).toBeGreaterThanOrEqual(1.0)
  })
})
