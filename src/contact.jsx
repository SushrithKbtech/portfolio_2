import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, RoundedBox } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { scroll } from './scrollState'
import { fitZ, dpr as DPR } from './device'

/* THE CLOSING ACT — a handset you can turn, with the four ways to reach me on it.
   The flat mock-up this replaces was a picture of a phone; this is an object. It is lit, it has
   thickness, it banks toward your cursor and keeps banking after you stop, and the apps DROP IN
   ONE AT A TIME as you scroll the last stretch — by the time the scroll ends all four are there.
   The callouts stay in the DOM and are re-anchored every frame from the projected position of
   each icon, so they are real links: focusable, copyable, long-pressable on a phone. */

const APPS = [
  { id: 'linkedin', label: 'LinkedIn', info: '/in/sushrith-kandagatla',
    href: 'https://www.linkedin.com/in/sushrith-kandagatla-9751572a6/', bg: '#0A66C2', fg: '#ffffff',
    path: 'M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z' },
  { id: 'whatsapp', label: 'WhatsApp', info: '+91 78927 86525',
    href: 'https://wa.me/917892786525', bg: '#25D366', fg: '#ffffff',
    path: 'M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35zM12.04 21.5h-.01a9.44 9.44 0 0 1-4.8-1.32l-.35-.2-3.57.93.96-3.48-.23-.36a9.4 9.4 0 0 1-1.44-5.03c0-5.2 4.24-9.43 9.45-9.43 2.52 0 4.89.99 6.67 2.77a9.36 9.36 0 0 1 2.76 6.67c0 5.2-4.24 9.44-9.44 9.44zM20.52 3.49A11.8 11.8 0 0 0 12.04 0C5.46 0 .1 5.35.1 11.92c0 2.1.55 4.15 1.6 5.96L0 24l6.27-1.64a11.9 11.9 0 0 0 5.76 1.47h.01c6.58 0 11.94-5.35 11.94-11.92 0-3.19-1.24-6.18-3.46-8.42z' },
  { id: 'email', label: 'Email', info: 'sushrithkandagatla@gmail.com',
    href: 'mailto:sushrithkandagatla@gmail.com', bg: '#EA4335', fg: '#ffffff',
    path: 'M2 5.5A2.5 2.5 0 0 1 4.5 3h15A2.5 2.5 0 0 1 22 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 18.5v-13zm2.2.2 7.8 5.2 7.8-5.2H4.2zM20 7.6l-7.45 4.97a1 1 0 0 1-1.1 0L4 7.6v10.9c0 .28.22.5.5.5h15a.5.5 0 0 0 .5-.5V7.6z' },
  { id: 'github', label: 'GitHub', info: '@SushrithKbtech',
    href: 'https://github.com/SushrithKbtech', bg: '#e9edf6', fg: '#0d1117',
    path: 'M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.7 5.38-5.26 5.67.41.35.77 1.05.77 2.12v3.14c0 .3.21.66.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z' },
]

// icon slots on the screen, in the order they arrive
const SLOTS = [[-0.42, 0.62], [0.42, 0.62], [-0.42, -0.02], [0.42, -0.02]]

const openLink = href => {
  const a = document.createElement('a')
  a.href = href
  if (href.startsWith('http')) { a.target = '_blank'; a.rel = 'noopener noreferrer' }
  document.body.appendChild(a); a.click(); a.remove()
}

/* Brand marks rasterised through Path2D — the same path data an <svg> would use, so the icons are
   the real ones rather than approximations, and they end up as a texture the GPU can just draw. */
function iconTexture({ path, bg, fg }) {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')
  const r = 56
  g.beginPath()
  g.moveTo(r, 0)
  g.arcTo(S, 0, S, S, r); g.arcTo(S, S, 0, S, r); g.arcTo(0, S, 0, 0, r); g.arcTo(0, 0, S, 0, r)
  g.closePath()
  g.fillStyle = bg; g.fill()
  g.save()
  const k = S * 0.56 / 24
  g.translate((S - 24 * k) / 2, (S - 24 * k) / 2); g.scale(k, k)
  g.fillStyle = fg
  g.fill(new Path2D(path))
  g.restore()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function wallpaperTexture() {
  const W = 512, H = 1024
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  const bg = g.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#0b1430'); bg.addColorStop(0.5, '#16244d'); bg.addColorStop(1, '#080f22')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)
  const halo = g.createRadialGradient(W * 0.5, H * 0.3, 10, W * 0.5, H * 0.3, W)
  halo.addColorStop(0, 'rgba(120,180,255,0.25)'); halo.addColorStop(1, 'rgba(120,180,255,0)')
  g.fillStyle = halo; g.fillRect(0, 0, W, H)
  g.fillStyle = 'rgba(255,255,255,0.85)'
  g.font = '600 26px ui-monospace, monospace'
  g.textAlign = 'left'; g.fillText('9:41', 34, 62)
  g.textAlign = 'right'; g.fillText('SK', W - 34, 62)
  g.textAlign = 'center'
  g.font = '500 30px ui-monospace, monospace'
  g.fillStyle = 'rgba(190,214,255,0.92)'
  g.fillText('+91 78927 86525', W / 2, H - 92)
  g.strokeStyle = 'rgba(160,190,255,0.35)'; g.lineWidth = 2
  g.beginPath(); g.moveTo(60, H - 140); g.lineTo(W - 60, H - 140); g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function Phone({ anchors }) {
  const rig = useRef(), body = useRef()
  const icons = useRef([])
  const { camera, size } = useThree()
  const wall = useMemo(() => wallpaperTexture(), [])
  const textures = useMemo(() => APPS.map(iconTexture), [])
  const mouse = useRef({ x: 0, y: 0 })
  const vel = useRef({ x: 0, y: 0 })
  const drag = useRef({ on: false, px: 0, py: 0, sy: 0, sx: 0 })
  const hover = useRef(-1)          // which icon the pointer is over
  const grow = useRef([1, 1, 1, 1]) // and how far each has swollen toward it
  const v = useMemo(() => new THREE.Vector3(), [])

  /* Hover aims it; DRAGGING throws it. The spin keeps going after you let go and unwinds back to
     facing you, so the handset is something you can pick up rather than a hover effect. */
  useEffect(() => {
    const move = e => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2
      if (!drag.current.on) return
      drag.current.sy += (e.clientX - drag.current.px) * 0.006
      drag.current.sx += (e.clientY - drag.current.py) * 0.004
      drag.current.px = e.clientX; drag.current.py = e.clientY
    }
    const down = e => {
      if (scroll.reveal < 0.5) return
      drag.current.on = true
      drag.current.px = e.clientX; drag.current.py = e.clientY
      document.body.style.cursor = 'grabbing'
    }
    const up = () => { drag.current.on = false; document.body.style.cursor = '' }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      document.body.style.cursor = ''
    }
  }, [])

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const step = Math.min(dt, 0.05)

    if (rig.current) {
      // the throw from a drag, bleeding off, and unwinding back toward front-on
      const d = drag.current
      d.sy *= 0.94; d.sx *= 0.94
      if (!d.on) { d.sy *= 0.97; d.sx *= 0.97 }
      // the handset turns toward the cursor and keeps a little momentum of its own
      const wantY = mouse.current.x * 0.55 + Math.sin(t * 0.35) * 0.06 + d.sy * 6
      const wantX = mouse.current.y * 0.34 + Math.sin(t * 0.27) * 0.04 + d.sx * 6
      vel.current.y += (wantY - rig.current.rotation.y - vel.current.y * 2.2) * step * 9
      vel.current.x += (wantX - rig.current.rotation.x - vel.current.x * 2.2) * step * 9
      rig.current.rotation.y += vel.current.y
      rig.current.rotation.x += vel.current.x
      rig.current.rotation.z = Math.sin(t * 0.2) * 0.02
      /* THE TRICK. The handset does not fade in — fading in is how a picture arrives, not how a
         thing appears. It opens: a seam of light stretches to full height first, then swings out
         to full width, and the flash behind it peaks at the moment it takes shape. Nothing of it
         exists before `reveal`, and `reveal` does not start until the frame has finished turning
         to black. */
      const r = scroll.reveal
      const sy = THREE.MathUtils.smoothstep(r, 0.0, 0.44)
      const sx = THREE.MathUtils.smoothstep(r, 0.28, 0.86)
      rig.current.position.y = -0.5 + r * 0.5 + Math.sin(t * 0.5) * 0.03
      // on a narrow frame the handset is shrunk rather than the camera pulled back — pulling back
      // would shrink the dust and the room with it and the scene would read as a doll's house
      const base = (0.86 + r * 0.14) / fitZ(size.width / size.height)
      rig.current.scale.set(base * (0.015 + 0.985 * sx), base * (0.05 + 0.95 * sy), base)
      rig.current.visible = r > 0.002
    }

    // ONE APP PER BEAT. Each icon gets its own slice of the closing scroll, so they land in
    // sequence and the fourth is still arriving as the scroll runs out.
    icons.current.forEach((m, i) => {
      if (!m) return
      const a = THREE.MathUtils.clamp((scroll.contactApps - i * 0.24) / 0.26, 0, 1)
      const e = 1 - Math.pow(1 - a, 3)
      // hover swells the icon the way a home screen does — eased, not switched, so it settles
      // back down when the pointer moves on
      const want = hover.current === i ? 1.24 : 1
      grow.current[i] = THREE.MathUtils.lerp(grow.current[i] ?? 1, want, Math.min(1, step * 12))
      m.scale.setScalar(e * grow.current[i])
      // 0.092 clears the screen plane at 0.0865 — anything lower and the icons sit INSIDE the
      // phone, hidden behind the wallpaper. A hovered icon also lifts off the glass a little.
      m.position.z = 0.092 + (1 - e) * 0.5 + (grow.current[i] - 1) * 0.28
      m.material.opacity = e
      m.visible = a > 0.01
      // and hand the DOM its anchor: where this icon actually is on screen, this frame
      if (anchors.current[i] && a > 0.01) {
        m.getWorldPosition(v)
        v.project(camera)
        anchors.current[i]({
          x: (v.x * 0.5 + 0.5) * size.width,
          y: (-v.y * 0.5 + 0.5) * size.height,
          on: a > 0.6,
        })
      } else if (anchors.current[i]) {
        anchors.current[i]({ on: false })
      }
    })
  })

  return (
    <group ref={rig} position={[0, 0, 0]}>
      {/* chassis — white ceramic, softly rounded.
          Metalness stays LOW: a white metal reads as grey the moment it reflects a dark room,
          which is all this room is. A dielectric with a wet clearcoat over it keeps the case
          bright and still catches a highlight along the rounded edge as the handset turns. */}
      <RoundedBox ref={body} args={[1.62, 3.3, 0.17]} radius={0.23} smoothness={8}>
        {/* a whisper of emissive on top: in a room this dark even a white dielectric settles to
            grey, and this holds the case at white without blowing out under the bloom pass */}
        <meshPhysicalMaterial color="#ffffff" metalness={0.12} roughness={0.32}
          clearcoat={1} clearcoatRoughness={0.12} envMapIntensity={1.35}
          emissive="#e8eef8" emissiveIntensity={0.34}
          sheen={0.5} sheenColor="#cfe0ff" />
      </RoundedBox>
      {/* screen */}
      <mesh position={[0, 0, 0.0865]}>
        <planeGeometry args={[1.46, 3.12]} />
        <meshBasicMaterial map={wall} toneMapped={false} />
      </mesh>
      {/* notch */}
      <mesh position={[0, 1.44, 0.088]}>
        <planeGeometry args={[0.42, 0.11]} />
        <meshBasicMaterial color="#04060c" />
      </mesh>

      {APPS.map((a, i) => (
        <mesh key={a.id} ref={el => (icons.current[i] = el)}
          position={[SLOTS[i][0], SLOTS[i][1], 0.09]}
          onClick={e => { e.stopPropagation(); openLink(a.href) }}
          onPointerOver={e => { e.stopPropagation(); hover.current = i; document.body.style.cursor = 'pointer' }}
          onPointerOut={() => { if (hover.current === i) hover.current = -1; document.body.style.cursor = '' }}>
          <planeGeometry args={[0.44, 0.44]} />
          <meshBasicMaterial map={textures[i]} transparent toneMapped={false} />
        </mesh>
      ))}

      {/* the light the screen throws back onto the chassis */}
      <pointLight position={[0, 0.4, 1.1]} intensity={7} distance={6} color="#8fc2ff" />
    </group>
  )
}

/* Dust in the room. Six hundred points drifting around the handset, brighter near it — it gives
   the black something to be, and it catches the bloom without costing a pass. */
function Dust() {
  const ref = useRef()
  const geo = useMemo(() => {
    const N = 600
    const pos = new Float32Array(N * 3)
    const rnd = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const r = 1.6 + Math.pow(Math.random(), 0.6) * 6
      const a = Math.random() * Math.PI * 2
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = (Math.random() - 0.5) * 8
      pos[i * 3 + 2] = Math.sin(a) * r * 0.6 - 1
      rnd[i] = Math.random()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1))
    return g
  }, [])

  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uIn: { value: 0 }, uPix: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: `
      attribute float aRnd;
      uniform float uT, uPix;
      varying float vA;
      void main(){
        vec3 p = position;
        p.y += sin(uT * 0.25 + aRnd * 12.0) * 0.4;
        p.x += cos(uT * 0.19 + aRnd * 9.0) * 0.3;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = (0.35 + 0.65 * sin(aRnd * 20.0 + uT)) * smoothstep(11.0, 3.0, length(p.xz));
        gl_PointSize = (1.0 + aRnd * 2.2) * uPix * (16.0 / max(-mv.z, 0.001));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uIn;
      varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(0.62, 0.78, 1.0), a * a * vA * 0.5 * uIn);
      }`,
  }), [])

  useFrame(({ clock }) => {
    mat.uniforms.uT.value = clock.elapsedTime
    // a little of it is already drifting in the black before anything appears, which is what
    // makes the empty screen read as a place rather than as a gap
    mat.uniforms.uIn.value = Math.max(scroll.reveal, scroll.contact * 0.22)
    if (ref.current) ref.current.visible = mat.uniforms.uIn.value > 0.01
  })

  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />
}

/* THE SEAM AND THE FLASH — the two lights the handset comes out of.
   One soft disc, stretched tall and thin, is the seam: it opens with the phone and dies as the
   phone takes over. The same disc, round and short-lived, is the flash at the moment of the
   reveal. Both additive, both behind the handset, both fed by the same progress value, so the
   light and the object are one event rather than two things that happen near each other. */
function Reveal() {
  const seam = useRef(), flash = useRef()
  const map = useMemo(() => {
    const S = 128
    const c = document.createElement('canvas')
    c.width = c.height = S
    const g = c.getContext('2d')
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    grd.addColorStop(0.0, 'rgba(255,255,255,1)')
    grd.addColorStop(0.25, 'rgba(226,240,255,0.75)')
    grd.addColorStop(1.0, 'rgba(140,190,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, S, S)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])

  useFrame(() => {
    const r = scroll.reveal
    const open = THREE.MathUtils.smoothstep(r, 0.0, 0.44)
    const s = seam.current, f = flash.current
    if (s) {
      s.visible = r > 0.002 && r < 0.98
      if (s.visible) {
        s.scale.set(0.35 + open * 0.9, 0.5 + open * 4.6, 1)
        s.material.opacity = Math.min(1, open * 1.7) * (1 - THREE.MathUtils.smoothstep(r, 0.5, 0.95))
      }
    }
    if (f) {
      // a single beat, centred on the moment the shape finishes opening
      const v = Math.exp(-Math.pow((r - 0.46) / 0.15, 2))
      f.visible = v > 0.01
      if (f.visible) {
        f.scale.setScalar(1.6 + v * 6.0)
        f.material.opacity = v * 0.8
      }
    }
  })

  return (
    <group position={[0, 0, -0.9]}>
      <mesh ref={flash} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={map} transparent opacity={0} depthWrite={false} depthTest={false}
          blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh ref={seam} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={map} transparent opacity={0} depthWrite={false} depthTest={false}
          blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  )
}

export default function ContactStage() {
  const stage = useRef()
  /* THE SECOND RENDERER WAS ALWAYS RUNNING. This canvas — its own scene, its own bloom pass, its
     own dust — was drawing every frame for the entire scroll, including the ~76% of it where the
     stage is fully transparent and nothing it draws can be seen. It now renders only once the
     close has begun. */
  const [live, setLive] = useState(false)
  const labels = useRef([])
  const lines = useRef([])
  const numRef = useRef()

  /* Tap the number to take it with you. Clipboard first, and a selection fallback for browsers
     that refuse the API on an insecure origin — which localhost isn't, but a LAN preview is. */
  const copyNumber = async () => {
    const el = numRef.current
    const text = '+917892786525'
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch { /* nothing else to try */ }
      ta.remove()
    }
    if (!el) return
    const original = el.textContent
    el.dataset.copied = '1'
    el.textContent = 'Copied to clipboard'
    setTimeout(() => { el.textContent = original; el.dataset.copied = '0' }, 1600)
  }
  /* Each icon publishes its screen position every frame and the DOM redraws its wire: a dot on the
     icon, a short diagonal away from the handset, then a long horizontal run out to the label —
     the elbow shape from the sketch, in gold. Drawn as one SVG over the canvas so the geometry is
     real lines rather than rotated divs. */
  const anchors = useRef(APPS.map((_, i) => pos => {
    const el = labels.current[i], wire = lines.current[i]
    if (!el || !wire) return
    if (!pos.on) { el.style.opacity = '0'; wire.style.opacity = '0'; return }
    const left = i % 2 === 0
    const dir = left ? -1 : 1
    const elbow = pos.x + dir * 74      // where the diagonal turns into the horizontal
    const endX = pos.x + dir * 210      // where the wire stops and the label starts
    const elbowY = pos.y - 30

    wire.style.opacity = '1'
    wire.querySelector('polyline').setAttribute('points',
      `${pos.x},${pos.y} ${elbow},${elbowY} ${endX},${elbowY}`)
    const dot = wire.querySelector('circle')
    dot.setAttribute('cx', pos.x); dot.setAttribute('cy', pos.y)

    el.style.opacity = '1'
    el.style.transform =
      `translate(${left ? -100 : 0}%, -100%) translate(${endX + dir * 12}px, ${elbowY - 6}px)`
  }))

  useEffect(() => {
    let raf
    const tick = () => {
      const el = stage.current
      if (el) {
        const v = scroll.contact
        el.style.opacity = v.toFixed(3)
        el.style.visibility = v > 0.004 ? 'visible' : 'hidden'
        el.style.pointerEvents = scroll.reveal > 0.6 ? 'auto' : 'none'
        // the copy — kicker, number, phone-only list — belongs to the reveal, not to the black
        // screen that precedes it. CSS does the fading; this only says which beat we are in.
        el.dataset.reveal = scroll.reveal > 0.32 ? '1' : '0'
        // flips at the threshold only, so this isn't a setState every frame
        setLive(prev => (prev === v > 0.004 ? prev : v > 0.004))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="contactstage" ref={stage}>
      <p className="cs-kicker">Get in touch</p>

      <Canvas className="cs-canvas" dpr={DPR} gl={{ antialias: true, alpha: true }}
        frameloop={live ? 'always' : 'never'}
        camera={{ position: [0, 0, 6.2], fov: 38 }}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 5, 6]} intensity={2.8} color="#eef4ff" />
        {/* a fill from below-left so the far edge of the case never falls into the background */}
        <directionalLight position={[-4, -2, 4]} intensity={0.9} color="#9fc0ff" />
        <Environment resolution={128}>
          <Lightformer form="rect" intensity={2.6} position={[0, 4, 5]} scale={[7, 3, 1]} color="#ffffff" />
          <Lightformer form="rect" intensity={2.0} position={[-5, 0, 3]} scale={[2, 7, 1]} color="#6f8bff" />
          <Lightformer form="rect" intensity={1.6} position={[5, 0, 3]} scale={[2, 7, 1]} color="#9ec2ff" />
        </Environment>
        <Dust />
        <Reveal />
        <Phone anchors={anchors} />
        {/* the handset earns a highlight pass: its edge, the app icons and the dust are all
            small bright things on black, which is exactly what bloom is for */}
        <EffectComposer disableNormalPass multisampling={0}>
          <Bloom intensity={0.5} luminanceThreshold={0.8} luminanceSmoothing={0.3}
            mipmapBlur radius={0.35} />
        </EffectComposer>
      </Canvas>

      {/* On a phone there is no room either side of the handset for callouts, so the same four
          links are listed under it instead — same hrefs, no projection maths. */}
      <ul className="cs-list">
        {APPS.map(a => (
          <li key={a.id}>
            <a href={a.href}
               target={a.href.startsWith('http') ? '_blank' : undefined}
               rel={a.href.startsWith('http') ? 'noopener noreferrer' : undefined}>
              <b>{a.label}</b><i>{a.info}</i>
            </a>
          </li>
        ))}
      </ul>

      {/* the wires, re-anchored each frame to wherever their icon has turned to */}
      {APPS.map((a, i) => (
        <svg key={a.id} className="cs-wire" ref={el => (lines.current[i] = el)} aria-hidden="true">
          <polyline points="0,0 0,0 0,0" />
          <circle r="4.5" cx="0" cy="0" />
        </svg>
      ))}
      {APPS.map((a, i) => (
        <a key={a.id} className={`cs-call ${i % 2 === 0 ? 'left' : 'right'}`}
          ref={el => (labels.current[i] = el)}
          href={a.href}
          target={a.href.startsWith('http') ? '_blank' : undefined}
          rel={a.href.startsWith('http') ? 'noopener noreferrer' : undefined}>
          <b>{a.label}</b><i>{a.info}</i>
        </a>
      ))}

      <p className="cs-phone" ref={numRef} onClick={copyNumber} role="button" tabIndex={0}
         onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') copyNumber() }}>
        +91 78927 86525
      </p>
    </div>
  )
}
