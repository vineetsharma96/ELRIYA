import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { seededRandom } from '../core/world'
import type { SimulationState } from '../core/types'

export function Petals({ count, simulation, wind }: { count: number; simulation: SimulationState; wind: { value: number } }) {
  const { geometry, material } = useMemo(() => {
    const plane = new THREE.PlaneGeometry(0.1, 0.17)
    const geometry = new THREE.InstancedBufferGeometry()
    geometry.index = plane.index
    geometry.attributes = plane.attributes
    geometry.instanceCount = count
    const random = seededRandom(792)
    const offsets = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      offsets[i * 3] = (random() - 0.5) * 62
      offsets[i * 3 + 1] = random() * 13
      offsets[i * 3 + 2] = (random() - 0.5) * 60
      phases[i] = random() * 6.28
    }
    geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3))
    geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1))
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uWind: { value: 0.6 }, uPlayer: { value: new THREE.Vector3() }, uVehicle: { value: new THREE.Vector3() } },
      vertexShader: `attribute vec3 aOffset; attribute float aPhase; uniform float uTime; uniform float uWind; uniform vec3 uPlayer; uniform vec3 uVehicle; varying vec2 vUv;
        void main(){ vUv=uv; vec3 p=aOffset; p.y=mod(p.y-uTime*(.26+aPhase*.025),13.);
        p.x+=sin(uTime*.4+aPhase+p.z*.1)*(1.+uWind*2.); p.z+=cos(uTime*.22+aPhase)*.8;
        vec2 d=p.xz-uPlayer.xz; float radius=length(d); p.xz+=normalize(d+vec2(.001))*(1.-smoothstep(0.,2.8,radius))*1.4;
        p.y+=(1.-smoothstep(0.,2.8,radius))*max(0.,1.-p.y*.25)*.7;
        vec2 dv=p.xz-uVehicle.xz; p.xz+=normalize(dv+vec2(.001))*(1.-smoothstep(0.,4.,length(dv)))*1.8;
        vec3 leaf=position; float r=uTime+aPhase; leaf.x=position.x*cos(r)-position.y*sin(r); leaf.y=position.x*sin(r)+position.y*cos(r);
        vec4 mv=viewMatrix*vec4(p,1.); mv.xyz+=leaf; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec2 vUv; void main(){ vec2 p=vUv*2.-1.; if(dot(p,p)>1.) discard; gl_FragColor=vec4(1.,.70,.76,.86);
      #include <tonemapping_fragment>
      #include <colorspace_fragment> }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    })
    return { geometry, material }
  }, [count])
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])
  useFrame(() => {
    material.uniforms.uTime.value = simulation.elapsed
    material.uniforms.uWind.value = wind.value
    material.uniforms.uPlayer.value.set(simulation.player.x, 0, simulation.player.z)
    material.uniforms.uVehicle.value.set(simulation.shuttle.x, 0, simulation.shuttle.z)
  })
  return <mesh geometry={geometry} material={material} frustumCulled={false} />
}
