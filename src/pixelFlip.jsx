import { forwardRef, useMemo } from 'react'
import { Effect } from 'postprocessing'
import { Uniform, Vector2 } from 'three'
import { scroll } from './scrollState'

/* PIXEL FLIP SHIFT — how the work ends and the black screen begins.
   The last project goes past and the frame does not fade out; it BREAKS UP. The image snaps
   down into a coarse grid of blocks, the rows tear sideways, the channels come apart, and the
   blocks turn to black one after another in a wave running top-left to bottom-right — and when
   the last one has turned, the phone is standing in the dark on the other side of it.

   It is a post pass, not an overlay, because the thing being pixelated is the RENDERED FRAME:
   the column, the cards and the planting all quantise together. An overlay can only ever draw
   on top of that picture; this is that picture, coming apart.

   Three moves, all keyed off one progress value:

     QUANTISE     uv snaps to a grid that coarsens to 0.5 and refines back out to 1.0. Mixed
                  rather than switched, so the blocks grow rather than appearing.
     SHIFT        a sine across the frame plus per-row jumps that re-roll several times a
                  second — the horizontal glitch, strongest exactly at the midpoint.
     FLIP         each block crosses from the frame to black on its own beat, ordered along the
                  diagonal and jittered per block so the front is ragged rather than a wipe.

   Plus a channel split that peaks with the shift and a spark of light as each block turns, so
   the wave has an edge you can see travelling.

   `inputBuffer`, `resolution` and `time` are declared by postprocessing's own effect shader —
   this file must NOT declare them again or the merged shader fails to compile. */

const fragment = /* glsl */`
uniform float uProgress;
uniform vec2 uGridSize;

float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

/* SQUARE BLOCKS ON ANY SCREEN. uGridSize.x is the number of columns and the rows fall out of the
   aspect ratio — a fixed pair would give tall thin blocks on a phone and wide flat ones on an
   ultrawide, and the whole effect depends on them reading as pixels. */
vec2 grid() {
  return vec2(uGridSize.x, max(2.0, floor(uGridSize.x * resolution.y / resolution.x)));
}

void mainUv(inout vec2 uv) {
  float p = uProgress;
  if (p <= 0.001 || p >= 0.999) return;

  // in to the grid and back out of it — 0 at both ends, 1 at the midpoint
  float q = 1.0 - abs(p * 2.0 - 1.0);
  q = q * q * (3.0 - 2.0 * q);

  // the grid coarsens from one cell per pixel down to uGridSize
  vec2 g = mix(resolution, grid(), q);
  vec2 cell = floor(uv * g);
  vec2 quv = (cell + 0.5) / g;

  // THE SHIFT. A slow wave across the whole frame, and on top of it whole rows jumping
  // sideways — but only some rows, re-rolled nine times a second, which is what reads as a
  // signal tearing rather than as a wobble.
  float slot = floor(time * 9.0);
  float pick = step(0.62, hash12(vec2(cell.y * 1.7, slot + 3.0)));
  float jump = (hash12(vec2(cell.y, slot)) - 0.5) * pick;
  quv.x += (sin(quv.y * 22.0 + time * 2.2) * 0.016 + jump * 0.075) * q * q;

  uv = mix(uv, quv, q);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float p = uProgress;
  if (p <= 0.001) { outputColor = inputColor; return; }

  vec2 g = grid();
  vec2 cell = floor(uv * g);

  // THE WAVE. 0 at the top-left block, 1 at the bottom-right, with a per-block offset so the
  // front of it is ragged. Every block gets the same 0.30-wide crossing, just at its own time.
  float diag = (cell.x / g.x + (1.0 - (cell.y + 0.5) / g.y)) * 0.5;
  float jit = hash12(cell + 11.0) * 0.22;
  float flip = smoothstep(0.0, 1.0, (p * 1.55 - 0.16 - diag * 0.62 - jit) / 0.30);

  // CHROMATIC SPLIT, peaking with the shift and gone by both ends
  float q = 1.0 - abs(p * 2.0 - 1.0);
  float ca = q * 0.0045;
  vec3 col = vec3(
    texture2D(inputBuffer, uv + vec2(ca, 0.0)).r,
    inputColor.g,
    texture2D(inputBuffer, uv - vec2(ca, 0.0)).b);

  // to black — and a spark of light on the way through, so you can see the front travelling
  float edge = flip * (1.0 - flip) * 4.0;
  col = mix(col, vec3(0.0), flip);
  col += vec3(0.52, 0.70, 1.0) * edge * 0.20 * (1.0 - p * 0.55);

  outputColor = vec4(col, inputColor.a);
}
`

class PixelFlipImpl extends Effect {
  constructor({ gridSize = new Vector2(34, 34) } = {}) {
    super('PixelFlipEffect', fragment, {
      uniforms: new Map([
        ['uProgress', new Uniform(0)],
        ['uGridSize', new Uniform(gridSize)],
      ]),
    })
  }

  /* Driven straight from the scroll rather than through React: this runs inside the composer's
     own update, one assignment a frame, no re-render anywhere. */
  update() {
    this.uniforms.get('uProgress').value = scroll.contact
  }
}

const PixelFlip = forwardRef(function PixelFlip({ gridSize }, ref) {
  const effect = useMemo(() => new PixelFlipImpl({
    gridSize: gridSize ? new Vector2(gridSize[0], gridSize[1]) : undefined,
  }), [gridSize])
  return <primitive ref={ref} object={effect} dispose={null} />
})

export default PixelFlip
