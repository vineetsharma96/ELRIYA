import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Asset, Citizens, ProceduralCharacter } from './Assets'
import { TrafficFleet } from './BlendKitAssets'
import { Terrain, createCanalMaterial } from './Terrain'
import { PlazaFountain } from './PlazaFountain'
import { ExperimentalTree } from './ExperimentalTree'
import { SakuraTree } from './SakuraTree'
import { Petals, RainDrops } from './Petals'
import { StreetLightingSystem } from './StreetLights'
import { BloomPostProcessing } from './BloomPostProcessing'
import { Ambience } from './audio'
import { computeScheduledWeather, createSimulation, stepSimulation } from '../core/simulation'
import { createInput, type InputController } from '../core/input'
import { createQualityState, getQualitySettings, resetQualitySampling, setQualityMode, updateAdaptiveQuality, type QualitySettings } from '../core/quality'
import { WORLD, getLandmark, CAMERA_OBSTACLES_3D } from '../core/world'
import { createBistroEncounter, DEFAULT_BISTRO_ANCHORS } from '../core/bistroEncounter'
import { BistroVisibilityManager } from './bistroVisibility'
import { IndoorCameraController } from './indoorCamera'
import {
  AVATAR_HIDE_DISTANCE,
  CameraGestureTracker,
  applyWheelZoom,
  computeRightShoulderPose,
  createDefaultOrbitState,
  getInitialRightShoulderCamera,
} from './cameraRig'
import { EnvironmentLightingController } from './lighting'
import { INITIAL_SNAPSHOT, type WorldCanvasProps, type WorldSnapshot } from './types'

const INITIAL_CAMERA_RIG = getInitialRightShoulderCamera(WORLD.spawn)
const CAMERA = { position: INITIAL_CAMERA_RIG.position, fov: 46, near: 0.1, far: 220 }
const RENDERER = { antialias: true, alpha: false, powerPreference: 'high-performance' as const, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }
const HDR_SUN_COLOR = new THREE.Color(2.35, 1.98, 1.38)
const HDR_MOON_COLOR = new THREE.Color(1.48, 1.66, 2.05)

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
  const lightingController = useMemo(() => new EnvironmentLightingController(simulation.time), [simulation])
  const cupRef = useRef<THREE.Group>(null!)
  const bistroInteriorRef = useRef<THREE.Group>(null!)
  const bistroVisibility = useMemo(() => new BistroVisibilityManager(), [])
  const [settings, setSettings] = useState(() => getQualitySettings(quality))
  const input = useRef<InputController | null>(null)
  const wind = useMemo(() => ({ value: 0.6, time: 0 }), [])
  const sakuraFallDensity = useMemo(() => ({ value: 1.0 }), [])
  const bloomIntensity = useMemo(() => ({ value: 1.0 }), [])
  const ambience = useMemo(() => new Ambience(), [])
  const orbit = useRef(createDefaultOrbitState())
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
  const movement = useMemo(() => ({
    target: new THREE.Vector3(...INITIAL_CAMERA_RIG.target),
    desired: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    ray: new THREE.Ray(),
    hit: new THREE.Vector3(),
    sky: new THREE.Color(),
    sun: new THREE.Color(),
    rig: {
      spine: new THREE.Vector3(),
      pivot: new THREE.Vector3(),
      target: new THREE.Vector3(),
      cameraPos: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      hit: new THREE.Vector3(),
      ray: new THREE.Ray(),
    },
  }), [])
  const collisionBoxes = useMemo(() => CAMERA_OBSTACLES_3D.map(b => new THREE.Box3(
    new THREE.Vector3(b.min[0], b.min[1], b.min[2]),
    new THREE.Vector3(b.max[0], b.max[1], b.max[2])
  ).expandByScalar(0.12)), [])
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
    gl.shadowMap.type = THREE.PCFShadowMap
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
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach(material => { if (material) material.needsUpdate = true })
      }
    })
    const windows = new Set<THREE.MeshStandardMaterial>()
    const colourWindows = new Set<{ value: number }>()
    scene.traverse(child => {
      if (child instanceof THREE.Mesh && child.material) {
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
          if (!material) continue
          if (material instanceof THREE.MeshStandardMaterial && material.emissive.getHex() !== 0) windows.add(material)
          if (material.userData?.elyriaNight) colourWindows.add(material.userData.elyriaNight)
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
  const activeAmbienceRef = useRef<Ambience | null>(null)
  const activeWaterRef = useRef<THREE.ShaderMaterial | null>(null)
  useEffect(() => {
    activeAmbienceRef.current = ambience
    activeWaterRef.current = water
    return () => {
      activeAmbienceRef.current = null
      activeWaterRef.current = null
      const oldAmbience = ambience
      const oldWater = water
      queueMicrotask(() => {
        if (activeAmbienceRef.current !== oldAmbience) oldAmbience.dispose()
        if (activeWaterRef.current !== oldWater) oldWater.dispose()
      })
    }
  }, [ambience, water])
  useEffect(() => {
    apiRef.current = {
      setTime: value => {
        const normalized = ((value % 24) + 24) % 24
        simulation.time = normalized
        snapshot.current.time = normalized
      },
      setWind: value => { wind.value = THREE.MathUtils.clamp(value, 0, 2) },
      setSakuraFallDensity: value => {
        const clamped = THREE.MathUtils.clamp(value, 0, 3)
        sakuraFallDensity.value = clamped
        snapshot.current.sakuraFallDensity = clamped
      },
      setBloomIntensity: value => {
        const clamped = THREE.MathUtils.clamp(value, 0, 2)
        bloomIntensity.value = clamped
        snapshot.current.bloomIntensity = clamped
      },
      setWeather: mode => {
        if (mode === 'auto') {
          const scheduled = computeScheduledWeather(simulation.elapsed)
          simulation.weather.autoCycle = true
          simulation.weather.condition = scheduled.condition
        } else {
          simulation.weather.autoCycle = false
          simulation.weather.condition = mode
        }
      },
      resetPlayer: () => {
        const fresh = createSimulation()
        Object.assign(simulation.player, fresh.player)
        Object.assign(simulation.companion, fresh.companion)
        orbit.current = createDefaultOrbitState()
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
  }, [apiRef, input, simulation, wind, sakuraFallDensity, bloomIntensity, bistroEncounter])
  useEffect(() => {
    const canvas = gl.domElement
    const gestures = new CameraGestureTracker()
    const down = (event: PointerEvent) => {
      if (simulation.paused) return
      if (event.pointerType !== 'touch' && event.button > 0) return
      gestures.onPointerDown(event.pointerId, event.clientX, event.clientY)
      try {
        canvas.setPointerCapture(event.pointerId)
      } catch {
        // Synthetic or detached pointers may not support capture
      }
    }
    const move = (event: PointerEvent) => {
      if (simulation.paused) {
        gestures.clear()
        return
      }
      gestures.onPointerMove(event.pointerId, event.clientX, event.clientY, orbit.current)
    }
    const up = (event: PointerEvent) => {
      gestures.onPointerUp(event.pointerId)
    }
    const onBlur = () => {
      gestures.clear()
    }
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      if (!simulation.paused) {
        orbit.current.targetDistance = applyWheelZoom(orbit.current.targetDistance, event.deltaY, event.ctrlKey)
      }
    }
    const blockNativePinchTouch = (event: TouchEvent) => {
      if (event.touches.length >= 2) event.preventDefault()
    }
    const blockSafariGesture = (event: Event) => {
      event.preventDefault()
    }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('lostpointercapture', up)
    canvas.addEventListener('wheel', wheel, { passive: false })
    canvas.addEventListener('touchstart', blockNativePinchTouch, { passive: false })
    canvas.addEventListener('touchmove', blockNativePinchTouch, { passive: false })
    canvas.addEventListener('gesturestart', blockSafariGesture, { passive: false })
    canvas.addEventListener('gesturechange', blockSafariGesture, { passive: false })
    window.addEventListener('blur', onBlur)
    return () => {
      gestures.clear()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('lostpointercapture', up)
      canvas.removeEventListener('wheel', wheel)
      canvas.removeEventListener('touchstart', blockNativePinchTouch)
      canvas.removeEventListener('touchmove', blockNativePinchTouch)
      canvas.removeEventListener('gesturestart', blockSafariGesture)
      canvas.removeEventListener('gesturechange', blockSafariGesture)
      window.removeEventListener('blur', onBlur)
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

    const env = lightingController.update(simulation.time, delta, false, simulation.weather)
    sun.current.position.copy(env.keyLightPosition)
    sun.current.intensity = env.sunIntensity
    sun.current.color.copy(env.sunColor)
    hemi.current.intensity = env.hemiIntensity
    hemi.current.color.copy(env.hemiSkyColor)
    hemi.current.groundColor.copy(env.hemiGroundColor)
    emissive.current.forEach(material => { material.emissiveIntensity = env.emissiveIntensity })
    nightUniforms.current.forEach(uniform => { uniform.value = env.emissiveIntensity })
    movement.sky.copy(env.skyColor)
    scene.background = movement.sky
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(movement.sky)
      scene.fog.near = env.fogNear
      scene.fog.far = env.fogFar
    }
    sunDisc.current.position.copy(env.sunDiscPosition)
    sunDisc.current.scale.setScalar(Math.max(0.001, env.sunScale))
    sunDisc.current.visible = env.sunScale > 0.01
    moonDisc.current.position.copy(env.moonDiscPosition)
    moonDisc.current.scale.setScalar(Math.max(0.001, env.moonScale))
    moonDisc.current.visible = env.moonScale > 0.01
    water.uniforms.uTime.value = simulation.elapsed
    water.uniforms.uDay.value = env.daylight * (1 - env.cloudCover * 0.25)

    const follow = cameraMode === 'follow'
    const target = movement.target
    const indoorResult = indoorCameraController.update(p, delta)
    orbit.current.distance = THREE.MathUtils.damp(orbit.current.distance, orbit.current.targetDistance, 11, delta)

    if (follow) {
      const indoorClamped = Math.min(orbit.current.distance, indoorResult.distance)
      const distance = THREE.MathUtils.lerp(orbit.current.distance, indoorClamped, indoorResult.indoorRatio)
      computeRightShoulderPose(
        p,
        orbit.current.yaw,
        orbit.current.pitch,
        distance,
        indoorResult.indoorRatio,
        collisionBoxes,
        movement.rig,
      )
      const followSmooth = 1 - Math.exp(-delta * 10)
      target.lerp(movement.rig.target, followSmooth)
      camera.position.lerp(movement.rig.cameraPos, followSmooth)
    } else {
      const vistaSmooth = 1 - Math.exp(-delta * 5)
      target.lerp(movement.desired.set(0, 1.5, -6), vistaSmooth)
      const yaw = orbit.current.yaw + Math.sin(simulation.elapsed * 0.018) * 0.4
      const distance = 64
      const pitch = 0.63
      movement.desired.set(
        target.x + Math.sin(yaw) * Math.cos(pitch) * distance,
        target.y + Math.sin(pitch) * distance,
        target.z + Math.cos(yaw) * Math.cos(pitch) * distance,
      )
      camera.position.lerp(movement.desired, 1 - Math.exp(-delta * 7))
    }
    camera.lookAt(target)
    // Hide the protagonist only if a tight wall collision forces the camera inside the character.
    movement.direction.set(p.x, p.y + 1.4, p.z)
    avatar.current.visible = camera.position.distanceTo(movement.direction) > AVATAR_HIDE_DISTANCE

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

    // Update 3D spatial audio listener, weather-reactive soundscape, and localized cherry blossom cluster birdsong
    movement.direction.subVectors(target, camera.position).normalize()
    const spatialAudio = ambience.updateSpatial(
      {
        x: p.x,
        y: p.y + 1.4,
        z: p.z,
        forwardX: movement.direction.x,
        forwardY: movement.direction.y,
        forwardZ: movement.direction.z,
      },
      env.daylight,
      wind.value,
      delta,
      {
        condition: env.weatherCondition,
        cloudCover: env.cloudCover,
        rainIntensity: env.rainIntensity,
      }
    )
    const weatherAudioMix = ambience.getWeatherMix()

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
      const activeNpcCount = Math.min(
        simulation.npcs.length,
        settings.npcCount >= 16 ? 36 : settings.npcCount >= 10 ? 28 : settings.npcCount >= 6 ? 18 : settings.npcCount * 3
      )
      snapshot.current = {
        ready: true, fps: mean > 0 ? 1000 / mean : 0, frameMs: mean,
        p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
        drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles,
        player: { x: p.x, y: p.y, z: p.z }, time: simulation.time,
        nearLandmark: simulation.nearLandmark, discovered: new Set(simulation.discovered),
        npcCount: activeNpcCount, petalCount: settings.petalCount,
        activeQuality: quality.tier, renderScale: gl.getPixelRatio(), wind: wind.value,
        sakuraFallDensity: sakuraFallDensity.value,
        bloomIntensity: bloomIntensity.value,
        backend: 'WebGL2', lighting: 'Hemisphere ambient + sun + HDR bloom',
        weather: env.weatherCondition,
        cloudCover: env.cloudCover,
        rainIntensity: env.rainIntensity,
        weatherAuto: simulation.weather.autoCycle,
        streetLightsOn: env.streetLampActive,
        streetLightIntensity: env.streetLampIntensity,
        bistroPrompt: encounter.promptText,
        bistroCanCancel: encounter.cupState === 'carried',
        bistroUnlocked: bistroEncounter.isUnlocked(),
        spatialAudioCluster: spatialAudio.activeCluster ? `${spatialAudio.activeCluster.id} (${spatialAudio.activeCluster.treeCount} trees)` : 'None',
        spatialBirdIntensity: spatialAudio.intensity,
        weatherAudioProfile: weatherAudioMix.label,
      }
      onSnapshotRef.current(snapshot.current)
    }
  })

  const renderedNpcCount = Math.min(
    simulation.npcs.length,
    settings.npcCount >= 16 ? 36 : settings.npcCount >= 10 ? 28 : settings.npcCount >= 6 ? 18 : settings.npcCount * 3
  )

  return <>
    <fog attach="fog" args={['#c7ded9', 65, 220]} />
    <hemisphereLight ref={hemi} args={['#dbf1ff', '#a0b995', 2]} />
    <directionalLight ref={sun} position={[35, 55, -28]} intensity={3.3} color="#fff2d3" castShadow={settings.shadows}
      shadow-mapSize={[settings.shadowMapSize || 512, settings.shadowMapSize || 512]}
      shadow-camera-left={-56} shadow-camera-right={56} shadow-camera-top={52} shadow-camera-bottom={-52}
      shadow-camera-near={1} shadow-camera-far={165} shadow-normalBias={0.045} shadow-bias={-0.00012} />
    <mesh ref={sunDisc}><sphereGeometry args={[5, 16, 12]} /><meshBasicMaterial color={HDR_SUN_COLOR} toneMapped={false} fog={false} /></mesh>
    <mesh ref={moonDisc}><sphereGeometry args={[3.6, 16, 12]} /><meshBasicMaterial color={HDR_MOON_COLOR} toneMapped={false} fog={false} /></mesh>
    <Terrain vegetationDensity={settings.vegetationDensity} lowDetail={quality.tier === 'LOW' || quality.tier === 'LITE'} wind={wind} lightingState={lightingController.state} bistroInteriorRef={bistroInteriorRef} />
    <PlazaFountain wind={wind} lightingState={lightingController.state} simulation={simulation} lowDetail={quality.tier === 'LOW' || quality.tier === 'LITE'} />
    <ExperimentalTree wind={wind} lightingState={lightingController.state} lowDetail={quality.tier === 'LOW' || quality.tier === 'LITE'} />
    <SakuraTree wind={wind} fallDensityRef={sakuraFallDensity} lightingState={lightingController.state} simulation={simulation} lowDetail={quality.tier === 'LOW' || quality.tier === 'LITE'} />
    <StreetLightingSystem lightingState={lightingController.state} playerPosition={simulation.player} lite={quality.tier === 'LOW' || quality.tier === 'LITE'} />
    {/* Recessed Sunpetal Canal animated water flowing beneath all three bridges at y = -0.14 */}
    <mesh position={[0, -0.14, -27]} rotation-x={-Math.PI / 2} material={water}>
      <planeGeometry args={[112, 7.8]} />
    </mesh>
    <group ref={avatar}><ProceduralCharacter kind="protagonist" lite={quality.tier === 'LOW' || quality.tier === 'LITE'} /></group>
    <group ref={companion}><ProceduralCharacter kind="companion" lite={quality.tier === 'LOW' || quality.tier === 'LITE'} /></group>
    <group ref={shuttle} visible={false}><Asset name="shuttle" lite={quality.tier === 'LOW' || quality.tier === 'LITE'} /></group>
    <TrafficFleet simulation={simulation} lite={quality.tier === 'LOW' || quality.tier === 'LITE'} />
    <group ref={cupRef}><Asset name="bistroCup" lite={quality.tier === 'LOW' || quality.tier === 'LITE'} /></group>
    <Citizens simulation={simulation} count={renderedNpcCount} lite={quality.tier === 'LOW' || quality.tier === 'LITE'} />
    <Petals count={settings.petalCount} simulation={simulation} wind={wind} />
    <RainDrops count={Math.max(220, Math.round(settings.petalCount * 0.75))} simulation={simulation} wind={wind} />
    <BloomPostProcessing lightingState={lightingController.state} qualityTier={quality.tier} bloomIntensityRef={bloomIntensity} />
  </>
}


