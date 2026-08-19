import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scroll } from './scrollState'
import { budget } from './device'

/* THE JUMP — flying through the wall into open space.
   The camera never moves. Everything else is thrown PAST it: the monogram, the LED wall, and
   these streaks. Moving the world rather than the lens is what makes the jump survivable — a
   camera that dives 20 units forward has to get back before the gallery starts, and there is no
   way to hide that return. Nothing has to come back here; the hero simply leaves through the
   viewer and the space it occupied is where the column assembles.

   Each streak is a LINE, not a point, because that is what the effect actually is: a star's
   apparent position smeared across the time the shutter is open. The line's length is the speed,
   so the field starts as a still starfield, stretches as the jump builds, and snaps back to dots
   at the far end. Lines also cost one draw call for the lot. */
/* THE LIGHT YOU FLY INTO.
   A single additive disc dead ahead. It starts as a speck at the vanishing point and swells as
   the jump builds until it fills the frame — so the whiteout that follows is not an effect thrown
   over the picture, it is the moment you reach the thing you have been flying at. The growth is
   quadratic in warp, which is how approach actually looks: almost nothing for most of the way,
   then everything at once. */
function Beacon() {
  const ref = useRef()
  const map = useMemo(() => {
    const S = 256
    const c = document.createElement('canvas')
    c.width = c.height = S
    const g = c.getContext('2d')
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    grd.addColorStop(0.0, 'rgba(255,255,255,1)')
    grd.addColorStop(0.18, 'rgba(226,240,255,0.92)')
    grd.addColorStop(0.45, 'rgba(150,200,255,0.42)')
    grd.addColorStop(1.0, 'rgba(120,170,255,0)')
    g.fillStyle = grd; g.fillRect(0, 0, S, S)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])

  useFrame(() => {
    const m = ref.current; if (!m) return
    const w = scroll.warp
    m.visible = w > 0.004 && scroll.p < 0.16
    if (!m.visible) return
    // it sits far off and comes at you, swelling as it arrives
    m.position.z = -34 + w * 30
    m.scale.setScalar(0.6 + w * w * 46)
    m.material.opacity = Math.min(1, 0.25 + w * w * 1.6) * (1 - THREE.MathUtils.smoothstep(scroll.p, 0.105, 0.15))
  })

  return (
    <mesh ref={ref} position={[0, 0, -34]} renderOrder={-3}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={map} transparent toneMapped={false} depthWrite={false}
        blending={THREE.AdditiveBlending} opacity={0} />
    </mesh>
  )
}

export default function Hyperspace() {
  const ref = useRef()
  const N = Math.round(1400 * budget)

  const geo = useMemo(() => {
    // two vertices per streak: the head, and a tail that the shader pushes back along z
    const pos = new Float32Array(N * 2 * 3)
    const seed = new Float32Array(N * 2)
    const tail = new Float32Array(N * 2)          // 0 = head, 1 = tail
    for (let i = 0; i < N; i++) {
      // a hollow cylinder ahead of the camera: nothing spawns dead centre, where it would just
      // sit in the middle of frame growing
      const a = Math.random() * Math.PI * 2
      const r = 1.6 + Math.pow(Math.random(), 0.6) * 22
      const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.72
      const z = -8 - Math.random() * 52
      for (let v = 0; v < 2; v++) {
        const o = (i * 2 + v) * 3
        pos[o] = x; pos[o + 1] = y; pos[o + 2] = z
        seed[i * 2 + v] = i / N
        tail[i * 2 + v] = v
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    g.setAttribute('aTail', new THREE.BufferAttribute(tail, 1))
    return g
  }, [N])

  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uWarp: { value: 0 }, uDist: { value: 0 }, uSpeed: { value: 0 } },
    vertexShader: `
      attribute float aSeed; attribute float aTail;
      uniform float uWarp, uDist, uSpeed;
      varying float vA;
      void main(){
        vec3 p = position;
        /* TRAVEL IS SCROLL, NOT TIME. uDist is the scroll position itself, so the field only
           moves while you move: stop mid-jump and you are parked out in the middle of it. Each
           streak is offset by its own seed so they never arrive in ranks. */
        float travel = fract(aSeed + uDist) * 60.0;
        p.z += travel;
        /* And the smear is your SPEED. Flick the wheel and the points draw out into long lines;
           ease off and they contract back to dots. That is the whole reason this reads as your
           motion rather than as an animation playing near you. */
        p.z -= aTail * (0.4 + uWarp * (2.0 + uSpeed * 30.0));
        // fade in with the jump, and out again as things pass behind the camera
        float ahead = smoothstep(2.0, -6.0, p.z);
        vA = uWarp * ahead * (0.25 + 0.75 * uWarp);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      varying float vA;
      void main(){ gl_FragColor = vec4(vec3(0.82, 0.90, 1.0), vA * 0.7); }`,
  }), [])

  useFrame(() => {
    // 9 turns of the field across the jump — enough that a full scroll of it never repeats visibly
    mat.uniforms.uDist.value = scroll.p * 9.0
    mat.uniforms.uSpeed.value = scroll.speed
    /* THE JUMP HAS TO END. `warp` is monotonic — it drives the wall and the monogram out through
       the lens and must stay at 1 so they never come back. The streaks are the opposite: they are
       the jump itself, so they get their own decay and are gone by the time the column has
       assembled. Without this they were still tearing past the frame under the title card. */
    const done = 1 - THREE.MathUtils.smoothstep(scroll.p, 0.105, 0.155)
    const v = scroll.warp * done
    mat.uniforms.uWarp.value = v
    if (ref.current) ref.current.visible = v > 0.004
  })

  return (
    <group>
      <Beacon />
      <lineSegments ref={ref} geometry={geo} material={mat} frustumCulled={false} />
    </group>
  )
}
