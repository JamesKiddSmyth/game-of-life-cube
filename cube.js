/*
 * Cube topology for Conway's Game of Life on a 6-faced cube.
 *
 * Each face is an N x N grid of cells addressed by local coordinates
 * (i, j) with i, j in [0, N-1]. Cells are given a single global index:
 *
 *   idx = face * N * N + j * N + i        (face in 0..5)
 *
 * Face order:  0 = +X (right)  1 = -X (left)
 *              2 = +Y (top)    3 = -Y (bottom)
 *              4 = +Z (front)  5 = -Z (back)
 *
 * The hard part of Life-on-a-cube is neighbor lookup: a cell near the
 * edge of a face has some of its 8 neighbors living on a *different*
 * face, correctly rotated into that face's coordinate system, and
 * cells at the 8 corners of the cube have neighbors that touch a
 * third face entirely.
 *
 * Rather than hand-coding the 12 edge transitions (and the 8 corner
 * special cases) we solve it once with 3D geometry: every cell maps
 * to a point on the surface of a unit cube via its face's (normal, u,
 * v) basis. To find a neighbor, we compute where that point *would*
 * land (which may briefly step off the current face, or even off two
 * faces at once at a corner), then re-project it onto the actual cube
 * surface: the axis with the largest magnitude picks the new face,
 * and the other two (clamped back into [-1, 1]) give the new local
 * coordinates. This handles edges and corners uniformly.
 */
(function (global) {
  'use strict';

  const FACES = [
    { name: 'right',  n: [1, 0, 0],  u: [0, 1, 0],  v: [0, 0, 1] },  // +X
    { name: 'left',   n: [-1, 0, 0], u: [0, 1, 0],  v: [0, 0, -1] }, // -X
    { name: 'top',    n: [0, 1, 0],  u: [0, 0, 1],  v: [1, 0, 0] },  // +Y
    { name: 'bottom', n: [0, -1, 0], u: [0, 0, 1],  v: [-1, 0, 0] }, // -Y
    { name: 'front',  n: [0, 0, 1],  u: [1, 0, 0],  v: [0, 1, 0] },  // +Z
    { name: 'back',   n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] }   // -Z
  ];

  function faceForAxis(axis, sign) {
    if (axis === 0) return sign > 0 ? 0 : 1;
    if (axis === 1) return sign > 0 ? 2 : 3;
    return sign > 0 ? 4 : 5;
  }

  const NEIGHBOR_OFFSETS = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],           [1, 0],
    [-1, 1],  [0, 1],  [1, 1]
  ];

  // Precompute the 8-neighbor global index for every cell on every face.
  function buildAdjacency(N) {
    const total = 6 * N * N;
    const neighbors = new Int32Array(total * 8);

    for (let f = 0; f < 6; f++) {
      const face = FACES[f];
      const n = face.n, u = face.u, v = face.v;

      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const idx = f * N * N + j * N + i;

          for (let k = 0; k < 8; k++) {
            const du = NEIGHBOR_OFFSETS[k][0];
            const dv = NEIGHBOR_OFFSETS[k][1];

            const s = ((i + 0.5) / N) * 2 - 1 + du * (2 / N);
            const t = ((j + 0.5) / N) * 2 - 1 + dv * (2 / N);

            const px = n[0] + s * u[0] + t * v[0];
            const py = n[1] + s * u[1] + t * v[1];
            const pz = n[2] + s * u[2] + t * v[2];

            const ax = Math.abs(px), ay = Math.abs(py), az = Math.abs(pz);
            let axis, val;
            if (ax >= ay && ax >= az) { axis = 0; val = px; }
            else if (ay >= ax && ay >= az) { axis = 1; val = py; }
            else { axis = 2; val = pz; }

            const nf = faceForAxis(axis, val >= 0 ? 1 : -1);
            const nb = FACES[nf];

            let s2 = px * nb.u[0] + py * nb.u[1] + pz * nb.u[2];
            let t2 = px * nb.v[0] + py * nb.v[1] + pz * nb.v[2];
            if (s2 < -1) s2 = -1; else if (s2 > 1) s2 = 1;
            if (t2 < -1) t2 = -1; else if (t2 > 1) t2 = 1;

            let ni = Math.floor(((s2 + 1) / 2) * N);
            let nj = Math.floor(((t2 + 1) / 2) * N);
            if (ni < 0) ni = 0; else if (ni > N - 1) ni = N - 1;
            if (nj < 0) nj = 0; else if (nj > N - 1) nj = N - 1;

            neighbors[idx * 8 + k] = nf * N * N + nj * N + ni;
          }
        }
      }
    }
    return neighbors;
  }

  // Standard B3/S23 Life rule, applied via the precomputed adjacency table.
  function stepState(state, neighbors, total) {
    const next = new Uint8Array(total);
    for (let idx = 0; idx < total; idx++) {
      const base = idx * 8;
      let count = 0;
      for (let k = 0; k < 8; k++) count += state[neighbors[base + k]];
      const alive = state[idx];
      next[idx] = (alive ? (count === 2 || count === 3) : (count === 3)) ? 1 : 0;
    }
    return next;
  }

  global.GOL = global.GOL || {};
  global.GOL.Cube = { FACES, buildAdjacency, stepState };
})(window);
