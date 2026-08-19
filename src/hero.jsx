import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshTransmissionMaterial, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { scroll } from './scrollState'
import Optional from './assetGuard.jsx'

/* ACT ZERO — the front door.
   A refractive SK standing inside a room of LED panels, with the full name set behind it.
   Everything the glass distorts has to LIVE IN THE SCENE: the name is a texture on a plane, the
   focus chart is a plane behind that, the panel wall is a tunnel around all of it. DOM text would
   sit on top of the canvas and the glass would have nothing to bend — that single decision is
   what makes the letters magnify and split as the object turns. */

const LINES = ['SUSHRITH', 'KANDAGATLA']

/* THE WORDMARK TYPEFACE, switchable from the URL: ?font=futura | avantgarde | montserrat | syne.
   Futura and Avant Garde have no web licence, so those two run down a stack of the geometric
   sans that ship with the OS — Century Gothic on Windows, Avenir Next on macOS — which carry the
   same wide, single-storey, compass-and-ruler character. Montserrat and Syne are self-hosted. */
const FACES = {
  futura:     { family: 'Futura PT', weight: 700, tracking: '0.10em',
                stack: `"Futura PT","Futura","Century Gothic","URW Gothic","Avenir Next",sans-serif` },
  avantgarde: { family: 'ITC Avant Garde Gothic', weight: 700, tracking: '0.12em',
                stack: `"ITC Avant Garde Gothic","Avant Garde","Century Gothic","URW Gothic",sans-serif` },
  montserrat: { family: 'Montserrat', weight: 900, tracking: '0.06em',
                stack: `"Montserrat","Helvetica Neue",Arial,sans-serif` },
  syne:       { family: 'Syne', weight: 800, tracking: '0.04em',
                stack: `"Syne","Helvetica Neue",Arial,sans-serif` },
}
const FONT = (() => {
  const q = typeof location !== 'undefined' && new URLSearchParams(location.search).get('font')
  return FACES[q] ? q : 'futura'
})()

/* ---------- the name, drawn once into a texture ---------- */
const WORD_CANVAS = [2400, 1000]

function wordTexture(lines) {
  const [W, H] = WORD_CANVAS
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  g.clearRect(0, 0, W, H)
  g.fillStyle = '#ffffff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const f = FACES[FONT]
  g.letterSpacing = f.tracking
  const face = px => `${f.weight} ${px}px ${f.stack}`
  const fit = W * 0.92
  // Both lines set to the SAME optical width, so the block reads as one slab of type rather than
  // two headlines that happen to be stacked.
  lines.forEach((line, i) => {
    let px = 430
    g.font = face(px)
    const measured = g.measureText(line).width
    if (measured > fit) { px = Math.floor(px * fit / measured); g.font = face(px) }
    g.fillText(line, W / 2, H * (i === 0 ? 0.31 : 0.71))
  })
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export function HeroWord({ width = 13.5 }) {
  const ref = useRef()
  const map = useMemo(() => wordTexture(LINES), [])
  const h = width * (WORD_CANVAS[1] / WORD_CANVAS[0])
  useFrame(() => {
    const m = ref.current; if (!m) return
    // the name is act zero's alone: it goes as the journey starts
    m.material.opacity = 1 - scroll.heroOut
    m.visible = m.material.opacity > 0.01
  })
  return (
    <mesh ref={ref} position={[0, 0, 0]} renderOrder={-1}>
      <planeGeometry args={[width, h]} />
      {/* unlit and untonemapped: the letters are a light source in the composition, not a surface */}
      <meshBasicMaterial map={map} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  )
}

// What the wall says. The name runs big at eye level; the roles run as smaller tickers above and
// below it, in and out of frame, the way a departure board or a stadium ribbon does.
const ROLES = 'AI/ML ENGINEER  ·  GEN AI  ·  FULL STACK DEVELOPER  ·  ' +
              'AGENTIC AI BUILDER  ·  RAG SYSTEMS  ·  TINKERER  ·  '

/* A line of type set once into a long strip that tiles seamlessly around the wall. Drawn edge to
   edge with a separator rather than centred, because it's a ticker, not a title. */
function stripTexture(text, tracking) {
  const W = 2048, H = 256
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  g.fillStyle = '#000000'; g.fillRect(0, 0, W, H)
  const f = FACES[FONT]
  g.fillStyle = '#ffffff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  // tracking is per-strip: the name is set wide, the roles stay tight, so the two read as
  // different voices on the same wall rather than one font at two sizes
  g.letterSpacing = tracking ?? f.tracking
  let px = 150
  g.font = `${f.weight} ${px}px ${f.stack}`
  // fit exactly one repeat to the canvas so fract() wrapping never shows a seam
  px = Math.floor(px * (W * 0.99) / g.measureText(text).width)
  g.font = `${f.weight} ${px}px ${f.stack}`
  /* THE TYPE IS THE LIGHT IN THIS ROOM. Drawn three times — a wide soft pass, a tight one, then
     the solid letter — so the strip carries its own halo and the wall GLOWS around the words
     instead of stencilling them out of the dark. Baked into the texture once, so it costs the
     shader nothing at all. */
  g.shadowColor = 'rgba(255,255,255,0.9)'
  g.shadowBlur = 38; g.fillText(text, W / 2, H / 2)
  g.shadowBlur = 15; g.fillText(text, W / 2, H / 2)
  g.shadowBlur = 0;  g.fillText(text, W / 2, H / 2)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.anisotropy = 8
  return t
}

/* ---------- the panel wall ----------
   Not graph paper. A tunnel of LED panels: most of them dark, a scattered few lit hard electric
   blue, each running its own slow band of "footage", all of it behind a wire grid with alignment
   crosshairs and the odd ghost triangle. The curvature is what stops it reading flat — verticals
   bow away at the frame edges, which is the whole look. */
export function HeroRoom() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true,
    uniforms: {
      uT: { value: 0 }, uFade: { value: 1 }, uTicker: { value: 1 },
      uText: { value: stripTexture(`${LINES.join(' ')}   ·   `, '0.30em') },
      uRoles: { value: stripTexture(ROLES, '0.10em') },
      // the cursor, in 0..1 screen space, lerped — plus where it was last frame and how fast it
      // is going, which is what makes the wall react to a flick differently than to a drift
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uPrevMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uMouseSpeed: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uT, uFade, uTicker, uMouseSpeed;
      uniform sampler2D uText, uRoles;
      uniform vec2 uMouse, uPrevMouse, uRes;
      varying vec2 vUv;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      /* THE WALL RUNS PROGRAMMES. Four of them, each a different way of deciding which panels are
         lit, cycling every few seconds with a quick cut between: diagonal bands marching across
         the grid, scattered panels, alternating rows, and a near-blackout down to a handful. The
         palette cuts with them — cold white, electric blue, violet, cyan — so the room is never
         the same colour twice in a row. */
      float programme(vec2 id, int m, float t){
        if (m == 0) return step(0.45, fract((id.x + id.y) * 0.13 - t * 0.05));
        if (m == 1) return step(0.70, hash(id + 11.0));
        if (m == 2) return step(0.5, fract(id.y * 0.5 + t * 0.03)) * step(0.30, hash(id));
        if (m == 3) return step(0.87, hash(id + 3.0));
        if (m == 4) return step(0.5, fract((id.x - id.y) * 0.11 + t * 0.04));   // counter-diagonals
        return step(0.62, hash(id + 19.0)) * step(0.35, fract(id.x * 0.5));     // vertical columns
      }

      // Seven programmes, seven colours — the blues and the violet, plus a warm amber, a red and
      // a green so the room isn't only ever one temperature.
      /* Saturated and lifted. With the bloom pass gone there is nothing downstream adding
         brilliance, so the emitters have to carry it themselves. */
      vec3 palette(int m){
        if (m == 0) return vec3(0.94, 0.97, 1.00);   // cold white
        if (m == 1) return vec3(0.24, 0.34, 1.00);   // electric blue
        if (m == 2) return vec3(0.70, 0.24, 1.00);   // violet
        if (m == 3) return vec3(1.00, 0.74, 0.10);   // amber
        if (m == 4) return vec3(1.00, 0.18, 0.28);   // red
        if (m == 5) return vec3(0.12, 1.00, 0.48);   // green
        return vec3(0.05, 0.68, 1.00);               // cyan
      }

      // signed distance to an upward triangle, for the ghost glyphs tiled through the wall
      float triangle(vec2 p, float r){
        const float k = 1.7320508;
        p.x = abs(p.x) - r;
        p.y = p.y + r / k;
        if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
        p.x -= clamp(p.x, -2.0 * r, 0.0);
        return -length(p) * sign(p.y);
      }

      void main(){
        /* THE CURSOR PUSHES THE WALL.
           Worked out in SCREEN space, not in the wall's own coordinates: the pointer is on the
           screen, and a cylinder's uv stretches and compresses across the frame, so a ripple
           computed in uv would drift away from the cursor at the edges. The distance is aspect
           corrected — on a wide monitor an uncorrected radius is an ellipse.

           The displacement is a smooth well around the pointer with a standing wave riding on it,
           pushed outward along the direction away from the cursor, and it grows with how fast you
           are moving: still, it is a barely-there bulge; flicked, the panels visibly swim. The
           velocity term drags the surface the way you moved, which is what stops it feeling like
           a fixed lens under the pointer. */
        vec2 sp = gl_FragCoord.xy / uRes;
        vec2 md = sp - uMouse;
        md.x *= uRes.x / uRes.y;
        float mdist = length(md);
        float fall = smoothstep(0.34, 0.0, mdist);
        float rip = sin(mdist * 30.0 - uT * 3.4);
        float amp = (0.004 + uMouseSpeed * 0.013) * fall * (0.62 + 0.38 * rip);
        vec2 push = md / max(mdist, 0.0001) * amp + (uMouse - uPrevMouse) * fall * 2.6;
        // screen displacement -> wall uv; the arc is wider than the frame, hence the scale down
        vec2 vu = vUv + push * vec2(0.5, 0.72);

        // Big panels, not fine graph paper: the reference wall is maybe two dozen screens across
        // and you can count them.
        vec2 cells = vec2(24.0, 11.0);
        vec2 g = vu * cells;
        vec2 id = floor(g), f = fract(g);

        float n  = hash(id);
        float n2 = hash2(id);

        // --- the panel face itself: charcoal glass, darkened toward its own bezel
        vec2 e = min(f, 1.0 - f);
        float bezel = smoothstep(0.0, 0.075, e.x) * smoothstep(0.0, 0.075, e.y);
        float face = (0.40 + 0.60 * bezel) * (0.65 + 0.35 * n);

        // --- which programme is on, and what it's cutting to next
        float pr = uT / 7.0;
        int m0 = int(mod(floor(pr), 7.0));
        int m1 = int(mod(floor(pr) + 1.0, 7.0));
        // A LONG CROSSFADE, not a cut. Every hard switch in this scene has been softened: the
        // wall now spends the back half of each cycle dissolving into the next programme and its
        // colour, so nothing on screen ever changes state in a single frame.
        float k = smoothstep(0.42, 1.0, fract(pr));
        float pat = mix(programme(id, m0, uT), programme(id, m1, uT), k);
        vec3 tint = mix(palette(m0), palette(m1), k);

        // --- DEAD PANELS. A fixed sixth of the wall never lights, in the same places every cycle,
        // so the programmes are always cut into by the same black shapes.
        pat *= 1.0 - step(hash(id + 7.0), 0.16);

        // --- what's playing on the live ones: slow bands and a rolling refresh line
        float bands = 0.5 + 0.5 * sin(f.y * 16.0 + uT * (0.4 + n2 * 0.6) + n * 40.0);
        float roll  = smoothstep(0.08, 0.0, abs(fract(f.y - uT * 0.09 * (0.4 + n2)) - 0.5));
        /* A THEATRE WITH THE HOUSE LIGHTS DOWN. The room is nearly black and the only things in
           it that emit are the LED panels and the type running across them — everything else,
           the grid, the bezels, the crosshairs, is barely there. Halving the content and cutting
           the wire to a quarter is what turns a video wall into a dark auditorium. */
        float content = pat * (0.055 + bands * 0.085 + roll * 0.13);

        // --- THE SPILL. Every bit of blue in the reference comes off the object and lands on the
        // wall behind it: brightest square in the middle of the frame, falling away fast.
        float spill = exp(-pow((vu.y - 0.5) * 4.2, 2.0));

        // --- ghost triangle glyphs, rare, drawn inside their cell
        float tri = 0.0;
        if (n2 > 0.93) {
          float d = triangle(f - 0.5, 0.22);
          tri = smoothstep(0.012, 0.0, abs(d)) * 0.4;
        }

        // --- the wire grid: thin, bright, and the most graphic thing on the wall
        vec2 d2 = min(f, 1.0 - f);
        float line = smoothstep(0.012, 0.0, d2.x) + smoothstep(0.020, 0.0, d2.y);

        // --- "+" alignment crosshairs at every cell centre
        vec2 c = abs(f - 0.5);
        float plus = step(c.x, 0.005) * step(c.y, 0.055) + step(c.y, 0.008) * step(c.x, 0.036);

        // hold the light at eye level; the wall falls to nothing at its top and bottom edges and
        // again at the two sides, so it never shows a hard boundary
        float depth = smoothstep(0.0, 0.30, vu.y) * smoothstep(1.0, 0.72, vu.y)
                    * smoothstep(0.0, 0.10, vu.x) * smoothstep(1.0, 0.90, vu.x);

        // --- THE NAME, RUNNING ON THE WALL. Two tickers crossing the middle of the tunnel in
        // opposite directions: the main one big and bright at eye level behind the object, a
        // smaller, dimmer one above it. Multiplied by the panel face so the bezels and grid lines
        // cut straight through the letters — it has to be ON the screens, not floating over them.
        vec3 ticker = vec3(0.0);
        {
          /* SEAM TEAR. Each panel carries its own fixed offset, scaled by how close the cursor is
             and how fast it is moving — so as you sweep across the wall whole screens jump
             sideways against their neighbours and snap back, and the seams between them become
             visible for a moment. */
          float seam = (hash(id + 31.0) - 0.5) * 0.018 * fall * uMouseSpeed;
          // 1.0 - vu.x because we're looking at the wall's INSIDE face: sampled straight, every
          // letter comes out mirrored.
          float x = 1.0 - vu.x + seam;
          // CHROMATIC DISPERSION, and only where there is displacement to justify it: the red and
          // blue copies of the name pull apart under the cursor and close again behind it.
          float ca = fall * (0.0015 + uMouseSpeed * 0.006);
          // THE NAME: one copy per wall, set wide and tall. Fewer repeats = bigger letters.
          float band = (vu.y - 0.50) / 0.235 + 0.5;       // main line, at eye level
          if (band > 0.0 && band < 1.0) {
            float u = fract(x * 0.95 + uT * 0.026);
            ticker.r += texture2D(uText, vec2(fract(u + ca), band)).r;
            ticker.g += texture2D(uText, vec2(u, band)).r;
            ticker.b += texture2D(uText, vec2(fract(u - ca), band)).r;
          }
          // WHAT I DO: smaller than the name but no longer a whisper, running the other way
          // taller bands and fewer repeats around the wall: same tickers, noticeably bigger type
          float band2 = (vu.y - 0.750) / 0.185 + 0.5;
          if (band2 > 0.0 && band2 < 1.0) {
            float u2 = fract(x * 0.92 - uT * 0.020);
            ticker += vec3(texture2D(uRoles, vec2(u2, band2)).r * 0.8);
          }
          float band3 = (vu.y - 0.255) / 0.165 + 0.5;
          if (band3 > 0.0 && band3 < 1.0) {
            float u3 = fract(x * 1.05 + uT * 0.014);
            ticker += vec3(texture2D(uRoles, vec2(u3, band3)).r * 0.68);
          }
        }
        ticker *= (0.52 + 0.48 * bezel) * uTicker;        // the bezel eats the letters at panel edges

        /* THE DOT MATRIX. Everything the wall emits — the programmes, the tickers, the spill —
           is pushed through a grid of round emitters with dark gaps between them, the way a real
           LED module works. lp is the sub-cell coordinate, dot the round emitter, and the faint
           gap term keeps the lattice visible even where the panel is bright.
           (No backticks in here: this whole shader is a JS template literal.) */
        vec2 lp = fract(f * 26.0);
        float dot = smoothstep(0.52, 0.24, length(lp - 0.5));
        float gap = 0.86 + 0.14 * dot;

        vec3 base = vec3(0.004, 0.005, 0.011);
        vec3 wire = vec3(0.62, 0.70, 1.00);
        vec3 glow = vec3(0.72, 0.80, 1.00);   // what the letters are lit in

        vec3 col = base * face * gap;
        // the spill takes the current programme's colour too, so the whole room turns together
        col += tint * (content + spill * 0.07 * (0.5 + 0.5 * n)) * dot;
        /* THE WORDS ARE THE BRIGHTEST THING ON THE WALL, and they only half go through the dot
           matrix — pushed fully through it the letters lost more light than they could spare in a
           room this dark, and the halo baked into the strip died with them. */
        col += glow * ticker * (0.95 + spill * 1.25) * (0.55 + 0.45 * dot);
        col += wire * (line * 0.13 + plus * 0.2 + tri * 0.45) * (0.35 + spill * 0.5);
        col *= depth;

        // LED sub-pixel scanlines, fine enough to read as panel structure rather than CRT
        col *= 0.88 + 0.12 * sin(vu.y * 1400.0);

        gl_FragColor = vec4(col, uFade);
      }`,
  }), [])

  const ref = useRef()
  const cur = useRef({ x: 0.5, y: 0.5, px: 0.5, py: 0.5, speed: 0 })
  useFrame(({ clock, camera, gl }) => {
    mat.uniforms.uT.value = clock.elapsedTime

    /* THE POINTER, SMOOTHED. Rig writes the raw position in NDC; this lerps toward it so the
       ripple trails the cursor slightly instead of being nailed to it, and derives a speed from
       the frame-to-frame delta. Speed builds fast and decays slowly — the same asymmetry the jump
       uses — so a flick registers immediately and the wall settles afterwards rather than
       stopping dead. It all shuts off with act zero: this is the front door's trick, not the
       journey's. */
    const c = cur.current
    c.px = c.x; c.py = c.y
    c.x += (scroll.mouse.x * 0.5 + 0.5 - c.x) * 0.1
    c.y += (scroll.mouse.y * 0.5 + 0.5 - c.y) * 0.1
    const v = Math.min(1, Math.hypot(c.x - c.px, c.y - c.py) * 26)
    c.speed += (v - c.speed) * (v > c.speed ? 0.4 : 0.045)
    mat.uniforms.uMouse.value.set(c.x, c.y)
    mat.uniforms.uPrevMouse.value.set(c.px, c.py)
    mat.uniforms.uMouseSpeed.value = c.speed * (1 - scroll.heroOut)
    // device pixels, because gl_FragCoord is in device pixels
    mat.uniforms.uRes.value.set(gl.domElement.width, gl.domElement.height)
    // Dims out as act one takes over, and then LEAVES. At a residual 2% the ticker was still
    // legible through the planting three acts later. It does NOT come back for the title beat:
    // bringing the wall up again there made the handover read as a loop rather than a journey.
    const on = 1 - scroll.heroOut
    mat.uniforms.uFade.value = on
    if (ref.current) {
      /* THE WALL COMES AT YOU. During the jump it rushes forward and passes the lens — the
         panels swell, slide off every edge and are gone behind you. Nothing fades out here;
         it leaves through the viewer, which is why no cut is needed on the far side. */
      // measured off the camera for the same reason as the monogram: the wall's near face has to
      // get past you, and how far back the camera sits depends on the shape of the screen
      ref.current.position.z = -3 + scroll.warp * (camera.position.z + 21)
      ref.current.visible = on > 0.005 && scroll.warp < 0.995
    }
  })

  return (
    /* A CURVED WALL, not a tube. As a full tunnel the ticker came out as a ring around the
       periphery — a band of constant depth — instead of a line of type crossing the frame. A
       segment of cylinder standing on its end puts uv.x across the wall and uv.y up it, so the
       name runs horizontally behind the object and the verticals still bow away at the edges. */
    <mesh ref={ref} position={[0, 0, -3]} material={mat} renderOrder={-6}>
      {/* radius 26 -> 17 and the arc widened 2.4 -> 3.05 rad: the wall now wraps far enough round
          that the panels at the edges of frame are turning away from you, which is where all the
          perspective in this shot comes from. More segments so the curve stays smooth up close. */}
      <cylinderGeometry args={[17, 17, 30, 140, 1, true, Math.PI - 1.52, 3.05]} />
    </mesh>
  )
}

/* ---------- the object: a solid glass SK ----------
   Built from stroke centrelines rather than a font file, because a typeface JSON is one more
   binary this repo doesn't ship. Each stroke is offset either side of its centreline into a
   closed outline, then extruded. Drop a real mesh at public/models/sk.glb and it takes over. */
function ribbonShape(points, width) {
  const half = width / 2
  const left = [], right = []
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)]
    const next = points[Math.min(points.length - 1, i + 1)]
    const dir = new THREE.Vector2(next.x - prev.x, next.y - prev.y).normalize()
    const n = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(half)
    left.push(new THREE.Vector2(points[i].x + n.x, points[i].y + n.y))
    right.push(new THREE.Vector2(points[i].x - n.x, points[i].y - n.y))
  }
  const s = new THREE.Shape()
  s.moveTo(left[0].x, left[0].y)
  for (let i = 1; i < left.length; i++) s.lineTo(left[i].x, left[i].y)
  for (let i = right.length - 1; i >= 0; i--) s.lineTo(right[i].x, right[i].y)
  s.closePath()
  return s
}

const V = (x, y) => new THREE.Vector2(x, y)
const DEG = Math.PI / 180

function arc(cx, cy, r, from, to, steps = 34) {
  const out = []
  for (let i = 0; i <= steps; i++) {
    const th = THREE.MathUtils.lerp(from, to, i / steps) * DEG
    out.push(V(cx + Math.cos(th) * r, cy + Math.sin(th) * r))
  }
  return out
}

/* THE MONOGRAM — a proper curved S with the K GROWING OUT OF IT.
   Not two letters side by side and not a boxed-off ligature: the K's stem is planted so it
   overlaps the S's right-hand bulges, top and bottom, so the two solids fuse into one piece of
   glass and the K reads as emerging from the S. Every stroke is a centreline polyline offset into
   an outline and extruded — four ribbons, no font file. */
function skGeometry() {
  const STROKE = 0.36          // heavy: at anything lighter the glass has no thickness to colour
  const R = 0.5                // the S's bowl radius; the letter stands 2R tall either side of 0
  const SX = -0.62             // the S sits left, the K takes the right
  const KX = 0.16              // the stem, close enough in to overlap the S and fuse with it
  const extrude = { depth: 0.5, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 4, curveSegments: 6 }

  const strokes = [
    // S — two arcs meeting at the waist, one continuous centreline
    [...arc(SX, R, R, 28, 250), ...arc(SX, -R, R, 70, -152)],
    // K — the stem, overlapping the S's right edge
    [V(KX, 1.0), V(KX, -1.0)],
    // K — both diagonals off the junction
    [V(KX, 0.02), V(0.95, 1.0)],
    [V(KX, 0.02), V(1.0, -1.0)],
  ]

  const geos = strokes.map(pts => new THREE.ExtrudeGeometry(ribbonShape(pts, STROKE), extrude))

  const g = mergeGeometries(geos, false)
  g.center()
  g.computeBoundingBox()
  const size = new THREE.Vector3()
  g.boundingBox.getSize(size)
  const k = 2 / Math.max(size.x, size.y, size.z)   // normalised, so `scale` means the same thing
  g.scale(k, k, k)
  g.computeVertexNormals()
  return g
}

/* Cursor control. Moving the pointer aims the object; dragging spins it and lets go with
   momentum; left alone it keeps a slow drift so the refraction never sits still. */
function useCursorSpin() {
  const state = useRef({ spin: 0, vy: 0, vx: 0, tilt: 0, look: 0, lookY: 0, drag: false, px: 0, py: 0, idle: 0 })
  useEffect(() => {
    const s = state.current
    // only while act zero is on screen — past the handover a drag belongs to the page, not the object
    const down = e => {
      if (scroll.heroOut > 0.6) return
      s.drag = true; s.px = e.clientX; s.py = e.clientY; document.body.style.cursor = 'grabbing'
    }
    const up = () => { s.drag = false; document.body.style.cursor = '' }
    const move = e => {
      s.look = (e.clientX / window.innerWidth - 0.5) * 2
      s.lookY = (e.clientY / window.innerHeight - 0.5) * 2
      if (!s.drag) return
      s.vy += (e.clientX - s.px) * 0.00045
      s.vx += (e.clientY - s.py) * 0.00035
      s.px = e.clientX; s.py = e.clientY
      s.idle = 0
    }
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('pointermove', move)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('pointermove', move)
      document.body.style.cursor = ''
    }
  }, [])
  return state
}

function Glass({ geometry }) {
  const ref = useRef()
  const mat = useRef()
  const s = useCursorSpin()

  useFrame(({ clock, camera }, dt) => {
    const o = ref.current; if (!o) return
    const c = s.current
    const step = Math.min(dt, 0.05)
    const t = clock.elapsedTime

    // momentum from the drag, bled off gently
    c.spin += c.vy
    c.tilt += c.vx
    c.vy *= 0.93; c.vx *= 0.93
    c.tilt = THREE.MathUtils.clamp(c.tilt, -0.9, 0.9)

    // ...and then it comes back to face you. A monogram that free-spins is unreadable half the
    // time; the reference object holds front-on and only ever turns a few degrees off it.
    if (!c.drag) {
      c.spin -= c.spin * step * 0.9
      c.tilt -= c.tilt * step * 0.9
    }

    const yFree = c.spin + c.look * 0.5 + Math.sin(t * 0.24) * 0.20
    const xFree = c.tilt + c.lookY * 0.26 + Math.sin(t * 0.19) * 0.06

    o.rotation.y = yFree
    o.rotation.x = xFree
    o.rotation.z = Math.sin(t * 0.13) * 0.04

    /* THE MONOGRAM IS THE DOOR. You fly INTO it: it rushes the lens, swelling as it comes, and
       passes either side of you. It does not shrink and it does not fade — going through it is
       the transition. */
    const w = scroll.warp
    /* IT HAS TO CLEAR THE LENS. The throw is measured against where the camera actually is —
       which changes with the aspect ratio, since a narrow screen is shot from further back — so
       the monogram passes behind you on every device instead of being switched off while it still
       fills the frame. At the old fixed 15 units it vanished mid-flight, and on a jump this long
       that pop was in plain sight rather than buried under the flash. */
    o.position.z = 1.6 + w * w * (camera.position.z + 5 - 1.6)
    o.scale.setScalar(2.45 * (1 + w * 1.8))
    if (mat.current) mat.current.opacity = 1
    o.visible = w < 0.995
  })

  return (
    <mesh ref={ref} geometry={geometry} renderOrder={1}>
      {/* MELTING ICE, not solid blue glass.
          ior 1.31 is ice's real refractive index — much weaker bending than glass, so you see
          THROUGH it rather than into a lens. The colour is attenuation over a long distance, so
          thin edges read almost clear and only the deep interior picks up blue: that gradient
          from clear rim to blue core is what makes it read as ice rather than as a plastic tint.
          A little surface roughness under a wet clearcoat gives the frosted-but-slick look, and
          the temporal distortion keeps the refraction crawling — the melt. */}
      {/* CONDENSATION ON GLASS. Thinner and far less attenuating, so the wall reads clearly
          through it; the humidity comes from roughness pushed up to 0.3 — a microfacet haze that
          scatters what's behind into a fogged bloom — under a clearcoat left slick and beaded at
          0.12, which is exactly the split you see on a cold window: misted body, wet surface.
          The crawling distortion is the water finding its way down. */}
      {/* samples 10 -> 5 and buffer 512 -> 256: this material re-renders the scene into an
          off-screen target every single frame, and at these sizes the difference is invisible
          through frosted glass but halves the cost of the hero.
          Attenuation is stretched right out (16) so the glass barely tints what passes through
          it — the monogram reads as clear ice picking up the room, not as a blue object. */}
      <MeshTransmissionMaterial ref={mat} transparent
        samples={5} resolution={256} thickness={0.7} ior={1.28} chromaticAberration={0.045}
        anisotropy={0.3} distortion={0.42} distortionScale={0.65} temporalDistortion={0.26}
        roughness={0.2} clearcoat={1} clearcoatRoughness={0.1}
        attenuationDistance={16} attenuationColor="#bcd8ff"
        iridescence={0.28} iridescenceIOR={1.28} iridescenceThicknessRange={[100, 620]}
        transmission={1} color="#ffffff" />
      {/* No `background` prop on purpose: it FILLS the transmission buffer with a flat colour
          instead of the real scene, which is what was making the object read as a solid blue
          lump. Left off, the wall and its tickers refract through the ice. */}
    </mesh>
  )
}

function GLBObject() {
  const { scene } = useGLTF('/models/sk.glb')
  const geometry = useMemo(() => {
    const geos = []
    scene.traverse(o => {
      if (o.isMesh && o.geometry) { const g = o.geometry.clone().toNonIndexed(); g.applyMatrix4(o.matrixWorld); geos.push(g) }
    })
    if (!geos.length) return skGeometry()
    const g = geos.length === 1 ? geos[0] : mergeGeometries(geos, false)
    g.computeBoundingBox()
    const size = new THREE.Vector3(), c = new THREE.Vector3()
    g.boundingBox.getSize(size); g.boundingBox.getCenter(c)
    g.translate(-c.x, -c.y, -c.z)
    // longest axis here, unlike the spine: this object is meant to fill the frame
    const k = 2 / Math.max(size.x, size.y, size.z)
    g.scale(k, k, k)
    g.computeVertexNormals()
    return g
  }, [scene])
  return <Glass geometry={geometry} />
}

function BuiltSK() {
  const geometry = useMemo(() => skGeometry(), [])
  return <Glass geometry={geometry} />
}

export function SKObject() {
  const light = useRef()
  // A blue key light BEHIND the object. Transmissive glass only has the colour that light puts
  // into it — lit from the front alone it goes to a dark blue lump, which is the difference
  // between the reference's glowing monolith and a paperweight.
  useFrame(() => {
    if (light.current) light.current.intensity = 9 * (1 - scroll.heroOut)
  })
  return (
    <group position={[0, 0, 1.6]}>
      {/* the backlight is what was painting it blue — pulled right down and cooled to white */}
      <pointLight ref={light} position={[0, 0.4, -2.4]} intensity={9} distance={14} color="#cfe2ff" />
      <Optional name="/models/sk.glb" fallback={<BuiltSK />}>
        <GLBObject />
      </Optional>
    </group>
  )
}
