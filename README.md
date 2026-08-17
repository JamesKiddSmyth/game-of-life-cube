# Game of Life on a Cube

Conway's Game of Life running across all six faces of a rotatable 3D cube.
Cells wrap seamlessly across every edge — and every corner, where three
faces meet — so gliders and guns cross face boundaries without
interruption. Pure JavaScript + [Three.js](https://threejs.org/), no
build step: open `index.html` in a browser.

## Features

- Adjustable grid resolution: 20–200 cells per face edge (2,400 to
  240,000 total cells)
- Two independent rotation axes (X/Y sliders), plus free drag-to-rotate
  with mouse or touch, plus auto-rotate
- Step / Run / Stop / Clear / Randomize, with an adjustable speed
- Click any cell to toggle it on or off
- A library of famous patterns you can stamp onto any face: Glider,
  Blinker, Toad, Beacon, Pulsar, Pentadecathlon, Gosper Glider Gun,
  R-pentomino, Block, Beehive

## Running it

Just open `index.html` — no server or build step required. (A
self-contained version with Three.js inlined is also published as a
[Claude Artifact](https://claude.ai/code/artifact/9a67feff-f0f8-496d-9a83-770853e81910),
built that way because Artifacts run under a CSP that blocks CDN
scripts entirely.)

## Dependencies

- **[Three.js](https://threejs.org/) r149** — the only external
  dependency, loaded from a CDN (`unpkg.com/three@0.149.0`) as a
  classic (non-module) script. Pinned to r149 deliberately: it's the
  last release that ships a global/UMD build (`build/three.js`)
  alongside the ES module build, and it already has
  `InstancedMesh.setColorAt()` (added in r131), so the app can use
  plain `<script src>` tags everywhere instead of ES modules — which
  matters because ES module imports of local files are blocked by
  Chrome's CORS rules when a page is opened via `file://` (i.e. just
  double-clicking `index.html`).
- Everything else (`cube.js`, `shapes.js`, `app.js`) is hand-written,
  no other libraries.

## How it's built

- **`cube.js`** — the cube's topology: precomputes, once per grid
  resolution, the 8-neighbor lookup table for every cell on every
  face, plus the Life step function.
- **`shapes.js`** — the pattern library (ASCII-art and RLE decoders,
  and the patterns themselves).
- **`app.js`** — Three.js scene setup, the simulation loop, and all UI
  wiring.

### Wrapping neighbors around a cube

The interesting problem here isn't the Life rule itself, it's neighbor
lookup. A cell near the edge of a face has some of its 8 neighbors
living on a *different* face, correctly rotated into that face's
coordinate system — and a cell at one of the cube's 8 corners has a
diagonal neighbor that touches a *third* face. Hand-coding this as 12
edge-transition tables plus corner special-cases is exactly the kind
of thing that's easy to get subtly wrong.

Instead, each face carries an orthonormal (normal, u, v) basis, and
every cell maps to a point on the actual surface of a unit cube. To
find a neighbor, the code computes where that point *would* land
(which can step slightly off the current face, or even off two axes
at once at a corner), then re-projects it onto the real cube surface:
whichever axis has the largest magnitude picks the new face, and the
other two (clamped back into `[-1, 1]`) give the new local
coordinates. Edges and corners fall out of the same formula — no
special-casing needed.

### Performance tricks

At the top end of the grid slider (N=200) the cube has 240,000 cells,
each with 8 neighbors — 1.92 million neighbor lookups per generation,
6 faces to render, and potentially tens of thousands of cells changing
state every step. A few choices keep that smooth:

- **Precompute the adjacency table once, not every step.** The 3D
  projection math above runs once per grid-size change (`buildAdjacency`),
  producing a flat `Int32Array` of neighbor indices. Simulating a
  generation is then just array lookups and addition — no vector math
  in the hot loop.
- **Typed arrays throughout.** Cell state is a `Uint8Array` (1 byte/cell
  instead of a JS array of booleans/numbers), and the neighbor table is
  an `Int32Array`. Both are contiguous and cache-friendly, and avoid
  per-cell object allocation / GC pressure.
- **One draw call per face, regardless of resolution.** Cells aren't
  individual Three.js `Mesh` objects (240,000 of those would be
  unworkable) — each face is a single `THREE.InstancedMesh` with
  N×N instances, so the whole cube renders in 6 draw calls whether
  N is 20 or 200. Per-cell color lives in the instance's GPU-side
  `instanceColor` buffer.
- **Diffed repaint.** After each generation, only cells whose state
  actually flipped get their instance color rewritten
  (`next[idx] !== state[idx]`) — most generations only touch a small
  fraction of the board, so most of the 240,000 cells aren't touched
  at all on a typical step.

### Two bugs worth knowing about

- **All cells rendered solid black at first.** `MeshBasicMaterial({
  vertexColors: true })` combined with `InstancedMesh.setColorAt()`
  turns out to require *two* things multiplied together: the
  instance's `instanceColor` (correct) and a per-vertex `color`
  attribute on the geometry itself, which `PlaneGeometry` doesn't
  have. The unbound attribute reads back as `(0, 0, 0)` in WebGL,
  silently zeroing out every correctly-set instance color. Fixed by
  giving the shared geometry a dummy all-white `color` attribute so
  that multiplication is a no-op.
- **The Gosper Glider Gun was subtly wrong.** The first RLE string
  used for it came from a web-search summary and had been corrupted
  in transcription — it decoded to 47 live cells instead of the
  correct, well-documented 36. Every pattern in the library is now
  verified against its published cell count before shipping (see the
  count check in the commit history); the gun was re-sourced from a
  raw, unprocessed pattern file and confirmed to decode to exactly 36.

## Original prompt

This project was built by Claude Fable 5 (`claude-fable-5`) in Claude
Code, from this request, verbatim:

> In the GOLCube folder you will code up a app that runs Game of Life
> on a 6 faced cube. There should be options to control the number of
> squares (20 - 200) and at least two axis of rotation of the 3D
> display. Also buttons to "run one step" "run/stop" and features to
> click onesquare on/off as well as a handful of the most famous
> shapes (gliders, etc). I've had the best luck with this kind of
> thing in Javascript, but if you think a different language would be
> preferrably, consider that I am running a macbook.
