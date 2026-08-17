import { useEffect, useRef, useState } from 'react'

/* THE INTRO — an instrument spinning up, then falling away like planetary rings.
   No counter: a percentage that isn't measuring anything is a lie about how long you're waiting,
   and this waits for a fixed beat rather than for bytes. So the rings do the talking — four
   concentric tracks turning in opposite directions at different rates, tick marks, crosshairs,
   orbiting nodes, and one track carrying the disciplines around its circumference.

   The dissolve is the whole point of the shape: everything here is flat and dead-on until the
   last beat, when the plate tilts back on X like a ring system seen edge-on and expands past the
   camera into the starfield. That tilt is what makes a 2D overlay feel like it was always an
   object in the same space as the scene behind it.

   SVG rather than another canvas: it's a few dozen vector primitives, it stays sharp at any DPR,
   and it costs nothing on a GPU that has a hero to draw the moment this clears. */

const DISCIPLINES =
  'AI / ML ENGINEERING · AGENTIC AI · RAG SYSTEMS · FULL STACK · PROMPT ENGINEERING · ' +
  'SYSTEMS DESIGN · PROTOTYPING · '

// spin, then tilt away. Under three seconds end to end, and any input skips to the dissolve.
// ?intro=hold parks it on the spin so the rings can be inspected; no effect without the flag.
const HOLD = typeof location !== 'undefined' &&
  new URLSearchParams(location.search).get('intro') === 'hold'
const SPIN_MS = HOLD ? 60000 : 2100
const DISSOLVE_MS = 1000

export default function Intro({ onDone }) {
  const [phase, setPhase] = useState('spin')   // spin → dissolve → gone
  const stage = useRef('spin')                 // the same value, readable without re-subscribing
  const done = useRef(false)
  const cb = useRef(onDone)
  cb.current = onDone

  /* THE EFFECT RUNS ONCE. It used to depend on [onDone, phase], and both of those change the
     moment the dissolve starts — onDone is a fresh closure on every parent render. React then
     tore the effect down mid-sequence and cleared the timer that unmounts this overlay, so the
     intro stayed mounted at z-index 55 forever: invisible, animation finished, and swallowing
     every click on the page underneath. The phase lives in a ref and the callback in another, so
     nothing here re-subscribes. */
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { cb.current?.(); return }

    let t1, t2
    const finish = () => {
      if (done.current) return
      done.current = true
      stage.current = 'gone'
      setPhase('gone')
      cb.current?.()
    }
    const dissolve = () => {
      if (stage.current !== 'spin') return
      stage.current = 'dissolve'
      setPhase('dissolve')
      clearTimeout(t1)
      t2 = setTimeout(finish, DISSOLVE_MS)
    }

    t1 = setTimeout(dissolve, SPIN_MS)
    window.addEventListener('pointerdown', dissolve)
    window.addEventListener('keydown', dissolve)
    window.addEventListener('wheel', dissolve, { passive: true })
    return () => {
      clearTimeout(t1); clearTimeout(t2)
      window.removeEventListener('pointerdown', dissolve)
      window.removeEventListener('keydown', dissolve)
      window.removeEventListener('wheel', dissolve)
    }
  }, [])

  if (phase === 'gone') return null

  // tick marks around the second track
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const a = (i / 72) * Math.PI * 2
    const long = i % 6 === 0
    const r1 = long ? 150 : 156, r2 = 164
    return (
      <line key={i} x1={200 + Math.cos(a) * r1} y1={200 + Math.sin(a) * r1}
        x2={200 + Math.cos(a) * r2} y2={200 + Math.sin(a) * r2}
        stroke={long ? 'rgba(190,215,255,.75)' : 'rgba(150,190,255,.32)'} strokeWidth={long ? 1.4 : 1} />
    )
  })

  return (
    <div className="intro" data-phase={phase}>
      <div className="intro-stars" />
      <div className="intro-stage">
        <svg viewBox="0 0 400 400" className="intro-svg" aria-hidden="true">
          <defs>
            {/* the path the disciplines ride around */}
            <path id="ringtext" fill="none"
              d="M 200,200 m -178,0 a 178,178 0 1,1 356,0 a 178,178 0 1,1 -356,0" />
          </defs>

          {/* crosshairs, faint, behind everything */}
          <g className="crosshair">
            <line x1="200" y1="8" x2="200" y2="392" />
            <line x1="8" y1="200" x2="392" y2="200" />
          </g>

          {/* outer track: the disciplines, turning slowly clockwise */}
          <g className="spin-a">
            <circle cx="200" cy="200" r="192" className="ring thin" />
            <text className="ringtext">
              <textPath href="#ringtext" startOffset="0">{DISCIPLINES}{DISCIPLINES}</textPath>
            </text>
          </g>

          {/* tick ring, counter-turning */}
          <g className="spin-b">{ticks}</g>

          {/* dashed track with orbiting nodes, turning fast the other way */}
          <g className="spin-c">
            <circle cx="200" cy="200" r="128" className="ring dashed" />
            <circle cx="328" cy="200" r="5.5" className="node" />
            <circle cx="72" cy="200" r="3.5" className="node dim" />
            <circle cx="200" cy="72" r="2.5" className="node dim" />
          </g>

          {/* inner track and its single bright node */}
          <g className="spin-d">
            <circle cx="200" cy="200" r="92" className="ring" />
            <circle cx="200" cy="108" r="4.5" className="node" />
            <path d="M 200,108 A 92,92 0 0,1 265,135" className="arc" />
          </g>

          {/* the mark at the centre */}
          <text x="200" y="200" className="mark" textAnchor="middle" dominantBaseline="central">SK</text>
        </svg>
      </div>
    </div>
  )
}
