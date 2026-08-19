import { useRef, useMemo, useEffect, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { EffectComposer, Bloom, Noise } from '@react-three/postprocessing'
import * as THREE from 'three'
import Lenis from 'lenis'
import { SYSTEMS } from './systems'
import { scroll } from './scrollState'
import Garden from './garden.jsx'
import BoneSpine from './boneSpine.jsx'
import Blossoms from './blossoms.jsx'
import Finale from './finale.jsx'
import Backdrop from './backdrop.jsx'
import { HeroRoom, SKObject } from './hero.jsx'
import { useSafeTexture, posterTexture } from './procAssets'
import ContactStage from './contact.jsx'
import { fitZ, dpr as DPR } from './device'
import Intro from './intro.jsx'
import Hyperspace from './hyperspace.jsx'
import PixelFlip from './pixelFlip.jsx'

/* THE JOURNEY, in four beats down one scroll:
     0.00 → 0.12   act zero  · the glass SK in the LED room, the name behind it
     0.12 → 0.24   handover  · the room dims, particles detonate out of the object, the skeleton
                               drops in and the camera pushes into it
     0.24 → 0.74   the work  · projects spiral around the column as rectangular panels
     0.74 → 1.00   the garden· everything dissolves into the planting
   Every module reads `scroll`, which Rig writes once a frame. Nothing else talks to anything. */

const R = 7.7, PITCH = 3.15, ANGLE_SPAN = 1.42, FOCUS = 0.85, TILT = 0.19
// START pushed out by a hero's worth of runway, so card 01 arrives after act zero has handed over
// rather than during it. The card CADENCE is untouched: same slots, same rate per pixel.
/* 0.95 -> 1.75 -> 2.90. The jump is a JOURNEY now, not a cut — it runs for two to three seconds of
   real scrolling — so the burst, the column assembling and the title all have to start after it
   rather than during it. The runway in index.css grows by the same ratio, which is what keeps the
   cards moving at exactly the same rate per pixel scrolled. */
const HERO_SLOTS = 2.90
const START = 1.25 + HERO_SLOTS
const CARD_SLOTS = SYSTEMS.length + START - 0.4
/* 3.05 -> 5.2. The close is a SEQUENCE — the picture quantising, then tearing, then turning to
   black block by block, then a seam of light, then the handset opening out of it, then four apps
   landing one at a time — and a sequence needs room to be read as one thing after another rather
   than as everything at once. This nearly doubles the scroll the ending gets. The gallery is
   unaffected: every card position is in slots, and the runway grows by the same ratio. */
const FINALE_SLOTS = 5.2
const TOTAL_SLOTS = CARD_SLOTS + FINALE_SLOTS
const FIN_FROM = CARD_SLOTS / TOTAL_SLOTS + 0.012
const HUE = new THREE.Color(), WHITE = new THREE.Color('#ffffff')

/* THE PANELS ARE CURVED, not flat cards.
   A screen bent away from you at both edges has depth on its own — it catches the light along the
   bend and its silhouette changes as it turns — which is the whole difference between a picture
   stuck on a rectangle and a display standing in the room.

   BEND is a coefficient, not an angle, and every layer of the card uses the SAME z(x) so the
   frame, the backing and the artwork stay exactly parallel however wide each one is: a flat z
   offset then separates them correctly all the way to the corners.

   Rounded corners are NOT in this geometry any more. A bent surface needs interior vertices to
   bend smoothly, and ShapeGeometry only puts them on the outline — so the corners are cut by an
   alpha mask instead, which is free and antialiases better than a polygon edge ever did. */
const BEND = 0.052

function curvedPanel(w, h) {
  const g = new THREE.PlaneGeometry(w, h, 30, 8)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setZ(i, -pos.getX(i) * pos.getX(i) * BEND)
  pos.needsUpdate = true
  g.computeVertexNormals()
  return g
}

// White rounded rectangle on black, used as an alphaMap: three multiplies the fragment's alpha by
// it, so the corners come off every layer of the card at once with a soft edge.
function cornerMask(w, h, r) {
  const S = 512, H = Math.round(S * h / w), rr = r / w * S
  const c = document.createElement('canvas')
  c.width = S; c.height = H
  const g = c.getContext('2d')
  g.fillStyle = '#000'; g.fillRect(0, 0, S, H)
  g.fillStyle = '#fff'
  g.beginPath()
  if (g.roundRect) g.roundRect(0, 0, S, H, rr)
  else {
    g.moveTo(rr, 0); g.lineTo(S - rr, 0); g.quadraticCurveTo(S, 0, S, rr)
    g.lineTo(S, H - rr); g.quadraticCurveTo(S, H, S - rr, H)
    g.lineTo(rr, H); g.quadraticCurveTo(0, H, 0, H - rr)
    g.lineTo(0, rr); g.quadraticCurveTo(0, 0, rr, 0)
  }
  g.fill()
  return new THREE.CanvasTexture(c)
}

/* Seven cards, one geometry and one mask each for the artwork and the frame. Built on first use
   and shared: identical panels have no business owning identical buffers. */
const CARD_W = 6.7, CARD_H = 4.26, FRAME_W = 6.86, FRAME_H = 4.42
const once = fn => { let v; return () => (v ??= fn()) }
const cardGeo  = once(() => curvedPanel(CARD_W, CARD_H))
const frameGeo = once(() => curvedPanel(FRAME_W, FRAME_H))
const cardMask  = once(() => cornerMask(CARD_W, CARD_H, 0.19))
const frameMask = once(() => cornerMask(FRAME_W, FRAME_H, 0.22))

/* Browsers refuse autoplay until the page has been interacted with. */
const PENDING = new Set()
if (typeof window !== 'undefined') {
  const kick = () => PENDING.forEach(v => v.play().then(() => v.pause()).catch(() => {}))
  window.addEventListener('pointerdown', kick, { once: true })
  window.addEventListener('wheel', kick, { once: true, passive: true })
}

/* THE TITLE, ON THE SAME TRACK AS THE WORK — AND ALIVE ON IT.
   It used to be a DOM card pinned to the middle of the screen, which meant the one element
   announcing the gallery was the one element not in the gallery's space. Then it was a single flat
   plane riding the helix, which put it in the right place but made it a decal: eight letters
   welded into one rectangle that arrived all at once.

   Now every letter is its own plane. They are laid around the SAME cylinder the cards ride, so the
   word bends away from you at both ends, and each one drops into place a beat after the one before
   as the word swings toward the front — then falls away in reverse as it leaves. The word assembles
   itself in front of you rather than being carried past. */
const WORD = 'PROJECTS'
const TITLE_H = 1.5       // cap height in world units; every glyph plane is scaled from it
const CURVE_R = 8.2       // the cylinder the word wraps around, close to the card helix's own R

/* One canvas per glyph. Each carries its own halo, drawn with the 2D context's shadow before the
   solid pass, so the letters read as lit rather than as white shapes cut out of the dark. */
function glyphSet() {
  const font = '900 210px "Montserrat", system-ui, sans-serif'
  const m = document.createElement('canvas').getContext('2d')
  m.font = font
  return WORD.split('').map(ch => {
    const adv = m.measureText(ch).width
    const CW = Math.ceil(adv) + 150, CH = 340
    const c = document.createElement('canvas')
    c.width = CW; c.height = CH
    const g = c.getContext('2d')
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff'
    g.shadowColor = 'rgba(150,205,255,0.9)'; g.shadowBlur = 40
    g.fillText(ch, CW / 2, CH / 2)
    g.shadowBlur = 18
    g.fillText(ch, CW / 2, CH / 2)
    g.shadowBlur = 0
    g.fillText(ch, CW / 2, CH / 2)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return { tex: t, w: (CW / CH) * TITLE_H, adv: (adv / CH) * TITLE_H }
  })
}

function TitlePanel() {
  const grp = useRef()
  const kids = useRef([])
  const SLOT = START - 0.8   // one beat ahead of card 01, once the column has finished assembling
  // Montserrat is self-hosted with font-display:block, so the first draw can land on the fallback.
  // Redrawing once the face has actually loaded costs eight small canvases, one time.
  const [ver, setVer] = useState(0)
  useEffect(() => { document.fonts?.ready.then(() => setVer(v => v + 1)) }, [])
  const letters = useMemo(() => glyphSet(), [ver])

  // lay the glyphs out along the arc, centred on the middle of the word
  const laid = useMemo(() => {
    const track = 1.16                                   // letter-spacing
    const total = letters.reduce((a, l) => a + l.adv * track, 0)
    let x = -total / 2
    return letters.map(l => {
      const cx = x + l.adv * track / 2
      x += l.adv * track
      return { ...l, a: cx / CURVE_R }                   // arc angle for this glyph
    })
  }, [letters])

  useFrame(({ clock }) => {
    const g = grp.current; if (!g) return
    const time = clock.elapsedTime
    const t = scroll.p * TOTAL_SLOTS - SLOT
    const angle = t * ANGLE_SPAN
    g.position.set(Math.sin(angle) * R, t * PITCH, Math.cos(angle) * R)
    const w = 1 - THREE.MathUtils.clamp(Math.abs(t) / FOCUS, 0, 1)
    const ease = w * w * (3 - 2 * w)
    g.rotation.y = angle * (1 - ease)
    g.rotation.z = -t * TILT * (1 - ease * 0.55) + Math.sin(time * 0.5) * 0.012
    g.rotation.x = t * 0.055 * (1 - ease)
    const near = Math.max(0, 1 - Math.abs(t) / 2.4)
    g.scale.setScalar((0.78 + near * near * 0.3) * 0.72 * scroll.bloom)
    g.visible = Math.abs(t) < 3.1 && scroll.bloom > 0.05 && scroll.fin < 0.5
    if (!g.visible) return

    // the approach, 0 a slot and a half out, 1 square-on — and the departure, which runs the
    // same collapse backwards so the last letter in is the first letter out
    const inN  = THREE.MathUtils.clamp((t + 1.5) / 1.5, 0, 1)
    const outN = THREE.MathUtils.clamp((t - 0.55) / 1.1, 0, 1)
    const n = laid.length
    for (let i = 0; i < n; i++) {
      const o = kids.current[i]; if (!o) return
      const kIn  = THREE.MathUtils.clamp((inN - i * 0.052) / 0.5, 0, 1)
      const kOut = THREE.MathUtils.clamp((outN - (n - 1 - i) * 0.052) / 0.5, 0, 1)
      const e = (1 - Math.pow(1 - kIn, 3)) * (1 - kOut * kOut)
      const s = 1 - e
      o.position.y = -s * 1.1 + Math.sin(time * 1.5 + i * 0.7) * 0.03
      o.rotation.x = s * 1.5
      o.rotation.z = s * 0.3 * (i % 2 ? 1 : -1) + Math.sin(time * 1.1 + i) * 0.013
      o.scale.setScalar(0.7 + e * 0.3)
      o.material.opacity = e
    }
  })

  return (
    <group ref={grp}>
      {laid.map((l, i) => (
        /* each glyph stands on the cylinder and turns with it — that is the curve */
        <group key={i} position={[Math.sin(l.a) * CURVE_R, 0, Math.cos(l.a) * CURVE_R - CURVE_R]}
          rotation={[0, l.a, 0]}>
          <mesh ref={el => { kids.current[i] = el }} renderOrder={2}>
            <planeGeometry args={[l.w, TITLE_H]} />
            <meshBasicMaterial map={l.tex} transparent toneMapped={false} opacity={0}
              side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ---------- ONE PROJECT PANEL ---------- */
function Card({ sys, i, onFocus }) {
  const grp = useRef()
  const vid = useMemo(() => {
    const v = document.createElement('video')
    v.src = `/video/card${i}.mp4`
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.loop = false
    v.crossOrigin = 'anonymous'
    v.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;top:-10px'
    return v
  }, [i])
  // The panel always has something on it: the generated poster until the film has a frame.
  const poster = useSafeTexture(`/cards/${i}.png`, () => posterTexture(sys))
  const matRef = useRef()
  const usingVideo = useRef(false)
  const tex = useMemo(() => {
    const t = new THREE.VideoTexture(vid)
    t.colorSpace = THREE.SRGBColorSpace
    t.minFilter = THREE.LinearFilter
    return t
  }, [vid])
  useEffect(() => {
    vid.src = `/video/card${i}.mp4`
    document.body.appendChild(vid)
    PENDING.add(vid)
    vid.load()
    return () => { vid.pause(); PENDING.delete(vid); vid.remove(); vid.removeAttribute('src'); vid.load() }
  }, [vid, i])

  const panel = cardGeo()
  // a hair larger, sitting just behind: the sliver that shows past the poster is the frame
  const frame = frameGeo()
  const was = useRef(false)
  const playing = useRef(false)
  const focused = useRef(0)   // how square-on this panel is, read by the click handler
  useFrame(({ clock }) => {
    const g = grp.current; if (!g) return
    const time = clock.elapsedTime
    const t = scroll.p*TOTAL_SLOTS - i - START
    const angle = t*ANGLE_SPAN
    g.position.set(Math.sin(angle)*R, t*PITCH, Math.cos(angle)*R)
    const w = 1 - THREE.MathUtils.clamp(Math.abs(t)/FOCUS, 0, 1)
    const ease = w*w*(3-2*w)
    g.rotation.y = angle*(1-ease)
    g.rotation.z = -t*TILT*(1-ease*0.55) + Math.sin(time*0.5+i)*0.012
    g.rotation.x = t*0.055*(1-ease)
    const near = Math.max(0, 1 - Math.abs(t)/2.4)
    focused.current = near
    // 0.58 on top of the old curve: with the camera pulled right in, a centred panel was running
    // off all four edges. Only the cards shrink — everything else keeps the close framing.
    g.scale.setScalar((0.78 + near*near*0.3) * 0.58 * scroll.bloom * (1 - scroll.fin))
    g.visible = Math.abs(t) < 3.1 && scroll.bloom > 0.05 && scroll.fin < 0.99

    const ready = vid.readyState >= 2
    if (matRef.current && ready !== usingVideo.current) {
      usingVideo.current = ready
      matRef.current.map = ready ? tex : poster
      matRef.current.needsUpdate = true
    }

    const wantsPlay = g.visible && near > 0.55
    if (wantsPlay && !playing.current) {
      playing.current = true
      vid.currentTime = 0
      vid.play().catch(() => {})
    } else if (!wantsPlay && playing.current) {
      playing.current = false
      vid.pause()
    }
    // 0.6 -> 0.28: the caption used to land only once the panel had squared up, so you'd been
    // looking at a project for most of its approach before being told what it was.
    if (ease > 0.28 && !was.current) { was.current = true; onFocus(i) }
    if (ease < 0.14) was.current = false
  })
  /* The panel is the link. Only while it's actually the one you're looking at — a click that
     lands on a card swinging past the edge of frame would open a site you never chose. */
  const open = e => {
    if (!sys.live || focused.current < 0.55) return
    e.stopPropagation()
    // A synthesised <a> click rather than window.open: inside embedded browsers and stricter
    // popup blockers, window.open from a canvas event gets swallowed with no error at all.
    const a = document.createElement('a')
    a.href = sys.live; a.target = '_blank'; a.rel = 'noopener noreferrer'
    document.body.appendChild(a); a.click(); a.remove()
  }
  const hover = on => {
    if (!sys.live) return
    document.body.style.cursor = on && focused.current >= 0.55 ? 'pointer' : ''
  }

  return (
    <group ref={grp}>
      {/* A DARK BACKING PLATE. The panel sits in front of a lit garden with depthWrite off, so the
          planting was showing straight through the artwork and washing it out. This blocks it —
          the poster now reads against near-black instead of against whatever is behind the card. */}
      {/* WARM EDGE. The reference's panels are bounded by a thin gold rule, which is what stops
          them dissolving into the dark scene behind them. */}
      <mesh geometry={frame} position={[0, 0, -0.022]} renderOrder={0}>
        <meshBasicMaterial color="#c9ab74" toneMapped={false} side={THREE.DoubleSide}
          alphaMap={frameMask()} transparent opacity={0.88} depthWrite={false} />
      </mesh>
      <mesh geometry={panel} position={[0, 0, -0.012]} renderOrder={1}>
        <meshBasicMaterial color="#04060d" toneMapped={false} side={THREE.DoubleSide}
          alphaMap={cardMask()} transparent opacity={0.94} depthWrite={false} />
      </mesh>
      <mesh geometry={panel} renderOrder={2}
        onClick={open} onPointerOver={() => hover(true)} onPointerOut={() => hover(false)}>
        <meshBasicMaterial ref={matRef} map={poster} toneMapped={false} side={THREE.DoubleSide}
          alphaMap={cardMask()} transparent opacity={1} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ---------- camera + the scroll clock everything reads from ---------- */
function Rig() {
  const { camera, scene, size } = useThree(); const m = useRef({x:0,y:0})
  useEffect(() => {
    const h = e => {
      m.current.x = (e.clientX/window.innerWidth-0.5)*2; m.current.y = (e.clientY/window.innerHeight-0.5)*2
      scroll.mouse.set(m.current.x, -m.current.y)
    }
    window.addEventListener('pointermove', h); return () => window.removeEventListener('pointermove', h)
  }, [])
  useFrame((_, dt) => {
    /* THE JUMP IS YOUR SCROLL. `speed` is the gap still to be closed between where the page is and
       where you have asked it to be — big while you are actively scrolling, zero the moment you
       stop. Eased asymmetrically: it builds fast so a flick registers immediately, and decays
       slowly so the streaks trail off rather than snapping to points. */
    const gap = Math.min(1, Math.abs(scroll.target - scroll.p) * 26)
    scroll.speed += (gap - scroll.speed) * (gap > scroll.speed ? 0.35 : 0.06)
    /* THE JUMP TAKES ITS TIME — TWO AND A HALF SECONDS OF IT, whatever you do to the wheel.
       Everywhere else the page simply chases your scroll at 0.062 a frame. Inside the jump that
       is slowed AND, more importantly, rate-limited: progress may not advance faster than 0.05 of
       the runway per second, so one hard flick that would otherwise cross the whole flight in five
       frames instead flies it at cruising speed. It is still entirely yours — stop and it stops,
       scroll back and it reverses — it just cannot be skipped.

       Per SECOND, not per frame: a 144Hz display would otherwise run the same jump at 2.4x. */
    const inJump = THREE.MathUtils.smoothstep(scroll.p, 0.020, 0.045)
                 * (1 - THREE.MathUtils.smoothstep(scroll.p, 0.155, 0.265))
    const step = (scroll.target - scroll.p) * (0.062 - 0.034 * inJump)
    // the ceiling itself is interpolated, not switched: at 0.05 of the runway a second inside the
    // jump and four outside it, coming out of the flight accelerates rather than snapping loose
    const cap = (0.05 + (1 - inJump) * 4.0) * Math.min(dt, 0.05)
    scroll.p += THREE.MathUtils.clamp(step, -cap, cap)
    const p = scroll.p

    /* THE JUMP, then the burst, then the bone. No cut anywhere in it:
         0.000-0.035  the hero holds
         0.035-0.155  you fly INTO the monogram and through the wall; streaks stretch out
         0.140-0.215  the burst — the field detonates from a point out in open space
         0.148-0.212  the swarm converges and the column assembles from it
       Each window overlaps the next, so no beat ever finishes before its successor starts.

       THE JUMP IS 0.12 OF THE RUNWAY, roughly a fifth of a mile of scrolling — it was 0.07 and it
       played out almost instantly. Distance alone is not enough though: someone who flicks the
       wheel hard would still cross it in a few frames, which is why the easing below slows down
       inside this window rather than the window simply being wider. */
    scroll.warp    = THREE.MathUtils.smoothstep(p, 0.035, 0.155)
    scroll.heroOut = THREE.MathUtils.smoothstep(p, 0.065, 0.150)
    /* YOU GO THROUGH THE LIGHT. The beacon has been growing in front of you for the whole jump;
       this is the instant you reach it. Full cover, but narrow, so it reads as passing through
       rather than as a curtain. Everything of the next section is already in place underneath by
       the time it clears. */
    scroll.flash   = Math.exp(-Math.pow((p - 0.166) / 0.016, 2))
    scroll.bloom   = THREE.MathUtils.smoothstep(p, 0.140, 0.220)
    // the column's whole entrance sits under the flash, so you never watch it arrive
    scroll.spineIn = THREE.MathUtils.smoothstep(p, 0.148, 0.215)
    /* THERE IS NO SEPARATE GARDEN ACT ANY MORE. The planting is up from the burst and stays up,
       so `fin` is no longer "the garden arrives" — it is only the clearing-away: the column and
       the leaves leaving, the camera settling back. It runs LATE and entirely underneath the
       break-up, so the last thing you see of the work is the work itself, whole. */
    scroll.fin     = THREE.MathUtils.smoothstep(p, FIN_FROM + 0.045, 0.90)
    /* THE CLOSE, IN THREE BEATS THAT DO NOT OVERLAP. The last project goes past, the frame
       breaks up into blocks and turns to black, and then — on an empty screen — the handset
       opens out of a seam of light and the apps land on it one at a time. Each beat finishes
       before the next begins, because the whole point is that the phone is not there and then
       it is. */
    /* SIX BEATS, EACH HANDING OVER TO THE NEXT — none of them instant, none of them waiting:
         0.715-0.805  the frame quantises, tears, and goes black block by block
         0.792-0.878  a seam of light opens to full height, then out to full width, and the
                      handset is standing in it
         0.872-0.970  the four apps land, one per beat
       Each window starts where the one before it has done its visible work rather than where its
       number happens to reach 1 — the flip's wave, for instance, finishes around 0.92 of its own
       progress, which is why the seam starts before `contact` is over. */
    scroll.contact = THREE.MathUtils.smoothstep(p, 0.715, 0.805)   // the frame coming apart
    scroll.reveal = THREE.MathUtils.smoothstep(p, 0.792, 0.878)    // the handset appearing
    scroll.contactApps = THREE.MathUtils.clamp((p - 0.872) / 0.098, 0, 1)
    scroll.gardenY = p * TOTAL_SLOTS * PITCH * 0.42

    const idx = THREE.MathUtils.clamp(Math.round(p * TOTAL_SLOTS - START), 0, SYSTEMS.length - 1)
    HUE.set(SYSTEMS[idx].hue[0]).lerp(WHITE, 0.55)
    scroll.tint.lerp(HUE, 0.03)
    const fin = scroll.fin
    if (scene.fog) scene.fog.density = 0.0016 + scroll.heroOut * 0.0044 + fin * 0.0062

    /* EVERY DISTANCE IS MULTIPLIED BY THE FIT. A portrait phone sees a far narrower slice than a
       laptop, so at a fixed camera distance the wordmark, the column and the project panels all
       run off the sides. Pushing the camera back by the aspect ratio keeps the same composition
       on any shape of screen — and the parallax is damped with it, because the same pointer swing
       is a much bigger fraction of a narrow frame. */
    const fit = fitZ(size.width / size.height)

    camera.position.x += (m.current.x*1.5*(1 - scroll.heroOut*0.45)/fit - camera.position.x)*0.04
    camera.position.y += ((-m.current.y*0.9/fit - fin*2.4) - camera.position.y)*0.04
    /* CLOSE THROUGHOUT, and no push-in. The whole journey is shot on a long lens with the subject
       right against the glass — 11.4 at the hero, 13 through the gallery so a centred project
       panel fills the frame edge to edge, backing off only for the garden.
       The dive is gone: it made the column arrive far bigger than it is for the rest of the
       scroll, so it appeared to leap at you and then retreat. It now enters at exactly the size
       it holds through the gallery. */
    camera.position.z = (11.4 + scroll.heroOut*1.6 + fin*7.0) * fit
    camera.lookAt(0, camera.position.y*0.25 + fin*2.6, -fin*5)
    camera.rotation.z += (m.current.x*0.02 - camera.rotation.z)*0.04
  })
  return null
}

function Scene({ onFocus }) {
  return (
    <>
      <color attach="background" args={['#04050a']} />
      <fogExp2 attach="fog" args={['#04050a', 0.0016]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[6,9,8]} intensity={2.4} color="#ffe9f6" />
      <pointLight position={[-9,-4,5]} intensity={70} distance={40} color="#5ee9ff" />
      <pointLight position={[9,6,-3]} intensity={55} distance={40} color="#ff4d9d" />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3.2} position={[0,6,9]} scale={[12,5,1]} color="#ffffff" />
        <Lightformer form="rect" intensity={2.2} position={[-9,1,4]} scale={[4,12,1]} color="#7ad8ff" />
        <Lightformer form="rect" intensity={2.0} position={[9,-2,3]} scale={[4,12,1]} color="#ff7ab8" />
        <Lightformer form="circle" intensity={2.6} position={[0,-7,6]} scale={[7,7,1]} color="#cfe0ff" />
      </Environment>

      {/* act zero */}
      <HeroRoom />
      <Hyperspace />
      <Suspense fallback={null}><SKObject /></Suspense>

      {/* the world it opens into */}
      <Backdrop />
      <Garden />
      {/* The particle ring-stack that used to wrap the column is gone: against the real vertebra
          mesh it read as a spring coiled round the bone, not as anatomy. */}
      <BoneSpine />
      <Blossoms />
      <Suspense fallback={null}><Finale /></Suspense>
      <TitlePanel />
      {SYSTEMS.map((s,i) => <Card key={s.id} sys={s} i={i} onFocus={onFocus} />)}

      {/* TWO PASSES, NOT SIX. The old stack had bloom, chromatic aberration, scanline, noise and
          vignette and cost the frame rate its head. This is the cheap 80%: bloom with a HIGH
          threshold so only genuine highlights — the LED emitters, the swarm, the wet edge of the
          glass — flare, and a whisper of grain to stop the gradients banding. mipmapBlur does the
          blur in mip levels rather than a wide kernel, which is what keeps it affordable. */}
      <EffectComposer disableNormalPass multisampling={0}>
        <Bloom intensity={0.62} luminanceThreshold={0.85} luminanceSmoothing={0.3}
          mipmapBlur radius={0.4} />
        <Noise premultiply opacity={0.05} />
        {/* LAST IN THE STACK, because it is the whole frame breaking up — everything above has
            to have already happened by the time the blocks turn. Idle at zero cost until the
            gallery ends: it reads scroll.contact itself and returns the input untouched while
            that is zero. */}
        <PixelFlip />
      </EffectComposer>

    </>
  )
}

/* The whiteout, driven straight from `scroll` on its own rAF rather than through React state —
   at 60fps a setState per frame would re-render the whole page for one opacity value. */
function Whiteout() {
  const ref = useRef()
  useEffect(() => {
    let raf
    const tick = () => {
      const el = ref.current
      if (el) {
        const v = scroll.flash
        el.style.opacity = v.toFixed(3)
        el.style.visibility = v > 0.002 ? 'visible' : 'hidden'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <div className="whiteout" ref={ref} />
}


const scrollMax = () => document.documentElement.scrollHeight - window.innerHeight

const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#%'
function useScramble(text) {
  const [out, setOut] = useState(text)
  useEffect(() => {
    let f = 0; const steps = 15
    const id = setInterval(() => {
      f++
      setOut(text.split('').map((c,i) => c === ' ' ? ' ' : i < (f/steps)*text.length ? c : CH[(Math.random()*CH.length)|0]).join(''))
      if (f >= steps) { clearInterval(id); setOut(text) }
    }, 26)
    return () => clearInterval(id)
  }, [text])
  return out
}

export default function Helix() {
  const [focus, setFocus] = useState(0)
  const [intro, setIntro] = useState(true)   // the rings spin up before anything else
  const [gone, setGone] = useState(false)      // act zero has handed over
  const [inWork, setInWork] = useState(false)  // the project gallery is running
  const title = useScramble(SYSTEMS[focus].n)
  const lenisRef = useRef(null)
  useEffect(() => {
    // ?s=0.42 pins the scroll for headless screenshots. No effect in normal use.
    const forced = parseFloat(new URLSearchParams(location.search).get('s'))
    if (!Number.isNaN(forced)) {
      scroll.target = forced; scroll.p = forced
      setGone(forced > 0.045); setInWork(forced > 0.222 && forced < 0.70)
      return
    }
    const lenis = new Lenis({ duration: 1.5, smoothWheel: true, wheelMultiplier: 0.85 })
    lenisRef.current = lenis
    lenis.on('scroll', ({ progress }) => {
      scroll.target = progress
      setGone(progress > 0.045)
      // out before the frame starts breaking up: the read-out belongs to the work, and the work
      // is over the moment the pixel flip begins
      setInWork(progress > 0.222 && progress < 0.70)
    })
    let raf; const loop = t => { lenis.raf(t); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    // arriving from the About page's Contact link: /#contact drops you at the close
    if (location.hash === '#contact') setTimeout(() => lenis.scrollTo(scrollMax(), { immediate: true }), 80)
    return () => { cancelAnimationFrame(raf); lenisRef.current = null; lenis.destroy() }
  }, [])

  /* Contact is a place on this page, not a mailto. Lenis owns the scroll position, so it has to do
     the travelling — a native scrollTo fights it and lands somewhere else. Target has to be a
     NUMBER: this version of Lenis ignores 'bottom' without complaining, which is why the link did
     nothing at all the first time. */
  const toContact = e => {
    e.preventDefault()
    const l = lenisRef.current
    if (l) l.scrollTo(scrollMax(), { duration: 2.6 })
    else window.scrollTo({ top: scrollMax(), behavior: 'smooth' })
  }
  return (
    <>
      {/* FIXED pixel ratio, deliberately. An adaptive monitor was tried here and made things far
          worse: every step re-allocated the renderer's targets and the composer's buffers, and the
          churn dragged a 47fps scene down to single digits within seconds. One conservative ratio,
          chosen per device class, costs nothing to maintain. */}
      <Canvas className="gl" dpr={DPR} gl={{ antialias:true, powerPreference:'high-performance' }}
        camera={{ position:[0,0,11.4], fov:38, near:0.1, far:260 }}>
        <Suspense fallback={null}><Rig /><Scene onFocus={setFocus} /></Suspense>
      </Canvas>

      {/* the rings spin up over everything, then tilt away to reveal the hero already running */}
      {intro && <Intro onDone={() => setIntro(false)} />}

      <Whiteout />
      <ContactStage />

      {/* act zero's chrome — the ghost triangles and the cool perimeter go with the room */}
      <div className="ghosts" style={{ opacity: gone ? 0 : 0.5 }} />
      <div className="falloff" />
      <div className="grain" />

      <nav>
        <span className="mark">SK</span>
        <a className="link" href="/">Home</a>
        <a className="link" href="/about.html">About</a>
        <a className="enter" href="#contact" onClick={toContact}>Contact</a>
      </nav>

      {/* The corner read-outs are gone — they were instrument dressing borrowed from the
          reference, and on this page they just crowded the bottom of the frame. */}
      <div className="scrollcue" style={{ opacity: gone ? 0 : 0.55 }}>Scroll to view projects</div>

      {/* the project read-out, gallery only */}
      <aside className="cap" style={{ opacity: inWork ? 1 : 0, pointerEvents: inWork ? 'auto' : 'none' }}>
        <i>{String(focus+1).padStart(2,'0')} / {String(SYSTEMS.length).padStart(2,'0')}</i>
        <b>{title}</b>
        <p>{SYSTEMS[focus].d}</p>
        {/* the panel itself is clickable; this is the same link for anyone who'd rather read it */}
        <span className="plinks">
          {SYSTEMS[focus].live &&
            <a href={SYSTEMS[focus].live} target="_blank" rel="noopener noreferrer">Live ↗</a>}
          {SYSTEMS[focus].repo &&
            <a href={SYSTEMS[focus].repo} target="_blank" rel="noopener noreferrer">Code ↗</a>}
        </span>
      </aside>

      <div className="runway" />
    </>
  )
}
