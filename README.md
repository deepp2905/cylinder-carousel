# 3D Cylinder Carousel

An interactive 3D media carousel rendered in WebGL. Images and videos sit on the faces of a cylinder; the active face flattens into a 2D card while inactive faces curve around the back. Drag, click, autoplay, and keyboard navigation all snap to the nearest face.

## What it does

- **WebGL rendering** with three.js. A custom vertex shader curves each plane around a cylinder; a fragment shader handles object-fit-contain letterboxing and rounded-corner SDF clipping per face.
- **Image and video faces**: each carousel slot accepts either a static image or a looping `VideoTexture`, with aspect ratio detected from the source and letterboxed in-shader.
- **Animation** via framer-motion (`animate`): spring-physics rotation on snap, with custom cubic-bezier easing on the autoplay fill.
- **Autoplay** with a progress fill rendered inside the active pagination dot. The fill starts the instant the active dot begins widening (in parallel with the rotation spring) rather than after settle. Pauses during interaction; toggle button switches between play and pause icons.
- **Drag-to-rotate** on the canvas with snap-to-nearest face on release.
- **Keyboard nav**: ArrowLeft / ArrowRight.
- **Synth click** on arrow/keyboard navigation: a layered Web Audio click (filtered noise tick + tunable triangle-wave body).
- **Settings panel** (gear icon, bottom-left) with collapsible sub-sections — Geometry & Camera, Interface & Timing, Audio Synthesis, and Media — and live controls for camera distance, max height, padding, corner radius, autoplay timer, UI spacing (arrow inset, pill bottom margin), and audio synthesis parameters (pitch start/end, duration).
- **Content manager**: upload local images/videos (multi-select), thumbnail grid, per-item delete. Defaults restore when the list empties.

## Files

- `index.html` — markup, importmap (three, framer-motion via esm.sh).
- `styles.css` — glass UI, settings panel, pagination dots with progress fill.
- `carousel.js` — three.js scene, shaders, animation, autoplay, audio, and parameter wiring.

## Running locally

The project uses native ES modules and an importmap, so it must be served over HTTP — opening `index.html` directly with `file://` will not work.

Pick any one of these from the project directory:

```bash
# Python
python -m http.server 8000

# Node (npx)
npx serve

# VS Code
# Install "Live Server" extension, then right-click index.html → "Open with Live Server"
```

Then open `http://localhost:8000` (or whatever port the server reports).

No build step, no package install — dependencies (three, framer-motion) are loaded from CDNs via the importmap in `index.html`.

## Browser support

Requires WebGL2 and ES module imports. Tested in modern Chromium, Firefox, and Safari. Touch input is supported.
