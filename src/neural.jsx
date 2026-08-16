import { useEffect, useRef } from 'react'

/* THE NETWORK — a constellation, not a diagram.
   The layered feed-forward version read as a textbook figure sitting behind the text. This is the
   web: a few hundred nodes drifting across the whole frame, and a line drawn between any two that
   come within reach of each other — so the mesh is never the same shape twice and it thickens
   wherever the drift happens to crowd. Line opacity falls off with distance, which is what gives
   it depth without any depth. The cursor pulls nearby nodes toward it and the closest one takes a
   ring, so the thing reacts to you without ever chasing you.

   Canvas 2D on purpose: a text page shouldn't hold a WebGL context open, and at this node count
   the whole frame costs well under a millisecond. */

const LINK = 132          // px — how close two nodes must be to be wired together
const CURSOR_PULL = 150   // px — radius the pointer influences

export default function NeuralBackdrop() {
  const ref = useRef()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let w = 0, h = 0, dpr = 1, nodes = []
    const pointer = { x: -9999, y: -9999 }

    const build = () => {
      // density scales with area, capped so a big monitor doesn't melt
      const count = Math.min(230, Math.round((w * h) / 11000))
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: 1 + Math.random() * 1.6,
        tw: Math.random() * Math.PI * 2,
      }))
    }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.clientWidth; h = canvas.clientHeight
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      build()
    }

    const onMove = e => { pointer.x = e.clientX; pointer.y = e.clientY }
    const onLeave = () => { pointer.x = pointer.y = -9999 }

    let raf, last = performance.now()
    const frame = now => {
      const dt = Math.min((now - last) / 16.7, 3); last = now
      ctx.clearRect(0, 0, w, h)

      // --- drift, wrap, and lean toward the pointer
      for (const n of nodes) {
        if (!reduced) { n.x += n.vx * dt; n.y += n.vy * dt }
        if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20
        if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20
        const dx = pointer.x - n.x, dy = pointer.y - n.y
        const d2 = dx * dx + dy * dy
        if (d2 < CURSOR_PULL * CURSOR_PULL) {
          const d = Math.sqrt(d2) || 1
          const pull = (1 - d / CURSOR_PULL) * 0.5 * dt
          n.x += (dx / d) * pull; n.y += (dy / d) * pull
        }
      }

      // --- the web. O(n²) over ~230 nodes is ~26k cheap comparisons a frame
      ctx.lineWidth = 1
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = a.x - b.x, dy = a.y - b.y
          const d2 = dx * dx + dy * dy
          if (d2 > LINK * LINK) continue
          const t = 1 - Math.sqrt(d2) / LINK
          ctx.strokeStyle = `rgba(94,200,255,${(t * 0.30).toFixed(3)})`
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
        }
      }

      // --- nodes, and the ring on whichever one the cursor is nearest
      let near = null, nearD = CURSOR_PULL * CURSOR_PULL
      for (const n of nodes) {
        n.tw += 0.02 * dt
        const tw = 0.55 + 0.45 * Math.sin(n.tw)
        ctx.fillStyle = `rgba(150,225,255,${(0.35 + tw * 0.4).toFixed(3)})`
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill()
        const dx = pointer.x - n.x, dy = pointer.y - n.y
        const d2 = dx * dx + dy * dy
        if (d2 < nearD) { nearD = d2; near = n }
      }
      if (near) {
        ctx.strokeStyle = 'rgba(140,225,255,0.75)'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(near.x, near.y, 15, 0, Math.PI * 2); ctx.stroke()
        const g = ctx.createRadialGradient(near.x, near.y, 0, near.x, near.y, 30)
        g.addColorStop(0, 'rgba(140,225,255,0.5)'); g.addColorStop(1, 'rgba(140,225,255,0)')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(near.x, near.y, 30, 0, Math.PI * 2); ctx.fill()
      }

      raf = requestAnimationFrame(frame)
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerleave', onLeave)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return <canvas className="neural" ref={ref} aria-hidden="true" />
}
