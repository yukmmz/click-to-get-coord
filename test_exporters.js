// node test_exporters.js
// Also writes scratch/test_coords.mat so that scratch/verify_mat.py can check it with SciPy.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { encodeMatV5 } = require('./matwriter.js');
const { buildCsv, buildMatVars, buildSessionJson, buildReadme } = require('./exporters.js');

/** @type {any} */
const dataset = {
  appVersion: '0.1.0',
  exportedAt: '2026-08-25T12:34:56+09:00',
  sourceKind: 'video',
  sourceName: 'sample.mp4',
  sourceFiles: ['sample.mp4'],
  width: 1920,
  height: 1080,
  fps: 30,
  fpsSource: 'detected',
  frameCount: 3,
  frameTimes: [0, 1 / 30, 2 / 30],
  transform: { p0: { x: 100, y: 400 }, r0: { x: 0, y: 0 }, scaleX: 0.05, scaleY: -0.05 },
  calibImg: [{ x: 100, y: 400 }, { x: 300, y: 200 }],
  calibReal: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
  framesRaw: [
    [{ x: 100, y: 400 }, { x: 200, y: 300 }],
    [],
    [{ x: 300, y: 200 }],
  ],
  framesReal: [
    [{ x: 0, y: 0 }, { x: 5, y: 5 }],
    [],
    [{ x: 10, y: 10 }],
  ],
};

// --- CSV ---------------------------------------------------------------------
const csv = buildCsv(dataset);
const lines = csv.trim().split('\n');
const dataLines = lines.filter((l) => !l.startsWith('#'));
assert.strictEqual(dataLines[0], 'frame_index,frame_number,time_sec,point_index,x_img,y_img,x_real,y_real');
assert.strictEqual(dataLines.length, 1 + 3, 'header + 3 points');
assert.strictEqual(dataLines[1], '0,1,0,0,100,400,0,0');
assert.strictEqual(dataLines[3].split(',')[0], '2', 'empty frame 1 emits no row');

// uncalibrated -> NaN in the real columns
const noCal = buildCsv(Object.assign({}, dataset, {
  transform: null,
  framesReal: [[{ x: NaN, y: NaN }, { x: NaN, y: NaN }], [], [{ x: NaN, y: NaN }]],
}));
assert.ok(noCal.includes(',NaN,NaN'), 'NaN written for uncalibrated points');

// --- session.json ------------------------------------------------------------
const session = JSON.parse(buildSessionJson(dataset));
assert.strictEqual(session.format, 'click-to-get-coord/session');
assert.strictEqual(session.framesRaw[0][1].x, 200);
assert.strictEqual(session.calibration.transform.scaleY, -0.05);

// --- README ------------------------------------------------------------------
const readme = buildReadme(dataset, ['coords.mat', 'coords.csv', 'session.json']);
for (const needle of ['coords_raw', 'coords_real', 'scale_x', 'loadmat', 'frame_index', 'NaN']) {
  assert.ok(readme.includes(needle), `README must document "${needle}"`);
}

// --- .mat --------------------------------------------------------------------
const bytes = encodeMatV5(buildMatVars(dataset));
assert.strictEqual(bytes.length % 8, 0, 'MAT elements must stay 8-byte aligned');
assert.strictEqual(bytes[126], 0x49);
assert.strictEqual(bytes[127], 0x4d);
assert.strictEqual(new DataView(bytes.buffer).getUint16(124, true), 0x0100);

const outDir = path.join(__dirname, 'scratch');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'test_coords.mat'), Buffer.from(bytes));

console.log('test_exporters.js: OK (wrote scratch/test_coords.mat)');
