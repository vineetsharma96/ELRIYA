import { describe, expect, it } from 'vitest'
import {
  BLOSSOM_CLUSTERS,
  computeBlossomClusters,
  evaluateSpatialBirdState,
  evaluateWeatherAudioMix,
} from '../../scene/audio'

describe('spatial audio cherry blossom cluster birdsong & dynamic weather soundscape', () => {
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

  it('adapts audio mix dynamically across sunny, overcast, and light_rain weather conditions', () => {
    const sunnyMix = evaluateWeatherAudioMix('sunny', 0, 0, 0.8)
    const overcastMix = evaluateWeatherAudioMix('overcast', 0.68, 0, 0.8)
    const rainMix = evaluateWeatherAudioMix('light_rain', 1.0, 1.0, 0.8)

    // Wind chimes are active when clear/sunny, reduced in overcast, and silenced during rain
    expect(sunnyMix.chimeActivity).toBeGreaterThan(0.5)
    expect(overcastMix.chimeActivity).toBeLessThan(sunnyMix.chimeActivity)
    expect(rainMix.chimeActivity).toBe(0)

    // Rain shower bed and raindrop patters activate during light_rain and stay silent when sunny
    expect(sunnyMix.rainBedGain).toBe(0)
    expect(sunnyMix.rainPatterRate).toBe(0)
    expect(rainMix.rainBedGain).toBeGreaterThan(0.1)
    expect(rainMix.rainPatterRate).toBeGreaterThan(5)

    // Birdsong scales down during light_rain as birds shelter in the canopy
    expect(sunnyMix.birdActivityScale).toBe(1)
    expect(overcastMix.birdActivityScale).toBeLessThan(sunnyMix.birdActivityScale)
    expect(rainMix.birdActivityScale).toBeLessThan(overcastMix.birdActivityScale)
  })
})
