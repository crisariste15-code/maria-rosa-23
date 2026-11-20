import { useEffect } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'

/** Entorno de estudio generado en código (sin descargar HDRs): da reflejos suaves y cálidos. */
export function useStudioEnv(intensity = 0.6) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl)
    const env = new THREE.Scene()
    env.background = new THREE.Color('#150a22')
    const panel = (color: string, power: number, pos: [number, number, number], sc: [number, number]) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }),
      )
      m.position.set(...pos)
      m.scale.set(sc[0], sc[1], 1)
      m.lookAt(0, 0, 0)
      env.add(m)
    }
    panel('#ffe2c4', 6, [-5, 6, 4], [6, 6])
    panel('#ff7aa8', 4, [6, 2, -4], [5, 8])
    panel('#a58cff', 3, [4, -3, 5], [6, 4])
    panel('#ffffff', 2, [0, 8, 0], [8, 8])
    const rt = pm.fromScene(env, 0.04)
    scene.environment = rt.texture
    ;(scene as unknown as { environmentIntensity: number }).environmentIntensity = intensity
    return () => {
      scene.environment = null
      rt.dispose()
      pm.dispose()
    }
  }, [gl, scene, intensity])
}
