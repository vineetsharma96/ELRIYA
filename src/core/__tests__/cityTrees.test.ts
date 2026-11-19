import { describe, expect, it } from 'vitest'
import { generateExperimentalTreeSkeleton } from '../experimentalTree'
import { generateSakuraTreeSkeleton } from '../sakuraTree'
import { WORLD } from '../world'

describe('City-Wide Unique Sakura & Botanical Green Tree Grove', () => {
  it('randomly mixes sakura and green trees across all old tree locations with unique seeds', () => {
    expect(WORLD.trees.length).toBeGreaterThanOrEqual(80)

    const sakuraTrees = WORLD.trees.filter(t => t.species === 'sakura')
    const greenTrees = WORLD.trees.filter(t => t.species === 'green')

    // Genuine random mix of both species across the city
    expect(sakuraTrees.length).toBeGreaterThanOrEqual(Math.floor(WORLD.trees.length * 0.3))
    expect(greenTrees.length).toBeGreaterThanOrEqual(Math.floor(WORLD.trees.length * 0.3))
    expect(sakuraTrees.length + greenTrees.length).toBe(WORLD.trees.length)

    // Every individual tree has its own unique branch-map seed
    const uniqueSeeds = new Set(WORLD.trees.map(t => t.seed))
    expect(uniqueSeeds.size).toBe(WORLD.trees.length)

    // No city tree collides with the two showcase plaza trees beside the fountain
    for (const t of WORLD.trees) {
      expect(Math.hypot(t.x - 5.4, t.z + 3.6)).toBeGreaterThanOrEqual(2.79)
      expect(Math.hypot(t.x - 5.4, t.z + 8.6)).toBeGreaterThanOrEqual(2.79)
    }
  })

  it('gives each green city tree a genuinely different multi-order branch map', () => {
    const sampleGreen = WORLD.trees.filter(t => t.species === 'green').slice(0, 6)
    expect(sampleGreen.length).toBe(6)

    const branchSignatures = new Set<string>()
    for (const tree of sampleGreen) {
      const skel = generateExperimentalTreeSkeleton(tree.seed, false, 'city')
      const orders = new Set(skel.branches.map(b => b.order))
      expect(orders.has(-1)).toBe(true)
      expect(orders.has(0)).toBe(true)
      expect(orders.has(1)).toBe(true)
      expect(orders.has(2)).toBe(true)
      expect(orders.has(3)).toBe(true)
      expect(skel.leaves.length).toBeGreaterThan(80)

      // Capture primary bough tip layout signature to confirm unique branch architecture
      const primaryTips = skel.branches
        .filter(b => b.order === 1)
        .map(b => {
          const tip = b.nodes[b.nodes.length - 1]
          return `${tip.x.toFixed(2)},${tip.y.toFixed(2)},${tip.z.toFixed(2)}`
        })
        .join('|')
      branchSignatures.add(primaryTips)

      for (const b of skel.branches) {
        expect(b.nodes[0].radius).toBeGreaterThan(b.nodes[b.nodes.length - 1].radius)
        for (const n of b.nodes) {
          expect(Number.isFinite(n.x)).toBe(true)
          expect(Number.isFinite(n.y)).toBe(true)
          expect(Number.isFinite(n.z)).toBe(true)
        }
      }
    }

    expect(branchSignatures.size).toBe(sampleGreen.length)
  })

  it('gives each sakura city tree a genuinely different spreading-weeping branch map', () => {
    const sampleSakura = WORLD.trees.filter(t => t.species === 'sakura').slice(0, 6)
    expect(sampleSakura.length).toBe(6)

    const branchSignatures = new Set<string>()
    for (const tree of sampleSakura) {
      const skel = generateSakuraTreeSkeleton(tree.seed, false, 'city')
      const orders = new Set(skel.branches.map(b => b.order))
      expect(orders.has(-1)).toBe(true)
      expect(orders.has(0)).toBe(true)
      expect(orders.has(1)).toBe(true)
      expect(orders.has(2)).toBe(true)
      expect(orders.has(3)).toBe(true)
      expect(skel.canopySlots.length).toBeGreaterThan(80)

      const primaryTips = skel.branches
        .filter(b => b.order === 1)
        .map(b => {
          const tip = b.nodes[b.nodes.length - 1]
          return `${tip.x.toFixed(2)},${tip.y.toFixed(2)},${tip.z.toFixed(2)}`
        })
        .join('|')
      branchSignatures.add(primaryTips)

      for (const b of skel.branches) {
        expect(b.nodes[0].radius).toBeGreaterThan(b.nodes[b.nodes.length - 1].radius)
      }
    }

    expect(branchSignatures.size).toBe(sampleSakura.length)
  })

  it('scales down cleanly in city-low mode for both species', () => {
    const gHigh = generateExperimentalTreeSkeleton(100003, false, 'city')
    const gLow = generateExperimentalTreeSkeleton(100003, true, 'city-low')
    expect(gLow.leaves.length).toBeLessThan(gHigh.leaves.length)
    expect(gLow.leaves.length).toBeGreaterThan(40)

    const sHigh = generateSakuraTreeSkeleton(107922, false, 'city')
    const sLow = generateSakuraTreeSkeleton(107922, true, 'city-low')
    expect(sLow.canopySlots.length).toBeLessThan(sHigh.canopySlots.length)
    expect(sLow.canopySlots.length).toBeGreaterThan(40)
  })
})
