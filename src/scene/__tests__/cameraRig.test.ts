import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  CameraGestureTracker,
  DEFAULT_CAMERA_DISTANCE,
  DEFAULT_CAMERA_PITCH,
  DEFAULT_CAMERA_YAW,
  MAX_CAMERA_DISTANCE,
  MIN_CAMERA_DISTANCE,
  MIN_CAMERA_CLEARANCE_Y,
  applyPinchZoom,
  applyWheelZoom,
  computeRightShoulderPose,
  computeShoulderOffset,
  createDefaultOrbitState,
  getInitialRightShoulderCamera,
  type RightShoulderScratch,
} from '../cameraRig'

function createScratch(): RightShoulderScratch {
  return {
    spine: new THREE.Vector3(),
    pivot: new THREE.Vector3(),
    target: new THREE.Vector3(),
    cameraPos: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    hit: new THREE.Vector3(),
    ray: new THREE.Ray(),
  }
}

describe('Right-shoulder camera rig & pinch-to-zoom', () => {
  it('defaults to an over-the-right-shoulder camera position behind the player', () => {
    const orbit = createDefaultOrbitState()
    expect(orbit.yaw).toBe(DEFAULT_CAMERA_YAW)
    expect(orbit.pitch).toBe(DEFAULT_CAMERA_PITCH)
    expect(orbit.distance).toBe(DEFAULT_CAMERA_DISTANCE)
    expect(orbit.targetDistance).toBe(DEFAULT_CAMERA_DISTANCE)

    const initial = getInitialRightShoulderCamera({ x: 0, z: 12 })
    // At yaw = 0, player faces -Z so right shoulder is +X and behind is +Z
    expect(initial.position[0]).toBeGreaterThan(0.5)
    expect(initial.position[2]).toBeGreaterThan(12 + 3.0)
    expect(initial.target[0]).toBeCloseTo(initial.position[0], 3)
    expect(initial.target[2]).toBeLessThan(12)
  })

  it('offsets the camera to the player right shoulder across arbitrary yaw angles and tapers when zoomed far out', () => {
    const scratch = createScratch()
    const nearOffset = computeShoulderOffset(DEFAULT_CAMERA_DISTANCE, 0)
    const farOffset = computeShoulderOffset(MAX_CAMERA_DISTANCE, 0)
    expect(nearOffset).toBeGreaterThan(0.6)
    expect(farOffset).toBe(0)

    // Facing West (yaw = +PI/2): forward = (-1, 0, 0), right = (0, 0, -1), behind = (+1, 0, 0)
    computeRightShoulderPose(
      { x: 5, y: 0, z: 10 },
      Math.PI / 2,
      DEFAULT_CAMERA_PITCH,
      DEFAULT_CAMERA_DISTANCE,
      0,
      [],
      scratch,
    )
    expect(scratch.pivot.z).toBeCloseTo(10 - nearOffset, 4)
    expect(scratch.cameraPos.x).toBeGreaterThan(5 + 3.5)
    expect(scratch.target.x).toBeLessThan(5)
  })

  it('prevents right-shoulder pivot and camera from clipping through nearby walls or below ground', () => {
    const scratch = createScratch()
    // Place a wall right next to the player's right side (+X = 0.25..2.0)
    const rightWall = new THREE.Box3(
      new THREE.Vector3(0.25, 0, 10),
      new THREE.Vector3(2.0, 5, 14),
    )
    computeRightShoulderPose(
      { x: 0, y: 0, z: 12 },
      0,
      -0.22, // looking upward
      DEFAULT_CAMERA_DISTANCE,
      0,
      [rightWall],
      scratch,
    )
    // Shoulder pivot must stay outside the right wall
    expect(scratch.pivot.x).toBeLessThanOrEqual(0.25)
    // Camera must never drop below floor clearance
    expect(scratch.cameraPos.y).toBeGreaterThanOrEqual(MIN_CAMERA_CLEARANCE_Y)

    // Place a wall directly behind the player at z = 14
    const backWall = new THREE.Box3(
      new THREE.Vector3(-4, 0, 14),
      new THREE.Vector3(4, 5, 15),
    )
    computeRightShoulderPose(
      { x: 0, y: 0, z: 12 },
      0,
      0.15,
      DEFAULT_CAMERA_DISTANCE,
      0,
      [backWall],
      scratch,
    )
    expect(scratch.cameraPos.z).toBeLessThan(14)
  })

  it('zooms in when pinching out (spreading fingers) and zooms out when pinching in (bringing fingers together)', () => {
    // Pinch out: span grows from 100px -> 150px => zoom IN (smaller distance)
    const zoomedIn = applyPinchZoom(DEFAULT_CAMERA_DISTANCE, 100, 150)
    expect(zoomedIn).toBeLessThan(DEFAULT_CAMERA_DISTANCE)
    expect(zoomedIn).toBeCloseTo(DEFAULT_CAMERA_DISTANCE * (100 / 150), 4)

    // Pinch in: span shrinks from 150px -> 100px => zoom OUT (larger distance)
    const zoomedOut = applyPinchZoom(DEFAULT_CAMERA_DISTANCE, 150, 100)
    expect(zoomedOut).toBeGreaterThan(DEFAULT_CAMERA_DISTANCE)
    expect(zoomedOut).toBeCloseTo(DEFAULT_CAMERA_DISTANCE * 1.5, 4)

    // Clamps cleanly at min and max bounds
    expect(applyPinchZoom(MIN_CAMERA_DISTANCE, 100, 200)).toBe(MIN_CAMERA_DISTANCE)
    expect(applyPinchZoom(MAX_CAMERA_DISTANCE, 200, 100)).toBe(MAX_CAMERA_DISTANCE)
  })

  it('supports trackpad pinch wheel events (ctrlKey) and standard scroll wheel zoom', () => {
    // Trackpad pinch out (negative deltaY) zooms in
    const trackpadIn = applyWheelZoom(DEFAULT_CAMERA_DISTANCE, -25, true)
    expect(trackpadIn).toBeLessThan(DEFAULT_CAMERA_DISTANCE)

    // Trackpad pinch in (positive deltaY) zooms out
    const trackpadOut = applyWheelZoom(DEFAULT_CAMERA_DISTANCE, 25, true)
    expect(trackpadOut).toBeGreaterThan(DEFAULT_CAMERA_DISTANCE)

    // Standard wheel scroll down zooms out, scroll up zooms in
    expect(applyWheelZoom(DEFAULT_CAMERA_DISTANCE, 100, false)).toBeGreaterThan(DEFAULT_CAMERA_DISTANCE)
    expect(applyWheelZoom(DEFAULT_CAMERA_DISTANCE, -100, false)).toBeLessThan(DEFAULT_CAMERA_DISTANCE)
  })

  it('tracks two-finger pinch and single-finger orbit transitions without camera jumps', () => {
    const tracker = new CameraGestureTracker()
    const orbit = createDefaultOrbitState()

    // Single finger drag orbits yaw/pitch
    tracker.onPointerDown(1, 200, 200)
    expect(tracker.onPointerMove(1, 220, 210, orbit)).toBe('orbit')
    expect(orbit.yaw).toBeLessThan(DEFAULT_CAMERA_YAW)
    expect(orbit.pitch).toBeGreaterThan(DEFAULT_CAMERA_PITCH)

    const yawBeforePinch = orbit.yaw
    const pitchBeforePinch = orbit.pitch

    // Second finger lands 100px away -> enters pinch mode
    tracker.onPointerDown(2, 320, 210)
    expect(tracker.activeCount).toBe(2)

    // Spread fingers apart to 160px -> zooms in without rotating yaw/pitch
    expect(tracker.onPointerMove(2, 380, 210, orbit)).toBe('pinch')
    expect(orbit.targetDistance).toBeLessThan(DEFAULT_CAMERA_DISTANCE)
    expect(orbit.yaw).toBe(yawBeforePinch)
    expect(orbit.pitch).toBe(pitchBeforePinch)

    // Pinch fingers closer to 80px -> zooms back out
    const midDist = orbit.targetDistance
    expect(tracker.onPointerMove(2, 300, 210, orbit)).toBe('pinch')
    expect(orbit.targetDistance).toBeGreaterThan(midDist)

    // Lift second finger -> remaining finger stays anchored so tiny movement causes tiny delta (no jump)
    tracker.onPointerUp(2)
    expect(tracker.activeCount).toBe(1)
    const yawBeforeLiftMove = orbit.yaw
    expect(tracker.onPointerMove(1, 222, 210, orbit)).toBe('orbit')
    expect(Math.abs(orbit.yaw - yawBeforeLiftMove)).toBeCloseTo(2 * 0.005, 5)
  })
})
