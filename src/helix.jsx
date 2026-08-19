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
/* 0.95 -> 1.75. The jump, the burst and the column's assembly all happen before the gallery, and
   the title panel needs a clear slot of its own after them — at the old value it swung through
   the frame while the streaks were still flying. */
const HERO_SLOTS = 1.75
const START = 1.25 + HERO_SLOTS
const CARD_SLOTS = SYSTEMS.length + START - 0.4
const FINALE_SLOTS = 3.05
const TOTAL_SLOTS = CARD_SLOTS + FINALE_SLOTS
const FIN_FROM = CARD_SLOTS / TOTAL_SLOTS + 0.012
const HUE = new THREE.Color(), WHITE = new THREE.Color('#ffffff')

// A flat rounded panel with proper 0..1 UVs. ShapeGeometry's own UVs are in shape space,
// so the texture has to be re-mapped across the bounding box or it comes out garbage.
function roundedPanel(w, h, r) {
  const s = new THREE.Shape()
  s.moveTo(-w/2+r, -h/2)
  s.lineTo(w/2-r,-h/2); s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r)
  s.lineTo(w/2,h/2-r);  s.quadraticCurveTo(w/2,h/2,w/2-r,h/2)
  s.lineTo(-w/2+r,h/2); s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r)
  s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2)
  const g = new THREE.ShapeGeometry(s, 22)
  const pos = g.attributes.position
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i*2]   = (pos.getX(i) + w/2) / w
    uv[i*2+1] = (pos.getY(i) + h/2) / h
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}

/* Browsers refuse autoplay until the page has been interacted with. */
const PENDING = new Set()
if (typeof window !== 'undefined') {
  const kick = () => PENDING.forEach(v => v.play().then(() => v.pause()).catch(() => {}))
  window.addEventListener('pointerdown', kick, { once: true })
  window.addEventListener('wheel', kick, { once: true, passive: true })
}

/* THE TITLE, ON THE SAME TRACK AS THE WORK.
   It used to be a DOM card pinned to the middle of the screen, which meant the one element
   announcing the gallery was the one element not in the gallery's space. This rides the identical
   helix the panels ride — same radius, same pitch, same easing — a slot and a half ahead of the
   first project, so it swings round the column, squares up to you, and carries on down as card 01
   comes up behind it. Nothing new to learn: it IS a card, it just says what the next ones are. */
function TitlePanel() {
  const grp = useRef()
  const SLOT = START - 0.9   // one beat ahead of card 01, once the column has finished assembling
  const map = useMemo(() => {
    const W = 1600, H = 420
    const c = document.createElement('canvas')
    c.width = W; c.height = H
    const g = c.getContext('2d')
    g.clearRect(0, 0, W, H)
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.letterSpacing = '0.1em'
    g.font = '900 210px Montserrat, system-ui, sans-serif'
    g.fillStyle = '#ffffff'
    g.fillText('PROJECTS', W / 2, H / 2)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [])

  useFrame(({ clock }) => {
    const g = grp.current; if (!g) return
    const t = scroll.p * TOTAL_SLOTS - SLOT
    const angle = t * ANGLE_SPAN
    g.position.set(Math.sin(angle) * R, t * PITCH, Math.cos(angle) * R)
    const w = 1 - THREE.MathUtils.clamp(Math.abs(t) / FOCUS, 0, 1)
    const ease = w * w * (3 - 2 * w)
    g.rotation.y = angle * (1 - ease)
    g.rotation.z = -t * TILT * (1 - ease * 0.55) + Math.sin(clock.elapsedTime * 0.5) * 0.012
    g.rotation.x = t * 0.055 * (1 - ease)
    const near = Math.max(0, 1 - Math.abs(t) / 2.4)
    g.scale.setScalar((0.78 + near * near * 0.3) * 0.72 * scroll.bloom)
    g.visible = Math.abs(t) < 3.1 && scroll.bloom > 0.05 && scroll.fin < 0.5
  })

  return (
    <group ref={grp}>
      <mesh renderOrder={2}>
        <planeGeometry args={[7.4, 1.94]} />
        <meshBasicMaterial map={map} transparent toneMapped={false} side={THREE.DoubleSide}
          depthWrite={false} />
      </mesh>
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

  const panel = useMemo(() => roundedPanel(6.7, 4.26, 0.17), [])
  // a hair larger, sitting just behind: the sliver that shows past the poster is the frame
  const frame = useMemo(() => roundedPanel(6.86, 4.42, 0.2), [])
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
      <mesh geometry={frame} position={[0, 0, -0.02]} renderOrder={0}>
        <meshBasicMaterial color="#c9ab74" toneMapped={false} side={THREE.DoubleSide}
          transparent opacity={0.88} depthWrite={false} />
      </mesh>
      <mesh geometry={panel} position={[0, 0, -0.012]} renderOrder={1}>
        <meshBasicMaterial color="#04060d" toneMapped={false} side={THREE.DoubleSide}
          transparent opacity={0.94} depthWrite={false} />
      </mesh>
      <mesh geometry={panel} renderOrder={2}
        onClick={open} onPointerOver={() => hover(true)} onPointerOut={() => hover(false)}>
        <meshBasicMaterial ref={matRef} map={poster} toneMapped={false} side={THREE.DoubleSide}
          transparent opacity={1} depthWrite={false} />
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
  useFrame(() => {
    /* THE JUMP IS YOUR SCROLL. `speed` is the gap still to be closed between where the page is and
       where you have asked it to be — big while you are actively scrolling, zero the moment you
       stop. Eased asymmetrically: it builds fast so a flick registers immediately, and decays
       slowly so the streaks trail off rather than snapping to points. */
    const gap = Math.min(1, Math.abs(scroll.target - scroll.p) * 26)
    scroll.speed += (gap - scroll.speed) * (gap > scroll.speed ? 0.35 : 0.06)
    scroll.p += (scroll.target - scroll.p)*0.062
    const p = scroll.p

    /* THE JUMP, then the burst, then the bone. No cut anywhere in it:
         0.000-0.030  the hero holds
         0.030-0.100  you fly INTO the monogram and through the wall; streaks stretch out
         0.090-0.125  the burst — the field detonates from a point out in open space
         0.098-0.170  the swarm converges and the column assembles from it
       Each window overlaps the next, so no beat ever finishes before its successor starts. */
    scroll.warp    = THREE.MathUtils.smoothstep(p, 0.030, 0.100)
    scroll.heroOut = THREE.MathUtils.smoothstep(p, 0.055, 0.098)
    /* YOU GO THROUGH THE LIGHT. The beacon has been growing in front of you for the whole jump;
       this is the instant you reach it. Full cover, but narrow — under a hundredth of the scroll
       — so it reads as passing through rather than as a curtain. Everything of the next section
       is already in place underneath by the time it clears. */
    scroll.flash   = Math.exp(-Math.pow((p - 0.103) / 0.013, 2))
    scroll.bloom   = THREE.MathUtils.smoothstep(p, 0.088, 0.150)
    // the column's whole entrance sits under the flash, so you never watch it arrive
    scroll.spineIn = THREE.MathUtils.smoothstep(p, 0.095, 0.145)
    scroll.fin     = THREE.MathUtils.smoothstep(p, FIN_FROM, 0.97)
    /* THE CLOSE. It starts the moment the last project has gone past rather than in the final few
       percent: the garden dissolves to black from 0.76, the phone is up by 0.90, and the apps land
       one at a time across the rest — so the end of the scroll is the fourth one arriving. */
    scroll.contact = THREE.MathUtils.smoothstep(p, 0.76, 0.90)
    scroll.contactApps = THREE.MathUtils.clamp((p - 0.845) / 0.150, 0, 1)
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
      setGone(forced > 0.06); setInWork(forced > 0.21 && forced < FIN_FROM + 0.03)
      return
    }
    const lenis = new Lenis({ duration: 1.5, smoothWheel: true, wheelMultiplier: 0.85 })
    lenisRef.current = lenis
    lenis.on('scroll', ({ progress }) => {
      scroll.target = progress
      setGone(progress > 0.06)
      setInWork(progress > 0.21 && progress < FIN_FROM + 0.03)
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
