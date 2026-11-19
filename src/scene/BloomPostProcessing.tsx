import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { evaluateBloomProfile, isSoftwareWebGLContext } from '../core/bloom'
import type { QualityTier } from '../core/quality'
import type { EnvironmentLightingSnapshot } from './lighting'

export interface BloomPostProcessingProps {
  lightingState: EnvironmentLightingSnapshot
  qualityTier: QualityTier
  bloomIntensityRef: { value: number }
}

/**
 * Linear-HDR Post-Processing Bloom Pipeline (EffectComposer -> RenderPass -> UnrealBloomPass -> OutputPass).
 *
 * Uses a HalfFloatType HDR render target (with WebGL2 MSAA on HIGH/ULTRA) so sunlit sakura
 * blossom canopies, street lamp halos, café windows, and sun/moon discs emit a soft, dreamy,
 * ethereal glow before final ACES Filmic tone mapping and sRGB output.
 *
 * Automatically bypasses multi-pass post-processing on CPU software WebGL or LITE quality tier,
 * falling back cleanly to direct renderer output with zero frame overhead.
 */
export function BloomPostProcessing({
  lightingState,
  qualityTier,
  bloomIntensityRef,
}: BloomPostProcessingProps) {
  const { gl, scene, camera, size } = useThree()

  const isSoftwareGl = useMemo(() => {
    const ctx = gl.getContext()
    return isSoftwareWebGLContext(ctx)
  }, [gl])

  const useMsaa = !isSoftwareGl && (qualityTier === 'HIGH' || qualityTier === 'ULTRA')

  const pipeline = useMemo(() => {
    const pixelRatio = gl.getPixelRatio()
    const width = Math.max(1, size.width)
    const height = Math.max(1, size.height)

    // Linear HalfFloat HDR buffer preserves intensities > 1.0 for clean selective bloom
    const renderTarget = new THREE.WebGLRenderTarget(
      Math.max(1, Math.floor(width * pixelRatio)),
      Math.max(1, Math.floor(height * pixelRatio)),
      {
        type: THREE.HalfFloatType,
        samples: useMsaa && gl.capabilities.isWebGL2 ? 4 : 0,
      }
    )

    const composer = new EffectComposer(gl, renderTarget)
    composer.setPixelRatio(pixelRatio)
    composer.setSize(width, height)

    const renderPass = new RenderPass(scene, camera)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.max(1, Math.floor(width * 0.75)), Math.max(1, Math.floor(height * 0.75))),
      0.34,
      0.62,
      0.84
    )
    const outputPass = new OutputPass()

    composer.addPass(renderPass)
    composer.addPass(bloomPass)
    composer.addPass(outputPass)

    return { composer, renderTarget, renderPass, bloomPass, outputPass }
  }, [gl, scene, camera, useMsaa])

  // Keep composer and bloom pyramid resolutions strictly in sync with viewport & DPR changes
  useEffect(() => {
    const pixelRatio = gl.getPixelRatio()
    const width = Math.max(1, size.width)
    const height = Math.max(1, size.height)
    const resScale = qualityTier === 'HIGH' || qualityTier === 'ULTRA' ? 0.75 : 0.5

    pipeline.composer.setPixelRatio(pixelRatio)
    pipeline.composer.setSize(width, height)
    pipeline.bloomPass.resolution.set(
      Math.max(1, Math.floor(width * resScale)),
      Math.max(1, Math.floor(height * resScale))
    )
  }, [pipeline, gl, size.width, size.height, qualityTier])

  // StrictMode-safe GPU disposal
  const activePipelineRef = useRef<typeof pipeline | null>(null)
  useEffect(() => {
    activePipelineRef.current = pipeline
    return () => {
      activePipelineRef.current = null
      const toDispose = pipeline
      queueMicrotask(() => {
        if (activePipelineRef.current !== toDispose) {
          toDispose.bloomPass.dispose()
          toDispose.outputPass.dispose()
          toDispose.renderTarget.dispose()
          toDispose.composer.dispose()
        }
      })
    }
  }, [pipeline])

  // Priority 1 hands final frame rendering to our HDR bloom composer (or direct gl.render when bypassed)
  useFrame(() => {
    const profile = evaluateBloomProfile({
      daylight: lightingState.daylight,
      twilight: lightingState.twilight,
      streetLampIntensity: lightingState.streetLampIntensity,
      rainIntensity: lightingState.rainIntensity,
      userIntensity: bloomIntensityRef.value,
      qualityTier,
      isSoftwareGl,
    })

    if (!profile.enabled) {
      gl.render(scene, camera)
      return
    }

    pipeline.bloomPass.strength = profile.strength
    pipeline.bloomPass.radius = profile.radius
    pipeline.bloomPass.threshold = profile.threshold
    pipeline.composer.render()
  }, 1)

  return null
}
