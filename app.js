(function () {
  'use strict';

  // ---- Tunables -----------------------------------------------------
  const CUBE_HALF = 4;      // cube spans -4..4 on each axis
  const CELL_GAP = 0.85;    // fraction of the cell pitch that is drawn (rest = grid line)
  const ALIVE_COLOR = 0x39ffa0;
  const OFF_COLORS = [
    0x3d4f6b, // right  (+X) steel blue
    0x4d3f68, // left   (-X) muted purple
    0x2f6558, // top    (+Y) teal green
    0x6b4c33, // bottom (-Y) muted amber
    0x33436b, // front  (+Z) indigo
    0x6b3350  // back   (-Z) muted rose
  ];

  // ---- Three.js setup -------------------------------------------------
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0e14);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 18);

  const cubeGroup = new THREE.Group();
  scene.add(cubeGroup);

  const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(CUBE_HALF * 2, CUBE_HALF * 2, CUBE_HALF * 2));
  const edges = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0x4a5568 }));
  cubeGroup.add(edges);

  // ---- Simulation state -------------------------------------------------
  let N = 40;
  let total = 0;
  let state = null;       // Uint8Array, alive flags
  let neighbors = null;   // Int32Array, 8 per cell
  let generation = 0;
  let faceMeshes = [];
  const colorScratch = new THREE.Color();

  function idxOf(f, i, j) { return f * N * N + j * N + i; }

  function paintCell(f, i, j, alive) {
    const mesh = faceMeshes[f];
    const localIdx = j * N + i;
    colorScratch.set(alive ? ALIVE_COLOR : OFF_COLORS[f]);
    mesh.setColorAt(localIdx, colorScratch);
    mesh.instanceColor.needsUpdate = true;
  }

  function refreshAllColors() {
    for (let f = 0; f < 6; f++) {
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          paintCell(f, i, j, !!state[idxOf(f, i, j)]);
        }
      }
    }
  }

  function buildGrid(newN) {
    N = newN;
    total = 6 * N * N;
    state = new Uint8Array(total);
    neighbors = GOL.Cube.buildAdjacency(N);

    if (faceMeshes.length) {
      faceMeshes[0].geometry.dispose();
      faceMeshes[0].material.dispose();
      faceMeshes.forEach(m => cubeGroup.remove(m));
    }
    faceMeshes = [];

    const cellSize = (2 * CUBE_HALF / N) * CELL_GAP;
    const geo = new THREE.PlaneGeometry(1, 1);
    // MeshBasicMaterial's vertexColors path multiplies by the geometry's
    // own per-vertex 'color' attribute in addition to the InstancedMesh
    // instanceColor. PlaneGeometry has no such attribute, so the unbound
    // attribute reads as (0,0,0) and zeroes out every instance color.
    // Give it an all-white attribute so that multiplication is a no-op.
    const vertCount = geo.attributes.position.count;
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertCount * 3).fill(1), 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });

    for (let f = 0; f < 6; f++) {
      const face = GOL.Cube.FACES[f];
      const nrm = new THREE.Vector3(face.n[0], face.n[1], face.n[2]);
      const uAx = new THREE.Vector3(face.u[0], face.u[1], face.u[2]);
      const vAx = new THREE.Vector3(face.v[0], face.v[1], face.v[2]);
      const mesh = new THREE.InstancedMesh(geo, mat, N * N);
      mesh.userData.faceIndex = f;
      const m4 = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const color = new THREE.Color(OFF_COLORS[f]);

      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const s = ((i + 0.5) / N) * 2 - 1;
          const t = ((j + 0.5) / N) * 2 - 1;
          pos.set(0, 0, 0)
            .addScaledVector(nrm, CUBE_HALF)
            .addScaledVector(uAx, s * CUBE_HALF)
            .addScaledVector(vAx, t * CUBE_HALF);
          m4.makeBasis(
            uAx.clone().multiplyScalar(cellSize),
            vAx.clone().multiplyScalar(cellSize),
            nrm
          );
          m4.setPosition(pos);
          const instIdx = j * N + i;
          mesh.setMatrixAt(instIdx, m4);
          mesh.setColorAt(instIdx, color);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      cubeGroup.add(mesh);
      faceMeshes.push(mesh);
    }

    generation = 0;
    updateStats();
  }

  function toggleCell(f, i, j) {
    const idx = idxOf(f, i, j);
    state[idx] = state[idx] ? 0 : 1;
    paintCell(f, i, j, !!state[idx]);
    updateStats();
  }

  function stampShape(f, i, j, key) {
    const shape = GOL.Shapes.SHAPES[key];
    if (!shape) return;
    const offX = Math.floor(shape.w / 2);
    const offY = Math.floor(shape.h / 2);
    shape.cells.forEach(([dx, dy]) => {
      const ni = i - offX + dx;
      const nj = j - offY + dy;
      if (ni >= 0 && ni < N && nj >= 0 && nj < N) {
        const idx = idxOf(f, ni, nj);
        if (!state[idx]) {
          state[idx] = 1;
          paintCell(f, ni, nj, true);
        }
      }
    });
    updateStats();
  }

  function doStep() {
    const next = GOL.Cube.stepState(state, neighbors, total);
    const NN = N * N;
    for (let idx = 0; idx < total; idx++) {
      if (next[idx] !== state[idx]) {
        const f = Math.floor(idx / NN);
        const local = idx - f * NN;
        const j = Math.floor(local / N), i = local % N;
        paintCell(f, i, j, !!next[idx]);
      }
    }
    state = next;
    generation++;
    updateStats();
  }

  function clearBoard() {
    state.fill(0);
    refreshAllColors();
    generation = 0;
    updateStats();
  }

  function randomize(density) {
    for (let idx = 0; idx < total; idx++) state[idx] = Math.random() < density ? 1 : 0;
    refreshAllColors();
    generation = 0;
    updateStats();
  }

  function placeStarter() {
    const mid = Math.floor(N / 2);
    stampShape(4, mid, mid, 'glider');   // front
    stampShape(2, mid, mid, 'blinker');  // top
    stampShape(0, mid, mid, 'toad');     // right
  }

  // ---- UI wiring -------------------------------------------------
  const nSlider = document.getElementById('nSlider');
  const nLabel = document.getElementById('nLabel');
  const rotXSlider = document.getElementById('rotXSlider');
  const rotYSlider = document.getElementById('rotYSlider');
  const autoRotateChk = document.getElementById('autoRotateChk');
  const speedSlider = document.getElementById('speedSlider');
  const speedLabel = document.getElementById('speedLabel');
  const shapeSelect = document.getElementById('shapeSelect');
  const stepBtn = document.getElementById('stepBtn');
  const runBtn = document.getElementById('runBtn');
  const clearBtn = document.getElementById('clearBtn');
  const randomBtn = document.getElementById('randomBtn');
  const genLabel = document.getElementById('genLabel');
  const popLabel = document.getElementById('popLabel');

  GOL.Shapes.SHAPE_ORDER.forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = GOL.Shapes.SHAPE_LABELS[key];
    shapeSelect.appendChild(opt);
  });

  function updateStats() {
    let pop = 0;
    for (let k = 0; k < total; k++) pop += state[k];
    genLabel.textContent = 'Generation: ' + generation;
    popLabel.textContent = 'Alive: ' + pop + ' / ' + total;
  }

  nSlider.addEventListener('input', () => { nLabel.textContent = nSlider.value; });
  nSlider.addEventListener('change', () => {
    if (running) setRunning(false);
    buildGrid(parseInt(nSlider.value, 10));
    placeStarter();
  });

  let rotX = -0.5, rotY = 0.6;
  function normDeg(r) { return ((THREE.MathUtils.radToDeg(r) % 360) + 360) % 360; }
  function syncRotationSliders() {
    rotXSlider.value = normDeg(rotX);
    rotYSlider.value = normDeg(rotY);
  }
  rotXSlider.addEventListener('input', () => { rotX = THREE.MathUtils.degToRad(parseFloat(rotXSlider.value)); });
  rotYSlider.addEventListener('input', () => { rotY = THREE.MathUtils.degToRad(parseFloat(rotYSlider.value)); });

  let autoRotate = false;
  autoRotateChk.addEventListener('change', () => { autoRotate = autoRotateChk.checked; });

  let running = false, timer = null;
  function setRunning(v) {
    running = v;
    runBtn.textContent = running ? 'Stop' : 'Run';
    stepBtn.disabled = running;
    nSlider.disabled = running;
    if (timer) clearInterval(timer);
    if (running) timer = setInterval(doStep, 1000 / parseFloat(speedSlider.value));
  }
  runBtn.addEventListener('click', () => setRunning(!running));
  stepBtn.addEventListener('click', () => { if (!running) doStep(); });
  speedSlider.addEventListener('input', () => {
    speedLabel.textContent = speedSlider.value + ' gen/s';
    if (running) setRunning(true);
  });
  clearBtn.addEventListener('click', clearBoard);
  randomBtn.addEventListener('click', () => randomize(0.25));

  // ---- Mouse: drag to rotate, click (no drag) to paint -------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const mouseNdc = new THREE.Vector2();
  let dragging = false, dragMoved = false, lastX = 0, lastY = 0;
  const ROT_SPEED = 0.008;

  canvas.addEventListener('mousedown', e => {
    dragging = true; dragMoved = false; lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved = true;
    if (dragMoved) {
      rotY += dx * ROT_SPEED;
      rotX += dy * ROT_SPEED;
      syncRotationSliders();
    }
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', e => {
    if (dragging && !dragMoved) handleClick(e);
    dragging = false;
  });

  function handleClick(e) {
    const rect = canvas.getBoundingClientRect();
    mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNdc.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera(mouseNdc, camera);
    const hits = raycaster.intersectObjects(faceMeshes, false);
    if (!hits.length) return;
    const hit = hits[0];
    const f = hit.object.userData.faceIndex;
    const i = hit.instanceId % N;
    const j = Math.floor(hit.instanceId / N);
    const key = shapeSelect.value;
    if (key === 'single') toggleCell(f, i, j);
    else stampShape(f, i, j, key);
  }

  // Touch support (basic single-finger drag / tap)
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    dragging = true; dragMoved = false;
    lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
  }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    if (!dragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - lastX, dy = e.touches[0].clientY - lastY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved = true;
    if (dragMoved) {
      rotY += dx * ROT_SPEED;
      rotX += dy * ROT_SPEED;
      syncRotationSliders();
    }
    lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
  }, { passive: true });
  canvas.addEventListener('touchend', e => {
    if (dragging && !dragMoved && e.changedTouches.length === 1) {
      handleClick(e.changedTouches[0]);
    }
    dragging = false;
  });

  // ---- Resize + render loop -------------------------------------------------
  function onResize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);

  function animate() {
    requestAnimationFrame(animate);
    if (autoRotate) { rotY += 0.004; syncRotationSliders(); }
    cubeGroup.rotation.set(rotX, rotY, 0);
    renderer.render(scene, camera);
  }

  // ---- Boot -------------------------------------------------
  nLabel.textContent = nSlider.value;
  speedLabel.textContent = speedSlider.value + ' gen/s';
  syncRotationSliders();
  onResize();
  buildGrid(N);
  placeStarter();
  animate();
})();
