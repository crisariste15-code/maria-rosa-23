import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { GlowPoints, makeGlowSprite } from '../three/glow'
import { TINT_ROSE, leafGeometry, roseGeometry, stemGeometry } from '../three/rose'
import { clamp01, damp, easeOutBack, easeOutCubic, lerp, rng } from '../lib/rng'
import type { Tier } from '../lib/device'
import { MEADOW } from './waypoints'
import { WISH_COUNT, nowSec, openWish, world } from './store'

const GOLDEN = 2.399963229728653
const PASTELS = ['#f6b8cc', '#e8a3bb', '#fdf2f0', '#cdb9f2', '#f3dcb0', '#f0a9b0', '#ffffff', '#d9a3c4']

interface Flower {
  group: THREE.Group
  head: THREE.Mesh
  mat: THREE.MeshStandardMaterial
  glow: THREE.Sprite
  hx: number
  hy: number
  hz: number
  ph: number
  hover: number
}

/** El prado de los 23 deseos: una flor por cada año. Al tocarla, se abre y revela su deseo. */
export function Meadow({ tier }: { tier: Tier }) {
  const hovered = useRef(-1)
  const light = useRef<THREE.PointLight>(null)

  const flowers = useMemo<Flower[]>(() => {
    const r = rng(77)
    const geo = roseGeometry(9, TINT_ROSE, 'morph', 9, 11)
    const leafGeo = leafGeometry(0.55, 0.22)
    const leafMat = new THREE.MeshStandardMaterial({ color: '#5f8f5a', roughness: 0.7, side: THREE.DoubleSide })
    const stemMat = new THREE.MeshStandardMaterial({ color: '#4c7a4a', roughness: 0.8 })
    return Array.from({ length: WISH_COUNT }, (_, i) => {
      const rad = 0.82 * Math.sqrt(i + 0.7)
      const th = i * GOLDEN
      const x = MEADOW[0] + Math.cos(th) * rad
      const z = MEADOW[2] + Math.sin(th) * rad * 0.9
      const h = 0.95 + r() * 0.45
      const tint = new THREE.Color(PASTELS[(i * 3) % PASTELS.length])
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        color: tint,
        side: THREE.DoubleSide,
        roughness: 0.55,
        emissive: tint.clone(),
        emissiveIntensity: 0.04,
      })
      const head = new THREE.Mesh(geo, mat)
      head.rotation.x = 0.5
      head.rotation.y = r() * Math.PI * 2
      head.scale.setScalar(0.46)
      const stem = new THREE.Mesh(stemGeometry(h, (r() - 0.5) * 0.3, 0.028), stemMat)
      const leaf = new THREE.Mesh(leafGeo, leafMat)
      leaf.position.set(0, -h * 0.45, 0)
      leaf.rotation.set(0.2, r() * Math.PI * 2, -1.0)
      const glow = makeGlowSprite('#ffd0e0', 1.7, 0.2)
      glow.position.set(0, 0.05, 0)
      const group = new THREE.Group()
      group.position.set(x, h, z)
      group.add(stem, leaf, head, glow)
      return { group, head, mat, glow, hx: x, hy: h, hz: z, ph: r() * 6.28, hover: 0 }
    })
  }, [])

  useFrame((state, dt) => {
    const t = nowSec()
    const el = state.clock.elapsedTime
    flowers.forEach((f, i) => {
      const opened = world.opened[i]
      const o = opened ? easeOutBack((t - world.openedAt[i]) / 1.9) : 0
      f.head.morphTargetInfluences![0] = Math.min(1.1, Math.max(0, o))
      f.hover = damp(f.hover, hovered.current === i ? 1 : 0, 9, dt)
      const breathe = opened ? 0 : Math.sin(el * 1.6 + f.ph) * 0.05
      f.head.scale.setScalar(0.46 * (1 + 0.14 * f.hover + breathe) * (1 + 0.12 * clamp01(o)))
      const rise = opened ? easeOutCubic((t - world.openedAt[i]) / 1.6) * 0.16 : 0
      f.group.position.y = f.hy + rise + Math.sin(el * 0.9 + f.ph) * 0.02
      f.group.rotation.z = Math.sin(el * 0.6 + f.ph) * 0.04
      const celebrate = world.allWishes ? easeOutCubic((t - world.allWishesAt) / 1.5) * (0.55 + 0.45 * Math.sin(el * 3 - i * 0.5)) : 0
      f.mat.emissiveIntensity = 0.05 + 0.25 * clamp01(o) + 0.25 * f.hover + 0.35 * celebrate
      const gm = f.glow.material as THREE.SpriteMaterial
      if (opened) {
        gm.color.set('#ffd9a0')
        gm.opacity = lerp(0.2, 0.5, clamp01(o)) + 0.3 * celebrate
      } else {
        gm.color.set('#ffc7dc')
        gm.opacity = 0.2 + 0.14 * Math.sin(el * 2 + f.ph) + 0.3 * f.hover
      }
      f.glow.scale.setScalar(1.7 + 0.8 * clamp01(o) + 0.6 * celebrate)
    })
    if (light.current) light.current.intensity = lerp(0, 22, world.night) + (world.allWishes ? 10 : 0)
  })

  const burst = () => {
    if (!world.allWishes) return 0
    const age = nowSec() - world.allWishesAt
    return clamp01(age / 0.8) * clamp01(1 - (age - 6) / 6)
  }

  return (
    <group>
      {flowers.map((f, i) => (
        <primitive key={i} object={f.group} />
      ))}
      {/* áreas de toque (invisibles, un poco más grandes que la flor para facilitar el toque en celulares) */}
      {flowers.map((f, i) => (
        <mesh
          key={`hit${i}`}
          position={[f.hx, f.hy + 0.05, f.hz]}
          onClick={(e) => {
            e.stopPropagation()
            openWish(i)
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            hovered.current = i
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            if (hovered.current === i) hovered.current = -1
            document.body.style.cursor = ''
          }}
        >
          <sphereGeometry args={[0.55, 8, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      <pointLight ref={light} position={[MEADOW[0], 3.2, MEADOW[2]]} color="#ffc4d8" distance={14} decay={2} />
      <GlowPoints
        count={tier === 'low' ? 120 : 240}
        center={[MEADOW[0], 1.8, MEADOW[2]]}
        box={[10, 3.6, 10]}
        colors={['#ffe9a8', '#ffc7dc', '#fff4c4']}
        size={[0.2, 0.6]}
        rise={0.55}
        wobble={0.3}
        twinkle={0.9}
        seed={91}
        opacity={burst}
      />
    </group>
  )
}
