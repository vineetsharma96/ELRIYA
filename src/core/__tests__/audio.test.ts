import { describe, expect, it } from 'vitest'
import { BLOSSOM_CLUSTERS, computeBlossomClusters, evaluateSpatialBirdState } from '../../scene/audio'

describe('spatial audio cherry blossom cluster birdsong system', () => {
  it('identifies dense cherry blossom tree clusters across the city', () => {
    const clusters = computeBlossomClusters()
    expect(clusters.length).toBeGreaterThanOrEqual(8)
    for (const cluster of clusters) {
      expect(cluster.treeCount).toBeGreaterThanOrEqual(3)
      expect(cluster.trees.length).toBe(cluster.treeCount)
      expect(cluster.y).toBeGreaterThan(2.5)
    }
  })

  it('activates localized bird state when near a dense blossom cluster and fades out when far away', () => {
    const targetCluster = BLOSSOM_CLUSTERS[0]
    const atCenter = evaluateSpatialBirdState({ x: targetCluster.x, z: targetCluster.z })
    expect(atCenter.activeCluster).not.toBeNull()
    expect(atCenter.intensity).toBeGreaterThan(0.75)

    const atEdge = evaluateSpatialBirdState({
      x: targetCluster.x + targetCluster.radius * 0.65,
      z: targetCluster.z,
    })
    expect(atEdge.intensity).toBeGreaterThan(0)
    expect(atEdge.intensity).toBeLessThan(atCenter.intensity)

    const farOutside = evaluateSpatialBirdState({ x: 999, z: 999 })
    expect(farOutside.activeCluster).toBeNull()
    expect(farOutside.nearbyClusters).toHaveLength(0)
    expect(farOutside.intensity).toBe(0)
  })
})
