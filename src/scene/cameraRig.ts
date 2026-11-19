import * as THREE from 'three'
import type { Point2 } from '../core/types'

export const DEFAULT_CAMERA_YAW = 0.0
export const DEFAULT_CAMERA_PITCH = 0.2
export const MIN_CAMERA_PITCH = -0.22
export const MAX_CAMERA_PITCH = 1.15

export const MIN_CAMERA_DISTANCE = 2.4
export const DEFAULT_CAMERA_DISTANCE = 4.6
export const MAX_CAMERA_DISTANCE = 32.0

export const SHOULDER_HEIGHT_OFFSET = 1.48
export const MIN_CAMERA_CLEARANCE_Y = 0.42
export const AVATAR_HIDE_DISTANCE = 1.05

export interface CameraOrbitState {
  yaw: number
  pitch: number
  distance: number
  targetDistance: number
}

export interface RightShoulderScratch {
  spine: THREE.Vector3
  pivot: THREE.Vector3
  target: THREE.Vector3
  cameraPos: THREE.Vector3
  direction: THREE.Vector3
  hit: THREE.Vector3
  ray: THREE.Ray
}

export function createDefaultOrbitState(): CameraOrbitState {
  return {
    yaw: DEFAULT_CAMERA_YAW,
    pitch: DEFAULT_CAMERA_PITCH,
    distance: DEFAULT_CAMERA_DISTANCE,
    targetDistance: DEFAULT_CAMERA_DISTANCE,
  }
}

export function clampCameraDistance(distance: number): number {
  if (!Number.isFinite(distance)) return DEFAULT_CAMERA_DISTANCE
  return THREE.MathUtils.clamp(distance, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE)
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * Lateral right-shoulder offset in world meters.
 * Keeps classic over-the-right-shoulder framing at close & default distances,
 * then smoothly centers as the user zooms far out for scenic wide views.
 */
export function computeShoulderOffset(distance: number, indoorRatio = 0): number {
  const d = clampCameraDistance(distance)
  const closeBlend = smoothstep(MIN_CAMERA_DISTANCE, DEFAULT_CAMERA_DISTANCE, d)
  const baseRight = THREE.MathUtils.lerp(0.58, 0.76, closeBlend)
  const wideCenterFade = 1 - smoothstep(10.0, 22.0, d)
  const indoorScale = 1 - THREE.MathUtils.clamp(indoorRatio, 0, 1) * 0.35
  return baseRight * wideCenterFade * indoorScale
}

/**
 * Forward look-ahead along camera view direction so the camera looks past
 * the character's right shoulder down the path ahead.
 */
export function computeLookAhead(distance: number, indoorRatio = 0): number {
  const d = clampCameraDistance(distance)
  const t = smoothstep(MIN_CAMERA_DISTANCE, 12.0, d)
  const base = THREE.MathUtils.lerp(2.0, 3.0, t)
  return base * (1 - THREE.MathUtils.clamp(indoorRatio, 0, 1))
}

/**
 * Multiplicative two-finger pinch zoom:
 * - Pinch out (fingers spread apart -> nextSpan > prevSpan): zooms IN (smaller distance)
 * - Pinch in (fingers come together -> nextSpan < prevSpan): zooms OUT (larger distance)
 */
export function applyPinchZoom(
  currentTargetDistance: number,
  previousSpan: number,
  nextSpan: number,
  sensitivity = 1.0,
): number {
  if (!Number.isFinite(previousSpan) || !Number.isFinite(nextSpan) || previousSpan <= 1e-3 || nextSpan <= 1e-3) {
    return clampCameraDistance(currentTargetDistance)
  }
  const rawRatio = THREE.MathUtils.clamp(previousSpan / nextSpan, 0.5, 2.0)
  const factor = Math.pow(rawRatio, sensitivity)
  return clampCameraDistance(currentTargetDistance * factor)
}

/**
 * Exponential wheel & trackpad-pinch zoom:
 * - Trackpad pinch fires wheel events with ctrlKey = true (negative deltaY = spread/zoom in)
 * - Standard mouse wheel fires wheel events with ctrlKey = false (negative deltaY = scroll up/zoom in)
 */
export function applyWheelZoom(
  currentTargetDistance: number,
  deltaY: number,
  isTrackpadPinch: boolean,
): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) {
    return clampCameraDistance(currentTargetDistance)
  }
  const clampedDelta = THREE.MathUtils.clamp(deltaY, -180, 180)
  const sensitivity = isTrackpadPinch ? 0.0085 : 0.0014
  return clampCameraDistance(currentTargetDistance * Math.exp(clampedDelta * sensitivity))
}

/**
 * Single-pointer drag orbit update.
 */
export function applyDragOrbit(orbit: CameraOrbitState, dx: number, dy: number): void {
  if (Number.isFinite(dx)) {
    orbit.yaw -= dx * 0.005
  }
  if (Number.isFinite(dy)) {
    orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + dy * 0.004, MIN_CAMERA_PITCH, MAX_CAMERA_PITCH)
  }
}

/**
 * Computes two-stage wall-safe right-shoulder camera placement:
 * 1) Spine -> Right-shoulder pivot (prevents lateral shoulder offset from poking inside a wall)
 * 2) Safe pivot -> Orbit camera position (pulls camera forward cleanly when backing into walls)
 * Mutates scratch vectors in place for zero per-frame allocations.
 */
export function computeRightShoulderPose(
  playerPos: { x: number; y: number; z: number },
  yaw: number,
  pitch: number,
  distance: number,
  indoorRatio: number,
  collisionBoxes: readonly THREE.Box3[],
  scratch: RightShoulderScratch,
): void {
  const rightX = Math.cos(yaw)
  const rightZ = -Math.sin(yaw)
  const forwardX = -Math.sin(yaw)
  const forwardZ = -Math.cos(yaw)

  const spineY = playerPos.y + SHOULDER_HEIGHT_OFFSET
  scratch.spine.set(playerPos.x, spineY, playerPos.z)

  // Stage 1: Resolve right-shoulder lateral offset against walls
  let shoulderOffset = computeShoulderOffset(distance, indoorRatio)
  if (shoulderOffset > 0.001 && collisionBoxes.length > 0) {
    scratch.direction.set(rightX, 0, rightZ)
    scratch.ray.set(scratch.spine, scratch.direction)
    const wallMargin = 0.2
    for (let i = 0; i < collisionBoxes.length; i++) {
      const hit = scratch.ray.intersectBox(collisionBoxes[i], scratch.hit)
      if (hit) {
        const hitDist = scratch.spine.distanceTo(hit)
        if (hitDist < shoulderOffset + wallMargin) {
          shoulderOffset = Math.min(shoulderOffset, Math.max(0, hitDist - wallMargin))
        }
      }
    }
  }

  scratch.pivot.set(
    playerPos.x + rightX * shoulderOffset,
    spineY,
    playerPos.z + rightZ * shoulderOffset,
  )

  const lookAhead = computeLookAhead(distance, indoorRatio)
  scratch.target.set(
    scratch.pivot.x + forwardX * lookAhead,
    spineY,
    scratch.pivot.z + forwardZ * lookAhead,
  )

  // Stage 2: Spherical camera offset behind safe right-shoulder pivot
  const cosPitch = Math.cos(pitch)
  scratch.cameraPos.set(
    scratch.pivot.x + Math.sin(yaw) * cosPitch * distance,
    Math.max(playerPos.y + MIN_CAMERA_CLEARANCE_Y, scratch.pivot.y + Math.sin(pitch) * distance),
    scratch.pivot.z + Math.cos(yaw) * cosPitch * distance,
  )

  if (collisionBoxes.length > 0) {
    scratch.direction.subVectors(scratch.cameraPos, scratch.pivot)
    const segLen = scratch.direction.length()
    if (segLen > 1e-4) {
      scratch.direction.divideScalar(segLen)
      scratch.ray.set(scratch.pivot, scratch.direction)
      let limit = segLen
      for (let i = 0; i < collisionBoxes.length; i++) {
        const hit = scratch.ray.intersectBox(collisionBoxes[i], scratch.hit)
        if (hit) {
          limit = Math.min(limit, Math.max(0.25, scratch.pivot.distanceTo(hit) - 0.18))
        }
      }
      scratch.cameraPos.copy(scratch.pivot).addScaledVector(scratch.direction, limit)
      scratch.cameraPos.y = Math.max(playerPos.y + MIN_CAMERA_CLEARANCE_Y, scratch.cameraPos.y)
    }
  }
}

/**
 * Computes initial right-shoulder camera & look target coordinates at spawn
 * so the very first rendered frame opens directly in right-shoulder view.
 */
export function getInitialRightShoulderCamera(spawn: Point2): {
  position: [number, number, number]
  target: [number, number, number]
} {
  const scratch: RightShoulderScratch = {
    spine: new THREE.Vector3(),
    pivot: new THREE.Vector3(),
    target: new THREE.Vector3(),
    cameraPos: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    hit: new THREE.Vector3(),
    ray: new THREE.Ray(),
  }
  computeRightShoulderPose(
    { x: spawn.x, y: 0, z: spawn.z },
    DEFAULT_CAMERA_YAW,
    DEFAULT_CAMERA_PITCH,
    DEFAULT_CAMERA_DISTANCE,
    0,
    [],
    scratch,
  )
  return {
    position: [scratch.cameraPos.x, scratch.cameraPos.y, scratch.cameraPos.z],
    target: [scratch.target.x, scratch.target.y, scratch.target.z],
  }
}

/**
 * Multi-pointer gesture tracker handling:
 * - 1 active pointer: drag to orbit camera yaw/pitch
 * - 2 active pointers: pinch in / pinch out to smoothly zoom camera distance
 * Seamlessly transitions between 1 and 2 fingers with zero camera jump.
 */
export class CameraGestureTracker {
  private pointers = new Map<number, { x: number; y: number }>()
  private lastPinchSpan: number | null = null

  private computeTwoPointerSpan(): number | null {
    if (this.pointers.size < 2) return null
    const iterator = this.pointers.values()
    const first = iterator.next().value
    const second = iterator.next().value
    if (!first || !second) return null
    return Math.hypot(second.x - first.x, second.y - first.y)
  }

  onPointerDown(pointerId: number, x: number, y: number): void {
    this.pointers.set(pointerId, { x, y })
    this.lastPinchSpan = this.pointers.size >= 2 ? this.computeTwoPointerSpan() : null
  }

  onPointerMove(
    pointerId: number,
    x: number,
    y: number,
    orbit: CameraOrbitState,
  ): 'orbit' | 'pinch' | 'none' {
    const prev = this.pointers.get(pointerId)
    if (!prev) return 'none'
    const dx = x - prev.x
    const dy = y - prev.y
    prev.x = x
    prev.y = y

    if (this.pointers.size >= 2) {
      const span = this.computeTwoPointerSpan()
      if (span !== null && this.lastPinchSpan !== null && this.lastPinchSpan > 4 && span > 4) {
        orbit.targetDistance = applyPinchZoom(orbit.targetDistance, this.lastPinchSpan, span)
      }
      this.lastPinchSpan = span
      return 'pinch'
    }

    this.lastPinchSpan = null
    applyDragOrbit(orbit, dx, dy)
    return 'orbit'
  }

  onPointerUp(pointerId: number): void {
    this.pointers.delete(pointerId)
    this.lastPinchSpan = this.pointers.size >= 2 ? this.computeTwoPointerSpan() : null
  }

  clear(): void {
    this.pointers.clear()
    this.lastPinchSpan = null
  }

  get activeCount(): number {
    return this.pointers.size
  }
}
