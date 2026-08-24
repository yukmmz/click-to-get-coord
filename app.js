// click-to-get-coord — skeleton
//
// Implemented here: file loading (video or images), canvas rendering, frame navigation,
// and mode switching. Calibration / point add / point delete / export are stubs marked
// with TODO below — see docs/design-notes.md before implementing them.

'use strict';

// TODO: [ASSUMPTION] Frame rate is assumed to be 30 fps because the browser does not
// expose the real fps of a <video>. See docs/design-notes.md section 1.
const ASSUMED_FPS = 30;

const els = {
  fileInput: document.getElementById('file-input'),
  open: document.getElementById('btn-open'),
  prev: document.getElementById('btn-prev'),
  next: document.getElementById('btn-next'),
  save: document.getElementById('btn-save'),
  frameLabel: document.getElementById('frame-label'),
  canvas: document.getElementById('canvas'),
  placeholder: document.getElementById('placeholder'),
  status: document.getElementById('status'),
  modeButtons: Array.from(document.querySelectorAll('#toolbar button.mode')),
};

const ctx = els.canvas.getContext('2d');

const state = {
  source: null,     // { kind: 'video'|'images', frameCount, ... }
  frameIndex: 0,
  mode: 'calib',    // 'calib' | 'add' | 'del'
  calibration: null,  // TODO: {imgA, imgB, realA, realB} -> image->real transform
  points: [],         // TODO: points[frameIndex] = [{x, y}, ...] in image coordinates
};

// --- source abstraction ------------------------------------------------------
// Both a video and a list of images are exposed as an indexable sequence of frames,
// so the rest of the app never branches on the source kind.

function makeVideoSource(file) {
  const video = document.createElement('video');
  video.src = URL.createObjectURL(file);
  video.muted = true;
  return new Promise((resolve, reject) => {
    video.onloadedmetadata = () => {
      const frameCount = Math.max(1, Math.floor(video.duration * ASSUMED_FPS));
      resolve({
        kind: 'video',
        name: file.name,
        frameCount,
        width: video.videoWidth,
        height: video.videoHeight,
        seek(index) {
          return new Promise((res) => {
            video.onseeked = () => res(video);
            video.currentTime = Math.min(index / ASSUMED_FPS, Math.max(0, video.duration - 1e-3));
          });
        },
      });
    };
    video.onerror = () => reject(new Error('動画を読み込めませんでした: ' + file.name));
  });
}

function makeImageSource(files) {
  const sorted = Array.from(files).sort((a, b) => a.name.localeCompare(b.name));
  const loads = sorted.map((file) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像を読み込めませんでした: ' + file.name));
    img.src = URL.createObjectURL(file);
  }));
  return Promise.all(loads).then((images) => ({
    kind: 'images',
    name: sorted.length === 1 ? sorted[0].name : `${sorted.length} images`,
    frameCount: images.length,
    width: images[0].naturalWidth,
    height: images[0].naturalHeight,
    seek(index) { return Promise.resolve(images[index]); },
  }));
}

// --- rendering ---------------------------------------------------------------

async function render() {
  if (!state.source) return;
  const frame = await state.source.seek(state.frameIndex);
  els.canvas.width = state.source.width;
  els.canvas.height = state.source.height;
  ctx.drawImage(frame, 0, 0, els.canvas.width, els.canvas.height);
  drawOverlay();
  updateFrameLabel();
}

function drawOverlay() {
  // TODO: draw recorded points and calibration markers for the current frame.
}

function updateFrameLabel() {
  const n = state.source ? state.source.frameCount : 0;
  els.frameLabel.textContent = state.source ? `${state.frameIndex + 1} / ${n}` : '- / -';
}

function setStatus(text) { els.status.textContent = text; }

// --- loading -----------------------------------------------------------------

async function loadFiles(files) {
  if (!files || files.length === 0) return;
  const list = Array.from(files);
  const isVideo = list[0].type.startsWith('video/');
  try {
    setStatus('読み込み中...');
    state.source = isVideo ? await makeVideoSource(list[0]) : await makeImageSource(list);
    state.frameIndex = 0;
    state.points = [];
    state.calibration = null;
    els.canvas.style.display = 'block';
    els.placeholder.style.display = 'none';
    setEnabled(true);
    setMode('calib');
    await render();
    setStatus(`${state.source.name} — ${state.source.frameCount} frames`
      + (state.source.kind === 'video' ? `（${ASSUMED_FPS} fps と仮定）` : ''));
  } catch (err) {
    setStatus(err.message);
  }
}

function setEnabled(enabled) {
  const multiFrame = enabled && state.source.frameCount > 1;
  els.prev.disabled = !multiFrame;
  els.next.disabled = !multiFrame;
  els.save.disabled = !enabled;
  els.modeButtons.forEach((b) => { b.disabled = !enabled; });
}

// --- navigation & modes ------------------------------------------------------

function step(delta) {
  if (!state.source) return;
  const next = state.frameIndex + delta;
  if (next < 0 || next >= state.source.frameCount) return;
  state.frameIndex = next;
  render();
}

function setMode(mode) {
  state.mode = mode;
  els.modeButtons.forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
}

function canvasToImageCoords(event) {
  const rect = els.canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (els.canvas.width / rect.width),
    y: (event.clientY - rect.top) * (els.canvas.height / rect.height),
  };
}

function onCanvasClick(event) {
  if (!state.source) return;
  const p = canvasToImageCoords(event);
  // TODO: dispatch on state.mode —
  //   'calib': collect two points, prompt for real-world coordinates, build the transform
  //   'add'  : append the point to state.points[state.frameIndex]
  //   'del'  : remove the nearest point on the current frame
  setStatus(`[${state.mode}] clicked at (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) — 未実装`);
}

function onSave() {
  // TODO: export state.points (image coords + real-world coords) as JSON / CSV.
  setStatus('保存は未実装です');
}

// --- wiring ------------------------------------------------------------------

els.open.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', (e) => loadFiles(e.target.files));
els.prev.addEventListener('click', () => step(-1));
els.next.addEventListener('click', () => step(1));
els.save.addEventListener('click', onSave);
els.canvas.addEventListener('click', onCanvasClick);
els.modeButtons.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  loadFiles(e.dataTransfer.files);
});

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  switch (e.key) {
    case 'ArrowRight': case 'x': step(1); break;
    case 'ArrowLeft': case 'z': step(-1); break;
    case 'c': if (state.source) setMode('calib'); break;
    case 'a': if (state.source) setMode('add'); break;
    case 'd': if (state.source) setMode('del'); break;
    default: return;
  }
  e.preventDefault();
});

setMode('calib');
