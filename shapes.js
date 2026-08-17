/*
 * A small library of famous Game of Life patterns, used for "stamping"
 * onto the cube. Each shape is stored as a list of [x, y] cell offsets
 * plus its bounding box (w, h); app.js centers the pattern on the
 * clicked cell.
 */
(function (global) {
  'use strict';

  function fromAscii(rows) {
    const cells = [];
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '#') cells.push([x, y]);
      }
    }
    const w = Math.max.apply(null, rows.map(r => r.length));
    return { cells, w, h: rows.length };
  }

  // Minimal RLE decoder (b = dead run, o = alive run, $ = end of row).
  function fromRLE(rle) {
    const cells = [];
    let x = 0, y = 0, maxX = 0, numStr = '';
    for (let idx = 0; idx < rle.length; idx++) {
      const c = rle[idx];
      if (c >= '0' && c <= '9') { numStr += c; continue; }
      const count = numStr ? parseInt(numStr, 10) : 1;
      numStr = '';
      if (c === 'b') {
        x += count;
      } else if (c === 'o') {
        for (let k = 0; k < count; k++) { cells.push([x, y]); x++; }
      } else if (c === '$') {
        maxX = Math.max(maxX, x);
        x = 0; y += count;
      } else if (c === '!') {
        break;
      }
    }
    maxX = Math.max(maxX, x);
    return { cells, w: maxX, h: y + 1 };
  }

  const SHAPES = {
    block: fromAscii(['##', '##']),
    beehive: fromAscii(['.##.', '#..#', '.##.']),
    blinker: fromAscii(['###']),
    toad: fromAscii(['.###', '###.']),
    beacon: fromAscii(['##..', '##..', '..##', '..##']),
    glider: fromAscii(['.#.', '..#', '###']),
    rpentomino: fromAscii(['.##', '##.', '.#.']),
    pulsar: fromAscii([
      '..###...###..',
      '.............',
      '#....#.#....#',
      '#....#.#....#',
      '#....#.#....#',
      '..###...###..',
      '.............',
      '..###...###..',
      '#....#.#....#',
      '#....#.#....#',
      '#....#.#....#',
      '.............',
      '..###...###..'
    ]),
    // Verified RLE data (cross-checked against raw pattern files; cell
    // counts confirmed against their well-known published values).
    pentadecathlon: fromRLE('2bo4bo$2ob4ob2o$2bo4bo'), // 12 cells
    gosperglidergun: fromRLE(
      '24bo$22bobo$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o' +
      '$2o8bo3bob2o4bobo$10bo5bo7bo$11bo3bo$12b2o'
    ) // 36 cells
  };

  const SHAPE_LABELS = {
    single: 'Single cell (click to toggle)',
    glider: 'Glider',
    blinker: 'Blinker (period 2)',
    toad: 'Toad (period 2)',
    beacon: 'Beacon (period 2)',
    pulsar: 'Pulsar (period 3)',
    pentadecathlon: 'Pentadecathlon (period 15)',
    gosperglidergun: 'Gosper Glider Gun',
    rpentomino: 'R-pentomino',
    block: 'Block (still life)',
    beehive: 'Beehive (still life)'
  };

  // Order controls the dropdown; 'single' is handled specially by app.js.
  const SHAPE_ORDER = [
    'single', 'glider', 'blinker', 'toad', 'beacon', 'pulsar',
    'pentadecathlon', 'gosperglidergun', 'rpentomino', 'block', 'beehive'
  ];

  global.GOL = global.GOL || {};
  global.GOL.Shapes = { SHAPES, SHAPE_LABELS, SHAPE_ORDER };
})(window);
