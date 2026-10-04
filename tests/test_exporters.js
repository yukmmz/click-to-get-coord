// node tests/test_exporters.js
// Also writes scratch/test_coords.mat so that scratch/verify_mat.py can check it with SciPy.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { encodeMatV5 } = require('../matwriter.js');
const { buildCsv, buildMatVars, buildSessionJson, buildReadme } = require('../exporters.js');

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
// it is Markdown: headings, tables and fenced code
assert.ok(readme.startsWith('# click-to-get-coord'), 'starts with an H1');
// the output must say where it came from, both the app and its source
assert.ok(readme.includes('https://yukmmz.github.io/click-to-get-coord/'), 'README links the app');
assert.ok(readme.includes('https://github.com/yukmmz/click-to-get-coord'), 'README links the source');
assert.ok(csv.includes('# app: https://yukmmz.github.io/click-to-get-coord/'), 'CSV header links the app');
assert.ok(csv.includes('# source: https://github.com/yukmmz/click-to-get-coord'), 'CSV header links the source');
assert.strictEqual(session.appUrl, 'https://yukmmz.github.io/click-to-get-coord/');
assert.strictEqual(session.sourceUrl, 'https://github.com/yukmmz/click-to-get-coord');
assert.ok(readme.includes('\n## 1. 入力データ'), 'has numbered sections');
assert.ok(readme.includes('|---|---|'), 'has tables');
assert.ok(readme.includes('```python'), 'has a fenced python example');
assert.ok(!readme.includes('===='), 'no plain-text underlines left over');
assert.ok(readme.includes('キャリブレーション点 2: 画像 (300, 200)'), 'README lists every calibration point');

// three calibration points: every one is listed and exported
{
  const d3 = Object.assign({}, dataset, {
    calibImg: [{ x: 100, y: 400 }, { x: 300, y: 401 }, { x: 99, y: 200 }],
    calibReal: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }],
  });
  const r3 = buildReadme(d3, ['coords.mat']);
  assert.ok(r3.includes('キャリブレーション点 3: 画像 (99, 200)'), 'README lists the third calibration point');
  const v3 = buildMatVars(d3);
  assert.strictEqual(v3.calib_img.rows, 3);
  assert.strictEqual(v3.calib_real.rows, 3);
}
// with no frame PNGs written, it says so instead of describing files that are absent
assert.ok(readme.includes('フレームごとの PNG'), 'explains the missing frame PNGs');
assert.ok(!readme.includes('### plot_frame_XXXX.png'), 'does not document absent plots');
// and describes them when they are there
const withPngs = buildReadme(dataset, ['coords.mat', 'plot_frame_0000.png', 'overlay_frame_0000.png']);
assert.ok(withPngs.includes('### plot_frame_XXXX.png') && withPngs.includes('### overlay_frame_XXXX.png'));
assert.ok(!withPngs.includes('### フレームごとの PNG について'));

// --- .mat --------------------------------------------------------------------
const bytes = encodeMatV5(buildMatVars(dataset));
assert.strictEqual(bytes.length % 8, 0, 'MAT elements must stay 8-byte aligned');
assert.strictEqual(bytes[126], 0x49);
assert.strictEqual(bytes[127], 0x4d);
assert.strictEqual(new DataView(bytes.buffer).getUint16(124, true), 0x0100);

const outDir = path.join(__dirname, '..', 'scratch');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'test_coords.mat'), Buffer.from(bytes));

console.log('test_exporters.js: OK (wrote scratch/test_coords.mat)');
