import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { rng } from '../lib/rng'

const vert = /* glsl */ `
attribute float aSeed;
attribute float aSize;
attribute vec3 aColor;
uniform float uTime;
uniform float uScale;
uniform float uPx;
uniform float uRise;
uniform float uYMin;
uniform float uYRange;
uniform float uWobble;
uniform float uAtten;
uniform float uTwinkle;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec3 p = position;
  if (uRise > 0.0) {
    p.y = uYMin + mod(p.y - uYMin + uTime * uRise * (0.4 + aSeed), uYRange);
  }
  p.x += sin(uTime * 0.35 + aSeed * 40.0) * uWobble;
  p.z += cos(uTime * 0.30 + aSeed * 27.0) * uWobble;
  p.y += sin(uTime * 0.50 + aSeed * 13.0) * uWobble * 0.6;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float size = aSize * uScale * uPx;
  gl_PointSize = uAtten > 0.5 ? size / max(0.1, -mv.z) : aSize * uPx * 2.0;
  float tw = 0.5 + 0.5 * sin(uTime * (0.8 + aSeed * 2.6) + aSeed * 60.0);
  vAlpha = mix(1.0, 0.2 + 0.8 * tw, uTwinkle);
  vColor = aColor;
  gl_Position = projectionMatrix * mv;
}
`
const frag = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a = a * a;
  gl_FragColor = vec4(vColor, a * vAlpha * uOpacity);
}
`

export function makeGlowMaterial(pixelRatio: number, opts: { atten?: boolean; twinkle?: number; rise?: number; yMin?: number; yRange?: number; wobble?: number; scale?: number }) {
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: opts.scale ?? 100 },
      uPx: { value: pixelRatio },
      uRise: { value: opts.rise ?? 0 },
      uYMin: { value: opts.yMin ?? 0 },
      uYRange: { value: opts.yRange ?? 1 },
      uWobble: { value: opts.wobble ?? 0.2 },
      uAtten: { value: opts.atten === false ? 0 : 1 },
      uTwinkle: { value: opts.twinkle ?? 0.6 },
      uOpacity: { value: 1 },
    },
  })
}

export interface GlowProps {
  count: number
  center?: [number, number, number]
  box: [number, number, number]
  colors: string[]
  size: [number, number]
  rise?: number
  wobble?: number
  twinkle?: number
  atten?: boolean
  scale?: number
  /** Distribuir sobre una cúpula de radio box[0] (estrellas). */
  dome?: boolean
  opacity?: number | (() => number)
  seed?: number
}

/** Partículas luminosas con parpadeo suave (luciérnagas, polvo dorado, estrellas). */
export function GlowPoints(p: GlowProps) {
  const gl = useThree((s) => s.gl)
  const { geometry, material } = useMemo(() => {
    const r = rng(p.seed ?? 7)
    const center = p.center ?? [0, 0, 0]
    const pos = new Float32Array(p.count * 3)
    const seed = new Float32Array(p.count)
    const size = new Float32Array(p.count)
    const col = new Float32Array(p.count * 3)
    const palette = p.colors.map((c) => new THREE.Color(c))
    for (let i = 0; i < p.count; i++) {
      if (p.dome) {
        const th = r() * Math.PI * 2
        const ph = Math.acos(0.02 + r() * 0.98)
        const R = p.box[0]
        pos[i * 3] = center[0] + R * Math.sin(ph) * Math.cos(th)
        pos[i * 3 + 1] = center[1] + R * Math.cos(ph)
        pos[i * 3 + 2] = center[2] + R * Math.sin(ph) * Math.sin(th)
      } else {
        pos[i * 3] = center[0] + (r() - 0.5) * p.box[0]
        pos[i * 3 + 1] = center[1] + (r() - 0.5) * p.box[1]
        pos[i * 3 + 2] = center[2] + (r() - 0.5) * p.box[2]
      }
      seed[i] = r()
      size[i] = p.size[0] + r() * (p.size[1] - p.size[0])
      const c = palette[Math.floor(r() * palette.length)]
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    const m = makeGlowMaterial(Math.min(gl.getPixelRatio(), 2), {
      atten: p.atten,
      twinkle: p.twinkle,
      rise: p.rise,
      yMin: center[1] - p.box[1] / 2,
      yRange: Math.max(0.1, p.box[1]),
      wobble: p.wobble,
      scale: p.scale,
    })
    return { geometry: g, material: m }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.count, p.seed, p.dome])

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
    if (typeof p.opacity === 'function') material.uniforms.uOpacity.value = p.opacity()
    else if (typeof p.opacity === 'number') material.uniforms.uOpacity.value = p.opacity
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}

/** Textura radial suave para sprites de resplandor. */
let glowTex: THREE.CanvasTexture | null = null
export function getGlowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.18, 'rgba(255,255,255,0.55)')
  grd.addColorStop(0.5, 'rgba(255,255,255,0.12)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  glowTex = new THREE.CanvasTexture(c)
  glowTex.colorSpace = THREE.SRGBColorSpace
  return glowTex
}

export function makeGlowSprite(color: string, scale: number, opacity = 1): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    map: getGlowTexture(),
    color: new THREE.Color(color),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity,
    fog: false,
  })
  const s = new THREE.Sprite(mat)
  s.scale.set(scale, scale, 1)
  return s
}
