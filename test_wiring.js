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
assert.strictEqual(scripts[0], 'i18n.js', 'the shared i18n.js must load before the app scripts');

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

// --- common settings sheet (instant apply, no OK / Cancel dialog) -------------
for (const id of ['settings-btn', 'fullscreen-btn', 'settings-panel', 'sheet-backdrop', 'settings-close',
  'lang-select', 'qrBtn', 'qrOverlay', 'changelogBtn', 'changelogOverlay', 'otherAppsLink']) {
  assert.ok(ids.has(id), `index.html must define #${id} for the common settings UI`);
}
assert.ok(!ids.has('dlg-settings') && !ids.has('set-ok'), 'the old settings <dialog> must be gone');
assert.ok(html.indexOf('id="fullscreen-btn"') < html.indexOf('id="settings-btn"'), '⛶ sits left of ⚙');
for (const f of ['qr.svg', 'src-qr.svg']) {
  assert.ok(html.includes(`src="${f}"`) && fs.existsSync(path.join(__dirname, f)), `${f} must be published`);
}

// --- changelog matches the version -------------------------------------------
const version = appjs.match(/const APP_VERSION = '([^']+)'/);
const firstEntry = appjs.match(/const CHANGELOG = \[\s*\{ version: '([^']+)'/);
assert.ok(version && firstEntry && version[1] === firstEntry[1],
  `CHANGELOG must start with APP_VERSION (${version && version[1]} vs ${firstEntry && firstEntry[1]})`);

// --- STRINGS: both languages have every key the UI uses ----------------------
const stringsSrc = appjs.slice(appjs.indexOf('const STRINGS = {'), appjs.indexOf('\n};', appjs.indexOf('const STRINGS = {')));
const enAt = stringsSrc.indexOf('\n  en: {');
assert.ok(enAt > 0, 'STRINGS must have ja and en tables');
const keysOf = (src) => new Set(Array.from(src.matchAll(/'([\w.]+)': /g)).map((m) => m[1]));
const ja = keysOf(stringsSrc.slice(0, enAt));
const en = keysOf(stringsSrc.slice(enAt));
assert.deepStrictEqual([...ja].sort(), [...en].sort(), 'STRINGS.ja and STRINGS.en must have the same keys');
const usedKeys = new Set();
for (const m of html.matchAll(/data-i18n(?:-html|-title|-aria-label|-placeholder)?="([^"]+)"/g)) usedKeys.add(m[1]);
for (const m of appjs.matchAll(/\bt\('([\w.]+)'/g)) usedKeys.add(m[1]);
for (const m of appjs.matchAll(/setStatus\('([\w.]+)'/g)) usedKeys.add(m[1]);
for (const m of read('source.js').matchAll(/srcText\('([\w.]+)'/g)) usedKeys.add(m[1]);
for (const m of read('calib.js').matchAll(/warnings\.push\('([\w.]+)'\)/g)) usedKeys.add(m[1]);
for (const k of usedKeys) assert.ok(ja.has(k), `UI uses the string key "${k}", which STRINGS does not define`);
for (const k of ['c.settings', 'c.close', 'c.language', 'c.share', 'c.showQr', 'c.changelog',
  'c.showChangelog', 'c.otherApps', 'c.openPortal', 'c.fullscreen']) {
  assert.ok(ja.has(k), `common key ${k} missing`);
}

// --- stylesheet exists -------------------------------------------------------
const css = html.match(/<link rel="stylesheet" href="([^"]+)"/);
assert.ok(css && fs.existsSync(path.join(__dirname, css[1])), 'stylesheet missing');

console.log('test_wiring.js: OK');
