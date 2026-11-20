import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GlowPoints, makeGlowSprite } from '../three/glow'
import { TINT_ROSE, roseGeometry } from '../three/rose'
import { useStudioEnv } from '../three/env'
import { clamp01, damp, lerp, rng } from '../lib/rng'
import type { Tier } from '../lib/device'
import { world } from './store'
import { FINALE, MEADOW, WP } from './waypoints'
import { Meadow } from './Meadow'
import { NightSky, StarAndBouquet } from './Night'

interface WorldProps {
  tier: Tier
  reduced: boolean
}

const DAY = {
  top: new THREE.Color('#6d58b8'),
  mid: new THREE.Color('#cf84ab'),
  hor: new THREE.Color('#f0b9a6'),
  ground: new THREE.Color('#7f9f7a'),
  path: new THREE.Color('#cdb592'),
  hemiSky: new THREE.Color('#ffe9f2'),
  hemiGround: new THREE.Color('#b9a2c9'),
  sun: new THREE.Color('#ffe0bd'),
}
const NIGHT = {
  top: new THREE.Color('#050818'),
  mid: new THREE.Color('#1d1049'),
  hor: new THREE.Color('#4a2a72'),
  ground: new THREE.Color('#20323c'),
  path: new THREE.Color('#4d4560'),
  hemiSky: new THREE.Color('#6b5bd1'),
  hemiGround: new THREE.Color('#1a1030'),
  sun: new THREE.Color('#ff9a78'),
}

// ───────────────────────── Cielo ─────────────────────────
function Sky() {
  const mesh = useRef<THREE.Mesh>(null)
  const scene = useThree((s) => s.scene)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new THREE.Color() },
          uMid: { value: new THREE.Color() },
          uHor: { value: new THREE.Color() },
          uSun: { value: new THREE.Color('#ffd9a8') },
          uSunDir: { value: new THREE.Vector3(-0.5, 0.16, -0.85).normalize() },
          uSunI: { value: 1 },
        },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying vec3 vDir; uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunDir; uniform float uSunI;
          void main(){
            float h = vDir.y;
            vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.32, h));
            c = mix(c, uTop, smoothstep(0.28, 0.95, h));
            c = mix(c, uHor * 0.6, smoothstep(0.0, -0.3, h));
            float s = max(dot(normalize(vDir), uSunDir), 0.0);
            c += uSun * (pow(s, 24.0) * 0.16 + pow(s, 220.0) * 0.5) * uSunI;
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  useFrame((state) => {
    const n = world.night
    mat.uniforms.uTop.value.lerpColors(DAY.top, NIGHT.top, n)
    mat.uniforms.uMid.value.lerpColors(DAY.mid, NIGHT.mid, n)
    mat.uniforms.uHor.value.lerpColors(DAY.hor, NIGHT.hor, n)
    mat.uniforms.uSunI.value = 1 - n * 0.85
    if (mesh.current) mesh.current.position.copy(state.camera.position)
    const fog = scene.fog as THREE.Fog | null
    if (fog) {
      fog.color.copy(mat.uniforms.uHor.value).lerp(mat.uniforms.uMid.value, 0.3)
      fog.far = lerp(135, 85, n)
    }
  })
  return (
    <mesh ref={mesh} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[400, 32, 16]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

function Lighting() {
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const moon = useRef<THREE.DirectionalLight>(null)
  useFrame(() => {
    const n = world.night
    if (hemi.current) {
      hemi.current.intensity = lerp(0.62, 0.4, n)
      hemi.current.color.lerpColors(DAY.hemiSky, NIGHT.hemiSky, n)
      hemi.current.groundColor.lerpColors(DAY.hemiGround, NIGHT.hemiGround, n)
    }
    if (sun.current) {
      sun.current.intensity = lerp(1.45, 0.2, n)
      sun.current.color.lerpColors(DAY.sun, NIGHT.sun, n)
    }
    if (moon.current) moon.current.intensity = lerp(0, 1.5, clamp01((n - 0.25) / 0.75))
  })
  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight ref={sun} position={[-10, 12, 8]} />
      <directionalLight ref={moon} position={[8, 14, -12]} color="#9db4ff" />
    </>
  )
}

// ───────────────────────── Suelo y sendero ─────────────────────────
function Ground() {
  const ground = useRef<THREE.MeshStandardMaterial>(null)
  const path = useRef<THREE.MeshStandardMaterial>(null)
  const alpha = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 4
    const g = c.getContext('2d')!
    const grd = g.createLinearGradient(0, 0, 128, 0)
    grd.addColorStop(0, '#000')
    grd.addColorStop(0.28, '#fff')
    grd.addColorStop(0.72, '#fff')
    grd.addColorStop(1, '#000')
    g.fillStyle = grd
    g.fillRect(0, 0, 128, 4)
    return new THREE.CanvasTexture(c)
  }, [])
  useFrame(() => {
    const n = world.night
    ground.current?.color.lerpColors(DAY.ground, NIGHT.ground, n)
    path.current?.color.lerpColors(DAY.path, NIGHT.path, n)
  })
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -45]}>
        <circleGeometry args={[260, 64]} />
        <meshStandardMaterial ref={ground} color={DAY.ground} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -45]}>
        <planeGeometry args={[3.4, 130]} />
        <meshStandardMaterial ref={path} color={DAY.path} roughness={1} alphaMap={alpha} transparent />
      </mesh>
    </>
  )
}

// ───────────────────────── Rosas, arbustos y pasto ─────────────────────────
const PASTELS = ['#f6b8cc', '#e8a3bb', '#fdf2f0', '#cdb9f2', '#f3dcb0', '#f0a9b0', '#ffffff', '#d9a3c4']
const GREENS = ['#5f8a5c', '#6f9a69', '#4f7d4f', '#7aa574', '#5a8556']

function RoseField({ tier }: { tier: Tier }) {
  const count = tier === 'low' ? 110 : tier === 'mid' ? 190 : 290
  const d = useMemo(() => {
    const r = rng(11)
    const items: { x: number; z: number; h: number; s: number; side: number; yaw: number; tilt: number; ph: number }[] = []
    for (let i = 0; i < count; i++) {
      const z = 11 - r() * 110
      const side = r() < 0.5 ? -1 : 1
      let x = side * (2.7 + Math.pow(r(), 2.0) * 14)
      if (Math.hypot(x - MEADOW[0], z - MEADOW[2]) < 6.4) x = side * (Math.abs(x) + 6)
      if (Math.hypot(x - FINALE[0], z - (FINALE[2] + 5)) < 5) x = side * (Math.abs(x) + 5)
      items.push({ x, z, h: 0.7 + r() * 1.0, s: 0.27 + r() * 0.22, side, yaw: r() * Math.PI * 2, tilt: 0.2 + r() * 0.3, ph: r() * 6.28 })
    }
    const geo = roseGeometry(11, TINT_ROSE, 'open', 10, 12, 0.6)
    const headMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.62,
      emissive: new THREE.Color('#ff9ec0'),
      emissiveIntensity: 0,
    })
    const heads = new THREE.InstancedMesh(geo, headMat, count)
    const col = new THREE.Color()
    items.forEach((it, i) => heads.setColorAt(i, col.set(PASTELS[Math.floor(r() * PASTELS.length)])))
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true
    heads.frustumCulled = false

    const stemGeo = new THREE.CylinderGeometry(0.012, 0.022, 1, 5)
    stemGeo.translate(0, 0.5, 0)
    const stems = new THREE.InstancedMesh(stemGeo, new THREE.MeshStandardMaterial({ color: '#4c7a4a', roughness: 0.8 }), count)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    items.forEach((it, i) => {
      m.compose(new THREE.Vector3(it.x, 0, it.z), q, new THREE.Vector3(1, it.h, 1))
      stems.setMatrixAt(i, m)
    })
    stems.frustumCulled = false

    const nb = Math.floor(count * 0.95)
    // arbustos con forma orgánica: icosaedro con vértices desplazados
    const bushGeo = mergeVertices(new THREE.IcosahedronGeometry(1, 3).deleteAttribute('uv').deleteAttribute('normal'))
    {
      const p = bushGeo.getAttribute('position') as THREE.BufferAttribute
      const v = new THREE.Vector3()
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i)
        const n = Math.sin(v.x * 5.1 + v.y * 3.7) * Math.cos(v.z * 4.3 - v.y * 2.1) + Math.sin(v.x * 11 + v.z * 9) * 0.35
        v.multiplyScalar(1 + n * 0.16)
        p.setXYZ(i, v.x, v.y, v.z)
      }
      bushGeo.computeVertexNormals()
    }
    const bushes = new THREE.InstancedMesh(bushGeo, new THREE.MeshStandardMaterial({ roughness: 1 }), nb)
    for (let i = 0; i < nb; i++) {
      const it = items[i % items.length]
      const sx = 0.45 + r() * 0.45
      const sy = 0.45 + r() * 0.5
      m.compose(
        new THREE.Vector3(it.x + (r() - 0.5) * 0.9, sy * 0.45, it.z + (r() - 0.5) * 0.9),
        q,
        new THREE.Vector3(sx, sy, 0.55 + r() * 0.55),
      )
      bushes.setMatrixAt(i, m)
      bushes.setColorAt(i, col.set(GREENS[Math.floor(r() * GREENS.length)]))
    }
    if (bushes.instanceColor) bushes.instanceColor.needsUpdate = true
    bushes.frustumCulled = false
    return { items, heads, headMat, stems, bushes }
  }, [count])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    dummy.rotation.order = 'YXZ'
    d.items.forEach((it, i) => {
      dummy.position.set(it.x, it.h, it.z)
      dummy.rotation.set(0.55 + Math.sin(t * 0.7 + it.ph) * 0.05, it.yaw, it.side * it.tilt * 0.5 + Math.cos(t * 0.6 + it.ph) * 0.05)
      dummy.scale.setScalar(it.s)
      dummy.updateMatrix()
      d.heads.setMatrixAt(i, dummy.matrix)
    })
    d.heads.instanceMatrix.needsUpdate = true
    d.headMat.emissiveIntensity = world.night * 0.3
  })
  return (
    <>
      <primitive object={d.bushes} />
      <primitive object={d.stems} />
      <primitive object={d.heads} />
    </>
  )
}

function Grass({ tier }: { tier: Tier }) {
  const count = tier === 'low' ? 2600 : tier === 'mid' ? 4200 : 6500
  const uTime = useMemo(() => ({ value: 0 }), [])
  const mesh = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.028, 0, 0, 0.028, 0, 0, 0, 1, 0]), 3))
    geo.setIndex([0, 1, 2])
    geo.computeVertexNormals()
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 1 })
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float sway = sin(uTime * 1.6 + instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 1.3) * 0.14 * position.y * position.y;
           transformed.x += sway;`,
        )
    }
    const m = new THREE.InstancedMesh(geo, mat, count)
    const r = rng(5)
    const dummy = new THREE.Object3D()
    const col = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const z = 10 - r() * 108
      let x = (r() - 0.5) * 22
      if (Math.hypot(x - MEADOW[0], z - MEADOW[2]) < 5 && r() < 0.6) x += 8 * Math.sign(x || 1)
      dummy.position.set(x, 0, z)
      dummy.rotation.set(0, r() * Math.PI, 0)
      dummy.scale.set(1, 0.16 + r() * 0.34, 1)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, col.set(GREENS[Math.floor(r() * GREENS.length)]).offsetHSL(0, 0, (r() - 0.5) * 0.08))
    }
    m.frustumCulled = false
    return m
  }, [count, uTime])
  useFrame((state) => {
    uTime.value = state.clock.elapsedTime
  })
  return <primitive object={mesh} />
}

function Lanterns() {
  const sprites = useRef<THREE.Sprite[]>([])
  const group = useMemo(() => {
    const g = new THREE.Group()
    const pole = new THREE.CylinderGeometry(0.014, 0.022, 1.9, 6)
    pole.translate(0, 0.95, 0)
    const poleMat = new THREE.MeshStandardMaterial({ color: '#4a3a3a', roughness: 0.6, metalness: 0.4 })
    const lampGeo = new THREE.SphereGeometry(0.1, 12, 10)
    const lampMat = new THREE.MeshBasicMaterial({ color: '#ffe3b0' })
    for (let i = 0; i < 16; i++) {
      const z = 2 - i * 6.2
      if (Math.abs(z - MEADOW[2]) < 6.5) continue
      const x = (i % 2 ? 1 : -1) * (2.3 + ((i * 7) % 3) * 0.2)
      const p = new THREE.Mesh(pole, poleMat)
      p.position.set(x, 0, z)
      const lamp = new THREE.Mesh(lampGeo, lampMat)
      lamp.position.set(x, 1.95, z)
      const s = makeGlowSprite('#ffc98a', 1.7, 0.2)
      s.position.set(x, 1.95, z)
      sprites.current.push(s)
      g.add(p, lamp, s)
    }
    return g
  }, [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    sprites.current.forEach((s, i) => {
      s.material.opacity = lerp(0.14, 0.95, world.night) * (0.92 + Math.sin(t * 3 + i) * 0.08)
    })
  })
  return <primitive object={group} />
}

// ───────────────────────── Mariposas ─────────────────────────
function wingGeometry(mirror: boolean) {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.25, 0.35, 0.8, 0.5, 0.68, 0.1)
  s.bezierCurveTo(0.74, -0.2, 0.36, -0.46, 0.05, -0.12)
  s.closePath()
  const g = new THREE.ShapeGeometry(s, 8)
  g.rotateX(Math.PI / 2)
  if (mirror) g.scale(-1, 1, 1)
  return g
}

function Butterflies({ tier }: { tier: Tier }) {
  const n = tier === 'low' ? 6 : 11
  const parts = useMemo(() => {
    const r = rng(21)
    const wingR = wingGeometry(false)
    const wingL = wingGeometry(true)
    const colors = ['#c9b5f0', '#f6b8cc', '#f3dcb0', '#ffffff', '#e8a3bb']
    const list = Array.from({ length: n }, (_, i) => {
      const root = new THREE.Group()
      const c = colors[i % colors.length]
      const mk = (geo: THREE.BufferGeometry) => {
        const holder = new THREE.Group()
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, transparent: true, opacity: 0.93 }))
        const spot = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#fff7ef', side: THREE.DoubleSide, transparent: true, opacity: 0.8 }))
        spot.scale.set(0.5, 1, 0.5)
        spot.position.set(0.2 * (geo === wingR ? 1 : -1), 0.002, 0.03)
        holder.add(m, spot)
        return holder
      }
      const R = mk(wingR)
      const L = mk(wingL)
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.32, 6), new THREE.MeshBasicMaterial({ color: '#4a3040' }))
      body.rotation.x = Math.PI / 2
      root.add(R, L, body)
      root.scale.setScalar(0.34 + r() * 0.16)
      return {
        root,
        R,
        L,
        cx: (r() - 0.5) * 7,
        cz: 7 - (i / n) * 62 - r() * 4,
        cy: 0.9 + r() * 1.3,
        ax: 1.6 + r() * 2,
        az: 1.2 + r() * 1.8,
        w: 0.35 + r() * 0.3,
        ph: r() * 6.28,
        fl: 11 + r() * 5,
      }
    })
    return list
  }, [n])
  const pos = (b: (typeof parts)[number], t: number, out: THREE.Vector3) =>
    out.set(
      b.cx + b.ax * Math.sin(b.w * t + b.ph),
      b.cy + 0.35 * Math.sin(1.9 * b.w * t + b.ph),
      b.cz + b.az * Math.cos(0.8 * b.w * t + b.ph * 1.3),
    )
  const a = useMemo(() => new THREE.Vector3(), [])
  const b2 = useMemo(() => new THREE.Vector3(), [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const vis = world.night < 0.88
    parts.forEach((b) => {
      b.root.visible = vis
      if (!vis) return
      pos(b, t, a)
      pos(b, t + 0.06, b2)
      b.root.position.copy(a)
      b.root.rotation.y = Math.atan2(b2.x - a.x, b2.z - a.z)
      const f = Math.sin(t * b.fl + b.ph) * 0.85 + 0.3
      b.R.rotation.z = f
      b.L.rotation.z = -f
    })
  })
  return (
    <>
      {parts.map((b, i) => (
        <primitive key={i} object={b.root} />
      ))}
    </>
  )
}

function Fireflies({ tier }: { tier: Tier }) {
  const k = tier === 'low' ? 0.55 : 1
  const op = () => 0.45 + 0.55 * world.night
  const cols = ['#ffe9a8', '#fff4c4', '#ffd0e0']
  return (
    <>
      <GlowPoints count={Math.floor(150 * k)} center={[0, 1.7, -20]} box={[26, 3.6, 62]} colors={cols} size={[0.25, 0.65]} wobble={0.5} twinkle={0.95} seed={31} opacity={op} />
      <GlowPoints count={Math.floor(110 * k)} center={[0, 1.6, -40]} box={[16, 3.2, 14]} colors={cols} size={[0.25, 0.65]} wobble={0.5} twinkle={0.95} seed={32} opacity={op} />
      <GlowPoints count={Math.floor(150 * k)} center={[0, 2.2, -80]} box={[26, 6, 34]} colors={cols} size={[0.25, 0.7]} wobble={0.55} twinkle={0.95} seed={33} opacity={op} />
      {/* polvo dorado y reflejos suspendidos */}
      <GlowPoints count={Math.floor(260 * k)} center={[0, 2.2, -45]} box={[22, 4.4, 110]} colors={['#fff0cf', '#ffd9a0', '#ffe8f0']} size={[0.08, 0.28]} rise={0.07} wobble={0.35} twinkle={0.8} seed={34} opacity={0.75} />
    </>
  )
}

// ───────────────────────── Cámara guiada por el scroll ─────────────────────────
function CameraRig({ reduced }: { reduced: boolean }) {
  const blocks = useRef<{ y: number; wp: string }[]>([])
  const frame = useRef(0)
  const look = useRef(new THREE.Vector3(...WP.welcome.look))
  const pos = useMemo(() => new THREE.Vector3(), [])
  const tgtPos = useMemo(() => new THREE.Vector3(), [])
  const tgtLook = useMemo(() => new THREE.Vector3(), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const first = useRef(true)

  useFrame((state, dt) => {
    if (frame.current++ % 40 === 0) {
      const els = document.querySelectorAll<HTMLElement>('[data-wp]')
      blocks.current = Array.from(els).map((el) => {
        const r = el.getBoundingClientRect()
        return { y: r.top + window.scrollY + r.height / 2, wp: el.dataset.wp ?? 'welcome' }
      })
    }
    const b = blocks.current
    if (!b.length) return
    const y = window.scrollY + window.innerHeight * 0.5
    let k = 0
    while (k < b.length - 1 && y >= b[k + 1].y) k++
    const n = Math.min(k + 1, b.length - 1)
    const A = WP[b[k].wp] ?? WP.welcome
    const C = WP[b[n].wp] ?? A
    const span = b[n].y - b[k].y || 1
    const u = clamp01((y - b[k].y) / span)
    const e = THREE.MathUtils.smoothstep(u, 0.3, 0.7)
    tgtPos.set(lerp(A.pos[0], C.pos[0], e), lerp(A.pos[1], C.pos[1], e), lerp(A.pos[2], C.pos[2], e))
    tgtLook.set(lerp(A.look[0], C.look[0], e), lerp(A.look[1], C.look[1], e), lerp(A.look[2], C.look[2], e))
    world.night = first.current ? lerp(A.night, C.night, e) : damp(world.night, lerp(A.night, C.night, e), 2.2, dt)

    // pantallas verticales: alejar la cámara para que la escena quepa
    const aspect = state.size.width / state.size.height
    if (aspect < 1) {
      tmp.copy(tgtPos).sub(tgtLook).setY(0).normalize()
      tgtPos.addScaledVector(tmp, Math.min(7, (1 / aspect - 1) * 1.6))
    }
    if (!reduced) {
      tgtPos.x += state.pointer.x * 0.35
      tgtPos.y += state.pointer.y * 0.2
    }
    if (first.current) {
      state.camera.position.copy(tgtPos)
      look.current.copy(tgtLook)
      first.current = false
    }
    pos.copy(state.camera.position)
    pos.x = damp(pos.x, tgtPos.x, 3, dt)
    pos.y = damp(pos.y, tgtPos.y, 3, dt)
    pos.z = damp(pos.z, tgtPos.z, 3, dt)
    state.camera.position.copy(pos)
    look.current.x = damp(look.current.x, tgtLook.x, 3.4, dt)
    look.current.y = damp(look.current.y, tgtLook.y, 3.4, dt)
    look.current.z = damp(look.current.z, tgtLook.z, 3.4, dt)
    state.camera.lookAt(look.current)
  })
  return null
}

function Content({ tier, reduced }: WorldProps) {
  useStudioEnv(0.3)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    scene.fog = new THREE.Fog('#f0b9a6', 12, 135)
    return () => {
      scene.fog = null
    }
  }, [scene])
  return (
    <>
      <Sky />
      <Lighting />
      <Ground />
      <RoseField tier={tier} />
      <Grass tier={tier} />
      <Lanterns />
      <Butterflies tier={tier} />
      <Fireflies tier={tier} />
      <Meadow tier={tier} />
      <NightSky tier={tier} />
      <StarAndBouquet />
      <CameraRig reduced={reduced} />
    </>
  )
}

export default function WorldCanvas(props: WorldProps) {
  return (
    <Canvas
      dpr={props.tier === 'low' ? [1, 1.5] : [1, 2]}
      camera={{ fov: 50, near: 0.1, far: 800, position: WP.welcome.pos }}
      gl={{ antialias: props.tier !== 'low', alpha: false, powerPreference: 'high-performance' }}
      style={{ position: 'fixed', inset: 0, zIndex: 0, touchAction: 'pan-y' }}
    >
      <Content {...props} />
    </Canvas>
  )
}
