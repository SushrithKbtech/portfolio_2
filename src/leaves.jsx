import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scroll } from './scrollState'
import { budget } from './device'

/* THE LEAVES — what the column gives off now.
   It used to shed glass beads. Beads are matter; leaves are GROWTH, and this journey ends in a
   garden, so what comes off the spine should already be the thing you are travelling toward.

   TWO LAYERS PER LEAF, and that is the whole reason it reads like the reference:

     THE BLADE   a broad ovate leaf, feathered at the margin rather than outlined, with dozens of
                 fine low-contrast veins fanning off the midrib. Tinted per instance — gold,
                 cream, cyan, violet — so a handful of them covers the reference's colour range.
     THE DUST    the same leaf, drawn as nothing but tiny lights strung along those same veins,
                 blended additively and left COOL WHITE whatever the blade underneath is doing.

   That second layer is what a single tinted texture cannot do: in the reference the warm gold
   leaves are covered in cold blue sparks, and multiplying one tint over one texture can only ever
   give you warm sparks on a warm leaf. Two instanced meshes, two draws, same matrices.

   Nothing is on a life cycle. They hang in the space around the column, breathing on their own
   slow beats and turning with your scroll, because these are not particles being emitted — they
   are what is growing there. */

const W = 320, H = 420
const TIP = 18, BASE = H - 18

// the outline: widest around a third of the way down, drawn to a point at the tip and rounded
// into the stem — an ovate leaf, not the lens shape a pair of symmetric arcs gives you
function leafPath() {
  const p = new Path2D()
  p.moveTo(W / 2, TIP)
  p.bezierCurveTo(W * 0.99, H * 0.24, W * 0.93, H * 0.82, W / 2, BASE)
  p.bezierCurveTo(W * 0.07, H * 0.82, W * 0.01, H * 0.24, W / 2, TIP)
  return p
}

// where the veins run: each is a quadratic from the midrib out toward the margin and up
const VEINS = (() => {
  const out = []
  for (let i = 1; i <= 22; i++) {
    const t = i / 23
    const y = TIP + (BASE - TIP) * t
    const spread = Math.sin(t * Math.PI) * W * 0.47
    const lift = (BASE - TIP) * 0.11 * (1 - t * 0.35)
    for (const s of [1, -1]) {
      out.push({
        x0: W / 2, y0: y,
        cx: W / 2 + spread * s * 0.5, cy: y - lift * 0.3,
        x1: W / 2 + spread * s, y1: y - lift,
      })
    }
  }
  return out
})()

const onVein = (v, t) => {
  const u = 1 - t
  return [
    u * u * v.x0 + 2 * u * t * v.cx + t * t * v.x1,
    u * u * v.y0 + 2 * u * t * v.cy + t * t * v.y1,
  ]
}

function bladeTexture() {
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  g.clearRect(0, 0, W, H)
  const path = leafPath()

  /* FEATHERED, NOT CUT OUT. The margin of a backlit leaf has no edge — it goes to nothing over a
     few millimetres. A blurred fill gives exactly that; a stroked outline gives a sticker. */
  g.save()
  if ('filter' in g) g.filter = 'blur(10px)'
  const body = g.createLinearGradient(0, TIP, 0, BASE)
  body.addColorStop(0.0, 'rgba(255,255,255,0.30)')
  body.addColorStop(0.35, 'rgba(255,255,255,0.46)')
  body.addColorStop(1.0, 'rgba(255,255,255,0.22)')
  g.fillStyle = body
  g.fill(path)
  g.restore()

  // the veins: many, thin, and quiet. Loud veins read as a wireframe rather than as a leaf.
  g.save()
  g.clip(path)
  g.lineCap = 'round'
  g.strokeStyle = 'rgba(255,255,255,0.26)'
  g.lineWidth = 1
  for (const v of VEINS) {
    g.beginPath()
    g.moveTo(v.x0, v.y0)
    g.quadraticCurveTo(v.cx, v.cy, v.x1, v.y1)
    g.stroke()
  }
  g.strokeStyle = 'rgba(255,255,255,0.5)'
  g.lineWidth = 2.6
  g.beginPath(); g.moveTo(W / 2, TIP + 10); g.lineTo(W / 2, BASE - 6); g.stroke()
  g.restore()

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// the same leaf as nothing but light: dots strung along every vein, thickening toward the margin
function dustTexture() {
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  g.clearRect(0, 0, W, H)
  g.save()
  g.clip(leafPath())
  g.shadowColor = 'rgba(190,240,255,0.95)'
  for (const v of VEINS) {
    const n = 7 + ((Math.random() * 6) | 0)
    for (let i = 0; i < n; i++) {
      const t = Math.pow(Math.random(), 0.7)          // biased outward, toward the margin
      const [x, y] = onVein(v, t)
      const r = 0.5 + Math.pow(Math.random(), 2.2) * 2.1
      g.shadowBlur = 3 + r * 2.5
      g.fillStyle = `rgba(255,255,255,${(0.35 + Math.random() * 0.6).toFixed(2)})`
      g.beginPath()
      g.arc(x + (Math.random() - 0.5) * 7, y + (Math.random() - 0.5) * 7, r, 0, Math.PI * 2)
      g.fill()
    }
  }
  g.restore()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export default function Leaves({ height = 20 }) {
  const blade = useRef(), dust = useRef()
  const N = Math.max(18, Math.round(90 * budget))
  const bladeMap = useMemo(() => bladeTexture(), [])
  const dustMap = useMemo(() => dustTexture(), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const items = useMemo(() => {
    // clumped, not sprinkled: leaves come off the column in groups with clear dark between them
    const CLUMPS = 12
    const anchors = Array.from({ length: CLUMPS }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 2.8 + Math.random() * 3.4,
      y: (Math.random() - 0.5) * height * 0.9,
    }))
    // the reference's range: cream and gold through to cyan, with the odd cool violet
    const pal = ['#ffe6b0', '#ffd489', '#fff3d6', '#8fe8ff', '#6ecfff', '#bfe8ff', '#c9a3ff']
    return Array.from({ length: N }, (_, i) => {
      const k = anchors[i % CLUMPS]
      return {
        a: k.a + (Math.random() - 0.5) * 0.9,
        r: k.r + (Math.random() - 0.5) * 2.4,
        y: k.y + (Math.random() - 0.5) * height * 0.24,
        s: 1.1 + Math.pow(Math.random(), 1.7) * 2.5,
        ph: Math.random() * Math.PI * 2,
        bob: 0.16 + Math.random() * 0.26,
        sway: 0.09 + Math.random() * 0.22,
        roll: Math.random() * Math.PI * 2,
        tilt: (Math.random() - 0.5) * 0.9,
        yaw: (Math.random() - 0.5) * 1.2,
        orbit: (Math.random() - 0.5) * 0.05,
        col: pal[(Math.random() * pal.length) | 0],
      }
    })
  }, [N, height])

  useEffect(() => {
    const m = blade.current; if (!m) return
    const c = new THREE.Color()
    items.forEach((L, i) => { c.set(L.col); m.setColorAt(i, c) })
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [items])

  useFrame(({ clock }) => {
    const b = blade.current, d = dust.current
    if (!b) return
    const t = clock.elapsedTime
    // arrives with the column and leaves with it
    const out = THREE.MathUtils.smoothstep(scroll.fin, 0.0, 0.5)
    const on = scroll.spineIn * (1 - out)
    b.visible = on > 0.01
    b.material.opacity = on
    if (d) { d.visible = b.visible; d.material.opacity = on }
    if (!b.visible) return

    for (let i = 0; i < items.length; i++) {
      const L = items[i]
      // turning around the column as you descend, each at its own rate
      const a = L.a + t * L.orbit + scroll.p * 1.1
      const r = L.r + Math.sin(t * L.sway + L.ph) * 0.35
      dummy.position.set(Math.cos(a) * r, L.y + Math.sin(t * L.bob + L.ph) * 0.55, Math.sin(a) * r)
      /* Rolled around the view axis and only tipped a little out of it: a leaf turned edge-on is a
         line, and a field of them flickering in and out of existence is worse than no motion. So
         they stay broadly facing you and do their moving in roll and a shallow tumble. */
      dummy.rotation.set(
        L.tilt + Math.sin(t * 0.3 + L.ph) * 0.16,
        L.yaw + Math.sin(t * 0.21 + L.ph) * 0.28,
        L.roll + Math.sin(t * 0.24 + L.ph) * 0.2)
      dummy.scale.setScalar(L.s)
      dummy.updateMatrix()
      b.setMatrixAt(i, dummy.matrix)
      if (d) d.setMatrixAt(i, dummy.matrix)
    }
    b.instanceMatrix.needsUpdate = true
    if (d) d.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={blade} args={[null, null, N]} frustumCulled={false} renderOrder={1}>
        <planeGeometry args={[1.5, 1.97]} />
        <meshBasicMaterial map={bladeMap} transparent opacity={0} depthWrite={false}
          side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>
      {/* the sparks, additive and cool whatever the leaf under them is */}
      <instancedMesh ref={dust} args={[null, null, N]} frustumCulled={false} renderOrder={2}>
        <planeGeometry args={[1.5, 1.97]} />
        <meshBasicMaterial map={dustMap} transparent opacity={0} depthWrite={false}
          color="#cfefff" blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
