import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Rosa procedural: cada pétalo es una superficie curva (columna vertebral con curvatura,
// copa lateral y borde ondulado). Los pétalos se disponen en espiral áurea, como en una rosa
// real, y cada uno tiene dos formas —cerrada y abierta— unidas por un "morph target".

const GOLDEN = 2.399963229728653
const { lerp } = THREE.MathUtils
const sstep = (x: number, a: number, b: number) => THREE.MathUtils.smoothstep(x, a, b)

export interface PetalShape {
  L: number
  W: number
  a0: number
  a1: number
  cup: number
  curl: number
}
export interface PetalSpec {
  index: number
  t: number
  closed: PetalShape
  open: PetalShape
  r0: number
  y0: number
  yaw: number
}

export function roseSpecs(n: number): PetalSpec[] {
  const out: PetalSpec[] = []
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1)
    const L = lerp(0.52, 1.0, Math.pow(t, 0.75))
    const W = lerp(0.34, 0.66, t)
    out.push({
      index: i,
      t,
      closed: { L, W, a0: lerp(-0.06, 0.16, t), a1: lerp(-1.05, 0.3, t), cup: lerp(1.0, 0.7, t), curl: 0 },
      open: {
        L,
        W,
        a0: lerp(0.3, 1.0, Math.pow(t, 0.9)),
        a1: lerp(0.35, 0.75, t),
        cup: lerp(0.75, 0.35, t),
        curl: lerp(0.1, 1.0, t),
      },
      r0: 0.035 + 0.2 * t,
      y0: lerp(0.06, -0.2, t),
      yaw: i * GOLDEN,
    })
  }
  return out
}

function shapePositions(sp: PetalSpec, sh: PetalShape, segU: number, segV: number): Float32Array {
  const nU = segU + 1
  const nV = segV + 1
  const out = new Float32Array(nU * nV * 3)
  const angAt = (v: number) => sh.a0 + sh.a1 * v * v + sh.curl * Math.pow(sstep(v, 0.62, 1.0), 1.5) * 0.55
  const sx = new Float32Array(nV)
  const sy = new Float32Array(nV)
  const an = new Float32Array(nV)
  let x = sp.r0
  let y = sp.y0
  sx[0] = x
  sy[0] = y
  an[0] = angAt(0)
  for (let j = 1; j < nV; j++) {
    const a = angAt((j - 0.5) / segV)
    x += (Math.sin(a) * sh.L) / segV
    y += (Math.cos(a) * sh.L) / segV
    sx[j] = x
    sy[j] = y
    an[j] = angAt(j / segV)
  }
  const cy = Math.cos(sp.yaw)
  const sy_ = Math.sin(sp.yaw)
  let k = 0
  for (let j = 0; j < nV; j++) {
    const v = j / segV
    const s = Math.min(v / 0.72, 1)
    let hw = sh.W * (0.26 + 0.74 * Math.sin(s * Math.PI * 0.5))
    if (v > 0.72) {
      const q = (v - 0.72) / 0.28
      hw *= Math.sqrt(Math.max(0, 1 - Math.pow(q, 2.4)))
    }
    const nx = -Math.cos(an[j])
    const ny = Math.sin(an[j])
    for (let i = 0; i < nU; i++) {
      const u = (i / segU) * 2 - 1
      const cupOff = sh.cup * u * u * hw * 0.9 * (0.35 + 0.65 * Math.sin(Math.min(v, 1) * Math.PI * 0.8))
      const ruffle = 0.035 * Math.sin(u * 6.0 + sp.index * 1.7) * sstep(v, 0.55, 1.0) * (0.4 + sh.curl)
      const px = sx[j] + nx * (cupOff - ruffle)
      const py = sy[j] + ny * (cupOff - ruffle)
      const pz = u * hw
      out[k++] = px * cy + pz * sy_
      out[k++] = py
      out[k++] = -px * sy_ + pz * cy
    }
  }
  return out
}

export interface RoseColors {
  base: THREE.Color
  mid: THREE.Color
  tip: THREE.Color
}

function petalColors(sp: PetalSpec, c: RoseColors, segU: number, segV: number): Float32Array {
  const nU = segU + 1
  const nV = segV + 1
  const out = new Float32Array(nU * nV * 3)
  const tmp = new THREE.Color()
  let k = 0
  const shade = lerp(0.7, 1.0, sp.t)
  for (let j = 0; j < nV; j++) {
    const v = j / segV
    for (let i = 0; i < nU; i++) {
      const u = (i / segU) * 2 - 1
      tmp.copy(c.base).lerp(c.mid, sstep(v, 0.0, 0.5)).lerp(c.tip, sstep(v, 0.5, 1.0))
      const edge = 1 + 0.28 * Math.pow(Math.abs(u), 3) * sstep(v, 0.3, 1.0)
      tmp.multiplyScalar(shade * edge)
      out[k++] = tmp.r
      out[k++] = tmp.g
      out[k++] = tmp.b
    }
  }
  return out
}

export type RoseMode = 'open' | 'closed' | 'morph'

export function petalGeometry(
  sp: PetalSpec,
  colors: RoseColors,
  mode: RoseMode,
  segU = 9,
  segV = 12,
  blend = 1,
): THREE.BufferGeometry {
  const nU = segU + 1
  const idx: number[] = []
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * nU + i
      const b = a + 1
      const c = a + nU
      const d = c + 1
      idx.push(a, c, b, b, c, d)
    }
  }
  const uv = new Float32Array((segU + 1) * (segV + 1) * 2)
  let q = 0
  for (let j = 0; j <= segV; j++) for (let i = 0; i <= segU; i++) {
    uv[q++] = i / segU
    uv[q++] = j / segV
  }
  const g = new THREE.BufferGeometry()
  const closedPos = shapePositions(sp, sp.closed, segU, segV)
  const openPos = shapePositions(sp, sp.open, segU, segV)
  let basePos = closedPos
  if (mode === 'open') {
    // blend < 1 → rosa "entreabierta" (en forma de copa), ideal para ramos y jardines vistos de lado
    basePos = blend >= 1 ? openPos : closedPos.map((c, i) => c + (openPos[i] - c) * blend)
  }
  g.setAttribute('position', new THREE.BufferAttribute(basePos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(petalColors(sp, colors, segU, segV), 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  if (mode === 'morph') {
    const tmp = new THREE.BufferGeometry()
    tmp.setAttribute('position', new THREE.BufferAttribute(openPos, 3))
    tmp.setIndex(idx)
    tmp.computeVertexNormals()
    g.morphAttributes.position = [new THREE.BufferAttribute(openPos, 3)]
    g.morphAttributes.normal = [tmp.getAttribute('normal') as THREE.BufferAttribute]
    g.morphTargetsRelative = false
  }
  return g
}

/** Rosa completa en una sola malla (para jardines instanciados y flores de los deseos). */
export function roseGeometry(
  n: number,
  colors: RoseColors,
  mode: RoseMode,
  segU = 8,
  segV = 10,
  blend = 1,
): THREE.BufferGeometry {
  const geos = roseSpecs(n).map((sp) => petalGeometry(sp, colors, mode, segU, segV, blend))
  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged ?? new THREE.BufferGeometry()
}

/** Posiciones de los vértices (estado cerrado) de todos los pétalos, para formar la rosa con partículas. */
export function roseSamplePoints(n: number, colors: RoseColors): Float32Array {
  const arrays = roseSpecs(n).map((sp) => {
    const g = petalGeometry(sp, colors, 'closed')
    const a = (g.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
    return Float32Array.from(a)
  })
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out = new Float32Array(total)
  let o = 0
  for (const a of arrays) {
    out.set(a, o)
    o += a.length
  }
  return out
}

// ---------- tallo, hojas y sépalos ----------

export function stemGeometry(height: number, bend: number, radius = 0.03): THREE.TubeGeometry {
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, -height, 0),
    new THREE.Vector3(bend, -height * 0.5, 0),
    new THREE.Vector3(0, -0.12, 0),
  )
  return new THREE.TubeGeometry(curve, 14, radius, 6, false)
}

export function leafGeometry(len = 0.7, wid = 0.28): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(wid, len * 0.2, wid, len * 0.7, 0, len)
  shape.bezierCurveTo(-wid, len * 0.7, -wid, len * 0.2, 0, 0)
  const g = new THREE.ShapeGeometry(shape, 10)
  const p = g.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    p.setZ(i, x * x * 0.9 - y * y * 0.12)
  }
  g.computeVertexNormals()
  return g
}

export function sepalGeometry(): THREE.BufferGeometry {
  const g = leafGeometry(0.42, 0.075)
  g.rotateZ(Math.PI)
  return g
}

export const RED_ROSE: RoseColors = {
  base: new THREE.Color('#2e030c'),
  mid: new THREE.Color('#7d0a22'),
  tip: new THREE.Color('#b61f40'),
}
/** Gradiente claro (casi blanco) para teñir con color por instancia. */
export const TINT_ROSE: RoseColors = {
  base: new THREE.Color('#b9a2a8'),
  mid: new THREE.Color('#f1e4e6'),
  tip: new THREE.Color('#ffffff'),
}
