/* ONE PLACE THAT KNOWS WHAT IT'S RUNNING ON.

   FRAMING — a portrait phone sees a much narrower slice of the scene than a laptop, so the same
   camera distance crops the wordmark, the column and the project panels. `fitZ` converts the
   viewport's aspect into a multiplier for camera distance: at 16:9 it's 1 and nothing changes, and
   the narrower the frame the further back everything is shot.

   BUDGET — the particle counts. Decided ONCE at module load, because rebuilding a 100k-point
   buffer on a resize would cost more than it saves.

   There is no longer a heavy path and a light one. The site runs at what used to be the lite
   settings for everyone: no post-processing stack, pixel ratio pinned to 1, a third of the old
   particle counts. It renders at several times the frame rate and reads sharper — the bloom was
   softening the type and the wall's grid as much as it was glowing. */

export const isTouch = typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0)

export const isPhone = typeof window !== 'undefined' && window.innerWidth < 760
export const isTablet = typeof window !== 'undefined' && window.innerWidth >= 760 && window.innerWidth < 1100

// a third of the original counts, scaled down again on the small stuff
export const budget = (isPhone ? 0.4 : isTablet ? 0.65 : 1) * 0.33

/* Pixel ratio 1, everywhere. At 2 the GPU shades four times the pixels for a difference that was
   marginal even before the bloom pass came out; at 1 the whole scene stays comfortably above the
   refresh rate on hardware that was previously dropping frames. */
export const dpr = [1, 1]

const REFERENCE = 16 / 9

/* How much further back the camera has to sit for this aspect to hold the same subject.
   Vertical FOV is fixed, so a narrow frame loses WIDTH — the correction is the ratio of the
   reference aspect to this one, clamped so an extreme window doesn't send the camera to orbit. */
export function fitZ(aspect) {
  if (!aspect || !isFinite(aspect)) return 1
  return Math.min(2.15, Math.max(1, REFERENCE / aspect))
}
