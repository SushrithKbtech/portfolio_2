# Sushrith Kandagatla — portfolio

A scroll-driven WebGL portfolio. One page, four beats: a glass **SK** monogram standing in a room
of LED panels, a whiteout that hands over to a vertebral column, seven projects spiralling past it
as panels, and a garden that dissolves to black for the contact card. A second page — `/about.html`
— opens on an OS login and lays out the CV over a live neural constellation.

Built with Vite + React 19 + React Three Fiber.

## Run it

```bash
npm install && npm run dev
```

- `/` — the journey (hero → projects → garden → contact)
- `/about.html` — about, skills, achievements, education, certifications

`npm run build` for a production bundle, `npm run preview` to serve it, `npm run lint` for oxlint.

## How it fits together

Everything animates off one shared object, [`src/scrollState.js`](src/scrollState.js). `Rig` in
[`helix.jsx`](src/helix.jsx) writes it once a frame from the Lenis scroll position; every other
module only reads it. Nothing talks to anything else.

| file | what it owns |
|---|---|
| `helix.jsx` | the scroll clock, the camera, the project panels, page chrome |
| `hero.jsx` | the glass SK monogram, the LED panel wall and its tickers, the focus chart |
| `boneSpine.jsx` | the vertebral column — the model, or a procedural stand-in |
| `garden.jsx` · `finale.jsx` · `blossoms.jsx` | the planting, the backdrop plate, the lawn |
| `contact.jsx` | the closing act: a 3D handset with the four ways to reach me |
| `about.jsx` · `osLogin.jsx` · `neural.jsx` | the about page, its login, its constellation |
| `intro.jsx` | the opening rings, and the tilt that hands over to the hero |
| `procAssets.js` · `assetGuard.jsx` | procedural stand-ins for any asset that isn't on disk |
| `systems.js` | the projects — edit this and the helix re-flows |

### Assets and the guard

`assetGuard.jsx` wraps every asset-consuming branch in its own error boundary, and `procAssets.js`
supplies a generated stand-in for each one. A missing GLB or texture costs you that single element,
never the canvas. Drop the real file in and it takes over on the next load. What ships here:

```
public/models/spine_straight.glb   the vertebral column
public/cards/0.png, 1.png          live-site screenshots for the first two projects
public/fonts/                      Montserrat + Syne, self-hosted for the wordmark
```

Anything else the code asks for — `sk.glb`, `blossom.glb`, `tex/vines.png`, the card films — is
optional and falls back to something generated at runtime.

### Knobs

- `?font=futura|avantgarde|montserrat|syne` — the wordmark typeface
- `?s=0.42` — pin the scroll to a fixed position, for screenshots
- `?boot=slow` — run the about-page login at a third speed
- `?intro=hold` — park the opening rings on their spin instead of dissolving

---

The 3D scaffolding started from the open-source Helix website template; the scenes, the monogram,
the panel wall, the contact act, the about page and everything on them are mine.
