import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/* PROCEDURAL STAND-INS for the binaries this repo doesn't ship (see ASSETS.md).
   Nothing here is trying to be the real artwork — it exists so the scene reads as a scene while
   the assets are missing, and so nothing 404s its way into a black page. */

/* ---------- textures ----------
   Deliberately NOT drei's useTexture: that one suspends and then throws on a 404, which is the
   whole failure this file exists to avoid. Plain loader, stand-in until (and unless) the real
   file arrives. */
export function useSafeTexture(url, make) {
  const [tex, setTex] = useState(() => make(url))
  useEffect(() => {
    let alive = true
    new THREE.TextureLoader().load(
      url,
      t => { if (!alive) return; t.colorSpace = THREE.SRGBColorSpace; setTex(t) },
      undefined,
      () => {},        // missing: keep the stand-in, say nothing further
    )
    return () => { alive = false }
  }, [url])
  return tex
}

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return [c, c.getContext('2d')]
}

function finish(c, { srgb = true, wrap = false } = {}) {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  if (wrap) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping }
  return t
}

/* Card poster: the panel is meshBasicMaterial with depthWrite off, so a black map over a black
   scene is an invisible card. Give every card something to be. */
export function posterTexture(sys) {
  const [c, g] = canvas(1024, 652)
  const [a, b] = sys.hue
  const bg = g.createLinearGradient(0, 0, 1024, 652)
  bg.addColorStop(0, '#080b14'); bg.addColorStop(1, '#0d1220')
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 652)

  // a wash of the system's own hue, so the six cards don't read as one repeated slate
  const wash = g.createRadialGradient(300, 180, 20, 300, 180, 760)
  wash.addColorStop(0, a + '44'); wash.addColorStop(0.55, b + '22'); wash.addColorStop(1, '#00000000')
  g.fillStyle = wash; g.fillRect(0, 0, 1024, 652)

  g.strokeStyle = '#ffffff10'; g.lineWidth = 1
  for (let x = 64; x < 1024; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 652); g.stroke() }
  for (let y = 64; y < 652; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke() }

  g.fillStyle = a
  g.font = '600 26px ui-monospace, Menlo, monospace'
  g.fillText(sys.k.toUpperCase(), 64, 96)
  g.fillStyle = '#f2f5ff'
  g.font = '800 74px Inter, Helvetica, Arial, sans-serif'
  g.fillText(sys.n, 64, 200)

  g.fillStyle = '#8d9bb8'
  g.font = '400 27px Inter, Helvetica, Arial, sans-serif'
  wrapText(g, sys.d, 64, 268, 896, 40)

  g.fillStyle = '#5a6580'
  g.font = '500 22px ui-monospace, Menlo, monospace'
  g.fillText('poster stand-in · public/cards/ not present', 64, 588)
  return finish(c)
}

function wrapText(g, text, x, y, max, lh) {
  let line = ''
  for (const word of text.split(' ')) {
    const test = line ? line + ' ' + word : word
    if (g.measureText(test).width > max && line) { g.fillText(line, x, y); y += lh; line = word }
    else line = test
  }
  if (line) g.fillText(line, x, y)
}

/* The act-three backdrop plate. Its shaders read luminance at the left/right edges to mask out
   "ivy", so the stand-in paints exactly that: a night lawn, mist, and two brighter edge curtains. */
export function plateTexture() {
  const [c, g] = canvas(1024, 576)
  const sky = g.createLinearGradient(0, 0, 0, 576)
  sky.addColorStop(0.00, '#0a1a18')
  sky.addColorStop(0.42, '#123028')
  sky.addColorStop(0.68, '#1b4433')
  sky.addColorStop(1.00, '#0c1f1a')
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 576)

  // a low band of mist where the lawn meets the hedge
  const mist = g.createLinearGradient(0, 300, 0, 430)
  mist.addColorStop(0, '#9fe8d000'); mist.addColorStop(0.5, '#9fe8d033'); mist.addColorStop(1, '#9fe8d000')
  g.fillStyle = mist; g.fillRect(0, 300, 1024, 130)

  // the ivy curtains the foreground pass is looking for
  for (const side of [0, 1]) {
    for (let i = 0; i < 220; i++) {
      const t = Math.random()
      const x = side ? 1024 - t * 150 : t * 150
      const y = Math.random() * 470
      const r = 5 + Math.random() * 16
      g.fillStyle = `rgba(${90 + Math.random() * 70 | 0},${170 + Math.random() * 60 | 0},${110 + Math.random() * 50 | 0},${0.16 + Math.random() * 0.4})`
      g.beginPath(); g.ellipse(x, y, r, r * 0.55, Math.random() * Math.PI, 0, Math.PI * 2); g.fill()
    }
  }
  return finish(c)
}

/* Equirect environment for the marble. A sky gradient with one soft moon is enough to stop the
   statuary reflecting pure black. */
export function envTexture() {
  const [c, g] = canvas(1024, 512)
  const sky = g.createLinearGradient(0, 0, 0, 512)
  sky.addColorStop(0.0, '#132a3d'); sky.addColorStop(0.5, '#2a4a52'); sky.addColorStop(1.0, '#0a1512')
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 512)
  const moon = g.createRadialGradient(300, 150, 8, 300, 150, 210)
  moon.addColorStop(0, '#eaf6ffcc'); moon.addColorStop(1, '#eaf6ff00')
  g.fillStyle = moon; g.fillRect(0, 0, 1024, 512)
  const t = finish(c, { wrap: true })
  t.mapping = THREE.EquirectangularReflectionMapping
  return t
}

/* ---------- geometry ---------- */

/* A vertebral column built the way helix.jsx's particle spine describes one: a flared centrum,
   a narrow disc between bones, and two lateral processes rotated a touch per vertebra. */
export function proceduralSpine(width = 5.4, count = 26) {
  const parts = []
  const step = 1.5
  const r = width * 0.29
  for (let i = 0; i < count; i++) {
    const y = i * step
    const body = new THREE.CylinderGeometry(r, r, step * 0.6, 20, 1)
    body.translate(0, y, 0); parts.push(body)

    const disc = new THREE.CylinderGeometry(r * 0.44, r * 0.44, step * 0.42, 12, 1)
    disc.translate(0, y + step * 0.5, 0); parts.push(disc)

    for (const s of [-1, 1]) {
      const wing = new THREE.BoxGeometry(width * 0.46, r * 0.32, r * 0.5)
      wing.translate(s * width * 0.3, 0, 0)
      wing.rotateY(i * 0.19)                  // each bone turned slightly off the one below
      wing.translate(0, y, 0)
      parts.push(wing)
    }
  }
  const g = mergeGeometries(parts, false)
  g.center()
  g.computeVertexNormals()
  return { geometry: g, height: count * step }
}

/* Five petals and a centre, normalised to unit size — blossoms.jsx scales per instance. */
export function proceduralBlossom() {
  const parts = []
  for (let k = 0; k < 5; k++) {
    const petal = new THREE.SphereGeometry(0.5, 12, 8)
    petal.scale(1, 0.16, 0.62)
    petal.translate(0.52, 0, 0)
    petal.rotateY((k / 5) * Math.PI * 2)
    parts.push(petal)
  }
  const core = new THREE.SphereGeometry(0.19, 10, 8)
  parts.push(core)
  const g = mergeGeometries(parts, false)
  g.computeBoundingBox()
  const size = new THREE.Vector3()
  g.boundingBox.getSize(size)
  const k = 1 / Math.max(size.x, size.y, size.z)
  g.scale(k, k, k)
  g.computeVertexNormals()
  return g
}

/* A bust-shaped solid: head, neck, shoulders, plinth. It goes through finale.jsx's own
   normalise() like a real GLB would, so the crystallise and head-tracking still read. */
export function proceduralBustScene(seed = 0) {
  const rnd = (n => () => (n = (n * 9301 + 49297) % 233280) / 233280)(seed * 7 + 13)
  const group = new THREE.Group()
  // NON-INDEXED on purpose: finale.jsx's mergeSimple() allocates by vertex count but writes one
  // entry per INDEX, so an indexed geometry gets silently truncated — which showed up as a bust
  // with nothing below the cranium.
  const add = (geo, y, rot) => {
    const m = new THREE.Mesh(geo.toNonIndexed())
    m.position.y = y
    if (rot) m.rotation.z = rot
    group.add(m)
  }
  add(new THREE.SphereGeometry(0.5, 26, 20).scale(0.86, 1, 0.9), 2.42)          // cranium
  add(new THREE.SphereGeometry(0.26, 18, 14).scale(0.7, 0.9, 1.0), 2.3)         // face mass, pushed forward
  group.children[1].position.z = 0.3
  add(new THREE.CylinderGeometry(0.19, 0.24, 0.42, 16), 1.94)                   // neck
  add(new THREE.SphereGeometry(0.78, 26, 18).scale(1.15, 0.72, 0.72), 1.36)     // shoulders
  add(new THREE.CylinderGeometry(0.52, 0.66, 1.0, 22), 0.72, (rnd() - 0.5) * 0.05)  // chest
  add(new THREE.CylinderGeometry(0.72, 0.82, 0.4, 24), 0.06)                    // plinth
  group.updateMatrixWorld(true)   // normalise() reads matrixWorld
  return group
}
