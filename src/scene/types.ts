import type { QualityMode } from '../core/quality'
import type { RefObject } from 'react'
import type { BistroActionResult } from '../core/bistroEncounter'

export type CameraMode = 'follow' | 'vista'
export interface WorldSnapshot {
  ready: boolean
  fps: number
  frameMs: number
  p95Ms: number
  drawCalls: number
  triangles: number
  player: { x: number; y: number; z: number }
  time: number
  nearLandmark: string | null
  discovered: string[]
  npcCount: number
  petalCount: number
  activeQuality: string
  renderScale: number
  wind: number
  backend: string
  lighting: string
  bistroPrompt?: string | null
  bistroCanCancel?: boolean
  bistroUnlocked?: boolean
}
export interface WorldApi {
  setTime(hours: number): void
  setWind(strength: number): void
  resetPlayer(): void
  interact(): string | null
  interactBistro(): BistroActionResult
  cancelBistro(): boolean
  setVirtual(input: { moveX?: number; moveZ?: number; sprint?: boolean; jump?: boolean }): void
  getSnapshot(): WorldSnapshot
}
export interface WorldCanvasProps {
  apiRef: RefObject<WorldApi | null>
  onSnapshot(snapshot: WorldSnapshot): void
  paused: boolean
  qualityMode: QualityMode
  cameraMode: CameraMode
  audioEnabled: boolean
}
export const INITIAL_SNAPSHOT: WorldSnapshot = {
  ready: false, fps: 0, frameMs: 0, p95Ms: 0, drawCalls: 0, triangles: 0,
  player: { x: 0, y: 0, z: 12 }, time: 9.5, nearLandmark: null, discovered: [],
  npcCount: 0, petalCount: 0, activeQuality: 'HIGH', renderScale: 1.5,
  wind: 0.6, backend: 'WebGL2', lighting: 'Hemisphere ambient + sun',
}
