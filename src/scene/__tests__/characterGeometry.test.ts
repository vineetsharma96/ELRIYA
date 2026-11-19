import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  buildCharacterParts,
  disposeCharacterParts,
  type CharacterKind,
} from '../characterGeometry'

function computeAggregateBounds(kind: CharacterKind, lite = false): {
  box: THREE.Box3
  partCount: number
  materialNames: string[]
  totalVertices: number
  hasFiniteVertices: boolean
  emissiveParts: number
} {
  const parts = buildCharacterParts(kind, lite)
  const box = new THREE.Box3()
  let totalVertices = 0
  let hasFiniteVertices = true
  let emissiveParts = 0
  const materialNames: string[] = []

  for (const part of parts) {
    part.geometry.computeBoundingBox()
    if (part.geometry.boundingBox) box.union(part.geometry.boundingBox)
    const pos = part.geometry.getAttribute('position')
    totalVertices += pos.count
    for (let i = 0; i < pos.array.length; i++) {
      if (!Number.isFinite(pos.array[i])) {
        hasFiniteVertices = false
        break
      }
    }
    materialNames.push(part.material.name)
    if (part.material instanceof THREE.MeshStandardMaterial && part.material.emissive.getHex() !== 0) {
      emissiveParts++
    }
  }

  disposeCharacterParts(parts)
  return { box, partCount: parts.length, materialNames, totalVertices, hasFiniteVertices, emissiveParts }
}

describe('Procedural Three.js Characters (1:1 Blender GLB replacement)', () => {
  it('recreates protagonist with exact Blender dimensions, 9 materials, and backpack', () => {
    const result = computeAggregateBounds('protagonist', false)
    expect(result.hasFiniteVertices).toBe(true)
    expect(result.partCount).toBe(9)
    expect(result.materialNames).toEqual([
      'ELYRIA_honeywood',
      'ELYRIA_lilac',
      'ELYRIA_porcelain',
      'ELYRIA_skin',
      'ELYRIA_auburn',
      'ELYRIA_ink',
      'ELYRIA_rice',
      'ELYRIA_petal',
      'ELYRIA_tangerine',
    ])
    // Exact GLB bounds: min [-0.455, 0, -0.409], max [0.46, 1.7875, 0.374]
    expect(result.box.min.x).toBeCloseTo(-0.455, 2)
    expect(result.box.min.y).toBeCloseTo(0.0, 2)
    expect(result.box.min.z).toBeCloseTo(-0.409, 2)
    expect(result.box.max.x).toBeCloseTo(0.46, 2)
    expect(result.box.max.y).toBeCloseTo(1.7875, 2)
    expect(result.box.max.z).toBeCloseTo(0.374, 2)
  })

  it('recreates citizen with exact Blender dimensions, 8 materials (sage cloth, no backpack)', () => {
    const result = computeAggregateBounds('citizen', false)
    expect(result.hasFiniteVertices).toBe(true)
    expect(result.partCount).toBe(8)
    expect(result.materialNames).toEqual([
      'ELYRIA_honeywood',
      'ELYRIA_sage',
      'ELYRIA_porcelain',
      'ELYRIA_skin',
      'ELYRIA_auburn',
      'ELYRIA_ink',
      'ELYRIA_rice',
      'ELYRIA_petal',
    ])
    // Exact GLB bounds: min [-0.455, 0, -0.365], max [0.46, 1.7875, 0.374]
    expect(result.box.min.x).toBeCloseTo(-0.455, 2)
    expect(result.box.min.y).toBeCloseTo(0.0, 2)
    expect(result.box.min.z).toBeCloseTo(-0.365, 2)
    expect(result.box.max.x).toBeCloseTo(0.46, 2)
    expect(result.box.max.y).toBeCloseTo(1.7875, 2)
    expect(result.box.max.z).toBeCloseTo(0.374, 2)
  })

  it('recreates companion with exact Blender dimensions, 6 materials, and emissive collar bell', () => {
    const result = computeAggregateBounds('companion', false)
    expect(result.hasFiniteVertices).toBe(true)
    expect(result.partCount).toBe(6)
    expect(result.emissiveParts).toBe(1)
    expect(result.materialNames).toEqual([
      'ELYRIA_porcelain',
      'ELYRIA_rice',
      'ELYRIA_petal',
      'ELYRIA_ink',
      'ELYRIA_lilac',
      'ELYRIA_warm_window',
    ])
    // Exact GLB bounds: min [-0.30, 0.02, -0.907], max [0.304, 0.97, 0.479]
    expect(result.box.min.x).toBeCloseTo(-0.3, 2)
    expect(result.box.min.y).toBeCloseTo(0.02, 2)
    expect(result.box.min.z).toBeCloseTo(-0.907, 2)
    expect(result.box.max.x).toBeCloseTo(0.304, 2)
    expect(result.box.max.y).toBeCloseTo(0.97, 2)
    expect(result.box.max.z).toBeCloseTo(0.479, 2)
  })

  it('produces single-batch vertex-colored lite meshes with identical bounds for all characters', () => {
    for (const kind of ['protagonist', 'citizen', 'companion'] as const) {
      const full = computeAggregateBounds(kind, false)
      const lite = computeAggregateBounds(kind, true)
      expect(lite.partCount).toBe(1)
      expect(lite.hasFiniteVertices).toBe(true)
      expect(lite.totalVertices).toBe(full.totalVertices)
      expect(lite.box.min.x).toBeCloseTo(full.box.min.x, 3)
      expect(lite.box.min.y).toBeCloseTo(full.box.min.y, 3)
      expect(lite.box.min.z).toBeCloseTo(full.box.min.z, 3)
      expect(lite.box.max.x).toBeCloseTo(full.box.max.x, 3)
      expect(lite.box.max.y).toBeCloseTo(full.box.max.y, 3)
      expect(lite.box.max.z).toBeCloseTo(full.box.max.z, 3)
    }
  })
})
