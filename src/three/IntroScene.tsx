import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { GlowPoints, makeGlowMaterial } from './glow'
import {
  RED_ROSE,
  leafGeometry,
  petalGeometry,
  roseSamplePoints,
  roseSpecs,
  sepalGeometry,
  stemGeometry,
} from './rose'
import { useStudioEnv } from './env'
import { T, type IntroClock } from './clock'
import { clamp01, damp, easeInOutCubic, easeOutCubic, lerp, rng } from '../lib/rng'
import type { Tier } from '../lib/device'

export interface IntroSceneProps {
  clock: IntroClock
  diveRef: { current: number }
  tier: Tier
  reduced: boolean
}

const BG = '#0a0512'

function Lights({ clock, diveRef }: Pick<IntroSceneProps, 'clock' | 'diveRef'>) {
  const inner = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const open = easeInOutCubic((clock.now() - T.open) / T.openDur)
    if (inner.current) inner.current.intensity = 0.3 + 1.6 * open + 9 * diveRef.current
  })
  return (
    <>
      <ambientLight intensity={0.18} color="#5a2a50" />
      <directionalLight position={[-3, 4, 5]} intensity={1.25} color="#ffd2b0" />
      <directionalLight position={[3, 2, -4]} intensity={1.6} color="#ff6a90" />
      <directionalLight position={[4, -1, 3]} intensity={0.25} color="#9a6ad0" />
      <pointLight ref={inner} position={[0, 0.3, 0]} color="#ff7a55" distance={3.5} decay={2} />
    </>
  )
}

/** Resplandor detrás de la rosa: crece con cada escena. */
function Backglow({ clock, diveRef }: Pick<IntroSceneProps, 'clock' | 'diveRef'>) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uI: { value: 0 },
          uC1: { value: new THREE.Color('#ff3d71') },
          uC2: { value: new THREE.Color('#ffc98a') },
        },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying vec2 vUv; uniform float uI; uniform vec3 uC1; uniform vec3 uC2;
          void main(){ float d = length(vUv - 0.5) * 2.0; float g = pow(max(0.0, 1.0 - d), 2.2);
          vec3 c = mix(uC1, uC2, pow(g, 1.5)); gl_FragColor = vec4(c * g * uI, 1.0); }`,
      }),
    [],
  )
  useFrame(() => {
    const t = clock.now()
    const form = clamp01((t - T.form) / 6)
    const open = easeInOutCubic((t - T.open) / T.openDur)
    mat.uniforms.uI.value = 0.08 + 0.2 * form + 0.22 * open + 2.4 * diveRef.current
  })
  return (
    <mesh position={[0, 0.1, -2.2]} scale={[12, 12, 1]}>
      <planeGeometry />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

/** Partículas que, tras flotar sueltas, se reúnen y dibujan la rosa. */
function FormingPoints({ clock, count }: { clock: IntroClock; count: number }) {
  const gl = useThree((s) => s.gl)
  const d = useMemo(() => {
    const r = rng(42)
    const src = roseSamplePoints(23, RED_ROSE)
    const nSrc = src.length / 3
    const start = new Float32Array(count * 3)
    const target = new Float32Array(count * 3)
    const delay = new Float32Array(count)
    const dur = new Float32Array(count)
    const seed = new Float32Array(count)
    const size = new Float32Array(count)
    const col = new Float32Array(count * 3)
    const palette = ['#ffd9a0', '#ff9fbd', '#fff1e8', '#ff5d86'].map((c) => new THREE.Color(c))
    for (let i = 0; i < count; i++) {
      const k = Math.floor(r() * nSrc)
      target[i * 3] = src[k * 3] + (r() - 0.5) * 0.03
      target[i * 3 + 1] = src[k * 3 + 1] + (r() - 0.5) * 0.03
      target[i * 3 + 2] = src[k * 3 + 2] + (r() - 0.5) * 0.03
      const th = r() * Math.PI * 2
      const ph = Math.acos(2 * r() - 1)
      const R = 2.5 + r() * 5.5
      start[i * 3] = R * Math.sin(ph) * Math.cos(th)
      start[i * 3 + 1] = R * Math.cos(ph) * 0.8
      start[i * 3 + 2] = R * Math.sin(ph) * Math.sin(th)
      delay[i] = r() * 2.4
      dur[i] = 3.2 + r() * 1.8
      seed[i] = r()
      size[i] = 0.16 + r() * 0.3
      const c = palette[Math.floor(r() * palette.length)]
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(start), 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    const mat = makeGlowMaterial(Math.min(gl.getPixelRatio(), 2), { atten: true, twinkle: 0.5, wobble: 0.0, scale: 100 })
    return { geo, mat, start, target, delay, dur }
  }, [count, gl])

  useFrame((state) => {
    const t = clock.now()
    const pos = d.geo.attributes.position.array as Float32Array
    for (let i = 0; i < count; i++) {
      const k = clamp01((t - T.form - d.delay[i]) / d.dur[i])
      const e = easeInOutCubic(k)
      const w = (1 - e) * 0.12
      const ph = state.clock.elapsedTime * 0.5 + i
      for (let a = 0; a < 3; a++) {
        const s = d.start[i * 3 + a]
        pos[i * 3 + a] = s + (d.target[i * 3 + a] - s) * e + Math.sin(ph + a * 2.1) * w
      }
    }
    d.geo.attributes.position.needsUpdate = true
    const fadeIn = clamp01(t / 2.5)
    const keep = lerp(1, 0.3, clamp01((t - (T.appear + 2)) / 4))
    d.mat.uniforms.uOpacity.value = fadeIn * keep
    d.mat.uniforms.uTime.value = state.clock.elapsedTime
  })

  return <points geometry={d.geo} material={d.mat} frustumCulled={false} />
}

function RoseHero({ clock, diveRef, reduced, tier }: IntroSceneProps) {
  const group = useRef<THREE.Group>(null)
  const parts = useMemo(() => {
    const specs = roseSpecs(23)
    const petals = specs.map((spec) => {
      const geo = petalGeometry(spec, RED_ROSE, 'morph', tier === 'low' ? 10 : 18, tier === 'low' ? 12 : 22)
      const mat = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: 0.46,
        metalness: 0,
        sheen: 0.8,
        sheenColor: new THREE.Color('#d83a5e'),
        sheenRoughness: 0.45,
        clearcoat: 0.08,
        clearcoatRoughness: 0.6,
        emissive: new THREE.Color('#ff5f86'),
        emissiveIntensity: 0,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      mesh.scale.setScalar(0.0001)
      return { mesh, mat, spec }
    })
    const green = new THREE.MeshStandardMaterial({ color: '#2f5b34', roughness: 0.7, side: THREE.DoubleSide })
    const sepalGeo = sepalGeometry()
    const sepals = Array.from({ length: 5 }, (_, i) => {
      const holder = new THREE.Group()
      holder.rotation.y = (i / 5) * Math.PI * 2
      const m = new THREE.Mesh(sepalGeo, green)
      m.position.set(0.1, -0.17, 0)
      m.rotation.z = 0.85
      holder.add(m)
      return holder
    })
    const stem = new THREE.Mesh(stemGeometry(2.6, 0.28, 0.035), green)
    const leafGeo = leafGeometry(0.75, 0.3)
    const leaf1 = new THREE.Mesh(leafGeo, green)
    leaf1.position.set(0.13, -1.25, 0)
    leaf1.rotation.set(0.2, 0.4, -1.15)
    const leaf2 = new THREE.Mesh(leafGeo, green)
    leaf2.position.set(0.1, -0.8, 0)
    leaf2.rotation.set(-0.1, Math.PI + 0.3, -1.1)
    return { petals, sepals, stem, leaves: [leaf1, leaf2], green }
  }, [tier])

  useFrame((state, dt) => {
    const t = clock.now()
    const dive = diveRef.current
    const openAll = easeInOutCubic((t - T.open) / T.openDur)
    parts.petals.forEach(({ mesh, mat, spec }, i) => {
      const tA = T.appear + i * T.petalEvery
      const a = easeOutCubic((t - tA) / 0.9)
      mesh.visible = a > 0.002
      mesh.scale.setScalar(Math.max(0.0001, a))
      const pulse = t > tA ? Math.exp(-Math.pow((t - tA - 0.45) / 0.5, 2)) : 0
      mat.emissiveIntensity = pulse * 0.9 + dive * 0.4
      const oi = clamp01((openAll - (1 - spec.t) * 0.45) / 0.55)
      mesh.morphTargetInfluences![0] = easeInOutCubic(oi) + dive * 0.22
    })
    const reveal = easeOutCubic((t - (T.appear + 1.5)) / 2.5)
    parts.stem.visible = parts.leaves[0].visible = parts.leaves[1].visible = reveal > 0.01
    parts.sepals.forEach((s) => (s.visible = reveal > 0.01))
    if (group.current) {
      const g = group.current
      const px = reduced ? 0 : state.pointer.x
      const py = reduced ? 0 : state.pointer.y
      g.rotation.y = damp(g.rotation.y, t * 0.1 + px * 0.55, 2.2, dt)
      g.rotation.x = damp(g.rotation.x, 0.34 - py * 0.18, 2.2, dt)
      const breathe = 1 + Math.sin(t * 1.3) * 0.012
      g.scale.setScalar(breathe)
    }
  })

  const count = tier === 'low' ? 1300 : tier === 'mid' ? 1900 : 2500
  return (
    <group ref={group} position={[0, 0.05, 0]}>
      {parts.petals.map((p, i) => (
        <primitive key={i} object={p.mesh} />
      ))}
      {parts.sepals.map((s, i) => (
        <primitive key={`s${i}`} object={s} />
      ))}
      <primitive object={parts.stem} />
      {parts.leaves.map((l, i) => (
        <primitive key={`l${i}`} object={l} />
      ))}
      <FormingPoints clock={clock} count={count} />
    </group>
  )
}

function CameraRig({ diveRef, reduced }: Pick<IntroSceneProps, 'diveRef' | 'reduced'>) {
  useFrame((state, dt) => {
    const cam = state.camera as THREE.PerspectiveCamera
    const aspect = state.size.width / state.size.height
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
    const fitZ = Math.min(8, Math.max(4.7, 3.9 / (aspect * 2 * tanHalf)))
    const e = easeInOutCubic(diveRef.current)
    const px = reduced ? 0 : state.pointer.x
    const py = reduced ? 0 : state.pointer.y
    cam.position.x = damp(cam.position.x, px * 0.5 * (1 - e), 2.5, dt)
    cam.position.y = damp(cam.position.y, lerp(0.3, 0.45, e) + py * 0.25 * (1 - e), 2.5, dt)
    cam.position.z = lerp(fitZ, 0.2, e)
    cam.lookAt(0, lerp(0.1, 0.45, e), 0)
  })
  return null
}

function Content(props: IntroSceneProps) {
  useStudioEnv(0.3)
  return (
    <>
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 9, 28]} />
      <Lights clock={props.clock} diveRef={props.diveRef} />
      <Backglow clock={props.clock} diveRef={props.diveRef} />
      <RoseHero {...props} />
      <GlowPoints
        count={props.tier === 'low' ? 240 : props.tier === 'mid' ? 420 : 620}
        center={[0, 0, -1]}
        box={[16, 9, 10]}
        colors={['#ffd9a0', '#ffb3c8', '#e3d4ff']}
        size={[0.12, 0.5]}
        rise={0.18}
        wobble={props.reduced ? 0.05 : 0.25}
        twinkle={0.7}
        seed={3}
        opacity={() => 0.9}
      />
      <CameraRig diveRef={props.diveRef} reduced={props.reduced} />
    </>
  )
}

export default function IntroScene(props: IntroSceneProps) {
  return (
    <Canvas
      dpr={props.tier === 'low' ? [1, 1.5] : [1, 2]}
      camera={{ fov: 38, near: 0.05, far: 60, position: [0, 0.3, 7] }}
      gl={{ antialias: props.tier !== 'low', alpha: false, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0, touchAction: 'pan-y' }}
    >
      <Content {...props} />
    </Canvas>
  )
}
