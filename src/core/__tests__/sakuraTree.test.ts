import { describe, expect, it } from 'vitest'
import { EXPERIMENTAL_TREE_CENTER, EXPERIMENTAL_TREE_SPECS, generateExperimentalTreeSkeleton } from '../experimentalTree'
import { FOUNTAIN_CENTER, FOUNTAIN_SPECS } from '../fountainWater'
import {
  FallingLeafPhase,
  SAKURA_TREE_CENTER,
  SAKURA_TREE_SPECS,
  SakuraLivingCanopySimulator,
  generateSakuraTreeSkeleton,
} from '../sakuraTree'
import { WORLD } from '../world'

describe('Experimental Sakura Tree & CoG Aerodynamic Falling/Regrowth Simulator', () => {
  it('generates a distinct spreading-weeping branching topology different from the Experimental Botanical Tree', () => {
    const sakura = generateSakuraTreeSkeleton(94127, false)
    const oak = generateExperimentalTreeSkeleton(50741, false)

    // Distinct structural branching parameters
    expect(SAKURA_TREE_SPECS.trunkHeight).toBeLessThan(EXPERIMENTAL_TREE_SPECS.trunkHeight)
    expect(sakura.stats.rootCount).toBe(7)
    expect(sakura.stats.primaryLimbCount).toBe(5)
    expect(sakura.stats.rootCount).not.toBe(oak.stats.rootCount)
    expect(sakura.stats.primaryLimbCount).not.toBe(oak.stats.primaryBoughCount)
    expect(sakura.stats.secondaryBoughCount).toBeGreaterThanOrEqual(20)
    expect(sakura.stats.weepingTwigCount).toBeGreaterThanOrEqual(60)
    expect(sakura.stats.canopySlotCount).toBeGreaterThanOrEqual(900)

    for (const branch of sakura.branches) {
      expect(branch.nodes[0].radius).toBeGreaterThan(branch.nodes[branch.nodes.length - 1].radius)
      for (const n of branch.nodes) {
        expect(Number.isFinite(n.x)).toBe(true)
        expect(Number.isFinite(n.y)).toBe(true)
        expect(Number.isFinite(n.z)).toBe(true)
      }
    }
  })

  it('falls slowly under anisotropic air resistance, disperses in multiple directions with wind & CoG torque, and regrows shed leaves over time', () => {
    const sakura = generateSakuraTreeSkeleton(94127, false)
    const sim = new SakuraLivingCanopySimulator(sakura.canopySlots, 200, 66109)

    // Advance 18 seconds of wind simulation at 30 Hz
    let maxDownwardSpeed = 0
    let activeTorqueObserved = false
    for (let step = 0; step < 540; step++) {
      sim.step(1 / 30, 0.9)
      const f = sim.falling
      for (let i = 0; i < f.count; i++) {
        if (f.phase[i] === FallingLeafPhase.Falling) {
          if (-f.vy[i] > maxDownwardSpeed) maxDownwardSpeed = -f.vy[i]
          if (Math.abs(f.angVx[i]) > 0.05 || Math.abs(f.angVz[i]) > 0.05) {
            activeTorqueObserved = true
          }
          expect(Number.isFinite(f.x[i])).toBe(true)
          expect(Number.isFinite(f.y[i])).toBe(true)
          expect(Number.isFinite(f.z[i])).toBe(true)
        }
      }
    }

    // Air resistance enforces slow graceful descent (terminal downward speed <= 1.05 m/s)
    expect(maxDownwardSpeed).toBeGreaterThan(0.15)
    expect(maxDownwardSpeed).toBeLessThanOrEqual(1.06)
    expect(activeTorqueObserved).toBe(true)

    // Verify leaves disperse in genuinely different horizontal directions (multiple quadrants)
    const quadrants = new Set<string>()
    let groundedCount = 0
    for (let i = 0; i < sim.falling.count; i++) {
      if (sim.falling.phase[i] !== FallingLeafPhase.Inactive) {
        const q = `${sim.falling.x[i] >= 0 ? '+' : '-'}${sim.falling.z[i] >= 0 ? '+' : '-'}`
        quadrants.add(q)
      }
      if (sim.falling.phase[i] === FallingLeafPhase.Grounded) {
        groundedCount++
      }
    }
    expect(quadrants.size).toBeGreaterThanOrEqual(3)
    expect(groundedCount).toBeGreaterThan(0)

    // Verify living canopy lifecycle: leaves actively shed and new leaves bud & regrow to full maturity
    expect(sim.totalLeavesShed).toBeGreaterThan(20)
    expect(sim.totalLeavesRegrown).toBeGreaterThan(10)
  })

  it('sits beside the Experimental Botanical Tree with clear walkway clearance and a registered collider', () => {
    const distToExpTree = Math.hypot(
      SAKURA_TREE_CENTER.x - EXPERIMENTAL_TREE_CENTER.x,
      SAKURA_TREE_CENTER.z - EXPERIMENTAL_TREE_CENTER.z
    )
    const distToFountain = Math.hypot(
      SAKURA_TREE_CENTER.x - FOUNTAIN_CENTER.x,
      SAKURA_TREE_CENTER.z - FOUNTAIN_CENTER.z
    )

    expect(distToExpTree).toBeGreaterThan(
      EXPERIMENTAL_TREE_SPECS.planterOuterRadius + SAKURA_TREE_SPECS.planterOuterRadius + 1.5
    )
    expect(distToExpTree).toBeLessThan(6.0)
    expect(distToFountain).toBeGreaterThan(FOUNTAIN_SPECS.plinthOuterRadius + SAKURA_TREE_SPECS.planterOuterRadius + 1.5)

    const collider = WORLD.colliders.find(
      c => c.x === SAKURA_TREE_CENTER.x && c.z === SAKURA_TREE_CENTER.z
    )
    expect(collider).toBeDefined()
    expect(collider!.halfX).toBeGreaterThanOrEqual(1.0)
  })

  it('scales falling sakura petal frequency dynamically with fallDensity (0x calm to 3x blossom storm)', () => {
    const sakura = generateSakuraTreeSkeleton(94127, false)
    const calmSim = new SakuraLivingCanopySimulator(sakura.canopySlots, 200, 66109)
    const lightSim = new SakuraLivingCanopySimulator(sakura.canopySlots, 200, 66109)
    const stormSim = new SakuraLivingCanopySimulator(sakura.canopySlots, 200, 66109)

    for (let step = 0; step < 300; step++) {
      calmSim.step(1 / 30, 0.8, 0)
      lightSim.step(1 / 30, 0.8, 0.5)
      stormSim.step(1 / 30, 0.8, 2.5)
    }

    expect(calmSim.totalLeavesShed).toBe(0)
    expect(lightSim.totalLeavesShed).toBeGreaterThan(10)
    expect(stormSim.totalLeavesShed).toBeGreaterThan(lightSim.totalLeavesShed * 3)
  })
})
