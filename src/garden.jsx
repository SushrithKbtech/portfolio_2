import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scroll } from './scrollState'
import { budget } from './device'

/* ============================================================
   THE GARDEN — a point cloud, not vegetation geometry.
   Every point knows two positions:
     aStart  = collapsed into a double helix under the sigil (the "DNA tail")
     position = its final place in the garden
   uBloom 0→1 detonates the tail outward into the garden, and running it
   back to 0 at the end of the scroll reforms the tail. One mechanic,
   both bookends.
   ============================================================ */

// more points to go with the denser planting — scaled down on phones and tablets, where a third
// of a million points is not a fair ask
const N = Math.round(300000 * budget)

/* THE SPECIES. Four was a planting; nine is a garden. The point of the extra five is not variety
   for its own sake — it is SILHOUETTE. A bed of domes and blobs reads as topiary however many of
   them you add; what makes a garden look composed is the arching frond against the vertical
   spire against the flat spread of a fan. */
const TREE = 0, MUSHROOM = 1, TENDRIL = 2, BUSH = 3
const FERN = 4, GRASS = 5, FAN = 6, SPIRE = 7, BLOSSOM = 8
// roughly how much of the frame each one occupies, used to hand out points — a sapling and a full
// tree drawing the same number of points is what made the big planting look thin
const MASS = { 0: 3.0, 1: 0.7, 2: 1.1, 3: 1.0, 4: 1.6, 5: 0.9, 6: 2.2, 7: 1.2, 8: 1.8 }

function rnd(a, b) { return a + Math.random() * (b - a) }

// palette: mostly cool green/teal, gold highlights, rare magenta
const PAL = ['#7dffb2', '#2fe0a8', '#9bff6a', '#d8ff8a', '#ffd76a', '#ffb03a', '#65e8ff', '#ff6ad5']
const WEIGHT = [0.26, 0.2, 0.14, 0.12, 0.1, 0.06, 0.09, 0.03]
// blossoms get their own palette — the reference's flowers are dense pink/violet point clusters
const BLOOM_PAL = ['#ff6ad5', '#ff8ecb', '#c86bff', '#9a5cff', '#ffb3e6', '#e0a0ff', '#ff4fa3']
const BLOOM_W = [0.22, 0.2, 0.17, 0.14, 0.12, 0.09, 0.06]

function pickWeighted(pal, weights) {
  let r = Math.random(), acc = 0
  for (let i = 0; i < weights.length; i++) { acc += weights[i]; if (r <= acc) return pal[i] }
  return pal[0]
}

export default function Garden() {
  const ref = useRef()

  const geo = useMemo(() => {
    const pos = new Float32Array(N * 3)
    const start = new Float32Array(N * 3)
    const col = new Float32Array(N * 3)
    const siz = new Float32Array(N)
    const rn = new Float32Array(N)

    const tmp = new THREE.Color()

    /* ---- build the planting: GROVES, not a scatter.
       A uniform sprinkle over a cylinder is what a random number generator does, and it looks
       like it: evenly spaced, evenly boring, gaps you can see straight through in every
       direction. Real planting comes in stands — a cluster of the same few species with clear
       ground between one stand and the next — and that grouping is most of the difference
       between scenery and somewhere you would pay to walk through.

       So: two dozen grove centres around the column, each with its OWN palette of two or three
       species, and every plant placed near a centre with a soft falloff. A tenth are left as
       strays to keep the edges from reading as circles. */
    const plants = []
    const COUNT = Math.round(430 * (0.55 + budget * 0.45))
    const GROVES = 24
    const groves = Array.from({ length: GROVES }, () => {
      const a = Math.random() * Math.PI * 2
      const rad = rnd(8.5, 30)
      // each grove is a stand of two or three species, drawn from the full set
      const set = [TREE, MUSHROOM, TENDRIL, BUSH, FERN, GRASS, FAN, SPIRE, BLOSSOM]
      const n = 2 + ((Math.random() * 2) | 0)
      const mix = Array.from({ length: n }, () => set[(Math.random() * set.length) | 0])
      return { x: Math.cos(a) * rad, z: Math.sin(a) * rad, y: rnd(-46, 46), mix, spread: rnd(3.5, 9) }
    })
    for (let i = 0; i < COUNT; i++) {
      const stray = Math.random() < 0.1
      const g0 = groves[(Math.random() * GROVES) | 0]
      const a = Math.random() * Math.PI * 2
      const off = Math.pow(Math.random(), 0.6) * g0.spread
      const rad = stray ? rnd(8.5, 30) : 0
      const sa = Math.random() * Math.PI * 2
      const kind = stray
        ? [TREE, BUSH, FERN, GRASS, TENDRIL][(Math.random() * 5) | 0]
        : g0.mix[(Math.random() * g0.mix.length) | 0]
      const scale = rnd(0.7, 1.9) * (kind === FAN || kind === TREE ? 1.15 : 1)
      plants.push({
        x: stray ? Math.cos(sa) * rad : g0.x + Math.cos(a) * off,
        z: stray ? Math.sin(sa) * rad : g0.z + Math.sin(a) * off,
        y: stray ? rnd(-46, 46) : g0.y + rnd(-7, 7),
        kind,
        scale,
        rot: Math.random() * Math.PI * 2,     // which way this one faces
        flower: kind === BLOSSOM || kind === SPIRE,
        weight: MASS[kind] * scale * scale,
      })
    }

    // POINTS GO WHERE THE MASS IS: a cumulative table, picked by binary search, so a full tree
    // gets its share and a mushroom gets a mushroom's share.
    const cum = new Float32Array(plants.length)
    let acc = 0
    for (let k = 0; k < plants.length; k++) { acc += plants[k].weight; cum[k] = acc }
    const pickPlant = () => {
      const r = Math.random() * acc
      let lo = 0, hi = plants.length - 1
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid }
      return plants[lo]
    }

    let i = 0
    while (i < N) {
      const p = pickPlant()
      const s = p.scale
      let x, y, z

      if (p.kind === 0) {
        // TREE: slim trunk + broad canopy
        if (Math.random() < 0.22) {
          const t = Math.random()
          x = p.x + rnd(-0.16, 0.16) * s
          y = p.y + t * 7 * s
          z = p.z + rnd(-0.16, 0.16) * s
        } else {
          const u = Math.random() * Math.PI * 2
          const v = Math.acos(2 * Math.random() - 1)
          const r = Math.pow(Math.random(), 0.42) * 3.5 * s
          x = p.x + Math.sin(v) * Math.cos(u) * r
          y = p.y + 7 * s + Math.cos(v) * r * 0.62
          z = p.z + Math.sin(v) * Math.sin(u) * r
        }
      } else if (p.kind === 1) {
        // MUSHROOM: short stalk + dome cap
        if (Math.random() < 0.3) {
          const t = Math.random()
          x = p.x + rnd(-0.12, 0.12) * s
          y = p.y + t * 2.1 * s
          z = p.z + rnd(-0.12, 0.12) * s
        } else {
          const u = Math.random() * Math.PI * 2
          const r = Math.pow(Math.random(), 0.5) * 2.1 * s
          const dome = Math.cos((r / (2.1 * s)) * Math.PI * 0.5)
          x = p.x + Math.cos(u) * r
          y = p.y + 2.1 * s + dome * 0.9 * s
          z = p.z + Math.sin(u) * r
        }
      } else if (p.kind === 2) {
        // HANGING TENDRIL: a strand falling, swaying wider as it drops
        const t = Math.pow(Math.random(), 0.8)
        const sway = t * 1.5 * s
        const a2 = p.y * 0.6
        x = p.x + Math.sin(a2 + t * 5) * sway + rnd(-0.1, 0.1)
        y = p.y - t * 11 * s
        z = p.z + Math.cos(a2 + t * 5) * sway + rnd(-0.1, 0.1)
      } else if (p.kind === 3) {
        // LOW BUSH: flattened blob
        const u = Math.random() * Math.PI * 2
        const r = Math.pow(Math.random(), 0.55) * 2.4 * s
        x = p.x + Math.cos(u) * r
        y = p.y + rnd(0, 0.9) * s
        z = p.z + Math.sin(u) * r
      } else if (p.kind === 4) {
        // FERN: a frond that climbs, arches over and falls away, with leaflets stepping out
        // either side of the rachis and shortening toward the tip
        const t = Math.pow(Math.random(), 0.85)
        const cos = Math.cos(p.rot), sin = Math.sin(p.rot)
        const along = t * 3.4 * s
        const leaf = (Math.random() - 0.5) * (1 - t * 0.72) * 2.2 * s
        x = p.x + cos * along - sin * leaf
        z = p.z + sin * along + cos * leaf
        y = p.y + Math.sin(t * 1.75) * 3.4 * s - Math.abs(leaf) * 0.18
      } else if (p.kind === 5) {
        // GRASS: a clump of blades, each leaning out on its own bearing
        const blade = (Math.random() * 11) | 0
        const ba = p.rot + blade * 0.63
        const t = Math.pow(Math.random(), 0.8)
        const lean = t * t * 1.3 * s
        x = p.x + Math.cos(ba) * (0.12 + lean) + rnd(-0.06, 0.06)
        y = p.y + t * 3.6 * s
        z = p.z + Math.sin(ba) * (0.12 + lean) + rnd(-0.06, 0.06)
      } else if (p.kind === 6) {
        // FAN: broad leaves radiating from a low crown, each dipping under its own weight —
        // this is the one that gives the garden its horizontal lines
        const LEAVES = 7
        const li = (Math.random() * LEAVES) | 0
        const la = p.rot + (li / LEAVES) * Math.PI * 2
        const t = Math.pow(Math.random(), 0.62)
        const half = Math.sin(t * Math.PI) * 0.9 * s
        const w = (Math.random() - 0.5) * 2 * half
        const reach = t * 4.4 * s
        x = p.x + Math.cos(la) * reach - Math.sin(la) * w
        z = p.z + Math.sin(la) * reach + Math.cos(la) * w
        y = p.y + 1.3 * s + Math.sin(t * 2.1) * 1.5 * s - t * t * 1.7 * s
      } else if (p.kind === 7) {
        // SPIRE: a flowering stalk, dense at the base of the head and tapering to a point
        const t = Math.pow(Math.random(), 0.75)
        const u = Math.random() * Math.PI * 2
        const r = Math.pow(Math.random(), 0.5) * 0.85 * (1 - t * 0.8) * s
        x = p.x + Math.cos(u) * r
        y = p.y + t * 6.8 * s
        z = p.z + Math.sin(u) * r
      } else {
        // BLOSSOM: a slim trunk carrying several dense clustered flower heads
        if (Math.random() < 0.13) {
          const t2 = Math.random()
          x = p.x + rnd(-0.13, 0.13) * s
          y = p.y + t2 * 5.4 * s
          z = p.z + rnd(-0.13, 0.13) * s
        } else {
          // pick one of a few heads, then fill it densely toward its centre
          const head = (Math.random() * 5) | 0
          const ha = (head / 5) * Math.PI * 2 + p.x
          const hd = 1.5 * s
          const cx = p.x + Math.cos(ha) * hd
          const cy = p.y + 5.4 * s + Math.sin(head * 2.1) * 1.1 * s
          const cz = p.z + Math.sin(ha) * hd
          const u = Math.random() * Math.PI * 2
          const v = Math.acos(2 * Math.random() - 1)
          const r = Math.pow(Math.random(), 0.30) * 2.15 * s   // low exponent = packed centre
          x = cx + Math.sin(v) * Math.cos(u) * r
          y = cy + Math.cos(v) * r * 0.82
          z = cz + Math.sin(v) * Math.sin(u) * r
        }
      }

      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z

      // collapsed state: a tight double helix hanging under the sigil
      const k = i / N
      const strand = i % 2 === 0 ? 0 : Math.PI
      const ha = k * Math.PI * 54 + strand
      const hr = 0.5 + Math.sin(k * Math.PI * 8) * 0.16
      start[i * 3] = Math.cos(ha) * hr
      start[i * 3 + 1] = 10 - k * 26
      start[i * 3 + 2] = Math.sin(ha) * hr

      const isBloom = p.flower
      const hex = isBloom ? pickWeighted(BLOOM_PAL, BLOOM_W) : pickWeighted(PAL, WEIGHT)
      tmp.set(hex).multiplyScalar(rnd(isBloom ? 0.7 : 0.55, isBloom ? 1.35 : 1.15))
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b

      siz[i] = rnd(0.6, 2.9)
      rn[i] = Math.random()
      i++
    }

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aStart', new THREE.BufferAttribute(start, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(siz, 1))
    g.setAttribute('aRnd', new THREE.BufferAttribute(rn, 1))
    return g
  }, [])

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uT: { value: 0 },
      uBloom: { value: 0 },
      uAct3: { value: 0 },   // act one's particle field stands down for the statuary
      // At uBloom 0 every point is parked in the collapsed DNA tail, which draws as a bright white
      // coil right through the middle of the frame. That's a state act zero must never show: the
      // field stays black until the detonation is already under way, so the planting reads as
      // growing OUT of the glass object rather than as a spring that was always there.
      uIn: { value: 0 },
      /* THE GARDEN IS THE WORLD, NOT THE LAST ROOM IN IT. This was briefly held back to a fifth
         through the project act so the column would hang in open space — but the planting at full
         strength IS the setting the whole middle of this journey wants: the column and the cards
         stand in it, the leaves come off it, and it never dims. The uniform is gone with the
         idea; the detonation and act three now share one continuous state. */
      // a single overexposed beat as the field leaves the seed
      uFlash: { value: 0 },
      uPix: { value: Math.min(window.devicePixelRatio, 2) },
      uTint: { value: new THREE.Color('#ffffff') },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    vertexShader: `
      attribute vec3 aStart;
      attribute float aSize;
      attribute float aRnd;
      uniform float uT, uBloom, uPix, uFlash;
      varying vec3 vC;
      varying float vA;
      void main(){
        vC = color;
        // staggered detonation so it unfurls instead of popping
        float b = clamp((uBloom - aRnd * 0.38) / 0.62, 0.0, 1.0);
        b = b * b * (3.0 - 2.0 * b);
        /* BIG BANG. Scaling the DNA tail down still left the tail's SHAPE — a thin vertical
           dashed line hanging in the middle of frame before it unwound. The seed is now a tiny
           SPHERE instead: every point starts a fraction of a unit from the origin along the
           direction of its own final position, so the field is a single bright speck that throws
           itself outward into the space it will occupy. Radial, not unrolled. */
        vec3 dir = normalize(position + vec3(0.0001, 0.0001, 0.0001));
        vec3 seed = dir * (0.18 + aRnd * 0.5);
        vec3 p = mix(seed, position, b);
        // idle drift
        float w = aRnd * 6.28 + uT * 0.22;
        p.x += sin(w) * 0.28 * b;
        p.y += cos(w * 0.77) * 0.22 * b;
        p.z += sin(w * 0.61) * 0.28 * b;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float depth = -mv.z;
        // points near the lens ballooned into soft blobs; clamp the size and fade them out
        vA = (0.45 + 0.55 * sin(aRnd * 20.0 + uT * 1.1)) * (0.25 + 0.75 * b)
             * smoothstep(2.5, 9.0, depth) * (1.0 - smoothstep(46.0, 72.0, depth))
             * (1.0 + uFlash * 0.9);   // the boom: everything overexposes for a beat as it goes
        // 17 -> 9. THE SINGLE BIGGEST COST IN THE SCENE: a quarter of a million additive points
        // at up to 17*dpr pixels across is many screens' worth of overdraw every frame, and the
        // blend means none of it can be depth-rejected. Halving the cap quarters the fill.
        gl_PointSize = min(aSize * uPix * (132.0 / max(depth, 0.001)), 11.0 * uPix);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uTint;
      uniform float uAct3, uIn;
      varying vec3 vC;
      varying float vA;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float len = length(d);
        // a crisp core with a soft halo reads far sharper than one wide gaussian
        float core = smoothstep(0.30, 0.04, len);
        float halo = smoothstep(0.5, 0.0, len);
        float a = core * 0.85 + halo * halo * 0.4;
        /* It used to fall to a quarter in act three, back when a marble bust was the subject
           and this was confetti in front of it. There is no bust any more — the PLANTING is what
           act three is — so it now holds almost all of its strength right to the end. */
        gl_FragColor = vec4(vC * uTint, a * vA * 0.95 * (1.0 - uAct3 * 0.12) * uIn);
      }`,
  }), [])

  useFrame(({ clock }) => {
    material.uniforms.uT.value = clock.elapsedTime
    material.uniforms.uBloom.value = scroll.bloom
    material.uniforms.uAct3.value = scroll.fin
    material.uniforms.uIn.value = THREE.MathUtils.smoothstep(scroll.bloom, 0.0, 0.14)
    // narrower window: at 0.075 the overexposure hung around for a good stretch of scroll, which
    // made it read as a white haze rather than as a hit
    material.uniforms.uFlash.value = Math.exp(-Math.pow((scroll.bloom - 0.09) / 0.042, 2))
    material.uniforms.uTint.value.copy(scroll.tint)
    if (ref.current) {
      ref.current.visible = scroll.bloom > 0.004
      // parallax: garden rises slower than the cards, so it reads as further away
      ref.current.position.y = scroll.gardenY
      // THE GARDEN TURNS AS YOU DESCEND. Scroll-driven, like the column: about two-thirds of a
      // revolution across the journey, so you're always seeing new planting rather than passing
      // the same trees. The clock term underneath keeps it alive when you stop.
      // halved with the column's spin, for the same reason: the planting was wheeling past
      ref.current.rotation.y = scroll.p * Math.PI * 0.7 + clock.elapsedTime * 0.006
    }
  })

  return <points ref={ref} geometry={geo} material={material} frustumCulled={false} userData={{ mat: material }} />
}

export { N as GARDEN_POINTS }
