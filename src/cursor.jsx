import { useEffect, useRef } from 'react'
import { isTouch } from './device'

/* THE LIQUID CURSOR — a gooey metaball trail.
   Eleven blobs chained behind the pointer: the first eases toward the cursor, each of the rest
   eases toward the one in front of it. That chain is what makes the tail lag and stretch when you
   move fast and gather back into a single mass when you stop — the viscosity is emergent, not
   simulated. The container is blurred and then contrast-thresholded (the same trick as the intro
   splash), so overlapping blobs fuse into one shape instead of reading as separate dots.

   Cost: one rAF loop writing eleven transforms. No canvas, no shader, no per-frame allocation —
   the blur and threshold are compositor work on a layer the GPU already has. It is skipped
   outright on touch, where there is no pointer to trail. */

const N = 11
const LEAD = 0.30      // how hard the head chases the cursor
const FOLLOW = 0.34    // how hard each blob chases the one ahead of it

export default function LiquidCursor() {
  const wrap = useRef()

  useEffect(() => {
    if (isTouch || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = wrap.current
    if (!el) return
    const blobs = Array.from(el.children)

    const half = window.innerWidth / 2, mid = window.innerHeight / 2
    const pts = blobs.map(() => ({ x: half, y: mid }))
    const target = { x: half, y: mid }
    let alive = false, raf, idle

    const move = e => {
      target.x = e.clientX; target.y = e.clientY
      if (!alive) { alive = true; el.style.opacity = '1' }
      // it fades out if the pointer stops moving, so a still cursor doesn't leave a blot on screen
      clearTimeout(idle)
      idle = setTimeout(() => { alive = false; el.style.opacity = '0' }, 900)
    }
    const leave = () => { alive = false; el.style.opacity = '0' }

    const tick = () => {
      pts[0].x += (target.x - pts[0].x) * LEAD
      pts[0].y += (target.y - pts[0].y) * LEAD
      for (let i = 1; i < pts.length; i++) {
        pts[i].x += (pts[i - 1].x - pts[i].x) * FOLLOW
        pts[i].y += (pts[i - 1].y - pts[i].y) * FOLLOW
      }
      for (let i = 0; i < blobs.length; i++) {
        // the tail tapers, so the trail comes to a point rather than ending in a full-sized disc
        const s = 1 - i / (N + 3)
        blobs[i].style.transform =
          `translate3d(${pts[i].x.toFixed(1)}px,${pts[i].y.toFixed(1)}px,0) translate(-50%,-50%) scale(${s.toFixed(3)})`
      }
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerleave', leave)
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf); clearTimeout(idle)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerleave', leave)
    }
  }, [])

  if (isTouch) return null

  return (
    <div className="cursorgoo" ref={wrap} aria-hidden="true">
      {Array.from({ length: N }, (_, i) => <span key={i} className={`cblob c${i % 4}`} />)}
    </div>
  )
}
