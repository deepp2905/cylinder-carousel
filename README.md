# 3D Cylinder Carousel

An interactive 3D media carousel rendered in WebGL. Images and videos sit on the faces of a cylinder; the active face flattens into a 2D card while inactive faces curve around the back. Drag, click, autoplay, and keyboard navigation all snap to the nearest face.



https://github.com/user-attachments/assets/ee683b6e-11db-4132-acc5-17e66d1b0010





## What it does

- **WebGL rendering** with three.js. A custom vertex shader curves each plane around a cylinder; a fragment shader handles object-fit-contain letterboxing and rounded-corner SDF clipping per face.
- **Image and video faces**: each carousel slot accepts either a static image or a looping `VideoTexture`, with aspect ratio detected from the source and letterboxed in-shader.
- **Animation** via framer-motion (`animate`): spring-physics rotation on snap, with custom cubic-bezier easing on the autoplay fill.
- **Autoplay** with a progress fill rendered inside the active pagination dot. The fill starts the instant the active dot begins widening (in parallel with the rotation spring) rather than after settle. Pauses during interaction; toggle button switches between play and pause icons.
- **Drag-to-rotate** on the canvas with snap-to-nearest face on release.
- **Keyboard nav**: ArrowLeft / ArrowRight.
- **Synth click** on arrow/keyboard navigation: a layered Web Audio click (filtered noise tick + tunable triangle-wave body).
- **DialKit control panel** (floating, bottom-right) with grouped folders — Geometry, Timing, and Audio — driving camera distance, max height, padding, corner radius, autoplay timer, UI spacing (arrow inset, pill bottom margin), and audio synthesis parameters (pitch start/end, duration). Sliders support click-to-snap, drag with rubber-band, and direct text editing.
- **Media panel** (image icon, bottom-left): upload local images/videos (multi-select), thumbnail grid, per-item delete. Defaults restore when the list empties.

## Files

- `index.html` — markup, Vite entry.
- `src/main.jsx` — React entry; mounts `DialRoot` and the bridge component, then loads the carousel module.
- `src/controls.jsx` — `useDialKit` config; pushes values into the carousel via exported setters.
- `src/carousel.js` — three.js scene, shaders, animation, autoplay, audio, media uploader; exports `setters`/`defaults` for the dial panel.
- `src/styles.css` — glass UI, media panel, pagination dots with progress fill.

## Running locally

```bash
npm install
npm run dev
```

Vite opens `http://localhost:5173/` automatically.

To produce a static build:

```bash
npm run build
npm run preview
```

## Browser support

Requires WebGL2 and ES module imports. Tested in modern Chromium, Firefox, and Safari. Touch input is supported.
