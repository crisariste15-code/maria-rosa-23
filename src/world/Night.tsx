import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { GlowPoints, makeGlowSprite } from '../three/glow'
import { TINT_ROSE, leafGeometry, roseGeometry } from '../three/rose'
import { clamp01, easeOutBack, easeOutCubic, lerp, rng } from '../lib/rng'
import type { Tier } from '../lib/device'
import { BOUQUET_POS, STAR_POS } from './waypoints'
import { activateStar, nowSec, world } from './store'

const smooth = (x: number, a: number, b: number) => THREE.MathUtils.smoothstep(x, a, b)

/** Grupo que acompaña a la cámara: así el cielo (estrellas, luna) siempre queda “infinitamente” lejos. */
function FollowCamera({ children }: { children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null)
  useFrame((s) => g.current?.position.copy(s.camera.position))
  return <group ref={g}>{children}</group>
}

function moonTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(128, 128, 20, 128, 128, 112)
  grd.addColorStop(0, '#fffdf3')
  grd.addColorStop(0.8, '#f4ecd2')
  grd.addColorStop(1, '#e6d9b4')
  g.fillStyle = grd
  g.beginPath()
  g.arc(128, 128, 104, 0, Math.PI * 2)
  g.fill()
  g.globalCompositeOperation = 'source-atop'
  g.fillStyle = 'rgba(160,140,110,0.18)'
  for (const [x, y, r] of [[96, 100, 26], [150, 90, 16], [140, 150, 30], [92, 158, 14], [172, 130, 12], [118, 70, 11]]) {
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function ShootingStars() {
  const slots = useMemo(() => {
    const mat = () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        uniforms: { uA: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying vec2 vUv; uniform float uA;
          void main(){ float tail = pow(vUv.x, 3.0); float w = 1.0 - abs(vUv.y - 0.5) * 2.0; gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * tail * w, 1.0) * uA; }`,
      })
    return Array.from({ length: 3 }, (_, i) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.35), mat())
      mesh.visible = false
      return { mesh, start: 0, nextAt: 2 + i * 2.4, x: 0, y: 0, dx: 0, dy: 0 }
    })
  }, [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const night = smooth(world.night, 0.6, 0.95)
    slots.forEach((s) => {
      const mat = s.mesh.material as THREE.ShaderMaterial
      if (!s.mesh.visible) {
        if (night > 0.5 && t > s.nextAt) {
          s.mesh.visible = true
          s.start = t
          s.x = -60 + Math.random() * 120
          s.y = 30 + Math.random() * 55
          const ang = Math.PI * (0.78 + Math.random() * 0.12)
          s.dx = Math.cos(ang)
          s.dy = Math.sin(ang)
          s.mesh.rotation.z = Math.atan2(s.dy, s.dx) + Math.PI
        }
      } else {
        const age = t - s.start
        if (age > 1.1) {
          s.mesh.visible = false
          s.nextAt = t + 2.5 + Math.random() * 5
        } else {
          const p = age * 95
          s.mesh.position.set(state.camera.position.x + s.x + s.dx * p, state.camera.position.y + s.y + s.dy * p, state.camera.position.z - 130)
          mat.uniforms.uA.value = Math.sin((age / 1.1) * Math.PI) * night
        }
      }
    })
  })
  return (
    <>
      {slots.map((s, i) => (
        <primitive key={i} object={s.mesh} />
      ))}
    </>
  )
}

export function NightSky({ tier }: { tier: Tier }) {
  const moon = useMemo(() => {
    const tex = moonTexture()
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }))
    m.scale.set(44, 44, 1)
    const halo = makeGlowSprite('#cfd8ff', 150, 0)
    const dir = new THREE.Vector3(-0.42, 0.3, -0.86).normalize().multiplyScalar(300)
    m.position.copy(dir)
    halo.position.copy(dir)
    return { m, halo }
  }, [])
  useFrame(() => {
    const k = smooth(world.night, 0.3, 0.9)
    moon.m.material.opacity = k
    moon.halo.material.opacity = k * 0.5
  })
  return (
    <>
      <FollowCamera>
        <GlowPoints
          dome
          count={tier === 'low' ? 380 : tier === 'mid' ? 650 : 950}
          box={[310, 0, 0]}
          colors={['#ffffff', '#dfe6ff', '#fff0d8', '#d6c8ff']}
          size={[0.5, 1.7]}
          atten={false}
          wobble={0}
          twinkle={0.85}
          seed={55}
          opacity={() => smooth(world.night, 0.3, 0.85)}
        />
        <primitive object={moon.halo} />
        <primitive object={moon.m} />
      </FollowCamera>
      <ShootingStars />
    </>
  )
}

function starShape() {
  const s = new THREE.Shape()
  const spikes = 5
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 1 : 0.46
    const a = (i / (spikes * 2)) * Math.PI * 2 + Math.PI / 2
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  s.closePath()
  return s
}

/** La estrella especial del cielo y el ramo de rosas que emerge al tocarla. */
export function StarAndBouquet() {
  const star = useRef<THREE.Mesh>(null)
  const starGlow = useMemo(() => makeGlowSprite('#ffd9a0', 10, 0), [])
  const ring = useMemo(() => makeGlowSprite('#fff2d0', 14, 0), [])
  const light = useRef<THREE.PointLight>(null)
  const bLight = useRef<THREE.PointLight>(null)

  const starGeo = useMemo(
    () => new THREE.ExtrudeGeometry(starShape(), { depth: 0.08, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 }),
    [],
  )

  const bouquet = useMemo(() => {
    const r = rng(404)
    const g = new THREE.Group()
    const paperMat = new THREE.MeshStandardMaterial({ color: '#efdcb8', roughness: 0.85, side: THREE.DoubleSide })
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.5, 28, 1, true), paperMat)
    cone.rotation.x = Math.PI
    cone.position.y = 0.75
    g.add(cone)
    const ribbonMat = new THREE.MeshStandardMaterial({ color: '#e787ab', roughness: 0.4, metalness: 0.1 })
    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.395, 0.035, 8, 32), ribbonMat)
    ribbon.rotation.x = Math.PI / 2
    ribbon.position.y = 0.72
    g.add(ribbon)
    for (const s of [-1, 1]) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.01), ribbonMat)
      tail.position.set(s * 0.1, 0.45, 0.4)
      tail.rotation.z = s * 0.25
      g.add(tail)
    }
    const geo = roseGeometry(14, TINT_ROSE, 'open', 9, 11)
    const palette = ['#f6b8cc', '#e8a3bb', '#fdf2f0', '#cdb9f2', '#f3dcb0', '#f0a9b0', '#ffffff']
    const heads: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial }[] = []
    const place = (x: number, y: number, z: number, tiltX: number, tiltZ: number, sc: number, ci: number) => {
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        color: new THREE.Color(palette[ci % palette.length]),
        side: THREE.DoubleSide,
        roughness: 0.55,
        emissive: new THREE.Color('#ff9ec0'),
        emissiveIntensity: 0.12,
      })
      const m = new THREE.Mesh(geo, mat)
      m.position.set(x, y, z)
      m.rotation.set(tiltX, r() * 6.28, tiltZ, 'YXZ')
      m.scale.setScalar(sc)
      g.add(m)
      heads.push({ mesh: m, mat })
    }
    place(0, 1.62, 0, 0, 0, 0.36, 0)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3
      place(Math.cos(a) * 0.4, 1.52, Math.sin(a) * 0.4, Math.sin(a) * 0.35, -Math.cos(a) * 0.35, 0.33, i + 1)
    }
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2
      place(Math.cos(a) * 0.74, 1.3, Math.sin(a) * 0.74, Math.sin(a) * 0.75, -Math.cos(a) * 0.75, 0.3, i + 2)
    }
    const leafMat = new THREE.MeshStandardMaterial({ color: '#4f8450', roughness: 0.7, side: THREE.DoubleSide })
    const leafGeo = leafGeometry(0.6, 0.22)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.2
      const l = new THREE.Mesh(leafGeo, leafMat)
      l.position.set(Math.cos(a) * 0.62, 1.28, Math.sin(a) * 0.62)
      l.rotation.set(0, -a + Math.PI / 2, -0.95, 'YXZ')
      g.add(l)
    }
    g.visible = false
    g.position.set(...BOUQUET_POS)
    return { g, heads }
  }, [])
  const bGlow = useMemo(() => makeGlowSprite('#ffc4d8', 5.5, 0), [])
  bGlow.position.set(BOUQUET_POS[0], BOUQUET_POS[1] + 1.4, BOUQUET_POS[2] - 0.4)

  useFrame((state) => {
    const t = nowSec()
    const el = state.clock.elapsedTime
    const night = smooth(world.night, 0.5, 0.95)
    const act = world.star ? clamp01((t - world.starAt) / 1.4) : 0
    const flare = world.star ? Math.exp(-Math.pow((t - world.starAt - 0.5) / 0.9, 2)) : 0
    if (star.current) {
      star.current.visible = night > 0.02
      star.current.rotation.y = Math.sin(el * 0.7) * 0.55
      star.current.rotation.z = Math.sin(el * 0.4) * 0.08
      const pulse = 1 + Math.sin(el * 2.2) * 0.06
      star.current.scale.setScalar((1.5 + 0.5 * easeOutCubic(act) + 1.4 * flare) * pulse * night)
      const m = star.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = 0.7 + 0.8 * act + 1.6 * flare
    }
    const gm = starGlow.material
    gm.opacity = night * (0.32 + 0.14 * Math.sin(el * 2.2) + 0.4 * act + 0.5 * flare)
    starGlow.scale.setScalar(10 + 6 * act + 10 * flare)
    ring.material.opacity = night * (world.star ? 0.2 : 0.18 + 0.18 * Math.sin(el * 2.8))
    ring.scale.setScalar(13 + (world.star ? 4 : Math.sin(el * 2.8) * 2.5))
    if (light.current) light.current.intensity = night * (30 + 120 * act + 200 * flare)

    const p = world.star ? clamp01((t - world.bouquetAt) / 3.6) : 0
    bouquet.g.visible = p > 0.001
    if (p > 0) {
      bouquet.g.position.y = lerp(-2.6, 0.12, easeOutBack(p))
      bouquet.g.scale.setScalar(0.35 + 0.65 * easeOutCubic(p))
      bouquet.g.rotation.y = (1 - easeOutCubic(p)) * 2.4 + Math.sin(el * 0.5) * 0.12
    }
    bouquet.heads.forEach((h, i) => {
      h.mat.emissiveIntensity = 0.12 + 0.25 * p + 0.12 * Math.sin(el * 2 + i)
    })
    bGlow.material.opacity = p * (0.55 + 0.15 * Math.sin(el * 1.7))
    if (bLight.current) bLight.current.intensity = p * 16
  })

  const burst = () => {
    if (!world.star) return 0
    const age = nowSec() - world.starAt
    return clamp01(age / 0.5) * clamp01(1 - (age - 5) / 6)
  }
  const bouquetBurst = () => {
    if (!world.star) return 0
    const age = nowSec() - world.bouquetAt
    return age < 0 ? 0 : clamp01(age / 0.6) * clamp01(1 - (age - 4) / 6)
  }

  return (
    <group>
      <group position={STAR_POS}>
        <mesh ref={star} geometry={starGeo}>
          <meshStandardMaterial color="#ffd27a" emissive="#ffae40" emissiveIntensity={0.8} roughness={0.35} metalness={0.4} />
        </mesh>
        <primitive object={starGlow} />
        <primitive object={ring} />
        {/* área de toque grande y cómoda */}
        <mesh
          onClick={(e) => {
            e.stopPropagation()
            activateStar()
          }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = '')}
        >
          <sphereGeometry args={[2.6, 10, 10]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <pointLight ref={light} color="#ffe0a0" distance={40} decay={2} />
      </group>
      <GlowPoints
        count={200}
        center={STAR_POS}
        box={[12, 9, 3]}
        colors={['#fff0c0', '#ffd9e6', '#ffffff']}
        size={[0.3, 0.9]}
        rise={0.8}
        wobble={0.5}
        twinkle={0.9}
        seed={606}
        opacity={burst}
      />
      <primitive object={bouquet.g} />
      <primitive object={bGlow} />
      <pointLight ref={bLight} position={[BOUQUET_POS[0], 1.8, BOUQUET_POS[2] + 1.5]} color="#ffc4d8" distance={9} decay={2} />
      <GlowPoints
        count={160}
        center={[BOUQUET_POS[0], 1.6, BOUQUET_POS[2]]}
        box={[3.2, 3, 3.2]}
        colors={['#fff0c0', '#ffd9e6', '#ffffff']}
        size={[0.12, 0.4]}
        rise={0.45}
        wobble={0.25}
        twinkle={0.9}
        seed={707}
        opacity={bouquetBurst}
      />
    </group>
  )
}
