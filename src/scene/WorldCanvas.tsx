import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Asset, Citizens } from './Assets'
import { Terrain, createCanalMaterial } from './Terrain'
import { Petals } from './Petals'
import { Ambience } from './audio'
import { createSimulation, stepSimulation } from '../core/simulation'
import { createInput, type InputController } from '../core/input'
import { createQualityState, getQualitySettings, resetQualitySampling, setQualityMode, updateAdaptiveQuality, type QualitySettings } from '../core/quality'
import { WORLD, getLandmark, CAMERA_OBSTACLES_3D } from '../core/world'
import { createBistroEncounter, DEFAULT_BISTRO_ANCHORS } from '../core/bistroEncounter'
import { BistroVisibilityManager } from './bistroVisibility'
import { IndoorCameraController } from './indoorCamera'
import { INITIAL_SNAPSHOT, type WorldCanvasProps, type WorldSnapshot } from './types'

const CAMERA = { position: [12, 13, 31] as [number, number, number], fov: 46, near: 0.2, far: 220 }
const RENDERER = { antialias: true, alpha: false, powerPreference: 'high-performance' as const, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }

export default function WorldCanvas(props: WorldCanvasProps) {
  const [renderSettings, setRenderSettings] = useState(() => getQualitySettings(createQualityState(props.qualityMode)))
  const onQualitySettings = useCallback((settings: QualitySettings) => setRenderSettings(settings), [])
  return <Canvas
    className="world-canvas"
    shadows={renderSettings.shadows}
    dpr={Math.min(window.devicePixelRatio || 1, renderSettings.renderScale)}
    camera={CAMERA}
    gl={RENDERER}
    fallback={<div className="world-error">Elyria needs WebGL 2 to bring the plaza to life. Enable hardware acceleration in your browser and reload.</div>}
  >
    <Suspense fallback={null}><Plaza {...props} onQualitySettings={onQualitySettings} /></Suspense>
  </Canvas>
}

function Plaza({ apiRef, onSnapshot, paused, qualityMode, cameraMode, audioEnabled, onQualitySettings }: WorldCanvasProps & { onQualitySettings(settings: QualitySettings): void }) {
  const { camera, gl, scene, setDpr } = useThree()
  const simulation = useMemo(createSimulation, [])
  const quality = useMemo(() => createQualityState(qualityMode), [])
  const bistroEncounter = useMemo(createBistroEncounter, [])
  const indoorCameraController = useMemo(() => new IndoorCameraController(), [])
  const cupRef = useRef<THREE.Group>(null!)
  const bistroInteriorRef = useRef<THREE.Group>(null!)
  const bistroVisibility = useMemo(() => new BistroVisibilityManager(), [])
  const [settings, setSettings] = useState(() => getQualitySettings(quality))
  const input = useRef<InputController | null>(null)
  const wind = useMemo(() => ({ value: 0.6, time: 0 }), [])
  const ambience = useMemo(() => new Ambience(), [])
  const orbit = useRef({ yaw: 0.45, pitch: 0.4, distance: 25 })
  const snapshot = useRef<WorldSnapshot>({ ...INITIAL_SNAPSHOT })
  const onSnapshotRef = useRef(onSnapshot)
  onSnapshotRef.current = onSnapshot
  const avatar = useRef<THREE.Group>(null!)
  const companion = useRef<THREE.Group>(null!)
  const shuttle = useRef<THREE.Group>(null!)
  const sun = useRef<THREE.DirectionalLight>(null!)
  const hemi = useRef<THREE.HemisphereLight>(null!)
  const sunDisc = useRef<THREE.Mesh>(null!)
  const moonDisc = useRef<THREE.Mesh>(null!)
  const emissive = useRef<THREE.MeshStandardMaterial[]>([])
  const nightUniforms = useRef<{ value: number }[]>([])
  const water = useMemo(createCanalMaterial, [])
  const movement = useMemo(() => ({ target: new THREE.Vector3(0, 1.4, 12), desired: new THREE.Vector3(), direction: new THREE.Vector3(), ray: new THREE.Ray(), hit: new THREE.Vector3(), sky: new THREE.Color(), sun: new THREE.Color() }), [])
  const collisionBoxes = useMemo(() => CAMERA_OBSTACLES_3D.map(b => new THREE.Box3(
    new THREE.Vector3(b.min[0], b.min[1], b.min[2]),
    new THREE.Vector3(b.max[0], b.max[1], b.max[2])
  )), [])
  const profile = useRef({ intervals: [] as number[], lastEmission: 0, skipNext: false })
  useEffect(() => {
    const changed = () => { profile.current.skipNext = true; profile.current.intervals = []; resetQualitySampling(quality) }
    document.addEventListener('visibilitychange', changed)
    return () => document.removeEventListener('visibilitychange', changed)
  }, [quality])

  useEffect(() => {
    setQualityMode(quality, qualityMode)
    setSettings({ ...getQualitySettings(quality) })
  }, [quality, qualityMode])
  useEffect(() => {
    onQualitySettings(settings)
    setDpr(Math.min(window.devicePixelRatio || 1, settings.renderScale))
    gl.shadowMap.enabled = settings.shadows
    gl.shadowMap.type = THREE.PCFSoftShadowMap
    gl.shadowMap.needsUpdate = true
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.far = settings.drawDistance + 70
      camera.updateProjectionMatrix()
    }
    if (sun.current) {
      const shadow = sun.current.shadow
      shadow.mapSize.set(settings.shadowMapSize || 512, settings.shadowMapSize || 512)
      shadow.map?.dispose()
      shadow.map = null
      shadow.needsUpdate = true
    }
    scene.traverse(child => {
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach(material => { material.needsUpdate = true })
      }
    })
    const windows = new Set<THREE.MeshStandardMaterial>()
    const colourWindows = new Set<{ value: number }>()
    scene.traverse(child => {
      if (child instanceof THREE.Mesh) {
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
          if (material instanceof THREE.MeshStandardMaterial && material.emissive.getHex() !== 0) windows.add(material)
          if (material.userData.elyriaNight) colourWindows.add(material.userData.elyriaNight)
        }
      }
    })
    emissive.current = [...windows]
    nightUniforms.current = [...colourWindows]
  }, [settings, camera, gl, scene, setDpr, onQualitySettings])
  useEffect(() => {
    const controller = createInput()
    input.current = controller
    controller.setEnabled(!simulation.paused)
    return () => { controller.dispose(); input.current = null }
  }, [simulation])
  useEffect(() => { simulation.paused = paused; input.current?.setEnabled(!paused) }, [paused, simulation])
  useEffect(() => {
    if (audioEnabled) void ambience.start().catch(error => console.warn('Audio could not start:', error))
    else ambience.stop()
  }, [audioEnabled, ambience])
  useEffect(() => () => { ambience.dispose(); water.dispose() }, [ambience, water])
  useEffect(() => {
    apiRef.current = {
      setTime: value => { simulation.time = ((value % 24) + 24) % 24 },
      setWind: value => { wind.value = THREE.MathUtils.clamp(value, 0, 2) },
      resetPlayer: () => {
        const fresh = createSimulation()
        Object.assign(simulation.player, fresh.player)
        Object.assign(simulation.companion, fresh.companion)
        orbit.current = { yaw: 0.45, pitch: 0.4, distance: 25 }
      },
      interact: () => {
        const landmark = simulation.nearLandmark ? getLandmark(simulation.nearLandmark) : null
        return landmark ? `${landmark.name} — ${landmark.description}` : null
      },
      interactBistro: () => {
        const p = { x: simulation.player.x, z: simulation.player.z }
        const state = bistroEncounter.getState(p)
        if (state.canPickup || state.canReturn) return bistroEncounter.interact(p)
        return null
      },
      cancelBistro: () => bistroEncounter.cancel(),
      setVirtual: value => input.current?.setVirtual(value),
      getSnapshot: () => snapshot.current,
    }
    return () => { apiRef.current = null }
  }, [apiRef, input, simulation, wind, bistroEncounter])
  useEffect(() => {
    const canvas = gl.domElement
    let pointer: number | null = null
    let lastX = 0
    let lastY = 0
    const down = (event: PointerEvent) => {
      if (simulation.paused || event.button > 0) return
      pointer = event.pointerId
      lastX = event.clientX; lastY = event.clientY
      canvas.setPointerCapture(pointer)
    }
    const move = (event: PointerEvent) => {
      if (pointer !== event.pointerId || simulation.paused) return
      orbit.current.yaw -= (event.clientX - lastX) * 0.005
      orbit.current.pitch = THREE.MathUtils.clamp(orbit.current.pitch + (event.clientY - lastY) * 0.004, 0.15, 1.15)
      lastX = event.clientX; lastY = event.clientY
    }
    const up = () => { pointer = null }
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      if (!simulation.paused) orbit.current.distance = THREE.MathUtils.clamp(orbit.current.distance + event.deltaY * 0.02, 6, 44)
    }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('lostpointercapture', up)
    canvas.addEventListener('wheel', wheel, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('lostpointercapture', up); canvas.removeEventListener('wheel', wheel)
    }
  }, [gl, simulation])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1)
    if (!document.hidden && input.current) stepSimulation(simulation, input.current.sample(orbit.current.yaw), delta)
    const p = simulation.player
    wind.time = simulation.elapsed
    const bob = simulation.paused ? 0 : Math.sin(simulation.elapsed * (p.speed > 5 ? 15 : 10)) * Math.min(p.speed, 4) * 0.012
    avatar.current.position.set(p.x, p.y + bob, p.z)
    avatar.current.rotation.y = p.yaw
    avatar.current.rotation.z = Math.sin(simulation.elapsed * 10) * Math.min(p.speed, 4) * 0.008
    companion.current.position.set(simulation.companion.x, Math.max(0, Math.sin(simulation.elapsed * 8)) * Math.min(p.speed, 4) * 0.015, simulation.companion.z)
    companion.current.rotation.y = simulation.companion.yaw
    shuttle.current.position.set(simulation.shuttle.x, 0, simulation.shuttle.z)
    shuttle.current.rotation.y = simulation.shuttle.yaw

    const cycle = (simulation.time - 6) / 24 * Math.PI * 2
    const daylight = THREE.MathUtils.smoothstep(Math.sin(cycle), -0.18, 0.5)
    sun.current.position.set(Math.cos(cycle) * 50, Math.max(8, Math.sin(cycle) * 65), -28)
    sun.current.intensity = daylight * 2.4 + 0.08
    sun.current.color.set(daylight > 0.7 ? '#fff2d3' : '#ffd3a4')
    hemi.current.intensity = 0.4 + daylight * 0.85
    hemi.current.color.set(daylight > 0.3 ? '#dbf1ff' : '#7182b1')
    emissive.current.forEach(material => { material.emissiveIntensity = 0.12 + (1 - daylight) * 1.65 })
    nightUniforms.current.forEach(uniform => { uniform.value = 0.12 + (1 - daylight) * 1.65 })
    movement.sky.set('#303d63').lerp(new THREE.Color('#c7ded9'), daylight)
    scene.background = movement.sky
    if (scene.fog instanceof THREE.Fog) { scene.fog.color.copy(movement.sky); scene.fog.far = 140 + daylight * 65 }
    sunDisc.current.position.set(Math.cos(cycle) * 115, Math.sin(cycle) * 115, -95)
    sunDisc.current.visible = Math.sin(cycle) > -0.1
    moonDisc.current.position.set(-Math.cos(cycle) * 115, -Math.sin(cycle) * 115, -95)
    moonDisc.current.visible = Math.sin(cycle) < 0.1
    water.uniforms.uTime.value = simulation.elapsed
    water.uniforms.uDay.value = daylight

    const follow = cameraMode === 'follow'
    const target = movement.target
    const smooth = 1 - Math.exp(-delta * 5)
    const indoorResult = indoorCameraController.update(p, delta)
    const lookAhead = follow ? 3 * (1 - indoorResult.indoorRatio) : 0
    target.lerp(movement.desired.set(follow ? p.x - Math.sin(orbit.current.yaw) * lookAhead : 0, follow ? 1.4 + p.y * 0.5 : 1.5, follow ? p.z - Math.cos(orbit.current.yaw) * lookAhead : -6), smooth)
    const yaw = follow ? orbit.current.yaw : orbit.current.yaw + Math.sin(simulation.elapsed * 0.018) * 0.4
    const distance = follow ? THREE.MathUtils.lerp(orbit.current.distance, indoorResult.distance, indoorResult.indoorRatio) : 64
    const pitch = follow ? orbit.current.pitch : 0.63
    movement.desired.set(target.x + Math.sin(yaw) * Math.cos(pitch) * distance, target.y + Math.sin(pitch) * distance, target.z + Math.cos(yaw) * Math.cos(pitch) * distance)
    if (follow) {
      movement.direction.subVectors(movement.desired, target).normalize()
      movement.ray.set(target, movement.direction)
      let limit = distance
      for (const box of collisionBoxes) {
        const hit = movement.ray.intersectBox(box, movement.hit)
        if (hit) limit = Math.min(limit, Math.max(0.15, target.distanceTo(hit) - 0.15))
      }
      movement.desired.copy(target).addScaledVector(movement.direction, limit)
    }
    camera.position.lerp(movement.desired, 1 - Math.exp(-delta * 7))
    camera.lookAt(target)
    if (avatar.current) {
      avatar.current.visible = camera.position.distanceTo(target) > 0.85
    }

    const encounter = bistroEncounter.getState({ x: p.x, z: p.z })
    if (cupRef.current) {
      if (encounter.cupState === 'carried') {
        cupRef.current.position.set(p.x + Math.sin(p.yaw) * 0.4, p.y + 0.85, p.z + Math.cos(p.yaw) * 0.4)
      } else if (encounter.cupState === 'returned') {
        cupRef.current.position.set(DEFAULT_BISTRO_ANCHORS.returnTray.x, DEFAULT_BISTRO_ANCHORS.returnTray.height, DEFAULT_BISTRO_ANCHORS.returnTray.z)
      } else {
        cupRef.current.position.set(DEFAULT_BISTRO_ANCHORS.tableA.x, DEFAULT_BISTRO_ANCHORS.tableA.height, DEFAULT_BISTRO_ANCHORS.tableA.z)
      }
    }
    if (bistroInteriorRef.current) {
      bistroInteriorRef.current.visible = bistroVisibility.shouldRenderInterior({ x: camera.position.x, z: camera.position.z })
    }

    const now = performance.now()
    const measuredMs = rawDelta * 1000
    if (!document.hidden && !paused && !profile.current.skipNext && updateAdaptiveQuality(quality, measuredMs, now)) setSettings({ ...getQualitySettings(quality) })
    if (!document.hidden && !profile.current.skipNext && measuredMs > 0 && Number.isFinite(measuredMs)) {
      profile.current.intervals.push(measuredMs)
      if (profile.current.intervals.length > 240) profile.current.intervals.shift()
    }
    if (!document.hidden) profile.current.skipNext = false
    if (now - profile.current.lastEmission > 250) {
      profile.current.lastEmission = now
      const intervals = profile.current.intervals
      const mean = intervals.reduce((sum, ms) => sum + ms, 0) / Math.max(1, intervals.length)
      const sorted = [...intervals].sort((a, b) => a - b)
      snapshot.current = {
        ready: true, fps: mean > 0 ? 1000 / mean : 0, frameMs: mean,
        p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
        drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles,
        player: { x: p.x, y: p.y, z: p.z }, time: simulation.time,
        nearLandmark: simulation.nearLandmark, discovered: [...simulation.discovered],
        npcCount: settings.npcCount, petalCount: settings.petalCount,
        activeQuality: quality.tier, renderScale: gl.getPixelRatio(), wind: wind.value,
        backend: 'WebGL2', lighting: 'Hemisphere ambient + sun',
        bistroPrompt: encounter.promptText,
        bistroCanCancel: encounter.cupState === 'carried',
        bistroUnlocked: bistroEncounter.isUnlocked(),
      }
      onSnapshotRef.current(snapshot.current)
    }
  })

  return <>
    <fog attach="fog" args={['#c7ded9', 65, 205]} />
    <hemisphereLight ref={hemi} args={['#dbf1ff', '#a0b995', 2]} />
    <directionalLight ref={sun} position={[35, 55, -28]} intensity={3.3} color="#fff2d3" castShadow={settings.shadows}
      shadow-mapSize={[settings.shadowMapSize || 512, settings.shadowMapSize || 512]}
      shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={40} shadow-camera-bottom={-40}
      shadow-camera-near={1} shadow-camera-far={150} shadow-normalBias={0.045} shadow-bias={-0.00012} />
    <mesh ref={sunDisc}><sphereGeometry args={[5, 16, 12]} /><meshBasicMaterial color="#fff0c5" fog={false} /></mesh>
    <mesh ref={moonDisc}><sphereGeometry args={[3.6, 16, 12]} /><meshBasicMaterial color="#e6e9ec" fog={false} /></mesh>
    <Terrain vegetationDensity={settings.vegetationDensity} lowDetail={quality.tier === 'LOW' || quality.tier === 'LITE'} wind={wind} bistroInteriorRef={bistroInteriorRef} />
    {[-23, 23].map(x => <mesh key={x} position={[x, 0.016, -27]} rotation-x={-Math.PI / 2} material={water}><planeGeometry args={[38, 7.8]} /></mesh>)}
    <group ref={avatar}><Asset name="protagonist" lite={quality.tier === 'LOW' || quality.tier === 'LITE'} /></group>
    <group ref={companion}><Asset name="companion" lite={quality.tier === 'LOW' || quality.tier === 'LITE'} /></group>
    <group ref={shuttle}><Asset name="shuttle" lite={quality.tier === 'LOW' || quality.tier === 'LITE'} /></group>
    <group ref={cupRef}><Asset name="bistroCup" lite={quality.tier === 'LOW' || quality.tier === 'LITE'} /></group>
    <Citizens simulation={simulation} count={settings.npcCount} lite={quality.tier === 'LOW' || quality.tier === 'LITE'} />
    <Petals count={settings.petalCount} simulation={simulation} wind={wind} />
  </>
}
