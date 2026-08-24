// node test_wiring.js
// Static consistency check between index.html and the scripts: every element the
// app looks up must exist, every script tag must point at a real file, and every
// cross-file function app.js calls must be defined somewhere.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const html = read('index.html');
const appjs = read('app.js');

// --- script tags point at real files ----------------------------------------
const scripts = Array.from(html.matchAll(/<script src="([^"]+)"><\/script>/g)).map((m) => m[1]);
assert.ok(scripts.length >= 6, `expected the app scripts, got ${scripts.join(', ')}`);
for (const s of scripts) {
  assert.ok(fs.existsSync(path.join(__dirname, s)), `index.html references missing script ${s}`);
}
assert.strictEqual(scripts[scripts.length - 1], 'app.js', 'app.js must load last');

// --- every getElementById target exists --------------------------------------
const ids = new Set(Array.from(html.matchAll(/\sid="([^"]+)"/g)).map((m) => m[1]));
for (const m of appjs.matchAll(/getElementById\('([^']+)'\)/g)) {
  assert.ok(ids.has(m[1]), `app.js looks up #${m[1]}, which index.html does not define`);
}

// --- mode buttons ------------------------------------------------------------
const modes = Array.from(html.matchAll(/class="mode" data-mode="([^"]+)"/g)).map((m) => m[1]);
assert.deepStrictEqual(modes.sort(), ['add', 'calib', 'del']);

// --- cross-file functions are defined ----------------------------------------
const others = ['calib.js', 'points.js', 'matwriter.js', 'exporters.js', 'plot.js', 'source.js'];
const defined = new Set();
for (const f of others) {
  for (const m of read(f).matchAll(/^(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/gm)) defined.add(m[1]);
}
const used = [
  'computeTransform', 'pixelToReal', 'addPoint', 'deleteNearest', 'totalPoints',
  'encodeMatV5', 'buildCsv', 'buildMatVars', 'buildSessionJson', 'buildReadme',
  'drawCalibratedPlot', 'drawOverlay', 'drawMarkers', 'createVideoSource', 'createImageSource',
];
for (const name of used) {
  assert.ok(defined.has(name), `app.js calls ${name}(), which no loaded script defines`);
  assert.ok(appjs.includes(`${name}(`), `${name} listed as used but app.js never calls it`);
}

// --- no native modal dialogs -------------------------------------------------
// Chrome can suppress prompt()/alert()/confirm(); when it does, the page just dims and the
// user is stuck. The app must use its own <dialog> elements instead.
const stripped = appjs
  .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
  .replace(/(^|[^:])\/\/.*$/gm, '$1');  // line comments
for (const fn of ['prompt', 'alert', 'confirm']) {
  const re = new RegExp(`(^|[^.\\w])${fn}\\s*\\(`, 'm');
  assert.ok(!re.test(stripped), `app.js must not call the native ${fn}() — use an in-page <dialog>`);
}
assert.ok(/showConfirm\s*\(/.test(appjs) && /openDialog\s*\(/.test(appjs), 'in-page dialog helpers missing');

// --- the guide bar exists and is driven --------------------------------------
for (const id of ['guide', 'guide-step', 'guide-text', 'guide-sub']) {
  assert.ok(ids.has(id), `index.html must define #${id} for the next-step guidance`);
}
assert.ok(/function updateGuide\(/.test(appjs), 'app.js must compute the guide text');

// --- stylesheet exists -------------------------------------------------------
const css = html.match(/<link rel="stylesheet" href="([^"]+)"/);
assert.ok(css && fs.existsSync(path.join(__dirname, css[1])), 'stylesheet missing');

console.log('test_wiring.js: OK');
