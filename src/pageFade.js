/* Page-to-page transitions without a router.
   This is a multi-page Vite site — clicking About is a real navigation, and a real navigation
   flashes white-to-black between documents. A veil that starts opaque, clears on load, and closes
   again before the browser leaves hides that seam entirely, so the two pages read as one place. */

const OUT_MS = 520

export function installPageFade() {
  if (typeof document === 'undefined' || document.querySelector('.pageveil')) return

  const veil = document.createElement('div')
  veil.className = 'pageveil'
  document.body.appendChild(veil)

  // two frames, not one: a single rAF can land in the same paint as the append, and the
  // transition never runs because the element was never opaque on screen
  requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.add('clear')))

  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const a = e.target.closest?.('a')
    if (!a) return
    const href = a.getAttribute('href') || ''
    // leave external links, mail, tel, downloads and in-page anchors alone
    if (!href || a.target === '_blank' || a.hasAttribute('download') ||
        /^(https?:|mailto:|tel:|#)/.test(href)) return
    e.preventDefault()
    veil.classList.remove('clear')
    setTimeout(() => { location.assign(href) }, OUT_MS)
    // If the navigation never happens — a blocked assign, an embedded viewer that pins its tab —
    // lift the veil again rather than leaving the visitor on a black screen forever.
    setTimeout(() => { veil.classList.add('clear') }, OUT_MS + 1200)
  })

  // coming back through history restores from bfcache with the veil still down
  window.addEventListener('pageshow', ev => { if (ev.persisted) veil.classList.add('clear') })
}
