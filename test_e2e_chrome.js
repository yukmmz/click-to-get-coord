// node test_e2e_chrome.js
//
// End-to-end test driven through the Chrome DevTools Protocol against the locally
// installed Chrome. Node only, no npm packages and no other runtime: it serves the
// folder with node's own http module, launches headless Chrome, and talks CDP over
// node's built-in WebSocket.
//
// Covers both input kinds:
//   1. still images  — loading, calibration, add/delete, exporters, PNG rendering
//   2. video         — a clip recorded in-page with MediaRecorder, so fps detection,
//                      duration resolution and frame seeking are exercised for real
//
// Writes scratch/e2e_*.png (screenshot and the rendered plot/overlay) for eyeballing.
//
//   node test_e2e_chrome.js          serve over http://127.0.0.1 (how GitHub Pages will serve it)
//   node test_e2e_chrome.js --file   open index.html directly as file://, no server at all

'use strict';
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HTTP_PORT = 8765;
const CDP_PORT = 9333;
const USE_FILE_URL = process.argv.includes('--file');
const PAGE_URL = USE_FILE_URL
  ? `file://${path.join(ROOT, 'index.html')}`
  : `http://127.0.0.1:${HTTP_PORT}/index.html`;
const OUT_DIR = path.join(ROOT, 'scratch');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Helpers injected into the page before each test body.
const PRELUDE = `
  const out = { checks: [], pngs: {} };
  const check = (name, cond, detail) => out.checks.push({ name, ok: !!cond, detail: detail === undefined ? null : detail });
  // image coordinates -> client coordinates, through the current zoom/pan transform
  const clickAt = (ix, iy) => {
    const r = els.canvas.getBoundingClientRect();
    els.canvas.dispatchEvent(new MouseEvent('click', {
      clientX: r.left + state.view.tx + ix * state.view.scale,
      clientY: r.top + state.view.ty + iy * state.view.scale,
      bubbles: true,
    }));
  };
  const wheel = (init) => els.stage.dispatchEvent(new WheelEvent('wheel',
    Object.assign({ bubbles: true, cancelable: true }, init)));
  const key = (k) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  const waitFor = async (fn, ms = 2000) => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      if (fn()) return true;
      await new Promise((r) => setTimeout(r, 20));
    }
    return false;
  };
  // the app uses in-page <dialog> elements, never native prompt()/confirm()
  const fillCalib = async (x, y) => {
    if (!await waitFor(() => els.dlgCalib.open)) throw new Error('calibration dialog did not open');
    if (!els.guideText.textContent.includes('入力してください')) {
      throw new Error('guide bar should ask for the coordinates while the dialog is open, got: ' + els.guideText.textContent);
    }
    const beforePending = state.pendingCalib.real.length;
    const beforeTransform = state.transform;
    els.calibX.value = String(x);
    els.calibY.value = String(y);
    els.dlgCalib.querySelector('button.primary').click();
    if (!await waitFor(() => !els.dlgCalib.open)) throw new Error('calibration dialog did not close');
    // the click handler resumes a tick later; the point is either added to the pending
    // calibration (first point) or commits a new transform (second point)
    const recorded = await waitFor(() => state.awaitingCalibInput === 0
      && (state.pendingCalib.real.length > beforePending || state.transform !== beforeTransform));
    if (!recorded) throw new Error('calibration value was not recorded');
  };
  const calibrate = async (ax, ay, ra, bx, by, rb) => {
    clickAt(ax, ay); await fillCalib(ra[0], ra[1]);
    clickAt(bx, by); await fillCalib(rb[0], rb[1]);
  };
  const toB64 = async (blob) => {
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return btoa(bin);
  };
`;

const IMAGE_TEST = `(async () => {
${PRELUDE}
  const makeImage = async (name, w, h, color) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff'; g.lineWidth = 3;
    for (let x = 0; x <= w; x += 100) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 100) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return new File([blob], name, { type: 'image/png' });
  };

  check('guide bar starts at step 1 before anything is loaded',
    els.guideStep.textContent === 'STEP 1', els.guideStep.textContent);

  // deliberately out of order, to check the natural-order sort
  await loadFiles([await makeImage('img_002.png', 800, 600, '#335577'), await makeImage('img_001.png', 800, 600, '#553355')]);
  check('source loaded', state.source !== null);
  check('frameCount == 2', state.source.frameCount === 2, state.source.frameCount);
  check('files sorted naturally', state.source.files.join(',') === 'img_001.png,img_002.png', state.source.files.join(','));
  check('frame is 800x600', state.currentFrame.width === 800 && state.currentFrame.height === 600,
    state.currentFrame.width + 'x' + state.currentFrame.height);
  check('view starts fitted to the frame', Math.abs(state.view.scale - fitScale()) < 1e-9, state.view.scale);
  check('default marker diameter is 4', state.settings.diameter === 4, state.settings.diameter);
  check('starts in calibration mode', state.mode === 'calib', state.mode);
  check('fps control hidden for images', els.fpsGroup.hidden && els.fpsGroup.getBoundingClientRect().width === 0);
  check('guide bar shows the calibration step', els.guideStep.textContent === 'STEP 2' && els.guideText.textContent.includes('1点目'),
    els.guideStep.textContent + ' / ' + els.guideText.textContent);

  // cancelling the coordinate entry must not leave a stray calibration point behind
  clickAt(300, 300);
  if (!await waitFor(() => els.dlgCalib.open)) throw new Error('calibration dialog did not open');
  els.calibCancel.click();
  await waitFor(() => !els.dlgCalib.open);
  await waitFor(() => state.pendingCalib.img.length === 0);
  check('cancelled calibration point is discarded', state.pendingCalib.img.length === 0,
    state.pendingCalib.img.length);

  // calibration: (100,500)->(0,0) and (700,100)->(12,9)
  await calibrate(100, 500, [0, 0], 700, 100, [12, 9]);
  check('two calibration pairs recorded', state.calibImg.length === 2 && state.calibReal.length === 2,
    'img=' + state.calibImg.length + ' real=' + state.calibReal.length + ' mode=' + state.mode);
  check('transform built', state.transform !== null);
  if (!state.transform) return JSON.stringify(out);
  check('guide bar moved on to adding points', els.guideStep.textContent === 'STEP 3', els.guideStep.textContent);
  // MouseEventInit.clientX is a long, so a synthesized click lands within ~1 display px
  // of the intended spot; verify against the pixels the app actually recorded.
  const ci = state.calibImg;
  check('calibration clicks landed near the intended pixels',
    Math.abs(ci[0].x - 100) < 2 && Math.abs(ci[0].y - 500) < 2 && Math.abs(ci[1].x - 700) < 2 && Math.abs(ci[1].y - 100) < 2,
    JSON.stringify(ci));
  check('scaleX matches the recorded pixels', Math.abs(state.transform.scaleX - 12 / (ci[1].x - ci[0].x)) < 1e-12, state.transform.scaleX);
  check('scaleY matches the recorded pixels', Math.abs(state.transform.scaleY - 9 / (ci[1].y - ci[0].y)) < 1e-12, state.transform.scaleY);
  check('scaleY negative (real Y up vs image Y down)', state.transform.scaleY < 0, state.transform.scaleY);
  check('auto-switched to add mode', state.mode === 'add', state.mode);

  clickAt(400, 300);
  clickAt(500, 200);
  check('2 points on frame 0', state.framesRaw[0].length === 2, state.framesRaw[0].length);
  const p0 = state.framesRaw[0][0];
  const r0 = pixelToReal(state.transform, p0.x, p0.y);
  check('real coords of the ~(400,300) click are ~(6, 4.5)',
    Math.abs(r0.x - 6) < 0.05 && Math.abs(r0.y - 4.5) < 0.05, r0.x + ',' + r0.y);

  await step(1);
  check('moved to frame 1', state.frameIndex === 1, state.frameIndex);
  clickAt(200, 400);
  check('frame 1 keeps its own list', state.framesRaw[1].length === 1, state.framesRaw[1].length);
  check('frame 0 untouched', state.framesRaw[0].length === 2, state.framesRaw[0].length);

  enterDelMode();
  check('guide bar explains delete mode', els.guideStep.textContent === 'DELETE', els.guideStep.textContent);
  clickAt(210, 405);
  check('nearest point deleted', state.framesRaw[1].length === 0, state.framesRaw[1].length);
  enterAddMode();

  // --- re-calibrating mid-session keeps the points and the old calibration ---
  await step(-1);
  clickAt(600, 150);
  const beforeRecal = {
    points: state.framesRaw[0].length,
    scaleX: state.transform.scaleX,
    real0: pixelToReal(state.transform, state.framesRaw[0][0].x, state.framesRaw[0][0].y),
  };
  enterCalibMode();
  check('re-calibration keeps the recorded points', state.framesRaw[0].length === beforeRecal.points,
    state.framesRaw[0].length);
  check('the old calibration stays in force until a new one is confirmed',
    state.transform !== null && state.transform.scaleX === beforeRecal.scaleX, String(state.transform && state.transform.scaleX));

  // abandoning it half way must not destroy the calibration
  clickAt(100, 500); await fillCalib(0, 0);
  check('one pending point does not replace the calibration',
    state.transform.scaleX === beforeRecal.scaleX && state.pendingCalib.img.length === 1,
    state.transform.scaleX + ' pending=' + state.pendingCalib.img.length);
  enterAddMode();
  check('leaving calibration mode drops the pending point',
    state.pendingCalib.img.length === 0 && state.transform.scaleX === beforeRecal.scaleX,
    'pending=' + state.pendingCalib.img.length);
  check('and the recorded points are still there', state.framesRaw[0].length === beforeRecal.points,
    state.framesRaw[0].length);

  // now complete a different calibration: same pixels, doubled real coordinates
  enterCalibMode();
  await calibrate(100, 500, [0, 0], 700, 100, [24, 18]);
  check('the new calibration replaces the old one',
    Math.abs(state.transform.scaleX - 2 * beforeRecal.scaleX) < 1e-9,
    beforeRecal.scaleX + ' -> ' + state.transform.scaleX);
  check('no point was lost by re-calibrating', state.framesRaw[0].length === beforeRecal.points,
    state.framesRaw[0].length);
  const real0After = pixelToReal(state.transform, state.framesRaw[0][0].x, state.framesRaw[0][0].y);
  check('existing points are recomputed with the new transform',
    Math.abs(real0After.x - 2 * beforeRecal.real0.x) < 1e-9
    && Math.abs(real0After.y - 2 * beforeRecal.real0.y) < 1e-9,
    beforeRecal.real0.x + ',' + beforeRecal.real0.y + ' -> ' + real0After.x + ',' + real0After.y);
  check('the export uses the recomputed values',
    Math.abs(buildDataset().framesReal[0][0].x - real0After.x) < 1e-12);
  check('back in add mode after re-calibrating', state.mode === 'add', state.mode);

  // restore the original calibration for the checks that follow
  enterCalibMode();
  await calibrate(100, 500, [0, 0], 700, 100, [12, 9]);
  state.framesRaw[0] = state.framesRaw[0].slice(0, beforeRecal.points - 1);

  // --- marker size: toolbar box and the [ ] keys ---
  key('[');
  check('[ shrinks the marker', state.settings.diameter === 3, state.settings.diameter);
  key(']'); key(']');
  check('] grows the marker', state.settings.diameter === 5, state.settings.diameter);
  check('toolbar box follows the shortcut', els.markerSize.value === '5', els.markerSize.value);
  setDiameter(4);

  // --- Enter must confirm, not cancel ---
  const calibForm = els.dlgCalib.querySelector('form');
  const submitters = Array.from(calibForm.querySelectorAll('button')).filter((b) => b.type === 'submit');
  check('the only submit button in the calibration form is OK',
    submitters.length === 1 && submitters[0].value === 'ok',
    submitters.map((b) => b.type + ':' + b.value).join(','));
  check('cancel is not a submit button', els.calibCancel.type === 'button', els.calibCancel.type);

  // --- zoom keeps the point under the cursor fixed ---
  await step(-1);
  const rect0 = els.canvas.getBoundingClientRect();
  const cursor = { x: rect0.left + 300, y: rect0.top + 200 };
  const imgUnderCursorBefore = {
    x: (cursor.x - rect0.left - state.view.tx) / state.view.scale,
    y: (cursor.y - rect0.top - state.view.ty) / state.view.scale,
  };
  const scaleBefore = state.view.scale;
  wheel({ deltaY: -120, ctrlKey: true, clientX: cursor.x, clientY: cursor.y });
  check('pinch / ctrl+wheel zooms in', state.view.scale > scaleBefore * 1.1,
    scaleBefore + ' -> ' + state.view.scale);
  const imgUnderCursorAfter = {
    x: (cursor.x - rect0.left - state.view.tx) / state.view.scale,
    y: (cursor.y - rect0.top - state.view.ty) / state.view.scale,
  };
  check('the image point under the cursor stays put',
    Math.abs(imgUnderCursorAfter.x - imgUnderCursorBefore.x) < 0.01
    && Math.abs(imgUnderCursorAfter.y - imgUnderCursorBefore.y) < 0.01,
    JSON.stringify(imgUnderCursorAfter));

  // --- clicking is still accurate while zoomed in ---
  const zoomedCount = state.framesRaw[0].length;
  clickAt(120, 140);
  const added = state.framesRaw[0][zoomedCount];
  check('a click while zoomed lands on the right pixel',
    Math.abs(added.x - 120) < 1 && Math.abs(added.y - 140) < 1, added.x + ',' + added.y);
  state.framesRaw[0] = state.framesRaw[0].slice(0, zoomedCount);

  // --- two-finger scroll pans ---
  const tx0 = state.view.tx;
  const ty0 = state.view.ty;
  wheel({ deltaX: 40, deltaY: 25, clientX: cursor.x, clientY: cursor.y });
  check('two-finger scroll pans the view', state.view.tx < tx0 && state.view.ty < ty0,
    (state.view.tx - tx0) + ',' + (state.view.ty - ty0));

  // --- 0 restores the fitted view ---
  key('0');
  check('0 returns to the fitted view', Math.abs(state.view.scale - fitScale()) < 1e-9, state.view.scale);

  await step(-1);
  const ds = buildDataset();
  const mat = encodeMatV5(buildMatVars(ds));
  check('.mat encoded and 8-byte aligned', mat.length > 128 && mat.length % 8 === 0, mat.length);
  const rows = buildCsv(ds).trim().split('\\n').filter((l) => !l.startsWith('#'));
  check('csv has header + 2 rows', rows.length === 3, rows.length);
  const cols = rows[1].split(',');
  check('csv row has 8 columns', cols.length === 8, cols.length);
  check('csv carries the calibrated values',
    Math.abs(Number(cols[6]) - 6) < 0.05 && Math.abs(Number(cols[7]) - 4.5) < 0.05, cols.slice(6).join(','));
  const readme = buildReadme(ds, ['coords.mat']);
  check('readme states the scale values', readme.includes('scale_x = 0.02') && readme.includes('scale_y = -0.022'));
  check('readme has no leftover placeholder', !readme.includes('undefined') && !readme.includes('[object'));
  const session = JSON.parse(buildSessionJson(ds));
  check('session json round-trips the points', session.framesRaw[0].length === 2);
  check('session json has no image data (stays small)', JSON.stringify(session).length < 4000);

  const imgs = await renderFrameImages(0, ds);
  check('two PNGs rendered', imgs.length === 2, imgs.map((i) => i.name).join(','));
  check('plot png non-trivial', imgs[0].data.size > 3000, imgs[0].data.size);
  check('overlay png non-trivial', imgs[1].data.size > 3000, imgs[1].data.size);
  for (const img of imgs) out.pngs['e2e_' + img.name] = await toB64(img.data);

  // --- marker outline: on by default, switchable from the settings dialog ---
  check('marker edge is on by default', state.settings.markerEdge === true, state.settings.markerEdge);
  const overlayWithEdge = await toB64(imgs[1].data);
  openSettings();
  if (!await waitFor(() => els.settings.open)) throw new Error('settings dialog did not open');
  els.setMarkerEdge.checked = false;
  els.setOk.click();
  if (!await waitFor(() => !els.settings.open)) throw new Error('settings dialog did not close');
  check('settings dialog turns the edge off', state.settings.markerEdge === false, state.settings.markerEdge);
  const overlayNoEdge = await toB64((await renderFrameImages(0, ds))[1].data);
  check('the rendered overlay actually changes without the edge',
    overlayNoEdge !== overlayWithEdge, overlayWithEdge.length + ' vs ' + overlayNoEdge.length);
  openSettings();
  await waitFor(() => els.settings.open);
  els.setMarkerEdge.checked = true;
  els.setOk.click();
  await waitFor(() => !els.settings.open);
  check('and back on again', state.settings.markerEdge === true, state.settings.markerEdge);

  // --- point numbers take the point colour by default, and never white ---
  check('index colour follows the point colour by default',
    state.settings.indexColorAuto === true && indexColor() === state.settings.pointColor,
    indexColor() + ' / ' + state.settings.pointColor);
  check('the default index colour is not white', indexColor().toLowerCase() !== '#ffffff', indexColor());
  const plotDefaultIndex = await toB64((await renderFrameImages(0, ds))[0].data);
  openSettings();
  await waitFor(() => els.settings.open);
  els.setIndexAuto.checked = false;
  els.setIndexColor.value = '#00aa00';
  els.setOk.click();
  await waitFor(() => !els.settings.open);
  check('an explicit index colour overrides it', indexColor() === '#00aa00', indexColor());
  const plotCustomIndex = await toB64((await renderFrameImages(0, ds))[0].data);
  check('the plot actually uses the index colour', plotCustomIndex !== plotDefaultIndex,
    plotDefaultIndex.length + ' vs ' + plotCustomIndex.length);
  openSettings();
  await waitFor(() => els.settings.open);
  els.setIndexAuto.checked = true;
  els.setOk.click();
  await waitFor(() => !els.settings.open);

  // Calling the picker without a user gesture always fails; what matters is *why*.
  // "user gesture" => the API is usable here. "opaque origin"/"not allowed" => this
  // origin cannot save to a folder at all.
  let dirPickerError = 'n/a';
  if (typeof window.showDirectoryPicker === 'function') {
    try {
      await window.showDirectoryPicker({ mode: 'readwrite' });
      dirPickerError = 'opened (unexpected without a gesture)';
    } catch (e) {
      dirPickerError = e.name + ': ' + e.message;
    }
  }
  // leave the calibration dialog open so the screenshot shows the guide bar and the dialog
  enterCalibMode();
  clickAt(250, 350);
  await waitFor(() => els.dlgCalib.open);

  out.env = {
    protocol: location.protocol,
    directoryPicker: dirPickerError,
    isSecureContext: window.isSecureContext,
    hasDirectoryPicker: typeof window.showDirectoryPicker === 'function',
    hasOpenFilePicker: typeof window.showOpenFilePicker === 'function',
    hasVideoFrameCallback: typeof HTMLVideoElement.prototype.requestVideoFrameCallback === 'function',
  };
  out.logLines = Array.from(document.querySelectorAll('#log div')).map((d) => d.textContent);
  return JSON.stringify(out);
})()`;

const VIDEO_TEST = `(async () => {
${PRELUDE}
  // record a short clip in-page so the video path runs against a real decoded stream
  const c = document.createElement('canvas');
  c.width = 640; c.height = 480;
  const g = c.getContext('2d');
  const chunks = [];
  const rec = new MediaRecorder(c.captureStream(30), { mimeType: 'video/webm' });
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start();
  const t0 = performance.now();
  await new Promise((resolve) => {
    const draw = () => {
      const t = performance.now() - t0;
      g.fillStyle = '#202028'; g.fillRect(0, 0, 640, 480);
      g.fillStyle = '#f59f00';
      g.fillRect(40 + (t / 2000) * 480, 200, 60, 60);
      if (t < 2000) requestAnimationFrame(draw); else resolve();
    };
    draw();
  });
  rec.stop();
  await new Promise((r) => { rec.onstop = r; });
  const file = new File([new Blob(chunks, { type: 'video/webm' })], 'test_clip.webm', { type: 'video/webm' });

  await loadFiles([file]);
  check('video source loaded', state.source && state.source.kind === 'video', state.source && state.source.kind);
  check('duration resolved -> more than one frame', state.source.frameCount > 1, state.source.frameCount);
  check('fps detected in a plausible range', state.source.fps > 5 && state.source.fps < 200, state.source.fps + ' (' + state.source.fpsSource + ')');
  check('fps control visible for video', !els.fpsGroup.hidden && els.fpsGroup.getBoundingClientRect().width > 0);
  check('video frame is 640x480', state.currentFrame.width === 640 && state.currentFrame.height === 480,
    state.currentFrame.width + 'x' + state.currentFrame.height);

  const idx = Math.min(5, state.source.frameCount - 1);
  await showFrame(idx);
  check('seeking advances the media time', state.frameTimes[idx] > 0, state.frameTimes[idx]);
  check('media time is near the nominal frame time',
    Math.abs(state.frameTimes[idx] - idx / state.source.fps) < 2 / state.source.fps,
    state.frameTimes[idx] + ' vs ' + (idx / state.source.fps));

  await calibrate(100, 400, [0, 0], 500, 100, [12, 9]);
  check('calibration on video', state.transform !== null);
  clickAt(300, 250);
  check('point recorded on the video frame', state.framesRaw[idx].length === 1, state.framesRaw[idx].length);

  const ds = buildDataset();
  check('every frame has a time', ds.frameTimes.filter((t) => typeof t === 'number').length === ds.frameCount, ds.frameCount);
  check('.mat encoded for video', encodeMatV5(buildMatVars(ds)).length > 128);
  const imgs = await renderFrameImages(idx, ds);
  check('video overlay png rendered', imgs[1].data.size > 3000, imgs[1].data.size);
  out.pngs['e2e_video_overlay.png'] = await toB64(imgs[1].data);

  out.logLines = Array.from(document.querySelectorAll('#log div')).map((d) => d.textContent);
  return JSON.stringify(out);
})()`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

/** Minimal read-only static server for the test run. */
function startStaticServer() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(ROOT, rel);
    // never serve anything outside the app folder
    if (!file.startsWith(ROOT + path.sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  server.listen(HTTP_PORT, '127.0.0.1');
  return server;
}

let nextId = 0;
/**
 * @param {WebSocket} ws
 * @param {string} method
 * @param {any} [params]
 */
function cdp(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const onMessage = (/** @type {MessageEvent} */ ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== id) return;
      ws.removeEventListener('message', onMessage);
      if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
      else resolve(msg.result);
    };
    ws.addEventListener('message', onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // The static server only exists to reach the files during this test — the app itself
  // is plain files with no server side. In --file mode nothing is served at all.
  const server = USE_FILE_URL ? null : startStaticServer();
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${path.join(OUT_DIR, '.chrome-profile')}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--autoplay-policy=no-user-gesture-required',
    ...(USE_FILE_URL ? ['--allow-file-access-from-files'] : []),
    '--window-size=1400,900',
    'about:blank',
  ], { stdio: 'ignore' });

  const cleanup = () => {
    try { chrome.kill(); } catch (e) { /* already gone */ }
    try { if (server) server.close(); } catch (e) { /* already gone */ }
  };

  let failed = 0;
  let total = 0;
  try {
    /** @type {any[]|null} */
    let targets = null;
    for (let i = 0; i < 60; i++) {
      await sleep(250);
      try {
        const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        targets = (await r.json()).filter((/** @type {any} */ t) => t.type === 'page');
        if (targets.length) break;
      } catch (e) { /* not up yet */ }
    }
    if (!targets || !targets.length) throw new Error('Chrome did not expose a page target');

    const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', () => res(undefined), { once: true });
      ws.addEventListener('error', () => rej(new Error('CDP websocket failed')), { once: true });
    });

    /** @type {string[]} */
    const pageErrors = [];
    /** @type {string[]} */
    let promptAnswers = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(/** @type {any} */ (ev).data);
      if (msg.method === 'Page.javascriptDialogOpening') {
        const text = msg.params.type === 'prompt' ? (promptAnswers.shift() || '') : '';
        cdp(ws, 'Page.handleJavaScriptDialog', { accept: true, promptText: text }).catch(() => {});
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        pageErrors.push((d.exception && d.exception.description) || d.text);
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        pageErrors.push(msg.params.args.map((/** @type {any} */ a) => a.value || a.description).join(' '));
      }
    });

    await cdp(ws, 'Page.enable');
    await cdp(ws, 'Runtime.enable');

    /**
     * @param {string} title
     * @param {string} expression
     * @param {string[]} answers
     * @param {boolean} screenshot
     */
    const runTest = async (title, expression, answers, screenshot) => {
      promptAnswers = answers.slice();
      await cdp(ws, 'Page.navigate', { url: PAGE_URL });
      await sleep(1200);
      const res = /** @type {any} */ (await cdp(ws, 'Runtime.evaluate', {
        expression, awaitPromise: true, returnByValue: true,
      }));
      if (res.exceptionDetails) {
        const d = res.exceptionDetails;
        throw new Error(`${title}: page threw: ${(d.exception && d.exception.description) || d.text}`);
      }
      const out = JSON.parse(res.result.value);
      console.log(`\n--- ${title} ---`);
      for (const c of out.checks) {
        if (!c.ok) failed++;
        total++;
        console.log(`${c.ok ? '  OK  ' : '  NG  '}${c.name}${c.detail === null ? '' : `  (${c.detail})`}`);
      }
      for (const [name, b64] of Object.entries(out.pngs || {})) {
        fs.writeFileSync(path.join(OUT_DIR, name), Buffer.from(/** @type {string} */ (b64), 'base64'));
      }
      if (screenshot) {
        const shot = /** @type {any} */ (await cdp(ws, 'Page.captureScreenshot', { format: 'png' }));
        fs.writeFileSync(path.join(OUT_DIR, 'e2e_screenshot.png'), Buffer.from(shot.data, 'base64'));
      }
      return out;
    };

    console.log(`page url: ${PAGE_URL}`);
    const imageOut = await runTest('images', IMAGE_TEST, ['0,0', '12,9'], true);
    console.log('\nbrowser environment:');
    for (const [k, v] of Object.entries(imageOut.env || {})) console.log(`  ${k}: ${v}`);
    const videoOut = await runTest('video', VIDEO_TEST, ['0,0', '12,9'], false);

    if (pageErrors.length) {
      console.log('\nPAGE ERRORS:');
      pageErrors.forEach((e) => console.log('  ' + e));
    }
    console.log('\nvideo app log:');
    (videoOut.logLines || []).forEach((/** @type {string} */ l) => console.log('  ' + l));
    const pass = failed === 0 && pageErrors.length === 0;
    console.log(`\nRESULT: ${pass ? 'PASS' : 'FAIL'} (${total - failed}/${total} checks, ${pageErrors.length} page errors)`);
    console.log('artifacts: scratch/e2e_*.png');
    cleanup();
    process.exit(pass ? 0 : 1);
  } catch (err) {
    console.error('E2E ERROR:', /** @type {Error} */ (err).message);
    cleanup();
    process.exit(1);
  }
})();
