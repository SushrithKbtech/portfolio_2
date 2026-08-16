import { useEffect, useRef, useState } from 'react'

/* THE LOGIN — the OS itself, not a laptop with an OS on it.
   The 3D machine put the thing you were meant to read at a distance, at an angle, behind a bloom
   pass, and then flash-banged you on the way out. This is the lock screen filling the browser
   instead: wallpaper, avatar, a password that types itself, a spinner, and a dissolve straight
   into the page. No perspective, no flash, and every pixel legible. */

const STEPS = { fill: [0.35, 1.25], enter: [1.35, 2.1], out: [2.15, 2.75], end: 2.8 }
const DOTS = 11

export default function OsLogin({ onDone }) {
  const [t, setT] = useState(0)
  const done = useRef(false)
  const skipped = useRef(false)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) { onDone?.(); return }

    let raf
    const t0 = performance.now()
    const tick = now => {
      let el = (now - t0) / 1000
      if (skipped.current) el = Math.max(el, STEPS.out[0] + (el - skipped.current) * 4)
      setT(el)
      if (el >= STEPS.end) { if (!done.current) { done.current = true; onDone?.() }; return }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const skip = () => { if (!skipped.current) skipped.current = (performance.now() - t0) / 1000 }
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip)
    window.addEventListener('wheel', skip, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
      window.removeEventListener('wheel', skip)
    }
  }, [onDone])

  const span = ([a, b]) => Math.min(1, Math.max(0, (t - a) / (b - a)))
  const filled = Math.floor(span(STEPS.fill) * DOTS)
  const signingIn = t >= STEPS.enter[0]
  const leaving = span(STEPS.out)

  return (
    <div className="oslogin" style={{ opacity: 1 - leaving, filter: `blur(${(leaving * 14).toFixed(1)}px)` }}>
      <div className="os-wall" style={{ transform: `scale(${1 + leaving * 0.06})` }} />
      <div className="os-card" style={{ transform: `translateY(${(leaving * -18).toFixed(1)}px)` }}>
        <div className="os-avatar">SK</div>
        <h2>Sushrith Kandagatla</h2>

        {!signingIn ? (
          <div className="os-field">
            {filled === 0 && <span className="os-ph">Password</span>}
            <span className="os-dots">
              {Array.from({ length: filled }, (_, i) => <i key={i} />)}
            </span>
            <span className="os-caret" />
            <button className="os-go" aria-label="Sign in" tabIndex={-1}>→</button>
          </div>
        ) : (
          <div className="os-signing">
            <span className="os-spinner" />
            <p>Welcome</p>
          </div>
        )}
      </div>

      <div className="os-foot">
        <span>sushrith_os</span>
        <span>100% · Wi-Fi · {new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</span>
      </div>
      <span className="os-skip">click to skip</span>
    </div>
  )
}
