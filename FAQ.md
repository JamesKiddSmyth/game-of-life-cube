# FAQ

### Was this code from training data, or did the assistant look things up online?

Mostly training data, but with a couple of specific spots where it
actually went out to the internet — worth being precise about which
was which.

**From training data, not looked up:**

- The Three.js usage (`InstancedMesh`, `Raycaster`, `Matrix4.makeBasis`,
  etc.) — general API knowledge from having seen a lot of Three.js
  code during training, written fresh for this app rather than
  adapted from a specific example.
- The cube-neighbor-topology math (the 3D basis-vector projection
  trick used to wrap neighbors across edges and corners — see the
  main [README](README.md#wrapping-neighbors-around-a-cube)) — derived
  during the build through reasoning about vector geometry, not
  retrieved from a "Game of Life on a cube" reference. That said,
  basis-vector projection onto cube faces is a fairly standard
  technique in graphics (cubemaps, voxel engines), so it's plausible
  something similar exists in material the model trained on even
  without a specific source being consciously recalled.
- The common, small Game of Life patterns (glider, blinker, toad,
  beacon, block, beehive, R-pentomino) — canonical and widely
  reproduced enough to recall directly with confidence.
- Diagnosing the black-cells rendering bug (see the main
  [README](README.md#two-bugs-worth-knowing-about)) — that was live
  empirical debugging in-browser (reading back actual pixel values
  and instance-buffer contents), not a lookup.

**Actually fetched from the internet:**

- The three larger, trickier patterns — Pulsar, Pentadecathlon, and
  the Gosper Glider Gun — were verified against real sources rather
  than trusted from memory, since they're easy to get subtly wrong
  and correctness was checkable. That caution paid off: the first
  pass at the Gosper Gun came from a web-search *summary*, which had
  silently corrupted the pattern (47 cells instead of the correct
  36). It was caught by checking the cell count programmatically,
  then fixed by re-fetching the raw, unprocessed RLE file directly
  from GitHub.

So: the architecture and rendering code is synthesized from general
knowledge, not copied from an existing project; the one place outside
verification was deliberately used was pattern *data*, where
correctness was checkable and memory alone wasn't reliable enough to
trust blindly.

### What model built this?

Claude Sonnet 5 (`claude-sonnet-5`), in Claude Code. See the
[README](README.md#original-prompt) for the original prompt this was
built from, verbatim.
