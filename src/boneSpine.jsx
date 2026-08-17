import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'
import { scroll } from './scrollState'
import Optional from './assetGuard.jsx'
import { proceduralSpine } from './procAssets'
import { budget } from './device'

/* A single FULL vertebral column, cervical down to the sacrum.
   Not a vertebra rubber-stamped: you descend the real thing, and by the end of
   the scroll you have arrived at its base. ?spine=curved swaps the mesh. */

// Size the column by its CROSS-SECTION, never its length. Scaling the longest axis to a
// fixed height made a spine as wide as the cards. A real spine is thin and long, so we set
// the thickness and let the length fall out of it.
// 5.4 -> 7.2: the real vertebra mesh is the centrepiece of the handover now, and the camera dives
// at it. At the old width it was a prop in the distance rather than something you pass through.
const SPINE_W = 7.2

/* THE CONVERGENCE — how the monogram becomes the column.
   Every particle carries two positions: P_scatter, a wide spherical throw, and P_spine, an actual
   point ON the surface of the vertebra mesh, taken with a surface sampler so the target is the
   real geometry rather than a cylinder standing in for it. The vertex shader walks between them:

     p = mix(P_scatter, P_spine, ease) + curl-ish noise * (1 - ease)

   The noise term is scaled by (1 - ease) so the swarm is turbulent while it travels and dead
   still by the time it lands — otherwise the particles jitter on the bone forever and it never
   resolves. The easing is a cubic-out on scroll progress, so the flight is fast at the start and
   settles slowly, and the solid mesh fades up underneath only over the last 40% of the flight:
   the bone appears to assemble FROM the particles rather than cross-fading with them.

   This is what replaces the whiteout. Nothing is hidden now — you watch the object become the
   column. */
function Swarm({ geometry, height }) {
  const ref = useRef()
  const N = Math.round(9000 * budget)

  const geo = useMemo(() => {
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(geometry)).build()
    const target = new Float32Array(N * 3)
    const scatter = new Float32Array(N * 3)
    const rnd = new Float32Array(N)
    const siz = new Float32Array(N)
    const col = new Float32Array(N * 3)
    const p = new THREE.Vector3(), c = new THREE.Color()
    const pal = ['#ff8ad0', '#8fe6ff', '#b98cff', '#7fffd0', '#dfe8ff']

    for (let i = 0; i < N; i++) {
      sampler.sample(p)
      target[i * 3] = p.x; target[i * 3 + 1] = p.y; target[i * 3 + 2] = p.z
      // thrown wide and high, biased outward so the flight reads as an inward rush
      const a = Math.random() * Math.PI * 2
      const r = 14 + Math.random() * 26
      scatter[i * 3] = Math.cos(a) * r
      scatter[i * 3 + 1] = (Math.random() - 0.5) * height * 1.6
      scatter[i * 3 + 2] = Math.sin(a) * r
      rnd[i] = Math.random()
      siz[i] = 0.5 + Math.pow(Math.random(), 2.2) * 2.6
      c.set(pal[(Math.random() * pal.length) | 0]).multiplyScalar(0.6 + Math.random() * 0.6)
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(target, 3))
    g.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3))
    g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(siz, 1))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [geometry, height, N])

  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: {
      uT: { value: 0 }, uConv: { value: 0 }, uIn: { value: 0 },
      uPix: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
      attribute vec3 aScatter; attribute float aRnd; attribute float aSize;
      uniform float uT, uConv, uPix;
      varying vec3 vC; varying float vA;
      void main(){
        vC = color;
        // staggered arrival: each particle lands on its own beat, so the swarm gathers rather
        // than snapping into place all at once
        float e = clamp((uConv - aRnd * 0.35) / 0.65, 0.0, 1.0);
        e = 1.0 - pow(1.0 - e, 3.0);

        vec3 p = mix(aScatter, position, e);
        // turbulence while it flies, nothing once it has landed
        float w = (1.0 - e) * 2.2;
        p.x += sin(uT * 0.7 + aRnd * 21.0) * w;
        p.y += cos(uT * 0.55 + aRnd * 17.0) * w;
        p.z += sin(uT * 0.63 + aRnd * 13.0) * w;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float depth = -mv.z;
        // brightest mid-flight, then handing over to the solid bone
        vA = (0.35 + 0.65 * sin(aRnd * 20.0 + uT * 1.4)) * (0.35 + 0.65 * (1.0 - e));
        gl_PointSize = min(aSize * uPix * (46.0 / max(depth, 0.001)), 11.0 * uPix);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uIn;
      varying vec3 vC; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.06, d);
        gl_FragColor = vec4(vC, a * a * vA * 0.6 * uIn);
      }`,
  }), [])

  useFrame(({ clock }) => {
    mat.uniforms.uT.value = clock.elapsedTime
    mat.uniforms.uConv.value = scroll.spineIn
    // present for the flight, gone once the bone has taken over
    const out = THREE.MathUtils.smoothstep(scroll.fin, 0.0, 0.5)
    mat.uniforms.uIn.value = Math.min(1, scroll.bloom * 1.6) * (1 - out)
    if (ref.current) ref.current.visible = mat.uniforms.uIn.value > 0.01
  })

  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />
}

/* THE SHED — the column giving off matter.
   Every particle owns a birth radius near the bone and a direction away from the axis, and its
   life is a sawtooth on the clock: it appears close in, drifts outward, swells slightly and fades
   as it goes, then wraps back to the start. Because each has its own phase offset the cloud never
   pulses in unison — at any instant some are new and tight to the surface while others are far
   out and nearly gone, which is what reads as continuous shedding rather than an explosion.

   They are round sprites, not spheres: at this size a lit sphere costs a draw call each and looks
   identical to a soft disc, and additive discs blend into the bokeh the reference has. */
function Shed({ height }) {
  const ref = useRef()
  const N = Math.round(2600 * budget)

  const geo = useMemo(() => {
    const pos = new Float32Array(N * 3)     // birth point: angle and radius around the axis
    const rnd = new Float32Array(N)         // phase offset, so lives don't sync
    const siz = new Float32Array(N)
    const col = new Float32Array(N * 3)
    const c = new THREE.Color()
    // the column's own dichroic palette, so the dust looks like it came off the bone
    const pal = ['#ffb8e0', '#9fe8ff', '#c8a6ff', '#a8ffe0', '#ffe6c2', '#e8eeff', '#6b7fb0', '#4f5f8c']
    /* CLUMPED, not evenly sprinkled. The reference's balls come off the bone in clusters with
       clear black between them; an even field reads as noise. So seed a set of anchors along the
       column and hang each particle off one of them. */
    const CLUMPS = 34
    const anchors = Array.from({ length: CLUMPS }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 1.5 + Math.random() * 1.6,
      y: (Math.random() - 0.5) * height * 0.92,
    }))
    for (let i = 0; i < N; i++) {
      const k = anchors[i % CLUMPS]
      const spread = 0.5 + Math.random() * 1.5
      const off = Math.random() * Math.PI * 2
      const a = k.a + Math.cos(off) * spread * 0.16
      const r = k.r + Math.sin(off) * spread * 0.5
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = k.y + (Math.random() - 0.5) * spread * 2.4
      pos[i * 3 + 2] = Math.sin(a) * r
      rnd[i] = Math.random()
      siz[i] = 0.8 + Math.pow(Math.random(), 1.7) * 5.2     // a few big ones, most small
      c.set(pal[(Math.random() * pal.length) | 0]).multiplyScalar(0.55 + Math.random() * 0.8)
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(siz, 1))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [N, height])

  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { uT: { value: 0 }, uIn: { value: 0 }, uPix: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: `
      attribute float aRnd; attribute float aSize;
      uniform float uT, uPix;
      varying vec3 vC; varying float vA;
      void main(){
        vC = color;
        // life 0..1, each particle offset by its own seed
        float life = fract(uT * (0.055 + aRnd * 0.055) + aRnd);
        vec3 p = position;
        vec2 outward = normalize(p.xz);
        p.xz += outward * life * (5.5 + aRnd * 7.0);      // away from the axis
        p.y += (aRnd - 0.5) * life * 3.0;                 // and a little drift along it
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float depth = -mv.z;
        // in fast, out slow: bright the instant it leaves the bone, then a long fade
        vA = smoothstep(0.0, 0.06, life) * (1.0 - smoothstep(0.25, 1.0, life));
        gl_PointSize = min(aSize * uPix * (46.0 / max(depth, 0.001)) * (1.0 + life * 1.5), 26.0 * uPix);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uIn;
      varying vec3 vC; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        // out-of-focus spheres are brighter at the RIM than the middle — that ring is what makes
        // a disc read as bokeh instead of as a blurred dot
        float disc = smoothstep(0.5, 0.42, d);
        float rim  = smoothstep(0.5, 0.34, d) - smoothstep(0.34, 0.2, d);
        float a = disc * 0.5 + rim * 0.55 + smoothstep(0.5, 0.0, d) * 0.35;
        gl_FragColor = vec4(vC, a * vA * 0.6 * uIn);
      }`,
  }), [])

  useFrame(({ clock }) => {
    mat.uniforms.uT.value = clock.elapsedTime
    // arrives with the column and leaves with it
    const out = THREE.MathUtils.smoothstep(scroll.fin, 0.0, 0.5)
    mat.uniforms.uIn.value = scroll.spineIn * (1 - out)
    if (ref.current) ref.current.visible = mat.uniforms.uIn.value > 0.01
  })

  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />
}

/* The column proper. It takes its geometry as a prop so the same animation drives either the
   real mesh or the procedural stand-in below. */
function Column({ geometry, height, map }) {
  const ref = useRef()
  const grp = useRef()

  /* DICHROIC BONE. A dark, near-black base whose colour is almost entirely thin-film
     interference and rim light — the surface shifts pink to teal to violet as it turns, which is
     what makes it read as a specimen under lights rather than as a prop. The GLB's own texture is
     kept but darkened right down, so its detail survives as structure while the iridescence
     supplies all of the colour. */
  const material = useMemo(() => new THREE.MeshPhysicalMaterial({
    map: map ?? null,
    color: map ? '#2a3340' : '#131a20',
    roughness: 0.24, metalness: 0.62,
    clearcoat: 1, clearcoatRoughness: 0.14,
    iridescence: 1, iridescenceIOR: 2.0, iridescenceThicknessRange: [180, 820],
    envMapIntensity: 2.3, sheen: 0.7, sheenColor: new THREE.Color('#9fd8ff'),
    transparent: true, opacity: 1,
  }), [map])

  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    // start at the cervical end, arrive at the sacrum as the scroll completes
    const travel = Math.max(0, height - 13)
    // ...and in act three it retreats to the apex of the V and drives its sacrum down THROUGH the
    // ground plane, which is opaque — so the column simply disappears into the earth behind the
    // main bust instead of stopping dead on the surface.
    // The column ENTERS from above rather than being there from frame one: at spineIn 0 it sits
    // a full height up, out of frame, so the opening is just the sigil on black.
    const entry = (1 - scroll.spineIn) * (height * 0.85)
    // the GROUP carries the travel, so the shed dust rides with the column without spinning with it
    const g = grp.current
    if (g) {
      g.position.y = -travel / 2 + scroll.p * travel - scroll.fin * 1.6 + entry
      g.position.z = -scroll.fin * 19    // retreats as the garden takes over
    }
    // THE COLUMN LEAVES WITH THE WORK. It belongs to the project act; once the last panel has gone
    // past it fades out over the first half of the garden's arrival rather than standing in the
    // planting as a leftover.
    const out = THREE.MathUtils.smoothstep(scroll.fin, 0.0, 0.5)
    if (g) g.visible = scroll.spineIn > 0.002 && out < 0.995
    // SCROLL DRIVES THE SPIN. On a clock alone the column turned whether or not you were doing
    // anything; tied to progress it reads as you walking around it — roughly two and a half turns
    // across the whole journey, with a slow idle drift underneath so it never sits dead still.
    m.rotation.y = scroll.p * Math.PI * 5 + clock.elapsedTime * 0.02
    m.rotation.z = Math.sin(clock.elapsedTime * 0.13) * 0.02
    /* The solid mesh fades up only over the last 45% of the convergence, so the particles are
       seen to become the bone rather than dissolving into an object that was already there. */
    material.opacity = THREE.MathUtils.smoothstep(scroll.spineIn, 0.55, 1.0) * (1 - out)
  })

  return (
    <group ref={grp}>
      <mesh ref={ref} geometry={geometry} material={material} frustumCulled={false} />
      <Swarm geometry={geometry} height={height} />
      <Shed height={height} />
    </group>
  )
}

function GLBColumn() {
  const which = typeof location !== 'undefined' && location.search.includes('spine=curved')
    ? '/models/spine_curved.glb' : '/models/spine_straight.glb'
  const { scene } = useGLTF(which)

  const { geometry, height, map } = useMemo(() => {
    let g = null, map = null
    // ...and take its baked texture with it, if the generation came with one
    scene.traverse(o => {
      if (!g && o.isMesh) {
        g = o.geometry.clone()
        const m = Array.isArray(o.material) ? o.material[0] : o.material
        if (m?.map) { map = m.map; map.colorSpace = THREE.SRGBColorSpace }
      }
    })
    if (!g) return { geometry: new THREE.CylinderGeometry(0.4, 0.4, 20, 12), height: 20, map: null }

    const size = new THREE.Vector3(), c = new THREE.Vector3()
    g.computeBoundingBox(); g.boundingBox.getSize(size); g.boundingBox.getCenter(c)
    g.translate(-c.x, -c.y, -c.z)

    // image_to_3d gives arbitrary orientation: stand the longest axis up along Y
    if (size.x >= size.y && size.x >= size.z) g.rotateZ(Math.PI / 2)
    else if (size.z > size.y && size.z > size.x) g.rotateX(-Math.PI / 2)

    g.computeBoundingBox(); g.boundingBox.getSize(size)
    const k = SPINE_W / Math.max(size.x, size.z)
    g.scale(k, k, k)
    g.computeVertexNormals()
    return { geometry: g, height: size.y * k, map }
  }, [scene])

  return <Column geometry={geometry} height={height} map={map} />
}

// No GLB on disk: a stacked column of centra, discs and lateral processes stands in for it.
function ProcColumn() {
  const { geometry, height } = useMemo(() => proceduralSpine(SPINE_W), [])
  return <Column geometry={geometry} height={height} />
}

export default function BoneSpine() {
  return (
    <Optional name="/models/spine_straight.glb" fallback={<ProcColumn />}>
      <GLBColumn />
    </Optional>
  )
}

useGLTF.preload('/models/spine_straight.glb')
