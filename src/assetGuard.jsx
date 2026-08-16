import { Component, Suspense } from 'react'

/* MISSING-ASSET GUARD.
   This repo ships no binaries (see ASSETS.md), and drei's useGLTF THROWS on a 404. That error
   escapes <Canvas>, React unmounts the whole WebGL tree, and the page goes black — which is
   NOT what the README describes. One boundary per asset-consuming branch means a missing file
   costs you that one element and its procedural stand-in takes over, instead of the whole site.
   Drop the real assets in and the guard never fires. */

const shouted = new Set()

class Guard extends Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err) {
    // once per asset, not once per StrictMode double-render
    if (shouted.has(this.props.name)) return
    shouted.add(this.props.name)
    console.warn(`[assets] ${this.props.name} unavailable — drawing the procedural stand-in. ` +
      `Generate the real set per ASSETS.md. (${err?.message ?? err})`)
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export default function Optional({ name, fallback = null, children }) {
  return (
    <Guard name={name} fallback={fallback}>
      {/* its own boundary, so a slow asset never holds the acts in front of it black */}
      <Suspense fallback={null}>{children}</Suspense>
    </Guard>
  )
}
