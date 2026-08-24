// click-to-get-coord — UI, state and export flow.
//
// Depends on the globals defined by the other scripts loaded before this one:
//   calib.js  points.js  matwriter.js  exporters.js  plot.js  source.js

'use strict';

const APP_VERSION = '1.0.0';

/**
 * @typedef {{x: number, y: number}} Pt
 */

const els = {
  open: /** @type {HTMLButtonElement} */ (document.getElementById('btn-open')),
  loadSession: /** @type {HTMLButtonElement} */ (document.getElementById('btn-load-session')),
  save: /** @type {HTMLButtonElement} */ (document.getElementById('btn-save')),
  fileInput: /** @type {HTMLInputElement} */ (document.getElementById('file-input')),
  sessionInput: /** @type {HTMLInputElement} */ (document.getElementById('session-input')),
  fpsGroup: /** @type {HTMLElement} */ (document.getElementById('fps-group')),
  fpsInput: /** @type {HTMLInputElement} */ (document.getElementById('fps-input')),
  fpsSource: /** @type {HTMLElement} */ (document.getElementById('fps-source')),
  prev: /** @type {HTMLButtonElement} */ (document.getElementById('btn-prev')),
  next: /** @type {HTMLButtonElement} */ (document.getElementById('btn-next')),
  jump: /** @type {HTMLButtonElement} */ (document.getElementById('btn-jump')),
  frameLabel: /** @type {HTMLElement} */ (document.getElementById('frame-label')),
  frameTime: /** @type {HTMLElement} */ (document.getElementById('frame-time')),
  pointCount: /** @type {HTMLElement} */ (document.getElementById('point-count')),
  stage: /** @type {HTMLElement} */ (document.getElementById('stage')),
  canvas: /** @type {HTMLCanvasElement} */ (document.getElementById('canvas')),
  placeholder: /** @type {HTMLElement} */ (document.getElementById('placeholder')),
  log: /** @type {HTMLElement} */ (document.getElementById('log')),
  logbox: /** @type {HTMLElement} */ (document.getElementById('logbox')),
  status: /** @type {HTMLElement} */ (document.getElementById('status')),
  settings: /** @type {HTMLDialogElement} */ (document.getElementById('dlg-settings')),
  help: /** @type {HTMLDialogElement} */ (document.getElementById('dlg-help')),
  btnSettings: /** @type {HTMLButtonElement} */ (document.getElementById('btn-settings')),
  btnHelp: /** @type {HTMLButtonElement} */ (document.getElementById('btn-help')),
  modeButtons: /** @type {HTMLButtonElement[]} */ (Array.from(document.querySelectorAll('button.mode'))),
  setDiameter: /** @type {HTMLInputElement} */ (document.getElementById('set-diameter')),
  setEqualAspect: /** @type {HTMLInputElement} */ (document.getElementById('set-equal-aspect')),
  setMarkerEdge: /** @type {HTMLInputElement} */ (document.getElementById('set-marker-edge')),
  setIndexAuto: /** @type {HTMLInputElement} */ (document.getElementById('set-index-auto')),
  setIndexColor: /** @type {HTMLInputElement} */ (document.getElementById('set-index-color')),
  setCancel: /** @type {HTMLButtonElement} */ (document.getElementById('set-cancel')),
  markerSize: /** @type {HTMLInputElement} */ (document.getElementById('marker-size')),
  zoomIn: /** @type {HTMLButtonElement} */ (document.getElementById('btn-zoom-in')),
  zoomOut: /** @type {HTMLButtonElement} */ (document.getElementById('btn-zoom-out')),
  zoomReset: /** @type {HTMLButtonElement} */ (document.getElementById('btn-zoom-reset')),
  zoomLabel: /** @type {HTMLElement} */ (document.getElementById('zoom-label')),
  setPointColor: /** @type {HTMLInputElement} */ (document.getElementById('set-point-color')),
  setCalibColor: /** @type {HTMLInputElement} */ (document.getElementById('set-calib-color')),
  setSmooth: /** @type {HTMLInputElement} */ (document.getElementById('set-smooth')),
  setShowIndex: /** @type {HTMLInputElement} */ (document.getElementById('set-show-index')),
  setOk: /** @type {HTMLButtonElement} */ (document.getElementById('set-ok')),

  guide: /** @type {HTMLElement} */ (document.getElementById('guide')),
  guideStep: /** @type {HTMLElement} */ (document.getElementById('guide-step')),
  guideText: /** @type {HTMLElement} */ (document.getElementById('guide-text')),
  guideSub: /** @type {HTMLElement} */ (document.getElementById('guide-sub')),

  dlgCalib: /** @type {HTMLDialogElement} */ (document.getElementById('dlg-calib')),
  calibTitle: /** @type {HTMLElement} */ (document.getElementById('calib-title')),
  calibPixel: /** @type {HTMLElement} */ (document.getElementById('calib-pixel')),
  calibNote: /** @type {HTMLElement} */ (document.getElementById('calib-note')),
  calibX: /** @type {HTMLInputElement} */ (document.getElementById('calib-x')),
  calibY: /** @type {HTMLInputElement} */ (document.getElementById('calib-y')),
  calibCancel: /** @type {HTMLButtonElement} */ (document.getElementById('calib-cancel')),

  dlgJump: /** @type {HTMLDialogElement} */ (document.getElementById('dlg-jump')),
  jumpValue: /** @type {HTMLInputElement} */ (document.getElementById('jump-value')),
  jumpRange: /** @type {HTMLElement} */ (document.getElementById('jump-range')),
  jumpCancel: /** @type {HTMLButtonElement} */ (document.getElementById('jump-cancel')),

  dlgConfirm: /** @type {HTMLDialogElement} */ (document.getElementById('dlg-confirm')),
  confirmTitle: /** @type {HTMLElement} */ (document.getElementById('confirm-title')),
  confirmText: /** @type {HTMLElement} */ (document.getElementById('confirm-text')),
  confirmCancel: /** @type {HTMLButtonElement} */ (document.getElementById('confirm-cancel')),
  confirmOk: /** @type {HTMLButtonElement} */ (document.getElementById('confirm-ok')),
};

const state = {
  /** @type {any} */ source: null,
  /** @type {any} */ currentFrame: null,
  frameIndex: 0,
  /** @type {'none'|'calib'|'add'|'del'} */ mode: 'none',
  /** @type {Pt[]} */ calibImg: [],
  /** @type {Pt[]} */ calibReal: [],
  /** @type {any} */ transform: null,
  /**
   * Calibration being entered right now. The committed calibration above stays in force
   * until two new points are confirmed, so an abandoned re-calibration cannot throw the
   * existing one (and every real-world coordinate derived from it) away.
   * @type {{img: Pt[], real: Pt[]}}
   */
  pendingCalib: { img: [], real: [] },
  /** @type {Pt[][]} */ framesRaw: [],
  /** @type {(number|null)[]} */ frameTimes: [],
  settings: {
    /** marker diameter: screen pixels on the canvas, image pixels in the exported overlay */
    diameter: 4,
    pointColor: '#e03131',
    calibColor: '#12b886',
    /** white outline around each marker; its thickness follows the marker size */
    markerEdge: true,
    smooth: false,
    showIndex: true,
    /** point numbers follow the point colour unless indexColorAuto is turned off */
    indexColorAuto: true,
    indexColor: '#1971c2',
    /** keep the exported plot's x and y at the same units-per-pixel */
    equalAspect: false,
  },
  /** canvas view transform, in CSS pixels: image point (ix,iy) -> (tx + ix*scale, ty + iy*scale) */
  view: { scale: 1, tx: 0, ty: 0 },
  dirty: false,
  busy: false,
  /** set when the view should snap back to "whole frame visible" on the next draw */
  needsFit: true,
  /** 1 or 2 while the calibration coordinate dialog is open, 0 otherwise */
  awaitingCalibInput: 0,
};

// --- small helpers -----------------------------------------------------------

/**
 * @param {string} msg
 * @param {'info'|'warn'|'err'} [level]
 */
function log(msg, level = 'info') {
  const div = document.createElement('div');
  if (level !== 'info') div.className = level === 'warn' ? 'warn' : 'err';
  const t = new Date();
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  const ss = String(t.getSeconds()).padStart(2, '0');
  div.textContent = `[${hh}:${mm}:${ss}] ${msg}`;
  els.log.appendChild(div);
  els.logbox.scrollTop = els.logbox.scrollHeight;
}

/** @param {string} text */
function setStatus(text) {
  els.status.textContent = text;
}

/** @param {number} n */
function pad4(n) {
  return String(n).padStart(4, '0');
}

/** ISO 8601 timestamp including the local UTC offset. */
function localIso() {
  const d = new Date();
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const p = (v) => String(Math.floor(Math.abs(v))).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T`
    + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    + `${sign}${p(off / 60)}:${p(off % 60)}`;
}

/** @param {HTMLCanvasElement} canvas */
function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(/** @type {Blob} */ (b)), 'image/png'));
}

/** Colour of the point numbers: the point colour by default. */
function indexColor() {
  return state.settings.indexColorAuto ? state.settings.pointColor : state.settings.indexColor;
}

// --- in-page dialogs ---------------------------------------------------------
// Native prompt() / confirm() / alert() are deliberately not used: Chrome can suppress
// them (and they render as an opaque page-dimming overlay when they do), which leaves the
// user stuck with no way forward. These <dialog> based versions always show up in-page.

/**
 * Move a modal dialog to the corner furthest from the click, so it never covers the
 * point being calibrated. Modal dialogs are centred by `margin: auto`, so overriding
 * the margins is enough to move them.
 * @param {HTMLDialogElement} dialog
 * @param {MouseEvent} [event]
 */
function placeDialogAwayFrom(dialog, event) {
  dialog.classList.remove('pos-left', 'pos-right', 'pos-top', 'pos-bottom');
  if (!event) return;
  dialog.classList.add(event.clientX > window.innerWidth / 2 ? 'pos-left' : 'pos-right');
  dialog.classList.add(event.clientY > window.innerHeight / 2 ? 'pos-top' : 'pos-bottom');
}

/**
 * @param {HTMLDialogElement} dialog
 * @returns {Promise<string>} the value of the button used to close it ('' if dismissed)
 */
function openDialog(dialog) {
  return new Promise((resolve) => {
    const onClose = () => {
      dialog.removeEventListener('close', onClose);
      resolve(dialog.returnValue);
    };
    dialog.addEventListener('close', onClose);
    dialog.returnValue = '';
    dialog.showModal();
  });
}

/**
 * @param {string} text
 * @param {{title?: string, okLabel?: string, cancelLabel?: string}} [opts]
 * @returns {Promise<boolean>}
 */
async function showConfirm(text, opts = {}) {
  els.confirmTitle.textContent = opts.title || '確認';
  els.confirmText.textContent = text;
  els.confirmOk.textContent = opts.okLabel || 'OK';
  els.confirmCancel.textContent = opts.cancelLabel || 'キャンセル';
  els.confirmCancel.hidden = false;
  return (await openDialog(els.dlgConfirm)) === 'ok';
}

/**
 * @param {string} text
 * @param {string} [title]
 * @returns {Promise<void>}
 */
async function showMessage(text, title = 'お知らせ') {
  els.confirmTitle.textContent = title;
  els.confirmText.textContent = text;
  els.confirmOk.textContent = 'OK';
  els.confirmCancel.hidden = true;
  await openDialog(els.dlgConfirm);
  els.confirmCancel.hidden = false;
}

/**
 * Ask for the real-world coordinates of a calibration point.
 * @param {number} pointNo 1 or 2
 * @param {Pt} pixel where the user clicked
 * @param {MouseEvent} [event] the originating click, used to place the dialog
 * @returns {Promise<Pt|null>} null when cancelled
 */
async function askCalibReal(pointNo, pixel, event) {
  els.calibTitle.textContent = `キャリブレーション ${pointNo}点目の実世界座標`;
  els.calibPixel.textContent = `クリック位置（画素）: x = ${pixel.x.toFixed(1)}, y = ${pixel.y.toFixed(1)}`;
  els.calibNote.textContent = pointNo === 1
    ? 'この後もう1点クリックします。2点で座標系が決まります。'
    : '1点目と x も y も異なる点であること。同じだとその軸の倍率を決められません。';
  els.calibX.value = '';
  els.calibY.value = '';
  placeDialogAwayFrom(els.dlgCalib, event);
  const result = await openDialog(els.dlgCalib);
  if (result !== 'ok') return null;
  const x = Number(els.calibX.value);
  const y = Number(els.calibY.value);
  if (!isFinite(x) || !isFinite(y)) return null;
  return { x, y };
}

/**
 * @param {number} max
 * @param {number} current 1-based
 * @returns {Promise<number|null>} 1-based frame number, or null when cancelled
 */
async function askFrameNumber(max, current) {
  els.jumpValue.max = String(max);
  els.jumpValue.value = String(current);
  els.jumpRange.textContent = `1 から ${max} の範囲で指定してください。`;
  const result = await openDialog(els.dlgJump);
  if (result !== 'ok') return null;
  const n = Number(els.jumpValue.value);
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return n;
}

// --- guide bar ---------------------------------------------------------------

/**
 * Say what to do next, in the bar under the toolbar.
 * @param {{step: string, text: string, sub?: string, tone?: 'info'|'warn'|'done'}} g
 */
function setGuide(g) {
  els.guideStep.textContent = g.step;
  els.guideText.textContent = g.text;
  els.guideSub.textContent = g.sub || '';
  els.guide.className = g.tone === 'warn' ? 'warn' : g.tone === 'done' ? 'done' : '';
}

/** Recompute the guide from the current state. */
function updateGuide() {
  if (!state.source) {
    setGuide({
      step: 'STEP 1',
      text: '動画または画像ファイルを開いてください',
      sub: '左上の「開く」ボタン、またはこの画面にドラッグ＆ドロップ（画像は複数選択可）',
    });
    return;
  }

  const nav = state.source.frameCount > 1 ? ' / ← → でフレーム移動' : '';

  if (state.mode === 'calib') {
    if (state.awaitingCalibInput) {
      setGuide({
        step: 'STEP 2',
        text: `${state.awaitingCalibInput}点目の実世界座標を入力してください`,
        sub: 'いま画面に出ているダイアログに、その点の実際の x と y を入れて OK。間違えたらキャンセルして打ち直せます',
      });
      return;
    }
    if (state.pendingCalib.img.length === 0) {
      setGuide({
        step: 'STEP 2',
        text: '実世界の座標が分かっている点を、画像上でクリック（1点目）',
        sub: state.transform
          ? '記録済みの点は消えません。新しい2点が確定するまで今のキャリブレーションが有効で、確定後に全点の実世界座標を計算し直します'
          : 'クリックすると座標を入力する画面が出ます。例: グラフの原点、定規の目盛り、既知の長さの端点など',
      });
    } else {
      setGuide({
        step: 'STEP 2',
        text: '2点目をクリック（1点目と x も y も異なる点）',
        sub: state.transform
          ? '中断したい場合は a キーで Add に戻れば、今のキャリブレーションがそのまま残ります'
          : '例: 1点目が原点なら、x 軸と y 軸のどちらの目盛りも違う点を選ぶ',
      });
    }
    return;
  }

  if (state.mode === 'del') {
    setGuide({
      step: 'DELETE',
      text: '消したい点の近くをクリックすると、いちばん近い点が削除されます',
      sub: `点の追加に戻るには a キー（または Add ボタン）${nav}`,
      tone: 'warn',
    });
    return;
  }

  if (state.mode === 'add') {
    if (!state.transform) {
      setGuide({
        step: '注意',
        text: 'キャリブレーションが未完了です。このまま打つと実世界座標は NaN になります',
        sub: 'c キー（または Calibration ボタン）でやり直せます',
        tone: 'warn',
      });
      return;
    }
    const n = totalPoints(state.framesRaw);
    setGuide({
      step: 'STEP 3',
      text: '記録したい位置をクリックして点を追加',
      sub: n === 0
        ? `間違えたら d キーで削除モード${nav}`
        : `${n} 点を記録済み。終わったら「保存」(Ctrl+S) で出力フォルダを選ぶ${nav}`,
      tone: n === 0 ? 'info' : 'done',
    });
    return;
  }

  setGuide({ step: 'モード', text: 'モードを選んでください', sub: 'Calibration (c) / Add (a) / Delete (d)' });
}

// --- loading -----------------------------------------------------------------

async function pickFiles() {
  const anyWin = /** @type {any} */ (window);
  if (typeof anyWin.showOpenFilePicker === 'function') {
    try {
      const handles = await anyWin.showOpenFilePicker({
        multiple: true,
        types: [{
          description: '動画または画像',
          accept: {
            'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.m4v', '.webm'],
            'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.tif', '.tiff'],
          },
        }],
      });
      return await Promise.all(handles.map((/** @type {any} */ h) => h.getFile()));
    } catch (e) {
      if (/** @type {any} */ (e).name === 'AbortError') return null;
      // fall through to the classic input
    }
  }
  return new Promise((resolve) => {
    els.fileInput.value = '';
    els.fileInput.onchange = () => resolve(Array.from(els.fileInput.files || []));
    els.fileInput.click();
  });
}

/** @param {File[]} files */
async function loadFiles(files) {
  if (!files || files.length === 0) return;
  if (state.dirty && !await showConfirm('保存していないクリック点があります。破棄して新しいファイルを開きますか？',
    { title: '未保存の点があります', okLabel: '破棄して開く' })) return;

  const videos = files.filter((f) => f.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|m4v|webm)$/i.test(f.name));
  const images = files.filter((f) => !videos.includes(f));

  try {
    state.busy = true;
    setStatus('読み込み中...');
    if (state.source) {
      state.source.dispose();
      state.source = null;
    }

    if (videos.length > 0) {
      if (videos.length > 1) log(`動画が複数選択されました。先頭の ${videos[0].name} のみ開きます。`, 'warn');
      state.source = await createVideoSource(videos[0], (m) => log(m));
    } else {
      state.source = await createImageSource(images, (m) => log(m, 'warn'));
    }

    resetAnnotations();
    els.canvas.style.display = 'block';
    els.placeholder.style.display = 'none';
    setEnabled(true);
    updateFpsUi();
    log(`読み込み完了: ${state.source.name} — ${state.source.frameCount} フレーム, ${state.source.width}x${state.source.height} px`);
    enterCalibMode();
    await showFrame(0);
  } catch (err) {
    log(/** @type {Error} */ (err).message, 'err');
    setStatus('読み込みに失敗しました');
    // leave the UI in a consistent "nothing loaded" state rather than pointing at a disposed source
    state.source = null;
    state.currentFrame = null;
    els.canvas.style.display = 'none';
    els.placeholder.style.display = '';
    els.fpsGroup.hidden = true;
    setMode('none');
    updateGuide();
    els.prev.disabled = true;
    els.next.disabled = true;
    els.jump.disabled = true;
    els.save.disabled = true;
    els.loadSession.disabled = true;
    els.zoomIn.disabled = true;
    els.zoomOut.disabled = true;
    els.zoomReset.disabled = true;
    els.modeButtons.forEach((b) => { b.disabled = true; });
  } finally {
    state.busy = false;
  }
}

function resetAnnotations() {
  const n = state.source.frameCount;
  state.framesRaw = Array.from({ length: n }, () => []);
  state.frameTimes = Array.from({ length: n }, (_, i) => (state.source.fps ? i / state.source.fps : null));
  state.calibImg = [];
  state.calibReal = [];
  state.transform = null;
  state.pendingCalib = { img: [], real: [] };
  state.frameIndex = 0;
  state.dirty = false;
  state.needsFit = true;
}

/** @param {boolean} enabled */
function setEnabled(enabled) {
  const multi = enabled && state.source.frameCount > 1;
  els.prev.disabled = !multi;
  els.next.disabled = !multi;
  els.jump.disabled = !multi;
  els.save.disabled = !enabled;
  els.loadSession.disabled = !enabled;
  els.zoomIn.disabled = !enabled;
  els.zoomOut.disabled = !enabled;
  els.zoomReset.disabled = !enabled;
  els.modeButtons.forEach((b) => { b.disabled = !enabled; });
}

function updateFpsUi() {
  const s = state.source;
  if (!s || s.kind !== 'video') {
    els.fpsGroup.hidden = true;
    return;
  }
  els.fpsGroup.hidden = false;
  els.fpsInput.value = String(s.fps);
  els.fpsSource.textContent = s.fpsSource === 'detected' ? '(自動検出)' : '(手動)';
}

// --- display -----------------------------------------------------------------

/** @param {number} index */
async function showFrame(index) {
  if (!state.source) return;
  const clamped = Math.max(0, Math.min(state.source.frameCount - 1, index));
  state.frameIndex = clamped;
  const frame = await state.source.getFrame(clamped);
  state.currentFrame = frame;
  if (frame.time !== null) state.frameTimes[clamped] = frame.time;
  if (state.needsFit) {
    fitView();
    state.needsFit = false;
  }
  redraw();
  updateLabels();
}

/** Size the backing store to the stage, in device pixels. */
function layoutCanvas() {
  const rect = els.stage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (els.canvas.width !== w || els.canvas.height !== h) {
    els.canvas.width = w;
    els.canvas.height = h;
  }
  return { width: rect.width, height: rect.height, dpr };
}

/** Scale at which the whole frame fits in the stage. */
function fitScale() {
  const f = state.currentFrame;
  if (!f) return 1;
  const rect = els.stage.getBoundingClientRect();
  return Math.min(rect.width / f.width, rect.height / f.height) || 1;
}

/** Reset the view so the whole frame is visible and centred. */
function fitView() {
  const f = state.currentFrame;
  if (!f) return;
  const rect = els.stage.getBoundingClientRect();
  const scale = fitScale();
  state.view = {
    scale,
    tx: (rect.width - f.width * scale) / 2,
    ty: (rect.height - f.height * scale) / 2,
  };
}

/** Keep part of the frame on screen, so it can never be panned away completely. */
function clampView() {
  const f = state.currentFrame;
  if (!f) return;
  const rect = els.stage.getBoundingClientRect();
  const margin = 60;
  const w = f.width * state.view.scale;
  const h = f.height * state.view.scale;
  state.view.tx = Math.min(rect.width - margin, Math.max(margin - w, state.view.tx));
  state.view.ty = Math.min(rect.height - margin, Math.max(margin - h, state.view.ty));
}

/**
 * Zoom around a point given in client coordinates, keeping the image point under it fixed.
 * @param {number} clientX
 * @param {number} clientY
 * @param {number} factor
 */
function zoomAt(clientX, clientY, factor) {
  if (!state.currentFrame) return;
  const rect = els.canvas.getBoundingClientRect();
  const px = clientX - rect.left;
  const py = clientY - rect.top;
  const v = state.view;
  const ix = (px - v.tx) / v.scale;
  const iy = (py - v.ty) / v.scale;
  const min = Math.min(0.05, fitScale() * 0.5);
  const next = Math.max(min, Math.min(64, v.scale * factor));
  v.tx = px - ix * next;
  v.ty = py - iy * next;
  v.scale = next;
  clampView();
}

/** Zoom about the centre of the stage — used by the buttons and keyboard. */
function zoomByButton(factor) {
  const rect = els.stage.getBoundingClientRect();
  zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  redraw();
}

function redraw() {
  const f = state.currentFrame;
  if (!f) return;
  const { dpr } = layoutCanvas();
  const v = state.view;
  const ctx = /** @type {CanvasRenderingContext2D} */ (els.canvas.getContext('2d'));

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#101010';
  ctx.fillRect(0, 0, els.canvas.width, els.canvas.height);

  ctx.setTransform(dpr * v.scale, 0, 0, dpr * v.scale, dpr * v.tx, dpr * v.ty);
  // once magnified past 4x, show the real pixels instead of a blurred interpolation
  ctx.imageSmoothingEnabled = v.scale < 4;
  ctx.drawImage(f.image, 0, 0, f.width, f.height);

  const markerStyle = {
    radius: state.settings.diameter / 2,
    pointColor: state.settings.pointColor,
    calibColor: state.settings.calibColor,
    showIndex: state.settings.showIndex,
    edge: state.settings.markerEdge,
    indexColor: indexColor(),
  };
  const points = state.framesRaw[state.frameIndex] || [];
  // markers keep a constant on-screen size at any zoom level
  if (state.mode === 'calib' && state.pendingCalib.img.length > 0) {
    // the calibration still in force is dimmed; the one being entered is solid
    ctx.globalAlpha = 0.3;
    drawMarkers(ctx, [], state.calibImg, markerStyle, v.scale);
    ctx.globalAlpha = 1;
    drawMarkers(ctx, points, state.pendingCalib.img, markerStyle, v.scale);
  } else {
    drawMarkers(ctx, points, state.calibImg, markerStyle, v.scale);
  }

  els.zoomLabel.textContent = `${Math.round(v.scale * 100)}%`;
}

function updateLabels() {
  const s = state.source;
  els.frameLabel.textContent = s ? `${state.frameIndex + 1} / ${s.frameCount}` : '- / -';
  const t = state.frameTimes[state.frameIndex];
  els.frameTime.textContent = t === null || t === undefined ? '' : `t = ${t.toFixed(4)} s`;
  const here = (state.framesRaw[state.frameIndex] || []).length;
  els.pointCount.textContent = `このフレーム ${here} 点 / 全体 ${totalPoints(state.framesRaw)} 点`;
  updateGuide();
}

// --- modes -------------------------------------------------------------------

/** @param {'none'|'calib'|'add'|'del'} mode */
function setMode(mode) {
  state.mode = mode;
  els.modeButtons.forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
}

function enterCalibMode() {
  setMode('calib');
  state.awaitingCalibInput = 0;
  state.pendingCalib = { img: [], real: [] };
  const n = totalPoints(state.framesRaw);
  if (state.transform) {
    log(`Calibration をやり直します。新しい2点が確定するまで今のキャリブレーションは有効なままで、`
      + `記録済みの ${n} 点も消えません（確定時に実世界座標を計算し直します）。`);
  } else {
    log('Calibration モード: 実世界座標が既知の2点をクリックしてください（x も y も異なる2点）。');
  }
  setStatus('Calibration: 1点目をクリック');
  redraw();
  updateGuide();
}

/** Drop a half-finished re-calibration and keep the one already in force. */
function discardPendingCalib() {
  if (state.pendingCalib.img.length === 0) return;
  state.pendingCalib = { img: [], real: [] };
  log(state.transform
    ? 'キャリブレーションのやり直しを中断しました。前のキャリブレーションをそのまま使います。'
    : 'キャリブレーションを中断しました。', 'warn');
}

function enterAddMode() {
  discardPendingCalib();
  setMode('add');
  setStatus('Add: クリックで点を追加');
  redraw();
  updateGuide();
}

function enterDelMode() {
  discardPendingCalib();
  setMode('del');
  setStatus('Delete: 消したい点の近くをクリック');
  redraw();
  updateGuide();
}

// --- clicking ----------------------------------------------------------------

/**
 * @param {MouseEvent} event
 * @returns {Pt}
 */
function eventToImageCoords(event) {
  const rect = els.canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left - state.view.tx) / state.view.scale,
    y: (event.clientY - rect.top - state.view.ty) / state.view.scale,
  };
}

/** @param {MouseEvent} event */
async function onCanvasClick(event) {
  if (!state.source || state.busy) return;
  if (document.querySelector('dialog[open]')) return;
  const f = state.currentFrame;
  const p = eventToImageCoords(event);
  if (!f || p.x < 0 || p.y < 0 || p.x >= f.width || p.y >= f.height) return;

  if (state.mode === 'calib') await handleCalibClick(p, event);
  else if (state.mode === 'add') handleAddClick(p);
  else if (state.mode === 'del') handleDelClick(p);
  else log('モードを選んでからクリックしてください。', 'warn');
}

/**
 * @param {Pt} p
 * @param {MouseEvent} [event] used to place the dialog away from the clicked point
 */
async function handleCalibClick(p, event) {
  state.pendingCalib.img.push(p);
  redraw();
  updateGuide();

  const n = state.pendingCalib.img.length;
  // block further canvas clicks until this point is fully resolved, so a fast second
  // click cannot slip in between the dialog closing and the value being recorded
  state.busy = true;
  state.awaitingCalibInput = n;
  updateGuide();
  setStatus(`Calibration: ${n}点目の実世界座標を入力`);
  let real;
  try {
    real = await askCalibReal(n, p, event);
  } finally {
    state.busy = false;
    state.awaitingCalibInput = 0;
  }
  if (!real) {
    state.pendingCalib.img.pop();
    log(`キャリブレーション ${n} 点目の入力をキャンセルしました。もう一度クリックしてください。`, 'warn');
    redraw();
    updateGuide();
    return;
  }
  state.pendingCalib.real.push(real);
  updateGuide();
  setStatus(state.pendingCalib.img.length >= 2 ? 'Add: クリックで点を追加' : 'Calibration: 2点目をクリック');
  log(`キャリブレーション ${n} 点目: 画素 (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) -> 実世界 (${real.x}, ${real.y})`);

  if (state.pendingCalib.img.length >= 2) {
    const { transform, warnings } = computeTransform(
      /** @type {[Pt, Pt]} */ ([state.pendingCalib.img[0], state.pendingCalib.img[1]]),
      /** @type {[Pt, Pt]} */ ([state.pendingCalib.real[0], state.pendingCalib.real[1]]),
    );
    const replaced = state.transform !== null;
    // commit: from here on this is the calibration every real-world coordinate uses
    state.transform = transform;
    state.calibImg = state.pendingCalib.img.slice();
    state.calibReal = state.pendingCalib.real.slice();
    state.pendingCalib = { img: [], real: [] };
    warnings.forEach((w) => log(w, 'warn'));
    log(`キャリブレーション${replaced ? 'を更新' : '完了'}: scale_x = ${transform.scaleX.toPrecision(6)}, scale_y = ${transform.scaleY.toPrecision(6)} （実世界単位/px）`);
    const n2 = totalPoints(state.framesRaw);
    if (n2 > 0) {
      // real-world coordinates are derived from the raw pixels on demand, so every
      // existing point simply follows the new transform
      log(`記録済みの ${n2} 点の実世界座標を、この変換で計算し直しました。`);
    }
    state.dirty = true;
    setMode('add');
    setStatus('Add: クリックで点を追加');
    redraw();
    updateGuide();
  } else {
    setStatus('Calibration: 2点目をクリック');
  }
}

/** @param {Pt} p */
function handleAddClick(p) {
  const i = state.frameIndex;
  state.framesRaw[i] = addPoint(state.framesRaw[i], p);
  state.dirty = true;
  const real = pixelToReal(state.transform, p.x, p.y);
  const n = state.framesRaw[i].length;
  if (state.transform) {
    log(`[frame ${i + 1} / 点 ${n}] 画素 (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) -> 実世界 (${real.x.toFixed(4)}, ${real.y.toFixed(4)})`);
  } else {
    log(`[frame ${i + 1} / 点 ${n}] 画素 (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) — 未キャリブレーションのため実世界座標は NaN`, 'warn');
  }
  redraw();
  updateLabels();
}

/** @param {Pt} p */
function handleDelClick(p) {
  const i = state.frameIndex;
  const res = deleteNearest(state.framesRaw[i], p.x, p.y);
  if (res.removedIndex < 0) {
    log('このフレームには削除できる点がありません。', 'warn');
    return;
  }
  state.framesRaw[i] = res.points;
  state.dirty = true;
  const r = /** @type {Pt} */ (res.removed);
  log(`[frame ${i + 1}] 点 ${res.removedIndex} を削除: 画素 (${r.x.toFixed(1)}, ${r.y.toFixed(1)})`);
  redraw();
  updateLabels();
}

// --- navigation --------------------------------------------------------------

/** @param {number} delta */
async function step(delta) {
  if (!state.source || state.busy) return;
  const next = state.frameIndex + delta;
  if (next < 0 || next >= state.source.frameCount) return;
  state.busy = true;
  try {
    await showFrame(next);
  } finally {
    state.busy = false;
  }
}

async function jumpDialog() {
  if (!state.source) return;
  const n = await askFrameNumber(state.source.frameCount, state.frameIndex + 1);
  if (n === null) return;
  state.busy = true;
  try {
    await showFrame(n - 1);
  } finally {
    state.busy = false;
  }
}

// --- export ------------------------------------------------------------------

/** @returns {any} */
function buildDataset() {
  const framesReal = state.framesRaw.map((pts) => pts.map((p) => pixelToReal(state.transform, p.x, p.y)));
  return {
    appVersion: APP_VERSION,
    exportedAt: localIso(),
    sourceKind: state.source.kind,
    sourceName: state.source.name,
    sourceFiles: state.source.files,
    width: state.source.width,
    height: state.source.height,
    fps: state.source.fps,
    fpsSource: state.source.fpsSource,
    frameCount: state.source.frameCount,
    frameTimes: state.frameTimes,
    transform: state.transform,
    calibImg: state.calibImg,
    calibReal: state.calibReal,
    framesRaw: state.framesRaw,
    framesReal,
  };
}

/**
 * Render the two PNGs for one frame.
 * @param {number} index
 * @param {any} dataset
 * @returns {Promise<{name: string, data: Blob}[]>}
 */
async function renderFrameImages(index, dataset) {
  const out = [];
  const frame = await state.source.getFrame(index);

  const plotCanvas = document.createElement('canvas');
  plotCanvas.width = 1200;
  plotCanvas.height = 900;
  drawCalibratedPlot(plotCanvas, dataset.framesReal[index], {
    title: `${dataset.sourceName} — frame_index ${index}`
      + (dataset.frameTimes[index] === null || dataset.frameTimes[index] === undefined
        ? '' : ` (t = ${Number(dataset.frameTimes[index]).toFixed(4)} s)`),
    smooth: state.settings.smooth,
    showIndex: state.settings.showIndex,
    pointColor: state.settings.pointColor,
    equalAspect: state.settings.equalAspect,
    indexColor: indexColor(),
  });
  out.push({ name: `plot_frame_${pad4(index)}.png`, data: await canvasToBlob(plotCanvas) });

  const overlayCanvas = document.createElement('canvas');
  drawOverlay(overlayCanvas, frame.image, frame.width, frame.height,
    state.framesRaw[index], state.calibImg, {
      radius: state.settings.diameter / 2,
      pointColor: state.settings.pointColor,
      calibColor: state.settings.calibColor,
      showIndex: state.settings.showIndex,
      edge: state.settings.markerEdge,
      indexColor: indexColor(),
    });
  out.push({ name: `overlay_frame_${pad4(index)}.png`, data: await canvasToBlob(overlayCanvas) });

  return out;
}

async function save() {
  if (!state.source || state.busy) return;
  if (!state.transform) {
    const go = await showConfirm('キャリブレーションがまだです。実世界座標は全て NaN になりますが、保存しますか？',
      { title: 'キャリブレーション未実施', okLabel: 'このまま保存' });
    if (!go) return;
  }
  const total = totalPoints(state.framesRaw);
  if (total === 0) {
    const go = await showConfirm('クリック点が1つもありません。それでも保存しますか？',
      { title: '点がありません', okLabel: 'このまま保存' });
    if (!go) return;
  }

  const anyWin = /** @type {any} */ (window);
  const hasDirPicker = typeof anyWin.showDirectoryPicker === 'function';
  /** @type {any} */
  let dir = null;
  if (hasDirPicker) {
    try {
      dir = await anyWin.showDirectoryPicker({ mode: 'readwrite' });
    } catch (e) {
      if (/** @type {any} */ (e).name === 'AbortError') return;
      log(`フォルダを開けませんでした: ${/** @type {Error} */ (e).message}`, 'err');
      return;
    }
  } else {
    log('このブラウザはフォルダ選択（File System Access API）に対応していません。ファイルを個別にダウンロードします。Chrome / Edge ならフォルダに直接保存できます。', 'warn');
  }

  state.busy = true;
  const restoreIndex = state.frameIndex;
  try {
    const dataset = buildDataset();
    /** @type {{name: string, data: any}[]} */
    const files = [
      { name: 'coords.mat', data: new Blob([encodeMatV5(buildMatVars(dataset))], { type: 'application/octet-stream' }) },
      { name: 'coords.csv', data: new Blob([buildCsv(dataset)], { type: 'text/csv' }) },
      { name: 'session.json', data: new Blob([buildSessionJson(dataset)], { type: 'application/json' }) },
    ];

    const framesWithPoints = [];
    for (let i = 0; i < state.framesRaw.length; i++) {
      if (state.framesRaw[i].length > 0) framesWithPoints.push(i);
    }
    for (let k = 0; k < framesWithPoints.length; k++) {
      const i = framesWithPoints[k];
      setStatus(`画像を生成中... (${k + 1} / ${framesWithPoints.length})`);
      files.push(...await renderFrameImages(i, dataset));
    }

    files.push({
      name: 'README.txt',
      data: new Blob([buildReadme(dataset, files.map((f) => f.name).concat(['README.txt']).sort())], { type: 'text/plain' }),
    });

    if (dir) {
      for (let k = 0; k < files.length; k++) {
        setStatus(`書き出し中... (${k + 1} / ${files.length}) ${files[k].name}`);
        const handle = await dir.getFileHandle(files[k].name, { create: true });
        const writable = await handle.createWritable();
        await writable.write(files[k].data);
        await writable.close();
      }
      log(`保存しました: ${files.length} ファイル（${framesWithPoints.length} フレーム分の PNG を含む）`);
    } else {
      for (const f of files) {
        const url = URL.createObjectURL(f.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = f.name;
        a.click();
        URL.revokeObjectURL(url);
        await new Promise((r) => setTimeout(r, 120));
      }
      log(`${files.length} ファイルをダウンロードしました。`);
    }
    state.dirty = false;
    setStatus('保存が完了しました');
  } catch (err) {
    log(`保存に失敗しました: ${/** @type {Error} */ (err).message}`, 'err');
    setStatus('保存に失敗しました');
  } finally {
    await showFrame(restoreIndex);
    state.busy = false;
  }
}

// --- session reload ----------------------------------------------------------

async function loadSessionFile() {
  els.sessionInput.value = '';
  els.sessionInput.onchange = async () => {
    const file = (els.sessionInput.files || [])[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.format !== 'click-to-get-coord/session') {
        throw new Error('click-to-get-coord の session.json ではありません。');
      }
      if (data.source && data.source.name !== state.source.name) {
        log(`警告: セッションの入力データ名 "${data.source.name}" が、いま開いているデータ "${state.source.name}" と異なります。`, 'warn');
      }
      const n = state.source.frameCount;
      if (data.framesRaw.length !== n) {
        log(`警告: セッションのフレーム数 ${data.framesRaw.length} が現在の ${n} と異なります。重なる範囲だけ復元します。`, 'warn');
      }
      state.framesRaw = Array.from({ length: n }, (_, i) => (data.framesRaw[i] || []).map(
        (/** @type {Pt} */ p) => ({ x: p.x, y: p.y }),
      ));
      if (data.calibration) {
        state.calibImg = data.calibration.imagePoints.map((/** @type {Pt} */ p) => ({ x: p.x, y: p.y }));
        state.calibReal = data.calibration.realPoints.map((/** @type {Pt} */ p) => ({ x: p.x, y: p.y }));
        state.transform = data.calibration.transform;
        enterAddMode();
      } else {
        enterCalibMode();
      }
      if (data.source && Array.isArray(data.source.frameTimes) && data.source.frameTimes.length === n) {
        state.frameTimes = data.source.frameTimes;
      }
      state.dirty = false;
      log(`セッションを復元しました: ${totalPoints(state.framesRaw)} 点`);
      await showFrame(0);
    } catch (err) {
      log(`セッションを読み込めませんでした: ${/** @type {Error} */ (err).message}`, 'err');
    }
  };
  els.sessionInput.click();
}

// --- settings ----------------------------------------------------------------

function openSettings() {
  els.setDiameter.value = String(state.settings.diameter);
  els.setPointColor.value = state.settings.pointColor;
  els.setCalibColor.value = state.settings.calibColor;
  els.setSmooth.checked = state.settings.smooth;
  els.setShowIndex.checked = state.settings.showIndex;
  els.setEqualAspect.checked = state.settings.equalAspect;
  els.setMarkerEdge.checked = state.settings.markerEdge;
  els.setIndexAuto.checked = state.settings.indexColorAuto;
  els.setIndexColor.value = state.settings.indexColor;
  placeDialogAwayFrom(els.settings, undefined);
  els.settings.showModal();
}

function applySettings() {
  setDiameter(Number(els.setDiameter.value));
  state.settings.pointColor = els.setPointColor.value;
  state.settings.calibColor = els.setCalibColor.value;
  state.settings.smooth = els.setSmooth.checked;
  state.settings.showIndex = els.setShowIndex.checked;
  state.settings.equalAspect = els.setEqualAspect.checked;
  state.settings.markerEdge = els.setMarkerEdge.checked;
  state.settings.indexColorAuto = els.setIndexAuto.checked;
  state.settings.indexColor = els.setIndexColor.value;
  redraw();
}

/**
 * Marker diameter, shared by the toolbar box, the settings dialog and the [ ] keys.
 * @param {number} d
 */
function setDiameter(d) {
  if (!isFinite(d)) return;
  state.settings.diameter = Math.max(1, Math.min(40, Math.round(d)));
  els.markerSize.value = String(state.settings.diameter);
  redraw();
}

// --- wiring ------------------------------------------------------------------

els.open.addEventListener('click', async () => {
  const files = await pickFiles();
  if (files) await loadFiles(files);
});
els.loadSession.addEventListener('click', loadSessionFile);
els.save.addEventListener('click', save);
els.prev.addEventListener('click', () => step(-1));
els.next.addEventListener('click', () => step(1));
els.jump.addEventListener('click', jumpDialog);
els.canvas.addEventListener('click', onCanvasClick);
els.btnSettings.addEventListener('click', openSettings);
els.btnHelp.addEventListener('click', () => els.help.showModal());
els.setOk.addEventListener('click', applySettings);

// Cancel buttons are type="button" on purpose: that leaves OK as the only submit button
// in each form, so pressing Enter in a field confirms instead of cancelling.
els.calibCancel.addEventListener('click', () => els.dlgCalib.close('cancel'));
els.jumpCancel.addEventListener('click', () => els.dlgJump.close('cancel'));
els.confirmCancel.addEventListener('click', () => els.dlgConfirm.close('cancel'));
els.setCancel.addEventListener('click', () => els.settings.close('cancel'));

els.markerSize.addEventListener('change', () => setDiameter(Number(els.markerSize.value)));
els.zoomIn.addEventListener('click', () => zoomByButton(1.25));
els.zoomOut.addEventListener('click', () => zoomByButton(1 / 1.25));
els.zoomReset.addEventListener('click', () => { fitView(); redraw(); });

// Trackpad pinch arrives as a wheel event with ctrlKey set; two-finger scroll arrives as
// a plain wheel event. Three-finger gestures never reach the page — macOS keeps them.
els.stage.addEventListener('wheel', (e) => {
  if (!state.currentFrame) return;
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  if (e.ctrlKey || e.metaKey) {
    zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * unit * 0.01));
  } else {
    let dx = e.deltaX * unit;
    let dy = e.deltaY * unit;
    if (e.shiftKey && dx === 0) { dx = dy; dy = 0; } // mouse wheel: shift pans sideways
    state.view.tx -= dx;
    state.view.ty -= dy;
    clampView();
  }
  redraw();
}, { passive: false });

els.modeButtons.forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.mode === 'calib') enterCalibMode();
  else if (b.dataset.mode === 'add') enterAddMode();
  else enterDelMode();
}));

els.fpsInput.addEventListener('change', async () => {
  const v = Number(els.fpsInput.value);
  if (!state.source || !isFinite(v) || v <= 0) return;
  const hadPoints = totalPoints(state.framesRaw) > 0;
  if (hadPoints && !await showConfirm('fps を変えるとフレーム数が変わり、記録済みの点はクリアされます。続けますか？',
    { title: 'fps の変更', okLabel: '変更する' })) {
    updateFpsUi();
    return;
  }
  state.source.setFps(v);
  resetAnnotations();
  updateFpsUi();
  log(`fps を ${v} に変更しました（${state.source.frameCount} フレーム）。記録済みの点はクリアされました。`, 'warn');
  enterCalibMode();
  await showFrame(0);
});

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer ? e.dataTransfer.files : []);
  await loadFiles(files);
});

document.addEventListener('keydown', (e) => {
  const target = /** @type {HTMLElement} */ (e.target);
  if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
  if (document.querySelector('dialog[open]')) return;

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
    e.preventDefault();
    els.open.click();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    save();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  switch (e.key) {
    case 'ArrowRight': case 'x': step(1); break;
    case 'ArrowLeft': case 'z': step(-1); break;
    case '[': setDiameter(state.settings.diameter - 1); break;
    case ']': setDiameter(state.settings.diameter + 1); break;
    case '+': case ';': case '=': zoomByButton(1.25); break;
    case '-': zoomByButton(1 / 1.25); break;
    case '0': fitView(); redraw(); break;
    case 'c': if (state.source) enterCalibMode(); break;
    case 'a': if (state.source) enterAddMode(); break;
    case 'd': if (state.source) enterDelMode(); break;
    case 'j': if (state.source) jumpDialog(); break;
    case 'e': openSettings(); break;
    case 'h': els.help.showModal(); break;
    default: return;
  }
  e.preventDefault();
});

window.addEventListener('resize', () => { clampView(); redraw(); });

window.addEventListener('beforeunload', (e) => {
  if (!state.dirty) return;
  e.preventDefault();
  e.returnValue = '';
});

log(`click-to-get-coord ${APP_VERSION} — 「開く」または画面へのドラッグ＆ドロップで動画・画像を読み込んでください。`);
setStatus('ready');
updateGuide();
els.markerSize.value = String(state.settings.diameter);
