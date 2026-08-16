import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scroll } from './scrollState'
import { useSafeTexture, plateTexture } from './procAssets'
import { budget } from './device'

/* THE GARDEN — the world the projects hang in and the place the scroll settles into.
   A backdrop plate whose top dissolves into the scene, a lawn of loose particles sitting on it,
   and a curtain of foreground ivy that only arrives at the very end. The plate comes in with the
   planting rather than with the finale, so the gallery has somewhere to be. */

export const GROUND_Y = -6.2

/* ---------- the lawn: loose particles only, sitting on the plate's own grass ---------- */
function Grass() {
  const ref = useRef()
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uPix: { value: Math.min(window.devicePixelRatio, 2) },
                uTint: { value: new THREE.Color('#ffffff') }, uFade: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    vertexShader: `
      attribute float aSize; attribute float aRnd;
      uniform float uT, uPix, uFade;
      varying vec3 vC; varying float vA;
      void main(){
        vC = color;
        vec3 p = position;
        p.x += sin(uT * 0.5 + aRnd * 9.0) * 0.05;     // the lawn breathes
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float depth = -mv.z;
        gl_PointSize = min(aSize * uPix * (95.0 / max(depth, 0.001)), 9.0 * uPix);
        vA = smoothstep(3.0, 11.0, depth) * (1.0 - smoothstep(58.0, 96.0, depth)) * uFade;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uTint;
      varying vec3 vC; varying float vA;
      void main(){
        float r = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.06, r) * vA;
        if (a < 0.004) discard;
        gl_FragColor = vec4(vC * uTint * 0.5, a);
      }`,
  }), [])

  const geo = useMemo(() => {
    const N = Math.round(46000 * budget)
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3)
    const siz = new Float32Array(N), rnd = new Float32Array(N)
    // fireflies and glowing blue flowers, per the reference — warm gold sparks over cool green
    const blade = new THREE.Color('#3f8f63'), fly = new THREE.Color('#ffd98a'), bloom = new THREE.Color('#7fc4ff')
    const c = new THREE.Color()
    for (let i = 0; i < N; i++) {
      const r = 46 * Math.sqrt(Math.random())
      const a = Math.random() * Math.PI * 2
      pos[i*3] = Math.cos(a) * r
      pos[i*3+1] = GROUND_Y + Math.random() * 0.9 - 0.18
      pos[i*3+2] = Math.sin(a) * r - 6
      const m = Math.random()
      c.copy(m < 0.70 ? blade : m < 0.88 ? bloom : fly).multiplyScalar(0.45 + Math.random() * 0.85)
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b
      siz[i] = 0.35 + Math.random() * 0.8
      rnd[i] = Math.random()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(siz, 1))
    g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1))
    return g
  }, [])

  useFrame(({ clock }) => {
    mat.uniforms.uT.value = clock.elapsedTime
    mat.uniforms.uFade.value = scroll.fin
    mat.uniforms.uTint.value.copy(scroll.tint)
    if (ref.current) ref.current.visible = scroll.fin > 0.01
  })
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />
}

/* A backdrop plate whose TOP dissolves instead of ending.
   A plain textured plane shows a hard horizontal edge where it stops, which is what made the
   generated art read as a photo stuck behind the scene. Fading the top (and the sides) into
   nothing lets it sit underneath the particle work as one continuous space. */
function platePlaneMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uOpacity: { value: 0 } },
    transparent: true, depthWrite: false, toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform float uOpacity;
      varying vec2 vUv;
      void main(){
        vec4 t = texture2D(uMap, vUv);
        // The plate now overfills the frame, so its edges are off-screen and only the top needs
        // feathering — that's the seam between the photograph and the WebGL scroll above it.
        float top  = smoothstep(1.0, 0.88, vUv.y);
        float side = 1.0, bot = 1.0;
        gl_FragColor = vec4(t.rgb, t.a * top * side * bot * uOpacity);
      }`,
  })
}

function foregroundVineMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uOpacity: { value: 0 } },
    transparent: true, depthWrite: false, toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform float uOpacity;
      varying vec2 vUv;
      void main(){
        vec4 t = texture2D(uMap, vUv);
        // Tight: only the outer ~16%, only the hanging upper portion, and only pixels bright
        // enough to actually BE a leaf. A looser mask laid a green haze over the whole frame.
        float edge = 1.0 - smoothstep(0.03, 0.16, min(vUv.x, 1.0 - vUv.x));
        float hang = smoothstep(0.28, 0.62, vUv.y);
        float lum = dot(t.rgb, vec3(0.299, 0.587, 0.114));
        float leaf = smoothstep(0.13, 0.34, lum);
        gl_FragColor = vec4(t.rgb, edge * hang * leaf * uOpacity);
      }`,
  })
}

function Grove() {
  /* ONE plate, sized to fill the frame at this distance. There is no separate 3D floor: the
     plate's own grass, mist and hedge carry the environment, and the particle lawn sits on it. */
  const plate = useSafeTexture('/tex/vines.png', plateTexture)
  const back = useRef(), fore = useRef()
  const matBack = useMemo(() => platePlaneMaterial(plate), [plate])
  const matFore = useMemo(() => foregroundVineMaterial(plate), [plate])

  useFrame(({ clock }) => {
    const fin = scroll.fin, t = clock.elapsedTime
    /* THE PLATE ARRIVES WITH THE PLANTING, not with the statuary. The project gallery used to run
       against pure black, which made the point-cloud trees look like they were floating in space;
       the garden backdrop behind them gives the whole middle act somewhere to be. It comes in at
       80% with the bloom and goes to full once you're down on the floor. */
    const early = Math.max(scroll.bloom * 0.8, fin)
    matBack.uniforms.uOpacity.value = early
    // the foreground ivy stays finale-only — over the cards it would just be leaves on the work
    matFore.uniforms.uOpacity.value = fin * 0.95
    if (back.current) {
      back.current.visible = early > 0.01
      back.current.position.x = Math.sin(t * 0.03) * 0.7          // a breath of drift
      back.current.position.y = 6 + Math.sin(t * 0.045) * 0.4
    }
    if (fore.current) {
      fore.current.visible = fin > 0.01
      // the foreground ivy sways more than the backdrop, which is what sells the depth
      fore.current.position.x = Math.sin(t * 0.11) * 0.5
      fore.current.position.y = 1 + Math.sin(t * 0.14 + 1.3) * 0.32
    }
  })

  return (
    <group>
      {/* THE HARSH LINE AT THE BOTTOM WAS THIS PLANE'S OWN EDGE.
          At 112x63 centred on y=1.2 the bottom of the rectangle fell inside the frustum, and
          there is nothing behind it but the black scene — so you saw the backdrop simply stop.
          Now 139x78 centred on y=6, which is where the tilted view actually looks at this depth,
          so both edges sit outside the frame with margin to spare. */}
      <mesh ref={back} position={[0, 6, -40]} renderOrder={-4}>
        <planeGeometry args={[139, 78]} />
        <primitive object={matBack} attach="material" />
      </mesh>
      <mesh ref={fore} position={[0, 1, 6]} renderOrder={3}>
        <planeGeometry args={[52, 29]} />
        <primitive object={matFore} attach="material" />
      </mesh>
    </group>
  )
}

export default function Finale() {
  return (
    <>
      <Grove />
      <Grass />
    </>
  )
}
