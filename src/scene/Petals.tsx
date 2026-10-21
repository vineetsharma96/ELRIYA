import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { seededRandom, WORLD } from '../core/world'
import type { SimulationState } from '../core/types'

export interface TreeLeafSpawn {
  treeIndex: number
  spawnX: number
  spawnY: number
  spawnZ: number
  canopyRadius: number
  kind: 'sakura_petal' | 'blush_petal' | 'cherry_leaf'
  phase: number
}

/**
 * Generates deterministic canopy spawn points inside the crowns of WORLD.trees
 * so falling leaves and blossom petals originate directly from tree branches.
 */
export function generateTreeCanopySpawns(count: number, seed = 792): TreeLeafSpawn[] {
  const random = seededRandom(seed)
  const trees = WORLD.trees
  const spawns: TreeLeafSpawn[] = []
  for (let i = 0; i < count; i++) {
    const treeIndex = i % trees.length
    const tree = trees[treeIndex]
    const angle = random() * Math.PI * 2
    // Concentrate spawns within the outer and mid foliage clusters of the tree crown
    const localRadius = (0.35 + Math.sqrt(random()) * 1.95) * tree.scale
    const canopyHeight = (2.65 + random() * 2.25) * tree.scale
    const spawnX = tree.x + Math.cos(angle) * localRadius
    const spawnZ = tree.z + Math.sin(angle) * localRadius
    const roll = random()
    const kind = roll < 0.48 ? 'sakura_petal' : roll < 0.74 ? 'blush_petal' : 'cherry_leaf'
    spawns.push({
      treeIndex,
      spawnX,
      spawnY: canopyHeight,
      spawnZ,
      canopyRadius: localRadius,
      kind,
      phase: random() * Math.PI * 2,
    })
  }
  return spawns
}

export function Petals({ count, simulation, wind }: { count: number; simulation: SimulationState; wind: { value: number } }) {
  // Multiply particle budget so every tree across the remapped city sheds a rich stream of leaves & petals
  const instanceCount = Math.max(450, count * 3)

  const { geometry, material } = useMemo(() => {
    const plane = new THREE.PlaneGeometry(0.14, 0.21, 1, 2)
    const geometry = new THREE.InstancedBufferGeometry()
    geometry.index = plane.index
    geometry.attributes = plane.attributes
    geometry.instanceCount = instanceCount

    const spawns = generateTreeCanopySpawns(instanceCount, 792)
    const random = seededRandom(1924)

    const aSpawn = new Float32Array(instanceCount * 4)
    const aMotion = new Float32Array(instanceCount * 4)

    for (let i = 0; i < instanceCount; i++) {
      const s = spawns[i]
      aSpawn[i * 4 + 0] = s.spawnX
      aSpawn[i * 4 + 1] = s.spawnY
      aSpawn[i * 4 + 2] = s.spawnZ
      aSpawn[i * 4 + 3] = s.kind === 'cherry_leaf' ? 0.85 : s.kind === 'blush_petal' ? 0.45 : 0.15

      aMotion[i * 4 + 0] = s.phase
      aMotion[i * 4 + 1] = 0.65 + random() * 0.55 // individual fall speed multiplier
      aMotion[i * 4 + 2] = (random() - 0.5) * 2.0 // lateral spiral direction
      aMotion[i * 4 + 3] = 0.78 + random() * 0.48 // leaf scale variation
    }

    geometry.setAttribute('aSpawn', new THREE.InstancedBufferAttribute(aSpawn, 4))
    geometry.setAttribute('aMotion', new THREE.InstancedBufferAttribute(aMotion, 4))

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWind: { value: 0.6 },
        uPlayer: { value: new THREE.Vector3() },
        uCompanion: { value: new THREE.Vector3() },
        uVehicle: { value: new THREE.Vector3() },
      },
      vertexShader: `
        attribute vec4 aSpawn;
        attribute vec4 aMotion;
        uniform float uTime;
        uniform float uWind;
        uniform vec3 uPlayer;
        uniform vec3 uCompanion;
        uniform vec3 uVehicle;
        varying vec2 vUv;
        varying float vKind;
        varying float vFlutter;
        varying float vGroundFade;

        void main() {
          vUv = uv;
          vKind = aSpawn.w;

          float phase = aMotion.x;
          float speedMul = aMotion.y;
          float spiralSign = aMotion.z;
          float leafScale = aMotion.w;

          // Cycle progress 0..1: [0..0.82] falling from tree canopy to ground, [0.82..1.0] resting on ground then fading
          float cycleRate = (0.11 + speedMul * 0.055) * (0.9 + uWind * 0.22);
          float life = fract(uTime * cycleRate + phase * 0.15915);
          float fallProgress = clamp(life / 0.82, 0.0, 1.0);
          float groundRest = clamp((life - 0.82) / 0.18, 0.0, 1.0);
          vGroundFade = 1.0 - smoothstep(0.55, 1.0, groundRest);

          // Start inside the tree's branch canopy (aSpawn.xyz) and fall to y = 0.025
          vec3 p = aSpawn.xyz;
          float currentHeight = mix(aSpawn.y, 0.025, fallProgress);
          // Subtle upward thermal flutter during mid-fall
          float thermal = sin(fallProgress * 12.566 + phase) * 0.12 * (1.0 - fallProgress);
          p.y = max(0.02, currentHeight + thermal);

          // Wind-driven lateral drift & helical spiral as the leaf falls away from the branch
          float fallDist = fallProgress;
          float gust = 0.65 + uWind * 1.45;
          float spiralRadius = (0.28 + 0.65 * fallDist) * gust;
          p.x += sin(uTime * 1.35 + phase + fallDist * 5.2) * spiralRadius + fallDist * uWind * 1.85 * spiralSign;
          p.z += cos(uTime * 1.05 + phase * 1.3 + fallDist * 4.6) * spiralRadius + fallDist * uWind * 0.95;

          // Interactive wake around player, companion, and shuttle
          vec2 d = p.xz - uPlayer.xz;
          float radius = length(d);
          float playerWake = (1.0 - smoothstep(0.0, 2.9, radius));
          p.xz += normalize(d + vec2(0.001)) * playerWake * 1.45;
          p.y += playerWake * max(0.0, 1.0 - p.y * 0.25) * 0.72;

          vec2 dc = p.xz - uCompanion.xz;
          p.xz += normalize(dc + vec2(0.001)) * (1.0 - smoothstep(0.0, 1.8, length(dc))) * 0.9;

          vec2 dv = p.xz - uVehicle.xz;
          p.xz += normalize(dv + vec2(0.001)) * (1.0 - smoothstep(0.0, 4.2, length(dv))) * 1.85;

          // 3D leaf camber (curved petal/leaf profile) & tumbling rotation
          vec3 localPos = position * leafScale;
          // Slightly larger size for serrated cherry leaves
          if (vKind > 0.7) {
            localPos.x *= 1.15;
            localPos.y *= 1.32;
          }
          // Gentle cup/curl along the leaf blade
          localPos.z += sin(uv.y * 3.14159) * 0.026 * leafScale;

          float activeSpin = 1.0 - smoothstep(0.0, 0.25, groundRest);
          float tumbleA = (uTime * (2.2 + speedMul) + phase) * activeSpin + phase;
          float tumbleB = (uTime * (1.6 + spiralSign * 0.7) + phase * 1.7) * activeSpin + phase * 0.5;
          vFlutter = sin(tumbleA) * cos(tumbleB);

          // Rotate in 3D space before projecting
          float ca = cos(tumbleA), sa = sin(tumbleA);
          float cb = cos(tumbleB), sb = sin(tumbleB);
          vec3 rotated = vec3(
            localPos.x * ca - localPos.y * sa,
            (localPos.x * sa + localPos.y * ca) * cb - localPos.z * sb,
            (localPos.x * sa + localPos.y * ca) * sb + localPos.z * cb
          );
          // Flatten onto pavement when resting on the ground
          rotated.y = mix(rotated.y, 0.008, smoothstep(0.0, 0.35, groundRest));

          vec4 worldPosition = vec4(p + rotated, 1.0);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying float vKind;
        varying float vFlutter;
        varying float vGroundFade;

        void main() {
          // Local coordinates in [-1, 1]
          vec2 p = vUv * 2.0 - 1.0;

          if (vKind > 0.7) {
            // Pointed cherry tree leaf silhouette with tapered base, acuminate tip, and central vein
            float widthEnvelope = sin(clamp(vUv.y, 0.0, 1.0) * 3.14159) * (1.0 - 0.22 * vUv.y);
            // Subtle serrated leaf margin
            float serration = sin(vUv.y * 28.0) * 0.045 * smoothstep(0.15, 0.85, vUv.y);
            float leafHalfWidth = max(0.02, widthEnvelope * 0.78 + serration);
            if (abs(p.x) > leafHalfWidth || vUv.y < 0.02 || vUv.y > 0.98) discard;

            // Central midrib & lateral leaf veins
            float midrib = 1.0 - smoothstep(0.0, 0.09, abs(p.x));
            float sideVein = 1.0 - smoothstep(0.0, 0.06, abs(fract((vUv.y - abs(p.x) * 0.55) * 6.0) - 0.5));
            vec3 leafBase = mix(vec3(0.42, 0.64, 0.34), vec3(0.58, 0.76, 0.41), vUv.y);
            // Warm sunlit gold/Chartreuse tint on the tip
            leafBase = mix(leafBase, vec3(0.84, 0.78, 0.42), smoothstep(0.68, 1.0, vUv.y) * 0.45);
            vec3 veinColor = vec3(0.68, 0.83, 0.49);
            vec3 finalLeaf = mix(leafBase, veinColor, max(midrib * 0.55, sideVein * 0.22)) + vFlutter * 0.05;
            gl_FragColor = vec4(finalLeaf, 0.93 * vGroundFade);
          } else {
            // Notched heart-shaped Sakura blossom petal silhouette
            float notch = smoothstep(0.35, 1.0, p.y) * 0.34 * exp(-p.x * p.x * 14.0);
            vec2 q = vec2(p.x * 1.12, p.y + notch);
            float dist = dot(q, q);
            if (dist > 1.0) discard;

            vec3 petalOuter = vKind > 0.3 ? vec3(0.99, 0.75, 0.81) : vec3(0.97, 0.62, 0.71);
            vec3 petalBase = vec3(1.0, 0.93, 0.95);
            vec3 col = mix(petalBase, petalOuter, smoothstep(-0.6, 0.75, p.y)) + vFlutter * 0.04;
            gl_FragColor = vec4(col, 0.90 * vGroundFade);
          }

          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    return { geometry, material }
  }, [instanceCount])

  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])
  useFrame(() => {
    material.uniforms.uTime.value = simulation.elapsed
    material.uniforms.uWind.value = wind.value
    material.uniforms.uPlayer.value.set(simulation.player.x, 0, simulation.player.z)
    material.uniforms.uCompanion.value.set(simulation.companion.x, 0, simulation.companion.z)
    material.uniforms.uVehicle.value.set(simulation.shuttle.x, 0, simulation.shuttle.z)
  })
  return <mesh geometry={geometry} material={material} frustumCulled={false} />
}

export function RainDrops({ count = 650, simulation, wind }: { count?: number; simulation: SimulationState; wind: { value: number } }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const { geometry, material } = useMemo(() => {
    const plane = new THREE.PlaneGeometry(0.022, 0.65)
    const geometry = new THREE.InstancedBufferGeometry()
    geometry.index = plane.index
    geometry.attributes = plane.attributes
    geometry.instanceCount = count
    const random = seededRandom(4190)
    const offsets = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      offsets[i * 3] = (random() - 0.5) * 68
      offsets[i * 3 + 1] = random() * 18
      offsets[i * 3 + 2] = (random() - 0.5) * 68
      phases[i] = random() * 6.28
    }
    geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3))
    geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1))
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWind: { value: 0.6 },
        uRainIntensity: { value: 0 },
        uCenter: { value: new THREE.Vector3() },
      },
      vertexShader: `attribute vec3 aOffset; attribute float aPhase;
        uniform float uTime; uniform float uWind; uniform float uRainIntensity; uniform vec3 uCenter;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          float fallSpeed = 13.5 + aPhase * 0.7;
          vec3 p = aOffset;
          p.x = uCenter.x + mod(aOffset.x - uCenter.x + uTime * uWind * 1.6 + 34.0, 68.0) - 34.0;
          p.z = uCenter.z + mod(aOffset.z - uCenter.z + 34.0, 68.0) - 34.0;
          p.y = mod(aOffset.y - uTime * fallSpeed, 18.0);
          vec3 streak = position;
          float slant = uWind * 0.14;
          streak.x += streak.y * slant;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          mv.xyz += streak;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying vec2 vUv; uniform float uRainIntensity;
        void main() {
          float edge = 1.0 - abs(vUv.x * 2.0 - 1.0);
          float tip = sin(vUv.y * 3.14159);
          float alpha = edge * tip * uRainIntensity * 0.42;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(0.84, 0.91, 0.96, alpha);
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    return { geometry, material }
  }, [count])

  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])

  useFrame(() => {
    const rain = simulation.weather?.rainIntensity ?? 0
    if (meshRef.current) {
      meshRef.current.visible = rain > 0.015
    }
    if (rain > 0.015) {
      material.uniforms.uTime.value = simulation.elapsed
      material.uniforms.uWind.value = wind.value
      material.uniforms.uRainIntensity.value = rain
      material.uniforms.uCenter.value.set(simulation.player.x, 0, simulation.player.z)
    }
  })

  return <mesh ref={meshRef} visible={false} geometry={geometry} material={material} frustumCulled={false} />
}
