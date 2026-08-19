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
    m.visible = w > 0.004 && scroll.p < 0.235
    if (!m.visible) return
    /* It sits far off and comes at you. The growth carries a LINEAR term as well as the square
       one: on the square alone the middle of a three-second approach was a stretch of frames with
       nothing changing in them, which is most of why the old jump felt like a switch rather than a
       flight. Now the light is visibly closing the whole way, and still arrives all at once. */
    m.position.z = -34 + w * 30
    m.scale.setScalar(0.6 + w * 3.2 + w * w * 44)
    m.material.opacity = Math.min(1, 0.18 + w * 0.5 + w * w * 1.3)
      /* and it is CONSUMED by the flash. Left burning past it, a disc this size with no depth
         test washed a grey haze over the column and the first cards. */
      * (1 - THREE.MathUtils.smoothstep(scroll.p, 0.152, 0.182))
  })

  return (
    /* depthTest OFF, and drawn after the wall. The light is BEYOND the panels you are flying at,
       and the wall writes depth — left to the depth buffer the beacon was hidden behind the very
       thing you were supposed to be flying through, so the approach had nothing in it. Drawing
       order still puts the monogram in front, which is what it should be: the object is
       silhouetted against the light it is taking you into. */
    <mesh ref={ref} position={[0, 0, -34]} renderOrder={-3}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={map} transparent toneMapped={false} depthWrite={false}
        depthTest={false} blending={THREE.AdditiveBlending} opacity={0} />
    </mesh>
  )
}

/* WHERE YOU COME OUT — and where the column lives from then on.
   The jump ends in open space, so open space has to still be there afterwards: a deep field of
   stars and two soft clouds of gas, far behind everything, that fade up as you come through the
   light and stay for the whole gallery. Without them the column is a lit object on black; with
   them it is a specimen suspended somewhere.

   Both are as cheap as scenery gets — one draw call of points and two textured planes — and both
   turn with your scroll rather than a clock, so the parallax reads as you moving past them. */
function Starfield() {
  const ref = useRef()
  const N = Math.round(1100 * budget)

  const geo = useMemo(() => {
    const pos = new Float32Array(N * 3)
    const rnd = new Float32Array(N)
    const siz = new Float32Array(N)
    const col = new Float32Array(N * 3)
    const c = new THREE.Color()
    // starlight is near white with a bias to blue, and the occasional warm one
    const pal = ['#ffffff', '#dfe9ff', '#bcd2ff', '#ffe7cf', '#cfe0ff', '#a8c4ff']
    for (let i = 0; i < N; i++) {
      // a THICK shell, so there is real depth between the near stars and the far ones
      const a = Math.random() * Math.PI * 2
      const r = 46 + Math.pow(Math.random(), 0.7) * 84
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = (Math.random() - 0.5) * 150
      pos[i * 3 + 2] = Math.sin(a) * r
      rnd[i] = Math.random()
      siz[i] = 0.5 + Math.pow(Math.random(), 3.0) * 3.4      // a few bright ones, most faint
      c.set(pal[(Math.random() * pal.length) | 0])
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(siz, 1))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [N])

  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { uT: { value: 0 }, uIn: { value: 0 }, uPix: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: `
      attribute float aRnd; attribute float aSize;
      uniform float uT, uPix;
      varying vec3 vC; varying float vA;
      void main(){
        vC = color;
        // scintillation: each star on its own slow beat, so the field is never static
        vA = 0.55 + 0.45 * sin(uT * (0.35 + aRnd * 0.9) + aRnd * 30.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = min(aSize * uPix * (190.0 / max(-mv.z, 0.001)), 6.0 * uPix);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uIn;
      varying vec3 vC; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vC, a * a * vA * uIn);
      }`,
  }), [])

  useFrame(({ clock }) => {
    mat.uniforms.uT.value = clock.elapsedTime
    // up with the jump, held for the whole gallery, gone by the time the garden owns the frame
    const out = THREE.MathUtils.smoothstep(scroll.fin, 0.1, 0.6)
    mat.uniforms.uIn.value = Math.max(scroll.warp * 0.5, scroll.bloom) * (1 - out)
    const g = ref.current
    if (g) {
      g.visible = mat.uniforms.uIn.value > 0.01
      g.rotation.y = scroll.p * 0.26
      g.position.y = -scroll.gardenY * 0.06
    }
  })

  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />
}

/* Two clouds of gas, far enough back that they never resolve into anything — they exist to put
   colour behind the column and to stop deep space reading as a flat black wall. */
function Nebula() {
  const a = useRef(), b = useRef()
  const map = useMemo(() => {
    const S = 512
    const c = document.createElement('canvas')
    c.width = c.height = S
    const g = c.getContext('2d')
    g.fillStyle = '#000'
    g.fillRect(0, 0, S, S)
    g.globalCompositeOperation = 'lighter'
    const blob = (x, y, r, col) => {
      const grd = g.createRadialGradient(x, y, 0, x, y, r)
      grd.addColorStop(0, col)
      grd.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grd
      g.fillRect(0, 0, S, S)
    }
    /* Deep and dim. Gas clouds this size are BACKGROUND — at any real strength they stop being
       depth behind the column and become a coloured wash over the whole frame, which is exactly
       what deep space is not. */
    blob(S * 0.42, S * 0.44, S * 0.46, 'rgba(78,58,170,0.30)')
    blob(S * 0.64, S * 0.58, S * 0.34, 'rgba(32,110,175,0.20)')
    blob(S * 0.30, S * 0.68, S * 0.28, 'rgba(150,55,135,0.16)')
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const out = THREE.MathUtils.smoothstep(scroll.fin, 0.1, 0.6)
    const v = scroll.bloom * (1 - out)
    if (a.current) {
      a.current.material.opacity = v * 0.3
      a.current.visible = v > 0.01
      a.current.rotation.z = t * 0.008 + scroll.p * 0.2
    }
    if (b.current) {
      b.current.material.opacity = v * 0.2
      b.current.visible = v > 0.01
      b.current.rotation.z = -t * 0.006 - scroll.p * 0.15
    }
  })

  return (
    <group>
      <mesh ref={a} position={[-14, 6, -78]}>
        <planeGeometry args={[190, 190]} />
        <meshBasicMaterial map={map} transparent opacity={0} fog={false}
          blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={b} position={[22, -10, -104]}>
        <planeGeometry args={[240, 240]} />
        <meshBasicMaterial map={map} transparent opacity={0} fog={false}
          blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
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
    // same reasoning as the beacon: the starfield is outside the room, and the room is opaque
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
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
    // 13 turns of the field across the scroll — the jump window is wider than it was, and the
    // field has to keep flowing across all of it rather than crawling
    mat.uniforms.uDist.value = scroll.p * 13.0
    mat.uniforms.uSpeed.value = scroll.speed
    /* THE JUMP HAS TO END. `warp` is monotonic — it drives the wall and the monogram out through
       the lens and must stay at 1 so they never come back. The streaks are the opposite: they are
       the jump itself, so they get their own decay and are gone by the time the column has
       assembled. Without this they were still tearing past the frame under the title card. */
    const done = 1 - THREE.MathUtils.smoothstep(scroll.p, 0.168, 0.228)
    const v = scroll.warp * done
    mat.uniforms.uWarp.value = v
    if (ref.current) ref.current.visible = v > 0.004
  })

  return (
    <group>
      <Nebula />
      <Starfield />
      <Beacon />
      <lineSegments ref={ref} geometry={geo} material={mat} renderOrder={-4} frustumCulled={false} />
    </group>
  )
}
