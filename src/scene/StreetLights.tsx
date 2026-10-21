import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { WORLD } from '../core/world'
import type { Point2, StreetLampPlacement } from '../core/types'

/**
 * Selects the N street lamps closest to the given viewer position so real PointLights
 * always illuminate the roads and sidewalks around the player without exceeding WebGL shader light limits.
 */
export function selectNearestStreetLamps(
  lamps: StreetLampPlacement[],
  viewer: Point2,
  maxLights = 8
): StreetLampPlacement[] {
  return [...lamps]
    .sort((a, b) => {
      const da = (a.globeX - viewer.x) ** 2 + (a.globeZ - viewer.z) ** 2
      const db = (b.globeX - viewer.x) ** 2 + (b.globeZ - viewer.z) ** 2
      return da - db
    })
    .slice(0, Math.min(maxLights, lamps.length))
}

export function StreetLightingSystem({
  lightingState,
  playerPosition,
  lite = false,
}: {
  lightingState: { streetLampIntensity: number; streetLampActive: boolean }
  playerPosition: Point2
  lite?: boolean
}) {
  const lamps = WORLD.streetLamps
  const poolCount = lite ? 4 : 8
  const groupRef = useRef<THREE.Group>(null!)
  const groundPoolRef = useRef<THREE.InstancedMesh>(null!)
  const coneRef = useRef<THREE.InstancedMesh>(null!)
  const haloRef = useRef<THREE.InstancedMesh>(null!)
  const pointLightRefs = useRef<(THREE.PointLight | null)[]>([])

  const {
    groundGeo,
    groundMat,
    coneGeo,
    coneMat,
    haloGeo,
    haloMat,
    uniforms,
  } = useMemo(() => {
    const uniforms = {
      uIntensity: { value: 0 },
    }

    // 1. Ground light pool projected onto roads & sidewalks beneath each lantern globe
    const groundGeo = new THREE.PlaneGeometry(8.8, 8.8)
    groundGeo.rotateX(-Math.PI / 2)
    const groundMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uIntensity;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 1.0 || uIntensity <= 0.005) discard;
          float falloff = pow(1.0 - r, 2.2);
          float core = pow(max(0.0, 1.0 - r * 1.45), 3.0);
          vec3 warmOuter = vec3(0.96, 0.63, 0.28);
          vec3 warmCore = vec3(1.0, 0.86, 0.56);
          vec3 col = mix(warmOuter, warmCore, core);
          gl_FragColor = vec4(col, (falloff * 0.36 + core * 0.18) * uIntensity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    })

    // 2. Soft downward volumetric light cone from the lantern globe toward the pavement
    const coneGeo = new THREE.CylinderGeometry(0.24, 1.95, 2.85, 16, 1, true)
    const coneMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uIntensity;
        void main() {
          if (uIntensity <= 0.005) discard;
          // vUv.y = 1 at top (lantern globe), 0 at bottom (near sidewalk/road)
          float verticalFade = pow(vUv.y, 1.35) * smoothstep(0.0, 0.22, vUv.y);
          vec3 coneColor = vec3(1.0, 0.78, 0.44);
          gl_FragColor = vec4(coneColor, verticalFade * 0.11 * uIntensity);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })

    // 3. Warm lantern bulb halo around each street lamp globe
    const haloGeo = new THREE.SphereGeometry(0.46, 14, 10)
    const haloMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform float uIntensity;
        void main() {
          if (uIntensity <= 0.005) discard;
          float glow = 0.42 * uIntensity;
          gl_FragColor = vec4(1.0, 0.82, 0.48, glow);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return { groundGeo, groundMat, coneGeo, coneMat, haloGeo, haloMat, uniforms }
  }, [])

  useEffect(
    () => () => {
      groundGeo.dispose()
      groundMat.dispose()
      coneGeo.dispose()
      coneMat.dispose()
      haloGeo.dispose()
      haloMat.dispose()
    },
    [groundGeo, groundMat, coneGeo, coneMat, haloGeo, haloMat]
  )

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    lamps.forEach((lamp, i) => {
      // Ground pool on road & sidewalk surface
      dummy.position.set(lamp.globeX, 0.068, lamp.globeZ)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      groundPoolRef.current.setMatrixAt(i, dummy.matrix)

      // Volumetric light cone suspended below lantern globe
      dummy.position.set(lamp.globeX, 1.68, lamp.globeZ)
      dummy.updateMatrix()
      coneRef.current.setMatrixAt(i, dummy.matrix)

      // Lantern globe halo at y = 3.14
      dummy.position.set(lamp.globeX, lamp.globeY, lamp.globeZ)
      dummy.updateMatrix()
      haloRef.current.setMatrixAt(i, dummy.matrix)
    })
    groundPoolRef.current.instanceMatrix.needsUpdate = true
    groundPoolRef.current.computeBoundingSphere()
    coneRef.current.instanceMatrix.needsUpdate = true
    coneRef.current.computeBoundingSphere()
    haloRef.current.instanceMatrix.needsUpdate = true
    haloRef.current.computeBoundingSphere()
  }, [lamps])

  useFrame(() => {
    const intensity = lightingState.streetLampIntensity
    const active = lightingState.streetLampActive && intensity > 0.01

    if (groupRef.current) {
      groupRef.current.visible = active
    }
    uniforms.uIntensity.value = intensity

    if (!active) {
      for (let i = 0; i < poolCount; i++) {
        const light = pointLightRefs.current[i]
        if (light) {
          light.visible = false
          light.intensity = 0
        }
      }
      return
    }

    const nearest = selectNearestStreetLamps(lamps, playerPosition, poolCount)
    for (let i = 0; i < poolCount; i++) {
      const light = pointLightRefs.current[i]
      const targetLamp = nearest[i]
      if (light && targetLamp) {
        light.visible = true
        light.position.set(targetLamp.globeX, targetLamp.globeY - 0.12, targetLamp.globeZ)
        light.intensity = intensity * 2.35
      }
    }
  })

  return (
    <group ref={groupRef} visible={false}>
      <instancedMesh ref={groundPoolRef} args={[groundGeo, groundMat, lamps.length]} renderOrder={2} />
      <instancedMesh ref={coneRef} args={[coneGeo, coneMat, lamps.length]} renderOrder={3} />
      <instancedMesh ref={haloRef} args={[haloGeo, haloMat, lamps.length]} renderOrder={4} />
      {Array.from({ length: poolCount }, (_, i) => (
        <pointLight
          key={`street-point-light-${i}`}
          ref={el => {
            pointLightRefs.current[i] = el
          }}
          color="#ffbf69"
          intensity={0}
          distance={16.5}
          decay={1.75}
          castShadow={false}
        />
      ))}
    </group>
  )
}
