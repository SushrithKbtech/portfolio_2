// Shared scroll/animation state. Written by Rig each frame, read by every module.
import * as THREE from 'three'

export const scroll = {
  tint: new THREE.Color('#ffffff'), // world colour, lerped toward the focused system
  p: 0,        // eased scroll progress 0..1
  target: 0,   // raw scroll progress from Lenis
  bloom: 0,    // 0 = garden collapsed into the DNA tail, 1 = fully detonated
  gardenY: 0,  // parallax offset for the garden
  fin: 0,      // 0 through the card gallery, 1 once you're down in the garden
  // The opening beats, each 0..1 and staggered: the sigil spins alone, the title materialises,
  // then the particles bloom in, then the spine drops in from above, then card 01 arrives.
  intro: 0,    // 0 = sigil only, 1 = world fully present
  spineIn: 0,  // the bone column entering from above
  // Act zero: the LED room, the name and the glass SK. 0 = the front door as you land on it,
  // 1 = fully handed over to the journey.
  heroOut: 0,
  // The jump: 0 = the hero sitting still, 1 = the wall and the monogram have flown past the lens
  // and you are out in open space with the streaks at full stretch.
  warp: 0,
  // How hard you are scrolling right now, 0..1, eased. The jump reads this: streaks stretch with
  // your input and collapse back to points the moment you stop.
  speed: 0,
  // The whiteout that covers the cut from act zero to the column. Read by a DOM overlay, not by
  // anything in the scene — it has to sit over the canvas, the nav and everything else.
  flash: 0,
  /* The closing act, in two beats that must NOT overlap:
       contact  the frame pixelates, tears and turns to black, block by block
       reveal   and only THEN does the handset appear, opening out of a seam of light
     Running them together made the phone fade up through the breaking image, which is a
     dissolve. Separated, the screen goes empty first and the thing appears in the empty — which
     is the trick. */
  contact: 0,
  reveal: 0,
  // a slower, longer ramp than `contact` — the apps land one by one across the whole close
  contactApps: 0,
  // Cursor in normalised device coords (-1..1). Written by Rig, read by the busts so they
  // can look at where you actually are rather than at a fixed point.
  mouse: new THREE.Vector2(0, 0),
}

// exposed for debugging in the console: window.__scroll.fin etc.
if (typeof window !== 'undefined') window.__scroll = scroll
