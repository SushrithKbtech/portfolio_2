import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { scroll } from './scrollState'
import Optional from './assetGuard.jsx'
import { proceduralSpine } from './procAssets'

/* A single FULL vertebral column, cervical down to the sacrum.
   Not a vertebra rubber-stamped: you descend the real thing, and by the end of
   the scroll you have arrived at its base. ?spine=curved swaps the mesh. */

// Size the column by its CROSS-SECTION, never its length. Scaling the longest axis to a
// fixed height made a spine as wide as the cards. A real spine is thin and long, so we set
// the thickness and let the length fall out of it.
// 5.4 -> 7.2: the real vertebra mesh is the centrepiece of the handover now, and the camera dives
// at it. At the old width it was a prop in the distance rather than something you pass through.
const SPINE_W = 7.2

/* The column proper. It takes its geometry as a prop so the same animation drives either the
   real mesh or the procedural stand-in below. */
function Column({ geometry, height, map }) {
  const ref = useRef()

  /* Two surfaces, chosen by whether the GLB brought its own texture.
     Untextured: abalone / dichroic — a dark base whose colour is almost all iridescence and rim
     light, so it sits inside the palette instead of glaring out of it.
     Textured: the model's own baked bone, lit brighter and with the iridescence pulled most of
     the way back, so the detail that was generated with it actually survives to the screen. */
  const material = useMemo(() => new THREE.MeshPhysicalMaterial({
    map: map ?? null,
    color: map ? '#c6cfd8' : '#131a20',
    roughness: map ? 0.42 : 0.22,
    metalness: map ? 0.22 : 0.55,
    clearcoat: 1, clearcoatRoughness: map ? 0.3 : 0.14,
    iridescence: map ? 0.4 : 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [180, 760],
    envMapIntensity: map ? 1.5 : 2.4, sheen: 0.6, sheenColor: new THREE.Color('#7fffd0'),
    transparent: true, opacity: 1,
  }), [map])

  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    // start at the cervical end, arrive at the sacrum as the scroll completes
    const travel = Math.max(0, height - 13)
    // ...and in act three it retreats to the apex of the V and drives its sacrum down THROUGH the
    // ground plane, which is opaque — so the column simply disappears into the earth behind the
    // main bust instead of stopping dead on the surface.
    // The column ENTERS from above rather than being there from frame one: at spineIn 0 it sits
    // a full height up, out of frame, so the opening is just the sigil on black.
    const entry = (1 - scroll.spineIn) * (height * 0.85)
    m.position.y = -travel / 2 + scroll.p * travel - scroll.fin * 1.6 + entry
    m.position.z = -scroll.fin * 19    // retreats as the garden takes over
    // THE COLUMN LEAVES WITH THE WORK. It belongs to the project act; once the last panel has gone
    // past it fades out over the first half of the garden's arrival rather than standing in the
    // planting as a leftover.
    const out = THREE.MathUtils.smoothstep(scroll.fin, 0.0, 0.5)
    m.visible = scroll.spineIn > 0.002 && out < 0.995
    // SCROLL DRIVES THE SPIN. On a clock alone the column turned whether or not you were doing
    // anything; tied to progress it reads as you walking around it — roughly two and a half turns
    // across the whole journey, with a slow idle drift underneath so it never sits dead still.
    m.rotation.y = scroll.p * Math.PI * 5 + clock.elapsedTime * 0.02
    m.rotation.z = Math.sin(clock.elapsedTime * 0.13) * 0.02
    // all the way to zero, not the old 12% ghost
    material.opacity = 1 - out
  })

  return <mesh ref={ref} geometry={geometry} material={material} frustumCulled={false} />
}

function GLBColumn() {
  const which = typeof location !== 'undefined' && location.search.includes('spine=curved')
    ? '/models/spine_curved.glb' : '/models/spine_straight.glb'
  const { scene } = useGLTF(which)

  const { geometry, height, map } = useMemo(() => {
    let g = null, map = null
    // ...and take its baked texture with it, if the generation came with one
    scene.traverse(o => {
      if (!g && o.isMesh) {
        g = o.geometry.clone()
        const m = Array.isArray(o.material) ? o.material[0] : o.material
        if (m?.map) { map = m.map; map.colorSpace = THREE.SRGBColorSpace }
      }
    })
    if (!g) return { geometry: new THREE.CylinderGeometry(0.4, 0.4, 20, 12), height: 20, map: null }

    const size = new THREE.Vector3(), c = new THREE.Vector3()
    g.computeBoundingBox(); g.boundingBox.getSize(size); g.boundingBox.getCenter(c)
    g.translate(-c.x, -c.y, -c.z)

    // image_to_3d gives arbitrary orientation: stand the longest axis up along Y
    if (size.x >= size.y && size.x >= size.z) g.rotateZ(Math.PI / 2)
    else if (size.z > size.y && size.z > size.x) g.rotateX(-Math.PI / 2)

    g.computeBoundingBox(); g.boundingBox.getSize(size)
    const k = SPINE_W / Math.max(size.x, size.z)
    g.scale(k, k, k)
    g.computeVertexNormals()
    return { geometry: g, height: size.y * k, map }
  }, [scene])

  return <Column geometry={geometry} height={height} map={map} />
}

// No GLB on disk: a stacked column of centra, discs and lateral processes stands in for it.
function ProcColumn() {
  const { geometry, height } = useMemo(() => proceduralSpine(SPINE_W), [])
  return <Column geometry={geometry} height={height} />
}

export default function BoneSpine() {
  return (
    <Optional name="/models/spine_straight.glb" fallback={<ProcColumn />}>
      <GLBColumn />
    </Optional>
  )
}

useGLTF.preload('/models/spine_straight.glb')
