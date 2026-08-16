/* ONE PLACE THAT KNOWS WHAT IT'S RUNNING ON.
   Two separate jobs, and they need separate answers:

   FRAMING — a portrait phone sees a much narrower slice of the scene than a laptop, so the same
   camera distance crops the wordmark, the column and the project panels. `fitZ` converts the
   viewport's aspect into a multiplier for camera distance: at 16:9 it's 1 and nothing changes, and
   the narrower the frame the further back everything is shot.

   BUDGET — a phone GPU should not be asked to draw a quarter of a million points. `budget` scales
   the particle counts, and it is decided ONCE at module load because rebuilding a 200k-point
   buffer on a resize would cost more than it saves. */

export const isTouch = typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0)

export const isPhone = typeof window !== 'undefined' && window.innerWidth < 760
export const isTablet = typeof window !== 'undefined' && window.innerWidth >= 760 && window.innerWidth < 1100

/* LITE MODE. Either asked for with ?lite=1, or assumed on a machine that has told us it is small:
   four cores or fewer, or 4GB of reported memory or less. It is sticky once chosen, because a
   visitor who switched to it should not have to switch again on the next page. */
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null
const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('lite') : null
const weak = typeof navigator !== 'undefined' &&
  ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4)

export const lite = params?.get('lite') === '1' || (params?.get('lite') !== '0' && (stored === '1' || weak))

export function setLite(on) {
  try { localStorage.setItem('lite', on ? '1' : '0') } catch { /* private mode: this session only */ }
  const url = new URL(location.href)
  url.searchParams.set('lite', on ? '1' : '0')
  location.href = url.toString()
}

// full budget on a desktop, ~40% on a phone, ~65% on a tablet — and a third of whatever that
// comes to if we're running lite
export const budget = (isPhone ? 0.4 : isTablet ? 0.65 : 1) * (lite ? 0.33 : 1)

// cap the pixel ratio harder on the small stuff — a 3x phone screen is the most expensive canvas
// in the room and the least able to pay for it
export const dpr = lite ? [1, 1] : isPhone ? [1, 1.6] : isTablet ? [1, 1.8] : [1, 2]

const REFERENCE = 16 / 9

/* How much further back the camera has to sit for this aspect to hold the same subject.
   Vertical FOV is fixed, so a narrow frame loses WIDTH — the correction is the ratio of the
   reference aspect to this one, clamped so an extreme window doesn't send the camera to orbit. */
export function fitZ(aspect) {
  if (!aspect || !isFinite(aspect)) return 1
  return Math.min(2.15, Math.max(1, REFERENCE / aspect))
}
